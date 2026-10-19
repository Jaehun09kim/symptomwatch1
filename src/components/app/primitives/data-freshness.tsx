import Link from "next/link";
import { importKindLabel } from "@/lib/import/fields";
import type { ImportBatchView } from "@/lib/services/imports";

type LastRun = { createdAt: string; patientsEvaluated: number; findingsCount: number };
const when = (value: string) => new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export function DataFreshness({ lastImport, lastRun }: { lastImport: ImportBatchView | null; lastRun: LastRun | null }) {
  return <section aria-label="Data freshness" className="space-y-2 border-y border-border py-3 text-xs leading-relaxed text-body">
    <dl className="grid gap-3 sm:grid-cols-2">
      <div>
        <dt className="font-semibold text-navy">Last successful import</dt>
        <dd>{lastImport ? <>
          <p>{importKindLabel[lastImport.kind]} · <time dateTime={lastImport.createdAt}>{when(lastImport.createdAt)} UTC</time>{lastImport.createdByName ? ` · by ${lastImport.createdByName}` : ""}</p>
          <p>{lastImport.rowCount} rows · {lastImport.createdCount} added · {lastImport.updatedCount} updated · {lastImport.unchangedCount} already current · {lastImport.errorCount} skipped</p>
        </> : <p>No records have been imported into this clinic yet.</p>}
          <Link href="/app/import" className="inline-flex min-h-10 items-center text-brand underline underline-offset-4">Import records</Link>
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-navy">Last detection run</dt>
        <dd>{lastRun ? <><time dateTime={lastRun.createdAt}>{when(lastRun.createdAt)} UTC</time> · {lastRun.patientsEvaluated} patient{lastRun.patientsEvaluated === 1 ? "" : "s"} checked · {lastRun.findingsCount} finding{lastRun.findingsCount === 1 ? "" : "s"}</> : "Detection has not run yet."}</dd>
      </div>
    </dl>
    <p>Detection checks only records available here. An empty flag list does not establish complete coverage; imports may skip rows and a run may check only affected patients.</p>
  </section>;
}
