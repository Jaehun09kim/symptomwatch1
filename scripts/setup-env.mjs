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
writeFileSync(target, template.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${secret}`), { mode: 0o600 });
console.log(`Created ${target} with a random SESSION_SECRET.`);
