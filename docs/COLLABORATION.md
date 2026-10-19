# Claude ↔ Codex collaboration log

SymptomWatch is built by two AI agents working under a human product owner.

| Agent | Role |
|---|---|
| **Claude** (Anthropic, Claude Code) | Architecture, product requirements, UX design, synthetic dataset & reference labels, code review, security/clinical-safety review, documentation, integration and verification |
| **Codex** (OpenAI, via the `claude-codex-bridge` MCP server: `codex_implement`, `codex_review_plan`, `codex_review_code`, `codex_query`) | Implementation of frontend, backend, database, auth, detection engine, tests, bug fixes |

## Ownership (to avoid simultaneous edits)

| Path | Owner |
|---|---|
| `docs/**` (except generated results), `src/data/synthetic/**`, `evaluation/reference-labels.ts` | Claude |
| Everything else (`src/app`, `src/components`, `src/lib`, `db/`, `scripts/`, `tests/`, `evaluation/*.ts` runners, `research/`) | Codex (Claude edits only after a Codex task has returned, during review/fix passes) |

Codex tasks run one at a time and synchronously; Claude does not modify Codex-owned files while a Codex task is running. Each phase is developed on its own branch (`phase-N-*`) and merged into `main` locally after Claude's review, tests, and a working local run. **Nothing is pushed or deployed without the product owner's authorization.**

## Label independence

The reference labels used to evaluate detection were written by Claude from the scenario narratives *before* the engine was implemented, and Codex was instructed not to read `evaluation/reference-labels.ts` while implementing the rules. This reduces — but does not remove — the optimism of evaluating rules and labels produced by the same team. See `evaluation/RESULTS.md` for limitations.

## Log

Entries are appended as work proceeds.

### 2026-10-16 — Phase 0/1: plan, contracts, database foundation

- **Bridge status.** Verified the `codex` MCP server (claude-codex-bridge). Read-only tools work (`codex_query`, `codex_review_plan`). Write tools are blocked by a bridge bug: `codex_implement` passes `--full-auto`, which Codex CLI 0.163 rejects, and every call after the first resumes the original thread without re-sending `--sandbox`, so later calls are stuck read-only. Workaround: implementation tasks were run with the Codex CLI directly (`codex exec --sandbox workspace-write`).
- **Codex — plan review** (`codex_review_plan`): 11 prioritized findings (hosted PGlite, RLS trust model, write policies, Next 16 caching, runtime spike, auth semantics, contracts, rule ambiguities, flag state machine, evaluation denominators, omitted deliverables). Claude adopted them in ARCHITECTURE §14 and PRODUCT_SPEC §6.5–6.7.
- **Claude:** architecture, product spec, detection contract (`src/lib/detection/types.ts`), the 36-patient synthetic dataset, 37 queue tasks, and 79 pre-declared reference labels — all written before any engine code.
- **Codex — task C2 (database foundation):** SQL migrations (schema, `sw_app` role, RLS policies, SECURITY DEFINER helpers, review-protection trigger), PGlite/postgres client with init promise and lock file, migrator, `withTenant`/`withSystem`, Drizzle schema, password hashing, env validation, seeder, snapshot builders, scripts, and 49 tests. Codex hit its **usage limit** before running the test suite.
- **Claude — review & fixes to C2:** the test fixture schema mismatch (`tasks.due_date` default) that failed 23 tests; replaced a font import from a private Next.js internal path with the `geist` package; scrypt hashed once per seed instead of once per account; production env guard scoped to serverless hosts so local `npm start` works; `.env.example` + `npm run setup`; migrations bundled into a generated module (removes whole-project file tracing on Vercel) with a drift test. Result: 50/50 tests, clean typecheck/lint/build, production server health check verified.
- **Decision (product owner):** with Codex's quota exhausted, Claude continues implementation alone and uses Codex for read-only code reviews when quota is available.

### 2026-10-16/17 — Phases 1–4 (Claude implementing; Codex quota exhausted)

- **Phase 1:** design system, public site, demo-request form with PHI tripwire, security headers, robots/sitemap.
- **Phase 2:** local auth (sessions, reset, invitations), sandboxes and view-as, permission guards, dashboard and charts, patient list and role-aware timeline, follow-up queue, staff and audit, settings and demo reset.
- **Phase 3:** rule engine implemented by Claude from PRODUCT_SPEC §6 (the spec and the reference labels were committed before engine code, but Claude had authored the labels — this is disclosed in `evaluation/RESULTS.md`), flag lifecycle, review workflow, evaluation runner, Python verifier.
- **Phase 4:** Playwright e2e + axe suite, postgres wire-protocol test, hosted-Postgres compatibility migration, documentation.
- Bugs found by Claude's own review and tests (fixed): partial-commit on invitation race, missing `users` grant for tenant name lookups, re-confirm overwriting review notes, single-patient refreshes shown as "last run", prerender clock usage in session checks, React form auto-reset losing input, contrast below AA.
- **Pending:** an independent Codex review of the engine against PRODUCT_SPEC §6 *without* reading the labels, and a security review of the RLS migrations, once Codex quota is available.

### 2026-10-17 — Design refresh, round 1 (Codex)

- Adopted a paper/ink/teal system, local Source Serif 4 display typography, 4–6px radius tokens, and divider-led layouts.
- Rebuilt marketing around the existing William Foster referral scenario and an annotated flag. Preserved safety disclosures and rewrote generic copy. Updated auth, demo, privacy, app shell, dashboard, charts, patient list and detail.
- All seven dashboard metrics retain semantics, links and role restrictions. Queue/review source directories and service/data code are untouched.
- Typecheck/lint passed; 150 tests passed. Three wire-protocol tests and production/e2e are blocked by sandbox localhost-binding restrictions. Claude must run full test/axe and visual review before merge. Detailed copy and verification inventory: `DESIGN_REFRESH.md`.
- Git staging/commit blocked: the sandbox refuses the parent repository worktree `index.lock`. All edits remain uncommitted; the proposed two-commit split and required co-author trailer are recorded in `DESIGN_REFRESH.md`.

### 2026-10-17 — v0.2 (Claude + Codex, Superpowers process)

- **Process.** Product owner approved v0.2 items 1–3 and asked for a parallel design refresh by Codex. Installed the Superpowers plugin (`superpowers@claude-plugins-official`, v7.0.0); applied its worktree, TDD (tests first, watched fail), and verification-before-completion practices. Codex ran in an isolated worktree (`.worktrees/design-refresh`); its sandbox can't write the worktree's git index, so Claude committed each round after browser review, e2e, and axe.
- **Codex — blind review** (read-only; did not open labels, results, synthetic data, or research): 3 high, several medium findings. Fixed: cross-clinic account takeover via admin reset links, stale view-as sessions, invitation race / membership modification, reset-token reuse, review-vs-detection race, R3 ignoring documented records, future encounters in R2/R3 evidence, dismissed rule-version updates, collected-without-date wording. Recorded as known limitations: owner connection + writable GUCs vs. arbitrary SQL, staff row access to referral clinical columns, proxy-trusting rate limits, dev outbox gating, flag-event actor attribution. Evaluation metrics unchanged.
- **Codex — design rounds 1–3:** paper/ink/teal system, case-led homepage, KPI strip, queue and patient restyle, review triage workspace (list + detail), rules page; e2e for snooze and structured dismissals.
- **Claude:** alert-fatigue controls (snooze, structured dismissal reasons, per-clinic rule settings, suppressed status, signal quality), CSV import (lab orders, referrals), CI workflow, migrations 0006–0008, docs.
- **Mistake caught:** one commit (8cf4493) went in with a failing database test because a shell `&&` chain checked `grep`'s exit status, not Vitest's. The failure was a deliberate RLS widening for admin lab imports; on reflection that weakened a clinical-safety boundary, so lab imports became physician-only and the original RLS was kept (63709ae).


### 2026-10-19 — Design round 6 (Claude + Codex) and round 7 plan

- **Claude:** implemented the owner's "not AI-generated" brief with a Linear reference: scoped light/dark token system, dark public site, engine-backed hero product shot, restyled pages and auth, light app polish, plus three review fixes (marketing counts now match the dashboard, 4-metric dashboard, no repeated status on review rows).
- **Codex (refinement pass, main tree):** spacing rhythm, tablet layouts, focus and target sizes, LoopDemo pause/replay, six interaction tests. Claude reversed two removals that contradicted explicit owner asks (hero tilt, track line draw) and restored a short dropdown fade.
- **Joint review for round 7:** Codex did a blind read-only review from 28 screenshots plus source; Claude did web research on small-practice adoption barriers and loop-closure evidence. Agreed findings and owner decisions are in `ROADMAP.md`.
- **Owner direction:** published SymptomWatch will hold real clinic data (CSV uploads), so publishing is gated on the clinical deployment checklist; native apps come later. Not ready to publish; refinement continues.

### 2026-10-19 — Round 7 (Claude + Codex in parallel)

- **Claude:** web research (adoption barriers; verified the Casalino 2009 loop-closure figure via NCBI); site batch A and accessibility batch C; reviewed and merged Codex's branch; fixed the confirm-gap default owner; aligned marketing metrics with the new dashboard definitions; ran full check and e2e.
- **Codex:** blind design review (top-12 ranked findings), then app batch B in `.worktrees/app-workflow` (35 files, unit/integration/e2e coverage). Its sandbox can't run Playwright or the Postgres wire tests; Claude ran both.
- **Mistakes caught:** Claude's own copy overstated in-app recording and understated storage (fixed before commit); Codex's default owner put front-desk work on physicians (fixed); stale dev-server CSS cache after an e2e build (restart with `.next/dev` cleared).

### 2026-10-19 — Batch D and the onboarding design

- **Codex:** batch D app polish in the worktree; hit its usage limit after the code and tests were complete (no report written). Claude verified tenant safety, ran the full suite (240 + e2e 50/50) and merged.
- **Claude:** site items (privacy wording, contact inputs, full-size link); wrote the clinic-onboarding design from the owner's idea.
- **Codex (read-only):** security review of the design — found an existing risk (manager-issued password resets would let a non-clinical manager take over a physician account) and gaps in RLS replacement, approval atomicity, pending sessions, OIDC binding and the last-manager guard. All folded into the design before owner approval.
- **Owner decisions:** code + one-click approval; job role separate from manager; manager can grant physician access alone (visible to physicians); verify applicants both in person and by email (dev outbox); revoking a code declines pending requests; Google sign-in and `oauth4webapi` approved.
