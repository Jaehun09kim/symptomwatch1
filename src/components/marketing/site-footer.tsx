import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { MARKETING_NAV } from "./nav-config";

const product = MARKETING_NAV.find((group) => group.label === "Product")!;

const COLUMNS = [
  { label: "Product", links: [{ href: product.href, title: product.overview! }, ...product.items!.map(({ href, title }) => ({ href, title }))] },
  { label: "Trust", links: [
    { href: "/safety", title: "Safety approach" },
    { href: "/safety#stores", title: "What we store" },
    { href: "/safety#evaluation", title: "How we measure accuracy" },
    { href: "/privacy", title: "Privacy & data policy" },
  ] },
  { label: "Company", links: [
    { href: "/about", title: "About SymptomWatch" },
    { href: "/how-it-works#setup", title: "What setup involves" },
    { href: "/contact", title: "Request a walkthrough" },
  ] },
];

const link = "inline-flex min-h-7 items-center rounded-sm text-slate-500 underline-offset-4 transition-colors duration-150 hover:text-navy hover:underline focus-visible:text-navy";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-14 sm:px-6 sm:grid-cols-3 lg:grid-cols-[1.7fr_1fr_1fr_1fr] lg:px-8">
        <div className="col-span-2 max-w-sm sm:col-span-3 lg:col-span-1">
          <Logo markClassName="size-6" />
          <p className="mt-4 text-[0.8125rem] leading-relaxed text-slate-500">
            A research and demonstration prototype for follow-up coordination in independent primary-care clinics. It
            runs only on fictional data, is not clinically validated, and is not HIPAA-compliant. Do not enter real
            patient information.
          </p>
          <div className="mt-5 flex gap-5 text-[0.8125rem] font-medium">
            <Link className={link} href="/demo">Try the demo</Link>
            <Link className={link} href="/how-it-works">How it works</Link>
            <Link className={link} href="/sign-in">Sign in</Link>
          </div>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.label} aria-label={column.label}>
            <p className="text-[0.8125rem] font-medium text-navy">{column.label}</p>
            <ul className="mt-3 space-y-1 text-[0.8125rem]">
              {column.links.map((item) => <li key={item.href}><Link className={link} href={item.href}>{item.title}</Link></li>)}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-5 sm:px-6 lg:px-8">
          <p className="meta-label">© 2026 SymptomWatch (prototype). All patients, clinics, and staff shown are fictional.</p>
          <p className="meta-label">Rule-based detection · external AI off</p>
        </div>
      </div>
    </footer>
  );
}
