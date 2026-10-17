import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/lib/db/types";
import { submitDemoRequest } from "@/lib/services/public-demo-requests";
import { createTestDatabase } from "../helpers/db";

const valid = {
  name: "Avery Clinician",
  email: "avery@clinic.example",
  clinicName: "Sample Family Practice",
  role: "Practice manager",
  clinicSize: "2–3 physicians",
  message: "We track referrals on a whiteboard today.",
  noPatientInfo: true,
};

describe("demo request submission", () => {
  let db: DatabaseHandle;
  beforeAll(async () => { db = await createTestDatabase(); });
  afterAll(async () => { await db.close(); });

  it("stores a valid request", async () => {
    expect(await submitDemoRequest(valid, db)).toEqual({ ok: true });
    expect(await db.query("select clinic_name, clinic_size from demo_requests")).toEqual([
      { clinic_name: "Sample Family Practice", clinic_size: "2–3 physicians" },
    ]);
  });

  it("rejects missing consent and invalid fields without storing", async () => {
    const result = await submitDemoRequest({ ...valid, email: "nope", noPatientInfo: false }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fieldErrors).sort()).toEqual(["email", "noPatientInfo"]);
    expect(await db.query("select count(*)::int as n from demo_requests")).toEqual([{ n: 1 }]);
  });

  it("rejects messages that look like patient information", async () => {
    const result = await submitDemoRequest({ ...valid, message: "Patient DOB 01/02/1960, MRN: 5566778" }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.message).toMatch(/fictional data only/);
  });
});
