import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BellOff, Clock3, Inbox } from "lucide-react";
import { StatusBadge } from "@/components/app/primitives/badges";
import { EmptyState, PageHeader } from "@/components/app/primitives/layout";
import { formatTimelineDate } from "@/components/app/primitives/timeline-item";
import { QueueFilters } from "@/components/app/queue/queue-filters";
import { CreateTaskDialog, UpdateTaskDialog } from "@/components/app/record-dialogs";
import { requirePermission } from "@/lib/auth/current";
import { can } from "@/lib/authz/permissions";
import { taskCategoryLabel, type TaskCategory, type TaskStatus } from "@/lib/labels";
import { listMembers } from "@/lib/services/members";
import { listPatientOptions } from "@/lib/services/patients";
import { listTasks, TASK_VIEWS, type DueWindow, type TaskView } from "@/lib/services/tasks";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Follow-up queue" };

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

const VIEW_LABELS: Record<TaskView, string> = {
  all: "All",
  calls: "Calls to make",
  confirmations: "Appointments to confirm",
  records: "Missing specialist records",
  other: "Other admin tasks",
  clinical: "Clinical review",
};
const STATUSES = new Set(["open", "any", "pending", "in_progress", "completed", "needs_review"]);
const DUES = new Set<DueWindow>(["all", "overdue", "today", "week"]);

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
  const views = (Object.keys(TASK_VIEWS) as TaskView[]).filter((view) => view !== "clinical" || clinicalAllowed);
  const requestedView = one(params.view) as TaskView | undefined;
  const view: TaskView = requestedView && views.includes(requestedView) ? requestedView : "all";
  const status = one(params.status) ?? "open";
  const due = (one(params.due) ?? "all") as DueWindow;
  const assignee = one(params.assignee);

  const [tasks, members, patients] = await Promise.all([
    listTasks(ctx, {
      view,
      status: (STATUSES.has(status) ? status : "open") as TaskStatus | "open" | "any",
      due: DUES.has(due) ? due : "all",
      assignee: assignee && (assignee === "me" || assignee === "unassigned" || /^[0-9a-f-]{36}$/.test(assignee)) ? assignee : undefined,
    }),
    listMembers(ctx),
    listPatientOptions(ctx),
  ]);
  const assignees = members.filter((member) => member.status === "active").map(({ userId, displayName, role }) => ({ userId, displayName, role }));
  const categories = (Object.keys(taskCategoryLabel) as TaskCategory[]).filter((category) => category !== "clinical_review" || clinicalAllowed);
  const now = new Date();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Follow-up queue"
        description="Calls, confirmations, and records requests for your team. Assign, track, and record outcomes."
        actions={<CreateTaskDialog assignees={assignees} patients={patients} categories={categories} />}
      />
      <p className="flex items-start gap-2 border-y border-border py-3 text-sm text-body">
        <BellOff className="size-4 shrink-0 text-slate-500" aria-hidden />
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
                  view === key ? "border-brand bg-brand-soft text-brand-hover" : "border-transparent text-slate-600 hover:bg-surface hover:text-navy",
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
          <p className="text-sm tabular-nums text-slate-500">{tasks.length} task{tasks.length === 1 ? "" : "s"} · All records fictional</p>
        </div>
        {tasks.length === 0 ? (
          <EmptyState className="m-4 border-0" icon={Inbox} title="Nothing here" description="No tasks match these filters." />
        ) : (
          <div tabIndex={0} role="region" aria-label="Task table" className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <caption className="sr-only">Follow-up tasks</caption>
              <thead className="bg-surface text-xs text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Task</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Patient</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Assigned to</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Due</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tasks.map((task) => {
                  const overdue = task.status !== "completed" && new Date(task.dueDate) < new Date(now.toISOString().slice(0, 10));
                  return (
                    <tr key={task.id} className="align-top hover:bg-surface/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-navy">{task.title}</p>
                        <p className="text-xs text-slate-500">{taskCategoryLabel[task.category]}{task.sourceFlagId ? " · from a reviewed flag" : ""}</p>
                        {task.outcome ? <p className="mt-1 max-w-md text-xs text-body"><span className="font-medium">Outcome:</span> {task.outcome}</p> : null}
                      </td>
                      <td className="px-4 py-3">
                        {task.patientId ? (
                          <Link href={`/app/patients/${task.patientId}`} className="text-brand hover:underline">{task.patientName}</Link>
                        ) : <span className="text-slate-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-body">{task.assigneeName ?? <span className="text-slate-500">Unassigned</span>}</td>
                      <td className="px-4 py-3 font-sans tabular-nums text-body">
                        <time dateTime={task.dueDate} className="whitespace-nowrap">{formatTimelineDate(task.dueDate)}</time>
                        {overdue ? <span className="mt-1 flex w-fit items-center gap-1 rounded-sm bg-attention-soft px-1.5 py-0.5 text-xs font-medium text-attention"><Clock3 className="size-3.5 shrink-0" aria-hidden />Overdue</span> : null}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={task.status} className="rounded-sm border-0 bg-transparent px-0" /></td>
                      <td className="px-4 py-3 text-right">
                        {task.category !== "clinical_review" || clinicalAllowed ? <UpdateTaskDialog task={task} assignees={assignees} /> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function QueuePage(props: PageProps<"/app/queue">) {
  return (
    <Suspense fallback={<div className="space-y-4"><div className="h-12 animate-pulse rounded-xl bg-surface" /><div className="h-96 animate-pulse rounded-xl bg-surface" /></div>}>
      <Queue searchParams={props.searchParams} />
    </Suspense>
  );
}
