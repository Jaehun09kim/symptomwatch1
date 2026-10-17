# Testing

All tests use **fictional data**. Database tests run against **real Postgres** (PGlite, Postgres compiled to WebAssembly) — no mocks of the database, no Docker.

## Commands

```bash
npm test                 # unit + integration + component (Vitest)
npm run test:e2e         # end-to-end + accessibility (Playwright, Chromium)
npx playwright install chromium   # once, before the first e2e run
npm run evaluate         # detection evaluation → evaluation/RESULTS.md + results/latest.json
npm run evaluate:verify  # independent Python recomputation of every metric
npm run check            # typecheck + lint + tests + evaluation + verification
```

`npm run test:e2e` builds the app and starts it on port 3210 with a throwaway database in `.data/e2e` (wiped each run), shared demo logins enabled, and `RATE_LIMIT_SCALE=50` so repeated sign-ins don't trip the limiter.

## What each suite proves

### Unit (`tests/unit`)
| File | Proves |
|---|---|
| `detection-rules.test.ts` | Each rule's positive case; documented exclusions (reschedules, future bookings, declined/cancelled referrals, chronic-and-managed symptoms, work-up on file); exact day boundaries (strict `>`); point-in-time snapshots; care-transfer suppression; non-diagnostic wording; stable evidence hash; external-AI provider refuses to run |
| `timeline.test.ts` | Chronological ordering both directions, same-day tie order, missed vs. upcoming appointments, Documented / Not documented / Rule-inferred provenance, expected-date placement, hidden dismissed flags |
| `phi-guard.test.ts` | Rejects SSNs, real phone numbers, emails, outside MRNs, dates of birth, pasted documents; accepts ordinary demo text, fictional 555-01xx numbers, DEMO MRNs |
| `rate-limit.test.ts` | Sliding window, per-key isolation, scale multiplier can't disable limits |
| `password.test.ts` | scrypt hashing/verification, policy |
| `env.test.ts` | Production refusals (secret, serverless PGlite, external AI), unsupported auth adapter refused |
| `system-boundary.test.ts` | The RLS-bypassing system path is imported only from the allowlist |
| `migrations-bundle.test.ts` | Bundled migrations match `db/migrations` byte-for-byte |
| `lock.test.ts` | PGlite single-process lock |

### Integration (`tests/integration`) — real Postgres
| File | Proves |
|---|---|
| `database.test.ts` | **Clinic isolation and RLS**: cross-clinic reads/writes denied; front desk denied clinical tables and clinical-review tasks (including in counts); admins can't write reviews; disabled/absent membership sees nothing; missing context sees nothing; context never leaks after commit/rollback; composite FKs block cross-tenant references; audit and flag events append-only; synthetic-only and fictional-phone constraints |
| `auth.test.ts` | Sign-in (generic failure, audited), forged tokens, sign-up creates a 30-patient sandbox, duplicate/weak passwords, disabled members and expired sandboxes lose sessions, idle expiry, single-use password reset that revokes sessions, admin-issued reset links (own clinic only), invitations (email-bound, single-use, rollback on mismatch), Try-Demo sandboxes, view-as rules |
| `services.test.ts` | Patient search/filter/paging, role redaction in serialized payloads, cross-clinic patient access refused, timeline-view audit de-duplication, task lifecycle with mandatory outcome, clinical-task restrictions, cross-clinic assignees refused, PHI in task text refused, queue filters, staff closing a referral loop, dashboard metrics per role, last-admin protection, admin-only audit log |
| `detection.test.ts` | Stored flags per clinic, idempotent re-runs, physician-only review, confirm + exactly-one task, dismissed flags stay dismissed until evidence changes, staff updates resolve flags without exposing them, reopen on reverted data, feedback aggregation, care-transferred patient never flagged |
| `evaluation.test.ts` | Every lab and referral has a declared reference unit; metrics bounded and consistent; zero denominators → n/a; **the database path finds exactly the same gaps as the evaluation path** |
| `seed-parity.test.ts` | Seeded DB snapshots equal the synthetic-data snapshots; demo reset semantics |
| `postgres-driver.test.ts` | The hosted code path (postgres.js over the Postgres wire protocol): migrations, role switch to `sw_app` and back, RLS, services, detection |
| `demo-requests.test.ts` | Contact form validation, consent, PHI rejection, persistence |

### Component (`tests/components`)
Accessible text for provenance and status badges; locked metric cards hide values.

### End-to-end (`tests/e2e`, Playwright)
| File | Proves |
|---|---|
| `public.spec.ts` | Homepage content and calls to action; contact form validation, PHI rejection, success; robots/noindex/CSP headers |
| `auth.spec.ts` | Anonymous redirect, wrong password, role-based landing pages, sign-out, sign-up sandbox, invitation → account → admin reset link → new password |
| `roles.spec.ts` | Front desk can't reach review/staff and can't see clinical text; physicians see the clinical timeline and flags; clinics are isolated |
| `workflow.spec.ts` | Task create → rejected completion without outcome (input preserved) → completion; confirm a gap; staff closes a referral loop and the flag resolves; evidence links highlight the timeline entry; Try Demo + view-as; demo reset audited |
| `accessibility.spec.ts` | axe-core WCAG 2.2 AA: no serious/critical violations on 5 public and 6 authenticated pages; skip link; dialog keyboard handling |
| `responsive.spec.ts` | Mobile (Pixel 7): no horizontal scroll; app navigation sheet works |

## Latest results (2026-10-17)

- Vitest: **153 passed** (18 files)
- Playwright: **27 passed**
- Evaluation: precision 83.3%, recall 83.3%, F1 83.3%, FPR 4.9% (synthetic; see `evaluation/RESULTS.md`), independently verified in Python

## Not covered (yet)

- A managed Supabase project (the wire-protocol test covers the driver and SQL, not Supabase's specific roles and poolers) — verify after first deployment, see `DEPLOYMENT.md`.
- Load, concurrency across multiple server instances, and browser engines other than Chromium.
- Screen-reader walkthroughs by people who use assistive technology (axe catches roughly a third to half of accessibility issues).
