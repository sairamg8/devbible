---
title: "03 · A resilient API client"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch), [`AbortSignal.any()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static), [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After), [`navigator.onLine`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine), [`Error.cause`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause). Documentation-validated; **no timings**.

**The wrapper's mechanics are
[Phase 11 · 03](../../phase-11-network-storage/03-fetch-wrapper/README.md).** This topic is what
changes when it becomes the *one* client a whole storefront depends on: the layering order, one new
capability — single-flight deduplication — and turning many failures into a few the UI can act on.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Composing the client](./01-composing-the-client.md)** | 🔴 **The layer order and the reason for each** — dedupe outermost so callers share retries, retry above auth so a refreshed token is used, and **timeout innermost, because a timeout around the retries aborts mid-backoff and looks like a flaky API**; single-flight deduplication with its three rules (`GET` only, clear in **`finally`**, and 🔴 **every caller shares one resolved object**); ⚠️ **what the key must contain**, since a URL-only key serves one user's cart to another; 🔴 **why dedupe is not a cache**, in a table; request ids; and what to leave out |
| 2 | **[Failing well](./02-failing-well.md)** | 🔴 **The four outcomes a call site should see**, plus cancellation which is not one; a `classify` function, and why 🔴 **the `unknown` class must exist** so a parser bug is not retried forever; `Error.cause` and why wrapping without it destroys the diagnosis; ⚠️ **the `Retry-After` HTTP-date form that becomes `setTimeout(NaN)`** and fires instantly; ⚠️ **`navigator.onLine` being trustworthy only when `false`**; 🔴 **what to report and what never to** — no bodies, no headers, no query strings; and 🔴 **per-region degradation** so one failed widget does not blank the page |

## The three sentences to keep

1. **Timeout innermost, dedupe outermost.** The order is why a client either recovers cleanly or
   looks like a flaky API.
2. **Dedupe shares an in-flight request and forgets** — the moment it gains a TTL it is a cache and
   needs invalidation.
3. **Reduce failures to four outcomes**, and never report cancellations, offline errors, or
   anything containing a body.

## Phase gate

You are done with this topic when you can state the layer order and justify each position, implement
deduplication with the correct key and `finally` cleanup, explain why a deduplicated `POST` is
dangerous, and list the four failure classes and what the UI does with each.

## Where this connects

- [Phase 11 · 03 · A `fetch` wrapper worth reusing](../../phase-11-network-storage/03-fetch-wrapper/README.md) — the mechanics this builds on
- [07 · Idempotency from the client](../07-idempotency/README.md) — what makes a repeated `POST` safe
- [06 · Optimistic updates with rollback](../06-optimistic-updates/README.md) — what the UI does while a write is in flight
- [Phase 12 · 02 · 01 · The trust boundary](../../phase-12-browser-platform/02-client-side-security/01-the-trust-boundary.md) — why bodies never reach an error tracker

---

Start → [01 · Composing the client](./01-composing-the-client.md)
