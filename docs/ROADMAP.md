# Roadmap

This is the team's working record of where we are, what's unresolved, and what's next. Detailed history is in `COLLABORATION.md`.

## Product goal

SymptomWatch helps 1–5-physician primary-care clinics catch follow-up loops that never closed: overdue return visits, lab results never documented, referrals with no outcome, and recurring symptoms without a plan. Every flag explains itself and is reviewed by a clinician. The current target is a credible demo for Orange County clinics. Real patient data is out of scope until the clinical deployment checklist is complete.

## Completed

| Date | Milestone |
|---|---|
| 2026-10-17 | **v0.1 prototype.** Covers all four phases: foundation, functional app, detection and evaluation, and demo readiness. It has 153 Vitest tests and 27 Playwright tests passing. `main` was pushed to GitHub (`d6f39c1`). Not deployed. |

## Design refresh, round 1 (2026-10-17)

Implemented on `design-refresh`: local Source Serif 4, paper/ink/teal tokens, case-led homepage, compact dashboard metrics, calmer shell, patient list/detail, auth, demo and privacy pages. Review and queue restructuring remains assigned to the other stream / round 2. No service, data, permission, or action changes.

Typecheck and lint pass. Vitest: 150 passing tests; the three wire-protocol tests cannot start because the sandbox denies localhost binding. Production/e2e is blocked by the same port restriction in Turbopack. Claude still needs to run full tests, axe, and desktop/mobile visual review outside this sandbox. Git staging is also blocked by the sandbox protecting the parent repository’s worktree index; changes remain uncommitted. Details and copy inventory: `DESIGN_REFRESH.md`.

## Current milestone: v0.2, a pilot-ready demo (proposed, awaiting product owner decision)

1. **Hardening:** GitHub Actions CI, a blind Codex review of the detection engine and RLS, fixes for its findings, and README cleanup.
2. **Data on-ramp:** CSV import of EHR-style report exports (appointments, lab orders, referrals), with column mapping, dry-run preview, validation, and re-detection. Synthetic files only.
3. **Alert-fatigue controls:** snooze or "expected" acknowledgement per flag, plus per-clinic rule thresholds.
4. **Hosted demo:** Vercel plus a demo-only Supabase project. Needs approval and the product owner's accounts.
5. **Customer discovery:** an interview guide and demo script for 5–10 clinics, led by the product owner.

## Open issues

- The evaluation is not independent (the same author wrote the rules, labels and engine). Blind review and, eventually, external labelers are needed.
- Migration `0005_owner_rls_compat.sql` hasn't been tested on real Supabase.
- Rate limits are in-memory per instance, there is no email transport, and auth is custom (no MFA or SSO).
- Rule limitations: R2 has no order-level linkage, and R1 accepts any later encounter (`PRODUCT_SPEC.md` §6.5).
- Undecided: whether to keep built-in auth or adopt Supabase Auth. Recommendation: keep built-in auth until real pilots require MFA or SSO.
- The two stray `# symptomwatch1` lines at the end of `README.md` need removing.

## Design refresh, round 3 (2026-10-17)

Implemented the v0.2 review workspace on `design-refresh`: compact list plus selected detail at ≥1280px, detail above list on smaller screens, URL selection/history, quiet filters and status markers, and matching Detection rules and patient flag styling. Existing clinical actions, settings fields, permissions, and data flow are preserved. Import work is untouched. E2e coverage now includes selection/history, structured dismissal, snooze/wake, administrator restrictions, rule-page axe coverage, and mobile layout.

Typecheck and lint pass. Vitest: 168 tests pass; the three wire-protocol tests cannot start because the sandbox denies localhost binding. Direct Tailwind/Lightning CSS compilation and diff checks pass. Playwright, axe, screenshots, and commit remain for Claude outside the sandbox; this round is implemented but awaiting browser verification. File inventory and handoff: `DESIGN_REFRESH.md` §Round 3.
