import Link from "next/link";
import { ArrowUpRight, Lock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  tone?: "blue" | "teal" | "attention" | "slate";
  href?: string;
  /** Shown instead of the value when the viewer lacks permission. */
  locked?: string;
  className?: string;
}

const toneStyle = {
  blue: "bg-brand-soft text-brand",
  teal: "bg-teal-soft text-teal-strong",
  attention: "bg-attention-soft text-attention",
  slate: "bg-slate-100 text-slate-600",
} as const;

export function StatCard({ label, value, hint, icon: Icon, tone = "blue", href, locked, className }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={cn("grid size-9 place-items-center rounded-[10px]", toneStyle[locked ? "slate" : tone])}>
          {locked ? <Lock className="size-4" aria-hidden /> : <Icon className="size-[1.125rem]" aria-hidden />}
        </span>
        {href && !locked ? (
          <ArrowUpRight className="size-4 text-slate-400 transition group-hover:text-brand" aria-hidden />
        ) : null}
      </div>
      <p className="mt-4 text-sm font-medium text-slate-600">{label}</p>
      {locked ? (
        <p className="mt-1 text-sm text-slate-500">{locked}</p>
      ) : (
        <p className="tabular mt-1 text-3xl font-semibold tracking-tight text-navy">{value}</p>
      )}
      {hint && !locked ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </>
  );
  const frame = cn(
    "group block rounded-xl border border-border bg-card p-5 shadow-soft transition",
    href && !locked && "hover:border-brand/40 hover:shadow-card focus-visible:shadow-card",
    className,
  );
  return href && !locked ? (
    <Link href={href} className={frame}>
      {body}
    </Link>
  ) : (
    <div className={frame}>{body}</div>
  );
}
