import { StatusBadge } from "@/components/app/primitives/badges";
import { formatTimelineDate } from "@/components/app/primitives/timeline-item";
import { taskCategoryLabel } from "@/lib/labels";
import { previewDate, previewPatientName, previewQueue, previewStats } from "./preview-data";

/** A product fragment using the demo dataset, without simulated browser controls. */
export function DashboardPreview() {
  return (
    <figure className="min-w-0 rounded-md border border-border bg-card" aria-label="Preview of the SymptomWatch dashboard with fictional data">
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

export function FlagPreview() {
  return (
    <figure className="border-y-2 border-primary bg-surface px-5 py-6 sm:px-7" aria-labelledby="flag-caption">
      <figcaption id="flag-caption" className="flex flex-wrap justify-between gap-2 border-b border-border pb-4 text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-widest">Anatomy of a flag</span>
        <span>Fictional record / {previewPatientName("hv-08")}</span>
      </figcaption>
      <p className="mt-5 text-xs font-medium text-brand">Possible gap · needs clinician review</p>
      <h2 className="mt-2 text-xl font-medium leading-snug">Gastroenterology referral:<br />no consult note received</h2>
      <dl className="mt-6 space-y-5 text-sm">
        <div className="grid gap-2 sm:grid-cols-[6.5rem_1fr]">
          <dt className="tabular-nums text-xs text-muted-foreground">01 / Evidence</dt>
          <dd className="space-y-3 border-l border-border pl-4">
            <p><span className="block font-sans tabular-nums text-xs text-muted-foreground">{formatTimelineDate(previewDate(-90))}</span>Referral to gastroenterology placed.</p>
            <p><span className="block font-sans tabular-nums text-xs text-muted-foreground">{formatTimelineDate(previewDate(-50))}</span>Scheduled specialist appointment date.</p>
          </dd>
        </div>
        <div className="grid gap-2 sm:grid-cols-[6.5rem_1fr]">
          <dt className="tabular-nums text-xs text-muted-foreground">02 / Missing</dt>
          <dd className="border-l border-dashed border-attention pl-4">No consult note or records received. Whether the visit happened is not documented.</dd>
        </div>
        <div className="grid gap-2 sm:grid-cols-[6.5rem_1fr]">
          <dt className="tabular-nums text-xs text-muted-foreground">03 / Rule</dt>
          <dd className="border-l border-border pl-4">The appointment date passed more than 14 days ago without a documented outcome.<span className="mt-2 block text-xs text-muted-foreground">Referral outcome · <span className="font-mono">v1.0.0</span></span></dd>
        </div>
      </dl>
      <p className="mt-6 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">Snapshot as of <span className="tabular-nums">{formatTimelineDate(previewDate(0))}</span>. The rule identifies a missing record, not a diagnosis or an urgency level. A physician reviews the evidence before deciding what to do.</p>
    </figure>
  );
}
