import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { drizzle as pgliteDrizzle } from "drizzle-orm/pglite";
import { drizzle as postgresDrizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { getEnv } from "../env";
import { acquirePgliteLock, resolvePgliteDirectory } from "./lock";
import { migrate } from "./migrate";
import * as schema from "./schema";
import type { DatabaseHandle, RawTransaction, SqlParameter } from "./types";

export type DatabaseOptions =
  | { driver: "pglite"; dataDir?: string; releaseLock?: () => void }
  | { driver: "postgres"; databaseUrl: string };

/** Single-connection operations queue as whole units, including owner transactions. */
function serialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(operation: () => Promise<T>): Promise<T> => {
    const pending = tail.then(operation);
    tail = pending.catch(() => undefined);
    return pending;
  };
}

export async function createDatabase(options: DatabaseOptions): Promise<DatabaseHandle> {
  if (options.driver === "pglite") {
    const dataDir = options.dataDir ?? "memory://";
    const release = dataDir === "memory://" ? () => undefined : options.releaseLock ?? acquirePgliteLock(dataDir);
    const client = new PGlite({ dataDir: dataDir === "memory://" ? undefined : resolvePgliteDirectory(dataDir), extensions: { citext } });
    try { await client.waitReady; }
    catch (error) { await client.close().catch(() => undefined); release(); throw error; }
    const db = pgliteDrizzle(client, { schema });
    const serial = serialQueue();
    let closed = false;
    return {
      driver: "pglite", db, migrationsApplied: 0,
      transaction: (fn) => serial(() => db.transaction(fn)),
      query: <T>(text: string, parameters: SqlParameter[] = []) => serial(async () => (await client.query<T>(text, parameters)).rows),
      exec: (text) => serial(async () => { await client.exec(text); }),
      rawTransaction: (fn) => serial(() => client.transaction((tx) => fn({
        query: async <T>(text: string, parameters: SqlParameter[] = []) => (await tx.query<T>(text, parameters)).rows,
        exec: async (text) => { await tx.exec(text); },
      }))),
      close: () => serial(async () => {
        if (closed) return;
        closed = true;
        try { await client.close(); } finally { release(); }
      }),
    };
  }

  const client = postgres(options.databaseUrl, { prepare: false });
  const db = postgresDrizzle(client, { schema });
  const raw = (connection: Pick<typeof client, "unsafe">): RawTransaction => ({
    query: async <T>(text: string, parameters: SqlParameter[] = []) => Array.from(await connection.unsafe<T[]>(text, parameters)),
    exec: async (text) => { await connection.unsafe(text).simple(); },
  });
  return {
    driver: "postgres", db, migrationsApplied: 0,
    ...raw(client),
    transaction: (fn) => db.transaction(fn),
    // Wrapping the result avoids postgres.js's automatic unwrapping of returned arrays.
    rawTransaction: async (fn) => (await client.begin(async (tx) => ({ value: await fn(raw(tx)) }))).value,
    close: async () => { await client.end({ timeout: 5 }); },
  };
}

const databaseGlobal = globalThis as typeof globalThis & {
  __symptomWatchDatabase?: Promise<DatabaseHandle>;
};

async function initializeDatabase(): Promise<DatabaseHandle> {
  const env = getEnv();
  const handle = await createDatabase(env.DATABASE_DRIVER === "pglite"
    ? { driver: "pglite", dataDir: env.PGLITE_DATA_DIR }
    : { driver: "postgres", databaseUrl: env.DATABASE_URL! });
  try {
    await migrate(handle);
    if (env.NODE_ENV !== "test") {
      await handle.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(736921002)`);
        if ((await tx.select({ id: schema.clinics.id }).from(schema.clinics).limit(1)).length === 0) {
          const { seedSharedDemo } = await import("../services/demo-seed");
          await seedSharedDemo(tx, new Date().toISOString().slice(0, 10));
        }
      });
    }
    return handle;
  } catch (error) { await handle.close(); throw error; }
}

/** Hot reload and concurrent first requests share create → migrate → first seed. */
export function getDatabase(): Promise<DatabaseHandle> {
  databaseGlobal.__symptomWatchDatabase ??= initializeDatabase();
  return databaseGlobal.__symptomWatchDatabase;
}

export async function closeDatabase(): Promise<void> {
  const pending = databaseGlobal.__symptomWatchDatabase;
  try { if (pending) await (await pending).close(); }
  finally { delete databaseGlobal.__symptomWatchDatabase; }
}
