/**
 * Applies a detection run to stored flags following the lifecycle in
 * PRODUCT_SPEC §6.6. Works on any transaction handle (tenant or system); the
 * caller decides the access path. Must run inside one transaction so a failed
 * run changes nothing.
 */
import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { detectionFlags, detectionRuns, flagEvents } from "@/lib/db/schema";
import type { DbTransaction } from "@/lib/db/types";
import { readRuleSettings } from "./clinic-config";
import { getDetectionProvider } from "./engine";
import { loadPatientSnapshots } from "@/lib/services/snapshots";
import { RULES_VERSION, type Finding, type RuleId } from "./types";

export interface DetectionRunSummary {
  patientsEvaluated: number;
  findings: number;
  created: number;
  reopened: number;
  resolved: number;
  /** Flags parked because their rule is turned off in clinic settings. */
  suppressed: number;
}

export function evidenceHash(finding: Pick<Finding, "evidence" | "missingInfo">): string {
  const parts = [
    ...finding.evidence.map((item) => `${item.kind}:${item.id}`).sort(),
    "|",
    ...finding.missingInfo.map((item) => item.code).sort(),
  ];
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

type FlagRow = typeof detectionFlags.$inferSelect;
const CLEAR_SNOOZE = { snoozedUntil: null, snoozedBy: null, snoozeNote: null };
type EventType = (typeof flagEvents.$inferInsert)["eventType"];

export async function applyDetectionRun(
  tx: DbTransaction,
  input: {
    clinicId: string;
    /** Membership user who triggered the run; null for system jobs (seeding, background refresh). */
    actorUserId: string | null;
    asOf: Date;
    patientIds?: string[];
    externalAiEnabled?: boolean;
    /** Event note for flags that stop matching, e.g. after a settings change. */
    resolvedNote?: string;
  },
): Promise<DetectionRunSummary> {
  const { clinicId, actorUserId } = input;
  // Serialize runs per clinic so concurrent refreshes can't interleave lifecycle transitions.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`detection:${clinicId}`}))`);

  const provider = getDetectionProvider("rules", input.externalAiEnabled ?? false);
  const settings = await readRuleSettings(tx, clinicId);
  const disabled = new Set<RuleId>(settings.disabledRules);
  const snapshots = await loadPatientSnapshots(tx, input.patientIds, { clinicId, clinical: true });
  const findings = await provider.detect(snapshots, { asOf: input.asOf.toISOString(), config: settings.config, disabledRules: settings.disabledRules });
  const evaluatedIds = snapshots.map((snapshot) => snapshot.patientId);

  const existing: FlagRow[] = evaluatedIds.length
    ? await tx.select().from(detectionFlags).where(and(eq(detectionFlags.clinicId, clinicId), inArray(detectionFlags.patientId, evaluatedIds)))
    : [];
  const byFingerprint = new Map(existing.map((flag) => [flag.fingerprint, flag]));
  const seen = new Set<string>();
  const events: Array<{ flagId: string; eventType: EventType; note?: string }> = [];
  const summary: DetectionRunSummary = { patientsEvaluated: snapshots.length, findings: findings.length, created: 0, reopened: 0, resolved: 0, suppressed: 0 };

  for (const found of findings) {
    seen.add(found.fingerprint);
    const hash = evidenceHash(found);
    const detectionFields = {
      ruleVersion: found.ruleVersion,
      title: found.title,
      rationale: found.rationale,
      evidence: found.evidence,
      missingInfo: found.missingInfo,
      evidenceHash: hash,
      lastDetectedAt: sql`now()` as unknown as string,
    };
    const current = byFingerprint.get(found.fingerprint);
    if (!current) {
      const [row] = await tx.insert(detectionFlags).values({
        clinicId,
        patientId: found.patientId,
        ruleId: found.ruleId,
        subjectType: found.subject.type,
        subjectId: found.subject.id,
        fingerprint: found.fingerprint,
        status: "open",
        ...detectionFields,
      }).returning({ id: detectionFlags.id });
      events.push({ flagId: row.id, eventType: "created" });
      summary.created += 1;
      continue;
    }
    const changed = current.evidenceHash !== hash;
    let status = current.status;
    let eventType: EventType | null = changed ? "updated" : null;
    let note: string | undefined;
    if (current.status === "resolved_by_data") {
      status = "open";
      eventType = "reopened";
    } else if (current.status === "suppressed") {
      status = "open";
      eventType = "reopened";
      note = "The rule was turned back on in clinic settings.";
    } else if (current.status === "dismissed" && changed) {
      status = "open";
      eventType = "reopened_evidence_changed";
    }
    if (status !== current.status) summary.reopened += 1;
    // A dismissed flag with unchanged evidence keeps its stored evidence as reviewed.
    if (current.status === "dismissed" && !changed) continue;
    // New documentation wakes a snoozed flag early.
    const wake = changed && current.snoozedUntil !== null;
    await tx.update(detectionFlags).set({ ...detectionFields, status, ...(wake ? CLEAR_SNOOZE : {}) })
      .where(and(eq(detectionFlags.clinicId, clinicId), eq(detectionFlags.id, current.id)));
    if (eventType) events.push({ flagId: current.id, eventType, note });
    if (wake) events.push({ flagId: current.id, eventType: "unsnoozed", note: "The record changed while the flag was snoozed." });
  }

  for (const flag of existing) {
    if (seen.has(flag.fingerprint)) continue;
    const ruleOff = disabled.has(flag.ruleId);
    if (flag.status === "suppressed" ? ruleOff : flag.status !== "open" && flag.status !== "confirmed") continue;
    const next = ruleOff ? "suppressed" : "resolved_by_data";
    await tx.update(detectionFlags).set({ status: next, ...CLEAR_SNOOZE })
      .where(and(eq(detectionFlags.clinicId, clinicId), eq(detectionFlags.id, flag.id)));
    events.push(ruleOff
      ? { flagId: flag.id, eventType: "suppressed", note: "The rule was turned off in clinic settings." }
      : { flagId: flag.id, eventType: "resolved_by_data", note: input.resolvedNote ?? "The rule no longer matches the documented record." });
    if (ruleOff) summary.suppressed += 1;
    else summary.resolved += 1;
  }

  if (events.length) {
    await tx.insert(flagEvents).values(events.map((event) => ({
      clinicId,
      flagId: event.flagId,
      eventType: event.eventType,
      actorUserId,
      note: event.note ?? null,
    })));
  }
  // Patient-scoped refreshes (after a record update) are incremental; only full-clinic runs are logged as runs.
  if (!input.patientIds) await tx.insert(detectionRuns).values({
    clinicId,
    provider: provider.id === "rules" ? "rules" : "llm",
    rulesVersion: RULES_VERSION,
    asOf: input.asOf.toISOString(),
    startedBy: actorUserId,
    patientsEvaluated: summary.patientsEvaluated,
    findingsCount: summary.findings,
  });
  return summary;
}
