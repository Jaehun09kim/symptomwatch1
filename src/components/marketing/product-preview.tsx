import { ClipboardCheck, FlaskConical, LayoutDashboard, ListChecks, Send, Users } from "lucide-react";
import { FictionalTag, StatusBadge } from "@/components/app/primitives/badges";
import { FlagCard } from "@/components/app/primitives/flag-card";
import { StatCard } from "@/components/app/primitives/stat-card";
import { TimelineItem } from "@/components/app/primitives/timeline-item";
import { LogoMark } from "@/components/brand/logo";
import { taskCategoryLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { previewDate, previewPatientName, previewQueue, previewStats } from "./preview-data";

function BrowserFrame({ children, label, className }: { children: React.ReactNode; label: string; className?: string }) {
  return (
    <figure
      className={cn("overflow-hidden rounded-2xl border border-border bg-white shadow-float", className)}
      aria-label={label}
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-slate-300" />
        <span className="size-2.5 rounded-full bg-slate-300" />
        <span className="size-2.5 rounded-full bg-slate-300" />
        <span className="ml-3 truncate rounded-md bg-white px-3 py-1 text-[0.7rem] text-slate-500 ring-1 ring-border">
          app.symptomwatch.demo
        </span>
      </div>
      {children}
    </figure>
  );
}

/** Static dashboard preview built from the real app primitives and the fictional dataset. */
export function DashboardPreview() {
  const nav = [
    { icon: LayoutDashboard, label: "Dashboard", active: true },
    { icon: ListChecks, label: "Follow-up queue" },
    { icon: ClipboardCheck, label: "Review" },
    { icon: Users, label: "Patients" },
  ];
  return (
    <BrowserFrame label="Preview of the SymptomWatch dashboard with fictional data">
      <div className="flex">
        <aside className="hidden w-44 shrink-0 border-r border-border bg-surface p-3 md:block" aria-hidden>
          <div className="mb-4 flex items-center gap-2 px-1">
            <LogoMark className="size-6" />
            <span className="text-xs font-semibold text-navy">Harbor View</span>
          </div>
          <ul className="space-y-1">
            {nav.map(({ icon: Icon, label, active }) => (
              <li
                key={label}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
                  active ? "bg-white font-medium text-navy shadow-soft" : "text-slate-600",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </li>
            ))}
          </ul>
        </aside>
        <div className="min-w-0 flex-1 space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Demo patients" value={previewStats.patients} icon={Users} tone="slate" className="p-3.5" />
            <StatCard label="Open follow-ups" value={previewStats.openTasks} icon={ListChecks} className="p-3.5" />
            <StatCard label="Pending labs" value={previewStats.pendingLabs} icon={FlaskConical} tone="attention" className="p-3.5" />
            <StatCard label="Pending records" value={previewStats.pendingRecords} icon={Send} tone="teal" className="p-3.5" />
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[30rem] text-left text-xs">
              <caption className="sr-only">Follow-up queue preview (fictional)</caption>
              <thead className="bg-surface text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Task</th>
                  <th className="px-3 py-2 font-medium">Patient</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {previewQueue.map((task) => (
                  <tr key={task.key}>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-navy">{task.title}</p>
                      <p className="text-slate-500">{taskCategoryLabel[task.category]}</p>
                    </td>
                    <td className="px-3 py-2.5 text-body">
                      <span className="flex items-center gap-1.5">
                        {task.patient} <FictionalTag />
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={task.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

export function FlagPreview({ className }: { className?: string }) {
  return (
    <FlagCard
      className={className}
      compact
      status="open"
      ruleLabel="Referral outcome"
      ruleVersion="1.0.0"
      title={`Gastroenterology referral for ${previewPatientName("hv-08")}: no consult note received`}
      rationale="The specialist appointment date passed more than 14 days ago and no records or outcome have been documented."
      evidence={[
        { date: previewDate(-90), label: "Visit — referral to gastroenterology placed" },
        { date: previewDate(-50), label: "Referral — specialist appointment scheduled" },
      ]}
      missing={[{ description: "No consult note or records received", certainty: "not_documented" }]}
    />
  );
}

export function TimelinePreview() {
  const name = previewPatientName("hv-19");
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="font-semibold text-navy">{name}</p>
        <FictionalTag />
        <span className="text-xs text-slate-500">Patient timeline</span>
      </div>
      <ol>
        <TimelineItem kind="visit" date={previewDate(-130)} title="Office visit — return in 2 months requested" provenance="documented" />
        <TimelineItem kind="missed_appointment" date={previewDate(-70)} title="Follow-up appointment — no-show" provenance="documented" />
        <TimelineItem kind="expected" date={previewDate(-56)} title="Completed follow-up visit" meta="Expected by this date; none on file" provenance="not_documented" />
        <TimelineItem
          kind="missed_appointment"
          date={previewDate(-40)}
          title="Follow-up appointment — cancelled by patient"
          meta="Did not rebook"
          provenance="documented"
        />
        <TimelineItem kind="flag" date={previewDate(0)} title="Follow-up visit appears overdue" meta="Awaiting physician review" provenance="rule_inferred" isLast />
      </ol>
    </div>
  );
}
