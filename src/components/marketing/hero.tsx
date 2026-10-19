"use client";

import Link from "next/link";
import { m, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { SampleFlag } from "./hero-data";
import { ProductShot } from "./product-shot";
import { TiltFrame } from "./tilt-frame";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Hero({ flags, total, selectedKey, patient, mrn }: {
  flags: SampleFlag[];
  total: number;
  selectedKey: string;
  patient: string;
  mrn: string;
}) {
  const reduce = useReducedMotion();
  const item: Variants = {
    hidden: { y: 8 },
    shown: { y: 0, transition: reduce ? { duration: 0 } : { duration: 0.35, ease: EASE } },
  };
  return (
    <section aria-labelledby="hero-title" className="pb-4 pt-12 sm:pt-20 lg:pt-24">
      <m.div initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: reduce ? 0 : 0.06 } } }} className="max-w-[52rem]">
        <m.p variants={item} className="meta-label mb-5">For independent primary care · 1–5 physicians</m.p>
        <m.h1 variants={item} id="hero-title" className="display-heading text-[2.5rem] text-navy sm:text-[3.5rem] lg:text-[4.25rem]">
          Follow-up tracking for small primary care clinics.
        </m.h1>
        <m.p variants={item} className="lead mt-6 max-w-[38rem]">
          SymptomWatch reads your clinic&rsquo;s records and points out follow-ups that never closed: a return visit that didn&rsquo;t happen,
          a lab result that never came back, a referral with no consult note, or a symptom that keeps coming back without a plan.
        </m.p>
        <m.div variants={item} className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
          <Link href="/demo" className={buttonVariants({ size: "lg" })}>Try the demo</Link>
          <Link href="/sign-up" className="text-link justify-center">
            Create a demo account
            <ArrowRight aria-hidden />
          </Link>
        </m.div>
        <m.p variants={item} className="mt-5 text-[0.8125rem] text-slate-500">Free to try with fictional patients. Nothing to install.</m.p>
      </m.div>
      <div className="mt-12 sm:mt-16">
        <TiltFrame>
          <ProductShot flags={flags} total={total} selectedKey={selectedKey} patient={patient} mrn={mrn} />
        </TiltFrame>
      </div>
    </section>
  );
}
