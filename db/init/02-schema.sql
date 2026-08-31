-- learning-engine schema
--
-- substrate: persistent reference data (corpus documents/chunks, course metadata).
--            This is the "trusted substrate" the spec requires retrieval to answer
--            from exclusively — never speculative generation.
-- runtime:   ephemeral working state (per-session progress, xAPI outbox if buffered locally).

CREATE SCHEMA IF NOT EXISTS substrate;
CREATE SCHEMA IF NOT EXISTS runtime;

CREATE TABLE IF NOT EXISTS substrate.corpus_documents (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS substrate.corpus_chunks (
  id BIGSERIAL PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES substrate.corpus_documents(id),
  section TEXT,
  content TEXT NOT NULL,
  embedding VECTOR(1536)
);

CREATE TABLE IF NOT EXISTS runtime.lesson_progress (
  id BIGSERIAL PRIMARY KEY,
  learner_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  beat_id TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
