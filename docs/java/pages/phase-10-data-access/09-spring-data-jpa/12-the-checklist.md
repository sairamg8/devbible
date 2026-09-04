---
title: "A repository interface is the shortest file in the codebase and the one where a review pays best, because every line of it is a query — here is what to check, in the order that finds problems fastest"
sidebar_label: "12 · The checklist"
sidebar_position: 47
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — this chunk collects rules established and cited in chunks 01–11 of
> this topic; each item links to the chunk carrying the primary source. Spine sources:
> the Spring Data JPA 4.1 reference
> ([docs.spring.io/spring-data/jpa/reference](https://docs.spring.io/spring-data/jpa/reference/))
> and PostgreSQL 18 ([postgresql.org/docs/18](https://www.postgresql.org/docs/18/)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**Reviewing a repository interface takes four minutes and catches more production problems
per minute than reviewing anything else in a Spring application, because it is fifteen lines
and every one of them is a database query. This is the order to read it in.**

## 1 · The declaration line

**What does it extend?** `JpaRepository` gives you every CRUD method, every batch delete and
`getReferenceById` on a public interface. Ask whether the caller should have them. A
repository extending `Repository<Order, Long>` and declaring the six methods the application
actually uses is a smaller attack surface and a better piece of documentation
([01d](01d-shaping-the-interface.md)).

**Is the domain type an aggregate root?** A repository per entity, including every child
entity, is the shape that produces services orchestrating five repositories where one would
do.

**If it is a base interface, is it `@NoRepositoryBean`?** Without the annotation, Spring Data
tries to create an instance of it ([01b](01b-the-repository-hierarchy.md)).

**Does it extend `JpaSpecificationExecutor`?** If so, expect dynamic predicates —
and check [07d](07d-what-the-base-repository-does.md)'s count-query trap on any paged usage.

## 2 · Every method name, read once

**Can you state the `WHERE` clause after reading the name once?** That is the whole
readability test. It starts failing around three predicates
([02f](02f-where-derived-queries-stop.md)).

**Does any property path traverse an association?** `findByCustomerName` is an **inner** join:
rows whose `customer` is null are gone. Almost never what the author meant
([02d](02d-property-paths-and-ambiguity.md)).

**Is there a `Containing`, `StartingWith` or `IgnoreCase`?** Each has a cost that no index
serves by default — a leading wildcard cannot use a b-tree, and `UPPER(col) = UPPER(?)` needs
an expression index ([02c](02c-like-ignorecase-and-grouping.md)).

**Is a `Top`/`First` or a `Limit` present without a total ordering?** Then which rows come
back is undefined ([02e](02e-limiting-and-static-ordering.md)).

**Is `Distinct` there to paper over a join fan-out?** It changes the query, the count and
usually the intent — [08 · 8c](../08-the-n-plus-1-problem/08c-duplicate-parents-and-distinct.md).

## 3 · Return types

**`Page`, `Slice` or `List`?** `Page` issues a second `COUNT` query. If the UI never shows a
total, `Slice` removes it ([05](05-pageable-and-sort.md)).

**`Optional<T>` or `T`?** A bare `T` returns null for no match and throws
`IncorrectResultSizeDataAccessException` for more than one. The `Optional` is not decoration
([01e](01e-return-types.md)).

**A `Stream` return?** It must be closed and consumed inside the transaction.

**Is the return type a projection, and is it *closed*?** One `@Value` anywhere on a projection
interface means the entity is loaded to back it ([06](06-projections.md)).

**Is the return type an interface the entity implements?** Then it is not a projection at all
and never was ([06](06-projections.md)).

## 4 · Pagination, specifically

**Does every paged query have a total ordering?** Equal sort values make page boundaries
non-deterministic: rows repeat across pages or disappear
([05c2](05c2-what-the-order-by-costs.md)).

**Does the sort have an index that matches — including direction?** `ORDER BY a DESC, b ASC`
is not served by an index on `(a, b)` in either scan direction
([05c2](05c2-what-the-order-by-costs.md)).

**How deep can the offset go?** If a caller can reach page 10,000, the skipped rows are still
computed. Keyset pagination is the fix, and it cannot be built on a `@Query`
([05b](05b-offset-pagination-at-depth.md), [05b2](05b2-keyset-filtering-and-scrolling.md)).

**Is there a `Pageable` *and* a `Sort`, or a `Pageable` *and* a `Limit`?** Both combinations
are invalid ([05](05-pageable-and-sort.md)).

## 5 · `@Query` methods

**Named parameters, not positional.** Positional numbering counts bindable parameters only, so
adding a `Pageable` or a dynamic-projection `Class` does not shift it — and reordering
parameters silently does ([03c](03c-binding-parameters.md)).

**Is there a stale `@Param`?** `@Param` beats the compiled parameter name, so a rename leaves
the annotation quietly wrong ([03c](03c-binding-parameters.md)).

**Native query?** Then it is not validated at startup, dynamic `Sort` is unreliable, and a
paged one needs an explicit `countQuery` unless JSqlParser is on the classpath
([03f](03f-what-is-checked-and-when.md), [03g2](03g2-native-pagination-and-results.md)).

**DTO return type?** JPQL constructor expressions must not contain aliases — the opposite of
what an interface projection needs ([06c](06c-class-based-projections.md)).

**Any SpEL in the query?** It is evaluated on every execution, and only annotation-sourced
expressions are safe ([03e2](03e2-expressions-escaping-and-cost.md)).

## 6 · Writes

**Does every `@Modifying` query have a transaction?** Without one, `executeUpdate` throws
([09](09-transactions-on-repositories.md)).

**Does it need `clearAutomatically`?** Both switches default to `false`. If the same
transaction reads those entities afterwards, the persistence context is now lying
([04](04-modifying-queries.md), [04b](04b-flush-clear-and-the-stale-context.md)).

**`deleteByX` or `deleteAllInBatch`?** The first loads every match and deletes one by one with
callbacks; the second is one statement with no cascade and no lifecycle events. Both are
wrong at millions of rows ([04c](04c-derived-delete-versus-bulk-delete.md)).

**Do any of these bypass auditing or optimistic locking?** Every bulk path does
([10b](10b-what-the-handler-does.md)).

**Is `save()` being called on a detached entity in a loop?** That is a `merge` — a `SELECT`
each — and the returned instance is not the one passed in
([06 · 13b](../06-jpa-hibernate-model/13b-merge-returns-a-copy.md)).

## 7 · Transactions

**Is there a boundary at the unit of work, or only on the repository?** Two repository calls
with no service boundary are two transactions
([09c](09c-the-service-boundary.md)).

**Is the interface annotated `@Transactional(readOnly = true)`?** Good — now check that every
modifying method overrides it with a plain `@Transactional`
([09](09-transactions-on-repositories.md)).

**Is any *service* method `readOnly = true` and also writing?** That write is silently
discarded ([09b](09b-what-readonly-actually-does.md)).

**Was an inherited method re-declared to add a setting?** Re-declaring replaces the whole
configuration and drops `readOnly` ([09](09-transactions-on-repositories.md)).

## 8 · Fetching

**Does anything returned here get serialised, logged or `toString`-ed outside the
transaction?** Both are N+1 generators and neither is a loop anyone wrote
([08 · 4c](../08-the-n-plus-1-problem/04c-serialization-and-logging.md)).

**Is there an `@EntityGraph`, and is it on the method that needs it?** The fetch plan belongs
at the call site, not in the mapping and not inside a `Specification`
([08 · 9g](../08-the-n-plus-1-problem/09g-spring-data-entitygraph.md)).

**Is a fetch join combined with pagination?** Hibernate 7.4 changed this; older advice is now
wrong ([08 · 8d](../08-the-n-plus-1-problem/08d-pagination.md)).

## 9 · Fragments and custom code

**Is there business logic in a fragment?** A fragment is hand-written data access. Decisions
and orchestration belong at the service boundary ([08](08-custom-implementations.md)).

**Does a fragment override an inherited CRUD method?** Custom implementations take priority
over the base implementation, so `save` may not be `SimpleJpaRepository`'s `save`
([08](08-custom-implementations.md)).

**Is a `repositoryBaseClass` in play?** Then behaviour changes for every repository in scope
and the repository file says nothing about it ([08c](08c-customising-the-base-repository.md)).

## 10 · The last question

**For each method: how many statements, and what shape?** If the interface has a method whose
answer you cannot give, that is the method to look at
([11](11-what-spring-data-hides.md)).

[12b](12b-the-red-flags.md) turns this into the other exercise — the sequence for a repository
you did not write and cannot review line by line.

## Gotchas

**★ The interface passes review because it is short.** Fifteen declarative lines look
obviously correct. Every one of them is a query.

**★ A checklist run on the interface alone misses the transaction boundary.** It is not in the
file. Follow at least one caller.

**★ Most items here are invisible with test-sized data.** Offset depth, sort cost, N+1 and
count-query cost are all fine at ten rows and all wrong at ten million.

**★ Half the items are one-word regressions.** `Slice` to `Page`, projection to entity, adding
one `@Value`, adding a `Pageable`. Diffs that read as trivial are the ones to slow down on.

**★ "It has always been like that" is not evidence.** The costs here are silent by
construction; longevity means nobody measured, not that it is fine.

**★ The checklist cannot see the schema.** Every pagination and sorting item on it is really a
question about an index, and the index is in a migration file
([11 · Flyway](../11-flyway-migrations/01-why-schema-is-code.md)), not in the repository.

**★ A method nobody calls yet is still a query somebody will call.** Repository interfaces
accumulate speculative finders; each one is a supported query with a cost, and the cheapest time
to delete it is now.

**★ Checking the SQL once is worth more than the whole checklist.** The checklist tells you
where to look; the statement log tells you what happened.

## Interview questions

**★ What is the first thing you look at in a repository interface?**
The declaration line — what it extends, and therefore what the caller can reach. `JpaRepository`
publishes every CRUD and batch method whether or not the application should have them.

**★ You have four minutes to review a repository. What do you check?**
Return types (`Page` versus `Slice`, `Optional`, projections), any paged method's ordering and
index, every `@Modifying` query for a transaction and a clear, and whether a service boundary
exists around multi-call operations.

**★ Which one-word changes in a repository diff deserve a second look?**
`Slice` to `Page` (adds a `COUNT`), a projection type to the entity (adds columns and possibly
N+1), adding a `@Value` to a projection (loses the narrowing), and adding a `Pageable` to a
method whose specification contains a fetch.

**★ How do you review pagination?**
Confirm the sort is a total order, that an index matches it including direction, and that a
caller cannot reach a deep offset. If they can, keyset pagination is the answer and it cannot
be built on a string query.

**★ Why is a checklist on the interface not sufficient?**
Because the transaction boundary, the serialisation of the result and the size of the data are
all outside the file. The interface tells you what is asked for; the caller and the database
tell you what it costs.

**★ Which items on the checklist are really schema questions?**
Every pagination and sorting item. Whether an `ORDER BY` is answered by an index, in the right
direction, with the right null ordering, is decided in a migration file — the repository only
decides that the sort exists.

**★ What do you do with a repository method that nothing calls?**
Delete it. It is a supported query with a maintenance cost and a review cost, and an unused
finder is the cheapest thing in the codebase to remove.

**★ What single habit replaces most of this list?**
Reading the SQL for every new repository method once, in development, through a logger — and
asserting statement counts in tests where the row count is unbounded.

{/* FOOTER */}
