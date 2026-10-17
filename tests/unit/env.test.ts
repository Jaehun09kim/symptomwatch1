import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEnv, resetEnvForTests } from "../../src/lib/env";

const keys = ["VERCEL", "AWS_LAMBDA_FUNCTION_NAME", "NETLIFY", "DATABASE_DRIVER", "DATABASE_URL", "PGLITE_DATA_DIR", "ALLOW_EPHEMERAL_PGLITE", "AUTH_PROVIDER", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SESSION_SECRET", "SEED_SHARED_DEMO_ACCOUNTS", "DEMO_ACCOUNT_PASSWORD", "DETECTION_PROVIDER", "EXTERNAL_AI_ENABLED", "APP_BASE_URL"];
beforeEach(() => {
  resetEnvForTests();
  for (const key of keys) vi.stubEnv(key, undefined);
  vi.stubEnv("NODE_ENV", "test");
});
afterEach(() => { vi.unstubAllEnvs(); resetEnvForTests(); });

describe("environment", () => {
  it("validates and caches local defaults", () => {
    const env = getEnv();
    expect(env.DATABASE_DRIVER).toBe("pglite");
    expect(env.SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.EXTERNAL_AI_ENABLED).toBe(false);
    expect(env.DEMO_ACCOUNT_PASSWORD).toBe("SymptomWatch-Demo-2026");
    vi.stubEnv("DATABASE_DRIVER", "bad-driver");
    expect(getEnv()).toBe(env);
    resetEnvForTests();
    expect(() => getEnv()).toThrow();
  });
  it.each(["true", "1", "FALSE", "yes"])("refuses EXTERNAL_AI_ENABLED=%s", (value) => {
    vi.stubEnv("EXTERNAL_AI_ENABLED", value);
    expect(() => getEnv()).toThrow();
  });
  it("requires a Postgres connection string for the postgres driver", () => {
    vi.stubEnv("DATABASE_DRIVER", "postgres");
    expect(() => getEnv()).toThrow(/DATABASE_URL/);
    vi.stubEnv("DATABASE_URL", "https://example.test");
    expect(() => getEnv()).toThrow(/Postgres URL/);
    vi.stubEnv("DATABASE_URL", "postgresql://demo:demo@localhost/demo");
    expect(getEnv().DATABASE_DRIVER).toBe("postgres");
  });
  it("requires an explicit production secret and, on serverless hosts, an ephemeral PGlite opt-in", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getEnv()).toThrow(/SESSION_SECRET/);
    vi.stubEnv("SESSION_SECRET", "x".repeat(32));
    expect(getEnv().DATABASE_DRIVER).toBe("pglite"); // local file-backed production run
    resetEnvForTests();
    vi.stubEnv("VERCEL", "1");
    expect(() => getEnv()).toThrow(/ALLOW_EPHEMERAL_PGLITE/);
    vi.stubEnv("ALLOW_EPHEMERAL_PGLITE", "true");
    const env = getEnv();
    expect(env.SEED_SHARED_DEMO_ACCOUNTS).toBe(false);
    expect(env.DEMO_ACCOUNT_PASSWORD).toBeUndefined();
  });
  it("requires an explicit demo password when shared accounts are enabled in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "x".repeat(32));
    vi.stubEnv("ALLOW_EPHEMERAL_PGLITE", "true");
    vi.stubEnv("SEED_SHARED_DEMO_ACCOUNTS", "true");
    expect(() => getEnv()).toThrow(/DEMO_ACCOUNT_PASSWORD/);
    vi.stubEnv("DEMO_ACCOUNT_PASSWORD", "Custom-Demo-2026");
    expect(getEnv().DEMO_ACCOUNT_PASSWORD).toBe("Custom-Demo-2026");
  });
  it("accepts hosted production with a secret and rejects short secrets", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_DRIVER", "postgres");
    vi.stubEnv("DATABASE_URL", "postgres://demo:demo@localhost/demo");
    vi.stubEnv("SESSION_SECRET", "short");
    expect(() => getEnv()).toThrow();
    vi.stubEnv("SESSION_SECRET", "x".repeat(32));
    expect(getEnv().SEED_SHARED_DEMO_ACCOUNTS).toBe(false);
  });
  it("requires both Supabase auth settings", () => {
    vi.stubEnv("AUTH_PROVIDER", "supabase");
    expect(() => getEnv()).toThrow(/NEXT_PUBLIC_SUPABASE/);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "demo-public-key");
    expect(getEnv().AUTH_PROVIDER).toBe("supabase");
  });
  it("accepts explicit false booleans without truthiness coercion", () => {
    vi.stubEnv("SEED_SHARED_DEMO_ACCOUNTS", "false");
    expect(getEnv().SEED_SHARED_DEMO_ACCOUNTS).toBe(false);
  });
});
