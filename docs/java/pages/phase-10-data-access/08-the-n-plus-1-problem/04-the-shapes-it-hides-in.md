---
title: "The loop is the textbook case and it is the one you will almost never meet — here are the shapes N+1 actually arrives in"
sidebar_label: "4 · The shapes it hides in"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 user guide §31.6.1 *Fetching
> associations*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Hibernate ORM 7.4 *A Short Guide to Hibernate 7* §8.4–8.6
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html))
> and the Jakarta Persistence 3.2 specification's `FetchType` defaults
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**[Chunk 1](01-one-hundred-and-one-queries.md) showed N+1 as a dereference
inside a loop, because that is the clearest way to see it. In real codebases it
is almost never written that way. This chunk and the two that follow are a
catalogue of the shapes it actually takes — and the reason a catalogue is
necessary is that in most of them there is no loop in your code at all.**

## Shape 1 · The lazy collection in a loop

The textbook case, restated for completeness. Any iteration over parents that
dereferences a lazy association:

```java
for (Order o : orders.findAll()) {
    total = total.add(o.getLines().stream()...);      // one select per order
}
```

Its variants all count as the same shape, and the last two are the ones that get
past review:

```java
orders.stream().map(o -> o.getLines().size())         // a stream, not a loop
orders.forEach(o -> audit(o.getCustomer().getName())) // a to-one, still N+1
orders.stream().flatMap(o -> o.getLines().stream())   // reads as flattening
```

Note the second line. **`@ManyToOne` is just as capable of N+1 as `@OneToMany`.**
If the association was mapped `fetch = LAZY` — which it should be, per
[Topic 07 · Relationships and fetch types](../07-relationships-fetch/README.md) — then
`o.getCustomer().getName()` initialises a proxy, and it does so once per order.

## Shape 2 · The eager `@ManyToOne` on a list result

This is the one that catches people who thought they were safe *because* they had
avoided lazy loading.

```java
@Entity
class Order {
    @ManyToOne                          // ← EAGER. That is the JPA default for @ManyToOne.
    Customer customer;
}
```

```java
List<Order> orders = em.createQuery("select o from Order o", Order.class)
                       .getResultList();
// nothing here touches customer at all
```

You get N+1 anyway. Hibernate must honour `EAGER`, the JPQL query said nothing
about `customer`, so after the orders come back Hibernate resolves each order's
customer — with a secondary select each. The user guide names this precisely:

> *"if you forget to `JOIN FETCH` an EAGER association in a JPQL query, Hibernate
> will initialize it with a secondary statement, which in turn can lead to N+1
> query issues."*

Two things make this shape especially nasty.

**There is no dereference to look for.** In shape 1 you can at least search for
the getter. Here the trigger is the *absence* of a join in a query written in
another file, and the code that pays for it does not mention `customer` at all.

**You cannot turn it off for this call.** The same section states the constraint
flatly: *"The EAGER fetching strategy cannot be overwritten on a per query
basis, so the association is always going to be retrieved even if you don't need
it."* A lazy association that you forgot to fetch can be fixed at the call site.
An eager one cannot be un-fetched at the call site at all — the only fix is to
change the mapping, which is a change to every other caller too.

This is the concrete reason the guide concludes *"So, EAGER fetching is to be
avoided"*, and why [16 · `EAGER` is not a fix](16-eager-is-not-a-fix.md) treats `EAGER` as a
cause of N+1 rather than a cure for it.

### Why the default is EAGER at all

Worth knowing, because it is asked and because it explains why this shape is so
common in old code. The user guide gives the history:

> *"Prior to Jakarta Persistence, Hibernate used to have all associations as
> LAZY by default. However, when Java Persistence 1.0 specification emerged, it
> was thought that not all providers would use Proxies. Hence, the `@ManyToOne`
> and the `@OneToOne` associations are now EAGER by default."*

So the default is a specification-era compromise about proxy support, not a
performance judgement — and the same guide's advice is to override it everywhere:
*"it's better if all associations are marked as LAZY by default."*

## Shape 3 · The mapper that walks the graph

Very common in layered codebases, and it hides the dereference behind an
abstraction boundary.

```java
@Service
class OrderService {
    List<OrderDto> recent() {
        return orders.findByPlacedAtAfter(cutoff).stream()
                     .map(mapper::toDto)                 // ← looks like pure conversion
                     .toList();
    }
}

@Component
class OrderMapper {
    OrderDto toDto(Order o) {
        return new OrderDto(o.getReference(),
                            o.getCustomer().getName(),   // ← query
                            o.getLines().size());        // ← query
    }
}
```

The service has no dereference in it. The mapper has no loop in it. **N+1 exists
only in the composition of the two**, and neither file is wrong when read alone.
Generated mappers — MapStruct and similar — have exactly this property, with the
additional twist that the dereferencing code does not exist in your source at all
until the annotation processor writes it.

The fix has a shape worth naming now, because
[12 · Projections and DTOs](12-projections-and-dtos.md)
argues it at length: if the destination of every one of these calls is a DTO
with three fields, **the entity was never the right thing to load**. A mapper
from an entity to a DTO is a strong signal that a projection would have been
better than a fetch join.

Three more shapes — nesting, the write side, and the per-element service call —
are in [chunk 4b](04b-three-more-shapes.md). The two shapes that arise from
serialisation and logging are [chunk 4c](04c-serialization-and-logging.md), and
the associations that cannot be made lazy at all are
[chunk 4d](04d-the-ones-you-cannot-make-lazy.md).

## Gotchas

**⚠️ Searching for `for (` to find your N+1s.**
Shapes 2 and 3 have no loop in the offending file, and shape 2 has no dereference
either. The reliable search is not textual at all — it is the statement count,
which is why [chunk 6](06-count-do-not-read.md) exists.

**⚠️ Assuming `@ManyToOne` is safe because it is a single row.**
A to-one association fetched once per parent is N queries just like a collection
is. It is often *worse* in practice, because the to-one is EAGER by default and
therefore fires even when nothing touches it.

**⚠️ Fixing the collection and leaving the to-one.**
A fetch join for `lines` that forgets `customer` removes one N and leaves the
other. When you fix a method, enumerate *every* association it touches — the
count assertion in [chunk 6b](06b-asserting-the-count-in-a-test.md) is what
tells you whether you got them all.

**⚠️ Believing a `@Query` with an explicit JPQL string is immune.**
It is immune only to the associations it actually fetches. An eager `@ManyToOne`
not named in the query still triggers a secondary select per row, so a
hand-written query can produce N+1 that `findAll()` would also have produced.

**⚠️ Thinking a mapper is "just conversion" and therefore free.**
A mapper that reads `o.getCustomer().getName()` is issuing a query, and the fact
that it is called from a `.map()` in a different class is what makes it
invisible. Generated mappers are worse: the dereferencing code does not exist in
your source until the annotation processor writes it.

**⚠️ Adding a fetch join to keep a mapper working, when the mapper's output is
three fields.**
That is treating the symptom. A mapper from an entity to a small DTO is the
strongest available signal that the entity was never the right thing to load —
see [12 · Projections and DTOs](12-projections-and-dtos.md).

## Interview questions

**★ Give two shapes N+1 takes that are not a `for` loop.**
First, an eager `@ManyToOne` on a query that returns many rows: nothing in the
calling code touches the association, but Hibernate must honour `EAGER`, and
since the JPQL did not join it, each row's association is resolved with its own
secondary select. Second, a mapper: the service maps entities to DTOs with
`.map(mapper::toDto)` and the mapper dereferences two associations — neither file
contains both the iteration and the dereference, so neither is wrong when read
alone. The common structure is one query per element of a collection; whether
that query is generated by a proxy, forced by an eager mapping, or written by
hand is incidental.

**★ Why is an eager `@ManyToOne` worse than a lazy one that you forgot to fetch?**
Because you cannot fix it at the call site. A lazy association you forgot to
fetch is fixed by adding a fetch join or an entity graph to that one query, and
every other caller is unaffected. An eager association is fetched whether or not
the caller wants it, and the Hibernate user guide states the constraint directly:
the EAGER strategy "cannot be overwritten on a per query basis, so the
association is always going to be retrieved even if you don't need it". Worse, it
actively creates N+1 — if a JPQL query does not join the eager association,
Hibernate initialises it with a secondary statement per row. So the only remedy
is to change the mapping, which is a change affecting every caller, and that is
why the guide's conclusion is that eager fetching is to be avoided.

**★ Why is `@ManyToOne` EAGER by default if eager is bad?**
It is a historical artefact of the specification rather than a performance
recommendation, and the Hibernate user guide says so: before Jakarta Persistence
existed, Hibernate defaulted every association to LAZY, but when the Java
Persistence 1.0 specification was written it was thought that not all providers
would use proxies — and without proxies there is no way to implement lazy to-one
fetching — so `@ManyToOne` and `@OneToOne` were specified as EAGER. That
constraint no longer applies to Hibernate, which is why the same guide advises
marking all associations LAZY explicitly. The practical consequence is that the
default is a trap in exactly the situation where it costs most: a query returning
many rows.

**★ A service does `repo.findAll().stream().map(mapper::toDto).toList()` and it
is slow. Where do you look?**
At the mapper, not the service — and specifically at every association it
dereferences. The service contains no query beyond `findAll()` and no
dereference, so reading it alone will tell you nothing. Open the mapper and count
the entity navigations: each one that crosses a lazy association is one query per
row, and each one that crosses an eager association was already one query per row
before the mapper ran. Then ask the more useful question: what does `OrderDto`
actually contain? If it is a handful of scalar fields, the right fix is not to
fetch-join the entity graph so the mapper keeps working — it is to stop loading
entities and select the fields directly, which is
[12 · Projections and DTOs](12-projections-and-dtos.md).

**★ Does a hand-written JPQL `@Query` protect you from N+1?**
Only for the associations it actually fetches, and only if none of the untouched
associations are eager. Writing the query yourself gives you the ability to add
`join fetch`, but it does not change the mapping — so an eager `@ManyToOne` that
your query does not mention is still resolved by a secondary select for every row
returned. In that specific sense a hand-written query can produce precisely the
N+1 that `findAll()` would have produced, and the false sense of control is part
of why the shape survives. The protection comes from what the query fetches, not
from the fact that a human wrote it.

---

← Prev: [3 · Why production is worse](03-why-production-is-worse.md) · Index: [08 · The N+1 problem](README.md) · Next → [4b · Three more shapes](04b-three-more-shapes.md)
