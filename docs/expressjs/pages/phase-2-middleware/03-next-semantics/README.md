---
title: "next semantics"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**`next()` continues. `next(err)` jumps to error handlers. Neither response nor
`next` means hang. `next` after a response means header errors.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. The argument
> handling is read from `router@2.2.0` in `sandbox/express-verify/node_modules/`
> — the `err === 'route'` and `layerError === 'router'` branches in
> `Router.prototype.handle` and their mirrors in `Route.prototype.dispatch`.
> Behaviour is cross-checked against
> [using middleware](https://expressjs.com/en/guide/using-middleware.html) (the
> hang), the [routing guide](https://expressjs.com/en/guide/routing.html)
> (`next('route')`), the
> [error-handling guide](https://expressjs.com/en/guide/error-handling.html) (the
> `res.headersSent` guard) and the Node
> [`http.ServerResponse`](https://nodejs.org/api/http.html#class-httpserverresponse)
> docs. **Reading source is not a run.** The three console blocks in this topic
> are re-used unchanged from the earlier authorised `sandbox/express-verify` run
> and are **sandbox-measured**; nothing was executed for this rewrite.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[What you can pass](01-what-you-can-pass.md)** | Four interpretations of one argument: falsy continues, `'route'` and `'router'` are sentinels, everything else is an error — including a string you meant as a message |
| 02 | **[The hang](02-the-hang.md)** | The failure with no status code, the five ways to write it, how to find something defined by an absence, and why a timeout makes it visible rather than fixed |
| 03 | **[Double send and guards](03-double-send-and-guards.md)** | Why the stack points at the victim, the three response-state properties, and the two guards — `return` everywhere and `res.headersSent` in every error handler |

**Split on concept boundaries at the 300-line mark.** 01 is the signature, 02 is
calling it too few times, 03 is calling it too many.

## Phase gate

You can say what `next('user not found')` does, name what fires and what does not
when a request hangs, and explain why `if (res.headersSent) return next(err)` is
the documented first line of an error handler.

## Where this connects

- **← [Phase 0 · 02 · chunk 03](../../phase-0-express-basics/02-app-router-server/03-inside-router-handle.md)**
  — the walk that `next` drives, from the source.
- **← [Phase 0 · 03 · chunk 03](../../phase-0-express-basics/03-request-lifecycle/03-the-four-endings.md)**
  — the four endings; chunks 02 and 03 here are the two that go wrong.
- **← [01 · The middleware contract](../01-middleware-contract/README.md)** — the
  three legal endings, and why `return next()` is load-bearing.
- **← [02 · Execution order](../02-execution-order/README.md)** — `DEBUG=router`, the
  tool chunk 02 uses to find a hang.
- **→ [04 · Middleware factories](../04-middleware-factories.md)** — the shape that
  makes named layers, which is what makes the debug output readable.
- **→ [Phase 1 · 04 · Route ordering](../../phase-1-routing/04-route-ordering.md)** —
  usually the better answer than `next('route')`.
- **→ [Phase 5 · 01 · Error middleware](../../phase-5-errors/01-error-middleware/README.md)**
  and **[· 02 · Async errors](../../phase-5-errors/02-async-errors.md)** — what
  happens once `next(err)` is called, and what Express 5 does not catch.
- **→ [Phase 9 · 06 · Timeouts](../../phase-9-hardening/06-timeouts-and-secrets.md)**
  — bounding the hang, and why that is not cancellation.

---

← Prev topic: [Execution order](../02-execution-order/README.md) · Start → [What you can pass](01-what-you-can-pass.md)
