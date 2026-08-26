---
title: "Binding substitutes values and nothing else — it will not rewrite a null into is null, it will not escape a wildcard, and it cannot change the shape of the query"
sidebar_label: "03d · What binding does not do"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "JPA Query
> Methods", sections "Using Advanced LIKE Expressions" and "Templated Queries and
> Expressions"
> ([query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html));
> the deprecation of `org.springframework.data.jpa.repository.Temporal` in 4.0
> ([deprecated-list](https://docs.spring.io/spring-data/jpa/docs/current/api/deprecated-list.html));
> Jakarta Persistence 3.2 §4.6 (conditional expressions, `like … escape`).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**Everything a derived query does *to* your arguments — rewriting `null` into
`is null`, wrapping a `Containing` value in escaped wildcards, deciding the
argument count from a keyword — is a service of the name parser. A `@Query` has
no parser doing that on your behalf: the string is the query, the argument is the
value, and the only clever thing Spring Data does is move a `%` from the query
text onto the bound value. Most `@Query` surprises are a derived-query habit
arriving in a place that does not have the habit.**

## `like` and the `%` that lives in the query

Spring Data recognises a wildcard written into the JPQL and moves it onto the
argument:

```java
@Query("select u from User u where u.firstname like %?1")
List<User> endingWith(String firstname);
```

> "In the preceding example, the `LIKE` delimiter character (`%`) is recognized,
> and the query is transformed into a valid JPQL query (removing the `%`). Upon
> running the query, the parameter passed to the method call gets augmented with
> the previously recognized `LIKE` pattern."

So the string that reaches the provider has no `%` in it; the argument does. This
is why you must not *also* append `%` at the call site — you would get `%%value%`
and a leading double wildcard.

🔴 **Nothing here escapes anything.** A derived `Containing` predicate sanitises
its argument (see
[02c · like, ignore case and grouping](02c-like-ignorecase-and-grouping.md)); a
`@Query` does not. If the value came from a user, `%` and `_` inside it are
wildcards, and a search box that accepts `%` is a search box that can be made to
scan the whole table. The supported escape hatch is the SpEL `escape(…)` helper
together with JPQL's `escape` clause, and that belongs to
[03e2 · expressions, escaping and their cost](03e2-expressions-escaping-and-cost.md).

## What binding does not do for you

**`null` is not rewritten.** In a *derived* query, a `null` argument to an
equality predicate is turned into `is null`. A `@Query` is a literal string:
`where u.status = :status` with a `null` argument stays `= null`, which in SQL is
never true, so the method returns nothing rather than everything. This asymmetry
between the two styles is a genuine trap and it is not called out where you would
look for it.

**Collections bind as a whole.** `where u.age in :ages` takes a `Collection`, and
the provider expands it. On PostgreSQL a varying number of elements means a
varying statement text unless the provider pads it, which is a prepared-statement
cache concern rather than a correctness one —
[topic 05 · `in` lists and the statement cache](../05-sql-first-access/05b-in-lists-and-the-statement-cache.md)
has the SQL-side version of the same argument.

**Types are converted by the mapping, not by you.** An enum parameter is bound
the way that field is mapped, a `java.time` value by the provider's type
descriptor. ⚠️ `@org.springframework.data.jpa.repository.Temporal` is deprecated
as of Spring Data JPA 4.0 — use `java.time` types and stop declaring temporal
precision at the query method.

**An entity binds as an entity.** `where o.customer = :customer` accepts a
`Customer` and compares primary keys. Passing a detached instance is fine; only
its identifier is used.

## Gotchas

**⚠️ Passing `null` to mean "ignore this filter" in a `@Query`.**
Unlike a derived query, nothing rewrites it to `is null`, and `= null` matches no
row. The method silently returns an empty list, which reads as "no data" rather
than as "broken query". Optional predicates need a `Specification`.

**⚠️ Migrating a derived method to `@Query` and keeping the callers.**
This is how the previous gotcha actually happens: the derived version tolerated a
`null` argument by turning it into `is null`, the hand-written one does not, and
the only thing that changed was the annotation. Check every call site for `null`
before converting.

**⚠️ Appending `%` at the call site as well as in the query.**
`like %?1` already augments the argument. Adding wildcards in the caller produces
`%%term%`, which still runs, still returns rows, and quietly disables any chance
of an index being used on that column.

**⚠️ Treating a `@Query` `like` as sanitised because the derived one is.**
`Containing` escapes `%` and `_` in the argument; `@Query` does not. A search box
wired to a hand-written `like` lets a user type `%` and read the whole table —
slowly, which makes it a denial-of-service as much as a disclosure.

**⚠️ Interpolating a value into the query string instead of binding it.**
Not possible in the annotation, very possible in a custom implementation, and
that is exactly where it appears. It is SQL injection with an extra step, and it
defeats the prepared-statement cache as well.

**⚠️ Binding a `String` where the mapping expects an enum.**
It fails at execution, not at startup, because the parse checks only the query.
The signature and the mapping have to agree and only the runtime knows whether
they do — one of several reasons a repository needs at least one test per method.

**⚠️ Passing an empty collection to an `in` clause.**
`in ()` is not valid SQL, and what happens next depends on the provider: some
render a predicate that is always false, some fail. Guard the empty case in the
caller rather than discovering which one you have in production.

**⚠️ Assuming a `Collection` parameter and an array behave alike.**
Derived `In`/`NotIn` accept arrays and varargs as well as collections; a
hand-written `in :ids` is bound by the provider and is happiest with a
`Collection`. It is a small difference that only shows up when a method is
converted from one style to the other.

**⚠️ Still declaring temporal precision at the query method.**
`@org.springframework.data.jpa.repository.Temporal` is deprecated as of Spring
Data JPA 4.0. Use `java.time` types on the entity and on the method, and let the
mapping decide the SQL type.

**⚠️ Binding a managed entity and expecting the query to see its unflushed
changes.**
Binding uses the identifier, and the database sees whatever has been flushed.
Changing a field on the entity and then filtering on that field in a query is a
flush-ordering question, not a binding one —
[06 · flush](../06-jpa-hibernate-model/15-flush.md).

**⚠️ Expecting the bound value to be visible in the SQL log.**
The value is bound, not inlined, so the statement shows a placeholder. Reading
the argument requires the provider's parameter logging, and that is a separate
switch — the observability half is
[06 · seeing what Hibernate does](../06-jpa-hibernate-model/18-seeing-what-hibernate-does.md).

## Interview questions

**★ How do you write a `contains` search with `@Query`?**
Put the wildcards in the query — `like %?1%` — and let Spring Data move them onto
the bound value; the `%` is removed from the query text before it reaches the
provider. Do not add wildcards in the caller as well, and remember that unlike a
derived `Containing` predicate this does no escaping.

**★ Is a user-supplied search term safe in a `like`?**
Not automatically. It cannot inject SQL, because it is bound — but `%` and `_`
inside the value are wildcards, so a user can widen the search to the entire
table. Sanitising it needs the SpEL `escape(…)` helper plus JPQL's `escape`
clause, or a manual replacement before the call.

**★ What does passing `null` to a `@Query` parameter do?**
It binds `null`, and `= null` is never true, so the query returns nothing. This
is different from a derived query, where a `null` argument to an equality
predicate is rewritten to `is null`. Using `null` as an "any value" sentinel is
wrong in both, but it fails differently in each — and the difference bites when a
derived method is rewritten as a declared one.

**★ How do you bind a list for an `in` clause?**
Declare the parameter as a `Collection` and write `in :ids`. The provider expands
it into the statement; on PostgreSQL that means the statement text varies with
the number of elements unless the provider pads or passes an array, which matters
for the prepared-statement cache rather than for correctness.

**★ What happens if that list is empty?**
There is no portable answer, which is itself the answer: `in ()` is not valid
SQL, so the provider either renders an always-false predicate or fails. Handle
the empty case above the repository, where you can decide whether it means "no
rows" or "no filter".

**★ Can you bind an entity rather than its id?**
Yes — `where o.customer = :customer` takes the entity and the provider compares
identifiers. It reads well and it type-checks the call site; the trade is that
the caller has to have the entity, which may cost a load it did not otherwise
need.

**★ Does a bound parameter see changes you have made in the same transaction?**
Only through the flush. The value bound is the value you passed; what the
database compares it against is whatever has been written so far. That is why a
query after an in-memory modification can appear to ignore it — the ordering
question belongs to the persistence context, not to binding.

**★ Why is `@Temporal` on a query method deprecated?**
Because `java.time` types carry their own precision and the mapping already knows
the SQL type. Declaring it a second time at the query method was a leftover from
`java.util.Date`, and Spring Data JPA 4.0 deprecated it rather than keep two
sources of truth.

**★ Where does binding stop helping you?**
At the shape of the query. Binding substitutes values; it cannot add or remove a
predicate, change a join, or reorder a `group by`. The moment the *structure*
varies at runtime you need a `Specification` or Query by Example, not another
parameter.

**★ Someone reports that a search returns nothing for a valid term. Where do you
look first?**
At the arguments, not the query. A `null` where a value was expected, a caller
that already added `%`, a `String` bound against an enum column, or an empty
collection in an `in` clause — all four produce "no rows" from a query that is
itself perfectly correct.

{/* FOOTER */}
