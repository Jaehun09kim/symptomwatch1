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

Round 1 (October 2026): an editorial, clinical-instrument treatment. See `DESIGN_REFRESH.md` for palette contrast calculations, copy inventory, and verification limits.

- Warm paper `#FBFAF7`, inset surface `#F0EFE9`, hairline borders `#D4D8D0`.
- Deep ink `#20332F`, body `#3D4D46`, muted text `#59645F`.
- Clinical teal `#17665B` for actions and focus; white button text. Amber `#85521E` on `#F6ECD6` for overdue administrative work / needs review; green `#35634C` on `#E9F0E7` for completion. Error red `#A5362B` never implies clinical urgency.
- Source Serif 4 for marketing/auth display headings and dashboard numbers; Geist Sans for UI/body; Geist Mono and tabular numerals for identifiers, dates, counts. All fonts come from installed local packages. No Google Fonts requests.
- Display sizes 36/48/60px, section headings 30/36px, body 16/18px, UI 12/14px. Display weight 400, UI emphasis 500/600. Display leading 1.08.
- Radius tokens 4–6px. Static surfaces use dividers and borders without elevation. Legacy review/queue layouts inherit tokens; restructuring is deferred to round 2.
- WCAG 2.2 AA contrast, visible focus rings, keyboard access, labelled scroll regions, and reduced-motion support remain required.
- Provenance retains text and icons: **Documented**, **Not documented** (dashed), **Rule-inferred · needs review**. The timeline uses small rectangular labels; review components retain their existing markup.

## 4. Public site (indexable)

`/` homepage:
1. Header: single-color shield + pulse mark, “SymptomWatch”, Product / How it works / Safety / Contact, Sign in, Try Demo.
2. Case-led hero: “The referral was sent. The consult note never arrived.” William Foster's fictional gastroenterology referral from the existing dataset, with Try Demo / Create Demo Account.
3. Annotated “Anatomy of a flag”: evidence dates, missing records, referral rule/version, fixed snapshot date, physician review explanation. No simulated browser controls.
4. Workflow as numbered rows: read evidence, make a review decision, assign follow-up work.
5. Full-width queue fragment using the existing synthetic preview counts and tasks; one fictional-data caption.
6. Prose disclosure: fictional data only, not clinically validated, not HIPAA-compliant, no diagnosis/treatment/urgency ranking/care-plan changes, no patient contact, external AI disabled.
7. Demo request form (same fields and behavior) with specific small-clinic copy and a clear no-email disclosure.
8. Footer with existing prototype disclaimer.

Also: `/demo` uses three divided role rows with existing actions; `/privacy` uses a ruled policy document layout. `robots.ts`, `sitemap.ts`, and Open Graph behavior are unchanged.

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
All open flags across patients, filter by rule/status/physician, sorted by first detected date (not by urgency). “Run detection” button with last-run timestamp.

### 5.5 Staff `/app/staff` (admin)
Members (role, status), change role, disable/enable (cannot remove last admin or self-demote last admin), invitations (create, copy link, revoke, status).

### 5.6 Audit log `/app/audit` (admin)
Filterable table (action, actor, date range), paginated.

### 5.7 Settings `/app/settings`
Clinic name, demo reset (admin, confirm dialog), data-handling notice, detection provider status (“Rule-based v1 · external AI disabled”).

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

## 8. Non-goals (v0.1)

Real EHR integration, real patient messaging, e-prescribing, billing, clinical decision support, urgency triage, LLM inference on any data, mobile apps.
