# Roadmap

This is the team's working record of where we are, what's unresolved, and what's next. Detailed history is in `COLLABORATION.md`; design decisions are in `DESIGN_REFRESH.md`.

## Product goal

SymptomWatch helps 1–5-physician primary-care clinics catch follow-up loops that never closed: overdue return visits, lab results never documented, referrals with no outcome, and recurring symptoms without a plan. Every flag explains itself and is reviewed by a clinician. The current target is a credible demo for Orange County clinics. Real patient data is out of scope until the clinical deployment checklist is complete.

**Working agreement (2026-10-17):** we refine the *demo* until the product owner and Claude agree it looks and works right. Only then do we start building the real product.

## Completed

| Date | Milestone |
|---|---|
| 2026-10-17 | **v0.1 prototype.** All four phases; 153 Vitest + 27 Playwright tests passing. Pushed to GitHub (`main` at `d6f39c1`). Not deployed. |
| 2026-10-17 | **v0.2 items 1–3, on branch `v0.2` (local, not pushed).** CI workflow; blind Codex review and fixes; alert-fatigue controls; CSV import; Codex design rounds 1–3. 190 Vitest + 32 Playwright tests passing; `npm run check` green; evaluation unchanged. |

## Current milestone: v0.2, a pilot-ready demo

| # | Item | Status |
|---|---|---|
| 1 | Hardening: CI, blind Codex review + fixes, README cleanup | ✅ Done (CI runs once pushed) |
| 2 | Data on-ramp: CSV import (lab orders, referrals) | ✅ Done. Appointments import deferred until clinics ask for it |
| 3 | Alert-fatigue controls: snooze, structured dismissals, per-clinic rule settings, signal quality | ✅ Done |
| — | Design refresh with Codex (product owner request) | 🔄 Round 3 merged; iterating with the product owner until agreed |
| 4 | Hosted demo (Vercel + demo-only Supabase) | ⏸ Needs approval and the product owner's accounts |
| 5 | Customer discovery (interview guide + demo script for 5–10 clinics) | ⏸ Product owner-led; `DEMO_SCRIPT.md` updated for v0.2 |

## Next design round (candidates)

- Review workspace: keep the detail pane in view (sticky) while scrolling a long list; drop the repeated "Awaiting review" marker on every row in that tab.
- Product owner's own feedback on rounds 1–3 (pending).

## Open issues

- **Not independent evaluation:** the same author wrote the rules, labels, and engine. Codex's blind review checked the engine against the spec, not accuracy. External labelers are needed eventually.
- Migration `0005` (and the owner-compat blocks in 0006/0008) are untested on real Supabase.
- Known security limitations from the Codex review are listed in `SECURITY.md` (owner connection vs. arbitrary SQL, referral clinical columns under staff RLS, rate-limit proxy trust, dev outbox gating, flag-event actor attribution).
- Rate limits are in-memory; no email transport; custom auth (no MFA/SSO). Recommendation: keep built-in auth until real pilots require MFA or SSO.
- Rule limitations: R2 has no order-level linkage; R1 accepts any later encounter (`PRODUCT_SPEC.md` §6.5).
