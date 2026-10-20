# Clinic demonstration script (~10 minutes)

Audience: a physician-owner, office manager, or front-desk lead at an independent primary-care clinic.
Goal: show that SymptomWatch makes open follow-up loops visible, explains every flag, and keeps clinicians in control.

**Before you start:** `npm run db:reset && npm run dev` (or open the hosted demo). Open two browser windows: one regular, one private.
Say up front: *"Everything you'll see is fictional — invented patients, invented records. This is a prototype, not a certified medical system."*

---

## 1. The problem (1 min) — homepage
- Open `/`. Point to the headline and the three benefits.
- *"In a small practice, follow-up lives in sticky notes and memory: the patient who no-showed, the lab nobody drew, the specialist note that never came back. SymptomWatch puts those loops in one place."*
- Scroll to **Safety & privacy**: synthetic data only, no patient messaging, no external AI.

## 2. The physician's morning (3 min)
1. Sign in as **Dr. Maya Rivera** — `physician@harborview.demo.test` / `SymptomWatch-Demo-2026` (or click **Use** next to her name).
2. **Dashboard:** start with *Review next* (the oldest open flags), then the four cards — overdue admin tasks, patients needing review, lab gaps awaiting review, open records requests; each opens exactly what it counts. Note the throughput chart and *"Show data table"*.
3. Open **Review flags**. *"These aren't diagnoses or urgency scores — they're documentation questions, listed by when they were found."*
4. Open the **Rachel Kim** flag (*No documented follow-up visit…*). Walk through **Why flagged**, **Supporting entries**, and **Missing or uncertain**.
5. Click a supporting entry → the patient timeline opens with that entry highlighted. Point out the three labels: **Documented**, **Not documented**, **Rule-inferred · needs review**.
6. Back on Review: **Confirm gap** → leave *"Create a follow-up task"* checked → type *"Reach patient to rebook"*, type *Call to make*, assign **Daniel Okafor** → Confirm.
7. Pick a referral flag → **Snooze** two weeks with *"Specialist office says the note is coming"*. It moves to the **Snoozed** tab. *"If the record changes before then, it comes back on its own."*
8. Open **Detection rules**: *"If a rule is too noisy for your clinic, a physician can lengthen its grace period or turn it off. Signal quality shows how often each rule's flags were confirmed versus dismissed, and why."*

## 2b. Bring in an export instead of re-typing (2 min)
1. Still as Dr. Rivera: **Import records → Lab orders → Use a sample export from this clinic.** *"This is what a lab-orders report out of your EHR looks like."* Optionally click **Download this file** to show the raw CSV.
2. Point at **Match columns**: familiar headers matched automatically, with the first row beside each field.
3. **Preview import**: walk through *Update* (results now on file), *New*, *No change*, and the three **Problems** — an unknown MRN, an impossible date, and a name that doesn't match the MRN. *"It refuses wrong-patient rows rather than guessing."*
4. **Import** → the summary shows how many lab gaps closed and whether any new ones appeared. Open **Review flags** to show them.

## 3. What the rules deliberately *don't* flag (1 min)
Open a few patients from **Patients**:
- **Grace Okonkwo** — follow-up was rescheduled at the patient's request; a confirmed appointment exists → no flag.
- **Robert Chen** — knee pain at three visits, but documented as chronic and managed → no flag.
- **Anthony Russo** — patient declined a referral, and that's documented → no flag.
*"It isn't enough for a symptom to repeat. What matters is whether a plan is documented."*

## 4. The front desk closes the loop (2 min) — private window
1. Sign in as **Daniel Okafor** — `frontdesk@harborview.demo.test`. He lands on the **Follow-up queue**.
2. Show the views: *Calls to make*, *Appointments to confirm*, *Missing specialist records*. Filter **Assigned to me**.
3. Find the task Dr. Rivera just created. **Update** → mark *Completed* without an outcome → the app asks for one. Add *"Left voicemail; patient called back and rebooked (simulated)"* → save.
4. Open **William Foster** → note that front desk sees the referral status but **not** the visit note, symptoms, or flags.
5. Referrals → **Update status** → *Records received* → Save.
6. Switch to Dr. Rivera's window → **Review flags → Resolved by new data**: the Gastroenterology flag closed itself because the record now exists.

## 5. Administration & trust (2 min)
1. Sign in as **Priya Shah** — `admin@harborview.demo.test`.
2. **Staff:** invite a colleague (the link appears instantly; no email is sent), change a role, issue a password-reset link.
3. **Audit log:** filter *Record access* and *Flag reviews* — every view and decision is attributed.
4. Mention: clinic data is isolated in the database itself (row-level security), not just hidden in the interface.

## 6. Close (1 min)
- *"Try it yourself: Try Demo gives you a private copy in one click, and Create Demo Account gives you your own clinic to invite your team into."*
- Be honest about the status: tested on fictional data only. Show `evaluation/RESULTS.md` if they ask about accuracy, including its limitations. Real use would require the clinical deployment checklist: privacy and legal review, BAAs, security testing, and validation on de-identified records.

### Questions to ask the clinic
- How do you track outstanding labs and referrals today? Who owns that list?
- Which of the four flag types would save your team the most time? What would you add?
- Who should see what — does your front desk need any clinical context to chase records?
