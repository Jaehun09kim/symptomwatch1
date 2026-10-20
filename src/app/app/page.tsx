import { Suspense } from "react";
import Link from "next/link";
import { ClipboardCheck, Inbox, ShieldCheck } from "lucide-react";
import { HorizontalBarChart, WeeklyTrendChart } from "@/components/charts/dashboard-charts";
import { PatientsPanel } from "@/components/app/patients/patients-panel";
import { EmptyState, PageHeader } from "@/components/app/primitives/layout";
import { StatCard } from "@/components/app/primitives/stat-card";
import { DataFreshness } from "@/components/app/primitives/data-freshness";
import { getLastSuccessfulImport } from "@/lib/services/imports";
import { requireSession, toAppContext } from "@/lib/auth/current";
import { can } from "@/lib/authz/permissions";
import { formatTimelineDate } from "@/components/app/primitives/timeline-item";
import { RunDetectionButton } from "@/components/app/review/flag-review";
import { listFlags, getLastRun } from "@/lib/services/detection";
import { listTasks } from "@/lib/services/tasks";
import { roleLabel, ruleLabel, taskCategoryLabel } from "@/lib/labels";
import { listRecentClinicalGrants } from "@/lib/services/join-codes";
import { getDashboardSummary } from "@/lib/services/dashboard";

type Params = Record<string, string | string[] | undefined>;

const welcome: Record<string, string> = {
  "1": "Your private demo clinic is ready. Everything here is fictional — explore freely, and use Settings to reset it any time.",
  demo: "Welcome to your sandbox. Use “View as…” in the top bar to see the clinic through another role's eyes.",
};

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-body">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

async function Dashboard({ searchParams }: { searchParams: Promise<Params> }) {
  const [session, params] = await Promise.all([requireSession(), searchParams]);
  const ctx = toAppContext(session);
  const clinical = can(session.role, "flag.read");
  const physician = session.role === "physician";
  const [summary, flags, dueTasks, lastRun, lastImport, grants] = await Promise.all([
    getDashboardSummary(ctx),
    clinical ? listFlags(ctx) : Promise.resolve([]),
    clinical ? Promise.resolve([]) : listTasks(ctx),
    clinical ? getLastRun(ctx) : Promise.resolve(null),
    clinical ? getLastSuccessfulImport(ctx) : Promise.resolve(null),
    physician ? listRecentClinicalGrants(ctx) : Promise.resolve([]),
  ]);
  const locked = "Visible to clinical roles";
  const welcomeMessage = typeof params.welcome === "string" ? welcome[params.welcome] : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description={`${session.clinicName} · Review open work, then assign the next follow-up.`}
      />
      {welcomeMessage ? (
        <p role="status" className="rounded-md border border-teal/30 bg-teal-soft px-4 py-3 text-sm text-teal-strong">{welcomeMessage}</p>
      ) : null}
      {clinical ? <DataFreshness lastImport={lastImport} lastRun={lastRun} /> : null}
      {grants.length ? (
        <section aria-labelledby="new-clinical-access" className="rounded-lg border border-brand/25 bg-brand-soft px-4 py-3 text-sm text-body">
          <h2 id="new-clinical-access" className="flex items-center gap-2 font-semibold text-navy"><ShieldCheck className="size-4 text-brand" aria-hidden />New clinical access</h2>
          <ul className="mt-1.5 space-y-1">
            {grants.slice(0, 5).map((grant, index) => (
              <li key={index}>
                <strong className="font-medium text-navy">{grant.userName}</strong> was given {roleLabel[grant.role]} access{" "}
                {grant.via === "join" ? (grant.grantedByName ? `when ${grant.grantedByName} approved their join request` : "by joining with an instant code") : `by ${grant.grantedByName ?? "a manager"}`}
                {" "}· {formatTimelineDate(grant.createdAt)}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-slate-600">Shown to physicians for 14 days. If you don&rsquo;t recognize someone, tell your clinic&rsquo;s manager.</p>
        </section>
      ) : null}

      <section aria-labelledby="next-work" className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="next-work" className="text-base font-semibold text-navy">{clinical ? "Review next" : "Due next"}</h2>
          <Link href={clinical ? "/app/review" : "/app/queue"} className="inline-flex min-h-11 items-center text-sm text-brand underline">{clinical ? "Browse flags" : "Open follow-up queue"}</Link>
        </div>
        <p className="text-xs text-body">{clinical ? "Oldest open flags first · detection order does not indicate urgency" : "Open tasks ordered by due date"}</p>
        {clinical && flags.length ? <ul className="mt-2 divide-y divide-border">
          {flags.slice(0, 4).map((flag) => <li key={flag.id}>
            <Link href={`/app/review?flag=${flag.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-md py-3 text-sm hover:bg-surface">
              <span className="min-w-0"><span className="font-semibold text-navy">{flag.patientName}</span><span className="block text-body">{flag.title}</span></span>
              <span className="text-xs text-body">Detected {formatTimelineDate(flag.firstDetectedAt)}</span>
            </Link>
          </li>)}
        </ul> : !clinical && dueTasks.length ? <ul className="mt-2 divide-y divide-border">
          {dueTasks.slice(0, 4).map((task) => <li key={task.id} className="py-3 text-sm">
            <Link href={`/app/queue?task=${task.id}`} className="block min-h-11 rounded-md hover:bg-surface">
              <span className="font-semibold text-navy">{task.title}</span>
              <span className="block text-body">{task.patientName ?? "No specific patient"} · {task.assigneeName ?? "Unassigned"} · due {formatTimelineDate(task.dueDate)}</span>
            </Link>
          </li>)}
        </ul> : <EmptyState icon={clinical ? ClipboardCheck : Inbox} className="mt-3 border-0 py-5"
          title={!summary.totalPatients ? "No patient records yet" : clinical && !lastRun ? "Detection has not run yet" : !clinical && !summary.totalTasks ? "No tasks yet" : "All caught up"}
          description={!summary.totalPatients ? "Import fictional records to start tracking follow-ups." : clinical ? "Run detection after records change to check for new gaps." : "There are no open follow-up tasks. Create a task from the queue when more work needs tracking."}
          action={clinical ? !summary.totalPatients ? <Link href="/app/import" className="inline-flex min-h-11 items-center text-brand underline">Import records</Link> : <RunDetectionButton /> : <Link href="/app/queue" className="inline-flex min-h-11 items-center text-brand underline">Open queue to create a task</Link>} />}
      </section>

      <div className="metric-strip">
        <StatCard
          label="Overdue administrative tasks"
          value={summary.overdueAdminTasks}
          tone="attention"
          href="/app/queue?view=admin&due=overdue"
          hint="Past due date, not completed"
        />
        <StatCard
          label="Patients needing review"
          value={summary.patientsNeedingReview ?? 0}
          tone="blue"
          href="/app/patients?status=awaiting_review"
          hint="With a possible gap awaiting a physician"
          locked={summary.patientsNeedingReview === null ? locked : undefined}
        />
        <StatCard
          label="Lab gaps awaiting review"
          value={summary.pendingLabFlags ?? 0}
          tone="attention"
          href="/app/review?rule=lab-result-missing"
          hint="Open lab flags, excluding snoozed"
          locked={summary.pendingLabFlags === null ? locked : undefined}
        />
        <StatCard label="Open records requests" value={summary.openRecordTasks} tone="blue" href="/app/queue?view=records" hint="Records-request tasks, not completed" />
      </div>
      {/* Context, not calls to action: kept quiet and out of the headline metrics. */}
      <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-body">
        <Link href="/app/queue" className="hover:text-navy"><span className="font-medium tabular-nums text-navy">{summary.openTasks}</span> open follow-ups</Link>
        <span><span className="font-medium tabular-nums text-navy">{summary.completedThisWeek}</span> tasks completed this week</span>
        <Link href="/app/patients" className="hover:text-navy"><span className="font-medium tabular-nums text-navy">{summary.totalPatients}</span> demo patients</Link>
      </p>

      <details className="border-y border-border py-3" open={Boolean(params.q || params.status || params.physician || params.page)}>
        <summary className="min-h-11 cursor-pointer py-3 font-semibold text-navy">Patients ({summary.totalPatients})</summary>
        <PatientsPanel ctx={ctx} params={params} basePath="/app" />
      </details>

      <div className="grid gap-4 xl:grid-cols-3 [&>*]:min-w-0">
        <div className="xl:col-span-2">
          <Panel title="Follow-up throughput" description="Tasks opened and completed per week, last 8 weeks">
            <WeeklyTrendChart data={summary.weekly} />
          </Panel>
        </div>
        <Panel title="Open tasks by type">
          <HorizontalBarChart
            label="Open tasks by type"
            valueLabel="Open tasks"
            data={summary.openByCategory
              .map((row) => ({ name: taskCategoryLabel[row.category], value: row.count }))
              .sort((a, b) => b.value - a.value)}
          />
        </Panel>
      </div>

      {summary.openFlagsByRule ? (
        <Panel title="Possible documentation gaps awaiting review" description="Open rule-based flags by type. Counts do not indicate urgency. Every flag needs physician review.">
          {summary.openFlagsByRule.length ? (
            <HorizontalBarChart
              label="Open flags by rule"
              valueLabel="Open flags"
              color="#2b59c3"
              data={summary.openFlagsByRule.map((row) => ({ name: ruleLabel[row.ruleId], value: row.count })).sort((a, b) => b.value - a.value)}
            />
          ) : (
            <p className="text-sm text-body">No open flags. Run detection from the Review page to check for gaps.</p>
          )}
        </Panel>
      ) : null}
    </div>
  );
}

function DashboardFallback() {
  return (
    <div className="space-y-6">
      <div className="h-9 w-48 animate-pulse rounded-lg bg-surface" />
      <div className="metric-strip">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-36 animate-pulse bg-surface" />)}
      </div>
      <div className="h-80 animate-pulse rounded-lg bg-surface" />
    </div>
  );
}

export default function DashboardPage(props: PageProps<"/app">) {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <Dashboard searchParams={props.searchParams} />
    </Suspense>
  );
}
