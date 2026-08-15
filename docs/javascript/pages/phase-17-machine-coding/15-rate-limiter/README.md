---
title: "15 · A rate limiter"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Performance.now()`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now), [`429 Too Many Requests`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429), [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) — and the IETF Internet-Draft [RateLimit header fields for HTTP](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/). Documentation-validated; **no timings, nothing was run**.

**Two knobs, one timestamp, and no interval timer.** A rate limiter is a small amount of
arithmetic wrapped around one honest question — *may I go now, and if not, when?*

```js
#refill() {
  const t = this.now();
  this.#tokens = Math.min(this.capacity, this.#tokens + (t - this.#last) * this.ratePerMs);
  this.#last = t;
}
```

That clamp is the burst allowance, the multiplication is the sustained rate, and computing it on
read rather than on a `setInterval` is the difference between a limiter that scales to one bucket
per user and one that holds a timer per user forever.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The token bucket](./01-the-token-bucket.md)** | The implementation with **lazy refill**; why an interval is wrong four different ways; `performance.now()` versus a wall clock, and injecting the clock so it can be tested at all; capacity as burst and rate as throughput (**capacity 1 is a leaky bucket**); fractional tokens; a per-call cost; then the **FIFO waiting queue** — one timer for all waiters, no fast path while anything is queued, `AbortSignal` cancellation and a bounded queue |
| 2 | **[Windows, and the server](./02-windows-and-the-server.md)** | Fixed window and its **2× boundary burst**; the sliding window log as a **ring buffer of exactly `limit` slots**; the sliding window counter approximation and the assumption inside it; a five-way comparison table; 🔴 why a browser limiter is a courtesy and not a control, and why it is per tab; parsing **`Retry-After`** in both its syntaxes; and how far to trust the `RateLimit` header fields |

## Four facts worth carrying out of this topic

- **Refill on read, never on an interval.** Elapsed-time arithmetic is exact, free while idle, and
  needs no cleanup; a timer is throttled in background tabs and lives forever.
- **`performance.now()` is monotonic**; a wall clock can jump backwards and make elapsed time
  negative.
- **A fixed window allows twice its limit** across a boundary. That single sentence is why the
  sliding variants exist.
- **A client-side limiter protects the client**, not the server. The enforcing one is server-side,
  and the server's answer — 429 plus `Retry-After` — outranks your own schedule.

## Phase gate

You are done with this topic when you can write a token bucket from an empty file, say why it
holds no timer, explain the fixed-window boundary burst and both sliding fixes, and describe what
a client should do the moment it receives a 429.

## Where this connects

- [07 · A concurrency-limited task queue](../07-task-queue/README.md) — the other half of throttling: *how many at once* rather than *how often*
- [08 · Retry with backoff, jitter and an `AbortSignal`](../08-retry-backoff/README.md) — what to do after the 429, and why jitter is not optional
- [03 · `debounce` and `throttle`](../03-debounce-throttle/README.md) — the same problem at UI scale, solved by discarding rather than queueing
- [Phase 12 · 13 · What belongs on the server](../../phase-12-browser-platform/13-what-belongs-on-the-server/README.md) — why the browser's limiter can never be the control
- [Phase 12 · 03 · Timers](../../phase-12-browser-platform/03-timers-and-frames/01-timers.md) — clamping and background throttling, the reasons a timer-driven refill drifts

---

Start → [The token bucket](./01-the-token-bucket.md)
