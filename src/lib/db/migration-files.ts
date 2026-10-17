// Disk access for tests and tooling only; the server uses the generated bundle.
import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export async function resolveMigrationsDirectory(start = process.cwd()): Promise<string> {
  let directory = resolve(start);
  while (true) {
    const candidate = join(directory, "db", "migrations");
    try { await access(candidate); return candidate; } catch { /* Search parent workspaces as well. */ }
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`Cannot find db/migrations from ${start}`);
    directory = parent;
  }
}

export interface MigrationFile { name: string; contents: string }

export async function readMigrationFiles(directory: string): Promise<Array<{ name: string; contents: string }>> {
  const names = (await readdir(directory)).filter((name) => /^\d+_[\w-]+\.sql$/.test(name)).sort();
  return Promise.all(names.map(async (name) => ({ name, contents: await readFile(join(directory, name), "utf8") })));
}
