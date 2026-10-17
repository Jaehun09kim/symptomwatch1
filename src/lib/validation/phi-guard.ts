/**
 * PHI tripwire for free-text inputs.
 *
 * This is a guard rail, not a de-identification tool: it catches the most
 * common ways real identifiers get pasted into a demo (SSNs, real phone
 * numbers, emails, outside MRNs, dates of birth, whole pasted notes) and
 * explains that real patient information is prohibited. It cannot prove text
 * is free of PHI.
 */

export type PhiReasonCode = "ssn" | "phone" | "email" | "mrn" | "dob" | "too_long";

export interface PhiReason {
  code: PhiReasonCode;
  message: string;
}

export type PhiCheckResult = { ok: true } | { ok: false; reasons: PhiReason[] };

export interface PhiCheckOptions {
  /** Allow email addresses (e.g. a dedicated work-email field). */
  allowEmail?: boolean;
  maxLength?: number;
}

export const PHI_MAX_FREE_TEXT = 1500;

const SSN = /\b\d{3}[- ]\d{2}[- ]\d{4}\b|\b\d{9}\b/;
const PHONE = /(?:\+?1[\s.-]?)?(?:\((\d{3})\)|\b(\d{3}))[\s.-]?(\d{3})[\s.-]?(\d{4})\b/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const MRN = /\b(?:MRN|medical\s+record(?:\s+(?:no|number|#))?|chart\s+(?:no|number|#)|patient\s+id)\b\s*[:#]?\s*(?!DEMO-\d{5}\b)[A-Z0-9][A-Z0-9-]{3,}/i;
const DOB = /\b(?:DOB|D\.O\.B\.|date\s+of\s+birth|born(?:\s+on)?)\b\s*[:]?\s*(?:\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2}|[A-Z][a-z]+\.?\s+\d{1,2},?\s+\d{4})/i;

const MESSAGES: Record<PhiReasonCode, string> = {
  ssn: "Looks like a Social Security number.",
  phone: "Contains a phone number outside the fictional 555-01xx range.",
  email: "Contains an email address.",
  mrn: "Looks like a medical record number from another system.",
  dob: "Looks like a date of birth.",
  too_long: "Is longer than a demo note should be — please don't paste clinical documents.",
};

function hasRealPhone(text: string): boolean {
  for (const match of text.matchAll(PHONE)) {
    const exchange = match[3];
    const line = match[4];
    if (!(exchange === "555" && line.startsWith("01"))) return true;
  }
  return false;
}

export function checkFreeText(text: string, options: PhiCheckOptions = {}): PhiCheckResult {
  const reasons: PhiReasonCode[] = [];
  const maxLength = options.maxLength ?? PHI_MAX_FREE_TEXT;
  if (text.length > maxLength) reasons.push("too_long");
  if (SSN.test(text)) reasons.push("ssn");
  if (hasRealPhone(text)) reasons.push("phone");
  if (!options.allowEmail && EMAIL.test(text)) reasons.push("email");
  if (MRN.test(text)) reasons.push("mrn");
  if (DOB.test(text)) reasons.push("dob");
  return reasons.length === 0
    ? { ok: true }
    : { ok: false, reasons: reasons.map((code) => ({ code, message: MESSAGES[code] })) };
}

export const PHI_REJECTION_NOTICE =
  "SymptomWatch is a demo with fictional data only. Please remove anything that could be real patient information.";

/** Formats a failed check for a form error message. */
export function describePhiFailure(field: string, result: Extract<PhiCheckResult, { ok: false }>): string {
  return `${field}: ${result.reasons.map((reason) => reason.message).join(" ")} ${PHI_REJECTION_NOTICE}`;
}
