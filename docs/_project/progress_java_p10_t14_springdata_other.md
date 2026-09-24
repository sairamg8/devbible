---
name: progress-java-p10-t14-springdata-other
description: devbible · Java Phase 10 · Topic 14 — Spring Data for MongoDB and Redis
metadata:
  type: progress
---

# devbible · Java Phase 10 · Topic 14 — Spring Data for MongoDB and Redis

**Fork session started 2026-08-26.** Tier: **Know**. Directory owned:
`docs/java/pages/phase-10-data-access/14-spring-data-other/` — mine alone.

## Scope and boundary

- **14 owns**: the *repository idiom over another store*. What carries across from Spring
  Data JPA, what does not, where the abstraction leaks.
- **09 owns** Spring Data JPA itself — **being written by a concurrent fork, does not exist
  on disk**. Referred to as **bold plain text `Topic 09 · Spring Data JPA` *(not written
  yet)***, never a link. Same for topics 10–13.
- The **MongoDB section** (`docs/mongodb/`) and **Redis section** (`docs/redis/`) of this
  bible own those databases. 14 never re-teaches the query language or data model.
- Closing topic of Phase 10 — the last chunk names what the whole phase taught.

## Hard constraints

- 🔴 No MongoDB server, no Redis server, no sandbox on this machine. **No console blocks**
  — no `mongosh` transcript, no `redis-cli` output, no timings, no byte counts, ever.
  Java source and documented configuration carry these pages.
- 300-line file cap is a FILE-SIZE rule; write in full then split at 301 on a concept
  boundary. Footer costs 4 lines → write to ≤296 body lines.
- Gotchas and Q&A are exhaustive, never a uniform count per file.
- Do not touch `README.md`, `_category_.json`, `_plan.md`, or any board. No commits in
  devbible. Commits in this store only.

## Link facts verified on disk (2026-08-26)

| Target | Exists? | Link form from a chunk in this topic |
|---|---|---|
| `docs/mongodb/README.md` | ✅ yes | `../../../../mongodb/README.md` |
| `docs/redis/README.md` | ✅ yes | `../../../../redis/README.md` |
| `09-spring-data-jpa/` | ⛔ only `_category_.json` + `_plan.md` | bold plain text |
| `../06-jpa-hibernate-model/` | ✅ full | `../06-jpa-hibernate-model/README.md` etc. |
| `../08-the-n-plus-1-problem/` | ✅ full | `../08-the-n-plus-1-problem/README.md` |
| `../04-spring-transactional/` | ✅ full | `../04-spring-transactional/README.md` |

⚠️ The dispatch prompt said `../../../mongodb/README.md` — that is **one level too few**.
The file sits at `docs/java/pages/phase-10-data-access/14-spring-data-other/NN.md`, so
`docs/mongodb` is **four** levels up.

## Per-file table

| # | File | Lines | Gotchas | Questions | Status |
|---|---|---|---|---|---|
| — | — | — | — | — | plan written, research next |

## Load-bearing claims and their sources

*(filled in as each claim is verified — see below)*

## RESUME HERE

**Next file: `03d-aggregation-from-java.md`, `sidebar_position: 10`.**
Then: `03-mongotemplate.md` (7), `03b-aggregation-from-java.md` (8),
`04-transactions-in-mongo.md`, `05-redis-repositories.md`,
`05b-what-a-redis-repository-can-answer.md`, `06-redistemplate.md`,
`07-what-does-not-carry-across.md`, `08-choosing-a-store.md` — positions increment by 1.

🔴 **FOOTER MARKER CORRECTED 2026-08-26 by the coordinator.** `<!--FOOTER-->` is INVALID
MDX and broke every GitHub Pages deploy since 2026-08-23. **Use `{/* FOOTER */}`** as the
literal last line. Never a bare `<!-- -->` in prose. Also: **a bare `<` followed by a
letter in prose is parsed as JSX** — always backtick generics (`RedisTemplate<K, V>`),
and never let an inline-code span straddle a newline.

⚠️ **Filename corrections vs the plan:**
- `01` links to `05b-what-a-redis-repository-can-answer.md`, NOT the plan's
  `05b-when-a-repository-is-the-wrong-shape.md`. Honour the on-disk link.
- `02` and `02b` both link to `03-mongotemplate.md` — that name is fixed.
- Plan chunk "2b · documents and mapping" became THREE files (02c/02d/02e) at 300 lines.

⚠️ **Cross-topic placeholders left for the coordinator** (bold plain text, never links):
`Topic 09 · Spring Data JPA`, `Topic 10 · Lazy loading`, `Topic 11 · Flyway migrations`,
`Topic 12 · Caching`, `Topic 13 · jOOQ`.

## Per-file table (live)

| # | File | Lines | Gotchas | Questions |
|---|---|---|---|---|
| 1 | `01-one-idiom-many-stores.md` | 283 | 7 | 9 |
| 2 | `02-mongodb-repositories.md` | 217 | 10 | 7 |
| 3 | `02b-query-and-aggregation.md` | 257 | 10 | 9 |
| 4 | `02c-documents-and-mapping.md` | 251 | 9 | 7 |
| 5 | `02d-naming-indexes-and-construction.md` | 227 | 10 | 9 |
| ? | `02e-the-class-discriminator.md` | 294 | 11 | 9 |
| ? | `03-mongotemplate.md` | 241 | 9 | 9 |
| ? | `03b-partial-updates.md` | 249 | 13 | 10 |
| ? | `03c-fluent-api-and-bulk-writes.md` | 229 | 12 | 9 |

Verified for 02c/02d: Spring Data MongoDB 5.1 *Mapping* reference — annotation overview,
identifier rules (the three rules + the five-row field-name table), `@MongoId` FieldType,
field-naming-strategy, constructor creation / `@PersistenceCreator`; Boot 4.1 properties
appendix for `spring.data.mongodb.field-naming-strategy` and `auto-index-creation`
(default `false`).

---

# RESEARCH PASS — all claims verified 2026-08-26

## A · The version trap — SETTLED, and it is the plan's biggest one

Boot 4.1.0's `spring-boot-dependencies` POM imports **`spring-data-bom` 2026.0.0** —
a *release-train name*, not a module version. The modules inside it:

| module | version | note |
|---|---|---|
| spring-data-commons | **4.1.0** | |
| spring-data-jpa | **4.1.0** | |
| spring-data-redis | **4.1.0** | |
| spring-data-keyvalue | **4.1.0** | Redis repositories build on it |
| spring-data-mongodb | **5.1.0** | 🔴 **one major ahead of the others** |
| spring-data-cassandra | 5.1.0 | |
| spring-data-neo4j | 8.1.0 | |
| spring-data-elasticsearch | 6.1.0 | |

Other managed versions in Boot 4.1.0: `mongodb.version` **5.8.0** (driver),
`lettuce.version` **7.5.2.RELEASE**, `jedis.version` **7.4.1**,
`hibernate.version` **7.4.1.Final**.

Sources (primary, both fetched directly):
- https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-dependencies/4.1.0/spring-boot-dependencies-4.1.0.pom
- https://repo1.maven.org/maven2/org/springframework/data/spring-data-bom/2026.0.0/spring-data-bom-2026.0.0.pom

⚠️ The unversioned docs.spring.io coordinates page documents Boot **4.1.1** (mongodb
5.1.1, redis 4.1.1, jpa 4.1.1) — do not quote it as 4.1.0.
Reference docs read: Spring Data MongoDB **5.1.1** reference, Spring Data Redis **4.1.1**
reference, Spring Data Redis **4.1.0** API javadoc, Spring Data MongoDB **5.1.0** API.

## B · Boot 4 moved the MongoDB CONNECTION properties out of `spring.data.*`

Verified against the Boot application-properties appendix (full-text grep of the page):

- `spring.mongodb.uri`, `spring.mongodb.host`, `spring.mongodb.port`,
  `spring.mongodb.database`, `spring.mongodb.username`, `spring.mongodb.password`,
  `spring.mongodb.additional-hosts[0]`, `spring.mongodb.ssl.enabled|bundle`
- **Still** under `spring.data.mongodb.*`: `auto-index-creation`,
  `field-naming-strategy`, `gridfs.bucket`, `gridfs.database`, `repositories.type`
- **Redis did NOT move**: `spring.data.redis.host|port|database|username|password|url`,
  `spring.data.redis.client-type`, `spring.data.redis.repositories.enabled` (default
  `true`), `spring.data.redis.sentinel.*`, `spring.data.redis.cluster.*`,
  `spring.data.redis.lettuce.pool.*`, `spring.data.redis.jedis.pool.*`
- Redis default client is **Lettuce**; default target `localhost:6379`.

Sources: https://docs.spring.io/spring-boot/appendix/application-properties/index.html ·
https://docs.spring.io/spring-boot/reference/data/nosql.html ·
https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide

## C · MongoDB transactions REQUIRE a replica set or sharded cluster

MongoDB Manual: transactions are supported "on replica sets and sharded clusters" where
the primary uses WiredTiger. Standalone is **not** listed. FCV ≥ 4.0 (replica set) /
4.2 (sharded). Cannot run on a sharded cluster with a shard whose
`writeConcernMajorityJournalDefault` is `false`.
Source: https://www.mongodb.com/docs/manual/core/transactions/

Spring Data MongoDB reference (client-session-transactions):
- `MongoTransactionManager` binds a `ClientSession` to the thread; `MongoTemplate`
  detects it. `ReactiveMongoTransactionManager` uses the Reactor context.
- "Make sure to add `replicaSet` to the MongoDB URI."
- 🔴 "MongoDB does NOT support collection operations, such as collection creation,
  within a transaction. This also affects the on the fly collection creation that
  happens on first usage. Therefore, make sure to have all required structures in place."
- `count` inside a transaction errors (server error 50851); Spring rewrites `count()`
  to a `$match`/`$count` aggregation, which forces `$where`→`$expr`,
  `$near`→`$geoWithin`+`$center`, `$nearSphere`→`$geoWithin`+`$centerSphere`.
- Transaction options come from **transaction labels** with the `mongo:` prefix,
  resolved by `MongoTransactionOptionsResolver`: `mongo:readConcern=…`,
  `mongo:writeConcern=…`, `mongo:readPreference=…`, `mongo:maxCommitTime=PT1S`.
- `@Transactional(readOnly = true)` still starts a transaction and attaches the session.
- `setSessionSynchronization(ALWAYS)` needed for `TransactionTemplate`.
- Transient error labels → the reference recommends Spring Retry.
Source: https://docs.spring.io/spring-data/mongodb/reference/mongodb/client-session-transactions.html

`MongoTransactionManager` constructors (5.1.0 API): no-arg, `(MongoDatabaseFactory)`,
`(MongoDatabaseFactory, TransactionOptions)`, and since 4.3
`(MongoDatabaseFactory, MongoTransactionOptionsResolver, MongoTransactionOptions)`.
**None deprecated.**
Source: https://docs.spring.io/spring-data/mongodb/docs/current/api/org/springframework/data/mongodb/MongoTransactionManager.html

## D · The `_class` discriminator

"the `MappingMongoConverter` uses a `MongoTypeMapper` abstraction with
`DefaultMongoTypeMapper` as its main implementation. Its default behavior to store the
fully qualified classname under `_class` inside the document."
"Type hints are written for top-level documents as well as for every value (if it is a
complex type and a subtype of the declared property type)."
`@TypeAlias("pers")` puts `pers` in `_class` instead. 🔴 "Type aliases only work if the
mapping context is aware of the actual type. The required entity metadata is determined
either on first save or has to be provided via the configurations initial entity set."
Customise further via `TypeInformationMapper` on `DefaultMongoTypeMapper` on
`MappingMongoConverter`.
Source: https://docs.spring.io/spring-data/mongodb/reference/mongodb/converters-type-mapping.html

## E · Mongo mapping annotations (5.1 reference)

`@Document` (class, collection name) · `@Id` · `@MongoId` (optional `FieldType`) ·
`@Field` (name and type) · `@Transient` · `@PersistenceCreator` · `@Indexed` · `@DBRef` ·
`@DocumentReference` · `@Version` (optimistic locking).
Id conversion rules: a field named `id` declared `String`/`BigInteger` is converted to
`ObjectId` **if possible**; `@MongoId` stores the actual type with no further conversion
unless a `FieldType` is declared; anything else must be assigned by the application.
Table: `String id`→`_id`; `@Field String id`→`_id`; `@Field("x") String id`→`x`;
`@Id String x`→`_id`; `@Field("x") @Id String y`→`_id` (`@Field(name)` ignored).
Source: https://docs.spring.io/spring-data/mongodb/reference/mongodb/mapping/mapping.html

## F · Mongo repositories and `@Query`

`MongoRepository` extends `PagingAndSortingRepository` and `CrudRepository`.
`@Query("{ 'firstname' : ?0 }")` — attributes `value`, `fields`, `sort`, `hint`,
`collation`, `readPreference`, plus `count`/`delete`/`exists`.
🔴 "String parameter values are escaped during the binding process, which means that it
is not possible to add MongoDB specific operators through the argument."
SpEL via `?#{[0]}`, with an explicit sanitisation warning in the reference.
`@Aggregation("{ $group: … }")` — 🔴 "The `Page` return type is not supported for
repository methods using `@Aggregation`." `@Meta(allowDiskUse = "true")`.
"We do not support referring to parameters that are mapped as `DBRef` in the domain class."
Geo: `Near`/`Within`; a `Distance` with a `Metric` produces `$nearSphere` not `$near`.
Source: https://docs.spring.io/spring-data/mongodb/reference/mongodb/repositories/query-methods.html

## G · MongoTemplate CRUD

"The difference between insert and save operations is that a save operation performs an
insert if the object is not already present." insert → "If there is an existing document
with the same `id`, an error is generated." save → "Saves the object, overwriting any
object that might have the same `id`."
`updateFirst` / `updateMulti` / `upsert` ("The document that is inserted is a combination
of the query document and the update document"); `Update` fluent modifiers (`set`, `inc`,
`push`, `addToSet`, `pull`, `unset`, `rename`, `currentDate`, `min`, `max`, `multiply`,
`pop`, `setOnInsert`); `AggregationUpdate` pipeline updates; `findAndModify` /
`findAndReplace` (replacement must not hold an id); fluent
`template.query(…)/update(…)/insert(…)/remove(…)`; `bulkOps` / `Bulk` (MongoDB 8.0+
cross-collection). Lifecycle event publishing is limited for bulk operations.
`@Version`: "provides syntax similar to that of JPA in the context of MongoDB and makes
sure updates are only applied to documents with a matching version";
`OptimisticLockingFailureException` on mismatch.
Source: https://docs.spring.io/spring-data/mongodb/reference/mongodb/template-crud-operations.html

## H · Mongo aggregation DSL

`newAggregation(...)` with `import static
org.springframework.data.mongodb.core.aggregation.Aggregation.*;`
Stages: match, group, project, sort/sortByCount, limit, skip, unwind, lookup, facet,
bucket/bucketAuto, addFields, count, geoNear, graphLookup, merge, redact, replaceRoot,
sample, set, setWindowFields, unionWith, unset.
`TypedAggregation<T>` checks field references against the input type and derives the
collection name; untyped needs the collection name passed.
"As of version 3.2, referencing non-existent properties no longer raises errors by
default. Use the `strictMapping` option of `AggregationOptions` to restore previous
behavior."
Results: `AggregationResults<T>` → `getMappedResults()`.
Source: https://docs.spring.io/spring-data/mongodb/reference/mongodb/aggregation-framework.html

## I · Spring Data MongoDB 4.x→5.x migration

Requires MongoDB Java Driver **5.6+**; 4.x driver generation dropped.
🔴 "Spring Data no longer defaults UUID settings … the `UuidRepresentation` has to be set
explicitly" (`configureClientSettings(b -> b.uuidRepresentation(STANDARD))`).
🔴 "Spring Data no longer defaults BigInteger/BigDecimal conversion … the default
`BigDecimalRepresentation` has to be set explicitly"
(`configAdapter.bigDecimal(BigDecimalRepresentation.DECIMAL128)`; `STRING` retains old
behaviour). `DefaultMessageListenerContainer` now auto-starts. JMX support discontinued.
Source: https://docs.spring.io/spring-data/mongodb/reference/migration-guide/migration-guide-4.x-to-5.x.html

## J · Redis repositories — the anatomy of one `save`

The reference documents the write for `repository.save(new Person("rand", "al'thor"))` as
four commands (quoted from the docs page, NOT from a run):

```
HMSET "people:19315449-…" "_class" "Person" "id" "19315449-…" "firstname" "rand" "lastname" "al'thor"
SADD  "people" "19315449-…"
SADD  "people:firstname:rand" "19315449-…"
SADD  "people:19315449-…:idx" "people:firstname:rand"
```

(1) the entity hash · (2) the keyspace SET holding every id · (3) the secondary index SET
· (4) the per-entity `:idx` helper set that tracks which index sets to clean up.
Source: https://docs.spring.io/spring-data/redis/reference/redis/redis-repositories/anatomy.html

## K · Redis `@Indexed`, mapping, queries

"Values are written to the according indexes on every save and are removed when objects
are deleted or expire." Nested: `SADD people:address.city:tear …`. Maps/lists index too.
🔴 "Indexes cannot be resolved on References." `@GeoIndexed` on a `Point` → `GEOADD` /
`GEORADIUS`; "It is **not** possible to combine `near` and `within` with other criteria."
Programmatic: `IndexConfiguration` + `SimpleIndexDefinition`, wired via
`@EnableRedisRepositories(indexConfiguration = …)`.
Source: https://docs.spring.io/spring-data/redis/reference/redis/redis-repositories/indexes.html

Mapping/flattening: `firstname = "rand"`; `address.city = "emond's field"`;
`nicknames.[0]`; `atts.[eye-color]`; `addresses.[0].city`; `addresses.[home].city`.
"The `_class` attribute is included on the root level as well as on any nested interface
or abstract types." 🔴 "Writing objects to a Redis hash deletes the content from the hash
and re-creates the whole hash, so data that has not been mapped is lost."
"Custom conversions have no effect on index resolution. Secondary Indexes are still
created, even for custom converted types."
"Map keys need to be simple types, such as `String` or `Number`."
Source: https://docs.spring.io/spring-data/redis/reference/redis/redis-repositories/mapping.html

Derived queries: `And`→`SINTER`, `Or`→`SUNION`, `Is/Equals`→`SINTER`, `IsTrue`→`:alive:1`,
`IsFalse`→`:alive:0`, `Top`/`First` limiting. 🔴 "Query methods for Redis repositories
support only queries for entities and collections of entities with paging."
🔴 "Please make sure properties used in finder methods are set up for indexing."
🔴 "Redis itself does not support in-flight sorting when retrieving hashes or sets.
Therefore, Redis repository query methods construct a `Comparator` that is applied to the
result before returning results as `List`." `RedisCallback` is the escape hatch.
Source: https://docs.spring.io/spring-data/redis/reference/redis/redis-repositories/queries.html

## L · Redis TTL / expiration

`@RedisHash(timeToLive = …)` (seconds, class-wide) or `@TimeToLive` on a numeric property
or a method — not both in one class. Reading back a `@TimeToLive` property returns the
live `TTL`/`PTTL`; `-1` means no expiration. Positive value → `EXPIRE`.
🔴 **Phantom copy**: "A phantom copy is persisted in Redis and set to expire five minutes
after the original" so `RedisKeyExpiredEvent` can carry the expired value.
`@EnableKeyspaceEvents(shadowCopy = OFF)` disables it — the event then holds only the id.
Listener is **disabled at startup by default**; startup mode can be "with the application"
or "on first insert of an entity with a TTL". A disabled listener publishes no expiry
events; a delayed one can lose them.
The listener alters `notify-keyspace-events` if unset; existing settings are not
overridden. AWS ElastiCache disables `CONFIG` — set
`keyspaceNotificationsConfigParameter` to an empty string.
🔴 "Redis does not allow expiration of individual set entries" used as secondary indexes,
and Pub/Sub messages are not persistent — a key expiring while the app is down leaves
**stale references in the secondary index**.
Source: https://docs.spring.io/spring-data/redis/reference/redis/redis-repositories/expirations.html

## M · Redis repository usage limits

🔴 "Referenced Objects are not persisted when the referencing object is saved. You must
persist changes on referenced objects separately, since only the reference is stored.
Indexes set on properties of referenced types are not resolved."
"Updating complex objects as well as map (or other collection) structures requires further
interaction with Redis to determine existing values, which means that rewriting the entire
entity might be faster."
Source: https://docs.spring.io/spring-data/redis/reference/redis/redis-repositories/usage.html

## N · RedisTemplate and serializers

"the central class of the Redis module" · "takes care of serialization and connection
management" · "Once configured, the template is thread-safe and can be reused across
multiple instances."
🔴 Default: "By default, `RedisCache` and `RedisTemplate` are configured to use Java
native serialization" — `JdkSerializationRedisSerializer`.
`StringRedisTemplate` "uses the `StringRedisSerializer` underneath, which means the stored
keys and values are human-readable".
🔴 Security: "Java native serialization is known for allowing the running of remote code
… do not use serialization in untrusted environments. In general, we strongly recommend
any other message format (such as JSON) instead."
`enableDefaultSerializer=false` + null serializers → raw `byte[]`.
Accessors: `opsForValue/List/Hash/Set/ZSet` and the `Bound*Operations` variants.
Source: https://docs.spring.io/spring-data/redis/reference/redis/template.html

**Serializer classes present in the Spring Data Redis 4.1.0 API** (javadoc package
summary, fetched and parsed): `RedisSerializer`, `StringRedisSerializer`,
`JdkSerializationRedisSerializer`, `OxmSerializer`, `GenericToStringSerializer`,
`Jackson2JsonRedisSerializer`, `GenericJackson2JsonRedisSerializer`
(🔴 **deprecated, marked "for removal"**), `JacksonJsonRedisSerializer`,
`GenericJacksonJsonRedisSerializer` (🔴 the **Jackson 3** replacements — they build on
`tools.jackson.databind`).
Source: https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/serializer/package-summary.html

## O · Redis transactions in Spring Data

`multi`/`exec`/`discard` exist on `RedisTemplate` but 🔴 "`RedisTemplate` is not
guaranteed to run all the operations in the transaction with the same connection" — use
`SessionCallback`. An exception between `multi()` and `exec()` can leave the connection
stuck in a transactional state; call `discard()`.
`template.setEnableTransactionSupport(true)` opts a template into managed Spring
transactions; the connection is then bound to the transaction via a `ThreadLocal`, commit
issues `EXEC`, rollback `DISCARD`. Read-only commands (e.g. `KEYS`) are piped to a fresh
non-thread-bound connection; writes are queued.
🔴 "returns null as values set within a transaction are not visible" —
`template.opsForValue().get("thing1")` inside the transaction returns `null`.
Source: https://docs.spring.io/spring-data/redis/reference/redis/transactions.html

---

## Could NOT confirm

- The MongoDB Manual transactions page does not state a standalone deployment is
  *unsupported* in so many words — it lists replica sets and sharded clusters as what is
  supported. Pages will say "the Manual lists replica sets and sharded clusters and does
  not list standalone", not invent a quote.
- The type-mapping page does not document disabling `_class` by passing a null type key
  to `DefaultMongoTypeMapper`. It documents `@TypeAlias` and `TypeInformationMapper` only.
  Pages will not claim a documented "turn it off" switch.
- The default transaction lifetime limit (`transactionLifetimeLimitSeconds`) is not on the
  Manual page fetched; it is left out rather than quoted from memory.

- 02e-the-class-discriminator.md: MappingMongoConverter/DefaultMongoTypeMapper _class default; type-hint rule for nested subtypes; @TypeAlias + the initial-entity-set caveat; TypeInformationMapper; explicitly does NOT claim a documented switch to disable _class; 5.x migration UUID + BigDecimalRepresentation (verified against migration-guide-4.x-to-5.x)

- 03-mongotemplate.md: template chapter

- 03b-partial-updates.md: template chapter

- 03c-fluent-api-and-bulk-writes.md: template chapter
