import { StatusBadge } from "@/components/app/primitives/badges";
import { taskCategoryLabel } from "@/lib/labels";
import { previewQueue, previewStats } from "./preview-data";

/** A product fragment using the demo dataset, without simulated browser controls. */
export function DashboardPreview() {
  return (
    <figure className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-card" aria-label="Preview of the SymptomWatch dashboard with fictional data">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-4">
        <span className="text-sm font-medium text-navy">Harbor View / Follow-up queue</span>
        <span className="text-xs text-muted-foreground">Fictional records · fixed demo snapshot</span>
      </figcaption>
      <dl className="grid grid-cols-2 border-b border-border sm:grid-cols-4">
        {[
          ["Demo patients", previewStats.patients],
          ["Open follow-ups", previewStats.openTasks],
          ["Pending labs", previewStats.pendingLabs],
          ["Pending records", previewStats.pendingRecords],
        ].map(([label, value]) => (
          <div key={label} className="border-r border-border px-5 py-4 last:border-r-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-sans text-3xl tabular-nums text-navy">{value}</dd>
          </div>
        ))}
      </dl>
      <ul className="divide-y divide-border sm:hidden" aria-label="Follow-up queue preview">
        {previewQueue.map((task) => (
          <li key={task.key} className="space-y-2 px-5 py-4 text-sm">
            <div><p className="font-medium text-navy">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{taskCategoryLabel[task.category]}</p></div>
            <p><span className="text-muted-foreground">Patient: </span>{task.patient}</p>
            <StatusBadge status={task.status} className="rounded-sm border-0 bg-transparent px-0" />
          </li>
        ))}
      </ul>
      <div className="hidden sm:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Follow-up queue preview (fictional)</caption>
          <thead className="bg-surface text-xs text-muted-foreground">
            <tr><th scope="col" className="px-5 py-3 font-medium">Task</th><th scope="col" className="px-5 py-3 font-medium">Patient</th><th scope="col" className="px-5 py-3 font-medium">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {previewQueue.map((task) => (
              <tr key={task.key}>
                <td className="px-5 py-4"><p className="font-medium text-navy">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{taskCategoryLabel[task.category]}</p></td>
                <td className="px-5 py-4">{task.patient}</td>
                <td className="px-5 py-4"><StatusBadge status={task.status} className="rounded-sm border-0 bg-transparent px-0" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
