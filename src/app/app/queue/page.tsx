import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BellOff, Inbox } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/app/primitives/layout";
import { QueueFilters } from "@/components/app/queue/queue-filters";
import { CreateTaskDialog } from "@/components/app/record-dialogs";
import { requirePermission } from "@/lib/auth/current";
import { can } from "@/lib/authz/permissions";
import { taskCategoryLabel, type TaskCategory } from "@/lib/labels";
import { listMembers } from "@/lib/services/members";
import { listPatientOptions } from "@/lib/services/patients";
import { listTasks } from "@/lib/services/tasks";
import { hasQueueFilters, parseQueueFilters, TASK_VIEWS, type TaskView } from "@/lib/queue-filters";
import { TaskList } from "@/components/app/queue/task-list";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Follow-up queue" };

type Params = Record<string, string | string[] | undefined>;

const VIEW_LABELS: Record<TaskView, string> = {
  all: "All",
  admin: "Administrative",
  calls: "Calls to make",
  confirmations: "Appointments to confirm",
  records: "Missing specialist records",
  other: "Other admin tasks",
  clinical: "Clinical review",
};
function viewHref(params: Params, view: TaskView): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (typeof value === "string" && key !== "view") next.set(key, value);
  if (view !== "all") next.set("view", view);
  const query = next.toString();
  return query ? `/app/queue?${query}` : "/app/queue";
}

async function Queue({ searchParams }: { searchParams: Promise<Params> }) {
  const [{ ctx, session }, params] = await Promise.all([requirePermission("task.read"), searchParams]);
  const clinicalAllowed = can(session.role, "task.manage_clinical");
  const views = (Object.keys(TASK_VIEWS) as TaskView[]).filter((view) => view !== "clinical" || can(session.role, "patient.read_clinical"));
  const filters = parseQueueFilters(params, can(session.role, "patient.read_clinical"));
  const { view } = filters;
  const [tasks, members, patients] = await Promise.all([
    listTasks(ctx, filters),
    listMembers(ctx),
    listPatientOptions(ctx),
  ]);
  const assignees = members.filter((member) => member.status === "active").map(({ userId, displayName, role }) => ({ userId, displayName, role }));
  const categories = (Object.keys(taskCategoryLabel) as TaskCategory[]).filter((category) => category !== "clinical_review" || clinicalAllowed);
  const filtered = hasQueueFilters(filters);
  const hasTaskHistory = !tasks.length && !filtered ? (await listTasks(ctx, { status: "any" })).length > 0 : false;
  const newTask = <CreateTaskDialog assignees={assignees} patients={patients} categories={categories} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Follow-up queue"
        description="Calls, confirmations, and records requests for your team. Assign, track, and record outcomes."
        actions={newTask}
      />
      <p className="flex items-start gap-2 border-y border-border py-3 text-sm text-body">
        <BellOff className="size-4 shrink-0 text-body" aria-hidden />
        Prototype — no calls, emails, or texts are sent to patients. Record the outcome of outreach your team does.
      </p>
      <nav aria-label="Task views">
        <ul className="flex flex-wrap gap-1">
          {views.map((key) => (
            <li key={key}>
              <Link
                href={viewHref(params, key)}
                aria-current={view === key ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-sm border-b-2 px-3 text-sm font-medium transition",
                  view === key ? "border-brand bg-brand-soft text-brand-hover" : "border-transparent text-body hover:bg-surface hover:text-navy",
                )}
              >
                {VIEW_LABELS[key]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <section aria-label={`${VIEW_LABELS[view]} tasks`} className="min-w-0 border-y border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4">
          <QueueFilters assignees={assignees} />
          <p className="text-sm tabular-nums text-body">{tasks.length} task{tasks.length === 1 ? "" : "s"} · All records fictional</p>
        </div>
        {tasks.length === 0 ? (
          <EmptyState className="m-4 border-0" icon={Inbox}
            title={filtered ? "No tasks match these filters" : hasTaskHistory ? "All caught up" : "No tasks yet"}
            description={filtered ? "Clear the filters to see all open follow-ups." : hasTaskHistory ? "Every follow-up is completed. Add a task when there is more work to track." : "Create a follow-up task to start tracking work for your team."}
            action={filtered ? <Link href="/app/queue" className="inline-flex min-h-11 items-center text-brand underline">Clear filters</Link> : newTask} />
        ) : <TaskList tasks={tasks} assignees={assignees} clinicalAllowed={clinicalAllowed} />}

      </section>
    </div>
  );
}

export default function QueuePage(props: PageProps<"/app/queue">) {
  return (
    <Suspense fallback={<div className="space-y-4"><div className="h-12 animate-pulse rounded-lg bg-surface" /><div className="h-96 animate-pulse rounded-lg bg-surface" /></div>}>
      <Queue searchParams={props.searchParams} />
    </Suspense>
  );
}
