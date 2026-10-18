import type { Metadata } from "next";
import { CtaBand, PageIntro } from "@/components/marketing/page-intro";

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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <PageIntro title="Why we're building SymptomWatch">
        <p>Small primary care practices do careful work with very little room for error. We want to make sure the follow-ups they intend actually happen.</p>
      </PageIntro>
      {SECTIONS.map((section) => (
        <section key={section.title} className="grid gap-6 border-b border-border py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12 lg:py-16">
          <h2 className="display-heading text-2xl sm:text-3xl">{section.title}</h2>
          <div className="max-w-3xl space-y-4 text-lg leading-relaxed text-body">
            {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </section>
      ))}
      <CtaBand
        title="Run a small practice?"
        body="Tell us how follow-up works in your clinic today. A 20-minute conversation helps us more than anything else."
        primary={{ href: "/contact", label: "Request a walkthrough" }}
        secondary={{ href: "/demo", label: "Try the demo" }}
      />
    </div>
  );
}
