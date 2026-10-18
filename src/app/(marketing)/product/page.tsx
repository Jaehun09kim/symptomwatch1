import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand, FeatureSection, PageIntro } from "@/components/marketing/page-intro";
import { FlagFragment, ImportFragment, RulesFragment, TimelineFragment } from "@/components/marketing/product-fragments";
import { DashboardPreview } from "@/components/marketing/product-preview";

export const metadata: Metadata = {
  title: "Product",
  description: "Explainable flags, a shared follow-up queue, patient timelines, record import, and per-clinic detection rules for small primary care clinics.",
};

export default function ProductPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <PageIntro title="One place for every follow-up">
        <p>SymptomWatch gives a small practice one shared view of the follow-ups it owes patients, explains every possible gap it finds, and turns the physician&rsquo;s decision into work the front desk can finish.</p>
      </PageIntro>

      <FeatureSection id="flags" title="Flags that explain themselves" visual={<FlagFragment />}>
        <p>Each flag says what looks missing, which rule found it, and the dated records behind it. Nothing is hidden in a score.</p>
        <p>A physician confirms the gap and assigns a task, snoozes it until a date, or dismisses it with a reason. Flags are listed by when they were found, never ranked by urgency, and they never change a care plan or contact a patient.</p>
      </FeatureSection>

      <FeatureSection id="queue" title="A follow-up queue with owners" visual={<DashboardPreview />} flip>
        <p>Calls to make, appointments to confirm, and specialist records to chase, each with an assignee, a due date, and a recorded outcome.</p>
        <p>The front desk sees administrative detail only. Clinical review tasks stay with physicians.</p>
      </FeatureSection>

      <FeatureSection id="timeline" title="The whole story on one timeline" visual={<TimelineFragment />}>
        <p>Visits, symptoms, appointments, labs, referrals, tasks, and flags in date order. Every entry is labeled <strong className="font-semibold text-navy">Documented</strong>, <strong className="font-semibold text-navy">Not documented</strong>, or <strong className="font-semibold text-navy">Rule-inferred</strong>, so a reader always knows what is charted and what is an inference.</p>
        <p>Evidence links on a flag jump straight to the entry they cite.</p>
      </FeatureSection>

      <FeatureSection id="import" title="Bring records in from your EHR" visual={<ImportFragment />} flip>
        <p>Upload a lab-order or referral report exported from your EHR. SymptomWatch matches the columns, shows exactly what each row will change, and refuses rows it can&rsquo;t trust, such as a name that doesn&rsquo;t match the record number.</p>
        <p>Re-importing the same export changes nothing, statuses only move forward, and the affected patients are re-checked for gaps right after the import.</p>
      </FeatureSection>

      <FeatureSection id="rules" title="Rules you can tune" visual={<RulesFragment />}>
        <p>If a rule is too noisy for your clinic, a physician can lengthen its grace period or turn it off. Every change is recorded and takes effect immediately.</p>
        <p>Signal quality shows how often each rule&rsquo;s flags were confirmed or dismissed, and why, so tuning is based on your clinic&rsquo;s own decisions. <Link href="/how-it-works#rules" className="font-medium text-brand underline underline-offset-4">See the default rules</Link>.</p>
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
