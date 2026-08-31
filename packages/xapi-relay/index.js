/**
 * xAPI relay server — holds LRS credentials server-side, accepts socket
 * connections from packages/client's browser relay (endOfChain: false there).
 *
 * Directly mirrors knightsrook-garage/relay-server.js. No new logic here;
 * this file exists only because a monorepo needs its own process for it
 * rather than reaching across into the garage's repo. If tsn-node-kit adds a
 * generic "run a relay server" CLI/binary later, this whole package can be
 * deleted in favor of that.
 */
import "dotenv/config"
import { XApiRelay } from "tsn-node-kit"

const PORT = parseInt(process.env.XAPI_RELAY_PORT ?? "5040", 10)

const relay = new XApiRelay(null, {
  nodeId: "learning-engine-relay",
  whitelist: [],
  endOfChain: true,
  lrs: {
    endpoint: process.env.LRS_ENDPOINT ?? "",
    key: process.env.LRS_KEY ?? "",
    secret: process.env.LRS_SECRET ?? "",
  },
})

relay.serveSocket(PORT)
console.log(`[xapi-relay] listening on ${PORT}`)
