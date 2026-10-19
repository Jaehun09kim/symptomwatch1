"use client";

import { useMemo, useState, useTransition, type ChangeEvent } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, MinusCircle, PlusCircle, RefreshCw, XCircle } from "lucide-react";
import { commitImportAction, previewImportAction, sampleExportAction } from "@/app/app/import/actions";
import { Button } from "@/components/ui/button";
import { CsvError, MAX_IMPORT_BYTES, parseCsv } from "@/lib/import/csv";
import { buildCorrectionCsv } from "@/lib/import/export";
import { guessMapping, IMPORT_FIELDS, importKindLabel, type ColumnMapping, type ImportKind } from "@/lib/import/fields";
import type { ImportPreview, ImportResult, RowAction } from "@/lib/services/imports";
import { cn } from "@/lib/utils";

interface Source {
  filename: string;
  csv: string;
  headers: string[];
  firstRow: string[];
}

const ACTION_STYLE: Record<RowAction, { label: string; icon: typeof PlusCircle; className: string }> = {
  create: { label: "New", icon: PlusCircle, className: "text-teal-strong" },
  update: { label: "Update", icon: RefreshCw, className: "text-brand-hover" },
  unchanged: { label: "No change", icon: MinusCircle, className: "text-body" },
  error: { label: "Problem", icon: XCircle, className: "text-attention" },
};

const select = "h-10 w-full min-w-0 rounded-[5px] border border-border bg-card px-2 text-sm text-navy";

function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ImportSteps({ step }: { step: number }) {
  return <ol aria-label="Import steps" className="grid grid-cols-2 gap-3 rounded-md border border-border bg-surface p-4 sm:grid-cols-4">
    {["Choose file", "Map columns", "Preview", "Import"].map((label, index) => (
      <li key={label} aria-current={step === index + 1 ? "step" : undefined} className="text-sm text-body">
        <span className="mr-2 font-mono text-brand-hover">{index + 1}</span><span className={step === index + 1 ? "font-semibold text-navy" : ""}>{label}</span>
      </li>
    ))}
  </ol>;
}

export function ImportWizard({ canImportLabs }: { canImportLabs: boolean }) {
  const [kind, setKind] = useState<ImportKind>(canImportLabs ? "lab_orders" : "referrals");
  const [source, setSource] = useState<Source | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [pending, startTransition] = useTransition();
  const fields = IMPORT_FIELDS[kind];

  const load = (next: { filename: string; csv: string }, forKind = kind) => {
    setPreview(null);
    setResult(null);
    try {
      const parsed = parseCsv(next.csv);
      setSource({ ...next, headers: parsed.headers, firstRow: parsed.rows[0] ?? [] });
      setMapping(guessMapping(forKind, parsed.headers));
      setError(parsed.rows.length ? null : "The file has a header row but no data rows.");
    } catch (problem) {
      setSource(null);
      setError(problem instanceof CsvError ? problem.message : "That file couldn't be read as CSV.");
    }
  };

  const changeKind = (next: ImportKind) => {
    setKind(next);
    setPreview(null);
    setResult(null);
    if (source) setMapping(guessMapping(next, source.headers));
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setError("The file is larger than 512 KB. Export a shorter date range.");
      return;
    }
    load({ filename: file.name, csv: await file.text() });
  };

  const useSample = () => startTransition(async () => {
    const response = await sampleExportAction(kind);
    if (response.ok) load(response.data);
    else setError(response.message);
  });

  const downloadSample = () => startTransition(async () => {
    const response = await sampleExportAction(kind);
    if (response.ok) { downloadCsv(response.data.filename, response.data.csv); setError(null); }
    else setError(response.message);
  });

  const request = () => ({ kind, csv: source!.csv, filename: source!.filename, mapping });

  const runPreview = () => startTransition(async () => {
    setResult(null);
    const response = await previewImportAction(request());
    if (response.ok) { setPreview(response.data); setError(null); }
    else { setPreview(null); setError(response.message); }
  });

  const runImport = () => startTransition(async () => {
    const response = await commitImportAction(request());
    if (response.ok) { setResult(response.data); setPreview(null); setError(null); }
    else setError(response.message);
  });

  const reset = () => { setSource(null); setPreview(null); setResult(null); setError(null); setMapping({}); };

  const downloadHref = useMemo(
    () => (source ? `data:text/csv;charset=utf-8,${encodeURIComponent(source.csv)}` : null),
    [source],
  );
  const missingRequired = fields.filter((field) => field.required && !mapping[field.key]);
  const rows = preview ? (problemsOnly ? preview.rows.filter((row) => row.action === "error" || row.messages.some((message) => message !== "Already up to date.")) : preview.rows) : [];
  const importable = preview ? preview.counts.create + preview.counts.update : 0;

  if (result) {
    const skipped = result.rows.filter((row) => row.action === "error");
    return (
      <section aria-labelledby="import-done" className="space-y-4 border-y border-border py-6" aria-live="polite">
        <ImportSteps step={4} />
        <h2 id="import-done" className="flex items-center gap-2 text-lg font-semibold text-navy"><CheckCircle2 className="size-5 text-teal-strong" aria-hidden /> Import complete</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          {(["create", "update", "unchanged", "error"] as RowAction[]).map((action) => (
            <div key={action}>
              <dt className="text-body">{action === "create" ? "Added" : action === "update" ? "Updated" : action === "unchanged" ? "Already current" : "Skipped (problems)"}</dt>
              <dd className="text-2xl tabular-nums text-navy">{result.counts[action]}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-body">
          Detection re-ran for the affected patients: <strong className="text-navy">{result.flags.resolved}</strong> possible gap{result.flags.resolved === 1 ? "" : "s"} closed by the new documentation, <strong className="text-navy">{result.flags.created}</strong> new, <strong className="text-navy">{result.flags.reopened}</strong> reopened.
        </p>
        {skipped.length ? <section aria-labelledby="skipped-heading" className="space-y-3 rounded-md border border-border bg-surface p-4">
          <h3 id="skipped-heading" className="font-semibold text-navy">Skipped rows ({skipped.length})</h3>
          <p className="text-sm text-body">These rows were not imported. Correct them and import the corrected file. The report includes the original columns and a reason for each skipped row.</p>
          <Button variant="outline" className="min-h-10" onClick={() => downloadCsv(`corrections-${result.filename}`, buildCorrectionCsv(source!.csv, result.rows))}>
            <Download className="size-4" aria-hidden /> Download correction report (CSV)
          </Button>
          <ul className="divide-y divide-border text-sm text-body">
            {skipped.map((row) => <li key={row.line} className="py-3">
              <p className="font-medium text-navy">Row {row.line}{row.patient ? ` · ${row.patient}` : ""}</p>
              <p>{row.summary}</p>
              {row.messages.map((message) => <p key={message}>{message}</p>)}
            </li>)}
          </ul>
        </section> : null}
        <div className="flex flex-wrap gap-2">
          <Link href="/app/review" className="inline-flex min-h-10 items-center rounded-[5px] bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-hover">Go to review flags</Link>
          <Button variant="outline" className="min-h-10" onClick={reset}>Import another file</Button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <ImportSteps step={preview ? 3 : source ? 2 : 1} />
      <section aria-labelledby="step-source" className="space-y-4">
        <h2 id="step-source" className="text-lg font-semibold text-navy"><span className="mr-2 font-mono text-sm text-body">1</span>Choose an export</h2>
        <div role="radiogroup" aria-label="Record type" className="inline-flex rounded-[6px] border border-border bg-surface p-0.5">
          {(Object.keys(importKindLabel) as ImportKind[]).map((option) => (
            <button key={option} type="button" role="radio" aria-checked={kind === option} onClick={() => changeKind(option)}
              disabled={pending || (option === "lab_orders" && !canImportLabs)}
              className={cn("min-h-10 rounded-[5px] px-3.5 text-sm font-medium disabled:cursor-not-allowed disabled:text-body", kind === option ? "bg-card text-navy shadow-[0_0_0_1px_var(--border)]" : "text-body hover:text-navy")}>
              {importKindLabel[option]}
            </button>
          ))}
        </div>
        {!canImportLabs ? <p className="text-sm text-body">Lab orders are imported by physicians, because recording a result closes a lab gap.</p> : null}
        <section aria-label={`${importKindLabel[kind]} field guide`} className="space-y-2 rounded-md border border-border bg-card p-4 text-sm text-body">
          <h3 className="font-semibold text-navy">{importKindLabel[kind]} field guide</h3>
          <p><strong className="text-navy">Required:</strong> {fields.filter((field) => field.required).map((field) => field.label).join(", ")}.</p>
          <p><strong className="text-navy">Optional:</strong> {fields.filter((field) => !field.required).map((field) => field.label).join(", ")}.</p>
          <p><strong className="text-navy">Patient name (check only):</strong> the Demo MRN matches an existing patient in this clinic. If a name is supplied, its last name is checked to catch wrong-patient rows. The supplied name is never stored or used to rename a patient.</p>
          <p>{kind === "lab_orders" ? "Use statuses such as Pending, Collected, Final, or Cancelled. A Final/resulted lab also requires a result date. Turnaround defaults to 7 days." : "Use statuses such as Referred, Scheduled, Seen, or Consult Note Received. Records received also requires the date they arrived. Expected wait defaults to 30 days."} Dates can use YYYY-MM-DD or MM/DD/YYYY.</p>
        </section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[5px] border border-border bg-card px-3.5 text-sm font-medium text-navy focus-within:ring-2 focus-within:ring-brand hover:bg-surface">
            <FileSpreadsheet className="size-4" aria-hidden /> Choose a CSV file
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} disabled={pending} />
          </label>
          <span className="text-sm text-body">or</span>
          <Button type="button" variant="outline" className="min-h-10 whitespace-normal" onClick={useSample} disabled={pending}>Use a sample export from this clinic</Button>
        </div>
        <Button type="button" variant="outline" className="min-h-10 whitespace-normal" onClick={downloadSample} disabled={pending}><Download className="size-4" aria-hidden /> Download fictional {importKindLabel[kind].toLowerCase()} sample CSV</Button>
        <p className="text-sm text-body">Samples use this clinic&rsquo;s fictional DEMO-MRN records and include deliberate problems to try the preview and correction report.</p>
        <p className="text-xs text-body">Up to 1,000 rows and 512 KB. Fictional data only: rows must use DEMO-##### MRNs, so real EHR exports are refused.</p>
        {source ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-body">
            <span><strong className="text-navy">{source.filename}</strong> · {source.headers.length} columns</span>
            {downloadHref ? <a href={downloadHref} download={source.filename} className="inline-flex min-h-10 items-center gap-1 text-brand hover:underline"><Download className="size-3.5" aria-hidden /> Download this file</a> : null}
          </p>
        ) : null}
      </section>

      {source ? (
        <section aria-labelledby="step-map" className="space-y-3">
          <h2 id="step-map" className="text-lg font-semibold text-navy"><span className="mr-2 font-mono text-sm text-body">2</span>Match columns</h2>
          <p className="text-sm text-body">Columns with familiar names are matched automatically. Check them against the first row of the file.</p>
          <div className="overflow-x-auto border-y border-border" tabIndex={0} role="region" aria-label="Column mapping">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-surface text-left text-xs font-medium text-body">
                <tr><th scope="col" className="px-3 py-2">SymptomWatch field</th><th scope="col" className="px-3 py-2">Column in your file</th><th scope="col" className="px-3 py-2">First row</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fields.map((field) => {
                  const header = mapping[field.key];
                  const example = header ? source.firstRow[source.headers.indexOf(header)] : "";
                  return (
                    <tr key={field.key}>
                      <th scope="row" className="px-3 py-2 text-left align-top font-medium text-navy">
                        <label htmlFor={`map-${field.key}`}>{field.label}{field.required ? <span className="text-attention"> *</span> : null}</label>
                        {field.hint ? <p className="mt-0.5 text-xs font-normal text-body">{field.hint}</p> : null}
                      </th>
                      <td className="px-3 py-2 align-top">
                        <select id={`map-${field.key}`} className={select} value={header ?? ""} disabled={pending}
                          onChange={(event) => { setPreview(null); setMapping({ ...mapping, [field.key]: event.target.value || null }); }}>
                          <option value="">— Not in this file —</option>
                          {source.headers.filter(Boolean).map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </td>
                      <td className="max-w-[16rem] truncate px-3 py-2 align-top text-body" title={example}>{example || <span className="text-body">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" className="min-h-10" onClick={runPreview} disabled={pending || missingRequired.length > 0}>{pending && !preview ? "Checking…" : "Preview import"}</Button>
            {missingRequired.length ? <p className="text-sm text-body">Choose a column for {missingRequired.map((field) => field.label).join(", ")}.</p> : <p className="text-xs text-body">Previewing doesn&rsquo;t change any records.</p>}
          </div>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="flex items-start gap-2 border-l-2 border-attention-line bg-attention-soft px-3 py-2 text-sm text-attention">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
        </p>
      ) : null}

      {preview ? (
        <section aria-labelledby="step-preview" className="space-y-3" aria-live="polite">
          <h2 id="step-preview" className="text-lg font-semibold text-navy"><span className="mr-2 font-mono text-sm text-body">3</span>Preview</h2>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            {(["create", "update", "unchanged", "error"] as RowAction[]).map((action) => {
              const { label, icon: Icon, className } = ACTION_STYLE[action];
              return (
                <div key={action} className="flex items-center gap-2">
                  <Icon className={cn("size-4", className)} aria-hidden />
                  <dt className="text-body">{label}</dt>
                  <dd className="font-semibold tabular-nums text-navy">{preview.counts[action]}</dd>
                </div>
              );
            })}
          </dl>
          <label className="flex min-h-10 items-center gap-2 text-sm text-body">
            <input type="checkbox" checked={problemsOnly} onChange={(event) => setProblemsOnly(event.target.checked)} className="size-4 accent-brand" />
            Show only rows with problems or notes
          </label>
          <div className="max-h-[28rem] overflow-auto border-y border-border" tabIndex={0} role="region" aria-label="Import preview">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="sticky top-0 bg-surface text-left text-xs font-medium text-body">
                <tr><th scope="col" className="px-3 py-2">Row</th><th scope="col" className="px-3 py-2">Result</th><th scope="col" className="px-3 py-2">Patient</th><th scope="col" className="px-3 py-2">Record</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => {
                  const { label, icon: Icon, className } = ACTION_STYLE[row.action];
                  return (
                    <tr key={row.line} className="align-top">
                      <td className="px-3 py-2 tabular-nums text-body">{row.line}</td>
                      <td className={cn("whitespace-nowrap px-3 py-2 font-medium", className)}><span className="inline-flex items-center gap-1.5"><Icon className="size-3.5" aria-hidden />{label}</span></td>
                      <td className="px-3 py-2 text-body">{row.patient ?? <span className="text-body">—</span>}</td>
                      <td className="px-3 py-2">
                        <p className="text-navy">{row.summary}</p>
                        {row.messages.filter((message) => message !== "Already up to date.").map((message) => <p key={message} className={cn("mt-0.5 text-xs", row.action === "error" ? "text-attention" : "text-body")}>{message}</p>)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <h2 className="text-lg font-semibold text-navy"><span className="mr-2 font-mono text-sm text-body">4</span>Import</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" className="min-h-10" onClick={runImport} disabled={pending || importable + preview.counts.unchanged === 0}>
              {pending ? "Importing…" : importable ? `Import ${preview.counts.create} new and ${preview.counts.update} updated` : "Record this import"}
            </Button>
            <p className="text-xs text-body">Rows with problems are skipped. Detection re-runs for affected patients right after the import.</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
