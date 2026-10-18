import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppContext } from "@/lib/authz/context";
import { auditLogs, importBatches, labOrders, patients } from "@/lib/db/schema";
import { withSystem } from "@/lib/db/system";
import type { DatabaseHandle } from "@/lib/db/types";
import { guessMapping } from "@/lib/import/fields";
import { parseCsv } from "@/lib/import/csv";
import { listFlags } from "@/lib/services/detection";
import { buildSampleExport, commitImport, listImportBatches, previewImport } from "@/lib/services/imports";
import { contextFor, createSeededDatabase } from "../helpers/seeded";

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

describe("CSV import of EHR exports", () => {
  let db: DatabaseHandle;
  let admin: AppContext;
  let physician: AppContext;
  let staff: AppContext;

  const request = (kind: "lab_orders" | "referrals", csv: string, filename = "export.csv") => ({
    kind, csv, filename, mapping: guessMapping(kind, parseCsv(csv).headers),
  });
  const labCount = () => withSystem(async (tx) => (await tx.select({ id: labOrders.id }).from(labOrders).where(eq(labOrders.clinicId, admin.clinicId))).length, db);
  const patientByMrn = (mrn: string) => withSystem(async (tx) => (await tx.select().from(patients).where(and(eq(patients.clinicId, admin.clinicId), eq(patients.demoMrn, mrn))))[0], db);

  beforeAll(async () => {
    db = await createSeededDatabase();
    admin = await contextFor(db, "hv-admin-shah");
    physician = await contextFor(db, "hv-dr-rivera");
    staff = await contextFor(db, "hv-fd-okafor");
  });
  afterAll(async () => { await db.close(); });

  it("is limited to clinic admins and physicians, and lab imports to physicians", async () => {
    await expect(buildSampleExport(staff, "lab_orders", db)).rejects.toThrow(/permission/i);
    await expect(previewImport(staff, request("referrals", "MRN,Specialty\nDEMO-00001,Cardiology"), db)).rejects.toThrow(/permission/i);
    await expect(buildSampleExport(admin, "lab_orders", db)).rejects.toThrow(/Only physicians can import lab orders/);
    await expect(previewImport(admin, request("lab_orders", "MRN,Test\nDEMO-00001,TSH"), db)).rejects.toThrow(/Only physicians/);
    await expect(buildSampleExport(admin, "referrals", db)).resolves.toMatchObject({ filename: expect.stringMatching(/referrals/) });
  });

  it("explains unmapped required columns instead of guessing", async () => {
    await expect(previewImport(physician, request("lab_orders", "MRN,Test\nDEMO-00001,TSH"), db)).rejects.toThrow(/Order date.*Status/);
  });

  it("previews a clinic's sample lab export without writing anything", async () => {
    const before = await labCount();
    const { csv, filename } = await buildSampleExport(physician, "lab_orders", db);
    expect(filename).toMatch(/lab-orders.*\.csv$/);
    const preview = await previewImport(physician, request("lab_orders", csv, filename), db);
    expect(preview.counts.update).toBeGreaterThan(0);
    expect(preview.counts.create).toBe(2);
    expect(preview.counts.unchanged).toBeGreaterThan(0);
    expect(preview.counts.error).toBe(3);
    const errors = preview.rows.filter((row) => row.action === "error").flatMap((row) => row.messages).join(" ");
    expect(errors).toMatch(/No patient with DEMO-99999/);
    expect(errors).toMatch(/isn't a date/);
    expect(errors).toMatch(/doesn't match/i);
    expect(await labCount()).toBe(before);
  });

  it("imports the sample export: resolves gaps it documents, raises new ones, records the batch, and audits", async () => {
    const openBefore = (await listFlags(physician, { ruleId: "lab-result-missing" }, db)).length;
    const before = await labCount();
    const { csv, filename } = await buildSampleExport(physician, "lab_orders", db);
    const result = await commitImport(physician, request("lab_orders", csv, filename), db);

    expect(result.counts.create).toBe(2);
    expect(await labCount()).toBe(before + 2);
    expect(result.flags.resolved).toBeGreaterThan(0);
    expect(result.flags.created).toBeGreaterThanOrEqual(1); // the 40-day-old TSH with no result
    const openAfter = (await listFlags(physician, { ruleId: "lab-result-missing" }, db)).length;
    expect(openAfter).toBe(openBefore - result.flags.resolved + result.flags.created);

    const [batch] = await listImportBatches(physician, db);
    expect(batch).toMatchObject({ id: result.batchId, kind: "lab_orders", filename, createdCount: 2, errorCount: 3 });
    const audit = await withSystem((tx) => tx.select().from(auditLogs).where(and(eq(auditLogs.action, "records.imported"), eq(auditLogs.entityId, result.batchId))), db);
    expect(audit).toHaveLength(1);
    const imported = await withSystem((tx) => tx.select().from(labOrders).where(eq(labOrders.importBatchId, result.batchId)), db);
    expect(imported.every((row) => row.externalRef?.startsWith("LAB-"))).toBe(true);
  });

  it("is idempotent: importing the same file again changes nothing", async () => {
    const { csv } = await buildSampleExport(physician, "lab_orders", db);
    const first = await commitImport(physician, request("lab_orders", csv), db);
    const again = await commitImport(physician, request("lab_orders", csv), db);
    expect(again.counts).toMatchObject({ create: 0, update: 0 });
    expect(again.counts.unchanged).toBe(first.counts.create + first.counts.update + first.counts.unchanged);
  });

  it("never moves a status backwards and flags wrong-patient and cross-clinic rows", async () => {
    const patient = await patientByMrn("DEMO-00001");
    const header = "Order #,MRN,Patient,Test,Order Date,Status,Result Date";
    await commitImport(physician, request("lab_orders", `${header}\nX-1,DEMO-00001,"${patient.lastName}, ${patient.firstName}",Ferritin,${daysAgo(10)},Final,${daysAgo(2)}`), db);
    const preview = await previewImport(physician, request("lab_orders", [
      header,
      `X-1,DEMO-00001,"${patient.lastName}, ${patient.firstName}",Ferritin,${daysAgo(10)},Pending,`,
      `X-2,DEMO-00001,"Somebody, Else",Ferritin,${daysAgo(10)},Pending,`,
      `X-3,DEMO-00031,"Any, Body",CBC,${daysAgo(3)},Pending,`,
      `X-1,DEMO-00001,"${patient.lastName}, ${patient.firstName}",Ferritin,${daysAgo(10)},Final,${daysAgo(2)}`,
    ].join("\n")), db);
    expect(preview.rows.map((row) => row.action)).toEqual(["unchanged", "error", "error", "error"]);
    expect(preview.rows[0].messages.join(" ")).toMatch(/backwards|already/i);
    expect(preview.rows[1].messages.join(" ")).toMatch(/doesn't match/i);
    expect(preview.rows[2].messages.join(" ")).toMatch(/No patient with DEMO-00031/); // only this clinic's patients are ever matched
    expect(preview.rows[3].messages.join(" ")).toMatch(/same order as row 2/i);
  });

  it("imports referrals and closes referral gaps when consult notes arrive", async () => {
    const before = (await listFlags(physician, { ruleId: "referral-outcome-missing" }, db)).length;
    const { csv } = await buildSampleExport(admin, "referrals", db);
    const result = await commitImport(admin, request("referrals", csv), db);
    expect(result.counts.update).toBeGreaterThan(0);
    expect(result.flags.resolved).toBeGreaterThan(0);
    expect((await listFlags(physician, { ruleId: "referral-outcome-missing" }, db)).length).toBe(before - result.flags.resolved + result.flags.created);
  });

  it("rejects future dates and keeps batches invisible to front-desk staff", async () => {
    const preview = await previewImport(physician, request("lab_orders", `MRN,Test,Order Date,Status\nDEMO-00001,TSH,${today().slice(0, 4)}-12-31,Pending`), db);
    if (today() < `${today().slice(0, 4)}-12-31`) expect(preview.rows[0].messages.join(" ")).toMatch(/future/);
    await expect(listImportBatches(staff, db)).rejects.toThrow();
    const batches = await withSystem((tx) => tx.select().from(importBatches).where(eq(importBatches.clinicId, admin.clinicId)), db);
    expect(batches.length).toBeGreaterThanOrEqual(3);
  });
});
