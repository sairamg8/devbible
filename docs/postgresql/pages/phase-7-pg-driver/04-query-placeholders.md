---
title: "pool.query and placeholders"
sidebar_label: "04 · query and placeholders"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex21-types-prepared.mjs`,
> `ex5-filter-sort.mjs`, `ex8-bulk-and-seed.mjs`.

**`pool.query(text, values)` — the text holds `$1`, `$2`, the values array holds the
data, and the two never meet in a string. This page is the driver's API surface; the
security argument lives elsewhere and is worth reading first.**

> **Why placeholders are safe** — the protocol switch, the measured injection that
> dropped a table, identifiers that cannot be parameterized, and wildcard abuse — is
> [Parameterized queries](../phase-4-crud/08-parameters.md) in Phase 4, with the Node
> framing in
> [Parameterized queries](/docs/nodejs/pages/phase-6-data-access/parameterized-queries).
> This page assumes you have read one of them.

## The three call shapes

```js
// 1. text only
await pool.query('SELECT now()');

// 2. text + values — the one you use for anything with input
await pool.query('SELECT * FROM users WHERE email = $1', [email]);

// 3. config object — needed for names, row modes and per-query timeouts
await pool.query({
  text: 'SELECT * FROM users WHERE email = $1',
  values: [email],
  name: 'find-user',          // prepared statement — see page 10
  rowMode: 'array',           // rows as arrays instead of objects
  types: customTypeParsers,   // per-query parsing — see page 09
});
```

All three return the same `Result` ([The result object](06-result-object.md)). The
callback form (`pool.query(text, values, cb)`) still exists; there is no reason to use it
in new code.

## Placeholders are positional and 1-based

```js
await pool.query(
  `UPDATE t SET a = $2, b = $2, updated_by = $1 WHERE owner = $1`,
  [userId, value],
);
```

`$1` is `values[0]`. A placeholder may repeat — the value is sent once and referenced
twice. Numbering must be contiguous from `$1`; skipping a number is an error, and passing
more values than the text references is silently ignored, which hides typos.

The failure mode to know is renumbering: inserting a clause in the middle means shifting
every later `$n` and the array to match. When that starts happening, build the fragments
and the parameter array together rather than by hand —
[Safe dynamic `WHERE`](../phase-9-api-crud/safe-dynamic-where/).

## `null` and `undefined` both become SQL `NULL`

```js
await pool.query('INSERT INTO t (a) VALUES ($1)', [undefined]);   // inserts NULL
```

There is no error for a missing property, so `[body.naem]` inserts `NULL` instead of
failing. Validate the object before you build the array.

## Lists: one parameter, not `n`

```js
await pool.query('SELECT * FROM t WHERE id = ANY($1::int[])', [[1, 2, 3]]);
```

`pg` maps a JavaScript array to a PostgreSQL array, so `= ANY($1)` replaces a generated
`IN ($1, $2, … $n)`. It keeps the statement text constant regardless of list length —
better for the plan cache — and sidesteps both the `NOT IN` null trap
([`WHERE` predicates](../phase-4-crud/02-where-predicates.md)) and the parameter ceiling:

```console
$ node ex8-bulk-and-seed.mjs
=== 2. how many parameters can one statement take? ===
21845 rows → ok (65535 params)
21846 rows → 08P01 bind message has 2 parameter formats but 0 parameters
```

For writes, the same idea is `unnest` with one array per column
([`VALUES` and `unnest`](../phase-4-crud/19-values-unnest.md)).

## Casts you will need

PostgreSQL infers a parameter's type from context. Where there is no context, say so:

```sql
WHERE ($1::text IS NULL OR name = $1)   -- otherwise: could not determine data type
WHERE id = ANY($1::int[])               -- array parameters always need the cast
```

## Identifiers are not parameters

```console
$ node ex5-filter-sort.mjs
=== 1. ORDER BY $1 ===
ORDER BY $1 with "name" → apple, Banana, cherry, date, Elderberry, fig
ORDER BY $1 with "price" → apple, Banana, cherry, date, Elderberry, fig
identical: true — the parameter is a constant, not a column reference
```

`ORDER BY $1` sorts every row by the same constant string and raises no error. Column
names, table names and sort direction need an allowlist — full treatment in
[Parameterized queries](../phase-4-crud/08-parameters.md) and
[Allowlists](../phase-9-api-crud/allowlists/).

## One statement per call

```console
$ node ex21-types-prepared.mjs
=== 6. multi-statement behaviour ===
with params→ 42601 cannot insert multiple commands into a prepared statement
```

Once values are supplied, the statement must be singular. That restriction is a feature —
it is what makes stacked-statement injection impossible — and it is covered in
[One query, one statement](12-one-statement.md).

## Trade-off

Positional placeholders are simple, fast and universally supported, and they cost
readability: `$7` says nothing about what it holds, and reordering a clause means
renumbering. Drivers with named parameters or tagged templates
([pg vs postgres.js](16-postgres-js.md)) trade that ergonomics win for a different
abstraction to learn.

`pg`'s position is deliberate — it is a thin protocol client, so `$n` is what the wire
protocol uses, unchanged. Query builders sit on top when you want more.

## Gotchas

**Symptom:** `could not determine data type of parameter $1`
**Cause:** No context to infer from, typically `$1 IS NULL`.
**Fix:** Cast: `$1::text`.

**Symptom:** A column is `NULL` and no error was raised
**Cause:** `undefined` in the values array from a misspelled property.
**Fix:** Validate the input object first.

**Symptom:** Sorting silently does nothing
**Cause:** `ORDER BY $1` — a parameter cannot be an identifier.
**Fix:** Allowlist the column name.

**Symptom:** `bind message supplies 3 parameters, but prepared statement requires 2`
**Cause:** Array length and `$n` count disagree, usually after editing the SQL.
**Fix:** Build text and values together.

**Symptom:** `08P01` on a large batch
**Cause:** Over 65 535 parameters.
**Fix:** `unnest`, or chunk.

**Symptom:** `42601 cannot insert multiple commands into a prepared statement`
**Cause:** Two statements in one parameterized call.
**Fix:** Separate calls, or a transaction.

## Interview questions

**★ What are the ways to call `pool.query`?**
`query(text)`, `query(text, values)`, and `query(configObject)`. The object form is
required for `name` (prepared statements), `rowMode: 'array'`, and per-query type
parsers. All return the same `Result`.

**★ How do you pass a variable-length list of ids?**
`WHERE id = ANY($1::int[])` with a JavaScript array. One parameter regardless of length,
so the statement text — and therefore the cached plan — stays constant, and it avoids
both the 65 535-parameter ceiling and `NOT IN`'s null behaviour.

**★ What happens if you pass `undefined` as a parameter?**
It becomes SQL `NULL`, silently — the same as `null`. A typo in a property name therefore
writes `NULL` rather than raising, which is why input validation belongs before the query.

**Can `$1` appear more than once in a statement?**
Yes. Placeholders are positional references, so repeating `$1` reuses the same value and
sends it once.

---

← [Connection configuration](03-connection-config.md) · Next → [Errors from PostgreSQL in Node](05-errors.md)
