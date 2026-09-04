---
title: "The retries that actually keep a page up are the ones around your own data access, where you can bound the wait, back off, and refuse to retry what will never succeed"
sidebar_label: "06b · Timeouts, backoff and your own retries"
sidebar_position: 19
description: "AbortSignal.timeout as the deadline the framework does not impose, why only idempotent operations may be retried automatically, full jitter, and the retry budget that stops a partial outage becoming a total one."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions)
> (page metadata `version: 16.3.4`, `lastUpdated: 2026-06-17`) for sequential dispatch and the
> "surface the error as a retry path" guidance, and MDN for the Web platform APIs used here —
> [`AbortSignal.timeout()`](https://developer.mozilla.org/docs/Web/API/AbortSignal/timeout_static).
> 🔴 **Next.js documents no retry or timeout policy**; the patterns here are **this book's
> recommendation**, built on standard Web APIs available on the Node.js runtime.
> Target: **Next.js 16.3.4**, App Router · **Node 24.20.0**. Documentation-validated;
> **no timings**.

**A boundary's retry button is the last line of defence, and by the time it is visible the page
has already failed.** Everything that keeps a page up rather than recovering it happens one layer
lower, around the calls themselves, where three things are possible that a boundary cannot do:
bound how long a dependency is allowed to take, retry only the call that failed rather than the
whole segment, and decline to retry an operation that is not safe to repeat. None of this is
framework behaviour and none of it is documented by Next.js — it is ordinary server code, and it
is the difference between a slow dependency degrading one widget and a slow dependency holding
the whole render open.

## A deadline is the first thing to add

Without one, a hung upstream call holds the render for as long as the platform allows. `fetch`
takes an `AbortSignal`, and the platform provides a timeout signal directly:

```ts
// lib/http.ts
export async function fetchWithDeadline(
  url: string,
  init: RequestInit = {},
  ms = 2_000
): Promise<Response> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(ms) })
  if (!res.ok) throw new UpstreamError(res.status, `${url} responded ${res.status}`)
  return res
}
```

An aborted `fetch` rejects with a `TimeoutError` `DOMException`, which is what lets a caller
distinguish "took too long" from "said no":

```ts
export function isTimeout(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === 'TimeoutError'
}
```

🔴 **Pick the deadline from the budget, not from the dependency.** If the page must render in two
seconds and three calls happen in sequence, no single call may have a two-second timeout. A
timeout that is longer than the time available is a timeout that never fires.

## Retry only what is safe to repeat

The rule that keeps automatic retries from causing incidents: **retry idempotent operations
only.** A `GET`, a read, a lookup — repeating it changes nothing. A `POST` that charges a card, a
create, an increment — repeating it may do the thing twice, and a timeout does not tell you
whether the server completed the work before the connection dropped.

```ts
// lib/retry.ts — reads only, by construction
type RetryOptions = { attempts?: number; baseMs?: number; capMs?: number }

export async function retryRead<T>(
  read: () => Promise<T>,
  { attempts = 3, baseMs = 100, capMs = 2_000 }: RetryOptions = {}
): Promise<T> {
  let lastCause: unknown

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await read()
    } catch (cause) {
      if (!isRetriable(cause)) throw cause // 4xx, validation, programmer error
      lastCause = cause

      if (attempt < attempts - 1) {
        const backoff = Math.min(capMs, baseMs * 2 ** attempt)
        const jitter = Math.random() * backoff // full jitter
        await new Promise((resolve) => setTimeout(resolve, jitter))
      }
    }
  }

  throw lastCause
}

function isRetriable(cause: unknown): boolean {
  if (isTimeout(cause)) return true
  if (cause instanceof UpstreamError) return cause.status >= 500 || cause.status === 429
  return false // anything unclassified is not retried
}
```

Three deliberate choices in that function:

- **`isRetriable` defaults to `false`.** An unrecognised failure is not retried. The opposite
  default turns a schema mismatch into three schema mismatches.
- **Jitter is applied, not just backoff.** Without it, every request that failed at the same
  moment retries at the same moment, and the dependency is hit by a synchronised wave each time.
- **The last cause is rethrown, not a summary.** Whatever ends up at the boundary should be the
  real failure.

A mutation gets the same protection only with an idempotency key, so the server can recognise a
repeat:

```ts
'use server'

export async function chargeOrder(orderId: string) {
  // the key makes the operation safe to repeat: the provider returns the original
  // result for a duplicate key rather than charging again
  const idempotencyKey = `order:${orderId}`
  return payments.charge({ orderId, idempotencyKey })
}
```

⚠️ **Without a key from the provider, do not auto-retry a mutation.** Surface it and let a person
decide — which is exactly what the Server Actions guide advises for the stale-action case:
*"Surface the error as a retry path in the UI rather than a hard failure."*

## A retry budget, so a partial outage stays partial

Per-call retries are locally sensible and globally dangerous: with three attempts each, a
dependency at 50% failure sees substantially more traffic exactly when it is least able to take
it. A budget caps the *proportion* of traffic that may be retries.

```ts
// lib/retry-budget.ts — a coarse, in-process circuit for a single dependency
const WINDOW_MS = 10_000
const MAX_RETRY_RATIO = 0.1 // retries may be at most 10% of calls

let calls = 0
let retries = 0
let windowStart = Date.now()

export function mayRetry(): boolean {
  const now = Date.now()
  if (now - windowStart > WINDOW_MS) {
    calls = 0
    retries = 0
    windowStart = now
  }
  return retries / Math.max(calls, 1) < MAX_RETRY_RATIO
}

export function recordCall(): void {
  calls++
}

export function recordRetry(): void {
  retries++
}
```

⚠️ **This state is per process.** On a serverless platform each instance keeps its own counters,
so the budget is approximate and gets weaker as instance count grows. A shared store makes it
exact and adds a dependency to the path that is meant to survive dependencies failing — which is
usually the wrong trade. Say which one you have chosen rather than assuming the coarse version is
exact.

## Gotchas

### A retry loop that turns a 400 into three 400s
**Symptom.** Bad requests take three times as long to fail and appear three times in the
dependency's logs.
**Cause.** The retry predicate treats every rejection as retriable.
**Fix.** Classify explicitly and default to not retrying, as `isRetriable` above does. A 4xx
other than 429 will not succeed on repetition.

### Backoff without jitter
**Symptom.** A dependency recovers, is immediately knocked over again, recovers, and repeats on a
rhythm.
**Cause.** Every client that failed at the same instant waits the same interval and retries in
lockstep.
**Fix.** Randomise the delay. The `Math.random() * backoff` form above spreads attempts across
the whole window rather than clustering at its end.

### A timeout longer than the request budget
**Symptom.** Timeouts are configured everywhere and the page still hangs.
**Cause.** Three sequential calls at five seconds each cannot fit in a request that is expected to
answer in two.
**Fix.** Derive per-call deadlines from the total budget, and shrink the remaining budget as calls
complete rather than giving each call the full amount.

### An auto-retried payment
**Symptom.** Duplicate charges after a period of upstream slowness.
**Cause.** A non-idempotent mutation was retried automatically. A timeout does not mean the work
did not happen.
**Fix.** Retry mutations only with a provider-supported idempotency key. Otherwise surface the
failure and let a person decide.

### Retrying inside a Server Action to hide a slow dependency
**Symptom.** Clicking a button appears to do nothing for eight seconds, and every other action in
the app is unresponsive during it.
**Cause.** Retries with backoff inside an action extend its duration, and the client dispatches
actions one at a time — so the retry loop is holding the whole queue.
**Fix.** Keep action durations short. Retry reads on the render path where they do not block the
dispatcher, and let a failed mutation return quickly with a retry affordance.

### A retry budget assumed to be global
**Symptom.** The budget is set to 10% and the dependency sees far more retry traffic than that.
**Cause.** In-process counters, many instances. Each one independently permits 10%.
**Fix.** Either accept it as an approximation and set the ratio accordingly, or move the counters
to a shared store — and note that doing so puts a dependency in the path whose job is to survive
dependencies being down.

## Interview questions

**★ Next.js gives you `retry()`. Why write your own retry logic at all?**
Because `retry()` operates at the wrong granularity and with no policy. It re-fetches the entire
segment, it happens only when a user presses a button, and it has no backoff, no attempt limit
and no timeout. Retries around the individual call can be bounded, jittered, restricted to
idempotent operations, and can keep the page from failing at all rather than recovering it after
it has.

**★ Which operations may be retried automatically?**
Idempotent ones — reads, and writes that carry an idempotency key the server honours. A timeout
tells you the response did not arrive, not that the work did not happen, so retrying a plain
`POST` risks doing it twice. Anything else should surface as an affordance for a person.

**★ Why is jitter not optional?**
Because clients that fail together retry together. Pure exponential backoff synchronises every
affected client onto the same schedule, so the dependency is hit by waves at predictable
intervals. Randomising within the backoff window spreads the load and is the difference between a
dependency recovering and a dependency being repeatedly re-broken.

**★ What should an unrecognised error do in a retry predicate?**
Not be retried. Defaulting to retry turns programmer errors and permanent failures into three or
five of themselves, adds latency to every failed request, and pollutes the dependency's logs. An
explicit allow-list of retriable conditions — timeouts, 5xx, 429 — is the safe default.

**★ What is a retry budget and what does it protect against?**
It caps retries as a proportion of total calls to a dependency, so that per-call retry policies
cannot multiply traffic to a service that is already failing. Without one, a dependency at 50%
failure with three attempts per call receives substantially more requests than when it was
healthy. In-process counters make it approximate on a multi-instance deployment, which is worth
stating rather than assuming away.

**★ Why is a retry loop inside a Server Action worse than the same loop on the render path?**
Because the client dispatches actions one at a time. An action that spends eight seconds backing
off is holding the queue for every subsequent action that user triggers, so the retry does not
just delay itself, it freezes the interface. Reads on the render path do not touch that queue.

---
---

← [06 · Retry, fallback and degradation](06-retry-fallback-and-graceful-degradation-patterns.md) · **Next → [06c · Partial data with `Promise.allSettled`](06c-partial-data-and-promise-allsettled.md)**
