import { closeDatabase } from "../src/lib/db/client";
import { withSystem } from "../src/lib/db/system";
import { purgeExpiredSandboxes } from "../src/lib/services/demo-cleanup";

async function main() {
  try { console.log(`Purged ${await withSystem((tx) => purgeExpiredSandboxes(tx))} expired sandbox clinics.`); }
  finally { await closeDatabase(); }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
