---
title: "Real-time in the App Router is not a feature you turn on — it is a decision about which HTTP shape your platform will hold open, and in a serverless-first deployment there is exactly one first-class answer"
sidebar_label: "03 · Real-time: the shapes"
sidebar_position: 160
description: "Polling, Server-Sent Events and WebSockets compared by what the request/response model can actually hold open; what a streaming Route Handler really is; and why SSE is the default answer in Next.js."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the Next.js [Streaming guide](https://nextjs.org/docs/app/guides/streaming),
> [`route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route),
> [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) and
> [Deploying to Platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms); MDN
> [`EventSource`](https://developer.mozilla.org/en-US/docs/Web/API/EventSource); Vercel
> [WebSockets](https://vercel.com/docs/functions/websockets). Documentation-verified,
> **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React **19.2.8** · Node **24.20.0**.

**Every real-time feature you will ever ship reduces to one question: which HTTP exchange can your deployment target keep open, and for how long. A Route Handler is a function that takes a `Request` and returns a `Response` — and a `Response` whose body is a `ReadableStream` is a connection the server can keep writing into for as long as the platform lets the invocation live. That single fact is the whole of real-time in the App Router. Server-Sent Events fit it exactly, because SSE *is* a long-lived HTTP response with a specific `Content-Type`. WebSockets do not fit it at all, because an upgrade replaces the response instead of streaming one, and Next.js has no API for that. This page establishes the shapes and the decision; the rest of the topic is the mechanics of each.**

## The three shapes, and what each costs

| Shape | Direction | What it is on the wire | Where it lives in Next.js |
|---|---|---|---|
| **Polling** | client pulls | N separate short requests | Any Route Handler, or a client library like SWR/TanStack Query |
| **Server-Sent Events** | server pushes | **one** long-lived HTTP response, `Content-Type: text/event-stream` | A `GET` Route Handler returning a `ReadableStream` |
| **WebSockets** | both ways | an HTTP `GET` with `Upgrade: websocket`, after which it is no longer HTTP | 🔴 **Nowhere.** Next.js exposes no upgrade API |

That last row is not a stylistic complaint. Vercel's own documentation states it flatly:

> *"Next.js does not expose an API for handling WebSocket upgrades."*
> — [Vercel · WebSockets](https://vercel.com/docs/functions/websockets)

Everything you will read about "WebSockets in Next.js" is one of three workarounds, and **03i** *(not written yet)* walks each of them.

## What a streaming Route Handler actually is

A Route Handler is a Web-standard request handler. The docs are explicit about the primitives:

> *"Route Handlers allow you to create custom request handlers for a given route using the Web `Request` and `Response` APIs."*
> — [Next.js · `route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route)

`Response` accepts a `ReadableStream` as its body. So a handler that "stays open" is a handler that returns a response whose stream has not been closed yet. Nothing framework-specific is happening:

```ts
// app/api/ticks/route.ts — the minimal long-lived response
export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('first chunk\n'))
      // The response is now open. Nothing has closed it.
      // Until controller.close() is called, the client is still reading.
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
```

The Streaming guide names this exact use:

> *"Outside of React rendering, Route Handlers can stream raw responses using the Web Streams API. This is useful for Server-Sent Events, large file generation, or any response where you want data to arrive progressively."*
> — [Next.js · Streaming](https://nextjs.org/docs/app/guides/streaming)

Server-Sent Events are that same response with two additions: the `Content-Type` is `text/event-stream`, and the bytes you enqueue follow a defined line format. That is genuinely the entire protocol. [03b](03b-the-event-stream-format.md) specifies the format byte by byte.

## Why SSE is the default answer, and when it is the wrong one

SSE wins by default because it is not a new transport. It is HTTP. It therefore inherits, for free, every piece of infrastructure you already have: your CDN, your reverse proxy, your `Set-Cookie` session, your CORS configuration, your firewall rules, your rate limiter, your access logs. A WebSocket inherits almost none of that, because after the upgrade the frames are opaque to every HTTP-aware box in the path.

It also inherits reconnection. The browser's `EventSource` reconnects on its own and tells the server where it left off — see **03f** *(not written yet)*. You do not write that code.

**Choose SSE when the data flows server → client.** Notifications, a live activity feed, job progress, a token stream from a model, "someone else moved this card", presence *broadcasts*. In SprintDesk terms: the board updating when a teammate drags a task is SSE-shaped.

**Choose a WebSocket when the client sends high-frequency messages too.** Cursor positions at 30 Hz, collaborative text editing with per-keystroke operations, a game loop. The tell is not "bidirectional" — you can always POST to a Route Handler — it is *how often* and *how small*. A POST per keystroke is a new TLS-terminated HTTP request per keystroke; a WebSocket frame is a few bytes on an already-open socket.

**Choose polling when the update interval is measured in tens of seconds and the payload is small.** Polling is unfashionable and frequently correct. It has no idle-connection cost, no reconnection semantics to get wrong, no proxy that buffers it, no per-domain connection limit, and it works identically on every deployment target that can serve a JSON response. See [14 · Client-side data fetching](../04-data-fetching-in-the-app-router/14-client-side-data-fetching-and-when-it-is-still-correct.md) for the SWR and TanStack Query shape of it.

## The cost nobody prices at design time: an idle connection is a running function

In a long-lived Node process, an open SSE connection costs a socket and a little memory. In a serverless deployment it costs **an invocation that is still running**. Vercel says so directly of WebSockets, and the same billing model applies to any held-open response:

> *"WebSocket connections use Vercel Functions and follow the same limits and pricing model as other Function invocations. This includes Function usage while the connection is active"*
> — [Vercel · WebSockets](https://vercel.com/docs/functions/websockets)

So: one thousand users with a dashboard open is one thousand concurrently-executing functions, each mostly asleep. That is a real bill and a real concurrency ceiling, and it is the single strongest argument for **polling at a sane interval** for anything that is not genuinely live. It is also why the platform will eventually cut your stream — **03h** *(not written yet)* covers the max-duration cliff.

## What the platform must support for any of this to work

The deployment-target requirements page draws the line precisely:

> *"**Streaming Required** means the platform must support chunked transfer encoding or HTTP/2 streaming and must not buffer the response before sending it to the client."*
> — [Next.js · Deploying to Platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms)

And on the baseline:

> *"To run Next.js, your platform needs **a Node.js server**. That's it."*

The corollary matters for real-time: `output: 'export'` (a static export) cannot serve any of this, and neither can a target that buffers. If your SSE endpoint "works locally and hangs in production", the cause is almost always a buffering layer, not your code.

## The decision, as a table you can defend in review

| If you need… | Use | Because |
|---|---|---|
| Server → client, seconds-scale, any number of clients | **SSE** | One HTTP response; automatic reconnect; nothing new in the stack |
| Server → client, minutes-scale | **Polling** | No idle connection cost at all |
| Client → server at keystroke frequency | **WebSocket via a long-lived process or a hosted service** | HTTP request overhead per message is the wrong shape |
| Presence for a large room, cross-instance | **A hosted realtime service** | Fan-out and presence state cannot live in one function instance's memory |
| A one-shot progressive response (LLM tokens, a big CSV) | **A streaming Route Handler, not SSE** | You want chunks, not an event protocol; see [04b · Constructing the response](../04-data-fetching-in-the-app-router/04b-constructing-the-response-status-codes-and-streaming.md) |

## Gotchas

**★ Symptom: your "real-time" feature is a `setInterval` in a `useEffect` and the team calls it SSE.** Cause: polling and streaming get conflated because both produce updating UI. Fix: name it honestly, because the failure modes differ completely — a poller degrades gracefully under a flaky network and a stream does not, while a stream costs one held connection and a poller costs none. If you meant polling, use a library that already handles dedup, focus revalidation and backoff rather than writing the interval yourself:

```tsx
'use client'
import useSWR from 'swr'

export function BoardActivity({ boardId }: { boardId: string }) {
  const { data } = useSWR(
    `/api/boards/${boardId}/activity`,
    (u: string) => fetch(u).then((r) => r.json()),
    { refreshInterval: 15_000, revalidateOnFocus: true },
  )
  return <ActivityList items={data?.items ?? []} />
}
```

**★ Symptom: `GET` handler returns a stream and the response is served from cache instead of running.** Cause: with Cache Components enabled a `GET` Route Handler is prerenderable, and a handler that never touches request data or uncached I/O will be evaluated at build time. Fix: force it to request time explicitly — `connection()` is the documented switch:

```ts
// app/api/ticks/route.ts
import { connection } from 'next/server'

export async function GET() {
  await connection() // prerendering stops here
  const stream = buildEventStream()
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}
```

> *"The `connection()` function allows you to indicate rendering should wait for an incoming user request before continuing."*
> — [Next.js · `connection`](https://nextjs.org/docs/app/api-reference/functions/connection)

**★ Symptom: you added `export const runtime = 'edge'` to the stream route "because streaming is an edge thing".** Cause: a stale mental model. The `runtime` reference now lists `'edge'` as deprecated and tells you to delete the export. Fix: remove it; Node.js is the default and streams fine.

```diff
- export const runtime = 'edge'
```

See [05](05-edge-functions-and-custom-cache-structures-for-global-comput.md) for the full current framing.

**★ Symptom: you POST to open the stream and the browser will not connect.** Cause: `EventSource` issues a `GET` and cannot be given a method or a body. Fix: put the subscription parameters in the URL, or drop `EventSource` for `fetch` — **03g** *(not written yet)* shows the second option in full.

**★ Symptom: the feature works with two testers and collapses in staging with fifty.** Cause: you counted requests, not concurrent invocations. Fifty open streams is fifty functions alive at once against a concurrency limit sized for short requests. Fix: either move the fan-out to a hosted realtime service, or reduce the number of open streams — one stream per browser tab multiplexing several topics beats one stream per widget.

## Interview questions

**★ Why can a Route Handler serve Server-Sent Events but not a WebSocket, when both start as an HTTP `GET`?**
Because SSE never stops being HTTP and a WebSocket does. SSE is a normal `200` response whose body happens to be long and whose `Content-Type` is `text/event-stream`; the Route Handler contract — take a `Request`, return a `Response` — describes it perfectly, and the body can be a `ReadableStream` you write into over time. A WebSocket handshake is a `GET` carrying `Upgrade: websocket` to which the server answers `101 Switching Protocols` and then *stops speaking HTTP on that socket*, handing the raw connection to a frame protocol. There is no `Response` object that expresses "and now give me the socket", so the handler signature cannot carry it. Vercel's docs say it outright: *"Next.js does not expose an API for handling WebSocket upgrades."* Platforms that support WebSockets in functions do it through an escape hatch outside the Web `Response` API.

**★ A colleague argues that polling is always worse than SSE. Where is that wrong?**
It is wrong on cost, on failure behaviour, and on infrastructure surface. A poll is a short request: it holds no server resource between polls, so a thousand users at one poll per thirty seconds is roughly thirty-three requests per second, not a thousand live invocations. It survives a proxy that buffers, a CDN that will not pass chunked responses, and a browser that has hit its per-domain connection limit — none of which SSE survives. And it has no resume protocol to get wrong. SSE wins when the acceptable latency is below the poll interval you would otherwise need, or when the payload is large enough that repeatedly fetching it dominates. Below that crossover, polling is the cheaper and more robust engineering choice.

**★ What does "the platform must not buffer the response" actually mean, and how does it break a feature that works locally?**
Streaming depends on every hop forwarding bytes as they arrive rather than accumulating them and sending one body at the end. `next dev` gives you a single process talking straight to your browser, so there is no hop to buffer. Production inserts a reverse proxy, a CDN and a compression layer, any of which may buffer by default — nginx does, and gzip/Brotli hold bytes until they have enough to compress. The symptom is not an error: the connection succeeds, the client sits silent, and then everything arrives at once, or when the stream closes. That is why the deployment requirements phrase the criterion as "must not buffer the response before sending it to the client" rather than "must support streaming". **03h** *(not written yet)* has the fixes.

**★ You are asked to add live cursors to SprintDesk's board. What do you propose and why?**
Not SSE. Cursor positions are client→server at high frequency, which is the one shape SSE cannot carry — each cursor move would be a separate POST, and the per-request overhead dwarfs the payload. It also needs fan-out across everyone in the room, which means shared state that no single function instance owns. So: a hosted realtime service, or a dedicated long-lived Node process running a WebSocket server next to (not inside) the Next.js app, with presence state in Redis rather than in process memory. Vercel's own guidance for WebSocket state is the same — *"Store durable state, presence, counters, rooms, and pub/sub coordination in an external data store instead of relying on in-memory variables."* The Next.js app then only needs to hand the client a short-lived token to connect with.

**★ What is the first thing you check when an SSE endpoint "hangs" in production?**
Whether anything is arriving at all versus arriving late. If the connection opens and the first byte never comes, suspect the handler — a `start()` that awaits before its first `enqueue`, or a route that got prerendered. If bytes arrive but all at once, it is a buffering layer: proxy, CDN or compression. The cheap discriminator is to send a comment line (`: ping`) immediately on connect, before any work. If that comment never appears, the path is buffering; if it appears instantly and the real events do not, the problem is your producer.

---

← **02 · Hybrid API design: Route Handlers and Server Actions** *(not written yet)* · [Chapter 15 overview](01-explanation.md) · Next → [03b · The event stream format](03b-the-event-stream-format.md)
