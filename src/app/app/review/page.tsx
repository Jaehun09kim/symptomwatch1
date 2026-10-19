import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, Info } from "lucide-react";
import { FlagStatusBadge } from "@/components/app/primitives/badges";
import { FlagCard } from "@/components/app/primitives/flag-card";
import { EmptyState, PageHeader } from "@/components/app/primitives/layout";
import { formatTimelineDate } from "@/components/app/primitives/timeline-item";
import { MobileReviewFilters } from "@/components/app/review/mobile-filters";
import { listPatients } from "@/lib/services/patients";
import { FlagReviewActions, RunDetectionButton } from "@/components/app/review/flag-review";
import { requirePermission } from "@/lib/auth/current";
import { can } from "@/lib/authz/permissions";
import { RULES_VERSION, type RuleId } from "@/lib/detection/types";
import { dismissReasonLabel, dismissReasonShortLabel, flagStatusLabel, ruleLabel, ruleShortLabel } from "@/lib/labels";
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
  const selected = flags.find((flag) => flag.id === one(params.flag)) ?? flags[0];
  // Canonical selection also advances the workspace when a decision removes a flag from this filter.
  if (selected && one(params.flag) !== selected.id) redirect(href(params, { flag: selected.id }));
  const selectedIndex = selected ? flags.findIndex((flag) => flag.id === selected.id) : -1;
  const previous = flags[selectedIndex - 1];
  const next = flags[selectedIndex + 1];
  const hasPatients = Boolean(selected) || (await listPatients(ctx)).total > 0;
  const filtered = status !== "open" || Boolean(ruleId);
  const history = await getFlagHistory(ctx, selected ? [selected.id] : []);
  const assignees = members.filter((member) => member.status === "active").map(({ userId, displayName, role }) => ({ userId, displayName, role }));
  const feedbackByRule = RULE_IDS.map((rule) => ({
    rule,
    rows: feedback.filter((row) => row.ruleId === rule),
  })).filter((entry) => entry.rows.length);

  return (
    <div className="space-y-5 pb-40 md:pb-0">
      <PageHeader
        title="Review flags"
        description="Possible documentation gaps found by transparent rules. Each one shows its evidence and needs a physician's judgment."
        actions={can(session.role, "detection.run") ? <RunDetectionButton /> : null}
      />
      <div className="space-y-2 border-y border-border py-3 text-[0.8125rem] leading-relaxed text-body">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-body" aria-hidden />
          <span>Listed by when first detected — <strong className="text-navy">not by urgency</strong>. Flags are documentation questions, not diagnoses, and never change care plans or contact patients.</span>
        </p>
        <p className="shrink-0 text-xs text-body">
          {lastRun
            ? `Last run ${new Date(lastRun.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · ${lastRun.patientsEvaluated} patient${lastRun.patientsEvaluated === 1 ? "" : "s"} · ${lastRun.findingsCount} finding${lastRun.findingsCount === 1 ? "" : "s"}`
            : "Not run yet"}
          {` · rules v${RULES_VERSION} · external AI off`}
        </p>
      </div>
      {!canReview ? (
        <p className="border-l-2 border-brand bg-brand-soft px-4 py-2.5 text-sm text-brand-hover">
          You can view flags and run detection. Confirming, dismissing, and feedback are reserved for physicians.
        </p>
      ) : null}

      <MobileReviewFilters status={status} rule={ruleId ?? ""}
        statuses={STATUSES.map((value) => ({ value, label: statusTabLabel(value) }))}
        rules={RULE_IDS.map((value) => ({ value, label: ruleShortLabel[value] }))} />
      <div className="hidden space-y-2 md:block">
        <nav aria-label="Flag status" className="overflow-x-auto border-b border-border">
          <ul className="flex min-w-max gap-x-4">
            {STATUSES.map((value) => (
              <li key={value}>
                <Link href={href(params, { status: value === "open" ? undefined : value, flag: undefined })} aria-current={status === value ? "page" : undefined}
                  className={cn("inline-flex min-h-11 items-center border-b-2 px-1 text-sm font-medium transition-colors duration-150 focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-brand", status === value ? "border-brand text-brand-hover" : "border-transparent text-body hover:border-input hover:text-navy")}>
                  {statusTabLabel(value)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Rule">
          <ul className="flex flex-wrap gap-1">
            <li><Link href={href(params, { rule: undefined, flag: undefined })} aria-current={!ruleId ? "page" : undefined}
              className={cn("inline-flex min-h-10 items-center rounded-md px-3 text-xs font-medium transition-colors duration-150", !ruleId ? "bg-brand-soft text-brand-hover ring-1 ring-inset ring-brand/20" : "text-body hover:bg-surface")}>All rules</Link></li>
            {RULE_IDS.map((rule) => (
              <li key={rule}><Link href={href(params, { rule, flag: undefined })} aria-current={ruleId === rule ? "page" : undefined}
                className={cn("inline-flex min-h-10 items-center rounded-md px-3 text-xs font-medium transition-colors duration-150", ruleId === rule ? "bg-brand-soft text-brand-hover ring-1 ring-inset ring-brand/20" : "text-body hover:bg-surface")}>{ruleShortLabel[rule]}</Link></li>
            ))}
          </ul>
        </nav>
      </div>

      <p className="text-xs text-body">{flags.length} flag{flags.length === 1 ? "" : "s"} · Fictional patient records</p>
      {!selected ? (
        <EmptyState icon={ClipboardCheck}
          title={!hasPatients ? "No patient records yet" : !lastRun ? "Detection has not run yet" : filtered ? "No flags match these filters" : "All caught up"}
          description={!hasPatients ? "Import fictional records before checking for documentation gaps." : !lastRun ? "Run detection to find documentation gaps in the imported records." : filtered ? "Clear the filters to return to flags awaiting review." : "No flags are awaiting review. Run detection after records change to look for new gaps."}
          action={!hasPatients ? <Link href="/app/import" className="inline-flex min-h-11 items-center text-brand underline">Import records</Link> : lastRun && filtered ? <Link href="/app/review" className="inline-flex min-h-11 items-center text-brand underline">Clear filters</Link> : <RunDetectionButton />} />
      ) : (
        <div className="grid items-start gap-6 md:grid-cols-[minmax(14rem,2fr)_minmax(0,3fr)] [&>*]:min-w-0">
          <section id="flag-detail" aria-label="Selected flag" tabIndex={-1} className="scroll-mt-16 rounded-lg border border-border bg-card md:sticky md:top-[calc(var(--banner-h,2rem)+1rem)] md:col-start-2 md:row-start-1 md:max-h-[calc(100vh-var(--banner-h,2rem)-2rem)] md:overflow-y-auto">
            <div key={selected.id}>
              <nav aria-label="Review position" className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-1 text-sm text-body">
                {previous ? <Link href={`${href(params, { flag: previous.id })}#flag-detail`} className="inline-flex min-h-11 items-center text-brand underline">Previous</Link> : <span className="text-body" aria-disabled="true">Previous</span>}
                <span className="tabular-nums">{selectedIndex + 1} of {flags.length}</span>
                {next ? <Link href={`${href(params, { flag: next.id })}#flag-detail`} className="inline-flex min-h-11 items-center text-brand underline">Next</Link> : <span className="text-body" aria-disabled="true">Next</span>}
              </nav>
              <div className="space-y-1 border-b border-border px-4 pb-4 pt-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="section-heading text-2xl"><Link href={`/app/patients/${selected.patientId}`} className="rounded-sm text-navy underline-offset-4 hover:text-brand hover:underline">{selected.patientName}</Link></h2>
                  <a href="#flag-list" className="inline-flex min-h-11 items-center text-sm text-brand underline underline-offset-4">Browse flags</a>
                </div>
                <p className="text-xs text-body"><span className="font-mono">{selected.patientMrn}</span>{selected.physicianName ? ` · ${selected.physicianName}` : ""} · first detected {formatTimelineDate(selected.firstDetectedAt)}</p>
              </div>
              <FlagCard
                className="rounded-b-lg rounded-t-none border-0"
                snoozedUntil={selected.isSnoozed && selected.snoozedUntil ? formatTimelineDate(selected.snoozedUntil) : undefined}
                status={selected.status}
                showStatus={status === "all" || selected.isSnoozed}
                ruleLabel={ruleLabel[selected.ruleId]}
                ruleVersion={selected.ruleVersion}
                title={selected.title}
                rationale={selected.rationale}
                evidence={selected.evidence.map((item) => ({ label: item.label, date: item.date, href: `/app/patients/${selected.patientId}#${anchorFor(item.kind, item.id)}` }))}
                missing={selected.missingInfo}
                footer={
                  <div className="space-y-3">
                    {selected.status === "dismissed" && selected.reviewReason ? (
                      <p className="text-sm text-body"><span className="font-medium text-navy">Dismissed:</span> {dismissReasonLabel[selected.reviewReason]}{selected.reviewNote ? ` — ${selected.reviewNote}` : ""}{selected.reviewerName ? ` (${selected.reviewerName})` : ""}</p>
                    ) : selected.reviewNote ? (
                      <p className="text-sm text-body"><span className="font-medium text-navy">{selected.status === "dismissed" ? "Dismissal reason" : "Review note"}:</span> {selected.reviewNote}{selected.reviewerName ? ` — ${selected.reviewerName}` : ""}</p>
                    ) : null}
                    {selected.isSnoozed && selected.snoozedUntil ? (
                      <p className="text-sm text-body">Snoozed{selected.snoozedByName ? ` by ${selected.snoozedByName}` : ""}{selected.snoozeNote ? ` — ${selected.snoozeNote}` : ""}. Returns sooner if the record changes.</p>
                    ) : null}
                    {history[selected.id]?.length ? (
                      <details className="text-xs text-body">
                        <summary className="cursor-pointer select-none py-2 font-medium text-navy">Review history ({history[selected.id].length})</summary>
                        <ol className="mt-2 space-y-1 border-l border-border pl-3">
                          {history[selected.id].map((entry, index) => (
                            <li key={index}>
                              <span className="tabular-nums text-body">{new Date(entry.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>{" "}
                              · {EVENT_LABEL[entry.eventType] ?? entry.eventType}{entry.actorName ? ` by ${entry.actorName}` : " (automatic)"}{entry.note ? ` — ${entry.note}` : ""}
                            </li>
                          ))}
                        </ol>
                      </details>
                    ) : null}
                    {canReview ? <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:z-auto md:border-0 md:p-0">
                      <p className="mb-2 truncate text-xs text-body md:hidden" title={`${selected.patientName} · ${selected.title}`}>Reviewing {selected.patientName} · {selected.title}</p>
                      <FlagReviewActions flagId={selected.id} status={selected.status} title={selected.title} ruleId={selected.ruleId} reviewerId={ctx.userId} assignees={assignees} snoozed={selected.isSnoozed} />
                    </div> : null}
                  </div>
                }
              />
            </div>
          </section>
          <nav id="flag-list" aria-label="Flags" tabIndex={-1} className="scroll-mt-16 md:col-start-1 md:row-start-1">
            <h2 className="border-b border-border pb-3 text-sm font-semibold">Select a flag</h2>
            <ul className="divide-y divide-border border-b border-border">
              {flags.map((flag) => (
                <li key={flag.id}>
                  <Link href={`${href(params, { flag: flag.id })}#flag-detail`} aria-current={selected.id === flag.id ? "true" : undefined}
                    className={cn("block min-w-0 space-y-1.5 border-l-2 px-3 py-3 transition-colors duration-150 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-brand focus-visible:-outline-offset-2", selected.id === flag.id ? "border-brand bg-brand-soft" : "border-transparent hover:bg-surface")}>
                    <span className="block text-sm font-semibold text-navy">{flag.patientName}</span>
                    <span className="line-clamp-2 text-sm leading-relaxed text-body" title={flag.title}>{flag.title}</span>
                    <span className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-body">
                      <span>{ruleShortLabel[flag.ruleId]}</span>
                      <span>Detected <time dateTime={flag.firstDetectedAt} className="tabular-nums">{formatTimelineDate(flag.firstDetectedAt)}</time></span>
                    </span>
                    {/* Inside a single-status tab every row would repeat the tab name; show status only where it differs. */}
                    {status === "all" || flag.isSnoozed ? (
                      <FlagStatusBadge status={flag.status} snoozedUntil={flag.isSnoozed && flag.snoozedUntil ? formatTimelineDate(flag.snoozedUntil) : undefined} />
                    ) : null}
                    {flag.status === "dismissed" && flag.reviewReason ? <span className="block text-xs text-body">{dismissReasonShortLabel[flag.reviewReason]}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}

      <aside aria-label="About detection" className="grid gap-6 border-t border-border pt-6 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold">How the rules work</h2>
          <ul className="mt-2 space-y-2 text-sm text-body">
            {RULE_IDS.map((rule) => (
              <li key={rule}>
                <strong className="text-navy">{ruleShortLabel[rule]}{off.has(rule) ? " (turned off)" : ""}:</strong> {describeRule(rule, settings)}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm"><Link href="/app/rules" className="font-medium text-brand hover:underline">{settings.isDefault ? "Default settings" : "This clinic's settings"} · adjust rules and see signal quality</Link></p>
          <p className="mt-3 text-xs text-body">Known limits: free-text plans and differently worded symptoms aren&rsquo;t understood in v1.</p>
        </section>
        <section>
          <h2 className="text-sm font-semibold">Clinician feedback</h2>
          {feedbackByRule.length ? (
            <ul className="mt-2 space-y-2 text-sm">
              {feedbackByRule.map(({ rule, rows }) => (
                <li key={rule}>
                  <p className="font-medium text-navy">{ruleShortLabel[rule]}</p>
                  <p className="text-xs text-body">{rows.map((row) => `${row.verdict.replace("_", " ")}: ${row.count}`).join(" · ")}</p>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-body">No feedback yet. Use “Feedback” on a flag to rate it.</p>}
        </section>
      </aside>
    </div>
  );
}

export default function ReviewPage(props: PageProps<"/app/review">) {
  return (
    <Suspense fallback={<div className="space-y-4"><div className="h-12 animate-pulse rounded-md bg-surface" /><div className="h-96 animate-pulse rounded-md bg-surface" /></div>}>
      <Review searchParams={props.searchParams} />
    </Suspense>
  );
}
