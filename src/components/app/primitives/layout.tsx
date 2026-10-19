import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Sticky, non-dismissible notice rendered on every page. */
export function DemoBanner() {
  return (
    <div
      role="note"
      aria-label="Demo notice"
      className="demo-banner sticky top-0 z-50 h-8 border-b border-[#ecd6a8] bg-[#fbf1de] text-[#7a4f0e]"
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-center gap-2 px-4 text-center text-[0.78rem] font-medium">
        <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">Demo Only — No Real Patient Data.</strong>{" "}
          <span className="hidden sm:inline">Every patient and record here is fictional. </span>
          <Link href="/privacy" className="underline underline-offset-2 hover:no-underline">
            Data policy
          </Link>
        </span>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
        <h1 className="section-heading text-[1.625rem] sm:text-[1.875rem]">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-lg border border-dashed border-border px-6 py-12 text-center", className)}>
      <span className="grid size-10 place-items-center rounded-md border border-border bg-card text-slate-500">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="mt-3 font-medium text-navy">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-slate-600">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
