import { StatusBadge } from "@/components/app/primitives/badges";
import { taskCategoryLabel } from "@/lib/labels";
import { sampleFlags } from "./hero-data";
import { previewQueue, previewStats } from "./preview-data";

/** Same definition as the dashboard: open lab-result flags from the real rule output. */
const labGaps = sampleFlags.filter((flag) => flag.ruleId === "lab-result-missing").length;

/** A product fragment using the demo dataset, without simulated browser controls. */
export function DashboardPreview() {
  return (
    <figure className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card" aria-label="Preview of the SymptomWatch dashboard with fictional data">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
        <span className="text-[0.8125rem] font-medium text-navy">Harbor View <span className="text-slate-400">/</span> Follow-up queue</span>
        <span className="meta-label">Fictional records · fixed demo snapshot</span>
      </figcaption>
      <dl className="grid grid-cols-2 border-b border-border sm:grid-cols-4">
        {[
          ["Demo patients", previewStats.patients],
          ["Open follow-ups", previewStats.openTasks],
          ["Lab gaps awaiting review", labGaps],
          ["Open records requests", previewStats.openRecordRequests],
        ].map(([label, value]) => (
          <div key={label} className="border-border px-5 py-5 [&:nth-child(odd)]:border-r sm:border-r sm:last:border-r-0 [&:nth-child(-n+2)]:border-b sm:[&:nth-child(-n+2)]:border-b-0">
            <dt className="text-[0.8125rem] text-muted-foreground">{label}</dt>
            <dd className="mt-2 text-[2rem] font-medium leading-none tracking-[-0.03em] tabular-nums text-navy">{value}</dd>
          </div>
        ))}
      </dl>
      <ul className="divide-y divide-border sm:hidden" aria-label="Follow-up queue preview">
        {previewQueue.map((task) => (
          <li key={task.key} className="space-y-2 px-5 py-4 text-sm">
            <div><p className="font-medium text-navy">{task.title}</p><p className="meta-label mt-1">{taskCategoryLabel[task.category]}</p></div>
            <p className="text-body"><span className="text-muted-foreground">Patient: </span>{task.patient}</p>
            <StatusBadge status={task.status} />
          </li>
        ))}
      </ul>
      <div className="hidden sm:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Follow-up queue preview (fictional)</caption>
          <thead className="text-[0.75rem] text-muted-foreground">
            <tr className="border-b border-border"><th scope="col" className="px-5 py-2.5 font-medium">Task</th><th scope="col" className="px-5 py-2.5 font-medium">Patient</th><th scope="col" className="px-5 py-2.5 font-medium">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {previewQueue.map((task) => (
              <tr key={task.key} className="transition-colors duration-150 hover:bg-white/[0.02]">
                <td className="px-5 py-3.5"><p className="font-medium text-navy">{task.title}</p><p className="meta-label mt-1">{taskCategoryLabel[task.category]}</p></td>
                <td className="px-5 py-3.5 text-body">{task.patient}</td>
                <td className="px-5 py-3.5"><StatusBadge status={task.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
