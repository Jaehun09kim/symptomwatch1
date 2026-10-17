/**
 * Exercises the hosted code path (postgres.js over the Postgres wire protocol)
 * without Docker: PGlite is served on a local TCP socket. Covers migrations,
 * the sw_app role switch, RLS, seeding, services, and detection.
 */
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { withSystem } from "@/lib/db/system";
import { withTenant } from "@/lib/db/tenant";
import type { DatabaseHandle } from "@/lib/db/types";
import { listFlags, runDetectionForClinic } from "@/lib/services/detection";
import { seedSharedDemo } from "@/lib/services/demo-seed";
import { listPatients } from "@/lib/services/patients";
import { contextFor } from "../helpers/seeded";

describe("postgres driver (wire protocol)", () => {
  let pglite: PGlite;
  let server: PGLiteSocketServer;
  let db: DatabaseHandle;

  beforeAll(async () => {
    pglite = await PGlite.create({ extensions: { citext } });
    server = new PGLiteSocketServer({ db: pglite, port: 0, host: "127.0.0.1" });
    await server.start();
    const port = Number(server.getServerConn().split(":").at(-1));
    db = await createDatabase({ driver: "postgres", databaseUrl: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable` });
    await migrate(db);
    await withSystem((tx) => seedSharedDemo(tx, new Date().toISOString().slice(0, 10)), db);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
    await server?.stop();
    await pglite?.close();
  });

  it("applies migrations idempotently over the wire", async () => {
    expect(await migrate(db)).toBe(4);
  });

  it("enforces tenant isolation through SET LOCAL ROLE and RLS", async () => {
    const physician = await contextFor(db, "hv-dr-rivera");
    const rows = await withTenant(physician, (tx) => tx.execute(sql`select count(*)::int as n, current_user as role from patients`), db);
    const [row] = Array.from(rows as unknown as Array<{ n: number; role: string }>);
    expect(row).toEqual({ n: 30, role: "sw_app" });
    const after = Array.from(await db.query<{ role: string }>("select current_user as role"));
    expect(after[0].role).toBe("postgres");
  });

  it("runs services and detection end to end", async () => {
    const physician = await contextFor(db, "hv-dr-rivera");
    expect((await listPatients(physician, {}, db)).total).toBe(30);
    const summary = await runDetectionForClinic(physician, db);
    expect(summary.patientsEvaluated).toBe(30);
    expect((await listFlags(physician, {}, db)).length).toBeGreaterThan(5);
    const staff = await contextFor(db, "hv-fd-okafor");
    await expect(listFlags(staff, {}, db)).rejects.toThrow();
  });
});
