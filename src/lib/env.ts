import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_DRIVER: z.enum(["pglite", "postgres"]).default("pglite"),
  DATABASE_URL: z.url().refine((url) => /^postgres(?:ql)?:/.test(url), "Must be a Postgres URL").optional(),
  PGLITE_DATA_DIR: z.string().min(1).default(".data/pglite"),
  ALLOW_EPHEMERAL_PGLITE: booleanString.default(false),
  AUTH_PROVIDER: z.enum(["local", "supabase"]).default("local"),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  SEED_SHARED_DEMO_ACCOUNTS: booleanString.optional(),
  DEMO_ACCOUNT_PASSWORD: z.string().min(10).optional(),
  DETECTION_PROVIDER: z.enum(["rules", "llm"]).default("rules"),
  EXTERNAL_AI_ENABLED: z.literal("false").default("false").transform(() => false as const),
  APP_BASE_URL: z.url().default("http://localhost:3000"),
  // Multiplies rate-limit allowances (e.g. 50 for end-to-end tests). Cannot disable limiting.
  RATE_LIMIT_SCALE: z.coerce.number().int().min(1).max(1000).default(1),
  // Set by serverless hosts, where a PGlite directory is per-instance and ephemeral.
  VERCEL: z.string().optional(),
  AWS_LAMBDA_FUNCTION_NAME: z.string().optional(),
  NETLIFY: z.string().optional(),
}).superRefine((env, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (env.DATABASE_DRIVER === "postgres" && !env.DATABASE_URL) {
    issue("DATABASE_URL", "Required when DATABASE_DRIVER=postgres");
  }
  if (env.AUTH_PROVIDER === "supabase") {
    if (!env.NEXT_PUBLIC_SUPABASE_URL) issue("NEXT_PUBLIC_SUPABASE_URL", "Required for Supabase auth");
    if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) issue("NEXT_PUBLIC_SUPABASE_ANON_KEY", "Required for Supabase auth");
  }
  if (env.NODE_ENV === "production") {
    if (!env.SESSION_SECRET) issue("SESSION_SECRET", "Required in production (at least 32 characters)");
    const serverless = Boolean(env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME || env.NETLIFY);
    if (serverless && env.DATABASE_DRIVER === "pglite" && !env.ALLOW_EPHEMERAL_PGLITE) {
      issue("ALLOW_EPHEMERAL_PGLITE", "Serverless production requires Postgres (DATABASE_URL); single-instance PGlite previews must explicitly set ALLOW_EPHEMERAL_PGLITE=true");
    }
    if (env.SEED_SHARED_DEMO_ACCOUNTS && !env.DEMO_ACCOUNT_PASSWORD) {
      issue("DEMO_ACCOUNT_PASSWORD", "Required when enabling shared demo accounts in production");
    }
  }
}).transform((env) => ({
  ...env,
  SESSION_SECRET: env.SESSION_SECRET ?? "symptomwatch-local-development-secret-only",
  SEED_SHARED_DEMO_ACCOUNTS: env.SEED_SHARED_DEMO_ACCOUNTS ?? env.NODE_ENV !== "production",
  DEMO_ACCOUNT_PASSWORD: env.DEMO_ACCOUNT_PASSWORD ?? (env.NODE_ENV !== "production" ? "SymptomWatch-Demo-2026" : undefined),
}));

export type Env = z.infer<typeof environmentSchema>;
let cachedEnv: Env | undefined;

export function getEnv(): Env {
  // Blank values (e.g. `SESSION_SECRET=` copied from .env.example) mean "unset".
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ""));
  cachedEnv ??= environmentSchema.parse(raw);
  return cachedEnv;
}

export function resetEnvForTests(): void {
  cachedEnv = undefined;
}
