---
title: "The result object"
sidebar_label: "06 · The result object"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex20-driver.mjs`.

**`rows` and `rowCount` are what you use daily. `command`, `fields` and `rowMode` are
what you reach for when something is behaving oddly — including the case where
`SELECT *` silently drops columns.**

## What comes back

```console
$ node ex20-driver.mjs
=== 4. what a Result actually contains ===
keys           : command, rowCount, oid, rows, fields, _parsers, _types, RowCtor, rowAsArray, _prebuiltEmptyResultObject
command        : SELECT | rowCount: 1
fields         : id:20, email:25, age:23
rows           : [ { id: '1', email: 'a@x.com', age: 30 } ]
```

The five public ones:

| Property | Is |
|---|---|
| `rows` | Array of plain objects, keyed by output column name |
| `rowCount` | Rows affected or returned — `null` for statements that affect none |
| `command` | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `MERGE`… |
| `fields` | Column metadata: `name`, `dataTypeID`, and more |
| `oid` | Legacy; `0` in modern PostgreSQL. Ignore it |

Anything beginning with `_` is internal and not API.

## `rowCount` across statement types

```console
INSERT INTO    → command: INSERT  rowCount: 1
UPDATE w_users → command: UPDATE  rowCount: 1
DELETE FROM    → command: DELETE  rowCount: 1
CREATE TEMP    → command: CREATE  rowCount: null
SELECT no rows → rowCount: 0 | rows: [] | fields still present: 4
```

Three things follow:

- **`rowCount` is `null`, not `0`, for DDL.** `if (result.rowCount === 0)` and
  `if (!result.rowCount)` behave differently there; use `=== 0` when you mean "matched
  nothing".
- **`rowCount` is not `rows.length`.** An `UPDATE` without `RETURNING` reports
  `rowCount: 1` and `rows: []`. That is the normal way to check a write succeeded without
  paying to send the row back ([`RETURNING`](../phase-4-crud/05-returning.md)).
- **`fields` survives an empty result.** Zero rows still describes four columns, which is
  how you introspect a query's shape without any data.

`rowCount` counts rows the statement *acted on*, which is not always what a user would
count: an `UPDATE` setting a column to the value it already holds still counts the row,
and `MERGE` reports inserts, updates and deletes summed together
([`MERGE`](../phase-4-crud/13-merge/README.md)).

## `fields` and `dataTypeID`

```console
fields         : id:20, email:25, age:23
```

Each entry carries the column's name and its PostgreSQL type OID — `20` is `int8`, `25`
is `text`, `23` is `int4`. That OID is exactly what the driver looks up to decide how to
turn bytes into JavaScript values, which is why `id` arrived as the string `'1'`
([Type parsing](08-type-parsing.md)).

Useful in practice for building generic tooling — CSV export, admin tables, a
`describe`-style endpoint — without a second round trip to the catalog.

## `SELECT *` across a join loses columns

```console
SELECT * across a join → fields: id, name, id, name
  row object           : { id: 99, name: 'from_b' } ← two columns silently lost
  same, rowMode:array  : [ 1, 'from_a', 99, 'from_b' ] ← nothing lost
```

The server returned all four columns — `fields` proves it — but `rows` is an object
keyed by column name, and duplicate keys collapse. **The last column of each name wins**,
so `z_a.id` and `z_a.name` vanish with no error anywhere.

This is the concrete reason [The `SELECT` shape](../phase-4-crud/01-select-shape.md)
says to name your columns. Two fixes:

```sql
SELECT a.id AS a_id, a.name AS a_name, b.id AS b_id, b.name AS b_name FROM z_a a, z_b b;
```

```js
const r = await pool.query({text: 'SELECT * FROM z_a, z_b', rowMode: 'array'});
// rows are positional arrays; pair them with r.fields yourself
```

## `rowMode: 'array'`

```js
const r = await pool.query({text: 'SELECT id, name FROM t', rowMode: 'array'});
// r.rows → [[1, 'from_a'], [2, 'other']]
```

Rows come back as arrays instead of objects. Worth using when duplicate column names
matter, when exporting to a format that is positional anyway (CSV), or on very large
results where skipping object construction saves measurable time and memory. The cost is
that indexes replace names, so the code becomes position-dependent.

## Several statements return an array of results

```console
multi-statement → Array.isArray: true | length: 2 | last rows: [ { b: 2 } ]
```

`pool.query('SELECT 1 AS a; SELECT 2 AS b')` resolves to an **array of `Result`
objects**, not a single one. Code doing `result.rows` on that gets `undefined` — a
confusing failure if a stray semicolon crept into a statement. Only possible without
parameters; see [One query, one statement](12-one-statement.md).

## Reading it in practice

```js
// existence / 404
const {rows: [item], rowCount} = await pool.query(
  `UPDATE items SET qty = $2 WHERE id = $1 RETURNING id, qty`, [id, qty]);
if (rowCount === 0) return res.sendStatus(404);
res.json(item);

// a single scalar
const {rows: [{n}]} = await pool.query(`SELECT count(*)::int AS n FROM items`);

// did a write land, without returning the row
const {rowCount} = await pool.query(`UPDATE items SET seen = true WHERE id = $1`, [id]);
```

The `count(*)::int` cast is deliberate — `count()` returns `bigint`, which arrives as a
string.

## Trade-off

Objects keyed by column name are the ergonomic default and cost one object allocation per
row plus the silent duplicate-key collapse. `rowMode: 'array'` avoids both and costs
readability.

Returning rows at all is a choice: `RETURNING` gives you the data in the same round trip,
while omitting it and reading `rowCount` transfers nothing. On bulk statements that
difference is large.

## Gotchas

**Symptom:** Columns are missing from a joined `SELECT *`
**Cause:** Duplicate column names collapse in the row object — measured, `fields` listed
four, `rows[0]` had two.
**Fix:** Alias the columns, or `rowMode: 'array'`.

**Symptom:** `if (!result.rowCount)` treats a successful DDL statement as a failure
**Cause:** `rowCount` is `null` for `CREATE`/`DROP` — measured.
**Fix:** Compare `=== 0` explicitly.

**Symptom:** `rows` is empty after a successful `UPDATE`
**Cause:** No `RETURNING` clause. `rowCount` is the signal.
**Fix:** Add `RETURNING` if you need the row.

**Symptom:** `result.rows` is `undefined`
**Cause:** The statement string contained a semicolon and several commands, so the result
is an array of results.
**Fix:** One statement per call.

**Symptom:** `count(*)` string-concatenates in JavaScript
**Cause:** `bigint` arrives as a string.
**Fix:** `count(*)::int`.

**Symptom:** Numbers arrive as strings for `numeric` columns
**Cause:** Deliberate, to preserve precision.
**Fix:** [Type parsing](08-type-parsing.md) and
[Overriding type parsers](09-pg-types.md).

## Interview questions

**★ What is the difference between `rowCount` and `rows.length`?**
`rowCount` is how many rows the statement affected; `rows.length` is how many were sent
back. They differ whenever there is no `RETURNING` — measured, an `UPDATE` gave
`rowCount: 1` with `rows: []`. `rowCount` is also `null` for DDL, not `0`.

**★ Why can a joined `SELECT *` lose columns?**
Because `rows` are objects keyed by output column name, and a join can produce the same
name twice — the later one overwrites the earlier. Measured: `fields` listed
`id, name, id, name` while the row object held only `{ id: 99, name: 'from_b' }`. No error
is raised. Alias the columns or use `rowMode: 'array'`.

**★ What is `fields` for?**
Column metadata — name and `dataTypeID` (the PostgreSQL type OID) per output column. The
driver uses the OID to choose a parser; you can use it to build generic tooling, and it is
present even when zero rows come back.

**When would you use `rowMode: 'array'`?**
When duplicate column names must be preserved, when the destination is positional anyway
such as CSV export, or on very large results where avoiding one object per row saves time
and memory.

**What does `pool.query` resolve to for a multi-statement string?**
An array of `Result` objects, one per statement — measured, length 2. Only possible
without parameters, since parameterized calls reject multi-statement text.

---

← [Errors from PostgreSQL in Node](05-errors.md) · Next → [`pool.connect` and release](07-connect-release.md)
