import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid flex-1 [&_input:not([type=checkbox])]:rounded-md lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <aside className="hidden flex-col border-r border-border bg-surface p-12 lg:flex">
        <Link href="/" className="self-start rounded-md" aria-label="SymptomWatch home"><Logo /></Link>
        <div className="my-auto max-w-md py-16">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">The demonstration clinic</p>
          <p className="display-heading mt-5 text-5xl text-navy">A place to work through the follow-up.</p>
          <p className="mt-6 leading-relaxed">Review a missing lab result. Check the referral timeline. Assign a records request to a colleague.</p>
          <p className="mt-4 leading-relaxed text-muted-foreground">Every patient and record is fictional. No calls, texts, or emails are sent to patients. Detection is rule-based; external AI is disabled.</p>
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
