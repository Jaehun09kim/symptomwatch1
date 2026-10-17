import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const points = [
  "Every patient and record is fictional",
  "No calls, texts, or emails are sent to patients",
  "Rule-based detection; external AI disabled",
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_24rem_at_100%_0%,rgb(29_95_209/0.45),transparent),radial-gradient(30rem_20rem_at_0%_100%,rgb(14_159_142/0.35),transparent)]"
        />
        <Link href="/" className="relative rounded-md [&_span]:text-white" aria-label="SymptomWatch home">
          <Logo />
        </Link>
        <div className="relative mt-auto max-w-md">
          <p className="text-3xl font-semibold leading-tight text-white">
            The follow-up loops that slip through the cracks, in one calm view.
          </p>
          <ul className="mt-8 space-y-3 text-slate-200">
            {points.map((point) => (
              <li key={point} className="flex items-center gap-3">
                <CheckCircle2 className="size-5 shrink-0 text-teal" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-xs text-slate-400">
          Research &amp; demonstration prototype · Not clinically validated · Not HIPAA-compliant
        </p>
      </aside>
      <main id="main" className="flex flex-col px-4 py-10 sm:px-8">
        <Link href="/" className="mb-10 self-start rounded-md lg:hidden" aria-label="SymptomWatch home">
          <Logo />
        </Link>
        <div className="mx-auto w-full max-w-md flex-1 lg:flex lg:flex-col lg:justify-center">{children}</div>
      </main>
    </div>
  );
}
