---
title: "The request lifecycle"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**Every request walks one path: middleware chain → route handler → response, or
it falls into error middleware. If nothing calls `next` and nothing writes a
response, the client hangs.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. Stage boundaries
> are from the Node [HTTP documentation](https://nodejs.org/api/http.html);
> invocation and dispatch are read from the installed `express@5.2.1` and
> `router@2.2.0` source in `sandbox/express-verify/node_modules/`, cited per chunk
> by function; the default error handler is cross-checked against the Express
> [error-handling guide](https://expressjs.com/en/guide/error-handling.html).
> **Reading source is not a run.** The single console block in this topic
> (chunk 01) is re-used unchanged from the earlier authorised
> `sandbox/express-verify` run and is **sandbox-measured**; nothing was executed
> for this rewrite.

The map, the machine that calls your function, and the four ways it can be over.
Phase 2 deepens `next` semantics and Phase 5 deepens error middleware; this topic
is the frame both of them hang on.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The nine stages](01-the-nine-stages.md)** | Socket to `'finish'`, which four stages Express owns, why the body does not exist yet in your first middleware, and where to hook for logging |
| 02 | **[How a handler is invoked](02-how-a-handler-is-invoked.md)** | `Layer.handleRequest` in full: arity as the only detection mechanism, what Express 5 catches, and the floating promise that succeeds and then kills the process |
| 03 | **[The four endings](03-the-four-endings.md)** | Responded · error · unmatched · hang — why 404 and 500 arrive at the same function, and why only one of the four has no status code |

**Split on concept boundaries at the 300-line mark.** 01 is the shape of the
journey, 02 is the mechanism at each step, 03 is how it stops.

## Phase gate

You can point to where a request is lost if nobody calls `next` and nobody writes
a response; say at what stage `req.body` starts existing; and explain why
`(err, req, res, next = null)` is a catastrophic signature.

## Where this connects

- **← [02 · app, Router and `http.Server`](../02-app-router-server/README.md)** —
  the object graph and the router walk. Chunk 01 here is that walk placed in the
  wider journey.
- **→ [Phase 2 · 01 · The middleware contract](../../phase-2-middleware/01-middleware-contract/README.md)**
  — the `(req, res, next)` contract in full.
- **→ [Phase 2 · 03 · `next` semantics](../../phase-2-middleware/03-next-semantics/README.md)**
  — `next()`, `next(err)`, `next('route')`, and calling it twice.
- **→ [Phase 3 · 02 · JSON and urlencoded](../../phase-3-requests/02-json-and-urlencoded/README.md)**
  — stage 6, and the content-type gate that decides whether it happens.
- **→ [Phase 5 · 01 · Error middleware](../../phase-5-errors/01-error-middleware/README.md)**
  — the arity rule chunk 02 derives, applied.
- **→ [Phase 5 · 02 · Async errors](../../phase-5-errors/02-async-errors.md)** —
  the four things Express 5 still does not catch.
- **→ [Phase 5 · 06 · 404 and process errors](../../phase-5-errors/06-not-found-and-process.md)**
  — ending 3 in full.
- **→ [Phase 9 · 06 · Timeouts](../../phase-9-hardening/06-timeouts-and-secrets.md)**
  — bounding ending 4, and why a timeout is not a cancellation.
- **← [Node Phase 5 · HTTP and processes](/docs/nodejs/pages/phase-5-http-processes/)**
  — stages 1, 2 and 9 belong to Node.

---

← Prev topic: [app, Router, and http.Server](../02-app-router-server/README.md) · Start → [The nine stages](01-the-nine-stages.md)
