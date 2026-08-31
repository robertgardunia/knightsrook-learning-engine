# knightsrook-learning-engine — Architecture Overview

## Purpose

Course assembly runtime. Success metric is time-to-assemble a course, not the
fidelity of any one course — a course is data (six config inputs), not code.
Generalizes patterns already proven in `knightsrook-garage` (see
[docs/reuse-log.md](../reuse-log.md)) into a reusable engine, so standing up
environment two costs hours, not a rebuild. Full spec:
`project:learning-demo:spec` (Knightsrook MCP), plus `research-claims` and
`research-open` companions.

## Services

| Service    | Tech                          | Port (dev) | Responsibility |
|------------|--------------------------------|------------|----------------|
| client     | Babylon.js + Vite + TS         | 5320       | Renders the course: room, avatar, lesson interpreter, theme provider |
| retrieval  | FastAPI + asyncpg              | 5110       | GraphRAG-forward query over the trusted substrate (corpus documents) |
| xapi-relay | Node + tsn-node-kit            | 5040       | Holds LRS credentials server-side, receives xAPI statements from the browser relay — near line-for-line port of garage's relay-server.js |
| db         | Postgres 16 + pgvector + AGE   | (internal) | substrate/runtime schema split — corpus + progress |

## Course package (the entire assembly surface)

Six inputs, all JSON config under `packages/client/public/courses/<id>/`, none
requiring a source edit: room GLB, avatar GLB (or primitive stand-in), voice
(ElevenLabs agent + voice id), theme tokens, lesson file (beats/choices), and
corpus (documents for retrieval). Types: `packages/shared-types/src/`.

## Key flows

1. **Course load** — `coursePackageLoader.ts` fetches `course.json`, no build
   step involved.
2. **Lesson playback** — `LessonInterpreter` (thin adapter) drives
   `ScriptRunner` (ported from garage's narrative system — see reuse-log #2)
   through the lesson's beats, resolving animation slots and choices.
3. **Theme swap** — `ThemeProvider.apply()` writes CSS variables live; the
   demo's intended "wow moment" is triggering this mid-session.
4. **Reference/lookup mode** — learner question → `POST /api/query` on the
   retrieval service → answer + citation, sourced only from ingested corpus
   chunks (trusted substrate). Currently a stub that always returns
   `insufficient_trusted_substrate` rather than fabricating an answer.

## What's real vs stubbed right now

Real: course package schema, lesson interpreter (via ported ScriptRunner),
theme provider, primitive stand-in avatar, xAPI client (reused, generalized),
DB schema, docker-compose.

Stubbed, by design, per the spec's own sprint plan: room GLB import + spawn-
node auto-frame (no real room asset yet), CC4/CC5 material correction (no
real avatar GLB yet), retrieval/ingest (status was "unknown" in the garage;
this stub enforces the trusted-substrate contract without answering anything
yet).

## Architecture Decision Records

### ADR-001 — Custom monorepo scaffold, not scaffold-anything's templates
**Status:** Accepted
**Context:** The spec calls for an npm-workspaces monorepo (Babylon client +
retrieval service + shared types) that doesn't map onto scaffold-anything's
single-app or multi-service menus (which assume dashboard-style frontends).
**Decision:** Hand-built the workspace structure directly.
**Consequences:** Port allocation still follows `project:knightsrook:port-registry`
convention (client=5320 Vite range, retrieval=5110 FastAPI range).

### ADR-002 — ScriptRunner reused directly as the lesson interpreter's engine
**Status:** Accepted
**Context:** The spec marked the lesson interpreter as wholly NEW work. Reading
`knightsrook-garage/src/narrative/scriptRunner.js` before writing anything
showed it already generic and game-agnostic.
**Decision:** Port ScriptRunner near-verbatim; write only a thin
`LessonInterpreter` adapter on top translating `Beat`/`Choice` shapes into
ScriptRunner steps.
**Consequences:** Most of the "new" lesson interpreter work collapsed into an
adapter. See reuse-log #2 for the garage retrofit implication (extracting
ScriptRunner to a standalone module).

### ADR-003 — TypeScript for this repo, garage stays JavaScript
**Status:** Accepted
**Context:** `project:learning-demo:research-open` flagged this as an open
conflict between garage convention (JS/ES6) and scaffold-types convention (TS).
**Decision:** New repo → TypeScript, primarily because shared-types needs to
be typed to do its job across client/retrieval boundary. Garage is not
migrated.
**Consequences:** Reused modules are typed on port; no TS is back-ported into
the garage. See reuse-log #6.
