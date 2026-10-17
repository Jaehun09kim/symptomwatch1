import { createDatabase } from "../../src/lib/db/client";
import { migrate } from "../../src/lib/db/migrate";
import type { DatabaseHandle } from "../../src/lib/db/types";

export async function createTestDatabase(): Promise<DatabaseHandle> {
  const database = await createDatabase({ driver: "pglite", dataDir: "memory://" });
  try { await migrate(database); return database; }
  catch (error) { await database.close(); throw error; }
}
