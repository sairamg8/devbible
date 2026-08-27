---
title: "The fluent query function is the only place in Spring Data where the projection, the ordering, the limit and the shape of the result are all chosen at the call site instead of being frozen into a method signature — and its two override rules are the part people get wrong"
sidebar_label: "07c · The fluent query API"
sidebar_position: 36
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Specifications"
> ([jpa/specifications.html](https://docs.spring.io/spring-data/jpa/reference/jpa/specifications.html)),
> "Query by Example"
> ([repositories/query-by-example.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-by-example.html))
> and "Defining Query Methods"
> ([query-methods-details.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html))
> — plus the 4.1 source of `JpaSpecificationExecutor`
> ([github.com/spring-projects/spring-data-jpa](https://github.com/spring-projects/spring-data-jpa/blob/main/spring-data-jpa/src/main/java/org/springframework/data/jpa/repository/JpaSpecificationExecutor.java)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**[07](07-specifications-and-criteria.md) and [07b](07b-query-by-example.md) built two
different kinds of dynamic predicate. Both are executed through the same fluent query
function — a lambda that takes a query object and must return a result. It exists because
a declared method signature can express *one* of projection, paging, ordering and limit
dynamically, and a search endpoint needs all four.
[07d](07d-what-the-base-repository-does.md) then takes up what the base repository does
with your predicate once you hand it over.**

## The signature

Both executors expose a `findBy` that takes the predicate and a function:

```java
// JpaSpecificationExecutor
<S extends T, R> R findBy(Specification<T> spec,
        Function<? super SpecificationFluentQuery<S>, R> queryFunction);

// QueryByExampleExecutor
<S extends T, R> R findBy(Example<S> example,
        Function<FluentQuery.FetchableFluentQuery<S>, R> queryFunction);
```

The reference gives the same rationale for both:

> *"As with other methods, it executes a query derived from a Specification. However,
> the query function allows you to take control over aspects of query execution that you
> cannot dynamically control otherwise."*

`SpecificationFluentQuery` is a 3.5 extension of the shared `FetchableFluentQuery`,
*"allowing slice results and pagination with a custom count Specification"* — so the
specification side has one method the example side does not, covered below.

## Intermediate methods

> *"`sortBy`: Apply an ordering for your result. Repeated method calls append each `Sort`
> (note that `page(Pageable)` using a sorted `Pageable` overrides any previous sort
> order)."*
>
> *"`limit`: Limit the result count."*
>
> *"`as`: Specify the type to be read or projected to."*
>
> *"`project`: Limit the queries properties."*

`as` and `project` are not the same lever and it is worth being precise about the
difference, because the reference gives each exactly one line. `as(Class<R>)` changes the
**type** you get back — it is a dynamic projection ([06d](06d-dynamic-projections-and-choosing.md))
with all the rules of [06](06-projections.md) intact: a closed interface projection
narrows the query, an open one does not, a DTO needs a usable constructor.
`project(String…)` names **properties** and leaves the type alone. You can use both: read
into a DTO with `as`, and restrict which properties are selected with `project`.

⚠️ **`project` takes property names as strings**, so it is one more place where a rename
does not propagate. It is also the only part of this API where you can ask for fewer
properties than the target type has, which produces a partially populated result rather
than an error.

## Terminal methods

`first`/`firstValue`, `one`/`oneValue`, `all`, `page`, `slice`, `scroll`, `stream`,
`count`, `exists`. Four of them carry semantics worth quoting:

> *"`first`, `firstValue`: Return the first value. `first` returns an `Optional<T>` or
> `Optional.empty()` if the query did not yield any result. `firstValue` is its nullable
> variant without the need to use `Optional`."*
>
> *"`one`, `oneValue`: Return the one value… Throws
> `IncorrectResultSizeDataAccessException` if more than one match found."*
>
> *"`scroll(ScrollPosition)`: Use scrolling (offset, keyset) to retrieve results as a
> `Window<T>`."*
>
> *"`stream()`: Return a `Stream<T>` to process results as a stream rather than a
> materialized Collection… The stream is stateful and must be closed after use."*

`count` and `exists` are terminals too, and they are the right answer to "does anything
match this dynamic predicate" — not `all().isEmpty()`, which fetches every row to decide.

```java
Page<CustomerProjection> page = repository.findBy(spec,
    q -> q.as(CustomerProjection.class)
          .page(PageRequest.of(0, 20, Sort.by("lastname"))));

Optional<Customer> match = repository.findBy(spec,
    q -> q.sortBy(Sort.by("lastname").descending())
          .first());

boolean any = repository.findBy(spec, FluentQuery::exists);
```

## The two override rules

The reference states one of them and the javadoc states both, precisely:

> *"The given `Pageable` will override any previously specified `Sort` if the `Sort`
> object is not `Sort#isUnsorted()`. Any potentially specified `limit(int)` will be
> overridden by `Pageable#getPageSize()`."*

So in a chain, **the `Pageable` wins twice**:

```java
repository.findBy(spec, q -> q
        .sortBy(Sort.by("createdAt").descending())   // ← discarded
        .limit(5)                                    // ← discarded
        .page(PageRequest.of(0, 20, Sort.by("id"))));
```

Neither the sort nor the limit survives. The result is twenty rows ordered by `id`. There
is no warning, and the code reads as though all three instructions apply.

Two consequences. Repeated `sortBy` calls **append**, which is the composable behaviour
you want when building an ordering from user input — but only if you then page with an
*unsorted* `PageRequest`. And `limit` is for the non-paging terminals (`all`, `stream`,
`scroll`); combining it with `page` is always a mistake, in the same family as the
`Pageable`-plus-`Limit` prohibition on declared methods
([02e](02e-limiting-and-static-ordering.md)).

## The query object does not outlive the call

> *"Intermediate and terminal methods must be invoked within the query function."*

and the javadoc on `findBy` says why:

> *"The query object used with `queryFunction` is only valid inside the `findBy(…)`
> method call. This requires the query function to return a query result and not the
> `FluentQuery` object to be used outside of the `findBy(…)` method."*

Returning the fluent object from the lambda compiles and produces something unusable. The
lambda must end in a terminal method. The same applies, more subtly, to `stream()`: the
`Stream` is legitimate to return, but it is stateful, must be closed, and must be consumed
while the transaction that produced it is still open.

## Scrolling, and the constraint it puts on your projection

`scroll(ScrollPosition)` is the keyset/offset cursor API from
[05b2](05b2-keyset-filtering-and-scrolling.md), and this is the one place it composes with
a *dynamic* predicate — string-based `@Query` methods cannot scroll at all, so a
specification plus `scroll` is the supported way to build a cursor endpoint with a
run-time filter.

The catch is documented in the "Consuming Large Query Results" table and it interacts
directly with `as(…)`:

> *"Results must expose all sorting keys in their results requiring projections to select
> potentially more properties than required for the actual projection."*

🔴 So a keyset `scroll` combined with a projection means the projection **must** contain
every property in the sort — including the tiebreaker id you added for correctness. A
`CustomerName` projection sorted by `createdAt, id` has to expose `createdAt` and `id`
whether or not the caller wants them. Leave one out and the cursor cannot be built.

## Gotchas

**★ A sorted `Pageable` passed to `page(…)` discards every earlier `sortBy`.** Repeated
`sortBy` appends; a sorted `Pageable` replaces. Express ordering in exactly one place per
call.

**★ `page(…)` also discards `limit(…)`.** The page size overrides it. `limit` belongs with
`all`, `stream` and `scroll`.

**★ The fluent query object is only valid inside the lambda.** Returning it instead of a
terminal result compiles and yields something you cannot use.

**★ `stream()` must be closed and must be consumed inside the transaction.** It is
stateful and holds resources; leaking it leaks a result set, and consuming it after the
transaction ends fails on the first lazy touch.

**★ `one()` throws on more than one match.** `IncorrectResultSizeDataAccessException`, not
a silent first row — the same contract as the single-result return types in
[01e](01e-return-types.md). `first()` is the one that tolerates duplicates, and it needs a
deterministic sort to mean anything.

**★ `firstValue`/`oneValue` return `null` rather than an `Optional`.** They exist for
callers who do not want the wrapper; they do not change what happens when nothing matched.

**★ `project(…)` takes strings.** Property names in a fluent chain are not refactored by
the IDE and are not checked by the compiler.

**★ `as(…)` is a dynamic projection, with every rule from [06](06-projections.md).** An
open interface projection here narrows nothing, and a DTO with two constructors fails at
run time.

**★ A keyset `scroll` forces the sort keys into the projection.** The result has to expose
every sorting key, so the projection selects more properties than the caller asked for —
including the id tiebreaker.

**★ `all().isEmpty()` where `exists` would do.** The terminal methods include `count` and
`exists`; using `all` to answer an existence question materialises the entire match set.

## Interview questions

**★ Why does the fluent `findBy` exist when `findAll(spec, pageable)` already does?**
Because a declared method signature cannot express "this predicate, projected to that
type, sorted this way, limited to n, returned as a `Page`" all at once. The query function
lets you set projection, sort, limit and result form at the call site on a dynamically
built predicate.

**★ Why must the lambda end in a terminal method?**
Because the query object is only valid inside the `findBy(…)` call. It is not a builder
you can hold; returning it gives you an object whose backing execution context is gone.

**★ What is the difference between `as` and `project`?**
`as` changes the type you get back — a dynamic projection, with all the closed/open and
constructor rules that implies. `project` names the properties to select and leaves the
type unchanged. They can be combined.

**★ You call `sortBy(...)`, then `limit(5)`, then `page(PageRequest.of(0, 20,
Sort.by("id")))`. What runs?**
Twenty rows ordered by `id`. A sorted `Pageable` overrides any previously specified sort,
and the page size overrides any specified limit. Neither of the first two calls has any
effect.

**★ How do you answer "does anything match this dynamic filter" cheaply?**
`repository.findBy(spec, FluentQuery::exists)` — or `count` if you need the number.
Fetching everything and checking the size is the version that gets slower as the data
grows.

**★ What extra constraint does a keyset `scroll` put on a projection?**
The result must expose every sorting key, so the projection has to select the sort columns
and the tiebreaker id even when the caller does not want them.

**★ Why can a cursor endpoint with a dynamic filter not be built on `@Query`?**
Because scrolling is not supported for string-based query methods. A `Specification` (or
an `Example`) plus the fluent `scroll` terminal is the supported route.

**★ What is the difference between `first()` and `one()` here?**
`one()` throws `IncorrectResultSizeDataAccessException` when more than one row matched;
`first()` takes the first row of whatever came back, which only has a defined meaning if
the query has a total ordering.

{/* FOOTER */}
