import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Faq, type FaqItem } from "@/components/marketing/faq";
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
  { who: "Clinic records", title: "Bring in your records", body: "Import lab and referral reports exported from your EHR, or update statuses by hand as they change." },
  { who: "Physician", title: "Review what's flagged", body: "Each flag lists the records behind it and what's missing. A physician confirms it, snoozes it, or dismisses it with a reason." },
  { who: "Front desk", title: "Close the loop", body: "Calls and records requests go to the front desk. When the missing record arrives, the flag closes on its own." },
];

const ROLES = [
  { role: "Front desk", body: "Sees the calls and records requests, with administrative detail only." },
  { role: "Physician", body: "Sees clinical detail and decides every flag." },
  { role: "Administrator", body: "Manages access and reviews the audit log." },
];

const FAQ: FaqItem[] = [
  {
    q: "Does it connect to our EHR?",
    a: (
      <>
        <p>Not directly yet. You export a lab-order or referral report from your EHR as a CSV file and upload it. SymptomWatch matches the columns, shows exactly what each row will change, and refuses rows it can&rsquo;t trust.</p>
        <p>Lab, referral, and appointment statuses can also be updated by hand, and appointments added. In this prototype, visits and symptoms come from the fictional demo data.</p>
      </>
    ),
  },
  {
    q: "How much work is it for our staff?",
    a: (
      <>
        <p>Someone uploads the latest exports whenever you want the list refreshed. Re-uploading the same file changes nothing, so there&rsquo;s no harm in doing it often. A physician reviews new flags; the front desk works the resulting calls and records requests from one shared list.</p>
        <p><Link href="/how-it-works#setup" className="font-medium text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand">See what setup involves</Link>.</p>
      </>
    ),
  },
  {
    q: "Does it use AI or contact patients?",
    a: <p>No to both. Flags come from four written rules you can read and tune. External AI is switched off, and the prototype never calls, texts, or emails patients.</p>,
  },
  {
    q: "Can we use it with real patients today?",
    a: <p>Not yet. SymptomWatch is a research and demonstration prototype that runs on fictional data only. It isn&rsquo;t clinically validated or HIPAA-compliant, and real records would require security, privacy, and legal work first.</p>,
  },
  {
    q: "What does it store?",
    a: <p>In the prototype: fictional patient details, visits, symptoms, appointments, lab orders, referrals, tasks, and flag reviews, plus account and audit records. A patient-name column in an import is used only to catch wrong-patient rows and is never saved. <Link href="/safety#stores" className="font-medium text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand">See the full list</Link>.</p>,
  },
  {
    q: "What does it cost?",
    a: <p>The demo is free. Pricing for real clinical use hasn&rsquo;t been set.</p>,
  },
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

      <section id="why" className="section-space scroll-mt-28 grid gap-10 lg:grid-cols-12 lg:gap-16" aria-labelledby="why-title">
        <div className="lg:col-span-5">
          <h2 id="why-title" className="section-heading text-[2rem] text-navy sm:text-[2.5rem]">Why this matters</h2>
          <p className="mt-8 text-[4.5rem] font-medium leading-none tracking-[-0.05em] text-navy sm:text-[6rem]">1 in 14</p>
          <p className="mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-body">abnormal test results had no record that the patient was ever told, across 23 primary care practices.</p>
        </div>
        <div className="space-y-5 lg:col-span-6 lg:col-start-7 lg:pt-16">
          <p className="lead">At one practice in the same study, it was about 1 in 4. Practices running on a mix of paper and electronic records missed more than practices using paper alone.</p>
          <p className="leading-relaxed text-body">These usually aren&rsquo;t errors of judgment. They&rsquo;re follow-ups that fall between systems: a result that arrives after the visit, a referral that goes quiet, a reminder that lives in someone&rsquo;s head. That&rsquo;s the gap SymptomWatch is designed to surface.</p>
          <p className="border-l border-border pl-4 text-[0.8125rem] leading-relaxed text-muted-foreground">
            Casalino LP, et al.{" "}
            <a href="https://pubmed.ncbi.nlm.nih.gov/19546413/" className="underline decoration-slate-500/50 underline-offset-4 hover:text-navy" rel="noopener noreferrer" target="_blank">
              Frequency of failure to inform patients of clinically significant outpatient test results
            </a>. <i>Arch Intern Med</i>. 2009;169(12):1123–1129.
          </p>
        </div>
      </section>

      <section id="what-it-looks-for" className="section-space scroll-mt-28 grid gap-12 border-t border-border lg:grid-cols-12 lg:gap-16" aria-labelledby="watch-title">
        <div className="lg:sticky lg:top-32 lg:col-span-5 lg:self-start">
          <h2 id="watch-title" className="section-heading text-[2rem] text-navy sm:text-[2.5rem]">What SymptomWatch looks for</h2>
          <p className="lead mt-5">Four kinds of follow-up that are easy to lose track of in a busy practice. The rules are simple and visible, so you can always see why something was flagged.</p>
          <p className="mt-4 leading-relaxed text-body">Each flag shows the records behind it. A physician decides what happens next, and the front desk gets a clear list of calls and records requests.</p>
          <Link href="/how-it-works#rules" className="text-link mt-4">Read the rules <ArrowRight aria-hidden /></Link>
        </div>
        <ul className="border-t border-border lg:col-span-7">
          {WATCHES.map(({ rule, title, body }) => {
            const example = exampleFlag(rule);
            return (
              <li key={rule} className="border-b border-border py-8">
                <h3 className="text-[1.125rem] font-medium tracking-[-0.015em] text-navy">{title}</h3>
                <p className="mt-2 leading-relaxed text-body">{body}</p>
                {example ? (
                  <p className="mt-4 rounded-md bg-surface px-3.5 py-2.5 text-[0.875rem] leading-relaxed text-body">
                    <span className="mr-2 text-muted-foreground">How a flag reads:</span>&ldquo;{example.title}&rdquo;
                  </p>
                ) : null}
              </li>
            );
          })}
          <li className="pt-4"><p className="meta-label">Examples are actual rule output on the fictional demo clinic.</p></li>
        </ul>
      </section>

      <section id="how" className="section-space scroll-mt-28 border-t border-border" aria-labelledby="how-title">
        <div className="mb-14 flex flex-wrap items-end justify-between gap-4">
          <h2 id="how-title" className="section-heading text-[2rem] text-navy sm:text-[2.5rem]">How it works</h2>
          <Link href="/how-it-works#setup" className="text-link">What setup involves <ArrowRight aria-hidden /></Link>
        </div>
        <LoopTrack steps={STEPS} />
      </section>

      <section id="product" className="section-space scroll-mt-28 border-t border-border" aria-labelledby="product-title">
        <div className="mb-12 grid gap-5 lg:grid-cols-12 lg:items-end lg:gap-16">
          <h2 id="product-title" className="section-heading text-[2rem] text-navy sm:text-[2.5rem] lg:col-span-6">One shared list for the whole team</h2>
          <p className="leading-relaxed text-body lg:col-span-5 lg:col-start-8">The same clinic, seen from three seats. Every number below is computed from the fictional demo data.</p>
        </div>
        <DashboardPreview />
        <dl className="mt-10 grid border-t border-border sm:grid-cols-3">
          {ROLES.map(({ role, body }) => (
            <div key={role} className="border-b border-border py-5 sm:border-b-0 sm:border-r sm:px-6 sm:first:pl-0 sm:last:border-r-0">
              <dt className="text-[0.9375rem] font-medium text-navy">{role}</dt>
              <dd className="mt-1.5 text-[0.9375rem] leading-relaxed text-body">{body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="faq" className="section-space scroll-mt-28 grid gap-10 border-t border-border lg:grid-cols-12 lg:gap-16" aria-labelledby="faq-title">
        <div className="lg:col-span-4">
          <h2 id="faq-title" className="section-heading text-[2rem] text-navy sm:text-[2.5rem]">Questions practices ask</h2>
          <p className="mt-5 leading-relaxed text-body">Something else? <Link href="/contact" className="font-medium text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand">Ask us directly</Link>.</p>
        </div>
        <div className="lg:col-span-8"><Faq items={FAQ} /></div>
      </section>

      <section id="safety" className="section-space scroll-mt-28 grid gap-10 border-t border-border lg:grid-cols-12 lg:gap-16" aria-labelledby="safety-title">
        <div className="lg:col-span-4">
          <h2 id="safety-title" className="section-heading text-[2rem] text-navy sm:text-[2.5rem]">Before you try it</h2>
          <div className="mt-6 flex flex-col gap-2.5 text-[0.9375rem] font-medium">
            <Link href="/safety" className="text-brand underline decoration-brand/40 underline-offset-4 transition-colors hover:decoration-brand">Our safety approach</Link>
            <Link href="/privacy" className="text-brand underline decoration-brand/40 underline-offset-4 transition-colors hover:decoration-brand">Privacy &amp; data policy</Link>
          </div>
        </div>
        <dl className="divide-y divide-border border-y border-border lg:col-span-8">
          <div className="grid gap-2 py-6 sm:grid-cols-[8rem_1fr] sm:gap-6">
            <dt className="text-[0.875rem] font-medium text-navy">Prototype</dt>
            <dd className="leading-relaxed text-body"><strong className="font-medium text-navy">This is a research and demonstration prototype.</strong> It uses fictional data only, is not clinically validated, and is not HIPAA-compliant. Do not enter real patient information. Input checks reduce risk; they cannot guarantee that free text contains no real information.</dd>
          </div>
          <div className="grid gap-2 py-6 sm:grid-cols-[8rem_1fr] sm:gap-6">
            <dt className="text-[0.875rem] font-medium text-navy">Scope</dt>
            <dd className="leading-relaxed text-body">SymptomWatch does not diagnose, recommend treatment, rank clinical urgency, or change care plans. Flags identify possible documentation gaps for clinician review.</dd>
          </div>
          <div className="grid gap-2 py-6 sm:grid-cols-[8rem_1fr] sm:gap-6">
            <dt className="text-[0.875rem] font-medium text-navy">Contact &amp; AI</dt>
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
