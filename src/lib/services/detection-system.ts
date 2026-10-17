/**
 * System-path detection refresh. Detection is a clinic-level system process:
 * when front-desk staff close a loop (e.g. specialist records received), the
 * affected patient's flags must update even though staff cannot read flags.
 * On the ARCHITECTURE §14.2 allowlist; never returns flag content to callers.
 */
import { withSystem } from "@/lib/db/system";
import type { DatabaseHandle, DbTransaction } from "@/lib/db/types";
import { applyDetectionRun } from "@/lib/detection/persistence";
import { getEnv } from "@/lib/env";

export async function refreshPatientFlags(
  input: { clinicId: string; patientId: string; actorUserId: string },
  database?: DatabaseHandle,
): Promise<void> {
  await withSystem(async (tx) => {
    await applyDetectionRun(tx, {
      clinicId: input.clinicId,
      actorUserId: input.actorUserId,
      asOf: new Date(),
      patientIds: [input.patientId],
      externalAiEnabled: getEnv().EXTERNAL_AI_ENABLED,
    });
  }, database);
}

/** Full-clinic run inside an existing system transaction (seed / demo reset). */
export async function detectForClinic(tx: DbTransaction, clinicId: string, asOf = new Date()): Promise<void> {
  await applyDetectionRun(tx, { clinicId, actorUserId: null, asOf, externalAiEnabled: getEnv().EXTERNAL_AI_ENABLED });
}
