"""
Canonical seam between format-specific extraction and format-agnostic
chunking/embedding. Every extractor, regardless of source format, produces
a flat list of Blocks — the chunker never needs to know what format a
document came from. See project:learning-demo:spec "ingest design".
"""

from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class Block:
    text: str
    """Document structure as a path, e.g. ["Section 3", "3.2 Escalation
    Procedure"]. A source with no real headings (a flat PDF, a plain text
    file) just gets a shallow or empty path — extractors must never invent
    structure that isn't in the source."""
    heading_path: list[str] = field(default_factory=list)
    """Extractor-specific pointer back into the source (line range, page
    number, char offset) so a chunk can always cite back to its origin."""
    source_ref: str = ""


class Extractor(Protocol):
    def extract(self, raw: bytes, *, source_ref_prefix: str = "") -> list[Block]: ...
