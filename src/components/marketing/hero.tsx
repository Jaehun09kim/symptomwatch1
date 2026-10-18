"use client";

import Link from "next/link";
import { m, useReducedMotion, type Variants } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { LoopDemo } from "./loop-demo";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Hero({ patient }: { patient: string }) {
  const reduce = useReducedMotion();
  const item: Variants = {
    hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 14 },
    shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
  };
  return (
    <section aria-labelledby="hero-title" className="grid items-center gap-12 py-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-24 [&>*]:min-w-0">
      <m.div initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.08 } } }}>
        <m.h1 variants={item} id="hero-title" className="display-heading text-4xl sm:text-5xl lg:text-[3.6rem]">
          Follow-up tracking for small primary care clinics.
        </m.h1>
        <m.p variants={item} className="mt-6 max-w-xl text-lg leading-relaxed text-body">
          SymptomWatch reads your clinic&rsquo;s records and points out follow-ups that never closed: a return visit that didn&rsquo;t happen,
          a lab result that never came back, a referral with no consult note, or a symptom that keeps coming back without a plan.
        </m.p>
        <m.p variants={item} className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
          Each flag shows the records behind it. A physician decides what happens next, and the front desk gets a clear list of calls and records requests.
        </m.p>
        <m.div variants={item} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/demo" className={buttonVariants({ size: "lg" })}>Try the demo</Link>
          <Link href="/sign-up" className={buttonVariants({ size: "lg", variant: "outline" })}>Create a demo account</Link>
        </m.div>
        <m.p variants={item} className="mt-4 text-sm text-muted-foreground">Free to try with fictional patients. Nothing to install.</m.p>
      </m.div>
      <m.div
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: EASE, delay: reduce ? 0 : 0.25 }}
      >
        <LoopDemo patient={patient} />
      </m.div>
    </section>
  );
}
