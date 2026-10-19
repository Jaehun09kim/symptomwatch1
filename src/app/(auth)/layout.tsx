import type { Viewport } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const POINTS = [
  "Review flagged lab results, referrals, and missed follow-ups",
  "Assign calls and records requests to the front desk",
  "Import an EHR export and watch gaps close",
];

export const viewport: Viewport = { themeColor: "#08090a" };

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="dark marketing-root grid flex-1 bg-background text-body lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <aside className="hidden flex-col border-r border-border bg-sidebar p-10 lg:flex xl:p-16">
        <Link href="/" className="self-start rounded-md" aria-label="SymptomWatch home"><Logo markClassName="size-6" /></Link>
        <div className="my-auto max-w-md py-16">
          <p className="meta-label">Demo workspace</p>
          <p className="display-heading mt-4 text-[2.5rem] text-navy">The SymptomWatch demo</p>
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {POINTS.map((line, index) => (
              <li key={line} className="grid grid-cols-[2rem_1fr] py-3.5 text-[0.9375rem] leading-relaxed">
                <span className="meta-label pt-1 tabular-nums">{String(index + 1).padStart(2, "0")}</span>{line}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[0.9375rem] leading-relaxed text-muted-foreground">Every patient and record is fictional. No calls, texts, or emails are sent to patients. Detection is rule-based; external AI is disabled.</p>
        </div>
        <p className="meta-label border-t border-border pt-5 leading-relaxed">Research and demonstration prototype.<br />Not clinically validated. Not HIPAA-compliant.</p>
      </aside>
      <main id="main" className="flex flex-col px-5 py-10 sm:px-8 lg:py-16">
        <Link href="/" className="mb-10 self-start rounded-md lg:hidden" aria-label="SymptomWatch home"><Logo markClassName="size-6" /></Link>
        <div className="mx-auto w-full max-w-md flex-1 lg:flex lg:flex-col lg:justify-center">{children}</div>
      </main>
    </div>
  );
}
