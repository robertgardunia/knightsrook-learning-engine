"""
End-to-end ingest_corpus against a real Postgres (see conftest.py::db_pool —
skips if `docker compose up -d db` isn't running). The embedder is faked so
this never makes a real OpenAI call or requires an API key; it exercises the
DB write path (upsert, section/citation tagging, re-ingest idempotency) that
the pure unit tests in test_ingest.py and test_ingest_fixture.py can't reach.
"""

from pathlib import Path

import pytest

from app.ingest.loader import IngestDocument, ingest_corpus

FIXTURE = Path(__file__).parent / "fixtures" / "precursor-behavior-excerpt.md"

pytestmark = pytest.mark.integration


class FakeEmbedder:
    """Deterministic stand-in for OpenAIEmbedder — a fixed-length zero
    vector per text, since these tests assert on DB rows, not embedding
    quality."""

    def __init__(self, dims: int = 1536) -> None:
        self.dims = dims
        self.calls: list[list[str]] = []

    async def embed(self, texts: list[str]) -> list[list[float]]:
        self.calls.append(texts)
        return [[0.0] * self.dims for _ in texts]


@pytest.fixture(autouse=True)
async def _clean_up(db_pool):
    yield
    async with db_pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM substrate.corpus_chunks WHERE document_id = 'test-precursor-doc'"
        )
        await conn.execute(
            "DELETE FROM substrate.corpus_documents WHERE id = 'test-precursor-doc'"
        )


async def test_ingest_writes_citable_chunks(db_pool):
    document = IngestDocument(
        id="test-precursor-doc",
        course_id="precursor-demo",
        title="Precursor Behavior Identification (test fixture)",
        source_url=str(FIXTURE),
        format="markdown",
    )
    embedder = FakeEmbedder()

    await ingest_corpus([document], db_pool, embedder=embedder)

    async with db_pool.acquire() as conn:
        doc_row = await conn.fetchrow(
            "SELECT * FROM substrate.corpus_documents WHERE id = $1", document.id
        )
        chunk_rows = await conn.fetch(
            "SELECT section, content, embedding FROM substrate.corpus_chunks "
            "WHERE document_id = $1 ORDER BY id",
            document.id,
        )

    assert doc_row["course_id"] == "precursor-demo"
    assert len(chunk_rows) > 0
    assert all(row["section"] for row in chunk_rows)
    assert any("Escalation Procedure" in row["section"] for row in chunk_rows)
    assert embedder.calls, "embedder was never invoked"


async def test_re_ingest_replaces_rather_than_duplicates(db_pool):
    document = IngestDocument(
        id="test-precursor-doc",
        course_id="precursor-demo",
        title="Precursor Behavior Identification (test fixture)",
        source_url=str(FIXTURE),
        format="markdown",
    )

    await ingest_corpus([document], db_pool, embedder=FakeEmbedder())
    await ingest_corpus([document], db_pool, embedder=FakeEmbedder())

    async with db_pool.acquire() as conn:
        count = await conn.fetchval(
            "SELECT count(*) FROM substrate.corpus_chunks WHERE document_id = $1",
            document.id,
        )
        doc_count = await conn.fetchval(
            "SELECT count(*) FROM substrate.corpus_documents WHERE id = $1", document.id
        )

    chunks_after_one_ingest = await _chunk_count(document, db_pool)
    assert count == chunks_after_one_ingest
    assert doc_count == 1


async def _chunk_count(document: IngestDocument, db_pool) -> int:
    from app.ingest.chunker import chunk_blocks
    from app.ingest.extractors import get_extractor

    extractor = get_extractor(format=document.format, source_url=document.source_url)
    blocks = extractor.extract(FIXTURE.read_bytes(), source_ref_prefix=document.source_url)
    return len(chunk_blocks(blocks))
