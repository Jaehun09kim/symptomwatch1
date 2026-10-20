/**
 * Real detection output for the public site: the v1 rules run over the
 * fictional Harbor View dataset at the evaluation reference date, the same way
 * evaluation/evaluate.ts runs them. Nothing here is hand-written.
 */
import { EVALUATION_REFERENCE_DATE, patients } from "@/data/synthetic";
import { runRules } from "@/lib/detection/engine";
import { buildSnapshotsFromSynthetic } from "@/lib/detection/snapshot-from-synthetic";
import { DEFAULT_RULE_CONFIG, type RuleId } from "@/lib/detection/types";
import { previewPatientName } from "./preview-data";

const clinicPatients = patients.filter((patient) => patient.clinic === "harbor-view");
// Seeded events sit at 16:00Z; evaluate at midday on the reference date (as the evaluation does).
const asOf = `${EVALUATION_REFERENCE_DATE}T12:00:00.000Z`;

export interface SampleFlag {
  key: string;
  patientKey: string;
  patient: string;
  ruleId: RuleId;
  title: string;
}

export const sampleFlags: SampleFlag[] = runRules(buildSnapshotsFromSynthetic(clinicPatients, EVALUATION_REFERENCE_DATE), {
  asOf,
  config: DEFAULT_RULE_CONFIG,
}).map((finding) => ({
  key: finding.fingerprint,
  patientKey: finding.patientId,
  patient: previewPatientName(finding.patientId),
  ruleId: finding.ruleId,
  title: finding.title,
}));

/** The first real flag each rule produced, used as a worked example. */
export function exampleFlag(ruleId: RuleId): SampleFlag | undefined {
  return sampleFlags.find((flag) => flag.ruleId === ruleId);
}
