# corpus/

Raw staged source documents (PDF/DOCX/Markdown/etc.) before ingest into the
retrieval service's trusted substrate. One subfolder per course id, matching
`CoursePackage.id`:

```
corpus/
  precursor-demo/
    smith-churchill-2002.pdf
    herscovitch-precursor-procedure.pdf
```

This is staging, not the substrate itself — `packages/retrieval/app/ingest/loader.py`
reads from here (or from `CorpusDocument.sourceUrl` directly for
already-hosted documents like the precursor-demo's published literature) and
writes chunked, embedded, citation-tagged rows into `substrate.corpus_chunks`.

Ingest is implemented as a two-stage pipeline (`packages/retrieval/app/ingest/`):
a format-specific extractor (plain text/Markdown so far — `format: "text"` or
`"markdown"` on `CorpusDocument`, or auto-detected from the file extension)
produces a canonical block list, and a format-agnostic chunker + embedder
turns that into substrate rows. Add a PDF/DOCX extractor once
`research-open` #1 (Jeffrey's actual document format) resolves.

Nothing checked in yet — no real corpus has landed here. Until it does, ingest
should be exercised against the precursor-demo's stand-in corpus (published
literature reachable via `CorpusDocument.sourceUrl`, no local file needed).
