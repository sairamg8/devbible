---
title: "09 · Failing well"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`try...catch`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch), [`JSON.parse()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse), [`Response.json()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/json), [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch), [`Window: message` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/message_event), [`Promise.allSettled()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled), [`Error.cause`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause). Documentation-validated; **no timings, no console blocks**.

The syllabus row is *validate at the boundary, never write an empty `catch`, and result objects
versus exceptions* — three rules that together decide whether a failure is diagnosable.

🔴 **Two sentences carry the topic.** Check data once, where it enters, and produce a value whose
shape is guaranteed. Then report failure in the form that matches how expected it is — a value
when the caller has a branch for it anyway, an exception when they do not.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Validate at the boundary](./01-validate-at-the-boundary.md)** | Where the boundaries are and the false assumption at each — including versioned storage, the one people miss; parsing rather than checking, so the value that leaves the boundary is the one everyone uses; why scattered defensive checks hide bugs; `fetch`'s three separate failures; fail-fast versus degrade decided per boundary; and checking `event.origin` before `event.data` |
| 02 | **[Results versus exceptions](./02-results-versus-exceptions.md)** | The expected/unexpected rule and what each style costs; results at the boundary and exceptions inside; the empty `catch` and the four things every `catch` must do; logging once rather than per layer; fallbacks that lie (`[]`, `0`, `null`) and modelling loading/empty/error as three states; and what the user sees versus what you keep |

## Four facts worth carrying out of this topic

- **Parse, do not merely check.** The boundary should emit a value whose shape nothing downstream
  needs to re-verify.
- **`catch { return [] }` reports "there are none" for a failure to find out.** Empty and failed
  must look different.
- **Every `catch` handles, translates, reports or rethrows** — and a deliberate ignore is a
  comment, not an empty block.
- **Log where you handle, not where you pass through.** Layered logging is how logs stop being
  read.

## Phase gate

You can point at every place untrusted data enters a module and show the single function that
parses it; and for any given failure you can say whether it should be a thrown error or a returned
result, and why.

## Where this connects

- [07 · The statements](../07-throw-try-catch/01-the-statements.md) — the narrow `try` and
  rethrowing what is not yours
- [07 · `finally`](../07-throw-try-catch/02-finally.md) — cleanup that runs on every path
- [08 · Designing the taxonomy](../08-custom-error-classes/01-designing-the-taxonomy.md) — the
  classes and codes a handler branches on
- [08 · Cause chains and boundaries](../08-custom-error-classes/02-cause-chains-and-boundaries.md)
  — translating at a boundary and keeping the chain for logs
- [Phase 7 · 15 · What is safe to retry](../../phase-7-async/15-timeouts-retries-backoff/01-what-is-safe-to-retry.md)
  — `res.ok`, and which failures deserve another attempt
- [Phase 7 · 16 · The bounded pool](../../phase-7-async/16-concurrency-limiting/02-the-bounded-pool.md)
  — the `allSettled` result shape, applied to bulk work
- **10 · Global error handling** · **14 · Testing JavaScript** *(not written yet)*

---

Start → [01 · Validate at the boundary](./01-validate-at-the-boundary.md)
