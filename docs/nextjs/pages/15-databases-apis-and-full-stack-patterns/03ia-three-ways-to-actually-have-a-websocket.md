---
title: "There are exactly three ways to have a WebSocket alongside a Next.js app — buy one, run one, or use a platform escape hatch — and each trades a different thing you currently take for granted"
sidebar_label: "03ia · Three ways to have a WebSocket"
sidebar_position: 172
description: "A managed realtime service and the token-minting Route Handler it needs, a separate long-running Node process and why a custom server is the worse version of that, and the platform upgrade escape hatch with its documented constraints."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against Vercel [WebSockets](https://vercel.com/docs/functions/websockets)
> and the [`@vercel/functions` reference](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package);
> Next.js [Custom server](https://nextjs.org/docs/app/guides/custom-server),
> [`connection()`](https://nextjs.org/docs/app/api-reference/functions/connection) and
> [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers).
> Documentation-verified, **no sandbox run**. No claim is made about any third-party
> vendor's current feature set or pricing.
> Target: **Next.js 16.3.4** · Node **24.20.0**.

**[03i](03i-websockets-and-the-serverless-request-model.md) established why a WebSocket cannot live inside a Route Handler and what the request model constrains even when a platform offers an upgrade API. This page is what you do about it. There are three real options and they are not variations on a theme — one moves the socket to a vendor, one moves it to a process you operate, and one keeps it on the platform at the cost of portability. In all three the Next.js application ends up doing the same small job: authenticating the user and minting a scoped token. That is worth noticing early, because it means the choice is reversible and the auth work is not wasted whichever way you go.**

## Option 1 — a managed realtime service

**The shape.** The browser connects to the vendor, not to you. Your Next.js app does two things: it mints a short-lived, scoped token so the client may subscribe to exactly the channels it is allowed to see, and it publishes events over the vendor's HTTP API from your ordinary mutations. No long-lived connection ever touches your deployment.

```ts
// app/api/realtime/token/route.ts — the whole of the client-facing surface
export async function POST(request: Request) {
  const session = await requireSession()
  const { boardId } = await request.json()
  await requireBoardAccess(boardId, session.userId)

  // Scoped to one board, short-lived, minted server-side. The client never
  // sees a credential that would let it subscribe to anything else.
  const token = await realtime.createToken({
    clientId: session.userId,
    capabilities: { [`board:${boardId}`]: ['subscribe', 'presence'] },
    ttlSeconds: 300,
  })

  return Response.json({ token })
}
```

```ts
// Publishing happens inside the mutation that already exists.
export async function POST(request: Request, { params }: MoveCardParams) {
  const { boardId, cardId } = await params
  await requireBoardAccess(boardId)
  const moved = await moveCard({ boardId, cardId, ...(await request.json()) })

  // One HTTP call. No connection held by your deployment.
  await realtime.publish(`board:${boardId}`, 'card-moved', moved)

  return Response.json(moved)
}
```

**What you get** is the part that is genuinely hard to build: fan-out to many subscribers across regions, presence (who is connected, who just left), rooms with membership, message history for a reconnecting client, and a client library that already handles reconnection and resume. Every one of those is a project on its own.

**What it costs.** A vendor dependency in the runtime path of your most visible feature. A second authorization boundary — the token's capabilities have to stay in sync with your real permission model, and a bug there is a data leak that your own middleware never sees. Per-message or per-connection pricing that scales with engagement rather than with revenue. And data residency questions, because user content now transits a third party.

Vendors in this category include Ably, Pusher, Supabase Realtime and PartyKit among others; **this page makes no claim about any of their current features, limits or pricing** — evaluate them against the four constraints in [03i](03i-websockets-and-the-serverless-request-model.md), which is what actually differentiates them.

## Option 2 — a separate long-running process

**The shape.** A small Node service, deployed on something that runs continuously — a container, a VM, a persistent app platform — running a WebSocket server. It shares your database and your Redis, it validates a token your Next.js app minted, and it is deployed and scaled separately.

```ts
// realtime/server.ts — a service, not part of the Next.js build
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { verifyStreamToken } from './auth'
import { subscribe, publish } from './bus' // Redis pub/sub

const httpServer = createServer((_req, res) => res.end('ok')) // health check
const wss = new WebSocketServer({ noServer: true })

httpServer.on('upgrade', async (request, socket, head) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const claims = await verifyStreamToken(url.searchParams.get('token'))
  if (!claims) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
    socket.destroy()
    return
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, claims)
  })
})

wss.on('connection', (ws, claims: TokenClaims) => {
  // Fan-out through Redis, never through a module-scope Map: this process is
  // one of N, and the other members of the room may be on a different one.
  const unsubscribe = subscribe(`board:${claims.boardId}`, (event) => {
    ws.send(JSON.stringify(event))
  })

  ws.on('message', async (raw) => {
    const message = JSON.parse(raw.toString())
    if (!claims.can('write')) return
    await publish(`board:${claims.boardId}`, message)
  })

  ws.on('close', unsubscribe)
})

httpServer.listen(Number(process.env.PORT ?? 8080))
```

**Why a separate service rather than a Next.js custom server.** A custom server is the version of this that most tutorials show, and it is the worse one. The documentation is discouraging about it in general:

> *"Next.js includes its own server with `next start` by default… A custom Next.js server allows you to programmatically start a server for custom patterns. The majority of the time, you will not need this approach."*

And it names two concrete costs. The first removes a deployment mode you probably want:

> *"When using standalone output mode, it does not trace custom server files. This mode outputs a separate minimal `server.js` file, instead. These cannot be used together."*

The second removes your toolchain from the file that now matters most:

> *"`server.js` does not run through the Next.js Compiler or bundling process."*

Put together: adopting a custom server to host a WebSocket means your whole application must be deployed as a persistent process, forfeits standalone output, and gains an entry point outside the compiler — all to co-locate a socket server that has no reason to share a lifecycle with your page rendering. A separate service keeps the Next.js app deployable exactly as it is, and lets the two scale on their own curves, which they will, because socket count and page views are unrelated.

Where a custom server *is* the right call is when you are already running Next.js as a single persistent process and want one port; the option table for `createServer` names the hook:

> `httpServer` — *"`node:http#Server` — (Optional) The HTTP Server that Next.js is running behind"*

**What it costs.** A second deployment target with its own health checks, logs, secrets, scaling policy and on-call. Redis or an equivalent becomes mandatory rather than optional, because with more than one instance the fan-out cannot be in-process. And you now own reconnection, heartbeats, backpressure and protocol versioning yourself — a raw `WebSocket` gives the client none of the automatic reconnection that `EventSource` provides.

**What you get** is the only option where a WebSocket behaves the way the protocol intends: connections that last as long as the user's session, no per-connection billing, and full control over the wire protocol.

## Option 3 — the platform escape hatch

Vercel exposes an upgrade API for functions. It is worth knowing precisely, because its constraints are documented and each one is a design input rather than a footnote.

> *"Upgrades an incoming HTTP GET request to a WebSocket connection."*

> *"`experimental_upgradeWebSocket()` requires the `ws` package in your project."*

> *"WebSockets require Fluid compute to be enabled. This is the default for new projects created on or after April 23, 2025."*

> *"`maxPayload` … Default 262144 (256 KiB) … Maximum allowed message size in bytes."*

Two operational details that will cost you an afternoon each if you do not know them:

> *"When using `experimental_upgradeWebSocket()` in a Next.js app with Cache Components enabled, call `connection()` before `experimental_upgradeWebSocket()`. This opts the route handler out of static prerendering, so the WebSocket upgrade runs only at request time."*

> *"When developing a Next.js app that uses `experimental_upgradeWebSocket()` locally, you must run the development server using `vc dev` with Vercel CLI 54.14.2 or above instead of `next dev`."*

And the vendor's own framing, which is unusually direct:

> *"this API only works on the Vercel platform and gives you less control over the request lifecycle; when possible, you should handle WebSocket connections using native Node.js APIs instead."*

⚠️ The name says `experimental_`. Treat the API surface as subject to change, and keep the socket logic behind an interface so that swapping to option 1 or 2 is a transport change rather than a rewrite. All four constraints from [03i](03i-websockets-and-the-serverless-request-model.md) still apply here in full — the connection still closes at the maximum duration, reconnections still land anywhere, memory is still not shared, and the socket is still billed as an active invocation.

## The comparison, on the axes that actually differ

| | Managed service | Separate process | Platform escape hatch |
|---|---|---|---|
| New infrastructure to operate | none | **a service** | none |
| Connection lifetime | vendor's | **as long as you like** | function max duration |
| Presence, rooms, history | provided | **you build it** | you build it |
| Portability | vendor lock-in | **highest** | platform lock-in |
| Cost shape | per message / connection | fixed per instance | per invocation-second |
| Client reconnection | vendor's library | **you write it** | you write it |
| Where auth lives | a token you mint | a token you mint | your Route Handler |

The rows in bold are the ones that decide it in practice. If you do not already operate a persistent service, option 2's real price is not the code above — it is the second thing to be paged about.

## Gotchas

**★ Symptom: the WebSocket server works locally and drops half the messages once it is scaled to two instances.** Cause: fan-out through an in-process structure. Each instance only knows its own connections. Fix: publish and subscribe through a shared bus, and never let a room's membership live in a module variable:

```ts
const unsubscribe = subscribe(`board:${claims.boardId}`, (event) => ws.send(JSON.stringify(event)))
ws.on('close', unsubscribe)
```

**★ Symptom: you adopted a custom server and standalone output stopped working.** Cause: the two are documented as mutually exclusive — standalone *"does not trace custom server files"* and outputs its own minimal `server.js`. Fix: do not host the socket inside the Next.js server. A separate service keeps standalone output, keeps `next start`, and lets the two scale independently.

**★ Symptom: a type error or a modern syntax feature breaks only in `server.js`.** Cause: *"`server.js` does not run through the Next.js Compiler or bundling process."* It is plain Node, with none of your build pipeline. Fix: keep that file as thin as physically possible, or — better — do not have one.

**★ Symptom: the token minted for the realtime service grants more than the user may see.** Cause: two permission models that drifted, because the token's capabilities were written once and the real authorization rules moved. Fix: derive the token's scope from the same function that guards the equivalent HTTP route, so there is exactly one place that decides what a user may read:

```ts
const scopes = await boardScopesFor(session.userId, boardId) // the same check the API uses
const token = await realtime.createToken({ clientId: session.userId, capabilities: scopes })
```

**★ Symptom: the client holds a realtime token for hours and it cannot be revoked.** Cause: a long TTL chosen to avoid writing refresh logic. Fix: short TTL and a refresh path. The client already has a reconnection loop; renewing a token is one more step inside it, and it is the difference between "we removed their access" and "we removed their access in four hours".

**★ Symptom: `experimental_upgradeWebSocket` returns a prerendered response instead of upgrading.** Cause: with Cache Components enabled the route was eligible for static prerendering, so the upgrade never ran at request time. Fix: the documented order — `connection()` first, then the upgrade:

```ts
import { connection } from 'next/server'

export async function GET(request: Request) {
  await connection() // must come first
  return experimental_upgradeWebSocket(request, handlers)
}
```

**★ Symptom: the upgrade route does nothing under `next dev`.** Cause: the documentation states you must run the development server with `vc dev` rather than `next dev` for this API. Fix: use the platform CLI for local development of that route, and be aware this splits your team's dev workflow — a real cost of the escape hatch, not a detail.

**★ Symptom: large messages are rejected and the connection closes.** Cause: `maxPayload`, documented with a default of 262144 bytes. Fix: raise it deliberately if you must, but prefer not to send large payloads over a socket at all — send an id and let the client fetch the object over HTTP, where you still have caching, range requests and a CDN.

**★ Symptom: the realtime feature is fine until a vendor incident takes the whole board down.** Cause: the socket became the only path for data that also exists in your database. Fix: keep the socket as an accelerator, not a source of truth. Render from your own data on load, apply socket messages as updates, and refetch on reconnect — the same discipline as [03fa](03fa-designing-a-resumable-sse-stream.md). Then a vendor outage degrades to "updates are slower", not "the page is empty".

**★ Symptom: migrating from one option to another turns into a rewrite.** Cause: the transport leaked into the domain — components subscribing to a vendor SDK directly, mutations calling `realtime.publish` inline. Fix: one publish function and one subscribe hook, both owned by you, both transport-agnostic. Every option in this page produces the same event shapes; only the delivery differs.

## Interview questions

**★ You need live cursors on a collaborative board. Walk me through the options and pick one.**
Three options, and the constraints from the request model decide it. A managed realtime service gets presence, rooms and cross-region fan-out on day one, at the price of a vendor in the runtime path of the feature and a second authorization boundary to keep in sync. A separate long-running Node process gets a socket that behaves the way the protocol intends and no per-connection billing, at the price of a second deployment target and mandatory Redis for fan-out. The platform escape hatch adds no infrastructure but inherits every serverless constraint — the connection still dies at the maximum duration, reconnections still land on an arbitrary instance, and it is not portable. For a team that does not already operate persistent services, I would take the managed service, because presence and fan-out are the genuinely hard parts and they are exactly what is being bought. For a team that already runs containers, the separate process, because the recurring cost is lower and there is no lock-in.

**★ Why is a Next.js custom server the wrong place to put a WebSocket server?**
Because it couples two things with unrelated lifecycles and takes away a deployment mode to do it. The documentation says most applications will not need a custom server at all, that it cannot be combined with standalone output — *"These cannot be used together"* — and that `server.js` does not go through the Next.js compiler or bundler. So you convert your whole application into a persistent process, lose the minimal standalone artifact, and gain an untranspiled entry point, all to co-locate a socket server that does not need to share a process with page rendering. A separate service costs one more deployment and gives back independent scaling — which you want, because concurrent socket count and page views move independently.

**★ What is the Next.js application's job in all three options?**
Minting a scoped, short-lived token, and publishing events from the mutations that already exist. That is deliberately the same in all three, and it is why the decision is reversible: the authentication work, the permission model and the event shapes are unchanged whichever transport you pick. It also puts the security boundary in the right place — the browser never holds a credential that grants more than the session does, because the token's capabilities are derived from the same authorization check that guards the equivalent HTTP route.

**★ The platform's upgrade API is named `experimental_`. How does that affect your design?**
It moves the risk from "will this work" to "how expensive is it when it changes". So: keep the socket behind an interface with your own publish and subscribe functions, so the blast radius of a change is the transport module rather than every component. Do not let the vendor's message shapes into the domain. And weigh the two documented workflow costs before adopting it — it requires the platform CLI rather than `next dev` for local development, which splits the team's workflow, and it requires Fluid compute enabled. The vendor's own advice is to prefer native Node APIs when possible, which is unusual candour and worth taking at face value.

**★ Why should a socket message never be the source of truth?**
Because a socket has no delivery guarantee and no replay. Messages sent while a client was disconnected are gone; there is no `Last-Event-ID` equivalent unless you build one; and a reconnection may land on a different instance with different state. If the UI's correctness depends on having seen every message, then any drop — a deploy, a duration limit, a laptop lid — produces silent divergence that only a reload fixes. The durable design is the same one SSE forces on you: the database is the truth, the socket is an accelerator, a reconnect fetches a snapshot or replays from a cursor, and every handler is idempotent so a duplicate is harmless.

**★ How would you decide between per-message vendor pricing and a fixed-cost process?**
By modelling message volume against engagement rather than against revenue, because that is the axis on which per-message pricing surprises people — a feature that makes the product stickier makes it cost more. A fixed-cost process inverts the risk: you pay for capacity whether or not anyone connects, and you pay in operational attention as well as money. In practice the managed service wins while volume is uncertain and the team is small, and the process wins once volume is predictable and large enough that the fixed cost is clearly lower. The important part is keeping the migration cheap, which is the interface discipline above, so the decision can be revisited with real numbers instead of guessed ones.

---

← [03i · WebSockets vs serverless](03i-websockets-and-the-serverless-request-model.md) · [Chapter 15 overview](01-explanation.md) · Next → [04 · Background jobs and message queues](04-background-jobs-and-message-queues-for-async-workloads.md)
