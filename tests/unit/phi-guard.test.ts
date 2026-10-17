import { describe, expect, it } from "vitest";
import { checkFreeText } from "@/lib/validation/phi-guard";

const codes = (text: string, options?: Parameters<typeof checkFreeText>[1]) => {
  const result = checkFreeText(text, options);
  return result.ok ? [] : result.reasons.map((reason) => reason.code);
};

describe("PHI tripwire", () => {
  it.each([
    "Follow up in 2 weeks for blood pressure recheck.",
    "Called (714) 555-0101 and left a voicemail (simulated).",
    "Patient DEMO-00012 rescheduled to next Tuesday.",
    "Lab turnaround is 7 days; BP 128/82 on 2026-06-01.",
    "Requested records from the cardiology office.",
    "",
  ])("accepts ordinary demo text: %s", (text) => {
    expect(codes(text)).toEqual([]);
  });

  it.each([
    ["SSN 123-45-6789", "ssn"],
    ["ssn 123456789 on file", "ssn"],
    ["Call her at (714) 832-4471", "phone"],
    ["cell 949.555.2210", "phone"],
    ["+1 310 555 0199 is fictional but 310-867-5309 is not", "phone"],
    ["email jane.doe@gmail.com", "email"],
    ["MRN: 00483921", "mrn"],
    ["medical record number 7781-22", "mrn"],
    ["DOB 04/12/1961", "dob"],
    ["date of birth: March 3, 1975", "dob"],
  ])("rejects %s", (text, code) => {
    expect(codes(text)).toContain(code);
  });

  it("allows emails only when the field opts in", () => {
    expect(codes("contact@clinic.example", { allowEmail: true })).toEqual([]);
  });

  it("rejects pasted documents over the length limit", () => {
    expect(codes("a".repeat(1501))).toContain("too_long");
    expect(codes("a".repeat(1500))).toEqual([]);
  });

  it("does not treat the clinic's own DEMO MRN format as an outside MRN", () => {
    expect(codes("MRN DEMO-00031")).toEqual([]);
  });
});
