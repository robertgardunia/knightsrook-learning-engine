import { io } from "socket.io-client"
import type { XApiActivityObject, XApiVerb } from "tsn-node-kit"

/**
 * Reuses tsn-node-kit's XApiRelay directly — same as knightsrook-garage's
 * src/systems/xapi/xapiService.js (which imports XApiRelay from 'tsn-node-kit'
 * too). See docs/reuse-log.md #3 for the corrected finding: the relay
 * abstraction itself was never the drift. The garage's version hardcodes a
 * fixed ACTIVITIES map and nodeId at module scope for one specific course;
 * this version takes both as constructor parameters instead, sourced from the
 * CoursePackage, so no course-specific values live in this file.
 *
 * Whether the full chain (this relay → a relay-server process → the LRS,
 * plus tsn-xapi-handler's actor migration on registration) is verified
 * working end-to-end is NOT confirmed — treat as an open question, not an
 * assumption, until it's actually exercised against a real deployment.
 *
 * endOfChain is false here by design: this relay forwards over the socket to
 * a relay-server process (see packages/xapi-relay) that holds the real LRS
 * credentials, rather than exposing them to the browser.
 *
 * tsn-node-kit is a Node module (XApiRelay pulls in `fs` via offlineQueue.js)
 * and isn't browser-bundle-safe as a static import — it's dynamic-imported
 * here, only when a socket URL is actually configured, so environments with
 * no xAPI relay configured (e.g. local dev with no .env) never pay for
 * loading it.
 */
export interface XapiActivityMap {
  [activityKey: string]: XApiActivityObject
}

export function createXapiRelay(
  socketUrl: string | undefined,
  nodeId: string,
  activities: XapiActivityMap,
): { emit: (activityKey: string, verb: XApiVerb) => void } {
  const relayReady = socketUrl
    ? import("tsn-node-kit").then(({ XApiRelay }) => {
        const socket = io(socketUrl, { autoConnect: true, reconnectionDelay: 2000 })
        return new XApiRelay(socket, {
          nodeId,
          whitelist: Object.values(activities).map((a) => a.id),
          endOfChain: false,
        })
      })
    : null

  return {
    emit(activityKey, verb) {
      const activity = activities[activityKey]
      if (!activity) {
        console.warn(`[xapi] unknown activity key "${activityKey}"`)
        return
      }
      relayReady?.then((relay) => relay.postActivity(verb, activity))
    },
  }
}
