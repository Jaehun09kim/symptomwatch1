/**
 * Evaluation core: runs the real rule engine over the synthetic dataset at
 * the fixed reference date and scores it against pre-declared reference units.
 */
import { EVALUATION_REFERENCE_DATE, patients, type SyntheticPatient } from "../src/data/synthetic";
import { runRules } from "../src/lib/detection/engine";
import { buildSnapshotsFromSynthetic } from "../src/lib/detection/snapshot-from-synthetic";
import { DEFAULT_RULE_CONFIG, RULES_VERSION, type Finding, type RuleId } from "../src/lib/detection/types";
import { LABEL_SET_VERSION, referenceUnits, type ReferenceUnit } from "./reference-labels";

export const RULE_IDS: RuleId[] = ["overdue-follow-up", "lab-result-missing", "referral-outcome-missing", "persistent-symptom-unresolved"];

export interface Counts {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

export interface Metrics extends Counts {
  units: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  falsePositiveRate: number | null;
}

export interface ScoredUnit {
  ruleId: RuleId;
  patientKey: string;
  subjectId: string;
  expected: boolean;
  predicted: boolean;
  outcome: "TP" | "FP" | "FN" | "TN";
  listed: boolean;
  rationale: string;
}

export interface EvaluationResult {
  generatedAt: string;
  asOf: string;
  rulesVersion: string;
  labelSetVersion: string;
  config: typeof DEFAULT_RULE_CONFIG;
  dataset: { patients: number; clinics: number; units: number; positiveUnits: number };
  overall: Metrics;
  perRule: Record<RuleId, Metrics>;
  patientLevel: Metrics;
  units: ScoredUnit[];
  predictions: Array<Pick<Finding, "ruleId" | "patientId" | "fingerprint" | "title"> & { subjectId: string }>;
  unlistedPredictions: string[];
}

const ratio = (numerator: number, denominator: number) => (denominator === 0 ? null : numerator / denominator);

export function metricsFrom(counts: Counts): Metrics {
  const precision = ratio(counts.tp, counts.tp + counts.fp);
  const recall = ratio(counts.tp, counts.tp + counts.fn);
  const f1 = precision === null || recall === null ? null : precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return {
    ...counts,
    units: counts.tp + counts.fp + counts.fn + counts.tn,
    precision,
    recall,
    f1,
    falsePositiveRate: ratio(counts.fp, counts.fp + counts.tn),
  };
}

function outcome(expected: boolean, predicted: boolean): ScoredUnit["outcome"] {
  if (expected && predicted) return "TP";
  if (!expected && predicted) return "FP";
  if (expected && !predicted) return "FN";
  return "TN";
}

const tally = (units: ScoredUnit[]): Counts => ({
  tp: units.filter((unit) => unit.outcome === "TP").length,
  fp: units.filter((unit) => unit.outcome === "FP").length,
  fn: units.filter((unit) => unit.outcome === "FN").length,
  tn: units.filter((unit) => unit.outcome === "TN").length,
});

export function evaluate(options: {
  dataset?: SyntheticPatient[];
  units?: ReferenceUnit[];
  referenceDate?: string;
  now?: Date;
} = {}): EvaluationResult {
  const dataset = options.dataset ?? patients;
  const units = options.units ?? referenceUnits;
  const referenceDate = options.referenceDate ?? EVALUATION_REFERENCE_DATE;
  // Seeded events sit at 16:00Z; evaluate at midday on the reference date.
  const asOf = `${referenceDate}T12:00:00.000Z`;
  const snapshots = buildSnapshotsFromSynthetic(dataset, referenceDate);
  const findings = runRules(snapshots, { asOf, config: DEFAULT_RULE_CONFIG });

  const predictedKeys = new Set(findings.map((finding) => `${finding.ruleId}|${finding.subject.id}`));
  const matchedPredictions = new Set<string>();
  const scored: ScoredUnit[] = units.map((unit) => {
    const ids = [unit.subjectId, ...(unit.aliases ?? [])];
    const hit = ids.map((id) => `${unit.ruleId}|${id}`).filter((key) => predictedKeys.has(key));
    hit.forEach((key) => matchedPredictions.add(key));
    const predicted = hit.length > 0;
    return {
      ruleId: unit.ruleId,
      patientKey: unit.patientKey,
      subjectId: unit.subjectId,
      expected: unit.expected,
      predicted,
      outcome: outcome(unit.expected, predicted),
      listed: true,
      rationale: unit.rationale,
    };
  });

  // Findings that match no declared unit are false positives on a unit nobody anticipated.
  const unlisted = findings.filter((finding) => !matchedPredictions.has(`${finding.ruleId}|${finding.subject.id}`));
  for (const finding of unlisted) {
    scored.push({
      ruleId: finding.ruleId,
      patientKey: finding.patientId,
      subjectId: finding.subject.id,
      expected: false,
      predicted: true,
      outcome: "FP",
      listed: false,
      rationale: "Unlisted prediction (no reference unit declared).",
    });
  }

  const perRule = Object.fromEntries(
    RULE_IDS.map((ruleId) => [ruleId, metricsFrom(tally(scored.filter((unit) => unit.ruleId === ruleId)))]),
  ) as Record<RuleId, Metrics>;

  const patientKeys = dataset.map((patient) => patient.key);
  const patientCounts: Counts = { tp: 0, fp: 0, fn: 0, tn: 0 };
  for (const key of patientKeys) {
    const expected = units.some((unit) => unit.patientKey === key && unit.expected);
    const predicted = findings.some((finding) => finding.patientId === key);
    const result = outcome(expected, predicted);
    patientCounts[result.toLowerCase() as keyof Counts] += 1;
  }

  return {
    generatedAt: (options.now ?? new Date()).toISOString(),
    asOf,
    rulesVersion: RULES_VERSION,
    labelSetVersion: LABEL_SET_VERSION,
    config: DEFAULT_RULE_CONFIG,
    dataset: {
      patients: dataset.length,
      clinics: new Set(dataset.map((patient) => patient.clinic)).size,
      units: units.length,
      positiveUnits: units.filter((unit) => unit.expected).length,
    },
    overall: metricsFrom(tally(scored)),
    perRule,
    patientLevel: metricsFrom(patientCounts),
    units: scored,
    predictions: findings.map((finding) => ({
      ruleId: finding.ruleId,
      patientId: finding.patientId,
      subjectId: finding.subject.id,
      fingerprint: finding.fingerprint,
      title: finding.title,
    })),
    unlistedPredictions: unlisted.map((finding) => finding.fingerprint),
  };
}
