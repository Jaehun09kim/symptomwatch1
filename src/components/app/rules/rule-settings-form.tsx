"use client";

import { toast } from "sonner";
import { updateRuleSettingsAction, type ActionResult } from "@/app/app/actions";
import { FormMessage, SubmitButton } from "@/components/forms/fields";
import { useFormAction } from "@/hooks/use-form-action";
import type { RuleSettingsValues } from "@/lib/detection/clinic-config";
import type { RuleId } from "@/lib/detection/types";
import { ruleLabel } from "@/lib/labels";

type NumberKey = Exclude<keyof RuleSettingsValues, "disabledRules">;

export interface RuleRow {
  rule: RuleId;
  description: string;
  fields: Array<{ key: NumberKey; label: string; unit: string; min: number; max: number; defaultValue: number }>;
}

const control = "h-11 w-24 rounded-md border border-input bg-card px-2 text-right text-sm tabular-nums text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand aria-invalid:border-destructive disabled:bg-surface disabled:text-slate-500";

export function RuleSettingsForm({ rows, values, editable }: { rows: RuleRow[]; values: RuleSettingsValues; editable: boolean }) {
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
                <input type="checkbox" name={`enabled:${rule}`} defaultChecked={!values.disabledRules.includes(rule)} aria-describedby={`${rule}-description`} className="size-5 shrink-0 rounded-sm border-input accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" />
                {ruleLabel[rule]}
              </label>
              <p id={`${rule}-description`} className="mt-1 pl-8 text-sm leading-relaxed text-body">{description}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 pl-8 sm:grid-cols-2 xl:pl-0">
              {fields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label htmlFor={field.key} className="block text-xs font-medium text-slate-600">{field.label}</label>
                  <div className="flex items-center gap-1.5">
                    <input id={field.key} name={field.key} type="number" inputMode="numeric" min={field.min} max={field.max} step={1} required
                      defaultValue={values[field.key]} aria-invalid={Boolean(errors[field.key])} aria-describedby={`${field.key}-range`} className={control} />
                    <span className="text-xs text-slate-500">{field.unit}</span>
                  </div>
                  <p id={`${field.key}-range`} className="text-xs text-slate-500">
                    {errors[field.key] ?? `${field.min}–${field.max} · default ${field.defaultValue}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
      {state && !state.ok ? <FormMessage status="error" message={state.message} /> : null}
      {editable ? (
        <div className="flex flex-col items-start gap-3">
          <SubmitButton size="default" pending={pending} pendingLabel="Saving and re-running…">Save and re-run detection</SubmitButton>
          <p className="max-w-3xl text-xs leading-relaxed text-slate-500">Saving re-runs detection now. Flags that no longer qualify are closed with a note; turning a rule off parks its flags until it&rsquo;s turned back on.</p>
        </div>
      ) : (
        <p className="text-sm text-slate-600">Only physicians can change detection rules. Changes are recorded in the audit log.</p>
      )}
    </form>
  );
}
