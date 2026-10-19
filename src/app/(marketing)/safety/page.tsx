import type { Metadata } from "next";
import Link from "next/link";
import { container, CtaBand, PageIntro } from "@/components/marketing/page-intro";
import results from "../../../../evaluation/results/latest.json";

export const metadata: Metadata = {
  title: "Safety",
  description: "How the SymptomWatch prototype keeps real patient data out, keeps clinics separate, keeps detection transparent, and how we measure accuracy — honestly.",
};

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

const SECTIONS = [
  {
    id: "data",
    title: "Fictional data, enforced",
    points: [
      "Every patient, clinic, and staff member in SymptomWatch is fictional, and the database rejects anything else: record numbers must look like DEMO-12345 and phone numbers must use the fictional 555-01xx range.",
      "Free-text fields block things that look like Social Security numbers, real phone numbers, email addresses, outside record numbers, dates of birth, or pasted documents.",
      "Imports accept only demo record numbers from the current clinic. A patient-name column is used only to catch wrong-patient rows and is never stored.",
      "These checks reduce risk. They can't guarantee that text contains no real information, so real patient data must never be entered.",
    ],
  },
  {
    id: "separation",
    title: "Each clinic's data stays separate",
    points: [
      "Clinic separation is enforced by the database itself (row-level security), not only by the screens, and every query runs with the signed-in person's clinic and role.",
      "Roles limit what each person sees: the front desk never receives clinical notes, and only physicians can confirm, dismiss, or snooze a flag.",
      "Sign-ins, record views, reviews, imports, and settings changes are written to an audit log that the application can't edit.",
    ],
  },
  {
    id: "detection",
    title: "Detection you can read",
    points: [
      "Flags come from four written rules, versioned and shown on every flag, not from a model nobody can inspect.",
      "Flags describe possible documentation gaps. They never diagnose, recommend treatment, rank urgency, change a care plan, or contact a patient.",
      "External AI is switched off. No record data is sent to any third-party AI service.",
    ],
  },
];

export default function SafetyPage() {
  const { overall, dataset } = results;
  return (
    <div className={container}>
      <PageIntro title="Safety and privacy" label="Safety">
        <p>SymptomWatch is a research and demonstration prototype. It uses fictional data only, is <strong className="font-semibold text-navy">not clinically validated</strong>, and is <strong className="font-semibold text-navy">not HIPAA-compliant</strong>. Here&rsquo;s how it&rsquo;s built to be safe to explore, and what real use would still require.</p>
      </PageIntro>

      {SECTIONS.map((section) => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-28 grid gap-6 border-t border-border py-14 lg:grid-cols-12 lg:gap-16 lg:py-20">
          <h2 id={`${section.id}-title`} className="section-heading text-[1.6rem] sm:text-[1.9rem] lg:col-span-4">{section.title}</h2>
          <ul className="divide-y divide-border border-y border-border lg:col-span-8">
            {section.points.map((point) => <li key={point} className="py-4 leading-relaxed text-body">{point}</li>)}
          </ul>
        </section>
      ))}

      <section id="evaluation" aria-labelledby="evaluation-title" className="scroll-mt-28 grid gap-6 border-t border-border py-14 lg:grid-cols-12 lg:gap-16 lg:py-20">
        <div className="lg:col-span-4">
          <h2 id="evaluation-title" className="section-heading text-[1.6rem] sm:text-[1.9rem]">How we measure accuracy</h2>
          <p className="meta-label mt-3">Rules v{results.rulesVersion} · fictional dataset</p>
        </div>
        <div className="space-y-8 lg:col-span-8">
          <p className="leading-relaxed text-body">We check the rules against a fictional dataset of {dataset.patients} patients, where each of {dataset.units} follow-up situations was labeled in advance as a real gap or not ({dataset.positiveUnits} real gaps, including deliberately tricky cases).</p>
          <dl className="grid grid-cols-2 border-y border-border sm:grid-cols-4">
            {[
              ["Precision", percent(overall.precision), "of flags were real gaps"],
              ["Recall", percent(overall.recall), "of real gaps were flagged"],
              ["False alarms", percent(overall.falsePositiveRate), "of non-gaps were flagged"],
              ["Missed", String(overall.fn), `of ${dataset.positiveUnits} real gaps`],
            ].map(([label, value, note]) => (
              <div key={label} className="border-border py-5 pr-4 [&:nth-child(odd)]:border-r sm:border-r sm:pl-5 sm:first:pl-0 sm:last:border-r-0 [&:nth-child(even)]:pl-5 [&:nth-child(-n+2)]:border-b sm:[&:nth-child(-n+2)]:border-b-0">
                <dt className="text-[0.8125rem] text-muted-foreground">{label}</dt>
                <dd className="mt-2 text-[1.9rem] font-medium leading-none tracking-[-0.03em] tabular-nums text-navy">{value}</dd>
                <dd className="mt-2 text-xs text-muted-foreground">{note}</dd>
              </div>
            ))}
          </dl>
          <div className="border-l-2 border-attention bg-attention-soft px-5 py-4 text-sm leading-relaxed text-attention">
            <p className="font-medium">Why these numbers aren&rsquo;t proof</p>
            <p className="mt-1">The same team wrote the rules, the fictional cases, and the labels, so the results are likely optimistic. They show the rules behave as designed, not that they work in a real clinic.</p>
          </div>
          <p className="leading-relaxed text-body">Before any real use, the rules would need testing on de-identified real records with independent clinicians labeling them, a silent trial where flags are recorded but not shown, and the privacy, legal, and security work listed in our clinical deployment checklist.</p>
        </div>
      </section>

      <section aria-labelledby="privacy-link-title" className="border-t border-border py-12 lg:py-16">
        <h2 id="privacy-link-title" className="text-lg font-medium">More detail</h2>
        <p className="mt-2 leading-relaxed text-body">Read the <Link href="/privacy" className="font-medium text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand">privacy &amp; data policy</Link> for what the prototype stores and how long sandboxes last.</p>
      </section>

      <CtaBand
        title="Questions about safety?"
        body="If you run a clinic and want to understand what real use would take, we'd like to hear from you."
        primary={{ href: "/contact", label: "Request a walkthrough" }}
      />
    </div>
  );
}
