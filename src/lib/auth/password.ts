import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const parameters = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const prefix = "scrypt$v1$32768$8$1";

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, parameters, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `${prefix}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  if (parts.length !== 7 || parts.slice(0, 5).join("$") !== prefix) return false;
  const [, , , , , saltHex, keyHex] = parts;
  if (!/^[a-f0-9]{32}$/.test(saltHex) || !/^[a-f0-9]{128}$/.test(keyHex)) return false;
  const actual = await derive(password, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(actual, Buffer.from(keyHex, "hex"));
}

const commonPasswords = new Set([
  "password", "password123", "password1234", "password123!", "1234567890",
  "12345678910", "qwerty12345", "qwertyuiop", "letmein1234", "welcome123", "welcome1234",
]);

export function validatePassword(password: string, email: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 10) errors.push("Use at least 10 characters.");
  const normalized = password.toLowerCase();
  const localPart = email.trim().split("@")[0].toLowerCase();
  if (localPart && normalized.includes(localPart)) errors.push("Password must not contain your email name.");
  if (commonPasswords.has(normalized)) errors.push("Choose a less common password.");
  return { valid: errors.length === 0, errors };
}
