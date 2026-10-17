"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { returnToOwnAccountAction, signOutAction, viewAsAction } from "@/app/(auth)/actions";
import { LogoMark } from "@/components/brand/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { roleLabel, type MemberRole } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type NavKey = "dashboard" | "queue" | "review" | "patients" | "staff" | "audit" | "settings";

const NAV: Record<NavKey, { href: string; label: string; icon: LucideIcon }> = {
  dashboard: { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  queue: { href: "/app/queue", label: "Follow-up queue", icon: ListChecks },
  review: { href: "/app/review", label: "Review flags", icon: ClipboardCheck },
  patients: { href: "/app/patients", label: "Patients", icon: Users },
  staff: { href: "/app/staff", label: "Staff", icon: UserCog },
  audit: { href: "/app/audit", label: "Audit log", icon: ScrollText },
  settings: { href: "/app/settings", label: "Settings", icon: Settings },
};

export interface ShellUser {
  displayName: string;
  email: string;
  role: MemberRole;
  clinicName: string;
  isSandbox: boolean;
  sandboxDaysLeft: number | null;
  viewingAsFrom: boolean;
}

export interface ViewAsOption {
  userId: string;
  displayName: string;
  role: MemberRole;
}

function NavLinks({ items, onNavigate }: { items: NavKey[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {items.map((key) => {
        const { href, label, icon: Icon } = NAV[key];
        const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
        return (
          <li key={key}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition",
                active ? "bg-white text-navy shadow-soft ring-1 ring-border" : "text-slate-600 hover:bg-white/70 hover:text-navy",
              )}
            >
              <Icon className={cn("size-[1.125rem]", active ? "text-brand" : "text-slate-500")} aria-hidden />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ClinicBlock({ user }: { user: ShellUser }) {
  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <p className="truncate text-sm font-semibold text-navy" title={user.clinicName}>{user.clinicName}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {user.isSandbox
          ? `Private sandbox${user.sandboxDaysLeft !== null ? ` · ${user.sandboxDaysLeft} day${user.sandboxDaysLeft === 1 ? "" : "s"} left` : ""}`
          : "Shared demo clinic"}
      </p>
    </div>
  );
}

function SidebarContent({ user, nav, onNavigate }: { user: ShellUser; nav: NavKey[]; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6">
      <Link href="/app" onClick={onNavigate} className="flex items-center gap-2.5 rounded-md px-1" aria-label="SymptomWatch dashboard">
        <LogoMark className="size-7" />
        <span className="font-semibold tracking-tight text-navy">Symptom<span className="text-brand">Watch</span></span>
      </Link>
      <ClinicBlock user={user} />
      <nav aria-label="Application">
        <NavLinks items={nav} onNavigate={onNavigate} />
      </nav>
      <p className="mt-auto px-1 text-[0.7rem] leading-relaxed text-slate-500">
        Prototype · fictional data only · rule-based detection, external AI disabled.
      </p>
    </div>
  );
}

function UserMenu({ user }: { user: ShellUser }) {
  const initials = user.displayName.replace(/^Dr\.\s+/, "").split(/\s+/).map((part) => part[0]).slice(0, 2).join("");
  return (
    <Popover>
      <PopoverTrigger className={cn(buttonVariants({ variant: "ghost" }), "h-11 gap-2.5 px-2")} aria-label="Account menu">
        <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-hover">{initials}</span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-medium leading-tight text-navy">{user.displayName}</span>
          <span className="block text-xs leading-tight text-slate-500">{roleLabel[user.role]}</span>
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="border-b border-border p-3">
          <p className="text-sm font-medium text-navy">{user.displayName}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
        </div>
        <form action={signOutAction} className="p-1.5">
          <Button type="submit" variant="ghost" className="w-full justify-start">
            <LogOut aria-hidden /> Sign out
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function ViewAsSwitcher({ options }: { options: ViewAsOption[] }) {
  if (!options.length) return null;
  return (
    <Popover>
      <PopoverTrigger className={buttonVariants({ variant: "outline", size: "sm" })}>
        <UserCog aria-hidden /> <span className="hidden sm:inline">View as…</span><span className="sm:hidden">Switch</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="border-b border-border p-3">
          <p className="text-sm font-medium text-navy">Switch to a fictional colleague</p>
          <p className="mt-0.5 text-xs text-slate-500">See what each role can and can&rsquo;t access. Sandbox only; every switch is audited.</p>
        </div>
        <ul className="p-1.5">
          {options.map((option) => (
            <li key={option.userId}>
              <form action={viewAsAction}>
                <input type="hidden" name="userId" value={option.userId} />
                <button type="submit" className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface">
                  <span className="font-medium text-navy">{option.displayName}</span>
                  <span className="text-xs text-slate-500">{roleLabel[option.role]}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({ user, nav, viewAs, children }: { user: ShellUser; nav: NavKey[]; viewAs: ViewAsOption[]; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-1">
      <aside className="sticky top-[33px] hidden h-[calc(100dvh-33px)] w-64 shrink-0 border-r border-border bg-surface p-4 lg:block">
        <SidebarContent user={user} nav={nav} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-border bg-white px-4 sm:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "lg:hidden")} aria-label="Open navigation">
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-surface p-4">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent user={user} nav={nav} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="inline-flex h-6 items-center rounded-full border border-border bg-surface px-2.5 text-xs font-medium text-slate-600">
            {roleLabel[user.role]} view
          </span>
          <div className="ml-auto flex items-center gap-2">
            <ViewAsSwitcher options={viewAs} />
            <UserMenu user={user} />
          </div>
        </header>
        {user.viewingAsFrom ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand/20 bg-brand-soft px-4 py-2 text-sm text-brand-hover sm:px-6">
            <span>
              You&rsquo;re viewing as <strong>{user.displayName}</strong> (fictional {roleLabel[user.role].toLowerCase()}).
            </span>
            <form action={returnToOwnAccountAction}>
              <Button type="submit" size="sm" variant="outline">Return to my account</Button>
            </form>
          </div>
        ) : null}
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
