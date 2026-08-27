---
title: "Two queries are usually cheaper than one fan-out join — and `LIMIT` on a fan-out join silently truncates the last object"
sidebar_label: "3c · Two queries, and `LIMIT`"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `ResultSetExtractor` and `RowMapper` source in
> spring-framework `main`
> ([github.com/spring-projects/spring-framework](https://github.com/spring-projects/spring-framework/blob/main/spring-jdbc/src/main/java/org/springframework/jdbc/core/ResultSetExtractor.java)),
> the Spring Framework 7.0 reference *Data Access → JDBC Core Classes*
> ([docs.spring.io/.../jdbc/core.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html)),
> and the PostgreSQL 18 manual *Table Expressions → Joined Tables* and *LIMIT and
> OFFSET*
> ([postgresql.org/docs/18/queries-table-expressions.html](https://www.postgresql.org/docs/18/queries-table-expressions.html),
> [.../queries-limit.html](https://www.postgresql.org/docs/18/queries-limit.html)).
> JDK 25, Spring Framework 7.0.8, PostgreSQL 18.

**Assembling a one-to-many from a single join is correct and often the wrong trade.
Every child row carries a full copy of the parent's columns across the network, so a
parent with a `jsonb` document and 500 children ships that document 500 times. Two
separate queries cost one extra round trip and nothing else — and they are the only
shape in which `LIMIT` means what you think it means.**

## The cost nobody costs: the parent columns, repeated

The fan-out is not free even when your assembly code is correct. Every child row
carries a full copy of the parent's columns across the network. Two orders with
three lines each means the `placed_at` and `status` values are transmitted three
times apiece. That is tolerable. An order with 500 lines, or a parent row carrying
a `jsonb` document, is not: you are shipping the document 500 times so that you can
throw away 499 copies.

**Two independent selects are frequently the better shape.** Fetch the parents,
then fetch all their children in one statement keyed by the parent ids, and group
in Java:

```java
List<Order> orders = jdbcClient
        .sql("select id, placed_at, status from orders where customer_id = :cid order by id")
        .param("cid", customerId)
        .query(Order.class)
        .list();

if (orders.isEmpty()) {
    return List.of();
}

Map<Long, List<OrderLine>> linesByOrder = jdbcClient
        .sql("""
             select order_id, id, sku, quantity
             from order_lines
             where order_id = any(:ids)
             order by order_id, id
             """)
        .param("ids", orders.stream().map(Order::id).toArray(Long[]::new))
        .query(OrderLineRow.class)
        .stream()
        .collect(groupingBy(OrderLineRow::orderId,
                            LinkedHashMap::new,
                            mapping(OrderLineRow::toLine, toList())));
```

Two round trips, no duplicated parent columns, and each statement is simple enough
to reason about on its own. Note `= any(:ids)` with a single array parameter rather
than an expanded `IN` list — the reason is
**[`IN (?)` and the PostgreSQL answer](../01-jdbc/08-in-lists-and-like-patterns.md)**,
and it matters more here than usual because the number of parents varies per call.
[Chunk 5b](05b-in-lists-and-the-statement-cache.md) explains what varying that
number does to the server's statement cache.

**Two queries is not "the N+1 problem".** N+1 is *one query per parent* — an
unbounded number of round trips that grows with the result. This is exactly two,
always, regardless of how many orders there are. The distinction matters because
people who have been burned by N+1 sometimes reject any second query on principle
and take a cartesian product instead. The ORM version of this argument is
[Topic 08 · The N+1 problem](../08-the-n-plus-1-problem/README.md).

## Pagination and fan-out do not mix

This is the trap that reaches production most often:

```sql
select o.id, o.placed_at, ol.sku
from orders o join order_lines ol on ol.order_id = o.id
order by o.id
limit 20;                     -- twenty ROWS, not twenty ORDERS
```

`LIMIT` counts rows. With a fan-out join, twenty rows might be four orders, or
seven, and the twentieth row is very likely the middle of an order whose remaining
lines were cut off. You get a partially populated object and nothing warns you.

The fix is to paginate the parents in a subquery — or, more simply, in the first of
two queries:

```sql
select o.id, o.placed_at, ol.sku
from (select id, placed_at from orders
      where customer_id = :cid
      order by id
      limit :limit offset :offset) o
join order_lines ol on ol.order_id = o.id
order by o.id, ol.id;
```

Now `LIMIT` applies to orders, and the join fans out afterwards. This is precisely
the problem Hibernate reports as `HHH000104` when you combine a fetch join with
pagination, and it is worth seeing here first, in raw SQL, because the ORM version
looks like a framework quirk when it is really this arithmetic.

## Gotchas

**Two fan-out joins in one query multiply.** An order joined to its lines *and* to
its shipments returns `lines × shipments` rows. Three lines and two shipments is
six rows, and your extractor will add each line three times unless it deduplicates.
If you find yourself adding `if (!order.lines().contains(line))`, stop — that is a
cartesian product asking to be two queries.

**`SELECT DISTINCT` does not fix a fan-out.** It is the first thing people reach
for, and it deduplicates *rows*, not objects. Since each row carries a different
child, all the rows are already distinct, so `DISTINCT` changes nothing except that
the database now sorts or hashes the entire result to prove it. You have paid for
the deduplication and received none.

## Interview questions

**★ How do you load an aggregate and its children with `JdbcTemplate`?**
Two legitimate ways. One query with a join and a `ResultSetExtractor` that
accumulates into a `LinkedHashMap` keyed by the parent id, adding a child per row.
Or two queries: select the parents, then select all children with `where parent_id
= any(?)` and group them in Java with `Collectors.groupingBy`. The first is one
round trip but transmits the parent columns once per child row; the second is
always exactly two round trips and transmits each column once. I would default to
two queries when parents have wide columns or many children, and to the join when
the parent row is narrow and the fan-out is small. Neither is N+1 — N+1 is one
query *per parent*, and both of these are bounded.

**★ Someone adds `SELECT DISTINCT` to fix duplicate parents from a join. What do
you say?**
That it cannot work and is not free. The duplicates are not duplicate rows —
each row carries a different child, so the rows genuinely differ. `DISTINCT`
deduplicates rows, finds nothing to remove, and in doing so makes the database sort
or hash the entire result set to prove it. So the symptom stays and a cost is
added. The duplicate *objects* come from mapping rows to objects one for one, and
the fix is at the mapping layer: a `ResultSetExtractor` that groups by the parent
key, or a second query.

**★ Why does `LIMIT 20` give you a broken object when you join to a child table?**
Because `LIMIT` counts rows and the join fans out, so twenty rows is some
unpredictable number of parents — and, crucially, the last parent in the window is
almost certainly truncated: some of its children fell past the limit. You end up
with an object that looks complete and is missing children, which is worse than an
error. The fix is to apply the limit to the parents before joining — a derived
table or CTE that selects and paginates the parent ids, joined to the children
outside it. This is the same underlying problem Hibernate warns about with
`HHH000104` when a fetch join is combined with pagination.

---

← Prev: [3b · The fan-out problem](03b-the-fan-out-problem.md) · Index: [05 · SQL-first access](README.md) · Next → [3d · The built-in mappers](03d-automatic-mappers.md)
