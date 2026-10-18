import Link from "next/link";
import { Check } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid flex-1 [&_input:not([type=checkbox])]:rounded-md lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <aside className="hidden flex-col border-r border-border bg-brand-soft p-12 lg:flex">
        <Link href="/" className="self-start rounded-md" aria-label="SymptomWatch home"><Logo /></Link>
        <div className="my-auto max-w-md py-16">
          <p className="display-heading text-4xl text-navy">The SymptomWatch demo</p>
          <ul className="mt-6 space-y-3 leading-relaxed">
            {["Review flagged lab results, referrals, and missed follow-ups", "Assign calls and records requests to the front desk", "Import an EHR export and watch gaps close"].map((line) => (
              <li key={line} className="flex gap-3"><Check className="mt-1 size-4 shrink-0 text-teal" aria-hidden />{line}</li>
            ))}
          </ul>
          <p className="mt-6 leading-relaxed text-muted-foreground">Every patient and record is fictional. No calls, texts, or emails are sent to patients. Detection is rule-based; external AI is disabled.</p>
        </div>
        <p className="border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">Research and demonstration prototype.<br />Not clinically validated. Not HIPAA-compliant.</p>
      </aside>
      <main id="main" className="flex flex-col px-4 py-10 sm:px-8">
        <Link href="/" className="mb-10 self-start rounded-md lg:hidden" aria-label="SymptomWatch home"><Logo /></Link>
        <div className="mx-auto w-full max-w-md flex-1 lg:flex lg:flex-col lg:justify-center">{children}</div>
      </main>
    </div>
  );
}
