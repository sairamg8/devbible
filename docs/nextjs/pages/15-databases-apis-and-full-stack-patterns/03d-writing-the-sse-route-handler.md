---
title: "An SSE Route Handler is a ReadableStream with a lifecycle, and the half everyone forgets is the teardown — the heartbeat, the abort signal and the cancel callback that stop the work when the client leaves"
sidebar_label: "03d · Writing the SSE Route Handler"
sidebar_position: 32
description: "The full handler: authorize before you stream, flush immediately, heartbeat, request.signal, the cancel callback, one idempotent cleanup, and why a leaked interval is the classic SSE production incident."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the Next.js [Streaming guide](https://nextjs.org/docs/app/guides/streaming)
> §"Streaming in Route Handlers", [`route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route),
> [`connection`](https://nextjs.org/docs/app/api-reference/functions/connection) and
> [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) §Caching; MDN
> [`ReadableStream()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/ReadableStream)
> and [`Request.signal`](https://developer.mozilla.org/en-US/docs/Web/API/Request/signal);
> WHATWG HTML [§9.2.7 Authoring notes](https://html.spec.whatwg.org/multipage/server-sent-events.html).
> Documentation-verified, **no sandbox run**.
> Target: **Next.js 16.3.4** · Node **24.20.0**.

**Writing the happy path of an SSE handler takes five minutes. What separates a demo from something you can leave running is the teardown: a heartbeat so intermediaries do not kill an idle connection, an abort path so a closed browser tab stops the work it started, and a single cleanup function that runs exactly once no matter which of the ways the connection ends. Get that wrong and the symptom is not an error — it is a server that gets slower every hour because every tab anyone ever opened still has an interval running and a database listener attached.**

## The ways a stream ends, and why they need one cleanup

| How it ends | What fires | What you must release |
|---|---|---|
| You call `controller.close()` | nothing else | the heartbeat, the data subscription |
| The client navigates away or closes the tab | the stream's `cancel(reason)` callback, and/or an abort on `request.signal` | the heartbeat, the data subscription |
| The source throws | the stream errors | everything, plus you owe the client a final event |
| The platform kills the invocation at max duration | possibly nothing at all | whatever the process holds — see [03h](03h-what-silently-breaks-sse-in-production.md) |

MDN defines the second one precisely:

> *"`cancel` (reason) — This method, also defined by the developer, will be called if the app signals that the stream is to be canceled (e.g., if `ReadableStream.cancel()` is called). The contents should do whatever is necessary to release access to the stream source."*
> — [MDN · `ReadableStream()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/ReadableStream)

Because the paths differ but the obligations are identical, write **one idempotent `cleanup()`** and call it from all of them. That is the single most important structural decision on this page.

## The handler, complete

```ts
// app/api/boards/[boardId]/events/route.ts
import { connection } from 'next/server'
import { encodeEvent, encodeComment } from '@/lib/sse'
import { subscribeToBoard } from '@/lib/board-events'
import { requireBoardMember } from '@/lib/dal'

const HEARTBEAT_MS = 15_000

export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  // Never prerender a stream. See "Do not let this route be prerendered" below.
  await connection()

  const { boardId } = await params
  // Authorize BEFORE opening the stream, so a rejection is a real HTTP status.
  await requireBoardMember(boardId)

  const lastEventId = request.headers.get('last-event-id')

  let cleanup = () => {}

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false

      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return
        try {
          controller.enqueue(chunk)
        } catch {
          // The stream was already closed or errored; stop producing.
          cleanup()
        }
      }

      // 1. Flush something immediately. This proves the path is not buffering
      //    and gives the client an `open` event straight away.
      safeEnqueue(encodeComment('open'))
      safeEnqueue(encodeEvent({ retry: 3000, data: { kind: 'connected' } }))

      // 2. Keep-alive. Intermediaries count idle time in bytes, not events.
      const heartbeat = setInterval(
        () => safeEnqueue(encodeComment('hb')),
        HEARTBEAT_MS,
      )

      // 3. The real source. `subscribeToBoard` returns an unsubscribe function.
      const unsubscribe = await subscribeToBoard(boardId, lastEventId, (change) => {
        safeEnqueue(
          encodeEvent({ id: change.seq, event: change.kind, data: change.payload }),
        )
      })

      // 4. ONE cleanup, safe to call any number of times.
      cleanup = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {
          // Already closed by the consumer; nothing to do.
        }
      }

      // 5. The client going away is an abort on the request.
      request.signal.addEventListener('abort', cleanup, { once: true })
    },

    // 6. The consumer cancelled the body. Same obligations as an abort.
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
```

Six things in that handler are load-bearing, and each is a bug if removed.

### 1 · Authorize before the stream, not inside it

Once you return a `200` with a stream, you have given up the ability to answer `401` or `403` — and the SSE client treats any non-`200` as terminal, so the browser will not even retry. Do the membership check in the handler body, where a thrown `unauthorized()` or `forbidden()` still becomes a real status. See [03g · Authorization at every entry point](../10-forms-authentication-and-security-hardening/03g-authorization-ownership-checks-and-every-entry-point.md) for why "every entry point" includes this one.

### 2 · Flush something immediately

The first `enqueue` inside `start()` runs before any awaiting, so the client gets bytes at once. That does three jobs: it turns `readyState` to `OPEN` and fires the client's `open` event; it proves the path is not block-buffering; and it lets you set `retry` once for the life of the subscription.

### 3 · The heartbeat is not optional

The specification's authoring notes name the interval:

> *"Legacy proxy servers are known to, in certain cases, drop HTTP connections after a short timeout. To protect against such proxy servers, authors can include a comment line (one starting with a ':' character) every 15 seconds or so."*
> — [WHATWG HTML §9.2.7](https://html.spec.whatwg.org/multipage/server-sent-events.html)

A comment, not an event: it costs a handful of bytes and dispatches nothing, so the client's handlers never see it.

### 4 · `cleanup` is captured by reference, and idempotent

`cleanup` is declared with `let` outside the stream and assigned inside `start()`, because `cancel()` may fire before or after `start()` finishes and must reach the same function. The `closed` guard makes double invocation harmless — and double invocation *will* happen, because an abort and a cancel commonly both fire.

### 5 · `request.signal` is how you learn the client left

The Fetch standard puts an `AbortSignal` on every `Request`:

> *"The read-only `signal` property of the `Request` interface returns the `AbortSignal` associated with the request."*
> — [MDN · `Request.signal`](https://developer.mozilla.org/en-US/docs/Web/API/Request/signal)

⚠️ Next.js's own documentation does not enumerate per-platform abort behaviour for Route Handlers, so treat `request.signal` as **one** of your cleanup triggers rather than the only one. Listening on both the signal and `cancel()` costs nothing and covers whichever one your deployment target actually delivers. Never make correctness depend on exactly one of them firing.

### 6 · `cancel()` closes the loop

If the consumer tears down the body — the browser, an intermediary, or your own `fetch` reader calling `reader.cancel()` — this is the callback that runs. Without it, a client that disconnects leaves your interval and your database listener alive with nothing reading them.

## Do not let this route be prerendered

With Cache Components enabled, a `GET` Route Handler is prerenderable:

> *"When Cache Components is enabled, `GET` Route Handlers follow the same model as normal UI routes in your application. They run at request time by default, can be prerendered when they don't access uncached or runtime data"*
> — [Next.js · Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)

A stream handler that reads `request.headers` or awaits `params` is already request-bound, so in practice it will not prerender — but *"in practice"* is not a contract you want a live connection resting on. `await connection()` states it:

> *"The `connection()` function allows you to indicate rendering should wait for an incoming user request before continuing."*
> — [Next.js · `connection`](https://nextjs.org/docs/app/api-reference/functions/connection)

Prerendering also stops on I/O generally:

> *"Prerendering stops if the `GET` handler accesses network requests, database queries, async file system operations, request object properties (like `req.url`, `request.headers`, `request.cookies`, `request.body`), runtime APIs like `cookies()`, `headers()`, `connection()`, or non-deterministic operations."*
> — [Next.js · Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)

## Gotchas

**★ Symptom: memory and database connections climb steadily and never come back down.** Cause: no `cancel` handler and no abort listener, so every closed tab leaves an interval and a subscription alive. This is *the* SSE production incident. Fix: one idempotent `cleanup()`, wired to both paths:

```ts
cleanup = () => {
  if (closed) return
  closed = true
  clearInterval(heartbeat)
  unsubscribe()
  try { controller.close() } catch {}
}
request.signal.addEventListener('abort', cleanup, { once: true })
// …and in the stream definition:
cancel() { cleanup() }
```

**★ Symptom: an "invalid state: controller is already closed" error appears in your logs.** Cause: a timer or a subscription callback fired after the stream ended and called `enqueue`. Fix: guard every enqueue behind the `closed` flag *and* a try/catch — the flag handles the ordinary race, the catch handles the one where the consumer closed the stream underneath you:

```ts
const safeEnqueue = (chunk: Uint8Array) => {
  if (closed) return
  try { controller.enqueue(chunk) } catch { cleanup() }
}
```

**★ Symptom: `cleanup` runs twice and `unsubscribe()` throws the second time.** Cause: abort and cancel both fired, which is normal, not exceptional. Fix: the `closed` guard as the first line of `cleanup`, plus `{ once: true }` on the listener. Never rely on the caller to invoke it once.

**★ Symptom: connections silently die after about a minute with no error anywhere.** Cause: an idle timeout in a proxy or load balancer, counting bytes rather than events. Fix: the heartbeat, at an interval comfortably under the shortest timeout in the path:

```ts
const heartbeat = setInterval(() => safeEnqueue(encodeComment('hb')), 15_000)
```

**★ Symptom: the client is stuck in `CONNECTING` and your await never resolves.** Cause: `start()` awaits something slow — a database connection, an auth lookup — before its first `enqueue`, so no bytes leave and the browser has not seen a usable response yet. Fix: do the slow work *before* constructing the stream, and make the first thing inside `start()` a synchronous enqueue:

```ts
await requireBoardMember(boardId)          // slow work, outside the stream
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(encodeComment('open'))  // first byte, immediately
    // …
  },
})
```

**★ Symptom: unauthorized users can open the stream and are only rejected once events start.** Cause: authorization moved inside `start()`, where you can no longer produce a status code. Fix: authorize in the handler body before `new ReadableStream`, so a failure is a real `401`/`403`. Anything checked inside the stream can only ever be reported as an event, which is invisible to logs, metrics and rate limiters.

**★ Symptom: an error thrown inside the source kills the connection with no diagnostics on the client.** Cause: you let it propagate, erroring the stream, which the browser sees as a broken connection. Fix: catch it, emit it as a payload, and close cleanly so the client's own reconnect logic takes over:

```ts
try {
  await pump()
} catch {
  safeEnqueue(encodeEvent({ event: 'streamError', data: { retryable: true } }))
  cleanup()
}
```

**★ Symptom: `params` destructured directly and TypeScript complains.** Cause: dynamic params are a promise in the App Router. Fix: `const { boardId } = await params` — the same shape every dynamic Route Handler uses, per [`route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route).

**★ Symptom: the route works in development and returns an empty body once deployed.** Cause: with Cache Components enabled, a handler that touched no request data got prerendered at build time, so what ships is a stored response rather than a live invocation. Fix: `await connection()` as the first line, which the docs list among the calls that stop prerendering.

## Interview questions

**★ Name every way an SSE connection can end, and what your handler owes each one.**
Four. You close it deliberately, after finishing the work — you owe the timers and subscriptions. The client goes away, which surfaces as an abort on `request.signal` and/or a `cancel()` on the stream — same obligations, and both may fire, so cleanup must be idempotent. The source errors — you owe the client a final event and a clean close rather than a broken connection, because a clean close reconnects and an error is murkier. And the platform terminates the invocation at max duration, where you may get no callback at all — which is why nothing that must happen should be deferred to teardown, and why the client must be built to resume. The design rule that falls out is: one `cleanup()`, guarded, called from every path, and no state that only teardown can save.

**★ Why is `request.signal` insufficient on its own, and what do you pair it with?**
Because it is a Fetch-standard property of the `Request` object, and the framework documentation does not state per-deployment-target guarantees about when — or whether — a Route Handler's request is aborted when a client disconnects. It very plausibly fires; it is not something to bet an unbounded loop on. The stream's own `cancel(reason)` callback is the complementary signal, defined by the Streams standard and invoked when the consumer tears down the body. Listening to both and routing them into one idempotent cleanup costs a line and removes the question entirely.

**★ Why authorize before opening the stream rather than inside it?**
Because status codes are only available before the response head is committed. As soon as you return `new Response(stream)` with `200`, the only channel left is the stream itself, and the SSE client treats a non-`200` as *fail the connection* — terminal, with no retry — so you cannot even change your mind later. Authorizing first also keeps the failure observable in the ordinary way: it appears in access logs as a `403`, it is countable, and it is rate-limitable, none of which is true of an application-level error event delivered on an otherwise successful response.

**What is the heartbeat actually protecting against, given that neither end has a timeout?**
The hops in between. Load balancers, reverse proxies and NAT devices all reclaim connections that have been idle for some period, and "idle" is measured in bytes on the wire, not in application-level activity. A feed that is genuinely quiet for a minute looks identical to a dead connection from the outside. The comment line is the cheapest possible liveness token: a handful of bytes, no event dispatched, no client code involved. Fifteen seconds is the specification's own suggestion and is comfortably under the common sixty-second idle timeouts.

**Why does the first byte need to leave the handler before any awaiting?**
Because everything the client and the intermediaries do next is triggered by bytes, not by your intent. The browser will not fire `open` and will not leave `CONNECTING` until it has a parseable response; a buffering proxy will not reveal itself until something is flushed; and your own monitoring cannot distinguish "slow to authorize" from "hung" without a first chunk to timestamp. Emitting a comment as the very first statement in `start()` turns all three of those into observable events and costs a few bytes. The corollary is that any slow work — auth, a pool checkout — belongs outside the stream constructor.

**Your handler holds a database subscription. What happens to it when the platform kills the invocation at max duration?**
Whatever the runtime does on termination, which is not something the framework promises for you — you may get no `cancel`, no abort and no chance to run cleanup. That is why the subscription must be something the *other* side can also reclaim: a Postgres `LISTEN` on a pooled connection that is returned when the process dies, a Redis subscriber with a timeout, a lease with an expiry rather than an explicit release. Design so that the worst case is a resource that expires on its own rather than one that must be explicitly freed by code you may never get to run.

---

← [03c · Producing the stream correctly](03c-producing-the-stream-correctly.md) · [Chapter 15 overview](01-explanation.md) · Next → [03e · Pull sources and back-pressure](03e-pull-sources-and-back-pressure.md)
