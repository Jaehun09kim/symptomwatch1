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
