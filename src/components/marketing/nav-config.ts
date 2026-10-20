import {
  History,
  ListChecks,
  ScanSearch,
  SlidersHorizontal,
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
  { label: "Safety", href: "/safety" },
  { label: "About", href: "/about" },
];

export function isActive(pathname: string, href: string): boolean {
  const path = href.split("#")[0];
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}
