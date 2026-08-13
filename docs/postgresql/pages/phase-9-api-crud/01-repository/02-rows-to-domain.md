---
title: "Rows to domain objects"
sidebar_label: "02 · Rows to domain"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex38-repository.mjs`.

**A row from `pg` is not your domain object, and the gap is bigger than the column
names.** Types change on the way out, a missing row is not an error, and
`rowCount` does not mean what it looks like it means.

## What actually comes back

`INSERT ... RETURNING` on a table with a bigint identity, text, int and
timestamptz:

```console
$ node ex38-repository.mjs
=== 3. create via INSERT ... RETURNING ===
raw row  : {
  id: '2',
  email: 'grace@x.com',
  full_name: 'Grace Hopper',
  age: 45,
  created_at: 2026-08-13T07:56:00.580Z
}
col types: {
  id: 'String',
  email: 'String',
  full_name: 'String',
  age: 'Number',
  created_at: 'Date'
}
```

**`id` is a `String`.** It is a `bigint` in PostgreSQL, whose range exceeds
`Number.MAX_SAFE_INTEGER`, so `pg` refuses to silently lose precision and hands
back the decimal text instead. `age` is an `int` and fits, so it arrives as a
`Number`. `created_at` becomes a JavaScript `Date`.

This is the single most common source of "why did my comparison fail":

```js
row.id === 2        // false — '2' is not 2
row.id == 2         // true, but now you are relying on coercion
Number(row.id)      // fine here, wrong for ids past 2^53
```

Treat ids as opaque strings all the way to the client. They are identifiers, not
quantities; nothing in an API should be doing arithmetic on them. The full
type→JS mapping for every PostgreSQL type is in
[Phase 7 · Type parsing](../../phase-7-pg-driver/08-type-parsing.md).

## The mapping function

```js
const toDomain = (row) => ({
  id: String(row.id),               // bigint arrives as a string
  email: row.email,
  fullName: row.full_name,
  age: row.age,
  createdAt: row.created_at.toISOString(),
});
```

```console
domain   : {
  id: '2',
  email: 'grace@x.com',
  fullName: 'Grace Hopper',
  age: 45,
  createdAt: '2026-08-13T07:56:00.580Z'
}
```

Three things happen here and each is a decision:

1. **`full_name` → `fullName`.** Where this belongs is its own topic —
   [snake_case to camelCase](../18-snake-camel.md) — and the answer is *exactly
   one place*, which is this function.
2. **`created_at` → an ISO string.** A `Date` serialises to ISO through
   `JSON.stringify` anyway, but doing it explicitly means the repository's output
   is already the API's contract, not something that happens to serialise
   correctly today.
3. **Nothing else is exposed.** The mapper is an allowlist by construction: a
   column added to the table later does not appear in responses until someone
   adds it here. That is the property that stops a `password_hash` column
   leaking the day it is added.

## A missing row is not an error

```console
=== 2. findById on a missing id — what the driver actually returns ===
rowCount      : 0
rows          : []
rows[0]       : undefined
typeof rows[0]: undefined
rows[0] ?? null: null
did it throw? : no — zero rows is a success
```

A `SELECT` that matches nothing is a completely successful query. `pg` does not
throw, `rows` is an empty array, and `rows[0]` is `undefined`. Every repository
read therefore ends in the same shape:

```js
export const findById = async (db, id) => {
  const {rows} = await db.query(
    `SELECT id, email, full_name, age, created_at FROM r_users WHERE id = $1`, [id]);
  return rows[0] ? toDomain(rows[0]) : null;
};
```

Returning `undefined` and returning `null` are not the same to a JSON serialiser —
`JSON.stringify({user: undefined})` drops the key entirely, while `null` survives.
Normalising to `null` at this boundary means the API shape does not depend on
whether a row was found. Whether `findById` should return `null` at all, or throw
a `NotFound`, is [its own topic](../07-find-by-id.md).

## `rowCount` is not `rows.length`

They agree for `SELECT`, and diverge everywhere it matters:

| Statement | `rowCount` | `rows.length` |
|---|---|---|
| `SELECT` matching 3 rows | 3 | 3 |
| `SELECT` matching nothing | 0 | 0 |
| `UPDATE ... WHERE` matching 3, no `RETURNING` | 3 | 0 |
| `INSERT ... RETURNING` one row | 1 | 1 |
| `INSERT` without `RETURNING` | 1 | 0 |

**`rowCount` is how many rows the statement affected; `rows` is what it sent
back.** For writes you almost always want `rowCount` — it is the only signal a
non-`RETURNING` write gives you, and it is what
[optimistic concurrency](../13-optimistic.md) is built on. For reads you want
`rows`.

The trap in the other direction: `rowCount` is `null`, not `0`, for statements
that do not report a count — `CREATE TABLE`, `BEGIN`, `SET`. `if (!result.rowCount)`
treats a successful DDL statement as a failure.

## Where the mapper goes

Put `toDomain` in the repository module, not in the controller and not in a
shared "models" package.

The reason is that the mapper and the `SELECT` list are one unit: the mapper can
only produce what the query selected, and every change to one requires a change to
the other. Splitting them across files means a column added to the `SELECT` and
forgotten in the mapper — or worse, a mapper reading `row.deleted_at` from a query
that never selected it, which is `undefined` rather than an error.

Keeping them adjacent also means `SELECT *` is never tempting. The mapper names
every field it needs, so the query can too — and a query that names its columns
does not break when the table gains one, and does not silently collapse duplicate
column names in a join. That collapse is measured in
[Phase 7 · The result object](../../phase-7-pg-driver/06-result-object.md).

## Trade-off

Hand-written mappers are boilerplate, and there is a real argument for skipping
them: `pg` can be told to rename columns globally, or the query can alias them
(`full_name AS "fullName"`), and then rows are already domain-shaped.

What you give up is the boundary. With a mapper, the database schema and the API
response are two independent things and a migration cannot change the API by
accident. Without it, every column rename is an API change, and every new column
is a new public field. For an internal service with one consumer that is a fine
trade. For a public API it is the thing that eventually leaks a column somebody
assumed was private.

The middle position that holds up: alias in SQL for the *shape*, keep a mapper for
the *contract*, and accept that the mapper is mostly one-to-one. It is boilerplate
that only earns its keep on the day the schema and the API need to disagree — but
on that day it is the difference between a migration and an API version.

## Gotchas

**Symptom:** `row.id === 2` is `false` even though the row is there
**Cause:** `bigint` arrives as a `String` — `pg` will not silently lose precision
past `Number.MAX_SAFE_INTEGER`.
**Fix:** Compare as strings and keep ids opaque. `Number()` is safe only while ids
stay under 2^53, which is not a property you can rely on later.

**Symptom:** A key vanishes from the JSON response
**Cause:** The repository returned `rows[0]`, which is `undefined` for a missing
row, and `JSON.stringify` drops `undefined` values.
**Fix:** `return rows[0] ?? null`.

**Symptom:** An `UPDATE` "returned no rows" but did change data
**Cause:** Reading `rows.length` on a statement with no `RETURNING`.
**Fix:** Use `rowCount` for writes; add `RETURNING` if you need the data back.

**Symptom:** `if (!result.rowCount) throw ...` fires after a successful `CREATE TABLE`
**Cause:** `rowCount` is `null` for statements that do not report one.
**Fix:** Compare explicitly — `result.rowCount === 0` — rather than testing
truthiness.

**Symptom:** A newly added column appears in API responses without anyone adding it
**Cause:** `SELECT *` plus no mapper, so the response is whatever the table
currently has.
**Fix:** Name columns in the query and in the mapper. Both are allowlists.

## Interview questions

**★ Why does `pg` return bigint columns as strings?**
Because `bigint` is 64-bit and JavaScript numbers lose integer precision past
2^53. Returning a string is lossless and forces the caller to decide; returning a
number would silently corrupt large ids. Measured: an identity `id` came back as
`'2'` with constructor `String`, while an `int` column came back as a `Number`.

**★ What does `pg` do when a `SELECT` matches no rows?**
Nothing special — it is a successful query with `rowCount: 0` and `rows: []`, so
`rows[0]` is `undefined`. It does not throw. Any "not found" behaviour is
something the repository adds.

**★ What is the difference between `rowCount` and `rows.length`?**
`rowCount` is how many rows the statement affected, `rows` is what it returned.
They match for `SELECT`, but an `UPDATE` without `RETURNING` has a `rowCount` of 3
and a `rows.length` of 0. `rowCount` is also `null` — not `0` — for statements
like `CREATE TABLE` that report no count.

**Why keep the row→domain mapper next to the query?**
Because the mapper can only read what the query selected, so they change together.
Separating them produces mappers reading fields the query never returned, which is
`undefined` rather than an error. Keeping them adjacent also removes the reason to
write `SELECT *`.

**What does the mapper protect you from?**
It makes the API response an explicit allowlist rather than a reflection of the
table. A column added by a migration does not become a public field until someone
adds it to the mapper — which is the difference between a schema change and an
unplanned disclosure.

---

← [The executor contract](01-the-executor-contract.md) · Next → [Errors to HTTP status codes](03-errors-to-http.md)
