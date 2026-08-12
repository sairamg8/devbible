---
title: "Expressions and CASE"
sidebar_label: "15 · Expressions"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex14-crud.mjs`.

**`CASE`, `COALESCE`, `GREATEST`/`LEAST` and the concatenation operators let you shape a
row in SQL instead of in JavaScript. Each one treats `NULL` differently, and those
differences are the whole reason this page exists.**

The rows below come from the phase table: `qty` is `5`, `NULL`, `3`, `0` for `a1`–`a4`.

```console
$ node ex14-crud.mjs
=== 9. expressions ===
┌─────────┬──────┬───┬───┬────────────┬───────────────────┬───────────────────────┐
│ (index) │ qty0 │ g │ l │ state      │ label             │ cws                   │
├─────────┼──────┼───┼───┼────────────┼───────────────────┼───────────────────────┤
│ 0       │ 5    │ 5 │ 2 │ 'in stock' │ 'Widget (a1)'     │ 'Widget / a1 / 5'     │
│ 1       │ 0    │ 2 │ 2 │ 'unknown'  │ 'Gadget (a2)'     │ 'Gadget / a2'         │
│ 2       │ 3    │ 3 │ 2 │ 'in stock' │ 'doohickey (a3)'  │ 'doohickey / a3 / 3'  │
│ 3       │ 0    │ 2 │ 0 │ 'out'      │ 'Widget Pro (a4)' │ 'Widget Pro / a4 / 0' │
└─────────┴──────┴───┴───┴────────────┴───────────────────┴───────────────────────┘
```

```sql
SELECT
  COALESCE(qty, 0) AS qty0,
  GREATEST(qty, 2) AS g, LEAST(qty, 2) AS l,
  CASE WHEN qty IS NULL THEN 'unknown'
       WHEN qty = 0     THEN 'out'
       ELSE 'in stock' END AS state,
  name || ' (' || sku || ')' AS label,
  concat_ws(' / ', name, sku, qty) AS cws
FROM c_items ORDER BY id LIMIT 4;
```

## `COALESCE` — the first non-null

`COALESCE(qty, 0)` turned the `NULL` in row 1 into `0`. It takes any number of arguments
and returns the first that is not null, so it is also a fallback chain:

```sql
COALESCE(nickname, first_name, email, 'anonymous')
```

It **short-circuits** — later arguments are not evaluated once one is non-null, so an
expensive subquery in the last position costs nothing when the first value is present.

The related one-liner is `NULLIF(a, b)`, which returns `NULL` when the two are equal.
`NULLIF(qty, 0)` is the standard guard against division by zero:

```sql
SELECT total / NULLIF(count, 0)   -- NULL rather than a 22012 division_by_zero error
```

## `GREATEST` and `LEAST` skip nulls

This surprises people, and it is visible in row 1: `qty` is `NULL`, yet
`GREATEST(qty, 2)` returned **`2`**, not `NULL`.

```console
│ 1       │ 0    │ 2 │ 2 │ 'unknown'  │
```

**`GREATEST` and `LEAST` ignore null arguments** and compare the rest, returning `NULL`
only when *every* argument is null. That is the opposite of almost every other operator
in SQL, where one null poisons the result. Convenient when you want it; a silent wrong
answer when you assumed the usual propagation.

They are also row-wise, not aggregates — `GREATEST(a, b, c)` compares three columns
within one row, while `max()` compares one column across many rows.

## `CASE` — branching

```console
│ 1       │ 'unknown'  │      ← qty IS NULL
│ 3       │ 'out'      │      ← qty = 0
```

```sql
CASE WHEN qty IS NULL THEN 'unknown'
     WHEN qty = 0     THEN 'out'
     ELSE 'in stock' END
```

Branches are tested in order and the first match wins, so **the `NULL` check must come
first** — `WHEN qty = 0` would never match a null row anyway (it evaluates to `NULL`,
not true), and without the `ELSE` such a row would fall through to an implicit
`ELSE NULL`. That implicit null is the usual bug: an uncovered case yields `NULL`
silently rather than an error.

There is also a shorter form for equality against one expression:

```sql
CASE status WHEN 'a' THEN 'active' WHEN 'p' THEN 'pending' ELSE 'unknown' END
```

It cannot express `IS NULL`, because it compares with `=`. When null is a possible
value, use the long form.

`CASE` is useful well beyond the select list — conditional aggregates
(`count(*) FILTER (WHERE …)` is usually better), and custom sort orders:

```sql
ORDER BY CASE status WHEN 'urgent' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, created_at DESC
```

## `||` propagates null; `concat()` does not

The most common null bug in string building:

```console
|| with NULL → null | concat() → "x"
```

```sql
SELECT 'x' || NULL;        -- NULL — the whole string is gone
SELECT concat('x', NULL);  -- 'x' — null treated as empty
```

One null column and `a || b || c` is `NULL` — not a shorter string, **no string at all**.
Compare the two output columns for row 1, where `qty` is null:

```console
│ 1       │ 'Gadget (a2)'     │ 'Gadget / a2'         │
```

`label` survived because `name` and `sku` are `NOT NULL`. `cws` used
`concat_ws(' / ', name, sku, qty)` and simply **dropped the null `qty`** — including its
separator, which is why there is no trailing ` / `.

Pick deliberately:

| Want | Use |
|---|---|
| A null anywhere should void the result | `\|\|` |
| Nulls treated as empty strings | `concat()` |
| Joined with a separator, nulls skipped | `concat_ws(sep, …)` |
| A specific placeholder | `COALESCE(col, 'n/a')` before concatenating |

Note the asymmetry in `concat_ws`: a null **separator** returns `NULL`, while null
*values* are skipped.

## Where expressions can and cannot go

Expressions are legal in the select list, `WHERE`, `ORDER BY`, `GROUP BY`, `HAVING`,
`RETURNING`, and in index definitions. What you cannot do is reuse a select-list alias in
`WHERE` — [The `SELECT` shape](01-select-shape.md) and
[Logical query processing order](09-logical-order.md).

If the same expression appears three times, name it once in a CTE or lateral join:

```sql
SELECT sku, total FROM (
  SELECT sku, price * qty AS total FROM c_items
) s WHERE total > 10 ORDER BY total DESC;
```

One caution: an expression in `WHERE` prevents a plain index on the column from being
used. `WHERE lower(email) = $1` will not use an index on `email` — it needs an
**expression index** on `lower(email)`
([Expression indexes](../phase-10-indexes/10-expression.md)).

## Trade-off

Computing in SQL means the value is consistent for every consumer of the database, is
available to `WHERE` and `ORDER BY`, and can be indexed or made a generated column. It
costs testability — expressions inside query strings are harder to unit-test than a
JavaScript function — and it puts logic somewhere reviewers may not look.

The line most teams settle on: presentation formatting in the application, anything the
database must filter, sort or constrain on in SQL. See
[Shaping in SQL vs JS](../phase-9-api-crud/15-shape-sql-vs-js.md).

## Gotchas

**Symptom:** A concatenated string is entirely `NULL`
**Cause:** `||` propagates null — measured, `'x' || NULL` → `null`.
**Fix:** `concat()`, `concat_ws()`, or `COALESCE` each nullable part.

**Symptom:** `GREATEST(a, b)` returned a number where `NULL` was expected
**Cause:** `GREATEST`/`LEAST` ignore nulls — measured, `GREATEST(NULL, 2)` → `2`.
**Fix:** Test for null explicitly if a null argument should void the result.

**Symptom:** A `CASE` column is unexpectedly `NULL`
**Cause:** No branch matched and there is no `ELSE`, so the implicit `ELSE NULL` applied.
**Fix:** Always write an `ELSE`, even if it raises: `ELSE raise_error(…)` via a small
function, or a `CHECK` constraint upstream.

**Symptom:** A `CASE` never takes its null branch
**Cause:** The short form `CASE col WHEN NULL THEN …` compares with `=`, which is never
true for null.
**Fix:** The long form with `WHEN col IS NULL`.

**Symptom:** `22012 division by zero`
**Cause:** A zero denominator.
**Fix:** `x / NULLIF(y, 0)`, giving `NULL` instead of an error.

**Symptom:** `concat_ws` returned `NULL` for every row
**Cause:** The separator argument was null.
**Fix:** Null *values* are skipped, but a null separator voids the whole call.

**Symptom:** An index on the column is ignored
**Cause:** The predicate wraps the column in an expression, e.g. `lower(email) = $1`.
**Fix:** Create the matching expression index, or store a normalized/generated column.

## Interview questions

**★ What is the difference between `||` and `concat()`?**
`||` propagates null — measured, `'x' || NULL` returns `NULL`, so one null column voids
the entire string. `concat()` treats nulls as empty and returned `'x'` for the same
input. `concat_ws(sep, …)` additionally skips the separator for null values, though a
null *separator* still voids the result.

**★ Do `GREATEST` and `LEAST` return `NULL` if one argument is null?**
No — they ignore nulls and compare the remaining arguments, returning `NULL` only when
all are null. Measured, `GREATEST(NULL, 2)` returned `2`. This is unlike almost every
other operator, and unlike `||`.

**★ Why might a `CASE` expression produce `NULL`?**
Because no `WHEN` matched and there is no `ELSE`, so the implicit `ELSE NULL` applies.
The other cause is ordering: a `WHEN qty = 0` branch placed before an `IS NULL` branch
never matches a null row, since `NULL = 0` is `NULL` rather than false.

**★ How do you avoid a division-by-zero error?**
`x / NULLIF(y, 0)` — `NULLIF` returns null when the arguments are equal, and dividing by
null gives null instead of raising `22012`. Then `COALESCE` the result if you need a
default.

**What is `COALESCE` and does it evaluate all its arguments?**
It returns the first non-null argument, and it short-circuits — evaluation stops at the
first non-null, so an expensive expression in a later position costs nothing when an
earlier one is present.

**Should this logic live in SQL or in the application?**
In SQL when the database must filter, sort, group or constrain on the value, or when
several consumers need it to agree — those are things application code cannot provide to
the planner. In the application for presentation formatting, where testability and
iteration speed matter more.

---

← [`TRUNCATE` vs `DELETE`](14-truncate.md) · Next → [String functions](16-string-functions.md)
