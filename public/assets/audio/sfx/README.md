# audio/sfx/

Short sound effects — UI feedback (choice select, correct/incorrect chime),
ambient stingers, transition sounds (e.g. accompanying `arrivalTransition.ts`).

```
audio/sfx/
  choice-correct.mp3
  choice-incorrect.mp3
  arrival-chime.mp3
```

Flat file-per-effect is fine here (unlike rooms/avatars) since these are
small, single-file, reused across every course — no per-asset subfolder
needed unless an effect ever grows variants.

Nothing checked in yet.
