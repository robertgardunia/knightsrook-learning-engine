# avatars/

Character GLBs (CC4/CC5 → glTF exports). One subfolder per avatar:

```
avatars/
  vulcan-tvek/
    avatar.glb
```

Export at **1K texture resolution, not 4K**, for browser delivery — decided
2026-08-31, see `project:learning-demo:research-open` #8. Let normal maps
carry detail rather than shipping 4K albedo/normal/roughness maps.

Before any avatar GLB lands here, confirm on a throwaway Genesis figure
whether CC5 Transformer's texture transfer issue (research-claims: CONFLICT,
unresolved as of Oct 2025 reports) still requires manual texture reapplication
— cheap to test, expensive to discover mid-course.

Material correction (`cc4Materials.ts`) is currently a deliberate no-op stub
until a real avatar GLB exists to test against — see that file's header
comment and `docs/reuse-log.md` #4.

No avatars are checked in yet. The primitive stand-in
(`src/avatar/primitiveStandIn.ts`) is procedural — capsules/spheres — and
needs no GLB asset at all.
