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
  ruleLabel,
  ruleVersion,
  footer,
  compact,
  className,
}: FlagCardProps) {
  return (
    <article className={cn("rounded-xl border border-brand/25 bg-white shadow-soft", className)}>
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <ProvenanceBadge kind="rule_inferred" />
        <FlagStatusBadge status={status} />
        <span className="ml-auto text-xs text-slate-500">
          {ruleLabel} · v{ruleVersion}
        </span>
      </header>
      <div className={cn("space-y-4 p-4", compact && "space-y-3")}>
        <div>
          <h3 className="text-[0.95rem] font-semibold leading-snug">{title}</h3>
          <p className="mt-1 text-sm text-body">
            <span className="font-medium text-navy">Why flagged: </span>
            {rationale}
          </p>
        </div>
        <section aria-label="Supporting record entries">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Supporting entries</h4>
          <ul className="mt-2 space-y-1.5">
            {evidence.map((item) => (
              <li key={`${item.date}-${item.label}`} className="flex items-start gap-2 text-sm">
                <FileText className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
                <span className="min-w-0">
                  <span className="tabular text-slate-500">{formatTimelineDate(item.date)} · </span>
                  {item.href ? (
                    <a href={item.href} className="text-brand underline-offset-2 hover:underline">
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
          <section aria-label="Missing or uncertain information">
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
      {footer ? <footer className="border-t border-border px-4 py-3">{footer}</footer> : null}
    </article>
  );
}
