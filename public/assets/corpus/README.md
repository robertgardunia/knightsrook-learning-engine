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
See `docs/reuse-log.md`'s note on the ingest design still being generalized
across document formats — this folder's contents are the input to whichever
format-specific extractor design lands there.

Nothing checked in yet — `research-open` #1 (Jeffrey's actual document format)
is still unresolved, so no real corpus has landed here.
