---
title: "Mapping snake_case columns to camelCase fields"
sidebar_label: "18 · snake_case to camelCase"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex41-shaping-mapping.mjs`.

**PostgreSQL folds unquoted identifiers to lower case, so `snake_case` is the
convention that survives contact with the database, and JavaScript wants
`camelCase`.** The rename has to happen somewhere. The only decision that matters
is that it happens in *one* place.

## Why the database side is not negotiable

An unquoted identifier is lower-cased before it is stored:

```sql
CREATE TABLE t (fullName text);      -- the column is actually "fullname"
SELECT fullName FROM t;              -- works: also folded to fullname
```

You can force the case with quotes — `CREATE TABLE t ("fullName" text)` — and then
every reference to it must be quoted forever, in every query, migration, index and
`psql` session. Miss one and you get `42703`. That is why `snake_case` is
universal in PostgreSQL: it is the only convention where the identifier you type is
the identifier you get.

## The three places it can happen

```console
$ node ex41-shaping-mapping.mjs
=== 6. the three places the rename can happen ===
all three identical? true

median of 5 runs over 20000 rows:
  (a) alias in SQL         33.2 ms
  (b) explicit JS map      31.6 ms
  (c) generic JS map       75.3 ms
```

**(a) Alias in SQL**

```sql
SELECT id, customer_name AS "customerName", order_total AS "orderTotal"
  FROM s_orders
```

**(b) An explicit mapper in JS**

```js
rows.map((r) => ({
  id: r.id, customerName: r.customer_name, orderTotal: r.order_total,
}));
```

**(c) A generic key rewriter**

```js
const camel = (s) => s.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
rows.map((r) => Object.fromEntries(
  Object.entries(r).map(([k, v]) => [camel(k), v])));
```

Identical output. (a) and (b) are effectively tied — 33.2 ms and 31.6 ms, a
difference inside the noise. **(c) is 2.3× slower than either**, because it
allocates an entries array and a new object per row and runs a regex per column.
At 20 000 rows that is 44 ms of pure overhead for the convenience of not naming
fields.

That is the measured argument against the generic approach, and there is a bigger
non-measured one below.

## The trap in the SQL alias

A quoted alias is a quoted identifier, with everything that implies:

```console
=== 7. what a quoted alias costs you afterwards ===
unquoted reference to the alias → 42703 column "customername" does not exist
ORDER BY the unquoted alias    → 42703 column "customername" does not exist
ORDER BY "customerName"        → ok: { customerName: 'customer 1' }
```

Once you alias to `"customerName"`, every later reference in that query must be
quoted too. The error is `42703 column "customername" does not exist` — note the
folded lower case in the message, which is the clue to what happened.

In a query built dynamically this is a real hazard: the sort allowlist from
[Sort and filter allowlists](./allowlists/) now has to emit quoted identifiers
consistently with the `SELECT` list, and a single unquoted one fails at runtime for
one particular sort column.

**So aliasing is fine for a fixed `SELECT` list and awkward for a dynamic one.**

## Why the generic rewriter is the wrong default

Speed is the smaller objection. The real one is that it is not a mapping, it is a
*rule* — and it publishes every column automatically.

- A column added by a migration appears in the API response the moment it exists,
  camel-cased. That is the same failure as `SELECT *`, described in
  [Rows to domain objects](./01-repository/02-rows-to-domain.md).
- The transformation is lossy in both directions. `user_id` → `userId` → back to
  `user_id` works, but `api_key` → `apiKey` → `api_key` and `oauth2_token` →
  `oauth2Token` → `oauth_2_token` do not round-trip. Anything that reverses the
  mapping — a sort parameter, a filter field — breaks on exactly the columns with
  digits or acronyms.
- It applies to nested objects only if you write it to, and then it rewrites keys
  inside `jsonb` payloads that were never column names.

An explicit mapper has none of these, costs the same, and is an allowlist by
construction.

## Doing it globally in the driver

`pg` can rename for you, which looks like the one-place solution:

```js
import pg from 'pg';
// applies to EVERY query in the process
pg.types.setTypeParser(...);           // types, not names
```

Name mapping is not a type parser — `pg` has no built-in column renaming, so this
is usually done with a wrapper around `query()` or with `rowMode: 'array'` plus
`result.fields`. Either way, doing it at the driver level means it applies to
every query in the process, including ones where you did not want it: aggregate
results, `EXPLAIN` output, catalog queries against `pg_stat_activity`, and
migration tooling sharing the pool.

Keep the rename in the repository's mapper, where it applies to the queries you
chose.

## One place, and which place

All of the above converges on the same answer as
[Rows to domain objects](./01-repository/02-rows-to-domain.md): the repository's
`toDomain` function is where the rename happens, alongside the `SELECT` list it
depends on.

That gives you:

- one direction of translation, in one file per resource;
- a mapper that is an allowlist, so new columns are private until published;
- SQL that stays unquoted and greppable — searching for `customer_name` finds the
  column in queries, migrations and the mapper.

And the reverse direction — a client sending `?sort=customerName` — is a lookup in
the same module, not an algorithm:

```js
const SORTABLE = {customerName: 'customer_name', orderTotal: 'order_total'};
```

A map rather than a `camelToSnake()` function, for the round-tripping reason above,
and because it is the allowlist the sort parameter needed anyway.

## Trade-off

An explicit mapper is boilerplate proportional to your column count, and it is the
thing people most want to automate. Automating it is exactly what turns the schema
into the API contract: the generic rewriter means every column is public and every
rename is a breaking change nobody reviewed.

The middle position that holds up in practice: explicit mappers for resources the
API exposes, and the generic rewriter — if you want it — only for internal tooling
where the schema *is* the contract and nobody is promised stability.

## Gotchas

**Symptom:** `42703 column "customername" does not exist`
**Cause:** A quoted alias referenced without quotes later in the same query;
PostgreSQL folded it to lower case.
**Fix:** Quote every reference, or do not alias — rename in JavaScript.

**Symptom:** A column created as `fullName` cannot be found as `fullName`
**Cause:** Unquoted identifiers are folded at creation; the column is `fullname`.
**Fix:** Use `snake_case` in the database.

**Symptom:** A new column appears in API responses uninvited
**Cause:** A generic key rewriter publishes whatever the query returned.
**Fix:** An explicit mapper, which names the fields it exposes.

**Symptom:** `?sort=apiKey` fails while `?sort=customerName` works
**Cause:** An algorithmic camel→snake reverse mapping; `apiKey` does not round-trip
to `api_key`.
**Fix:** A lookup map, which is also the sort allowlist.

**Symptom:** Serialising large result sets is slower than expected
**Cause:** The generic rewriter allocates an entries array and object per row.
Measured: 75.3 ms vs 31.6 ms over 20 000 rows.
**Fix:** An explicit mapper.

**Symptom:** Keys inside a `jsonb` column get renamed
**Cause:** A recursive generic rewriter cannot tell column names from payload keys.
**Fix:** Rename at the column level only.

## Interview questions

**★ Why are PostgreSQL columns `snake_case`?**
Because unquoted identifiers are folded to lower case, so `fullName` becomes
`fullname`. Preserving case requires quoting the identifier everywhere forever, and
missing one quote gives `42703`. `snake_case` is the convention where what you type
is what you get.

**★ Where should the rename to camelCase happen?**
In one place — the repository's row→domain mapper, next to the `SELECT` list it
depends on. That keeps SQL unquoted and greppable, and makes the mapper an
allowlist so new columns are not published automatically.

**★ What is wrong with a generic snake→camel rewriter?**
It publishes every column the query returns, so a migration changes the API. It
does not round-trip — `api_key` → `apiKey` → `api_key` fails on anything with
digits or acronyms — so reverse mapping for sort and filter parameters breaks. And
measured, it is 2.3× slower than an explicit mapper: 75.3 ms against 31.6 ms over
20 000 rows.

**★ What happens if you alias columns in SQL instead?**
It works and is as fast as mapping in JS — 33.2 ms against 31.6 ms. But the alias
is a quoted identifier, so every later reference in that query must be quoted:
measured, `ORDER BY customerName` failed with `42703 column "customername" does not
exist`. Fine for a fixed `SELECT` list, awkward for a dynamically built one.

**How do you map a client's `?sort=customerName` back to a column?**
With a lookup map, not an algorithm — the reverse transformation is not reliable,
and you need the allowlist anyway to keep identifiers out of the SQL.

---

← [created_at and updated_at](17-timestamps-trigger.md) · Next → [Phase index](README.md)
