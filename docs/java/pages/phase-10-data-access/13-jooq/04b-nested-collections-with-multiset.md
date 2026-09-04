---
title: "MULTISET nests a whole child collection into one column of the parent row, which turns the parent-with-children query from a fan-out or an N+1 into a single flat statement with a typed tree coming back"
sidebar_label: "04b · Nested collections with MULTISET"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *MULTISET value constructor*
> ([multiset-value-constructor](https://www.jooq.org/doc/latest/manual/sql-building/column-expressions/multiset-value-constructor/))
> and *POJOs* ([sql-execution/fetching/pojos](https://www.jooq.org/doc/latest/manual/sql-execution/fetching/pojos/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.1, PostgreSQL 18.

**Every data-access technology has to answer the same question: how do you load an order with its
lines in one round trip without multiplying the order across every line? JPA answers with a fetch
join and deduplication, and with the collection-fetch restrictions that follow. jOOQ answers by
changing the *projection* — `MULTISET` makes the child collection a single column value, so the
parent row stays one row and the children arrive nested inside it. The manual calls it "one of
jOOQ's and standard SQL's most powerful features", and for once that is not marketing.**

## The problem it removes

Two bad options, both familiar:

- **Join and fan out.** One query, and the parent appears once per child. You deduplicate in
  memory, the row count is `parents × children`, and any aggregate over the result is wrong.
- **Query per parent.** No fan-out, and now you have the N+1 that
  **[Topic 08 · The N+1 problem](../08-the-n-plus-1-problem/README.md)** exists to describe.

`MULTISET` is a third option that has neither property.

## The syntax

```java
var result =
    create.select(
              ORDER.ID,
              ORDER.PLACED_AT,
              multiset(
                  select(ORDER_LINE.SKU, ORDER_LINE.QUANTITY, ORDER_LINE.PRICE)
                      .from(ORDER_LINE)
                      .where(ORDER_LINE.ORDER_ID.eq(ORDER.ID))
              ).as("lines"))
          .from(ORDER)
          .where(ORDER.STATUS.eq("SHIPPED"))
          .fetch();
```

**One row per order.** The `lines` column holds a nested `Result` of `Record3<String, Integer,
BigDecimal>` — a collection, typed, per row. The correlation to the outer query
(`ORDER_LINE.ORDER_ID.eq(ORDER.ID)`) is what makes each parent get its own children.

`MULTISET_AGG` is the aggregate-function counterpart, for when the children come from a `GROUP BY`
rather than from a correlated subquery.

## Mapping it into a DTO tree

A nested `Result` is usable but not what you want to return. The manual's route is a
`RecordMapper`, most conveniently through an **ad-hoc converter** attached directly to the
multiset expression:

```java
record Line(String sku, int quantity, BigDecimal price) { }
record Order(Long id, OffsetDateTime placedAt, List<Line> lines) { }

List<Order> orders =
    create.select(
              ORDER.ID,
              ORDER.PLACED_AT,
              multiset(
                  select(ORDER_LINE.SKU, ORDER_LINE.QUANTITY, ORDER_LINE.PRICE)
                      .from(ORDER_LINE)
                      .where(ORDER_LINE.ORDER_ID.eq(ORDER.ID))
              ).convertFrom(r -> r.map(Records.mapping(Line::new))))
          .from(ORDER)
          .fetch(Records.mapping(Order::new));
```

🔴 **`convertFrom` is the important piece.** It attaches the conversion to the *field*, so the
multiset column's Java type becomes `List<Line>` and the outer mapping then sees a shape that
matches the `Order` record's canonical constructor exactly. The whole tree is typed, and the
positional-constructor caution from **[04 · Mapping results](04-mapping-results.md)** applies at
every level.

**This is the feature that makes jOOQ competitive with an ORM for read models**, and it is worth
being explicit about why: you get a nested object graph from one statement, with the SQL fully
under your control, and no session, no proxies and no lazy loading anywhere in the picture.

## How it runs on PostgreSQL, and why that matters

The manual is clear that `MULTISET` is **native on Informix and Oracle** and **emulated
everywhere else**. The emulations are per dialect:

| Dialect group | Emulation |
|---|---|
| **PostgreSQL** | **JSONB aggregation with array structures** |
| MySQL | JSON merge functions |
| SQLite | JSON group arrays |
| DB2, SQL Server, Teradata | XML |
| DuckDB, Snowflake | `ARRAY` |
| Firebird, Sybase, Redshift | **unsupported** |

⚠️ **On PostgreSQL your nested collection travels as JSONB and is parsed on the client.** Several
things follow, and none of them are obvious from the Java:

- **The types survive because jOOQ knows them**, not because JSON does. jOOQ generates the
  aggregation with the structure it needs to convert back, which is why hand-written
  `jsonb_agg` and `MULTISET` are not the same thing.
- **The database does the aggregation.** The nesting is server-side work, and the client does the
  parsing. That is a different cost profile from a flat join, and it is a real cost — it is simply
  not the fan-out cost.
- **A very large nested collection is a very large JSONB value in a single column.** There is no
  streaming inside a multiset; the whole child collection for a parent row materialises at once.

🔴 **Do not carry a "MULTISET is always faster" claim into a design.** It removes fan-out and it
removes round trips, and it adds aggregation and parsing. Which wins depends on the shape of the
data, and this bible has no measurements to offer — see
**[08 · jOOQ vs JPA](08-jooq-vs-jpa.md)** for where the honest comparisons sit.

## Gotchas

**★ Forgetting the correlation predicate gives every parent every child.** Drop
`ORDER_LINE.ORDER_ID.eq(ORDER.ID)` and the subquery is uncorrelated: it still compiles, still
runs, and every order gets the entire `order_line` table. On a small test dataset that can even
look plausible.

**★ `MULTISET` is unsupported on Firebird, Sybase and Redshift.** Not emulated — unsupported. A
codebase that adopts multisets heavily has quietly chosen its portable dialect set.

**★ The emulation is dialect-specific, so the rendered SQL is unrecognisable.** Debugging a
multiset query on PostgreSQL means reading generated JSONB aggregation. That is a real cost when
a DBA asks what the application is doing.

**★ Ordering inside the collection needs an `orderBy` in the subquery.** There is no ordering
guarantee on the nested rows otherwise, and the order you happen to observe in development is not
a contract.

**★ Nesting multisets inside multisets works and compounds.** Order → lines → line adjustments is
three levels of aggregation in one statement. It is a legitimate thing to do and a good way to
build a query whose plan nobody can read.

**★ There is no `LIMIT` on the nested collection unless you put one in the subquery.** "The order
with its first ten lines" is expressible; "the order with its lines, and I'll take ten in Java" has
already fetched all of them.

**★ A multiset column cannot be filtered on from the outer query in the way a join can.** Filtering
parents by a property of their children is a `WHERE EXISTS` or a semi join —
**[03c · Joins and aliasing](03c-joins-and-aliasing.md)** — not a predicate on the multiset.

**★ `convertFrom` changes the field's Java type, which changes the outer mapping's arity
requirement.** Adding it, or removing it, alters what the enclosing `Records.mapping(...)`
expects. The error is a mapping failure at runtime, not a compile error, when types coincide.

**★ Empty collections come back as empty, not null — but check rather than assume.** Code that
guards for `null` and code that guards for `isEmpty()` are both cheap; picking the wrong one and
being confident is not.

**★ A multiset over a large child table per parent is a memory decision.** The nested result for
each parent is fully materialised. A parent with fifty thousand children is one very large value,
and no cursor or fetch size reaches inside it.

**★ It does not work in every clause.** It is a *column expression*, so it belongs in the
projection. Trying to use one as a join target or a grouping key is a different query.

**★ People reach for `jsonb_agg` by hand because they know PostgreSQL, and lose the typing.** The
hand-written version returns a `JSONB` you must parse yourself. `MULTISET` returns typed records.
If you are on jOOQ, the DSL version is the one that keeps the compile-time guarantee.

## Interview questions

**★ What does `MULTISET` do?** It nests a whole child collection into a single column of the parent
row, so a parent-with-children query is one statement with one row per parent and a typed
collection inside each row.

**★ Which two problems does it replace?** Join fan-out — the parent repeated once per child, with
deduplication and wrong aggregates — and the N+1 of one child query per parent.

**★ How does it run on PostgreSQL?** Emulated, as JSONB aggregation with array structures. It is
native only on Informix and Oracle; other dialects use JSON, XML or `ARRAY` emulations, and
Firebird, Sybase and Redshift do not support it at all.

**★ If it is JSONB on the wire, how do the Java types survive?** Because jOOQ generated both the
aggregation and the conversion. It knows the record type of the subquery, so it can reconstruct
typed records from the JSON. Hand-written `jsonb_agg` gives you a `JSONB` and nothing else.

**★ How do you turn the nested `Result` into a `List` of your own type?** `convertFrom` on the
multiset expression, with a `RecordMapper` — typically `Records.mapping(Line::new)` — so the
column's Java type becomes `List<Line>` and the outer mapping sees the shape your parent record's
constructor expects.

**★ What happens if you omit the correlation predicate in the subquery?** The subquery is
uncorrelated and every parent row receives the entire child table. It compiles and runs, so the
only signal is the data.

**★ How do you order the nested collection?** With an `orderBy` inside the subquery. There is no
ordering guarantee otherwise, and observed order in development is not a contract.

**★ Is `MULTISET` faster than a join?** It is *different*. It removes fan-out and round trips, and
adds server-side aggregation and client-side parsing. Which is faster depends on the data shape,
and claiming a general answer without measuring it is exactly the kind of claim that gets repeated
until someone believes it.

**★ Can you filter parents by something about their children using a multiset?** No — that is a
semi join or a `WHERE EXISTS`. A multiset is a column expression that shapes the output; it does
not participate in filtering the parent set.

**★ What is `MULTISET_AGG` for?** It is the aggregate-function form, for building the nested
collection out of a `GROUP BY` rather than a correlated subquery.

**★ What is the memory characteristic of a multiset?** Each parent row's whole child collection is
materialised at once. Lazy fetching and fetch size operate on the outer rows and do not reach
inside a nested collection.

**★ Why is a multiset query harder to hand to a DBA?** Because the rendered SQL is the dialect's
emulation — JSONB aggregation on PostgreSQL — rather than anything resembling the Java. It is
readable, but it is not what the developer wrote, and that gap is a genuine operational cost.

{/* FOOTER */}
