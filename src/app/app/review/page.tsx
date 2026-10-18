import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, Info } from "lucide-react";
import { FictionalTag } from "@/components/app/primitives/badges";
import { FlagCard } from "@/components/app/primitives/flag-card";
import { EmptyState, PageHeader } from "@/components/app/primitives/layout";
import { formatTimelineDate } from "@/components/app/primitives/timeline-item";
import { FlagReviewActions, RunDetectionButton } from "@/components/app/review/flag-review";
import { requirePermission } from "@/lib/auth/current";
import { can } from "@/lib/authz/permissions";
import { RULES_VERSION, type RuleId } from "@/lib/detection/types";
import { dismissReasonShortLabel, flagStatusLabel, ruleLabel, ruleShortLabel, type FlagStatus } from "@/lib/labels";
import { feedbackSummary, getFlagHistory, getLastRun, listFlags, type FlagQuery } from "@/lib/services/detection";
import { getRuleSettings } from "@/lib/services/rule-settings";
import { listMembers } from "@/lib/services/members";
import { describeRule } from "@/lib/rule-descriptions";
import { anchorFor } from "@/lib/timeline";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Review flags" };

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);
type StatusTab = NonNullable<FlagQuery["status"]>;
const STATUSES: StatusTab[] = ["open", "snoozed", "confirmed", "dismissed", "resolved_by_data", "all"];
const statusTabLabel = (value: StatusTab) => value === "all" ? "All" : value === "snoozed" ? "Snoozed" : flagStatusLabel[value];
const RULE_IDS = Object.keys(ruleLabel) as RuleId[];

const EVENT_LABEL: Record<string, string> = {
  created: "Detected",
  updated: "Evidence updated",
  confirmed: "Confirmed",
  dismissed: "Dismissed",
  reopened: "Reopened",
  reopened_evidence_changed: "Reopened — record changed after dismissal",
  resolved_by_data: "Resolved by new documentation",
  feedback: "Feedback",
  snoozed: "Snoozed",
  unsnoozed: "Back in the queue",
  suppressed: "Parked — rule turned off",
};

function href(params: Params, changes: Record<string, string | undefined>): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (typeof value === "string") next.set(key, value);
  for (const [key, value] of Object.entries(changes)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  return next.size ? `/app/review?${next}` : "/app/review";
}

async function Review({ searchParams }: { searchParams: Promise<Params> }) {
  const [{ ctx, session }, params] = await Promise.all([requirePermission("flag.read"), searchParams]);
  const statusParam = one(params.status) as StatusTab | undefined;
  const status = statusParam && STATUSES.includes(statusParam) ? statusParam : "open";
  const ruleParam = one(params.rule) as RuleId | undefined;
  const ruleId = ruleParam && RULE_IDS.includes(ruleParam) ? ruleParam : undefined;
  const canReview = can(session.role, "flag.review");

  const [flags, lastRun, members, feedback, settings] = await Promise.all([
    listFlags(ctx, { status, ruleId }),
    getLastRun(ctx),
    listMembers(ctx),
    feedbackSummary(ctx),
    getRuleSettings(ctx),
  ]);
  const off = new Set(settings.disabledRules);
  const history = await getFlagHistory(ctx, flags.map((flag) => flag.id));
  const assignees = members.filter((member) => member.status === "active").map(({ userId, displayName, role }) => ({ userId, displayName, role }));
  const feedbackByRule = RULE_IDS.map((rule) => ({
    rule,
    rows: feedback.filter((row) => row.ruleId === rule),
  })).filter((entry) => entry.rows.length);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Review flags"
        description="Possible documentation gaps found by transparent rules. Each one shows its evidence and needs a physician's judgment."
        actions={can(session.role, "detection.run") ? <RunDetectionButton /> : null}
      />
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-body md:flex-row md:items-center md:justify-between">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
          <span>Listed by when first detected — <strong className="text-navy">not by urgency</strong>. Flags are documentation questions, not diagnoses, and never change care plans or contact patients.</span>
        </p>
        <p className="shrink-0 text-xs text-slate-500">
          {lastRun
            ? `Last run ${new Date(lastRun.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · ${lastRun.patientsEvaluated} patient${lastRun.patientsEvaluated === 1 ? "" : "s"} · ${lastRun.findingsCount} finding${lastRun.findingsCount === 1 ? "" : "s"}`
            : "Not run yet"}
          {` · rules v${RULES_VERSION} · external AI off`}
        </p>
      </div>
      {!canReview ? (
        <p className="rounded-[10px] border border-brand/20 bg-brand-soft px-4 py-2.5 text-sm text-brand-hover">
          You can view flags and run detection. Confirming, dismissing, and feedback are reserved for physicians.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <nav aria-label="Flag status" className="-mx-1 overflow-x-auto">
          <ul className="flex min-w-max gap-1 px-1">
            {STATUSES.map((value) => (
              <li key={value}>
                <Link href={href(params, { status: value === "open" ? undefined : value })} aria-current={status === value ? "page" : undefined}
                  className={cn("inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium", status === value ? "bg-navy text-white" : "text-slate-600 hover:bg-surface hover:text-navy")}>
                  {statusTabLabel(value)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Rule">
          <ul className="flex flex-wrap gap-1">
            <li><Link href={href(params, { rule: undefined })} aria-current={!ruleId ? "page" : undefined}
              className={cn("inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium", !ruleId ? "border-brand/30 bg-brand-soft text-brand-hover" : "border-border text-slate-600")}>All rules</Link></li>
            {RULE_IDS.map((rule) => (
              <li key={rule}><Link href={href(params, { rule })} aria-current={ruleId === rule ? "page" : undefined}
                className={cn("inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium", ruleId === rule ? "border-brand/30 bg-brand-soft text-brand-hover" : "border-border text-slate-600")}>{ruleShortLabel[rule]}</Link></li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] [&>*]:min-w-0">
        <section aria-label="Flags" className="space-y-4">
          <p className="text-sm text-slate-500">{flags.length} flag{flags.length === 1 ? "" : "s"}</p>
          {flags.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="Nothing to review here" description="No flags match these filters. Run detection after records change to look for new gaps." />
          ) : flags.map((flag) => (
            <div key={flag.id} className="space-y-0">
              <div className="flex flex-wrap items-center gap-2 rounded-t-xl border border-b-0 border-border bg-surface px-4 py-2 text-sm">
                <Link href={`/app/patients/${flag.patientId}`} className="font-medium text-brand hover:underline">{flag.patientName}</Link>
                <FictionalTag />
                <span className="text-slate-500">{flag.patientMrn}{flag.physicianName ? ` · ${flag.physicianName}` : ""} · first detected {formatTimelineDate(flag.firstDetectedAt)}</span>
              </div>
              <FlagCard
                className="rounded-t-none"
                status={flag.status}
                ruleLabel={ruleLabel[flag.ruleId]}
                ruleVersion={flag.ruleVersion}
                title={flag.title}
                rationale={flag.rationale}
                evidence={flag.evidence.map((item) => ({ label: item.label, date: item.date, href: `/app/patients/${flag.patientId}#${anchorFor(item.kind, item.id)}` }))}
                missing={flag.missingInfo}
                footer={
                  <div className="space-y-3">
                    {flag.status === "dismissed" && flag.reviewReason ? (
                      <p className="text-sm text-body"><span className="font-medium text-navy">Dismissed:</span> {dismissReasonShortLabel[flag.reviewReason]}{flag.reviewNote ? ` — ${flag.reviewNote}` : ""}{flag.reviewerName ? ` (${flag.reviewerName})` : ""}</p>
                    ) : flag.reviewNote ? (
                      <p className="text-sm text-body"><span className="font-medium text-navy">{flag.status === "dismissed" ? "Dismissal reason" : "Review note"}:</span> {flag.reviewNote}{flag.reviewerName ? ` — ${flag.reviewerName}` : ""}</p>
                    ) : null}
                    {flag.isSnoozed && flag.snoozedUntil ? (
                      <p className="text-sm text-body"><span className="font-medium text-navy">Snoozed until {formatTimelineDate(flag.snoozedUntil)}</span>{flag.snoozedByName ? ` by ${flag.snoozedByName}` : ""}{flag.snoozeNote ? ` — ${flag.snoozeNote}` : ""}. Returns sooner if the record changes.</p>
                    ) : null}
                    {history[flag.id]?.length ? (
                      <details className="text-xs text-slate-600">
                        <summary className="cursor-pointer select-none font-medium text-slate-700">Review history ({history[flag.id].length})</summary>
                        <ol className="mt-2 space-y-1 border-l border-border pl-3">
                          {history[flag.id].map((entry, index) => (
                            <li key={index}>
                              <span className="tabular-nums text-slate-500">{new Date(entry.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>{" "}
                              · {EVENT_LABEL[entry.eventType] ?? entry.eventType}{entry.actorName ? ` by ${entry.actorName}` : " (automatic)"}{entry.note ? ` — ${entry.note}` : ""}
                            </li>
                          ))}
                        </ol>
                      </details>
                    ) : null}
                    {canReview ? <FlagReviewActions flagId={flag.id} status={flag.status} title={flag.title} assignees={assignees} snoozed={flag.isSnoozed} /> : null}
                  </div>
                }
              />
            </div>
          ))}
        </section>
        <aside className="space-y-4">
          <section className="rounded-xl border border-border bg-white p-4 shadow-soft">
            <h2 className="text-sm font-semibold">How the rules work</h2>
            <ul className="mt-2 space-y-2 text-sm text-body">
              {RULE_IDS.map((rule) => (
                <li key={rule}>
                  <strong className="text-navy">{ruleShortLabel[rule]}{off.has(rule) ? " (turned off)" : ""}:</strong> {describeRule(rule, settings)}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm"><Link href="/app/rules" className="font-medium text-brand hover:underline">{settings.isDefault ? "Default settings" : "This clinic's settings"} · adjust rules and see signal quality</Link></p>
            <p className="mt-3 text-xs text-slate-500">Known limits: free-text plans and differently worded symptoms aren&rsquo;t understood in v1.</p>
          </section>
          <section className="rounded-xl border border-border bg-white p-4 shadow-soft">
            <h2 className="text-sm font-semibold">Clinician feedback</h2>
            {feedbackByRule.length ? (
              <ul className="mt-2 space-y-2 text-sm">
                {feedbackByRule.map(({ rule, rows }) => (
                  <li key={rule}>
                    <p className="font-medium text-navy">{ruleShortLabel[rule]}</p>
                    <p className="text-xs text-slate-600">{rows.map((row) => `${row.verdict.replace("_", " ")}: ${row.count}`).join(" · ")}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-slate-500">No feedback yet. Use “Feedback” on a flag to rate it.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function ReviewPage(props: PageProps<"/app/review">) {
  return (
    <Suspense fallback={<div className="space-y-4"><div className="h-12 animate-pulse rounded-xl bg-surface" /><div className="h-96 animate-pulse rounded-xl bg-surface" /></div>}>
      <Review searchParams={props.searchParams} />
    </Suspense>
  );
}
