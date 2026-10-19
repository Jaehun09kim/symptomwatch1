import type { RuleSettingsValues } from "@/lib/detection/clinic-config";
import type { RuleId } from "@/lib/detection/types";

type NumberKey = Exclude<keyof RuleSettingsValues, "disabledRules">;
const keys: Record<RuleId, NumberKey[]> = {
  "overdue-follow-up": ["overdueGraceDays"],
  "lab-result-missing": ["labGraceDays"],
  "referral-outcome-missing": ["referralSentGraceDays", "referralRecordsDays"],
  "persistent-symptom-unresolved": ["symptomMinEncounters", "symptomMinSpanDays"],
};

/** Counts come from signalQuality's tenant-scoped query, never from a client role. */
export type RuleImpactCounts = Partial<Record<RuleId, { open: number; snoozed: number; confirmed: number }>>;

export function ruleChangePreview(previous: RuleSettingsValues, next: RuleSettingsValues, counts: RuleImpactCounts = {}): Array<{ rule: RuleId; effect: string }> {
  return (Object.keys(keys) as RuleId[]).flatMap((rule) => {
    const wasOff = previous.disabledRules.includes(rule);
    const isOff = next.disabledRules.includes(rule);
    const changed = keys[rule].filter((key) => Number.isFinite(next[key]) && next[key] !== previous[key]);
    if (wasOff === isOff && !changed.length) return [];
    let effect: string;
    if (!wasOff && isOff) {
      const count = counts[rule];
      const total = count ? count.open + count.snoozed + count.confirmed : undefined;
      effect = `Turning this rule off parks ${total === undefined ? "its open and confirmed flags" : `${total} open or confirmed flag${total === 1 ? "" : "s"} (including snoozed flags)`}. They return if you turn it back on and the records still meet the rule.`;
    } else if (wasOff && !isOff) {
      effect = "Turning this rule on checks the records again. Parked flags that still meet these settings return; those that no longer qualify are resolved. New gaps may be flagged.";
    } else if (isOff) {
      effect = "This rule stays off. These thresholds will apply when you turn it back on; its flags remain parked.";
    } else {
      const longer = changed.every((key) => next[key] > previous[key]);
      const shorter = changed.every((key) => next[key] < previous[key]);
      const symptom = rule === "persistent-symptom-unresolved";
      effect = longer
        ? `${symptom ? "Higher visit/span threshold" : "Longer grace or waiting period"}: flags that no longer meet it will be resolved on the next run.`
        : shorter
          ? `${symptom ? "Lower visit/span threshold" : "Shorter grace or waiting period"}: the next run may raise new flags or reopen resolved flags sooner.`
          : "These thresholds move in different directions. The next run may raise or reopen flags and resolve flags that no longer qualify.";
    }
    return [{ rule, effect }];
  });
}
