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

No rooms are checked in yet — see `project:learning-demo:research-open` #3
(poly counts/texture sizes/file sizes for Sketchfab candidates still unknown)
before committing to one.
