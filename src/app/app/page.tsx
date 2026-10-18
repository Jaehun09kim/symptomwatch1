import { Suspense } from "react";
import { HorizontalBarChart, WeeklyTrendChart } from "@/components/charts/dashboard-charts";
import { PatientsPanel } from "@/components/app/patients/patients-panel";
import { PageHeader } from "@/components/app/primitives/layout";
import { StatCard } from "@/components/app/primitives/stat-card";
import { requireSession, toAppContext } from "@/lib/auth/current";
import { ruleLabel, taskCategoryLabel } from "@/lib/labels";
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
      {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

async function Dashboard({ searchParams }: { searchParams: Promise<Params> }) {
  const [session, params] = await Promise.all([requireSession(), searchParams]);
  const ctx = toAppContext(session);
  const summary = await getDashboardSummary(ctx);
  const locked = "Visible to clinical roles";
  const welcomeMessage = typeof params.welcome === "string" ? welcome[params.welcome] : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`${session.clinicName} · Review open work, then assign the next follow-up.`}
      />
      {welcomeMessage ? (
        <p role="status" className="rounded-xl border border-teal/30 bg-teal-soft px-4 py-3 text-sm text-teal-strong">{welcomeMessage}</p>
      ) : null}

      <div className="metric-strip">
        <StatCard
          label="Overdue administrative tasks"
          value={summary.overdueAdminTasks}
          tone="attention"
          href="/app/queue?due=overdue"
          hint="Past due date, not completed"
        />
        <StatCard label="Open follow-ups" value={summary.openTasks} href="/app/queue" hint="Tasks not yet completed" />
        <StatCard
          label="Patients needing review"
          value={summary.patientsNeedingReview ?? 0}
          tone="blue"
          href="/app/review"
          hint="With a possible gap awaiting a physician"
          locked={summary.patientsNeedingReview === null ? locked : undefined}
        />
        <StatCard
          label="Pending lab follow-ups"
          value={summary.pendingLabs ?? 0}
          tone="attention"
          href="/app/review?rule=lab-result-missing"
          hint="Ordered or collected, no result yet"
          locked={summary.pendingLabs === null ? locked : undefined}
        />
        <StatCard label="Pending specialist records" value={summary.pendingRecords} tone="blue" href="/app/queue?view=records" hint="Referrals without records received" />
        <StatCard label="Tasks completed this week" value={summary.completedThisWeek} tone="teal" href="/app/queue?status=completed" hint="Since Monday" />
        <StatCard label="Total demo patients" value={summary.totalPatients} tone="slate" href="/app/patients" />
      </div>

      <PatientsPanel ctx={ctx} params={params} basePath="/app" />

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
              color="#39705c"
              data={summary.openFlagsByRule.map((row) => ({ name: ruleLabel[row.ruleId], value: row.count })).sort((a, b) => b.value - a.value)}
            />
          ) : (
            <p className="text-sm text-slate-500">No open flags. Run detection from the Review page to check for gaps.</p>
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
        {Array.from({ length: 7 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-xl bg-surface" />)}
      </div>
      <div className="h-80 animate-pulse rounded-xl bg-surface" />
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
