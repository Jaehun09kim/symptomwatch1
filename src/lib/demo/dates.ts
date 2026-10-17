import type { DayOffset } from "@/data/synthetic/types";

export type ReferenceDate = string | Date;

/** Anchor relative scenarios to UTC calendar days, independent of server timezone. */
export function dateAtOffset(referenceDate: ReferenceDate, offset: DayOffset): string {
  const reference = new Date(referenceDate);
  if (Number.isNaN(reference.getTime()) || !Number.isSafeInteger(offset)) {
    throw new Error("Synthetic dates require a valid reference date and an integer day offset");
  }
  reference.setUTCHours(16, 0, 0, 0);
  reference.setUTCDate(reference.getUTCDate() + offset);
  return reference.toISOString();
}

export function optionalDateAtOffset(
  referenceDate: ReferenceDate,
  offset: DayOffset | undefined,
): string | null {
  return offset === undefined ? null : dateAtOffset(referenceDate, offset);
}

/** Symptoms have no authored key; their encounter and position identify the seed row. */
export function symptomSeedKey(encounterKey: string, index: number): string {
  return `${encounterKey}:symptom:${index + 1}`;
}
