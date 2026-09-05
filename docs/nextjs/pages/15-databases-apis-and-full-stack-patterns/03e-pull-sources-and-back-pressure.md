---
title: "A push source has no brake: if the client reads slower than you produce, the stream's internal queue grows inside your process until something dies"
sidebar_label: "03e · Pull sources and back-pressure"
sidebar_position: 33
description: "start versus pull, async iterators as pull sources, desiredSize and the high water mark, shedding versus coalescing versus persisting, and the snapshot-plus-delta protocol that makes dropping safe."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against MDN
> [`ReadableStream()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/ReadableStream),
> [`ReadableStreamDefaultController.desiredSize`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultController/desiredSize)
> and [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream); the Next.js
> [Streaming guide](https://nextjs.org/docs/app/guides/streaming) §"Streaming in Route Handlers"
> (whose file-download example uses `FileHandle.readableWebStream()`).
> Documentation-verified, **no sandbox run, no memory measurements**.
> Target: **Next.js 16.3.4** · Node **24.20.0**.

**Flow control is the part of streaming that only shows up under load, which is why it is usually discovered in production. A `ReadableStream` has an internal queue; if your producer enqueues faster than the consumer reads, that queue grows, and it grows in your server's heap. Whether you get back-pressure for free or have to build it yourself is decided by one choice: whether your source is *pull*-shaped or *push*-shaped. This page is that choice, the mechanism for each, and the three honest strategies for a push source that is outrunning its client.**

## `start` and `pull` answer different questions

> *"`start` (controller) — This is a method, called immediately when the object is constructed."*
> *"`pull` (controller) — This method … will be called repeatedly when the stream's internal queue of chunks is not full, up until it reaches its high water mark. If `pull()` returns a promise, then it won't be called again until that promise fulfills; if the promise rejects, the stream will become errored."*
> — [MDN · `ReadableStream()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/ReadableStream)

Read the second one for what it guarantees: **the stream will not ask again until your promise settles**, and it only asks at all when the queue has room. That is complete back-pressure with no code from you. `start`, by contrast, hands you a controller and gets out of the way — nothing throttles your `enqueue` calls, so the pacing is entirely your problem.

| Source shape | Example | Use | Back-pressure |
|---|---|---|---|
| **Pull** — you can produce on demand | a cursor over a query, a paginated API, a file, an async generator | `pull` | Free |
| **Push** — data arrives when it arrives | a change feed, `LISTEN`/`NOTIFY`, a Redis subscription, a webhook fan-out | `start` + callbacks | Yours to build |

One more clause from the same reference is worth flagging because it causes a hang:

> *"it will only be called repeatedly if it enqueues at least one chunk or fulfills a BYOB request; a no-op `pull()` implementation will not be continually called."*

A `pull` that returns without enqueuing and without closing is a stalled stream, not a retried one.

## A pull source, end to end

```ts
// app/api/boards/[boardId]/export/route.ts
import { connection } from 'next/server'
import { encodeEvent } from '@/lib/sse'
import { streamBoardRows } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  await connection()
  const { boardId } = await params

  // An async iterator over a server-side cursor. Nothing has been read yet.
  const rows = streamBoardRows(boardId)

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await rows.next()
      if (done) {
        controller.close()
        return
      }
      controller.enqueue(encodeEvent({ id: value.id, data: value }))
    },

    async cancel() {
      // The consumer went away mid-export. Close the cursor and return the
      // connection to the pool, or it stays checked out until the pool reaps it.
      await rows.return?.(undefined)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
```

The `cancel` here matters more than in a push handler. A server-side cursor holds a database connection for as long as it is open; if the client aborts a large export and nothing calls `rows.return()`, that connection is checked out of the pool doing nothing. On a serverless deployment with a small pooled connection budget, a handful of abandoned exports is an outage. See [10c · Tenant isolation in the data access layer](10c-tenant-isolation-in-the-data-access-layer.md) for the request-scoped shape these helpers should have.

For a plain file the framework gives you a shorter route entirely — the Streaming guide's own example:

```ts
// app/api/download/route.ts
import { open } from 'node:fs/promises'

export async function GET() {
  const file = await open('/path/to/large-file.csv')
  return new Response(file.readableWebStream(), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="data.csv"',
    },
  })
}
```

> *"You can also stream files without loading them entirely into memory. Use `FileHandle.readableWebStream()` to get a Web `ReadableStream` directly from a file."*
> — [Next.js · Streaming](https://nextjs.org/docs/app/guides/streaming)

## A push source has no brake, and `desiredSize` is the gauge

> *"The `desiredSize` read-only property … returns the desired size required to fill the stream's internal queue. The number can be negative if the queue is over-full … The value is `null` if the stream has errored and `0` if it is closed."*
> — [MDN · `desiredSize`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultController/desiredSize)

Three readings, three meanings:

- **positive** — the queue has room; enqueue freely.
- **zero or negative** — the consumer is behind; every further `enqueue` grows your heap.
- **`null`** — the stream errored; stop producing and clean up.

The default queuing strategy for a non-byte stream counts chunks with a high water mark of 1, so `desiredSize` goes non-positive almost immediately on a fast feed. If you want a real buffer before you start shedding, say so explicitly:

```ts
const stream = new ReadableStream<Uint8Array>(
  { start(controller) { /* … */ } },
  // Allow 32 queued frames before desiredSize goes negative.
  new CountQueuingStrategy({ highWaterMark: 32 }),
)
```

## The three honest strategies for a slow consumer

**First decide whether every event matters.** That single question picks the strategy; everything else is implementation.

### Shed — for feeds where the latest state is what counts

Presence, progress bars, live counters, cursor positions. An event that arrives ten seconds late is worth less than the memory it cost.

```ts
let droppedSinceSnapshot = 0

const safeEnqueue = (chunk: Uint8Array) => {
  if (closed) return
  if ((controller.desiredSize ?? 0) <= 0) {
    droppedSinceSnapshot += 1
    return
  }
  controller.enqueue(chunk)
}

// Periodically reconcile, so a client with gaps converges anyway.
const snapshot = setInterval(() => {
  if ((controller.desiredSize ?? 0) <= 0) return
  controller.enqueue(
    encodeEvent({ event: 'snapshot', data: { state: currentState(), droppedSinceSnapshot } }),
  )
  droppedSinceSnapshot = 0
}, 10_000)
```

🔴 **Shedding is only safe with a reconciliation path.** Dropping deltas and never sending a snapshot produces a client that is quietly, permanently wrong — the worst failure mode on this page, because the UI looks fine.

### Coalesce — for feeds where many events collapse into one

Twenty edits to the same task in two seconds is one "task changed" notification. Coalescing keeps correctness *and* bounds the queue, so prefer it to shedding whenever the events have a natural key:

```ts
const pending = new Map<string, BoardChange>()
let flushScheduled = false

function onChange(change: BoardChange) {
  pending.set(change.taskId, change) // last writer wins per task
  if (flushScheduled) return
  flushScheduled = true
  setTimeout(() => {
    flushScheduled = false
    for (const [, latest] of pending) {
      safeEnqueue(encodeEvent({ id: latest.seq, event: 'taskChanged', data: latest }))
    }
    pending.clear()
  }, 100)
}
```

The 100 ms window is the whole trade: it is added latency in exchange for a bounded burst. Tune it to the smallest value that visibly reduces the burst, not to the smallest value you can imagine.

### Persist and resume — for feeds where nothing may be lost

A payments feed, an audit log, anything a user will reconcile against. Do not hold undelivered events in process memory at all: write them durably with a monotonic sequence number, send the `id`, and let a reconnecting client ask for everything after its `Last-Event-ID`. The queue then lives in Postgres, where it is bounded by disk rather than heap and survives the invocation being killed. [03f](03f-eventsource-reconnection-and-last-event-id.md) is that protocol, and [04d](04d-postgres-as-a-queue-skip-locked.md) is the durable-log shape it rests on.

## `tee()` and why fan-out inside one handler is usually wrong

`ReadableStream.tee()` splits one stream into two, and it is genuinely useful in a cache handler ([05h](05h-a-shared-cache-across-instances.md) uses it). It is a trap for real-time fan-out, because a `tee` progresses at the speed of its *slowest* branch: the faster reader's chunks are buffered until the slower one catches up. Two subscribers on a teed stream means one slow client throttles — or memory-inflates — the other. Fan-out belongs in a pub/sub layer that owns per-subscriber buffers, not in a stream primitive.

## Gotchas

**★ Symptom: process memory grows on one chatty board while every other board is fine.** Cause: a push source with no back-pressure and a slow consumer — the stream's internal queue is absorbing the difference, in your heap. Fix: check `desiredSize` before enqueueing and shed or coalesce rather than buffer, then reconcile with a periodic snapshot:

```ts
if ((controller.desiredSize ?? 0) <= 0) { droppedSinceSnapshot += 1; return }
controller.enqueue(chunk)
```

**★ Symptom: the client receives a stream that just stops, with no `done` and no error.** Cause: a `pull()` implementation that returned without enqueuing and without closing. MDN: *"a no-op `pull()` implementation will not be continually called."* Fix: every `pull` path must either enqueue or close:

```ts
async pull(controller) {
  const { value, done } = await rows.next()
  if (done) return controller.close()   // never fall through silently
  controller.enqueue(encodeEvent({ data: value }))
}
```

**★ Symptom: database connections leak on aborted exports.** Cause: a `pull` source over a cursor with no `cancel`, so the iterator is never finished and the connection stays checked out. Fix: return the iterator in `cancel`:

```ts
async cancel() { await rows.return?.(undefined) }
```

**★ Symptom: shedding "works" and the UI is subtly wrong for hours.** Cause: dropped deltas with no reconciliation, so the client's state diverges silently and nothing ever corrects it. Fix: pair every shedding path with a periodic full snapshot, and count what you dropped so the client can tell it has a gap:

```ts
controller.enqueue(
  encodeEvent({ event: 'snapshot', data: { state: currentState(), droppedSinceSnapshot } }),
)
droppedSinceSnapshot = 0
```

**★ Symptom: you added `desiredSize` checks and now nothing is ever sent.** Cause: the default queuing strategy has a high water mark of 1 chunk, so on any non-trivial feed `desiredSize` is at or below zero most of the time and your guard drops almost everything. Fix: give the stream an explicit buffer before shedding:

```ts
new ReadableStream(source, new CountQueuingStrategy({ highWaterMark: 32 }))
```

**★ Symptom: a `pull` source that throws mid-iteration errors the whole response with no client-visible reason.** Cause: *"if the promise rejects, the stream will become errored."* Fix: catch inside `pull`, emit a final event, and close cleanly so the client's reconnect logic runs:

```ts
async pull(controller) {
  try {
    const { value, done } = await rows.next()
    if (done) return controller.close()
    controller.enqueue(encodeEvent({ data: value }))
  } catch {
    controller.enqueue(encodeEvent({ event: 'streamError', data: { retryable: true } }))
    controller.close()
  }
}
```

**★ Symptom: two subscribers share a teed stream and the fast one runs at the speed of the slow one.** Cause: `tee` buffers for the lagging branch by design. Fix: do not fan out with `tee` — give each subscriber its own stream fed from a pub/sub layer that can shed per subscriber:

```ts
// one ReadableStream per connection, each with its own desiredSize policy
const unsubscribe = bus.subscribe(boardId, (change) => safeEnqueue(encode(change)))
```

**★ Symptom: coalescing added a visible lag to a UI that used to feel instant.** Cause: the flush window is latency you chose. Fix: only coalesce while you are actually behind, and pass changes straight through when the queue has room:

```ts
function onChange(change: BoardChange) {
  if ((controller.desiredSize ?? 0) > 0 && pending.size === 0) {
    return safeEnqueue(encodeEvent({ id: change.seq, data: change }))
  }
  pending.set(change.taskId, change)
  scheduleFlush()
}
```

## Interview questions

**★ When would you use `pull` instead of `start`, and what changes?**
When the source is pull-shaped: an async iterator over a query, a file, a paginated API. With `pull`, the stream only asks for a chunk when its internal queue has room, and it will not ask again until the promise you returned resolves — so back-pressure is automatic and your producer never runs ahead of the consumer. With `start`, you decide when to enqueue, which is the only option for a push source like a change feed, and it means back-pressure becomes your problem: you have to watch `desiredSize` and decide whether to buffer, drop, or coalesce. A useful heuristic: if you can express the source as `for await`, prefer `pull`.

**★ How do you handle a client that reads slower than you produce?**
First decide whether every event matters. If it does — a payments feed, an audit log — you must not drop, so you either switch to a pull source and get real back-pressure, or you persist events with a sequence number and let the client resume by `Last-Event-ID`, which moves the queue out of your heap and into storage. If it does not — presence, progress — dropping is correct and buffering is the bug, so check `desiredSize`, shed while it is non-positive, count what you shed, and periodically send a full snapshot so a client with gaps converges. Between those two sits coalescing, which is the best answer whenever events have a natural key, because it preserves correctness and bounds the burst at the cost of a small, chosen latency. What you must not do is nothing: the default behaviour of a push source with a slow consumer is unbounded queue growth inside your process.

**★ What does `desiredSize` of zero actually tell you, and what would you do with it?**
That the internal queue has reached its high water mark, so anything you enqueue now is pure accumulation rather than flow. It is not an error and nothing prevents you from enqueuing anyway — that is the point, it is advisory. What you do with it depends entirely on the semantics of the feed, which is why the API gives you a number instead of a policy. The one thing worth knowing is that the default strategy counts chunks with a high water mark of one, so a naive "only send when `desiredSize > 0`" guard on a busy feed drops almost everything; if you intend to buffer at all, set the high water mark deliberately with a `CountQueuingStrategy`.

**Why is `tee()` the wrong tool for broadcasting one feed to many subscribers?**
Because a teed stream advances at the pace of its slowest branch: chunks already consumed by the fast reader are retained until the slow one has taken them, so one lagging subscriber either throttles the others or inflates memory on their behalf. It is the correct tool when both branches are yours and you control the pace — writing a cache entry to storage while also returning it to the caller, for instance. Broadcast needs per-subscriber buffering and per-subscriber policy (this one may drop, that one may not), which is exactly what a pub/sub layer provides and a stream primitive does not.

**Your export endpoint streams a hundred thousand rows and the client cancels at row nine. What is the cost, and how do you avoid paying it?**
The cost is a database cursor and its connection, held open with nobody reading, until the pool reaps it — and on a serverless deployment where the pooled connection budget is small, a few of those is a saturated pool and an outage that looks nothing like an export bug. You avoid it by implementing `cancel` on the stream and finishing the iterator there, which closes the cursor and returns the connection. The general form of the lesson is that with a pull source the *consumer* controls the lifetime of a server-side resource, so every pull source needs a teardown path, not just a happy path.

**A reviewer says "just buffer, memory is cheap". What is the counter-argument?**
That the buffer is unbounded and lives in a process shared by every other request. Cheap memory bounds a queue you sized; it does not bound one whose size is set by how slowly an arbitrary client on an arbitrary network chooses to read. The failure is also non-local: the process that dies takes every other connection with it, and on a platform that recycles instances, the load then lands on the remaining ones. If buffering is genuinely the right answer, it should be an explicit high water mark with a defined behaviour at the limit — which is precisely what a queuing strategy plus a `desiredSize` check expresses.

---

← [03d · Writing the SSE Route Handler](03d-writing-the-sse-route-handler.md) · [Chapter 15 overview](01-explanation.md) · Next → [03f · Reconnection and `Last-Event-ID`](03f-eventsource-reconnection-and-last-event-id.md)
