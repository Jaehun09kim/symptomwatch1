import Link from "next/link";
import { ArrowRight, CalendarClock, FileSearch, FlaskConical, Repeat2 } from "lucide-react";
import { Hero } from "@/components/marketing/hero";
import { CtaBand } from "@/components/marketing/page-intro";
import { DashboardPreview } from "@/components/marketing/product-preview";
import { previewPatientName } from "@/components/marketing/preview-data";

const WATCHES = [
  { icon: CalendarClock, title: "Return visits that didn't happen", body: "A clinician asked the patient to come back in three months. No visit took place and nothing is booked." },
  { icon: FlaskConical, title: "Lab results that never came back", body: "A test was ordered, the expected turnaround passed, and there's still no result on file." },
  { icon: FileSearch, title: "Referrals without an outcome", body: "The specialist visit should have happened by now, but no consult note has arrived." },
  { icon: Repeat2, title: "Symptoms that keep returning", body: "The same complaint at several visits, still active, with no plan or work-up documented." },
];

const STEPS = [
  { title: "Bring in your records", body: "Import lab and referral reports from your EHR, or record visits and orders as they happen." },
  { title: "Review what's flagged", body: "Each flag lists the records behind it and what's missing. A physician confirms it, snoozes it, or dismisses it with a reason." },
  { title: "Close the loop", body: "Calls and records requests go to the front desk. When the missing record arrives, the flag closes on its own." },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <Hero patient={previewPatientName("hv-19")} />

      <section id="what-it-looks-for" className="scroll-mt-14 border-t border-border py-14 lg:py-20" aria-labelledby="watch-title">
        <div className="max-w-2xl">
          <h2 id="watch-title" className="display-heading text-3xl sm:text-4xl">What SymptomWatch looks for</h2>
          <p className="mt-4 text-lg leading-relaxed text-body">Four kinds of follow-up that are easy to lose track of in a busy practice. The rules are simple and visible, so you can always see why something was flagged.</p>
          <Link href="/how-it-works#rules" className="mt-4 inline-flex items-center gap-1 font-medium text-brand underline-offset-4 hover:underline">Read the rules <ArrowRight className="size-4" aria-hidden /></Link>
        </div>
        <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {WATCHES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <Icon className="mt-1 size-5 shrink-0 text-brand" aria-hidden />
              <div>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="mt-1.5 leading-relaxed text-body">{body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-16 rounded-2xl bg-surface p-6 sm:p-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="display-heading text-2xl sm:text-3xl">How it works</h2>
            <Link href="/how-it-works" className="inline-flex items-center gap-1 text-sm font-medium text-brand underline-offset-4 hover:underline">The full picture <ArrowRight className="size-4" aria-hidden /></Link>
          </div>
          <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-6">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative">
                <div className="flex items-center gap-3">
                  <span className={index === STEPS.length - 1 ? "grid size-8 place-items-center rounded-full bg-teal text-sm font-semibold text-white" : "grid size-8 place-items-center rounded-full bg-brand text-sm font-semibold text-white"}>{index + 1}</span>
                  {index < STEPS.length - 1 ? <span aria-hidden className="hidden h-px flex-1 bg-gradient-to-r from-brand/40 to-teal/40 md:block" /> : null}
                </div>
                <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
                <p className="mt-1.5 leading-relaxed text-body">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="product" className="scroll-mt-14 border-t border-border py-14 lg:py-20" aria-labelledby="product-title">
        <div className="mb-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-10">
          <h2 id="product-title" className="display-heading text-3xl sm:text-4xl">One shared list for the whole team</h2>
          <p className="max-w-xl leading-relaxed text-body">The front desk sees the calls and records requests. Physicians see clinical detail and review flags. Administrators manage access and the audit log.</p>
        </div>
        <DashboardPreview />
      </section>

      <section id="safety" className="scroll-mt-14 grid gap-6 border-y border-border py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-10 lg:py-16" aria-labelledby="safety-title">
        <div>
          <h2 id="safety-title" className="display-heading text-3xl sm:text-4xl">Before you try it</h2>
          <div className="mt-5 flex flex-col gap-2 text-sm font-medium">
            <Link href="/safety" className="text-brand underline underline-offset-4">Our safety approach</Link>
            <Link href="/privacy" className="text-brand underline underline-offset-4">Privacy &amp; data policy</Link>
          </div>
        </div>
        <div className="space-y-5 leading-relaxed">
          <p><strong className="font-semibold text-navy">This is a research and demonstration prototype.</strong> It uses fictional data only, is not clinically validated, and is not HIPAA-compliant. Do not enter real patient information. Input checks reduce risk; they cannot guarantee that free text contains no real information.</p>
          <p>SymptomWatch does not diagnose, recommend treatment, rank clinical urgency, or change care plans. Flags identify possible documentation gaps for clinician review.</p>
          <p><strong className="font-semibold text-navy">No patient contact.</strong> The prototype sends no calls, texts, or emails to patients. <strong className="font-semibold text-navy">External AI is disabled.</strong> Detection uses rules inside the application; no record data is sent to third-party AI services.</p>
        </div>
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
