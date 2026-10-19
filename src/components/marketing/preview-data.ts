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
  // Same definition as the dashboard's "Open records requests".
  openRecordRequests: clinicTasks.filter((task) => task.category === "request_records" && task.status !== "completed").length,
};
/** Dates in previews are anchored to the fixed evaluation reference date. */
export const previewDate = (offset: number) => dateAtOffset(EVALUATION_REFERENCE_DATE, offset);

export function previewPatientName(key: string): string {
  const patient = patients.find((entry) => entry.key === key);
  if (!patient) throw new Error(`Unknown preview patient ${key}`);
  return `${patient.firstName} ${patient.lastName}`;
}

/** Same numbering the demo seed uses: patients sorted by key, DEMO-00001 upward. */
export function previewMrn(key: string): string {
  const index = [...clinicPatients].sort((a, b) => a.key.localeCompare(b.key)).findIndex((patient) => patient.key === key);
  if (index < 0) throw new Error(`Unknown preview patient ${key}`);
  return `DEMO-${String(index + 1).padStart(5, "0")}`;
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
