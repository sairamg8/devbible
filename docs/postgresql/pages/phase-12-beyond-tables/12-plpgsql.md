---
title: "PL/pgSQL functions"
sidebar_label: "12 · PL/pgSQL"
sidebar_position: 12
---

<span className="db-tier t-know">Should Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex47-functions.mjs`.

**With an application server in front of the database you write very little
PL/pgSQL — except trigger functions, which must be written in it.** This page is
scoped to that: enough to read and write one, plus the one performance fact that
decides `sql` versus `plpgsql`.

## The two languages

```sql
-- LANGUAGE sql: a query with parameters. No control flow.
CREATE FUNCTION f_sql(c text) RETURNS TABLE (id bigint, total numeric) AS $$
  SELECT id, total FROM f_orders WHERE customer = c
$$ LANGUAGE sql STABLE;

-- LANGUAGE plpgsql: a procedural block. Variables, IF, LOOP, EXCEPTION.
CREATE FUNCTION f_plpgsql(c text) RETURNS TABLE (id bigint, total numeric) AS $$
BEGIN
  RETURN QUERY SELECT o.id, o.total FROM f_orders o WHERE o.customer = c;
END
$$ LANGUAGE plpgsql STABLE;
```

`$$` is dollar quoting — it delimits the body so you do not have to escape every
quote inside it. `$func$ ... $func$` works too and is clearer when bodies nest.

## The fact that decides which to use

A `LANGUAGE sql` function can be **inlined** into the calling query. A `plpgsql`
one cannot: it is a black box the planner calls.

```console
$ node ex47-functions.mjs
-- called on its own --
LANGUAGE sql         1.13 ms
    ->  Bitmap Heap Scan on f_orders (actual rows=60.00 loops=1)
          Index Cond: (customer = 'cust-42'::text)
LANGUAGE plpgsql     0.98 ms
    ->  Function Scan on f_plpgsql (actual rows=60.00 loops=1)
↑ different plans, SAME time: plpgsql runs the same indexed query internally.
  Inlining has not paid for itself yet.
```

**Read that carefully, because the usual claim is wrong.** The plans differ —
`Bitmap Heap Scan` against `Function Scan` — and the timings are the same. The
`plpgsql` function runs the same indexed query inside itself. Adding a predicate to
the result does not separate them either: both filtered 54 of 60 rows in under a
millisecond.

The real difference is what the planner **estimates**:

```console
-- what the planner ESTIMATES for each --
LANGUAGE sql     Bitmap Heap Scan on f_orders  (cost=4.89..213.74 rows=60 width=40)
LANGUAGE plpgsql Function Scan on f_plpgsql  (cost=0.25..10.25 rows=1000 width=40)
↑ a plpgsql function has no statistics, so the planner assumes a fixed
  1000 rows — which is what wrecks a join against it
```

**60 rows against a fixed guess of 1000.** On its own that costs nothing. Join the
function against another table and the planner picks a strategy for 1000 rows when
there are 60 — the wrong join type, the wrong drive side — and *that* is where the
cost appears.

So the rule is: **if the body is a single query, write `LANGUAGE sql`.** It inlines,
the planner sees real statistics, and it composes into larger queries. Reach for
`plpgsql` only when you need control flow.

## Volatility is not decoration

```console
=== 2. VOLATILE blocks inlining, even for LANGUAGE sql ===
sql VOLATILE         0.90 ms
    ->  Function Scan on f_sql_volatile (actual rows=60.00 loops=1)
↑ same body as f_sql, only the volatility marker differs
```

Identical body, one word different, and inlining stops. Volatility is a promise you
make to the planner:

| Marker | Promise | Planner may |
|---|---|---|
| `IMMUTABLE` | same inputs → same output, forever | fold to a constant, use in an index |
| `STABLE` | same within one statement | inline, use for index scans |
| `VOLATILE` (default) | no promise | must call it per row, cannot inline |

**`VOLATILE` is the default**, so a function you forgot to mark gets the worst
treatment. Mark every read-only function `STABLE`, and anything depending only on
its arguments `IMMUTABLE`.

`IMMUTABLE` earns its keep by being foldable:

```console
IMMUTABLE function in a WHERE clause over 3 rows → 3 rows kept
  plan shows the call folded to a constant:
    Seq Scan on f_orders
      Filter: (total > '1'::numeric)
```

The call vanished from the plan entirely — it was evaluated once at planning time
and replaced with `'1'`. It is also the requirement for using a function in an
index, which is the `42P17` error from
[Indexing jsonb](03-index-jsonb.md) and
[full-text search](05-full-text/02-indexing-and-ranking.md).

**Lying about volatility gives wrong answers, not errors.** Mark something
`IMMUTABLE` that reads a table and the planner will cache a result that later
changes.

## Where you actually need it: trigger functions

A trigger body must be `plpgsql`, and the ones worth writing are short:

```sql
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;
```

`NEW`, `OLD`, `RETURN NEW`, `RETURN NULL` and `TG_OP`/`TG_NAME`/`TG_LEVEL` are
essentially the whole vocabulary. The firing rules and their measured costs are in
[Triggers](08-triggers.md); the `updated_at` case is in
[created_at/updated_at](../phase-9-api-crud/17-timestamps-trigger.md).

## Raising errors the application can map

```sql
RAISE EXCEPTION 'insufficient stock for sku %', v_sku
  USING ERRCODE = '23514', HINT = 'check availability first';
```

`RAISE EXCEPTION` reaches the driver as an ordinary error, so `USING ERRCODE`
lets the application map it exactly as it maps a constraint violation — see
[Errors to HTTP](../phase-9-api-crud/01-repository/03-errors-to-http.md). Without
an explicit code you get `P0001 raise_exception`, which is fine as a catch-all and
useless for distinguishing cases.

Use SQLSTATEs from the `23xxx` integrity class for validation failures, or
PostgreSQL's user-defined range, rather than inventing codes that collide.

## When logic genuinely belongs in the database

Rarely, in a stack with an application server — and the honest list is short:

- **Trigger bodies.** No choice.
- **Data-heavy loops that would otherwise round-trip per row** — but check first
  whether a single statement with a CTE or
  [set-returning function](10-srf.md) does it, because it usually does.
- **An invariant that must hold no matter which client writes**, where a `CHECK`
  constraint cannot express it.

Everything else belongs in the application: it is testable with your normal tools,
visible in code review, deployable with your normal process, and readable by people
who do not know PL/pgSQL. A function in the database is deployed by a migration,
versioned only if you remember, and invisible from the application's source.

## Trade-off

PL/pgSQL runs next to the data, so a loop that would be a round trip per row
becomes one call. That is a genuine win in the narrow case where the work is
data-heavy and cannot be expressed as a single statement.

Against that: it is a second language in your stack, with its own testing story,
its own deployment path, and no type checking against the application. Debugging
means `RAISE NOTICE`. And each function is a black box to the planner — measured
above, a fixed estimate of 1000 rows regardless of reality.

The default that holds up: **`LANGUAGE sql` for anything that is one query,
`plpgsql` for triggers, and the application for everything else.**

## Gotchas

**Symptom:** A function is not inlined and joins against it plan badly
**Cause:** It is `plpgsql`, which the planner cannot see inside — measured, a fixed
estimate of 1000 rows against an actual 60.
**Fix:** `LANGUAGE sql` if the body is a single query.

**Symptom:** A `LANGUAGE sql` function is still not inlined
**Cause:** It is `VOLATILE`, the default. Measured: same body, one marker
different, and the plan became a `Function Scan`.
**Fix:** Mark it `STABLE`, or `IMMUTABLE` if it depends only on its arguments.

**Symptom:** `42P17 functions in index expression must be marked IMMUTABLE`
**Cause:** Indexing an expression calling a `STABLE` or `VOLATILE` function.
**Fix:** Make it genuinely immutable and mark it so — but only if it truly is.

**Symptom:** A cached result is stale
**Cause:** A function marked `IMMUTABLE` that actually reads a table.
**Fix:** `STABLE`. Volatility is a promise; breaking it gives wrong answers rather
than errors.

**Symptom:** Every application error from a function looks the same
**Cause:** `RAISE EXCEPTION` without `USING ERRCODE` gives `P0001` for everything.
**Fix:** Set an explicit SQLSTATE the application can switch on.

**Symptom:** `RETURN QUERY` returns nothing although the query has rows
**Cause:** A parameter name shadows a column name, so `WHERE customer = customer`
is always true or always compares a column with itself.
**Fix:** Prefix parameters (`p_customer`), or qualify columns with a table alias.

## Interview questions

**★ When would you write `LANGUAGE sql` rather than `plpgsql`?**
Whenever the body is a single query. A `sql` function can be inlined into the
calling query, so the planner sees the underlying table and its statistics —
measured, an estimate of 60 rows against `plpgsql`'s fixed guess of 1000. On a
standalone call the two took the same time; the estimate is what matters once you
join against the function.

**★ What do the volatility markers do?**
They tell the planner what it may assume. `IMMUTABLE` — same inputs, same output
forever — can be folded to a constant at planning time and used in an index.
`STABLE` — constant within a statement — can be inlined. `VOLATILE`, the default,
must be called per row and blocks inlining: measured, the same `sql` body became a
`Function Scan` purely from the marker.

**★ What happens if you mark a function `IMMUTABLE` and it is not?**
You get wrong answers rather than an error — the planner caches or folds a result
that later changes. Volatility is a promise you are trusted to keep.

**★ Where does PL/pgSQL genuinely belong?**
Trigger bodies, which have no alternative; occasionally a data-heavy loop that
cannot be written as one statement. Everything else belongs in the application,
where it is testable, reviewable, deployable and readable by people who do not know
the language.

**How do you make an error from a function usable by the application?**
`RAISE EXCEPTION ... USING ERRCODE = '23514'`. It reaches the driver as an ordinary
error with that SQLSTATE, so the same mapping that handles constraint violations
handles it. Without an explicit code everything is `P0001`.

---

← [Materialized views](11-matviews.md) · Next → [LISTEN/NOTIFY](13-listen-notify.md)
