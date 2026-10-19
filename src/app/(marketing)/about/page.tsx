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
      <PageIntro title="Why we're building SymptomWatch" label="About">
        <p>Small primary care practices do careful work with very little room for error. We want to make sure the follow-ups they intend actually happen.</p>
      </PageIntro>
      {SECTIONS.map((section, index) => (
        <section key={section.title} className="grid gap-6 border-t border-border py-14 lg:grid-cols-12 lg:gap-16 lg:py-20">
          <div className="lg:col-span-4">
            <p className="meta-label tabular-nums">{String(index + 1).padStart(2, "0")}</p>
            <h2 className="section-heading mt-3 text-[1.6rem] sm:text-[1.9rem]">{section.title}</h2>
          </div>
          <div className="lead max-w-2xl space-y-5 lg:col-span-8">
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
