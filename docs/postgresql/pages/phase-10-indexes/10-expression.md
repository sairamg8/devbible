---
title: "Expression indexes"
sidebar_label: "10 · Expression indexes"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`,
> server `TimeZone: UTC`), **Node 24.19.0** (`TZ: Asia/Calcutta`), `pg` 8.23.0.
> Script: `sandbox/pg-api/ex25-index-kinds.mjs`.

**If your query cannot stop calling a function on the column, index the function's result
instead. The catch: the query must spell the expression identically, and PostgreSQL will
only index expressions it considers `IMMUTABLE` — which rules out most of the date
expressions people try first.**

## 1170× on the canonical case

400 000 rows with an ordinary index on `email`:

```console
$ node ex25-index-kinds.mjs
=== 3. expression indexes ===
lower(email), plain index    : ->  Parallel Seq Scan on e_users → 97.245 ms
lower(email), expression idx : Index Scan using e_users_lower_email_idx → 0.083 ms
```

```sql
CREATE INDEX e_users_lower_email_idx ON e_users (lower(email));
```

**97.245 ms → 0.083 ms.** The index stores the lowercased value, so `WHERE lower(email) =
'…'` is a direct lookup.

## It matches the expression, not the column

```console
upper(email) instead         : ->  Parallel Seq Scan on e_users → 99.460 ms
bare email (the other index) : Index Scan using e_users_email_idx → 0.108 ms
```

`upper(email)` is a *different expression* — the `lower()` index is useless to it, and so
is the plain one. The plain index on `email` still serves the bare-column query.

**Each expression you query needs its own index.** That is the real cost: three
case-insensitive query shapes mean three indexes, or one normalisation decision made once
when the row is written.

## The immutability rule — the part that surprises people

`created_at` is `timestamptz`. Every one of these looks reasonable; three are rejected:

```console
-- which date expressions may be indexed at all (created_at is timestamptz) --
  42P17   (created_at::date) → functions in index expression must be marked IMMUTABLE
  OK      ((created_at AT TIME ZONE 'UTC')::date)
  42P17   (date_trunc('day', created_at)) → functions in index expression must be marked IMMUTABLE
  OK      (date_trunc('day', created_at, 'UTC'))
  OK      (created_ts::date)  -- plain timestamp
  42P17   (age(created_at)) → functions in index expression must be marked IMMUTABLE
```

The pattern is exact: **anything whose result depends on the session's `TimeZone` is
`STABLE`, not `IMMUTABLE`, and cannot be indexed.** `timestamptz::date` gives a different
answer to a session in Asia/Calcutta than to one in UTC, so the index would be wrong for
somebody.

Two ways through, both shown above to work:

```sql
-- name the zone explicitly
CREATE INDEX ON e_users ((date_trunc('day', created_at, 'UTC')));
CREATE INDEX ON e_users (((created_at AT TIME ZONE 'UTC')::date));

-- or index a plain `timestamp` column, which has no session dependency
CREATE INDEX ON e_users ((created_ts::date));
```

```console
date_trunc(...,'UTC'), expr idx: ->  Index Scan using e_users_day_idx on e_users → 9.530 ms
```

`date_trunc(field, timestamptz, zone)` — the three-argument form — is the one to
remember. `age()` fails for the same family of reasons: it depends on `now()`.

## They come with their own statistics

```console
pg_stats rows for the expression indexes:
┌─────────┬───────────────────────────┬──────────────┬────────────┐
│ (index) │ tablename                 │ attname      │ n_distinct │
├─────────┼───────────────────────────┼──────────────┼────────────┤
│ 0       │ 'e_users_day_idx'         │ 'date_trunc' │ 6          │
│ 1       │ 'e_users_lower_email_idx' │ 'lower'      │ -1         │
└─────────┴───────────────────────────┴──────────────┴────────────┘
```

`ANALYZE` collects statistics **for the expression itself**, listed in `pg_stats` under
the index name. That is a real second benefit: without the index the planner has no idea
how selective `date_trunc('day', created_at, 'UTC') = …` is and falls back on a default
guess. Here it knows there are 6 distinct days, and `lower(email)` is
`n_distinct = -1` — unique per row.

Creating an expression index purely to give the planner statistics is a legitimate, if
unusual, move.

## In SQL

```sql
-- note the doubled parentheses for a bare expression; a function call needs only one pair
CREATE INDEX ON t ((a + b));
CREATE INDEX ON t (lower(email));
CREATE UNIQUE INDEX ON users (lower(email));       -- case-insensitive uniqueness
CREATE INDEX ON t ((data->>'sku'));                -- one jsonb field, B-tree, cheap
CREATE INDEX ON t (md5(long_text));                -- index a hash of a very long value

-- what got indexed
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'e_users';
```

`CREATE UNIQUE INDEX ON users (lower(email))` deserves its own mention — it is how you
enforce case-insensitive uniqueness without the `citext` extension.

## From Node

Normalise once on write, or index the expression — pick one, and be consistent:

```js
// A. normalise on write, plain index, no expression needed anywhere
await pool.query(`INSERT INTO users (email) VALUES (lower($1))`, [input]);
await pool.query(`SELECT * FROM users WHERE email = lower($1)`, [input]);

// B. keep the original casing, index the expression
// CREATE INDEX ON users (lower(email));
await pool.query(`SELECT * FROM users WHERE lower(email) = lower($1)`, [input]);
```

Option B is what you want when the stored value must keep the user's own capitalisation.
Note that `lower($1)` on the *parameter* side is free — it is evaluated once, not per
row. The expression that has to match the index is the one on the column.

For dates, keep the zone explicit on both sides:

```js
const {rows} = await pool.query(
  `SELECT count(*) FROM e_users
   WHERE date_trunc('day', created_at, 'UTC') = date_trunc('day', $1::timestamptz, 'UTC')`,
  [when]);
```

## Trade-off

**An expression index is a second physical copy of a derived value, maintained on every
write, and it only serves the exact expression it stores.** `lower(email)` does not help
`upper(email)`; `date_trunc('day', …)` does not help `date_trunc('month', …)`.

Often the better answer is to stop deriving at read time: store the normalised value in
its own column — a `GENERATED ALWAYS AS (…) STORED` column, indexed normally — so the
expression is written once, visible in `\d`, and usable by any query without matching a
string exactly. The cost is a wider row.

## Gotchas

**Symptom:** `functions in index expression must be marked IMMUTABLE` (`42P17`)
**Cause:** The expression depends on the session `TimeZone` or on `now()`
**Fix:** Name the zone — `date_trunc('day', ts, 'UTC')` — or index a plain `timestamp`

**Symptom:** Expression index exists, query still sequential-scans
**Cause:** The query's expression differs — `upper` vs `lower`, a different `date_trunc`
unit, an extra cast
**Fix:** Compare `indexdef` against the query text; they must match

**Symptom:** `CREATE INDEX ON t (a + b)` is a syntax error
**Cause:** A bare expression needs a second pair of parentheses
**Fix:** `CREATE INDEX ON t ((a + b))`

**Symptom:** Row estimates are badly wrong for a query on an expression
**Cause:** No statistics exist for an expression until an index on it does
**Fix:** Create the index (and `ANALYZE`) — the statistics appear in `pg_stats` under the
index name

**Symptom:** Index on `(data->>'sku')` unused for `data @> '{"sku":"x"}'`
**Cause:** Different operators need different indexes — `->>` is B-tree, `@>` is
[GIN](11-gin-trgm.md)
**Fix:** Index the operator you actually query with

## Interview questions

**★ Why would you index an expression?**
Because a function around a column defeats an ordinary index. Measured: `WHERE
lower(email) = …` went from 97.2 ms to 0.083 ms once `lower(email)` was indexed.

**★ Why can't you index `created_at::date` on a `timestamptz`?**
The result depends on the session `TimeZone`, so the function is `STABLE`, not
`IMMUTABLE`, and the index would be wrong for other sessions — `42P17`. Use
`date_trunc('day', created_at, 'UTC')` or `(created_at AT TIME ZONE 'UTC')::date`.

**★ Does an index on `lower(email)` help `WHERE email = $1`?**
No. They are different values. Keep both indexes, or normalise on write.

**How do you enforce case-insensitive uniqueness?**
`CREATE UNIQUE INDEX ON users (lower(email))`.

**What is the second, less obvious benefit of an expression index?**
`ANALYZE` gathers statistics for the expression, so the planner stops guessing its
selectivity. Measured: `n_distinct = 6` for the day-truncation expression.

**When is a generated column better?**
When several query shapes need the derived value, or when you want it visible in the
schema — it removes the requirement to spell the expression identically everywhere.

---

← [Partial indexes](09-partial.md) · Next → [GIN, jsonb, arrays, FTS and trigrams](11-gin-trgm.md)
