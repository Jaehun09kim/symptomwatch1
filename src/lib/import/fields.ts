/** What each import kind needs, and the header names EHR exports commonly use for it. */
export type ImportKind = "lab_orders" | "referrals";

export interface ImportField {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
  /** Lower-case header names that map to this field without asking. */
  synonyms: string[];
}

const shared = {
  externalRef: (label: string, synonyms: string[]): ImportField => ({
    key: "externalRef", label, required: false, hint: "Lets a later import of the same export update rows instead of duplicating them.", synonyms,
  }),
  mrn: { key: "mrn", label: "Demo MRN", required: true, hint: "DEMO-12345 format. Real record numbers are refused.", synonyms: ["mrn", "demo mrn", "patient mrn", "medical record number", "mrn #", "chart #", "patient id"] },
  patientName: { key: "patientName", label: "Patient name (check only)", required: false, hint: "Used only to catch wrong-patient rows; never stored.", synonyms: ["patient", "patient name", "name", "pt name"] },
} satisfies Record<string, ImportField | ((label: string, synonyms: string[]) => ImportField)>;

export const IMPORT_FIELDS: Record<ImportKind, ImportField[]> = {
  lab_orders: [
    shared.externalRef("Order ID", ["order #", "order id", "order number", "accession", "accession #", "requisition #"]),
    shared.mrn,
    shared.patientName,
    { key: "testName", label: "Test", required: true, synonyms: ["test", "test name", "test description", "order description", "lab test", "procedure"] },
    { key: "orderedAt", label: "Order date", required: true, synonyms: ["order date", "ordered", "ordered on", "date ordered", "ordered date"] },
    { key: "status", label: "Status", required: true, synonyms: ["status", "order status", "result status"] },
    { key: "collectedAt", label: "Collection date", required: false, synonyms: ["collection date", "collected", "collected on", "specimen collected", "draw date"] },
    { key: "resultedAt", label: "Result date", required: false, synonyms: ["result date", "resulted", "resulted on", "date resulted", "final date"] },
    { key: "resultNote", label: "Result comment", required: false, hint: "Fictional text only.", synonyms: ["result comment", "comment", "result note", "notes", "result summary"] },
    { key: "expectedWithinDays", label: "Expected turnaround (days)", required: false, hint: "Defaults to 7 days.", synonyms: ["turnaround", "expected days", "tat", "expected within"] },
  ],
  referrals: [
    shared.externalRef("Referral ID", ["referral id", "referral #", "referral number", "auth #"]),
    shared.mrn,
    shared.patientName,
    { key: "specialty", label: "Specialty", required: true, synonyms: ["specialty", "referred to specialty", "department", "service"] },
    { key: "reason", label: "Reason", required: false, hint: "Fictional text only.", synonyms: ["reason", "referral reason", "reason for referral", "diagnosis"] },
    { key: "referredAt", label: "Referral date", required: true, synonyms: ["referral date", "referred", "referred on", "date referred", "date sent"] },
    { key: "status", label: "Status", required: true, synonyms: ["status", "referral status"] },
    { key: "appointmentAt", label: "Specialist appointment date", required: false, synonyms: ["appointment date", "appt", "appt date", "specialist appointment", "scheduled date"] },
    { key: "recordsReceivedAt", label: "Records received date", required: false, synonyms: ["records received", "note received", "consult note received", "report received", "records received date"] },
    { key: "expectedWithinDays", label: "Expected wait (days)", required: false, hint: "Defaults to 30 days.", synonyms: ["expected days", "expected within", "target days"] },
  ],
};

export type ColumnMapping = Record<string, string | null>;

/** Exact (case-insensitive) synonym matches only; anything else stays unmapped for the user to choose. */
export function guessMapping(kind: ImportKind, headers: string[]): ColumnMapping {
  const byLower = new Map(headers.map((header) => [header.trim().toLowerCase(), header]));
  const used = new Set<string>();
  const mapping: ColumnMapping = {};
  for (const field of IMPORT_FIELDS[kind]) {
    const match = field.synonyms.map((synonym) => byLower.get(synonym)).find((header) => header && !used.has(header));
    mapping[field.key] = match ?? null;
    if (match) used.add(match);
  }
  return mapping;
}

export const importKindLabel: Record<ImportKind, string> = { lab_orders: "Lab orders", referrals: "Referrals" };
