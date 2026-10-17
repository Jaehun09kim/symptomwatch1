import { rm } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { createDatabase } from "../src/lib/db/client";
import { acquirePgliteLock, resolvePgliteDirectory } from "../src/lib/db/lock";
import { migrate } from "../src/lib/db/migrate";
import { withSystem } from "../src/lib/db/system";
import { getEnv } from "../src/lib/env";
import { seedSharedDemo } from "../src/lib/services/demo-seed";

async function main() {
  const env = getEnv();
  if (env.DATABASE_DRIVER !== "pglite") throw new Error("db:reset only supports the local PGlite database.");
  const dataDir = env.PGLITE_DATA_DIR === "memory://" ? "memory://" : resolvePgliteDirectory(env.PGLITE_DATA_DIR);
  if (dataDir !== "memory://") {
    const localRoot = resolvePgliteDirectory(resolve(".data"));
    const inside = relative(localRoot, dataDir);
    if (!inside || inside.startsWith("..") || isAbsolute(inside)) {
      throw new Error("db:reset only wipes a directory inside this project's .data/. Set PGLITE_DATA_DIR=.data/pglite.");
    }
  }
  const release = dataDir === "memory://" ? () => undefined : acquirePgliteLock(dataDir);
  try {
    if (dataDir !== "memory://") await rm(dataDir, { recursive: true, force: true });
    const database = await createDatabase({ driver: "pglite", dataDir, releaseLock: release });
    try {
      await migrate(database);
      await withSystem((tx) => seedSharedDemo(tx, new Date().toISOString().slice(0, 10)), database);
      console.log(`Local demo reset: ${database.migrationsApplied} migrations, 2 shared clinics.`);
    } finally { await database.close(); }
  } finally { release(); }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
