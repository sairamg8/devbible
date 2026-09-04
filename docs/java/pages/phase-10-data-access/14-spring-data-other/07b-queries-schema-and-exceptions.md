---
title: "The derived-query parser accepts keywords the store cannot execute, there is no schema and therefore no migration, and the one thing that genuinely carries across is the exception hierarchy"
sidebar_label: "07b · Queries, schema and exceptions"
sidebar_position: 23
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data MongoDB 5.1 reference *Query Methods*
> ([docs.spring.io/spring-data/mongodb/reference/mongodb/repositories/query-methods.html](https://docs.spring.io/spring-data/mongodb/reference/mongodb/repositories/query-methods.html)),
> the Spring Data Redis 4.1 reference *Queries and Query Methods*
> ([docs.spring.io/spring-data/redis/reference/redis/redis-repositories/queries.html](https://docs.spring.io/spring-data/redis/reference/redis/redis-repositories/queries.html)),
> the Spring Boot 4.1 application-properties appendix for
> `spring.data.mongodb.auto-index-creation`
> ([docs.spring.io/spring-boot/appendix/application-properties/](https://docs.spring.io/spring-boot/appendix/application-properties/index.html))
> and the Boot 4.1 test-slice appendix for `@DataMongoTest` and `@DataRedisTest`
> ([docs.spring.io/spring-boot/appendix/test-auto-configuration/slices.html](https://docs.spring.io/spring-boot/appendix/test-auto-configuration/slices.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data MongoDB 5.1.0, Spring Data Redis 4.1.0.

**The previous chunk was about the persistence context. This one is about everything else
you stop having: a query language, a schema, constraints, migrations, and a planner. Some
of those absences are the point of the store and some are just absences. The section that
matters most is the last one, because there is exactly one part of the JPA experience that
transfers intact — the exception hierarchy — and it is the part nobody expects to.**

## There is no JPQL, and no criteria API that means the same thing

`@Query` exists in all three modules and contains a different language in each:

| Module | What is inside `@Query` | Checked when |
|---|---|---|
| Spring Data JPA | JPQL, or native SQL with `nativeQuery = true` | JPQL is parsed at startup |
| Spring Data MongoDB | a JSON query document — `{ 'firstname' : ?0 }` | it is a string until it reaches the server |
| Spring Data Redis | *there is no `@Query`* | — |

JPQL is a typed language over your entity model, so a renamed field breaks the application
at startup. A MongoDB query document is text: rename the property and the query keeps
running against a field that no longer exists, returning nothing. That difference is the
entire content of
[02b · `@Query` and `@Aggregation`](02b-query-and-aggregation.md), and it is the reason
derived queries — which *are* checked against the mapping metadata — are worth preferring in
MongoDB more than they are in JPA.

`Criteria` in Spring Data MongoDB is a query-document builder, not the Jakarta Persistence
Criteria API. Same word, unrelated thing: no metamodel, no compile-time property references,
no type safety beyond the method signature.

## The shared parser is a shared vocabulary, not a shared capability

This is the subtlest trap in the topic. `findByAgeBetween` parses identically for all three
stores, because the parser is in Spring Data Commons. What happens next is not identical:

- **JPA** turns it into `BETWEEN` and the database does the rest.
- **MongoDB** turns it into `$gte`/`$lte` and the server executes it, with or without an
  index.
- **Redis** has no representation for it at all — its executor works on set intersection
  over per-value index sets, and a range is not expressible. The reference limits query
  methods to *"queries for entities and collections of entities with paging"* and tells you
  to *"make sure properties used in finder methods are set up for indexing"*.

**Portability of the method name is not portability of the query.** A repository interface
copied from a JPA project to a Redis one compiles and means something completely different,
if it means anything.

The same asymmetry runs through the return types:

| Feature | JPA | MongoDB | Redis |
|---|---|---|---|
| Interface / DTO projections | ✅ | ✅ | ✗ |
| `Page` | ✅ | ✅ (not on `@Aggregation`) | paging, sorted in the JVM |
| `Slice` | ✅ | ✅ | — |
| `Stream` | ✅ | ✅ (a cursor, must be closed) | — |
| Derived `delete`/`count`/`exists` | ✅ | ✅ | limited |
| `Sort` executed by the store | ✅ | ✅ | ✗ — a `Comparator` in your heap |

## There is no join, so the model does the joining

MongoDB has `$lookup` and it is a real join, priced like one, and reachable only through the
aggregation DSL in
[03d · Aggregation from Java](03d-aggregation-from-java.md). Redis has nothing: you fetch
ids and then fetch documents, in your application.

The intended answer in both stores is to not need one — embed what is read together, and
accept the duplication. That trade has a name and a cost: **denormalisation moves referential
integrity into your application**, and the maintenance burden lands on writes. When a
customer's name is copied into ten thousand orders, changing it is a bulk update you write,
schedule and monitor, and there is no constraint anywhere that will tell you if it half
finished.

## There is no schema, so there is no migration

Phase 10 spends a whole topic on
[11 · Why schema is code](../11-flyway-migrations/01-why-schema-is-code.md). None of that
tooling exists here, and the absence is bigger than it looks:

- **No DDL and no `NOT NULL`.** A document missing a field is legal. The only thing that
  will reject it is your mapping code, at read time, on a document written months earlier.
- **No foreign keys.** A `DBRef` or a Redis `@Reference` can point at something that does not
  exist, and nothing prevents or detects it.
- **Unique constraints exist in MongoDB only as unique indexes**, and only if something
  created them.
- **`spring.data.mongodb.auto-index-creation` defaults to `false` in Boot.** Your
  `@Indexed` annotations create nothing unless you turn it on or create the indexes
  yourself — and turning it on means index creation happens at application startup, which
  conflicts with the "have all required structures in place" requirement of
  [04 · Transactions in MongoDB](04-transactions-in-mongo.md).
- **No versioned migration history.** There is no `flyway_schema_history` equivalent telling
  you which shape changes have been applied to which environment.

The consequence is schema-on-read: **old documents keep their old shape forever, and your
mapping code is the migration.** A field added last year is absent from every document
written before then, so the class needs a default, a nullable type or a converter — and
that accommodation is permanent, because nothing will ever rewrite the old documents unless
you write the job that does it. Over a few years this accumulates into a class whose
optional fields encode the deployment history of the service.

MongoDB does offer server-side schema validation with `$jsonSchema`, which is the closest
thing to a constraint and is owned by the [MongoDB section](../../../../mongodb/README.md)
of this bible rather than by the Java boundary.

## What genuinely does carry across

Three things, and they are not small.

**1 · The exception hierarchy.** Spring translates store-specific failures into the same
`DataAccessException` tree you know from
[05 · The exception hierarchy](../05-sql-first-access/06-the-exception-hierarchy.md).
`DuplicateKeyException` from a unique-index violation in MongoDB is the same type you catch
from a Postgres unique violation. `OptimisticLockingFailureException` from a `@Version`
mismatch is the same type Hibernate throws. **Code that handles data-access failures
generically keeps working across stores**, which is the strongest argument for Spring Data's
abstraction actually existing — much stronger than the repository interface.

**2 · `@Transactional` as a programming model**, once a manager exists. Same proxy, same
self-invocation trap, same propagation semantics from
[04 · Spring `@Transactional`](../04-spring-transactional/README.md). The manager and the
guarantees differ; the annotation's behaviour does not.

**3 · The template pattern.** `JdbcTemplate`, `MongoTemplate` and `RedisTemplate` are the
same idea — resource management and exception translation around an API you still control —
and knowing one is most of knowing the others.

## Testing changes shape too

There is no H2 for MongoDB and no in-memory Redis you should trust. Boot ships the
`@DataMongoTest` and `@DataRedisTest` slices, and the realistic backing for both is a
container: Testcontainers' `MongoDBContainer` initialises a single-node replica set, which
[04 · Transactions in MongoDB](04-transactions-in-mongo.md) explains is not optional if your
code uses transactions.

Two test-only traps worth stating: a fresh database has **no collections**, which is the
implicit-creation failure inside a transaction; and a fresh Redis has **no indexes**, which
in this store is not a performance difference but a correctness one, because an unindexed
property is not queryable at all.

## Gotchas

**★ A MongoDB `@Query` string is not validated against your mapping.** Rename a property and
the query silently targets a field that no longer exists. JPQL would have failed at startup.

**★ `Criteria` in Spring Data MongoDB is not the JPA Criteria API.** No metamodel, no
compile-time property names — a fluent builder for a JSON document, and nothing more.

**★ The same derived method name means different things in different modules.** The parser is
shared; the executors are not. A Redis repository will accept a range keyword by parsing it
and be unable to answer it.

**★ Projections work in MongoDB and not in Redis.** Interface and DTO projections are a JPA
and MongoDB feature; the Redis executor returns entities and collections of entities.

**★ Denormalisation moves referential integrity into application code.** Nothing checks that
the copies agree, and the update that fixes them is a bulk job you own.

**★ `auto-index-creation` is off by default.** `@Indexed` alone creates nothing. This is a
silent performance cliff in MongoDB and, in Redis, the difference between a query working
and returning nothing.

**★ Turning `auto-index-creation` on moves index creation to startup**, which then collides
with the rule that collection and index operations cannot happen inside a transaction.

**★ Old documents never change shape.** Every field you have ever added must remain optional
in the mapping unless you ran a backfill. The class becomes an archaeological record.

**★ There is no migration history.** Nothing records which shape changes have been applied
where, so "does staging have the new field?" is answered by querying, not by reading a table.

**★ A missing index in Redis is a correctness bug, not a slow query.** In SQL an unindexed
predicate is slow; here there is no set to read.

**★ The exception hierarchy carrying across can hide a store difference.** Catching
`DataAccessException` uniformly is good practice and can obscure the fact that a MongoDB
`DuplicateKeyException` arrived from an index somebody has to have created, while a Postgres
one arrived from a constraint that is in the schema.

**★ An in-memory or embedded substitute for these stores is not equivalent.** A standalone
MongoDB cannot run transactions and a fake Redis does not have the same eviction, expiry or
command semantics. The container is the test double.

## Interview questions

**★ Why is `@Query` more dangerous in Spring Data MongoDB than in Spring Data JPA?**
Because JPQL is parsed against the entity model at startup and a MongoDB query document is a
string interpreted by the server. A renamed property breaks a JPQL query loudly at boot and
breaks a MongoDB query silently at runtime by matching nothing.

**★ The derived-query parser is shared. Does that make repositories portable?**
No. It makes the *method names* portable. The executors differ enormously — a `Between`
becomes SQL, becomes `$gte`/`$lte`, or has no Redis representation at all. Portable syntax
over non-portable semantics is worse than no portability, because it compiles.

**★ How do you join in MongoDB, and in Redis?**
In MongoDB, `$lookup` inside an aggregation pipeline — a real join with a real cost. In
Redis, you do not: you fetch ids and then fetch each document. Both stores expect you to
have embedded or denormalised instead.

**★ What replaces Flyway?**
Nothing, and that is the answer to give. There is no schema to version, so what you version
instead is index creation and any backfill jobs, in whatever deployment tooling you use.
Documents keep their old shape indefinitely, so the mapping class carries every historical
variant.

**★ Which parts of Spring Data JPA knowledge are still worth money here?**
The exception hierarchy — the same `DataAccessException` tree, with `DuplicateKeyException`
and `OptimisticLockingFailureException` meaning the same things. The `@Transactional`
programming model and its proxy semantics. And the template pattern, which is identical in
shape across `JdbcTemplate`, `MongoTemplate` and `RedisTemplate`.

**★ Why is `spring.data.mongodb.auto-index-creation` defaulting to `false` a deliberate
choice?**
Because creating indexes is a database operation with a cost and a locking profile, and doing
it implicitly at application startup — in every instance of a scaled-out deployment — is not
something a framework should decide for you. The consequence is that annotations alone create
nothing.

**★ How do you test a MongoDB repository properly?**
Against a real MongoDB in a container. `@DataMongoTest` gives you the slice, Testcontainers'
`MongoDBContainer` gives you a single-node replica set so transactions work, and you create
collections and indexes in setup because a fresh database has neither.

**★ What is the most under-appreciated thing Spring Data gives you across stores?**
Exception translation. The repository interface is superficial similarity; the
`DataAccessException` hierarchy is a genuine abstraction that lets a retry policy, an error
handler or a `@ControllerAdvice` written for one store keep working against another.

{/* FOOTER */}
