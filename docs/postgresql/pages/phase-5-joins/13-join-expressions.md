---
title: "Joining on expressions"
sidebar_label: "13 · Join expressions"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex35-joins.mjs`.

**`ON` takes any boolean expression, not just column equality — a function call, a range
containment test, an inequality. The catch is indexing: an expression index made no
difference at all to a full-table join here, and turned the same join into a 59× faster
nested loop once the driving side was small.**

## Joining on a range

Prices valid over time, sales at a point in time — the join condition is containment, not
equality:

```sql
CREATE TABLE j_prices (sku text, valid tstzrange, price int);
INSERT INTO j_prices VALUES
  ('A', tstzrange('2026-01-01','2026-06-01'), 100),
  ('A', tstzrange('2026-06-01','2027-01-01'), 120),
  ('B', tstzrange('2026-01-01','2027-01-01'),  50);

SELECT s.id, s.sku, p.price
FROM j_sales s
JOIN j_prices p ON p.sku = s.sku AND p.valid @> s.sold_at
ORDER BY s.id;
```

```console
$ node ex35-joins.mjs
=== 13. joining on an expression, and on a range ===
range join (price at time of sale): [{"id":1,"sku":"A","price":100},{"id":2,"sku":"A","price":120},
                                     {"id":3,"sku":"B","price":50}]
```

Sale 1 in March gets **100**, sale 2 in September gets **120** — the same SKU priced by
when it sold. Expressed with bare timestamps this is
`s.sold_at >= p.valid_from AND s.sold_at < p.valid_to`, with the half-open boundary you
have to remember to get right; `tstzrange` and `@>` carry that in the type. The default
`[)` bound is what makes the 2026-06-01 changeover unambiguous — the June sale belongs to
exactly one row.

The pairing that makes this safe is an **exclusion constraint** preventing two overlapping
validity rows for one SKU, so the join cannot silently double a row:

```sql
ALTER TABLE j_prices ADD CONSTRAINT no_overlap
  EXCLUDE USING gist (sku WITH =, valid WITH &&);
```

Without it, overlapping periods are a fan-out bug
([fan-out and aggregates](01-inner-join/02-fan-out-and-aggregates.md)) that appears only
for the affected SKUs — the sale is priced twice, and only for the products someone
mis-entered. Ranges, exclusion constraints and the `23P01` they raise are covered in
[Phase 2](../phase-2-types/16-ranges.md).

The reverse failure is a **gap**: a sale whose timestamp falls in no validity period at all
gets dropped by the inner join, silently reducing the report's row count. Whether that is
better or worse than double-pricing depends on the domain, but it is worth choosing
deliberately — `LEFT JOIN` plus a `WHERE p.sku IS NULL` check surfaces the gaps instead of
hiding them.

For a range join over any real volume, index the range column with **GiST** — a B-tree
cannot answer containment.

## Joining on a function result

Two tables whose codes differ only in case:

```sql
SELECT count(*) FROM j_x x JOIN j_y y ON lower(x.code) = y.code;
```

200 000 rows on each side. First without an expression index, then with one:

```console
join on lower(x.code)            : Parallel Hash Join (actual time=55.810..194.705 rows=100000.00 loops=2) 211.532 ms
same join with an expression index: Parallel Hash Join (actual time=55.665..195.210 rows=100000.00 loops=2) 212.556 ms
  ^ the index changes nothing: every row of both tables is needed anyway
```

**211.5 ms then 212.6 ms — no change.** `CREATE INDEX ON j_x (lower(code))` did nothing,
and it would be easy to conclude that expression indexes do not help joins.

They do; this query just cannot use one. Both tables are read in full, so a hash join over
sequential scans is already the cheapest plan — an index offers no way to touch fewer rows
when you need all of them. The plan node is identical before and after; the 1 ms is noise.

Change the driving side to 50 rows and the same index becomes decisive:

```console
50-row driving side, expr index    : Nested Loop (actual time=0.040..0.979 rows=50.00 loops=1) 1.109 ms
same 50 rows, index dropped        : Hash Join (actual time=27.609..58.313 rows=25.00 loops=2) 65.246 ms
```

**1.1 ms against 65.2 ms — 59×.** With the index the planner probes `j_x` 50 times
(`Nested Loop`); without it, it has no way to evaluate `lower(x.code)` selectively and must
hash all 200 000 rows to find 50 matches.

The general rule, and the reason the first pair of numbers is not a counter-example: an
index reduces the rows examined, so it pays exactly when the query needs a small fraction
of them. Whether that condition holds is a property of the *query*, not of the index —
[why an index is not used](../phase-10-indexes/05-index-not-used.md) has the other four
reasons.

An expression index must match the expression in the query textually, and the function must
be `IMMUTABLE`. `lower(code)` qualifies; `lower(code || suffix)` is a different expression
and will not match. See [expression indexes](../phase-10-indexes/10-expression.md) for the
`42P17` you get when the function is not immutable.

## Other expression joins

- **Inequality**: `ON b.value BETWEEN a.lo AND a.hi` — legal, but **only a nested loop
  applies**. A hash join needs equality to key the hash, and a merge join needs a
  *mergejoinable* clause (a btree equality operator) to walk two sorted inputs against; a
  range predicate offers neither. There is no alternative plan, so an index on the probed
  side is not an optimisation here but the difference between one index probe and one full
  scan per driving row.
- **Case-insensitive**: `citext` avoids the `lower()` on both sides entirely, at the cost
  of a non-core type ([Phase 2](../phase-2-types/14-network-geo-citext.md)).
- **Computed key**: prefer a `GENERATED ALWAYS AS (…) STORED` column plus a plain index
  over an expression index when the same expression is joined and filtered repeatedly —
  it can be examined with `\d` and cannot drift from the query text.
- **JSONB extraction**: `ON (a.doc->>'ref') = b.ref` needs an expression index on
  `(doc->>'ref')`, and note the result is `text` — a mismatch against an `int` column is
  one of the standard reasons an index goes unused.

## From Node

```js
const {rows} = await pool.query(
  `SELECT s.id, p.price
   FROM j_sales s
   JOIN j_prices p ON p.sku = s.sku AND p.valid @> s.sold_at
   WHERE s.sold_at >= $1 AND s.sold_at < $2
   ORDER BY s.id`,
  [from, to],
);
```

`tstzrange` has no JS equivalent, so selecting the range column itself would hand you the
string `["2026-01-01 00:00:00+00","2026-06-01 00:00:00+00")` to parse. Select the scalar
columns you need instead, and keep range logic in SQL.

## Trade-off

Expression and range joins let the database express relationships that would otherwise be
resolved by pulling both sides into the application — temporal pricing, fuzzy key matching,
containment. The price is planner freedom: a non-equality condition rules out hash joins,
an unindexed expression rules out index access, and a `FULL OUTER JOIN` on such a condition
is rejected outright ([page 06](06-outer-joins.md)). Expression indexes get you back to
indexed access, but only for queries selective enough to want it — as the 211 ms pair
shows, they are not a general speed-up.

## Gotchas

**Symptom:** An expression index made no difference to a join
**Cause:** The query needs every row, so a sequential hash join is already optimal
**Fix:** Nothing to fix — check whether the query is selective before adding the index.
Measured: 211.5 → 212.6 ms full-table, 65.2 → 1.1 ms with a 50-row driving side

**Symptom:** An expression index exists but is never used
**Cause:** The query's expression does not match the index's textually, or the function is
not `IMMUTABLE`
**Fix:** Match it exactly; check with `\d table` and see
[expression indexes](../phase-10-indexes/10-expression.md)

**Symptom:** A range join returns duplicate rows
**Cause:** Overlapping validity periods for the same key
**Fix:** `EXCLUDE USING gist (key WITH =, period WITH &&)` so overlaps cannot be stored

**Symptom:** A row on the exact boundary is priced by the wrong period, or by both
**Cause:** Inclusive-inclusive bounds
**Fix:** Half-open `[)` — the `tstzrange` default

**Symptom:** A range join is slow
**Cause:** No GiST index on the range column; B-tree cannot answer `@>`
**Fix:** `CREATE INDEX ON j_prices USING gist (valid)`, or a composite with `sku`

**Symptom:** `ERROR: FULL JOIN is only supported with merge-joinable or hash-joinable join
conditions`
**Cause:** A full outer join on a range or inequality condition
**Fix:** Rewrite as two anti-joins plus `UNION ALL`

## Interview questions

**★ Can you join on something other than equality?**
Yes — `ON` accepts any boolean expression: function results, inequalities, range
containment. The consequence is that a non-equality condition leaves the planner with the
**nested loop only**: hash join needs an equality operator to key the hash, and merge join
needs a mergejoinable (btree equality) clause to advance two sorted inputs. A range
predicate satisfies neither, so an index on the probed side is the only lever left.

**★ You add an expression index for a join and nothing gets faster. Why?**
Because the query reads every row anyway. Measured: 211.5 ms before and 212.6 ms after on a
200k × 200k join. The same index made the same join 59× faster once the driving side was 50
rows — indexes pay when the query is selective.

**★ How do you join a fact to the price that was valid when it happened?**
A range column plus `@>`: `ON p.sku = s.sku AND p.valid @> s.sold_at`. Guard it with an
exclusion constraint so periods cannot overlap, and index the range with GiST.

**Why half-open ranges?**
So consecutive periods meet without overlapping or leaving a gap. `[)` is the `tstzrange`
default, and it is why the June sale matched exactly one price row.

**Expression index or generated column?**
A generated stored column plus a plain index when the expression is used repeatedly — it is
visible in `\d`, cannot drift from the query text, and supports index-only scans. An
expression index when you want no extra storage and only one query needs it.

---

← [Alias discipline](12-alias-discipline.md) · [Phase index](README.md)
