---
title: "Async errors on Express 5"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**Rejected promises from async handlers reach error middleware on Express 5. You
do not need `express-async-errors` for that baseline.**

> Verified: 2026-08-14 on **Express 5.2.1**. The forwarding mechanism is
> `Layer.prototype.handleRequest`'s `isPromise(ret)` branch in **`router@2.2.0`**'s
> `lib/layer.js`, in `sandbox/express-verify/node_modules/`, quoted in chunk 01.
> Cross-checked against [Migrating to Express
> 5](https://expressjs.com/en/guide/migrating-5.html) — async handler errors are
> *"automatically forwarded to the error handler"* — and the
> [error-handling guide](https://expressjs.com/en/guide/error-handling.html), which
> states the limit for callback-based APIs. **Reading source is not a run.** The
> single console block (chunk 01) is re-used unchanged from the earlier authorised
> `sandbox/express-verify` run and is **sandbox-measured**. The habits in chunk 03
> are this bible's guidance, stated as such.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[What is forwarded](01-what-is-forwarded.md)** | The seven lines that are the whole feature, why Express does not `await`, where `Error: Rejected promise` comes from, and why the shim and the wrapper should both go |
| 02 | **[The four shapes that escape](02-the-shapes-that-escape.md)** | Callbacks, floating promises, timers, emitters — plus `Promise.all`'s partial failure — and why the floating promise is the one that takes the process down |
| 03 | **[Writing async handlers](03-writing-async-handlers.md)** | Seven habits that make the guarantee cover your code, and the one thing no habit fixes because nothing can cancel a running handler |

**Split on concept boundaries at the 300-line mark.** 01 is the guarantee, 02 is
its edge, 03 is how to stay inside it.

## Phase gate

You can state exactly what Express 5 attaches to, name the shapes that escape it,
and explain why a floating promise is more dangerous than a thrown one.

## Where this connects

- **← [Phase 0 · 03 · chunk 02](../../phase-0-express-basics/03-request-lifecycle/02-how-a-handler-is-invoked.md)**
  — `Layer.handleRequest` in full, including the arity gate.
- **← [01 · Error middleware](../01-error-middleware/README.md)** — where a
  forwarded error goes, and what answers if nothing does.
- **→ [03 · Error contract](../03-error-contract.md)** — the envelope the
  forwarded errors end up wearing.
- **→ [05 · Operational vs programmer](../05-operational-vs-programmer.md)** — the
  distinction that decides whether to keep serving.
- **→ [06 · 404 and process errors](../06-not-found-and-process.md)** — the two
  process listeners, in full.
- **→ [Phase 2 · 03 · chunk 02](../../phase-2-middleware/03-next-semantics/02-the-hang.md)**
  — why a promise that *resolves* without responding still hangs.
- **→ [Phase 9 · 06 · Timeouts](../../phase-9-hardening/06-timeouts-and-secrets.md)**
  — `AbortSignal`, and why a timeout is not a cancellation.
- **→ [Node Phase 7 · Background work](/docs/nodejs/pages/phase-7-background-work/)**
  — where fire-and-forget work should actually live.

---

← Prev topic: [Four-arg error middleware](../01-error-middleware/README.md) · Start → [What is forwarded](01-what-is-forwarded.md)
