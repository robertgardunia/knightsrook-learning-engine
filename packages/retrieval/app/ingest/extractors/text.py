"""
Plain text / Markdown extractor — the proving case for the extractor seam
(see loader.py docstring for build-order rationale). Markdown ATX headings
(`#`, `##`, ...) build heading_path; plain text with no headings falls back
to one block per paragraph with an empty heading_path.
"""

import re

from app.ingest.extractors.base import Block

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")


class TextExtractor:
    def extract(self, raw: bytes, *, source_ref_prefix: str = "") -> list[Block]:
        text = raw.decode("utf-8")
        heading_stack: list[str] = []
        blocks: list[Block] = []

        for para_index, para in enumerate(_split_paragraphs(text)):
            heading_match = _HEADING_RE.match(para)
            if heading_match:
                level = len(heading_match.group(1))
                title = heading_match.group(2).strip()
                heading_stack[level - 1 :] = [title]
                continue

            if not para.strip():
                continue

            blocks.append(
                Block(
                    text=para.strip(),
                    heading_path=list(heading_stack),
                    source_ref=f"{source_ref_prefix}#p{para_index}",
                )
            )

        return blocks


def _split_paragraphs(text: str) -> list[str]:
    return [p for p in re.split(r"\n\s*\n", text)]
