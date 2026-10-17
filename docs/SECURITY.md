# Security

> Implementing these controls does **not** make SymptomWatch HIPAA-compliant. This document describes the prototype as built and its known gaps. See [`CLINICAL_DEPLOYMENT_CHECKLIST.md`](./CLINICAL_DEPLOYMENT_CHECKLIST.md) for production requirements.

## Implemented controls

### Tenant isolation (defense in depth)
- **Service layer:** every tenant-data function takes an `AppContext` and filters by `clinic_id` explicitly (`src/lib/services/*`).
- **Database:** every tenant table has row-level security with one policy per command (`db/migrations/0003_rls.sql`). Tenant queries run as the restricted, non-owner, `NOBYPASSRLS` role `sw_app` via `SET LOCAL ROLE` (`src/lib/db/tenant.ts`).
- **Role is never trusted from the client or a session variable:** `app.current_role()` reads the caller's *active* membership row; a missing or disabled membership returns no rows.
- **Composite foreign keys** (`(clinic_id, id)`) stop cross-tenant references even though FK checks bypass RLS.
- **System path allowlist:** the RLS-bypassing `withSystem` may be imported only by auth, demo/public services, the detection system job, scripts, and tests — enforced by `tests/unit/system-boundary.test.ts`.
- On Supabase, migrations revoke all grants from `anon`/`authenticated`, so the Data API cannot read app tables.

### Role-based access
- Permission matrix in `src/lib/authz/permissions.ts`; page guards redirect, action guards throw.
- Front desk never receives clinical rows *or* fields: clinical tables are RLS-denied, and referral reasons/outcomes are projected out in the service layer (verified on serialized payloads in tests).
- Only physicians can review flags — enforced by RLS policies plus a trigger that blocks non-physicians from writing review columns.
- Last-admin protection is serialized with row locks.

### Authentication & sessions
- Passwords: scrypt (N=2¹⁵, r=8, p=1, 16-byte salt, 64-byte key), constant-time comparison; minimum length, no email name, common-password denylist.
- Unknown emails are verified against a dummy hash (no timing oracle); failures return one generic message and are audited without revealing whether the account exists.
- Sessions: 256-bit random tokens in `httpOnly`, `SameSite=Lax`, `Secure` (production) cookies; only HMAC-SHA256 hashes stored; 12-hour idle and 7-day absolute expiry; membership and sandbox expiry rechecked on every request; rotated on sign-in, invitation acceptance, and view-as; all sessions revoked after a password reset.
- Reset and invitation tokens: single-use, consumed atomically (`UPDATE … WHERE used_at IS NULL … RETURNING`), 30-minute and 7-day expiry, stored hashed. Reset requests respond identically whether or not the account exists. Invitations are bound to the invited email.
- "View as" (demo only): sandbox clinics only, fictional placeholder colleagues only, original actor preserved in the session and audit log, with a return path.
- Rate limiting on sign-in (per IP and per email), sign-up, password reset, demo provisioning, and the contact form.
- CSRF: mutations are Server Actions (Next.js checks `Origin` against `Host`); cookies are `SameSite=Lax`.

### Input & data safety
- Zod validation on every action and service input.
- PHI tripwire (`src/lib/validation/phi-guard.ts`) on all free text: rejects SSN patterns, non-fictional phone numbers, emails in clinical text, outside MRNs, dates of birth, and pasted documents.
- Database constraints: `patients.is_synthetic = true`, fictional `555-01xx` phones, `DEMO-#####` MRNs. No file uploads exist.
- External AI hard kill switch: startup fails unless `EXTERNAL_AI_ENABLED=false`; the LLM provider stub throws.

### Audit
- Append-only `audit_logs` (no UPDATE/DELETE grants for the app role) covering sign-in success/failure, sign-out, sign-up, resets, invitations, role/access changes, record views (de-duplicated), task and record changes, flag reviews and feedback, detection runs, demo reset, view-as. Metadata never contains clinical free text; IPs are stored as keyed hashes. Demo reset never deletes audit rows.

### Transport & browser
- Security headers on every route: CSP (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`), HSTS (production), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy`.
- `/app`, `/api`, `/dev`, and auth routes: `X-Robots-Tag: noindex, nofollow` and `Cache-Control: private, no-store`; authenticated rendering always happens per request (never cached or prerendered).
- Errors: users see generic messages; details are logged server-side only.

### Secrets & supply chain
- Secrets only in environment variables; `.env*` git-ignored (except `.env.example`); `npm run setup` generates a random `SESSION_SECRET` into `.env.local` with mode 600.
- `npm audit --omit=dev`: **0 vulnerabilities** (2026-10-17). Development-only tooling (shadcn CLI, esbuild via drizzle-kit) has advisories that do not ship in the server bundle.

## Known gaps (prototype)

| Gap | Risk | Production fix |
|---|---|---|
| CSP allows `'unsafe-inline'` scripts (static CSP keeps pages prerenderable) | XSS impact not mitigated by CSP | Nonce- or hash-based CSP |
| In-memory, per-instance rate limits | Distributed brute force | Shared store (Redis/Upstash) or edge WAF |
| No MFA, no SSO | Account takeover via password reuse | TOTP/WebAuthn, enforced for admins; SAML/OIDC |
| No email transport; admin-issued reset links | Admin must relay the link securely | BAA-covered transactional email |
| Column-level redaction lives in the service layer | A new service could leak a clinical column to front desk | Views or column privileges per role; tests per new service |
| PHI tripwire is heuristic | Real data could still be typed in | Organizational controls; real-data mode would need a different design entirely |
| Single-region, no backups/DR configured | Data loss in a hosted demo | Managed backups, PITR, tested restore |
| `sw_app` context asserted by trusted server code | Arbitrary SQL as `sw_app` could assert another user id | The server is the boundary; no direct DB access for clients |
| No independent penetration test or threat model | Unknown unknowns | Formal threat model + third-party pen test |

## Reporting

This is a prototype with fictional data. If you find a security problem, open a private issue with the repository owner rather than a public one.
