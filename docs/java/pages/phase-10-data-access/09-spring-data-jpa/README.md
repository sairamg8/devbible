---
title: "09 · Spring Data JPA"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: see each chunk's own `> Verified:` line.

**The repository abstraction, end to end: an interface you never implement, four ways to
tell it what query you want, and the costs none of them display.**

:::tip Complete — 48 chunks
Six parts. **The interface** (what a repository actually is, the hierarchy and its 3.0
break, what `JpaRepository` adds, how to shape the API you publish, and what a return type
decides). **Saying what you want** — derived query names and the grammar behind them, `@Query`
with JPQL, parameter binding, templated queries, what is validated and when, and native SQL.
**Writing** — `@Modifying`, the stale persistence context, and derived versus bulk deletes.
**Shaping the result** — `Pageable`, `Page` versus `Slice`, offset pagination at depth, keyset
scrolling, what a `Sort` may contain and what an `ORDER BY` costs, then projections in all
four forms. **Dynamic queries** — `Specification` as reworked in 4.0, Query by Example, the
fluent query API, and what `SimpleJpaRepository` does with a predicate. **The edges** — custom
fragment implementations, transactions on repositories and why a service boundary still
matters, and auditing. It closes on the argument the whole topic is for: Spring Data removes
the code that writes the SQL, not the SQL — with a review checklist and a diagnosis table for
when that bill arrives.
:::

Boundaries this topic keeps: **06** owns the persistence context and entity states, **07**
owns mappings and fetch types, **08** owns N+1 and every fix for it — including `@EntityGraph`
on a repository method and projections *as an N+1 fix* — **05** owns `JdbcTemplate` and
`JdbcClient`, and **04** owns the `@Transactional` proxy, propagation and rollback rules. This
topic links to them rather than re-arguing them.

{/* CHUNKS */}

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[1 · What a repository is](01-what-a-repository-is.md)** | A Spring Data repository is an interface you never implement, and the object you actually call is a proxy the… |
| 2 | **[1b · The repository hierarchy](01b-the-repository-hierarchy.md)** | The repository hierarchy contains one genuine trap: PagingAndSortingRepository stopped extending CrudRepository in… |
| 3 | **[1c · What JpaRepository adds](01c-what-jparepository-adds.md)** | What JpaRepository adds on top of the store-neutral interfaces is a flush family, a batch-delete family and… |
| 4 | **[1d · Shaping the interface](01d-shaping-the-interface.md)** | A repository interface is an API you are publishing to the rest of the application, and the default — extends… |
| 5 | **[1e · Return types](01e-return-types.md)** | The return type is part of the query, not decoration on it — it decides whether a missing row is null, empty or an… |
| 6 | **[02 · Derived queries](02-derived-queries.md)** | A derived query is a method name that Spring Data compiles into JPQL at startup — it splits the name at the first… |
| 7 | **[02b · The predicate keywords](02b-the-predicate-keywords.md)** | The predicate half of a method name is a keyword grammar with two tables behind it — a store-neutral one that lists… |
| 8 | **[02c · Like, IgnoreCase and grouping](02c-like-ignorecase-and-grouping.md)** | Four derived-query keywords carry behaviour the method name does not show: Containing escapes your wildcards,… |
| 9 | **[02d · Property paths and ambiguity](02d-property-paths-and-ambiguity.md)** | A predicate token is resolved against your entity by a greedy camel-case algorithm that prefers a direct property… |
| 10 | **[02e · Limiting and static ordering](02e-limiting-and-static-ordering.md)** | Top, First, the Limit parameter and a static OrderBy are the four ways a method name can bound and order a result —… |
| 11 | **[02f · Where derived queries stop](02f-where-derived-queries-stop.md)** | Derived queries fail by becoming unreadable long before they fail by being inexpressible — and the list of things… |
| 12 | **[03 · @Query and JPQL](03-at-query-jpql.md)** | @Query moves the query out of the method name and into a JPQL string — the annotation wins over every other source,… |
| 13 | **[03b · What JPQL buys you](03b-what-jpql-buys-you.md)** | What a JPQL string buys you is grouping, real joins, aggregates and constructor expressions — what it does not buy… |
| 14 | **[03c · Binding parameters](03c-binding-parameters.md)** | Positional binding numbers the bindable method parameters and nothing else, named binding decouples the argument… |
| 15 | **[03d · What binding does not do](03d-what-binding-does-not-do.md)** | Binding substitutes values and nothing else — it will not rewrite a null into is null, it will not escape a… |
| 16 | **[03e · Templated queries](03e-templated-queries-and-expressions.md)** | A @Query string is a template as well as a query — SpEL expressions and property placeholders are substituted into… |
| 17 | **[03e2 · Expressions, escaping and their cost](03e2-expressions-escaping-and-cost.md)** | Expressions over the arguments buy you escaping, an extension-supplied value and a configuration property — each is… |
| 18 | **[03f · What is checked, and when](03f-what-is-checked-and-when.md)** | A JPQL string is checked when the repository bean is created, by handing it to a throwaway EntityManager — which is… |
| 19 | **[03g · Native queries](03g-native-queries.md)** | A native query is SQL in a string with no parse before production, no entity names, no portability and no automatic… |
| 20 | **[03g2 · Native pagination](03g2-native-pagination-and-results.md)** | Paginating a native query needs a count query Spring Data can only sometimes derive — and scrolling and reliable… |
| 21 | **[03g3 · What a native query returns](03g3-what-a-native-query-returns.md)** | For a native query the return type is the instruction — the domain type, an interface projection run as a Tuple, a… |
| 22 | **[04 · Modifying queries](04-modifying-queries.md)** | @Modifying switches the execution from getResultList to executeUpdate — and everything difficult about it comes from… |
| 23 | **[04b · Flush, clear and the stale context](04b-flush-clear-and-the-stale-context.md)** | flushAutomatically and clearAutomatically both default to false — so by default a modifying query is executed… |
| 24 | **[04c · Derived delete vs bulk delete](04c-derived-delete-versus-bulk-delete.md)** | A derived delete loads the rows and removes them one by one so callbacks and cascades happen; a @Modifying delete… |
| 25 | **[05 · Pageable, Page and Slice](05-pageable-and-sort.md)** | Pageable is one parameter that changes the query, the result type and the number of round-trips at once — and the… |
| 26 | **[05b · Offset pagination at depth](05b-offset-pagination-at-depth.md)** | OFFSET makes the server compute and discard every row it skips, so page 5,000 costs five thousand pages of work —… |
| 27 | **[05b2 · Keyset filtering and scrolling](05b2-keyset-filtering-and-scrolling.md)** | Keyset filtering replaces skip-N with a where clause on the last row's sort values, which is the only form of… |
| 28 | **[05c · What a Sort may contain](05c-sort-is-not-free.md)** | The strings in a Sort are validated as JPQL path expressions before they ever reach the database, which is why a… |
| 29 | **[05c2 · What the ORDER BY costs](05c2-what-the-order-by-costs.md)** | An ORDER BY is either answered by a b-tree index in the right direction or paid for by sorting every matching row,… |
| 30 | **[06 · Projections](06-projections.md)** | A repository method's return type is not a cast at the end of the query, it is an instruction to the query builder —… |
| 31 | **[06b · Inside a projection](06b-computed-values-and-nesting.md)** | Everything you can put inside a projection beyond a plain getter — a default method, a SpEL expression, a nested… |
| 32 | **[06c · DTO projections](06c-class-based-projections.md)** | A DTO projection is not a proxy over a Tuple but a real object built by a real constructor, which is why it needs a… |
| 33 | **[06d · Dynamic projections](06d-dynamic-projections-and-choosing.md)** | One query method can serve several shapes if you pass the shape in as a Class argument — a feature with one sharp… |
| 34 | **[07 · Specifications](07-specifications-and-criteria.md)** | A Specification is a predicate you can name, store in a variable and combine at runtime, which is the one thing a… |
| 35 | **[07b · Query by Example](07b-query-by-example.md)** | Query by Example turns a half-filled instance of your entity into a WHERE clause, which is the least code any… |
| 36 | **[07c · The fluent query API](07c-executing-specifications-and-examples.md)** | The fluent query function is the only place in Spring Data where the projection, the ordering, the limit and the… |
| 37 | **[07d · What the base repository does](07d-what-the-base-repository-does.md)** | SimpleJpaRepository applies your specification to the count query as well as the data query, which is why a fetch… |
| 38 | **[08 · Custom implementations](08-custom-implementations.md)** | When the repository abstraction runs out you do not abandon it — you add a fragment interface and one implementation… |
| 39 | **[08b · Finding the implementation](08b-finding-the-implementation.md)** | The infrastructure finds your fragment implementation by scanning below the package it found the repository in and… |
| 40 | **[08c · The base repository](08c-customising-the-base-repository.md)** | Changing behaviour for every repository at once means replacing SimpleJpaRepository itself, which works, is… |
| 41 | **[09 · Transactions on repositories](09-transactions-on-repositories.md)** | Every CRUD method you inherit arrives with a transaction annotation you did not write, and every query method you… |
| 42 | **[09b · What readOnly does](09b-what-readonly-actually-does.md)** | readOnly = true is not a guard against writing, it is a hint to the driver and an instruction to Hibernate to stop… |
| 43 | **[09c · The service boundary](09c-the-service-boundary.md)** | The transaction defaults on a repository make each call correct on its own and say nothing about a unit of work… |
| 44 | **[10 · Auditing](10-auditing-and-lifecycle.md)** | Four annotations, one SPI and one enabling annotation give you created-by and modified-at columns that maintain… |
| 45 | **[10b · What the handler does](10b-what-the-handler-does.md)** | Auditing is a JPA PrePersist and PreUpdate callback, so its four configuration switches are small and its blind… |
| 46 | **[11 · What it hides](11-what-spring-data-hides.md)** | Spring Data removes the code that writes the SQL, not the SQL — there are four translations between a method name… |
| 47 | **[12 · The checklist](12-the-checklist.md)** | A repository interface is the shortest file in the codebase and the one where a review pays best, because every line… |
| 48 | **[12b · Red flags and diagnosis](12b-the-red-flags.md)** | The other half of reviewing repositories is diagnosis rather than inspection — a symptom in production maps to a… |

{/* FOOTER */}
