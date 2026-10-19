import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/primitives/layout";
import { RuleSettingsForm, type RuleRow } from "@/components/app/rules/rule-settings-form";
import { requirePermission } from "@/lib/auth/current";
import { can } from "@/lib/authz/permissions";
import { DEFAULT_RULE_SETTINGS, RULE_IDS } from "@/lib/detection/clinic-config";
import { dismissReasonShortLabel, ruleShortLabel, type DismissReason } from "@/lib/labels";
import { describeRule } from "@/lib/rule-descriptions";
import { signalQuality } from "@/lib/services/detection";
import { getRuleSettings, RULE_SETTING_BOUNDS } from "@/lib/services/rule-settings";
import type { RuleImpactCounts } from "@/lib/rule-change-preview";

export const metadata: Metadata = { title: "Detection rules" };

const field = (key: keyof typeof RULE_SETTING_BOUNDS, label: string, unit: string): RuleRow["fields"][number] => ({
  key, label, unit, min: RULE_SETTING_BOUNDS[key][0], max: RULE_SETTING_BOUNDS[key][1], defaultValue: DEFAULT_RULE_SETTINGS[key],
});

const FIELDS: Record<(typeof RULE_IDS)[number], RuleRow["fields"]> = {
  "overdue-follow-up": [field("overdueGraceDays", "Grace after due date", "days")],
  "lab-result-missing": [field("labGraceDays", "Grace after turnaround", "days")],
  "referral-outcome-missing": [field("referralSentGraceDays", "Grace for an appointment", "days"), field("referralRecordsDays", "Wait for records after visit", "days")],
  "persistent-symptom-unresolved": [field("symptomMinEncounters", "Minimum visits", "visits"), field("symptomMinSpanDays", "Minimum span", "days")],
};

const percent = (value: number | null) => (value === null ? "No reviewed flags yet" : `${Math.round(value * 100)}%`);

async function Rules() {
  const { ctx, session } = await requirePermission("flag.read");
  const [settings, signals] = await Promise.all([getRuleSettings(ctx), signalQuality(ctx)]);
  const rows: RuleRow[] = RULE_IDS.map((rule) => ({ rule, description: describeRule(rule, settings), fields: FIELDS[rule] }));
  const impactCounts: RuleImpactCounts = Object.fromEntries(signals.map(({ ruleId, open, snoozed, confirmed }) => [ruleId, { open, snoozed, confirmed }]));

  return (
    <div className="space-y-10">
      <PageHeader
        title="Detection rules"
        description="Tune how long SymptomWatch waits before raising a possible gap, or turn a rule off for this clinic. Fewer, better flags beat a queue nobody reads."
      />

      <section aria-labelledby="settings-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="settings-heading" className="font-display text-3xl font-normal text-navy">Rule settings</h2>
          <p className="text-xs text-body">
            {settings.isDefault
              ? "Using SymptomWatch defaults."
              : `Last changed ${new Date(settings.updatedAt!).toLocaleDateString("en-US", { dateStyle: "medium" })}${settings.updatedByName ? ` by ${settings.updatedByName}` : ""}.`}
          </p>
        </div>
        <RuleSettingsForm key={settings.updatedAt ?? "defaults"} rows={rows} values={settings} editable={can(session.role, "detection.configure")} impactCounts={impactCounts} />
      </section>

      <section aria-labelledby="signal-heading" className="space-y-3">
        <div>
          <h2 id="signal-heading" className="font-display text-3xl font-normal text-navy">Signal quality</h2>
          <p className="mt-1 max-w-3xl text-sm text-body">
            What physicians decided about each rule&rsquo;s flags in this clinic. A low confirm rate or many &ldquo;expected&rdquo; dismissals suggests a rule needs a longer grace period. These are review outcomes, not a clinical validation of the rules.
          </p>
        </div>
        <div className="overflow-x-auto border-y border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" tabIndex={0} role="region" aria-label="Signal quality by rule">
          <table className="w-full min-w-[46rem] text-sm">
            <caption className="sr-only">Flag counts and physician review outcomes by detection rule</caption>
            <thead className="bg-surface text-left text-xs font-medium text-body">
              <tr>
                <th scope="col" className="px-3 py-3">Rule</th>
                <th scope="col" className="px-3 py-3 text-right">Raised</th>
                <th scope="col" className="px-3 py-3 text-right">Awaiting</th>
                <th scope="col" className="px-3 py-3 text-right">Snoozed</th>
                <th scope="col" className="px-3 py-3 text-right">Confirmed</th>
                <th scope="col" className="px-3 py-3 text-right">Dismissed</th>
                <th scope="col" className="px-3 py-3 text-right">Resolved by data</th>
                <th scope="col" className="px-3 py-3 text-right">Confirm rate</th>
                <th scope="col" className="px-3 py-3">Top dismissal reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {signals.map((signal) => {
                const [topReason, topCount] = (Object.entries(signal.dismissReasons) as Array<[DismissReason, number]>).sort((a, b) => b[1] - a[1])[0];
                return (
                  <tr key={signal.ruleId} className="hover:bg-surface">
                    <th scope="row" className="px-3 py-3 text-left font-medium text-navy">
                      {ruleShortLabel[signal.ruleId]}
                      {settings.disabledRules.includes(signal.ruleId) ? <span className="ml-2 text-xs font-normal text-body">(off · {signal.suppressed} parked)</span> : null}
                    </th>
                    <td className="px-3 py-3 text-right">{signal.total}</td>
                    <td className="px-3 py-3 text-right">{signal.open}</td>
                    <td className="px-3 py-3 text-right">{signal.snoozed}</td>
                    <td className="px-3 py-3 text-right">{signal.confirmed}</td>
                    <td className="px-3 py-3 text-right">{signal.dismissed}</td>
                    <td className="px-3 py-3 text-right">{signal.resolved}</td>
                    <td className="px-3 py-3 text-right">{percent(signal.confirmRate)}</td>
                    <td className="px-3 py-3 text-body">{topCount ? `${dismissReasonShortLabel[topReason]} (${topCount})` : signal.confirmRate === null ? "No reviewed flags yet" : "No dismissals yet"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function RulesPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-surface" />}>
      <Rules />
    </Suspense>
  );
}
