# SymptomWatch — Architecture

> **Status:** research & demonstration prototype. Synthetic data only. Not clinically validated. Not HIPAA-compliant. See [`CLINICAL_DEPLOYMENT_CHECKLIST.md`](./CLINICAL_DEPLOYMENT_CHECKLIST.md).

## 1. Goals that drive the architecture

1. **Zero-setup local demo.** `npm install && npm run dev` must work with no Docker, no Supabase CLI, no paid APIs, no cloud credentials.
2. **One schema, two runtimes.** The same SQL migrations — including row-level security (RLS) — run on embedded Postgres locally and on Supabase Postgres when hosted.
3. **Defense in depth for tenancy.** Clinic isolation is enforced in the service layer *and* by Postgres RLS. Either layer alone should stop a cross-tenant read.
4. **Explainability over cleverness.** Detection is deterministic, rule-based, versioned, and every finding carries its evidence.
5. **No patient contact, no external AI.** Nothing in the prototype sends SMS/email to patients or patient data to third parties.

## 2. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript | Full-stack in one deployable unit; Vercel-native |
| Styling / UI | Tailwind CSS 4, shadcn/ui (Base UI primitives), lucide-react icons | Accessible primitives, consistent design tokens |
| Charts | Recharts 3 | Mature, SSR-safe client components |
| Database (local / zero-credential) | **PGlite** — real Postgres compiled to WASM, file-backed in `.data/pglite` | Same SQL & RLS as production; no install |
| Database (hosted) | **Supabase Postgres** via `postgres` (postgres.js) driver | Managed Postgres, free tier |
| ORM / queries | Drizzle ORM (typed queries) + hand-written SQL migrations in `db/migrations` | SQL migrations carry RLS policies, roles, functions verbatim |
| Auth (default, both runtimes) | Built-in **local auth**: scrypt password hashes, opaque DB-backed sessions in httpOnly cookies | Works offline; fully testable |
| Auth (optional hosted) | **Supabase Auth** adapter behind the same `AuthProvider` interface (`AUTH_PROVIDER=supabase`) | Managed auth, email flows |
| Validation | Zod 4 | Shared client/server schemas |
| Tests | Vitest (unit + integration on in-memory PGlite), Playwright + axe-core (E2E + a11y) | Fast, real-Postgres integration tests without Docker |
| Research | Python 3 (stdlib only) in `research/` | Independent re-computation of evaluation metrics; future NLP experiments |

## 3. Runtime modes

Configured by environment variables (validated at startup in `src/lib/env.ts`):

| Variable | Values | Default | Effect |
|---|---|---|---|
| `DATABASE_DRIVER` | `pglite` \| `postgres` | `pglite` | Which database runtime |
| `PGLITE_DATA_DIR` | path \| `memory://` | `.data/pglite` | PGlite storage. On Vercel without `DATABASE_URL`, use `/tmp/pglite` (ephemeral) |
| `DATABASE_URL` | Postgres URL | — | Required when `DATABASE_DRIVER=postgres` |
| `AUTH_PROVIDER` | `local` \| `supabase` | `local` | Auth adapter |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | — | Only for `AUTH_PROVIDER=supabase` |
| `SESSION_SECRET` | ≥32 chars | dev fallback in dev only | HMAC key for session/CSRF/token hashing; **required in production** |
| `SEED_SHARED_DEMO_ACCOUNTS` | `true`\|`false` | `true` in dev, `false` in production | Seeds known-password demo logins for the shared demo clinic |
| `DETECTION_PROVIDER` | `rules` \| `llm` | `rules` | `llm` is a disabled stub that refuses to run |
| `EXTERNAL_AI_ENABLED` | must be `false` | `false` | Hard kill switch; any other value fails startup in this prototype |
| `APP_BASE_URL` | URL | `http://localhost:3000` | Links in invitation / reset messages |

**Demo mode is the only mode.** Every environment shows the “Demo Only — No Real Patient Data” banner.

## 4. Directory layout

```
db/migrations/            Ordered SQL migrations (schema, roles, RLS, functions)
docs/                     Architecture, product spec, security, deployment, demo script
evaluation/               Reference labels, evaluation runner, committed results
research/                 Python metric verification + NLP experiment notes
scripts/                  db:migrate, db:reset, db:seed CLIs
src/app/(marketing)/      Public, indexable pages
src/app/(auth)/           Sign-in, sign-up, forgot/reset password, invitation acceptance
src/app/app/              Authenticated product (noindex)
src/app/dev/outbox/       Local-only simulated staff email outbox
src/components/           ui/ (shadcn), marketing/, app/, charts/
src/data/synthetic/       Synthetic patient scenarios (Claude-owned)
src/lib/env.ts            Zod-validated environment
src/lib/db/               Client factory, Drizzle schema, migrator, tenant context
src/lib/auth/             AuthProvider interface, local + Supabase adapters, sessions, passwords
src/lib/authz/            Permission matrix + guards
src/lib/services/         The ONLY modules that read/write tenant data
src/lib/detection/        Rule engine, rules, provider interface
src/lib/validation/       Zod schemas, PHI tripwire
tests/unit|integration|e2e
```

## 5. Data model (summary)

All tenant tables carry `clinic_id uuid not null` and are protected by RLS. Full DDL lives in `db/migrations`.

**Identity & tenancy (system tables — accessed only via `withSystem`, never exposed to tenants directly):**
- `users` (id, email unique citext, display_name, password_hash nullable, auth_subject nullable, is_placeholder, created_at)
- `sessions` (id, user_id, token_hash, active_clinic_id, user_agent, created_at, last_seen_at, expires_at)
- `password_reset_tokens` (id, user_id, token_hash, expires_at, used_at)
- `outbox_messages` (id, to_email, subject, body, kind, created_at) — simulated **staff** emails (invites, resets). Never patient messages.
- `demo_requests` (id, name, email, clinic_name, role, message, created_at) — public contact form

**Tenant tables (RLS):**
- `clinics` (id, name, slug, is_sandbox, owner_user_id, expires_at, created_at)
- `memberships` (id, clinic_id, user_id, role `clinic_admin|physician|staff`, status `active|disabled`, created_at) unique (clinic_id, user_id)
- `invitations` (id, clinic_id, email, role, token_hash, invited_by, expires_at, accepted_at, revoked_at)
- `patients` (id, clinic_id, demo_mrn `DEMO-#####`, first_name, last_name, date_of_birth, sex, phone (555-01xx only), primary_physician_id, care_status `active|transferred_out`, is_synthetic **check (is_synthetic = true)**, seed_key, created_at)
- `encounters` (id, clinic_id, patient_id, occurred_at, encounter_type, provider_id, chief_complaint, assessment, plan, follow_up_kind `interval|as_needed|none`, follow_up_interval_days, seed_key)
- `appointments` (id, clinic_id, patient_id, scheduled_for, purpose `follow_up|lab_draw|annual|new_concern|specialist`, status `scheduled|confirmed|completed|no_show|cancelled_by_patient|cancelled_by_clinic|rescheduled`, status_reason, origin_encounter_id, completed_encounter_id, seed_key)
- `symptom_observations` (id, clinic_id, patient_id, encounter_id, symptom_code, label, observed_at, status `active|improving|resolved|chronic_managed`, note, seed_key)
- `lab_orders` (id, clinic_id, patient_id, encounter_id, test_name, ordered_at, expected_within_days, status `ordered|collected|resulted|cancelled`, collected_at, resulted_at, result_summary, status_reason, symptom_code, seed_key)
- `referrals` (id, clinic_id, patient_id, encounter_id, specialty, reason, referred_at, expected_within_days, status `sent|scheduled|seen|records_received|declined|cancelled`, specialist_appointment_at, records_received_at, outcome_summary, status_reason, symptom_code, seed_key)
- `tasks` (id, clinic_id, patient_id nullable, category `call_patient|confirm_appointment|request_records|lab_follow_up|admin_other|clinical_review`, title, description, status `pending|in_progress|completed|needs_review`, assignee_id, created_by, due_date, outcome, completed_at, source_flag_id, created_at, updated_at)
- `detection_runs` (id, clinic_id, provider, rules_version, as_of, started_by, patients_evaluated, findings_count, created_at)
- `detection_flags` (id, clinic_id, patient_id, rule_id, rule_version, fingerprint, subject_type, subject_id, title, rationale, evidence jsonb, missing_info jsonb, status `open|confirmed|dismissed|resolved_by_data`, first_detected_at, last_detected_at, reviewed_by, reviewed_at, review_note) unique (clinic_id, fingerprint)
- `flag_feedback` (id, clinic_id, flag_id, user_id, verdict `accurate|false_positive|already_addressed|not_useful`, comment, created_at)
- `audit_logs` (id, clinic_id nullable, actor_user_id, action, entity_type, entity_id, metadata jsonb, ip_hash, created_at) — **append-only**: no UPDATE/DELETE grants to the app role

## 6. Tenancy & authorization

### 6.1 Two database access paths
- `withTenant(ctx, fn)` — opens a transaction, `SET LOCAL ROLE sw_app` (a NOLOGIN, non-superuser, non-BYPASSRLS role), sets `app.user_id`, `app.clinic_id`, `app.role` via `set_config(..., true)`, then runs `fn(tx)`. All tenant-data service functions use this.
- `withSystem(fn)` — owner connection, bypasses RLS. Used **only** by `src/lib/auth/*`, migrations, seeding, demo sandbox provisioning, and the public demo-request insert. Lint/grep test enforces that `withSystem` is not imported elsewhere.

### 6.2 RLS
Every tenant table: `ENABLE` + `FORCE ROW LEVEL SECURITY`. Helper functions (`app.current_user_id()`, `app.current_clinic_id()`, `app.current_role()`, `app.is_active_member(clinic uuid)`) are `SECURITY DEFINER`, `STABLE`, with a pinned `search_path`.

Base policy for every tenant table:
```
clinic_id = app.current_clinic_id() AND app.is_active_member(clinic_id)
```
Role-restricted tables add `AND app.current_role() IN ('clinic_admin','physician')`:
`encounters`, `symptom_observations`, `lab_orders`, `detection_flags`, `flag_feedback`, `detection_runs`.
`tasks` with `category = 'clinical_review'` are invisible to `staff`.
`audit_logs`: SELECT for `clinic_admin` only; INSERT for any member; no UPDATE/DELETE.
`memberships`/`invitations` writes: `clinic_admin` only.

Column-level minimization (e.g. hiding `referrals.reason` and `outcome_summary` from front-desk staff) is done in the service layer projections; documented as a known limitation of row-level policies.

On Supabase, the app role is granted to the connection user; `anon`/`authenticated` roles receive **no** grants on app tables, so the Supabase Data API cannot reach them even with the anon key.

### 6.3 Permission matrix (`src/lib/authz/permissions.ts`)

| Permission | clinic_admin | physician | staff (front desk) |
|---|:-:|:-:|:-:|
| `patient.read_demographics` | ✓ | ✓ | ✓ |
| `patient.read_clinical` (visits, symptoms, labs, referral reasons, flags) | ✓ (read-only) | ✓ | ✗ |
| `appointment.manage` (schedule/confirm/reschedule/mark no-show) | ✓ | ✓ | ✓ |
| `referral.update_admin_status` (scheduled / records received) | ✓ | ✓ | ✓ |
| `lab.update_status` | ✗ | ✓ | ✗ |
| `task.read` / `task.manage` (non-clinical categories) | ✓ | ✓ | ✓ |
| `task.manage_clinical` (`clinical_review`) | ✗ | ✓ | ✗ |
| `flag.read` | ✓ | ✓ | ✗ |
| `flag.review` (confirm / dismiss / feedback) | ✗ | ✓ | ✗ |
| `detection.run` | ✓ | ✓ | ✗ |
| `staff.manage` (invite, change role, disable) | ✓ | ✗ | ✗ |
| `audit.read` | ✓ | ✗ | ✗ |
| `demo.reset` / `demo.impersonate_placeholder` (sandbox only) | ✓ | ✗ | ✗ |

Guards: `requireSession()`, `requirePermission(perm)` return a `TenantContext { userId, clinicId, role }`. Every Server Action and data-loading Server Component calls a guard before any service call. Services take `TenantContext` as their first argument and also include `clinic_id` predicates explicitly.

## 7. Authentication

`AuthProvider` interface: `signUp`, `signIn`, `signOut`, `getSession`, `requestPasswordReset`, `resetPassword`.

**Local provider (default):**
- Passwords: Node `crypto.scrypt` (N=2^15, r=8, p=1, 16-byte salt), constant-time compare; min length 10 + zxcvbn-style basic checks (length, not email, not common list).
- Sessions: 32-byte random token → cookie `sw_session` (httpOnly, `SameSite=Lax`, `Secure` in production, 12h idle / 7d absolute). DB stores `HMAC-SHA256(SESSION_SECRET, token)` only.
- Password reset: single-use 32-byte token, 30-minute expiry, stored hashed; the “email” is written to `outbox_messages` and viewable at `/dev/outbox` **in non-production only**. Response is identical whether or not the email exists.
- Rate limiting: in-memory sliding window per IP and per email for sign-in, sign-up, reset, contact form (documented as single-instance only).
- Sign-in failures and successes audited.

**Supabase provider (optional):** `@supabase/ssr` server client; on each request `getUser()` → maps `auth_subject` to `users`. Same membership/authorization path. Unit-tested with a mocked client; integration requires a Supabase project.

## 8. Demo workspaces

- **Shared demo clinic** (“Harbor View Family Medicine — DEMO”), seeded at first start, with known-password logins for each role when `SEED_SHARED_DEMO_ACCOUNTS=true`. A second seeded clinic (“Orange Grove Primary Care — DEMO”) exists to demonstrate and test isolation.
- **Try Demo** (`/demo`): provisions a private **sandbox clinic** (synthetic patients + three placeholder staff), signs the visitor in as the role they pick, expires after 7 days. A “View as” switcher lets the sandbox admin step into the placeholder physician/front-desk users — server-checked, sandbox-only, audited.
- **Create Demo Account** (`/sign-up`): email + password → new sandbox clinic owned by the user as `clinic_admin`. The admin can invite colleagues (`/app/staff`) by email + role; the invite link is shown in-app and in the dev outbox; accepting requires sign-in/sign-up with the invited email.
- **Reset demo data**: admin action and `npm run db:reset`. Reseeds dates relative to *now* so scenarios stay current.

## 9. Detection engine

`src/lib/detection/`:
- `types.ts` — `PatientRecord` (normalized snapshot), `Finding` (ruleId, ruleVersion, subject, title, rationale, evidence[], missingInfo[], fingerprint), `DetectionProvider` interface.
- `rules/*.ts` — pure functions `(record, config, asOf) => Finding[]`. No I/O, no clock reads (asOf is injected).
- `engine.ts` — runs all rules; `providers/rules.ts` default provider; `providers/llm-disabled.ts` throws `ExternalAiDisabledError`.
- Persistence (`services/detection.ts`) upserts by fingerprint, marks no-longer-matching open flags `resolved_by_data`, never reopens a `dismissed` flag with unchanged evidence, records a `detection_runs` row and audit entry.

Rule definitions are specified in [`PRODUCT_SPEC.md` §6](./PRODUCT_SPEC.md#6-detection-rules-v1). The engine **never** diagnoses, recommends treatment, ranks urgency, or modifies care plans. Findings are phrased as documentation questions (“No completed result is documented for…”).

## 10. Safety safeguards for “no real data”

- Global non-dismissible banner: **Demo Only — No Real Patient Data**.
- No file-upload feature anywhere.
- `patients.is_synthetic` DB check constraint; demo MRNs `DEMO-#####`; phone numbers restricted to the fictional `555-01xx` range.
- **PHI tripwire** (`src/lib/validation/phi-guard.ts`) on every free-text input: rejects SSN patterns, non-fictional phone numbers, email addresses inside clinical free text, MRN-like identifiers from other systems, and long pasted note-like blocks; returns a clear error explaining real data is prohibited.
- External AI kill switch (startup failure if enabled).
- `robots.txt` disallows `/app`, `/api`, `/dev`, auth routes; `X-Robots-Tag: noindex, nofollow` on all non-public routes; per-page `robots` metadata.

## 11. Audit logging

`services/audit.ts#record(ctx, action, entity, metadata)` — called inside the same transaction as the mutation. Actions include: `auth.sign_in`, `auth.sign_in_failed`, `auth.sign_out`, `auth.password_reset_requested|completed`, `invite.created|accepted|revoked`, `membership.role_changed|disabled|enabled`, `patient.timeline_viewed`, `task.created|updated|status_changed|assigned`, `appointment.updated`, `referral.updated`, `lab.updated`, `flag.confirmed|dismissed|feedback`, `detection.run`, `demo.reset`, `demo.view_as`. Metadata never contains free-text clinical content.

## 12. Security headers

Set in `next.config.ts` / proxy: `Content-Security-Policy`, `Strict-Transport-Security` (prod), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` / `frame-ancestors 'none'`, `Permissions-Policy` (camera, mic, geolocation off). Authenticated responses: `Cache-Control: no-store`.

## 13. Known architectural limitations (prototype)

- In-memory rate limiter is per-instance.
- PGlite is single-process; on serverless without `DATABASE_URL` data is ephemeral per instance.
- Column-level minimization relies on the service layer.
- No field-level encryption, key management, backup/DR, BAA-covered vendors, or formal threat model yet — see the clinical deployment checklist.

## 14. Decisions adopted after Codex plan review (C0)

Codex reviewed this plan (`codex_review_plan`) before implementation. Adopted changes — these **override** earlier sections where they conflict:

1. **Hosted mode requires shared Postgres.** Zero credentials is guaranteed **locally** (PGlite). A hosted demo (Vercel) must set `DATABASE_DRIVER=postgres` + `DATABASE_URL` (a free, demo-only Supabase project is sufficient) and `SESSION_SECRET`. The app refuses to start in production with PGlite unless `ALLOW_EPHEMERAL_PGLITE=true` (single-instance preview only; banner says data is ephemeral).
2. **RLS trust model.**
   - *System path* = the connection user, which bypasses RLS (superuser in PGlite; `postgres` with `BYPASSRLS` on Supabase). `withSystem` is exported only from `src/lib/db/system.ts`; a test fails if it is imported outside the allowlist (`src/lib/auth/**`, `src/lib/services/demo*.ts`, `src/lib/services/public*.ts`, `scripts/**`, `db/**`, tests).
   - *Tenant path* = `SET LOCAL ROLE sw_app` (NOLOGIN, NOBYPASSRLS, not table owner). Only `app.user_id` and `app.clinic_id` are set as GUCs. **Role is never trusted from a GUC**: `app.current_role()` is a `SECURITY DEFINER` function (owner = system role, `SET search_path = pg_catalog, public`, `EXECUTE` granted only to `sw_app`) that reads the caller's *active* membership row; it returns NULL if the membership is missing/disabled, which denies everything. Because definer functions run as the RLS-bypassing owner, policies on `memberships` that call them do not recurse.
   - GUCs are assertions made by trusted server code; `sw_app` is unreachable from clients (no Data API grants). Documented: anyone able to run arbitrary SQL as `sw_app` could assert another user id — the boundary is the server.
   - **One permissive policy per command per table** (`FOR SELECT`, `FOR INSERT … WITH CHECK`, `FOR UPDATE … USING … WITH CHECK`, `FOR DELETE`), each embedding both tenant and role conditions, so permissive-policy OR-combination cannot widen access. Admin may *run detection* (insert `detection_runs`, upsert flags via the detection service) but may not *review* flags (no UPDATE of review columns, no INSERT into `flag_events` of review types / `flag_feedback`) — enforced in policy, not just UI.
   - **Composite tenant foreign keys**: child tables reference `(clinic_id, patient_id) → patients(clinic_id, id)`, `(clinic_id, encounter_id) → encounters(clinic_id, id)`, task assignee `(clinic_id, assignee_id) → memberships(clinic_id, user_id)`, etc., because FK checks bypass RLS.
   - Required negative tests: cross-clinic read/write, forbidden role writes, disabled membership, missing context (no GUC → zero rows), context does not leak after commit/rollback, interleaved tenant/system calls on the shared PGlite handle, staff redaction in serialized service payloads and aggregate counts.
3. **Next.js 16 / Cache Components.** `cookies()`, `headers()`, `params`, `searchParams` are awaited; request-dependent UI sits under `<Suspense>`; no legacy `dynamic`/`revalidate`/`fetchCache` route exports. Authorization and tenant reads are **never cached** (no `"use cache"` in services). `src/proxy.ts` handles redirects, `X-Robots-Tag`, and `Cache-Control: no-store` for `/app`; authorization happens in actions/services, never only in proxy. Cookie writes only in Server Actions / Route Handlers; demo provisioning is POST-only. **CSP is static (no nonce)** because nonces force dynamic rendering of every page; `script-src 'self' 'unsafe-inline'` is a documented prototype limitation (hash-based CSP is a hardening item).
4. **Database runtime.** A single `globalThis` initialization promise covers PGlite creation → migrations → first seed; the PGlite directory is guarded by a lock file so a second process fails fast with a clear message. `citext` is loaded as a PGlite extension. `@electric-sql/pglite` is in `serverExternalPackages`. All service code uses the transaction handle passed by `withTenant`/`withSystem`. An optional parity job runs the integration suite against a real Postgres when `TEST_DATABASE_URL` is set.
5. **Auth semantics.** Sessions store `user_id`, `active_clinic_id`, `original_user_id` (for view-as), idle (12h) and absolute (7d) expiry; every request rechecks membership status and sandbox expiry. Sessions rotate on sign-in and on view-as/return; all sessions for a user are revoked after password reset. Reset and invite tokens are consumed atomically (`UPDATE … WHERE used_at IS NULL AND expires_at > now() RETURNING`). Last-admin changes are serialized with `SELECT … FOR UPDATE` on the clinic's admin memberships. View-as keeps `original_user_id`; audit rows record both actor and effective user; a “Return to my account” control restores the original session. Demo provisioning is rate-limited per IP; expired sandboxes are purged opportunistically on provisioning and by `npm run db:cleanup`. scrypt uses explicit `maxmem` (64 MiB).
   - **Password reset delivery:** in non-production the reset email lands in `/dev/outbox`. In production with local auth there is no email transport in this prototype, so self-service reset shows “ask your clinic administrator”, and admins can generate a one-time reset link for a member from `/app/staff` (audited). With `AUTH_PROVIDER=supabase`, Supabase sends the email.
6. **Auth-failure auditing** uses a tenantless system insert (`clinic_id NULL`). Audit rows are append-only; demo reset deletes clinical/task data but never audit rows. `patient.timeline_viewed` is recorded by the timeline Server Component and de-duplicated per (user, patient) per 10 minutes so prefetch/re-renders don't inflate it.
7. **Flag lifecycle** (supersedes §9 bullet and PRODUCT_SPEC §6 “Flag lifecycle”): see PRODUCT_SPEC §6.6.
8. **Contracts first.** Claude owns the normalized detection input/output contract in `src/lib/detection/types.ts` and the evaluation unit list in `evaluation/reference-labels.ts`; Codex implements against them.

## 15. As built (v0.1) — deltas from the plan

| Area | As built | Why |
|---|---|---|
| Auth provider | Built-in local auth only. `AUTH_PROVIDER=supabase` fails at startup with an explanatory error; the Supabase SDK packages were removed. | One fully tested auth path; Supabase is used as hosted Postgres. Supabase Auth is planned (see DEPLOYMENT.md). |
| Hosted PGlite | Refused only on serverless hosts (`VERCEL`, `AWS_LAMBDA_FUNCTION_NAME`, `NETLIFY`) unless `ALLOW_EPHEMERAL_PGLITE=true`; a local `npm start` with file-backed PGlite is allowed. | Local production runs are durable; serverless instances are not. |
| Migrations | Bundled into `src/lib/db/migrations.generated.ts` at `predev`/`prebuild`/`pretest` (drift test). | Runtime filesystem reads made Next trace the whole project into serverless bundles. |
| `0004_users_directory.sql` | `sw_app` may read `users(id, email, display_name, is_placeholder)` only for members of the current clinic. | Assignee/actor names in tenant queries; never password hashes. |
| `0005_owner_rls_compat.sql` | Drops `FORCE` RLS for the owner only when the connection user can't bypass RLS. | Managed Postgres (e.g. Supabase) where the owner isn't a superuser; `sw_app` is unaffected. |
| Detection refresh | `src/lib/services/detection-system.ts` (system path, on the allowlist) refreshes one patient's flags after any appointment/referral/lab update, and runs a full pass after seed/reset. Patient-scoped refreshes don't create `detection_runs` rows. | Front desk closes loops but cannot read flags; flags must still resolve. |
| Snapshot loader | Accepts an explicit `{ clinicId, clinical }` scope for system runs; otherwise derives both from the tenant context. | Same normalized input for tenant runs, system runs, and the evaluator. |
| Request-time rendering | `getCurrentSession()` calls `connection()` before reading cookies; app routes set `instant = false`. | Clock-based session expiry must never run during (runtime) prerendering; authenticated pages are never cached. |
| Forms | `useFormAction` submits via `onSubmit` + `startTransition`. | React 19 auto-resets forms after an `action`, wiping user input on validation errors (caught by e2e). |
| Re-confirming a flag | Keeps the original review and event; only allows adding a task. | A second confirm must not overwrite the physician's note. |
| Rate limits | `RATE_LIMIT_SCALE` multiplies allowances (tests use 50); cannot disable limiting. | Deterministic e2e runs without an "off" switch that could leak into production. |
| Muted text color | `slate-500` → `#56667c` (≥ 5:1 on every surface). | axe flagged Tailwind's default at 4.47:1. |
| Timeline anchors | `ev-<kind>-<id>`; visits also carry `ev-symptom_observation-<id>` aliases. | Flag evidence links resolve to the exact charted entry. |
