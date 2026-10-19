import { describe, expect, it } from "vitest";
import { flagExpectedDate } from "@/lib/flag-expected-date";
import type { RuleId } from "@/lib/detection/types";

const records: Parameters<typeof flagExpectedDate>[1] = {
  encounters: [{ id: "visit", followUpKind: "interval", followUpIntervalDays: 30, occurredAt: "2026-12-20T16:00:00Z" }],
  labs: [{ id: "lab", orderedAt: "2026-12-28T16:00:00Z", expectedWithinDays: 7 }],
  referrals: [{ id: "ref", referredAt: "2026-12-01T16:00:00Z", expectedWithinDays: 30, specialistAppointmentAt: "2027-01-02T16:00:00Z" }],
};
const settings = { referralRecordsDays: 14 };
const flag = (ruleId: RuleId, id: string, kind: "encounter" | "lab_order" | "referral", code = "") => ({ ruleId, evidence: [{ id, kind, role: "basis" as const, date: "2026-12-01", label: "Fictional source" }], missingInfo: [{ code, description: "Missing", certainty: "not_documented" as const }] });

describe("expected-by dates", () => {
  it("uses documented intervals across year boundaries, without adding detection grace", () => {
    expect(flagExpectedDate(flag("overdue-follow-up", "visit", "encounter"), records, settings)).toBe("2027-01-19");
    expect(flagExpectedDate(flag("lab-result-missing", "lab", "lab_order"), records, settings)).toBe("2027-01-04");
  });
  it("distinguishes the appointment expectation from the post-visit records window", () => {
    expect(flagExpectedDate(flag("referral-outcome-missing", "ref", "referral", "no_specialist_appointment"), records, settings)).toBe("2026-12-31");
    expect(flagExpectedDate(flag("referral-outcome-missing", "ref", "referral", "no_consult_note"), records, settings)).toBe("2027-01-16");
  });
  it("does not invent dates for missing sources, undated visits, or persistent symptoms", () => {
    expect(flagExpectedDate(flag("lab-result-missing", "other-clinic", "lab_order"), records, settings)).toBeUndefined();
    expect(flagExpectedDate(flag("persistent-symptom-unresolved", "visit", "encounter"), records, settings)).toBeUndefined();
    expect(flagExpectedDate(flag("referral-outcome-missing", "ref", "referral", "no_consult_note"), { ...records, referrals: [{ ...records.referrals[0], specialistAppointmentAt: null }] }, settings)).toBeUndefined();
  });
});
