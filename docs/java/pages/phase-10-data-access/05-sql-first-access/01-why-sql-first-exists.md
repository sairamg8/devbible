---
title: "An entity is a model of your domain; a result set is a model of your question — and a report is a question"
sidebar_label: "1 · Why SQL-first exists"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Data Access →
> Data Access with JDBC*
> ([docs.spring.io/spring-framework/reference/data-access/jdbc.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc.html)),
> and the PostgreSQL 18 manual *Aggregate Functions* and *UPDATE*
> ([postgresql.org/docs/18/functions-aggregate.html](https://www.postgresql.org/docs/18/functions-aggregate.html),
> [.../sql-update.html](https://www.postgresql.org/docs/18/sql-update.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, PostgreSQL 18.

**An ORM maps your *tables* once and reuses that mapping for every query. SQL-first
maps your *query* — each query, separately, to whatever shape that one answer needs.
Most applications need both, and the whole of this topic is about knowing which
question you are asking. When the answer you want is a row of an entity, an entity
is the right tool. When the answer you want is "revenue by month by region", there
is no entity for that, and pretending otherwise is where the slow code comes from.**

## Two different things are called "mapping"

Say the word "mapping" to two developers and they will mean different things.

**Mapping a table.** You declare, once, that the `orders` table corresponds to an
`Order` class: this column is that field, this foreign key is that reference. Every
query about orders reuses the declaration. That is what JPA does, and its payoff is
that the mapping is written once and the framework can then do a great deal on top
of it — track which objects you changed, write them back without you asking, follow
a reference into another table on demand.

**Mapping a query.** You write a `SELECT` that produces exactly the columns you
want, and you say what one row of *that* result becomes. Nothing is declared in
advance, nothing is reused, and nothing follows from it. That is what SQL-first
access does.

The first is a model of your **domain**. The second is a model of one **question**.
They are not competitors, and the argument "ORM versus SQL" is a category error.
The real question is always: *is the answer I want shaped like a domain object?*

## When the answer is not shaped like an entity

Here is the query behind a perfectly ordinary admin dashboard: revenue per month
per region, for the last year, with the order count.

```sql
select date_trunc('month', o.placed_at)   as month,
       r.name                             as region,
       count(*)                           as order_count,
       sum(ol.quantity * ol.unit_price)   as revenue
from orders o
join order_lines ol on ol.order_id = o.id
join customers c    on c.id = o.customer_id
join regions r      on r.id = c.region_id
where o.placed_at >= now() - interval '1 year'
  and o.status = 'COMPLETED'
group by 1, 2
order by 1, 2;
```

Now ask the awkward question: **what entity is a row of that?**

There is no `MonthlyRegionalRevenue` table. There is no row in any table that
this corresponds to. The result has four columns and three of them are computed.
It is not a projection of an entity; it is a value the database calculated and
will never store.

The Java type that fits it is a record:

```java
public record RevenueByMonth(
        LocalDate month,
        String region,
        long orderCount,
        BigDecimal revenue) {}
```

…and the shortest honest way to get there is to run that SQL and map four columns
into that record. That is SQL-first access. Two lines with `JdbcClient`:

```java
List<RevenueByMonth> rows = jdbcClient
        .sql(REVENUE_BY_MONTH)          // the SQL above, as a constant
        .query(RevenueByMonth.class)
        .list();
```

The alternative — load `Order` entities, walk `getLines()`, walk
`getCustomer().getRegion()`, and sum in Java — asks the database for thousands of
rows so the JVM can compute four columns the database would have computed in one
pass. That is not a mapping problem. It is doing the work in the wrong process.

## The four shapes that push you to SQL

There are four recognisable shapes where SQL-first stops being a preference and
starts being the obvious answer. All four have the same underlying reason: **the
answer is not a domain object.**

**1 · Aggregates and reports.** Counts, sums, `group by`, window functions,
percentile ranks. There is no entity for a `sum`. Everything in the dashboard
example above.

**2 · Projections over wide tables.** A `products` table with forty columns,
three of them `jsonb` and one a `text` blob. The autocomplete dropdown needs `id`
and `name`. An entity query fetches the row — all of it, because the entity *is*
the row. A projection asks for two columns:

```sql
select id, name from products where name ilike :prefix || '%' limit 20;
```

**3 · Bulk updates.** "Archive every order older than a year."

```sql
update orders set status = 'ARCHIVED'
where placed_at < now() - interval '1 year' and status = 'COMPLETED';
```

One statement, executed entirely inside the database. Done through entities, the
same work becomes: select every matching row into memory, change a field on each,
and let the framework issue one `UPDATE` per object at flush time. The database
never sees the *set*; it sees a stream of single-row updates.

**4 · Anything where the exact SQL matters.** A query you tuned against a specific
index. A `LATERAL` join. `SELECT ... FOR UPDATE SKIP LOCKED` to drain a work queue
(see **[Locking and `SELECT FOR UPDATE`](../03-jdbc-transactions/12-locking-and-select-for-update.md)**).
A recursive CTE. These are not exotic — they are the queries you write once and
then need to *stay* written that way. If the SQL is load-bearing, own it.

## Gotchas

**"SQL-first" is not permission to concatenate strings.**
Every argument in this chunk is about choosing SQL over an entity graph. None of it
is about how the SQL gets its values. Parameters are bound, always — `?` or
`:name`, never `+ userInput +`. The injection story is unchanged from
**[`PreparedStatement` and injection](../01-jdbc/05-preparedstatement-and-injection.md)**,
and it does not get safer because a Spring class is holding the string.

**A dashboard built out of entities looks fine in development and dies in
production.** With fifty orders in your local database, walking
`order.getLines()` in a loop is instant. The behaviour that kills it — one query
per order — is invisible at that size, and the growth is linear in a number that
is not a number anyone tests with. This is the N+1 problem, and it gets its own
topic: [Topic 08 · The N+1 problem](../08-the-n-plus-1-problem/README.md).

**The wide-table projection argument reverses for narrow tables.** If a table has
six columns and you need four, fetching the entity costs almost nothing extra and
buys you a mapping you already have. The projection argument earns its keep on
tables with large columns — `jsonb`, `text`, `bytea` — where the columns you did
not ask for are the expensive ones. Do not turn "select only what you need" into a
ritual applied to a table of integers.

**The database being faster at aggregation is not universal, it is
situational.** It is faster here because it can aggregate while scanning, using
indexes and a fraction of the memory, and because the alternative ships every
contributing row across the network. If your aggregate is over 200 rows you
already have in memory for another reason, doing it in Java is fine. The argument
is about data volume and locality, not about SQL being magic.

## Interview questions

**★ When would you choose `JdbcTemplate` or `JdbcClient` over JPA?**
When the result is not shaped like an entity. Three concrete cases. Reports and
aggregates, because there is no entity corresponding to `sum(...) group by month`
and forcing one means shipping every contributing row to the JVM to compute
something the database computes while scanning. Projections over wide tables,
because an entity query fetches the whole row by definition, and if the row
carries `jsonb` and `text` columns you are paying for forty columns to display
two. And bulk updates, because a single `UPDATE ... WHERE` runs entirely inside
the database, whereas the entity route selects every matching row into memory and
issues one statement per object. The fourth, softer case is any query whose exact
plan matters to you — a tuned index hit, a `LATERAL`, a recursive CTE — where you
want the SQL to be the thing that is written down rather than the output of a
query generator.

**★ Why is running a `group by` in the database usually better than aggregating in
Java?**
Three reasons, and only one of them is "SQL is fast". First, data movement: the
aggregate is small and the input is large, so computing it at the database means
four columns cross the network instead of a hundred thousand rows. Second,
memory: the database aggregates as it scans, using a hash table proportional to
the number of *groups*; the Java version needs the input rows resident, which is a
heap cost proportional to the number of *rows*. Third, access paths: the planner
can choose an index-only scan or a pre-sorted path that removes the sort entirely,
and it re-chooses as the data changes. None of that applies if the input is
already in memory for another reason and is small — then aggregating in Java is
simply cheaper than a round trip.

**★ What does "projection" mean here, and why does it matter?**
A projection is a result containing a subset of columns — or computed columns —
rather than the whole row. It matters because an entity is defined as the row: you
cannot ask JPA for "an `Order` with only two of its fields populated" and have it
still be an `Order`, because the object would then be lying about its own state.
Frameworks work around this with DTO projections and interface projections, which
is a tacit admission that the query result and the entity are different things.
SQL-first has no workaround to make, because the result type was never claimed to
be an entity in the first place.

**★ Someone says "we use JPA, so we do not write SQL". What is wrong with that?**
It confuses the persistence strategy with the query language. JPA users write
query languages constantly — JPQL, Criteria, `@Query` — so the claim is really "we
never write *native* SQL", and that is a self-imposed restriction with a cost. The
cost lands on precisely the queries where SQL matters most: aggregates, window
functions, database-specific features, and anything whose plan you care about. It
also tends to produce a worse outcome than admitting the SQL, because the work
does not disappear — it reappears as Java loops over entity collections, which is
the same computation done in the slower place with more network traffic.

---

Index: [05 · SQL-first access](README.md) · Next → [1b · The three APIs](01b-the-three-apis.md)
