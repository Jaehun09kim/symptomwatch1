import { describe, expect, it } from "vitest";
import { generateJoinCode, normalizeJoinCode } from "@/lib/onboarding/codes";

describe("join code primitives", () => {
  it("generates 8-character codes from the unambiguous alphabet", () => {
    for (let index = 0; index < 1000; index++) {
      const { code, display } = generateJoinCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
      expect(display).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
      expect(display.replace("-", "")).toBe(code);
    }
  });

  it("normalizes case, spaces and dashes", () => {
    expect(normalizeJoinCode("hv7k 29qf")).toBe("HV7K29QF");
    expect(normalizeJoinCode("HV7K-29QF")).toBe("HV7K29QF");
    expect(normalizeJoinCode("  hv7k-29qf ")).toBe("HV7K29QF");
  });

  it("rejects ambiguous or wrong-length input", () => {
    expect(normalizeJoinCode("HV7K-29Q0")).toBeNull();
    expect(normalizeJoinCode("HV7K29Q")).toBeNull();
    expect(normalizeJoinCode("HV7K-29QFX")).toBeNull();
    expect(normalizeJoinCode("")).toBeNull();
  });
});
