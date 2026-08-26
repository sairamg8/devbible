---
title: "A constructor expression consumes one flat row, so a DTO with a nested list needs either two queries or a grouping step — and both are better than they sound"
sidebar_label: "12b · Projecting a collection"
sidebar_position: 41
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 specification §4.9.2
> *Constructor Expressions in the SELECT Clause*
> ([jakarta.ee/specifications/persistence/3.2](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)),
> the Spring Data JPA 4.1 *Projections* reference
> ([docs.spring.io/spring-data/jpa/reference/repositories/projections.html](https://docs.spring.io/spring-data/jpa/reference/repositories/projections.html)),
> and the PostgreSQL 18 manual §9.21 *Aggregate Functions*, Table 9.62
> ([postgresql.org/docs/18/functions-aggregate.html](https://www.postgresql.org/docs/18/functions-aggregate.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, Spring Data JPA 4.1.0,
> PostgreSQL 18.

**This is the one thing entities do that projections do not do for free: nest. A
`select new OrderView(...)` runs its constructor once per row, and a row is flat,
so `OrderView` cannot have a `List<LineView>` in it. Four ways out, in descending
order of how often they are right.**

## Why it does not work directly

A constructor expression is evaluated per result row. `§4.9.2` allows the
arguments to be path expressions, scalar expressions, aggregates and
identification variables — all of which are single values. There is no
"collection of sub-results" argument, because at that point in the query there is
no sub-result set; there is a row.

So an order with three lines is three rows, and three constructor calls, and you
have the same flattening [chunk 8b](08b-what-a-fetch-join-breaks.md) described
for entities — except that nothing reassembles it for you, because there is no
identity map for DTOs.

## Way 1 · two queries, joined in Java

The honest default, and it is what an ORM's batch fetching does under the hood
anyway:

```java
record OrderHead(Long id, String number, String customerName) {}
record LineView(Long orderId, String productName, int quantity, BigDecimal total) {}
record OrderView(Long id, String number, String customerName, List<LineView> lines) {}
```

```java
@Query("""
    select new com.example.OrderHead(o.id, o.number, c.name)
    from Order o join o.customer c
    where o.placedAt > :cutoff
    """)
List<OrderHead> heads(@Param("cutoff") Instant cutoff);

@Query("""
    select new com.example.LineView(l.order.id, p.name, l.quantity, l.quantity * l.unitPrice)
    from OrderLine l join l.product p
    where l.order.id in :orderIds
    """)
List<LineView> linesFor(@Param("orderIds") Collection<Long> orderIds);
```

```java
List<OrderHead> heads = repo.heads(cutoff);
Map<Long, List<LineView>> byOrder = repo.linesFor(heads.stream().map(OrderHead::id).toList())
        .stream().collect(groupingBy(LineView::orderId));

List<OrderView> result = heads.stream()
        .map(h -> new OrderView(h.id(), h.number(), h.customerName(),
                                byOrder.getOrDefault(h.id(), List.of())))
        .toList();
```

**Two statements, always.** Not ⌈N/k⌉, not N+1 — two, because the second one is
an explicit `IN` over ids you already have. It composes with pagination, because
the first query pages normally. It handles two collections in four statements
with no product. And every column in both queries is one you named.

⚠️ Enable `hibernate.query.in_clause_parameter_padding` if that `in :orderIds` is
called with widely varying list sizes — this is the query shape that setting
actually exists for ([chunk 10b](10b-what-the-sql-looks-like.md)).

## Way 2 · one flat query, grouped in Java

When the parent's columns are few and the fan-out is small, one query and a
grouping step is less code:

```java
record FlatRow(Long orderId, String number, String customerName,
               String productName, int quantity, BigDecimal total) {}
```

```java
List<OrderView> result = repo.flatRows(cutoff).stream()
        .collect(groupingBy(FlatRow::orderId, LinkedHashMap::new, toList()))
        .values().stream()
        .map(rows -> {
            FlatRow first = rows.getFirst();
            return new OrderView(first.orderId(), first.number(), first.customerName(),
                    rows.stream().map(r -> new LineView(r.orderId(), r.productName(),
                                                        r.quantity(), r.total())).toList());
        })
        .toList();
```

One statement, and the parent's columns repeat per row — the same redundancy a
fetch join has, but over four narrow columns rather than every column of two
entities.

⚠️ **Do not paginate this one.** `LIMIT` counts rows, and rows are lines, so a
page boundary can split an order — the identical unit mismatch
[chunk 8d](08d-pagination.md) describes. Use way 1 when the result is paginated.

## Way 3 · Spring Data nested interface projections

Spring Data builds nested projections for you — an interface with a
`List<LineSummary> getLines()` whose element type is itself a projection
interface. The reference says "projections can be used recursively" and that the
nested property "is obtained and wrapped into a projecting proxy in turn". The
syntax and the variants are [chunk 12c](12c-spring-data-projections.md).

🔴 **Read the limitation before adopting this**, because it undoes most of the
benefit:

> *"Projections limit the selection to top-level properties of the target entity.
> Any nested properties resolving to joins select the **entire nested property**
> causing the full join to materialize."*

So the nesting is applied **after** the data is loaded, not to the `select` list.
You get the whole `OrderLine` — every column — with a proxy in front of it
exposing one getter. Convenient for shaping a response; not a column-reduction
technique for anything reached through a join.

## Way 4 · let the database build the JSON

If the endpoint's output is JSON, PostgreSQL can assemble the nesting server-side:

```sql
select o.id,
       o.reference,
       c.name as customer_name,
       json_agg(
           json_build_object('product', p.name, 'quantity', l.quantity)
           order by l.line_number
       ) as lines
from   orders o
  join customer   c on c.id = o.customer_id
  join order_line l on l.order_id = o.id
  join product    p on p.id = l.product_id
where  o.placed_at > :cutoff
group  by o.id, o.reference, c.name;
```

`json_agg` is documented in the PostgreSQL 18 manual's general-purpose aggregate
table as *"Collects all the input values, including nulls, into a JSON array"*,
and it accepts an `ORDER BY` inside the call, which is how you get a defined line
order without a second sort.

**One statement, one row per order, no fan-out on the wire beyond the JSON
itself, and `LIMIT` counts orders again** — which quietly solves the pagination
problem that ways 2 and 3 have.

The costs are real and worth stating: it is a native query, so you lose the JPQL
compiler and the portability; you are mapping a `json`/`jsonb` column into a Java
type yourself; and the manual notes these aggregates have "Partial Mode = No", so
they do not participate in parallel aggregation. Use it when the response *is*
the JSON and the shape is stable, not as a default.

## Choosing

| | statements | paginates | columns | portable |
|---|---|---|---|---|
| Way 1 · two queries | 2 | ✅ | named only | ✅ |
| Way 2 · flat + group | 1 | ❌ | named only | ✅ |
| Way 3 · nested interface projection | 1 | ⚠️ | **whole joined entity** | ✅ |
| Way 4 · `json_agg` | 1 | ✅ | named only | ❌ PostgreSQL |

**Way 1 is the default.** It is two round trips, it paginates, it scales to
several collections without any product, and every part of it is ordinary code
that a reader can follow without knowing anything about fetch strategies.

## Gotchas

**⚠️ Paginating a flattened projection.**
Way 2's `LIMIT` counts lines, not orders, so a page can end in the middle of an
order and that order arrives with some of its lines. This is the same unit
mismatch as a paginated collection fetch join, and unlike that one, Hibernate is
not involved and will not warn you.

**⚠️ Believing a nested Spring Data projection reduces the columns.**
The reference is explicit that nested properties resolving to joins "select the
entire nested property causing the full join to materialize". The projection is a
presentation wrapper over fully-loaded data in that case, not a narrower query.

**⚠️ Forgetting the parent with no children in way 1.**
The second query returns nothing for an order with no lines, and
`groupingBy` produces no entry for it. `getOrDefault(id, List.of())` is the whole
fix and omitting it is an NPE in the mapper.

**⚠️ Losing the order of the children.**
Neither the `IN` query nor the grouping preserves anything unless you say so. Add
an `order by` to the child query (way 1), or `order by` inside `json_agg`
(way 4), or sort in the mapper. A `List` that happens to be in the right order in
testing is [chunk 8e4](08e4-ordering-and-the-call-sites.md)'s trap again.

**⚠️ Calling the child query once per parent.**
`heads.forEach(h -> repo.linesFor(List.of(h.id())))` is way 1 written as an N+1.
The whole point is one `IN` over all the ids; if the code shape makes that awkward,
the code shape is the bug.

**⚠️ An unbounded `IN` list.**
A page of 25 is fine; a full export of 200,000 ids in one `IN` is not. Chunk the
id list — `Lists.partition`-style, in batches of a few hundred to a few
thousand — and accept the extra statements. This is the same arithmetic as
[chunk 10c](10c-choosing-a-batch-size.md), done by hand and therefore visible.

**⚠️ Using `l.order.id` and accidentally joining.**
`l.order.id` on a `@ManyToOne` reads the foreign key column and needs no join;
`l.order.number` needs one. Getting this wrong turns a two-column child query
into a join you did not want. It is worth knowing which of your paths are
foreign-key-only.

**⚠️ Assembling in Java and calling it "the mapper's problem".**
The grouping code is part of the query's design. Burying it in a
`@Component OrderMapper` far from the two `@Query` annotations is how a
maintainer later "simplifies" it back into an entity fetch. Keep the pair of
queries and the assembly in one place.

**⚠️ Reaching for `json_agg` because the Java felt like boilerplate.**
Twelve lines of stream code is not a reason to adopt a native query, lose the
JPQL compiler and take on JSON mapping. Reach for it when the response *is* JSON,
the shape is stable, and the fan-out on the wire is the actual problem.

## Interview questions

**★ Why can't a constructor expression build a DTO with a nested list?**
Because it is evaluated once per result row and a row is flat. §4.9.2 allows
constructor arguments that are path expressions, scalar expressions, aggregates
and identification variables — all single values. An order with three lines is
three rows and three constructor calls, and nothing reassembles them, because
there is no identity map for DTOs the way there is for entities.

**★ What is your default approach then?**
Two queries: one for the parents, projected; one for the children, projected,
restricted by `where parentId in :ids`; then `groupingBy` in Java. Two statements
regardless of the number of parents, it paginates because the parent query has no
join to a collection, it extends to several collections without any Cartesian
product, and everything in it is ordinary code.

**★ How is that different from what `@BatchSize` does?**
It is the same idea done explicitly, and better in three ways: it is exactly two
statements rather than ⌈N/k⌉, it selects only the columns you named rather than
whole entities, and nothing it returns is managed. The cost is that you write the
join yourself instead of navigating an association.

**★ When would you do it in one query instead?**
When the result is not paginated and the parent's projected columns are few, so
repeating them per child row is cheap. Then one flat query plus a `groupingBy` is
less code and one fewer round trip. The disqualifier is pagination: `LIMIT` counts
rows, rows are children, and a page boundary can split a parent — the same unit
mismatch as a paginated collection fetch join, with nothing to warn you.

**★ Do Spring Data's nested interface projections solve this?**
They produce the nested shape, and the reference is explicit that they do not
narrow the query across a join: "projections limit the selection to top-level
properties of the target entity. Any nested properties resolving to joins select
the entire nested property causing the full join to materialize." So you get the
whole child entity loaded and a proxy exposing two getters. Convenient for shaping
a response; not a column-reduction technique for anything joined.

**★ What is the case for building the JSON in the database?**
When the response is JSON and the nesting is the expensive part on the wire.
PostgreSQL's `json_agg` "collects all the input values, including nulls, into a
JSON array" and takes an `ORDER BY` inside the call, so one statement returns one
row per parent with its children already nested and ordered — which also restores
`LIMIT` counting parents. The price is a native query, manual mapping of the
`json` column, no JPQL compilation, no portability, and no parallel aggregation
for those functions.

**★ What breaks most often in the two-query approach?**
Parents with no children — the second query returns nothing for them, the
grouping map has no entry, and the mapper NPEs unless it defaults to an empty
list. After that, ordering, because neither the `IN` query nor the grouping
preserves any order you did not ask for. And an unbounded `IN` list on an export
path, which needs chunking.

**★ Is two round trips ever unacceptable?**
Rarely, and when it is, the constraint is usually latency to a distant database
rather than the database's own work. In that case way 4 or a single flat query is
the answer, and both of them trade something concrete — portability, or the
ability to paginate. It is worth being explicit about which one you traded rather
than reaching for "fewer queries is better" as a principle.

---

← Prev: [12 · Projections and DTOs](12-projections-and-dtos.md) · Index: [08 · The N+1 problem](README.md) · Next → [12c · Spring Data projections](12c-spring-data-projections.md)
