---
title: "Spring Data removes the code that writes the SQL, not the SQL — there are four translations between a method name and a query plan, each one discards information the next cannot recover, and everything difficult about this topic lives in that gap"
sidebar_label: "11 · What it hides"
sidebar_position: 46
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Defining Query Methods"
> ([query-methods-details.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html))
> and "JPA Query Methods"
> ([jpa/query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html));
> and PostgreSQL 18 "LIMIT and OFFSET"
> ([postgresql.org](https://www.postgresql.org/docs/18/queries-limit.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**This is the closing argument of the topic. Spring Data JPA is an excellent abstraction
and the criticism it usually attracts — "too much magic" — is the wrong one. The right one
is narrower and harder to dismiss: it removes the *code*, and the *cost* stays exactly
where it was, now one level further from the file you are reading.**

## Four translations, and what each one drops

```
findByCustomerNameAndStatusOrderByCreatedAtDesc(String, Status, Pageable)
   ↓  Spring Data's parser
select u from Order u where u.customer.name = ?1 and u.status = ?2 order by u.createdAt desc
   ↓  Hibernate
select … from orders o inner join customers c on … where c.name = ? and o.status = ? order by o.created_at desc limit ? offset ?
   ↓  PostgreSQL's planner
a query plan — index scan or sequential scan, sort node or index order, nested loop or hash join
```

Each arrow is lossy in one direction.

**Method name → JPQL.** The name says *what* to filter, never *how*. A property traversal
becomes an **inner** join, so rows with a null association disappear
([02d](02d-property-paths-and-ambiguity.md)) — a semantic decision the name cannot express
and the reader cannot see.

**JPQL → SQL.** Hibernate decides the join shape, the alias set, whether a fetch is a join or
a second statement, and how many statements there are in total. `LAZY` on a mapping means
"another statement later"; nothing at the repository says how many later.

**SQL → plan.** The database decides everything that determines the actual cost. `ORDER BY`
is either an index scan or a sort of every matched row ([05c2](05c2-what-the-order-by-costs.md));
`OFFSET 500000` still computes and discards half a million rows
([05b](05b-offset-pagination-at-depth.md)). No Java construct anywhere expresses that
difference.

The repository interface sits at the top of that stack and shows you none of it. That is the
whole of the problem, and it is a *visibility* problem rather than a *correctness* one — the
generated SQL is nearly always right.

## The catalogue

Everything on this list is a real cost that a repository method does not display. Each row
names the chunk that owns it, and the point of collecting them here is that no single one of
them is surprising while the set of them is.

| What the method looks like | What actually happens | Owned by |
|---|---|---|
| `Page<T> findByX(…, Pageable)` | Two queries — the data query and a `COUNT` | [05](05-pageable-and-sort.md) |
| A `Pageable` at page 25,000 | The skipped rows are still computed server-side | [05b](05b-offset-pagination-at-depth.md) |
| A `Sort` on an unindexed column | Every matched row is sorted, on every page request | [05c2](05c2-what-the-order-by-costs.md) |
| `save(detachedEntity)` | A `merge`: an extra `SELECT`, and a *different* instance returned | [06 · 13b](../06-jpa-hibernate-model/13b-merge-returns-a-copy.md) |
| `deleteByStatus(…)` | Select every match, then delete one by one, firing callbacks | [04c](04c-derived-delete-versus-bulk-delete.md) |
| `deleteAllInBatch()` | One statement, no cascade, no lifecycle events, stale context | [04c](04c-derived-delete-versus-bulk-delete.md) |
| `@Modifying @Query("update …")` | The persistence context now disagrees with the database | [04b](04b-flush-clear-and-the-stale-context.md) |
| A projection with one `@Value` | The whole entity is loaded to back the expression | [06](06-projections.md) |
| A nested interface projection | The join materialises in full | [06b](06b-computed-values-and-nesting.md) |
| A `Specification` plus a `Pageable` | Your predicate runs twice, once against a `COUNT` | [07d](07d-what-the-base-repository-does.md) |
| A `List<Order>` returned to a serialiser | One query per row, per association | [08 · 4c](../08-the-n-plus-1-problem/04c-serialization-and-logging.md) |
| A declared query method | **No transaction at all** by default | [09](09-transactions-on-repositories.md) |
| Two repository calls, no boundary | Two transactions, two persistence contexts | [09c](09c-the-service-boundary.md) |
| `@Transactional(readOnly = true)` | Dirty checking off — a mutation writes nothing, silently | [09b](09b-what-readonly-actually-does.md) |
| An audited entity updated in bulk | Audit columns left stale, no callback | [10b](10b-what-the-handler-does.md) |
| A native `@Query` | Not validated at startup; first failure is in production | [03f](03f-what-is-checked-and-when.md) |
| `getReferenceById(id)` | No `SELECT` now; possibly an exception on first access | [01c](01c-what-jparepository-adds.md) |

Seventeen rows, none of them a bug in Spring Data, and all of them invisible in the interface
file.

## What it genuinely removes, and this matters

The abstraction is not on trial. What it takes away is real:

- **The implementation class.** No `EntityManager` handling, no `createQuery`, no result
  mapping, no null-checking a single result. A repository interface with fifteen methods is
  fifteen lines.
- **Exception translation.** Provider exceptions become Spring's `DataAccessException`
  hierarchy, so a unique-constraint violation is the same type whether it came from Hibernate
  or `JdbcTemplate` ([05 · the exception hierarchy](../05-sql-first-access/06-the-exception-hierarchy.md)).
- **Paging arithmetic**, sorting, limiting, scrolling and their result types — the code
  everybody writes slightly differently and one team always gets wrong at the boundary.
- **Bootstrap-time validation of derived queries and JPQL.** A mistyped property or a broken
  JPQL string fails at startup, which is better than any hand-written string-based data access
  layer offers ([03f](03f-what-is-checked-and-when.md)).
- **A uniform idiom across stores.** The same interface shape works against Mongo, Redis and
  the rest — the subject of topic [14 · Spring Data for other stores](../14-spring-data-other/README.md).

Nothing above is a small saving, and none of it is what causes production incidents.

## The rule that falls out

**You should be able to state, for every repository method you write, how many SQL statements
it issues and what each one is.** Not the exact text — the count and the shape.

That is a low bar and it fails constantly. `Page<OrderSummary> findByStatus(Status, Pageable)`
is two statements if the projection is closed, two statements plus one per row if somebody
adds a `@Value`, and two statements plus one per row per association if the projection is
replaced by the entity. The method signature changes by one word between those cases.

Three habits make the bar reachable:

1. **Turn the SQL on in development and read it once per new method.** Not `show-sql` — a
   logger, for the reasons in
   [08 · 5b](../08-the-n-plus-1-problem/05b-show-sql-is-not-the-answer.md).
2. **Count statements in tests where N is unbounded.** Counting is an assertion; reading a log
   is a habit that lapses — [08 · 6](../08-the-n-plus-1-problem/06-count-do-not-read.md).
3. **`EXPLAIN` the statements behind your paginated endpoints.** The Java side cannot tell you
   whether the `ORDER BY` came from an index.

## Where the abstraction is the wrong tool

Honest boundaries, since the topic has spent thirty-odd chunks inside them:

- **Reporting and aggregation.** Group-bys, window functions, `CASE` expressions and CTEs are
  not what an entity model is for. SQL-first access
  ([05 · when SQL-first beats an entity](../05-sql-first-access/10-when-sql-first-beats-an-entity.md))
  or [13 · jOOQ](../13-jooq/README.md).
- **Bulk data movement.** Millions of rows do not belong in a persistence context at all —
  neither `deleteBy` nor `deleteAllInBatch` is the right tool at that scale
  ([04c](04c-derived-delete-versus-bulk-delete.md)).
- **PostgreSQL-specific features.** `jsonb` operators, `distinct on`, full-text search,
  `insert … on conflict` — expressible natively ([03g](03g-native-queries.md)), and more
  honestly expressed in a SQL-first layer.
- **Anything where the query plan is the design.** If you are choosing the index before the
  method name, write the SQL.

Mixing is fine and normal: a `JpaRepository` for the aggregate, a fragment holding a
`JdbcClient` for the report ([08](08-custom-implementations.md)), one transaction over both —
with the flush-ordering caveat in
[05 · 11b](../05-sql-first-access/11b-the-flush-ordering-trap.md).

## Gotchas

**★ "It generates the SQL" is not the same as "you do not need to know the SQL".** The
generated statement is almost always correct and says nothing about what it costs.

**★ A one-word change to a signature can change the statement count by a factor of N.**
Projection to entity, `Slice` to `Page`, `List` to `Page` — all one-word edits with
first-order cost consequences.

**★ The defaults are chosen for correctness, not for your workload.** `Page` counts because a
page number needs a total. `save` merges because the entity might be detached. Every default
here is defensible and several are wrong for a specific endpoint.

**★ Bootstrap validation covers less than it appears to.** Derived queries and JPQL are parsed;
native SQL is not, semantics are never checked, and no amount of validation says anything
about cost ([03f](03f-what-is-checked-and-when.md)).

**★ The repository interface is where reviewers stop reading.** It is short, declarative and
looks obviously correct — which is exactly why the costs on this page survive review.

**★ Adding a property to a shared projection changes every query that returns it.** The
projection *is* a select list, and it has no owner.

**★ The transaction boundary is not in the file.** Neither the repository nor the caller shows
where the transaction begins unless somebody annotated it deliberately.

**★ "It works in the test" usually means "it works with ten rows".** Every item in the
catalogue above is invisible at small data volumes; that is the definition of the problem.

**★ Abandoning the abstraction because of this list is the wrong conclusion.** The alternative
is hand-written data access with the same costs, less validation and more code. The conclusion
is to read the SQL.

## Interview questions

**★ What does Spring Data JPA actually save you, and what does it not?**
It saves the implementation code, the result mapping, the exception translation, the paging
arithmetic and a lot of boilerplate, and it validates derived queries and JPQL at startup. It
does not change what the database does, and it moves the cost of a query one level away from
the file that declares it.

**★ Describe the layers between a method name and a query plan.**
The method name is parsed into JPQL, Hibernate translates JPQL to SQL, and the database plans
the SQL. Each step makes decisions the previous one could not express — the inner join implied
by a property traversal, the statement count implied by lazy loading, the sort or index scan
implied by `ORDER BY`.

**★ Name three costs a repository method does not show you.**
The `COUNT` query behind a `Page`; the `merge` and extra `SELECT` behind `save` on a detached
entity; the absence of any transaction on a declared query method. Several more are in the
catalogue on this page.

**★ What is a reasonable standard to hold repository code to?**
That for every method you can say how many statements it issues and what shape each one has.
Not the text — the count and the shape.

**★ How do you actually verify that?**
Read the SQL through a logger in development, assert the statement count in tests wherever N
is unbounded, and `EXPLAIN` the statements behind paginated endpoints. The Java side cannot
answer the last one.

**★ When should you not use a repository at all?**
For reporting and aggregation, for bulk data movement, for database-specific features, and for
anything where the query plan is the design. A SQL-first layer states those directly, and it
can live behind a fragment on the same repository interface.

**★ Is "too much magic" a fair criticism of Spring Data JPA?**
Not really. The generation is deterministic, documented and validated at startup. The fair
criticism is narrower: the cost of a query is not visible where the query is declared, and the
defaults are tuned for correctness rather than for any particular workload.

{/* FOOTER */}
