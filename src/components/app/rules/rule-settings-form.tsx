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

const control = "h-9 w-20 rounded-[5px] border border-input bg-card px-2 text-right text-sm tabular-nums text-navy disabled:bg-surface disabled:text-slate-500";

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
          <div key={rule} className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div className="min-w-0">
              <label className="flex items-center gap-2.5 text-[15px] font-semibold text-navy">
                <input type="checkbox" name={`enabled:${rule}`} defaultChecked={!values.disabledRules.includes(rule)} className="size-4 accent-brand" />
                {ruleLabel[rule]}
              </label>
              <p className="mt-1.5 pl-[26px] text-sm text-body">{description}</p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-3 pl-[26px] md:justify-end md:pl-0">
              {fields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label htmlFor={field.key} className="block text-xs font-medium text-slate-600">{field.label}</label>
                  <div className="flex items-center gap-1.5">
                    <input id={field.key} name={field.key} type="number" inputMode="numeric" min={field.min} max={field.max} step={1} required
                      defaultValue={values[field.key]} aria-invalid={Boolean(errors[field.key])} aria-describedby={`${field.key}-range`} className={control} />
                    <span className="text-xs text-slate-500">{field.unit}</span>
                  </div>
                  <p id={`${field.key}-range`} className="text-[11px] text-slate-500">
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
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton size="default" pending={pending} pendingLabel="Saving and re-running…">Save and re-run detection</SubmitButton>
          <p className="text-xs text-slate-500">Saving re-runs detection now. Flags that no longer qualify are closed with a note; turning a rule off parks its flags until it&rsquo;s turned back on.</p>
        </div>
      ) : (
        <p className="text-sm text-slate-600">Only physicians can change detection rules. Changes are recorded in the audit log.</p>
      )}
    </form>
  );
}
