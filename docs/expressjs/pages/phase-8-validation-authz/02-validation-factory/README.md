---
title: "Validation middleware factory"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**`validate({body, params, query})` returns middleware. On failure: 400 with
stable codes. On success: attach parsed data.**

> Verified: 2026-08-14 — **no sandbox run and no console block in any chunk.**
> The factory shape is **Express's own convention**: the docs describe
> *"configurable middleware"* as a module that *"exports a function which accepts
> an options object and returns the middleware implementation"*
> ([using middleware](https://expressjs.com/en/guide/using-middleware.html)).
> `next(err)` with a `statusCode` works because the default handler reads
> `err.status`/`err.statusCode`
> ([error handling](https://expressjs.com/en/guide/error-handling.html)), read from
> `finalhandler@2.1.1` in `sandbox/express-verify/node_modules/`. **`req.query` is
> a getter and assigning to it throws**
> ([migration guide](https://expressjs.com/en/guide/migrating-5.html), and
> `express@5.2.1`'s `lib/request.js`) — which is why the parsed result goes on
> `req.validated`. Express publishes **no reserved-name list**, so the namespace
> matters. **Schema design and the ordering rule are this bible's guidance.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The factory](01-the-factory.md)** | `safeParse` collecting every issue rather than throwing on the first, the five deliberate decisions in twenty lines, and why one `req.validated` beats three properties |
| 02 | **[Mounting and order](02-mounting-and-order.md)** | Authn → authz → validate, and the reason people miss: validation errors describe your schema. The webhook exception, and the one test that catches a reordering |
| 03 | **[Schemas that hold up](03-schemas-that-hold-up.md)** | One schema per *operation*, server-owned fields excluded by omission, why `PATCH` needs a `refine`, and the coercion traps specific to params and query |

**Split on concept boundaries at the 300-line mark.** 01 is the middleware, 02 is
where it goes, 03 is what you feed it.

## Phase gate

You can say why `safeParse` beats `parse` here, give the order of authn, authz and
validation *with the information-leak reason*, and explain why one schema cannot
serve both `POST` and `PATCH`.

## Where this connects

- **← [01 · Validate at the boundary](../01-validate-at-boundary/README.md)** —
  why the parse output is the thing that matters.
- **← [Phase 2 · 02 · chunk 01](../../phase-2-middleware/02-execution-order/01-the-four-levels.md)**
  — registration order as an array walk, which the chain depends on.
- **← [Phase 3 · 02](../../phase-3-requests/02-json-and-urlencoded/README.md)** —
  the parser that must run first, and the empty body that becomes `{}`.
- **→ [03 · Coercion traps](../03-coercion-traps.md)** — `z.coerce.number()` on
  `''`, in full.
- **→ [04 · Authn middleware](../04-authn-middleware/README.md)** — the guard that runs
  before this one.
- **→ [09 · Type inference](../09-type-inference.md)** — removing the duplication
  the trade-off complains about.
- **→ [Phase 5 · 03 · chunk 01](../../phase-5-errors/03-error-contract/01-the-envelope.md)**
  — the `details` array these issues become.
- **→ [Phase 6 · 08 · OpenAPI](../../phase-6-rest-surface/08-openapi.md)** —
  generating the documented request bodies from the same schemas.
- **→ [Phase 6 · 09 · Webhooks](../../phase-6-rest-surface/09-webhooks.md)** — the
  documented exception to the ordering rule.

---

← Prev topic: [Validate at the boundary](../01-validate-at-boundary/README.md) · Start → [The factory](01-the-factory.md)
