---
title: "A join that fans out returns more rows than objects, so no per-row function can produce the answer"
sidebar_label: "3b · The fan-out problem"
sidebar_position: 6
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

**One order with three lines, joined, is three rows. A `RowMapper` is a function
from one row to one object, so it will hand you three orders. This is not a
limitation you work around with a cleverer mapper — it is arithmetic, and the only
fix is a callback that sees the whole result at once. This chunk builds that
callback; [chunk 3c](03c-two-queries-and-limit.md) then argues that quite often you
should not use it at all, and should run two queries instead.**

## The arithmetic

```sql
select o.id            as order_id,
       o.placed_at     as placed_at,
       o.status        as status,
       ol.id           as line_id,
       ol.sku          as sku,
       ol.quantity     as quantity
from orders o
join order_lines ol on ol.order_id = o.id
where o.customer_id = ?
order by o.id, ol.id;
```

If a customer has 2 orders with 3 lines each, this returns **6 rows** and you want
**2 objects**. A `RowMapper<Order>` maps rows to orders one for one, so it produces
6 orders — each one carrying a single line, and each order's header columns
repeated. The list is wrong in a way that is easy to miss, because every individual
object in it looks plausible.

You cannot fix this inside a `RowMapper`. Mapping row *n* correctly requires
knowing whether row *n−1* had the same `order_id`, and a `RowMapper` is handed one
row with no access to the ones around it. The interface has the wrong shape for the
job.

## The `ResultSetExtractor` that does work

The extractor is called once, drives the cursor itself, and can therefore keep an
accumulator in a local variable:

```java
private static final ResultSetExtractor<List<Order>> ORDERS_WITH_LINES = rs -> {
    Map<Long, Order> byId = new LinkedHashMap<>();
    while (rs.next()) {
        long orderId = rs.getLong("order_id");
        Order order = byId.computeIfAbsent(orderId, id -> new Order(
                id,
                rs.getObject("placed_at", OffsetDateTime.class),   // will not compile — see below
                OrderStatus.valueOf(rs.getString("status")),
                new ArrayList<>()));
        order.lines().add(new OrderLine(
                rs.getLong("line_id"),
                rs.getString("sku"),
                rs.getInt("quantity")));
    }
    return List.copyOf(byId.values());
};

public List<Order> findOrdersWithLines(long customerId) {
    return jdbcTemplate.query(ORDERS_WITH_LINES_SQL, ORDERS_WITH_LINES, customerId);
}
```

Three things in that code are deliberate.

**`LinkedHashMap`, not `HashMap`.** The query has an `ORDER BY`; a `HashMap` throws
that ordering away and hands you orders in hash order. If the SQL bothered to sort,
the accumulator must preserve it.

**The map is a local variable.** This is the point the `ResultSetExtractor` javadoc
makes when it says an extractor "is typically stateless and thus reusable, as long
as it doesn't … keep result state within the object". The *object* is a stateless
`static final` constant; the *state* lives in a fresh scope per call. Two threads
calling `findOrdersWithLines` concurrently each get their own map.

**Nothing calls `rs.close()`.** The template closes it. And nothing catches
`SQLException` — the template translates it.

⚠️ **The lambda above cannot read the `ResultSet` inside `computeIfAbsent` in real
code without care**, because the mapping function may throw `SQLException` and
lambdas passed to `computeIfAbsent` cannot. Write it as an explicit
`if (order == null) { … }` instead:

```java
Order order = byId.get(orderId);
if (order == null) {
    order = new Order(orderId,
                      rs.getObject("placed_at", OffsetDateTime.class),
                      OrderStatus.valueOf(rs.getString("status")),
                      new ArrayList<>());
    byId.put(orderId, order);
}
```

That version compiles, and it is the one to write.

## `LEFT JOIN` and the row that is half absent

Change the join to a `LEFT JOIN` so that orders with no lines still appear, and a
new problem arrives: for such an order, every `ol.*` column is `NULL`, but there
is still a row.

```java
long lineId = rs.getLong("line_id");
if (!rs.wasNull()) {
    order.lines().add(new OrderLine(lineId, rs.getString("sku"), rs.getInt("quantity")));
}
```

`rs.getLong` on a SQL `NULL` returns `0`, and nothing tells you — that is
**[`getInt` on a NULL column returns 0](../01-jdbc/13-nulls-and-wasnull.md)**, and
this is the shape where it bites hardest, because `0` is a plausible id and the
resulting order gets a phantom line. `wasNull()` immediately after the getter, or
`getObject("line_id", Long.class)` and a `null` check, is the fix.

## Gotchas

**A one-to-many "just worked" in testing because every parent had one child.**
With one line per order the fan-out is 1:1 and a `RowMapper` produces exactly the
right answer. The bug appears the first time somebody adds a second line — in
production, on someone else's data. Seed test data with at least one parent having
two children and one having none; those two cases catch nearly everything.

**`computeIfAbsent` with a `ResultSet` will not compile.** The mapping function
cannot throw `SQLException`. Every checked-exception-friendly rewrite of it — a
helper that wraps in `UncheckedIOException`-style plumbing, a `sneakyThrows` — is
worse than the four-line `if (x == null)` version. Write the `if`.

**`ORDER BY` on the parent key is required by the *streaming* version, not the map
version.** If your extractor keeps a `Map`, rows can arrive in any order and the
result is still correct. If instead you wrote the lower-memory version that emits a
parent as soon as its key changes, then an unsorted result silently produces
duplicate parents. Know which one you wrote, and if it is the streaming one, put
the `ORDER BY` in and add a comment saying it is load-bearing — otherwise somebody
removes it as "an unnecessary sort" in six months.

**`List.copyOf` throws on nulls.** The final line of the extractor above is
`List.copyOf(byId.values())`, which is a nice immutable result — and it throws
`NullPointerException` if anything in the map is null. That is usually what you
want. It is worth knowing it is the source, because the stack trace points at your
last line rather than at the row that produced the null.

**Reusing a stateful `RowCallbackHandler` instance across two queries merges their
results.** If you wrote a handler that counts rows or builds a document, and then
stored it in a field because "it is just a handler", the second query continues
where the first stopped. Construct one per call. The interface being functional
makes this easy to forget, because a lambda stored in a `static final` field looks
harmless right up until it captures something mutable.

**A `ResultSetExtractor` returning `null` is legal and means something specific.**
The javadoc allows it: "an arbitrary result object, or `null` if none (the
extractor will typically be stateful in the latter case)". So `query(sql, rse)`
returning `null` is not necessarily a bug — but it does mean callers must handle
it, which is why returning `Optional` from the extractor is usually nicer than
returning `null`.

## Interview questions

**★ Why can a `RowMapper` not map a one-to-many relationship?**
Because it is a function from one row to one object, and a fan-out join produces
more rows than objects. One order with three lines is three rows; the mapper is
invoked three times and returns three orders. Correctly assembling the result
requires knowing, at row *n*, whether row *n−1* belonged to the same parent — and
the `RowMapper` contract gives you one row and a counter, nothing else. It is a
shape mismatch, not a missing feature, which is why every "clever `RowMapper`" fix
turns out to be a `ResultSetExtractor` with extra steps.

**★ Where does the accumulator live in a `ResultSetExtractor`, and why does it
matter?**
In a local variable inside `extractData`. That is what lets a single extractor
instance be a shared `static final` constant and still be safe under concurrency —
each invocation gets a fresh scope, so two threads never share the map. The
javadoc states the rule from the other direction: an extractor is "typically
stateless and thus reusable, as long as it doesn't … keep result state within the
object". Putting the map in a field of the extractor is the version that breaks,
and it breaks intermittently and only under load, which makes it an expensive
mistake.

**★ Can you use these callbacks with `JdbcClient`, or only `JdbcTemplate`?**
All three, and `JdbcClient` exposes them on `StatementSpec`:
`query(RowMapper)` returns a `MappedQuerySpec` so you can then choose `.list()`,
`.single()`, `.optional()`, `.set()` or `.stream()`; `query(ResultSetExtractor)`
returns the extracted object directly; and `query(RowCallbackHandler)` returns
`void`. This is one of the places `JdbcClient` reads better than `JdbcTemplate`,
because the same three callbacks are visibly three overloads of one method instead
of scattered across a dozen `query`/`queryForObject`/`queryForList` signatures.

---

← Prev: [3 · `RowMapper` and friends](03-rowmapper.md) · Index: [05 · SQL-first access](README.md) · Next → [3c · Two queries, and `LIMIT`](03c-two-queries-and-limit.md)
