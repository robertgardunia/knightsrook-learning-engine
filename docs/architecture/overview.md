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

Six inputs, all JSON config under `public/courses/<id>/` (repo root, not
nested inside `packages/client` — see [public/README.md](../../public/README.md)),
none requiring a source edit: room GLB, avatar GLB (or primitive stand-in), voice
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
DB schema, docker-compose, corpus ingest (`packages/retrieval/app/ingest/`),
room GLB import + spawn-node auto-frame + ambient audio (see below).

## Room + ambient audio

First real room GLB (`assets/rooms/sci-fi-lab/room.glb`, a Sketchfab
download) is wired into `main.ts`: `SceneLoader.ImportMeshAsync` loads it,
`roomConvention.ts` frames the camera from its bounding box, and a looping
ambient bed (`RoomConfig.ambientAudioUrl`, e.g.
`assets/audio/music/sci-fi-lab-ambient.mp3`) plays via Babylon's `Sound` API.
See `docs/architecture/room-convention.md` for the spawn-node fallback this
surfaced (most downloaded GLBs don't author a `SpawnPoint` node).

`tsn-node-kit`'s `XApiRelay` (`telemetry/xapiClient.ts`) is not
browser-bundle-safe as a static import — `offlineQueue.js` uses synchronous
`fs` calls no polyfill can satisfy — so it's now dynamic-imported, only when
`VITE_XAPI_SOCKET_URL` is actually configured. This was blocking the whole
scene from rendering (a module-load-time crash) before it was found while
verifying the room/audio work in a real browser.

Corpus ingest is a two-stage pipeline with a stable seam: format-specific
**extractors** (`ingest/extractors/`, currently plain text/Markdown via
`TextExtractor`, picked by `CorpusDocument.format` or auto-detected from the
source URL extension) produce a canonical `Block` list
(`{text, heading_path, source_ref}`); a format-agnostic **chunker**
(`ingest/chunker.py`) and **embedder** (`ingest/embedder.py`, OpenAI
`text-embedding-3-small`) turn those into citation-tagged rows in
`substrate.corpus_chunks`, orchestrated by `ingest/loader.py::ingest_corpus`.
Add a PDF/DOCX extractor once research-open #1 (Jeffrey's actual document
format) resolves — nothing else in the pipeline should need to change.

Stubbed, by design, per the spec's own sprint plan: CC4/CC5 material
correction (no real avatar GLB yet), `/api/query` retrieval (status was
"unknown" in the garage; this stub enforces the trusted-substrate contract
without answering anything yet — it now has a real substrate to query once
retrieval logic lands).

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
