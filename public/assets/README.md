# Asset library — standardized structure

Pre-set on purpose, unlike `knightsrook-garage/public`, which grew organically
over the life of one course and accumulated ad hoc folders as a result. This
tree is fixed up front so every future course drops assets into the same
places without inventing a new convention each time.

This is the **shared, course-agnostic asset library** — reusable rooms,
avatars, animation clips, audio, textures, and UI assets. It is distinct from
`public/courses/<id>/`, which holds one course's `course.json`
and anything genuinely specific to that course. A `CoursePackage`'s
`room.glbUrl` / `avatar.glbUrl` fields point INTO this library
(`/assets/rooms/<id>/room.glb`, etc.) — courses reference shared assets by
URL, they don't own copies of them.

## Naming convention

Every asset gets its own kebab-case-id subfolder, even if it's a single file
today — this leaves room for textures/variants/LODs to land later without a
restructure. Never put a bare file directly in a top-level category folder.

## Folders

| Folder | Contents |
|--------|----------|
| `rooms/` | Room GLBs. One subfolder per room, must contain the `SpawnPoint` node per [docs/architecture/room-convention.md](../../docs/architecture/room-convention.md). |
| `avatars/` | Character GLBs (CC4/CC5 exports). One subfolder per avatar. |
| `animations/` | Shared animation clip libraries, if ever extracted separately from avatar GLBs (e.g. a common ActorCore gesture set reused across avatars). |
| `audio/sfx/` | Short sound effects (UI feedback, ambient stingers). |
| `audio/music/` | Background/ambient music beds. |
| `textures/` | Shared textures not baked into a GLB (environment maps, shared UI textures). |
| `ui/icons/` | UI iconography. |
| `ui/themes/` | Per-theme visual assets (logos, background images) referenced by `ThemeTokens`. |
| `corpus/` | Raw staged source documents (PDF/DOCX/MD) before ingest into the retrieval service. One subfolder per course id. See `packages/retrieval/app/ingest/loader.py`. |

Each folder has its own `README.md` explaining its specific convention in
more detail, and exists as a real, empty, git-tracked directory (via that
README) from day one — so "where do I put a new room GLB" never requires
guessing or re-deriving the structure.
