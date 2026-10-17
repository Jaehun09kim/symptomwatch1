"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import { TimelineItem } from "@/components/app/primitives/timeline-item";
import { Button } from "@/components/ui/button";
import { sortTimeline, type TimelineEvent, type TimelineFilter } from "@/lib/timeline";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ key: TimelineFilter; label: string }> = [
  { key: "visit", label: "Visits" },
  { key: "appointment", label: "Appointments" },
  { key: "lab", label: "Labs" },
  { key: "referral", label: "Referrals" },
  { key: "task", label: "Tasks" },
  { key: "flag", label: "Flags & gaps" },
];

export function PatientTimeline({ events, clinical }: { events: TimelineEvent[]; clinical: boolean }) {
  const [direction, setDirection] = useState<"desc" | "asc">("desc");
  const available = FILTERS.filter((filter) => events.some((event) => event.filter === filter.key));
  const [hidden, setHidden] = useState<Set<TimelineFilter>>(new Set());
  const [highlight, setHighlight] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const anchor = window.location.hash.slice(1);
      setHighlight(anchor || null);
      if (anchor) document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const visible = useMemo(
    () => sortTimeline(events.filter((event) => !hidden.has(event.filter)), direction),
    [events, hidden, direction],
  );

  const toggle = (key: TimelineFilter) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section aria-labelledby="timeline-heading" className="rounded-xl border border-border bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="timeline-heading" className="text-base font-semibold">Timeline</h2>
        <Button variant="outline" size="sm" onClick={() => setDirection((value) => (value === "desc" ? "asc" : "desc"))}>
          {direction === "desc" ? <ArrowDownWideNarrow aria-hidden /> : <ArrowUpNarrowWide aria-hidden />}
          {direction === "desc" ? "Newest first" : "Oldest first"}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Show event types">
        {available.map((filter) => {
          const on = !hidden.has(filter.key);
          return (
            <button
              key={filter.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(filter.key)}
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition",
                on ? "border-brand/30 bg-brand-soft text-brand-hover" : "border-border bg-white text-slate-500 line-through",
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>
      {!clinical ? (
        <p className="mt-3 rounded-[10px] border border-border bg-surface px-3 py-2 text-xs text-slate-600">
          Front-desk view: visits, symptoms, lab orders, referral reasons, and review flags are limited to clinical roles.
        </p>
      ) : null}
      <ol className="mt-5">
        {visible.map((event, index) => (
          <TimelineItem
            key={event.anchor}
            id={event.anchor}
            kind={event.kind}
            date={event.date}
            title={event.upcoming ? `${event.title} (upcoming)` : event.title}
            meta={event.meta}
            provenance={event.provenance}
            highlighted={highlight === event.anchor}
            isLast={index === visible.length - 1}
          >
            {event.details.length ? (
              <dl className="grid gap-1.5">
                {event.details.map((detail) => (
                  <div key={detail.label} className="grid gap-x-3 sm:grid-cols-[9rem_1fr]">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{detail.label}</dt>
                    <dd className="text-sm text-body">{detail.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </TimelineItem>
        ))}
      </ol>
      {visible.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No events for the selected types.</p> : null}
    </section>
  );
}
