"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Check, ClipboardList } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/app/primitives/layout";
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
      const hash = window.location.hash.slice(1);
      // Evidence may point at a symptom observation; resolve it to the visit that recorded it.
      const anchor = events.find((event) => event.anchor === hash || event.aliases?.includes(hash))?.anchor ?? hash;
      setHighlight(anchor || null);
      if (anchor) document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [events]);

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
    <section aria-labelledby="timeline-heading" className="border-t border-border py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="timeline-heading" className="text-base font-semibold">Timeline</h2>
        <Button variant="outline" size="sm" className="min-h-10" onClick={() => setDirection((value) => (value === "desc" ? "asc" : "desc"))}>
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
                "inline-flex min-h-11 items-center gap-2 rounded-sm border px-3 text-xs font-medium transition",
                on ? "border-brand bg-brand-soft text-brand-hover" : "border-input bg-background text-body hover:bg-surface",
              )}
            >
              <span className={cn("grid size-4 place-items-center rounded-sm border", on ? "border-brand bg-brand text-white" : "border-input")} aria-hidden>
                {on ? <Check className="size-3" /> : null}
              </span>
              {filter.label}
            </button>
          );
        })}
      </div>
      {!clinical ? (
        <p className="mt-3 rounded-md border border-border bg-surface px-3 py-2 text-xs text-slate-600">
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
            outcome={event.outcome}
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
      {visible.length === 0 ? <EmptyState icon={ClipboardList}
        title={events.length ? "No events match these filters" : "No visible records yet"}
        description={events.length ? "Show all event types to see the patient’s history." : clinical ? "Import fictional records to build this timeline." : "Administrative appointments, referrals, and tasks will appear here."}
        action={events.length ? <Button variant="outline" className="min-h-11" onClick={() => setHidden(new Set())}>Clear filters</Button> : clinical ? <Link href="/app/import" className="inline-flex min-h-11 items-center text-brand underline">Import records</Link> : <Link href="/app/queue" className="inline-flex min-h-11 items-center text-brand underline">Open follow-up queue</Link>} /> : null}
    </section>
  );
}
