"""
Maps a CorpusDocument's format (explicit, or auto-detected from its
source_url extension) to a concrete extractor. Add PDF/DOCX here once
research-open #1 (Jeffrey's actual document format) resolves — nothing
else in the ingest pipeline needs to change.
"""

from app.ingest.extractors.base import Extractor
from app.ingest.extractors.text import TextExtractor

_BY_FORMAT: dict[str, Extractor] = {
    "text": TextExtractor(),
    "markdown": TextExtractor(),
}

_EXTENSION_TO_FORMAT = {
    ".txt": "text",
    ".md": "markdown",
    ".markdown": "markdown",
}


def get_extractor(*, format: str | None, source_url: str) -> Extractor:
    resolved = format or _detect_format(source_url)
    try:
        return _BY_FORMAT[resolved]
    except KeyError:
        raise ValueError(
            f"No extractor for format {resolved!r} (source: {source_url}). "
            f"Supported: {sorted(_BY_FORMAT)}"
        ) from None


def _detect_format(source_url: str) -> str:
    for ext, fmt in _EXTENSION_TO_FORMAT.items():
        if source_url.lower().endswith(ext):
            return fmt
    raise ValueError(
        f"Cannot auto-detect format for {source_url!r} — pass "
        f"CorpusDocument.format explicitly."
    )
