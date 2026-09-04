---
title: "08 · Aborting and timing out"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), [`AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static), [`AbortSignal.any()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static), [`AbortSignal.abort()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/abort_static), [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch), [`DOMException`](https://developer.mozilla.org/en-US/docs/Web/API/DOMException), [`EventTarget.addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener). Documentation-validated; **no timings**.

🔴 **`fetch` has no timeout.** A request that never gets an answer stays pending for as
long as the browser allows, and the promise it returned never settles. That is the single
most surprising thing about the API after "a 404 does not reject"
([01 · `fetch`](../01-fetch/README.md)), and `AbortController` is the answer to both
cancelling and timing out.

**But `AbortController` is bigger than `fetch`.** It is the platform's general
cancellation protocol — event listeners, streams, `postMessage` handlers and your own
async functions all speak it. Learning it as "the way to cancel a fetch" undersells it and
leads to the listener-cleanup boilerplate it was designed to delete.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The controller and the signal](./01-the-controller-and-the-signal.md)** | The two-object split and why it exists; aborting a `fetch` and the `AbortError` it rejects with; 🔴 **distinguishing a cancel from a real failure**, and why swallowing them all is wrong; `AbortSignal.timeout()` and its distinct `TimeoutError`; `AbortSignal.any()` for combining them; and `signal.reason` |
| 2 | **[Cancellation as a lifecycle](./02-cancellation-as-a-lifecycle.md)** | 🔴 **`addEventListener(..., { signal })`** — one abort removing every listener; cancelling on unmount and the stale-response race it prevents; per-request versus per-component controllers; making your own async work abortable; and what abort does **not** do — the request may already have reached the server |

## The shape

```js
const controller = new AbortController();

fetch(url, { signal: controller.signal });   // hand the signal to the work
controller.abort();                          // trigger it from anywhere
```

**One controller, one signal, many consumers.** The signal is the read-only half you pass
around; the controller is the write half you keep.

## Phase gate

You are done with this topic when you can say **how to tell a user-cancelled request from
a network failure**, and **why `AbortController` is worth using for event listeners that
have nothing to do with the network**.

## Where this connects

- [01 · `fetch`](../01-fetch/README.md) — the API that has no timeout of its own
- [03 · A `fetch` wrapper worth reusing](../03-fetch-wrapper/README.md) — where a timeout belongs in practice
- [07 · Reading responses](../07-reading-responses/README.md) — aborting mid-body-read
- **Phase 7 · 14 · Cancellation** and **Phase 7 · 15 · Timeouts, retries, backoff** *(another chunk's topics)* — the promise-side treatment
- **Phase 17 · 08 · Retry with backoff, jitter and an `AbortSignal`** *(another chunk's topic)* — building it from scratch

---

Start → [1 · The controller and the signal](./01-the-controller-and-the-signal.md)
