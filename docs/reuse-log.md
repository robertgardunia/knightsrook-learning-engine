# Reuse log — knightsrook-garage → knightsrook-learning-engine

Purpose: this project exists partly to find where knightsrook-garage's course-
specific code is actually already generic, and where it needs to become
generic. Every entry below is a candidate for a retroactive change to the
garage — either "port this back as-is, it's already clean" or "the garage
version needs this adjustment too."

Format per entry: **source file → what changed → garage retrofit action.**

---

## 1. `src/garage/loadProgress.js` → `packages/client/src/scene/loadProgress.ts`

**Changed:** Nothing functionally — ported near-verbatim, typed. No garage-
specific assumptions found in the original; it was already a clean, reusable
byte-weighted progress tracker.

**Garage retrofit action:** None needed. Optionally back-port the TS types if
the garage ever migrates off plain JS (see #6 below on the JS/TS split), but
there is no urgency — the JS version works as-is.

## 2. `src/narrative/scriptRunner.js` → `packages/client/src/lesson/scriptRunner.ts`

**Changed:** Nothing functionally. This was the single biggest finding of the
scaffold: the spec called the lesson interpreter "NEW... a few hundred lines,"
but garage's ScriptRunner is *already* a fully generic handler-registration
sequencer with zero game-specific dependencies (its own doc comment says so:
"Completely modular. No dependencies on any specific game system."). The only
new code is `lessonInterpreter.ts`, a thin adapter mapping `LessonFile.beats`
onto ScriptRunner's `{type, ...params}` step shape.

**Garage retrofit action:** None to ScriptRunner itself. Worth doing later:
extract ScriptRunner out of `src/narrative/` into a standalone reusable
module (or a shared package both repos depend on) since it has no dependency
on the narrative system's specific step types (`fade`, `voice`, etc.) — those
live in `gameHandlers.js`/`handlers.js`, not in the runner.

## 3. `src/systems/xapi/xapiService.js` → `packages/client/src/telemetry/xapiClient.ts`

**Changed:** Garage's version hardcodes a fixed `ACTIVITIES` map, `BASE` URL,
and `nodeId: 'knightsrook-garage'` for the kart-builder course specifically.
The learning-engine version takes activities, node id, and socket URL as
constructor parameters — nothing course-specific is baked into the module.

**Garage retrofit action:** Worth doing — extract the constant `ACTIVITIES`/
`BASE`/`nodeId` values out of `xapiService.js` into `characterConfig.js` or a
new `xapiConfig.js`, and make the service itself take them as parameters. This
is a small, low-risk change and directly un-blocks reuse: right now, standing
up course two means editing xapiService.js's module-level constants, which
violates the "course is data, not code" thesis this whole project tests.

## 4. `src/utils/cc4Materials.js` → NOT ported (see `packages/client/src/avatar/cc4Materials.ts`)

**Changed:** N/A — deliberately left a no-op stub. Per the spec, model and
character creation is a separate pipeline off this project's critical path,
and the primitive stand-in avatar covers the demo need until a real CC4/CC5
GLB exists.

**Garage retrofit action:** None yet. When the first real avatar GLB lands in
this project, port `cc4Materials.js` verbatim (typed) and log that port here.
No changes anticipated to the garage's original — it's already a standalone,
non-game-specific fix keyed only on Reallusion's export quirks (transparency
mode, emissive zeroing, hair-cap alpha).

## 5. Arrival transition (garage: WRITTEN, not extracted to its own module)

**Changed:** The spec describes this transition (visibility ramp + emissive
wash with the transparencyMode/emissive/post-load gotchas) as living inline in
the garage rather than as an importable module. `arrivalTransition.ts` here
extracts it as a standalone function, `playArrivalTransition(meshes, duration)`.

**Garage retrofit action:** Worth doing — if the garage's version is inline
in `characterLoader.js` or similar, extracting it to its own module (as done
here) would make it directly copy-paste reusable rather than requiring a
re-read of this file's comments to reconstruct the three gotchas correctly
each time. Locate the garage's actual implementation and confirm gotchas
(a)/(b)/(c) match what's ported here before treating this file as authoritative.

## 6. TypeScript vs JavaScript

**Changed:** This repo is TS throughout (client + shared-types); the garage is
JS/ES6/no-TS (`project:knightsrook-garage:overview`). This was an open
conflict noted in `project:learning-demo:research-open` #6, resolved as: new
repo → TS, garage stays JS.

**Garage retrofit action:** None planned. Do not port TS-typed reused modules
back into the garage as TS — keep the garage's existing JS convention intact.
If a module proves worth sharing literally (not just conceptually) between the
two repos, consider a third shared package published as compiled JS, rather
than migrating the garage's build tooling.

## Not yet examined

`characterLoader.js`, `sceneLoader.js`, `sceneConfig.js`/`characterConfig.js`,
`avatarChatOM/*` (per-mentor ElevenLabs agent + emotion/gaze/prosody
controllers), `progressiveLoader.js`, `animationMixer.js`, `mentorChat.js`.
These are real reuse candidates per the spec's reuse ledger but weren't
needed for the first scaffold pass (lesson interpreter + course package
format, per the spec's "first sprint" priority). Pull them in as the room/
avatar/voice pieces of the demo actually get built, and log each here.
