import Link from "next/link";
import { Clock3 } from "lucide-react";
import { StatusBadge } from "@/components/app/primitives/badges";
import { formatTimelineDate } from "@/components/app/primitives/timeline-item";
import { UpdateTaskDialog, type AssigneeOption } from "@/components/app/record-dialogs";
import { taskCategoryLabel } from "@/lib/labels";
import type { TaskRow } from "@/lib/services/tasks";
import { TaskOutcomeDialog } from "./task-outcome";

function Due({ task, today }: { task: TaskRow; today: string }) {
  return <>
    <time dateTime={task.dueDate} className="tabular-nums">{formatTimelineDate(task.dueDate)}</time>
    {task.status !== "completed" && task.dueDate.slice(0, 10) < today ? <span className="flex w-fit items-center gap-1 text-xs font-medium text-attention"><Clock3 className="size-3.5" aria-hidden />Overdue</span> : null}
  </>;
}

function Actions({ task, assignees, clinicalAllowed }: { task: TaskRow; assignees: AssigneeOption[]; clinicalAllowed: boolean }) {
  if (task.category === "clinical_review" && !clinicalAllowed) return null;
  return <div className="flex flex-wrap gap-2">
    {task.status !== "completed" ? <TaskOutcomeDialog task={task} /> : null}
    <UpdateTaskDialog task={task} assignees={assignees} />
  </div>;
}

function Patient({ task }: { task: TaskRow }) {
  return task.patientId ? <Link href={`/app/patients/${task.patientId}`} className="inline-flex min-h-10 items-center text-brand hover:underline">{task.patientName}</Link> : <span className="text-body">No specific patient</span>;
}

function Outcome({ task }: { task: TaskRow }) {
  return task.outcome ? <p className="mt-2 text-sm text-body"><span className="font-medium">Outcome:</span> {task.outcome}</p> : null;
}

export function TaskList({ tasks, assignees, clinicalAllowed }: { tasks: TaskRow[]; assignees: AssigneeOption[]; clinicalAllowed: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  return <>
    <ul aria-label="Follow-up tasks" className="divide-y divide-border md:hidden">
      {tasks.map((task) => <li key={task.id} className="space-y-3 bg-card py-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-body">{taskCategoryLabel[task.category]}</p><StatusBadge status={task.status} /></div>
        <h3 className="font-semibold text-navy">{task.title}</h3>
        <Patient task={task} />
        <dl className="grid grid-cols-2 gap-3 text-sm text-body">
          <div><dt className="text-xs">Owner</dt><dd className="font-medium text-navy">{task.assigneeName ?? "Unassigned"}</dd></div>
          <div><dt className="text-xs">Due</dt><dd><Due task={task} today={today} /></dd></div>
        </dl>
        <Outcome task={task} />
        <Actions task={task} assignees={assignees} clinicalAllowed={clinicalAllowed} />
      </li>)}
    </ul>
    <div tabIndex={0} role="region" aria-label="Task table" className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[52rem] text-left text-sm">
        <caption className="sr-only">Follow-up tasks</caption>
        <thead className="bg-surface text-xs text-body"><tr>
          {["Task", "Patient", "Assigned to", "Due", "Status", "Actions"].map((label) => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-border">
          {tasks.map((task) => <tr key={task.id} className="align-top hover:bg-surface">
            <td className="px-4 py-3"><p className="font-medium text-navy">{task.title}</p><p className="text-xs text-body">{taskCategoryLabel[task.category]}</p><Outcome task={task} /></td>
            <td className="px-4 py-3"><Patient task={task} /></td>
            <td className="px-4 py-3 text-body">{task.assigneeName ?? "Unassigned"}</td>
            <td className="px-4 py-3 text-body"><Due task={task} today={today} /></td>
            <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
            <td className="px-4 py-3"><Actions task={task} assignees={assignees} clinicalAllowed={clinicalAllowed} /></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </>;
}
