import { randomUUID } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

interface LockRecord { pid: number; token: string }

function readLock(path: string): LockRecord | undefined {
  try {
    const record: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (typeof record === "object" && record !== null && "pid" in record && "token" in record &&
        Number.isSafeInteger(record.pid) && Number(record.pid) > 0 && typeof record.token === "string") {
      return { pid: Number(record.pid), token: record.token };
    }
  } catch { /* An incomplete or unreadable lock is never assumed stale. */ }
}

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { return !(error instanceof Error && "code" in error && error.code === "ESRCH"); }
}

export function resolvePgliteDirectory(directory: string): string {
  const absolute = resolve(directory);
  mkdirSync(dirname(absolute), { recursive: true });
  return existsSync(absolute) ? realpathSync(absolute) : resolve(realpathSync(dirname(absolute)), absolute.split("/").at(-1)!);
}

/** A sibling lock remains held even while db:reset removes the data directory. */
export function acquirePgliteLock(directory: string): () => void {
  const path = `${resolvePgliteDirectory(directory)}.lock`;
  const record: LockRecord = { pid: process.pid, token: randomUUID() };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const descriptor = openSync(path, "wx", 0o600);
      try { writeFileSync(descriptor, JSON.stringify(record)); }
      finally { closeSync(descriptor); }
      const release = () => {
        if (readLock(path)?.token === record.token) {
          try { unlinkSync(path); } catch { /* Another shutdown hook may have released it. */ }
        }
        process.off("exit", release);
      };
      process.once("exit", release);
      return release;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      const previous = readLock(path);
      if (!previous || isAlive(previous.pid)) {
        throw new Error(`PGlite directory is locked${previous ? ` by live process ${previous.pid}` : " (unreadable lock)"}: ${path}. Stop the other SymptomWatch process or choose a different PGLITE_DATA_DIR.`);
      }
      if (readLock(path)?.token === previous.token) {
        try { unlinkSync(path); }
        catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
        }
      }
    }
  }
  throw new Error(`Unable to acquire PGlite lock: ${path}`);
}
