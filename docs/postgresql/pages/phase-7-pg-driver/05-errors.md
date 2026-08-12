---
title: "Errors from PostgreSQL in Node"
sidebar_label: "05 · Errors"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex20-driver.mjs`,
> `ex21-types-prepared.mjs`, `ex18-delete.mjs`.

**A rejected `pool.query` gives you an error carrying PostgreSQL's five-character
SQLSTATE plus the table, column and constraint involved. Branch on `err.code`. Never on
`err.message` — that string is localised, version-dependent, and not an API.**

## What the error object contains

```console
$ node ex20-driver.mjs
=== 5. PostgreSQL errors as JS objects ===
unique violation     → 23505 | constraint: w_users_email_key | column: - | table: w_users
   full shape: {"name":"error","code":"23505","severity":"ERROR","detail":"Key (email)=(a@x.com) already exists.","schema":"public","table":"w_users","constraint":"w_users_email_key","routine":"_bt_check_unique"}
```

Every field is populated by the server, not guessed by the driver. The useful ones:

| Field | Holds |
|---|---|
| `code` | The SQLSTATE — the thing to branch on |
| `constraint` | Which constraint was violated |
| `table`, `schema`, `column` | Where |
| `detail` | The offending value — **do not return this to a client** |
| `severity` | `ERROR`, `FATAL`, `PANIC` |
| `position` | Character offset into the statement, for syntax errors |
| `routine` | The C function that raised it — occasionally useful when searching |

Which fields are filled depends on the error:

```console
not-null violation   → 23502 | constraint: - | column: name | table: w_users
check violation      → 23514 | constraint: w_users_age_check | column: - | table: w_users
fk violation         → 23503 | constraint: w_orders_user_id_fkey | column: - | table: w_orders
undefined column     → 42703 | constraint: - | column: - | table: -
invalid text input   → 22P02 | constraint: - | column: - | table: -
syntax error         → 42601 | constraint: - | column: - | table: -
undefined table      → 42P01 | constraint: - | column: - | table: -
division by zero     → 22012 | constraint: - | column: - | table: -
```

Note `23502` (not-null) is the one that fills `column`; `23505`, `23514` and `23503`
fill `constraint` instead. Any error-mapping code has to handle both.

## The class tells you who is at fault

The first two characters are the class, and they sort errors into "the user sent
something wrong", "my code is broken", and "retry":

| Class | Meaning | Whose fault |
|---|---|---|
| `08` | Connection exception | Infrastructure |
| `22` | Data exception (`22P02`, `22012`, `22001`) | The input |
| `23` | Integrity constraint violation | The input, usually |
| `25` | Invalid transaction state | Your code |
| `40` | Transaction rollback (`40001`, `40P01`) | Nobody — **retry** |
| `42` | Syntax error or access rule violation | **Your code** — a bug |
| `53` | Insufficient resources (`53300` too many clients) | Capacity |
| `57` | Operator intervention (`57014` cancelled) | Timeout or admin |

**A `42xxx` in production is always a bug**, never a user error — the SQL is wrong or the
schema is not what the code expects. It should be a 500 and an alert, not a 400.

## Mapping to HTTP

```js
const STATUS = {
  '23505': 409,  // unique_violation           → conflict
  '23503': 409,  // foreign_key_violation      → referenced row missing / still referenced
  '23502': 400,  // not_null_violation
  '23514': 400,  // check_violation
  '23001': 409,  // restrict_violation
  '22P02': 400,  // invalid_text_representation — e.g. 'abc' for an int
  '22001': 400,  // string_data_right_truncation — value too long
  '22003': 400,  // numeric_value_out_of_range
  '40001': 409,  // serialization_failure       → retry, then conflict
  '40P01': 409,  // deadlock_detected           → retry, then conflict
  '57014': 504,  // query_canceled (statement_timeout)
  '53300': 503,  // too_many_connections
};

export function toHttp(err) {
  const status = STATUS[err.code] ?? 500;
  return {status, code: err.code, retryable: err.code === '40001' || err.code === '40P01'};
}
```

Used at the edge:

```js
try {
  const {rows: [user]} = await pool.query(
    `INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id, email`, [email, name]);
  res.status(201).json(user);
} catch (err) {
  if (err.code === '23505' && err.constraint === 'users_email_key') {
    return res.status(409).json({error: 'That email is already registered'});
  }
  throw err;                       // anything else is not this handler's business
}
```

**Match the constraint name, not just the code.** A table with three unique constraints
produces `23505` for all of them, and "already exists" is a useless message when the user
cannot tell which field was the problem. This is the concrete payoff of a naming
convention ([Naming](../phase-3-ddl/11-naming.md)) — `users_email_key` is
readable; `uq_1` is not.

## `detail` leaks data

```console
"detail":"Key (email)=(a@x.com) already exists."
```

That string contains the value someone submitted, and it is exactly the kind of thing
that ends up in a JSON error response by accident. On a signup form it confirms whether
an address is registered — user enumeration, from an error message. On other tables it
can echo back a token, a phone number or an internal id.

**Log `detail`; never serialise the raw error to a client.** Return your own message,
keyed off `code` and `constraint`.

## Errors that mean "try again"

```js
async function withRetry(fn, tries = 3) {
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (err) {
      const retryable = err.code === '40001' || err.code === '40P01';
      if (!retryable || i >= tries - 1) throw err;
      await new Promise(r => setTimeout(r, 2 ** i * 50 + Math.random() * 50));
    }
  }
}
```

`40001` (serialization failure) and `40P01` (deadlock detected) are not bugs — they are
the isolation machinery doing its job, and the documented response is to run the
transaction again. Retry the **whole transaction**, not the failed statement, and use
jitter so competing clients do not collide again in step. See
[MVCC](../phase-11-mvcc/) and
[Retry and backoff](/docs/nodejs/pages/phase-6-data-access/retry-backoff).

Connection-class errors (`08006`, `ECONNRESET`) are retryable for reads. For writes they
are not, unless the write is idempotent — you cannot tell whether the statement committed
before the connection dropped ([Idempotent writes](../phase-9-api-crud/11-idempotent-writes.md)).

## Not every failure has a SQLSTATE

```console
=== 3. where connection errors surface ===
first query → ECONNREFUSED | connect ECONNREFUSED 127.0.0.1:1
```

Socket-level failures come from Node, so `err.code` is `ECONNREFUSED`, `ETIMEDOUT` or
`ENOTFOUND` — not a five-character SQLSTATE. Client-side timeouts produce a plain
message:

```console
$ node ex21-types-prepared.mjs
query_timeout     → Query read timeout after 213 ms
```

So `err.code` may be a SQLSTATE, a Node errno, or absent. Test for what you expect rather
than assuming the field's shape:

```js
const isPgError = typeof err.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code);
```

## `FATAL` errors arrive as events, not rejections

```console
idle_in_transaction → arrived as an "error" EVENT: Connection terminated unexpectedly
  next query on it   → Client has encountered a connection error and is not queryable
```

When the server terminates a connection, there may be no in-flight query to reject — so
`pg` emits `'error'` on the client or pool instead. Unhandled, that is an uncaught
exception and the process dies. `pool.on('error', …)` is not optional
([Installing and wiring pg](01-install-wire.md)).

## Trade-off

Branching on SQLSTATE gives precise, stable handling and lets the database enforce rules
that application checks cannot enforce race-free — inserting and catching `23505` is
correct under concurrency where "check then insert" is not.

It costs coupling: the handler must know constraint names, so renaming one in a migration
can quietly change an API's behaviour from 409 to 500. Keep the mapping in one module,
name constraints deliberately, and test the mapping against a real database
([Testing against real PostgreSQL](../phase-9-api-crud/16-testing-real-pg.md)).

## Gotchas

**Symptom:** Error handling breaks after a PostgreSQL upgrade
**Cause:** Matching on `err.message` text.
**Fix:** Match `err.code`. Messages are localised and change between versions; SQLSTATEs
do not.

**Symptom:** A signup form reveals which emails are registered
**Cause:** The raw error, including `detail: "Key (email)=(a@x.com) already exists."`,
returned to the client.
**Fix:** Return your own message; log the original.

**Symptom:** Every unique violation returns the same unhelpful message
**Cause:** Branching on `23505` alone when the table has several unique constraints.
**Fix:** Also match `err.constraint`.

**Symptom:** `err.column` is undefined for a unique violation
**Cause:** Only `23502` populates `column`; `23505`/`23514`/`23503` populate `constraint`.
**Fix:** Handle both shapes.

**Symptom:** Intermittent `40001` under load treated as a 500
**Cause:** Serialization failures are normal at `REPEATABLE READ`/`SERIALIZABLE`.
**Fix:** Retry the whole transaction with backoff and jitter.

**Symptom:** `42P01 relation does not exist` only in one environment
**Cause:** `search_path`, or migrations not applied there — a `42` class error is your
bug, not the user's.
**Fix:** Check the schema and migration state.

**Symptom:** The process exits with no stack from your code
**Cause:** An unhandled `'error'` event from a terminated connection.
**Fix:** `pool.on('error')`.

**Symptom:** `err.code` is `ECONNREFUSED` and the SQLSTATE lookup returns `undefined`
**Cause:** Not every failure originates in PostgreSQL.
**Fix:** Default to 500 and check the code's shape before mapping.

## Interview questions

**★ How do you handle a duplicate-key error properly?**
Attempt the insert and catch SQLSTATE `23505`, then branch on `err.constraint` to know
which unique constraint failed, and return a 409 with your own message. Measured, the
error carries `constraint: 'w_users_email_key'`, `table`, `schema` and a `detail` naming
the value. Do not "check then insert" — that is a race; the constraint is the only
race-free check. Do not return `detail` to the client: it contains the submitted value
and enables user enumeration.

**★ Why branch on `err.code` rather than the message?**
SQLSTATEs are a stable, documented five-character contract; messages are prose that is
localised and changes between server versions. Code matching on message text breaks on
upgrade.

**★ Which errors should be retried automatically?**
`40001` serialization failure and `40P01` deadlock detected — both mean the transaction
can simply run again. Retry the whole transaction with exponential backoff and jitter.
Connection errors are retryable for reads; for writes only if the operation is
idempotent, since you cannot know whether it committed.

**★ What does a `42xxx` error tell you?**
That your SQL or your assumptions about the schema are wrong — undefined column, undefined
table, syntax error. It is a bug, so it deserves a 500 and an alert, never a 400. Measured
examples: `42703`, `42P01`, `42601`.

**How would you map SQLSTATE to HTTP status codes?**
`23505`/`23503` → 409, `23502`/`23514`/`22P02` → 400, `40001`/`40P01` → retry then 409,
`57014` → 504, `53300` → 503, everything else → 500. Keep it in one module and test it
against a real database.

**Is every rejected query a PostgreSQL error?**
No. Socket failures surface as Node errnos like `ECONNREFUSED`, and a client-side
`query_timeout` rejects with a plain message and no `code`. Validate the shape before
treating `code` as a SQLSTATE.

---

← [`pool.query` and placeholders](04-query-placeholders.md) · Next → [The result object](06-result-object.md)
