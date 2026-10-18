# Roadmap

This is the team's working record of where we are, what's unresolved, and what's next. Detailed history is in `COLLABORATION.md`.

## Product goal

SymptomWatch helps 1–5-physician primary-care clinics catch follow-up loops that never closed: overdue return visits, lab results never documented, referrals with no outcome, and recurring symptoms without a plan. Every flag explains itself and is reviewed by a clinician. The current target is a credible demo for Orange County clinics. Real patient data is out of scope until the clinical deployment checklist is complete.

## Completed

| Date | Milestone |
|---|---|
| 2026-10-17 | **v0.1 prototype.** Covers all four phases: foundation, functional app, detection and evaluation, and demo readiness. It has 153 Vitest tests and 27 Playwright tests passing. `main` was pushed to GitHub (`d6f39c1`). Not deployed. |

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
