import type { Metadata } from "next";
import { Minus } from "lucide-react";
import { container, CtaBand, PageIntro } from "@/components/marketing/page-intro";
import { DEFAULT_RULE_SETTINGS } from "@/lib/detection/clinic-config";
import type { RuleId } from "@/lib/detection/types";
import { ruleLabel } from "@/lib/labels";
import { describeRule } from "@/lib/rule-descriptions";

export const metadata: Metadata = {
  title: "How it works",
  description: "How SymptomWatch finds follow-ups that never closed: four transparent rules, a physician's review, and a front desk that closes the loop.",
};

const STEPS = [
  { title: "Bring in your records", body: "Import lab-order and referral reports from your EHR, or record visits, appointments, and orders as they happen. Only fictional data in this prototype." },
  { title: "SymptomWatch checks every patient", body: "Four simple rules look for follow-ups that should have happened by now. Each finding becomes a flag with its evidence attached." },
  { title: "A physician reviews", body: "Confirm the gap and assign a task, snooze it until a date, or dismiss it with a reason. Nothing changes in the chart without a person deciding." },
  { title: "The front desk closes the loop", body: "Calls, confirmations, and records requests land in a shared queue. When the missing record arrives, the flag closes on its own." },
];

const RULES: RuleId[] = ["overdue-follow-up", "lab-result-missing", "referral-outcome-missing", "persistent-symptom-unresolved"];

const NOT_FLAGGED = [
  "A follow-up the patient rescheduled, when a new appointment is already booked.",
  "A symptom that repeats but is documented as chronic and managed.",
  "A referral the patient declined, when the decision is documented.",
  "Any patient whose care was transferred to another practice.",
];

const ROLES = [
  { role: "Physician", does: "Reviews flags, confirms or dismisses them, tunes rules, imports lab orders." },
  { role: "Front desk", does: "Works the follow-up queue: calls, confirmations, records requests. Sees administrative detail only." },
  { role: "Clinic admin", does: "Manages staff and access, imports referrals, reviews the audit log. Can read flags but not decide them." },
];

export default function HowItWorksPage() {
  return (
    <div className={container}>
      <PageIntro title="How SymptomWatch works" label="How it works">
        <p>SymptomWatch doesn&rsquo;t guess and doesn&rsquo;t diagnose. It compares what a clinic asked for with what its records show, and asks a physician about the difference.</p>
      </PageIntro>

      <section aria-labelledby="steps-title" className="border-t border-border section-space">
        <h2 id="steps-title" className="sr-only">Steps</h2>
        <ol className="grid border-border md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="border-b border-border py-7 md:px-6 md:[&:nth-child(odd)]:border-r md:[&:nth-child(odd)]:pl-0 lg:border-b-0 lg:border-r lg:first:pl-0 lg:last:border-r-0 lg:[&:nth-child(odd)]:pl-6 lg:[&:first-child]:pl-0">
              <p className="meta-label tabular-nums">
                <span className="text-brand">{String(index + 1).padStart(2, "0")}</span>
              </p>
              <h3 className="mt-5 text-[1.05rem] font-medium tracking-[-0.015em]">{step.title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-body">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="rules" aria-labelledby="rules-title" className="scroll-mt-28 border-t border-border section-space">
        <div className="max-w-2xl">
          <h2 id="rules-title" className="section-heading text-[2rem] sm:text-[2.5rem]">The four rules</h2>
          <p className="lead mt-5">These are the defaults. Each clinic&rsquo;s physicians can lengthen the waiting periods or turn a rule off.</p>
        </div>
        <dl className="mt-12 border-t border-border">
          {RULES.map((rule, index) => (
            <div key={rule} className="grid gap-x-6 gap-y-2 border-b border-border py-7 md:grid-cols-[19rem_1fr]">
              <dt className="flex gap-6 font-medium text-navy"><span className="meta-label w-6 shrink-0 pt-1 tabular-nums">R{index + 1}</span>{ruleLabel[rule]}</dt>
              <dd className="leading-relaxed text-body">{describeRule(rule, DEFAULT_RULE_SETTINGS)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="not-title" className="grid gap-10 section-space lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <h2 id="not-title" className="section-heading text-[2rem] sm:text-[2.5rem]">What it deliberately doesn&rsquo;t flag</h2>
          <p className="mt-4 leading-relaxed text-body">A good follow-up tool is quiet when things are fine. The rules look for a documented plan, not just a repeated event.</p>
        </div>
        <ul className="divide-y divide-border border-y border-border lg:col-span-7">
          {NOT_FLAGGED.map((line) => (
            <li key={line} className="flex gap-4 py-4 leading-relaxed text-body"><Minus className="mt-1 size-4 shrink-0 text-slate-500" aria-hidden />{line}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="roles-title" className="border-t border-border section-space">
        <h2 id="roles-title" className="section-heading text-[2rem] sm:text-[2.5rem]">Who does what</h2>
        <dl className="mt-10 divide-y divide-border border-y border-border">
          {ROLES.map(({ role, does }) => (
            <div key={role} className="grid gap-2 py-5 sm:grid-cols-[12rem_1fr]">
              <dt className="font-medium text-navy">{role}</dt>
              <dd className="leading-relaxed text-body">{does}</dd>
            </div>
          ))}
        </dl>
      </section>

      <CtaBand
        title="Try it from each seat"
        body="The demo lets you switch between physician, front desk, and admin in a private copy of a fictional clinic."
        primary={{ href: "/demo", label: "Try the demo" }}
        secondary={{ href: "/product", label: "See the product" }}
      />
    </div>
  );
}
