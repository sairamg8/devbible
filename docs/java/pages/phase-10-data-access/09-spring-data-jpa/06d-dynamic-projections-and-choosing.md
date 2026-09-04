---
title: "One query method can serve several shapes if you pass the shape in as a Class argument — a feature with one sharp edge in its parameter handling — and closing the chunk with the honest comparison of when each of the three projection forms is the right one"
sidebar_label: "06d · Dynamic projections"
sidebar_position: 33
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Projections", the
> *Dynamic Projections* section
> ([projections.html](https://docs.spring.io/spring-data/jpa/reference/repositories/projections.html));
> "Defining Query Methods"
> ([query-methods-details.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html));
> and the Spring Data JPA source for `QueryParameterSetterFactory`
> ([github.com/spring-projects/spring-data-jpa](https://github.com/spring-projects/spring-data-jpa/blob/main/spring-data-jpa/src/main/java/org/springframework/data/jpa/repository/query/QueryParameterSetterFactory.java)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**So far the projection has been fixed at compile time by the method's return type. A
dynamic projection moves that decision to the call, which removes the usual reason a
repository accumulates four near-identical finders. It also introduces the only place
in Spring Data where an ordinary-looking parameter is not a query parameter.**

## The shape

> *"So far, we have used the projection type as the return type or element type of a
> collection. However, you might want to select the type to be used at invocation time
> (which makes it dynamic)."*

```java
interface PersonRepository extends Repository<Person, UUID> {

  <T> Collection<T> findByLastname(String lastname, Class<T> type);
}
```

and at the call site:

```java
Collection<Person>    aggregates = people.findByLastname("Matthews", Person.class);
Collection<NamesOnly> summaries  = people.findByLastname("Matthews", NamesOnly.class);
```

One declaration, three possible results — the entity, an interface projection, a DTO —
each with the query narrowed (or not) exactly as if the type had been written into the
signature. This is the answer to a repository that has grown `findByStatus`,
`findSummariesByStatus` and `findIdsByStatus` with identical predicates: one method,
and the caller says what it needs.

Both the fluent `findBy(…)` APIs on `JpaSpecificationExecutor` and
`QueryByExampleExecutor` express the same idea through `as(…)` — see
[07c](07c-executing-specifications-and-examples.md).

## The sharp edge: a `Class` parameter is not always a query parameter

> *"Query parameters of type `Class` are inspected whether they qualify as dynamic
> projection parameter. If the actual return type of the query equals the generic
> parameter type of the `Class` parameter, then the matching `Class` parameter is not
> available for usage within the query or SpEL expressions. If you want to use a `Class`
> parameter as query argument then make sure to use a different generic parameter, for
> example `Class<?>`."*

Two separate facts are packed into that.

**One.** The rule that decides is *type equality between the method's generic return
type and the `Class` parameter's type argument*. `<T> Collection<T> f(String, Class<T>)`
matches, so the `Class` is consumed as the projection. `<T> Collection<T> f(String,
Class<?>)` does not match, so the `Class` stays an ordinary bindable argument you can
reference in the query.

**Two.** When it *is* consumed, it disappears from binding — and Spring Data's positional
numbering counts bindable parameters only. `QueryParameterSetterFactory` resolves
positional references against `parameters.getBindableParameters()`, the same list that
already excludes `Pageable`, `Sort`, `Limit` and `ScrollPosition`
([03c](03c-binding-parameters.md)). So in

```java
@Query("select p from Person p where p.lastname = ?1")
<T> List<T> findByLastname(String lastname, Class<T> type);
```

`?1` is `lastname` and there is no `?2`. Adding the `Class` parameter to an existing
`@Query` method does not shift the numbering — which is the behaviour you want, and
exactly the behaviour that makes it surprising the first time you count parameters by
eye and get a different answer than the framework.

## What the caller has to know

A dynamic projection weakens the type signature deliberately: the method now returns
`Collection<T>` for whatever `T` the caller asked for, and nothing checks that `T` is a
sensible projection of `Person`. Pass an unrelated interface and the failure is at
runtime, from the projection machinery, not from the compiler.

That is a real trade. A fixed return type documents the endpoint's contract in the
repository; a dynamic one moves that documentation to every call site. The rule that
has held up: use a dynamic projection when *the same predicate* is genuinely needed at
two or more granularities, and a fixed return type when there is one consumer.

## Choosing between the three forms

| | Interface, closed | Interface, open | DTO / record |
|---|---|---|---|
| Query narrowed | yes | no | yes |
| What you get back | proxy over a `Tuple` | proxy over the entity | a constructed object |
| Computed fields | `default` methods only | `@Value` SpEL, bean calls | in the constructor or the query |
| Nesting | yes (join still materialises) | yes | no |
| Nullable wrappers | yes | yes | no |
| `@Query` needs | aliases matching the getters | aliases matching the getters | a constructor expression, **no** aliases |
| Safe outside the transaction | yes | no — `target` may be lazy | yes |
| Serialises cleanly to JSON | usually | usually | always |

The decision procedure that falls out of that table is short:

1. **Do you need to write?** Then you need the entity, not a projection.
2. **Is the value computed from fields you are already selecting?** Closed interface
   projection with a `default` method, or a record with a derived accessor.
3. **Does the shape leave the transaction — a controller response, a message payload, a
   cache entry?** A record. It holds values, not proxies, and there is nothing left to
   initialise.
4. **Do several callers need different granularities of the same predicate?** Dynamic
   projection.
5. **Does the shape need aggregation, a window function or columns from an unmapped
   join?** No projection form reaches that. That is a `@Query` with a DTO constructor
   expression, or SQL-first access
   ([05 · when SQL-first beats an entity](../05-sql-first-access/10-when-sql-first-beats-an-entity.md)).

## Where projections stop

A projection selects properties of one aggregate. It does not:

- **aggregate** — `count`, `sum`, `avg` over a group are not properties, so they need a
  query that computes them and a DTO to receive them;
- **flatten a collection** — a to-many is still a to-many, and the four honest ways of
  projecting one are in
  [08 · 12b](../08-the-n-plus-1-problem/12b-projecting-a-collection.md);
- **reach an unmapped table** — the property resolver only knows the model;
- **narrow a join** — top-level properties only, as
  [06b](06b-computed-values-and-nesting.md) established.

Each of those is a query problem, and each is answered by
[07 · Specifications](07-specifications-and-criteria.md),
[03 · `@Query`](03-at-query-jpql.md) or a native query — not by a cleverer return type.

## Gotchas

**★ `Class<T>` is swallowed; `Class<?>` is bound.** If the `Class` parameter's type
argument equals the method's generic return type, it is the projection and is not
available to the query or to SpEL. Use a different generic to keep it as an argument.

**★ Positional parameters do not count the projection `Class`.** Binding is resolved
against bindable parameters only, alongside `Pageable`, `Sort` and `Limit`. Counting
parameters by eye gives the wrong index.

**★ A dynamic projection erases the contract from the repository.** Nothing at compile
time says which types are valid, and an unrelated `T` fails at runtime. Prefer a fixed
return type when there is exactly one consumer.

**★ It does not make the *query* dynamic — only the shape.** The predicate is still
whatever the method name or `@Query` says. If the predicate needs to vary, that is a
`Specification`, not a `Class` parameter.

**★ A dynamic projection over `Person.class` returns managed entities.** The same method
that hands out detached-safe records also hands out live entities, and the caller cannot
tell from the method name. Anything that depends on managed state now depends on an
argument.

**★ The count query behind a `Page` is unaffected by the projection.** Narrowing the
select list does nothing about the second query, which is still counting the matched
rows — see [05](05-pageable-and-sort.md).

**★ Test the shapes you actually pass.** A dynamic projection is a family of queries.
Testing one member proves nothing about the others; the interface projection can resolve
while the DTO's constructor expression fails.

## Interview questions

**★ What is a dynamic projection?**
A query method that takes a `Class<T>` argument and returns `T`, so the caller decides at
invocation time whether to receive entities, an interface projection or a DTO. The query
is narrowed exactly as though the type had been declared in the signature.

**★ How does Spring Data decide whether a `Class` parameter is a projection or an
argument?**
By type equality: if the actual return type of the query equals the `Class` parameter's
generic type argument, it is treated as the dynamic projection and removed from the
query's parameters. Declaring it as `Class<?>` instead keeps it bindable.

**★ In `@Query("… where p.lastname = ?1") <T> List<T> f(String lastname, Class<T> t)`,
what is `?2`?**
There is no `?2`. Positional binding is resolved against the bindable parameters, which
exclude the dynamic-projection `Class` just as they exclude `Pageable`, `Sort` and
`Limit`.

**★ What is the cost of a dynamic projection?**
The type signature stops documenting the contract. Nothing checks that the requested type
is a valid projection of the aggregate, and passing the entity class quietly returns
managed entities from a method most callers use to get detached values.

**★ When would you choose a record over a closed interface projection?**
When the object leaves the transaction — a controller response, a message, a cache entry
— because a record holds values with nothing left to initialise, and because value
semantics come for free. Interface projections are better when you want nesting or
nullable wrappers.

**★ When is no projection form the right answer?**
When the shape needs aggregation, a window function, columns from an unmapped join, or a
flattened collection. Those are query problems, not return-type problems, and they belong
to `@Query`, a `Specification` or SQL-first access.

**★ Does a projection change the count query behind a `Page`?**
No. The projection narrows the data query's select list; the count query still counts the
rows the predicate matched, and its cost is unchanged.

{/* FOOTER */}
