/**
 * Per-clinic detection settings: grace periods, symptom thresholds, and rules
 * a clinic has turned off. Changing them is a clinical decision, so only
 * physicians may save; every change is audited and immediately re-runs
 * detection so the review queue reflects the new settings.
 */
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { AppContext } from "@/lib/authz/context";
import { can } from "@/lib/authz/permissions";
import { clinicRuleSettings, users } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import type { DatabaseHandle } from "@/lib/db/types";
import { RULE_IDS, valuesFrom, type RuleSettingsValues } from "@/lib/detection/clinic-config";
import { applyDetectionRun, type DetectionRunSummary } from "@/lib/detection/persistence";
import { getEnv } from "@/lib/env";
import { recordAudit } from "./audit";
import { ServiceError } from "./errors";

export { DEFAULT_RULE_SETTINGS, RULE_IDS, type RuleSettingsValues } from "@/lib/detection/clinic-config";

/** Bounds mirror the CHECK constraints in 0006_alert_controls.sql. */
export const RULE_SETTING_BOUNDS = {
  overdueGraceDays: [0, 60],
  labGraceDays: [0, 60],
  referralSentGraceDays: [0, 90],
  referralRecordsDays: [0, 90],
  symptomMinEncounters: [2, 6],
  symptomMinSpanDays: [0, 180],
} as const satisfies Record<Exclude<keyof RuleSettingsValues, "disabledRules">, readonly [number, number]>;

const bounded = (key: keyof typeof RULE_SETTING_BOUNDS) => {
  const [min, max] = RULE_SETTING_BOUNDS[key];
  return z.coerce.number().int("Use whole days").min(min, `Must be at least ${min}`).max(max, `Must be ${max} or less`);
};

export const ruleSettingsSchema = z.object({
  overdueGraceDays: bounded("overdueGraceDays"),
  labGraceDays: bounded("labGraceDays"),
  referralSentGraceDays: bounded("referralSentGraceDays"),
  referralRecordsDays: bounded("referralRecordsDays"),
  symptomMinEncounters: bounded("symptomMinEncounters"),
  symptomMinSpanDays: bounded("symptomMinSpanDays"),
  disabledRules: z.array(z.enum(RULE_IDS)).transform((rules) => [...new Set(rules)]),
}).partial();

export interface RuleSettingsView extends RuleSettingsValues {
  isDefault: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
}

export async function getRuleSettings(ctx: AppContext, database?: DatabaseHandle): Promise<RuleSettingsView> {
  if (!can(ctx.role, "flag.read")) throw new ServiceError("You don't have access to detection settings.");
  return withTenant(ctx, async (tx) => {
    const [row] = await tx.select({
      settings: clinicRuleSettings,
      updatedByName: sql<string | null>`(select display_name from ${users} where ${users.id} = ${clinicRuleSettings.updatedBy})`,
    }).from(clinicRuleSettings).where(eq(clinicRuleSettings.clinicId, ctx.clinicId));
    return {
      ...valuesFrom(row?.settings),
      isDefault: !row,
      updatedAt: row?.settings.updatedAt ?? null,
      updatedByName: row?.updatedByName ?? null,
    };
  }, database);
}

export async function updateRuleSettings(
  ctx: AppContext,
  raw: z.input<typeof ruleSettingsSchema>,
  database?: DatabaseHandle,
): Promise<DetectionRunSummary> {
  if (!can(ctx.role, "detection.configure")) throw new ServiceError("Only physicians can change detection rules.");
  const changes = ruleSettingsSchema.parse(raw);
  return withTenant(ctx, async (tx) => {
    const [row] = await tx.select().from(clinicRuleSettings).where(eq(clinicRuleSettings.clinicId, ctx.clinicId));
    const previous = valuesFrom(row);
    const next: RuleSettingsValues = { ...previous, ...changes };
    const values = { ...next, updatedBy: ctx.userId, updatedAt: sql`now()` as unknown as string };
    if (row) await tx.update(clinicRuleSettings).set(values).where(eq(clinicRuleSettings.clinicId, ctx.clinicId));
    else await tx.insert(clinicRuleSettings).values({ clinicId: ctx.clinicId, ...values });

    const changed = Object.fromEntries(
      (Object.keys(next) as Array<keyof RuleSettingsValues>)
        .filter((key) => JSON.stringify(next[key]) !== JSON.stringify(previous[key]))
        .map((key) => [key, { from: previous[key], to: next[key] }]),
    );
    const summary = await applyDetectionRun(tx, {
      clinicId: ctx.clinicId,
      actorUserId: ctx.userId,
      asOf: new Date(),
      externalAiEnabled: getEnv().EXTERNAL_AI_ENABLED,
      resolvedNote: "No longer meets this clinic's rule settings.",
    });
    await recordAudit(tx, ctx, "detection.settings_updated", { type: "clinic", id: ctx.clinicId }, { changed, ...summary });
    return summary;
  }, database);
}
