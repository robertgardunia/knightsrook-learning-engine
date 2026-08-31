# Reuse log — knightsrook-garage → knightsrook-learning-engine

## Framing

The garage was originally born from a procedural engine — it had
"enginification" in its bones. It has since progressed a great deal as its
own course (kart-building), and that progress pulled parts of it toward being
course-specific rather than engine-shaped. This project is not just a place to
copy code from the garage; it is the pressure test that shows exactly where
that drift happened and what it costs to reverse, so the garage can be
realigned back toward its engine roots afterward.

Read each entry below as a drift audit, not just a port log: an entry where
nothing needed to change (#1, #2) is a place the garage never drifted; an
entry with a real "garage retrofit action" (#3, #5) is a place it did.

Every entry is a candidate for a retroactive change to the garage — either
"port this back as-is, it's already clean" or "the garage version needs this
adjustment too."

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

**Corrected 2026-08-31 (see below the original entry).**

**What's actually reused:** garage's `xapiService.js` already imports
`XApiRelay` directly from the published `tsn-node-kit` package (not a local
reimplementation), and `relay-server.js` at the repo root runs a standalone
Node process holding real LRS credentials, matching the documented
Batcher → Catcher → Relay pattern from `tsn-node-kit`'s own README. The relay
abstraction itself was never the drift — it was already an external, shared
dependency, correctly separated from browser-exposed credentials.

**What was actually wrong (my own mistake, not garage's):** the first pass of
this file hand-rolled a raw `socket.io-client` emit wrapper instead of
importing `XApiRelay`, duplicating logic tsn-node-kit already provides
(whitelist checking, statement validation, LRS posting, reconnect/flush
queueing). Fixed by importing `XApiRelay` from `tsn-node-kit` directly and
adding `packages/xapi-relay` — a near line-for-line port of garage's
`relay-server.js` — as its own workspace package, since the monorepo needs its
own relay-server process rather than reaching into the garage's repo for one.

**Real, narrower garage drift that still stands:** `xapiService.js` hardcodes
a fixed `ACTIVITIES` map, `BASE` URL, and `nodeId: 'knightsrook-garage'` for
the kart-builder course specifically. `xapiClient.ts` here takes activities
and node id as parameters instead, sourced from the CoursePackage.

**Garage retrofit action:** Extract the constant `ACTIVITIES`/`BASE`/`nodeId`
values out of `xapiService.js` into `characterConfig.js` or a new
`xapiConfig.js`, and make the service take them as parameters — small,
low-risk, and directly un-blocks the "course is data, not code" thesis: right
now, standing up course two in the garage means editing xapiService.js's
module-level constants.

**Open, unconfirmed:** whether the full chain (browser relay → relay-server →
LRS, plus `tsn-xapi-handler`'s actor migration from temp event-code actor to
permanent `tsn_id` actor on registration) is verified working end-to-end in
production. Not claimed here either way — treat as a standing question, same
category as `project:learning-demo:research-open`.

**`tsn-xapi-handler` note (separate deployed HTTP service, not an npm
dependency):** its actor-migration flow assumes an event-code-claim
provisioning model (kiosk QR scan → temp actor → permanent actor on
registration). Jeffrey's staff-training context likely doesn't need that
migration step if staff already have persistent accounts rather than
walk-up-and-claim codes — but its `/query` endpoint (arbitrary xAPI query
against the LRS, pagination handled) is a directly reusable reporting tool
regardless of provisioning model, and is the natural fit for the spec's "flag
someone at day 150" RBT training-window tracking feature. Not wired up yet.

---

*Original entry, superseded by the correction above, kept for the record:*

> **Changed:** Garage's version hardcodes a fixed `ACTIVITIES` map, `BASE` URL,
> and `nodeId: 'knightsrook-garage'` for the kart-builder course specifically.
> The learning-engine version takes activities, node id, and socket URL as
> constructor parameters — nothing course-specific is baked into the module.
>
> **Garage retrofit action:** Worth doing — extract the constant `ACTIVITIES`/
> `BASE`/`nodeId` values out of `xapiService.js` into `characterConfig.js` or a
> new `xapiConfig.js`, and make the service itself take them as parameters.
> This is a small, low-risk change and directly un-blocks reuse.

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

## Reuse sources outside the garage

Two published packages the garage itself already depends on, discovered while
correcting entry #3 — worth stating explicitly since they aren't "garage
code" and could otherwise be missed by anyone reading this log expecting only
garage-sourced entries.

**`tsn-node-kit`** (`/d/workspace-tsn/tsn-node-kit`) — identity provisioning
and xAPI relay for TSN activity nodes. Batcher → Catcher → Relay pattern.
`XApiRelay` is reused directly (#3 above). `CodeBatcher`/`CodeCaptureService`
(event-code QR-scan provisioning) are NOT currently reused here — they assume
a walk-up-and-claim-a-code model that doesn't obviously fit Jeffrey's
staff-training context (persistent accounts, not anonymous kiosk codes).
Revisit if/when the engine needs multi-tenant identity provisioning.

**`tsn-xapi-handler`** (`/d/workspace-tsn/tsn-xapi-handler`) — deployed HTTP
service (not an npm dependency): migrates xAPI statements from a temporary
event-code actor to a permanent `tsn_id` actor on registration, and exposes a
`/query` endpoint for arbitrary xAPI queries against the LRS. Actor migration
likely doesn't apply here (same reasoning as CodeBatcher above); the `/query`
endpoint is a plausible fit for the spec's RBT 5/180-day training-window
tracking feature. Not wired up. Whether the full xAPI chain (garage/engine →
relay → LRS → this handler) actually works end-to-end in production is
unconfirmed — flagged, not assumed.

## Not yet examined

`characterLoader.js`, `sceneLoader.js`, `sceneConfig.js`/`characterConfig.js`,
`avatarChatOM/*` (per-mentor ElevenLabs agent + emotion/gaze/prosody
controllers), `progressiveLoader.js`, `animationMixer.js`, `mentorChat.js`.
These are real reuse candidates per the spec's reuse ledger but weren't
needed for the first scaffold pass (lesson interpreter + course package
format, per the spec's "first sprint" priority). Pull them in as the room/
avatar/voice pieces of the demo actually get built, and log each here.
