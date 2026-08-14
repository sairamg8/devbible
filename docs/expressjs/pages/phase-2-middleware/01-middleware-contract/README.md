---
title: "The middleware contract"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**Middleware is a function `(req, res, next) => void`. It must either send a
response or call `next` (or `next(err)`). Anything else hangs the client.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. The contract is
> quoted from [using middleware](https://expressjs.com/en/guide/using-middleware.html)
> and the factory convention from
> [writing middleware](https://expressjs.com/en/guide/writing-middleware.html);
> the arity gates and `Layer.name` are read from `router@2.2.0`'s `lib/layer.js`
> in `sandbox/express-verify/node_modules/`. **Reading source is not a run.** The
> single console block in this topic (chunk 01) is re-used unchanged from the
> earlier authorised `sandbox/express-verify` run and is **sandbox-measured**;
> nothing was executed for this rewrite. The structural rules in chunks 02 and 03
> are this bible's guidance, stated as such — Express enforces none of them.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The shape and the endings](01-the-shape-and-the-endings.md)** | The three legal endings and the two things that look like endings and are not; arity as part of the contract; why `return next()` is load-bearing |
| 02 | **[Middleware that composes](02-middleware-that-composes.md)** | The factory convention every built-in follows, why the returned function should be named, per-route versus global, async rules, and the cost of extending `req` |
| 03 | **[What middleware must not do](03-what-middleware-must-not-do.md)** | Seven things Express permits and you should not: double `next`, respond-and-continue, unconditional cost, authorization that stops at the middleware, swallowed errors, business logic, assumed order |

**Split on concept boundaries at the 300-line mark.** 01 is the contract, 02 is
how to write one well, 03 is what the contract permits and shouldn't.

## Phase gate

You can say what happens when `next()` is called twice, why
`(err, req, res, next = null)` is a catastrophic signature, and which
authorization question middleware structurally cannot answer.

## Where this connects

- **← [Phase 0 · 03 · chunk 02](../../phase-0-express-basics/03-request-lifecycle/02-how-a-handler-is-invoked.md)**
  — `Layer.handleRequest` in full, where the arity gate lives.
- **← [Phase 0 · 03 · chunk 03](../../phase-0-express-basics/03-request-lifecycle/03-the-four-endings.md)**
  — what a hung request looks like from the router's side.
- **→ [02 · Execution order](../02-execution-order.md)** — registration order as an
  array walk.
- **→ [03 · `next` semantics](../03-next-semantics.md)** — `next()`, `next(err)`,
  `next('route')`, and calling it twice.
- **→ [04 · Middleware factories](../04-middleware-factories.md)** — the convention
  chunk 02 leans on, in full.
- **→ [06 · Mutating `req`/`res`](../06-mutating-req-res.md)** — the undeclared
  dependency chunk 02 warns about.
- **→ [Phase 5 · 01 · Error middleware](../../phase-5-errors/01-error-middleware.md)**
  — the four-argument half of the contract.
- **→ [Phase 8 · 07 · Ownership](../../phase-8-validation-authz/07-ownership.md)** —
  the authorization question chunk 03 says middleware cannot answer.
- **→ [Phase 10 · 01 · The app factory](../../phase-10-app-factory/01-create-app.md)**
  — where the mount order becomes readable.

---

← Index: [Phase 2](../README.md) · Start → [The shape and the endings](01-the-shape-and-the-endings.md)
