---
title: "Hand-written mapping is not primitive; it is the thing an ORM spends its life hiding"
sidebar_label: "16 · Mapping rows to objects"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the JDK 25 API for `java.sql.ResultSet`, records
> and `java.util.function`
> (docs.oracle.com/en/java/javase/25/docs/api/), and the JDBC 4.3 result-set
> contract as documented in the `java.sql` package summary. JDK 25, JDBC 4.3,
> PostgreSQL 18, pgjdbc 42.7.13.

**Every piece of data access ends with the same problem: a cursor over columns on
one side, a Java object on the other, and something in the middle that knows how
they correspond. An ORM solves it with annotations, reflection and a persistence
context that also does five other things. Raw JDBC solves it with a function from
`ResultSet` to `T`, written by hand, about four lines long. The hand-written
version is not the primitive option that you graduate from — it is explicit,
trivially testable, produces exactly the SQL you wrote, and has no lazy-loading
failure mode, no N+1, and no `LazyInitializationException`. What it costs is
typing, and what it buys is that nobody ever has to ask what query ran. For a
substantial class of services that is the better trade, and this chunk is about
writing it well rather than apologetically.**

## The `RowMapper` shape

The whole abstraction is one functional interface:

```java
@FunctionalInterface
interface RowMapper<T> {
    T map(ResultSet rs) throws SQLException;
}
```

⚠️ **It cannot be `Function<ResultSet, T>`**, because every getter throws
`SQLException` and `Function.apply` does not declare it. That is the same friction
[Phase 5](../../phase-5-exceptions/06-checked-exceptions-lambdas.md) describes
between checked exceptions and lambdas, and the answer is the same: declare your
own interface that throws.

Records are the natural target — immutable, positional, and with a canonical
constructor that reads like the `SELECT` list:

```java
record Customer(long id, String email, String displayName,
                Instant createdAt, Integer lifetimeSpendCents) { }

static final RowMapper<Customer> CUSTOMER = rs -> new Customer(
        rs.getLong("id"),
        rs.getString("email"),
        rs.getString("display_name"),
        rs.getObject("created_at", OffsetDateTime.class).toInstant(),
        rs.getObject("lifetime_spend_cents", Integer.class));
```

🔴 **Note the two disciplines from earlier chunks doing their work here.**
`getObject(..., Integer.class)` rather than `getInt`, so a nullable column stays
nullable ([chunk 13](13-nulls-and-wasnull.md)); `getObject(..., OffsetDateTime.class)`
rather than `getTimestamp`, so the instant is an instant
([chunk 14](14-dates-times-and-timestamptz.md)). A mapper is where those two
decisions become visible, which is a good argument for keeping mappers in one place
per aggregate.

## The two helpers that remove all the ceremony

Almost every query is "one row or none" or "all the rows". Write these once:

```java
static <T> Optional<T> queryOne(Connection c, String sql,
                                RowMapper<T> mapper, Object... params)
        throws SQLException {
    try (PreparedStatement ps = c.prepareStatement(sql)) {
        bind(ps, params);
        try (ResultSet rs = ps.executeQuery()) {
            if (!rs.next()) return Optional.empty();
            T value = mapper.map(rs);
            if (rs.next()) throw new IllegalStateException("more than one row: " + sql);
            return Optional.of(value);
        }
    }
}

static <T> List<T> queryList(Connection c, String sql,
                             RowMapper<T> mapper, Object... params)
        throws SQLException {
    try (PreparedStatement ps = c.prepareStatement(sql)) {
        bind(ps, params);
        try (ResultSet rs = ps.executeQuery()) {
            List<T> out = new ArrayList<>();
            while (rs.next()) out.add(mapper.map(rs));
            return List.copyOf(out);
        }
    }
}

private static void bind(PreparedStatement ps, Object... params) throws SQLException {
    for (int i = 0; i < params.length; i++) {
        if (params[i] == null) throw new IllegalArgumentException(
                "null parameter at index " + (i + 1) + " — use setNull with a type");
        ps.setObject(i + 1, params[i]);
    }
}
```

⚠️ **The `if (rs.next()) throw` in `queryOne` is not pedantry.** A "find by email"
that silently returns the first of two rows is how a duplicate-account bug survives
for a year. Failing loudly turns a data-integrity problem into an alert.

⚠️ **The null guard in `bind` is deliberate**, and it is the honest limitation of a
varargs binder: `setObject(n, null)` is the form that fails with "could not
determine data type of parameter" ([chunk 6](06-the-preparedstatement-api.md)).
A varargs helper cannot know the type, so it should refuse rather than produce a
mysterious server error. Queries with nullable parameters use the explicit form.

That is the entire framework. Roughly forty lines, no dependencies, no reflection,
and it covers most of what a repository does.

## Mapping a join without an N+1

The interesting case is a parent with children, and it is where a naive mapper
becomes the problem an ORM is famous for. Two approaches:

```java
// ✅ one query, grouped in Java
static final String SQL = """
        SELECT o.id AS order_id, o.placed_at, o.total_cents,
               l.id AS line_id, l.sku, l.quantity
        FROM orders o
        JOIN order_lines l ON l.order_id = o.id
        WHERE o.customer_id = ?
        ORDER BY o.id, l.id
        """;

Map<Long, Order> byId = new LinkedHashMap<>();
while (rs.next()) {
    long orderId = rs.getLong("order_id");
    Order order = byId.computeIfAbsent(orderId, k -> newOrder(rs2 -> ...));
    order.lines().add(new Line(rs.getLong("line_id"),
                               rs.getString("sku"),
                               rs.getInt("quantity")));
}
```

🔴 **Two things this makes visible that an ORM hides.** First, the aliasing is
mandatory — both tables have an `id`, and without `AS` the label lookup silently
returns the wrong one ([chunk 12](12-resultset-the-cursor-model.md)). Second, the
join *duplicates* the parent columns once per child, which is the fan-out an ORM's
`JOIN FETCH` also produces; with two collections joined at once it multiplies, and
the answer there is two queries, not a bigger join.

The alternative — and usually the better one — is **two queries with an array
parameter**:

```java
List<Order> orders = queryList(c, ORDERS_SQL, ORDER, customerId);
Array ids = c.createArrayOf("bigint",
        orders.stream().map(Order::id).toArray(Long[]::new));
List<Line> lines = queryList(c, "SELECT * FROM order_lines WHERE order_id = ANY(?)",
                             LINE, ids);
Map<Long, List<Line>> byOrder = lines.stream().collect(groupingBy(Line::orderId));
```

Two round trips, no duplicated parent columns, no fan-out multiplication — and it
is *exactly* the strategy Hibernate's batch fetching implements for you. Writing it
by hand makes the cost obvious rather than emergent, which is the recurring theme
of this chunk.

## Where hand-mapping stops being the right answer

Be honest about this, because "just use JDBC" is as lazy a position as "just use
JPA":

| Signal | What it means |
|---|---|
| A dozen entities with dirty tracking and cascading saves | you are writing an ORM. Use one. |
| Deep object graphs loaded by identity | a persistence context is genuinely useful |
| Mostly reads, deliberate SQL, flat DTOs | hand mapping wins comfortably |
| Reporting, aggregates, window functions, CTEs | hand mapping is the *only* pleasant option |
| A team that will not read SQL | the mappers will rot; pick the tool the team maintains |

[Topic 05 — SQL-first access](../05-sql-first-access/README.md) covers the middle ground —
Spring's `JdbcClient` and `JdbcTemplate` give you exactly the helpers above,
tested, with named parameters — and **Topic 06 — The JPA/Hibernate model** *(not
written yet)* covers the other end.

## The trade-off

The cost of hand mapping is duplication that the compiler cannot check: the
`SELECT` list, the mapper, and the record's components must agree, and nothing
enforces it. Adding a column means touching three places, and forgetting the mapper
gives you a field that is silently null. Two mitigations are worth the effort —
keep the SQL constant and its mapper adjacent in the same class so they are read
together, and write one round-trip test per mapper against a real schema
(Testcontainers, in **Phase 11 — Testing**) so a drifted column fails a build
rather than a request. Reflection-based mapping trades this compile-time
duplication for runtime surprises, which is not obviously the better bargain.

## Gotchas

**⚠️ A mapper that silently returns the first of several rows**
**Symptom:** a duplicate-account or duplicate-order bug that persists for months.
**Cause:** `if (rs.next()) return map(rs);` with no check for a second row.
**Fix:** the `queryOne` shape above — throw when a second row exists.

**⚠️ A mapper reading `getInt` on a nullable column**
**Symptom:** business logic behaving as though the value were zero.
**Cause:** the primitive getter's NULL-to-0 conversion.
**Fix:** `getObject(col, Integer.class)`. Mappers are where this discipline is
applied or lost.

**⚠️ Joining two tables that both have `id`, without aliases**
**Symptom:** the parent's id in the child object, silently.
**Cause:** the first matching label wins.
**Fix:** `AS` on every column in a join, always.

**⚠️ Returning a `ResultSet`, or a lazy `Stream` over one, from the mapper layer**
**Symptom:** "This ResultSet is closed" in the caller.
**Cause:** the connection went back to the pool when the helper returned.
**Fix:** materialise inside the helper — that is why `queryList` returns a `List`.

**⚠️ A mapper drifting from its query**
**Symptom:** a field that is quietly null after someone edited the `SELECT` list.
**Cause:** three places must agree and nothing checks them.
**Fix:** keep SQL and mapper adjacent, and one integration test per mapper.

**⚠️ Reaching for reflection to "avoid the boilerplate"**
**Symptom:** a home-grown mapper that works until a column is renamed, then fails
at runtime with a message about a missing setter.
**Cause:** you have written the first 5% of an ORM, with none of its testing.
**Fix:** if you want reflection-based mapping, use `JdbcClient` or a real ORM.
Do not maintain a private one.

**⚠️ A join that fans out across two collections**
**Symptom:** a query returning parents × children × grandchildren rows and a mapper
that deduplicates them in Java.
**Cause:** two joined collections multiply.
**Fix:** separate queries with an `= ANY(?)` array, grouped in Java.

## Interview questions

**★ What does a `RowMapper` actually need to be, and why not `Function`?**
A single-method interface from `ResultSet` to `T` that is allowed to throw
`SQLException` — which is exactly why `Function<ResultSet, T>` will not do, since
`apply` does not declare a checked exception and every `ResultSet` getter throws
one. So you declare a four-line functional interface of your own. That is the entire
abstraction: everything else a mapping layer does is helper methods around it, and
the two that matter are "one row or empty" and "all rows as a list". Records are the
natural target because the canonical constructor lines up with the `SELECT` list and
the result is immutable.

**★ Why should a single-row query fail when it finds two rows?**
Because silently taking the first one converts a data-integrity problem into wrong
behaviour that nobody notices. A "find customer by email" that returns the first of
two duplicate accounts will happily authenticate against one of them, update the
other, and produce support tickets that make no sense — for months. Reading a second
row and throwing turns that into an immediate, loud failure that points straight at
a missing unique constraint. It costs one `if` and it is the difference between a
bug that is found in an hour and one that is found in a year.

**★ How do you map a parent with its children without an N+1?**
Two ways. Either one query with a join, ordered by the parent key, grouping in Java
with a `LinkedHashMap` keyed by parent id — which needs every column aliased,
because both tables have an `id`, and which duplicates the parent's columns once per
child. Or, usually better, two queries: fetch the parents, collect their ids, and
fetch all children with `WHERE parent_id = ANY(?)` bound as a single array, then
group in Java. The second is two round trips regardless of result size, produces no
duplicated parent data, and does not multiply when there are two child collections —
which is exactly the case where the join approach explodes. It is also precisely
what an ORM's batch fetching does; writing it by hand just makes the cost visible.

**★ When would you not hand-map?**
When the application's shape is genuinely object-graph-oriented: many entities,
identity-based loading, cascading saves, dirty tracking. Reimplementing those by
hand means writing an ORM badly, and a real one is better. Also when the team will
not maintain SQL — mappers rot silently, and a tool nobody reads is worse than a
heavier tool everyone does. Hand mapping wins when the workload is mostly reads with
deliberate SQL and flat result shapes, and it is the only pleasant option for
reporting, aggregates, window functions and CTEs, which is a large fraction of what
real services actually do.

**★ What is the real cost of hand-written mapping?**
Duplication the compiler cannot check. The `SELECT` list, the mapper and the record
components have to agree, and nothing enforces it — so adding a column means editing
three places and forgetting one gives you a silently null field. The mitigations are
cheap and worth insisting on: keep each SQL constant next to its mapper so they are
read together, and write one integration test per mapper against a real schema so
drift fails the build rather than a production request. What you get in return is
that the query is visible, the object construction is visible, and there is no lazy
loading, no persistence context and no N+1 that emerges from a getter.

---

← Prev: [15 · Fetch size and streaming](15-fetch-size-and-streaming.md) · Index: [JDBC](README.md) · Next → [17 · Resource handling](17-resource-handling.md)
