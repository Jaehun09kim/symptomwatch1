import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppContext } from "@/lib/authz/context";
import { detectionFlags } from "@/lib/db/schema";
import { withSystem } from "@/lib/db/system";
import type { DatabaseHandle } from "@/lib/db/types";
import {
  dismissFlag,
  getFlagHistory,
  listFlags,
  runDetectionForClinic,
  signalQuality,
  snoozeFlag,
  unsnoozeFlag,
} from "@/lib/services/detection";
import { getRuleSettings, updateRuleSettings } from "@/lib/services/rule-settings";
import { getDashboardSummary } from "@/lib/services/dashboard";
import { contextFor, createSeededDatabase, patientId } from "../helpers/seeded";

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

describe("alert-fatigue controls", () => {
  let db: DatabaseHandle;
  let physician: AppContext;
  let admin: AppContext;
  let staff: AppContext;

  async function flagFor(patientKey: string, ruleId: string) {
    const id = await patientId(db, patientKey);
    return (await listFlags(physician, { status: "all" }, db)).find((flag) => flag.patientId === id && flag.ruleId === ruleId)!;
  }

  beforeAll(async () => {
    db = await createSeededDatabase();
    physician = await contextFor(db, "hv-dr-rivera");
    admin = await contextFor(db, "hv-admin-shah");
    staff = await contextFor(db, "hv-fd-okafor");
  });
  afterAll(async () => { await db.close(); });

  describe("snooze", () => {
    it("hides a snoozed flag from the review queue and the dashboard count until it wakes", async () => {
      const flag = await flagFor("hv-03", "referral-outcome-missing");
      const openBefore = (await listFlags(physician, {}, db)).length;
      const referralCount = async () => (await getDashboardSummary(physician, new Date(), db)).openFlagsByRule!.find((row) => row.ruleId === "referral-outcome-missing")!.count;
      const reviewBefore = await referralCount();

      await snoozeFlag(physician, { flagId: flag.id, until: inDays(14), note: "Specialist office closed for two weeks" }, db);

      const open = await listFlags(physician, {}, db);
      expect(open.map((item) => item.id)).not.toContain(flag.id);
      expect(open).toHaveLength(openBefore - 1);
      const snoozed = await listFlags(physician, { status: "snoozed" }, db);
      expect(snoozed.map((item) => item.id)).toEqual([flag.id]);
      expect(snoozed[0].snoozedUntil?.slice(0, 10)).toBe(inDays(14));
      expect(await referralCount()).toBe(reviewBefore - 1);

      // Re-running detection with unchanged evidence keeps it snoozed.
      await runDetectionForClinic(physician, db);
      expect((await listFlags(physician, { status: "snoozed" }, db)).map((item) => item.id)).toEqual([flag.id]);

      await unsnoozeFlag(physician, { flagId: flag.id }, db);
      expect((await listFlags(physician, {}, db)).map((item) => item.id)).toContain(flag.id);
      const history = (await getFlagHistory(physician, [flag.id], db))[flag.id].map((entry) => entry.eventType);
      expect(history.slice(-2)).toEqual(["snoozed", "unsnoozed"]);
    });

    it("treats a snooze whose date has passed as awake", async () => {
      const flag = await flagFor("hv-03", "referral-outcome-missing");
      await snoozeFlag(physician, { flagId: flag.id, until: inDays(3) }, db);
      await withSystem((tx) => tx.update(detectionFlags).set({ snoozedUntil: new Date(Date.now() - 60_000).toISOString() }).where(eq(detectionFlags.id, flag.id)), db);
      expect((await listFlags(physician, {}, db)).map((item) => item.id)).toContain(flag.id);
      expect(await listFlags(physician, { status: "snoozed" }, db)).toEqual([]);
    });

    it("wakes a snoozed flag early when its evidence changes", async () => {
      const flag = await flagFor("hv-01", "overdue-follow-up");
      await snoozeFlag(physician, { flagId: flag.id, until: inDays(30) }, db);
      await withSystem(async (tx) => {
        const { appointments } = await import("@/lib/db/schema");
        await tx.insert(appointments).values({ clinicId: physician.clinicId, patientId: flag.patientId, scheduledFor: new Date(Date.now() - 3 * 86_400_000).toISOString(), purpose: "follow_up", status: "no_show" });
      }, db);
      await runDetectionForClinic(admin, db);
      const woken = await flagFor("hv-01", "overdue-follow-up");
      expect(woken.status).toBe("open");
      expect(woken.snoozedUntil).toBeNull();
      const history = (await getFlagHistory(physician, [flag.id], db))[flag.id];
      expect(history.at(-1)).toMatchObject({ eventType: "unsnoozed", note: expect.stringMatching(/record changed/i) });
    });

    it("is reserved for physicians, bounded to 90 days, and only for open flags", async () => {
      const flag = await flagFor("hv-03", "referral-outcome-missing");
      await expect(snoozeFlag(admin, { flagId: flag.id, until: inDays(7) }, db)).rejects.toThrow(/Only physicians/);
      await expect(snoozeFlag(staff, { flagId: flag.id, until: inDays(7) }, db)).rejects.toThrow(/Only physicians/);
      await expect(snoozeFlag(physician, { flagId: flag.id, until: inDays(91) }, db)).rejects.toThrow(/90 days/);
      await expect(snoozeFlag(physician, { flagId: flag.id, until: inDays(0) }, db)).rejects.toThrow(/future/);
      // Database backstop: an admin connection cannot set a snooze directly.
      const { withTenant } = await import("@/lib/db/tenant");
      await expect(withTenant(admin, (tx) => tx.update(detectionFlags).set({ snoozedUntil: new Date(Date.now() + 86_400_000).toISOString() }).where(eq(detectionFlags.id, flag.id)), db)).rejects.toThrow();
    });
  });

  describe("structured dismissal reasons", () => {
    it("records the reason code and requires a note only for 'other'", async () => {
      const flag = await flagFor("hv-03", "referral-outcome-missing");
      await expect(dismissFlag(physician, { flagId: flag.id, reasonCode: "other", reason: "" }, db)).rejects.toThrow();
      await dismissFlag(physician, { flagId: flag.id, reasonCode: "expected", reason: "" }, db);
      const dismissed = await flagFor("hv-03", "referral-outcome-missing");
      expect(dismissed).toMatchObject({ status: "dismissed", reviewReason: "expected" });
    });
  });

  describe("per-clinic rule settings", () => {
    it("returns defaults until a physician saves settings, and only physicians may save", async () => {
      expect(await getRuleSettings(admin, db)).toMatchObject({ labGraceDays: 7, disabledRules: [], isDefault: true });
      await expect(updateRuleSettings(admin, { labGraceDays: 10 }, db)).rejects.toThrow(/physician/i);
      await expect(updateRuleSettings(staff, { labGraceDays: 10 }, db)).rejects.toThrow();
      await expect(updateRuleSettings(physician, { labGraceDays: 61 }, db)).rejects.toThrow();
    });

    it("suppresses a turned-off rule's flags and restores them when it is turned back on", async () => {
      const before = (await listFlags(physician, { ruleId: "lab-result-missing" }, db)).length;
      expect(before).toBeGreaterThan(0);
      const summary = await updateRuleSettings(physician, { disabledRules: ["lab-result-missing"] }, db);
      expect(summary.suppressed).toBe(before);
      expect(await listFlags(physician, { ruleId: "lab-result-missing" }, db)).toEqual([]);
      expect((await listFlags(physician, { ruleId: "lab-result-missing", status: "suppressed" }, db))).toHaveLength(before);

      await updateRuleSettings(physician, { disabledRules: [] }, db);
      expect(await listFlags(physician, { ruleId: "lab-result-missing" }, db)).toHaveLength(before);
    });

    it("applies thresholds to detection and closes flags that no longer meet them", async () => {
      const before = (await listFlags(physician, { ruleId: "lab-result-missing" }, db)).length;
      const summary = await updateRuleSettings(physician, { labGraceDays: 60 }, db);
      const after = (await listFlags(physician, { ruleId: "lab-result-missing" }, db)).length;
      expect(after).toBeLessThan(before);
      expect(summary.resolved).toBe(before - after);
      expect(await getRuleSettings(physician, db)).toMatchObject({ labGraceDays: 60, isDefault: false });
      await updateRuleSettings(physician, { labGraceDays: 7 }, db);
      expect((await listFlags(physician, { ruleId: "lab-result-missing" }, db)).length).toBe(before);
    });
  });

  describe("signal quality", () => {
    it("summarizes outcomes per rule for clinical roles only", async () => {
      const rows = await signalQuality(admin, db);
      const referral = rows.find((row) => row.ruleId === "referral-outcome-missing")!;
      expect(referral.dismissed).toBeGreaterThanOrEqual(1);
      expect(referral.dismissReasons.expected).toBeGreaterThanOrEqual(1);
      expect(referral.total).toBeGreaterThanOrEqual(referral.open + referral.confirmed + referral.dismissed);
      await expect(signalQuality(staff, db)).rejects.toThrow();
    });
  });
});
