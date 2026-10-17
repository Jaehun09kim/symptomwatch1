import { describe, expect, it } from "vitest";
import { evaluate, metricsFrom } from "../../evaluation/evaluate";
import { referenceUnits } from "../../evaluation/reference-labels";
import { EVALUATION_REFERENCE_DATE, patients } from "@/data/synthetic";
import { clinics, encounters, labOrders, patients as patientTable, referrals } from "@/lib/db/schema";
import { withSystem } from "@/lib/db/system";
import { runRules } from "@/lib/detection/engine";
import { DEFAULT_RULE_CONFIG } from "@/lib/detection/types";
import { seedSharedDemo } from "@/lib/services/demo-seed";
import { loadPatientSnapshots } from "@/lib/services/snapshots";
import { createTestDatabase } from "../helpers/db";

describe("evaluation", () => {
  it("declares a reference unit for every lab order and referral in the dataset", () => {
    const declared = new Set(referenceUnits.map((unit) => unit.subjectId));
    for (const patient of patients) {
      for (const lab of patient.labs ?? []) expect(declared.has(lab.key), lab.key).toBe(true);
      for (const referral of patient.referrals ?? []) expect(declared.has(referral.key), referral.key).toBe(true);
    }
    expect(patients.length).toBeGreaterThanOrEqual(30);
  });

  it("produces consistent, bounded metrics with no unlisted predictions", () => {
    const result = evaluate({ now: new Date("2026-06-02T00:00:00Z") });
    const { overall } = result;
    expect(overall.tp + overall.fp + overall.fn + overall.tn).toBe(result.units.length);
    for (const value of [overall.precision, overall.recall, overall.f1, overall.falsePositiveRate]) {
      expect(value).not.toBeNull();
      expect(value!).toBeGreaterThanOrEqual(0);
      expect(value!).toBeLessThanOrEqual(1);
    }
    expect(result.unlistedPredictions).toEqual([]);
  });

  it("handles zero denominators as null", () => {
    expect(metricsFrom({ tp: 0, fp: 0, fn: 0, tn: 4 })).toMatchObject({ precision: null, recall: null, f1: null, falsePositiveRate: 0 });
  });

  it("finds exactly the same gaps through the database path as the evaluation path", async () => {
    const db = await createTestDatabase();
    try {
      await withSystem((tx) => seedSharedDemo(tx, EVALUATION_REFERENCE_DATE), db);
      const asOf = `${EVALUATION_REFERENCE_DATE}T12:00:00.000Z`;
      const viaDatabase = await withSystem(async (tx) => {
        const keys = new Map<string, string>();
        const clinicRows = await tx.select({ id: clinics.id }).from(clinics);
        const findings = [];
        for (const clinic of clinicRows) {
          const snapshots = await loadPatientSnapshots(tx, undefined, { clinicId: clinic.id, clinical: true });
          findings.push(...runRules(snapshots, { asOf, config: DEFAULT_RULE_CONFIG }));
        }
        for (const table of [patientTable, encounters, labOrders, referrals] as const) {
          for (const row of await tx.select({ id: table.id, seedKey: table.seedKey }).from(table)) keys.set(row.id, row.seedKey ?? row.id);
        }
        return findings.map((finding) => {
          const subject = finding.subject.type === "symptom"
            ? `${keys.get(finding.patientId)}:${finding.subject.id.split(":")[1]}`
            : keys.get(finding.subject.id);
          return `${finding.ruleId}|${subject}`;
        }).sort();
      }, db);
      const viaEvaluation = evaluate().predictions.map((prediction) => `${prediction.ruleId}|${prediction.subjectId}`).sort();
      expect(viaDatabase).toEqual(viaEvaluation);
    } finally {
      await db.close();
    }
  });
});
