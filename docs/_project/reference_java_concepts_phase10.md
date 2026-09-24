---
name: reference-java-concepts-phase10
description: Verified version spine and load-bearing facts for devbible Java Phase 10 (Data access) — Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, HikariCP 7.0.2, Flyway 12.4.0, jOOQ 3.21.5 — plus two corrections to Phase 9's record
metadata:
  type: reference
---

# Java Phase 10 · Data access — the verified version spine

Researched 2026-08-20 from PRIMARY sources only (Maven Central POMs read directly,
docs.spring.io, hibernate.org, jakarta.ee, HikariCP source at its release tag,
flywaydb, jooq.org). See [[progress-java-python-syllabus]] and
[[reference-java-concepts-phase9]].

## 🔴 TWO CORRECTIONS TO WHAT WE ALREADY WROTE

1. **Spring Boot 4.1.0 was released 10 June 2026, not 11.** Four sources agree (git
   tag `2026-06-10T16:16:28Z`, release `2026-06-10T18:21:42Z`, the spring.io blog
   post `2026/06/10/spring-boot-4/`, Maven Central `Last-Modified` 10 Jun). Phase 9's
   record says 11 Jun — **that is wrong**; do not propagate it.
2. **The JDK baseline is 17, not 25.** `spring-boot-starter-parent-4.1.0.pom` sets
   `<java.version>17</java.version>`, and Framework 7.0 *"retains a JDK 17 baseline
   while at the same time recommending JDK 25 as the latest LTS release."* Targeting
   JDK 25 is right; calling it the floor is wrong.
   ⚠️ **Except jOOQ, which forces Java 21** — see below.

## The managed versions (from `spring-boot-dependencies-4.1.0.pom`)

| Thing | Version |
|---|---|
| Spring Framework | **7.0.8** |
| Hibernate ORM | **7.4.1.Final** (Apache-2.0 since 7.0 — relicensed from LGPL) |
| Jakarta Persistence | **3.2.0** |
| Spring Data BOM | **2026.0.0** — ⚠️ **members do NOT share a version**: jpa/commons/jdbc/relational/redis/envers/keyvalue **4.1.0**, mongodb/cassandra/rest **5.1.0**, couchbase/elasticsearch **6.1.0**, neo4j **8.1.0**. No codename (those stopped after 2023.1 Vaughan) |
| HikariCP | **7.0.2** (still the default pool) |
| Flyway | **12.4.0** (upstream is already 13.3.0 — Boot pins a major behind) |
| jOOQ | **3.21.5** |
| MongoDB driver | 5.8.0 · Lettuce **7.5.2.RELEASE** · Jedis 7.4.1 |
| Jackson | **3.1.4** default (Jackson 2 also managed at 2.21.4 — never write "Jackson 2.21.4" as *the* version) |
| Ehcache 3.12.0 · Infinispan hibernate cache 16.1.4 | |

⚠️ **Doc-linking hazard:** `docs.spring.io/spring-boot/4.1/…` currently 302s to the
unversioned path and will silently serve 4.2 later. **Pin `/4.1/` in every
`> Verified:` line** and record that the version selector read 4.1.0 on 2026-08-20.

## 🔴 Facts that break almost every sample online

### Hibernate 7 removed the API everyone still writes
`Session#save` / `update` / `saveOrUpdate` / `delete` / `load` are **gone** →
`persist` / `merge` / `remove` / `getReference`. Also removed: `@Where`, `@OrderBy`
(the Hibernate one), `@Index`, `@ForeignKey`, `@Proxy`, `@SelectBeforeUpdate`,
`@Loader`, `@LazyCollection`, `@LazyToOne`. Implicit `cascade=PERSIST` on
`@Id`/`@MapsId` associations removed. `hibernate.query.immutable_entity_update_query_handling_mode`
**default flipped `warning` → `exception`**. Native queries now return `java.time`
types instead of `java.sql`. `char` → `varchar(1)`. Entity discovery needs the new
`hibernate-scan-jandex` module.

### 🔴 The AUTO sequence is named after the TABLE, not the entity
Widely mis-stated. Hibernate 7.4 User Guide: *"since the entity is mapped to a table
named `product`, Hibernate will use a sequence named `product_seq`"*. Entity name is
used only for `@Subselect` mappings. Default `allocationSize` **50**
(`OptimizableGenerator.DEFAULT_INCREMENT_SIZE`), default optimizer **`pooled`**
(NOT `pooled-lo`).

### `hbm2ddl.auto` unchanged, but 7.4 added a trap
Values `create`, `create-drop`, `create-only`, `drop`, `update`, `validate`, `none`
(default `none`), plus Hibernate-only `populate` (7.0) and `synchronize` (7.2).
⚠️ **`truncate` is NOT a legal value.** `jakarta.persistence.schema-generation.database.action`
**takes precedence**. ⚠️ **7.4 change:** schema actions now run even when no entities
are mapped, so a stray `import.sql` may suddenly execute —
`hibernate.hbm2ddl.skip_default_import_file`.

### `StatelessSession` changed in 7
🔴 **Uses the second-level cache by default now** (pass `CacheMode.IGNORE` to bypass),
and `hibernate.jdbc.batch_size` **no longer affects it** — use `setJdbcBatchSize(Integer)`.
New `insertMultiple`/`updateMultiple`/`deleteMultiple`/`upsertMultiple`/`getMultiple`.
Still does **not** cascade.

### Jakarta Persistence 3.2 — nothing removed, but semantics moved
- **`@GeneratedValue.generator()` now defaults to the entity name** (3.1: the
  provider's generator).
- **`AUTO` is specified per id type**: `UUID`/`String` → as `GenerationType.UUID`;
  integral → provider picks TABLE/SEQUENCE/IDENTITY. 3.1's *"only integral types will
  be portable"* sentence is gone.
- Generated ids in `@PrePersist` are available for SEQUENCE/TABLE/UUID, **not IDENTITY**.
- `EntityManager` gained `find(Class,Object,FindOption...)`, `getReference(T)`,
  `runWithConnection`/`callWithConnection`, cache retrieve/store mode accessors, and a
  `Timeout` class (*"always a hint"*). ⚠️ The option interfaces are **asymmetric**:
  `CacheRetrieveMode` is a `FindOption` only; `LockModeType` is a Find/RefreshOption but
  deliberately **not** a `LockOption`.
- `EntityManagerFactory` gained `runInTransaction`/`callInTransaction`, `getSchemaManager()`.
- **JPQL**: `UNION`/`INTERSECT`/`EXCEPT`, and the **SELECT clause and identification
  variable are now OPTIONAL** — `FROM Order WHERE customer.lastname='Smith'` is legal,
  implicit variable `this`. ⚠️ **Reversed rule**: 3.1 forbade an identification variable
  sharing a name with an entity; 3.2 allows it.
- **Records** are legal as embeddables and PK classes, **illegal as entities**. Entities
  may now be static inner classes.
- Deprecated: `@Temporal`, `TemporalType`, `java.util.Date/Calendar`,
  `CriteriaQuery.multiselect(...)`.
- 🔴 **There is no `@EnableQueryCache`** — confirmed absent from the full 3.1→3.2 diff.

### Spring Data JPA 4.1.0 — the derived-query engine changed
- **Derived queries moved from the Criteria API to String-based JPQL in 4.0**
  (~3.5× faster). ⚠️ `spring.data.jpa.query.native.parser` is **gone** — use
  `@EnableJpaRepositories(queryEnhancerSelector = …)`. New `@NativeQuery`.
  Single-result methods now use `getSingleResultOrNull()`, so **`NoResultException`
  no longer surfaces**.
- `PagingAndSortingRepository` still extends only `Repository<T,ID>` (changed in
  Spring Data 3.0, not 4.x). `ListCrudRepository`/`ListPagingAndSortingRepository`
  are `@since 3.0`; ⚠️ the latter narrows only `findAll(Sort)` — `findAll(Pageable)`
  still returns `Page<T>`.
- 🔴 **`scrollBy(...)` DOES NOT EXIST.** It is
  **`FluentQuery.FetchableFluentQuery#scroll(ScrollPosition)`**. `Window<T>`,
  `ScrollPosition`, `KeysetScrollPosition`, `OffsetScrollPosition` are `@since 3.1`;
  `Limit` is `@since 3.2`.
- Removed in 4.0: `ListenableFuture` support, `@PersistenceConstructor`,
  `QueryMethodEvaluationContextProvider`; `PropertyPath`/`TypeInformation` **moved to
  `org.springframework.data.core`**. In **4.1**, `@ProjectedPayload` becomes
  **required** on web projection parameters.
- **AOT repositories are on by default** — `spring.aot.repositories.enabled`,
  `spring.aot.jpa.repositories.enabled`. ⚠️ They appear **nowhere** in Boot's
  properties appendix, and JPA AOT **does not support `ScrollPosition` methods**.
- JSpecify: `org.springframework.lang.{Nullable,NonNull,…}` deprecated (not removed).

### `@Transactional` — semantics unchanged, proxying changed
Framework 7.0's release notes contain **no transaction section at all**. Defaults:
`propagation=REQUIRED`, `isolation=DEFAULT`, `timeout=-1`, `readOnly=false`.

Exact default rollback wording, verbatim from
`docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html`
(⚠️ the path is `declarative/rolling-back.html`, **not** `declarative-rolling-back.html`,
which 404s):

> *"In its default configuration, the Spring Framework's transaction infrastructure code
> marks a transaction for rollback only in the case of runtime, unchecked exceptions.
> That is, when the thrown exception is an instance or subclass of `RuntimeException`.
> (`Error` instances also, by default, result in a rollback)."* … *"Checked exceptions
> that are thrown from a transactional method do not result in a rollback in the default
> configuration."*

Plus *"the strongest matching rule wins"*.

**What 7.0 DID change:** *"global proxy type defaulting to CGLIB — like in Spring Boot —
is consistently applied to all proxy processors (including `@Async` and co)"*, with a new
**`@Proxyable(INTERFACES|TARGET_CLASS)`** opt-out. **Self-invocation is unchanged and
still silently untransactional.** Hibernate transaction managers **moved package** in
7.0: `org.springframework.orm.hibernate5` → `org.springframework.orm.hibernate`.

⚠️ Commonly mis-dated as 7.0 but actually **6.1**: `TransactionExecutionListener`
(package `org.springframework.transaction`, not `.support`), failed `CompletableFuture`
triggering rollback, `@TransactionalEventListener` in reactive transactions.

### HikariCP 7.0.2 — the defaults, verbatim from its README
`maximumPoolSize` **10** · `minimumIdle` **= maximumPoolSize** · `connectionTimeout`
**30000** · `idleTimeout` **600000** · `maxLifetime` **1800000** · `keepaliveTime`
**120000** · `validationTimeout` **5000** · `leakDetectionThreshold` **0** ·
`initializationFailTimeout` **1** · `autoCommit` **true**. Requires **Java 11+**.

Sizing formula, verbatim from `/wiki/About-Pool-Sizing`:
**`connections = ((core_count * 2) + effective_spindle_count)`** — cores excluding
hyperthreading; effective spindles → 0 if the working set is fully cached. Axiom:
*"You want a small pool, saturated with threads waiting for connections."*

**The exact exception message**, read from `HikariPool.java` at tag `HikariCP-7.0.2`
(a `SQLTransientConnectionException`):
```
poolName + " - Connection is not available, request timed out after " + elapsedMillis + "ms " +
  "(total=" + total + ", active=" + active + ", idle=" + idle + ", waiting=" + waiting + ")"
```
⚠️ The `(total=…)` suffix **is** present in 7.0.2 — older material shows it without.

Boot's selection order (reference `/reference/data/sql.html`): *"We prefer HikariCP for
its performance and concurrency. If HikariCP is available, we always choose it."* →
Tomcat → DBCP2 → Oracle UCP. Override with `spring.datasource.type`.

### `JdbcClient` — Framework **6.1**, extended in 7.0
Class javadoc: *"Delegates to `JdbcTemplate` and `NamedParameterJdbcTemplate`."*
Neither is deprecated. 🔴 **There is no `JdbcClient.of(...)`** — the factories are all
`create(...)`. Terminal specs are **disjoint**: `MappedQuerySpec` has
`stream/list/set/single/optional`; `ResultQuerySpec` has
`rowSet/listOfRows/singleRow/singleColumn/singleValue/optionalValue`.
**New in 7.0**: `withFetchSize(int)`, `withMaxRows(int)`, `withQueryTimeout(int)`.
Boot auto-configures it **conditional on a `NamedParameterJdbcTemplate` bean**.

### Flyway 12.4.0 — two things Boot does not paper over
1. 🔴 **`flyway-database-postgresql` is STILL mandatory.** Boot's own docs: *"Other
   cases require also a database-specific module. For example, use
   `org.flywaydb:flyway-database-postgresql` with PostgreSQL."* Proven three more
   ways: `spring-boot-starter-flyway:4.1.0`'s tree stops at `flyway-core`;
   `flyway-core-12.4.0.jar` contains only `…/database/h2/` and `…/sqlite/`;
   PostgreSQL support lives in the separate module via `META-INF/services`. Boot
   **does** manage its version — declare it without one.
2. 🔴 **Boot 4.0 breaking change: `spring-boot-starter-flyway` is NEW** — it 404s for
   3.4/3.5. *"you used to only have the relevant third-party dependency. You now need
   to replace that with `spring-boot-starter-flyway`."*

⚠️ **Nomenclature:** Maven Central ships **Flyway OSS** (*"contains no proprietary
functionality"*, Apache-2.0). **"Community"** is a Redgate *package* = OSS + proprietary
desktop tooling. Undo, dry-run and drift detection remain paid.
**Minimum Java 17** for 11.x/12.x/13.x — *"Starting with Flyway v14, Java 21 will be
required"* (v14, **not** v13 as some sources claim).

`spring.flyway.*` intact; `clean-disabled` **true** (source: `private boolean
cleanDisabled = true;`); `table` = `flyway_schema_history`; `locations` =
`classpath:db/migration` (⚠️ the properties appendix prints an **empty** default cell —
cite the source, not the appendix). **Removed in Boot 4.0:**
`spring.flyway.clean-on-validation-error`. Renamed: `oracle-sqlplus` → `oracle.sqlplus`.

### jOOQ 3.21.5 — raises the Java floor to 21
🔴 *"The jOOQ Open Source Edition 3.20 increases its baseline to JDK 21"* — verified
mechanically: `jooq-3.21.5.jar` classes are major version **65**, non-multi-release.
Boot says it outright: *"jOOQ requires Java 21 or later."* Java 17 builds exist only
under `org.jooq.pro-java-17` (commercial). **A Boot 4.1 app stops being Java-17-portable
the moment jOOQ is added.**
OSS Edition **supports PostgreSQL** — ⚠️ but *"The jOOQ Open Source Edition always
supports the latest dialect version"*, so an older PostgreSQL is outside the supported
matrix. Oracle/SQL Server/Db2/CockroachDB need a commercial edition.
Sample-breakers: 3.20 moved JPA annotation support out to `jooq-jpa-extensions`;
**3.21 removed all pre-3.10 deprecated API**.

### Mongo / Redis
Lettuce is **still the default**; `spring.data.redis.client-type` enum allows exactly
`LETTUCE`, `JEDIS`. **Valkey is essentially absent** — zero hits across the whole Boot
`v4.1.0` tree and all 48 Spring Data Redis `.adoc` files; the only primary
acknowledgement is the spring-data-redis README (*"tested to work with Valkey on a
best-effort basis"*).
⚠️ Boot **4.0 split MongoDB properties** — many `spring.data.mongodb.*` became
**`spring.mongodb.*`**. (`spring.redis.*`→`spring.data.redis.*` was Boot **3.0**.)
⚠️ Spring Data MongoDB 5.0 **changed `BigDecimal` storage to `Decimal128`** — needs data
migration. ⚠️ Spring Data Redis 4.0 made `RedisCache` `put`/`evict`/`clear`
**asynchronous by default** under Lettuce (`it.immediateWrites()` restores 3.x
behaviour); `spring.data.redis.lettuce.cluster.refresh.adaptive` was **removed in 4.1.0**.

### Caching
`spring.cache.type` values, from the `CacheType` enum at `v4.1.0` (Boot's prose never
lists them): `generic`, `jcache`, `hazelcast`, `couchbase`, `infinispan`, `redis`,
`cache2k`, `caffeine`, `simple`, `none` — ⚠️ **there is no `ehcache` value**; Ehcache 3
is reached via `jcache`.
`@Cacheable` with `CompletableFuture`/`Mono`/`Flux` is a **6.1** feature, not 7.0.
**Framework 7.0 changes nothing in the cache abstraction.**
Hibernate 7: *"comes with built-in support for the Java caching standard JCache and also
the popular caching library: Infinispan."* **`hibernate-ehcache` was removed in 6.0**
(HHH-12416).
Defaults: `hibernate.cache.region.factory_class` → `NoCachingRegionFactory`;
`hibernate.cache.use_second_level_cache` → **true when a provider is specified, false
otherwise**; `hibernate.cache.use_query_cache` → **false**;
`jakarta.persistence.sharedCache.mode` → **`ENABLE_SELECTIVE`**. Boot has **no**
dedicated 2LC property — everything goes through `spring.jpa.properties.*`.
⚠️ `org.hibernate.annotations.@Cache`'s `include` attribute was **removed in 7.0** →
`includeLazy`. (The 7.4 User Guide prose still describes `include` — it is stale.)

### Boot 4 package moves that 404 every Boot 3 javadoc link
The autoconfigure monolith is split per technology and root packages moved to
`org.springframework.boot.<technology>`:
`JpaProperties` → `org.springframework.boot.jpa.autoconfigure.JpaProperties` ·
`HibernateProperties` → `org.springframework.boot.hibernate.autoconfigure.HibernateProperties` ·
`FlywayProperties` → `org.springframework.boot.flyway.autoconfigure.FlywayProperties` ·
`RedisProperties` → **`DataRedisProperties`** · `SpringDataWebProperties` → **`DataWebProperties`**.
Starter *names* are unchanged, but `spring-boot-starter-data-jpa` now pulls
`spring-boot-starter-jdbc` + `spring-boot-data-jpa` + `spring-boot-jdbc`.

### 🔴 `spring.jpa.open-in-view` is STILL `true` by default, and Boot still warns
`@ConditionalOnBooleanProperty(name = "spring.jpa.open-in-view", matchIfMissing = true)`.
Exact WARN string from `JpaBaseConfiguration$JpaWebConfiguration` at `v4.1.0`:

> `spring.jpa.open-in-view is enabled by default. Therefore, database queries may be
> performed during view rendering. Explicitly configure spring.jpa.open-in-view to
> disable this warning`

`spring.jpa.hibernate.ddl-auto` default, from the source comment: *"Defaults to
`create-drop` when using an embedded database and no schema manager was detected.
Otherwise, defaults to `none`."*

⚠️ Jackson 3 knock-on: `spring.data.web.pageable.serialization-mode` defaults to
**`direct`**, so `PageImpl` still serializes raw and **logs a discouraging warning once
per app**; `VIA_DTO` wraps in `PagedModel`. Boot's docs never mention it (zero hits
across all 162 `.adoc` files at `v4.1.0`) — **cite spring-data-commons, not Boot**.

## 🔴 COULD NOT CONFIRM — state as uncertain or leave out (rule 8)

- **Flyway's edition lineup.** Redgate's current editions page lists only **Community
  (free)** and **Enterprise**; "Teams" survives only in older pages. Do not write a
  confident Community/Teams/Enterprise trio.
- A Flyway-side `flyway.oracle.*` namespace move — the regrouping is confirmed on the
  **Boot** side only.
- Flyway schema-history **table format** changes in 11/12/13 — nothing in the
  breaking-change sections. Absence of evidence.
- **Ehcache 3.12.0's contents** — ehcache.org documents only to 3.11 and there is no
  GitHub release for v3.12.0. The version is solid; what changed in it is not.
- **`hibernate.query.in_clause_parameter_padding`'s default** — `false` comes from
  `SessionFactoryOptions` source, not from a `@settingDefault`. **Boot's own effective
  value was never checked.**
- `hibernate.id.new_generator_mappings`' removal version rests on a 5.6→6.0 source
  diff, not prose. Same for `hibernate-infinispan`'s removal (no ticket found).
- Whether `jakarta.persistence.QueryFlushMode` exists in JPA 3.2.
- JPA 3.2 **binary** compatibility after the `Graph` pull-ups and the
  `Attribute<T,X>` → `Attribute<? super T,X>` widening. Source-compatible is visible;
  **say "recompile", not "drop-in"**.
- Defaults for `spring.aot.*repositories.enabled` — prose only, no printed default.
- `@DataJpaTest` transactional/rollback defaults and `@AutoConfigureTestDatabase`'s
  `replace` default in Boot 4.x — not read (that is phase 11's problem).
- Spring Framework **6.2** transaction changes — a grep of the full notes found
  nothing. Absence of evidence, not a positive "nothing changed".
- `JdbcClientAutoConfiguration`'s class name and `@Conditional` annotations —
  behaviour confirmed from prose only.
