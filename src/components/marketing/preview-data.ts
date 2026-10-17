/**
 * Figures for homepage previews, computed from the fictional demo dataset so
 * the marketing site never shows invented metrics.
 */
import { EVALUATION_REFERENCE_DATE, patients, tasks } from "@/data/synthetic";
import { dateAtOffset } from "@/lib/demo/dates";

const clinic = "harbor-view" as const;
const clinicPatients = patients.filter((patient) => patient.clinic === clinic);
const clinicTasks = tasks.filter((task) => task.clinic === clinic);

export const previewStats = {
  patients: clinicPatients.length,
  openTasks: clinicTasks.filter((task) => task.status !== "completed").length,
  pendingLabs: clinicPatients.flatMap((patient) => patient.labs ?? []).filter((lab) => lab.status === "ordered" || lab.status === "collected").length,
  pendingRecords: clinicPatients
    .flatMap((patient) => patient.referrals ?? [])
    .filter((referral) => ["sent", "scheduled", "seen"].includes(referral.status)).length,
};

/** Dates in previews are anchored to the fixed evaluation reference date. */
export const previewDate = (offset: number) => dateAtOffset(EVALUATION_REFERENCE_DATE, offset);

export function previewPatientName(key: string): string {
  const patient = patients.find((entry) => entry.key === key);
  if (!patient) throw new Error(`Unknown preview patient ${key}`);
  return `${patient.firstName} ${patient.lastName}`;
}

export const previewQueue = clinicTasks
  .filter((task) => task.status !== "completed" && task.patient && task.category !== "clinical_review")
  .slice(0, 4)
  .map((task) => ({
    key: task.key,
    title: task.title,
    patient: previewPatientName(task.patient!),
    category: task.category,
    status: task.status,
    dueDay: task.dueDay,
  }));
