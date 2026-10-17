import { describe, expect, it } from "vitest";
import { readMigrationFiles, resolveMigrationsDirectory } from "@/lib/db/migration-files";
import { bundledMigrations } from "@/lib/db/migrations.generated";

describe("bundled migrations", () => {
  it("match db/migrations exactly (run `npm run db:bundle` after editing SQL)", async () => {
    const onDisk = await readMigrationFiles(await resolveMigrationsDirectory());
    expect(bundledMigrations).toEqual(onDisk);
  });
});
