import { Suspense } from "react";
import type { Metadata } from "next";
import { ImportWizard } from "@/components/app/import/import-wizard";
import { PageHeader } from "@/components/app/primitives/layout";
import { requirePermission } from "@/lib/auth/current";
import { can } from "@/lib/authz/permissions";
import { importKindLabel } from "@/lib/import/fields";
import { listImportBatches } from "@/lib/services/imports";

export const metadata: Metadata = { title: "Import records" };

async function History() {
  const { ctx } = await requirePermission("records.import");
  const batches = await listImportBatches(ctx);
  if (!batches.length) return <p className="text-sm text-slate-500">No imports yet.</p>;
  return (
    <div className="overflow-x-auto border-y border-border" tabIndex={0} role="region" aria-label="Recent imports">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="bg-surface text-left text-xs font-medium text-slate-600">
          <tr>
            <th scope="col" className="px-3 py-2">When</th>
            <th scope="col" className="px-3 py-2">File</th>
            <th scope="col" className="px-3 py-2">Type</th>
            <th scope="col" className="px-3 py-2 text-right">Added</th>
            <th scope="col" className="px-3 py-2 text-right">Updated</th>
            <th scope="col" className="px-3 py-2 text-right">Current</th>
            <th scope="col" className="px-3 py-2 text-right">Skipped</th>
            <th scope="col" className="px-3 py-2">By</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border tabular-nums">
          {batches.map((batch) => (
            <tr key={batch.id}>
              <td className="whitespace-nowrap px-3 py-2 text-body">{new Date(batch.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td>
              <td className="max-w-[16rem] truncate px-3 py-2 text-navy" title={batch.filename}>{batch.filename}</td>
              <td className="px-3 py-2 text-body">{importKindLabel[batch.kind]}</td>
              <td className="px-3 py-2 text-right">{batch.createdCount}</td>
              <td className="px-3 py-2 text-right">{batch.updatedCount}</td>
              <td className="px-3 py-2 text-right">{batch.unchangedCount}</td>
              <td className="px-3 py-2 text-right">{batch.errorCount}</td>
              <td className="px-3 py-2 text-body">{batch.createdByName ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function ImportPage() {
  const { session } = await requirePermission("records.import");
  return (
    <div className="space-y-10">
      <PageHeader
        title="Import records"
        description="Bring in lab orders and referrals from your EHR's report exports instead of re-typing them. SymptomWatch matches each row to a patient, shows exactly what will change, and re-checks for gaps after the import."
      />
      <ImportWizard canImportLabs={can(session.role, "lab.update_status")} />
      <section aria-labelledby="history-heading" className="space-y-3">
        <h2 id="history-heading" className="text-lg font-semibold text-navy">Recent imports</h2>
        <History />
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-surface" />}>
      <ImportPage />
    </Suspense>
  );
}
