---
title: "03 · A fetch wrapper worth reusing"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch), [`Response.clone()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/clone), [`URL()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL), [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers), [`RequestInit.credentials`](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#credentials), [`AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static), [`AbortSignal.any()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static), [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After). Documentation-validated.

**`fetch` is a transport, not a client.** A wrapper is where the decisions it refuses to make get
made once: check the status, parse the body, carry auth, and give up eventually.

Written out, that is about eighty lines — and every one of them exists because of a specific
failure. This topic is the tour of those failures, in the order the lines earn their place.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What fetch leaves you with](./01-what-fetch-leaves-you.md)** | What `fetch` deliberately does not do, and why the missing `res.ok` check surfaces as a **JSON parse error three layers away**; the three-line version 1; a typed `HttpError` carrying **status and body**, and why `statusText` is the wrong thing to throw (HTTP/2 has no reason phrases); reading the error body via `clone()` **before** the first read, and why cloning everything buffers whole downloads in memory |
| 2 | **[URLs, parsing and the client surface](./02-urls-and-parsing.md)** | `new URL(path, base)` and the two resolution rules that make a version prefix vanish — a base without a trailing slash, a path with a leading one; branching the parse on `Content-Type` (and why `includes("json")` beats equality, given `+json` and `; charset=utf-8`); `204`/empty bodies; method helpers and the spread-order bug that turns a `GET` into a `POST`; a factory rather than a singleton; and four things the wrapper must not do |
| 3 | **[Headers and bodies](./03-headers-and-bodies.md)** | The body-type branch that keeps `Content-Type` **off** `FormData` requests, and why the server then reports an *empty form* rather than a header problem; merging through `Headers` because header names are case-insensitive and object keys are not; `set` vs `append` and the tripled `Accept`; forbidden header names; and why a cross-origin `res.headers.get()` returns `null` |
| 4 | **[Auth and the 401 refresh](./04-auth-and-refresh.md)** | Auth as a **function**, not a captured value — the bug that presents as "it logs me out after an hour"; `credentials: "same-origin"` and the cross-origin 401 the address bar does not reproduce; the **single-flight refresh** that stops six parallel 401s from logging the user out, cleared in `finally`; the three guards on the retry (once only, not the refresh endpoint, 401 not 403); and why a stored `Request` cannot be replayed |
| 5 | **[Timeouts and cancellation](./05-timeouts-and-cancellation.md)** | `fetch` has **no** timeout; `AbortSignal.timeout()` and its `TimeoutError`; telling `TimeoutError`, `AbortError` and `TypeError` apart **by `name`**, because all three resist `instanceof`; abort reasons and `throwIfAborted()`; combining the caller's signal with the wrapper's via `AbortSignal.any()`, and why a hand-rolled combiner destroys the distinction; and the one-word bug of leaving `signal` in `...rest` |
| 6 | **[Retries](./06-retries.md)** | What is retryable and what never is; **why a retried `POST` creates duplicate orders** — a timeout means you stopped listening, not that the server did nothing — and where the idempotency key must be generated; exponential backoff, the **thundering herd** that jitter prevents, and both legal forms of `Retry-After`; the fresh signal and fresh body every attempt needs; and the eighty-line summary of the whole wrapper |

## The three sentences to keep

1. **The wrapper's job is the `!res.ok` check.** Everything else is convenience on top of the one
   thing call sites forget.
2. **Never set `Content-Type` for `FormData`**, and never let object spread merge headers — header
   names are case-insensitive, object keys are not.
3. **`AbortError` is never retryable and never shown; `TimeoutError` is both.** Tell them apart by
   `err.name`, and never retry a `POST` without an idempotency key.

## Phase gate

You are done with this topic when you can write the wrapper from an empty file — status check,
typed error, base URL, header merge with the `FormData` exception, auth from a function, a
timeout combined with the caller's signal, and a retry policy — and justify each piece by naming
the failure it prevents.

## Where this connects

- [01 · `fetch`](../01-fetch/README.md) — the `ok` behaviour and read-once bodies this is built on
- [02 · Request bodies](../02-request-bodies/README.md) — which body types set their own header
- [Phase 8 · 03 · `Error` and its subclasses](../../phase-8-modules-errors/03-error-and-subclasses/README.md) — how `HttpError` is built
- [Phase 7 · 08 · Error handling in async code](../../phase-7-async/08-error-handling/README.md) — the `try`/`catch` shape the caller ends up with
- [Phase 7 · 09 · Sequential vs parallel](../../phase-7-async/09-sequential-vs-parallel/README.md) — the shared-promise pattern behind the single-flight refresh
- [Phase 7 · 11 · Promise anti-patterns](../../phase-7-async/11-anti-patterns/README.md) — including the retry loops this topic replaces

---

Start → [01 · What fetch leaves you with](./01-what-fetch-leaves-you.md)
