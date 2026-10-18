/**
 * Minimal RFC 4180 CSV parser for EHR report exports: quoted fields, escaped
 * quotes, embedded commas and newlines, CRLF, and a UTF-8 BOM. Pure; runs in
 * the browser (column mapping) and on the server (validation and import).
 */
export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_BYTES = 512 * 1024;

export class CsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvError";
  }
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export function parseCsv(text: string): ParsedCsv {
  if (text.length > MAX_IMPORT_BYTES) throw new CsvError("The file is larger than 512 KB. Export a shorter date range.");
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let line = 1;
  let quoteLine = 0;

  const endRecord = () => {
    record.push(field);
    field = "";
    if (record.some((value) => value.trim() !== "")) records.push(record);
    record = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') { field += '"'; index += 1; }
        else quoted = false;
      } else {
        if (char === "\n") line += 1;
        field += char;
      }
    } else if (char === '"' && field === "") {
      quoted = true;
      quoteLine = line;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      line += 1;
      endRecord();
    } else {
      field += char;
    }
  }
  if (quoted) throw new CsvError(`A quoted value starting on line ${quoteLine} is never closed.`);
  if (field !== "" || record.length) endRecord();

  if (!records.length) throw new CsvError("The file is empty.");
  const headers = records[0].map((header) => header.trim());
  const seen = new Set<string>();
  for (const header of headers) {
    const key = header.toLowerCase();
    if (!key) continue;
    if (seen.has(key)) throw new CsvError(`The file has a duplicate column named "${header}".`);
    seen.add(key);
  }
  const rows = records.slice(1);
  if (rows.length > MAX_IMPORT_ROWS) throw new CsvError(`The file has ${rows.length.toLocaleString("en-US")} rows; the limit is 1,000 rows per import.`);
  return { headers, rows };
}
