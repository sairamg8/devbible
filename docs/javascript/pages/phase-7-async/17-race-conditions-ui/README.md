---
title: "17 · Race conditions in a UI"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`AbortSignal.throwIfAborted()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted), [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch), [`ETag`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag), [`If-Match`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-Match), [412 Precondition Failed](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/412) — and [RFC 9110 § Conditional requests](https://www.rfc-editor.org/rfc/rfc9110#section-13). Documentation-validated; **no timings, no console blocks**.

The syllabus row is *stale responses overwriting fresh ones, keying by request, and
last-write-wins*.

🔴 **One sentence covers the whole topic: a response may only write shared state if it is still
the newest request for that state — and if the scope it belongs to is still alive.** Every
pattern here is that sentence enforced by a different mechanism.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The stale response](./01-the-stale-response.md)** | Why responses need not arrive in request order; the `await` between read and write as the seam; the three defences — cancel the previous, ignore a mismatched key, sequence number — and how they differ; loading and error state racing too; and why debouncing narrows the window without closing it |
| 02 | **[The other UI races](./02-the-other-races.md)** | Double submit and single-flight; writing to a scope that is gone; optimistic updates whose *rollback* races; the lost update between two users, `If-Match`/ETag and **412**; and serialising writes per key without one failure breaking the chain |

## Four facts worth carrying out of this topic

- **A single thread still races.** It guarantees no interleaved statements, not ordered
  completions — every `await` between reading and writing is a window.
- **Cancel what you can; check what you cannot cancel.** An `AbortController` removes the race;
  a key or sequence check detects it.
- **Debouncing is a rate control, not a correctness control.** It makes the bug rarer, which
  means it ships.
- **Last-write-wins is a decision.** `If-Match` with an ETag turns a silent lost update into a
  **412** you can show the user.

## Phase gate

You can explain why a search box shows results for the previous query, fix it two different ways,
and say which one you would pick and why — and you can name what else races on the same screen:
the loading flag, the error banner, and the optimistic rollback.

## Where this connects

- [14 · Cancellation](../14-cancellation/01-the-model.md) — the controller that removes the race
  outright, and the scope signal checked after every `await`
- [16 · The bounded pool](../16-concurrency-limiting/02-the-bounded-pool.md) — in-flight
  deduplication, which is single-flight applied to a list
- [15 · What is safe to retry](../15-timeouts-retries-backoff/01-what-is-safe-to-retry.md) —
  idempotency keys, the server-side half of double-submit
- [07 · Where it suspends](../07-async-await/02-where-it-suspends.md) — the seam every one of
  these bugs lives on
- [Phase 8 · 04 · The four leaks](../../phase-8-modules-errors/04-leaks/02-the-four-leaks.md) —
  the detached node a late write keeps alive
- [Phase 3 · 10 · Debounce and throttle](../../phase-3-functions/10-debounce-and-throttle.md) —
  what debouncing does and does not buy you

---

Start → [01 · The stale response](./01-the-stale-response.md)
