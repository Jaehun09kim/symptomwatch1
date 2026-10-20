# Deployment

> **Nothing has been deployed.** These steps prepare a public *demo* with fictional data. A real clinical deployment needs everything in [`CLINICAL_DEPLOYMENT_CHECKLIST.md`](./CLINICAL_DEPLOYMENT_CHECKLIST.md) first — including BAAs, which Vercel and Supabase only offer on specific plans.

## Recommended topology for the public demo

```
Browser ──▶ Vercel (Next.js, serverless) ──▶ Supabase Postgres (demo-only project)
```

- **App:** Vercel, any plan.
- **Database:** a *separate, demo-only* Supabase project (free tier is fine). Never reuse a production project; demo mode must never touch production credentials.
- **Auth:** SymptomWatch's built-in auth (`AUTH_PROVIDER=local`). Supabase is used only as Postgres. A Supabase Auth adapter is not part of v0.1 (see bottom).
- **Why not PGlite on Vercel?** Each serverless instance would get its own throwaway database, so sessions and sandboxes would randomly disappear. The app refuses to start that way unless you set `ALLOW_EPHEMERAL_PGLITE=true` for a single-instance preview.

## 1. Create the demo database (Supabase)

1. Create a project at supabase.com → choose a US West region (close to Orange County users) → set a strong database password.
2. **Project Settings → Database → Connection string → URI.** Use the **Session pooler** string (IPv4-compatible), e.g.
   `postgresql://postgres.<project-ref>:<password>@aws-0-us-west-1.pooler.supabase.com:5432/postgres`
   The transaction pooler (port 6543) also works: every tenant setting is transaction-scoped (`SET LOCAL`), and the driver runs with `prepare: false`.
3. Optional hardening: in **Project Settings → Data API**, remove `public` from exposed schemas. (Migrations already revoke all table grants from `anon`/`authenticated`, so the Data API can't read app tables either way.)

## 2. Apply migrations (recommended before first deploy)

From your machine:

```bash
DATABASE_DRIVER=postgres DATABASE_URL='postgresql://…' npm run db:migrate
```

Migrations create the `sw_app` role, tables, and row-level-security policies. They also run automatically (advisory-locked) on the first request if you skip this step.

**Verify on first deploy (not testable locally):** migration `0005_owner_rls_compat.sql` relaxes `FORCE ROW LEVEL SECURITY` for the table owner when the connection user is neither superuser nor `BYPASSRLS`, so trusted system operations (sign-in, seeding, detection jobs) keep working on managed Postgres. After migrating, check:

```sql
select rolname, rolsuper, rolbypassrls from pg_roles where rolname in (current_user, 'sw_app');
-- sw_app must show rolbypassrls = false
```

## 3. Configure Vercel

Import the Git repository in Vercel (or deploy with `npx vercel` from the project folder). Framework preset: **Next.js**; build command and output are the defaults.

Environment variables (Production and Preview):

| Variable | Value |
|---|---|
| `DATABASE_DRIVER` | `postgres` |
| `DATABASE_URL` | the Supabase connection string from step 1 |
| `SESSION_SECRET` | 32+ random characters — `openssl rand -base64 32` |
| `APP_BASE_URL` | `https://<your-project>.vercel.app` (used in invitation and reset links) |
| `AUTH_PROVIDER` | `local` |
| `EXTERNAL_AI_ENABLED` | `false` |
| `DETECTION_PROVIDER` | `rules` |
| `DEV_OUTBOX_ENABLED` | leave **unset** (the app refuses `true` on Vercel/Netlify/Lambda). Without an email provider, "Join with a code" works only through Google sign-in once configured. |
| `SEED_SHARED_DEMO_ACCOUNTS` | `false` (recommended publicly — visitors use **Try Demo** or **Create Demo Account**). Set `true` together with `DEMO_ACCOUNT_PASSWORD` only for a private review link. |

Never commit these values; `.env*` files are git-ignored except `.env.example`.

## 4. Deploy and verify

1. Deploy. Then open `https://<your-project>.vercel.app/api/health` → expect `{"status":"ok","driver":"postgres","migrationsApplied":8,"clinics":2}`.
2. Click **Try Demo → Start as Physician** → you should land on a private sandbox dashboard with flags on the Review page.
3. **Create Demo Account** → you become administrator of a 30-patient sandbox.
4. Check response headers on `/app`: `x-robots-tag: noindex, nofollow` and `cache-control: private, no-store`.
5. In Supabase SQL editor, confirm isolation still holds: `set role sw_app; select count(*) from patients;` → **0** (no tenant context means no rows).

## Operating the demo

- **Sandbox cleanup:** Try-Demo sandboxes expire after 7 days and registered sandboxes after 30. Expired sandboxes are purged whenever a new Try-Demo sandbox is created, or manually with `DATABASE_DRIVER=postgres DATABASE_URL=… npm run db:cleanup`. Audit rows are kept.
- **Password resets:** production has no email transport in v0.1. Members ask their clinic admin, who creates a one-time reset link on the Staff page. The developer outbox (`/dev/outbox`) is disabled in production.
- **Rate limits** are in-memory per serverless instance — adequate for a demo, not for production.
- **Connections:** each server instance opens up to 10 pooled connections; use the Supabase pooler as above.
- **Rotating `SESSION_SECRET`** signs everyone out and invalidates outstanding invitation and reset links.

## Local production run

```bash
npm run setup            # .env.local with random secret + shared demo logins
npm run build && npm start
```

## Supabase Auth (planned, not in v0.1)

v0.1 deliberately ships one fully tested auth path. Moving to Supabase Auth makes sense once MFA, SSO, and transactional email matter (all production checklist items). Sketch: a `SupabaseAuthProvider` using `@supabase/ssr`, session refresh in `src/proxy.ts`, and mapping `auth.users.id` → `users.auth_subject`, while keeping SymptomWatch's own memberships, roles, and RLS context unchanged. `AUTH_PROVIDER=supabase` currently fails at startup with an explanatory error rather than half-working.
