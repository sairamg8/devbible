---
title: "WHERE predicates"
sidebar_label: "02 · WHERE predicates"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex14-crud.mjs`.

**Almost every `WHERE` bug is a NULL bug.** SQL uses three-valued logic — true,
false, and unknown — and `WHERE` keeps only rows where the predicate is **true**.
Unknown is discarded exactly like false, silently.

## `!=` skips NULL rows

Four rows, one with `qty` NULL:

```console
$ node ex14-crud.mjs
=== 1. NULL comparison: != vs IS DISTINCT FROM ===
WHERE qty != 5             → 2 rows
WHERE qty IS DISTINCT FROM 5 → 3 rows  ← includes the NULL row
NULL = NULL → null | NULL IS NOT DISTINCT FROM NULL → true
```

`NULL != 5` is **unknown**, not true, so the NULL row is dropped. Asked "everything
that is not 5", most people mean the three rows — and get two.

`IS DISTINCT FROM` is the null-safe comparison: it treats NULL as a value that
differs from everything except another NULL. Note `NULL = NULL` is `null`, while
`NULL IS NOT DISTINCT FROM NULL` is `true`.

Use `IS DISTINCT FROM` whenever the column is nullable and you mean "different,
counting NULL as different". The same applies to `WHERE status != 'archived'` — it
silently excludes rows with no status.

## `NOT IN` with a NULL returns nothing at all

```console
NOT IN (a1, NULL)                  (none)
  ↑ NOT IN with a NULL in the list returns NOTHING
```

Zero rows, not "everything except a1". `x NOT IN (a, NULL)` expands to
`x != a AND x != NULL`, and `x != NULL` is unknown, so the whole conjunction can
never be true.

This is the single most dangerous predicate in SQL, because the NULL usually comes
from a subquery:

```sql
-- ✗ returns nothing the moment one order has a NULL user_id
SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM orders);

-- ✓ null-safe, and usually faster
SELECT * FROM users u WHERE NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.user_id = u.id);
```

**Prefer `NOT EXISTS` over `NOT IN` for subqueries, always.** `IN` with a literal
list you wrote is fine; `NOT IN` over a nullable column is a bug waiting for its
first NULL.

## Pattern matching

```console
=== 2. pattern matching ===
LIKE 'W%'                          Widget, Widget Pro
ILIKE 'w%'                         Widget, Widget Pro
~ '^[Ww]idget'                     Widget, Widget Pro
~* 'widget'                        Widget, Widget Pro
IN ('a1','a3')                     Widget, doohickey
BETWEEN 3 AND 5                    Widget, doohickey
```

| Operator | Meaning |
|---|---|
| `LIKE` | `%` any sequence, `_` one character. Case-sensitive |
| `ILIKE` | Same, case-insensitive. **PostgreSQL-specific** |
| `~` / `~*` | POSIX regex, case-sensitive / insensitive |
| `!~` / `!~*` | Negated regex |

**Wildcards in user input are a bug**, not an injection — from
[Pattern matching and composition](../phase-9-api-crud/03-safe-dynamic-where/02-patterns-and-composition.md),
a bare `%` as a search term matched every row. Escape `\`, `%` and `_` before
wrapping the term.

**Index behaviour is the practical difference.** A btree index can serve
`LIKE 'W%'` (anchored prefix) but not `LIKE '%W'` or `ILIKE` at all. For
case-insensitive or contains search you need an index on `lower(col)`, or a trigram
index (`pg_trgm`) — Phase 10's material. Regex is never btree-indexable.

## `BETWEEN` is inclusive on both ends

`qty BETWEEN 3 AND 5` is `qty >= 3 AND qty <= 5`. That is a trap for timestamps:

```sql
-- ✗ includes exactly midnight on the 1st of the next month
WHERE created_at BETWEEN '2026-08-01' AND '2026-09-01'

-- ✓ half-open interval — the only correct form for time ranges
WHERE created_at >= '2026-08-01' AND created_at < '2026-09-01'
```

Half-open ranges tile without gaps or overlaps. Use them for anything continuous.

## Predicates that defeat indexes

The rule: **an index on `col` serves a predicate on bare `col`**. Wrap the column in
a function or arithmetic and the index cannot be used.

```sql
-- ✗ index on created_at unused
WHERE date(created_at) = '2026-08-12'
WHERE created_at + interval '1 day' > now()
WHERE lower(email) = 'a@x.com'          -- unless an index on lower(email) exists

-- ✓ index-friendly: the column stands alone
WHERE created_at >= '2026-08-12' AND created_at < '2026-08-13'
WHERE created_at > now() - interval '1 day'
WHERE email = 'a@x.com'
```

The fix is either to rewrite the predicate so the column is bare, or to build an
expression index matching exactly what you wrote. Confirm with
`EXPLAIN (ANALYZE, BUFFERS)` rather than assuming.

## Combining predicates

`AND` before `OR`, so parenthesise anything mixed:

```sql
-- ✗ reads as: status='a' AND (qty>0 OR status='b')  ← no: AND binds tighter
WHERE status = 'a' AND qty > 0 OR status = 'b'

-- ✓ say what you mean
WHERE (status = 'a' OR status = 'b') AND qty > 0
```

An `OR` across two different columns often cannot use either index efficiently;
PostgreSQL may manage a `BitmapOr`, but rewriting as a `UNION` of two indexed
queries is sometimes far faster. Measure before assuming either way.

## Trade-off

Rich predicates let you push filtering into the database, which is almost always
right — filtering 10 rows out of a million in SQL beats fetching a million rows to
filter in JavaScript.

The cost is that SQL's NULL semantics do not match any programming language's, and
the mismatch fails silently. There is no error for a `WHERE` that quietly dropped
the rows you wanted. The defence is mechanical: know which columns are nullable, and
reach for `IS DISTINCT FROM` and `NOT EXISTS` by default on those.

## Gotchas

**Symptom:** `WHERE col != 'x'` misses rows
**Cause:** `NULL != 'x'` is unknown, and `WHERE` keeps only true — measured, 2 rows
instead of 3.
**Fix:** `WHERE col IS DISTINCT FROM 'x'`.

**Symptom:** `NOT IN (subquery)` returns zero rows
**Cause:** One NULL in the subquery makes the whole predicate unknown for every row
— measured, `(none)`.
**Fix:** `NOT EXISTS`, always, for subqueries.

**Symptom:** A search box returns every row
**Cause:** A `%` or `_` in the user's term reached `LIKE`/`ILIKE` as a wildcard.
**Fix:** Escape `\`, `%`, `_` and declare `ESCAPE '\'`.

**Symptom:** A date-range report double-counts boundary rows
**Cause:** `BETWEEN` is inclusive at both ends.
**Fix:** Half-open: `>= start AND < end`.

**Symptom:** An index is not used despite matching the column
**Cause:** The column is wrapped — `date(created_at)`, `lower(email)`, `col + 1`.
**Fix:** Rewrite so the column is bare, or add a matching expression index.

**Symptom:** `AND`/`OR` produces unexpected rows
**Cause:** `AND` binds tighter than `OR`.
**Fix:** Parenthesise explicitly.

**Symptom:** `ILIKE` is slow on a large table
**Cause:** Btree indexes cannot serve `ILIKE` or leading-wildcard `LIKE`.
**Fix:** An index on `lower(col)` with a matching predicate, or a `pg_trgm` index.

## Interview questions

**★ Why does `WHERE qty != 5` miss rows?**
Because `NULL != 5` evaluates to *unknown*, and `WHERE` keeps only rows where the
predicate is *true* — unknown is discarded exactly like false. Measured: 2 rows
instead of the expected 3. Use `IS DISTINCT FROM`, which treats NULL as a value that
differs from everything but another NULL.

**★ What is wrong with `NOT IN (SELECT …)`?**
If the subquery yields a single NULL, the predicate is unknown for every row and the
query returns **nothing** — measured. `x NOT IN (a, NULL)` expands to
`x != a AND x != NULL`, which can never be true. Use `NOT EXISTS`, which is
null-safe and usually plans better.

**★ Why is `BETWEEN` risky for timestamps?**
It is inclusive at both ends, so `BETWEEN '2026-08-01' AND '2026-09-01'` includes
exactly midnight on 1 September — a row counted in two consecutive monthly reports.
Use half-open ranges: `>= start AND < end`.

**★ Which predicates prevent an index from being used?**
Any that wrap the column: `date(created_at) = …`, `lower(email) = …`, `col + 1 > …`.
An index on `col` serves predicates on bare `col`. Either rewrite so the column
stands alone, or create an expression index matching the predicate exactly.

**★ `LIKE`, `ILIKE` or regex?**
`LIKE` for simple patterns and the only one a btree can serve, and only with an
anchored prefix (`'W%'`). `ILIKE` for case-insensitive — PostgreSQL-specific, and
not btree-indexable. Regex (`~`, `~*`) for anything structural, never indexable by
btree. Case-insensitive or contains search at scale needs `lower()` plus a matching
index, or `pg_trgm`.

**What is the difference between `=` and `IS NOT DISTINCT FROM`?**
`NULL = NULL` is `null`; `NULL IS NOT DISTINCT FROM NULL` is `true` — measured. The
`IS DISTINCT FROM` family is the null-safe comparison family, and it is what you
want whenever a nullable column is being compared.

---

← [The `SELECT` shape](01-select-shape.md) · Next → [`LIMIT` / `OFFSET`](03-limit-offset.md)
