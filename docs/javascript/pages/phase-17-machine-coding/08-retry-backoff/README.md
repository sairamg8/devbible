---
title: "08 · Retry with backoff, jitter and an AbortSignal"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After), [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch), [`setTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout). Documentation-validated; **nothing was run**.

**The loop is five lines. The three decisions around it are the topic:** what is worth
retrying, how long to wait, and how the whole thing gets cancelled.

```js
for (let attempt = 0; attempt < attempts; attempt++) {
  signal?.throwIfAborted();
  try { return await fn({ attempt, signal }); }
  catch (err) {
    if (signal?.aborted) throw signal.reason;                       // cancelled ≠ failed
    if (!isRetryable(err) || attempt === attempts - 1) throw err;   // 400 will not fix itself
    await sleep(Math.random() * Math.min(cap, base * 2 ** attempt), signal);   // jitter, abortable
  }
}
```

Retrying a `400` is a slower failure. Retrying without jitter turns a brief outage into a
synchronised stampede. Retrying without a signal keeps working after the user has gone.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Backoff and jitter](./01-backoff-and-jitter.md)** | Which failures are retryable (and ⚠️ **`fetch` not rejecting on a `500`**), idempotency and why `POST` is different, exponential growth with a cap, **the four jitter strategies and why full jitter is the default**, honouring `Retry-After` in both its formats, and why the retry belongs inside the unit of work |
| 2 | **[Cancellation and timeouts](./02-cancellation-and-timeouts.md)** | The `AbortSignal` surface, **an abortable sleep** (the hole most retries have), `throwIfAborted()` between attempts, passing the signal into the task, **per-attempt timeout versus overall deadline composed with `AbortSignal.any`**, the `AbortError`/`TimeoutError` split and reporting outcomes honestly |

## The three that catch people

```js
if (!res.ok) { /* nothing thrown */ }        // ⛔ the retry loop never sees a 500
await sleep(backoff);                         // ⛔ un-abortable — cancellation waits it out
catch { retry(); }                            // ⛔ retries the user's own cancellation
```

## Phase gate

You are done with this topic when you can write the loop from an empty file, justify full
jitter in one sentence, name four errors you would never retry, and cancel a retry mid-backoff
so the in-flight request stops too.

## Where this connects

- [07 · A concurrency-limited task queue](../07-task-queue/README.md) — retries live *inside* the task, so a retrying task keeps its slot
- [Phase 11 · 03 · A fetch wrapper](../../phase-11-network-storage/03-fetch-wrapper/README.md) — where retry, timeout and cancellation belong in real code, together
- [Phase 11 · 01 · `fetch`](../../phase-11-network-storage/01-fetch/README.md) — why `res.ok` must be checked before anything can be retried
- [Phase 7 · 08 · Error handling](../../phase-7-async/08-error-handling/README.md) — classifying errors, and re-throwing the right one
- [Phase 6 · 07 · Paginating an API](../../phase-6-iteration-and-destructuring/07-paginating-an-api/README.md) — the `429`/`Retry-After` handling this generalises
- **15 · A rate limiter** *(not written yet)* — the constraint retry is often confused with

---

Start → [Backoff and jitter](./01-backoff-and-jitter.md)
