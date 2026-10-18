import Link from "next/link";
import { Lock } from "lucide-react";
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
      <p className="min-h-10 text-xs font-medium leading-snug text-body">{label}</p>
      {locked ? (
        <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground"><Lock className="size-3.5 shrink-0" aria-hidden />{locked}</p>
      ) : (
        <p className={cn("mt-2 font-display text-4xl leading-none tabular-nums", tone === "attention" ? "text-attention" : tone === "teal" ? "text-teal-strong" : "text-navy")}>{value}</p>
      )}
      {hint && !locked ? <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </>
  );
  const frame = cn("block bg-background px-4 py-5", href && !locked && "transition-colors hover:bg-surface focus-visible:relative focus-visible:z-10", className);
  return href && !locked ? <Link href={href} className={frame}>{body}</Link> : <div className={frame}>{body}</div>;
}
