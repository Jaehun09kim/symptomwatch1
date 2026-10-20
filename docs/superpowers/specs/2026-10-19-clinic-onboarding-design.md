# Clinic onboarding: role codes, approval, manager flag, Google sign-in

Status: **approved** (2026-10-19), revised after an independent Codex security review.

## Intent

Whoever at a practice signs up first — often the front desk or practice manager — should be able to create the clinic workspace and bring colleagues in with the right role, without the founders' help. Colleagues join by entering a short code. Because the published product will hold real patient data, a code alone must never grant access: the clinic's manager approves each join with one click.

Owner decisions (2026-10-19): code + one-click approval; separate job role from "manages the clinic"; include "Continue with Google".

## Goals

1. A new user can **start a clinic** (clinic details + their own job role) or **join one with a code**.
2. Clinic managers can create **role codes** (Physician, Front desk, Practice admin), set expiry, and revoke them.
3. Entering a code creates a **pending join request**; a manager approves (optionally changing the role) or declines. Nothing in the clinic is visible before approval.
4. **Job role** (what you see and do clinically) is separate from **manages the clinic** (invite, approve, change roles, audit log, demo reset). A front-desk owner can run the account without clinical access.
5. **Continue with Google** for sign-up and sign-in, alongside email + password.

## Non-goals (this milestone)

- SAML/enterprise SSO, Microsoft sign-in (revisit after clinic conversations), MFA (required before real data, tracked in `CLINICAL_DEPLOYMENT_CHECKLIST.md`), real email delivery (verification and codes go through the dev outbox until the owner approves a provider).
- Changing what each job role can see clinically, beyond moving management permissions to the flag.

## Anti-goals

- A code that grants access by itself. A shared "physician password" for a clinic.
- Auto-linking a Google identity to an existing password account by email alone.

## Data model (new migration `0009_onboarding.sql`; applied migrations untouched)

- `memberships.can_manage boolean NOT NULL DEFAULT false`. Backfill: existing `clinic_admin` rows → `true`. The clinic creator gets `true`.
- `app.current_can_manage()` — `SECURITY DEFINER`, reads the caller's active membership exactly like `app.current_role()` (never a GUC). RLS write policies on `memberships`, `invitations`, and the new tables use it instead of `role = 'clinic_admin'`.
- `join_codes`: `id, clinic_id, role, code_hash, label, created_by, created_at, expires_at (90 seconds after creation — see Owner refinement), revoked_at, uses`. Only the hash is stored; the code is shown once at creation (regenerate if lost). Format: 8 characters from an unambiguous alphabet, shown as `XXXX-XXXX`.
- `join_requests`: `id, clinic_id, user_id, requested_role, join_code_id, status (pending | approved | declined | withdrawn), decided_by, decided_at, decided_role, created_at`. One pending request per user per clinic.
- `users.google_sub text UNIQUE NULL`; `users.password_hash` becomes nullable (Google-only accounts). Sign-in with password requires a hash.
- `clinics`: optional `city`, `state`, `physician_count` (no patient data).

## Permissions

`permissionsFor(role) ∪ (can_manage ? {staff.manage, audit.read, demo.reset} : ∅)`. Those three leave the `clinic_admin` role matrix and attach to the flag; `clinic_admin` remains the "practice admin" job role with its current non-management permissions (open question below). The flag is loaded server-side from the membership, never from the client; the session exposes it read-only.

## Flows

**Sign up** (`/sign-up`, two steps): account (name, work email, password — or Continue with Google) → choose **Start a new clinic** (clinic name, city, state, number of physicians, your job role, fictional-data acknowledgement) or **Join with a code**.

**Join:** enter code → server validates (active, unexpired, unrevoked) → pending request → "Waiting for {clinic} to approve you" screen. Signing in while pending shows the same screen; no clinic data is reachable (no active membership ⇒ RLS denies everything). The requester can withdraw.

**Manage** (Staff page, managers only): *Role codes* (create per role with expiry; list with label, role, expiry, uses; revoke) and *Join requests* (approve — role defaults to the requested one and can be changed; decline). A pending-requests count appears on the dashboard and nav for managers. Existing per-person email invitations remain as an alternative.

**Google:** OpenID Connect authorization-code flow with PKCE, `state` and `nonce`. Verify the ID token (issuer, audience, expiry, nonce, `email_verified`). New Google identity → new user. If a password account already has that email, do **not** auto-link: ask the person to sign in with their password, then link Google from Settings. The button is hidden unless `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set.

## Security

- Code lookup crosses tenants (the requester has no membership yet), so it needs the RLS-bypassing system module. It lives in the existing auth module that is already on the `withSystem` allowlist, as one narrow, hashed-code lookup; the allowlist test is extended deliberately, with a comment.
- Rate limits on code entry per IP and per account; generic error for invalid/expired/revoked codes.
- Approval can't be self-granted: deciding a request requires `can_manage` in the request's clinic, checked in the service and in RLS. The last manager can't remove their own flag.
- Audit events: `join_code.created/revoked`, `join_request.created/approved/declined/withdrawn`, `membership.manage_changed`, `oauth.google_linked`, `auth.sign_in` with method.
- Free-text fields keep the PHI guard; clinic details are not patient data.

## Dependencies and accounts (owner actions)

- **Google Cloud OAuth client** (free): the owner creates it in Google Cloud Console and sets `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env.local` themselves; redirect URI `http://localhost:3000/auth/google/callback` (plus the hosted URL later). Claude never reads the secret.
- **One small dependency:** `oauth4webapi` (standards-only OIDC client, no vendor lock-in) for PKCE and ID-token validation, rather than hand-rolling JWT verification. Needs owner approval.

## Milestones

1. **Role split:** `can_manage`, RLS function, permission changes, Staff page toggle, backfill. Tests: RLS and service.
2. **Role codes + requests:** tables, services, Staff page sections, pending screen, rate limits, audit.
3. **New sign-up flow:** start-or-join, clinic details, job role.
4. **Google sign-in:** OIDC flow, linking from Settings, mocked provider in tests. Blocked until the owner sets up the OAuth client.

Each milestone ends with `npm run check` and `npm run test:e2e` green and docs updated (`ARCHITECTURE.md` §14/§15, `SECURITY.md`, `PRODUCT_SPEC.md`).

## Testing

- Unit: code generation/format, permission union, OIDC claim validation.
- Integration (PGlite + RLS): non-managers can't create codes or decide requests; a pending user reads nothing; expired/revoked codes fail; cross-clinic codes can't be decided by another clinic's manager; last-manager guard; Google linking never by email alone.
- E2E: front desk starts a clinic → creates a Physician code → second browser signs up and enters it → waiting screen → manager approves → physician sees Review flags; declined user stays locked out.

## Security review findings (Codex, 2026-10-19) and how the design answers them

1. **Manager-issued password resets** (existing feature) would let a non-clinical manager take over a physician's account. → Manager-visible reset links stay **sandbox/demo-only**; real clinics get self-service recovery only (requires email transport, so it ships before real data). A reset can never add a password to a Google-only account. Recorded in `SECURITY.md` known limitations until then.
2. **Managers can grant clinical access**, including to a second account of their own; approvals alone can't prevent that. → No self role changes; every clinical-access grant is audited and shown to all physicians in the clinic ("Dr. X was granted physician access by Y"). Whether clinical grants need a physician's co-approval is an owner decision (see Open questions).
3. **RLS must be replaced, not appended.** Permissive policies OR together, so new ones next to old ones keep old access. → `0009` drops and recreates the named policies on `clinics` (update), `memberships`, `invitations`, `audit_logs` (read) with `app.current_can_manage()`, keeping the tenant predicate and both `USING`/`WITH CHECK`. New tables get explicit RLS, grants, revoked Data-API access, and the 0005 owner-compat treatment. Tested by upgrading a populated database, not only fresh installs.
4. **Approval invariants.** → Requester, clinic and requested role are derived server-side; partial unique index for one pending request per user per clinic; composite tenant foreign keys; one transaction moves only `pending → approved`, inserts the membership with `can_manage = false`, never overwrites an existing or disabled membership (same safeguard as invitation acceptance), and audits. Races between approval, withdrawal, code revocation and invitation acceptance resolve to the first committed transition.
5. **Google OIDC contract.** → Short-lived, single-use, browser-bound transaction (HttpOnly cookie) holding PKCE verifier, nonce, intent, and for linking the session/user; linking requires recent password authentication and is refused in view-as/sandbox placeholder sessions; session rotation after sign-in; identities resolved by Google `sub`, never merged by email.
6. **Pending users.** → An identity-only session (no clinic) that can read and withdraw its own requests and nothing else; managers see a narrow applicant projection (name, email, verified or not, requested role, code label). Password-account emails are shown as **unverified**.
7. **Last-manager guard** covers removal, disabling, flag removal and concurrent changes: membership-management mutations lock per clinic and re-check authorization after the lock (verified against real PostgreSQL; PGlite serializes).
8. **Codes:** CSPRNG, normalized (case and dash-insensitive), purpose-separated HMAC hash, globally unique with collision retry, never logged; rate-limited by authenticated user and trusted ingress IP (the current limiter is per process; a shared store is needed before multi-instance hosting).
9. **Scope trims:** drop `uses` and the nav badge from milestone 2. Google sign-in is built and tested against a mocked provider without waiting for credentials; only live validation needs the owner's OAuth client.

## Left to the builder

Exact layouts and copy, code-list presentation, toast wording, where the pending count badge sits.

## Owner decisions on the open questions (2026-10-19)

1. **Clinical grants:** a manager may grant physician access alone; every clinical-access grant is audited and shown to all physicians in the clinic.
2. **Applicant verification — both:** the approval screen shows whether the applicant's email is verified and asks the manager to confirm in person or by phone; **and** an email-verification flow is built now (one-time link, hashed token, expiry) that delivers through the existing dev outbox. Real delivery plugs in later with an email provider, which needs the owner's account and approval (it may cost money). Google sign-ins count as verified when Google reports `email_verified`.
3. **Revoking a code declines its pending requests;** expiry does not.
4. **Practice admin keeps clinical reads for now** (unchanged); revisit with clinics.
5. **`oauth4webapi` approved.** Google sign-in is built against a mocked provider until the owner creates the Google OAuth client.

## Owner refinement (2026-10-19, after M1)

- **"Join with a code" starts from the sign-in page.** Sign-in shows "Have a code from your clinic? Join with a code" → `/join`: (1) enter the code; a valid code shows the clinic name and role being joined (invalid/expired/revoked codes get one generic message, rate-limited); (2) confirm identity — **Continue with Google** (Google's verified email counts as confirmed; no email sent) or email + password confirmed by a one-time link (dev outbox until a provider is approved); (3) access.
- **Per-code approval mode, chosen by the manager when creating the code:** "I approve each person" (**default**) → pending request and waiting screen; or "Let them in right away" → membership created as soon as the identity is confirmed. Both paths are audited; a join that grants clinical access (physician / practice admin) appears in the physicians' clinical-grant notice either way. Instant-mode codes never grant the manager flag.
- **Codes live 90 seconds** (owner, 2026-10-19), replacing the 7-day default: `expires_at = created_at + interval '90 seconds'`, enforced server-side. The Staff page shows the code large with a countdown ring and `m:ss` timer computed from the server's `expires_at` (not the browser clock alone); at zero it shows "Expired" and **Generate new code**. Screen readers get updates at 60, 30, 10 seconds and at expiry only. Entering a valid code inside the window starts a 15-minute, single-use, browser-bound join transaction (HttpOnly cookie) to finish Google/email confirmation; expiry of the code afterwards doesn't break it. Expiry does not cancel pending approval requests. No longer-lived option for now (remote colleagues get a fresh code during a call).
- Schema: `join_codes.approval_mode text NOT NULL CHECK (approval_mode IN ('approve', 'instant')) DEFAULT 'approve'`. An instant join still records a `join_requests` row (status `approved`, `decided_by` NULL, `decided_role` = code role) so every join has one history.
