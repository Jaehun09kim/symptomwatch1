"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronDown, Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { isActive, MARKETING_NAV, type NavGroup } from "./nav-config";

const EASE = [0.22, 1, 0.36, 1] as const;
const OPEN_DELAY = 60;
const CLOSE_DELAY = 140;

/**
 * Desktop navigation: disclosure dropdowns (buttons with aria-expanded, not an
 * ARIA menu), opened by hover intent or click, closed by Escape, outside click,
 * or choosing a link. A shared hover pill slides between top-level items.
 */
function DesktopNav() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  /** When hover opened a panel; a click right after shouldn't immediately close it. */
  const hoverOpenedAt = useRef(0);
  const navRef = useRef<HTMLElement>(null);
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({});
  const baseId = useId();

  const schedule = (next: string | null, delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (next) hoverOpenedAt.current = Date.now();
      setOpen(next);
    }, delay);
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const current = open;
      setOpen(null);
      triggers.current[current]?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onTriggerKey = (event: ReactKeyboardEvent<HTMLButtonElement>, group: NavGroup) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(group.label);
      window.requestAnimationFrame(() => document.getElementById(`${baseId}-${group.label}`)?.querySelector<HTMLElement>("a")?.focus());
    }
  };

  return (
    <nav ref={navRef} aria-label="Primary" className="hidden flex-1 md:block" onMouseLeave={() => { setHovered(null); schedule(null, CLOSE_DELAY); }}>
      <ul className="flex items-center gap-0.5">
        {MARKETING_NAV.map((group) => {
          const active = isActive(pathname, group.href);
          const expanded = open === group.label;
          const panelId = `${baseId}-${group.label}`;
          const itemClass = cn(
            "relative isolate inline-flex h-9 items-center gap-1 rounded-full px-3.5 text-[0.9rem] font-medium transition-colors",
            active || expanded ? "text-navy" : "text-slate-600 hover:text-navy",
          );
          const pill = hovered === group.label || expanded ? (
            <m.span layoutId="marketing-nav-pill" aria-hidden className="absolute inset-0 -z-10 rounded-full bg-surface"
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }} />
          ) : null;
          return (
            <li key={group.label} className="relative" onMouseEnter={() => { setHovered(group.label); schedule(group.items ? group.label : null, OPEN_DELAY); }}>
              {group.items ? (
                <>
                  <button
                    ref={(node) => { triggers.current[group.label] = node; }}
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => {
                      window.clearTimeout(timer.current);
                      if (expanded && Date.now() - hoverOpenedAt.current < 400) return;
                      setOpen(expanded ? null : group.label);
                    }}
                    onKeyDown={(event) => onTriggerKey(event, group)}
                    className={itemClass}
                  >
                    {pill}
                    {group.label}
                    {active ? <span className="sr-only"> (current section)</span> : null}
                    <m.span aria-hidden animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2, ease: EASE }} className="inline-flex">
                      <ChevronDown className="size-3.5" />
                    </m.span>
                  </button>
                  <AnimatePresence>
                    {expanded ? (
                      <m.div
                        id={panelId}
                        initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
                        transition={{ duration: 0.2, ease: EASE }}
                        style={{ transformOrigin: "top left" }}
                        className="absolute left-0 top-full z-40 pt-2"
                      >
                        <div className="w-[26rem] overflow-hidden rounded-2xl border border-border bg-card shadow-float">
                          <ul className="p-2">
                            {group.items.map((item, index) => (
                              <m.li key={item.href}
                                initial={reduce ? false : { opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.18, ease: EASE, delay: reduce ? 0 : 0.02 * index }}>
                                <Link href={item.href} onClick={() => setOpen(null)}
                                  className="group flex gap-3 rounded-xl p-3 outline-none transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-ring">
                                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                                    <item.icon className="size-[18px]" aria-hidden />
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-navy">{item.title}</span>
                                    <span className="mt-0.5 block text-[0.8rem] leading-snug text-muted-foreground">{item.body}</span>
                                  </span>
                                </Link>
                              </m.li>
                            ))}
                          </ul>
                          <Link href={group.href} onClick={() => setOpen(null)}
                            className="group flex items-center justify-between border-t border-border bg-surface px-5 py-3 text-sm font-medium text-brand outline-none hover:text-brand-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                            {group.overview}
                            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                          </Link>
                        </div>
                      </m.div>
                    ) : null}
                  </AnimatePresence>
                </>
              ) : (
                <Link href={group.href} aria-current={active ? "page" : undefined} className={itemClass} onClick={() => setOpen(null)}>
                  {pill}
                  {group.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Mobile: a sheet with accordion groups that expand with a height animation. */
function MobileNav() {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "ml-auto md:hidden")} aria-label="Open menu">
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="right" className="w-[88vw] max-w-sm overflow-y-auto">
        <SheetHeader>
          <SheetTitle><Logo /></SheetTitle>
        </SheetHeader>
        <nav aria-label="Mobile" className="px-4 pb-8">
          <ul className="divide-y divide-border border-y border-border">
            {MARKETING_NAV.map((group) => {
              const expanded = section === group.label;
              return (
                <li key={group.label}>
                  {group.items ? (
                    <>
                      <button type="button" aria-expanded={expanded} onClick={() => setSection(expanded ? null : group.label)}
                        className="flex min-h-12 w-full items-center justify-between text-left text-base font-semibold text-navy">
                        {group.label}
                        <m.span aria-hidden animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2, ease: EASE }} className="inline-flex">
                          <ChevronDown className="size-4 text-slate-500" />
                        </m.span>
                      </button>
                      <AnimatePresence initial={false}>
                        {expanded ? (
                          <m.ul
                            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: EASE }}
                            className="overflow-hidden"
                          >
                            {[{ href: group.href, title: group.overview ?? group.label }, ...group.items].map((item) => (
                              <li key={item.href}>
                                <Link href={item.href} onClick={close} className="flex min-h-11 items-center rounded-lg px-3 text-[0.95rem] text-body hover:bg-surface hover:text-navy">
                                  {item.title}
                                </Link>
                              </li>
                            ))}
                            <li aria-hidden className="h-2" />
                          </m.ul>
                        ) : null}
                      </AnimatePresence>
                    </>
                  ) : (
                    <Link href={group.href} onClick={close} className="flex min-h-12 items-center text-base font-semibold text-navy">{group.label}</Link>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-6 grid gap-2">
            <Link href="/demo" className={buttonVariants({ size: "lg" })} onClick={close}>Try the demo</Link>
            <Link href="/sign-up" className={buttonVariants({ size: "lg", variant: "outline" })} onClick={close}>Create a demo account</Link>
            <Link href="/sign-in" className={buttonVariants({ size: "lg", variant: "ghost" })} onClick={close}>Sign in</Link>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export function SiteHeader() {
  return (
    <header className="relative z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="rounded-md" aria-label="SymptomWatch home">
          <Logo />
        </Link>
        <DesktopNav />
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Link href="/sign-in" className={buttonVariants({ variant: "ghost" })}>Sign in</Link>
          <Link href="/demo" className={buttonVariants()}>Try Demo</Link>
        </div>
        <MobileNav />
      </div>
    </header>
  );
}
