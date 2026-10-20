/**
 * Turns one CSV row into a typed lab-order or referral record, or a list of
 * plain-language problems. Pure: no database access (patient lookup and
 * duplicate detection happen in the import service).
 */
import { checkFreeText, describePhiFailure } from "@/lib/validation/phi-guard";
import type { ColumnMapping, ImportKind } from "./fields";

export type LabStatus = "ordered" | "collected" | "resulted" | "cancelled";
export type ReferralStatus = "sent" | "scheduled" | "seen" | "records_received" | "declined" | "cancelled";

interface Common {
  externalRef: string | null;
  mrn: string;
  patientName: string | null;
  expectedWithinDays: number;
}

export interface LabImportRow extends Common {
  kind: "lab_orders";
  testName: string;
  orderedAt: string;
  status: LabStatus;
  collectedAt: string | null;
  resultedAt: string | null;
  resultNote: string | null;
}

export interface ReferralImportRow extends Common {
  kind: "referrals";
  specialty: string;
  reason: string;
  referredAt: string;
  status: ReferralStatus;
  appointmentAt: string | null;
  recordsReceivedAt: string | null;
}

export type ImportRow = LabImportRow | ReferralImportRow;
export type NormalizeResult = { ok: true; value: ImportRow } | { ok: false; errors: string[] };

const LAB_STATUS: Record<string, LabStatus> = {
  ordered: "ordered", pending: "ordered", open: "ordered", sent: "ordered", "not collected": "ordered", "awaiting collection": "ordered",
  collected: "collected", "specimen collected": "collected", "in lab": "collected", received: "collected", "in process": "collected",
  resulted: "resulted", final: "resulted", complete: "resulted", completed: "resulted", "result received": "resulted", reviewed: "resulted",
  cancelled: "cancelled", canceled: "cancelled", discontinued: "cancelled", voided: "cancelled",
};

const REFERRAL_STATUS: Record<string, ReferralStatus> = {
  sent: "sent", referred: "sent", pending: "sent", open: "sent", "awaiting scheduling": "sent", new: "sent",
  scheduled: "scheduled", "appointment scheduled": "scheduled", "appt scheduled": "scheduled", booked: "scheduled",
  seen: "seen", completed: "seen", "visit completed": "seen", attended: "seen",
  "records received": "records_received", "report received": "records_received", "consult note received": "records_received",
  "note received": "records_received", closed: "records_received",
  declined: "declined", "patient declined": "declined", refused: "declined",
  cancelled: "cancelled", canceled: "cancelled", withdrawn: "cancelled",
};

const DEFAULT_EXPECTED_DAYS: Record<ImportKind, number> = { lab_orders: 7, referrals: 30 };

function validDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/** ISO (YYYY-MM-DD, optionally with a time) or US (M/D/YYYY, M/D/YY). Returns a calendar date or null. */
export function parseImportDate(raw: string): string | null {
  const value = raw.trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(value);
  if (match) return validDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(value);
  if (match) {
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    return validDate(year, Number(match[1]), Number(match[2]));
  }
  return null;
}

/** Normalizes a demo MRN to DEMO-12345, or returns null. */
export function normalizeMrn(raw: string): string | null {
  const match = /^demo-?(\d{5})$/i.exec(raw.trim());
  return match ? `DEMO-${match[1]}` : null;
}

export function normalizeRow(kind: ImportKind, headers: string[], values: string[], mapping: ColumnMapping, today: string): NormalizeResult {
  const errors: string[] = [];
  const index = new Map(headers.map((header, position) => [header, position]));
  const get = (key: string): string => {
    const header = mapping[key];
    if (!header) return "";
    const position = index.get(header);
    return position === undefined ? "" : (values[position] ?? "").trim();
  };
  const text = (key: string, label: string, max: number): string | null => {
    const value = get(key);
    if (!value) return null;
    if (value.length > max) { errors.push(`${label} is longer than ${max} characters.`); return null; }
    const check = checkFreeText(value, { maxLength: max });
    if (!check.ok) { errors.push(describePhiFailure(label, check)); return null; }
    return value;
  };
  const date = (key: string, label: string, required: boolean): string | null => {
    const value = get(key);
    if (!value) {
      if (required) errors.push(`${label} is missing.`);
      return null;
    }
    const parsed = parseImportDate(value);
    if (!parsed) { errors.push(`${label} "${value}" isn't a date SymptomWatch recognizes (use YYYY-MM-DD or MM/DD/YYYY).`); return null; }
    if (parsed > today) { errors.push(`${label} ${parsed} is in the future.`); return null; }
    return parsed;
  };

  const rawMrn = get("mrn");
  const mrn = normalizeMrn(rawMrn);
  if (!rawMrn) errors.push("Demo MRN is missing.");
  else if (!mrn) errors.push(`"${rawMrn}" isn't a demo MRN (DEMO-12345). Real record numbers can't be imported into this prototype.`);

  const externalRef = text("externalRef", kind === "lab_orders" ? "Order ID" : "Referral ID", 64);
  const patientName = text("patientName", "Patient name", 120);

  let expectedWithinDays = DEFAULT_EXPECTED_DAYS[kind];
  const rawExpected = get("expectedWithinDays");
  if (rawExpected) {
    const parsed = Number(rawExpected);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 365) errors.push(`Expected days "${rawExpected}" must be a whole number from 0 to 365.`);
    else expectedWithinDays = parsed;
  }

  const rawStatus = get("status");
  const statusKey = rawStatus.toLowerCase().replace(/\s+/g, " ");
  if (!rawStatus) errors.push("Status is missing.");

  if (kind === "lab_orders") {
    const testName = text("testName", "Test", 120);
    if (!get("testName")) errors.push("Test is missing.");
    const orderedAt = date("orderedAt", "Order date", true);
    const collectedAt = date("collectedAt", "Collection date", false);
    const resultedAt = date("resultedAt", "Result date", false);
    const resultNote = text("resultNote", "Result comment", 300);
    const status = LAB_STATUS[statusKey];
    if (rawStatus && !status) errors.push(`Status "${rawStatus}" isn't recognized for lab orders (e.g. Pending, Collected, Final, Cancelled).`);
    if (status === "resulted" && !resultedAt && !get("resultedAt")) errors.push("A resulted lab needs a result date.");
    for (const [label, value] of [["Collection date", collectedAt], ["Result date", resultedAt]] as const) {
      if (value && orderedAt && value < orderedAt) errors.push(`${label} ${value} is before the order date ${orderedAt}.`);
    }
    if (errors.length || !mrn || !testName || !orderedAt || !status) return { ok: false, errors };
    return { ok: true, value: { kind, externalRef, mrn, patientName, testName, orderedAt, status, collectedAt, resultedAt, resultNote, expectedWithinDays } };
  }

  const specialty = text("specialty", "Specialty", 80);
  if (!get("specialty")) errors.push("Specialty is missing.");
  const reason = text("reason", "Reason", 300);
  const referredAt = date("referredAt", "Referral date", true);
  const appointmentAt = parseOptionalAppointment(get("appointmentAt"), errors);
  const recordsReceivedAt = date("recordsReceivedAt", "Records received date", false);
  const status = REFERRAL_STATUS[statusKey];
  if (rawStatus && !status) errors.push(`Status "${rawStatus}" isn't recognized for referrals (e.g. Referred, Scheduled, Seen, Consult Note Received, Declined).`);
  if (status === "records_received" && !recordsReceivedAt && !get("recordsReceivedAt")) errors.push("Referrals marked as records received need the date they arrived.");
  if (recordsReceivedAt && referredAt && recordsReceivedAt < referredAt) errors.push(`Records received date ${recordsReceivedAt} is before the referral date ${referredAt}.`);
  if (errors.length || !mrn || !specialty || !referredAt || !status) return { ok: false, errors };
  return {
    ok: true,
    value: { kind, externalRef, mrn, patientName, specialty, reason: reason ?? "Imported referral", referredAt, status, appointmentAt, recordsReceivedAt, expectedWithinDays },
  };
}

/** Specialist appointments may be in the future, unlike every other imported date. */
function parseOptionalAppointment(raw: string, errors: string[]): string | null {
  if (!raw) return null;
  const parsed = parseImportDate(raw);
  if (!parsed) errors.push(`Specialist appointment date "${raw}" isn't a date SymptomWatch recognizes.`);
  return parsed;
}
