---
title: "Spring Data will narrow the query for a closed interface projection and will not for an open one, and that single sentence decides whether a projection is a fix or a wrapper"
sidebar_label: "12c · Spring Data projections"
sidebar_position: 42
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 *Projections* reference —
> "Interface-based Projections", "Closed Projections", "Open Projections",
> "Class-based Projections (DTOs)", "Dynamic Projections" and "Using Projections
> with JPA"
> ([docs.spring.io/spring-data/jpa/reference/repositories/projections.html](https://docs.spring.io/spring-data/jpa/reference/repositories/projections.html)),
> and the Jakarta Persistence 3.2 specification §4.9.2
> ([jakarta.ee/specifications/persistence/3.2](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1.

**Spring Data offers three projection styles and they are not interchangeable. A
*closed* interface projection lets it narrow the generated SQL; an *open* one —
the moment you add a single `@Value` — does not, and you are back to loading the
entity with a nicer wrapper on it. For an N+1 conversation, that distinction is
the entire content of this page.**

## Interface projections

Declare an interface whose getters match properties of the aggregate:

```java
interface OrderSummary {
    String getNumber();
    Instant getPlacedAt();
}

interface OrderRepository extends Repository<Order, Long> {
    List<OrderSummary> findByStatus(OrderStatus status);
}
```

The reference: *"The query execution engine creates proxy instances of that
interface at runtime for each element returned and forwards calls to the exposed
methods to the target object."* And, for JPA specifically: *"Spring Data JPA uses
generally `Tuple` queries to construct interface proxies for Interface-based
Projections."*

**The property names must match exactly.** There is no mapping layer; the getter
name *is* the selector.

## Closed versus open — the sentence that matters

> *"A projection interface whose accessor methods all match properties of the
> target aggregate is considered to be a **closed projection**."*
>
> *"If you use a closed projection, Spring Data can **optimize the query
> execution**, because we know about all the attributes that are needed to back
> the projection proxy."*

And the other half:

> *"A projection interface using `@Value` is an **open projection**. Spring Data
> **cannot apply query execution optimizations** in this case, because the SpEL
> expression could use any attribute of the aggregate root."*

🔴 **One `@Value` demotes the whole interface.** The optimisation is
all-or-nothing per interface, not per method, because Spring Data cannot know
which attributes a SpEL expression will reach for. So:

```java
interface OrderSummary {
    String getNumber();
    Instant getPlacedAt();

    @Value("#{target.number + ' / ' + target.customer.name}")   // ← now OPEN
    String getLabel();
}
```

That interface loads the full `Order` entity for every row, and `target.customer`
dereferences a lazy association per row — an N+1, created by a construct whose
name suggested it was preventing one.

**The fix is a `default` method**, which the reference recommends for exactly
this: *"For very simple expressions, one option might be to resort to default
methods"*, and *"this approach requires you to be able to implement logic purely
based on the other accessor methods exposed on the projection interface"* — which
is the point. A default method can only combine values the projection already
selects, so the interface stays closed.

```java
interface OrderSummary {
    String getNumber();
    String getCustomerName();                       // selected, not dereferenced

    default String getLabel() {                     // still CLOSED
        return getNumber() + " / " + getCustomerName();
    }
}
```

If the expression genuinely needs more, the reference's escape is a Spring bean:
`@Value("#{@myBean.getFullName(target)}")` — still open, still loading the
entity, and now with the cost visible in one place at least.

## Nested projections and their limit

Projections nest: a getter returning another projection interface is "wrapped
into a projecting proxy in turn". But:

> *"Projections limit the selection to top-level properties of the target entity.
> Any nested properties resolving to joins select the **entire nested property**
> causing the full join to materialize."*

So `OrderSummary.getCustomer()` returning a `CustomerName` projection does **not**
select two columns from `customer` — it materialises the whole join. Nesting is a
shaping feature, not a narrowing one, and this is the most commonly misread
sentence in the projections documentation.

An embedded (`@Embedded`) property is a different case: it is not a join, so it
stays within "top-level properties".

## The one that returns an entity instead of a projection

The reference opens with a rule that reads like housekeeping and is a real trap:

> *"Projection types are types residing **outside** the entity's type hierarchy.
> Superclasses and interfaces implemented by the entity are **inside** the type
> hierarchy hence returning a supertype (or implemented interface) returns an
> instance of the fully materialized entity."*

So if `Order implements Identifiable` and you declare
`List<Identifiable> findByStatus(...)`, you have not asked for a projection — you
have asked for orders, typed as `Identifiable`. Full entities, every column,
every lazy association, and no indication that the narrowing you intended did not
happen. Projection interfaces must be types the entity does **not** implement.

## Nullable wrappers

Getters may return `Optional<String>` — the reference lists `java.util.Optional`,
Guava's, `scala.Option` and Vavr's `Option`. *"If the underlying projection value
is not null, then values are returned using the present-representation of the
wrapper type. In case the backing value is null, then the getter method returns
the empty representation."*

## Gotchas

**⚠️ One `@Value` turning a closed projection open.**
The optimisation is per interface, not per method, "because the SpEL expression
could use any attribute of the aggregate root". A single computed getter loads the
whole entity for every row — and if the expression walks an association, it is an
N+1 wearing the word *projection*. Use a `default` method built from the other
getters instead.

**⚠️ Expecting nested projections to narrow a join.**
They do not: "any nested properties resolving to joins select the entire nested
property causing the full join to materialize". For column reduction across a
join, use a constructor expression over an explicit join
([chunk 12](12-projections-and-dtos.md)).

**⚠️ A getter name that does not match a property.**
There is no mapping layer. A misspelled or renamed property produces a failure
at query construction rather than compile time, and for an interface with a
`@Value` fallback it can silently return `null`.

**⚠️ Choosing an interface projection when the shape is a response body.**
The proxy is convenient and the record is honest: a `record` serialises directly,
has value semantics, is trivially testable, and its constructor documents the
selector list. Interface projections earn their place when you want several
narrow views of one aggregate without writing several records.

**⚠️ Assuming a closed projection means one query.**
It means a *narrower* query. If the closed projection's properties span a
collection, you still get one row per child, and the assembly problem from
[chunk 12b](12b-projecting-a-collection.md) is unchanged.

**⚠️ Declaring the return type as an interface the entity already implements.**
Then it is not a projection at all — the reference says returning "a supertype
(or implemented interface) returns an instance of the fully materialized entity".
This is the worst failure mode on the page, because the code reads exactly like a
projection and behaves exactly like an entity fetch. If your domain has a shared
`Auditable`/`Identifiable` interface, keep projection interfaces well away from
those names.

**⚠️ Naming a boolean getter inconsistently.**
`isActive()` and `getActive()` are different method names resolving against the
same property, and which one Spring Data matches depends on how the property is
exposed on the entity. Mirror the entity's accessor style rather than choosing
one.

**⚠️ Sorting or paginating by a property the projection does not expose.**
`Sort` and `Pageable` apply to the *query*, not to the projection, so sorting by
an unexposed column is fine. Sorting by a `default` or `@Value` computed getter is
not — there is no column behind it, and the failure is at query construction.

**⚠️ Relying on `equals`, `hashCode` or `toString` of a projection proxy.**
The reference describes the runtime object as a proxy that "forwards calls to the
exposed methods to the target object", and says nothing about value semantics. I
could not confirm from the Spring Data JPA 4.1 documentation what those three
methods do on the proxy, so I would not put projection instances in a `Set`, use
them as map keys, or assert on them with `isEqualTo` — use a record, which has
defined value semantics, when equality matters.

**⚠️ Serialising a nested projection and pulling in the join anyway.**
The nesting materialises the full join, so a response that looks narrow was
assembled from wide data. The response body is not evidence about the query;
count columns in the SQL, not fields in the JSON.

## Interview questions

**★ What is the difference between a closed and an open projection?**
A closed projection's accessors all match properties of the aggregate, so Spring
Data "can optimize the query execution, because we know about all the attributes
that are needed to back the projection proxy". An open projection contains at
least one `@Value` SpEL accessor, and then Spring Data "cannot apply query
execution optimizations … because the SpEL expression could use any attribute of
the aggregate root". It is all-or-nothing per interface: one `@Value` and the
whole thing loads the entity.

**★ Why does that matter for N+1?**
Because an open projection loads the entity, and a SpEL expression that walks an
association — `target.customer.name` — dereferences a lazy proxy once per row.
That is a textbook N+1 introduced by a construct named "projection". The fix is a
`default` method, which can only combine values the interface already exposes and
therefore keeps it closed.

**★ Do nested interface projections reduce the columns fetched?**
No, and this is the most misread sentence in the documentation: "projections
limit the selection to top-level properties of the target entity. Any nested
properties resolving to joins select the entire nested property causing the full
join to materialize." Nesting shapes the response; it does not narrow the query
across a join. An `@Embedded` property is not a join, so it is not affected.

**★ What happens if the projection interface is one the entity implements?**
You get entities. The reference states that projection types are "types residing
outside the entity's type hierarchy", and that "superclasses and interfaces
implemented by the entity are inside the type hierarchy hence returning a
supertype (or implemented interface) returns an instance of the fully
materialized entity". It is the nastiest failure on this page because the code
looks like a projection and behaves like a full fetch, with no error anywhere.

**★ How does Spring Data build an interface projection for JPA specifically?**
Through `Tuple` queries — the reference says "Spring Data JPA uses generally
`Tuple` queries to construct interface proxies for Interface-based Projections",
and the execution engine "creates proxy instances of that interface at runtime for
each element returned and forwards calls to the exposed methods to the target
object". That is why the accessor name must match the property name exactly:
the name is the selector, and there is no mapping layer to correct it.

**★ Can you use `Sort` and `Pageable` with a projection?**
Yes, because they apply to the query rather than to the projection — so you may
sort by a column the projection does not expose. What you cannot do is sort by a
`default` method or a `@Value` getter, because there is no column behind either;
that fails at query construction.

**★ Would you put projection instances in a `Set` or compare them in a test?**
Not interface projections. They are proxies forwarding to a target, and I could
not find a statement in the Spring Data JPA 4.1 documentation defining `equals`,
`hashCode` or `toString` on them. Where equality matters — deduplication, map
keys, assertions — a record DTO has defined value semantics and is the right
tool.

**★ Interface projection or record DTO?**
Record, by default. It serialises directly, has value semantics, and its
constructor parameter names are the selector list — the reference says the loaded
fields "are determined from the parameter names of the constructor that is
exposed", and calls records "ideal to define DTO types". Interface projections
are the better choice when you want several narrow views of one aggregate without
maintaining several records, and their cost is a proxy and the closed/open trap.

---

← Prev: [12b · Projecting a collection](12b-projecting-a-collection.md) · Index: [08 · The N+1 problem](README.md) · Next → [12c2 · DTO projections in Spring Data](12c2-dto-projections-in-spring-data.md)
