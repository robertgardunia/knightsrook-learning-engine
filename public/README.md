# public/

Repo-root-level, not owned by any one workspace package. Two subtrees:

- **`courses/`** — course package JSON (`course.json` per course id) and
  anything genuinely course-specific.
- **`assets/`** — the shared, course-agnostic asset library (rooms, avatars,
  animations, audio, textures, UI, and staged corpus documents). See
  [assets/README.md](assets/README.md).

Deliberately placed here rather than under `packages/client/public/` because
not everything in it is a client concern — `assets/corpus/` in particular is
consumed by `packages/retrieval`'s ingest step, not served to the browser.
Nesting it inside the client package would have made a whole-repo asset
library look like client-owned data.

`packages/client/vite.config.ts` points its `publicDir` here so Vite still
serves these files at the site root during dev/build (`/courses/...`,
`/assets/...`) exactly as if they lived in the conventional `public/` location
— only the physical location moved, not the served URL paths.
