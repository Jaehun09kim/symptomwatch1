import { describe, expect, it } from "vitest";
import { hashPassword, validatePassword, verifyPassword } from "../../src/lib/auth/password";

describe("passwords", () => {
  it("salts scrypt hashes and verifies the correct password", async () => {
    const password = "Fictional-Demo-2026";
    const [first, second] = await Promise.all([hashPassword(password), hashPassword(password)]);
    expect(first).toMatch(/^scrypt\$v1\$32768\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    expect(first).not.toBe(second);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword("wrong-password", first)).toBe(false);
  });
  it.each(["", "scrypt$v2$32768$8$1$aa$bb", "scrypt$v1$32768$8$1$00$00", "scrypt$v1$1073741824$8$1$00$00"])("rejects malformed or unsupported encoding %s", async (encoded) => {
    expect(await verifyPassword("some-password", encoded)).toBe(false);
  });
  it("validates length, email local part, and common passwords", () => {
    expect(validatePassword("short", "person@example.test").valid).toBe(false);
    expect(validatePassword("Strong-ALICE-2026", "alice@example.test").valid).toBe(false);
    expect(validatePassword("Password123", "person@example.test").valid).toBe(false);
    expect(validatePassword("Fictional-Demo-2026", "person@example.test")).toEqual({ valid: true, errors: [] });
  });
});
