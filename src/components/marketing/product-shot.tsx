import { ClipboardCheck, LayoutDashboard, ListChecks, SlidersHorizontal, Upload, Users } from "lucide-react";
import { ruleShortLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { SampleFlag } from "./hero-data";
import { LoopDemo } from "./loop-demo";

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Follow-up queue", icon: ListChecks },
  { label: "Review flags", icon: ClipboardCheck, active: true },
  { label: "Detection rules", icon: SlidersHorizontal },
  { label: "Patients", icon: Users },
  { label: "Import records", icon: Upload },
];

/**
 * The hero image is the product: the review workspace rendered from real rule
 * output on fictional data. Shown in the app's own light theme, so visitors see the interface they would use.
 * Sidebar and list are decorative (aria-hidden); the detail pane is the
 * accessible animated example.
 */
export function ProductShot({ flags, total, selectedKey, patient, mrn }: {
  flags: SampleFlag[];
  total: number;
  selectedKey: string;
  patient: string;
  mrn: string;
}) {
  return (
    <div className="light overflow-hidden rounded-xl border border-border bg-card text-body shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_40px_100px_-40px_rgb(0_0_0/0.9)]">
      <div aria-hidden className="hidden h-10 items-center justify-between border-b border-border px-4 md:flex">
        <p className="meta-label">Harbor View Family Medicine <span className="text-slate-400">/</span> Review flags</p>
        <p className="record-meta hidden lg:block">rules v1.0.0 · external AI off</p>
      </div>
      <div className="md:grid md:grid-cols-[17rem_minmax(0,1fr)] lg:grid-cols-[12rem_18rem_minmax(0,1fr)]">
        <aside aria-hidden className="hidden flex-col gap-0.5 border-r border-border bg-sidebar p-3 lg:flex">
          <p className="px-2 pb-3 pt-1 text-[0.8rem] font-medium text-navy">Harbor View</p>
          {NAV.map(({ label, icon: Icon, active }) => (
            <p key={label} className={cn("flex h-8 items-center gap-2.5 rounded-md px-2 text-[0.8rem]", active ? "bg-card font-medium text-navy shadow-[0_0_0_1px_var(--border)]" : "text-slate-500")}>
              <Icon className="size-3.5" />
              <span className="flex-1">{label}</span>
              {active ? <span className="meta-label tabular-nums">{total}</span> : null}
            </p>
          ))}
        </aside>
        <div aria-hidden className="hidden min-w-0 border-r border-border md:block">
          <div className="flex h-11 items-center justify-between border-b border-border bg-card px-4">
            <p className="text-[0.8rem] font-medium text-navy">Awaiting review</p>
            <p className="meta-label tabular-nums">{total} flags</p>
          </div>
          <ul>
            {flags.map((flag) => {
              const selected = flag.key === selectedKey;
              return (
                <li key={flag.key} className={cn("border-b border-border px-4 py-3", selected && "bg-brand-soft shadow-[inset_2px_0_0_var(--sw-blue)]")}>
                  <p className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                    <span className="text-[0.8rem] font-medium text-navy">{flag.patient}</span>
                    <span className="meta-label shrink-0">{ruleShortLabel[flag.ruleId]}</span>
                  </p>
                  <p className="mt-1 truncate text-[0.78rem] text-slate-500">{flag.title}</p>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="min-w-0 p-5 sm:p-6 lg:p-7">
          <LoopDemo patient={patient} mrn={mrn} className="max-w-lg" />
        </div>
      </div>
    </div>
  );
}
