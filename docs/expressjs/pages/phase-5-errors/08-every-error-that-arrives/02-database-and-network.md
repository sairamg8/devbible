---
title: "Database and network"
sidebar_label: "02 · Database and network"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**The errors nobody writes a handler for: a unique constraint, a deadlock, a
statement timeout, a service that will not connect. Each has a correct status,
and three of them are the client's fault while the rest are not.**

> Verified: 2026-08-14 — **no sandbox run on this page and no console block.**
> The SQLSTATE mapping below matches the **sandbox-proven** table in the
> PostgreSQL track, where each code was produced by actually causing the error
> ([PostgreSQL · errors to HTTP](../../../../postgresql/pages/phase-9-api-crud/01-repository/03-errors-to-http.md),
> and the driver's error surface in
> [PostgreSQL Phase 7 · 05](../../../../postgresql/pages/phase-7-pg-driver/05-errors.md));
> the codes themselves are PostgreSQL's documented
> [error codes appendix](https://www.postgresql.org/docs/current/errcodes-appendix.html).
> MongoDB's duplicate-key error is code **11000**
> ([MongoDB manual](https://www.mongodb.com/docs/manual/reference/error-codes/)).
> Node's system errors (`ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`, `ECONNRESET`)
> are the [Node errors documentation](https://nodejs.org/api/errors.html#common-system-errors);
> Node's `fetch` rejects with a `TypeError` carrying the underlying failure as
> **`cause`**, and `AbortSignal.timeout()` aborts with a **`TimeoutError`**
> `DOMException` while `AbortController.abort()` defaults to **`AbortError`**
> ([MDN · AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)).
> Statuses are [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §15.6.3
> (502), §15.6.4 (503), §15.6.5 (504) and §10.2.3 (`Retry-After`).
> **Express knows none of this** — every mapping is application code.

## PostgreSQL, by SQLSTATE

```js
// in the repository — the layer that knows which constraint means what
const STATUS = {
  '23505': 409,   // unique_violation           — it already exists
  '23503': 409,   // foreign_key_violation      — 400 if they named a bad parent
  '23514': 400,   // check_violation            — broke a rule the DB enforces
  '23502': 400,   // not_null_violation         — a required field was missing
  '22P02': 400,   // invalid_text_representation — ?id=abc
  '22003': 400,   // numeric_value_out_of_range
};
```

| SQLSTATE | Name | HTTP | Whose fault |
|---|---|---|---|
| `23505` | unique_violation | **409** | client — the resource exists |
| `23503` | foreign_key_violation | **400** or **409** | 400 naming a bad parent; 409 deleting something referenced |
| `23514` | check_violation | **400** | client |
| `23502` | not_null_violation | **400** | client |
| `22P02` | invalid_text_representation | **400** | client — *not* a 404 |
| `22003` | numeric_value_out_of_range | **400** | client |
| `40001` | serialization_failure | **retry**, then 503 | nobody — concurrency |
| `40P01` | deadlock_detected | **retry**, then 503 | nobody — concurrency |
| `57014` | query_canceled | **504** | your timeout fired |
| `53300` | too_many_connections | **503** + `Retry-After` | your capacity |
| `42703` `42601` `42P01` | undefined_column, syntax_error, undefined_table | **500** | **you** — a bug |

Three of these are worth dwelling on:

🔴 **`22P02` is a 400, not a 404.** `GET /orders/abc` is malformed input, and
answering 404 tells the client the id was well-formed and absent — which is a
different fact, and the one that hides the bug in their code
([Phase 8 · 03](../../phase-8-validation-authz/03-coercion-traps.md)). Validating
the parameter at the boundary means the driver never sees it at all.

🔴 **`40001` and `40P01` are retryable, and only from outside the transaction.**
Serialization failures and deadlocks mean *"try again"*, and the retry has to
re-run the whole transaction — retrying a statement inside an aborted transaction
fails immediately. Retry twice with a short backoff, then answer 503; a request
that retries forever is a queue nobody can see.

🔴 **The `42xxx` family is your bug, so it must be a 500.** `undefined_column`
means a query and a schema disagree. A repository that maps *everything* to a
client-facing status will report a deploy mismatch as 400 — a permanently failing
endpoint that blames the caller ([chunk 01](01-the-taxonomy.md): re-throw what you
do not recognise).

⚠️ **The driver's fields are not uniformly populated.** `constraint` is present
for the `23xxx` integrity errors and `column` only for `23502` — measured in the
PostgreSQL track — so a mapping keyed on `err.constraint` silently falls through
for everything else. Key on `code`, then refine with `constraint` when it exists.

## MongoDB and ORMs

The vocabulary changes; the boundary does not.

```js
if (err.code === 11000) {                       // duplicate key
  throw new ConflictError('EMAIL_TAKEN', {cause: err});
}
```

- **MongoDB** signals a duplicate key with code **11000** (`E11000` in the
  message), and validation failures with its own document-validation error rather
  than an HTTP-shaped one.
- **ORMs wrap the driver in their own codes** — Prisma documents `P2002` for a
  unique-constraint failure and `P2025` for an operation on a record that does not
  exist, for example. The translation is the same shape, one layer further out.

⚠️ **An ORM's "not found" is a decision, not a fact.** `P2025`-style errors happen
because the ORM chose to throw where a driver would have returned zero rows.
Translate it to your `NotFoundError` in the repository, so the service above sees
one behaviour regardless of which library is underneath — and so an ownership
check still answers 404 for the right reason
([Phase 8 · 07](../../phase-8-validation-authz/07-ownership/README.md)).

## Calling another service: 502, 503, 504

An outbound call has more failure modes than a database query, and they map to
three different statuses. Getting them right is what makes your API debuggable
from the outside.

| What happened | Detected as | Status |
|---|---|---|
| DNS did not resolve | `ENOTFOUND` | **502** |
| Connection refused | `ECONNREFUSED` | **502** |
| Connection dropped mid-response | `ECONNRESET` | **502** |
| The peer answered 5xx | your own check of `res.status` | **502** |
| **Your timeout fired** | `TimeoutError` / `AbortError` | **504** |
| The dependency is known-down, or you are shedding load | your circuit breaker | **503** + `Retry-After` |
| The peer answered 4xx because *you* called it wrong | `res.status` 400/401 | **500** — your bug, not the caller's |

The last row is the one that gets mis-mapped. **A 401 from the payment provider is
not a 401 for your caller** — it means your credentials are wrong. Passing an
upstream status through is the commonest way an API ends up telling users to
re-authenticate because a server-side API key expired.

```js
// ✅ one wrapper per dependency, so the vocabulary is translated once
export async function fetchPrice(sku) {
  try {
    const res = await fetch(`${base}/price/${sku}`, {signal: AbortSignal.timeout(2000)});
    if (res.status === 404) return null;                       // meaningful to us
    if (!res.ok) throw new BadGatewayError('PRICING_FAILED', {cause: res.status});
    return await res.json();
  } catch (err) {
    if (err.name === 'TimeoutError') throw new GatewayTimeoutError('PRICING_TIMEOUT', {cause: err});
    if (err instanceof BadGatewayError) throw err;
    throw new BadGatewayError('PRICING_UNREACHABLE', {cause: err});   // ECONNREFUSED &c.
  }
}
```

🔴 **`fetch` failures hide inside `cause`.** Node's `fetch` rejects with a
`TypeError: fetch failed` whose `cause` carries the real system error — so a log
line that prints only `err.message` records "fetch failed" and nothing about
*why*. Log the cause chain, always ([topic 07](../07-error-logging.md)).

⚠️ **`TimeoutError` and `AbortError` are different.** `AbortSignal.timeout()`
aborts with a `TimeoutError`; an explicit `AbortController.abort()` defaults to
`AbortError`. Treat the first as 504 and the second as *your* cancellation —
usually the client disconnected, which is not an error to report at all
([chunk 03](03-programmer-errors-and-the-fallback.md)).

## Always set a timeout, or you inherit theirs

An outbound call without a timeout fails only when the peer decides to fail, which
may be minutes. Meanwhile your request holds a connection, a pool slot, and
whatever the caller's own timeout is — so one slow dependency turns into
exhaustion everywhere upstream.

**A timeout is what converts an unbounded wait into a 504 you chose.** It belongs
on every outbound call, at a value smaller than your own request timeout
([Phase 9 · 06](../../phase-9-hardening/06-timeouts-and-secrets.md)), and it is
the precondition for any retry or circuit-breaker to mean anything.

## `Retry-After`, and what 503 promises

```js
res.set('Retry-After', '30');     // seconds, or an HTTP-date
```

503 says *"try again later"*, and `Retry-After` is what makes that actionable
rather than an invitation to hammer. Send it whenever the answer is a capacity or
availability problem you expect to pass: pool exhaustion, a tripped breaker,
maintenance, shed load. Do **not** send it on 502 or 504, where you do not know
when the peer recovers.

## Gotchas

**Symptom:** `GET /orders/abc` returns 404
**Cause:** `22P02` mapped as "not found" rather than malformed input
**Fix:** 400 — and validate the parameter at the boundary so the query never runs

**Symptom:** A duplicate signup returns 500
**Cause:** `23505` reached the fallback untranslated
**Fix:** Map it in the repository, refined by `constraint`, to a 409 with your own
code

**Symptom:** An endpoint permanently returns 400 after a deploy
**Cause:** A `42703` undefined_column mapped as a client error
**Fix:** The `42xxx` family is a 500 — re-throw what you do not recognise

**Symptom:** Users are told to re-authenticate when a server-side API key expires
**Cause:** An upstream 401 passed through
**Fix:** An upstream 4xx caused by your call is a 500; only 502/503/504 describe a
dependency

**Symptom:** Logs say only "fetch failed"
**Cause:** `err.message` logged without the `cause` chain
**Fix:** Log causes — the system error lives one level down

**Symptom:** One slow dependency exhausts the pool and takes the API down
**Cause:** An outbound call with no timeout
**Fix:** A timeout on every call, below your own request timeout

**Symptom:** Deadlock retries make a spike worse
**Cause:** Retrying immediately, or retrying inside the aborted transaction
**Fix:** Re-run the whole transaction, twice, with backoff — then 503

## Interview questions

**★ A unique constraint fires. What does the client get, and who maps it?**
409, mapped in the repository — the only layer that knows `users_email_key` means
"email taken". It becomes a domain error with your own code, the driver error is
kept as `cause` for the log, and nothing above that layer ever sees a SQLSTATE.

**★ Why is `22P02` a 400 rather than a 404?**
Because `?id=abc` is malformed input, not a well-formed id that is absent. A 404
asserts the second, which is a different fact and hides the client's bug.
Validating the parameter at the boundary means the query never runs.

**★ Which database errors are retryable, and how?**
Serialization failures (`40001`) and deadlocks (`40P01`) — both mean "try again",
and the retry must re-run the entire transaction, because statements inside an
aborted one fail immediately. Two attempts with backoff, then 503.

**★ 502, 503 or 504?**
502 when the dependency was unreachable or answered badly — DNS failure, refused
connection, reset, its own 5xx. 504 when *your* timeout fired. 503 when you are
deliberately unavailable or shedding load, and that is the one that carries
`Retry-After`.

**★ A payment provider returns 401. What is your status?**
500. The provider rejected *your* credentials, so it is your bug; passing the 401
through tells your caller to re-authenticate, which cannot help. Only 502, 503
and 504 describe a dependency failure.

**Why does every outbound call need a timeout?**
Because without one you inherit the peer's failure timing, holding a connection
and a pool slot for as long as it takes. A timeout is what converts an unbounded
wait into a 504 you chose, and it is the precondition for retries or a breaker to
mean anything.

**What is in `cause` after a failed `fetch`?**
The real system error. Node's `fetch` rejects with a `TypeError: fetch failed`
and puts `ECONNREFUSED`, `ENOTFOUND` or the timeout underneath — so logging only
the message records nothing useful.

---

← Prev: [The taxonomy](01-the-taxonomy.md) · Index: [Every error that arrives](README.md) · Next → [Programmer errors and the fallback](03-programmer-errors-and-the-fallback.md)
