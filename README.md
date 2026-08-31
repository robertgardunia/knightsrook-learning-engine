# knightsrook-learning-engine

Course assembly runtime. Generalizes patterns from `knightsrook-garage` into a
reusable engine for standing up new learning environments quickly — success
metric is time-to-assemble a course, not the fidelity of any one course.

learning-demo.knightsrook.com · full spec in Knightsrook MCP:
`project:learning-demo:spec`

## Stack

- **packages/client/** — Babylon.js + Vite + TypeScript. Lesson interpreter,
  theme provider, primitive stand-in avatar, room-convention loader.
- **packages/retrieval/** — FastAPI. GraphRAG-forward query over a trusted
  substrate (currently stubbed — see [docs/architecture/overview.md](docs/architecture/overview.md)).
- **packages/shared-types/** — TypeScript types for the course package format
  shared between client and retrieval.
- **db/** — Postgres 16 + pgvector + Apache AGE.

## Quickstart

```bash
cp .env.example .env   # fill in values
npm install
npm run build:types
npm run dev:client        # Babylon client dev server, http://localhost:5320
docker compose up --build retrieval db   # retrieval API + Postgres
```

## Docs

- [docs/architecture/overview.md](docs/architecture/overview.md) — services, course package schema, key flows, ADRs
- [docs/architecture/room-convention.md](docs/architecture/room-convention.md) — the spawn-node contract every room GLB must satisfy
- [docs/reuse-log.md](docs/reuse-log.md) — what was ported from `knightsrook-garage`, what changed, and what should be retrofitted back
