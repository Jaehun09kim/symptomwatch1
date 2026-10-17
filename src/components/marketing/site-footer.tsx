import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
        <div className="max-w-md">
          <Logo />
          <p className="mt-3 text-sm text-slate-600">
            A research and demonstration prototype for follow-up coordination in independent primary-care clinics. It
            runs only on fictional data, is not clinically validated, and is not HIPAA-compliant. Do not enter real
            patient information.
          </p>
        </div>
        <nav aria-label="Product">
          <p className="text-sm font-semibold text-navy">Product</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li><Link className="hover:text-navy" href="/demo">Try the demo</Link></li>
            <li><Link className="hover:text-navy" href="/sign-up">Create demo account</Link></li>
            <li><Link className="hover:text-navy" href="/sign-in">Sign in</Link></li>
          </ul>
        </nav>
        <nav aria-label="Trust">
          <p className="text-sm font-semibold text-navy">Trust</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li><Link className="hover:text-navy" href="/privacy">Privacy &amp; data policy</Link></li>
            <li><Link className="hover:text-navy" href="/#safety">Safety approach</Link></li>
            <li><Link className="hover:text-navy" href="/#contact">Request a walkthrough</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-slate-500 sm:px-6 lg:px-8">
          © 2026 SymptomWatch (prototype). All patients, clinics, and staff shown are fictional.
        </p>
      </div>
    </footer>
  );
}
