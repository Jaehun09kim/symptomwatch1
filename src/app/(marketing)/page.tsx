import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { exampleFlag, sampleFlags } from "@/components/marketing/hero-data";
import { Hero } from "@/components/marketing/hero";
import { LoopTrack } from "@/components/marketing/loop-track";
import { container, CtaBand } from "@/components/marketing/page-intro";
import { DashboardPreview } from "@/components/marketing/product-preview";
import { previewMrn, previewPatientName } from "@/components/marketing/preview-data";
import type { RuleId } from "@/lib/detection/types";

const WATCHES: { rule: RuleId; title: string; body: string }[] = [
  { rule: "overdue-follow-up", title: "Return visits that didn't happen", body: "A clinician asked the patient to come back in three months. No visit took place and nothing is booked." },
  { rule: "lab-result-missing", title: "Lab results that never came back", body: "A test was ordered, the expected turnaround passed, and there's still no result on file." },
  { rule: "referral-outcome-missing", title: "Referrals without an outcome", body: "The specialist visit should have happened by now, but no consult note has arrived." },
  { rule: "persistent-symptom-unresolved", title: "Symptoms that keep returning", body: "The same complaint at several visits, still active, with no plan or work-up documented." },
];

const STEPS = [
  { who: "Clinic records", title: "Bring in your records", body: "Import lab and referral reports from your EHR, or record visits and orders as they happen." },
  { who: "Physician", title: "Review what's flagged", body: "Each flag lists the records behind it and what's missing. A physician confirms it, snoozes it, or dismisses it with a reason." },
  { who: "Front desk", title: "Close the loop", body: "Calls and records requests go to the front desk. When the missing record arrives, the flag closes on its own." },
];

const ROLES = [
  { role: "Front desk", body: "Sees the calls and records requests, with administrative detail only." },
  { role: "Physician", body: "Sees clinical detail and decides every flag." },
  { role: "Administrator", body: "Manages access and reviews the audit log." },
];

const HERO_PATIENT = "hv-19";

export default function HomePage() {
  const selected = sampleFlags.find((flag) => flag.patientKey === HERO_PATIENT && flag.ruleId === "lab-result-missing")!;
  return (
    <div className={container}>
      <Hero
        flags={sampleFlags.slice(0, 8)}
        total={sampleFlags.length}
        selectedKey={selected.key}
        patient={previewPatientName(HERO_PATIENT)}
        mrn={previewMrn(HERO_PATIENT)}
      />

      <section id="what-it-looks-for" className="scroll-mt-28 grid gap-10 section-space lg:grid-cols-12 lg:gap-16" aria-labelledby="watch-title">
        <div className="lg:sticky lg:top-32 lg:col-span-5 lg:self-start">
          <h2 id="watch-title" className="section-heading text-[2rem] text-navy sm:text-[2.5rem]">What SymptomWatch looks for</h2>
          <p className="lead mt-5">Four kinds of follow-up that are easy to lose track of in a busy practice. The rules are simple and visible, so you can always see why something was flagged.</p>
          <p className="mt-4 leading-relaxed text-body">Each flag shows the records behind it. A physician decides what happens next, and the front desk gets a clear list of calls and records requests.</p>
          <Link href="/how-it-works#rules" className="text-link mt-5">
            Read the rules <ArrowRight aria-hidden />
          </Link>
        </div>
        <ul className="border-t border-border lg:col-span-7">
          {WATCHES.map(({ rule, title, body }, index) => {
            const example = exampleFlag(rule);
            return (
              <li key={rule} className="grid gap-x-6 gap-y-3 border-b border-border py-8 sm:grid-cols-[3rem_1fr]">
                <span className="meta-label pt-1 tabular-nums">R{index + 1}</span>
                <div>
                  <h3 className="text-[1.125rem] font-medium tracking-[-0.015em] text-navy">{title}</h3>
                  <p className="mt-2 leading-relaxed text-body">{body}</p>
                  {example ? (
                    <p className="mt-4 border-l border-brand/50 pl-3 font-mono text-[0.78rem] leading-relaxed text-slate-500">
                      {example.title}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
          <li className="pt-4"><p className="meta-label">Examples are real rule output on the fictional demo clinic.</p></li>
        </ul>
      </section>

      <section id="how" className="scroll-mt-28 border-t border-border section-space" aria-labelledby="how-title">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <h2 id="how-title" className="section-heading text-[2rem] text-navy sm:text-[2.5rem]">How it works</h2>
          <Link href="/how-it-works" className="text-link">
            The full picture <ArrowRight aria-hidden />
          </Link>
        </div>
        <LoopTrack steps={STEPS} />
      </section>

      <section id="product" className="scroll-mt-28 border-t border-border section-space" aria-labelledby="product-title">
        <div className="mb-10 grid gap-5 lg:grid-cols-12 lg:items-end lg:gap-16">
          <h2 id="product-title" className="section-heading text-[2rem] text-navy sm:text-[2.5rem] lg:col-span-6">One shared list for the whole team</h2>
          <p className="leading-relaxed text-body lg:col-span-5 lg:col-start-8">The same clinic, seen from three seats. Every number below is computed from the fictional demo data.</p>
        </div>
        <DashboardPreview />
        <dl className="mt-8 grid border-t border-border sm:grid-cols-3">
          {ROLES.map(({ role, body }) => (
            <div key={role} className="border-b border-border py-5 sm:border-b-0 sm:border-r sm:px-6 sm:first:pl-0 sm:last:border-r-0">
              <dt className="text-[0.9375rem] font-medium text-navy">{role}</dt>
              <dd className="mt-1.5 text-[0.9375rem] leading-relaxed text-body">{body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="safety" className="scroll-mt-28 grid gap-10 border-t border-border section-space lg:grid-cols-12 lg:gap-16" aria-labelledby="safety-title">
        <div className="lg:col-span-4">
          <h2 id="safety-title" className="section-heading text-[2rem] text-navy sm:text-[2.5rem]">Before you try it</h2>
          <div className="mt-6 flex flex-col gap-2.5 text-[0.9375rem] font-medium">
            <Link href="/safety" className="text-brand underline decoration-brand/40 underline-offset-4 transition-colors hover:decoration-brand">Our safety approach</Link>
            <Link href="/privacy" className="text-brand underline decoration-brand/40 underline-offset-4 transition-colors hover:decoration-brand">Privacy &amp; data policy</Link>
          </div>
        </div>
        <dl className="divide-y divide-border border-y border-border lg:col-span-8">
          <div className="grid gap-2 py-6 sm:grid-cols-[7rem_1fr] sm:gap-6">
            <dt className="meta-label pt-1">Status</dt>
            <dd className="leading-relaxed text-body"><strong className="font-medium text-navy">This is a research and demonstration prototype.</strong> It uses fictional data only, is not clinically validated, and is not HIPAA-compliant. Do not enter real patient information. Input checks reduce risk; they cannot guarantee that free text contains no real information.</dd>
          </div>
          <div className="grid gap-2 py-6 sm:grid-cols-[7rem_1fr] sm:gap-6">
            <dt className="meta-label pt-1">Scope</dt>
            <dd className="leading-relaxed text-body">SymptomWatch does not diagnose, recommend treatment, rank clinical urgency, or change care plans. Flags identify possible documentation gaps for clinician review.</dd>
          </div>
          <div className="grid gap-2 py-6 sm:grid-cols-[7rem_1fr] sm:gap-6">
            <dt className="meta-label pt-1">Contact &amp; AI</dt>
            <dd className="leading-relaxed text-body"><strong className="font-medium text-navy">No patient contact.</strong> The prototype sends no calls, texts, or emails to patients. <strong className="font-medium text-navy">External AI is disabled.</strong> Detection uses rules inside the application; no record data is sent to third-party AI services.</dd>
          </div>
        </dl>
      </section>

      <CtaBand
        title="Want a walkthrough for your clinic?"
        body="Tell us how follow-up works in your practice today, or explore the demo with fictional patients first."
        primary={{ href: "/contact", label: "Request a walkthrough" }}
        secondary={{ href: "/demo", label: "Try the demo" }}
      />
    </div>
  );
}
