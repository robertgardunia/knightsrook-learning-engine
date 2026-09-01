from app.ingest.chunker import chunk_blocks
from app.ingest.extractors import get_extractor


def test_text_extractor_builds_heading_path_from_markdown():
    extractor = get_extractor(format="markdown", source_url="doc.md")
    raw = b"# Section 3\n\n## 3.2 Escalation Procedure\n\nCall the BCBA.\n\nThen wait."

    blocks = extractor.extract(raw, source_ref_prefix="doc.md")

    assert [b.heading_path for b in blocks] == [
        ["Section 3", "3.2 Escalation Procedure"],
        ["Section 3", "3.2 Escalation Procedure"],
    ]
    assert blocks[0].text == "Call the BCBA."


def test_plain_text_with_no_headings_gets_empty_heading_path():
    extractor = get_extractor(format="text", source_url="doc.txt")
    raw = b"First paragraph.\n\nSecond paragraph."

    blocks = extractor.extract(raw, source_ref_prefix="doc.txt")

    assert all(b.heading_path == [] for b in blocks)
    assert len(blocks) == 2


def test_chunker_groups_same_section_blocks_and_joins_heading_path():
    extractor = get_extractor(format="markdown", source_url="doc.md")
    raw = b"# Section 3\n\nOne.\n\nTwo."
    blocks = extractor.extract(raw, source_ref_prefix="doc.md")

    chunks = chunk_blocks(blocks)

    assert len(chunks) == 1
    assert chunks[0].section == "Section 3"
    assert chunks[0].text == "One.\n\nTwo."


def test_chunker_starts_new_chunk_on_section_change():
    extractor = get_extractor(format="markdown", source_url="doc.md")
    raw = b"# A\n\nFirst.\n\n# B\n\nSecond."
    blocks = extractor.extract(raw, source_ref_prefix="doc.md")

    chunks = chunk_blocks(blocks)

    assert [c.section for c in chunks] == ["A", "B"]


def test_unknown_format_raises():
    import pytest

    with pytest.raises(ValueError):
        get_extractor(format="pdf", source_url="doc.pdf")
