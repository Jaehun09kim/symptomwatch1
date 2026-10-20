import { describe, expect, it } from "vitest";
import { CsvError, parseCsv } from "@/lib/import/csv";
import { guessMapping, IMPORT_FIELDS } from "@/lib/import/fields";
import { normalizeRow, parseImportDate } from "@/lib/import/normalize";

const TODAY = "2026-06-01";

describe("parseCsv", () => {
  it("handles quotes, embedded commas, escaped quotes, newlines in quotes, CRLF, and a BOM", () => {
    const text = "﻿Order #,Comment\r\nA1,\"Low, recheck\"\r\nA2,\"He said \"\"fine\"\"\"\r\nA3,\"two\nlines\"\r\n";
    expect(parseCsv(text)).toEqual({
      headers: ["Order #", "Comment"],
      rows: [["A1", "Low, recheck"], ["A2", 'He said "fine"'], ["A3", "two\nlines"]],
    });
  });

  it("skips blank lines and trims header whitespace", () => {
    expect(parseCsv(" MRN , Test \n\nDEMO-00001,TSH\n\n")).toEqual({ headers: ["MRN", "Test"], rows: [["DEMO-00001", "TSH"]] });
  });

  it("rejects unterminated quotes, duplicate headers, empty files, and oversize input", () => {
    expect(() => parseCsv('a,b\n"open,1')).toThrow(CsvError);
    expect(() => parseCsv("MRN,MRN\nx,y")).toThrow(/duplicate column/i);
    expect(() => parseCsv("")).toThrow(/empty/i);
    expect(() => parseCsv("MRN\n" + "DEMO-00001\n".repeat(1001))).toThrow(/1,000 rows/);
  });
});

describe("guessMapping", () => {
  it("maps common EHR export headers to SymptomWatch fields", () => {
    const mapping = guessMapping("lab_orders", ["Order #", "MRN", "Patient", "Test Description", "Order Date", "Order Status", "Collection Date", "Result Date", "Result Comment"]);
    expect(mapping).toEqual({
      externalRef: "Order #", mrn: "MRN", patientName: "Patient", testName: "Test Description", orderedAt: "Order Date",
      status: "Order Status", collectedAt: "Collection Date", resultedAt: "Result Date", resultNote: "Result Comment", expectedWithinDays: null,
    });
  });

  it("leaves fields unmapped rather than guessing wildly", () => {
    expect(guessMapping("referrals", ["Foo", "Bar"])).toEqual(Object.fromEntries(IMPORT_FIELDS.referrals.map((field) => [field.key, null])));
  });
});

describe("parseImportDate", () => {
  it("accepts ISO and US formats and rejects impossible dates", () => {
    expect(parseImportDate("2026-03-04")).toBe("2026-03-04");
    expect(parseImportDate("3/4/2026")).toBe("2026-03-04");
    expect(parseImportDate("03/04/26")).toBe("2026-03-04");
    expect(parseImportDate("2026-03-04T15:30:00Z")).toBe("2026-03-04");
    expect(parseImportDate("13/45/2026")).toBeNull();
    expect(parseImportDate("2026-02-30")).toBeNull();
    expect(parseImportDate("soon")).toBeNull();
  });
});

describe("normalizeRow", () => {
  const labHeaders = ["Order #", "MRN", "Test", "Ordered", "Status", "Collected", "Resulted", "Comment"];
  const labMapping = guessMapping("lab_orders", labHeaders);
  const lab = (values: string[]) => normalizeRow("lab_orders", labHeaders, values, labMapping, TODAY);

  it("normalizes a lab row with status synonyms and US dates", () => {
    expect(lab(["L-1", "demo-00012", "TSH", "5/1/2026", "Final", "5/2/2026", "5/4/2026", "Within range (fictional)"])).toEqual({
      ok: true,
      value: {
        kind: "lab_orders", externalRef: "L-1", mrn: "DEMO-00012", patientName: null, testName: "TSH", orderedAt: "2026-05-01",
        status: "resulted", collectedAt: "2026-05-02", resultedAt: "2026-05-04", resultNote: "Within range (fictional)", expectedWithinDays: 7,
      },
    });
  });

  it("explains every problem with a row", () => {
    const result = lab(["", "12345", "", "someday", "Lost in space", "", "", ""]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/demo MRN/i),
      expect.stringMatching(/test/i),
      expect.stringMatching(/order date/i),
      expect.stringMatching(/status "Lost in space"/i),
    ]));
  });

  it("requires a result date for resulted labs and rejects future or out-of-order dates", () => {
    expect(lab(["", "DEMO-00012", "TSH", "5/1/2026", "Resulted", "", "", ""])).toMatchObject({ ok: false, errors: [expect.stringMatching(/result date/i)] });
    expect(lab(["", "DEMO-00012", "TSH", "7/1/2026", "Pending", "", "", ""])).toMatchObject({ ok: false, errors: [expect.stringMatching(/future/i)] });
    expect(lab(["", "DEMO-00012", "TSH", "5/10/2026", "Final", "", "5/1/2026", ""])).toMatchObject({ ok: false, errors: [expect.stringMatching(/before the order date/i)] });
  });

  it("blocks likely real identifiers in free text", () => {
    const result = lab(["", "DEMO-00012", "TSH", "5/1/2026", "Final", "", "5/4/2026", "Call 949-555-1234, SSN 123-45-6789"]);
    expect(result).toMatchObject({ ok: false, errors: [expect.stringMatching(/comment/i)] });
  });

  it("normalizes referral rows", () => {
    const headers = ["Referral ID", "MRN", "Specialty", "Reason", "Referred", "Status", "Appt", "Note Received"];
    const mapping = guessMapping("referrals", headers);
    expect(normalizeRow("referrals", headers, ["R-9", "DEMO-00003", "Cardiology", "Palpitations", "2026-04-01", "Consult Note Received", "2026-04-20", "2026-05-02"], mapping, TODAY)).toEqual({
      ok: true,
      value: {
        kind: "referrals", externalRef: "R-9", mrn: "DEMO-00003", patientName: null, specialty: "Cardiology", reason: "Palpitations",
        referredAt: "2026-04-01", status: "records_received", appointmentAt: "2026-04-20", recordsReceivedAt: "2026-05-02", expectedWithinDays: 30,
      },
    });
  });
});
