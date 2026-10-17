# SymptomWatch

**Follow-up coordination for independent primary-care clinics.** SymptomWatch gives one-to-five-physician practices a shared view of every open follow-up loop — missed visits, labs without results, referrals without specialist records, recurring symptoms without a documented plan — with explainable, rule-based flags that a physician confirms or dismisses.

> ⚠️ **Research & demonstration prototype — fictional data only.** Not clinically validated. Not HIPAA-compliant. Do not enter real patient information. See [`docs/CLINICAL_DEPLOYMENT_CHECKLIST.md`](docs/CLINICAL_DEPLOYMENT_CHECKLIST.md) for what real deployment would require.

## Quick start (local, no accounts or cloud services needed)

Requirements: **Node.js 22+** and npm. (Python 3 is optional, only for the metric verifier.)

```bash
cd symptomwatch
npm install
npm run setup      # creates .env.local with a random SESSION_SECRET (never committed)
npm run dev        # http://localhost:3000
```

The first request creates an embedded Postgres database (PGlite) in `.data/pglite`, applies migrations, seeds two fictional clinics, and runs detection. Nothing else to install — no Docker, no Supabase account, no API keys.

Production-mode run on your machine: `npm run build && npm start`.

### Demo logins (shared demo clinics)

Password for all: **`SymptomWatch-Demo-2026`** (also shown on the sign-in page with one-click fill)

| Role | Email | Clinic |
|---|---|---|
| Physician | `physician@harborview.demo.test` | Harbor View Family Medicine — DEMO (30 patients) |
| Front desk | `frontdesk@harborview.demo.test` | Harbor View |
| Clinic admin | `admin@harborview.demo.test` | Harbor View |
| Physician | `physician@orangegrove.demo.test` | Orange Grove Primary Care — DEMO (6 patients) |

Or click **Try Demo** to get a private sandbox clinic (no sign-up), or **Create Demo Account** to get your own 30-patient workspace where you are the administrator.

### Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build && npm start` | Production build and server |
| `npm run db:reset` | Wipe the local database and reseed (stop the dev server first) |
| `npm run db:cleanup` | Delete expired sandbox clinics |
| `npm test` | Unit, integration, and component tests (Vitest, real Postgres via PGlite) |
| `npm run test:e2e` | End-to-end + accessibility tests (Playwright; first run: `npx playwright install chromium`) |
| `npm run evaluate` | Score the detection rules against the reference labels → `evaluation/RESULTS.md` |
| `npm run evaluate:verify` | Recompute every metric independently in Python |
| `npm run check` | Typecheck + lint + tests + evaluation + verification |

## What's inside

**Public site** — homepage with live product previews (rendered from real components and the fictional dataset), Try Demo role picker, demo-request form (stored, never emailed), privacy & data policy. Public pages are indexable; everything under `/app` is `noindex`.

**Accounts & roles** — email/password sign-up and sign-in, sign-out, password reset (local: developer outbox at `/dev/outbox`; hosted: admin-issued one-time link), invitations to join a clinic with a role, and three roles:

| | Physician | Front desk | Clinic admin |
|---|:-:|:-:|:-:|
| Demographics, appointments, referral status, admin tasks | ✓ | ✓ | ✓ |
| Visits, symptoms, labs, referral reasons, flags | ✓ | — | read-only |
| Confirm / dismiss flags, feedback, clinical review tasks | ✓ | — | — |
| Run detection | ✓ | — | ✓ |
| Staff, invitations, audit log, demo reset | — | — | ✓ |

**Clinic dashboard** — seven metric cards, follow-up throughput and open-work charts (with data-table views), and a searchable, filterable, sortable patient table.

**Follow-up queue** — calls to make, appointments to confirm, missing specialist records, other admin tasks (and clinical review for physicians); create, assign, change status, record outcomes; filter by status, assignee, and due window. No message is ever sent to a patient.

**Patient timeline** — chronological (toggleable) history of visits, symptoms, appointments and no-shows, labs, referrals, tasks, and flags. Every entry is labeled **Documented**, **Not documented** (expected but missing), or **Rule-inferred · needs review**. Evidence links jump to and highlight the supporting entry.

**Explainable detection** — four transparent, versioned rules (overdue follow-up, lab result missing, referral outcome missing, recurring symptom without documented plan). Each flag shows what was flagged, why, which records support it, and what's missing. Physicians confirm (optionally creating a task), dismiss with a reason, or leave feedback. Flags resolve automatically when someone documents the missing record. External AI is hard-disabled; a provider interface exists for future evaluation only.

**Safety rails** — sticky "Demo Only — No Real Patient Data" banner, synthetic-only database constraints, fictional-phone-only patients, a PHI tripwire on all free text, no file uploads, audit logging, clinic isolation enforced by Postgres row-level security.

## Evaluation (synthetic)

`npm run evaluate` runs the real engine over 36 fictional patients against 79 pre-declared reference units (18 real gaps):

| | Precision | Recall | F1 | False-positive rate |
|---|---:|---:|---:|---:|
| All rules | 83.3% | 83.3% | 83.3% | 4.9% |

These numbers come from a tiny, purpose-built, self-authored dataset whose six errors are exactly the challenge cases planted to defeat v1 rules. They demonstrate that the engine implements its specification — **not** clinical performance. Read the limitations in [`evaluation/RESULTS.md`](evaluation/RESULTS.md).

## Documentation

| Document | Contents |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Stack, runtime modes, data model, tenancy & RLS, auth, detection, decisions |
| [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) | Requirements, design system, exact rule definitions, flag lifecycle, evaluation units |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Implemented controls, threat notes, known gaps |
| [`docs/TESTING.md`](docs/TESTING.md) | Test layout, what each suite proves, how to run |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Vercel + Supabase Postgres, environment variables, step by step |
| [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) | A 10-minute walkthrough for a clinic audience |
| [`docs/CLINICAL_DEPLOYMENT_CHECKLIST.md`](docs/CLINICAL_DEPLOYMENT_CHECKLIST.md) | Legal, security, privacy, vendor, and clinical-validation work before real use |
| [`docs/COLLABORATION.md`](docs/COLLABORATION.md) | How Claude and Codex divided and reviewed the work |

## Project layout

```
db/migrations/        SQL schema, roles, row-level security (bundled into the app at build)
docs/                 Architecture, spec, security, testing, deployment, demo script
evaluation/           Reference labels, evaluator, committed results
research/             Python metric verifier
scripts/              setup, db reset/migrate/cleanup, migration bundler
src/app/              Next.js routes: (marketing), (auth), app/, dev/outbox, api/health
src/components/       UI primitives, app screens, charts, marketing sections
src/data/synthetic/   Fictional clinics, staff, patients, tasks
src/lib/              auth, authz, db, detection engine, services, validation, security
tests/                unit, integration, component, e2e
```

## Tech stack

Next.js 16 (App Router, Server Actions, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Base UI) · Recharts · Drizzle ORM · PostgreSQL (PGlite locally; any Postgres such as Supabase when hosted) · Zod · Vitest · Playwright + axe-core · Python 3 (verification).

## Status

v0.1 prototype. Nothing has been deployed publicly; see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) when you're ready.
# symptomwatch1
