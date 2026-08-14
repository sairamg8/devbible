---
title: "Error response contract"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**One public JSON shape for errors. Include a stable `code`. Never send
`err.stack` when `NODE_ENV === 'production'`.**

> Verified: 2026-08-14. **The envelope is this bible's design, not an Express
> feature** — Express has no opinion on error body shape and no mechanism to
> enforce one, and every recommendation here says so. What is documented is the
> behaviour being replaced: the [error-handling
> guide](https://expressjs.com/en/guide/error-handling.html)'s description of the
> default handler, and its `if (res.headersSent) return next(err)` guard verbatim.
> The default handler's environment-dependent leak is read from
> **`finalhandler@2.1.1`** in `sandbox/express-verify/node_modules/` and quoted in
> [01 · chunk 02](../01-error-middleware/02-the-default-handler.md).
> [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html) is the standardised
> alternative. **Reading source is not a run: nothing was executed for this topic
> and no chunk carries a console block.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The envelope](01-the-envelope.md)** | The handler, the three fields and why each earns its place, how to name codes, the shape of validation `details`, and `problem+json` as the standard alternative |
| 02 | **[What is safe to expose](02-what-is-safe-to-expose.md)** | The 4xx/5xx line, the nine leaks including the two nobody counts, why to map driver errors at the repository, and the `NODE_ENV` check that fails closed |
| 03 | **[Making it stick](03-making-it-stick.md)** | One place creates errors and one formats them; the four ways the contract leaks; and the table-driven test that keeps it honest |

**Split on concept boundaries at the 300-line mark.** 01 is the shape, 02 is what
goes in it, 03 is how to make every route obey it.

## Phase gate

You can say why a `code` and a `message` are for different audiences, name three
things that must never reach a client, and give the four places an error contract
usually leaks.

## Where this connects

- **← [01 · Error middleware](../01-error-middleware/README.md)** — the handler
  this envelope lives in, and what answers if you write none.
- **← [02 · Async errors](../02-async-errors/README.md)** — how errors get there.
- **→ [04 · Mapping to HTTP](../04-mapping-to-http.md)** — the code-to-status
  table chunk 03's `AppError` reads.
- **→ [05 · Operational vs programmer](../05-operational-vs-programmer.md)** — the
  distinction behind `expose`.
- **→ [06 · 404 and process errors](../06-not-found-and-process.md)** — the 404
  path, which never reaches the handler.
- **→ [07 · Error logging](../07-error-logging.md)** — the detail you removed from
  the response, and why a naive serialiser logs `{}`.
- **→ [Phase 6 · 08 · OpenAPI](../../phase-6-rest-surface/08-openapi.md)** — where
  the codes are documented.
- **→ [Phase 8 · 02 · Validation factory](../../phase-8-validation-authz/02-validation-factory.md)**
  — `safeParse` and the per-issue `details` array.
- **→ [Phase 10 · 02 · Request id](../../phase-10-app-factory/02-request-id.md)** —
  the one field that makes a terse error acceptable.

---

← Prev topic: [Async errors on Express 5](../02-async-errors/README.md) · Start → [The envelope](01-the-envelope.md)
