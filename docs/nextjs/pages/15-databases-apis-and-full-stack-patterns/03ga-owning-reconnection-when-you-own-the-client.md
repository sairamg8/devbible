---
title: "Once you replace EventSource with fetch you have not written a client, you have written half of one — the missing half is a retry loop that knows which failures are worth retrying"
sidebar_label: "03ga · Owning reconnection"
sidebar_position: 168
description: "The request half of a hand-rolled SSE client: Authorization headers and POST bodies, the CORS preflight they cost, a failure taxonomy that separates retryable from terminal, exponential backoff with jitter, honouring Retry-After, token refresh inside the loop, and AbortController teardown."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the WHATWG HTML Living Standard
> [§9.2.2–§9.2.4 Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
> (the reconnection algorithm this client reimplements); MDN
> [`ReadableStreamDefaultReader.cancel()`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultReader/cancel)
> and [`Response.body`](https://developer.mozilla.org/en-US/docs/Web/API/Response/body); Next.js
> [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) §Caching.
> Documentation-verified, **no sandbox run, no network measurements**.
> Target: **Next.js 16.3.4** · React **19.2.8** · Node **24.20.0**.

**[03g](03g-fetch-and-readablestream-when-you-need-headers.md) got the bytes out of the response and turned them into events. This page is the other half: making the request in the first place, and making it again. `EventSource` had a specified reconnection algorithm behind it — a reconnection time, an optional backoff, a `Last-Event-ID` header set automatically, and a rule for which failures are worth retrying. None of that exists in a `fetch` loop until you write it, and the version most people write first is a `while (true)` with a fixed delay, which retries a `401` forever and stampedes on a deploy. The compensation is that you can be *better* than the browser: you can see the status code, you can honour `Retry-After`, and you can refresh a token between attempts. Those three are impossible with `EventSource`.**

## The request you came here for

```ts
const response = await fetch('/api/boards/abc/events', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...(lastEventId ? { 'Last-Event-ID': lastEventId } : {}),
  },
  body: JSON.stringify({ topics: ['activity', 'presence'], since: cursor }),
  signal: controller.signal,
  cache: 'no-store',
})
```

Every line of that object is impossible with `EventSource`. Two notes on the server side:

- **A `POST` Route Handler can return a stream exactly like a `GET` one.** The docs list `POST` among the supported methods and state that *"Route Handlers are not cached by default. You can, however, opt into caching for `GET` methods. Other supported HTTP methods are **not** cached."* — so a `POST` stream also sidesteps the prerendering question a `GET` stream has to answer with `connection()`.
- **`Last-Event-ID` is now a header you set**, and the server reads it exactly as it would from `EventSource`. Same handler, same validation, same bounded replay — [03fa](03fa-designing-a-resumable-sse-stream.md). It is client-supplied input in both cases; the only thing that changed is which piece of code supplies it.

## Cross-origin: a custom header costs you a preflight

`Authorization` is not a CORS-safelisted request header, so a cross-origin call triggers an `OPTIONS` preflight before the stream opens. Not fatal, but it is a second round trip on every connection attempt — including every reconnect, which is exactly when latency hurts — and the server has to answer it:

```ts
// app/api/boards/[boardId]/events/route.ts
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://app.example.com',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Last-Event-ID',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '600',
    },
  })
}
```

Same-origin — the usual case in a Next.js app, where the Route Handler ships in the same deployment as the page — has no preflight at all. That is a good argument for proxying a third-party stream through your own Route Handler rather than connecting to it from the browser.

## The failure taxonomy, which is the actual design problem

`EventSource` has two outcomes: *reestablish* or *fail*, decided almost entirely by whether the response was a network error. You have five, and you can tell them apart:

| Outcome | Retry? | Delay | Why |
|---|---|---|---|
| Network error, DNS failure, connection reset | ✅ | backoff + jitter | Nothing about the request was wrong |
| `429`, or `503` with `Retry-After` | ✅ | **the server's number**, not yours | The server told you when to come back |
| `5xx` without `Retry-After` | ✅ | backoff + jitter | Probably transient, possibly not — cap the attempts |
| `401` / `403` | ⚠️ **once**, after refreshing the token | immediate | Retrying the same credential is pure load |
| `400` / `404` / `422`, wrong `Content-Type` | ❌ terminal | — | The request is wrong; retrying cannot fix it |
| Clean end of body | 🔴 **your choice** | your `retry` value | `EventSource` reconnects here. You decide |

That last row is the one worth pausing on. The specification makes a clean end of stream reconnect — *"if res is not a network error, then reestablish the connection"* — which produces the infinite-poll behaviour described in [03f](03f-eventsource-reconnection-and-last-event-id.md). In your own client you can distinguish "the server closed after telling me the job was done" from "the server closed unexpectedly", because you saw the events. Take the opportunity.

## The loop

```ts
// lib/sse-client.ts
import { readEventStream } from './sse-fetch'
import type { ParsedEvent } from './sse-parser'

type ClientOptions = {
  url: string
  getAccessToken: () => Promise<string>
  onEvent: (event: ParsedEvent) => void
  onStatus?: (status: 'connecting' | 'live' | 'offline') => void
  signal: AbortSignal
}

const BASE_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000
const MAX_CONSECUTIVE_FAILURES = 12

class TerminalStreamError extends Error {}

function backoff(attempt: number): number {
  const exponential = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt)
  // Full jitter. Without this, every client that dropped together returns together.
  return Math.random() * exponential
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('aborted', 'AbortError'))
    }, { once: true })
  })

export async function runEventStream(options: ClientOptions): Promise<void> {
  const { url, getAccessToken, onEvent, onStatus, signal } = options
  let lastEventId = ''
  let serverRetryMs: number | null = null // whatever `retry:` last told us
  let attempt = 0
  let refreshedForThisAttempt = false

  while (!signal.aborted) {
    onStatus?.(attempt === 0 ? 'connecting' : 'connecting')
    try {
      // Read the token INSIDE the loop, so every attempt uses a fresh one.
      const token = await getAccessToken()

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
          ...(lastEventId ? { 'Last-Event-ID': lastEventId } : {}),
        },
        cache: 'no-store',
        signal,
      })

      if (response.status === 401 || response.status === 403) {
        if (refreshedForThisAttempt) throw new TerminalStreamError('not authorized')
        refreshedForThisAttempt = true
        continue // one immediate retry with a freshly-minted token
      }
      if (response.status === 429 || response.status === 503) {
        const retryAfter = Number(response.headers.get('retry-after'))
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1_000
          : backoff(attempt++), signal)
        continue
      }
      if (response.status >= 400 && response.status < 500) {
        throw new TerminalStreamError(`request rejected: ${response.status}`)
      }
      if (!response.ok) throw new Error(`server error: ${response.status}`)

      onStatus?.('live')
      refreshedForThisAttempt = false
      const connectedAt = Date.now()

      lastEventId = await readEventStream(
        response,
        onEvent,
        (ms) => { serverRetryMs = ms },
      )

      // Reset the backoff only if the connection was genuinely useful. A stream
      // that dies after 200ms is a failure however cleanly it ended.
      if (Date.now() - connectedAt > 10_000) attempt = 0
    } catch (error) {
      if (signal.aborted || (error as Error).name === 'AbortError') return
      if (error instanceof TerminalStreamError) {
        onStatus?.('offline')
        throw error
      }
    }

    if (attempt >= MAX_CONSECUTIVE_FAILURES) {
      onStatus?.('offline')
      throw new TerminalStreamError('giving up after repeated failures')
    }
    await sleep(serverRetryMs ?? backoff(attempt++), signal)
  }
}
```

Five decisions in there are the difference between this and a `while (true)`:

- **Full jitter, not a fixed delay.** Every client that dropped together would otherwise return together, so the growth curve just moves the stampede later without thinning it. This is the client-side twin of the server-side `retry:` jitter in [03f](03f-eventsource-reconnection-and-last-event-id.md), and you want both; what a synchronised return actually does to a deployment is in [03h · What silently breaks SSE in production](03h-what-silently-breaks-sse-in-production.md).
- **`Retry-After` beats your own backoff.** The server knows something you do not. `EventSource` cannot read it.
- **The token is fetched inside the loop.** A stream that outlives its access token is the normal case, not an edge case.
- **A `4xx` is terminal.** Retrying a `404` is load with no possibility of success.
- **The backoff resets on a *useful* connection, not on any connection.** A stream that opens and dies immediately, repeatedly, is a failing stream; resetting `attempt` on every successful `fetch` turns exponential backoff back into a tight loop.

## Teardown, and where the loop lives in React

```tsx
'use client'
import { useEffect, useState } from 'react'
import { runEventStream } from '@/lib/sse-client'

export function BoardFeed({ boardId }: { boardId: string }) {
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting')
  const [items, setItems] = useState<Activity[]>([])

  useEffect(() => {
    const controller = new AbortController()

    runEventStream({
      url: `/api/boards/${boardId}/events`,
      getAccessToken,
      onStatus: setStatus,
      onEvent: (event) => {
        if (event.type !== 'activity') return
        const row: Activity = JSON.parse(event.data)
        setItems((prev) => [row, ...prev.filter((x) => x.id !== row.id)])
      },
      signal: controller.signal,
    }).catch((error) => {
      if ((error as Error).name === 'AbortError') return // expected on unmount
      reportStreamFailure(error)
    })

    return () => controller.abort()
  }, [boardId])

  return <Feed status={status} items={items} />
}
```

`controller.abort()` is doing three jobs at once: it rejects the in-flight `read()`, it cancels a pending `sleep()` so the loop does not wake up after unmount, and it propagates to the server as `request.signal` aborting, which fires the stream's `cancel()` callback and stops the producer — see [03d](03d-writing-the-sse-route-handler.md). Merely setting a `cancelled` flag does none of those.

## Gotchas

**★ Symptom: the bearer token expires mid-stream and the connection dies with no diagnostics.** Cause: the header was captured once at connect time; a stream that outlives its token has no way to refresh it, and the server can no longer answer with a status code once the body has started. Fix: read the token *inside* the loop so every attempt is fresh, and have the server signal expiry as an application event rather than trying to change status mid-body:

```ts
const token = await getAccessToken() // inside the while, not above it
```

**★ Symptom: you added `Authorization` and a cross-origin stream stopped working entirely.** Cause: the custom header made the request non-simple and there is no `OPTIONS` handler, so the preflight fails and the real request is never sent. Fix: export an `OPTIONS` Route Handler whose `Access-Control-Allow-Headers` names every custom header you send — `Authorization` and `Last-Event-ID` both.

**★ Symptom: cross-origin cookies are not sent even though the CORS headers look right.** Cause: `fetch` defaults to `credentials: 'same-origin'`, so a cross-origin request sends no cookies at all unless you ask. Fix: `credentials: 'include'` on the request, `Access-Control-Allow-Credentials: true` on the response, and an explicit origin — a wildcard is not permitted alongside credentials.

**★ Symptom: aborting the request leaves the server handler running.** Cause: nothing was aborted — you stopped reading, which is not the same as cancelling. Fix: one `AbortController` per stream lifetime, passed into `fetch` and into every `sleep`:

```ts
const controller = new AbortController()
// ...
return () => controller.abort()
```

**★ Symptom: `AbortError` is logged as a crash every time the user navigates.** Cause: abort rejects the in-flight `read()`, the `fetch` promise and any pending timer, and a bare catch reports all three. Fix: treat it as the normal termination it is, at the one place the promise is consumed:

```ts
.catch((error) => {
  if ((error as Error).name === 'AbortError') return
  reportStreamFailure(error)
})
```

**★ Symptom: a revoked token produces thousands of requests a minute.** Cause: the loop retries every failure identically, so a `401` is retried at the same cadence as a dropped connection — and it will never succeed. Fix: the taxonomy. `4xx` is terminal after at most one token refresh; only network errors and `5xx` get the backoff.

**★ Symptom: the client reconnects instantly and forever after the server starts returning `503`.** Cause: `Retry-After` was ignored, or the backoff resets on every response that arrives at all. Fix: honour the header when it is present and parseable, and only reset the attempt counter after a connection that lasted long enough to be useful:

```ts
if (Date.now() - connectedAt > 10_000) attempt = 0
```

**★ Symptom: after a reconnect the client re-receives events it already had, or misses some.** Cause: `lastEventId` was scoped inside the `try`, or a fresh parser was created per attempt and its cursor discarded. Fix: hold the cursor in the loop's scope and feed it back into the next request's headers — that is the whole reason `readEventStream` returns it:

```ts
lastEventId = await readEventStream(response, onEvent, onRetry)
```

**★ Symptom: two identical streams open in development and everything renders twice.** Cause: React 19's Strict Mode runs effects twice, and the first loop was never aborted because the cleanup returned nothing. Fix: always `return () => controller.abort()`. This is a genuinely useful signal — the doubled connection is the bug the mode exists to surface.

**★ Symptom: `sleep()` keeps a timer alive after unmount and the loop wakes into a dead component.** Cause: a bare `setTimeout` promise with no abort wiring. Fix: the abort-aware `sleep` above — every wait in a retry loop must be cancellable, or teardown is only ever approximate.

## Interview questions

**★ You replaced `EventSource` with `fetch`. What exactly do you now have to build that you did not have to before?**
Five things, all of which the specification was providing invisibly. A reconnection loop, with a delay you choose and a decision about which failures deserve one. The `Last-Event-ID` header on every retry, which the browser was setting from the id buffer. Honouring `retry:` from the stream, which is now just a number your parser hands you and which nothing acts on unless you make it. UTF-8 decoding across chunk boundaries and the whole line and field grammar. And an abort path, since `close()` no longer exists. The compensation is that you can now see the status code and the response headers, which lets you be smarter than the browser about all of it.

**★ How do you decide whether a failure is worth retrying?**
By the same split the specification makes — network errors are retryable, protocol violations are not — refined with the information `EventSource` could not see. A dropped connection, a DNS failure, a `5xx`: retry with backoff, because nothing about the request was wrong. A `429` or a `503` carrying `Retry-After`: retry, at the server's stated time rather than your own, because it knows something you do not. A `401` or `403`: refresh the credential and try once; if it fails again, stop, because retrying the same rejected token is pure load. A `400`, `404` or a wrong `Content-Type`: terminal, because the request itself is wrong and no number of retries will change it. The cheapest bug to avoid here is retrying a `4xx` forever.

**★ When should the backoff counter reset?**
After a connection that was genuinely useful, not after any connection that opened. If you reset on every successful `fetch`, a server that accepts the request and then immediately drops the stream — which is exactly what an overloaded or crash-looping backend does — puts you back at the base delay every time, and your "exponential backoff" is a tight loop with an extra branch. Gating the reset on a minimum connected duration, or on having received at least one event, makes the counter measure what you actually care about: whether the stream is working.

**★ Your loop is inside a `useEffect`. What does the cleanup have to do, and what breaks if it only sets a flag?**
It has to `abort()`. A flag stops the *next* iteration but leaves the current one in place: the in-flight `read()` is still pending, the pending `setTimeout` still fires, and — the part that costs money — the server-side handler never learns the client is gone, so the Route Handler keeps producing and, on a serverless platform, the invocation keeps running. An `AbortSignal` passed to both `fetch` and every `sleep` rejects the read, cancels the timer, and propagates to the server as `request.signal` aborting, which fires the stream's `cancel()` callback. It is the direct replacement for `EventSource.close()`, and there is no partial version of it that works.

**★ Is there any reason to keep `EventSource` once you have written this?**
Yes — it is less code and less to get wrong, and for the common case of a same-origin, cookie-authenticated feed it does everything this loop does, correctly, for free. The hand-rolled client is the answer to a specific constraint: a header you must send, a body you must post, or a status code you must react to. If none of those apply, the browser's implementation is better tested than yours will be, and the reconnection semantics are the same ones every other site's users have already trained on. Reach for `fetch` when you have a reason to name, not because it feels more controllable.

---

← [03g · fetch + ReadableStream](03g-fetch-and-readablestream-when-you-need-headers.md) · [Chapter 15 overview](01-explanation.md) · Next → [03h · What silently breaks SSE in production](03h-what-silently-breaks-sse-in-production.md)
