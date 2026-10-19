import type { Metadata } from "next";
import Link from "next/link";
import { DemoRequestForm } from "@/components/marketing/demo-request-form";
import { container, PageIntro } from "@/components/marketing/page-intro";

export const metadata: Metadata = {
  title: "Request a walkthrough",
  description: "Tell us how follow-up works in your clinic and request a walkthrough of the SymptomWatch prototype.",
};

export default function ContactPage() {
  return (
    <div className={container}>
      <PageIntro title="Request a walkthrough">
        <p>Running a small practice in Orange County? Tell us how follow-up works in your clinic today and what&rsquo;s hard to keep track of.</p>
      </PageIntro>
      <section id="contact" aria-label="Walkthrough request" className="grid gap-12 border-t border-border py-14 lg:grid-cols-12 lg:gap-16 lg:py-20">
        <div className="space-y-4 text-[0.9375rem] leading-relaxed text-body lg:col-span-4">
          <h2 className="text-[1rem] font-medium text-navy">What a walkthrough is</h2>
          <p>A short conversation. You tell us how follow-up works in your clinic today; we show SymptomWatch on fictional patients and answer your questions, including what real use would take.</p>
          <h2 className="pt-2 text-[1rem] font-medium text-navy">What happens next</h2>
          <p>Your request is saved for the SymptomWatch team. This prototype doesn&rsquo;t send automated email.</p>
          <p>Please leave out any patient information. Describe your workflow, not your patients.</p>
          <p>Prefer to look first? <Link href="/demo" className="font-medium text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand">Try the demo</Link> with fictional patients.</p>
        </div>
        <div className="min-w-0 lg:col-span-8"><DemoRequestForm /></div>
      </section>
    </div>
  );
}
