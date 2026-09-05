---
title: "A WebSocket does not fit a Route Handler because the handshake replaces the response instead of streaming one — and the four things serverless actually constrains are lifetime, affinity, shared memory and cost, not the protocol"
sidebar_label: "03i · WebSockets vs serverless"
sidebar_position: 40
description: "Why Next.js exposes no upgrade API, what the serverless request model genuinely forbids, the fifth option nobody considers — SSE down and POST up — and the decision table for choosing between a managed service, a long-running process and not having a WebSocket at all."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against Vercel [WebSockets](https://vercel.com/docs/functions/websockets)
> and the [`@vercel/functions` reference](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package);
> Next.js [`route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route),
> [Custom server](https://nextjs.org/docs/app/guides/custom-server) and
> [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers).
> Documentation-verified, **no sandbox run, no load testing**.
> Target: **Next.js 16.3.4** · React **19.2.8** · Node **24.20.0**.

**"Next.js does not support WebSockets" is repeated everywhere and is imprecise in a way that leads people to the wrong fix. The protocol is not the problem — a WebSocket handshake is an ordinary HTTP `GET`. The problem is what happens next: the server answers `101 Switching Protocols` and then stops speaking HTTP on that socket, handing the raw connection to a frame protocol. There is no value a `Response` object can hold that means "and now give me the socket", so the Route Handler signature — take a `Request`, return a `Response` — structurally cannot express it. That is a framework-level gap, and Vercel says so outright. Underneath it sits a second, deeper set of constraints that would apply even if the API existed, and those are the ones that decide your architecture.**

## Why the handler signature cannot carry an upgrade

A Route Handler is a function from `Request` to `Response`:

> *"Route Handlers allow you to create custom request handlers for a given route using the Web `Request` and `Response` APIs."*
> — Next.js, [`route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route)

An SSE stream fits that perfectly, because it never stops being an HTTP response — it is a `200` whose body happens to be long, which is the whole argument of [03](03-real-time-server-sent-events-and-websockets-in-a-serverless.md). A WebSocket does not fit, because after the handshake there is no response left to return; there is a socket, and the Web `Response` API has no way to surrender one.

The framework-level statement, verbatim:

> *"Next.js does not expose an API for handling WebSocket upgrades. As a workaround, you can use the `experimental_upgradeWebSocket()` API"*
> — [Vercel · WebSockets](https://vercel.com/docs/functions/websockets)

Everything you will read about WebSockets in Next.js is one of three workarounds around that sentence, and they are in [03ia](03ia-three-ways-to-actually-have-a-websocket.md).

## The four constraints that survive even when the API exists

Vercel does now offer an upgrade API, which makes it possible to see what the request model constrains independently of the framework gap. These four apply to *any* platform where a request is handled by an ephemeral instance.

### 1 · Lifetime — the connection ends when the invocation does

> *"WebSocket connections close when a Vercel Function reaches its maximum duration."*

A WebSocket is meant to be long-lived — hours, a work session. A function invocation is meant to be short. Putting one inside the other means the connection has a maximum lifetime that has nothing to do with the user, and every client must therefore have reconnect logic that WebSocket clients do not get for free the way `EventSource` does. Same conclusion as [03ha](03ha-connection-lifetime-limits-and-the-cost-of-an-open-stream.md), one layer up.

### 2 · Affinity — a connection is pinned, a reconnection is not

> *"A single WebSocket connection is pinned to one Vercel Function instance. Messages sent over that connection reach the same function instance for the lifetime of the connection, and Fluid compute allows a single function instance to handle multiple WebSocket connections."*

> *"New WebSocket connections are not guaranteed to reach the same Vercel Function instance. If a client reconnects, it may connect to a different instance. After a new deployment, new connections may reach the new deployment while existing connections remain on the previous deployment until they close."*

Read those together and the consequence is sharp: **two users in the same room are not necessarily on the same instance**, and the same user before and after a reconnect is not either. Anything that depends on "these connections can see each other" is therefore false by default.

### 3 · Shared memory — there isn't any

Which is why the guidance is unambiguous:

> *"Store durable state, presence, counters, rooms, and pub/sub coordination in an external data store instead of relying on in-memory variables."*

This is the constraint that actually kills naive designs. `const rooms = new Map()` at module scope is the first thing everyone writes and it is correct only when exactly one process exists. With more than one instance it produces a bug with a very specific signature: everything works for two people testing together and half the messages vanish in staging, because the two testers happened to land on the same instance and the staging users did not.

### 4 · Cost — an open socket is a running invocation

> *"WebSocket connections use Vercel Functions and follow the same limits and pricing model as other Function invocations. This includes Function usage while the connection is active, plus Fast Data Transfer and Fast Origin Transfer for data sent over the connection."*

An idle WebSocket is not free the way an idle socket on a long-running server is free. It is compute you are holding. That reframes the design question from "can I have a WebSocket" to "how many concurrently-open connections am I willing to pay to hold, and is a socket the cheapest way to get what I want".

## The option nobody considers: SSE down, POST up

Before reaching for any of the three workarounds, price the alternative that needs no new infrastructure at all. A WebSocket is chosen for bidirectionality, but the two directions almost never have the same requirements:

| Direction | Typical traffic | Cheapest correct transport |
|---|---|---|
| Server → client | continuous, unsolicited, many messages | **SSE** — one long-lived response, automatic reconnect |
| Client → server | occasional, user-initiated, needs a result | **`POST`** — an ordinary Route Handler or Server Function |

For a collaborative board, a chat, a comment thread, a live dashboard with controls — anything where the user acts at human speed — this is the whole design, and it is built from two things you already have:

```ts
// Down: one stream per tab, carrying every topic. (03d, 03fa)
// app/api/boards/[boardId]/events/route.ts  -> text/event-stream

// Up: an ordinary mutation. No new transport, no new infrastructure.
// app/api/boards/[boardId]/cards/[cardId]/move/route.ts
export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string; cardId: string }> },
) {
  const { boardId, cardId } = await params
  await requireBoardAccess(boardId)
  const { columnId, position } = await request.json()

  const moved = await moveCard({ boardId, cardId, columnId, position })
  // Fan out to everyone else's stream through the shared store, not memory.
  await publish(`board:${boardId}`, { type: 'card-moved', ...moved })

  return Response.json(moved)
}
```

What you keep: cookies, CORS, rate limiting, firewall rules, access logs, the CDN, and a client that reconnects without you writing it. What you give up: per-message overhead in the upstream direction, which matters only above a certain message rate.

**The honest boundary is message frequency and size, not "bidirectional".** A `POST` per user action is fine. A `POST` per keystroke, per cursor move, or per frame of an animation is not — each one is a full HTTP request with headers, and above roughly interactive-input frequency the overhead dominates the payload. That is the point where a real socket earns its complexity, and it is a narrower set of features than people assume: collaborative text editing with per-keystroke operations, live cursors, multiplayer game state, live audio or video control channels.

## The decision, as a table you can defend in review

| Situation | Choose | Why |
|---|---|---|
| Server → client updates, user-speed actions upward | **SSE + `POST`** | No new infrastructure; keeps every HTTP-layer feature |
| High-frequency client → server, or genuine presence for a room | **A managed realtime service** | Fan-out and presence cannot live in one instance's memory |
| You already run a long-lived Node process, or you need full control | **A separate WebSocket server** | The only option where a socket behaves the way the protocol intends |
| You are on a platform with an upgrade escape hatch, and the feature is small | **The platform API** | Least new deployment surface — at the cost of portability |
| Latency requirements are in tens of seconds | **Polling** | No held connection at all |

The three "have a WebSocket" rows are worked through in [03ia](03ia-three-ways-to-actually-have-a-websocket.md).

## Gotchas

**★ Symptom: `const rooms = new Map()` at module scope, and half the messages vanish once there is more than one user.** Cause: connections are pinned to instances but users are not distributed to a single one; two clients in the same room may be on different instances with different `Map`s. Fix: rooms, presence and pub/sub live in a shared store — the platform guidance is explicit that durable state belongs *"in an external data store instead of relying on in-memory variables"*:

```ts
// Every instance publishes and subscribes through the same store.
await redis.publish(`board:${boardId}`, JSON.stringify(event))
```

**★ Symptom: it works when two developers test together and fails in staging.** Cause: the same thing, diagnosed differently — the two developers landed on one warm instance. Fix: the shared store, and a test that deliberately forces two instances. Any correctness argument that depends on "they will probably be on the same instance" is not a correctness argument.

**★ Symptom: a WebSocket connection dies on a schedule and users see "disconnected" every few minutes.** Cause: the invocation reached its maximum duration. Fix: reconnect logic on the client with backoff and jitter, and a server-side resume protocol so a reconnect is not a state reset. Unlike `EventSource`, a raw `WebSocket` gives you none of that for free — you write all of it.

**★ Symptom: after a deploy, some clients behave as though they are on the old code.** Cause: existing connections stay on the previous deployment until they close, while new ones reach the new one — stated directly in the platform docs. Fix: version the message protocol and make both sides tolerate the other's version for one release, exactly as you would for a rolling API deploy. A "we deployed, everyone has the new code" assumption is false for long-lived connections.

**★ Symptom: you replaced a working SSE feed with a WebSocket and lost your rate limiting and access logs.** Cause: after the upgrade the traffic is opaque frames; every HTTP-aware box in the path — WAF, rate limiter, logger, CDN — stops seeing individual messages. Fix: know that you are buying this before you buy it. Vercel notes that the *handshake* still passes through routing and security controls — *"Before the connection is upgraded, the request goes through the same routing and security controls as other requests"* — but that is the handshake only. Per-message controls have to be rebuilt inside your own protocol.

**★ Symptom: the team chose a WebSocket for a notification feed.** Cause: "real-time" was translated into "WebSocket" without asking which direction the data flows. Fix: count the messages in each direction. If the upstream direction is user-speed, SSE plus `POST` does the job with less to operate, less to secure and a client that reconnects itself.

**★ Symptom: a design meeting stalls on "but we might need bidirectional later".** Cause: treating the transport as irreversible. Fix: it is not. The two designs share the same server-side event model — something happens, it is published to a store, subscribers receive it. Swapping the delivery mechanism later touches the transport layer, not the domain. Build the cheap one, and keep the publish step behind an interface.

**★ Symptom: WebSocket messages are used as the source of truth and the UI diverges after a reconnect.** Cause: treating a socket as a reliable log. It is not — messages sent while disconnected are gone, and there is no `Last-Event-ID` equivalent unless you build one. Fix: the same discipline as [03fa](03fa-designing-a-resumable-sse-stream.md). The socket carries hints; the durable store carries truth; a reconnect fetches a snapshot or replays from a cursor.

## Interview questions

**★ Why can a Route Handler serve Server-Sent Events but not a WebSocket, when both start as an HTTP `GET`?**
Because SSE never stops being HTTP and a WebSocket does. SSE is a normal `200` response whose body is long and whose `Content-Type` is `text/event-stream`; the Route Handler contract — take a `Request`, return a `Response` — describes it exactly, and the body can be a `ReadableStream` you write into over time. A WebSocket handshake is a `GET` carrying an `Upgrade` header to which the server answers `101 Switching Protocols` and then hands the raw socket to a frame protocol. There is no `Response` that expresses "and now give me the socket", so the handler signature cannot carry it, and Vercel states plainly that *"Next.js does not expose an API for handling WebSocket upgrades."* Platforms that support it in functions do so through an escape hatch outside the Web `Response` API.

**★ Suppose the upgrade API existed everywhere. What would still be wrong with a WebSocket in a serverless function?**
Four things, none of them about the protocol. Lifetime: the connection dies when the invocation reaches its maximum duration, so a transport designed for hours lives for minutes. Affinity: a connection is pinned to one instance, but a reconnection is not guaranteed to reach the same one, and after a deploy old and new connections are on different builds. Shared memory: there is none between instances, so rooms, presence and pub/sub cannot live in a module-scope variable — the platform documentation says to keep them in an external store. And cost: an idle socket is a running invocation, billed while it is open, which is very different from an idle socket on a long-running server. Those four are the actual architecture, and the upgrade API does not change any of them.

**★ When is SSE plus `POST` genuinely not enough?**
When the upstream direction is high-frequency and small. Each `POST` is a complete HTTP request with headers and, cross-origin, possibly a preflight — negligible for a user clicking a button, dominant for a stream of cursor positions, per-keystroke collaborative editing operations, or a game loop. The tell is not "bidirectional", because you can always `POST`; it is the message rate and the ratio of overhead to payload. The other case is genuine presence for a room, where the server must know who is currently connected and tell everyone else — that needs shared state and fan-out regardless of transport, which is usually the real reason to buy a service rather than build one.

**★ A colleague wants to keep a room's membership in a module-level `Map`. What do you say?**
That it will work on their machine and fail the first time there is more than one instance, and that the failure will look like flakiness rather than a bug: some messages arrive, some do not, depending on which instance each client happened to reach. Connections are pinned to an instance for their lifetime but clients are not assigned to a common one, so two members of the same room can be on different instances with different `Map`s — and after a deploy, on different *builds*. The platform documentation is direct about it: durable state, presence, counters, rooms and pub/sub coordination belong in an external data store. The cheapest correct version is usually Redis pub/sub for fan-out plus a key per room for membership, which also survives a restart.

**★ What do you lose at the HTTP layer when you upgrade to a WebSocket?**
Per-message visibility, and everything built on it. The handshake goes through normal routing and security controls, so authentication, firewall rules and rate limits still apply *to the connection*. After the `101`, the traffic is opaque frames: your WAF cannot inspect a message, your rate limiter cannot count messages, your access log records one long request rather than a thousand operations, and a CDN cannot do anything at all. Everything you want per-message — authorization, quotas, audit — has to be rebuilt inside your own protocol. That is a real, ongoing cost, and it is the strongest argument for keeping the upstream direction on ordinary HTTP requests when the message rate allows it.

**★ How would you add live cursors to a collaborative board?**
Not with SSE, and not with a function-hosted socket. Cursor movement is client → server at high frequency, which is the one shape SSE cannot carry, and it needs fan-out to everyone in the room, which means state no single ephemeral instance owns. So: a managed realtime service, or a dedicated long-running process running a WebSocket server beside — not inside — the Next.js app, with presence in Redis rather than in process memory. The Next.js application's job shrinks to minting a short-lived, scoped token that authorizes the client to connect and subscribe to exactly the rooms it may see. Notably, the *rest* of the board — cards moving, comments arriving — stays on SSE, because it is user-speed and durable. Mixing the two by traffic shape is the correct answer, not choosing one transport for everything.

---

← [03ha · Connection lifetime and cost](03ha-connection-lifetime-limits-and-the-cost-of-an-open-stream.md) · [Chapter 15 overview](01-explanation.md) · Next → [03ia · Three ways to actually have a WebSocket](03ia-three-ways-to-actually-have-a-websocket.md)
