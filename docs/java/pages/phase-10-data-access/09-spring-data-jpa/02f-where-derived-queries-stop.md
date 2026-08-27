---
title: "Derived queries fail by becoming unreadable long before they fail by being inexpressible — and the list of things the grammar genuinely cannot say is short enough to memorise"
sidebar_label: "02f · Where derived queries stop"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Defining Query
> Methods"
> ([query-methods-details.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html)),
> "JPA Query Methods"
> ([query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html))
> and "Specifications"
> ([specifications.html](https://docs.spring.io/spring-data/jpa/reference/jpa/specifications.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1.

**There are two boundaries, and people usually notice the wrong one. The hard
boundary is what the grammar cannot express — grouping, left joins, aggregates,
subqueries, expressions — and it is a short, learnable list. The soft boundary
arrives much earlier: the point at which a method name is still perfectly legal
and no longer readable. A repository crosses the soft boundary silently, one
`And` at a time, and by the time anyone objects there are forty methods whose
names have to be parsed by a human before the query is knowable.**

## The soft boundary: a name you have to decode

Compare:

```java
List<Order> findByCustomerIdAndStatus(Long customerId, OrderStatus status);

List<Order> findByCustomerIdAndStatusAndPlacedAtBetweenAndTotalGreaterThanEqualAndExpeditedTrueOrderByPlacedAtDesc(
        Long customerId, OrderStatus status, Instant from, Instant to,
        Money minimum);
```

The second is legal. It resolves at bootstrap, produces correct JPQL, and is
faster to *write* than the equivalent `@Query`. It is also five positional
parameters, two of which are `Instant` and therefore transposable without a
compile error, and a name nobody will read — they will read the parameter list
and guess.

🔴 **The test is not "does it work". It is: can a reader state the `where` clause
after reading the name once?** When the answer is no, the name has stopped being
documentation and become an encoding. That is the moment to write the JPQL, and
it typically arrives at three predicates, not at ten.

Three smaller symptoms of the same thing:

- **Two same-typed parameters in a row.** Positional binding means a transposition
  compiles, starts and returns wrong rows.
- **A name with more than one keyword you had to look up.** `GreaterThanEqual`
  next to `Between` next to `True` is three different argument arities in one
  signature.
- **A method whose name is longer than the query it generates.** At that point
  the abstraction is costing more characters than it saves.

## The hard boundary: what the grammar cannot say

This list is worth knowing, because each item has a different escape hatch.

| Cannot express | Why | Escape |
|---|---|---|
| Grouping — `a and (b or c)` | no parentheses in the grammar; the parser splits on `Or` then `And` | `@Query`, or a `Specification` |
| A `left join` | path navigation implies an **inner** join | `@Query` with `left join` |
| An optional predicate | the name is fixed at compile time | `Specification`, or Query by Example |
| Aggregates and `group by` | the subject only chooses select/count/exists/delete | `@Query` with a constructor expression |
| A subquery or correlated `exists` | no syntax for one | `@Query`, or a `Specification` subquery |
| A function or arithmetic on a column | only `IgnoreCase` is available, and only as `UPPER(…)` | `@Query` |
| A join to an entity with no association mapped | the resolver walks mapped properties only | `@Query`, or SQL-first |
| Window functions, `case when`, set operations | not part of the method-name grammar, and partly not JPQL either | native query, or SQL-first |
| Ordering by an expression | `Sort.by("LENGTH(firstname)")` throws | `JpaSort.unsafe(…)`, with its own limits |

Two of those deserve their own sentence.

**The optional predicate is the one that actually forces the decision.** A search
screen with five nullable filters has 32 combinations. You cannot write 32
methods, and you cannot write one derived method, because the name is fixed. The
answer is a composable predicate —
[07 · specifications and criteria](07-specifications-and-criteria.md) — or a
probe object, [07b · query by example](07b-query-by-example.md). This is the
single most common reason a real repository outgrows derived queries.

**The left join is the one people do not notice.** "Customers with no orders in
the last year" is not expressible, and the derived attempt returns customers with
*some* order that is old — silently, because the inner join removed the
customers with no orders at all before the predicate was evaluated.

## What replaces it, in order of distance travelled

You do not have to jump to SQL. The ladder has rungs:

1. **`@Query` with JPQL.** Same entities, same types, same session; you gain
   grouping, joins you control, projections and aggregates. Validated at
   bootstrap like a derived query. [03 · `@Query`](03-at-query-jpql.md).
2. **A `Specification`.** For predicates assembled at runtime. Composable,
   type-checked against the metamodel if you generate one, and reusable across
   methods. Costs readability compared to JPQL.
3. **A projection.** When the problem is not the predicate but the shape of the
   result — you need three columns, not an entity. [06 · projections](06-projections.md).
4. **A native query.** When the SQL feature you need has no JPQL spelling —
   window functions, a database-specific operator, a CTE.
   [03g · native queries](03g-native-queries.md).
5. **SQL-first, with `JdbcClient`.** When the result was never an entity and the
   query is the point.
   [topic 05 · when SQL-first beats an entity](../05-sql-first-access/10-when-sql-first-beats-an-entity.md).

⚠️ **Moving down the ladder is not an admission of failure.** Spring Data's own
reference presents these as siblings, not as fallbacks. The failure mode is
staying on rung one past the point where it fits, which produces a repository of
long names and a service layer that filters in Java what the database should have
filtered.

## The filtering-in-Java tell

The clearest sign that a derived query has been pushed past its limit is not in
the repository, it is in the service:

```java
var candidates = repository.findByCustomerId(customerId);
var result = candidates.stream()
        .filter(o -> o.getStatus() == PLACED)
        .filter(o -> o.getTotal().isGreaterThan(minimum))
        .toList();
```

Each `filter` is a `where` clause that was not sent to the database. The query
returned every order the customer ever placed, the JVM discarded most of them,
and every one of them is now a managed entity in the persistence context. On a
customer with four orders this is invisible; on a customer with forty thousand it
is an incident. The persistence-context half of that cost is
[topic 06 · the persistence context](../06-jpa-hibernate-model/11-the-persistence-context.md).

## Gotchas

**⚠️ Growing a method name one `And` at a time.**
No single commit looks wrong. The sixth predicate is added by someone who did not
write the first five, and by then rewriting it as JPQL means re-testing every
caller. The cheapest moment to stop is the third predicate.

**⚠️ Writing a mixed `And`/`Or` name and believing your own grouping.**
The parser splits on `Or` first, so `findByAAndBOrC` is `(A and B) or C`. If the
requirement was `A and (B or C)`, the derived query is not slow or ugly — it is
wrong, and it looks right.

**⚠️ Using an inner-join traversal for a "has no…" requirement.**
Entities whose association is `null` are removed before the predicate runs, so a
negative predicate over a traversal cannot find them. This is the failure that
returns a plausible, smaller, wrong result set.

**⚠️ Writing one derived method per filter combination.**
Five optional filters is 32 methods, and the 33rd requirement doubles it. The
combinatorial explosion is the requirement telling you it needs a composable
predicate.

**⚠️ Passing `null` into a derived method to mean "no filter".**
It does not mean that. A `null` argument to an equality predicate becomes
`is null`, so "no status filter" turns into "status is null" and returns almost
nothing. This is the single most common attempted workaround for the previous
gotcha, and it fails quietly.

**⚠️ Filtering in the service instead of in the query.**
Every `stream().filter(…)` after a repository call is a predicate that was not
pushed down. It also inflates the persistence context with entities you
immediately discard, and the cost scales with the data rather than with the
result.

**⚠️ Sorting in the service for the same reason.**
`list.sort(…)` after a `findBy…` cannot use an index and cannot be combined with
a limit. If the order matters, it belongs in the query — and if it belongs in the
query, the limit belongs there too.

**⚠️ Reaching for a native query when JPQL would have done.**
JPQL is validated at bootstrap and survives a rename; native SQL is a string
against a schema, checked by nothing until it runs. Skipping rung one of the
ladder costs you the earliest failure you had.

**⚠️ Assuming a `Specification` is the answer to every hard query.**
It is the answer to a *dynamic* predicate. For a fixed complex query, a
`Specification` is a Criteria API expression of something JPQL says in one
readable line — more code, less legible, same SQL.

**⚠️ Keeping a derived method around "for compatibility" after writing the
`@Query` version.**
Two methods, one predicate, and no compiler link between them. The next change
to the requirement updates one of them.

**⚠️ Treating method-name length as the only signal.**
A short name can be past the boundary too: `findByCustomer` returning forty
thousand rows because the caller only wanted the recent ones is worse than a long
name that filters correctly. The signal is what the caller does with the result,
not how the method is spelled.

## Interview questions

**★ When do you stop using derived queries?**
When the name stops being readable, which is earlier than when it stops working.
The practical test is whether a reader can state the `where` clause after reading
the name once — usually true at two predicates, usually false at four. Two
same-typed positional parameters is a second signal, because a transposition
compiles.

**★ What can a method name genuinely not express?**
Grouping such as `a and (b or c)`; a left join; an optional predicate; aggregates
and `group by`; subqueries; functions or arithmetic on a column beyond
`IgnoreCase`; joins to entities with no mapped association; window functions and
`case when`; and ordering by an expression.

**★ Why can't it express `a and (b or c)`?**
There is no grouping token in the grammar. The predicate is split on `Or` first
and then on `And`, which always produces a disjunction of conjunctions. Anything
else needs JPQL or a `Specification`.

**★ A search screen has five optional filters. What do you build?**
Not derived queries — five optional filters is 32 combinations. A `Specification`
composed at runtime from whichever filters were supplied, or Query by Example if
the predicate is a flat conjunction of equality and string matches. Both push the
whole predicate to the database, which is the point.

**★ Why not just pass `null` for the filters you do not want?**
Because a `null` argument to a derived equality predicate is rewritten to
`is null` rather than being ignored. "No status filter" becomes "status is null".
The behaviour is documented and useful in its own right, which is exactly why it
makes a poor "any value" sentinel.

**★ How would you write "customers with no orders in the last year"?**
Not as a derived query. Path navigation implies an inner join, so customers with
no orders vanish before the predicate is evaluated. It needs JPQL with a
`left join` and an `is null` test on the joined side, or a `not exists`
subquery.

**★ What is the ladder between a derived query and raw SQL?**
`@Query` with JPQL for grouping, joins and aggregates; a `Specification` for
runtime-assembled predicates; a projection when the result shape rather than the
predicate is the problem; a native query for SQL features JPQL lacks; and
SQL-first access when the result was never an entity.

**★ Is dropping to `@Query` a failure of the abstraction?**
No. The reference presents declared queries as a first-class option, not a
fallback, and a derived name is only an abbreviation for a query you could have
written. The real failure is staying with derived queries past the point they fit
and moving the missing predicates into Java.

**★ How do you spot that in a code review?**
Look at the service, not the repository: `stream().filter(…)` or `list.sort(…)`
after a repository call is a `where` or `order by` that was not sent to the
database. It also fills the persistence context with entities that are discarded
immediately, so the cost grows with the table rather than with the answer.

**★ Would you use a `Specification` for a fixed but complicated query?**
Usually not. Specifications earn their complexity when the predicate varies at
runtime. For a fixed query, JPQL in a `@Query` says the same thing in fewer lines
and is far easier to read against the SQL it produces.

{/* FOOTER */}
