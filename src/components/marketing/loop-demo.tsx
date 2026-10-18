"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { Check, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Flagged", who: "Rule · lab result", text: "Ordered three weeks ago, expected within 14 days. No result on file." },
  { label: "Reviewed", who: "Physician", text: "Dr. Rivera confirms the gap and assigns a follow-up." },
  { label: "Followed up", who: "Front desk", text: "The front desk asks the lab to send the result." },
  { label: "Closed", who: "Automatic", text: "The result is filed, so the flag resolves on its own." },
] as const;

const STATUS = [
  { text: "Awaiting review", tone: "text-brand-hover bg-brand-soft" },
  { text: "Gap confirmed", tone: "text-brand-hover bg-brand-soft" },
  { text: "Task in progress", tone: "text-brand-hover bg-brand-soft" },
  { text: "Resolved by new data", tone: "text-teal-strong bg-teal-soft" },
] as const;

const HOLD_MS = [2200, 2200, 2200, 3400];
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * One fictional flag moving from "flagged" to "closed" — the whole product in
 * four steps. Pauses on hover/focus; static and complete under reduced motion.
 */
export function LoopDemo({ patient }: { patient: string }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = reduce ? STEPS.length - 1 : step;

  useEffect(() => {
    if (reduce || paused) return;
    const timer = window.setTimeout(() => setStep((current) => (current + 1) % STEPS.length), HOLD_MS[step]);
    return () => window.clearTimeout(timer);
  }, [step, paused, reduce]);

  const status = STATUS[active];
  const done = active === STEPS.length - 1;

  return (
    <figure
      aria-label="Animated example with fictional data: how one flag gets closed"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative rounded-2xl border border-border bg-card p-5 shadow-float sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground"><span className="font-medium text-navy">{patient}</span> · fictional patient</p>
        <span className="relative inline-flex h-7 items-center overflow-hidden rounded-full px-3 text-xs font-medium" aria-live="off">
          <AnimatePresence mode="popLayout" initial={false}>
            <m.span
              key={status.text}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: EASE }}
              className={cn("absolute inset-0 inline-flex items-center justify-center rounded-full px-3", status.tone)}
            >
              {status.text}
            </m.span>
          </AnimatePresence>
          <span className="invisible">Resolved by new data</span>
        </span>
      </div>
      <p className="mt-4 text-lg font-semibold leading-snug text-navy">{done ? "Vitamin D result filed" : "Vitamin D test has no result on file"}</p>

      <ol className="relative mt-5 space-y-1">
        {STEPS.map((item, index) => {
          const state = index < active ? "past" : index === active ? "current" : "future";
          const green = done && index === STEPS.length - 1;
          return (
            <li key={item.label} className="relative flex gap-3 py-2 pr-2">
              {index < STEPS.length - 1 ? (
                <span aria-hidden className={cn("absolute left-[11px] top-[34px] -bottom-[6px] w-px transition-colors duration-500", index < active ? (done ? "bg-teal" : "bg-brand") : "bg-border")} />
              ) : null}
              <m.span
                aria-hidden
                initial={false}
                animate={{ scale: state === "current" ? 1.08 : 1 }}
                transition={{ duration: 0.3, ease: EASE }}
                className={cn(
                  "relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border transition-colors duration-300",
                  state === "future" && "border-border bg-card text-slate-400",
                  state !== "future" && !green && "border-brand bg-brand text-white",
                  green && "border-teal bg-teal text-white",
                )}
              >
                {state === "past" || green ? <Check className="size-3.5" strokeWidth={3} /> : <CircleDot className="size-3.5" />}
              </m.span>
              {/* Upcoming steps are quieter but keep AA contrast (no opacity dimming). */}
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className={cn("font-semibold transition-colors duration-300", state === "future" ? "text-slate-600" : "text-navy")}>{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.who}</span>
                </p>
                <p className={cn("mt-0.5 text-sm leading-relaxed transition-colors duration-300", state === "future" ? "text-slate-500" : "text-body")}>{item.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <figcaption className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
        Fictional example. Flags point to missing records; they don&rsquo;t diagnose or rank urgency.
      </figcaption>
    </figure>
  );
}
