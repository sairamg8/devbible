---
title: "14 · Cancellation"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), [`AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static), [`AbortSignal.any()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static), [`AbortSignal.throwIfAborted()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted), [`EventTarget.addEventListener()` § signal](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener) — and the [DOM Standard § Aborting ongoing activities](https://dom.spec.whatwg.org/#aborting-ongoing-activities). Documentation-validated; **no timings, no console blocks**.

The syllabus row is *`AbortController`, `AbortSignal.timeout`, `AbortSignal.any`,
`throwIfAborted`, and propagating a signal down a call tree* — one vocabulary, used everywhere
from `fetch` to `addEventListener` to Node streams.

🔴 **The premise the whole topic rests on: a promise cannot be cancelled.** A promise reports a
result; it is not the work. `AbortController` cancels the *operation*, cooperatively, and the
promise then rejects with the signal's reason.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The model — controller, signal, reason](./01-the-model.md)** | Why the API has two halves and why you pass the signal; cancellation as a cooperative request; `reason` and the default `AbortError`; not treating an abort as a failure; `aborted` before starting, `throwIfAborted()` in a loop, the `abort` event for unwinding; the platform APIs that take a signal; and the four obligations of a cancellable function |
| 02 | **[Composing and propagating signals](./02-composing-signals.md)** | `AbortSignal.abort`, `.timeout` (and its `TimeoutError`), `.any` for "user cancel **or** timeout"; threading a signal down a call tree; one controller per scope as the whole teardown; the per-operation controller for search-as-you-type; why `Promise.race` with a timer cancels nothing; and the cleanup composition still owes you |

## Four facts worth carrying out of this topic

- **Cancellation is cooperative.** Only APIs that honour the signal stop, and nothing interrupts
  a synchronous block.
- **An already-aborted signal fires no `abort` event.** Every entry point must check
  `signal.aborted` (or call `throwIfAborted()`) before starting.
- **`AbortSignal.timeout` aborts with `TimeoutError`, a manual `abort()` with `AbortError`** —
  so a timeout can be retried while a cancellation stays silent.
- **`Promise.race` against a timer is not a timeout.** The loser keeps running and holds its
  resources; only its result is discarded.

## Phase gate

You can write a function that takes an optional `signal`, refuses to start when it is already
aborted, checks it after every `await`, passes it into everything it calls, and cleans up on the
way out — and you can add a timeout to it without losing the ability to cancel early.

## Where this connects

- [13 · Promisifying a callback API](../13-creating-promises/02-promisifying.md) — where a
  wrapper accepts a signal and turns it into real teardown
- [12 · The API and clearing](../12-timers/01-the-api.md) — the `delay(ms, { signal })` helper
- [08 · Rejections that vanish](../08-error-handling/02-rejections-that-vanish.md) — the
  dangling rejection a `race`-based timeout leaves behind
- [10 · Combinators](../10-combinators/README.md) — what `race`, `all` and `any` actually
  promise about the losers
- [Phase 8 · 04 · The four leaks](../../phase-8-modules-errors/04-leaks/02-the-four-leaks.md) —
  listeners and controllers that outlive their scope
- **15 · Timeouts, retries, backoff and jitter** · **17 · Race conditions in a UI** ·
  **Phase 11 · 08 · Aborting and timing out** *(not written yet)* — the applied versions

---

Start → [01 · The model — controller, signal, reason](./01-the-model.md)
