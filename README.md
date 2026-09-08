# knightsrook-learning-engine

Course assembly runtime. Generalizes patterns from `knightsrook-garage` into a
reusable engine for standing up new learning environments quickly — success
metric is time-to-assemble a course, not the fidelity of any one course.

learning-demo.knightsrook.com · full spec in Knightsrook MCP:
`project:learning-demo:spec`

## Stack

- **packages/client/** — Babylon.js + Vite + TypeScript. Lesson interpreter,
  theme provider, GLB-backed avatar with streaming ElevenLabs TTS + full
  viseme/lip-sync (morph targets + jaw-bone rotation, ported from garage's
  `avatarChatOM` — falls back to a primitive stand-in when no GLB is configured),
  room GLB import + spawn-node auto-frame + ambient audio (see [docs/architecture/room-convention.md](docs/architecture/room-convention.md)).
  Single model per character — no separate visual/speaking split. All animations
  are retargeted at runtime from the actorcore library via `animationMixer.ts`
  (`AnimationSlots` holds filenames, not baked indices).
- **packages/retrieval/** — FastAPI. Corpus ingest (extract -> chunk -> embed,
  format-specific extractors behind a shared seam) is implemented;
  GraphRAG-forward query over the ingested substrate is still stubbed. See
  [packages/retrieval/README.md](packages/retrieval/README.md) (tests) and
  [docs/architecture/overview.md](docs/architecture/overview.md).
- **packages/shared-types/** — TypeScript types for the course package format
  shared between client and retrieval.
- **packages/xapi-relay/** — Node process holding LRS credentials, reusing
  `tsn-node-kit`'s `XApiRelay` (same pattern as `knightsrook-garage/relay-server.js`).
- **db/** — Postgres 16 + pgvector + Apache AGE.
- **public/** — repo-root, not owned by any one package: course package JSON
  (`public/courses/`) and the shared asset library (`public/assets/` — rooms,
  avatars, animations, audio, textures, UI, staged corpus documents). See
  [public/README.md](public/README.md).

## Quickstart

```bash
cp .env.example .env   # fill in values
npm install
npm run build:types
npm run dev:client            # Babylon client dev server, http://localhost:5320
npm run start:xapi-relay      # xAPI relay, ws://localhost:5040
docker compose up --build retrieval db   # retrieval API + Postgres
```

## Tools

- **`/tools/anim-viewer/`** — Animation viewer. Auto-loads the default character on open, plays the first animation. 420px sidebar, no horizontal scroll. Character faces the camera correctly. Inspect baked animation groups by index, preview actorcore library clips retargeted onto the rig, assign animations to named course slots (`idle`, `talk`, `greet`, `explain`, `point`), and copy a ready-to-paste `animationSlots` JSON block. Planned: import wizard to re-run `fbx2glb-avatar.py` with configurable settings from the browser.

## Docs

- [docs/architecture/overview.md](docs/architecture/overview.md) — services, course package schema, key flows, ADRs
- [docs/architecture/room-convention.md](docs/architecture/room-convention.md) — the spawn-node contract every room GLB must satisfy
- [docs/reuse-log.md](docs/reuse-log.md) — what was ported from `knightsrook-garage`, what changed, and what should be retrofitted back
- [public/README.md](public/README.md) — the standardized asset folder structure and why it lives at the repo root, not inside `packages/client`
