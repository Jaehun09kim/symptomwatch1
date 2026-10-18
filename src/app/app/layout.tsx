import { Suspense } from "react";
import type { Metadata } from "next";
import { AppShell, type NavKey } from "@/components/app/shell/app-shell";
import { requireSession } from "@/lib/auth/current";
import { can } from "@/lib/authz/permissions";
import { daysUntil } from "@/lib/dates";
import { listViewAsCandidates } from "@/lib/services/demo-sandbox";

// Every page here reads the session at request time; skip instant-navigation validation for the segment.
export const instant = false;

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · SymptomWatch" },
  robots: { index: false, follow: false },
};

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const nav: NavKey[] = ["dashboard", "queue"];
  if (can(session.role, "flag.read")) nav.push("review", "rules");
  nav.push("patients");
  if (can(session.role, "staff.manage")) nav.push("staff");
  if (can(session.role, "audit.read")) nav.push("audit");
  nav.push("settings");
  const viewAs = await listViewAsCandidates(session);
  const daysLeft = session.clinicExpiresAt ? daysUntil(session.clinicExpiresAt) : null;
  return (
    <AppShell
      nav={nav}
      viewAs={viewAs}
      user={{
        displayName: session.displayName,
        email: session.email,
        role: session.role,
        clinicName: session.clinicName,
        isSandbox: session.isSandbox,
        sandboxDaysLeft: daysLeft,
        viewingAsFrom: Boolean(session.originalUserId),
      }}
    >
      {children}
    </AppShell>
  );
}

function ShellFallback() {
  return (
    <div className="flex flex-1">
      <div className="hidden w-64 shrink-0 border-r border-border bg-surface lg:block" />
      <div className="flex-1 p-8">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-surface" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-xl bg-surface" />)}
        </div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}
