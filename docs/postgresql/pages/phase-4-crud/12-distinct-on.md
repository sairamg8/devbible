---
title: "DISTINCT and DISTINCT ON"
sidebar_label: "12 · DISTINCT ON"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex14-crud.mjs`.

**`DISTINCT ON` solves "the latest row per group" in one clause. It is
PostgreSQL-specific, and it is dramatically shorter than the window-function or
lateral-join versions that portable SQL requires.**

## The problem it solves

"The most recent event for each user" — a query every application needs, and one that
plain `DISTINCT` cannot express at all.

```sql
SELECT DISTINCT ON (user_id) user_id, at, kind
  FROM c_events
 ORDER BY user_id, at DESC;
```

```console
$ node ex14-crud.mjs
=== 7. DISTINCT ON ===
latest event per user:
┌─────────┬─────────┬──────────────────────────┬──────────┐
│ (index) │ user_id │ at                       │ kind     │
├─────────┼─────────┼──────────────────────────┼──────────┤
│ 0       │ 1       │ 2026-01-03T00:00:00.000Z │ 'logout' │
│ 1       │ 2       │ 2026-01-05T00:00:00.000Z │ 'login'  │
└─────────┴─────────┴──────────────────────────┴──────────┘
```

One row per `user_id`, and it is the **first row per group in the `ORDER BY`** — so
`at DESC` gives the latest. Change it to `at ASC` and you get the earliest. Note you
get the *whole row*, including `kind`, which is what makes this different from
`max(at)`.

## The `ORDER BY` rule is not optional

```console
ORDER BY not matching DISTINCT ON → 42P10 SELECT DISTINCT ON expressions must match initial ORDER BY expressions
```

**The `DISTINCT ON` expressions must be the leading `ORDER BY` expressions**, in the
same order. That is not a syntax quirk — it is what makes the result deterministic.
The clause keeps the first row of each group as the `ORDER BY` produced them; without
that ordering, "first" would be arbitrary.

```sql
DISTINCT ON (user_id) … ORDER BY user_id, at DESC   -- ✓
DISTINCT ON (user_id) … ORDER BY at DESC            -- ✗ 42P10
DISTINCT ON (a, b)    … ORDER BY a, b, c DESC       -- ✓
```

**Omitting `ORDER BY` entirely is legal and dangerous.** You get one arbitrary row
per group with no error — the same class of silent non-determinism as `LIMIT` without
`ORDER BY` ([Logical order](09-logical-order.md)).

## Versus the portable alternatives

```sql
-- DISTINCT ON — PostgreSQL
SELECT DISTINCT ON (user_id) * FROM c_events ORDER BY user_id, at DESC;

-- window function — portable, and lets you keep the rank
SELECT * FROM (
  SELECT *, row_number() OVER (PARTITION BY user_id ORDER BY at DESC) AS rn
    FROM c_events
) s WHERE rn = 1;

-- lateral join — good when the outer table is small and indexed
SELECT u.id, e.*
  FROM users u
  LEFT JOIN LATERAL (
    SELECT * FROM c_events e WHERE e.user_id = u.id ORDER BY e.at DESC LIMIT 1
  ) e ON true;
```

| | `DISTINCT ON` | `row_number()` | `LATERAL` |
|---|---|---|---|
| Portable | no | yes | mostly |
| Top **N** per group | no — only 1 | yes (`rn <= 3`) | yes (`LIMIT 3`) |
| Keeps users with no events | no | no | **yes**, with `LEFT JOIN` |
| Typically fastest | when scanning the whole table | — | when the outer set is small |

The honest split: **`DISTINCT ON` for top-1 over a whole table**, `row_number()` when
you need top-N or the rank itself, `LATERAL` when you are iterating a small outer set
and can use an index per lookup. Windows are Phase 6's material; `LATERAL` is
Phase 5's.

## Making it fast

`DISTINCT ON` needs the data in `(group, sort)` order. Give it an index in exactly
that shape and the sort disappears:

```sql
CREATE INDEX c_events_user_at_idx ON c_events (user_id, at DESC);
```

Without it, PostgreSQL sorts the whole table first — fine on thousands of rows, not on
millions. Check with `EXPLAIN (ANALYZE, BUFFERS)` whether you see a `Sort` node or an
`Index Scan`.

The index column order must match the clause: `(user_id, at DESC)`, not
`(at, user_id)`.

## Plain `DISTINCT`

`DISTINCT` deduplicates the **entire select list**, after it is computed:

```sql
SELECT DISTINCT status FROM orders;              -- the set of statuses
SELECT DISTINCT id, status FROM orders;          -- pointless: id is unique already
```

The second returns every row. This is the most common `DISTINCT` mistake: it is
reached for to "remove duplicates" while a unique column in the select list
guarantees there are none. If you are adding `DISTINCT` to fix duplicate rows, the
real cause is usually a join fanning out
([Phase 5](../phase-5-joins/)) — fix the join rather than masking it, because
`DISTINCT` then sorts or hashes the whole result for nothing.

`DISTINCT` also treats NULLs as equal to each other, unlike `=` — so
`SELECT DISTINCT qty` collapses all NULL rows to one.

## Trade-off

`DISTINCT ON` is concise, fast with the right index, and returns whole rows without a
subquery. It costs portability — it exists only in PostgreSQL, so a query using it
cannot move to another engine unchanged — and it is limited to one row per group.

`row_number()` is standard and more general at the price of a subquery wrapper and,
usually, materialising the ranked set. For a codebase committed to PostgreSQL,
`DISTINCT ON` is the better default for top-1 and worth the lock-in; reach for the
window function the moment you need top-N or want the rank in the output.

## Gotchas

**Symptom:** `42P10 SELECT DISTINCT ON expressions must match initial ORDER BY
expressions`
**Cause:** The `DISTINCT ON` columns are not the leading `ORDER BY` columns.
**Fix:** Lead the `ORDER BY` with exactly those expressions, in order.

**Symptom:** `DISTINCT ON` returns an unpredictable row per group
**Cause:** No `ORDER BY` — legal, and non-deterministic.
**Fix:** Always specify the full `ORDER BY`.

**Symptom:** It returns the oldest row instead of the newest
**Cause:** `ORDER BY user_id, at` ascending.
**Fix:** `at DESC`.

**Symptom:** `SELECT DISTINCT` does not remove duplicates
**Cause:** A unique column in the select list makes every row distinct.
**Fix:** Remove it, or use `DISTINCT ON` for per-group deduplication.

**Symptom:** `DISTINCT` was added to hide duplicate rows from a join
**Cause:** The join fans out — a one-to-many relationship multiplying rows.
**Fix:** Fix the join (aggregate, or `EXISTS`); `DISTINCT` sorts the whole result to
mask it.

**Symptom:** `DISTINCT ON` is slow on a large table
**Cause:** No index in `(group, sort)` order, so the whole table is sorted.
**Fix:** `CREATE INDEX … (user_id, at DESC)` matching the clause exactly.

**Symptom:** Users with no events disappear
**Cause:** `DISTINCT ON` selects from the events table only.
**Fix:** `LEFT JOIN LATERAL … ON true` from the users table.

## Interview questions

**★ What does `DISTINCT ON` do?**
Keeps the first row of each group defined by its expressions, where "first" is
decided by the `ORDER BY`. Measured: `DISTINCT ON (user_id) … ORDER BY user_id, at
DESC` returned exactly one row per user, the latest, with all its columns. Plain
`DISTINCT` cannot do this — it only deduplicates whole select lists.

**★ Why must `ORDER BY` start with the `DISTINCT ON` expressions?**
Because "first row per group" is only meaningful if the rows are in a defined order —
`42P10` otherwise. Omitting `ORDER BY` altogether is legal and gives an arbitrary row
per group with no error, which is worse.

**★ How does it compare to `row_number()`?**
`DISTINCT ON` is shorter and PostgreSQL-only, and gives exactly one row per group.
`row_number() OVER (PARTITION BY … ORDER BY …)` is standard, needs a subquery
wrapper, and generalises to top-N and to exposing the rank. `LATERAL` wins when the
outer set is small and each lookup can use an index — and is the only one that keeps
groups with no matching rows.

**★ How do you make `DISTINCT ON` fast?**
An index in exactly the clause's shape — `(user_id, at DESC)` — so the rows arrive
pre-ordered and no sort is needed. Verify with `EXPLAIN (ANALYZE, BUFFERS)` that
there is no `Sort` node.

**★ Someone added `DISTINCT` to remove duplicate rows. Is that the fix?**
Usually not. Duplicates in a result almost always come from a join fanning out over a
one-to-many relationship. `DISTINCT` masks it by sorting or hashing the entire
result; fixing the join — aggregating, or using `EXISTS` — removes both the
duplicates and the work.

---

← [`DELETE`](11-delete.md) · Next → [`MERGE`](13-merge/README.md)
