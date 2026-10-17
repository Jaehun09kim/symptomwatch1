import { createHash } from "node:crypto";
import { bundledMigrations } from "./migrations.generated";
import type { DatabaseHandle } from "./types";

/**
 * Checksums cover exact file bytes; previously applied migrations must never be edited.
 * The SQL comes from the generated bundle unless explicit files are passed (tests, tooling).
 */
export async function migrate(
  handle: DatabaseHandle,
  source: ReadonlyArray<{ name: string; contents: string }> = bundledMigrations,
): Promise<number> {
  if (source.length === 0) throw new Error("No SQL migrations found");
  const files = source.map((file) => ({ ...file, checksum: createHash("sha256").update(file.contents).digest("hex") }));
  const applied = await handle.rawTransaction(async (tx) => {
    // Serializes startup/migration across hosted processes; PGlite also serializes transactions.
    await tx.query("SELECT pg_advisory_xact_lock(736921001)");
    await tx.exec(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    ); REVOKE ALL ON public.schema_migrations FROM PUBLIC;`);
    const previous = await tx.query<{ name: string; checksum: string }>("SELECT name, checksum FROM public.schema_migrations ORDER BY name");
    for (const existing of previous) {
      const file = files.find((item) => item.name === existing.name);
      if (!file || file.checksum !== existing.checksum) throw new Error(`Migration checksum mismatch or missing file: ${existing.name}`);
    }
    for (const file of files) {
      if (previous.some((item) => item.name === file.name)) continue;
      if (previous.some((item) => item.name > file.name)) throw new Error(`Out-of-order migration: ${file.name}`);
      await tx.exec(file.contents);
      await tx.query("INSERT INTO public.schema_migrations(name, checksum) VALUES ($1, $2)", [file.name, file.checksum]);
    }
    return files.length;
  });
  handle.migrationsApplied = applied;
  return applied;
}
