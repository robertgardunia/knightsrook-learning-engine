# rooms/

Room GLBs. One subfolder per room, named with a kebab-case id:

```
rooms/
  sci-fi-lab/
    room.glb
  med-bay/
    room.glb
```

Every room GLB placed here **must** contain a named spawn/transform node
(default `SpawnPoint`) per [docs/architecture/room-convention.md](../../../docs/architecture/room-convention.md)
— `roomConvention.ts` throws a clear error at load time if it's missing rather
than silently defaulting to the GLB's raw origin.

A `CoursePackage.room.glbUrl` for this room would be
`/assets/rooms/sci-fi-lab/room.glb`.

`sci-fi-lab/room.glb` is the first real room, wired into the precursor-demo
course package. It's a Sketchfab download with no authored `SpawnPoint`
node — turns out most downloaded assets don't have one, and re-exporting
every find just to add an empty defeats the point of the convention. See
[docs/architecture/room-convention.md](../../../docs/architecture/room-convention.md)'s
"Revision from the original spec" note: `roomConvention.ts` now synthesizes
a spawn point from the bounding-box center when the node is missing, with a
loud console warning, rather than hard-failing.
