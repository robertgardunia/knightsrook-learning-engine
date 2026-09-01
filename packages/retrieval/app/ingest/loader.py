"""
Corpus ingest orchestration. Per spec's first-sprint guidance: proven against
the precursor-behavior literature (input #6 of the course package) before
Jeffrey's real documents arrive, so that when they do you are measuring
retrieval quality, not plumbing.

Fetch -> extract (format-specific, swappable) -> chunk (format-agnostic) ->
embed -> upsert into substrate.corpus_chunks, every chunk tagged with its
source document id and section so query.py can always cite back to it.
"""

from dataclasses import dataclass
from pathlib import Path

import asyncpg
import httpx

from app.ingest.chunker import chunk_blocks
from app.ingest.embedder import Embedder, OpenAIEmbedder
from app.ingest.extractors import get_extractor


@dataclass
class IngestDocument:
    """Mirrors shared-types' CorpusDocument, plus the course_id it belongs
    to (CorpusDocument itself is nested under a CoursePackage, which already
    carries course_id — see packages/shared-types/src/course-package.ts)."""

    id: str
    course_id: str
    title: str
    source_url: str
    format: str | None = None


async def ingest_corpus(
    documents: list[IngestDocument],
    pool: asyncpg.Pool,
    *,
    embedder: Embedder | None = None,
) -> None:
    embedder = embedder or OpenAIEmbedder()

    async with httpx.AsyncClient() as http_client:
        for document in documents:
            extractor = get_extractor(format=document.format, source_url=document.source_url)
            raw = await _fetch(document.source_url, http_client)
            blocks = extractor.extract(raw, source_ref_prefix=document.source_url)
            chunks = chunk_blocks(blocks)

            if not chunks:
                continue

            embeddings = await embedder.embed([c.text for c in chunks])

            async with pool.acquire() as conn, conn.transaction():
                await conn.execute(
                    """
                    INSERT INTO substrate.corpus_documents (id, course_id, title, source_url)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (id) DO UPDATE
                    SET course_id = EXCLUDED.course_id,
                        title = EXCLUDED.title,
                        source_url = EXCLUDED.source_url
                    """,
                    document.id,
                    document.course_id,
                    document.title,
                    document.source_url,
                )
                await conn.execute(
                    "DELETE FROM substrate.corpus_chunks WHERE document_id = $1",
                    document.id,
                )
                await conn.executemany(
                    """
                    INSERT INTO substrate.corpus_chunks (document_id, section, content, embedding)
                    VALUES ($1, $2, $3, $4)
                    """,
                    [
                        (document.id, chunk.section, chunk.text, _to_pgvector(vector))
                        for chunk, vector in zip(chunks, embeddings)
                    ],
                )


def _to_pgvector(vector: list[float]) -> str:
    return "[" + ",".join(repr(v) for v in vector) + "]"


async def _fetch(source_url: str, http_client: httpx.AsyncClient) -> bytes:
    if source_url.startswith(("http://", "https://")):
        response = await http_client.get(source_url)
        response.raise_for_status()
        return response.content
    return Path(source_url).read_bytes()
