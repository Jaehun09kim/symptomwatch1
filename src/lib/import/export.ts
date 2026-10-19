import { parseCsv } from "./csv";

/** Quote CSV fields and keep spreadsheet programs from executing uploaded text. */
export function buildCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map((value) => {
    const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(value) ? `'${value}` : value;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  }).join(",")).join("\r\n") + "\r\n";
}

/** Result row numbers use parsed records (header = 1), including multiline cells. */
export function buildCorrectionCsv(csv: string, results: readonly { line: number; action: string; messages: string[] }[]): string {
  const source = parseCsv(csv);
  // Keep even extra, unmapped cells so the report does not silently lose input.
  const width = Math.max(source.headers.length, ...source.rows.map((row) => row.length));
  const used = new Set(source.headers.filter(Boolean).map((header) => header.toLowerCase()));
  const unique = (label: string) => {
    let header = label;
    for (let suffix = 2; used.has(header.toLowerCase()); suffix += 1) header = `${label} (${suffix})`;
    used.add(header.toLowerCase());
    return header;
  };
  const headers = Array.from({ length: width }, (_, index) => source.headers[index] || unique(`Unnamed column ${index + 1}`));
  const rows = results.filter((row) => row.action === "error").map((row) => [
    String(row.line),
    row.messages.join("; "),
    ...Array.from({ length: width }, (_, index) => source.rows[row.line - 2]?.[index] ?? ""),
  ]);
  return buildCsv([[unique("Import row"), unique("Skip reason"), ...headers], ...rows]);
}
