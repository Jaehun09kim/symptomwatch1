import type { Metadata } from "next";
import { container, CtaBand, PageIntro } from "@/components/marketing/page-intro";

export const metadata: Metadata = {
  title: "About",
  description: "Why SymptomWatch exists, who it's for, and where the prototype stands.",
};

const SECTIONS = [
  {
    title: "The problem",
    body: [
      "In a small practice, follow-up lives in many places at once: an inbox of results, a stack of referral faxes, a reminder on a sticky note, someone's memory. Most of the time it works. When it doesn't, a lab result goes unread or a specialist's note never arrives, and nobody notices until the patient comes back.",
      "Large health systems have teams and software for this. Practices with one to five physicians usually don't.",
    ],
  },
  {
    title: "What we're building",
    body: [
      "SymptomWatch is a shared list of the follow-ups a clinic owes its patients, with a simple check running underneath it. It compares what was asked for with what the records show and raises the difference for a physician to review.",
      "We chose plain, readable rules over AI on purpose. A clinician should be able to see exactly why something was flagged and disagree with it.",
    ],
  },
  {
    title: "Where it stands",
    body: [
      "SymptomWatch is a working prototype with fictional data. It isn't clinically validated or HIPAA-compliant, and it isn't ready for real patient records.",
      "Right now we're talking with independent primary care practices in Orange County, California, to learn how follow-up actually works in their clinics and what would make a tool like this worth using.",
    ],
  },
];

export default function AboutPage() {
  return (
    <div className={container}>
      <PageIntro title="Why we're building SymptomWatch">
        <p>Small primary care practices do careful work with very little room for error. We want to make sure the follow-ups they intend actually happen.</p>
      </PageIntro>
      {/* The problem gets the full measure; the two answers sit side by side. */}
      <section aria-labelledby="problem-title" className="section-space border-t border-border">
        <h2 id="problem-title" className="section-heading text-[1.6rem] text-navy sm:text-[1.9rem]">{SECTIONS[0].title}</h2>
        <div className="mt-6 max-w-3xl space-y-5">
          <p className="text-[1.35rem] leading-[1.5] tracking-[-0.01em] text-navy sm:text-[1.6rem]">{SECTIONS[0].body[0]}</p>
          {SECTIONS[0].body.slice(1).map((paragraph) => <p key={paragraph} className="lead">{paragraph}</p>)}
        </div>
      </section>
      <div className="section-space grid gap-12 border-t border-border md:grid-cols-2 md:gap-16">
        {SECTIONS.slice(1).map((section) => (
          <section key={section.title} aria-label={section.title}>
            <h2 className="section-heading text-[1.6rem] text-navy sm:text-[1.9rem]">{section.title}</h2>
            <div className="mt-5 space-y-4 leading-relaxed text-body">
              {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </section>
        ))}
      </div>
      <CtaBand
        title="Run a small practice?"
        body="Tell us how follow-up works in your clinic today. A 20-minute conversation helps us more than anything else."
        primary={{ href: "/contact", label: "Request a walkthrough" }}
        secondary={{ href: "/demo", label: "Try the demo" }}
      />
    </div>
  );
}
