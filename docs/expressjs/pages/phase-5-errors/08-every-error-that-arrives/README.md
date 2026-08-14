---
title: "Every error that arrives"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**The complete catalogue: everything that can reach the error handler — your own
errors, validation, database codes, network failures, library throws that are not
`Error` objects, and plain bugs — what each becomes, and where each is
translated.**

> 🔴 **The rule this topic exists to argue: the global handler does not interpret,
> it formats.** Translation happens at the boundary that understands the
> vocabulary — the repository knows what `23505` on `users_email_key` means, and
> the handler never will.

> Verified: 2026-08-14 — **no sandbox run and no console block in any chunk.**
> Express's part is one documented mechanism: a **four-argument** middleware
> defined last, receiving anything passed to `next(err)` or thrown/rejected inside
> a handler in Express 5; the built-in handler reads `err.status`/`err.statusCode`
> and *"the stack trace is not included in the production environment"*; and a
> handler must delegate with `next(err)` once the response has started
> ([error handling](https://expressjs.com/en/guide/error-handling.html)).
> **Express knows nothing about drivers, HTTP clients or validation libraries** —
> every mapping here is application code. The SQLSTATE table matches the
> **sandbox-proven** one in the
> [PostgreSQL track](../../../../postgresql/pages/phase-9-api-crud/01-repository/03-errors-to-http.md);
> codes are PostgreSQL's
> [error codes appendix](https://www.postgresql.org/docs/current/errcodes-appendix.html)
> and MongoDB's [error codes](https://www.mongodb.com/docs/manual/reference/error-codes/).
> Node system errors and `fetch`'s `cause` are the
> [Node errors docs](https://nodejs.org/api/errors.html#common-system-errors);
> `TimeoutError` vs `AbortError` is
> [MDN](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). Statuses
> are [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html).
> **The taxonomy, mappings and policies are this bible's.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The taxonomy](01-the-taxonomy.md)** | Six families and who can translate each, why the god handler fails, the four fields a translated error carries, and normalising things that are not `Error`s |
| 02 | **[Database and network](02-database-and-network.md)** | SQLSTATE → status including the retryable and the your-bug families, Mongo and ORM codes, and 502 vs 503 vs 504 for outbound calls |
| 03 | **[Programmer errors and the fallback](03-programmer-errors-and-the-fallback.md)** | Why a `TypeError` is never a 400, the fallback line by line, headers already sent, aborted clients, when to crash, and the table test that proves no leak |

**Split on concept boundaries at the 300-line mark.** 01 is the model, 02 is the
vocabulary, 03 is the last resort.

## Phase gate

You can name the six families and say who translates each, explain why database
codes must not be mapped in the global handler, give the status for a unique
violation, a malformed id, a deadlock, a refused dependency and your own timeout,
say what happens when an error arrives after the response has started, and
describe the test that proves a 500 leaks nothing.

## Where this connects

- **← [01 · Four-arg error middleware](../01-error-middleware/README.md)** — how
  anything reaches the handler, and the built-in one behind it.
- **← [02 · Async errors](../02-async-errors/README.md)** — the five shapes that
  escape Express 5's guarantee entirely.
- **← [03 · Error response contract](../03-error-contract/README.md)** — the
  envelope this topic fills in, and the nine leaks.
- **← [04 · Mapping to HTTP](../04-mapping-to-http.md)** — which status an
  operational failure deserves.
- **← [05 · Operational vs programmer](../05-operational-vs-programmer.md)** — the
  distinction chunk 03 turns into a policy.
- **→ [07 · Error logging](../07-error-logging.md)** — logging the `cause` chain,
  and what must never be written down.
- **→ [Phase 3 · 05](../../phase-3-requests/05-malformed-bodies.md)** — the
  framework errors that already carry a status.
- **→ [Phase 7 · 01](../../phase-7-layering/01-controller-service-repository/README.md)**
  — the repository where translation belongs.
- **→ [PostgreSQL · errors to HTTP](../../../../postgresql/pages/phase-9-api-crud/01-repository/03-errors-to-http.md)**
  — the measured SQLSTATE table this page agrees with.

---

← Prev topic: [07 · Error logging](../07-error-logging.md) · Start → [The taxonomy](01-the-taxonomy.md)
