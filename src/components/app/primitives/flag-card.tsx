import type { ReactNode } from "react";
import { FileText } from "lucide-react";
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
  expectedBy?: string;
  status: FlagStatus;
  showStatus?: boolean;
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
  expectedBy,
  status,
  showStatus = true,
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
      </header>
      <div className={cn("space-y-5 p-4", compact && "space-y-4 px-0")}>
        <div>
          <h3 className={cn("text-xl font-medium leading-snug text-navy", compact && "text-base")}>{title}</h3>
          {showStatus || snoozedUntil ? <FlagStatusBadge status={status} snoozedUntil={snoozedUntil} className="mt-2" /> : null}
          {expectedBy ? <p className="mt-2 text-sm text-body"><span className="font-medium text-navy">Expected by:</span> <time dateTime={expectedBy}>{formatTimelineDate(expectedBy)}</time></p> : null}
        </div>
        {missing.length ? (
          <section aria-label="Missing or uncertain information" className="border-l-2 border-border bg-surface p-3">
            <h4 className="text-xs font-semibold text-navy">What&rsquo;s missing</h4>
            <ul className="mt-2 space-y-1.5 text-sm text-body">
              {missing.map((item) => <li key={item.description}>{item.description}{item.certainty === "uncertain" ? " (uncertain)" : ""}</li>)}
            </ul>
          </section>
        ) : null}
        <section aria-label="Supporting record entries">
          <h4 className="text-xs font-semibold text-navy">Source records</h4>
          <ul className="mt-2 divide-y divide-border">
            {evidence.map((item) => (
              <li key={`${item.date}-${item.label}`} className="flex items-start gap-2 py-2 text-sm">
                <FileText className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
                <span className="min-w-0">
                  <span className="tabular text-body">{formatTimelineDate(item.date)} · </span>
                  {item.href ? (
                    <a href={item.href} className="inline-flex min-h-10 items-center text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand">
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
        <details className="text-sm text-body">
          <summary className="min-h-10 cursor-pointer content-center rounded-sm font-medium text-navy focus-visible:outline-2 focus-visible:outline-brand">Why this was flagged</summary>
          <p className="mt-2 leading-relaxed">{rationale}</p>
          <p className="mt-2 text-xs">{ruleLabel} · <span className="font-mono">v{ruleVersion}</span></p>
        </details>
      </div>
      {footer ? <footer className={cn("border-t border-border px-4 py-4", compact && "px-0")}>{footer}</footer> : null}
    </article>
  );
}
