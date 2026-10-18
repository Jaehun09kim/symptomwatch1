import type { ReactNode } from "react";
import {
  CalendarClock,
  CalendarX2,
  ClipboardList,
  FlaskConical,
  ListChecks,
  ScanSearch,
  Send,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProvenanceBadge, type Provenance } from "./badges";

export type TimelineKind =
  | "visit"
  | "appointment"
  | "missed_appointment"
  | "lab"
  | "referral"
  | "task"
  | "flag"
  | "expected";

const kindIcon: Record<TimelineKind, LucideIcon> = {
  visit: Stethoscope,
  appointment: CalendarClock,
  missed_appointment: CalendarX2,
  lab: FlaskConical,
  referral: Send,
  task: ListChecks,
  flag: ScanSearch,
  expected: ClipboardList,
};

export interface TimelineItemProps {
  id?: string;
  kind: TimelineKind;
  date: string;
  title: string;
  meta?: string;
  provenance: Provenance;
  highlighted?: boolean;
  children?: ReactNode;
  isLast?: boolean;
}

export function TimelineItem({ id, kind, date, title, meta, provenance, highlighted, children, isLast }: TimelineItemProps) {
  const Icon = kindIcon[kind];
  const dashed = provenance === "not_documented";
  return (
    <li id={id} className="relative flex gap-4 scroll-mt-24">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-sm border bg-background",
            provenance === "documented" && "border-border text-slate-600",
            provenance === "rule_inferred" && "border-brand/40 bg-brand-soft text-brand",
            dashed && "border-dashed border-slate-400 text-slate-500",
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        {!isLast ? <span className="mt-1 w-px flex-1 bg-border" aria-hidden /> : null}
      </div>
      <div
        className={cn(
          "mb-6 min-w-0 flex-1 border-b bg-background pb-6 transition",
          dashed ? "border-dashed border-slate-400" : "border-border",
          highlighted && "ring-2 ring-brand/50",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <time className="font-mono tabular-nums text-xs text-slate-500" dateTime={date}>
            {formatTimelineDate(date)}
          </time>
          <ProvenanceBadge kind={provenance} className="rounded-sm" />
        </div>
        <p className="mt-1.5 font-medium text-navy">{title}</p>
        {meta ? <p className="mt-0.5 text-sm text-slate-600">{meta}</p> : null}
        {children ? <div className="mt-3 text-sm text-body">{children}</div> : null}
      </div>
    </li>
  );
}

export function formatTimelineDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
