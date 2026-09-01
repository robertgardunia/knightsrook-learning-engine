# audio/music/

Background/ambient music beds, if any course wants one. Flat file-per-track,
same reasoning as `audio/sfx/`.

```
audio/music/
  vulcan-ambient.mp3
```

`sci-fi-lab-ambient.mp3` is the first real ambient bed, referenced by the
precursor-demo course package via `RoomConfig.ambientAudioUrl` (added to
`CoursePackage` for this — `packages/shared-types/src/course-package.ts`).
Played on a loop via Babylon's `Sound` API in `main.ts`; browser autoplay
policy may hold it muted/suspended until the first user interaction with the
page, which is expected, not a bug.
