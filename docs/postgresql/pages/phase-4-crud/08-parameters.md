---
title: "Parameterized queries"
sidebar_label: "08 · Parameters"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex5-filter-sort.mjs`,
> `ex2-ddl-edges.mjs`, `ex8-bulk-and-seed.mjs`.

**Every value a user supplies goes in as `$1`, never into the SQL string. Parameters are
not escaping — the value is sent separately from the statement and can never become
part of it. That guarantee does not extend to identifiers, and that gap is where the
remaining injections live.**

## The attack, measured

A sort field concatenated into the SQL text, and a request that abuses it:

```console
$ node ex5-filter-sort.mjs
=== 2. concatenated ORDER BY — the injection ===
?sort=name → Banana, Elderberry, apple
?sort=name; DROP TABLE fs_items CASCADE; --
  → 2 statements executed
fs_items after that request: GONE
(table was dropped — rebuilt and reseeded)
```

One HTTP request destroyed the table. The same payload as a parameter:

```console
=== 3. the same payload as a parameter ===
rows: 0 | table still there: fs_items
```

Zero rows — the string was compared against a column as data, matched nothing, and the
table survived.

## Why parameters are safe

Not because anything is escaped. Because of the wire protocol. With no parameters, `pg`
uses the **simple query protocol**: the string is a script and may contain several
statements. Supply a parameter array and it switches to the **extended query protocol**,
which parses the statement first, then binds values to already-compiled placeholders.

The statement's shape is fixed before your data is ever looked at, so a value cannot
introduce syntax. It cannot end a string, add a clause, or start a second statement — and
PostgreSQL refuses multi-statement text outright once parameters are involved:

```console
$ node ex2-ddl-edges.mjs
=== A. multi-statement with an empty params array ===
empty array → array of 2
non-empty array → 42601 | cannot insert multiple commands into a prepared statement
```

**`42601` is the guarantee, enforced by the server.** Note the first line: an *empty*
array still uses the simple protocol and happily runs two statements. `[]` is not the
same protection as `[value]`.

```js
await pool.query(`SELECT * FROM t WHERE name = $1`, [userInput]);   // ✓ extended
await pool.query(`SELECT * FROM t WHERE name = '${userInput}'`);    // ✗ simple
```

## Parameters cannot be identifiers

This is the part people get wrong, and it fails **silently**:

```console
=== 1. ORDER BY $1 ===
ORDER BY $1 with "name" → apple, Banana, cherry, date, Elderberry, fig
ORDER BY $1 with "price" → apple, Banana, cherry, date, Elderberry, fig
identical: true — the parameter is a constant, not a column reference
...and it raises no error, so nothing tells you it did not work
```

Both orderings identical, no error. `ORDER BY $1` sorts by a **constant string** — the
literal `'name'`, the same for every row — so the sort is a no-op. Sorting appears to
work in tests (rows come back in some order) and quietly does nothing in production.

The same applies everywhere an identifier belongs: table names, column names, `ASC`/`DESC`,
schema names. Parameters are for **values only**.

## Handling dynamic identifiers

**Allowlist first.** Map user input to a known-safe identifier and reject everything
else:

```console
=== 6. allowlist ===
sort=price asc  → fig, apple, cherry, Elderberry
sort=name desc  → fig, date, cherry, apple
sort=<payload>  → rejected before SQL: 400 unsortable field: name; DROP TABLE fs_items; --
```

```js
const SORTABLE = {name: 'name', price: 'price', created: 'created_at'};
const DIRECTIONS = {asc: 'ASC', desc: 'DESC'};

const col = SORTABLE[req.query.sort];
const dir = DIRECTIONS[req.query.dir] ?? 'ASC';
if (!col) return res.status(400).json({error: `unsortable field: ${req.query.sort}`});

const {rows} = await pool.query(
  `SELECT id, name, price FROM fs_items ORDER BY ${col} ${dir} LIMIT $1`, [limit]);
```

The interpolated text comes from your own object's values, never from the request. User
input only ever selects a key. Details in
[Allowlists](../phase-9-api-crud/allowlists/).

**When the identifier is genuinely unknown** — a migration tool, an admin console over
arbitrary tables — quote it server-side with `%I`:

```console
=== 7. format/quote_ident for a genuinely dynamic identifier ===
{
  a: 'name',
  b: '"name; DROP TABLE fs_items; --"',
  c: 'ORDER BY "name; DROP TABLE fs_items; --"'
}
```

`format('%I', …)` wrapped the payload in double quotes, turning it into a single
(nonexistent) column name rather than executable syntax. The statement then fails with
"column does not exist" — an error, not a dropped table. `%L` does the same for literals,
`%s` does nothing and is the one to avoid.

## Parameters do not stop wildcard abuse

A parameter guarantees the value stays data. It does not guarantee the value is *harmless*
to the operator consuming it:

```console
=== 5. wildcards inside the search term ===
term "an"  → Banana
term "%"   → apple, Banana, cherry, date, Elderberry, fig   ← matches everything
term "_"   → apple, Banana, cherry, date, Elderberry, fig   ← matches everything
term "%" escaped → (none)
term "_" escaped → (none)
```

Searching for `%` returned the entire table. That is not SQL injection — it is `LIKE`
doing its job on a wildcard that arrived as data. On a large table it is a cheap way to
force a full scan. Escape the wildcards when the user means them literally:

```sql
WHERE name ILIKE '%' || replace(replace($1, '%', '\%'), '_', '\_') || '%'
```

## Type inference and casts

PostgreSQL infers each parameter's type from context. When there is no context, it cannot:

```sql
SELECT * FROM t WHERE ($1::text IS NULL OR name = $1);   -- cast required
SELECT * FROM t WHERE id = ANY($1::int[]);               -- array parameter
```

`pg` sends most parameters as text and lets the server coerce them. `null` becomes SQL
`NULL`; `undefined` also becomes `NULL`, which is worth knowing because a typo in a
property name silently becomes `NULL` rather than an error.

Passing an array to `= ANY($1)` is the clean way to handle `IN` lists — one parameter for
any number of values, instead of generating `$1, $2, … $n`:

```js
await pool.query(`SELECT * FROM t WHERE id = ANY($1::int[])`, [[1, 2, 3]]);
```

It also sidesteps the `NOT IN` NULL trap ([`WHERE` predicates](02-where-predicates.md))
and the parameter ceiling below.

## The 65 535 parameter ceiling

```console
$ node ex8-bulk-and-seed.mjs
=== 2. how many parameters can one statement take? ===
21845 rows → ok (65535 params)
21846 rows → 08P01 bind message has 2 parameter formats but 0 parameters
```

The protocol stores the parameter count in 16 bits. Chunk large inserts, or pass arrays
and expand them with `unnest` ([`VALUES` and `unnest`](19-values-unnest.md)).

## Placeholders are positional, not named

`pg` has no named parameters. `$1` is the first element of the array, and reusing `$1`
several times in one statement is fine and passes the value once:

```js
await pool.query(
  `UPDATE t SET a = $2, b = $2, updated_by = $1 WHERE owner = $1`, [userId, value]);
```

Off-by-one errors here are common when a clause is added in the middle. If you find
yourself renumbering placeholders by hand, build the statement and its parameter array
together in one pass — [Safe dynamic `WHERE`](../phase-9-api-crud/safe-dynamic-where/).

## Trade-off

Parameters cost nothing in safety terms and are strictly faster on repeated statements,
since the server can reuse a plan ([Prepared statements](../phase-7-pg-driver/10-prepared.md)).
The only friction is that they are values-only, so any dynamic *structure* — sort column,
table name, optional filters — needs an allowlist or `%I`, which is more code than string
concatenation.

That extra code is the entire defence. Measured above: without it, one query-string
parameter dropped a table.

## Gotchas

**Symptom:** Sorting silently does nothing
**Cause:** `ORDER BY $1` sorts by a constant — measured, two different sort fields
produced identical output with no error.
**Fix:** Allowlist the column and interpolate your own constant.

**Symptom:** `42601 cannot insert multiple commands into a prepared statement`
**Cause:** Several statements in one `query()` call with parameters.
**Fix:** Split them into separate calls, or use a transaction. This error is the
protection working.

**Symptom:** A multi-statement string ran even though a parameter array was passed
**Cause:** The array was **empty** — `[]` keeps the simple protocol. Measured, two
statements executed.
**Fix:** Do not pass user input into statement text at all; there is no safe empty-array
case.

**Symptom:** `could not determine data type of parameter $1`
**Cause:** No context to infer from, typically `$1 IS NULL`.
**Fix:** Cast explicitly: `$1::text`.

**Symptom:** A search for `%` returns every row
**Cause:** `LIKE`/`ILIKE` wildcards arriving as data. Parameters do not neutralise them.
**Fix:** Escape `%` and `_` when the user means them literally.

**Symptom:** `08P01 bind message has 2 parameter formats but 0 parameters`
**Cause:** More than 65 535 parameters — measured at 21 846 rows × 3 columns.
**Fix:** Chunk, or pass arrays and `unnest`.

**Symptom:** A column is set to `NULL` unexpectedly
**Cause:** `undefined` in the values array — a misspelled property — becomes `NULL`.
**Fix:** Validate the input object before building the array.

**Symptom:** An ORM's "raw query" helper is still injectable
**Cause:** Some helpers interpolate rather than parameterize.
**Fix:** Check which one you are calling — in most drivers the tagged-template form is
safe and the plain string-argument form is not.

## Interview questions

**★ Why are parameterized queries safe? Is it escaping?**
No. With parameters the driver uses the extended query protocol: the statement is parsed
and planned before any value is bound, so a value cannot alter the statement's structure.
The server enforces it — measured, a multi-statement string with parameters fails with
`42601 cannot insert multiple commands into a prepared statement`, while the same payload
concatenated into the SQL executed two statements and dropped a table.

**★ Why can't you parameterize a column name in `ORDER BY`?**
Because parameters carry values, and an identifier is part of the statement's structure,
which is fixed at parse time. `ORDER BY $1` sorts every row by the same constant string —
measured, sorting by `name` and by `price` returned identical output with no error raised.
Use an allowlist, or `format('%I', …)` when the identifier is genuinely dynamic.

**★ How do you safely support user-chosen sort columns?**
Map the input through an object whose values are hard-coded identifiers, reject anything
not in it, then interpolate your own value. User input selects a key; it never reaches
the SQL. Measured: the injection payload was rejected with a 400 before any SQL ran.

**★ Do parameters protect against every kind of injection?**
They protect the statement's structure. They do not change how an operator interprets the
value — a `%` in a `LIKE` parameter still matches everything, measured returning the whole
table. Escape wildcards, cap result sizes, and validate ranges separately.

**What is the maximum number of parameters in one statement?**
65 535, because the protocol stores the count in 16 bits — measured, 21 845 rows × 3
columns succeeded and one more row failed with `08P01`. Chunk, or pass one array per
column and expand with `unnest`.

**Does passing an empty array make a query safe?**
No. An empty array leaves `pg` on the simple query protocol, where multi-statement text
still executes — measured, two statements ran. Safety comes from values being bound, not
from the argument being present.

---

← [`UPDATE`](07-update.md) · Next → [Logical query processing order](09-logical-order.md)
