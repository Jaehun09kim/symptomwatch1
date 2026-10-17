import { Suspense } from "react";
import type { Metadata } from "next";
import { Database, RotateCcw, ScanSearch, ShieldCheck } from "lucide-react";
import { resetDemoAction } from "@/app/app/actions";
import { PageHeader } from "@/components/app/primitives/layout";
import { SubmitButton } from "@/components/forms/fields";
import { requireSession } from "@/lib/auth/current";
import { can } from "@/lib/authz/permissions";
import { getEnv } from "@/lib/env";
import { roleLabel } from "@/lib/labels";

export const metadata: Metadata = { title: "Settings" };

function Card({ icon: Icon, title, children }: { icon: typeof Database; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-white p-5 shadow-soft">
      <h2 className="flex items-center gap-2 text-base font-semibold"><Icon className="size-4 text-slate-500" aria-hidden />{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-body">{children}</div>
    </section>
  );
}

async function Settings() {
  const session = await requireSession();
  const env = getEnv();
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description={session.clinicName} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card icon={ShieldCheck} title="Your access">
          <p>Signed in as <strong className="text-navy">{session.displayName}</strong> ({session.email}) with the <strong className="text-navy">{roleLabel[session.role]}</strong> role.</p>
          <p>{session.isSandbox ? "This is a private sandbox clinic." : "This is a shared demo clinic."}{session.clinicExpiresAt ? ` It will be deleted on ${new Date(session.clinicExpiresAt).toLocaleDateString("en-US", { dateStyle: "long" })}.` : ""}</p>
        </Card>
        <Card icon={ScanSearch} title="Detection">
          <p><strong className="text-navy">Rule-based v1</strong> — transparent rules for overdue follow-ups, missing lab results, missing referral outcomes, and recurring symptoms without a documented plan.</p>
          <p>External AI: <strong className="text-navy">{env.EXTERNAL_AI_ENABLED ? "enabled" : "disabled"}</strong>. No record data is sent to third-party services.</p>
        </Card>
        <Card icon={Database} title="Data handling">
          <p>Every patient and record here is fictional. Free-text fields block likely identifiers. Don&rsquo;t enter real patient information.</p>
          <p>Database: {env.DATABASE_DRIVER === "pglite" ? "embedded local Postgres (PGlite)" : "hosted Postgres"} · Auth: {env.AUTH_PROVIDER === "local" ? "built-in" : "Supabase"}.</p>
        </Card>
        {can(session.role, "demo.reset") ? (
          <Card icon={RotateCcw} title="Reset demo data">
            <p>Restore this clinic&rsquo;s fictional patients, tasks, and flags to their original state, with dates shifted to today. Staff accounts and the audit log are kept.</p>
            <form action={resetDemoAction}>
              <SubmitButton size="default" variant="outline" pendingLabel="Resetting…">Reset demo data</SubmitButton>
            </form>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface" />}>
      <Settings />
    </Suspense>
  );
}
