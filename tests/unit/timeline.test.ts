import { describe, expect, it } from "vitest";
import type { PatientRecord } from "@/lib/services/patients";
import { buildTimeline, sortTimeline } from "@/lib/timeline";

const iso = (day: string) => `${day}T16:00:00.000Z`;

function record(overrides: Partial<PatientRecord> = {}): PatientRecord {
  return {
    header: { id: "p1", demoMrn: "DEMO-00001", firstName: "Test", lastName: "Patient", dateOfBirth: "1970-01-01", sex: "female", phone: "(714) 555-0101", careStatus: "active", physicianName: "Dr. Example" },
    clinical: true,
    encounters: [],
    symptoms: [],
    labs: [],
    referrals: [],
    appointments: [],
    tasks: [],
    flags: [],
    ...overrides,
  };
}

const encounter = (id: string, day: string, interval: number | null) => ({
  id, clinicId: "c", patientId: "p1", occurredAt: iso(day), encounterType: "office_visit" as const, status: "completed" as const,
  providerId: null, providerName: "Dr. Example", chiefComplaint: "Check-up", assessment: "Stable", plan: "Return later",
  followUpKind: interval ? ("interval" as const) : ("as_needed" as const), followUpIntervalDays: interval, seedKey: null,
});

describe("patient timeline", () => {
  it("orders events newest first by default and supports oldest first", () => {
    const events = buildTimeline(record({
      encounters: [encounter("e1", "2026-01-10", 90), encounter("e2", "2026-03-01", null)],
      appointments: [{ id: "a1", clinicId: "c", patientId: "p1", scheduledFor: iso("2026-02-01"), purpose: "follow_up", status: "no_show", statusReason: null, originEncounterId: "e1", completedEncounterId: null, seedKey: null }],
    }), new Date("2026-06-01"));
    expect(events.map((event) => event.anchor)).toEqual(["ev-encounter-e2", "ev-appointment-a1", "ev-encounter-e1"]);
    expect(sortTimeline(events, "asc").map((event) => event.anchor)).toEqual(["ev-encounter-e1", "ev-appointment-a1", "ev-encounter-e2"]);
  });

  it("keeps a visit before its same-day lab order in chronological order", () => {
    const events = buildTimeline(record({
      encounters: [encounter("e1", "2026-01-10", null)],
      labs: [{ id: "l1", clinicId: "c", patientId: "p1", encounterId: "e1", testName: "TSH", orderedAt: iso("2026-01-10"), expectedWithinDays: 7, status: "ordered", collectedAt: null, resultedAt: null, resultSummary: null, statusReason: null, symptomCode: null, seedKey: null }],
    }));
    expect(sortTimeline(events, "asc").map((event) => event.kind)).toEqual(["visit", "lab"]);
  });

  it("labels missed appointments and marks future bookings as upcoming", () => {
    const events = buildTimeline(record({
      appointments: [
        { id: "a1", clinicId: "c", patientId: "p1", scheduledFor: iso("2026-02-01"), purpose: "follow_up", status: "cancelled_by_clinic", statusReason: "Provider unavailable", originEncounterId: null, completedEncounterId: null, seedKey: null },
        { id: "a2", clinicId: "c", patientId: "p1", scheduledFor: iso("2026-07-01"), purpose: "follow_up", status: "confirmed", statusReason: null, originEncounterId: null, completedEncounterId: null, seedKey: null },
      ],
    }), new Date("2026-06-01"));
    expect(events.find((event) => event.anchor === "ev-appointment-a1")).toMatchObject({ kind: "missed_appointment", upcoming: false });
    expect(events.find((event) => event.anchor === "ev-appointment-a2")).toMatchObject({ kind: "appointment", upcoming: true });
  });

  it("distinguishes documented events, missing records, and rule inferences", () => {
    const events = buildTimeline(record({
      encounters: [encounter("e1", "2026-01-10", 30)],
      flags: [{
        id: "f1", clinicId: "c", patientId: "p1", ruleId: "overdue-follow-up", ruleVersion: "1.0.0", fingerprint: "x", subjectType: "encounter", subjectId: "e1",
        title: "Follow-up visit appears overdue", rationale: "…", evidence: [{ kind: "encounter", id: "e1", date: iso("2026-01-10"), label: "Visit", role: "basis" }],
        missingInfo: [{ code: "no_completed_visit_after", description: "No completed visit after Jan 10", certainty: "not_documented" }],
        evidenceHash: "h", status: "open", firstDetectedAt: iso("2026-06-01"), lastDetectedAt: iso("2026-06-01"), reviewedBy: null, reviewedAt: null, reviewNote: null,
      }],
    }));
    expect(events.find((event) => event.kind === "visit")?.provenance).toBe("documented");
    const expected = events.find((event) => event.kind === "expected")!;
    expect(expected).toMatchObject({ provenance: "not_documented", title: "No completed visit after Jan 10" });
    expect(expected.date).toBe(iso("2026-02-09")); // visit + 30 days
    expect(events.find((event) => event.kind === "flag")?.provenance).toBe("rule_inferred");
  });

  it("omits dismissed and resolved flags", () => {
    const base = buildTimeline(record({ flags: [{
      id: "f1", clinicId: "c", patientId: "p1", ruleId: "lab-result-missing", ruleVersion: "1.0.0", fingerprint: "x", subjectType: "lab_order", subjectId: "l1",
      title: "t", rationale: "r", evidence: [], missingInfo: [], evidenceHash: "h", status: "dismissed",
      firstDetectedAt: iso("2026-06-01"), lastDetectedAt: iso("2026-06-01"), reviewedBy: null, reviewedAt: null, reviewNote: null,
    }] }));
    expect(base).toEqual([]);
  });
});
