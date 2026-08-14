---
title: "09.2 · pg_stat_statements — finding the expensive query"
sidebar_label: "02 · pg_stat_statements"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [`pg_stat_statements`](https://www.postgresql.org/docs/18/pgstatstatements.html).
> **Not sandbox-measured** — no console output on this page.

**The query that is killing your database is usually not the slow one.** It is
the fast one you run fifty thousand times a minute. `pg_stat_statements` is the
only view that can tell you that, and it is the single most valuable thing you
can enable on a production PostgreSQL.

## Total time beats mean time

Consider two queries:

| Query | `calls` | `mean_exec_time` | `total_exec_time` |
|---|---|---|---|
| A nightly report | 1 | 8 000 ms | 8 000 ms |
| A per-request lookup | 500 000 | 4 ms | **2 000 000 ms** |

The report is two thousand times slower per execution. The lookup is consuming
250× more of your database. Optimise the report and nothing improves; shave 1 ms
off the lookup and you free more capacity than the report ever consumed.

This is why **`total_exec_time` is the column to sort by** and why "find the slow
query" is the wrong instinct. Slow-query logging ([11 · Logging](../11-logging/README.md))
finds individual slow statements and will never show you the second row, because
4 ms is under every threshold you would set.

## Enabling it

It is a `shared_preload_libraries` module, so it needs a **restart** — not a
reload. Plan for that; it is the only real cost of adopting it.

```conf
# postgresql.conf
shared_preload_libraries = 'pg_stat_statements'
compute_query_id = on
pg_stat_statements.max = 10000        # default 5000
pg_stat_statements.track = all        # default 'top'
```

Then, per database:

```sql
CREATE EXTENSION pg_stat_statements;
```

Both halves are required, and forgetting the second is the usual reason the view
"does not exist" after a restart.

Two settings worth deliberate choices:

- **`pg_stat_statements.max`** (default **5000**) is how many distinct statements
  are tracked. Exceeding it evicts the least-executed entries — so on a system
  with many query shapes you silently lose the long tail. Memory is proportional
  to this value; raising it to 10000 is cheap and common.
- **`pg_stat_statements.track`** (default **`top`**) tracks only top-level
  statements. Setting it to `all` also counts statements inside functions and
  procedures — necessary if meaningful work happens in PL/pgSQL, and it will
  change your numbers, because time attributed to a function call gets attributed
  to its statements instead.

`compute_query_id = on` is what makes `queryid` available. On `auto` it is
enabled when the module needs it, so this is belt-and-braces rather than strictly
required.

Also relevant: `pg_stat_statements.track_planning` defaults to **off**, so the
planning-time columns are zero until you turn it on — worth knowing before you
conclude that planning is free. `pg_stat_statements.save` defaults to **on**, so
statistics survive a restart.

## Normalisation, and the trap in it

Entries are **normalised**: literal constants are replaced with `$1`, `$2` and so
on, so that these two

```sql
SELECT * FROM orders WHERE customer_id = 42;
SELECT * FROM orders WHERE customer_id = 99;
```

become one entry with one set of counters. That is exactly what you want — it
turns a million distinct statements into one row you can reason about.

The documented consequences are worth holding:

- Normalisation is based on the **post-parse-analysis** representation, not on
  the text, so formatting and whitespace differences do not create separate
  entries — but genuinely different query *shapes* do.
- `IN` lists are collapsed and displayed as `IN ($1 /*, ... */)`.
- The representative `query` text shown is from one execution; the constants you
  see are not necessarily the interesting ones.
- **`queryid` is stable across minor versions on the same architecture but is
  *not* guaranteed stable across major versions.** Any dashboard keyed on
  `queryid` breaks at a major upgrade — a real operational detail when planning
  [17 · Major version upgrades](../17-major-upgrades.md).
- Hash collisions can, rarely, merge unrelated queries.

The trap for application developers: **queries built by string concatenation
produce a new entry per shape.** An ORM or hand-rolled builder that inlines
values rather than using parameters can fill `pg_stat_statements.max` with
thousands of near-identical entries, evict everything useful, and leave the view
worthless. That is one more reason to use `$1` parameters — alongside the
injection-safety and plan-caching reasons Phase 7 covers.

## Trade-off

`pg_stat_statements` costs a fixed slice of shared memory (proportional to
`.max`), a small amount of per-execution bookkeeping, and one **restart** to
enable. In exchange it is the only source of truth about aggregate query cost —
the thing that actually determines whether your database keeps up.

The overhead is small enough that the trade is not really in doubt; the practical
objection is the restart, which is why the right time to enable it is *before*
you need it, not during the incident where you first wish you had.

## Gotchas

**Symptom:** `relation "pg_stat_statements" does not exist` after configuring it
**Cause:** `shared_preload_libraries` loads the module; `CREATE EXTENSION`
creates the view. Both are needed, per database.
**Fix:** Run `CREATE EXTENSION pg_stat_statements;` in the database you query.

**Symptom:** Changing `shared_preload_libraries` had no effect
**Cause:** It requires a **restart**, not a reload.
**Fix:** Restart. Schedule it — this is the one genuine cost of adoption.

**Symptom:** The view is full of thousands of near-identical entries
**Cause:** Queries built by string interpolation instead of `$1` parameters, so
each value is a distinct query shape.
**Fix:** Parameterise. Otherwise `pg_stat_statements.max` (default 5000) is
exhausted and useful entries are evicted.

**Symptom:** Optimising the slowest query changed nothing
**Cause:** Sorted by `mean_exec_time` instead of `total_exec_time`. The expensive
query is usually a fast one executed constantly.
**Fix:** Sort by `total_exec_time`.

**Symptom:** Planning time is always zero
**Cause:** `pg_stat_statements.track_planning` defaults to **off**.
**Fix:** Turn it on if you suspect planning cost — it is not free to track.

**Symptom:** Statements inside functions are missing
**Cause:** `pg_stat_statements.track` defaults to `top` — top-level only.
**Fix:** Set it to `all` if real work happens in PL/pgSQL.

## Interview questions

**★ How do you find the query that is hurting your database?**
`pg_stat_statements`, ordered by `total_exec_time` — not by mean. The most
expensive query is typically a fast one called constantly: a 4 ms query run
500 000 times costs far more than a single 8-second report, and slow-query
logging will never surface it because it is under every threshold.

**★ What does `pg_stat_statements` require to enable?**
Adding it to `shared_preload_libraries`, which needs a **server restart**, plus
`CREATE EXTENSION pg_stat_statements` in each database you want to query. The
restart is the reason to enable it before you need it.

**★ What is query normalisation and what breaks it?**
Literal constants are replaced with `$1`, `$2`… so all executions of one query
shape aggregate into a single entry. Queries built by string concatenation defeat
it — every distinct value becomes its own entry, filling
`pg_stat_statements.max` (default 5000) and evicting useful rows. Parameterised
queries are what make the view usable.

**Why is `queryid` not a safe key for a long-lived dashboard?**
Because it is documented as stable across minor versions on the same
architecture but **not** guaranteed stable across major versions. Any dashboard
keyed on it breaks at a major upgrade — a real consideration when planning one.

---

← [What is happening now](01-whats-happening-now.md) · Next → [Reading it](03-reading-pg-stat-statements.md)
