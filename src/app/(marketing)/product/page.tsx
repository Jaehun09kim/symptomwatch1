import type { Metadata } from "next";
import Link from "next/link";
import { container, CtaBand, FeatureSection, PageIntro } from "@/components/marketing/page-intro";
import { FlagFragment, ImportFragment, RulesFragment, TimelineFragment } from "@/components/marketing/product-fragments";
import { DashboardPreview } from "@/components/marketing/product-preview";

export const metadata: Metadata = {
  title: "Product",
  description: "Explainable flags, a shared follow-up queue, patient timelines, record import, and per-clinic detection rules for small primary care clinics.",
};

export default function ProductPage() {
  return (
    <div className={container}>
      <PageIntro title="One place for every follow-up">
        <p>SymptomWatch gives a small practice one shared view of the follow-ups it owes patients, explains every possible gap it finds, and turns the physician&rsquo;s decision into work the front desk can finish.</p>
      </PageIntro>

      {/* Showcase: the flag is the product's core idea, so it gets the full width. */}
      <section id="flags" aria-labelledby="flags-title" className="section-space scroll-mt-28 border-t border-border">
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-16">
          <h2 id="flags-title" className="section-heading text-[2rem] text-navy sm:text-[2.5rem] lg:col-span-5">Flags that explain themselves</h2>
          <div className="space-y-4 leading-relaxed text-body lg:col-span-6 lg:col-start-7">
            <p>Each flag says what looks missing, which rule found it, and the dated records behind it. Nothing is hidden in a score.</p>
            <p>A physician confirms the gap and assigns a task, snoozes it until a date, or dismisses it with a reason. Flags are listed by when they were found, never ranked by urgency, and they never change a care plan or contact a patient.</p>
          </div>
        </div>
        <div className="mx-auto mt-12 max-w-3xl"><FlagFragment /></div>
      </section>

      {/* Two seats, side by side: what the front desk works and what a reader of the chart sees. */}
      <section aria-label="Queue and timeline" className="section-space grid gap-14 border-t border-border lg:grid-cols-2 lg:gap-12">
        <div id="queue" className="scroll-mt-28 [&>*]:min-w-0">
          <h2 className="section-heading text-[1.6rem] text-navy sm:text-[1.9rem]">A follow-up queue with owners</h2>
          <p className="mt-4 max-w-lg leading-relaxed text-body">Calls to make, appointments to confirm, and specialist records to chase, each with an assignee, a due date, and a recorded outcome. The front desk sees administrative detail only; clinical review tasks stay with physicians.</p>
          <div className="mt-8"><DashboardPreview /></div>
        </div>
        <div id="timeline" className="scroll-mt-28 [&>*]:min-w-0">
          <h2 className="section-heading text-[1.6rem] text-navy sm:text-[1.9rem]">The whole story on one timeline</h2>
          <p className="mt-4 max-w-lg leading-relaxed text-body">Visits, symptoms, appointments, labs, referrals, tasks, and flags in date order. Every entry is labeled <strong className="font-medium text-navy">Documented</strong>, <strong className="font-medium text-navy">Not documented</strong>, or <strong className="font-medium text-navy">Rule-inferred</strong>, and evidence links on a flag jump straight to the entry they cite.</p>
          <div className="mt-8"><TimelineFragment /></div>
        </div>
      </section>

      <FeatureSection id="import" title="Bring records in from your EHR" visual={<ImportFragment />}>
        <p>Upload a lab-order or referral report exported from your EHR. SymptomWatch matches the columns, shows exactly what each row will change, and refuses rows it can&rsquo;t trust, such as a name that doesn&rsquo;t match the record number.</p>
        <p>Re-importing the same export changes nothing, statuses only move forward, and the affected patients are re-checked for gaps right after the import.</p>
      </FeatureSection>

      <FeatureSection id="rules" title="Rules you can tune" visual={<RulesFragment />} flip>
        <p>If a rule is too noisy for your clinic, a physician can lengthen its grace period or turn it off. Every change is recorded and takes effect immediately.</p>
        <p>Signal quality shows how often each rule&rsquo;s flags were confirmed or dismissed, and why, so tuning is based on your clinic&rsquo;s own decisions. <Link href="/how-it-works#rules" className="font-medium text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand">See the default rules</Link>.</p>
      </FeatureSection>

      <CtaBand
        title="See it with fictional patients"
        body="The demo opens a private copy of a 30-patient clinic. Switch between the physician, front-desk, and admin views."
        primary={{ href: "/demo", label: "Try the demo" }}
        secondary={{ href: "/contact", label: "Request a walkthrough" }}
      />
    </div>
  );
}
