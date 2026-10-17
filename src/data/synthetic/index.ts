/**
 * Entry point for the fictional demo dataset. ALL DATA IS SYNTHETIC.
 */
import { clinics, staff } from "./clinics";
import { harborViewPatients } from "./patients-harbor-view";
import { orangeGrovePatients } from "./patients-orange-grove";
import { tasks } from "./tasks";
import type { SyntheticPatient } from "./types";

export * from "./types";
export { clinics, staff, tasks };

export const patients: SyntheticPatient[] = [...harborViewPatients, ...orangeGrovePatients];

/** Fixed reference date used by the evaluator so results are reproducible. */
export const EVALUATION_REFERENCE_DATE = "2026-06-01";

export const SYNTHETIC_DATA_NOTICE =
  "All patients, staff, clinics, and clinical details in this dataset are fictional and generated for demonstration only.";
