"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const links = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#safety", label: "Safety" },
  { href: "/#contact", label: "Contact" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="rounded-md" aria-label="SymptomWatch home">
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden flex-1 md:block">
          <ul className="flex items-center gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:text-navy">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Link href="/sign-in" className={buttonVariants({ variant: "ghost" })}>
            Sign in
          </Link>
          <Link href="/demo" className={buttonVariants()}>
            Try Demo
          </Link>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "ml-auto md:hidden")}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="right" className="w-[85vw] max-w-sm">
            <SheetHeader>
              <SheetTitle>
                <Logo />
              </SheetTitle>
            </SheetHeader>
            <nav aria-label="Mobile" className="px-4">
              <ul className="space-y-1">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-navy hover:bg-surface"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-6 grid gap-2">
                <Link href="/demo" className={buttonVariants({ size: "lg" })} onClick={() => setOpen(false)}>
                  Try Demo
                </Link>
                <Link href="/sign-up" className={buttonVariants({ size: "lg", variant: "outline" })} onClick={() => setOpen(false)}>
                  Create Demo Account
                </Link>
                <Link href="/sign-in" className={buttonVariants({ size: "lg", variant: "ghost" })} onClick={() => setOpen(false)}>
                  Sign in
                </Link>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
