// Creates .env.local from .env.example with a freshly generated SESSION_SECRET.
// Never overwrites an existing .env.local.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const target = ".env.local";
if (existsSync(target)) {
  console.log(`${target} already exists — leaving it unchanged.`);
  process.exit(0);
}
const template = readFileSync(".env.example", "utf8");
const secret = randomBytes(32).toString("base64url");
const local = template
  .replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${secret}`)
  // Local demo: keep the shared demo logins even when running `npm start` (production mode).
  .replace(/^# SEED_SHARED_DEMO_ACCOUNTS=true$/m, "SEED_SHARED_DEMO_ACCOUNTS=true")
  .replace(/^# DEMO_ACCOUNT_PASSWORD=(.*)$/m, "DEMO_ACCOUNT_PASSWORD=$1");
writeFileSync(target, local, { mode: 0o600 });
console.log(`Created ${target} with a random SESSION_SECRET.`);
