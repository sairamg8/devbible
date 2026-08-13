---
title: "Materialized views and REFRESH CONCURRENTLY"
sidebar_label: "11 · Materialized views"
sidebar_position: 11
---

<span className="db-tier t-know">Should Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex46-views-triggers.mjs`.

**A materialized view is a table that remembers the query that filled it.** It
trades freshness for speed — and nothing refreshes it for you, which is the whole
of the design problem.

## It stores its result

```sql
CREATE MATERIALIZED VIEW mv_totals AS
SELECT customer, sum(total) AS lifetime, count(*)::int AS orders
  FROM v_orders GROUP BY customer;
```

```console
$ node ex46-views-triggers.mjs
=== 11. a materialized view stores its result ===
CREATE MATERIALIZED VIEW: 122 ms
matview size: 256 kB | plain view size: 0 bytes
query the plain view       0.6 ms
query the matview         0.88 ms  (no index yet)
matview + index           0.51 ms
```

**256 kB against a plain view's 0 bytes** — the aggregate over 300 000 orders is
now 5000 stored rows.

Note the middle two lines honestly: for *this* query the plain view was already
fast (0.6 ms), because filtering on the `GROUP BY` key pushes down into an index —
see [Views](07-views.md). The matview only pulled ahead once it had its own index,
at 0.51 ms.

**That is the real lesson: a materialized view is not automatically faster.** It
wins when the underlying query is genuinely expensive *and cannot be made cheap by
pushdown* — the aggregate-filter case from the views page, which took 135.8 ms
against 0.8 ms. Against a query the planner can already optimise, you have added
storage and staleness for very little.

**A matview needs its own indexes.** It is a table; nothing is inherited from the
base tables.

## `REFRESH`, and why `CONCURRENTLY` needs a unique index

```console
=== 12. REFRESH, and why CONCURRENTLY needs a unique index ===
REFRESH ... CONCURRENTLY with no unique index  → 55000 cannot refresh materialized view "public.mv_totals" concurrently

REFRESH                   142 ms
REFRESH CONCURRENTLY      227 ms   (1.6x slower)
```

`REFRESH MATERIALIZED VIEW CONCURRENTLY` fails with `55000` until the view has a
**unique index**:

```sql
CREATE UNIQUE INDEX mv_totals_pk ON mv_totals (customer);
```

The reason is mechanical: `CONCURRENTLY` computes the new result into a temporary
relation and then *diffs* it against the old one, applying only the changed rows.
Diffing requires a key that identifies a row on both sides. Without one there is
no way to match old to new, so it refuses.

`CONCURRENTLY` is **1.6× slower** — it builds the result and then does the
comparison work, rather than swapping in the new data wholesale.

## What each one does to a reader

```console
=== 13. what each REFRESH does to a concurrent reader ===
reader waited during plain REFRESH        : 32 ms
reader waited during REFRESH CONCURRENTLY : 2 ms
↑ plain REFRESH takes an AccessExclusiveLock; CONCURRENTLY does not block readers
```

A plain `REFRESH` takes an **`AccessExclusiveLock`**: every reader blocks for the
whole refresh. The reader here waited 32 ms — the remainder of the 142 ms refresh
from when it arrived. On a matview that takes 30 seconds to rebuild, that is a
30-second outage for every query against it.

`CONCURRENTLY` took `ExclusiveLock` instead, which does not conflict with reads:
the reader waited **2 ms**, essentially not at all.

So the trade is explicit: **`CONCURRENTLY` is 1.6× slower and blocks nobody;
plain `REFRESH` is faster and stops the world.** For anything user-facing, pay the
1.6×. Plain `REFRESH` is for a matview nothing reads during the refresh window —
a nightly rebuild before the business day, for instance.

Both hold their lock for the *entire* refresh, and both do the full query — there
is no incremental refresh in PostgreSQL. A matview over a query that takes two
minutes costs two minutes of work every time, however few rows changed.

## Staleness is yours to manage

```console
=== 14. staleness and WITH NO DATA ===
matview before the insert: 26820.00
matview after  the insert: 26820.00 ← unchanged; nothing refreshes it for you
```

An order was inserted and the matview did not move. There is no automatic
refresh, no invalidation, no TTL. Until you run `REFRESH`, every reader sees the
old answer and nothing indicates it is old.

The options, in the order they are usually right:

1. **A scheduled refresh** — cron, `pg_cron`, or your job runner. Simple, and the
   staleness window is known and stated.
2. **Refresh after the writes that matter**, from application code at the end of
   the job that changes the data.
3. **A trigger-driven refresh** — almost always wrong. It puts a full recompute
   inside a write transaction, so a single-row insert pays for the whole
   aggregate. If freshness matters that much, you want an incrementally
   maintained summary table with triggers updating *counters*, not a matview.

**Record when it was refreshed**, so consumers can display it:

```sql
SELECT last_refresh FROM mv_meta WHERE name = 'mv_totals';
```

A dashboard showing "as of 04:00" is honest. A dashboard silently showing
yesterday's numbers is a bug report waiting to happen.

## `WITH NO DATA`

```console
SELECT from a WITH NO DATA matview             → 55000 materialized view "mv_empty" has not been populated
after REFRESH: [ { x: 1 } ]
pg_class.relispopulated = true
```

`CREATE MATERIALIZED VIEW ... WITH NO DATA` creates the definition without running
the query — useful in a migration where you want the object to exist and the
expensive build to happen later. Querying it before it is populated raises
`55000`.

`pg_class.relispopulated` tells you which state it is in, which is what a
health check should look at:

```sql
SELECT relname, relispopulated FROM pg_class WHERE relkind = 'm';
```

## Trade-off

A materialized view buys a fast read of an expensive query, and pays in three
currencies: **storage** (the full result, plus its indexes), **staleness** (bounded
only by your refresh schedule), and **refresh cost** (the entire query, every
time, however little changed).

It is the right tool when the query is expensive, the data changes far less often
than it is read, and consumers can tolerate a known lag — reporting, dashboards,
leaderboards, aggregated search facets.

It is the wrong tool when readers need current data, when the base data changes
constantly (you will spend more on refreshing than on the original query), or when
the underlying query is only slow because of a missing index. **Check the plan
first** — the measurement above showed a plain view answering in 0.6 ms because
the predicate pushed into an index. Reaching for a matview there would add
storage and staleness to solve a problem that did not exist.

The alternative worth knowing: a **summary table maintained by triggers**, updated
incrementally on write. More machinery, always current, and it does not recompute
the world. That is the trade when the refresh cost of a matview stops fitting in
the window you have.

## Gotchas

**Symptom:** `55000 cannot refresh materialized view ... concurrently`
**Cause:** No unique index. `CONCURRENTLY` diffs old against new and needs a key
to match rows.
**Fix:** `CREATE UNIQUE INDEX` on a column set that is unique across the result.

**Symptom:** Every query against the matview hangs during a refresh
**Cause:** Plain `REFRESH` takes an `AccessExclusiveLock`. Measured: a reader
waited 32 ms of a 142 ms refresh — scale that to a slow matview.
**Fix:** `REFRESH ... CONCURRENTLY`, accepting 1.6× the refresh time.

**Symptom:** The matview shows stale data
**Cause:** Nothing refreshes it. Measured: an insert left the value unchanged.
**Fix:** Schedule a refresh, and expose the last-refreshed time to consumers.

**Symptom:** `55000 materialized view has not been populated`
**Cause:** Created `WITH NO DATA` and never refreshed.
**Fix:** `REFRESH`; check `pg_class.relispopulated` in a health check.

**Symptom:** Queries against the matview are still slow
**Cause:** It has no indexes — it is a table, and inherits nothing from the base
tables.
**Fix:** Index it as you would any table. Measured: 0.88 ms → 0.51 ms.

**Symptom:** A matview refresh takes longer than the interval between refreshes
**Cause:** There is no incremental refresh; the full query runs every time.
**Fix:** A trigger-maintained summary table instead.

**Symptom:** Writes became slow after adding a matview
**Cause:** A trigger refreshing it, putting a full recompute inside every write
transaction.
**Fix:** Schedule the refresh instead.

## Interview questions

**★ How does a materialized view differ from a view?**
A view stores nothing and is expanded into your query at plan time; a matview
stores the result as a real table — measured, 256 kB against 0 bytes — and needs
its own indexes. The matview is fast to read and stale until refreshed.

**★ Why does `REFRESH CONCURRENTLY` require a unique index?**
Because it computes the new result and *diffs* it against the existing rows,
applying only what changed. Matching old rows to new needs a key. Without one it
raises `55000`.

**★ What is the trade between `REFRESH` and `REFRESH CONCURRENTLY`?**
Plain `REFRESH` takes an `AccessExclusiveLock` so every reader blocks for the
whole rebuild — measured, a reader waited 32 ms of a 142 ms refresh.
`CONCURRENTLY` does not block readers (2 ms) but is 1.6× slower. Pay the 1.6× for
anything user-facing.

**★ How do you handle staleness?**
Actively — there is no automatic refresh or invalidation. Schedule it, or refresh
at the end of the job that changes the data, and record and expose the last
refresh time. A trigger-driven refresh is nearly always wrong: it puts a full
recompute inside a write transaction.

**★ When is a materialized view the wrong answer?**
When readers need current data; when the base data changes so often that
refreshing costs more than the query; and when the query is only slow because of a
missing index. Measured here, a plain view answered in 0.6 ms because the
predicate pushed into an index — a matview would have added storage and staleness
for nothing. Check the plan first.

**What is the alternative when refreshes stop fitting the window?**
A summary table maintained incrementally by triggers. More machinery and always
current, because it updates counters on write rather than recomputing the whole
result.

---

← [Set-returning functions](10-srf.md) · Next → [PL/pgSQL functions](12-plpgsql.md)
