import { describe, expect, it } from "vitest";
import { disabledLlmProvider, ExternalAiDisabledError, getDetectionProvider, runRules } from "@/lib/detection/engine";
import { evidenceHash } from "@/lib/detection/persistence";
import { daysBetween, windowPassed } from "@/lib/detection/time";
import {
  DEFAULT_RULE_CONFIG,
  type AppointmentSnapshot,
  type EncounterSnapshot,
  type LabOrderSnapshot,
  type PatientSnapshot,
  type ReferralSnapshot,
  type SymptomObservationSnapshot,
} from "@/lib/detection/types";

// Hand-built fixtures (independent of the labeled evaluation dataset).
const AS_OF = "2026-06-01T12:00:00.000Z";
const day = (offset: number) => new Date(Date.parse("2026-06-01T16:00:00.000Z") + offset * 86_400_000).toISOString();
const ctx = { asOf: AS_OF, config: DEFAULT_RULE_CONFIG };

const patient = (parts: Partial<PatientSnapshot> = {}): PatientSnapshot => ({
  patientId: "p", careStatus: "active", encounters: [], appointments: [], symptomObservations: [], labOrders: [], referrals: [], ...parts,
});
const visit = (id: string, offset: number, followUp: Pick<EncounterSnapshot, "followUpKind" | "followUpIntervalDays"> = { followUpKind: "as_needed", followUpIntervalDays: null }): EncounterSnapshot => ({
  id, occurredAt: day(offset), status: "completed", type: "office_visit", chiefComplaint: "Check-up", ...followUp,
});
const interval = (days: number) => ({ followUpKind: "interval" as const, followUpIntervalDays: days });
const appt = (id: string, offset: number, status: AppointmentSnapshot["status"], purpose: AppointmentSnapshot["purpose"] = "follow_up"): AppointmentSnapshot => ({
  id, scheduledFor: day(offset), purpose, status, statusReason: null, originEncounterId: null,
});
const lab = (id: string, offset: number, status: LabOrderSnapshot["status"], extra: Partial<LabOrderSnapshot> = {}): LabOrderSnapshot => ({
  id, encounterId: null, testName: "TSH", orderedAt: day(offset), expectedWithinDays: 7, status, collectedAt: null, resultedAt: null, symptomCode: null, ...extra,
});
const referral = (id: string, offset: number, status: ReferralSnapshot["status"], extra: Partial<ReferralSnapshot> = {}): ReferralSnapshot => ({
  id, encounterId: null, specialty: "Cardiology", referredAt: day(offset), expectedWithinDays: 30, status, specialistAppointmentAt: null, recordsReceivedAt: null, symptomCode: null, ...extra,
});
const obs = (id: string, encounterId: string, offset: number, code: string, status: SymptomObservationSnapshot["status"] = "active"): SymptomObservationSnapshot => ({
  id, encounterId, observedAt: day(offset), symptomCode: code, label: code, status,
});
const rules = (snapshot: PatientSnapshot) => runRules([snapshot], ctx).map((finding) => `${finding.ruleId}:${finding.subject.id}`);

describe("day arithmetic", () => {
  it("uses UTC calendar days and strict window comparison", () => {
    expect(daysBetween("2026-05-31T23:59:00Z", "2026-06-01T00:01:00Z")).toBe(1);
    expect(windowPassed(day(-21), AS_OF, 21)).toBe(false);
    expect(windowPassed(day(-22), AS_OF, 21)).toBe(true);
  });
});

describe("R1 overdue follow-up", () => {
  it("flags an interval follow-up past due + grace with no visit or booking, citing missed appointments", () => {
    const findings = runRules([patient({ encounters: [visit("e1", -120, interval(60))], appointments: [appt("a1", -60, "no_show")] })], ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ ruleId: "overdue-follow-up", subject: { type: "encounter", id: "e1" }, fingerprint: "overdue-follow-up:encounter:e1" });
    expect(findings[0].evidence.map((item) => [item.kind, item.role])).toEqual([["encounter", "basis"], ["appointment", "supporting"]]);
    expect(findings[0].missingInfo.map((item) => item.code)).toEqual(["no_completed_visit_after", "no_future_follow_up"]);
  });

  it("is not flagged inside the grace window (boundary: due + 14 days exactly)", () => {
    expect(rules(patient({ encounters: [visit("e1", -104, interval(90))] }))).toEqual([]);
    expect(rules(patient({ encounters: [visit("e1", -105, interval(90))] }))).toEqual(["overdue-follow-up:e1"]);
  });

  it("is satisfied by a later completed visit or a future follow-up booking (legitimate reschedule)", () => {
    expect(rules(patient({ encounters: [visit("e1", -120, interval(30)), visit("e2", -40)] }))).toEqual([]);
    expect(rules(patient({ encounters: [visit("e1", -120, interval(30))], appointments: [appt("a1", -90, "rescheduled"), appt("a2", 10, "confirmed")] }))).toEqual([]);
  });

  it("does not count a same-day visit, a future lab draw, or a cancelled booking as follow-up", () => {
    expect(rules(patient({ encounters: [visit("e1", -120, interval(30)), visit("e0", -120)] }))).toEqual(["overdue-follow-up:e1"]);
    expect(rules(patient({ encounters: [visit("e1", -120, interval(30))], appointments: [appt("a1", 5, "scheduled", "lab_draw")] }))).toEqual(["overdue-follow-up:e1"]);
    expect(rules(patient({ encounters: [visit("e1", -120, interval(30))], appointments: [appt("a1", 5, "cancelled_by_patient")] }))).toEqual(["overdue-follow-up:e1"]);
  });

  it("never fires for as-needed or unstructured follow-up (free-text plans are a known v1 blind spot)", () => {
    expect(rules(patient({ encounters: [visit("e1", -200, { followUpKind: "as_needed", followUpIntervalDays: null }), visit("e2", -100, { followUpKind: "none", followUpIntervalDays: null })] }))).toEqual([]);
  });

  it("evaluates only the most recent interval request", () => {
    expect(rules(patient({ encounters: [visit("e1", -300, interval(30)), visit("e2", -200, interval(30))] }))).toEqual(["overdue-follow-up:e2"]);
  });
});

describe("R2 lab result missing", () => {
  it("flags ordered and collected labs past turnaround + grace with distinct missing info", () => {
    const findings = runRules([patient({ labOrders: [lab("l1", -40, "ordered"), lab("l2", -30, "collected", { collectedAt: day(-30) })] })], ctx);
    expect(findings.map((finding) => finding.missingInfo[0].code)).toEqual(["no_collection_or_result", "no_result_after_collection"]);
  });

  it("respects the expected window + 7-day grace boundary", () => {
    expect(rules(patient({ labOrders: [lab("l1", -14, "ordered")] }))).toEqual([]);
    expect(rules(patient({ labOrders: [lab("l1", -15, "ordered")] }))).toEqual(["lab-result-missing:l1"]);
  });

  it("ignores resulted and cancelled labs, and ordered labs with a future lab-draw booking", () => {
    expect(rules(patient({ labOrders: [lab("l1", -60, "resulted"), lab("l2", -60, "cancelled")] }))).toEqual([]);
    expect(rules(patient({ labOrders: [lab("l1", -60, "ordered")], appointments: [appt("a1", 3, "scheduled", "lab_draw")] }))).toEqual([]);
  });

  it("still flags a collected-but-unresulted lab even when a lab draw is booked", () => {
    expect(rules(patient({ labOrders: [lab("l1", -60, "collected", { collectedAt: day(-60) })], appointments: [appt("a1", 3, "scheduled", "lab_draw")] }))).toEqual(["lab-result-missing:l1"]);
  });
});

describe("R3 referral outcome missing", () => {
  it("flags a sent referral past expected + 14 days", () => {
    expect(rules(patient({ referrals: [referral("r1", -44, "sent")] }))).toEqual([]);
    expect(rules(patient({ referrals: [referral("r1", -45, "sent")] }))).toEqual(["referral-outcome-missing:r1"]);
  });

  it("handles scheduled referrals by appointment date", () => {
    expect(rules(patient({ referrals: [referral("r1", -60, "scheduled", { specialistAppointmentAt: day(12) })] }))).toEqual([]);
    expect(rules(patient({ referrals: [referral("r1", -60, "scheduled", { specialistAppointmentAt: day(-14) })] }))).toEqual([]);
    expect(rules(patient({ referrals: [referral("r1", -60, "scheduled", { specialistAppointmentAt: day(-15) })] }))).toEqual(["referral-outcome-missing:r1"]);
    expect(rules(patient({ referrals: [referral("r1", -60, "scheduled")] }))).toEqual(["referral-outcome-missing:r1"]); // no date → treated as sent
  });

  it("flags 'seen' without records after 14 days", () => {
    expect(rules(patient({ referrals: [referral("r1", -85, "seen", { specialistAppointmentAt: day(-40) })] }))).toEqual(["referral-outcome-missing:r1"]);
  });

  it("never flags received, declined, or cancelled referrals", () => {
    expect(rules(patient({ referrals: [referral("r1", -200, "records_received"), referral("r2", -200, "declined"), referral("r3", -200, "cancelled")] }))).toEqual([]);
  });
});

describe("R4 persistent symptom without documented plan", () => {
  const asNeeded: Pick<EncounterSnapshot, "followUpKind" | "followUpIntervalDays"> = { followUpKind: "as_needed", followUpIntervalDays: null };
  const two = (code: string, status: SymptomObservationSnapshot["status"] = "active", followUp = asNeeded) => ({
    encounters: [visit("e1", -90), visit("e2", -40, followUp)],
    symptomObservations: [obs("o1", "e1", -90, code), obs("o2", "e2", -40, code, status)],
  });

  it("flags a symptom recurring across ≥2 visits spanning ≥28 days with no plan", () => {
    const findings = runRules([patient(two("cough"))], ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ subject: { type: "symptom", id: "p:cough" } });
    expect(findings[0].evidence.map((item) => item.role)).toEqual(["basis", "supporting"]);
  });

  it("does not flag persistent symptoms documented as improving, resolved, or chronic and managed", () => {
    for (const status of ["improving", "resolved", "chronic_managed"] as const) expect(rules(patient(two("pain", status)))).toEqual([]);
  });

  it("does not flag when a related work-up or upcoming follow-up is documented", () => {
    expect(rules(patient({ ...two("rash"), referrals: [referral("r1", -40, "scheduled", { symptomCode: "rash", specialistAppointmentAt: day(10) })] }))).toEqual([]);
    expect(rules(patient({ ...two("rash"), labOrders: [lab("l1", -40, "resulted", { symptomCode: "rash" })] }))).toEqual([]);
    expect(rules(patient({ ...two("rash"), appointments: [appt("a1", 20, "scheduled")] }))).toEqual([]);
  });

  it("does not let a declined or cancelled referral, or an older unrelated work-up, count as a plan", () => {
    expect(rules(patient({ ...two("rash"), referrals: [referral("r1", -40, "cancelled", { symptomCode: "rash" })] }))).toEqual(["persistent-symptom-unresolved:p:rash"]);
    expect(rules(patient({ ...two("rash"), referrals: [referral("r1", -40, "declined", { symptomCode: "rash" })] }))).toEqual(["persistent-symptom-unresolved:p:rash"]);
    expect(rules(patient({ ...two("rash"), labOrders: [lab("l1", -200, "resulted", { symptomCode: "rash" })] }))).toEqual(["persistent-symptom-unresolved:p:rash"]);
  });

  it("is satisfied while the latest visit's interval follow-up is not yet due", () => {
    expect(rules(patient(two("dizziness", "active", interval(60))))).toEqual([]);
  });

  it("requires distinct visits and the minimum span; does not merge synonyms", () => {
    expect(rules(patient({ encounters: [visit("e1", -30), visit("e2", -10)], symptomObservations: [obs("o1", "e1", -30, "cough"), obs("o2", "e2", -10, "cough")] }))).toEqual([]);
    expect(rules(patient({ encounters: [visit("e1", -90)], symptomObservations: [obs("o1", "e1", -90, "cough"), obs("o2", "e1", -90, "cough")] }))).toEqual([]);
    expect(rules(patient({ encounters: [visit("e1", -90), visit("e2", -40)], symptomObservations: [obs("o1", "e1", -90, "fatigue"), obs("o2", "e2", -40, "tiredness")] }))).toEqual([]);
  });
});

describe("engine-wide behavior", () => {
  it("suppresses all findings when care was transferred out", () => {
    expect(runRules([patient({ careStatus: "transferred_out", labOrders: [lab("l1", -90, "ordered")], referrals: [referral("r1", -90, "sent")] })], ctx)).toEqual([]);
  });

  it("ignores records dated after the as-of date (point-in-time snapshot)", () => {
    expect(rules(patient({ labOrders: [lab("l1", 5, "ordered")], encounters: [visit("e1", 3, interval(1))] }))).toEqual([]);
  });

  it("phrases findings as documentation questions, never diagnoses or urgency", () => {
    const findings = runRules([patient({ encounters: [visit("e1", -120, interval(30))], labOrders: [lab("l1", -60, "ordered")], referrals: [referral("r1", -90, "sent")], ...{} })], ctx);
    for (const finding of findings) {
      expect(`${finding.title} ${finding.rationale}`).not.toMatch(/urgent|critical|diagnos|high risk|severe|emergency/i);
    }
  });

  it("produces a stable evidence hash independent of evidence order", () => {
    const [finding] = runRules([patient({ encounters: [visit("e1", -120, interval(60))], appointments: [appt("a1", -60, "no_show")] })], ctx);
    expect(evidenceHash(finding)).toBe(evidenceHash({ ...finding, evidence: [...finding.evidence].reverse() }));
  });

  it("refuses to run any external AI provider", async () => {
    await expect(disabledLlmProvider.detect([], ctx)).rejects.toBeInstanceOf(ExternalAiDisabledError);
    expect(() => getDetectionProvider("llm", false)).toThrow(ExternalAiDisabledError);
    expect(getDetectionProvider("rules", false).sendsDataExternally).toBe(false);
  });
});

describe("per-clinic rule configuration", () => {
  const overdue = patient({ encounters: [visit("e1", -120, interval(30))] });
  const lateLab = patient({ labOrders: [lab("l1", -20, "ordered")] });

  it("skips rules the clinic has turned off", () => {
    expect(runRules([overdue, lateLab], ctx)).toHaveLength(2);
    const findings = runRules([overdue, lateLab], { ...ctx, disabledRules: ["overdue-follow-up"] });
    expect(findings.map((finding) => finding.ruleId)).toEqual(["lab-result-missing"]);
  });

  it("applies a clinic's grace periods instead of the defaults", () => {
    // Ordered 20 days ago, 7-day turnaround: past the default 7-day grace, inside a 14-day grace.
    const config = { ...DEFAULT_RULE_CONFIG, labResultMissing: { graceDays: 14 } };
    expect(runRules([lateLab], { ...ctx, config })).toEqual([]);
  });
});
