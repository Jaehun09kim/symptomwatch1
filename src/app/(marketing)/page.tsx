import Link from "next/link";
import { DemoRequestForm } from "@/components/marketing/demo-request-form";
import { DashboardPreview, FlagPreview } from "@/components/marketing/product-preview";
import { previewPatientName } from "@/components/marketing/preview-data";
import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <section className="grid gap-10 py-14 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-24 [&>*]:min-w-0" aria-labelledby="story-title">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Follow-up coordination / Independent primary care</p>
          <h1 id="story-title" className="display-heading mt-6 text-4xl sm:text-5xl lg:text-6xl">
            The referral was sent.<br />The consult note never arrived.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed">
            {previewPatientName("hv-08")}&rsquo;s gastroenterology appointment was scheduled for seven weeks ago.
            His chart still has no specialist records. Is the visit complete, or does someone need to check?
          </p>
          <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
            SymptomWatch brings that question to the surface, with the entries behind it.
            Built for primary-care teams of one to five physicians to review possible documentation gaps and assign follow-up work.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/demo" className={buttonVariants({ size: "lg" })}>Try Demo</Link>
            <Link href="/sign-up" className={buttonVariants({ size: "lg", variant: "outline" })}>Create Demo Account</Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">A fictional case from the demo clinic. No patient messaging.</p>
        </div>
        <div className="lg:pt-10"><FlagPreview /></div>
      </section>

      <section id="how-it-works" className="scroll-mt-14 border-t border-border py-12 lg:py-16" aria-labelledby="how-title">
        <div className="grid gap-8 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <h2 id="how-title" className="display-heading text-3xl sm:text-4xl">A flag is a question<br className="hidden lg:block" /> for the chart.</h2>
          <div>
            <p className="max-w-2xl text-lg leading-relaxed">A missing record does not tell you whether care happened. Each flag separates what is documented from what the rule cannot find. A clinician decides what it means.</p>
            <ol className="mt-8 divide-y divide-border border-y border-border">
              {[
                ["01", "Read the evidence", "Open the dated chart entries behind the flag. The rule and its version are shown alongside the missing information."],
                ["02", "Make the review decision", "Confirm a possible gap and optionally create a task, or dismiss it with a reason. The review is recorded."],
                ["03", "Give the work an owner", "Assign calls, appointment confirmations, and records requests to staff. Record an outcome when the task is complete."],
              ].map(([number, title, body]) => (
                <li key={number} className="grid grid-cols-[2rem_1fr] gap-4 py-5 sm:grid-cols-[2rem_11rem_1fr]">
                  <span className="pt-0.5 font-mono text-xs text-muted-foreground">{number}</span>
                  <h3 className="font-medium">{title}</h3>
                  <p className="col-start-2 text-sm leading-relaxed text-body sm:col-start-auto">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="product" className="scroll-mt-14 border-t border-border py-12 lg:py-16" aria-labelledby="product-title">
        <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <h2 id="product-title" className="display-heading max-w-xl text-3xl sm:text-4xl">A working list for the people<br className="hidden sm:block" /> who follow up.</h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">Front-desk staff see administrative work. Physicians can inspect clinical detail and review flags. Clinic administrators manage access and review the audit log.</p>
        </div>
        <DashboardPreview />
      </section>

      <section id="safety" className="scroll-mt-14 grid gap-8 border-y border-border py-12 lg:grid-cols-[1fr_2fr] lg:gap-16 lg:py-16" aria-labelledby="safety-title">
        <div>
          <h2 id="safety-title" className="display-heading text-3xl sm:text-4xl">Before you try it.</h2>
          <Link href="/privacy" className="mt-5 inline-block text-sm font-medium text-brand underline underline-offset-4">Privacy &amp; data policy</Link>
        </div>
        <div className="space-y-5 leading-relaxed">
          <p><strong className="font-medium text-navy">This is a research and demonstration prototype.</strong> It uses fictional data only, is not clinically validated, and is not HIPAA-compliant. Do not enter real patient information. Input checks reduce risk; they cannot guarantee that free text contains no real information.</p>
          <p>SymptomWatch does not diagnose, recommend treatment, rank clinical urgency, or change care plans. Flags identify possible documentation gaps for clinician review.</p>
          <p><strong className="font-medium text-navy">No patient contact.</strong> The prototype sends no calls, texts, or emails to patients. <strong className="font-medium text-navy">External AI is disabled.</strong> Detection uses rules inside the application; no record data is sent to third-party AI services.</p>
        </div>
      </section>

      <section id="contact" className="scroll-mt-14 grid gap-10 py-12 lg:grid-cols-[1fr_1.3fr] lg:gap-20 lg:py-20" aria-labelledby="contact-title">
        <div>
          <h2 id="contact-title" className="display-heading text-3xl sm:text-4xl">Show us how your clinic<br className="hidden lg:block" /> handles follow-up.</h2>
          <p className="mt-5 max-w-md leading-relaxed">Running a small practice in Orange County? Tell us where follow-up work lives today and what is hard to keep track of.</p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">Request a walkthrough using the form. This prototype stores your request but does not send email. Please leave out patient information.</p>
          <Link href="/demo" className="mt-6 inline-block text-sm font-medium text-brand underline underline-offset-4">Explore the demo first</Link>
        </div>
        <div className="border-l-2 border-border pl-5 sm:pl-8"><DemoRequestForm /></div>
      </section>
    </div>
  );
}
