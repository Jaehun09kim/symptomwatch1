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
 * or choosing a link. Panels move as a single surface; labels stay crisp.
 */
function DesktopNav() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<string | null>(null);
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
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        window.clearTimeout(timer.current);
        setOpen(null);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      window.clearTimeout(timer.current);
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
      window.clearTimeout(timer.current);
      setOpen(group.label);
      window.requestAnimationFrame(() => document.getElementById(`${baseId}-${group.label}`)?.querySelector<HTMLElement>("a")?.focus());
    }
  };

  return (
    <nav ref={navRef} aria-label="Primary" className="hidden flex-1 justify-center lg:flex"
      onMouseLeave={() => schedule(null, CLOSE_DELAY)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          window.clearTimeout(timer.current);
          setOpen(null);
        }
      }}>
      <ul className="flex items-center gap-0.5">
        {MARKETING_NAV.map((group) => {
          const active = isActive(pathname, group.href);
          const expanded = open === group.label;
          const panelId = `${baseId}-${group.label}`;
          const itemClass = cn(
            "inline-flex h-9 items-center gap-1 rounded-md px-3 text-[0.875rem] font-medium transition-colors duration-150",
            active || expanded ? "bg-muted text-navy" : "text-slate-600 hover:bg-muted hover:text-navy",
          );
          return (
            <li key={group.label} className="relative" onMouseEnter={() => { schedule(group.items ? group.label : null, OPEN_DELAY); }}>
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
                    {group.label}
                    {active ? <span className="sr-only"> (current section)</span> : null}
                    <m.span aria-hidden animate={{ rotate: expanded ? 180 : 0 }} transition={reduce ? { duration: 0 } : { duration: 0.16, ease: EASE }} className="inline-flex">
                      <ChevronDown className="size-3 text-slate-500" />
                    </m.span>
                  </button>
                  <AnimatePresence>
                    {expanded ? (
                      <m.div
                        id={panelId}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4, transition: { duration: reduce ? 0 : 0.1 } }}
                        transition={reduce ? { duration: 0 } : { duration: 0.12, ease: EASE }}
                        style={{ transformOrigin: "top center" }}
                        className="absolute left-1/2 top-full z-40 -translate-x-1/2 pt-2"
                      >
                        <div className="w-[22rem] overflow-hidden rounded-xl border border-white/10 bg-popover shadow-float">
                          <ul className="p-1.5">
                            {group.items.map((item) => (
                              <li key={item.href}>
                                <Link href={item.href} onClick={() => setOpen(null)}
                                  className="group flex gap-3 rounded-lg px-3 py-2.5 outline-none transition-colors duration-150 hover:bg-white/[0.05] focus-visible:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-ring">
                                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center text-slate-500 transition-colors duration-150 group-hover:text-navy">
                                    <item.icon className="size-3.5" aria-hidden />
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block text-[0.875rem] font-medium text-navy">{item.title}</span>
                                    <span className="mt-0.5 block text-[0.8rem] leading-snug text-muted-foreground">{item.body}</span>
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                          <Link href={group.href} onClick={() => setOpen(null)}
                            className="group flex items-center justify-between border-t border-white/[0.07] px-4.5 py-3 text-[0.8125rem] font-medium text-slate-600 outline-none transition-colors hover:text-navy focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                            {group.overview}
                            <ArrowRight className="size-3.5 transition-transform duration-150 motion-safe:group-hover:translate-x-0.5" aria-hidden />
                          </Link>
                        </div>
                      </m.div>
                    ) : null}
                  </AnimatePresence>
                </>
              ) : (
                <Link href={group.href} aria-current={active ? "page" : undefined} className={itemClass} onClick={() => setOpen(null)}>
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
      <SheetTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "ml-auto lg:hidden")} aria-label="Open menu">
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="right" className="dark w-[88vw] max-w-sm overflow-y-auto border-white/10 bg-background">
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
                        className="flex min-h-12 w-full items-center justify-between text-left text-[0.95rem] font-medium text-navy">
                        {group.label}
                        <m.span aria-hidden animate={{ rotate: expanded ? 180 : 0 }} transition={reduce ? { duration: 0 } : { duration: 0.16, ease: EASE }} className="inline-flex">
                          <ChevronDown className="size-4 text-slate-500" />
                        </m.span>
                      </button>
                      <AnimatePresence initial={false}>
                        {expanded ? (
                          <m.ul
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0 }}
                            transition={reduce ? { duration: 0 } : { duration: 0.18, ease: EASE }}
                            className="overflow-hidden"
                          >
                            {[{ href: group.href, title: group.overview ?? group.label }, ...group.items].map((item) => (
                              <li key={item.href}>
                                <Link href={item.href} onClick={close} className="flex min-h-11 items-center rounded-md px-3 text-[0.9rem] text-body hover:bg-white/[0.05] hover:text-navy">
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
                    <Link href={group.href} onClick={close} className="flex min-h-12 items-center text-[0.95rem] font-medium text-navy">{group.label}</Link>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-6 grid gap-2">
            <Link href="/demo" className={buttonVariants({ size: "lg" })} onClick={close}>Try the demo</Link>
            <Link href="/contact" className={buttonVariants({ size: "lg", variant: "outline" })} onClick={close}>Request a walkthrough</Link>
            <Link href="/sign-in" className={buttonVariants({ size: "lg", variant: "ghost" })} onClick={close}>Sign in</Link>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-[var(--banner-h,2rem)] z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0 rounded-md lg:w-44" aria-label="SymptomWatch home">
          <Logo markClassName="size-6" />
        </Link>
        <DesktopNav />
        <div className="hidden shrink-0 items-center justify-end gap-1 whitespace-nowrap lg:flex lg:w-44">
          <Link href="/sign-in" className="inline-flex h-8 items-center rounded-md px-3 text-[0.875rem] font-medium text-slate-500 transition-colors duration-150 hover:text-navy">Sign in</Link>
          <Link href="/demo" className={buttonVariants({ size: "sm", className: "h-8" })}>Try the demo</Link>
        </div>
        <MobileNav />
      </div>
    </header>
  );
}
