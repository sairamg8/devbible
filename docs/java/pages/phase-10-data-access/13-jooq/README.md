---
title: "13 · jOOQ"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: see each chunk's own `> Verified:` line. Spine: jOOQ **3.21.7**, JDK 25,
> Spring Boot 4.1.1, PostgreSQL 18.

**SQL as a typed Java DSL generated from your real schema — so a wrong column name is a compile
error, not something a user finds. And the full price of that guarantee.**

:::tip Complete — 32 chunks
The topic argues one thing from six directions. jOOQ inverts the direction an ORM points in: the
**database schema is the source of truth**, a code generator turns it into a Java API, and your
queries are expression trees the compiler checks against it. The chunks run from what jOOQ is and
the licence that decides whether you can use it, through **code generation** and the three ways to
feed the generator a schema, the **DSL** — conditions, joins, implicit joins, fetching — **mapping**
including `MULTISET`, **writes** and jOOQ's surprising optimistic locking, the **PostgreSQL**
features that are the usual reason to adopt it, and **transactions under Spring**. It closes on the
honest part: where JPA is simply better, how to run both without corrupting data, and what the
build step, the generated tree, the team's SQL literacy and the licence actually cost.
:::

{/* CHUNKS */}

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[01 · What jOOQ is](01-what-jooq-is.md)** | jOOQ makes your schema a Java API, so a wrong column name is a compile error rather than something a user finds |
| 2 | **[01b · The licence question](01b-the-licence-question.md)** | Free for open-source databases, paid for commercial ones — the split is by database, not by feature, and it decides adoption |
| 3 | **[01c · A tree, not a string](01c-the-dsl-is-a-tree.md)** | The DSL builds a syntax tree rather than a string, which is why predicates compose safely and why jOOQ is not an ORM |
| 4 | **[02 · Code generation](02-code-generation.md)** | The generator reads your real schema and emits Java from it, inverting the direction every ORM points in |
| 5 | **[02b · Configuring the generator](02b-configuring-the-generator.md)** | Which parts of the database become Java, and where that Java lives — both answers are hard to reverse |
| 6 | **[02c · Shaping the generated API](02c-shaping-the-generated-api.md)** | Forced types and the generation flags fix the schema's bad decisions in one place instead of at every call site |
| 7 | **[02d · Generating from migrations](02d-generating-from-migrations.md)** | `DDLDatabase` needs no server at all, at the cost of everything jOOQ's parser and an in-memory H2 cannot represent |
| 8 | **[02e · Generating from a real database](02e-generating-from-a-real-database.md)** | The only route whose output reflects what the database actually did — and it hangs on plugin order in your POM |
| 9 | **[02f · The throwaway container](02f-the-throwaway-container.md)** | A container per build gives the generator a really-migrated schema and charges a container runtime to every machine that compiles |
| 10 | **[03 · The DSL](03-the-dsl.md)** | Every query starts from a `DSLContext` holding a `Configuration` and carries the degree of its projection in its own Java type |
| 11 | **[03b · Conditions and dynamic SQL](03b-conditions-and-dynamic-sql.md)** | A `Condition` is a value you can build and combine — provided you use `noCondition()` rather than an empty predicate |
| 12 | **[03c · Joins and aliasing](03c-joins-and-aliasing.md)** | An aliased generated table is still the generated type, so the compiler keeps checking every column you dereference through it |
| 13 | **[03d · Implicit joins](03d-implicit-joins.md)** | Path expressions add a join to the one query rather than issuing another — an ORM navigation with no lazy proxy |
| 14 | **[03e · Fetching](03e-fetching.md)** | The fetch method you choose is a statement about how many rows you expect, and the wrong one returns `null` instead of failing |
| 15 | **[04 · Mapping results](04-mapping-results.md)** | `into(Class)` tries three strategies in a fixed order, and which one your type triggers decides whether it survives a schema change |
| 16 | **[04b · Nested collections with MULTISET](04b-nested-collections-with-multiset.md)** | `MULTISET` nests a whole child collection into one column, turning parent-with-children into one flat statement and a typed tree |
| 17 | **[04c · Mappers and converters](04c-record-mappers-and-converters.md)** | `Records.mapping` and ad-hoc converters give compile-time-checked mapping instead of reflection |
| 18 | **[05 · Writes](05-writes.md)** | An upsert, a `RETURNING` clause and an insert-select are one statement each, not a load-mutate-flush cycle |
| 19 | **[05b · UpdatableRecords](05b-updatable-records.md)** | The most ORM-like thing in jOOQ, and the place where jOOQ's guarantees are weakest |
| 20 | **[05c · Optimistic locking](05c-optimistic-locking.md)** | Off by default and, without a version column, implemented with `SELECT … FOR UPDATE` — a pessimistic lock wearing an optimistic name |
| 21 | **[06 · Window functions](06-postgres-specifics.md)** | The clearest case for adopting jOOQ: the thing an ORM cannot express at all, with partition, order and frame all type-checked |
| 22 | **[06b · CTEs and DISTINCT ON](06b-ctes-and-distinct-on.md)** | Named intermediate steps, recursion in one statement, and the PostgreSQL shortcut jOOQ deliberately spells backwards |
| 23 | **[06c · JSONB, arrays and bindings](06c-jsonb-arrays-and-bindings.md)** | `jsonb` as an opaque typed value, arrays as a value constructor, and a custom `Binding` for everything JDBC cannot represent |
| 24 | **[07 · Transactions and Spring](07-transactions-and-spring.md)** | Boot wraps your `DataSource` in a transaction-aware proxy, which is why `@Transactional` works over jOOQ with nothing configured |
| 25 | **[07b · jOOQ's transaction API](07b-jooqs-transaction-api.md)** | A lambda against a derived `Configuration` that delegates to Spring — so the question is which of two mechanisms your codebase uses |
| 26 | **[08 · jOOQ vs JPA](08-jooq-vs-jpa.md)** | One makes a query the unit of work, the other an object graph — and that single difference predicts every trade-off |
| 27 | **[08b · Using both](08b-using-both.md)** | jOOQ's own documented arrangement, needing no plumbing because Spring puts both libraries on the `EntityManager`'s connection |
| 28 | **[08c · One owner per table](08c-one-owner-per-table.md)** | The whole discipline is one rule nothing enforces — and two mechanisms that can turn it into a compile error |
| 29 | **[08d · The stale context](08d-the-stale-persistence-context.md)** | A managed entity will write its stale copy back over a jOOQ `UPDATE` at flush time, silently, in the same transaction |
| 30 | **[08e · Repairing the stale context](08e-repairing-the-stale-context.md)** | Flush, refresh, detach, clear — every repair is a hand-written call, and each fixes one problem by creating a smaller one |
| 31 | **[09 · The cost](09-the-cost.md)** | A build that cannot compile without a schema, a generated tree somebody owns, and a regeneration discipline nothing enforces |
| 32 | **[09b · The people and the exit](09b-the-people-and-the-exit.md)** | Two literacies, a licence set by your database and your JDK, and generated code that is yours but not portable |

{/* FOOTER */}
