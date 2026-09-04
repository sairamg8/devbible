---
title: "A repository method's return type is not a cast at the end of the query, it is an instruction to the query builder — and the single rule that decides whether Spring Data honours it is whether the type sits outside the entity's own type hierarchy"
sidebar_label: "06 · Projections"
sidebar_position: 30
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Projections"
> ([projections.html](https://docs.spring.io/spring-data/jpa/reference/repositories/projections.html)),
> the *Introduction*, *Interface-based Projections*, *Closed Projections* and *Open
> Projections* sections plus *Using Projections with JPA*.
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**Every chunk so far has treated the return type as the shape of the answer. It is
more than that: Spring Data introspects the returned type *before* building the query
and uses it to decide what to select. Change `List<Order>` to `List<OrderSummary>` and
you have not added a mapping step — you have changed the SQL. This chunk is the
mechanism, the one precondition that makes it work at all, and the single sentence
that separates a projection which narrows the query from one which does not.**

## The precondition nobody reads

The reference opens the chapter with a sentence that decides whether anything else on
this page applies to your code:

> *"Projection types are types residing outside the entity's type hierarchy.
> Superclasses and interfaces implemented by the entity are inside the type hierarchy
> hence returning a supertype (or implemented interface) returns an instance of the
> fully materialized entity."*

Read that twice. If your `Order` entity implements `Identifiable`, then declaring

```java
List<Identifiable> findByStatus(String status);
```

does **not** project. It returns fully materialised `Order` entities, upcast. No
narrowing, no proxy, no reduced select list — and nothing anywhere tells you so. The
call compiles, the test passes, and the query is exactly the one you were trying to
avoid.

This is why projection interfaces are declared as standalone types with no relationship
to the entity. `OrderSummary` must not be something `Order` implements. The moment
somebody "tidies up" by making the entity implement its own summary interface, every
projection in the codebase silently reverts to loading entities.

## Interface projections and the proxy

An interface whose getters name properties of the aggregate is the lightest form:

```java
interface OrderSummary {
    Long getId();
    String getNumber();
    BigDecimal getTotal();
}

interface OrderRepository extends JpaRepository<Order, Long> {
    List<OrderSummary> findByStatus(String status);
}
```

You never implement `OrderSummary`. The reference:

> *"The query execution engine creates proxy instances of that interface at runtime
> for each element returned and forwards calls to the exposed methods to the target
> object."*

And, JPA-specifically:

> *"Spring Data JPA uses generally `Tuple` queries to construct interface proxies for
> Interface-based Projections."*

Those two sentences together explain most of the behaviour you will observe. The thing
in your `List` is a runtime proxy, not a class you can step into. It is **not** an
entity — not in the persistence context, not dirty-checked, no identity, nothing to
`save()`. Underneath it is a `Tuple`, which is why the getter names have to line up
with something the query actually selected.

The property names must match exactly:

> *"The important bit here is that the properties defined here exactly match
> properties in the aggregate root."*

`getTotalAmount()` against a field called `total` does not resolve, and nothing links the
interface to the entity for a compiler to check. A projection's property names go through
the same resolver derived queries use ([02d](02d-property-paths-and-ambiguity.md)).
⚠️ Whether a mismatch is reported when the repository is created or on the first call is
not something the reference states, and I did not confirm it — so treat a projection's
accessor names as something a test must cover, not something startup will catch for you.

## Closed projections are the ones that change the SQL

This is the distinction the whole feature turns on.

> *"A projection interface whose accessor methods all match properties of the target
> aggregate is considered to be a closed projection."*

> *"If you use a closed projection, Spring Data can optimize the query execution,
> because we know about all the attributes that are needed to back the projection
> proxy."*

Add one `@Value` and you are in the other category:

> *"A projection interface using `@Value` is an open projection."*

> *"Spring Data cannot apply query execution optimizations in this case, because the
> SpEL expression could use any attribute of the aggregate root."*

That is the whole rule, and it is *per interface*, not per method. One computed getter
demotes the entire projection:

```java
interface OrderSummary {
    Long getId();
    String getNumber();

    @Value("#{target.customer.name + ' — ' + target.number}")   // ← demotes the interface
    String getLabel();
}
```

Spring Data now has to hand the expression a fully populated `Order`, so it selects
one. The three narrow getters buy you nothing. Because the demotion is invisible at
the call site, an endpoint that used to select three columns quietly starts selecting
the whole row — and, if `target.customer` is lazy, one more query per row.

The aggregate root is exposed to the expression as `target`. That name is the reason
an open projection cannot be optimised: the expression may reach anything reachable
from the root, and Spring Data has no way to know in advance what.

🔴 **This page owns the mechanism; the consequence for N+1 belongs to topic 08.** The
argument for using a closed projection *as a fix for a fetching problem* is
[08 · 12c · Spring Data projections](../08-the-n-plus-1-problem/12c-spring-data-projections.md),
and the DTO variant of the same argument is
[08 · 12c2](../08-the-n-plus-1-problem/12c2-dto-projections-in-spring-data.md). This
topic covers projections as a Spring Data feature and links rather than re-arguing.

[06b](06b-computed-values-and-nesting.md) takes up what you can do inside a projection
without demoting it, plus nesting and nullable wrappers.
[06c](06c-class-based-projections.md) is the DTO form.

## Gotchas

**★ A projection type that the entity implements is not a projection.** Returning a
supertype or an implemented interface returns the fully materialised entity. The method
still compiles and still returns objects with the right getters, so nothing signals the
regression. Keep projection interfaces structurally unrelated to the entity.

**★ One `@Value` demotes the whole interface, not one getter.** Every other getter on
that projection loses the narrowing too. Review a projection as a unit, not line by
line.

**★ An open projection can re-introduce lazy loading per row.** The proxy is backed by
a real entity, so `#{target.customer.name}` initialises `customer` for every element of
the list. That is
[the N+1 shape](../08-the-n-plus-1-problem/04-the-shapes-it-hides-in.md) arriving
through a feature you adopted to avoid it.

**★ A projection is not managed.** It is a proxy over a `Tuple`. There is no dirty
checking, no identity and no `save()`. If a code path needs to write, it needs the
entity — which usually means the read method and the write method are different
methods.

**★ Getter names must match property names exactly.** `getTotalAmount()` will not find
`total`. There is no camel-case leniency and no `@Column`-name matching, and the compiler
has nothing to check against — the projection interface and the entity are unrelated types.

**★ Interface projections are proxies, so `equals`, `hashCode` and `toString` are the
proxy's.** Do not put them in a `HashSet` expecting entity semantics, and check what
your proxy actually renders before relying on it in a log line.

**★ Adding a getter to a shared projection changes every query that returns it.** A
projection interface is a select list. Widening it for one endpoint widens the SQL of
every endpoint using it — the same coupling problem an eager association has, in a
different file.

**★ The narrowing is a "can", not a "must".** The reference says Spring Data *can*
optimise for a closed projection and points at the module-specific documentation for
details. Treat a closed projection as permission to narrow, then confirm with the SQL
that it did.

## Interview questions

**★ What does the return type of a repository method actually do?**
It is introspected before the query is built. If it is a type outside the entity's type
hierarchy, Spring Data treats it as a projection and can narrow what the query selects.
If it is the entity, a supertype of it, or an interface the entity implements, you get
fully materialised entities.

**★ Why does returning an interface the entity implements not project?**
Because the reference defines a projection as a type residing *outside* the entity's
type hierarchy. A supertype or implemented interface is inside it, so Spring Data
returns the entity itself, upcast — with no warning at compile time or run time.

**★ What is actually in the `List` when a method returns `List<OrderSummary>`?**
Runtime proxy instances of that interface, one per result row, forwarding calls to an
underlying target — which for JPA is generally a `Tuple`. They are not entities, are not
in the persistence context, and cannot be saved.

**★ What is the difference between a closed and an open projection?**
A closed projection's accessors all match properties of the aggregate, so Spring Data
knows the complete attribute set and can optimise the query. An open projection uses
`@Value`, whose SpEL could touch any attribute of the root, so no optimisation is
possible.

**★ You added one computed field to a projection and the endpoint got slower. Why?**
The `@Value` made the whole interface open. Spring Data stopped narrowing the select
list, started materialising the entity to back the expression, and any lazy association
the expression touches is now initialised once per row.

**★ Can you modify and save a projection?**
No. There is nothing behind it to make managed — no dirty checking, no identity. Read
with the projection, write with the entity.

**★ A projection getter returns null for a column you know has a value. Where do you
look first?**
At the name. The accessor has to match the property exactly; a near-miss resolves
differently or not at all, and for a `@Query`-backed method with a `Tuple` result the
alias in the query has to match too.

**★ Why is a projection interface a coupling risk when shared across endpoints?**
Because it *is* the select list. Every property on it is fetched for every method
returning it, so one endpoint's requirement silently becomes every endpoint's cost.

{/* FOOTER */}
