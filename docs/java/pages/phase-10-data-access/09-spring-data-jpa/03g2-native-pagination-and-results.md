---
title: "Paginating a native query needs a count query Spring Data can only sometimes derive — and scrolling and reliable dynamic sorting are simply not on offer for a string-based query at all"
sidebar_label: "03g2 · Native pagination"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "JPA Query
> Methods", sections "Native Queries" and "Query Introspection and Rewriting"
> ([query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html));
> "Scrolling Large Query Results" on the same page.
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**Returning a `Page` requires a count query, and deriving one from arbitrary SQL
requires parsing arbitrary SQL — which the project says plainly it does not
attempt in general. So pagination over native SQL is a choice between three
routes with different costs, one of which most people forget. Two further
conveniences are not available here at any price: scrolling does not work with
string-based query methods, and dynamic `Sort` is appended to text nobody
parsed.**

## The count query, and why it is hard

Spring Data can, in principle, derive a `COUNT` query from a declared one — that
is how a JPQL `Page` method works without you writing anything. For SQL it is
candid about the limits:

> "Our built-in SQL query enhancer supports only simple queries for introspection
> `COUNT` query derivation. A more complex query will require either the usage of
> JSqlParser or that you provide a `COUNT` query through `@Query(countQuery=…)`."

and, on why:

> "SQL on the other hand allows for quite some variance across dialects. Because
> of this, there is no way Spring Data will ever be able to support all levels of
> query complexity. We are not general purpose SQL parser library but one to
> increase developer productivity through making query execution simpler."

So there are three routes to a paginated native query, in increasing order of how
much you should like them:

**1. Write the count query yourself.** Explicit, no dependency, no parsing
involved, and it is checked by exactly nothing — so it is a second string to keep
in step with the first.

```java
@NativeQuery(value = "SELECT * FROM USERS WHERE LASTNAME = ?1",
        countQuery = "SELECT count(*) FROM USERS WHERE LASTNAME = ?1")
Page<User> findByLastname(String lastname, Pageable pageable);
```

**2. Put JSqlParser on the classpath.** *"If JSqlParser is on the class path,
Spring Data JPA will use it for native queries."* One dependency, and derivation
starts working for queries the built-in enhancer cannot handle. It is a
whole-application switch, not a per-query one.

**3. Return a `Slice` instead.** No count query is needed, because a `Slice`
answers "is there more" rather than "how many". If the UI does not print a total
page count, this removes the problem instead of solving it —
[05 · pageable and sort](05-pageable-and-sort.md).

⚠️ **A hand-written `countQuery` is a correctness risk, not just duplication.**
The two strings must have the same `where` clause forever. When they drift, the
rows are right and the total is wrong, which produces a last page that is empty
or a pager that stops early — a bug that looks like a UI defect for weeks.

For named native queries the mechanism is different again: *"a similar approach
also works with named native queries, by adding the `.count` suffix to a copy of
your query"*, with the caveat that *"you probably need to register a result set
mapping for your count query, though"*.

If you need finer control over which enhancer is used, `QueryEnhancerSelector` is
the strategy interface, configured on the annotation:

```java
@Configuration
@EnableJpaRepositories(queryEnhancerSelector = MyQueryEnhancerSelector.class)
class ApplicationConfig { }
```

## What the query introspection is for

The same machinery does four jobs, and it is worth knowing the list because it
explains what breaks when the parser cannot cope. Spring Data JPA can:

- introspect a query for its projection and run a tuple query for interface
  projections;
- use DTO projections when the query has a constructor expression, and rewrite
  the projection when the query declares the entity alias or a multi-select;
- apply dynamic sorting;
- derive a `COUNT` query.

Those work through dialect-specific parsers for HQL and EQL — *"as these dialects
are well-defined"*. Native SQL has no such guarantee, which is the whole reason
the previous section exists.

## Two things that simply are not available

**Scrolling.** *"Scrolling with String-based query methods is not yet supported"*
— so `Window` and `ScrollPosition`, including keyset scrolling, are for derived
queries, Query by Example and Querydsl, not for a `@Query`. It is also *"not
supported using stored `@Procedure` query methods"*.

**Reliable dynamic sorting.** `Sort` is appended as text. For JPQL that text is
parsed; for native SQL the enhancer may or may not be able to place it. Static
ordering inside the SQL string is the dependable option, and that removes
per-request sorting from the method's API.

## Gotchas

**⚠️ Returning `Page` from a native query and not thinking about the count.**
It works for simple SQL and stops working the moment the query grows a join, a
union or a `group by` — as a runtime failure, because nothing parsed it at
startup.

**⚠️ Writing a `countQuery` and then editing only the main query.**
The rows and the total drift apart. Nothing checks that the two `where` clauses
agree, and the symptom — a pager that ends early or shows an empty last page —
does not look like a query defect.

**⚠️ Forgetting that the hand-written count query is also unvalidated.**
Both strings are native and neither is parsed until it runs. A `countQuery` with
a syntax error is discovered by the first request that asks for a page, and only
by that.

**⚠️ Adding JSqlParser and assuming everything now derives.**
It broadens what can be introspected; it does not make derivation universal.
Complex SQL still deserves an explicit count query, and now you have a dependency
whose version is one more thing to track.

**⚠️ Using `count(*)` where the main query has a `group by`.**
The count of grouped rows is not `count(*)` over the base table; it is a count of
the grouped result. A hand-written count for an aggregate query is the case most
likely to be wrong, and the one people write fastest.

**⚠️ Counting over a query with `distinct` and forgetting the `distinct`.**
Same failure, different cause: the rows are de-duplicated and the total is not,
so the pager promises pages that do not exist.

**⚠️ Paying for a count you never display.**
A `Page` issues a second query on every request. If the screen shows "next" and
"previous" rather than "page 7 of 143", a `Slice` removes the whole problem —
including the native count-derivation problem — for free.

**⚠️ Believing `Sort` will be applied wherever you put it.**
Ordering is appended to the query text. A native query with a `union`, a subquery
carrying its own order, or a limit already in the string may end up with the
order clause somewhere it is not valid — or valid and ignored.

**⚠️ Exposing per-request sorting over a native query without testing each
property.**
Every sortable property is a different appended clause against SQL nobody parsed.
The one nobody tried is the one that fails, and it fails for a user rather than
for the build.

**⚠️ Designing a cursor API on top of a `@Query`.**
Scrolling is not supported for string-based query methods, so `Window` and
`ScrollPosition` are unavailable. Discovering that after the API is public is
expensive; it is a constraint to check at design time.

**⚠️ Assuming `OFFSET` in the native string and `Pageable` compose.**
They do not compose the way you would like — Spring Data applies its own paging,
and a limit already in the string is a second, independent restriction. Pick one
mechanism per method.

## Interview questions

**★ Why can't Spring Data always derive a count query from native SQL?**
Because deriving one means parsing the query, and SQL varies across dialects. The
project's own position is that it is not a general-purpose SQL parser: the
built-in enhancer handles simple queries, anything more needs JSqlParser on the
classpath or an explicit `countQuery`.

**★ What are your options for a paginated native query?**
Write `countQuery` yourself; add JSqlParser so derivation covers more shapes; or
return a `Slice`, which needs no count at all. The third is the one people forget,
and it is often the right answer because most screens do not need a total.

**★ What is the risk in a hand-written count query?**
Drift. It is a second string with the same predicate and no mechanism keeping
them in step, and neither is validated before it runs. When they disagree the
rows are right and the total is wrong, which reads as a UI bug rather than a
query bug.

**★ Your main query has `group by` and `distinct`. What does the count query look
like?**
Not `count(*)` on the base table. It has to count the *result* of the grouping —
typically a count over a subquery containing the same grouping and the same
`distinct` — otherwise the total describes a different query from the one that
produced the rows.

**★ How do named native queries get a count query?**
By convention: a copy of the query registered with the `.count` suffix. The
reference adds that you probably need a result-set mapping registered for the
count query as well.

**★ What is `QueryEnhancerSelector`?**
The strategy interface that decides which `QueryEnhancer` handles a given query,
configurable on `@EnableJpaRepositories`. It is the fine-grained control for
introspection behaviour, and you can supply your own `QueryEnhancer`
implementation.

**★ What four jobs does query introspection do?**
Run a tuple query for interface projections; use or rewrite DTO projections when
the query has a constructor expression or a multi-select; apply dynamic sorting;
and derive a `COUNT` query. All four are why the parser exists, and all four
degrade when the parser cannot read the query.

**★ Can you use keyset scrolling with a `@Query`?**
No. Scrolling is not supported for string-based query methods, nor for stored
`@Procedure` methods. It works with derived queries, Query by Example and
Querydsl — a genuine constraint on API design, because a cursor-based endpoint
cannot be backed by a hand-written query.

**★ How reliable is `Sort` on a native query?**
Less reliable than on JPQL, because the ordering is appended to text the enhancer
may not have parsed. Static ordering inside the SQL is dependable; per-request
sorting over native SQL should be tested for every property you intend to expose.

**★ Why is `Slice` under-used?**
Because `Page` is the default shape in most examples and the total looks free. It
is not: it is a second query per request, and for native SQL it is also the thing
that drags in JSqlParser or a duplicated string. If the UI does not print a total,
`Slice` is strictly cheaper.

{/* FOOTER */}
