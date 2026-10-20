"use client";

import { toast } from "sonner";
import { useState } from "react";
import { updateRuleSettingsAction, type ActionResult } from "@/app/app/actions";
import { SubmitButton } from "@/components/forms/fields";
import { useFormAction } from "@/hooks/use-form-action";
import type { RuleSettingsValues } from "@/lib/detection/clinic-config";
import type { RuleId } from "@/lib/detection/types";
import { ruleLabel } from "@/lib/labels";
import { ruleChangePreview, type RuleImpactCounts } from "@/lib/rule-change-preview";

type NumberKey = Exclude<keyof RuleSettingsValues, "disabledRules">;

export interface RuleRow {
  rule: RuleId;
  description: string;
  fields: Array<{ key: NumberKey; label: string; unit: string; min: number; max: number; defaultValue: number }>;
}

const control = "h-11 w-24 rounded-md border border-border bg-card px-2 text-right text-sm tabular-nums text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand aria-invalid:border-attention-line disabled:bg-surface disabled:text-body";

export function RuleSettingsForm({ rows, values, editable, impactCounts }: { rows: RuleRow[]; values: RuleSettingsValues; editable: boolean; impactCounts: RuleImpactCounts }) {
  const [draft, setDraft] = useState(values);
  const preview = ruleChangePreview(values, draft, impactCounts);
  const [state, onSubmit, pending] = useFormAction(async (previous: ActionResult | null, form: FormData) => {
    void previous;
    const result = await updateRuleSettingsAction(null, form);
    if (result.ok) toast.success(result.message ?? "Saved.");
    return result;
  }, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset disabled={!editable || pending} className="divide-y divide-border border-y border-border">
        <legend className="sr-only">Detection rules</legend>
        {rows.map(({ rule, description, fields }) => (
          <div key={rule} className="grid gap-5 py-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
            <div className="min-w-0">
              <label className="flex min-h-11 items-center gap-3 text-base font-medium text-navy">
                <input type="checkbox" name={`enabled:${rule}`} checked={!draft.disabledRules.includes(rule)} onChange={(event) => setDraft({ ...draft, disabledRules: event.target.checked ? draft.disabledRules.filter((id) => id !== rule) : [...draft.disabledRules, rule] })} aria-describedby={`${rule}-description`} className="size-5 shrink-0 rounded-sm border-border accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" />
                {ruleLabel[rule]}
              </label>
              <p id={`${rule}-description`} className="mt-1 pl-8 text-sm leading-relaxed text-body">{description}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 pl-8 sm:grid-cols-2 xl:pl-0">
              {fields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label htmlFor={field.key} className="block text-xs font-medium text-body">{field.label}</label>
                  <div className="flex items-center gap-1.5">
                    <input id={field.key} name={field.key} type="number" inputMode="numeric" min={field.min} max={field.max} step={1} required
                      value={Number.isFinite(draft[field.key]) ? draft[field.key] : ""} onChange={(event) => setDraft({ ...draft, [field.key]: event.target.valueAsNumber })} aria-invalid={Boolean(errors[field.key])} aria-describedby={`${field.key}-range`} className={control} />
                    <span className="text-xs text-body">{field.unit}</span>
                  </div>
                  <p id={`${field.key}-range`} className="text-xs text-body">
                    {errors[field.key] ?? `${field.min}–${field.max} · default ${field.defaultValue}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
      {state && !state.ok ? <p role="alert" className="rounded-md border border-attention-line bg-attention-soft p-3 text-sm text-attention">{state.message}</p> : null}
      {editable ? <section aria-labelledby="rule-preview-heading" aria-live="polite" className="space-y-2 rounded-md border border-border bg-surface p-4 text-sm text-body">
        <h3 id="rule-preview-heading" className="font-semibold text-navy">Preview of changes</h3>
        {preview.length ? <ul className="space-y-3">{preview.map(({ rule, effect }) => <li key={rule}><strong className="text-navy">{ruleLabel[rule]}:</strong> {effect}</li>)}</ul> : <p>No settings have changed. Adjust a rule to preview its effect.</p>}
        <p>Saving starts that next detection run immediately and records the change in the audit log. Counts reflect this page load and may change before saving.</p>
      </section> : null}
      {editable ? (
        <div className="flex flex-col items-start gap-3">
          <SubmitButton size="default" className="min-h-10" pending={pending} pendingLabel="Saving and re-running…">Save and re-run detection</SubmitButton>
        </div>
      ) : (
        <p className="text-sm text-body">Only physicians can change detection rules. Changes are recorded in the audit log.</p>
      )}
    </form>
  );
}
