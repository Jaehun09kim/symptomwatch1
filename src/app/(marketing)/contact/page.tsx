import type { Metadata } from "next";
import Link from "next/link";
import { DemoRequestForm } from "@/components/marketing/demo-request-form";
import { PageIntro } from "@/components/marketing/page-intro";

export const metadata: Metadata = {
  title: "Request a walkthrough",
  description: "Tell us how follow-up works in your clinic and request a walkthrough of the SymptomWatch prototype.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <PageIntro title="Request a walkthrough">
        <p>Running a small practice in Orange County? Tell us how follow-up works in your clinic today and what&rsquo;s hard to keep track of.</p>
      </PageIntro>
      <section id="contact" aria-label="Walkthrough request" className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12 lg:py-16">
        <div className="space-y-4 text-sm leading-relaxed text-body">
          <p className="text-base font-semibold text-navy">What to expect</p>
          <p>Your request is saved for the SymptomWatch team. This prototype doesn&rsquo;t send automated email.</p>
          <p>Please leave out any patient information. Describe your workflow, not your patients.</p>
          <p>Prefer to look first? <Link href="/demo" className="font-medium text-brand underline underline-offset-4">Try the demo</Link> with fictional patients.</p>
        </div>
        <div className="min-w-0"><DemoRequestForm /></div>
      </section>
    </div>
  );
}
