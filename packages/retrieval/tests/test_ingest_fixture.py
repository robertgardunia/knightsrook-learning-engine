"""
Runs the extractor -> chunker seam against a realistic multi-section document
(tests/fixtures/precursor-behavior-excerpt.md, shaped like the precursor-demo
corpus this pipeline is meant to prove out first) rather than the synthetic
one- and two-line strings in test_ingest.py.
"""

from pathlib import Path

from app.ingest.chunker import chunk_blocks
from app.ingest.extractors import get_extractor

FIXTURE = Path(__file__).parent / "fixtures" / "precursor-behavior-excerpt.md"


def test_extracts_nested_headings_from_real_shaped_document():
    extractor = get_extractor(format="markdown", source_url=str(FIXTURE))
    blocks = extractor.extract(FIXTURE.read_bytes(), source_ref_prefix=str(FIXTURE))

    assert blocks[0].heading_path == ["Precursor Behavior Identification", "1. Overview"]

    chain_analysis_blocks = [
        b for b in blocks if b.heading_path[-1:] == ["2.2 Chain Analysis"]
    ]
    assert len(chain_analysis_blocks) == 1
    assert chain_analysis_blocks[0].heading_path == [
        "Precursor Behavior Identification",
        "2. Identification Procedure",
        "2.2 Chain Analysis",
    ]


def test_every_block_and_chunk_carries_a_citable_source_ref():
    extractor = get_extractor(format="markdown", source_url=str(FIXTURE))
    blocks = extractor.extract(FIXTURE.read_bytes(), source_ref_prefix=str(FIXTURE))

    assert all(b.source_ref.startswith(str(FIXTURE)) for b in blocks)

    chunks = chunk_blocks(blocks)
    assert all(c.source_ref for c in chunks)
    assert all(c.section for c in chunks)


def test_chunks_stay_within_document_sections():
    extractor = get_extractor(format="markdown", source_url=str(FIXTURE))
    blocks = extractor.extract(FIXTURE.read_bytes(), source_ref_prefix=str(FIXTURE))

    chunks = chunk_blocks(blocks)

    sections = [c.section for c in chunks]
    assert "Precursor Behavior Identification > 3. Escalation Procedure" in sections
    # No chunk's text should straddle two different sections' content.
    escalation_chunk = next(
        c for c in chunks if c.section.endswith("3. Escalation Procedure")
    )
    assert "redirect to a functionally" in escalation_chunk.text
    assert "Chain Analysis" not in escalation_chunk.text
