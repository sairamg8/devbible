---
title: "One query, one statement"
sidebar_label: "12 · One statement"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex21-types-prepared.mjs`,
> `ex2-ddl-edges.mjs`.

**`pg` will run several statements in one call — but only when there are no parameters.
That restriction is not a limitation to work around; it is the mechanism that makes
stacked-statement injection impossible.**

## Two protocols, two behaviours

```console
$ node ex21-types-prepared.mjs
=== 6. multi-statement behaviour ===
no params  → Array of 2 results; last: [ { b: 2 } ]
empty array→ no error; Array of 2 ← [] still uses the simple protocol
with params→ 42601 cannot insert multiple commands into a prepared statement
```

- **No values argument** → the **simple query protocol**. The string is treated as a
  script; several statements run and you get an **array of `Result` objects**.
- **A values argument** → the **extended query protocol**. Exactly one statement is
  permitted; anything else is `42601`.

That `42601` is the guarantee that a parameter can never introduce a second statement —
the full argument, with the measured injection it prevents, is
[Parameterized queries](../phase-4-crud/08-parameters.md).

## An empty array is not protection

```console
empty array→ no error; Array of 2 ← [] still uses the simple protocol
```

Passing `[]` looks parameterized and is not. `pg` switches protocols based on whether a
values argument is *present and non-empty*, so `query(sql, [])` still executes a
multi-statement script. It is measured the same way in `ex2-ddl-edges.mjs`:

```console
$ node ex2-ddl-edges.mjs
=== A. multi-statement with an empty params array ===
empty array → array of 2
non-empty array → 42601 | cannot insert multiple commands into a prepared statement
```

The lesson is not "always pass a non-empty array" — it is that **safety comes from values
being bound, not from an argument being present.** Never build statement text from input,
in either protocol.

## The whole string is one implicit transaction

```console
2nd statement failed → 22P02
rows in m_t after the failure: 0 ← the whole string was one implicit transaction
```

```js
await pool.query(`INSERT INTO m_t VALUES (1); INSERT INTO m_t VALUES ('bad');`);
```

The first insert was valid, the second raised `22P02`, and **zero rows remained** — the
successful statement was rolled back with the failed one. PostgreSQL wraps a
multi-statement simple-query string in a single implicit transaction.

Useful when you want it, and surprising when you do not. If you need the statements to
commit independently, send them separately. If you need explicit control, write the
`BEGIN`/`COMMIT` yourself on a checked-out client
([`pool.connect` and release](07-connect-release.md)).

Note this differs from the same statements sent one at a time in autocommit, where the
first would have persisted.

## Reading the array of results

```js
const results = await pool.query(`SELECT 1 AS a; SELECT 2 AS b`);
// results is an Array, not a Result
results[0].rows;   // [{a: 1}]
results[1].rows;   // [{b: 2}]
```

Code written for the single-statement case does `results.rows` and gets `undefined`. It is
a genuinely confusing failure when a stray semicolon has crept into a query string — the
error appears far from its cause, as a missing property rather than a SQL error.

## Where multi-statement is legitimate

Schema work, where the input is a file you wrote and there are no parameters by
definition:

```js
const sql = await fs.readFile('migrations/003_add_orders.sql', 'utf8');
await pool.query(sql);          // several DDL statements, one implicit transaction
```

This is exactly how the migration runner in
[Schema and data from Node](../phase-8-schema-from-node/) applies files, and the implicit
transaction is a feature there: a migration that fails halfway leaves nothing behind,
because [PostgreSQL has transactional DDL](../phase-3-ddl/07-transactional-ddl.md).

The caveats for that use:

- **Some statements cannot run inside a transaction** — `CREATE INDEX CONCURRENTLY`,
  `VACUUM`, `ALTER TYPE … ADD VALUE` in older versions. Those must be sent alone, outside
  any transaction ([`CREATE INDEX CONCURRENTLY`](../phase-10-indexes/12-concurrently.md)).
- **Error attribution is poor.** You get one error for the file; `position` refers to the
  whole string. Splitting on `;` to report which statement failed is unreliable — a
  semicolon inside a string literal or a `$$`-quoted function body will break it.

## Everywhere else: one statement per call

```js
await client.query('BEGIN');
await client.query('INSERT INTO orders …', [userId]);
await client.query('INSERT INTO order_items …', [orderId]);
await client.query('COMMIT');
```

More round trips than one concatenated string, and worth it: every statement is
parameterized, each error is attributable, and the transaction boundary is explicit rather
than implied. When round trips genuinely matter, the answer is a **CTE** that does the
work in one *statement* ([`RETURNING`](../phase-4-crud/05-returning.md)), not several
statements in one string.

## Trade-off

Multi-statement calls save round trips and are the natural fit for applying a `.sql` file
atomically. They cost parameterization entirely — no values may be bound — plus poor error
attribution and a result shape that differs from every other query.

One statement per call costs a round trip each and buys parameters, precise errors, and a
consistent `Result`. That is the right default; the exception is schema files.

## Gotchas

**Symptom:** `42601 cannot insert multiple commands into a prepared statement`
**Cause:** Several statements plus a values array.
**Fix:** Separate calls. This error is the injection protection working.

**Symptom:** `result.rows` is `undefined`
**Cause:** A stray `;` made the call multi-statement, so the result is an array.
**Fix:** One statement per call; check for a trailing semicolon plus a second statement.

**Symptom:** A statement that succeeded was rolled back
**Cause:** A later statement in the same string failed, and the whole string is one
implicit transaction — measured, 0 rows remained.
**Fix:** Send them separately, or make the transaction explicit.

**Symptom:** `CREATE INDEX CONCURRENTLY` fails inside a migration file
**Cause:** It cannot run in a transaction block, and a multi-statement string is one.
**Fix:** Send it as its own call, outside any transaction.

**Symptom:** A migration runner reports the wrong failing statement
**Cause:** Splitting the file on `;`, which breaks on semicolons inside literals and
`$$`-quoted bodies.
**Fix:** Apply whole files and rely on the error's message, or use a real parser.

**Symptom:** A multi-statement string ran despite passing an array
**Cause:** The array was empty — measured, `[]` keeps the simple protocol.
**Fix:** Do not put input into statement text at all.

## Interview questions

**★ Why can't you use parameters with a multi-statement query?**
Because parameters put `pg` on the extended query protocol, which permits exactly one
statement per `Parse` — measured, the attempt fails with `42601`. That is precisely why
parameterized queries cannot be attacked with stacked statements: a value has no way to
introduce a second command.

**★ What does `pool.query` return for `'SELECT 1; SELECT 2'`?**
An array of `Result` objects, one per statement — measured, length 2. Code expecting a
single result reads `.rows` off the array and gets `undefined`, which is a common symptom
of an accidental semicolon.

**★ If the second statement in a multi-statement string fails, what happens to the first?**
It is rolled back. The whole string runs as one implicit transaction — measured, a valid
`INSERT` followed by a failing one left zero rows.

**★ Is passing an empty array a safe way to run a statement?**
No. `pg` chooses the protocol on whether values are present and non-empty, so `query(sql,
[])` still runs multi-statement text — measured, two statements executed. Safety comes
from binding values, not from the argument existing.

**When is multi-statement the right choice?**
Applying schema files, where there are no parameters and the implicit transaction gives
you an all-or-nothing migration. Watch for statements that cannot run in a transaction,
such as `CREATE INDEX CONCURRENTLY`.

---

← [Query timeouts](11-timeouts.md) · Next → [`pool.end`](13-pool-end.md)
