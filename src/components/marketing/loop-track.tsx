"use client";

import { m, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

export interface TrackStep {
  who: string;
  title: string;
  body: string;
}

/**
 * One track connects the handoff between roles, vertically on mobile. On wider
 * screens the line draws once when scrolled into view and ends on the green
 * "closed" node. Text never animates, so it is always readable.
 */
export function LoopTrack({ steps }: { steps: TrackStep[] }) {
  const reduce = useReducedMotion();
  return (
    <ol className="relative grid gap-8 md:grid-cols-3 md:gap-0">
      <m.span aria-hidden className="absolute inset-x-0 top-0 z-[1] hidden h-px origin-left bg-brand/70 md:block"
        initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, margin: "-120px" }}
        transition={reduce ? { duration: 0 } : { duration: 1.2, ease: EASE }} />
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <li key={step.title} className="relative border-l border-border pl-6 md:border-l-0 md:border-t md:pl-0 md:pr-8 md:pt-6 md:last:pr-0">
            <span aria-hidden className={cn("absolute -left-[4.5px] top-1 z-[2] size-2 rounded-full border bg-background md:left-0 md:top-[-4.5px]", last ? "border-teal bg-teal" : "border-brand")} />
            <p className="meta-label">Step {index + 1} · {step.who}</p>
            <h3 className="mt-2 text-[1.05rem] font-medium tracking-[-0.015em] text-navy">{step.title}</h3>
            <p className="mt-2 max-w-xs text-[0.9375rem] leading-relaxed text-body">{step.body}</p>
          </li>
        );
      })}
    </ol>
  );
}
