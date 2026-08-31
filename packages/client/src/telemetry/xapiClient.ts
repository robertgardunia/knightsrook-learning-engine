import { io, type Socket } from "socket.io-client"

/**
 * xAPI catcher/batcher client — reused from knightsrook-garage/src/systems/xapi/xapiService.js
 * (see docs/reuse-log.md #3). Adjustment: garage's version hardcoded a fixed
 * ACTIVITIES map and BASE URL for the kart-builder course; this version takes
 * both as constructor config so any CoursePackage can supply its own activity
 * IDs without touching this file.
 */
export interface XapiActivity {
  id: string
  display: string
}

export class XapiClient {
  private socket: Socket | null

  constructor(
    socketUrl: string | undefined,
    private nodeId: string,
    private activities: Record<string, XapiActivity>,
  ) {
    this.socket = socketUrl ? io(socketUrl, { autoConnect: true, reconnectionDelay: 2000 }) : null
  }

  emit(activityKey: string, verbId: string, verbDisplay: string): void {
    const activity = this.activities[activityKey]
    if (!activity) {
      console.warn(`[xapi] unknown activity key "${activityKey}"`)
      return
    }
    if (!this.socket) return
    this.socket.emit("statement", {
      nodeId: this.nodeId,
      object: { id: activity.id, display: activity.display },
      verb: { id: verbId, display: { "en-US": verbDisplay } },
    })
  }
}
