---
title: "15 · Timeouts, retries, backoff and jitter"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`fetch()` § Exceptions](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch), [HTTP request methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods), [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After), [429](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429), [503](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/503), [`AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static), [`AbortSignal.any()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static), [`Error.cause`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause) — plus [RFC 9110 § 9.2](https://www.rfc-editor.org/rfc/rfc9110#section-9.2) and the AWS Builders' Library, [*Timeouts, retries and backoff with jitter*](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/). Documentation-validated; **no timings, no console blocks**.

The syllabus row is *the wrapper every real client needs, and which errors are safe to retry* —
and the second half is what most implementations get wrong.

🔴 **A retry is only correct when both answers are yes: the failure is transient, and repeating
the operation is safe.** Retrying a permanent error wastes the user's time; retrying a
non-idempotent one can do the work twice.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[What is safe to retry](./01-what-is-safe-to-retry.md)** | Transient versus permanent, the status-code table, why `fetch` never rejects on 5xx, never retrying your own `AbortError`, `Retry-After` outranking your schedule, idempotent methods and idempotency keys, the three limits (per-attempt timeout, deadline, attempt cap) and retry amplification |
| 02 | **[The wrapper — backoff, jitter and a deadline](./02-the-wrapper.md)** | Why plain exponential backoff still causes a thundering herd, full jitter and the capped ceiling, the complete `withRetry` with a composed `AbortSignal`, `{ cause }` on the final error, what the wrapper must not swallow or log, and where it belongs in the stack |

## Four facts worth carrying out of this topic

- **`fetch` fulfils on 4xx and 5xx.** A retry predicate that only inspects rejections never sees
  a 503 — classify the `Response` too.
- **Never retry your own `AbortError`.** It means stop; that is why `AbortSignal.timeout` aborts
  with `TimeoutError` instead.
- **Backoff without jitter keeps the herd synchronised.** Randomise: `Math.random() *
  min(cap, base · 2ⁿ)`.
- **Retries multiply across layers.** Three layers × three attempts = 27 requests for one user
  action. Own retries in exactly one layer.

## Phase gate

You can write a retry wrapper that honours a caller's `AbortSignal` through every attempt *and*
every backoff sleep, enforces both a per-attempt timeout and a total deadline, and can explain
for any given failure whether it should be retried at all.

## Where this connects

- [14 · Cancellation](../14-cancellation/02-composing-signals.md) — the composed signal this
  wrapper is built on, and why timeout and cancel carry different names
- [12 · The API and clearing](../12-timers/01-the-api.md) — the cancellable `delay` the backoff
  sleeps on
- [08 · Rejections that vanish](../08-error-handling/02-rejections-that-vanish.md) — why the
  final error carries `{ cause }`
- [10 · Combinators](../10-combinators/README.md) — what `race` does and does not promise about
  the work it discards
- **16 · Concurrency limiting** · **17 · Race conditions in a UI** ·
  **Phase 11 · 08 · Aborting and timing out** *(not written yet)*

---

Start → [01 · What is safe to retry](./01-what-is-safe-to-retry.md)
