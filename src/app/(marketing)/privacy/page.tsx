import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy & data policy",
  description: "How the SymptomWatch prototype handles data: fictional records only, no patient messaging, no external AI.",
};

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "Fictional data only",
    body: (
      <>
        <p>
          SymptomWatch is a research and demonstration prototype. Every patient, clinic, staff member, and clinical
          detail in it is fictional. <strong>Entering real patient information is prohibited.</strong>
        </p>
        <p>
          Guard rails back this up: patient records can only be created from the synthetic dataset, CSV imports
          accept only demo record numbers from the current clinic, phone numbers must use the fictional 555-01xx range, and free-text fields reject things that
          look like Social Security numbers, real phone numbers, email addresses, outside medical record numbers, dates
          of birth, or pasted clinical documents. These checks reduce risk; they cannot guarantee that text contains no
          real information, so the responsibility not to enter it remains yours.
        </p>
      </>
    ),
  },
  {
    title: "What we store",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Demo accounts: email address, display name, and a salted password hash (never the password).</li>
        <li>Sessions: a hashed session token, timestamps, and expiry.</li>
        <li>Audit log: who did what and when inside a demo clinic. IP addresses are stored only as keyed hashes.</li>
        <li>Demo requests submitted through the contact form.</li>
        <li>Synthetic patient records, tasks, flags, and clinician feedback inside your demo workspace.</li>
      </ul>
    ),
  },
  {
    title: "What we never do",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Contact patients. The prototype sends no calls, texts, or emails to patients.</li>
        <li>Send record data to third-party AI services. Detection is rule-based and runs inside the application; external AI is disabled by a hard switch.</li>
        <li>Diagnose, rank clinical urgency, recommend treatment, or change care plans.</li>
        <li>Sell or share demo data.</li>
      </ul>
    ),
  },
  {
    title: "Demo workspaces",
    body: (
      <p>
        Workspaces created from “Try Demo” expire after seven days and are deleted. Any demo clinic administrator can
        reset their workspace to the original synthetic data at any time. Audit history is retained separately.
      </p>
    ),
  },
  {
    title: "Not HIPAA-compliant",
    body: (
      <>
        <p>
          The prototype includes security controls designed with healthcare in mind: clinic-level data isolation
          enforced by the database, role-based permissions, audit logging, hashed credentials, and input validation.
          Implementing these controls does not make a system HIPAA-compliant.
        </p>
        <p>
          Before any real deployment, SymptomWatch would need, among other things: a formal HIPAA risk analysis,
          business associate agreements with every vendor that touches data, multi-factor authentication, independent
          penetration testing, backup and disaster-recovery procedures, California privacy-law review (including CMIA),
          an FDA clinical-decision-support analysis, and clinical validation on de-identified data under appropriate
          review. The full list lives in the project&rsquo;s clinical deployment checklist
          (<code className="rounded-sm bg-surface px-1 font-mono text-[0.8em]">docs/CLINICAL_DEPLOYMENT_CHECKLIST.md</code>).
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
      <p className="meta-label mb-5">Policy · updated October 2026</p>
      <h1 className="display-heading text-[2.6rem] sm:text-6xl">Privacy &amp; data policy</h1>
      <p className="lead mt-6">
        Plain-language rules for the SymptomWatch demonstration prototype. Last updated October 2026.
      </p>
      <div className="mt-14 border-b border-border">
        {sections.map((section) => (
          <section key={section.title} aria-labelledby={section.title} className="grid gap-3 border-t border-border py-8 sm:grid-cols-[12rem_1fr] sm:gap-8">
            <h2 id={section.title} className="text-[1.05rem] font-medium tracking-[-0.015em]">{section.title}</h2>
            <div className="space-y-3 leading-relaxed text-body">{section.body}</div>
          </section>
        ))}
      </div>
    </article>
  );
}
