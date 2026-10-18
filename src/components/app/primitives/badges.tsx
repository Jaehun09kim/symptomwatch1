import { CheckCircle2, CircleDashed, CircleDot, CircleHelp, CirclePause, Clock3, Eye, ScanSearch, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { flagStatusLabel, taskStatusLabel, type FlagStatus, type TaskStatus } from "@/lib/labels";

const pill =
  "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium [&_svg]:size-3.5 [&_svg]:shrink-0";

const taskStatusStyle: Record<TaskStatus, { icon: LucideIcon; className: string }> = {
  pending: { icon: CircleDashed, className: "border-slate-300 bg-white text-slate-700" },
  in_progress: { icon: Clock3, className: "border-brand/30 bg-brand-soft text-brand-hover" },
  completed: { icon: CheckCircle2, className: "border-teal/30 bg-teal-soft text-teal-strong" },
  needs_review: { icon: Eye, className: "border-amber-300 bg-attention-soft text-attention" },
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const { icon: Icon, className: tone } = taskStatusStyle[status];
  return (
    <span className={cn(pill, tone, className)}>
      <Icon aria-hidden />
      {taskStatusLabel[status]}
    </span>
  );
}

export type Provenance = "documented" | "not_documented" | "rule_inferred";

const provenanceStyle: Record<Provenance, { icon: LucideIcon; label: string; className: string }> = {
  documented: { icon: CheckCircle2, label: "Documented", className: "border-teal/40 bg-white text-teal-strong" },
  not_documented: {
    icon: CircleHelp,
    label: "Not documented",
    className: "border-dashed border-slate-400 bg-white text-slate-700",
  },
  rule_inferred: {
    icon: ScanSearch,
    label: "Rule-inferred · needs review",
    className: "border-brand/40 bg-brand-soft text-brand-hover",
  },
};

/** Distinguishes charted facts, missing expected records, and engine inferences — never by color alone. */
export function ProvenanceBadge({ kind, className }: { kind: Provenance; className?: string }) {
  const { icon: Icon, label, className: tone } = provenanceStyle[kind];
  return (
    <span className={cn(pill, tone, className)}>
      <Icon aria-hidden />
      {label}
    </span>
  );
}

const flagStatusStyle: Record<FlagStatus, { icon: LucideIcon; className: string }> = {
  open: { icon: CircleDot, className: "border-brand/30 bg-brand-soft text-brand-hover" },
  confirmed: { icon: CheckCircle2, className: "border-amber-300 bg-attention-soft text-attention" },
  dismissed: { icon: XCircle, className: "border-slate-300 bg-white text-slate-600" },
  resolved_by_data: { icon: CheckCircle2, className: "border-teal/30 bg-teal-soft text-teal-strong" },
  suppressed: { icon: CirclePause, className: "border-slate-300 bg-surface text-slate-600" },
};

export function FlagStatusBadge({ status, className }: { status: FlagStatus; className?: string }) {
  const { icon: Icon, className: tone } = flagStatusStyle[status];
  return (
    <span className={cn(pill, tone, className)}>
      <Icon aria-hidden />
      {flagStatusLabel[status]}
    </span>
  );
}

/** Marks synthetic records wherever a person's name is shown. */
export function FictionalTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full bg-slate-100 px-2 text-[0.7rem] font-medium uppercase tracking-wide text-slate-600",
        className,
      )}
    >
      Fictional
    </span>
  );
}
