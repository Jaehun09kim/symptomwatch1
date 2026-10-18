import {
  Gauge,
  History,
  Info,
  ListChecks,
  MessageSquareText,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  FileLock2,
  Upload,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  title: string;
  body: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  /** The group's own page; also the "overview" link inside its dropdown. */
  href: string;
  overview?: string;
  items?: NavItem[];
}

export const MARKETING_NAV: NavGroup[] = [
  {
    label: "Product",
    href: "/product",
    overview: "Product overview",
    items: [
      { href: "/product#flags", title: "Explainable flags", body: "Every possible gap shows its evidence and what's missing.", icon: ScanSearch },
      { href: "/product#queue", title: "Follow-up queue", body: "Calls, confirmations, and records requests, each with an owner.", icon: ListChecks },
      { href: "/product#timeline", title: "Patient timeline", body: "One chronological view with every entry labeled.", icon: History },
      { href: "/product#import", title: "Record import", body: "Bring lab and referral reports in from your EHR.", icon: Upload },
      { href: "/product#rules", title: "Detection rules", body: "Tune each rule for your clinic and see how it performs.", icon: SlidersHorizontal },
    ],
  },
  { label: "How it works", href: "/how-it-works" },
  {
    label: "Safety",
    href: "/safety",
    overview: "Our safety approach",
    items: [
      { href: "/safety#data", title: "Fictional data, enforced", body: "Guard rails that keep real patient information out.", icon: ShieldCheck },
      { href: "/safety#evaluation", title: "How we measure accuracy", body: "Our numbers, and why they aren't proof yet.", icon: Gauge },
      { href: "/privacy", title: "Privacy & data policy", body: "What the prototype stores and for how long.", icon: FileLock2 },
    ],
  },
  {
    label: "Company",
    href: "/about",
    overview: "About SymptomWatch",
    items: [
      { href: "/about", title: "Why we're building this", body: "The problem, who it's for, and where we stand.", icon: Info },
      { href: "/contact", title: "Request a walkthrough", body: "Tell us how follow-up works in your clinic.", icon: MessageSquareText },
    ],
  },
];

export function isActive(pathname: string, href: string): boolean {
  const path = href.split("#")[0];
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}
