---
title: "A projection fixes N+1 by never creating the object graph that could have one, which is why it is the only fix on this list that cannot regress"
sidebar_label: "12 · Projections and DTOs"
sidebar_position: 40
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 specification §4.9.2
> *Constructor Expressions in the SELECT Clause* and §4.9 *SELECT Clause*
> ([jakarta.ee/specifications/persistence/3.2](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)),
> the Hibernate ORM 7.4 user guide §12.8
> ([docs.hibernate.org/orm/7.4/userguide](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> and the Spring Data JPA 4.1 *Projections* reference
> ([docs.spring.io/spring-data/jpa/reference/repositories/projections.html](https://docs.spring.io/spring-data/jpa/reference/repositories/projections.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, Spring Data JPA 4.1.0,
> PostgreSQL 18.

**Every other fix in this part manages the object graph better. A projection
declines to build one. There is no lazy association to touch, no proxy to
dereference, no persistence context to be outside of, and no `FetchType` anywhere
in the story — so N+1 is not fixed, it is *unreachable*. That is a different kind
of guarantee, and it is why Hibernate's own guide reaches for it first.**

## The guide's own ranking

From §12.8, in the middle of explaining `@BatchSize`:

> *"However, although `@BatchSize` is better than running into an N + 1 query
> issue, most of the time, **a DTO projection or a `JOIN FETCH` is a much better
> alternative** since it allows you to fetch all the required data with a single
> query."*

DTO projection is named first, in the batch-fetching section, by the people who
wrote batch fetching.

## The mechanism

```java
public record InvoiceLine(
        String orderNumber,
        String customerName,
        String productName,
        BigDecimal lineTotal) {}
```

```java
@Query("""
    select new com.example.invoice.InvoiceLine(
        o.number,
        c.name,
        p.name,
        l.quantity * l.unitPrice)
    from Order o
      join o.customer c
      join o.lines    l
      join l.product  p
    where o.id = :id
    """)
List<InvoiceLine> invoice(@Param("id") Long id);
```

One statement. Four columns. No entity is constructed, so nothing is managed,
nothing is snapshotted, nothing is lazy, and nothing can be touched later to
produce a query.

The specification, §4.9.2, sets the rules:

- *"The specified class is not required to be an entity or to be mapped to the
  database."* — any class with a matching constructor works; a `record` is ideal.
- *"The constructor name must be fully qualified."* — the package is not optional
  in portable JPQL. Spring Data's documentation flags the same thing: *"(Note the
  usage of a FQDN for the DTO type!)"*.

## What a projection removes

| | entity fetch | projection |
|---|---|---|
| Lazy associations | present, touchable | **none exist** |
| Persistence context | every row managed | nothing managed |
| Dirty-check snapshot | one per entity | none |
| `equals`/`hashCode` mattering | yes ([8e3](08e3-what-set-costs-the-model.md)) | no |
| Columns transferred | all mapped columns | the ones you named |
| `LazyInitializationException` possible | yes | **no** |
| Can regress into N+1 later | yes | **no** |

That last row is the argument. A fetch join, an entity graph, a batch size — all
of them are correct until somebody adds a `getX().getY()` to a serialiser or a
template three months later. A projection has nothing to add it to. **It is the
only fix on this list whose correctness does not depend on future code.**

## The persistence-context cost you stop paying

An entity query with `N` rows puts `N` managed instances in the context, each
with a snapshot of its loaded state for dirty checking, all of which live until
the context closes and all of which are compared at every flush —
[topic 06 chunk 11](../06-jpa-hibernate-model/11-the-persistence-context.md).

For a read-only endpoint, every part of that is waste: the memory, the snapshot,
the flush-time comparison, and the risk that something modifies an entity by
accident and the change is written on commit. A projection has none of it, which
is a stronger statement than `@Transactional(readOnly = true)` — that asks the
runtime not to flush; a projection has nothing to flush.

## Aggregates come along for free

The `select` list may contain aggregate expressions, so a projection can answer
questions an entity graph cannot express at all:

```java
public record OrderSummary(Long id, String number, long lineCount, BigDecimal total) {}
```

```java
@Query("""
    select new com.example.OrderSummary(
        o.id, o.number, count(l), sum(l.quantity * l.unitPrice))
    from Order o left join o.lines l
    where o.placedAt > :cutoff
    group by o.id, o.number
    """)
List<OrderSummary> summaries(@Param("cutoff") Instant cutoff);
```

This is the shape most "N+1 in a list page" bugs really wanted. The loop was
calling `order.getLines().size()` and `order.getLines().stream().map(…).sum()` —
which is N queries to compute two numbers the database computes in the same scan
([chunk 6](06-count-do-not-read.md) makes the same point about counting).

## The trap the specification warns about

§4.9.2, and this is the single most important sentence for anyone writing
projections:

> *"If a `single_valued_path_expression` or `identification_variable` that is an
> argument to the constructor references an **entity**, the resulting entity
> instance referenced by that … will be in the **managed** state."*

So:

```java
// ❌ this is not a projection
select new com.example.OrderView(o, count(l))
from Order o left join o.lines l
group by o
```

`o` is an entity, so it is **managed**, with all its lazy associations, its
snapshot, and its capacity to produce an N+1 the moment `OrderView` is
serialised. You have written a DTO around the exact object you were trying to
avoid.

The rule is simple and worth stating as a rule: **a projection's constructor
arguments must be scalars.** Ids, columns, expressions, aggregates. The moment
one of them is an entity or an association path resolving to an entity, it is not
a projection any more.

§4.9.2 also covers the related case: *"If an entity class name is specified as
the constructor name in the `SELECT NEW` clause, the resulting entity instances
will be in either the new or the detached state, depending on whether a primary
key is retrieved."* Constructing an *entity* class in a `select new` gives you
new-or-detached instances, which is a different surprise and rarely what anyone
meant.

## What a projection cannot do

- **Modify anything.** Nothing is managed, so nothing is tracked. If the
  operation writes, it needs entities.
- **Hold a nested collection directly.** A DTO with a `List<LineView>` field
  cannot be built by one constructor expression, because the result set is flat.
  That is the genuinely hard part, and it is
  [chunk 12b](12b-projecting-a-collection.md).
- **Give you the second-level cache's entity hits.** A projection queries; it
  does not resolve from the entity cache.

## Gotchas

**⚠️ Passing an entity into the constructor.**
The specification says the referenced entity "will be in the managed state", so
the DTO is a wrapper around a live entity with live lazy associations. Everything
the projection was supposed to prevent is back, and the class name says otherwise.
Constructor arguments must be scalars.

**⚠️ Forgetting the fully qualified class name.**
§4.9.2: "The constructor name must be fully qualified." Spring Data repeats the
warning. It is a long string in a query, it is easy to get wrong after a package
move, and the failure is at query-compile time — which for a `@Query` on a
repository means **bootstrap**, so at least it is loud.

**⚠️ A constructor whose parameter types do not match the select list.**
`count(l)` is a `Long`, `sum(...)` on a `BigDecimal` column is a `BigDecimal`,
and an `int` parameter will not accept a `Long`. The error surfaces as a
constructor-not-found at query compilation, and reading it requires knowing what
JPQL says each aggregate returns — §4.9.5.

**⚠️ Aliases inside a constructor expression.**
Spring Data's reference is explicit: "JPQL constructor expressions must not
contain aliases for selected columns and query rewriting will not remove them for
you", and while `select u as user, count(u.roles) as roleCount` is valid for
interface projections, "the same construct is invalid when requesting a DTO".
Some providers are lenient; do not rely on it.

**⚠️ Grouping by an entity rather than by its columns.**
`group by o` is accepted by some providers and expands to the entity's columns,
which is usually not the grouping you wanted and is not portable. Group by the
identifier and the columns you select.

**⚠️ Treating the projection as a place to put presentation logic.**
A projection is a query result. Formatting, currency symbols and localised labels
belong above it. The moment the DTO has methods that do work, it is a view model,
and mixing the two makes the query harder to change than it should be.

**⚠️ Projecting so aggressively that a second query becomes necessary.**
Three projections for one endpoint is three round trips. Sometimes that is right;
sometimes the honest answer was one entity query with a fetch join. Count the
statements the endpoint issues in total, not per query.

**⚠️ Assuming a projection avoids the join problems.**
It avoids the *entity* problems. A projection over two collections is still a
Cartesian product at the SQL level — you get `lines × shipments` rows, each
narrow. It is a much cheaper mistake than the entity version, and it is still a
mistake.

**⚠️ Using a projection and then loading the entity anyway to make a decision.**
`findSummaries()` then `findById()` per row is an N+1 built out of projections.
The projection is a shape, not a discipline; the discipline is deciding what the
unit of work needs before writing either query.

**⚠️ Reaching for a native query because the JPQL felt awkward.**
A constructor expression over a native query needs `@SqlResultSetMapping` or
positionally-matching constructor arguments, and you lose the query compiler that
catches the mismatches above at bootstrap. Try the JPQL first.

## Interview questions

**★ Why is a projection a better answer to N+1 than a fetch join?**
Because it removes the mechanism rather than managing it. There is no lazy
association, no proxy, no persistence context, so there is nothing that can
trigger a query later. A fetch join is correct for the code as it exists today and
can be defeated by a change to a serialiser next quarter; a projection has
nothing to defeat. Hibernate's own user guide puts DTO projection first when it
lists better alternatives to `@BatchSize`.

**★ What does the specification require of a constructor expression?**
That the class name be fully qualified, and nothing else about the class: §4.9.2
says "the specified class is not required to be an entity or to be mapped to the
database". The constructor arguments may be path expressions, scalar expressions,
aggregates or identification variables. A Java `record` is the natural fit,
because value semantics are exactly what a query result has.

**★ What is the trap in `select new View(o, count(l))`?**
`o` is an entity, and the specification says an entity referenced as a constructor
argument "will be in the managed state". So the DTO is a wrapper around a managed
entity with all its lazy associations intact, and serialising it produces exactly
the N+1 the projection was meant to prevent. The rule is that a projection's
constructor arguments must be scalars.

**★ How does a projection interact with dirty checking?**
It does not participate. Nothing is managed, so no snapshot is taken, nothing is
compared at flush, and nothing can be written by accident. That is a stronger
guarantee than `@Transactional(readOnly = true)`, which asks the runtime not to
flush — a projection has nothing to flush in the first place.

**★ What can a projection not do?**
Write. And it cannot directly produce a DTO containing a nested collection,
because a constructor expression consumes one flat row — building `Order` with a
`List<Line>` needs either two queries or grouping a flat result in Java
([chunk 12b](12b-projecting-a-collection.md)). It also bypasses the second-level
entity cache, since it is a query rather than a lookup.

**★ Does a projection avoid the Cartesian product?**
No. Joining two collections in a projection still produces `lines × shipments`
rows; they are just narrow rows carrying four columns instead of every column of
four entities. The projection makes the mistake cheaper, not impossible, and the
diagnosis is the same one — look at the row count.

**★ When would you deliberately not use a projection?**
When the unit of work modifies data, because you need managed entities to do
that. When the operation is a genuine aggregate load — read the order, apply a
domain rule, write it back. And when the endpoint is small and stable and the
fetch join is already there and obvious; replacing a working `join fetch` with a
projection for its own sake is churn.

**★ How would you introduce projections into a codebase that returns entities
from every endpoint?**
Endpoint by endpoint, starting with the read-only ones that serialise the most.
Each conversion is local: a record, a query, and a controller change. The signal
to look for is an endpoint whose response is a document — those are the ones where
the entity was never the model, which is
[chunk 12d](12d-the-entity-was-never-the-model.md).

---

← Prev: [11b · The subselect trap](11b-the-trap.md) · Index: [08 · The N+1 problem](README.md) · Next → [12b · Projecting a collection](12b-projecting-a-collection.md)
