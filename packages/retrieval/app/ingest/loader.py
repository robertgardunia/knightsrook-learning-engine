"""
Corpus ingest — stub. Per spec's first-sprint guidance: wire this against the
precursor-behavior literature (input #6 of the course package) BEFORE Jeffrey's
real documents arrive, so that when they do you are measuring retrieval
quality, not plumbing.

TODO: fetch each CorpusDocument.sourceUrl, chunk, embed into pgvector, and
(per the trusted-substrate design) tag every chunk with its source document id
and section so query.py can always cite back to it.
"""


async def ingest_corpus(document_urls: list[str]) -> None:
    raise NotImplementedError("Corpus ingest not yet built — see module docstring")
