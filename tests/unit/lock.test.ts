import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { acquirePgliteLock } from "../../src/lib/db/lock";

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
function dataDirectory() {
  const parent = mkdtempSync(join(tmpdir(), "sw-lock-"));
  directories.push(parent);
  return join(parent, "pglite");
}

describe("PGlite lock", () => {
  it("fails fast for a live process and releases for the next opener", () => {
    const directory = dataDirectory();
    const release = acquirePgliteLock(directory);
    try { expect(() => acquirePgliteLock(directory)).toThrow(/live process/); }
    finally { release(); }
    acquirePgliteLock(directory)();
  });
  it("recovers a stale PID lock", () => {
    const directory = dataDirectory();
    // PID outside the operating system's process-id range.
    writeFileSync(`${directory}.lock`, JSON.stringify({ pid: 2147483647, token: "stale" }));
    acquirePgliteLock(directory)();
  });
  it("does not delete an unreadable lock", () => {
    const directory = dataDirectory();
    writeFileSync(`${directory}.lock`, "incomplete");
    expect(() => acquirePgliteLock(directory)).toThrow(/unreadable lock/);
  });
});
