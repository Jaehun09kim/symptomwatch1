/**
 * Clinic-level detection configuration, stored in clinic_rule_settings.
 * A clinic without a row uses the engine defaults (DEFAULT_RULE_CONFIG).
 */
import { eq } from "drizzle-orm";
import { clinicRuleSettings } from "@/lib/db/schema";
import type { DbTransaction } from "@/lib/db/types";
import { DEFAULT_RULE_CONFIG, type RuleConfig, type RuleId } from "./types";

export const RULE_IDS = ["overdue-follow-up", "lab-result-missing", "referral-outcome-missing", "persistent-symptom-unresolved"] as const satisfies readonly RuleId[];

export interface RuleSettingsValues {
  overdueGraceDays: number;
  labGraceDays: number;
  referralSentGraceDays: number;
  referralRecordsDays: number;
  symptomMinEncounters: number;
  symptomMinSpanDays: number;
  disabledRules: RuleId[];
}

export const DEFAULT_RULE_SETTINGS: RuleSettingsValues = {
  overdueGraceDays: DEFAULT_RULE_CONFIG.overdueFollowUp.graceDays,
  labGraceDays: DEFAULT_RULE_CONFIG.labResultMissing.graceDays,
  referralSentGraceDays: DEFAULT_RULE_CONFIG.referralOutcomeMissing.sentGraceDays,
  referralRecordsDays: DEFAULT_RULE_CONFIG.referralOutcomeMissing.postVisitRecordsDays,
  symptomMinEncounters: DEFAULT_RULE_CONFIG.persistentSymptom.minEncounters,
  symptomMinSpanDays: DEFAULT_RULE_CONFIG.persistentSymptom.minSpanDays,
  disabledRules: [],
};

export function toRuleConfig(values: RuleSettingsValues): RuleConfig {
  return {
    overdueFollowUp: { graceDays: values.overdueGraceDays },
    labResultMissing: { graceDays: values.labGraceDays },
    referralOutcomeMissing: { sentGraceDays: values.referralSentGraceDays, postVisitRecordsDays: values.referralRecordsDays },
    persistentSymptom: { minEncounters: values.symptomMinEncounters, minSpanDays: values.symptomMinSpanDays },
  };
}

type SettingsRow = typeof clinicRuleSettings.$inferSelect;

export function valuesFrom(row: SettingsRow | undefined): RuleSettingsValues {
  if (!row) return { ...DEFAULT_RULE_SETTINGS, disabledRules: [] };
  return {
    overdueGraceDays: row.overdueGraceDays,
    labGraceDays: row.labGraceDays,
    referralSentGraceDays: row.referralSentGraceDays,
    referralRecordsDays: row.referralRecordsDays,
    symptomMinEncounters: row.symptomMinEncounters,
    symptomMinSpanDays: row.symptomMinSpanDays,
    disabledRules: row.disabledRules.filter((rule): rule is RuleId => (RULE_IDS as readonly string[]).includes(rule)),
  };
}

/** Works on any transaction handle; detection calls it on both the tenant and the system path. */
export async function readRuleSettings(tx: DbTransaction, clinicId: string): Promise<{ config: RuleConfig; disabledRules: RuleId[] }> {
  const [row] = await tx.select().from(clinicRuleSettings).where(eq(clinicRuleSettings.clinicId, clinicId));
  const values = valuesFrom(row);
  return { config: toRuleConfig(values), disabledRules: values.disabledRules };
}
