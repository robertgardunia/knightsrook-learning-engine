"""
Format-agnostic chunking — ships once, never touched when a new extractor is
added. Operates purely on Blocks, with no notion of source format.
"""

from dataclasses import dataclass

from app.ingest.extractors.base import Block

MAX_CHUNK_CHARS = 1500


@dataclass
class Chunk:
    text: str
    section: str
    source_ref: str


def chunk_blocks(blocks: list[Block]) -> list[Chunk]:
    """Groups adjacent same-heading blocks up to MAX_CHUNK_CHARS; a block
    longer than the limit on its own becomes its own chunk rather than being
    split mid-sentence."""
    chunks: list[Chunk] = []
    buffer: list[Block] = []
    buffer_len = 0

    def flush() -> None:
        nonlocal buffer, buffer_len
        if not buffer:
            return
        chunks.append(
            Chunk(
                text="\n\n".join(b.text for b in buffer),
                section=" > ".join(buffer[0].heading_path),
                source_ref=buffer[0].source_ref,
            )
        )
        buffer = []
        buffer_len = 0

    for block in blocks:
        same_section = buffer and buffer[-1].heading_path == block.heading_path
        would_overflow = buffer_len + len(block.text) > MAX_CHUNK_CHARS
        if buffer and (not same_section or would_overflow):
            flush()
        buffer.append(block)
        buffer_len += len(block.text)

    flush()
    return chunks
