import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "blue" | "teal" | "attention" | "slate";
  href?: string;
  /** Shown instead of the value when the viewer lacks permission. */
  locked?: string;
  className?: string;
}

/** A cell in the dashboard metric strip. The whole unlocked cell is a link. */
export function StatCard({ label, value, hint, tone, href, locked, className }: StatCardProps) {
  const body = (
    <>
      <p className="min-h-[2.5em] pr-5 text-[0.8125rem] font-medium leading-snug text-slate-600">{label}</p>
      {href && !locked ? <ArrowRight className="absolute right-4 top-[1.4rem] hidden size-3.5 text-slate-500 group-hover:text-brand group-focus-visible:text-brand sm:block sm:right-5" aria-hidden /> : null}
      {locked ? (
        <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground"><Lock className="size-3.5 shrink-0" aria-hidden />{locked}</p>
      ) : (
        <p className={cn("mt-3 font-sans text-[2.25rem] sm:text-[2.5rem] font-medium leading-none tracking-[-0.035em] tabular-nums", tone === "attention" ? "text-attention" : tone === "teal" ? "text-teal-strong" : "text-navy")}>{value}</p>
      )}
      {hint && !locked ? <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </>
  );
  const frame = cn("group relative block bg-background px-4 py-5 sm:px-5", href && !locked && "transition-colors duration-150 hover:bg-card focus-visible:relative focus-visible:z-10", className);
  return href && !locked ? <Link href={href} className={frame}>{body}</Link> : <div className={frame}>{body}</div>;
}
