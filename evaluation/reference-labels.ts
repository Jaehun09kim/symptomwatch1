/**
 * Reference labels for evaluating follow-up gap detection (Claude-owned).
 *
 * Authored from the scenario narratives by clinical/documentation judgment:
 * "Would a careful reviewer consider this a real, currently open follow-up
 * documentation gap of this type?" — NOT by applying the v1 rules literally.
 * Written BEFORE the detection engine was implemented; the implementer was
 * instructed not to read this file. Some labels intentionally disagree with
 * what structured-field rules can see (free-text plans, synonym symptoms,
 * results filed under a different order, "resulted" labs that need a redraw).
 *
 * Every evaluation unit is enumerated here, independent of engine output.
 * See docs/PRODUCT_SPEC.md §6.7 for unit definitions.
 *
 * All patients are fictional.
 */
import type { RuleId } from "../src/lib/detection/types";

export interface ReferenceUnit {
  ruleId: RuleId;
  patientKey: string;
  /** Subject id in engine terms: encounter/lab/referral seed key, or `${patientKey}:${symptomCode}`. */
  subjectId: string;
  /** Other subject ids that refer to the same unit (e.g. synonym symptom codes). */
  aliases?: string[];
  expected: boolean;
  rationale: string;
}

const R1 = "overdue-follow-up" as const;
const R2 = "lab-result-missing" as const;
const R3 = "referral-outcome-missing" as const;
const R4 = "persistent-symptom-unresolved" as const;

export const LABEL_SET_VERSION = "2026-10-16.1";

export const referenceUnits: ReferenceUnit[] = [
  // ---------------------------------------------------------------- R1
  { ruleId: R1, patientKey: "hv-01", subjectId: "hv-01-e1", expected: true, rationale: "3-month return requested; no-show, never rebooked, ~2 months past due." },
  { ruleId: R1, patientKey: "hv-02", subjectId: "hv-02-e1", expected: false, rationale: "3-month return not yet due." },
  { ruleId: R1, patientKey: "hv-03", subjectId: "hv-03-e1", expected: false, rationale: "Return after cardiology; structured interval not yet due." },
  { ruleId: R1, patientKey: "hv-04", subjectId: "hv-04-e2", expected: false, rationale: "Recheck requested at e2 and a later visit (e3) occurred." },
  { ruleId: R1, patientKey: "hv-05", subjectId: "hv-05-e1", expected: false, rationale: "Follow-up completed." },
  { ruleId: R1, patientKey: "hv-06", subjectId: "hv-06-e3", expected: false, rationale: "Recheck not yet due." },
  { ruleId: R1, patientKey: "hv-07", subjectId: "hv-07-e1", expected: false, rationale: "Rescheduled at patient request; confirmed future appointment." },
  { ruleId: R1, patientKey: "hv-08", subjectId: "hv-08-e1", expected: false, rationale: "Return after GI; not yet due (the GI gap is an R3 issue)." },
  { ruleId: R1, patientKey: "hv-09", subjectId: "hv-09-e1", expected: false, rationale: "6-month return not yet due." },
  { ruleId: R1, patientKey: "hv-11", subjectId: "hv-11-e1", expected: false, rationale: "Annual return not yet due." },
  { ruleId: R1, patientKey: "hv-13", subjectId: "hv-13-e1", expected: true, rationale: "Free-text plan: return in 2 weeks for BP recheck; nothing since (~10 weeks)." },
  { ruleId: R1, patientKey: "hv-14", subjectId: "hv-14-e1", expected: false, rationale: "Care transferred to another practice." },
  { ruleId: R1, patientKey: "hv-15", subjectId: "hv-15-e2", expected: false, rationale: "Return after GI; not yet due." },
  { ruleId: R1, patientKey: "hv-16", subjectId: "hv-16-e1", expected: false, rationale: "Not yet due." },
  { ruleId: R1, patientKey: "hv-17", subjectId: "hv-17-e1", expected: false, rationale: "Not yet due." },
  { ruleId: R1, patientKey: "hv-18", subjectId: "hv-18-e1", expected: false, rationale: "10 days past due — within a reasonable scheduling window (boundary)." },
  { ruleId: R1, patientKey: "hv-19", subjectId: "hv-19-e1", expected: true, rationale: "No-show then patient cancellation, never rebooked." },
  { ruleId: R1, patientKey: "hv-20", subjectId: "hv-20-e1", expected: false, rationale: "6-month return not yet due." },
  { ruleId: R1, patientKey: "hv-21", subjectId: "hv-21-e3", expected: false, rationale: "3-month return not yet due." },
  { ruleId: R1, patientKey: "hv-22", subjectId: "hv-22-e2", expected: false, rationale: "6-month return not yet due." },
  { ruleId: R1, patientKey: "hv-24", subjectId: "hv-24-e2", expected: false, rationale: "2-month recheck not yet due." },
  { ruleId: R1, patientKey: "hv-25", subjectId: "hv-25-e1", expected: false, rationale: "6-week return occurred (e2). The open issue is the symptom (R4)." },
  { ruleId: R1, patientKey: "hv-26", subjectId: "hv-26-e1", expected: false, rationale: "6-month return not yet due." },
  { ruleId: R1, patientKey: "hv-27", subjectId: "hv-27-e1", expected: false, rationale: "Not yet due." },
  { ruleId: R1, patientKey: "hv-28", subjectId: "hv-28-e2", expected: false, rationale: "Free-text: reassess at annual exam in 6 months — not yet due." },
  { ruleId: R1, patientKey: "hv-29", subjectId: "hv-29-e2", expected: false, rationale: "6-month return not yet due." },
  { ruleId: R1, patientKey: "hv-30", subjectId: "hv-30-e1", expected: true, rationale: "Clinic cancelled the 1-month follow-up and never rebooked." },
  { ruleId: R1, patientKey: "og-01", subjectId: "og-01-e1", expected: false, rationale: "Annual return not yet due." },
  { ruleId: R1, patientKey: "og-02", subjectId: "og-02-e1", expected: false, rationale: "Return after orthopedics; structured interval not yet due." },
  { ruleId: R1, patientKey: "og-03", subjectId: "og-03-e1", expected: false, rationale: "Annual return not yet due." },
  { ruleId: R1, patientKey: "og-04", subjectId: "og-04-e1", expected: true, rationale: "1-month return requested 80 days ago; nothing scheduled." },
  { ruleId: R1, patientKey: "og-05", subjectId: "og-05-e1", expected: false, rationale: "3-month return not yet due." },

  // ---------------------------------------------------------------- R2
  { ruleId: R2, patientKey: "hv-01", subjectId: "hv-01-l1", expected: false, rationale: "Resulted." },
  { ruleId: R2, patientKey: "hv-02", subjectId: "hv-02-l1", expected: true, rationale: "A1c never collected, 40 days." },
  { ruleId: R2, patientKey: "hv-02", subjectId: "hv-02-l2", expected: false, rationale: "Resulted." },
  { ruleId: R2, patientKey: "hv-05", subjectId: "hv-05-l1", expected: false, rationale: "Resulted." },
  { ruleId: R2, patientKey: "hv-07", subjectId: "hv-07-l1", expected: false, rationale: "Resulted." },
  { ruleId: R2, patientKey: "hv-09", subjectId: "hv-09-l1", expected: false, rationale: "Resulted." },
  { ruleId: R2, patientKey: "hv-10", subjectId: "hv-10-l1", expected: true, rationale: "Collected a month ago; no result." },
  { ruleId: R2, patientKey: "hv-11", subjectId: "hv-11-l1", expected: false, rationale: "Result is in the chart under a separate outside-lab entry; clerical only." },
  { ruleId: R2, patientKey: "hv-11", subjectId: "hv-11-l2", expected: false, rationale: "Resulted." },
  { ruleId: R2, patientKey: "hv-11", subjectId: "hv-11-l3", expected: false, rationale: "Resulted (outside result)." },
  { ruleId: R2, patientKey: "hv-14", subjectId: "hv-14-l1", expected: false, rationale: "Care transferred." },
  { ruleId: R2, patientKey: "hv-16", subjectId: "hv-16-l1", expected: false, rationale: "Resulted." },
  { ruleId: R2, patientKey: "hv-16", subjectId: "hv-16-l2", expected: false, rationale: "Cancelled as duplicate with documented reason." },
  { ruleId: R2, patientKey: "hv-17", subjectId: "hv-17-l1", expected: false, rationale: "Lab draw rescheduled; appointment in 3 days." },
  { ruleId: R2, patientKey: "hv-18", subjectId: "hv-18-l1", expected: false, rationale: "Resulted." },
  { ruleId: R2, patientKey: "hv-19", subjectId: "hv-19-l1", expected: true, rationale: "Vitamin D never collected, >4 months." },
  { ruleId: R2, patientKey: "hv-19", subjectId: "hv-19-l2", expected: false, rationale: "Resulted." },
  { ruleId: R2, patientKey: "hv-27", subjectId: "hv-27-l1", expected: false, rationale: "Still within expected turnaround + grace (boundary)." },
  { ruleId: R2, patientKey: "og-01", subjectId: "og-01-l1", expected: true, rationale: "Never collected, 45 days." },
  { ruleId: R2, patientKey: "og-03", subjectId: "og-03-l1", expected: false, rationale: "Resulted." },
  { ruleId: R2, patientKey: "og-05", subjectId: "og-05-l1", expected: true, rationale: "Marked resulted, but specimen hemolyzed and redraw required; none ordered." },

  // ---------------------------------------------------------------- R3
  { ruleId: R3, patientKey: "hv-03", subjectId: "hv-03-r1", expected: true, rationale: "Sent 75 days ago; no appointment documented." },
  { ruleId: R3, patientKey: "hv-06", subjectId: "hv-06-r1", expected: false, rationale: "Records received." },
  { ruleId: R3, patientKey: "hv-08", subjectId: "hv-08-r1", expected: true, rationale: "Specialist date passed ~7 weeks ago; no records." },
  { ruleId: R3, patientKey: "hv-09", subjectId: "hv-09-r1", expected: false, rationale: "Records received." },
  { ruleId: R3, patientKey: "hv-14", subjectId: "hv-14-r1", expected: false, rationale: "Care transferred." },
  { ruleId: R3, patientKey: "hv-15", subjectId: "hv-15-r1", expected: false, rationale: "Specialist appointment scheduled in the future." },
  { ruleId: R3, patientKey: "hv-20", subjectId: "hv-20-r1", expected: true, rationale: "Patient reports visit ~6 weeks ago; no consult note." },
  { ruleId: R3, patientKey: "hv-22", subjectId: "hv-22-r1", expected: false, rationale: "Outcome documented in later visit note; status field never updated." },
  { ruleId: R3, patientKey: "hv-26", subjectId: "hv-26-r1", expected: false, rationale: "Declined by patient; documented." },
  { ruleId: R3, patientKey: "hv-30", subjectId: "hv-30-r1", expected: false, rationale: "Records received." },
  { ruleId: R3, patientKey: "og-02", subjectId: "og-02-r1", expected: true, rationale: "Sent 100 days ago; no appointment documented." },
  { ruleId: R3, patientKey: "og-03", subjectId: "og-03-r1", expected: false, rationale: "Records received." },
  { ruleId: R3, patientKey: "og-06", subjectId: "og-06-r1", expected: false, rationale: "Cancelled by patient (the open issue is the symptom — R4)." },

  // ---------------------------------------------------------------- R4
  { ruleId: R4, patientKey: "hv-04", subjectId: "hv-04:cough", expected: true, rationale: "Cough at 3 visits over ~3 months; latest visit documents no plan/work-up/follow-up." },
  { ruleId: R4, patientKey: "hv-05", subjectId: "hv-05:headache", expected: false, rationale: "Documented resolved." },
  { ruleId: R4, patientKey: "hv-06", subjectId: "hv-06:knee_pain", expected: false, rationale: "Documented chronic and managed." },
  { ruleId: R4, patientKey: "hv-12", subjectId: "hv-12:fatigue", aliases: ["hv-12:tiredness"], expected: true, rationale: "Same concept recorded as fatigue then tiredness; no plan." },
  { ruleId: R4, patientKey: "hv-15", subjectId: "hv-15:abdominal_pain", expected: false, rationale: "GI work-up documented and scheduled." },
  { ruleId: R4, patientKey: "hv-21", subjectId: "hv-21:headache", expected: false, rationale: "Improving with documented plan and follow-up." },
  { ruleId: R4, patientKey: "hv-22", subjectId: "hv-22:blurred_vision", expected: false, rationale: "Documented resolved." },
  { ruleId: R4, patientKey: "hv-24", subjectId: "hv-24:dizziness", expected: false, rationale: "Medication review documented; recheck not yet due." },
  { ruleId: R4, patientKey: "hv-25", subjectId: "hv-25:shortness_of_breath", expected: true, rationale: "3 visits, no plan/work-up/follow-up at the last two." },
  { ruleId: R4, patientKey: "hv-28", subjectId: "hv-28:insomnia", expected: false, rationale: "Free-text plan documents counseling, diary, and reassessment." },
  { ruleId: R4, patientKey: "hv-29", subjectId: "hv-29:wheezing", expected: false, rationale: "Documented resolved." },
  { ruleId: R4, patientKey: "hv-30", subjectId: "hv-30:chest_discomfort", expected: false, rationale: "Documented resolved after cardiology." },
  { ruleId: R4, patientKey: "og-06", subjectId: "og-06:rash", expected: true, rationale: "Persists; referral cancelled; no alternative plan." },
];
