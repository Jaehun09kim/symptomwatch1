"use client";

import { useEffect, useRef, useState } from "react";
import { m, useInView, useReducedMotion } from "framer-motion";
import { Check, Pause, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Flagged", who: "Rule · lab result", text: "Ordered at a fatigue visit, expected within 14 days. No result on file." },
  { label: "Reviewed", who: "Physician", text: "Dr. Rivera confirms the gap and assigns a follow-up." },
  { label: "Followed up", who: "Front desk", text: "The front desk asks the lab to send the result." },
  { label: "Closed", who: "Automatic", text: "The result is filed, so the flag resolves on its own." },
] as const;

const STATUS = [
  { text: "Awaiting review", tone: "text-brand-hover border-brand/25 bg-brand-soft" },
  { text: "Gap confirmed", tone: "text-attention border-attention-line bg-attention-soft" },
  { text: "Task in progress", tone: "text-brand-hover border-brand/25 bg-brand-soft" },
  { text: "Resolved by new data", tone: "text-teal-strong border-teal/30 bg-teal-soft" },
] as const;

const HOLD_MS = [2400, 2200, 2200];
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * One fictional flag moving from "flagged" to "closed" — the whole product in
 * four steps. Plays once on view, with playback controls; reduced motion shows
 * the completed example. The server and first client render share step zero.
 */
export function LoopDemo({ patient, mrn, className }: { patient: string; mrn?: string; className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = step;

  useEffect(() => {
    if (step === STEPS.length - 1 || (!reduce && (!inView || paused))) return;
    const timer = window.setTimeout(() => setStep((current) => reduce ? STEPS.length - 1 : current + 1), reduce ? 0 : HOLD_MS[step]);
    return () => window.clearTimeout(timer);
  }, [step, paused, reduce, inView]);

  const status = STATUS[active];
  const done = active === STEPS.length - 1;

  return (
    <figure
      ref={ref}
      aria-label="Animated example with fictional data: how one flag gets closed"
      className={cn("relative", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="record-meta">{mrn ? `${mrn} · ` : ""}fictional patient</p>
        <span className="relative inline-flex h-6 items-center overflow-hidden text-xs font-medium" aria-live="off">
          <m.span
            key={status.text}
            initial={{ y: 4 }}
            animate={{ y: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.2, ease: EASE }}
            className={cn("absolute inset-0 inline-flex items-center justify-center rounded-md border px-2", status.tone)}
          >
            {status.text}
          </m.span>
          <span aria-hidden className="invisible px-2">Resolved by new data</span>
        </span>
      </div>
      <p className="mt-4 text-[1.35rem] font-medium leading-snug tracking-[-0.02em] text-navy">{patient}</p>
      <p className="mt-1 text-[0.95rem] leading-snug text-body">{done ? "Vitamin D result filed" : "Vitamin D test has no result on file"}</p>

      <ol className="relative mt-6 border-t border-border pt-4">
        {STEPS.map((item, index) => {
          const state = index < active ? "past" : index === active ? "current" : "future";
          const green = done && index === STEPS.length - 1;
          return (
            <li key={item.label} className="relative grid grid-cols-[1.25rem_1fr] gap-3 py-2.5">
              {index < STEPS.length - 1 ? (
                <span aria-hidden className="absolute left-[9.5px] top-[30px] -bottom-[8px] w-px bg-border">
                  <m.span className={cn("absolute inset-x-0 top-0 origin-top", done ? "bg-teal" : "bg-brand")}
                    initial={false} animate={{ scaleY: index < active ? 1 : 0 }} transition={reduce ? { duration: 0 } : { duration: 0.3, ease: EASE }}
                    style={{ height: "100%" }} />
                </span>
              ) : null}
              <span
                aria-hidden
                className={cn(
                  "relative z-10 mt-0.5 grid size-5 place-items-center rounded-full border transition-colors duration-300",
                  state === "future" && "border-input bg-card",
                  state === "current" && !green && "border-brand bg-card",
                  state === "past" && !green && "border-brand bg-brand text-background",
                  green && "border-teal bg-teal text-background",
                )}
              >
                {state === "past" || green ? <Check className="size-3" strokeWidth={3} /> : state === "current" ? (
                  <span className="size-1.5 rounded-full bg-brand" />
                ) : null}
              </span>
              {/* Upcoming steps are quieter but keep AA contrast (no opacity dimming). */}
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className={cn("font-medium transition-colors duration-300", state === "future" ? "text-slate-600" : "text-navy")}>{item.label}</span>
                  <span className="meta-label">{item.who}</span>
                </p>
                <p className={cn("mt-0.5 text-[0.8125rem] leading-relaxed transition-colors duration-300", state === "future" ? "text-slate-500" : "text-body")}>{item.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <figcaption className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
        <p>Fictional example. Flags point to missing records; they don&rsquo;t diagnose or rank urgency.</p>
        <button type="button"
          onClick={() => { if (done) { setStep(0); setPaused(false); } else setPaused(!paused); }}
          className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-navy motion-reduce:hidden">
          {done ? <RotateCcw className="size-3" aria-hidden /> : paused ? <Play className="size-3" aria-hidden /> : <Pause className="size-3" aria-hidden />}
          {done ? "Replay example" : paused ? "Play example" : "Pause example"}
        </button>
      </figcaption>
    </figure>
  );
}
