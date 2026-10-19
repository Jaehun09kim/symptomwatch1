/**
 * Small, static product fragments for the marketing pages. They're built from
 * the same badges and labels as the app so they stay truthful to it; every
 * name and value is fictional.
 */
import { AlarmClock, CheckCircle2, MinusCircle, PlusCircle, RefreshCw, XCircle } from "lucide-react";
import { ProvenanceBadge } from "@/components/app/primitives/badges";
import { cn } from "@/lib/utils";

const frame = "overflow-hidden rounded-xl border border-border bg-card shadow-card";

export function FlagFragment() {
  return (
    <figure className={frame} aria-label="Example flag detail with fictional data">
      <div className="border-b border-border px-5 py-4">
        <ProvenanceBadge kind="rule_inferred" />
        <p className="mt-3 text-[1.05rem] font-medium leading-snug tracking-[-0.015em] text-navy">Cardiology referral from Aug 4 has no recorded outcome</p>
        <p className="meta-label mt-1.5">Aiko Tanaka · fictional patient · Referral outcome v1.0.0</p>
      </div>
      <div className="space-y-4 px-5 py-4 text-sm">
        <p className="text-body"><span className="font-semibold text-navy">Why flagged: </span>A specialist appointment was expected within 30 days. More than 44 days have passed with no appointment, consult note, or outcome documented.</p>
        <div>
          <p className="meta-label">Supporting entries</p>
          <ul className="mt-2 space-y-1.5 text-brand">
            <li>Aug 4 · Referral to Cardiology — sent</li>
            <li>Aug 4 · Visit — Palpitations (referring visit)</li>
          </ul>
        </div>
        <p className="rounded-md border border-border bg-surface px-3 py-2 text-body"><span className="font-semibold text-navy">Missing: </span>No specialist appointment documented</p>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3 text-[0.8125rem]" aria-hidden>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 font-medium text-primary-foreground"><CheckCircle2 className="size-3.5" /> Confirm gap</span>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 px-3 font-medium text-navy"><AlarmClock className="size-3.5" /> Snooze</span>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 px-3 font-medium text-navy"><XCircle className="size-3.5" /> Dismiss</span>
      </div>
    </figure>
  );
}

const TIMELINE = [
  { date: "Jun 10", title: "Office visit — fatigue; return in 60 days requested", kind: "documented" as const },
  { date: "Jun 10", title: "Lab ordered — Vitamin D, 25-hydroxy", kind: "documented" as const },
  { date: "Aug 9", title: "Follow-up visit expected by this date — none on file", kind: "not_documented" as const },
  { date: "Aug 23", title: "Follow-up visit appears overdue", kind: "rule_inferred" as const },
];

export function TimelineFragment() {
  return (
    <figure className={cn(frame, "p-5")} aria-label="Example patient timeline with fictional data">
      <p className="text-sm text-muted-foreground"><span className="font-medium text-navy">Rachel Kim</span> <span className="meta-label">· fictional patient</span></p>
      <ol className="mt-4 space-y-3">
        {TIMELINE.map((entry) => (
          <li key={entry.title} className="grid grid-cols-[3.5rem_1fr] gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
            <span className="font-mono text-[0.75rem] leading-5 tabular-nums text-muted-foreground">{entry.date}</span>
            <div>
              <p className={cn("text-sm", entry.kind === "documented" ? "text-navy" : "text-body")}>{entry.title}</p>
              <ProvenanceBadge kind={entry.kind} className="mt-1.5" />
            </div>
          </li>
        ))}
      </ol>
    </figure>
  );
}

const IMPORT_ROWS = [
  { icon: RefreshCw, label: "Update", tone: "text-brand", text: "Hemoglobin A1c: ordered → resulted" },
  { icon: PlusCircle, label: "New", tone: "text-teal-strong", text: "Lipid panel · ordered 3 days ago" },
  { icon: MinusCircle, label: "No change", tone: "text-slate-600", text: "CBC with differential · collected" },
  { icon: XCircle, label: "Problem", tone: "text-destructive", text: "Patient name doesn't match DEMO-00002" },
];

export function ImportFragment() {
  return (
    <figure className={frame} aria-label="Example import preview with fictional data">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3 text-sm">
        <span className="font-mono text-[0.8rem] text-navy">ehr-lab-orders-export.csv</span>
        <span className="meta-label">Preview · nothing saved yet</span>
      </figcaption>
      <ul className="divide-y divide-border text-sm">
        {IMPORT_ROWS.map((row) => (
          <li key={row.text} className="flex items-center gap-4 px-5 py-3">
            <span className={cn("inline-flex w-24 shrink-0 items-center gap-1.5 font-medium", row.tone)}><row.icon className="size-4" aria-hidden />{row.label}</span>
            <span className="text-body">{row.text}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

const RULE_ROWS = [
  { name: "Lab result not documented", setting: "Grace after turnaround", value: 7, rate: "82%" },
  { name: "Referral outcome not recorded", setting: "Wait for records", value: 14, rate: "75%" },
  { name: "Follow-up visit appears overdue", setting: "Grace after due date", value: 21, rate: "64%" },
];

export function RulesFragment() {
  return (
    <figure className={frame} aria-label="Example detection rule settings with fictional values">
      <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_4.5rem] gap-x-3 border-b border-border px-5 py-2.5 text-xs font-medium text-muted-foreground">
        <span>Rule</span><span className="text-right">Setting</span><span className="text-right">Confirmed</span>
      </div>
      <ul className="divide-y divide-border text-sm">
        {RULE_ROWS.map((row) => (
          <li key={row.name} className="grid grid-cols-[minmax(0,1fr)_3.5rem_4.5rem] items-center gap-x-3 px-5 py-3.5">
            <span className="font-medium text-navy">{row.name}<span className="block text-xs font-normal text-muted-foreground">{row.setting}</span></span>
            <span className="inline-flex h-8 min-w-14 items-center justify-end rounded-md border border-slate-300 bg-surface px-2 font-mono text-[0.8rem] tabular-nums text-navy">{row.value} d</span>
            <span className="text-right tabular-nums text-body">{row.rate}</span>
          </li>
        ))}
      </ul>
      <figcaption className="border-t border-border px-5 py-3 text-xs text-muted-foreground">Illustrative values. In the app, confirm rates come from your physicians&rsquo; own reviews.</figcaption>
    </figure>
  );
}
