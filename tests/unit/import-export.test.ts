import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/import/csv";
import { buildCorrectionCsv, buildCsv } from "@/lib/import/export";

describe("downloadable CSVs", () => {
  it("round-trips commas, quotes, Unicode, line breaks, and empty fields", () => {
    const rows = [["MRN", "Patient", "Note"], ["DEMO-00001", "Example, Zoë", 'A "fictional"\nresult'], ["DEMO-00002", "", ""]];
    expect(parseCsv(buildCsv(rows))).toEqual({ headers: rows[0], rows: rows.slice(1) });
    expect(buildCsv(rows)).toMatch(/\r\n$/);
  });

  it("exports only skipped records with original columns and all reasons after multiline records", () => {
    const csv = buildCsv([["MRN", "Note"], ["DEMO-00001", "two\nlines"], ["DEMO-00002", 'bad, "status"'], ["DEMO-00003", "unchanged"]]);
    const result = buildCorrectionCsv(csv, [
      { line: 2, action: "create", messages: [] },
      { line: 3, action: "error", messages: ["Invalid status", "Missing date"] },
      { line: 4, action: "unchanged", messages: ["Already current"] },
    ]);
    expect(parseCsv(result)).toEqual({ headers: ["Import row", "Skip reason", "MRN", "Note"], rows: [["3", "Invalid status; Missing date", "DEMO-00002", 'bad, "status"']] });
  });

  it("keeps extra/unmapped cells, pads short rows, and emits a header for no skipped rows", () => {
    const csv = "MRN,Note\nDEMO-00001,bad,extra\nDEMO-00002";
    const results = [{ line: 2, action: "error", messages: ["Bad"] }, { line: 3, action: "error", messages: ["Missing"] }];
    expect(parseCsv(buildCorrectionCsv(csv, results))).toEqual({
      headers: ["Import row", "Skip reason", "MRN", "Note", "Unnamed column 3"],
      rows: [["2", "Bad", "DEMO-00001", "bad", "extra"], ["3", "Missing", "DEMO-00002", "", ""]],
    });
    expect(parseCsv(buildCorrectionCsv(csv, [])).rows).toEqual([]);
  });

  it("neutralizes formula-like cells in the source, headers, and reasons", () => {
    const csv = '=header,Note\n=HYPERLINK("example"),@SUM(1)\n +123,\tformula';
    const result = parseCsv(buildCorrectionCsv(csv, [{ line: 2, action: "error", messages: ["-reason"] }, { line: 3, action: "error", messages: [] }]));
    expect(result.headers[2]).toBe("'=header");
    expect(result.rows[0]).toEqual(["2", "'-reason", '\'=HYPERLINK("example")', "'@SUM(1)"]);
    expect(result.rows[1].slice(2)).toEqual(["' +123", "'\tformula"]);
  });

  it("keeps original column names when the file already has correction metadata columns", () => {
    const report = parseCsv(buildCorrectionCsv("MRN,Import row,Skip reason\nDEMO-00001,old,old reason", [{ line: 2, action: "error", messages: ["New reason"] }]));
    expect(report.headers).toEqual(["Import row (2)", "Skip reason (2)", "MRN", "Import row", "Skip reason"]);
    expect(report.rows[0]).toEqual(["2", "New reason", "DEMO-00001", "old", "old reason"]);
  });
});
