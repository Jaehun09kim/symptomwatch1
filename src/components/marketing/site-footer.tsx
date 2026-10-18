import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { MARKETING_NAV } from "./nav-config";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:px-8">
        <div className="max-w-md">
          <Logo />
          <p className="mt-3 text-sm text-slate-600">
            A research and demonstration prototype for follow-up coordination in independent primary-care clinics. It
            runs only on fictional data, is not clinically validated, and is not HIPAA-compliant. Do not enter real
            patient information.
          </p>
          <div className="mt-4 flex gap-4 text-sm font-medium">
            <Link className="text-brand hover:underline" href="/demo">Try the demo</Link>
            <Link className="text-brand hover:underline" href="/how-it-works">How it works</Link>
            <Link className="text-brand hover:underline" href="/sign-in">Sign in</Link>
          </div>
        </div>
        {MARKETING_NAV.filter((group) => group.items).map((group) => (
          <nav key={group.label} aria-label={group.label}>
            <p className="text-sm font-semibold text-navy">{group.label}</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><Link className="hover:text-navy" href={group.href}>{group.overview}</Link></li>
              {group.items!.map((item) => <li key={item.href}><Link className="hover:text-navy" href={item.href}>{item.title}</Link></li>)}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-slate-500 sm:px-6 lg:px-8">
          © 2026 SymptomWatch (prototype). All patients, clinics, and staff shown are fictional.
        </p>
      </div>
    </footer>
  );
}
