---
title: "14 · Spring Data for MongoDB and Redis"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: see each chunk's own `> Verified:` line. JDK 25, Spring Boot 4.1.1,
> Spring Data Commons 4.1.0, Spring Data MongoDB **5.1.0** (one major ahead of the other
> modules), Spring Data Redis 4.1.0, Spring Data KeyValue 4.1.0, MongoDB Java driver 5.8.0,
> Lettuce 7.5.2, MongoDB 8, Redis 8.

**The repository interface over MongoDB and over Redis is the one you already know from
Spring Data JPA — and almost nothing underneath it is the same.**

:::tip Complete — 25 chunks
Four parts. **MongoDB through the repository** (derived queries, JSON `@Query`, the mapping
annotations, and the `_class` field that puts your package name in every document). **The
template underneath it** (whole-document `save` and the lost update it makes the default,
partial updates, `findAndModify`, bulk writes, the aggregation DSL, and transactions that
are a *deployment* property before they are a Java one). **Redis** (what four commands one
`save` really is, why a repository can only answer equality, the TTL machinery with its
phantom copy and its listener that is off by default, `RedisTemplate`, five serializers, and
a "transaction" with no rollback). Then **what does not carry across** — no dirty checking,
no persistence context, no JPQL, no cascade, no schema — and the closing argument of the
topic and of Phase 10.
:::

This topic owns only the **Java boundary**. The query languages and data models themselves
belong to the [MongoDB](../../../../mongodb/README.md) and [Redis](../../../../redis/README.md)
sections of this bible.

{/* CHUNKS */}

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[1 · One idiom, many stores](01-one-idiom-many-stores.md)** | The repository interface over MongoDB and over Redis looks exactly like the one over Postgres, and almost nothing underneath it is the same |
| 2 | **[2 · MongoDB repositories](02-mongodb-repositories.md)** | A MongoDB repository derives the same method names JPA does, and its keyword vocabulary has two entries a relational schema cannot even express |
| 3 | **[2b · @Query and @Aggregation](02b-query-and-aggregation.md)** | `@Query` takes a JSON document, and its parameters are escaped so hard that you cannot smuggle an operator through one |
| 4 | **[2c · Documents and identifiers](02c-documents-and-mapping.md)** | Four annotations map a document, and the identifier rules are the only place where writing the same field two ways gives two different documents |
| 5 | **[2d · Naming, indexes and construction](02d-naming-indexes-and-construction.md)** | Field names, index creation and object construction are global defaults, and each becomes a data migration the moment there is data |
| 6 | **[2e · The _class discriminator](02e-the-class-discriminator.md)** | Every document carries your fully-qualified class name, which is why renaming a package can stop the application reading its own data |
| 7 | **[3 · MongoTemplate](03-mongotemplate.md)** | `save` replaces the whole document, which makes a lost update the default behaviour rather than an edge case |
| 8 | **[3b · Partial updates](03b-partial-updates.md)** | A partial update writes one field instead of a whole document, and `findAndModify` is the atomic read-and-write a query plus a save can never be |
| 9 | **[3c · Fluent API and bulk writes](03c-fluent-api-and-bulk-writes.md)** | The fluent API makes "one document or all of them" a word rather than a method name, and bulk writes are JDBC batching under another name |
| 10 | **[3d · Aggregation from Java](03d-aggregation-from-java.md)** | A pipeline is an ordered list of stage objects, and the type argument you are not required to supply is the only thing checking your field names |
| 11 | **[3e · Expressions, options and raw stages](03e-expressions-options-and-raw-stages.md)** | Version 3.2 turned a misspelled property into an empty column, and `strictMapping` is the one-word option that gives the exception back |
| 12 | **[4 · Transactions in MongoDB](04-transactions-in-mongo.md)** | A multi-document transaction is a deployment feature before it is a Java feature, and a standalone `mongod` cannot give you one |
| 13 | **[4b · Wiring a Mongo transaction](04b-wiring-a-mongo-transaction.md)** | Without a `MongoTransactionManager` bean, `@Transactional` is not an error and not a transaction — it is nothing, silently |
| 14 | **[5 · Redis repositories](05-redis-repositories.md)** | One `save` is four commands, not one, and three of them exist to fake a feature Redis does not have |
| 15 | **[5b · What a Redis repository can answer](05b-what-a-redis-repository-can-answer.md)** | Equality and nothing else; `Sort` runs in your JVM after everything is loaded, and a finder on an unindexed property has no set to read |
| 16 | **[5c · Object-to-hash mapping and updates](05c-object-to-hash-mapping-and-updates.md)** | Writing an object deletes the hash and re-creates it, so every field the mapping does not know about is destroyed by a `save` |
| 17 | **[5d · Expiry and the phantom copy](05d-expiry-and-the-phantom-copy.md)** | A TTL writes a second copy of the entity, needs a listener that is disabled by default, and leaves indexes pointing at objects that no longer exist |
| 18 | **[5e · A data-structure server behind a repository](05e-a-data-structure-server-behind-a-repository.md)** | Redis is a data structure server, a `CrudRepository` can address exactly one of its structures, and the structure is the design |
| 19 | **[6 · RedisTemplate](06-redistemplate.md)** | The whole Redis API with connection management and serialization bolted on — and the bean Boot hands you is typed `Object, Object` |
| 20 | **[6b · Serializers and the byte key](06b-serializers-and-the-byte-key.md)** | Five serializers, all defaulting to Java native serialization, producing a key that is not the string you typed |
| 21 | **[6c · Redis transactions](06c-redis-transactions.md)** | No rollback, no transaction manager of its own, and a `GET` inside a transaction returns null |
| 22 | **[7 · What does not carry across](07-what-does-not-carry-across.md)** | Dirty checking, the identity map, cascade, lazy loading and flush ordering are all absent, and each absence is code you must now write |
| 23 | **[7b · Queries, schema and exceptions](07b-queries-schema-and-exceptions.md)** | The shared parser accepts keywords the store cannot execute, there is no schema and so no migration, and the exception hierarchy is what really carries across |
| 24 | **[8 · Choosing a store](08-choosing-a-store.md)** | Choose by the access patterns you can name and the ones you cannot, which is why the relational default wins arguments it appears to lose |
| 25 | **[8b · What Phase 10 taught](08b-what-phase-10-taught.md)** | A connection, a round trip and a boundary — and a failure mode that is almost always silence rather than an exception |

{/* FOOTER */}
