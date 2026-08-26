---
title: "Spring Data will write the constructor expression for you when the return type is a DTO, and back off silently the moment you write one yourself"
sidebar_label: "12c2 · DTO projections in Spring Data"
sidebar_position: 43
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 *Projections* reference —
> "Class-based Projections (DTOs)", "Dynamic Projections" and "Using Projections
> with JPA" (Derived queries / String-based queries / JPQL Queries / DTO
> Projection JPQL Query Rewriting / Native Queries)
> ([docs.spring.io/spring-data/jpa/reference/repositories/projections.html](https://docs.spring.io/spring-data/jpa/reference/repositories/projections.html)),
> and the Jakarta Persistence 3.2 specification §4.9.2 *Constructor Expressions
> in the SELECT Clause*
> ([jakarta.ee/specifications/persistence/3.2](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1.

**A record return type is the clearest way to say "this endpoint does not want
entities", and Spring Data makes it nearly free by rewriting your query into a
constructor expression. The rules around that rewriting are short, undocumented
in most tutorials, and each of them has a failure mode that is silent.**

## The DTO

```java
record OrderSummary(String number, Instant placedAt) {}
```

> *"These DTO types can be used in exactly the same way projection interfaces are
> used, except that **no proxying happens and no nested projections can be
> applied**."*
>
> *"If the store optimizes the query execution by limiting the fields to be
> loaded, the fields to be loaded are determined from the **parameter names of
> the constructor** that is exposed."*

So **the constructor is the selector list**, and the parameter *names* — not just
the types — are what Spring Data reads. Two rules follow:

- *"types must declare a single constructor so that Spring Data can determine
  their input properties."* With more than one, annotate the intended one
  `@PersistenceCreator`.
- Records are the reference's own recommendation: *"Java Records are ideal to
  define DTO types since they adhere to value semantics: all fields are private
  final and `equals(…)`/`hashCode()`/`toString()` methods are created
  automatically."*

⚠️ A record with a compact constructor **plus** a convenience constructor has two
constructors and stops working. It is an easy accident, and adding a constructor
does not look like changing a query.

## Derived query methods

> *"Query derivation supports both, class-based and interface projections by
> introspecting the returned type. Class-based projections use JPA's
> instantiation mechanism (constructor expressions) to create the projection
> instance."*

So `List<OrderSummary> findByStatus(OrderStatus status)` with no `@Query` at all
generates a constructor expression from the record's components. This is the
cheapest projection in the whole framework — a record and a method signature.

The same limit as interface projections applies:

> *"Projections limit the selection to top-level properties of the target entity.
> Any nested properties resolving to joins select the entire nested property
> causing the full join to materialize."*

A record component named after a path across an association does not become a
narrow join. For that, write the join and the constructor expression yourself
([chunk 12](12-projections-and-dtos.md)).

## `@Query` and the rewriting

JPQL's own mechanism is §4.9.2's constructor expression, which requires a fully
qualified class name — *"(Note the usage of a FQDN for the DTO type!)"*. Spring
Data will write it for you:

```java
@Query("select o from Order o where o.status = :status")                     // (1)
List<OrderSummary> byStatus(@Param("status") OrderStatus status);

@Query("select o.number, o.placedAt from Order o where o.status = :status")  // (2)
List<OrderSummary> byStatus2(@Param("status") OrderStatus status);
```

Both are rewritten to
`select new com.example.OrderSummary(o.number, o.placedAt) from Order o where …`.
The reference calls case (1) "selection of the top-level entity" and case (2)
"multi-select of firstname and lastname properties", and rewrites both.

Four rules govern it, and every one has a silent failure:

| Rule | The reference's words | What goes wrong |
|---|---|---|
| It applies to DTO return types | *"repository query methods that return a DTO projection type (a Java type outside the domain type hierarchy) are subject to query rewriting"* | a "DTO" the entity implements is not one — see [12c](12c-spring-data-projections.md) |
| It backs off if you wrote one | *"if an `@Query`-annotated query already uses constructor expressions, then Spring Data backs off and doesn't apply DTO constructor expression rewriting"* | a half-finished constructor expression is yours to finish |
| Aliases are not removed | *"JPQL constructor expressions must not contain aliases for selected columns and query rewriting will not remove them for you"* | works on one provider, fails on another |
| The constructor must be all-args | *"Make sure that your DTO types provide an all-args constructor for the projection, otherwise the query will fail"* | a partial constructor fails at bootstrap |

On aliases, the reference is unusually specific about *why* it differs between
the two projection styles: `select u as user, count(u.roles) as roleCount FROM
User u` is *"a valid query for interface-based projections that rely on column
names from the returned `Tuple`"*, and *"the same construct is invalid when
requesting a DTO where it needs to be `SELECT u, count(u.roles) FROM User u`"* —
adding that *"some persistence providers may be lenient about this, others
not"*.

## Dynamic projections

One method, any shape at the call site:

```java
interface OrderRepository extends Repository<Order, Long> {
    <T> List<T> findByStatus(OrderStatus status, Class<T> type);
}
```

```java
List<Order>        full    = repo.findByStatus(OPEN, Order.class);
List<OrderSummary> summary = repo.findByStatus(OPEN, OrderSummary.class);
```

> *"Query parameters of type `Class` are inspected whether they qualify as
> dynamic projection parameter. If the actual return type of the query equals the
> generic parameter type of the `Class` parameter, then the matching `Class`
> parameter is not available for usage within the query or SpEL expressions. If
> you want to use a `Class` parameter as query argument then make sure to use a
> different generic parameter, for example `Class<?>`."*

This is the right shape when the same restriction serves a list view, a detail
view and an export — one query method, three record types, and the caller says
which. It is the projection equivalent of the entity-graph argument in
[chunk 9](09-entity-graph.md): separate the restriction from the shape.

## Native queries

Two paths, and the reference is explicit about when each applies:

- *"If properties of the result type map directly to the result (the order of
  columns and their types match the constructor arguments), then you can declare
  the query result type as the DTO type without further hints (or use the DTO
  class through dynamic projections)."*
- *"If the properties do not match or require transformation, use
  `@SqlResultSetMapping` through JPA's annotations to map the result set to the
  DTO and provide the result mapping name through
  `@NativeQuery(resultSetMapping = "…")`."*

⚠️ **The first path binds by column *order*.** Reordering the `select` list of a
native query silently rebinds every argument of the same type — a `(String,
String)` record swapped is compile-clean, test-clean if the fixtures are
symmetrical, and wrong.

## The restriction on inherited methods

> *"Declaring a method in your Repository that overrides a base method (e.g.
> declared in `CrudRepository`, a store-specific repository interface, or the
> `Simple…Repository`) results in a call to the base method regardless of the
> declared return type. Make sure to use a compatible return type as base methods
> cannot be used for projections."*

So you cannot make `findAll()` return a projection by re-declaring it. Give the
method its own name — which is better practice anyway, because the name then says
which view it returns. The reference notes that *"some store modules support
`@Query` annotations to turn an overridden base method into a query method"*;
naming the method is simpler and does not depend on that.

## Gotchas

**⚠️ A DTO with two constructors.**
"Types must declare a single constructor"; with two, annotate one
`@PersistenceCreator`. A record plus a convenience constructor is the usual way
this happens, and nothing about adding a constructor looks like editing a query.

**⚠️ Renaming a constructor parameter.**
The fields to load "are determined from the parameter names of the constructor
that is exposed", so a parameter rename is a selector change. Records make this
worse in a good way: the component name is the parameter name, so renaming a
record component to read better in JSON changes what the query selects.

**⚠️ Aliases in a `@Query` feeding a DTO.**
Valid for interface projections, which read names off a `Tuple`; invalid inside a
constructor expression; and rewriting "will not remove them for you". The
reference warns that providers differ in leniency, so a query that works today
can fail on an upgrade.

**⚠️ Adding a constructor expression by hand and wondering why rewriting
stopped.**
By design — Spring Data "backs off and doesn't apply DTO constructor expression
rewriting". That is correct behaviour and it means a partially-written
constructor expression is now entirely your responsibility, fully qualified name
and all.

**⚠️ A DTO without an all-args constructor.**
"Otherwise the query will fail." A record always has one; a hand-written class
with a builder and a private no-arg constructor does not, and the failure is at
bootstrap with a message about a missing constructor rather than about the query.

**⚠️ Re-declaring `findAll()` with a projection return type.**
It calls the base method regardless. Name the method something else.

**⚠️ Using a `Class<T>` dynamic-projection parameter inside the query.**
When the return type equals the `Class` parameter's generic type, that parameter
"is not available for usage within the query or SpEL expressions". Declare it
`Class<?>` if you need it as an argument too.

**⚠️ Relying on column order in a native-query DTO.**
The direct path matches "the order of columns and their types". Two adjacent
`String` columns swapped in the `select` list produce a silently wrong object.
Use `@SqlResultSetMapping` for anything with more than a couple of same-typed
columns, or alias and go through an interface projection.

**⚠️ Expecting a DTO return type to make a slow query fast.**
It narrows the `select` list. It does not change the joins, the predicates or the
row count, and a projection over a Cartesian product is still a Cartesian
product ([chunk 12](12-projections-and-dtos.md)).

**⚠️ Putting the DTO in the domain package and letting it become a supertype.**
"A Java type outside the domain type hierarchy" is the condition for rewriting.
A DTO that ends up implementing a domain interface — because it lives next to
them and somebody added a marker interface — quietly stops being a projection.
Keep response records in the package of the thing that returns them.

## Interview questions

**★ What are the constraints on a class-based projection?**
A single constructor, or `@PersistenceCreator` on the intended one, because the
fields to load are "determined from the parameter names of the constructor that
is exposed". No proxying and no nested projections — the reference says both
explicitly. And for a `@Query`, an all-args constructor. A record satisfies all
of it by construction, which is why the reference calls records "ideal to define
DTO types".

**★ When does Spring Data rewrite a query into a constructor expression?**
When the method returns a DTO type outside the domain type hierarchy and the
query selects the root entity or a list of select items — both
`select o from Order o` and `select o.number, o.placedAt from Order o` are
rewritten into `select new com.example.OrderSummary(o.number, o.placedAt) …`. It
backs off entirely if you already wrote a constructor expression, and it does not
remove aliases, which are invalid inside one.

**★ Why are aliases fine for an interface projection and not for a DTO?**
Because the two read the result differently. Interface projections are built from
`Tuple` queries and resolve values by column name, so `count(u.roles) as
roleCount` is exactly how they find the value. A constructor expression is
positional and takes a list of expressions, and an alias is not part of that
grammar. The reference says the same construct "is invalid when requesting a DTO"
and warns that providers vary in how strictly they enforce it.

**★ How do dynamic projections work, and what is their trap?**
`<T> List<T> findByStatus(OrderStatus status, Class<T> type)` lets the caller
choose the shape, so one restriction serves a list view, a detail view and an
export. The trap is that when the query's actual return type equals the `Class`
parameter's generic type, that parameter "is not available for usage within the
query or SpEL expressions" — so if you also want it as a query argument, declare
it `Class<?>`.

**★ How do you project a native query into a DTO?**
Either the columns line up with the constructor "in order and their types", in
which case declaring the DTO as the return type is enough; or they do not, in
which case `@SqlResultSetMapping` plus
`@NativeQuery(resultSetMapping = "…")`. I would reach for the mapping whenever
there is more than one column of a given type next to another, because the direct
path binds positionally and a reordered `select` list is a silent defect.

**★ Can you make an inherited `findAll()` return a projection?**
No. Re-declaring a base method "results in a call to the base method regardless
of the declared return type", and base methods "cannot be used for projections".
Declare a differently-named query method. That is better practice regardless,
because the method name then documents which view it returns.

**★ Derived query or `@Query` for a DTO?**
Derived, when the restriction is expressible as a method name — it is a record
and a signature, and Spring Data generates the constructor expression from the
record's components. `@Query` when the restriction needs joins, aggregates or
expressions the derivation cannot say. The one thing to avoid is the middle
ground: a `@Query` selecting the root entity purely so that the rewriting fires,
where a derived method would have said the same thing with less to read.

**★ What is the single biggest advantage of a record DTO over an interface
projection, in your view?**
That it is an ordinary object. It has value semantics, it serialises without a
proxy, it is trivial to construct in a test, and its constructor is a
human-readable statement of exactly which columns the endpoint needs. The
interface projection's closed/open distinction is a real cliff — one `@Value` and
the query stops being narrowed — and a record has no equivalent way to
accidentally stop being a projection, except by leaving the "outside the domain
type hierarchy" rule.

---

← Prev: [12c · Spring Data projections](12c-spring-data-projections.md) · Index: [08 · The N+1 problem](README.md) · Next → [12d · The entity was never the model](12d-the-entity-was-never-the-model.md)
