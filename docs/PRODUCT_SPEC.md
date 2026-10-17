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

- Background white `#FFFFFF`; surface `#F6F8FB`; borders `#E3E8EF`.
- Typography navy `#0B1F3A` (headings), slate `#334155` (body), muted `#64748B`.
- Primary blue `#1D5FD1` (actions), teal `#0E9F8E` (positive / completed / brand accent), amber `#B45309` text on `#FEF3C7` (needs attention), red reserved for destructive actions & errors only — **never** used to imply clinical urgency.
- Font: Inter (or Geist) via `next/font`; tabular numerals for metrics.
- Radius: 12px cards, 10px inputs/buttons, pill badges.
- WCAG 2.2 AA contrast, visible focus rings, ≥44px touch targets on mobile, `prefers-reduced-motion` respected.
- Provenance badges, used consistently on timeline and flags:
  - **Documented** (solid teal-outline, check icon) — an event recorded in the chart.
  - **Not documented** (dashed slate outline, question icon) — an expected event with no record.
  - **Rule-inferred** (blue outline, sparkle/scan icon) — produced by the detection engine; always shows “Possible gap — needs clinician review”.

## 4. Public site (indexable)

`/` homepage:
1. Header: logo (shield + pulse-line mark, “SymptomWatch”), nav (Product, How it works, Safety, Contact), **Sign in**, **Try Demo** (primary).
2. Hero: headline (“Close the follow-up loops that slip through the cracks.”), subcopy, **Try Demo**, **Create Demo Account**; product preview (rendered dashboard mock built from real components, not a stock image).
3. Demo disclaimer strip.
4. Three benefits: *Never lose a follow-up loop* · *Explainable flags, clinician in control* · *Built for small-clinic workflows*.
5. How it works (3 steps) with timeline preview.
6. Product previews: follow-up queue, patient timeline, flag explanation.
7. Safety & privacy section: synthetic-data-only, no patient contact, no external AI, not HIPAA-certified yet.
8. Demo request form (name, work email, clinic name, role, clinic size, message) → stored; success message; no emails sent.
9. Footer with disclaimer.

Also: `/demo` (role picker), `/privacy` (prototype data policy), `robots.ts`, `sitemap.ts`, Open Graph metadata.

## 5. Application (noindex, authenticated) — `/app/*`

Shell: left sidebar (collapsible to sheet on mobile), clinic name + DEMO badge, role badge, user menu (sign out), sticky demo banner, “View as” switcher in sandbox clinics.

### 5.1 Dashboard `/app`
Overview cards (each links to a filtered view): Total demo patients · Open follow-ups (open tasks) · Patients needing review (patients with ≥1 open flag; physician/admin only) · Overdue administrative tasks (due date < today, not completed) · Pending lab follow-ups · Pending specialist records · Tasks completed this week.
Front-desk staff see the cards they are permitted to see; clinical counts are replaced with a lock-state card explaining the permission.
Charts: tasks opened vs. completed per week (last 8 weeks, line); open tasks by category (bar); open flags by rule (bar, clinical roles).
Patient table: search (name, demo MRN), filters (status: needs review / open tasks / no open items; primary physician), sortable columns, pagination; row click → timeline.

### 5.2 Follow-up queue `/app/queue`
Tabs/segments: All · Calls to make · Appointments to confirm · Missing specialist records · Other admin tasks · (Clinical review — physicians only).
Filters: status, assignee (incl. “Unassigned”, “Me”), due window (overdue / today / next 7 days / all).
Columns: task, patient, category, assignee, due date, status, actions.
Actions: create task (dialog), edit, assign, change status (`pending`, `in_progress`, `completed`, `needs_review`), record outcome (required when completing). Changes persist and are audited. Assignment only to active members permitted for that category.
Banner: “Prototype — no calls, emails or texts are sent to patients.”

### 5.3 Patient timeline `/app/patients/[id]`
Header: fictional name, demo MRN, age, sex, primary physician, care status, “Synthetic record” badge.
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
