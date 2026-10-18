# SymptomWatch — Product Specification (v0.1 prototype)

## 1. Positioning

SymptomWatch helps independent primary-care clinics (1–5 physicians, Orange County, CA) keep track of follow-up loops that are easy to lose: overdue follow-up visits, labs without documented results, referrals without specialist records, and recurring symptoms without a documented plan.

It is a **documentation and coordination aid**. It surfaces *possible documentation gaps* for clinician review. It does **not** diagnose, recommend treatment, rank clinical urgency, change care plans, or contact patients.

## 2. Personas

| Persona | Role | Primary jobs |
|---|---|---|
| Dr. Maya Rivera (fictional) | `physician` | Review flagged gaps, inspect timelines, confirm/dismiss flags, create clinical review tasks |
| Daniel Okafor (fictional) | `staff` (front desk) | Work the call/confirmation/records queue, record outcomes |
| Priya Shah (fictional) | `clinic_admin` (office manager) | Invite & manage staff, oversee throughput, audit log, reset demo |

## 3. Design system

Round 4 (October 2026, product-owner direction: blue + green, less "AI-looking"). History in `DESIGN_REFRESH.md`.

- Page `#F7F9FB`, cards white, surface `#EDF2F7`, borders `#D6DEE7`; ink `#0F2A43`, body `#36475A`, muted `#566577` (≥ 5.1:1 on every surface).
- **Blue `#1F5AA6`** for actions, links, focus, and the brand mark (white text 6.8:1). **Green `#1D7350`** (text) / `#14855A` (chart marks) for completed and documented states and the "Watch" in the wordmark. Amber `#80500F` on `#FBEFD9` for overdue/attention; red `#B03A2E` only for errors, never clinical urgency.
- Geist Sans throughout, semibold display headings with tight tracking; Geist Mono only for identifiers. No uppercase eyebrows, no mono step numbering, no serif/mono "editorial" pairing.
- Radii 6–16px; soft shadows on elevated surfaces (cards, the hero example); dividers inside.
- Motion (Framer Motion via `LazyMotion`): route enter transitions (`template.tsx` per route group; the app fades quickly), a staggered hero entrance, and one functional animation — a fictional flag moving Flagged → Reviewed → Followed up → Closed. Buttons press (`scale 0.97`). No scroll-triggered reveals. `MotionConfig reducedMotion="user"` plus explicit reduced-motion paths; e2e checks both the animated and reduced-motion homepage.
- WCAG 2.2 AA, visible focus rings, keyboard access; provenance labels keep text + icon (**Documented**, **Not documented**, **Rule-inferred · needs review**).

## 4. Public site (indexable)

Site map (round 5): header with animated dropdown menus — **Product ▾** (`/product` + section links), **How it works** (`/how-it-works`), **Safety ▾** (`/safety`, `/safety#evaluation`, `/privacy`), **Company ▾** (`/about`, `/contact`) — plus Sign in and Try Demo. Dropdowns are disclosure buttons (`aria-expanded`), open on hover intent or click, support ArrowDown/Escape, and close on outside click; on mobile they become an animated accordion in a sheet.

`/` homepage: plain hero + animated flag example; what SymptomWatch looks for (links to the rules); how it works (links to `/how-it-works`); shared-list preview; short safety disclosure (links to `/safety`, `/privacy`); walkthrough call-to-action (links to `/contact`).

- `/product` — explainable flags, follow-up queue, patient timeline, record import, detection rules (anchors `#flags`, `#queue`, `#timeline`, `#import`, `#rules`), each with a static product fragment built from the app's own badges.
- `/how-it-works` — four steps; the four rules with their default thresholds (rendered from `DEFAULT_RULE_SETTINGS` + `describeRule`, so the page can't drift from the engine); what the rules deliberately don't flag; who does what.
- `/safety` — fictional-data guard rails, clinic separation, readable detection, and `#evaluation`, which renders the latest evaluation numbers from `evaluation/results/latest.json` with the non-independence caveat.
- `/about` — the problem, what we're building, where it stands. `/contact` — the walkthrough request form (moved from the homepage).
- `/demo` (role picker), `/privacy` (prototype data policy), `robots.ts`, `sitemap.ts` (all public pages), Open Graph metadata.

## 5. Application (noindex, authenticated) — `/app/*`

Shell: left sidebar (collapsible to sheet on mobile), clinic name + DEMO badge, role badge, user menu (sign out), sticky demo banner, “View as” switcher in sandbox clinics.

### 5.1 Dashboard `/app`
Compact metric strip (each unlocked cell retains its destination): Total demo patients · Open follow-ups (open tasks) · Patients needing review (patients with ≥1 open flag; physician/admin only) · Overdue administrative tasks (due date < today, not completed) · Pending lab follow-ups · Pending specialist records · Tasks completed this week.
Front-desk staff see the cards they are permitted to see; clinical counts are replaced with a lock-state cell explaining the permission.
The patient worklist precedes historical charts. Charts: tasks opened vs. completed per week (last 8 weeks, line); open tasks by category (bar); open flags by rule (bar, clinical roles).
Patient table: search (name, demo MRN), filters (status: needs review / open tasks / no open items; primary physician), sortable columns, pagination; row click → timeline.

### 5.2 Follow-up queue `/app/queue`
Tabs/segments: All · Calls to make · Appointments to confirm · Missing specialist records · Other admin tasks · (Clinical review — physicians only).
Filters: status, assignee (incl. “Unassigned”, “Me”), due window (overdue / today / next 7 days / all).
Columns: task, patient, category, assignee, due date, status, actions.
Actions: create task (dialog), edit, assign, change status (`pending`, `in_progress`, `completed`, `needs_review`), record outcome (required when completing). Changes persist and are audited. Assignment only to active members permitted for that category.
Banner: “Prototype — no calls, emails or texts are sent to patients.”

### 5.3 Patient timeline `/app/patients/[id]`
Header: fictional name, demo MRN, age, sex, primary physician, care status, a single “Fictional patient record” caption.
Left/main: reverse-chronological (toggle to chronological) timeline grouping events by date: visits (with symptoms, follow-up recommendation), appointments (incl. no-shows, reschedules with reason), lab orders/results, referrals/records, tasks, flags, and **expected-but-not-documented** placeholders derived from flags’ `missingInfo`.
Right rail: open flags (each expandable: what, why, supporting evidence links that scroll to/highlight the timeline entry, missing/uncertain info, review status, rule id & version), outstanding tasks, active referrals, pending labs.
Physician actions on a flag: **Confirm gap** (optionally create a follow-up task), **Dismiss** (reason required), **Feedback** (verdict + comment).
Staff view: demographics, appointments, referral administrative status, non-clinical tasks; clinical sections show a permission notice.

### 5.4 Review queue `/app/review` (physician/admin)
Triage workspace (v0.2): a compact flag list beside the selected flag's detail (`?flag=<id>`), stacked on narrow screens. Tabs: Awaiting review · Snoozed · Gap confirmed · Dismissed · Resolved by new data · All; rule filter. Sorted by first detected date (not by urgency). “Run detection” with last-run metadata. Physician actions: confirm (+ optional task), **snooze** until a date (≤ 90 days; wakes early if evidence changes), **wake now**, dismiss with a **structured reason** (expected · addressed elsewhere · not clinically relevant · data error · other — note required for “other”), feedback.

### 5.5 Staff `/app/staff` (admin)
Members (role, status), change role, disable/enable (cannot remove last admin or self-demote last admin), invitations (create, copy link, revoke, status).

### 5.6 Audit log `/app/audit` (admin)
Filterable table (action, actor, date range), paginated.

### 5.7 Settings `/app/settings`
Clinic name, demo reset (admin, confirm dialog), data-handling notice, detection provider status (“Rule-based v1 · external AI disabled”).

### 5.8 Detection rules `/app/rules` (physician edits, admin reads) — v0.2
Per-clinic settings: turn each rule on/off; R1 grace (0–60 d, default 14), R2 grace (0–60, 7), R3 appointment grace (0–90, 14) and records wait (0–90, 14), R4 minimum visits (2–6, 2) and span (0–180 d, 28). Saving re-runs detection: flags that no longer qualify close as `resolved_by_data` with the note “No longer meets this clinic's rule settings”; a turned-off rule's open/confirmed flags become `suppressed` and return when it's turned back on. **Signal quality** table per rule: raised, awaiting, snoozed, confirmed, dismissed, resolved, confirm rate (confirmed ÷ reviewed), top dismissal reason — review outcomes, not clinical validation. The evaluation (`npm run evaluate`) always uses the engine defaults.

### 5.9 Import records `/app/import` (clinic admin, physician) — v0.2
CSV import of EHR report exports: **referrals** (admin or physician) and **lab orders** (physician only — recording a result closes a lab gap). Steps: choose a file (≤ 512 KB, ≤ 1,000 rows) or generate a sample export from the clinic's own fictional records → match columns (auto-matched from common EHR header names) → preview (new / update / no change / problem, per row, with reasons) → import.
- Patients are matched by **demo MRN within the current clinic only**; non-`DEMO-#####` identifiers are refused. An optional patient-name column is used only to catch wrong-patient rows (surname must match) and is never stored.
- Matching existing records: by source order/referral id when present, otherwise by (patient, test/specialty, order/referral date). Re-importing the same export is idempotent; source ids are saved for future matches.
- Statuses only move forward (lab: ordered → collected → resulted/cancelled; referral: sent → scheduled → seen → records received; declined/cancelled terminal). Dates already documented are never overwritten.
- Free text passes the PHI tripwire; future dates (except specialist appointments) and out-of-order dates are rejected.
- The commit re-validates on the server, writes the batch, rows, and audit entry in one transaction, and re-runs detection for the affected patients. Recent imports are listed with counts.

## 6. Detection rules (v1)

Common:
- `asOf` is injected. All windows are in days. Each rule has `ruleId`, `ruleVersion` (`1.0.0`), and configurable windows.
- **Global suppression:** patients with `care_status = transferred_out` produce no findings.
- Only `completed` encounters count as visits.
- A **future follow-up appointment** = appointment with `scheduled_for > asOf` and status `scheduled|confirmed` and purpose `follow_up`.
- Findings are phrased as documentation questions; no diagnosis, no urgency.

### R1 `overdue-follow-up` — follow-up visit appears overdue
Subject: the **most recent** completed encounter E with `follow_up_kind = 'interval'`.
- `due = E.occurred_at + follow_up_interval_days`
- Satisfied (no finding) if: any completed encounter after E, **or** a future follow-up appointment exists.
- Otherwise flag if `asOf > due + graceDays` (`graceDays = 14`).
- Evidence: E (recommendation), any no-show / cancelled / rescheduled appointments after E.
- Missing info: “No completed visit after {E.date}”, “No future follow-up appointment on file”.
- Encounters with `follow_up_kind` `as_needed` or `none` never trigger R1.

### R2 `lab-result-missing` — laboratory order without a documented result
Subject: each lab order L with status `ordered` or `collected`.
- `window = L.expected_within_days + graceDays` (`graceDays = 7`).
- Satisfied if: status `resulted` or `cancelled`; or a future appointment with purpose `lab_draw` exists **and** L.status = `ordered`.
- Otherwise flag if `asOf > L.ordered_at + window`.
- Missing info: `ordered` → “No specimen collection or result documented”; `collected` → “Specimen collected {date}; no result documented”.

### R3 `referral-outcome-missing` — specialist referral without a recorded outcome
Subject: each referral F with status `sent`, `scheduled`, or `seen`.
- `sent`: flag if `asOf > F.referred_at + F.expected_within_days + 14` (“No specialist appointment documented”).
- `scheduled`: if `specialist_appointment_at` is in the future → satisfied. If it is in the past by > 14 days with no records → flag (“Specialist visit date passed; no consult note received”). If missing date, treat as `sent`.
- `seen`: flag if > 14 days since `specialist_appointment_at` (or since `referred_at` if absent) with no records.
- `records_received`, `declined`, `cancelled` → never flagged.

### R4 `persistent-symptom-unresolved` — recurring symptom without documented follow-up plan
Subject: (patient, `symptom_code`).
- Candidate when the same `symptom_code` is observed at ≥ 2 completed encounters whose observation dates span ≥ 28 days.
- Satisfied if **any**:
  - latest observation status is `resolved`, `improving`, or `chronic_managed`;
  - a lab order or referral with matching `symptom_code`, dated on/after the first observation, with status not `cancelled`;
  - a future follow-up appointment exists;
  - the latest encounter with that observation has `follow_up_kind = 'interval'` and its R1 due date (+grace) has not yet passed.
- Otherwise flag. Evidence: all observations of the code; missing: “No resolution, management plan, work-up, or scheduled follow-up documented for {label}”.
- Matching is exact on `symptom_code` (a known limitation — synonyms are not merged in v1).

### 6.5 Shared semantics & clarifications (adopted after Codex review)
- **Day arithmetic:** all comparisons use UTC calendar days: `daysBetween(a, b) = floor(utcDay(b) − utcDay(a))`. A window *passes* only when `daysBetween(start, asOf) > window` (strictly greater). `due + grace` equal to today is **not** flagged.
- **Point-in-time snapshot:** records whose event date is after `asOf` are ignored (encounters, observations, lab orders, referrals) — except appointment `scheduled_for` and referral `specialist_appointment_at`, which may legitimately be in the future.
- **Encounters** have `status` (`completed` | `cancelled`); only `completed` count. R4 counts **distinct encounters**.
- **R2** future lab draw = appointment purpose `lab_draw`, status `scheduled|confirmed`, `scheduled_for > asOf`. There is no order-level linkage in v1, so any such draw suppresses all `ordered` labs for that patient (documented limitation).
- **R4** work-up evidence must be dated on/after the first observation in the candidate set; referrals with status `declined` or `cancelled` and labs `cancelled` do **not** count.
- **R1** limitations kept for v1: *any* later completed encounter satisfies the recommendation; a future follow-up appointment satisfies it regardless of how far out.
- Ties on the same day: an encounter on the same day as E does not count as “after E”.
- **Clarified after the blind Codex review (2026-10-17):** R3 is suppressed whenever `records_received_at ≤ asOf`, whatever the status says; R2/R3 never cite an ordering/referring encounter dated after `asOf`; R2 treats status `collected` as documented collection even without a `collected_at` date (“date not recorded”). Evaluation metrics were unchanged by these fixes.

### 6.6 Flag lifecycle
- `fingerprint = ruleId + ":" + subjectType + ":" + subjectId` (stable subject identity). `evidence_hash` = SHA-256 of the canonical (sorted) evidence ids + missing-info codes.
- On a **successful, complete** detection run for a clinic (serialized per clinic with `pg_advisory_xact_lock`):

| Current state | Finding present | Finding absent |
|---|---|---|
| (none) | create `open` | — |
| `open` | update evidence / `last_detected_at` | → `resolved_by_data` |
| `confirmed` | keep `confirmed`, update evidence | → `resolved_by_data` |
| `dismissed` | stay `dismissed` if `evidence_hash` unchanged; otherwise → `open` (event `reopened_evidence_changed`) | stay `dismissed` |
| `resolved_by_data` | → `open` (event `reopened`) | stay |

- If a rule's `ruleVersion` changes, existing flags keep their history; the new finding updates `rule_version`.
- Every transition and review writes an append-only `flag_events` row (`created`, `updated`, `confirmed`, `dismissed`, `reopened`, `reopened_evidence_changed`, `resolved_by_data`, `feedback`) with actor, timestamp, note. The flag row stores only the current state.
- **Confirm + create task** is one transaction and idempotent (at most one open task per `source_flag_id`).
- A failed run changes nothing (single transaction).
- **v0.2 additions.** *Snooze* is an overlay on `open` (columns `snoozed_until/by`, `snooze_note`): snoozed flags leave the Awaiting tab and dashboard counts until the date; a run that changes the evidence clears the snooze (event `unsnoozed`, “record changed”). *Suppressed* is a status for flags whose rule the clinic turned off: `open|confirmed` + rule off → `suppressed` (event `suppressed`); `suppressed` + rule on → `open` if the finding is present, else `resolved_by_data`. Dismissals record `review_reason`. A dismissed flag with unchanged evidence still gets its `rule_version` updated. Physician reviews take the same per-clinic advisory lock as detection runs, so a run can't overwrite a review it read before commit.

### 6.7 Evaluation units (pre-declared)
`evaluation/reference-labels.ts` enumerates **every** evaluation unit with an expected label, independent of engine output:
- R1: per patient, the most recent completed encounter in which the clinician asked for a time-bound return visit (structured *or* free-text, as judged by the labeler).
- R2: every lab order. R3: every referral.
- R4: every (patient, symptom concept) observed at ≥ 2 distinct encounters, identified by the code of the *first* observation (synonyms such as “fatigue”/“tiredness” are one concept).
- Engine findings that match no declared unit are counted as FP and listed as `unlisted predictions`.
- Metrics: TP/FP/FN/TN per rule and overall; precision = TP/(TP+FP), recall = TP/(TP+FN), F1, FPR = FP/(FP+TN); `null` (“n/a”) when a denominator is 0. Patient-level: positive if any unit positive / any finding emitted.

## 7. Synthetic dataset & evaluation

- ≥ 30 fictional patients across two clinics, authored as scenarios in `src/data/synthetic/` with dates relative to a reference date, plus stable `seed_key`s.
- Reference labels (`evaluation/reference-labels.ts`) are authored **by clinical judgment of whether a real follow-up documentation gap exists**, *before* the engine is implemented, and intentionally include cases where the literal v1 rules are expected to disagree (synonym symptoms, free-text-only plans, results filed under a different order, etc.).
- `npm run evaluate` runs the real engine at the fixed reference date and reports per-rule and overall TP/FP/FN/TN, precision, recall, F1, false-positive rate (FP / (FP + TN) over candidate units), plus patient-level metrics. Results written to `evaluation/results/latest.json` and `evaluation/RESULTS.md`.
- `research/verify_metrics.py` recomputes metrics independently from the exported predictions and labels.

## 8. Non-goals (v0.1–v0.2)

Real EHR integration, real patient messaging, e-prescribing, billing, clinical decision support, urgency triage, LLM inference on any data, mobile apps.
