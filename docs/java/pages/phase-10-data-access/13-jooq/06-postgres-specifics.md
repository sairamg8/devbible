---
title: "Window functions are the clearest case for adopting jOOQ, because they are the thing an ORM cannot express at all and the DSL renders them with the partition, order and frame all type-checked"
sidebar_label: "06 · Window functions"
sidebar_position: 21
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *Window functions*
> ([column-expressions/window-functions](https://www.jooq.org/doc/latest/manual/sql-building/column-expressions/window-functions/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.0, PostgreSQL 18.

**Ask why a team adopted jOOQ and the answer is rarely "type safety" — it is usually a specific
query somebody could not write. Running totals, rank within group, this row compared with the
previous one, the top three per category: these are window functions, they are PostgreSQL's best
feature, and an entity-per-row model has no way to express them. jOOQ renders them from a DSL
where the partition, the ordering and the frame are all ordinary typed expressions.**

## The shape

A window function is *"an aggregate or ranking value calculated over a subset of data (the window)
relative to the projected row"*. In jOOQ that is a function followed by `.over(...)`:

```java
create.select(
          ORDER.ID,
          ORDER.CUSTOMER_ID,
          ORDER.TOTAL,
          rowNumber().over(partitionBy(ORDER.CUSTOMER_ID).orderBy(ORDER.PLACED_AT.desc())),
          sum(ORDER.TOTAL).over(partitionBy(ORDER.CUSTOMER_ID)))
      .from(ORDER)
      .fetch();
```

**One row in, one row out.** That is what separates a window function from a `GROUP BY`: the
result keeps every row and adds a column computed over its neighbours. It is why "show each order
alongside its customer's running total" is one query rather than two.

## What is available

The manual lists the ranking and value functions explicitly:

| Kind | Functions |
|---|---|
| Ranking | `ROW_NUMBER`, `RANK`, `DENSE_RANK`, `PERCENT_RANK`, `CUME_DIST`, `NTILE` |
| Navigation | `LEAD`, `LAG`, `FIRST_VALUE`, `LAST_VALUE`, `NTH_VALUE` |
| Ratio | `RATIO_TO_REPORT` |

**And every aggregate function can be used as a window function** — `sum`, `count`, `avg`, `min`,
`max` and the rest, each with `.over(...)`. That is where most of the practical value is: a
running total is `sum(...).over(orderBy(...))`, and a "how many others like this row" is
`count().over(partitionBy(...))`.

```java
// the three most recent orders per customer
Field<Integer> rn = rowNumber()
        .over(partitionBy(ORDER.CUSTOMER_ID).orderBy(ORDER.PLACED_AT.desc()))
        .as("rn");

Table<?> ranked = create.select(ORDER.ID, ORDER.CUSTOMER_ID, rn).from(ORDER).asTable("ranked");

create.selectFrom(ranked).where(ranked.field(rn).le(3)).fetch();
```

⚠️ **The derived table is not optional.** A window function cannot appear in the `WHERE` clause of
the query that computes it — window functions are evaluated after `WHERE` — so filtering on a rank
always means a subquery or a CTE. That is SQL's rule, not jOOQ's, and jOOQ will let you write the
invalid version and fail at the database.

## Frames

The window can be narrower than the partition. jOOQ supports the **`ROWS`, `RANGE` and `GROUPS`**
frame clauses, plus **`EXCLUDE`**:

```java
avg(READING.VALUE)
    .over(orderBy(READING.TAKEN_AT)
    .rowsBetweenPreceding(1).andFollowing(1))
```

which renders `ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING` — a three-row sliding average.

🔴 **The default frame is the thing to know, because it is not "the whole partition".** With an
`ORDER BY` in the window and no explicit frame, SQL's default is `RANGE BETWEEN UNBOUNDED
PRECEDING AND CURRENT ROW` — which is what makes `sum(...).over(orderBy(...))` a *running* total
rather than a partition total. Remove the `ORDER BY` and the same expression becomes the partition
total. **Adding an `ORDER BY` to a window changes the result of an aggregate over it**, and that
catches everyone once.

⚠️ **`RANGE` and `ROWS` differ on ties.** With `RANGE`, all rows with the same `ORDER BY` value are
in the frame together; with `ROWS`, they are counted individually. A running total over a
duplicated timestamp gives different answers under each, and the default is `RANGE`.

## Named windows

The manual references *"the `WINDOW` clause of the `SELECT` statement"*, so a window definition can
be named once and reused:

```java
create.select(
          ORDER.ID,
          rowNumber().over(name("w")),
          sum(ORDER.TOTAL).over(name("w")))
      .from(ORDER)
      .window(name("w").as(partitionBy(ORDER.CUSTOMER_ID).orderBy(ORDER.PLACED_AT)))
      .fetch();
```

**Use it the moment two functions share a window.** Repeating `partitionBy(...).orderBy(...)` is
how one of the copies quietly acquires a different ordering.

## Why this argues for jOOQ specifically

- **JPQL has no window functions.** Not a limitation of a mapping, a limitation of the query
  language, so the ORM answer is native SQL — at which point you have given up the ORM's checking
  for that query anyway.
- **`JdbcClient` can run the SQL, and cannot check it.** Topic 05 argues the SQL-first case; jOOQ's
  version of it is the same SQL with the columns, the partition and the ordering all
  compiler-checked — see **[05 · SQL-first access](../05-sql-first-access/README.md)**.
- **The composition matters more here than anywhere else.** A window expression is a value, so a
  ranking used in three queries is one `Field` in one place rather than three copies of a clause
  nobody will keep in step.

## Gotchas

**★ Adding `orderBy` to a window changes an aggregate from a partition total to a running total.**
Same function, same partition, different number — because the default frame with an `ORDER BY` is
`UNBOUNDED PRECEDING` to `CURRENT ROW`. This is the number-one window function surprise.

**★ You cannot filter on a window function in the same query's `WHERE`.** Windows are computed
after `WHERE`, so a rank filter needs a derived table or a CTE. jOOQ builds the invalid query
happily and the database rejects it.

**★ `RANGE` and `ROWS` disagree on ties, and `RANGE` is the default.** A running total ordered by a
timestamp with duplicates includes all the tied rows at once under `RANGE`. If you meant "one row
at a time", say `ROWS`.

**★ `LAST_VALUE` with the default frame returns the current row.** Because the default frame ends
at the current row, `lastValue(...)` over an ordered window is almost never what people expect
until they add an explicit frame ending at `UNBOUNDED FOLLOWING`.

**★ `RANK` and `DENSE_RANK` differ on gaps, and `ROW_NUMBER` never ties.** Three functions that
look interchangeable and answer three different questions. Choosing by name rather than by
semantics produces a leaderboard that skips positions or invents an order among equals.

**★ Repeating a window definition across two functions invites drift.** One gets an extra
`orderBy` column in a later edit. Name the window.

**★ A window function over a partition with no ordering has a non-deterministic row order.**
`rowNumber().over(partitionBy(x))` with no `orderBy` returns *a* numbering, stable within a run
and not across runs. It looks fine in development.

**★ Window functions do not reduce the data transferred.** They add columns to every row. A
running total over a million rows still ships a million rows; the aggregation that reduces the
result is `GROUP BY`.

**★ The derived table wrapping a rank filter loses type safety on the way out.** `ranked.field(rn)`
is the string-free version, and it still returns a `Field` looked up by identity rather than a
generated constant — the caveat in
**[03c · Joins and aliasing](03c-joins-and-aliasing.md)**.

**★ Not every dialect supports every frame clause.** `GROUPS` and `EXCLUDE` are recent SQL, and
jOOQ's emulation coverage varies. On PostgreSQL 18 they are available; a query written against
that and later run elsewhere is not portable in the way jOOQ usually is.

**★ A window function inside a `MULTISET` subquery windows over the subquery's rows, not the
parent's.** Correct, and easy to misread when the two queries are visually adjacent in the same
expression.

**★ `filterWhere` on an aggregate is a PostgreSQL `FILTER` clause and is not universally
available.** It is far more readable than `sum(case when ...)`, and it is one of the places where
the SQL you write and the SQL that runs on another dialect diverge.

## Interview questions

**★ What is a window function, in one sentence?** An aggregate or ranking value computed over a
window of rows relative to the current row, without collapsing the result — one row in, one row
out.

**★ How is that different from `GROUP BY`?** `GROUP BY` reduces many rows to one. A window function
keeps every row and adds a column computed from its neighbours, which is why "each order alongside
its customer's total" is one query.

**★ Why can you not filter on a window function in `WHERE`?** Because window functions are
evaluated after the `WHERE` clause. Filtering on a rank requires computing it in a derived table
or CTE and filtering the outer query.

**★ What is the default window frame, and why does it matter?** With an `ORDER BY` in the window
and no explicit frame, it is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. It matters
because it silently turns an aggregate into a running total — adding an `ORDER BY` to a window
changes the number.

**★ What is the difference between `ROWS` and `RANGE`?** How ties are handled. `RANGE` includes
every row sharing the current row's `ORDER BY` value; `ROWS` counts physical rows. On data with
duplicate ordering values they give different answers, and `RANGE` is the default.

**★ `ROW_NUMBER`, `RANK`, `DENSE_RANK` — when do you use each?** `ROW_NUMBER` when you need a
unique sequence and ties can be broken arbitrarily; `RANK` when ties should share a position and
leave gaps; `DENSE_RANK` when ties share a position and the next value continues without a gap.

**★ Why does `LAST_VALUE` usually return the wrong thing?** Because the default frame ends at the
current row, so the "last" value in the frame is the current one. It needs an explicit frame
ending at `UNBOUNDED FOLLOWING`.

**★ How do you write "the three most recent orders per customer"?** `rowNumber()` over a partition
by customer ordered by date descending, computed in a derived table or CTE, with the outer query
filtering on the rank.

**★ How do you avoid repeating a window definition?** The `WINDOW` clause — define it once with a
name and reference it from each function. That also removes the way two copies of a window
definition drift apart.

**★ Why are window functions the strongest argument for jOOQ over an ORM?** Because JPQL cannot
express them at all, so the ORM route is native SQL — and once you are writing native SQL, the
question is only whether it is checked. jOOQ's is.

**★ Do window functions reduce the amount of data returned?** No, the opposite — they add a column
to every row. If the goal is a smaller result, that is aggregation, not windowing.

**★ Where does portability suffer?** In the newer frame clauses — `GROUPS`, `EXCLUDE` — and in
PostgreSQL-specific extras like the aggregate `FILTER` clause. All are fine on PostgreSQL 18, and
none should be assumed to survive a dialect change the way ordinary jOOQ usually does.

{/* FOOTER */}
