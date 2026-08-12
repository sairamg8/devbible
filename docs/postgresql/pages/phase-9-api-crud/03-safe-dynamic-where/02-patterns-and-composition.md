---
title: "Pattern matching and composition"
sidebar_label: "02 · Patterns and composition"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex5-filter-sort.mjs`.

**Chapter 2 of [Safe dynamic `WHERE`](README.md).** Search terms are parameters and
still not safe from themselves — and how the filter builder joins the rest of the
endpoint.

## Wildcards inside the search term

`ILIKE` is the usual case-insensitive contains-search, and `%${term}%` is the usual
way to build it. Both are right; together they hand the user control of the pattern.

```js
const {rows} = await pool.query(
  `SELECT name FROM fs_items WHERE name ILIKE $1 ORDER BY id`,
  [`%${term}%`],
);
```

```console
=== 5. wildcards inside the search term ===
term "an"  → Banana
term "%"   → apple, Banana, cherry, date, Elderberry, fig   ← matches everything
term "_"   → apple, Banana, cherry, date, Elderberry, fig   ← matches everything
```

This is not an injection — the parameter is still a value — but it is a bug, and on
a large table it is a denial-of-service one: a single `%` turns an indexed prefix
search into a full scan returning every row. Escape the pattern metacharacters:

```js
const pattern = `%${term.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
const {rows} = await pool.query(
  `SELECT name FROM fs_items WHERE name ILIKE $1 ESCAPE '\\' ORDER BY id`,
  [pattern],
);
```

```console
term "%" escaped → (none)
term "_" escaped → (none)
```

Escape the backslash first — the character class `[\\%_]` handles all three in one
pass, so a term containing `\` cannot smuggle an escape through. Declaring
`ESCAPE '\'` explicitly is worth the noise: the default escape character is already
backslash, but `standard_conforming_strings` and nested quoting have historically
made that assumption fragile.

## Composing the parts

The filter builder is one half of a list endpoint. Sorting cannot use this
mechanism at all, because `ORDER BY` needs an identifier, and pagination adds two
more parameters on the end:

```js
export async function listItems(client, {filters, sort, limit = 20, offset = 0}) {
  const {sql, params} = buildList(filters);       // WHERE  — parameters
  const order = orderClause(sort);                // ORDER BY — allowlist, see 04
  params.push(limit, offset);
  const text = `${sql} ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const {rows} = await client.query(text, params);
  return rows;
}
```

`limit` and `offset` are values, so they are parameters like any other — pushing
them last keeps the numbering rule intact. `orderClause` returns vetted literal
text and contributes nothing to `params`. The full endpoint, including why `OFFSET`
is the wrong default, is in
[`list` with filtering, sorting and pagination](../02-list-endpoint.md).

## Trade-off

Hand-building predicates keeps the SQL visible, keeps the parameter list explicit,
and produces statements you can paste into `psql` unchanged. It costs boilerplate,
and the boilerplate grows with every filter — a resource with twelve optional
filters is a long, dull function.

A query builder (Knex, Kysely) removes that boilerplate and numbers parameters for
you. The cost is that the SQL is no longer the thing you read, and every raw
escape hatch (`knex.raw`, `sql.raw`) reintroduces exactly the hole this page
closes. For a codebase learning raw `pg` first, the explicit version is worth the
lines: when a query is slow, you are already looking at the text you will paste
into `EXPLAIN`.

## Gotchas

**Symptom:** A search box returns the entire table
**Cause:** The user typed `%` or `_` and it reached `ILIKE` as a pattern
metacharacter.
**Fix:** Escape `\`, `%` and `_` in the term before wrapping it, and declare
`ESCAPE '\'`.

**Symptom:** A search term containing a backslash behaves oddly
**Cause:** The escape character was not itself escaped, so it consumed the
character after it.
**Fix:** Escape `\` first — a single character class `[\\%_]` handles all three in
one pass.

**Symptom:** `bind message supplies 4 parameters, but prepared statement requires 2`
**Cause:** `limit`/`offset` pushed onto `params` before the filter fragments were
finished numbering.
**Fix:** Push pagination values last, after every filter has been added.

**Symptom:** A search endpoint is fast in staging and times out in production
**Cause:** A leading-wildcard `ILIKE '%term%'` cannot use a plain btree index, so
it scans; the difference only shows at scale.
**Fix:** A trigram index (`pg_trgm`) for contains-search, or full-text search for
word search.

## Interview questions

**★ A user searches for `%` and gets every row. Is that SQL injection?**
No — the parameter is still bound as a value, so no SQL was injected. It is a
pattern-metacharacter bug: `%` and `_` are wildcards inside `LIKE`/`ILIKE`. Escape
them in the user's term before wrapping it in `%…%`. On a large table it is a
practical denial of service, since it forces a scan returning everything.

**★ Where does sorting fit into this builder?**
Nowhere — it cannot. `ORDER BY` takes an identifier, and identifiers cannot be
parameters; `ORDER BY $1` silently sorts by a constant. Sorting needs an allowlist
that maps a request key to vetted literal SQL text, kept entirely separate from the
parameter array ([Sort and filter allowlists](../allowlists/)).

**★ Why must `limit` and `offset` be pushed onto the parameter array last?**
Because the placeholder number is `params.length` after the push. Adding pagination
before the filters are finished renumbers every subsequent fragment, so the query
binds the wrong values to the wrong predicates — or fails outright with a bind
message mismatch.

**Why declare `ESCAPE '\'` when backslash is already the default?**
Explicitness. The default has historically depended on `standard_conforming_strings`
and on how the literal was quoted, so stating it removes an assumption that has
silently changed under people before.

---

← [Building predicates and parameters](01-predicates-and-params.md) · Next → [Sort and filter allowlists](../allowlists/)
