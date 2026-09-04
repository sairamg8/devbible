---
title: "There are two honest ways to produce the record — read the entity and map it, or query straight into the constructor — and the difference that matters here is not performance but when the values are read and whether anything deferred escapes with them"
sidebar_label: "05b · Mapping to a DTO"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference, *Projections* — class-based
> (DTO) projections, JPQL constructor expressions and DTO query rewriting
> ([docs.spring.io/spring-data/jpa/reference/repositories/projections.html](https://docs.spring.io/spring-data/jpa/reference/repositories/projections.html)),
> the Hibernate ORM 7.4 *Introduction* §8.21 *Dealing with denormalized data* on returning
> record types instead of entity instances
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> and Jakarta Persistence 3.2 §4.9.2 on constructor expressions in the `SELECT` clause
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**Once you have accepted that a record leaves the transaction, the remaining question is how
the record gets built — and every option has a different answer to the only question this
topic cares about: at what instant is each field's value actually read from the database? A
hand mapper reads at the line you wrote. A constructor expression reads in the query. And at
least one popular option does not read the value at all until somebody calls the getter, which
may be long after the session is gone. That last case is the reason this chunk exists: it
looks exactly like the fix and is not one.** Continues
**[05 · The DTO boundary](05-the-dto-boundary.md)**.

## Option 1 · Load the entity, map it by hand

```java
final class OrderMapper {

    static OrderView toView(Order order) {
        return new OrderView(
                order.getId(),
                order.getNumber(),
                order.getPlacedAt(),
                order.getTotal(),
                toCustomerView(order.getCustomer()),          // ← a read
                order.getLines().stream()                     // ← a read
                     .map(OrderMapper::toLineView)
                     .toList());
    }

    private static CustomerView toCustomerView(Customer c) {
        return new CustomerView(c.getId(), c.getName());
    }

    private static LineView toLineView(OrderLine l) {
        return new LineView(l.getId(), l.getSku(), l.getQuantity(), l.getPrice());
    }
}
```

**When the values are read:** at the marked lines, synchronously, in whatever transaction the
caller is in. Nothing is deferred. When `toView` returns, every field of the result is a
value.

**What it costs:** the entity is fully loaded — every column, plus a persistence-context entry
and a dirty-check snapshot for it and for every associated entity the mapper touched. And each
marked line is a lazy load unless the query fetched it, so **the mapper's field list is the
fetch requirement**, and the two are in different files.

**What it buys:** the reads are explicit and greppable. If you want to know what this view
needs loaded, you read the mapper. It also keeps entity behaviour available — a computed
`order.total()` that enforces an invariant is callable here and is not callable from a query.

⚠️ **This is also the version that hides an N+1 in plain sight.** Mapping a list of a hundred
orders calls `order.getCustomer()` a hundred times. Inside the transaction that is a hundred
fast queries and no exception, which is precisely the failure mode of
**[Topic 08 · The N+1 problem](../08-the-n-plus-1-problem/README.md)**. The boundary is closed
and the query count is wrong; those are separate problems and you have to fix both.

## Option 2 · Query straight into the constructor

```java
public record OrderSummary(long id, String number, Instant placedAt, BigDecimal total) {}
```

```java
@Query("""
        select new com.example.order.OrderSummary(o.id, o.number, o.placedAt, o.total)
        from Order o
        where o.customer.id = :customerId
        order by o.placedAt desc
        """)
List<OrderSummary> findSummariesForCustomer(@Param("customerId") long customerId);
```

**When the values are read:** in the query, all of them, before the method returns. There is
no entity, no proxy, no persistence-context entry, no snapshot and no graph. This is the
version where the boundary is closed by construction rather than by discipline.

Two rules from the specification that bite immediately:

- **The constructor name must be fully qualified.** `new OrderSummary(...)` does not compile in
  JPQL; `new com.example.order.OrderSummary(...)` does.
- **The argument types must match a constructor exactly.** A `long` where the property is
  `Long`, or an `int` count where the constructor takes `long`, produces a
  constructor-not-found failure at query compilation.

Spring Data will write the expression for you when the return type is a DTO — the reference
calls this *DTO Projection JPQL Query Rewriting* — and it backs off the moment you write one
yourself. The rewriting rules, the derived-query case and the native-query case are
**[Topic 08 · 12c2 · DTO projections in Spring Data](../08-the-n-plus-1-problem/12c2-dto-projections-in-spring-data.md)**.

### The limitation that decides most designs

🔴 **A constructor expression consumes one flat row, so it cannot build a nested collection.**
`select new OrderView(o.id, o.number, o.lines)` is not a thing. There is no result-set shape
that turns into a `List<LineView>` inside one constructor call, because joining the lines
multiplies the order rows rather than nesting them.

So a record with a `List` field cannot come from one constructor expression. That is not a
Spring Data limitation or a Hibernate limitation; it is the shape of a relational result.

## The two-query assembly, which is the answer nobody writes down

When the view genuinely needs a nested collection and you do not want to materialise entities,
run two flat queries and join them in memory:

```java
@Transactional(readOnly = true)
public OrderView findOrder(long id) {

    OrderHeader header = orders.findHeader(id)          // one flat row → a record
                               .orElseThrow(OrderNotFound::new);

    List<LineView> lines = orders.findLines(id);        // N flat rows → N records

    return new OrderView(header.id(), header.number(), header.placedAt(),
                         header.total(),
                         new CustomerView(header.customerId(), header.customerName()),
                         lines);
}
```

Two queries, both constructor expressions, no entity anywhere, and a fully assembled value
returned. For a list page it generalises to *one query for the parents, one query for all the
children with `where parent_id in (:ids)`, group in memory* — which is two queries regardless
of how many parents there are.

**This is the shape that scales**, and it is worth knowing precisely because the ergonomic
options (an entity plus a mapper, or a fetch join plus `distinct`) are what people reach for
first. The fetch-join alternative and what it costs in row multiplication is
**[Topic 08 · 08 · join fetch](../08-the-n-plus-1-problem/08-join-fetch.md)**; projecting a
collection specifically is
**[Topic 08 · 12b · Projecting a collection](../08-the-n-plus-1-problem/12b-projecting-a-collection.md)**.

## What a constructor expression cannot do

Being honest about this is what keeps the pattern credible:

- **No nested collections**, as above.
- **No polymorphism.** You cannot select "a `CardPaymentView` or a `BankPaymentView` depending
  on the row" from one constructor expression. You select a discriminator column and branch in
  Java — which, incidentally, is the fix for the `instanceof`-on-a-proxy trap in
  **[04c · What looks safe and is not](04c-what-looks-safe-and-is-not.md)**.
- **No entity behaviour.** If the value is computed by a domain method with rules in it, the
  query cannot call it. Either the rule moves into SQL, which duplicates it, or you load the
  entity and use option 1.
- **⚠️ Do not pass an entity into the constructor.** `select new OrderView(o, count(l))` makes
  `o` a managed entity inside your "DTO", and you are back where you started. The
  specification's own rule about entities in constructor expressions is in
  **[Topic 08 · 12 · Projections and DTOs](../08-the-n-plus-1-problem/12-projections-and-dtos.md)**.

## Choosing between the two

| | Load and map | Constructor expression |
|---|---|---|
| When values are read | at each mapper line | in the query |
| Entity instantiated | yes | no |
| Persistence-context entry | yes, plus snapshot | none |
| Needs a fetch plan | yes, and it is implicit in the mapper | no, the query *is* the plan |
| Nested collections | natural | needs a second query |
| Domain behaviour available | yes | no |
| Can hide an N+1 | yes, easily | no |
| Can the boundary leak | only if a field holds an entity | no |

**Use the constructor expression for reads** — lists, detail views, reports, exports. **Use
load-and-map when the view needs domain behaviour**, or when you are already loading the entity
because the same method also writes.

The remaining routes — Spring Data's interface projections, dynamic projections, and generated
mappers like MapStruct — are a separate discussion, because one of them defers evaluation past
the boundary and therefore does not close it:
**[05c · Projections and generated mappers](05c-projections-and-generated-mappers.md)**.

## Gotchas

**★ The mapper is a fetch specification that nobody treats as one.** Adding one line to
`toView` can add a query per row, and the change is reviewed as "the response now includes the
customer name". The query that feeds it lives in another file and is not part of the diff.

**★ A hand mapper closes the boundary and does nothing about query counts.** After the
conversion the exception is gone and the endpoint may be slower, because the reads that used to
happen during serialisation now happen during mapping — same queries, earlier. If nobody
counts, this reads as "DTOs made it slower".

**★ `new OrderSummary(...)` without the package fails at query compilation, not at startup.**
Depending on how the query is validated it can surface on the first call rather than on
context refresh, so a typo in a rarely used repository method ships.

**★ A constructor expression will not tell you it picked the wrong constructor.** If the record
has two constructors with compatible arities, the resolution is by type. Adding a compact
canonical constructor for validation is fine; adding a second convenience constructor is how
you get a silently different mapping.

**★ You cannot select a collection into a constructor argument, and the error message is not
helpful about why.** The reason is that a result row is flat. Once you internalise that, the
two-query assembly stops feeling like a workaround.

**★ Passing the entity into the DTO constructor undoes everything.** `select new
OrderView(o, count(l))` type-checks, runs, and hands the caller a managed-then-detached entity
inside a record. It is the single fastest way to build something that looks like a DTO
boundary and is not one.

**★ A `record` with a `List` field is not immutable unless you copy.** `List.copyOf` in a
compact constructor, or `.toList()` at the mapping site. Handing out a `PersistentList` inside
a record is the same bug as handing out the entity.

**★ Mapping a `Page<Order>` with `page.map(mapper)` inside the service is correct; outside it
is not.** The transformation is applied to the content when `map` is called, so the location of
the call decides whether the reads are legal. This is easy to get wrong because the two
versions look identical in a diff.

**★ Two queries beat one fetch join more often than people expect.** A fetch join multiplies
the parent columns by the number of children and forces `distinct` handling; two flat
constructor-expression queries send each column once and assemble in memory. Neither is
universally right, and the trade-off is a row-count argument rather than a round-trip argument.

## Interview questions

**★ What is the difference between mapping to a DTO and projecting into one, for this topic
specifically?**
When the values are read. A mapper reads them at the lines you wrote, from an already-loaded
entity, so every association it touches must have been fetched or it becomes a query — inside
the transaction, so silent. A constructor expression reads them in the query itself and never
builds an entity, so there is nothing to fetch and nothing that can be unfetched. Both produce
a value that crosses the boundary safely; only one of them makes it impossible to accidentally
add a lazy load later.

**★ Why can a constructor expression not produce a record with a nested list?**
Because a constructor expression is applied to one row of a flat result set, and a parent with
many children is not one row. Joining the children multiplies the parent's columns across N
rows, which a per-row constructor call cannot collapse back into one object with a list. The
standard answer is two flat queries — parents, then children filtered by the parent ids — and
grouping in memory, which is two round trips regardless of the number of parents.

**★ You convert an endpoint from returning an entity to returning a DTO and it gets slower.
What happened?**
Almost certainly nothing new happened; the same queries moved earlier. Under open-in-view the
lazy loads were happening during serialisation and were being attributed to response writing;
now they happen in the mapper. If the mapper touches an association the query does not fetch,
the N+1 is still there. The conversion fixed the correctness problem; the fetch plan still has
to be written, and the way to know is to count statements rather than to time the endpoint.

**★ What is wrong with `select new OrderView(o, count(l)) from Order o join o.lines l group by
o`?**
`o` is an entity. Whatever the record is called, one of its fields is now a managed entity that
becomes detached when the transaction ends, so the whole boundary argument is void — the caller
can navigate from it and throw. A constructor expression's arguments should be scalars, plus
nested records built from scalars. If you need the parent's fields, select the fields.

**★ When would you deliberately load the entity and map it by hand rather than project?**
When the view needs behaviour rather than columns: a total computed by a domain method with
rounding rules, a status derived from several fields by logic you do not want duplicated in
SQL, or a value that depends on an invariant the entity enforces. Also when the same
transactional method is already loading the entity in order to write it, in which case a second
query to project the same row would be pure cost.

**★ How do you keep a mapper and its query in sync?**
By making the query own the requirement rather than the mapper. If the values come from a
constructor expression there is nothing to keep in sync, because there is one artefact. If you
are loading and mapping, the practical measures are a repository method named for the view it
serves — `findDetailForView`, not `findById` — so the coupling is visible, and a statement-count
assertion on the path so that an added mapper line that adds a query fails a test rather than a
customer.

{/* FOOTER */}
