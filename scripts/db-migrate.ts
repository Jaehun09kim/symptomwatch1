import { createDatabase } from "../src/lib/db/client";
import { migrate } from "../src/lib/db/migrate";
import { getEnv } from "../src/lib/env";

async function main() {
  const env = getEnv();
  const database = await createDatabase(env.DATABASE_DRIVER === "pglite"
    ? { driver: "pglite", dataDir: env.PGLITE_DATA_DIR }
    : { driver: "postgres", databaseUrl: env.DATABASE_URL! });
  try { console.log(`Database migrated: ${await migrate(database)} migrations applied (${database.driver}).`); }
  finally { await database.close(); }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
