import Link from "next/link";
import {
  ArrowRight,
  BellOff,
  ClipboardList,
  Database,
  Eye,
  FileSearch,
  Lock,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import { ProvenanceBadge } from "@/components/app/primitives/badges";
import { DemoRequestForm } from "@/components/marketing/demo-request-form";
import { DashboardPreview, FlagPreview, TimelinePreview } from "@/components/marketing/product-preview";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const benefits = [
  {
    icon: ClipboardList,
    title: "Never lose a follow-up loop",
    body: "Overdue visits, labs without results, and referrals without specialist records surface in one queue — instead of living in sticky notes, inboxes, and memory.",
  },
  {
    icon: ScanSearch,
    title: "Explainable flags, clinician in control",
    body: "Every possible gap shows exactly which chart entries triggered it and what is missing. Physicians confirm or dismiss; nothing changes a care plan on its own.",
  },
  {
    icon: UsersRound,
    title: "Built for small-clinic workflows",
    body: "Designed for practices with one to five physicians: front-desk staff work calls and records requests, physicians see clinical detail, administrators manage access.",
  },
];

const steps = [
  {
    icon: ClipboardList,
    title: "Organize follow-ups",
    body: "Visits, appointments, labs, and referrals line up on one longitudinal timeline per patient, with a shared task queue for the team.",
  },
  {
    icon: FileSearch,
    title: "Review explainable flags",
    body: "Transparent rules look for documentation gaps — never diagnoses — and show their evidence. Charted facts, missing records, and inferences are labeled distinctly.",
  },
  {
    icon: ShieldCheck,
    title: "Close the loop",
    body: "Confirm a gap and assign a task, or dismiss it with a reason. Feedback is recorded so rules can be evaluated and improved.",
  },
];

const safety = [
  { icon: Database, title: "Fictional data only", body: "Every patient in the prototype is synthetic. Free-text fields block identifiers like SSNs, real phone numbers, and outside record numbers." },
  { icon: BellOff, title: "No patient contact", body: "The prototype never calls, texts, or emails patients. Staff record outcomes of their own outreach." },
  { icon: Lock, title: "External AI disabled", body: "Detection is rule-based and runs inside the application. No record data is sent to third-party AI services." },
  { icon: Eye, title: "Honest about its status", body: "SymptomWatch is not HIPAA-compliant or clinically validated yet. We publish what real deployment would require." },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_70%_-10%,var(--sw-blue-soft),transparent),radial-gradient(40rem_24rem_at_0%_10%,var(--sw-teal-soft),transparent)]"
        />
        <div className="mx-auto grid max-w-7xl items-center gap-12 [&>*]:min-w-0 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:px-8 lg:pb-24 lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-white px-3 py-1 text-xs font-medium text-brand-hover shadow-soft">
              <Stethoscope className="size-3.5" aria-hidden />
              Follow-up coordination for independent primary care
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-[3.5rem]">
              Close the follow-up loops that slip through the cracks.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-body">
              SymptomWatch gives one-to-five-physician clinics a shared view of every open follow-up — missed visits,
              outstanding labs, missing specialist records — with explainable flags a physician can verify in seconds.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/demo" className={buttonVariants({ size: "lg" })}>
                Try Demo <ArrowRight aria-hidden />
              </Link>
              <Link href="/sign-up" className={buttonVariants({ size: "lg", variant: "outline" })}>
                Create Demo Account
              </Link>
            </div>
            <p className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span>Synthetic data only</span>
              <span aria-hidden>·</span>
              <span>No patient messaging</span>
              <span aria-hidden>·</span>
              <span>External AI disabled</span>
            </p>
          </div>
          <div id="product" className="scroll-mt-8">
            <DashboardPreview />
            <p className="mt-3 text-center text-xs text-slate-500">
              Live product components with the fictional Harbor View demo clinic.
            </p>
          </div>
        </div>
      </section>

      {/* Disclaimer strip */}
      <section aria-label="Prototype status" className="border-y border-border bg-surface">
        <p className="mx-auto max-w-7xl px-4 py-4 text-center text-sm text-body sm:px-6 lg:px-8">
          <strong className="font-semibold text-navy">Research &amp; demonstration prototype.</strong> Not clinically
          validated, not HIPAA-compliant, and not for real patient records.
        </p>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="benefits-title">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-brand">Why SymptomWatch</p>
          <h2 id="benefits-title" className="mt-2 text-3xl font-semibold sm:text-4xl">
            Less chasing. Fewer loose ends.
          </h2>
          <p className="mt-4 text-lg text-body">
            Small clinics run follow-up on memory and goodwill. SymptomWatch turns it into a visible, shared workflow.
          </p>
        </div>
        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {benefits.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-2xl border border-border bg-white p-6 shadow-soft">
              <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-body">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-8 bg-surface py-20" aria-labelledby="how-title">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 [&>*]:min-w-0 lg:px-8">
          <div>
            <p className="text-sm font-semibold text-brand">How it works</p>
            <h2 id="how-title" className="mt-2 text-3xl font-semibold sm:text-4xl">
              From scattered records to a closed loop
            </h2>
            <ol className="mt-10 space-y-8">
              {steps.map(({ icon: Icon, title, body }, index) => (
                <li key={title} className="flex gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-sm font-semibold text-brand shadow-soft ring-1 ring-border">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                      <Icon className="size-4 text-teal" aria-hidden />
                      {title}
                    </h3>
                    <p className="mt-1.5 leading-relaxed text-body">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-10 rounded-xl border border-border bg-white p-4">
              <p className="text-sm font-medium text-navy">Every entry says where it came from</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ProvenanceBadge kind="documented" />
                <ProvenanceBadge kind="not_documented" />
                <ProvenanceBadge kind="rule_inferred" />
              </div>
            </div>
          </div>
          <TimelinePreview />
        </div>
      </section>

      {/* Second preview row */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="explain-title">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] [&>*]:min-w-0">
          <div>
            <p className="text-sm font-semibold text-brand">Explainable by design</p>
            <h2 id="explain-title" className="mt-2 text-3xl font-semibold sm:text-4xl">
              See what was flagged, why, and what&rsquo;s missing
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-body">
              Flags come from transparent, versioned rules — not a black box. Each one cites the visit, appointment,
              lab, or referral it is based on, lists what is undocumented, and records whether a clinician has reviewed
              it.
            </p>
            <ul className="mt-6 space-y-3 text-body">
              {[
                "Phrased as documentation questions — never diagnoses or urgency scores",
                "Rescheduled visits, declined referrals, and documented chronic plans are not flagged",
                "Physician confirmations, dismissals, and feedback are kept for evaluation",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <Sparkles className="mt-1 size-4 shrink-0 text-teal" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <FlagPreview className="shadow-float" />
        </div>
      </section>

      {/* Safety */}
      <section id="safety" className="scroll-mt-8 border-y border-border bg-navy py-20 text-white" aria-labelledby="safety-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-teal-soft">Safety &amp; privacy</p>
            <h2 id="safety-title" className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
              A prototype that knows it&rsquo;s a prototype
            </h2>
            <p className="mt-4 text-lg text-slate-300">
              Clinic-level data isolation, role-based permissions, and audit logging are built in from day one — but
              we don&rsquo;t claim compliance we haven&rsquo;t earned.
            </p>
          </div>
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {safety.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <Icon className="size-5 text-teal" aria-hidden />
                <h3 className="mt-4 font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{body}</p>
              </li>
            ))}
          </ul>
          <Link href="/privacy" className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-white underline-offset-4 hover:underline">
            Read the data policy and what real deployment would require <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-8 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="contact-title">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] [&>*]:min-w-0">
          <div>
            <p className="text-sm font-semibold text-brand">Talk to us</p>
            <h2 id="contact-title" className="mt-2 text-3xl font-semibold sm:text-4xl">Request a walkthrough</h2>
            <p className="mt-4 text-lg leading-relaxed text-body">
              Running an independent practice in Orange County? Tell us how follow-up works in your clinic today. Or skip
              ahead — the demo takes about two minutes and needs no installation.
            </p>
            <Link href="/demo" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-6")}>
              Explore the demo first
            </Link>
          </div>
          <div className="rounded-2xl border border-border bg-white p-6 shadow-card sm:p-8">
            <DemoRequestForm />
          </div>
        </div>
      </section>
    </>
  );
}
