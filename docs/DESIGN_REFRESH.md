# Design refresh, round 1

Implemented on `design-refresh`, October 17, 2026. This is a visual/copy change with the existing routes, actions, data, permissions, and metric definitions preserved. Review and queue source directories are untouched.

## System and rationale

Warm paper and deep green ink give the product the quiet hierarchy of a medical chart. Teal is reserved for links, actions, focus, and selected states. It relates to the clinical setting without using bright blue on every surface. Status labels retain words and icons; color never implies clinical urgency.

Source Serif 4 is loaded by `next/font/local` from the installed package's Latin variable WOFF2. Geist Sans remains the UI/body face; Geist Mono and tabular numerals identify dates, MRNs, and counts. There is no external font request at build or runtime. Display headings use weight 400, 1.08 leading, and 36/48/60px sizes. Section headings use 30/36px; UI emphasis uses 500/600. The root page title now describes follow-up coordination for small clinics.

Radii are 4–6px. Static cards lose their shadows. Dividers separate metrics, table rows, timeline entries, patient side sections, and demo roles. The logo and favicon use solid teal. Shared form controls in the protected queue/review flows retain their local styles; auth and patient controls receive scoped radius adjustments.

Calculated sRGB relative-luminance contrast ratios (not a substitute for rendered axe checks):

| Use | Foreground | Background | Ratio |
|---|---|---|---|
| Heading / paper | `#20332F` | `#FBFAF7` | 12.77:1 |
| Body / paper | `#3D4D46` | `#FBFAF7` | 8.57:1 |
| Muted / paper | `#59645F` | `#FBFAF7` | 5.90:1 |
| Muted / inset | `#59645F` | `#F0EFE9` | 5.34:1 |
| Primary action | `#FFFFFF` | `#17665B` | 6.80:1 |
| Teal / selected tint | `#17665B` | `#E7EFEB` | 5.81:1 |
| Overdue / needs review | `#85521E` | `#F6ECD6` | 5.55:1 |
| Completed | `#35634C` | `#E9F0E7` | 5.95:1 |
| Error / paper | `#A5362B` | `#FBFAF7` | 6.36:1 |
| Input boundary / paper (non-text) | `#88948D` | `#FBFAF7` | 3.02:1 |

Hairlines use `#D4D8D0`; chart grids `#E2E4DC`. Charts use ink `#20332F` and green `#39705C`, linear 1.5px lines, a dashed completion series with a matching legend, and 10px square-ended bars. All existing data-table alternatives remain.

## Page and copy inventory

- **Homepage:** replaced the old slogan hero, benefit cards, timeline section, and dark safety cards with one existing fictional referral case. New headline: “The referral was sent. The consult note never arrived.” William Foster's story matches `hv-08`: referral at day −90, specialist appointment at day −50, no received records. The figure labels evidence, missing information, and the referral rule, identifies its June 1, 2026 snapshot, and explicitly requires clinician review. It does not claim the specialist visit happened.
- **Homepage workflow:** “A flag is a question for the chart.” Steps are “Read the evidence”, “Make the review decision”, and “Give the work an owner”, with plain explanations of confirmation, dismissal, assignment, and recorded outcomes.
- **Homepage product section:** “A working list for the people who follow up.” Role-specific copy explains staff, physician, and administrator access. The queue uses existing preview data; captions replace per-row fictional chips. Removed fake browser controls, decorative dashboard navigation, and the standalone marketing timeline preview.
- **Homepage safety:** “Before you try it.” Prose retains fictional-only data, lack of clinical validation and HIPAA compliance, prohibition on real patient information, no patient contact, and disabled external AI. Adds the existing policy's explicit limit on free-text checks and retains clinical non-goals. The global demo banner and footer disclosures are unchanged.
- **Homepage contact:** “Show us how your clinic handles follow-up.” Copy asks Orange County practices where follow-up work lives and explicitly says requests are stored without sending email. Form labels, validation, success message, and submission behavior are unchanged. CTAs and navigation labels/destinations remain unchanged.
- **Global metadata:** default title changes from the slogan to “SymptomWatch — Follow-up coordination for small clinics”; browser theme color becomes paper.
- **Auth:** sign-in, sign-up, forgot-password, reset-password, and valid invitation headings adopt the serif system. The sidebar now says “The demonstration clinic” / “A place to work through the follow-up.” Supporting copy describes reviewing a lab, checking a referral, and assigning a records request. All fictional-data, no-contact, external-AI, clinical-validation, and HIPAA disclosures remain. Existing form and action copy is unchanged. Shared-login rows use separators.
- **Demo:** role cards become divided rows. “We'll spin up…” becomes “Explore a private sandbox…”; the staff restriction is stated as “Sees administrative detail only; clinical notes are restricted.” The lower notice says “Fictional data only. Do not enter real patient information.” Session privacy, expiration, persona names, capabilities, role actions, and account link retain their meaning.
- **Privacy:** removes the “Trust” eyebrow; title gains serif typography and sections gain rules. “Not HIPAA-compliant — yet” becomes “Not HIPAA-compliant”; one em-dash becomes a colon. No policy promises or requirements change.
- **Dashboard:** overdue administrative work leads the metric strip; total patients appears last. All seven labels, values, hints, permission states, and destinations are retained. Description now says “Review open work, then assign the next follow-up.” Chart explanation now says “Counts do not indicate urgency. Every flag needs physician review.” Patient worklist moves before historical charts. Decorative chips and arrows are removed.
- **App shell:** quiet sidebar selection with a left rule, unboxed clinic identity, plain role caption, and a narrower sidebar. Navigation, account menu, view-as controls, and every-page demo banner remain.
- **Patients:** list keeps “All records fictional” once and removes per-row chips. MRNs use mono; review counts become plain text. Filters and pagination retain behavior; controls have 44px height. Detail header uses “Fictional patient record” instead of the chip. Timeline entries and side sections use dividers, with provenance, expected/missing distinctions, evidence highlighting, links, and every action preserved.

## Test changes

- `tests/e2e/public.spec.ts`: updates the homepage test name and heading assertions for the case/workflow/product/disclosure sections, preserving all link and demo-banner assertions. Updates the privacy heading assertion to remove “yet”. Adds explicit assertions for all five core safety disclosures. Line-break-tolerant expressions allow responsive heading wraps without changing the asserted wording.
- `tests/components/primitives.test.tsx`: removes the obsolete decorative `icon` prop/import from the locked-metric test. The permission-text and hidden-value assertions remain unchanged.

## Verification and handoff

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: 17 files / 150 tests passed. The wire-protocol suite fails during setup with `listen EPERM: operation not permitted 127.0.0.1`; its 3 tests do not run. No test is disabled or weakened to bypass the sandbox.
- `npm run test:e2e`: attempted. The initial attempt exposed an unavailable font CSS entry point, corrected to an existing local WOFF2 through `next/font/local`. The subsequent attempt reaches CSS processing and fails because Turbopack cannot bind a local port (`Operation not permitted`). Playwright, axe, production rendering, responsive screenshots, and visual review remain unverified.
- Direct Tailwind compilation and Lightning CSS optimization: passed (3,486 scanned candidates), without a server or port binding. This checks stylesheet compilation, not browser rendering.
- `git diff --check`: passed. No edits under `src/lib`, `db`, `evaluation`, `research`, `scripts`, or review/queue source directories. Evaluation output was not regenerated, respecting this round's scope.

Round 2 should redesign the review/queue work surfaces with the other stream, review evidence density on small screens, and tune spacing/chart labels after actual desktop/mobile screenshots. Verify all rendered color states with axe before merging.

## Commit handoff

Git staging was attempted, but the sandbox refuses creation of `/Users/Jacob/Projects/symptomwatch/.git/worktrees/design-refresh/index.lock`. No commits were created and all edits remain in the worktree. The task's approval policy does not allow an escalation.

Suggested logical commits when Git metadata is writable:

1. `Establish paper and teal design system with case-led marketing` — tokens, fonts, brand, shared button, marketing/auth pages, public e2e copy assertions.
2. `Prioritize follow-up work in dashboard and patient records` — shell, metric strip, charts, patient list/detail/timeline, locked-metric test update, and project documentation.

End each commit message with `Co-Authored-By: Codex <noreply@openai.com>`.

## Round 2

- **Sidebar:** a full-page background column now contains sticky, independently scrolling `h-svh` content, capped below the demo banner. Extra bottom padding keeps the disclosure clear of the development indicator.
- **Timeline and typography:** event toggles distinguish visible types with checkmarks and teal borders; hidden types have empty indicators and paper backgrounds. Existing multi-select behavior and `aria-pressed` remain. Dates and metric counts use Geist Sans with tabular numerals; Mono is reserved for MRNs and rule versions.
- **Homepage:** below 640px, the working-list preview stacks each task, category, patient, and status. The fixed minimum table width is removed. Below-hero spacing is reduced by 25% (30% for the desktop contact section), with a consistent 1:2 column grid and smaller gutters. The case-led hero, flag anatomy, KPI strip, disclosures, and local fonts remain.
- **Queue:** replaces the card frame with dividers, wraps view tabs, simplifies status badges, and uses one fictional-record caption. Overdue dates have an amber-token label with a clock icon and “Overdue” text. All views, filters, links, permissions, dialogs, and action logic are retained.
- **Scope:** no route, data, dependency, or business-logic changes. Review source directories are untouched. No staging or commit attempted; changes are ready for Claude to commit.

Verification: `npm run typecheck` and `npm run lint` passed. `npm test` finished with 17 files / 150 tests passing; the wire-protocol suite failed setup with `listen EPERM` on localhost, leaving its 3 tests skipped. Direct Tailwind / Lightning CSS compilation and `git diff --check` passed. Calculated changed-state contrast meets AA: selected text 8.16:1, unselected text 8.57:1, control boundary 3.02:1, and overdue text 5.55:1.

Browser verification remains outstanding: the sandbox rejected the dev server's localhost port, and a separate Playwright Chromium launch failed with a macOS permission error. Actual 390px rendering (including hero/anatomy fit and absence of horizontal scroll), long-page sidebar scrolling, and rendered axe checks could not be verified here.
