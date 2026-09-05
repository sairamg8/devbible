---
title: "Every SSE connection is on three separate clocks and one counter — an idle timeout, a function duration limit, a deploy, and the six connections a browser will give your domain — and the only correct design is one that expects to be cut"
sidebar_label: "03ha · Connection lifetime and cost"
sidebar_position: 39
description: "Idle timeouts and the 15-second comment heartbeat, maxDuration as a hard ceiling you design around, the HTTP/1.1 six-connection-per-domain limit versus HTTP/2 streams, reconnect storms after a deploy, graceful shutdown, and why an idle stream is a running invocation."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the WHATWG HTML Living Standard
> [§9.2.7 Authoring notes](https://html.spec.whatwg.org/multipage/server-sent-events.html);
> MDN [`EventSource`](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) and
> [Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events);
> Next.js [`maxDuration`](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/maxDuration)
> and [Self-hosting](https://nextjs.org/docs/app/guides/self-hosting) §`after`; Vercel
> [WebSockets](https://vercel.com/docs/functions/websockets) (for the function-lifetime and billing model).
> Documentation-verified, **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · Node **24.20.0**.

**[03h](03h-what-silently-breaks-sse-in-production.md) was about bytes that do not arrive. This page is about connections that do not last. A stream can be perfectly written, perfectly unbuffered, and still be cut after thirty seconds by a load balancer that saw no traffic, after five minutes by a function duration limit, or immediately by a deploy — and separately, the seventh tab a user opens will never connect at all, because a browser will not give one domain more than six HTTP/1.1 connections and each open stream permanently occupies one. None of these is a bug you can fix. They are the operating envelope, and the design that survives them is one that assumes it will be cut, says where it left off, and comes back with the load spread out.**

## The symptom index

| What you see | Almost always |
|---|---|
| Connections die at a consistent short interval, no error anywhere | An idle timeout in a proxy or load balancer |
| Connections die at a consistent longer interval, under load and idle alike | The function duration limit |
| Every client drops at once, then the service falls over a few seconds later | A deploy, followed by a synchronised reconnect |
| The seventh tab hangs in `CONNECTING` forever | The per-browser, per-domain HTTP/1.1 connection limit |
| Concurrency alarms fire with modest traffic | Each open stream is a running invocation |
| A background tab reconnects all night | Nothing tells the loop the tab is hidden |

## Idle timeouts, and the heartbeat that is a comment

The specification's authoring notes name this precisely, along with the interval:

> *"Legacy proxy servers are known to, in certain cases, drop HTTP connections after a short timeout. To protect against such proxy servers, authors can include a comment line (one starting with a ':' character) every 15 seconds or so."*

MDN says the same from the other direction:

> *"The comment line can be used to prevent connections from timing out; a server can send a comment periodically to keep the connection alive."*

Note that the mechanism is *bytes*, not events. An idle-connection timer counts traffic, so anything on the wire resets it — which is why a comment works and why it is the right choice: it is ignored by the parser, so it costs nothing on the client.

> *"A colon as the first character of a line is in essence a comment, and is ignored."*

```ts
const HEARTBEAT_MS = 15_000

const heartbeat = setInterval(() => {
  if (closed) return
  try {
    controller.enqueue(encoder.encode(': keep-alive\n\n'))
  } catch {
    cleanup() // the consumer went away between the guard and the enqueue
  }
}, HEARTBEAT_MS)
```

🔴 **A heartbeat must not be an event, and must not carry an `id:`.** An event wakes every listener on the client for no reason, and an id moves the resume cursor to a position no replay query knows about — the failure described in [03fa](03fa-designing-a-resumable-sse-stream.md). A comment does neither.

Fifteen seconds is the specification's own suggestion and a good default. The real requirement is *comfortably below the shortest idle timeout in your path*, which you have to find out rather than guess: a load balancer, an ingress controller, a corporate proxy and a mobile carrier NAT may each impose one.

## The duration ceiling you cannot heartbeat past

A heartbeat defeats an *idle* timeout. It does nothing about a limit on total execution time, which is what a serverless platform enforces:

> *"The `maxDuration` option allows you to set the maximum execution time (in seconds) for server-side logic in a route segment. Deployment platforms can use `maxDuration` from the Next.js build output to add specific execution limits."*
> — Next.js, [`maxDuration`](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/maxDuration)

```ts
// app/api/boards/[boardId]/events/route.ts
export const maxDuration = 300 // seconds, subject to what the platform permits
```

⚠️ **The Next.js documentation does not state any numeric ceiling** — it says only that platforms consume the value from the build output and apply their own limits. Whatever your platform's maximum is, it is a property of that platform and its plan, and I could not settle it from a primary source that applies generally. Find your own number and design for it; do not carry one from a blog post.

What the platform documentation *does* settle is the model. Vercel, describing WebSockets, states the rule that applies to any held-open response on a function:

> *"WebSocket connections close when a Vercel Function reaches its maximum duration."*
> — [Vercel · WebSockets](https://vercel.com/docs/functions/websockets)

So on a serverless target the stream **will** end, on a schedule, whether or not anything is wrong. That is not a failure to handle; it is the normal lifecycle. The design that survives it is the one from [03fa](03fa-designing-a-resumable-sse-stream.md): emit ids, read `Last-Event-ID`, replay the gap. A cut at the duration limit then costs a reconnect and a small replay instead of a hole in the client's state.

Better still, cut it yourself. A stream that closes deliberately, a little before the ceiling, closes at a moment you chose — with a `retry:` you set and jitter you control:

```ts
const SOFT_LIMIT_MS = 240_000 // comfortably inside maxDuration

setTimeout(() => {
  if (closed) return
  // Spread the return so every client does not come back together.
  controller.enqueue(encodeEvent({ retry: 3_000 + Math.floor(Math.random() * 5_000), data: 'rotating' }))
  controller.close()
}, SOFT_LIMIT_MS)
```

## An idle stream is a running function

This is the cost model people price last and discover first. On a long-lived Node server an idle SSE connection costs a socket and some memory. On a serverless platform it costs an invocation that has not finished:

> *"WebSocket connections use Vercel Functions and follow the same limits and pricing model as other Function invocations. This includes Function usage while the connection is active, plus Fast Data Transfer and Fast Origin Transfer for data sent over the connection."*
> — [Vercel · WebSockets](https://vercel.com/docs/functions/websockets)

The same arithmetic applies to a held-open HTTP response. One thousand dashboards left open is one thousand concurrently-executing functions, each doing nothing. That is a bill, and — usually sooner — a concurrency ceiling sized for requests that last two hundred milliseconds.

The three levers, in the order they are usually worth pulling: **poll instead** where the acceptable latency allows it; **multiplex**, so one browser tab holds one stream carrying several topics rather than one per widget; and **move the fan-out to a service built for it**, which is [03i](03i-websockets-and-the-serverless-request-model.md).

## Six connections, and what HTTP/2 changes

MDN states the limit and its scope, including the fact that it will not be fixed:

> *"When **not used over HTTP/2**, SSE suffers from a limitation to the maximum number of open connections, which can be specially painful when opening various tabs as the limit is _per browser_ and set to a very low number (6). The issue has been marked as "Won't fix" in Chrome and Firefox. This limit is per browser + domain… When using HTTP/2, the maximum number of simultaneous _HTTP streams_ is negotiated between the server and the client (defaults to 100)."*

Two details make this worse than it sounds. It is per **browser**, not per tab, so six tabs of your app exhaust it — and it is per **domain**, so those six are competing with every ordinary request your pages make to the same origin. An open SSE connection never returns to the pool, so the seventh request of any kind queues behind a stream that will not finish.

The specification's authoring notes list the workarounds, and are honest about their cost:

> *"Clients that support HTTP's per-server connection limitation might run into trouble when opening multiple pages from a site if each page has an `EventSource` to the same domain. Authors can avoid this using the relatively complex mechanism of using unique domain names per connection, or by allowing the user to enable or disable the `EventSource` functionality on a per-page basis, or by sharing a single `EventSource` object using a shared worker."*

In practice: **serve over HTTP/2**, which raises the ceiling from six connections to a negotiated stream count defaulting to 100 and removes the interference with ordinary requests. Where that is not available, a `SharedWorker` holding one connection for the whole origin is the specification's own suggestion, at the cost of a piece of infrastructure with its own lifecycle.

## Deploys, drains and the synchronised return

A deployment ends every open connection at the same instant. What happens next is decided by your `retry:` value, and if every client has the same one, they all come back together — into an instance that is still warming up.

On a self-hosted server the shutdown side is documented:

> *"When stopping the server, ensure a graceful shutdown by sending `SIGINT` or `SIGTERM` signals and waiting. The Next.js server will finish in-flight requests and execute any pending `after()` callbacks before exiting. Platforms should allow a configurable drain period (10-30 seconds is recommended) to ensure all background work completes."*
> — Next.js, [Self-hosting](https://nextjs.org/docs/app/guides/self-hosting)

⚠️ Note what that says: it finishes *in-flight requests*. An SSE stream is an in-flight request that never finishes on its own, so a drain period is a deadline for it rather than a promise — which is another reason for the soft self-imposed limit above, since a stream that ends itself every few minutes is never more than a few minutes from being safely drainable.

## Gotchas

**★ Symptom: connections silently die after a consistent short interval with no error anywhere.** Cause: an idle timeout counting bytes, not events, in a proxy or load balancer. Fix: a comment heartbeat at an interval comfortably under the shortest timeout in the path — the spec suggests every fifteen seconds:

```ts
setInterval(() => controller.enqueue(encoder.encode(': keep-alive\n\n')), 15_000)
```

**★ Symptom: the heartbeat is an event, and the client re-renders every fifteen seconds forever.** Cause: `encodeEvent({ data: 'ping' })` instead of a comment. Fix: a colon line. It is ignored by the parser, so it resets the timeout without waking a single listener.

**★ Symptom: after adding a heartbeat, resume stopped working.** Cause: the encoder stamps every frame with an id, including the keep-alive, so the resume cursor now points at a heartbeat no replay query recognises. Fix: heartbeats bypass the event encoder entirely:

```ts
controller.enqueue(encoder.encode(': keep-alive\n\n')) // no id, no event, no data
```

**★ Symptom: streams die at a fixed longer interval that no heartbeat prevents.** Cause: the function duration limit, which counts execution time rather than idleness. Fix: stop fighting it. Make the stream resumable, and close it yourself a little early so the cut happens on your schedule with a jittered `retry:` — see the `SOFT_LIMIT_MS` pattern above.

**★ Symptom: every client reconnects in the same second after a deploy and the new deployment falls over.** Cause: all connections were terminated together and every client is waiting the identical `retry:` interval you gave them. The specification permits but does not require the browser to add backoff. Fix: jitter the interval per connection, on the server, where you control it:

```ts
const jittered = 5_000 + Math.floor(Math.random() * 5_000) // 5–10s
controller.enqueue(encodeEvent({ retry: jittered, data: 'connected' }))
```

**★ Symptom: five tabs work and the sixth hangs in `CONNECTING` forever.** Cause: the per-browser, per-domain HTTP/1.1 connection limit, permanently occupied by each open stream. Fix: serve over HTTP/2, which negotiates a stream count defaulting to 100. Where that is impossible, share one connection across tabs with a `SharedWorker`, which is the specification's own suggestion — and be aware it is real infrastructure, not a one-liner.

**★ Symptom: with an SSE stream open, ordinary requests to the same origin queue.** Cause: the same six-connection budget. The stream is not competing with other streams, it is competing with your images, your API calls and your navigations. Fix: HTTP/2, or move the stream to a different subdomain so it draws from a separate connection pool — at the cost of CORS and cookie configuration.

**★ Symptom: a background tab burns invocations reconnecting all night.** Cause: nothing in the client knows the tab is hidden, and the server keeps timing the connection out and the client keeps coming back. Fix: for feeds where staleness while hidden is acceptable, close on `visibilitychange` and reopen on focus — the resume cursor makes reopening cheap and correct:

```ts
document.addEventListener('visibilitychange', () => {
  if (document.hidden) source.close()
  else openStream() // resumes from Last-Event-ID
})
```

**★ Symptom: concurrency alarms with a few hundred users.** Cause: each open stream is a running invocation, and your platform's concurrency limit was sized for requests that last milliseconds. Fix: reduce the number of open streams before optimising anything else — one per tab rather than one per component, polling for anything whose acceptable latency is measured in tens of seconds, and a dedicated realtime service where genuine fan-out is required.

**★ Symptom: a rolling deploy leaves the previous version serving streams for a long time.** Cause: a stream is an in-flight request, and a graceful shutdown waits for in-flight requests to finish. One that never finishes on its own holds the old instance until the drain deadline expires. Fix: the self-imposed soft limit — a stream that rotates every few minutes is never far from drainable, and the drain becomes a short wait rather than a forced kill.

**★ Symptom: the platform kills the invocation and the client shows an error rather than reconnecting.** Cause: the connection ended in a way the client treated as terminal — usually a hand-rolled `fetch` client with no retry taxonomy, since `EventSource` would have reconnected on a network-level end. Fix: in a hand-rolled client, an unexpected end of body is a retryable outcome, not a terminal one — the taxonomy in [03ga](03ga-owning-reconnection-when-you-own-the-client.md).

## Interview questions

**★ Why is a heartbeat a comment rather than an event, and how do you choose the interval?**
Because the goal is bytes on the wire, not information for the application. An idle timeout in a proxy or load balancer counts traffic, so any bytes reset it, and a comment line — a line beginning with a colon — is defined by the specification to be ignored by the parser. That means it resets every timer in the path without waking a listener, without re-rendering anything, and without touching the resume cursor. The interval is chosen against the *shortest* idle timeout in the path, not against a nice-looking number; the specification's suggestion of "every 15 seconds or so" is a good default precisely because it is under the common ones. If you have a proxy with a shorter timeout, the heartbeat has to be shorter than that, and the only way to know is to find out.

**★ A heartbeat keeps the connection alive. Why does the stream still die after a few minutes on a serverless platform?**
Because those are two different clocks. A heartbeat defeats an *idle* timeout, which measures time since the last byte. A function duration limit measures total execution time and does not care what the connection is doing — Vercel states plainly that connections close when a function reaches its maximum duration. So on a serverless target the stream is guaranteed to end on a schedule, and the correct response is not to extend it but to design for it: emit ids so the client can resume, and preferably close deliberately a little before the ceiling so the cut happens at a moment you chose, with a jittered reconnect delay you set.

**★ Why is the six-connection limit worse than it first sounds?**
Because of its scope on both axes. It is per browser and per domain, not per tab — so six tabs of your application exhaust it for the whole browser — and the budget is shared with every ordinary request to the same origin, so an open stream is competing with your images, your API calls and your navigations rather than with other streams. An SSE connection never returns to the pool, so the seventh request of any kind simply queues behind something that will not finish. MDN notes the issue is marked "Won't fix" in Chrome and Firefox, so it is a constraint to design around rather than wait out. HTTP/2 removes it by multiplexing streams over one connection, with a negotiated limit defaulting to 100.

**★ You have a thousand users with a dashboard open. What does that cost, and what would you change?**
On a serverless platform it is a thousand invocations executing simultaneously, because a held-open response is a function that has not returned — and the pricing model bills function usage while the connection is active, plus the data transferred. The first thing that breaks is usually not the bill but the concurrency limit, which was sized for short requests. What I would change, in order: check whether the feature actually needs sub-poll-interval latency, because a fifteen-second poll for a thousand users is about sixty-six requests a second and no held connections at all; multiplex so a browser tab holds one stream for every topic rather than one per widget; and if genuine fan-out to many clients is the requirement, move it to a service designed for it rather than to one function per viewer.

**★ Why is jitter more important than the exponential part of exponential backoff?**
Because the failures that matter are correlated. Clients do not drop one at a time; they drop together, when a deployment rolls, a load balancer restarts, an instance hits its duration limit, or a network partition heals. Every one of them then computes the same delay from the same failure instant and returns in the same moment — so a growth curve on its own just moves the stampede later without thinning it. Randomising the delay across the whole window is what actually spreads the arrivals, and it is the part that protects a service that is already unhealthy. Growth without jitter is a synchronised retry with extra arithmetic. You want it on both sides: the server sets a jittered `retry:` for `EventSource` clients, and a hand-rolled client jitters its own backoff.

**★ What happens to open SSE connections during a deploy, and what should the design do about it?**
They are all terminated, at the same instant. On a self-hosted server the process finishes in-flight requests during a drain period, but a stream is an in-flight request that never finishes on its own, so the drain is a deadline rather than a graceful handoff. The client then reconnects — and if every client has the same `retry:` value, they reconnect together, into an instance that is still warming up, which is how a routine deploy becomes an incident. Two fixes, and you want both: jitter the reconnection time per connection on the server, and give the stream a self-imposed soft lifetime well under the platform ceiling so connections are naturally staggered before a deploy ever happens.

**★ Why is a `SharedWorker` the specification's suggested fix for the connection limit, and why is it not the default advice?**
Because the limit is per browser and per domain, so the only way to reduce connections without reducing features is to have fewer of them — one connection shared by every tab, fanned out over message ports. The specification lists it alongside two worse options: unique domain names per connection, which multiplies your CORS and cookie surface, and letting the user turn the feature off per page, which is an admission of defeat. It is not the default advice because a `SharedWorker` is genuine infrastructure: its own lifecycle, its own error handling, its own debugging story, no framework support, and a hard dependency on browser support you have to verify. For an application whose users keep one tab open, HTTP/2 solves the problem for free and the worker solves nothing.

---

← [03h · What silently breaks SSE](03h-what-silently-breaks-sse-in-production.md) · [Chapter 15 overview](01-explanation.md) · Next → [03i · WebSockets and the serverless request model](03i-websockets-and-the-serverless-request-model.md)
