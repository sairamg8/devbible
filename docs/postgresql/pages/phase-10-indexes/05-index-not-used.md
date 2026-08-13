---
title: "Why an index is not being used"
sidebar_label: "05 · Index not used"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex24-index-not-used.mjs`.

**Five causes account for almost every "the index is right there and it is not using it".
Four are your query's fault. One — low selectivity — means the planner is right and the
index should be ignored.**

Fixture for everything below: 400 000 rows, indexes on `account_no`, `email`, `status`,
`created_at`; 400 rows `locked`, 399 600 `active`.

## 1 · A function wraps the column

```console
$ node ex24-index-not-used.mjs
=== 1. a function around the column kills the index ===
bare column   : Index Scan using n_users_email_idx on n_users → 0.139 ms
lower(email)  : ->  Parallel Seq Scan on n_users             → 105.018 ms
created_at::date =    : ->  Parallel Seq Scan on n_users     → 49.681 ms
range on bare column  : Index Scan using n_users_created_at_idx on n_users → 9.722 ms
```

**0.139 ms → 105 ms, 755× slower, from one call to `lower()`.** The index stores
`email`, not `lower(email)`; those are different values and the B-tree has no way to
search for one given the other.

Two fixes, and the second is usually better:

```sql
-- fix A: index the expression you actually query
CREATE INDEX ON n_users (lower(email));

-- fix B: rewrite so the column is bare  (49.7 ms → 9.7 ms)
SELECT * FROM n_users
WHERE created_at >= current_date AND created_at < current_date + 1;
```

See [Expression indexes](10-expression.md) for fix A — including which date expressions
PostgreSQL will refuse to index at all.

## 2 · The cast landed on the indexed side

`account_no` is `text`. There is no `text = bigint` operator:

```console
text = bigint with no cast → 42883 operator does not exist: text = bigint
```

So one side must be cast, and **which side decides everything**:

```console
cast on the OTHER column (u.id::text) : ->  Index Only Scan using t_events_user_id_text_idx
   → 5.518 ms | hit=1761 read=244
cast on the INDEXED column (e.x::bigint): ->  Parallel Seq Scan on t_events e
   → 43.249 ms | hit=1301
```

Same on a single table:

```console
account_no::bigint = 12345 : ->  Parallel Seq Scan on n_users → 35.930 ms
account_no = '12345'       : Index Scan using n_users_account_no_idx → 0.073 ms
```

**Casting the column is casting every row.** Cast the literal instead — or fix the column
type, which is the real answer when a `text` column holds numbers.

**From Node this specific trap is quieter than you would expect.** `pg` sends parameters
as untyped text and lets the server infer, so a JS number against a `text` column just
works and still uses the index:

```console
text column, JS number param: no error, rows = 1 | Index Scan using n_users_account_no_idx
```

The danger is not the driver — it is the `::` you add by hand to make an error go away.

## 3 · Low selectivity — the planner is right

```console
=== 3. low selectivity — the index exists and is correctly ignored ===
status='locked' (400 rows)   : Index Scan using n_users_status_idx → 0.599 ms
status='active' (399600 rows): Seq Scan on n_users                 → 101.936 ms
pg_stats for status: {active,locked} {0.9989333,0.0010666667}
forced index path            : Index Scan using n_users_status_idx → 115.752 ms
```

**Same column, same index.** The planner knows from `pg_stats` that `active` is 99.89%
of the table, and reading 99.89% of the rows through an index is slower — forcing it
cost 115.8 ms against 101.9 ms.

This is the case where the answer is "your index is fine, your query is not selective",
and the fix is a [partial index](09-partial.md) or a better predicate — not a new index.

## 4 · Stale statistics

The planner plans against what it last measured, and a brand-new table has measured
nothing:

```console
reltuples on a never-analyzed table: -1 ← -1 means "unknown", not "empty"
after ANALYZE at 2000 rows        : 2000
```

Now grow the table 200× without re-analyzing:

```console
-- plan with stale stats (planner still believes 2000 rows) --
Aggregate  (cost=8.44..8.45 rows=1 width=8) (actual time=157.109..157.110 rows=1.00 loops=1)
  ->  Index Only Scan using s_stale_tag_idx on s_stale  (cost=0.42..8.44 rows=1 width=0)
        (actual time=0.068..119.743 rows=400001.00 loops=1)
        Index Cond: (tag = 'tag7'::text)
        Heap Fetches: 400001
Execution Time: 157.163 ms
  catalog still says reltuples = 2000
```

**Estimated 1 row. Actual 400 001.** The planner chose an index scan on the strength of
that estimate and did 400 001 heap fetches.

```console
-- same query after ANALYZE --
->  Parallel Seq Scan on s_stale  (cost=0.00..5128.88 rows=235233 width=0)
      (actual time=0.017..34.052 rows=200000.50 loops=2)
Execution Time: 58.482 ms
  reltuples now: 402000

stale: 157.163 ms   fresh: 58.482 ms
```

An `estimated rows=1` next to an `actual rows=400001` is the signature. Run `ANALYZE`
before you conclude anything else — see [Statistics and ANALYZE](16-statistics.md).

## 5 · The predicate shape is not indexable

```console
=== 5. three more shapes that skip the index ===
<>  (negation)      ->  Parallel Seq Scan on n_users   → 28.095 ms
NOT IN              ->  Parallel Seq Scan on n_users   → 28.755 ms
OR across columns   Seq Scan on n_users                → 84.630 ms
OR, both selective  Bitmap Heap Scan on n_users        → 0.919 ms
leading wildcard    ->  Parallel Seq Scan on n_users   → 36.801 ms
```

- **`<>` and `NOT IN`** ask for "everything except", which a sorted structure cannot seek
  to.
- **`OR` is not automatically fatal.** `status = 'locked' OR country = 'IN'` seq-scanned
  because `country = 'IN'` is a third of the table — but `status = 'locked' OR
  account_no = '7'`, where *both* sides are selective and *both* are indexed, became a
  0.919 ms bitmap scan (PostgreSQL combines the two bitmaps with `BitmapOr`).
  The rule is not "`OR` breaks indexes", it is "every branch of the `OR` needs its own
  usable index".
- **`LIKE '%…'`** has no prefix to seek to. That one needs [`pg_trgm`](11-gin-trgm.md).

## The checklist

```sql
-- 1. is the column bare on the left of the operator?
-- 2. is anything cast?  which side?
-- 3. how many rows does this actually match?
SELECT count(*) FROM t WHERE <predicate>;
-- 4. are the statistics current?
SELECT relname, reltuples, last_analyze, last_autoanalyze, n_mod_since_analyze
FROM pg_stat_user_tables WHERE relname = 't';
ANALYZE t;
-- 5. does an index exist that covers this predicate at all?
\d t
-- then, and only then:
SET enable_seqscan = off;  EXPLAIN (ANALYZE, BUFFERS) <query>;  RESET enable_seqscan;
```

Step 5 is the tie-breaker: if the forced plan is *slower*, the planner was right and you
are looking at cause 3.

## From Node

The two failures that come from application code are the hand-added cast and the
function wrapper. Both are visible in the SQL you wrote:

```js
// defeats the index — the cast is on the column
await pool.query(`SELECT * FROM n_users WHERE account_no::bigint = $1`, [12345]);

// uses it — the parameter carries the type
await pool.query(`SELECT * FROM n_users WHERE account_no = $1`, ['12345']);

// defeats the index
await pool.query(`SELECT * FROM n_users WHERE lower(email) = $1`, [email.toLowerCase()]);

// uses it — either index lower(email), or store the column already normalised
await pool.query(`SELECT * FROM n_users WHERE email = $1`, [email]);
```

## Trade-off

**Fixing "the index is not used" by adding another index is the expensive answer, and
often the wrong one.** Three of the five causes are fixed by rewriting the query at no
ongoing cost; one is fixed by `ANALYZE`; and one means no index should be used. Only
cause 1 sometimes genuinely calls for a new [expression index](10-expression.md) — with
the write cost that implies.

## Gotchas

**Symptom:** Index ignored after a bulk load or a migration
**Cause:** Statistics still describe the old table; `reltuples` may still be `-1`
**Fix:** `ANALYZE t` as the last step of every bulk load

**Symptom:** Query fast in `psql`, slow from the app
**Cause:** The app's prepared statement switched to a generic plan
**Fix:** See [prepared statements](../phase-7-pg-driver/10-prepared.md)

**Symptom:** Adding `::text` or `::int` "fixed a type error" and the query got slow
**Cause:** The cast landed on the indexed column
**Fix:** Cast the parameter, or correct the column type

**Symptom:** `WHERE deleted_at IS NULL AND ...` never uses the index
**Cause:** `IS NULL` on a mostly-NULL column is unselective
**Fix:** A [partial index](09-partial.md) `WHERE deleted_at IS NULL`

**Symptom:** An `OR` query is slow but each half is fast
**Cause:** One branch has no usable index, so the whole predicate falls back to a scan
**Fix:** Index every branch, or rewrite as `UNION` of two selective queries

## Interview questions

**★ Name the reasons an index is not used.**
A function wraps the column; a cast landed on the indexed side; the predicate is not
selective enough to be worth it; statistics are stale; or the predicate shape (`<>`,
`NOT IN`, leading `%`) is not seekable.

**★ Which of those is not a bug?**
Low selectivity. Measured: forcing the index for a value matching 99.89% of rows took
115.8 ms versus 101.9 ms for the sequential scan.

**★ Why does `WHERE lower(email) = $1` skip an index on `email`?**
The index stores `email`. `lower(email)` is a different value with no derivable ordering
relationship. Measured 0.139 ms → 105 ms. Fix with an index on `lower(email)`.

**★ How do you spot stale statistics in a plan?**
A large gap between estimated and actual rows on a scan node — measured, `rows=1`
estimated against `rows=400001` actual, and the query took 157 ms instead of 58 ms.

**Does `pg` cause type-mismatch problems by sending JS types?**
No. Parameters go as untyped text and the server infers, so a JS number against a `text`
column still used the index. The mismatch problems come from casts written by hand.

**Is `SET enable_seqscan = off` a fix?**
No, a diagnostic. It reprices sequential scans rather than forbidding them, and if the
forced plan is slower you have learned the planner was right.

---

← [Seq vs index vs bitmap](04-scan-types.md) · Next → [Multicolumn indexes](06-multicolumn.md)
