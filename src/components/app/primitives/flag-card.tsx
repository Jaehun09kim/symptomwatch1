import type { ReactNode } from "react";
import { CircleHelp, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlagStatus } from "@/lib/labels";
import { FlagStatusBadge, ProvenanceBadge } from "./badges";
import { formatTimelineDate } from "./timeline-item";

export interface FlagEvidence {
  label: string;
  date: string;
  href?: string;
}

export interface FlagMissing {
  description: string;
  certainty: "not_documented" | "uncertain";
}

export interface FlagCardProps {
  title: string;
  rationale: string;
  evidence: FlagEvidence[];
  missing: FlagMissing[];
  status: FlagStatus;
  /** Formatted return date, when this flag is currently snoozed. */
  snoozedUntil?: string;
  ruleLabel: string;
  ruleVersion: string;
  footer?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function FlagCard({
  title,
  rationale,
  evidence,
  missing,
  status,
  snoozedUntil,
  ruleLabel,
  ruleVersion,
  footer,
  compact,
  className,
}: FlagCardProps) {
  return (
    <article className={cn("rounded-md border border-border bg-card", className)}>
      <header className={cn("space-y-2 px-4 pt-4", compact && "px-0")}>
        <ProvenanceBadge kind="rule_inferred" plain />
        <p className="text-xs text-slate-500">
          {ruleLabel} · <span className="font-mono">v{ruleVersion}</span>
        </p>
      </header>
      <div className={cn("space-y-5 p-4", compact && "space-y-4 px-0")}>
        <div>
          <h3 className={cn("text-xl font-medium leading-snug", compact && "text-base")}>{title}</h3>
          <FlagStatusBadge status={status} snoozedUntil={snoozedUntil} className="mt-2" />
          <p className="mt-3 text-sm leading-relaxed text-body">
            <span className="font-medium text-navy">Why flagged: </span>
            {rationale}
          </p>
        </div>
        <section aria-label="Supporting record entries">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Supporting entries</h4>
          <ul className="mt-2 divide-y divide-border">
            {evidence.map((item) => (
              <li key={`${item.date}-${item.label}`} className="flex items-start gap-2 py-2 text-sm">
                <FileText className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
                <span className="min-w-0">
                  <span className="tabular text-slate-500">{formatTimelineDate(item.date)} · </span>
                  {item.href ? (
                    <a href={item.href} className="text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand">
                      {item.label}
                    </a>
                  ) : (
                    <span className="text-body">{item.label}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
        {missing.length ? (
          <section aria-label="Missing or uncertain information" className="border-l-2 border-input bg-surface p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Missing or uncertain</h4>
            <ul className="mt-2 space-y-1.5">
              {missing.map((item) => (
                <li key={item.description} className="flex items-start gap-2 text-sm text-body">
                  <CircleHelp className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
                  <span>
                    {item.description}
                    {item.certainty === "uncertain" ? <span className="text-slate-500"> (uncertain)</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      {footer ? <footer className={cn("border-t border-border px-4 py-4", compact && "px-0")}>{footer}</footer> : null}
    </article>
  );
}
