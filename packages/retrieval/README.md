# packages/retrieval

FastAPI service. Corpus ingest (`app/ingest/`) is implemented; `/api/query`
retrieval over the ingested substrate is still stubbed — see
[docs/architecture/overview.md](../../docs/architecture/overview.md).

## Ingest pipeline

Extract (format-specific, `app/ingest/extractors/`) -> chunk (format-agnostic,
`app/ingest/chunker.py`) -> embed (`app/ingest/embedder.py`) -> upsert into
`substrate.corpus_chunks`, orchestrated by `app/ingest/loader.py::ingest_corpus`.
Add a new document format by adding an extractor and registering it in
`app/ingest/extractors/registry.py` — nothing else in the pipeline changes.

## Tests

```bash
python -m venv .venv && .venv/Scripts/activate   # or source .venv/bin/activate
pip install -e . pytest pytest-asyncio
pytest tests/ -q
```

- `test_ingest.py`, `test_ingest_fixture.py` — extractor/chunker unit tests
  against synthetic input and `tests/fixtures/precursor-behavior-excerpt.md`
  (a realistic multi-section document shaped like the precursor-demo corpus).
  No `.env` or Docker required.
- `test_ingest_integration.py` — end-to-end `ingest_corpus` against a real
  Postgres, with the embedder faked (no OpenAI call). Requires
  `docker compose up -d db` and a `.env` with `POSTGRES_HOST=localhost`
  (see `.env.example`'s note). Skips automatically — not fails — if either
  isn't available, so `pytest tests/` stays runnable without Docker.
