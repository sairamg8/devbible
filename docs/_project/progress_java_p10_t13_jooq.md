---
name: progress-java-p10-t13-jooq
description: devbible · Java Phase 10 · Topic 13 · jOOQ — fork progress
metadata:
  type: progress
---

# devbible · Java Phase 10 · Topic 13 · jOOQ — fork progress

**Scope (mine alone):** `docs/java/pages/phase-10-data-access/13-jooq/`
**Tier:** Know (`<span className="db-tier t-know">Know</span>` on every chunk)
**sidebar_position:** starts at 1, increments per file.
**Do not touch:** `README.md`, `_category_.json`, `_plan.md`, any board, any other topic.
**Do not commit in devbible.** Commit only in this store.

## Boundary

- `../05-sql-first-access/` — COMPLETE, 33 chunks. Owns `JdbcTemplate`/`JdbcClient` and
  already argues the SQL-first case. Topic 13 is the *generated, type-checked* version of
  that argument — contrast, never repeat.
  - `../05-sql-first-access/11b-the-flush-ordering-trap.md` already documents the
    unflushed-persistence-context hazard for `JdbcClient`. **Link to it from `08b`,
    do not re-derive.**
  - Other useful 05 chunks that exist on disk: `10-when-sql-first-beats-an-entity.md`,
    `10b-what-you-give-up.md`, `11-mixing-both.md`, `08-writes-and-generated-keys.md`,
    `12g-testcontainers-and-serviceconnection.md`, `03d-automatic-mappers.md`,
    `06-the-exception-hierarchy.md`, `06c-what-to-catch-on-postgresql.md`.
- `../06-jpa-hibernate-model/`, `../07-relationships-fetch/`, `../08-the-n-plus-1-problem/`
  own JPA — COMPLETE. `08-jooq-vs-jpa.md` must say plainly where JPA wins.
- ⚠️ **Topics 09, 10, 11, 12, 14 of this phase are being written by OTHER FORKS RIGHT NOW
  and their files do not exist.** Phase 11 · Testing does not exist. Refer to them as
  **bold plain text** with *(not written yet)* — never a link. This especially hits
  `02b-generating-from-migrations.md`, which must name **Flyway** in prose only.

## 🔴 LOAD-BEARING CLAIMS — every one with the URL that settles it

### Version

- **Current jOOQ release is 3.21.7** (the plan guessed 3.20.x — corrected).
  Source: https://www.jooq.org/download/ (fetched 2026-08).

### Licensing — THE fact that decides adoption. Verified 2026-08.

Source: https://www.jooq.org/legal/licensing and https://www.jooq.org/download/

- **jOOQ Open Source Edition — free, Apache-2.0** for the runtime, meta and codegen
  components. jooq.org: *"All of jOOQ is available for free under the terms of various
  Open Source licenses"*, Apache-2.0 for runtime/meta/codegen.
- **The split is by DATABASE, not by feature.** OSS Edition supports, at latest versions
  only: **ClickHouse, Derby, DuckDB, Firebird, H2, HSQLDB, MariaDB, MySQL, PostgreSQL,
  SQLite, Trino, YugabyteDB.**
- **Express Edition — €99 / developer / year.** Adds Microsoft Access 2013+, Oracle
  Express Edition 18c+, SQL Server Express Edition 2012+, plus historic version support.
- **Professional Edition — €399 / developer / year.** Adds Oracle (all editions) 18c+,
  SQL Server (all editions) 2012+, Amazon Redshift, Aurora MySQL, Aurora PostgreSQL,
  Azure SQL Database, Azure SQL Datawarehouse, CockroachDB, MemSQL/SingleStore.
- **Enterprise Edition — €799 / developer / year.** Adds BigQuery, Databricks,
  DB2 LUW 9.7+, Exasol, HANA, Informix 12.10+, Snowflake, Spanner, Sybase ASE 15.5+,
  Sybase SQL Anywhere 12+, Teradata 16+, Vertica 7.1+.
- **Licence unit:** *"One for every developer workstation which is used to write jOOQ
  code. Server licenses are included."* Perpetual "Unlimited" plans never expire and
  include 1 year of maintenance/upgrades + support (renewable); Monthly/Yearly
  subscriptions expire at term end.
- **Generated code is yours:** jooq.org states the generator output *"is not jOOQ API, but
  your own code"* and can be licensed under any licence, though it *"makes use of jOOQ's
  internal APIs"*.
- 🔴 **JDK support matrix is per edition and is BACKWARDS from what you'd guess:**
  - Open Source Edition — **Java 21 and newer**
  - Express Edition — Java 11 and newer
  - Professional Edition — Java 11 and newer
  - Enterprise Edition — Java 8 and newer
  (The free edition has the *highest* Java floor; the paid editions buy backwards
  compatibility.) Source: https://www.jooq.org/download/
- **Consequence for devbible's spine:** PostgreSQL 18 + JDK 25 → the free Apache-2.0
  Open Source Edition covers everything this phase teaches. Nothing on this topic needs a
  paid licence.

### Code generation

- **DDLDatabase** — generates from SQL DDL script files, no live database. Parses the
  scripts with jOOQ's own parser and **applies them to an in-memory H2** to build a schema
  replica, then reverse-engineers that.
  Artifact: `org.jooq:jooq-meta-extensions:3.21.7`.
  Properties: `scripts` (ant-style patterns), `sort` (`semantic` | `alphanumeric` |
  `flyway` | `none`), `defaultNameCase` (`as_is` | `upper` | `lower`), `unqualifiedSchema`
  (`public` | `none`), `parseIgnoreComments` (default true) with
  `parseIgnoreCommentStart`/`Stop`, `sql`, `logExecutedQueries`, `logExecutionResults`.
  Escape hatch for unparseable vendor syntax:
  `-- [jooq ignore start]` … `-- [jooq ignore stop]`.
  🔴 **Limitation that matters:** it only understands syntax jOOQ's parser can represent,
  and the replica is H2 — so PostgreSQL-only DDL is the weak spot.
  Source: https://www.jooq.org/doc/latest/manual/code-generation/codegen-ddl/

### DSL / dynamic SQL

- **Plain SQL templating placeholders are `{0}`, `{1}`, …** (0-based, may repeat).
  `DSL.field(String, ...)`, `DSL.condition(String, ...)`, `DSL.table(String, ...)`.
  `DSL.list(QueryPart...)` wraps a comma-separated list as one template argument:
  `condition("my_column IN ({0})", list(a, b, c))`. The templating engine ignores tokens
  inside string literals, quoted names, comments and JDBC escapes.
  Source: https://www.jooq.org/doc/latest/manual/sql-building/plain-sql-templating/
- 🔴 **`DSL.noCondition()` is the documented answer for dynamic SQL**, NOT
  `and(emptyList())`. It is *"a pseudo-identity for both AND and OR, not generating any SQL,
  except if the reduction produces nothing (from an empty set), in case of which it will
  behave like TRUE"*. ⚠️ The manual's own warning: *"noCondition() does not act as an
  identity! If your noCondition() is the only predicate left in a WHERE clause, there will
  not be any WHERE clause, regardless if you work with AND predicates or OR predicates."*
  `trueCondition()` = identity of AND; `falseCondition()` = identity of OR.
  Source: https://www.jooq.org/doc/latest/manual/sql-building/conditional-expressions/true-false-no-condition/
  and https://www.jooq.org/doc/latest/manual/sql-building/dynamic-sql/no-condition/
  ⚠️ **TRAP I ALMOST SHIPPED:** I first wrote "`DSL.and(emptyList())` renders `true`" —
  the javadoc does NOT document empty-collection behaviour. Corrected to the documented
  `noCondition()` story before commit.

### Spring Boot 4.1 integration (for chunk 07)

Source: https://docs.spring.io/spring-boot/reference/data/sql.html and
https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-jooq/src/main/java/org/springframework/boot/jooq/autoconfigure/JooqAutoConfiguration.java

- Boot **auto-configures a `DSLContext` bean** wired to the application `DataSource`.
- Boot docs state jOOQ **requires Java 21 or later** (matches the OSS edition floor).
- `JooqAutoConfiguration` in Boot 4.1 lives in module `spring-boot-jooq`, package
  `org.springframework.boot.jooq.autoconfigure`. Starter is `spring-boot-starter-jooq`.
  - `@AutoConfiguration(after = {DataSourceAutoConfiguration.class, TransactionAutoConfiguration.class})`
  - `@ConditionalOnClass(DSLContext.class)` · `@ConditionalOnBean(DataSource.class)`
  - `@EnableConfigurationProperties(JooqProperties.class)`
  - `@Bean @ConditionalOnMissingBean(ConnectionProvider.class) DataSourceConnectionProvider`
    — wraps the DataSource in **`TransactionAwareDataSourceProxy`**
  - `@Bean @ConditionalOnBean(PlatformTransactionManager.class)
    @ConditionalOnMissingBean(TransactionProvider.class) SpringTransactionProvider`
  - `@Bean @Order(0) DefaultExecuteListenerProvider jooqExceptionTranslatorExecuteListenerProvider`
  - `@Bean @ConditionalOnMissingBean ExceptionTranslatorExecuteListener jooqExceptionTranslator()`
  - `@Bean @ConditionalOnMissingBean(org.jooq.Configuration.class) DefaultConfiguration`
  - `@Bean @ConditionalOnMissingBean(DSLContext.class) DefaultDSLContext`
  - `@Bean @ConditionalOnProperty("spring.jooq.config") Settings settings(...)`
- `spring.jooq.sql-dialect` — otherwise Boot detects it; falls back to `DEFAULT`.
  🔴 Boot docs: *"Spring Boot can only auto-configure dialects supported by the open source
  version of jOOQ."*
- Customisation hooks: a `DefaultConfigurationCustomizer` bean, or your own
  `org.jooq.Configuration` `@Bean`.
- jOOQ manual: *"When using Spring Boot, its jOOQ starter already pre-configures the correct
  Spring transaction aware data source, so Spring JDBC transactions will work out of the box
  with jOOQ."*
  Source: https://www.jooq.org/doc/latest/manual/sql-execution/transaction-management/
- Test slice `@JooqTest` exists at
  `org.springframework.boot.jooq.test.autoconfigure.JooqTest` (Boot 4.x API docs).

### jOOQ's own transaction API (chunk 07)

- `dsl.transaction(TransactionalRunnable)` / `dsl.transactionResult(TransactionalCallable)`.
  Lambda receives a derived `Configuration trx`; the manual says *"avoid using the scope from
  outside the transaction"* and use `trx.dsl()`.
- Nested transactions use JDBC **savepoints** via `DefaultTransactionProvider`.
- Any uncaught checked or unchecked exception rolls back.
- `TransactionProvider` SPI; the manual shows a Spring example using
  `DataSourceTransactionManager` with `PROPAGATION_NESTED`.

### Mapping (chunk 04)

Source: https://www.jooq.org/doc/latest/manual/sql-execution/fetching/pojos/
- `fetchInto(Class)` / `into(Class)`.
- Order of strategies: **`@jakarta.persistence.Column` annotations are checked FIRST**
  (on fields, setters or getters); then best-match on mutable POJOs; then constructor
  mapping for immutable POJOs.
- Immutable POJO with no `@ConstructorProperties`: **projection order must match constructor
  argument order.** With `@ConstructorProperties({"title","id"})` order no longer matters and
  unmapped columns are ignored.
- Interfaces/abstract types → `java.lang.reflect.Proxy` over a `HashMap`.
- Reverse: `create.newRecord(BOOK, myPojo)` then `record.store()`.
- `RecordMapper` / `RecordMapperProvider` for custom mapping.

### MULTISET (chunk 04b) — the anti-N+1 headline

Source: https://www.jooq.org/doc/latest/manual/sql-building/column-expressions/multiset-value-constructor/
- Manual calls it *"one of jOOQ's and standard SQL's most powerful features"*.
- `multiset(select…).as("books")` nests a whole collection into one column of the parent row.
- Native on **Informix and Oracle**; emulated elsewhere — **PostgreSQL emulation is
  JSONB aggregation with array structures**; MySQL uses JSON merge functions; SQLite uses
  JSON group arrays; DB2/SQL Server/Teradata use XML; DuckDB/Snowflake use ARRAY.
  **Unsupported: Firebird, Sybase, Redshift.**
- `MULTISET_AGG` is the aggregate-function counterpart.
- `RecordMapper`s + ad-hoc converters (`convertFrom`) map nested records to DTO trees.

### Postgres specifics (chunk 06)

- **Window functions:** `rowNumber().over(orderBy(BOOK.LANGUAGE_ID))`,
  `rowNumber().over().partitionBy(BOOK.AUTHOR_ID).orderBy(BOOK.ID)`,
  `count().over(partitionBy(BOOK.AUTHOR_ID))`.
  Source: https://www.jooq.org/doc/latest/manual/sql-building/column-expressions/window-functions/
- **CTEs:** `name("t1").fields("f1","f2").as(select(val(1), val("a")))`; `DSLContext.with(…)`
  and `DSLContext.withRecursive(…)`.
  Sources: https://www.jooq.org/doc/latest/manual/sql-building/sql-statements/with-clause/
  and http://www.jooq.org/doc/latest/manual/sql-building/sql-statements/with-recursive-clause/
- **DISTINCT ON:** `create.select(BOOK.LANGUAGE_ID, BOOK.TITLE).distinctOn(BOOK.LANGUAGE_ID)
  .from(BOOK).orderBy(BOOK.LANGUAGE_ID, BOOK.TITLE)`. ⚠️ **jOOQ inverts the keyword order**
  deliberately — *"the order of keywords had to be inversed as the PostgreSQL syntax cannot
  be easily reproduced in jOOQ's internal DSL"*. `distinctOn` implicitly enforces DISTINCT.
  Source: https://www.jooq.org/doc/latest/manual/sql-building/sql-statements/select-statement/select-clause/select-clause-distinct-on/
- **JSONB:** `org.jooq.JSONB` / `SQLDataType.JSONB`; *"pre-processed, binary-stored JSON
  document… has no direct representation in JDBC"*. Attribute access via `->` or
  `jsonGetAttribute()` / `jsonbGetAttribute()`; the API is *"PostgreSQL inspired"*.
  Sources: https://www.jooq.org/doc/latest/manual/sql-building/data-types/built-in-data-types/data-type-jsonb/
  and https://www.jooq.org/doc/latest/manual/sql-building/column-expressions/json-functions/json-attribute-access/
- **Custom bindings** for types JDBC does not support (HSTORE, PostGIS): register an
  `org.jooq.Binding` as a forced type in the generator.
  Source: http://www.jooq.org/doc/latest/manual/code-generation/custom-data-type-bindings/

### Writes (chunk 05)

- `create.insertInto(AUTHOR, AUTHOR.ID, AUTHOR.LAST_NAME).values(3, "Koontz")
  .onDuplicateKeyUpdate().set(AUTHOR.LAST_NAME, "Koontz").execute()` — on PostgreSQL,
  Aurora Postgres, CockroachDB, YugabyteDB this renders `ON CONFLICT … DO UPDATE`.
  Emulated via MERGE on DB2/Exasol/Firebird/H2/Hana/HSQLDB/Oracle/Redshift/Snowflake/
  SQL Server/Sybase/Teradata. **Unsupported: ASE, Access, BigQuery, ClickHouse, Databricks,
  Informix, SQLDataWarehouse, Spanner, Trino, Vertica.**
  Source: https://www.jooq.org/doc/latest/manual/sql-building/sql-statements/insert-statement/insert-on-duplicate-key/
- `insertInto(...).values(...).returning().fetchOne()` returns an `AuthorRecord`
  (seen in the transaction-management manual page).

### Code generation (chunks 02 / 02b)

- Generated artefacts seen in the manual's own tutorial: a **Schema class** (e.g.
  `Library.java`), **table classes** in `<pkg>.tables`, **record classes** in
  `<pkg>.tables.records` (e.g. `AuthorRecord.java`). Generator class is
  `org.jooq.codegen.JavaGenerator`; config blocks are `<jdbc>`, `<generator>`
  (with `<database>` → `<inputSchema>`, `<includes>`, `<excludes>`) and `<target>`
  (`<packageName>`, `<directory>`).
  Source: https://www.jooq.org/doc/latest/manual/getting-started/tutorials/jooq-in-7-steps/jooq-in-7-steps-step3/
- `<generate/>` flags: `records` **defaults true**; `pojos` **defaults false**;
  `daos` implies `pojos`; `immutablePojos`; `interfaces` (+ `immutableInterfaces`,
  `serializableInterfaces`). DAOs can carry Spring `@Repository`/`@Autowired`.
  Sources: https://www.jooq.org/doc/latest/manual/code-generation/codegen-object-types/codegen-pojos/
  and https://www.jooq.org/doc/latest/manual/code-generation/codegen-object-types/codegen-interfaces/
- 🔴 **jOOQ's own Flyway tutorial**: flyway-maven-plugin and jooq-codegen-maven **both bind
  to `generate-sources`**, Flyway first — *"the jOOQ code generator relies on such migrations
  having been done **prior** to code generation"*. The tutorial uses **H2**, and explicitly
  says Testcontainers is a **third party** tool with a separate blog article.
  Source: http://www.jooq.org/doc/latest/manual/getting-started/tutorials/jooq-with-flyway/
- 🔴 **The Testcontainers route is the Testcontainers project's plugin, NOT jOOQ's**:
  `org.testcontainers:testcontainers-jooq-codegen-maven-plugin`, goal `generate`, phase
  `generate-sources`. Config elements `<database>` (`<type>POSTGRES</type>`,
  `<containerImage>`, `<username>`, `<password>`, `<databaseName>`), `<flyway>` and
  `<jooq><generator>…`. **Supported types: POSTGRES, MYSQL, MARIADB.** Migration engines:
  **Flyway (all documented properties) and Liquibase (essential properties)**.
  Source: https://github.com/testcontainers/testcontainers-jooq-codegen-maven-plugin
- Blog article jOOQ points at: https://blog.jooq.org/using-testcontainers-to-generate-jooq-code/

## Per-file table

| # | File | Lines | Gotchas | Qs | Status |
|---|---|---|---|---|---|
| 1 | `01-what-jooq-is.md` | 226 | 8 | 7 | ✅ |
| 2 | `01b-the-licence-question.md` | 224 | 6 | 8 | ✅ |
| 3 | `01c-the-dsl-is-a-tree.md` | 268 | 9 | 9 | ✅ |
| 4 | `02-code-generation.md` | 280 | 11 | 10 | ✅ |
| 5 | `02b-configuring-the-generator.md` | 284 | 11 | 10 | ✅ |
| 6 | `02c-shaping-the-generated-api.md` | 248 | 12 | 11 | ✅ |
| 7 | `02d-generating-from-migrations.md` | 221 | 11 | 10 | ✅ |
| 8 | `02e-generating-from-a-real-database.md` | 242 | 10 | 10 | ✅ |
| 9 | `02f-the-throwaway-container.md` | 251 | 12 | 12 | ✅ |
| 10 | `03-the-dsl.md` | 272 | 11 | 12 | ✅ |
| 11 | `03b-conditions-and-dynamic-sql.md` | 274 | 12 | 12 | ✅ |
| 12 | `03c-joins-and-aliasing.md` | 267 | 12 | 12 | ✅ |
| 13 | `03d-implicit-joins.md` | 207 | 11 | 12 | ✅ |
| 14 | `03e-fetching.md` | 230 | 13 | 13 | ✅ |
| 15 | `04-mapping-results.md` | 237 | 12 | 12 | ✅ |
| 16 | `04b-nested-collections-with-multiset.md` | 218 | 12 | 12 | ✅ |
| 17 | `04c-record-mappers-and-converters.md` | 234 | 12 | 12 | ✅ |
| 18 | `05-writes.md` | 233 | 12 | 12 | ✅ |
| 19 | `05b-updatable-records.md` | 194 | 12 | 12 | ✅ |
| 20 | `05c-optimistic-locking.md` | 195 | 12 | 12 | ✅ |
| 21 | `06-postgres-specifics.md` (window functions) | 224 | 12 | 12 | ✅ |
| 22 | `06b-ctes-and-distinct-on.md` | 219 | 12 | 12 | ✅ |
| 23 | `06c-jsonb-arrays-and-bindings.md` | 213 | 12 | 12 | ✅ |
| 24 | `07-transactions-and-spring.md` | 239 | 12 | 12 | ✅ |
| 25 | `07b-jooqs-transaction-api.md` | 205 | 12 | 12 | ✅ |

⚠️ **Chunk numbering deviates from `_plan.md`, deliberately (rule 1).** The planned
`01-what-jooq-is.md` came to 318 lines, so it was split on a concept boundary:
`01` = what it is / three parts / what the compiler catches; `01b` = the licence (kept the
planned filename, since it is the adoption gate and belongs early); `01c` = the DSL as a
tree, not-an-ORM, and the `JdbcClient` comparison table.

## RESUME HERE

Next file: **`08-jooq-vs-jpa.md`** (`sidebar_position: 26`).
Remaining, in order: `08-jooq-vs-jpa.md`, `08b-using-both.md`, `09-the-cost.md`.
**Only 4 dangling forward links left in the topic**, all to `08-jooq-vs-jpa.md` and
`09-the-cost.md` — they close when those two land.

⚠️ **`06-postgres-specifics.md` keeps its filename (three inbound links) but its
`sidebar_label` is "06 · Window functions"** — the PostgreSQL group is 06 + 06b + 06c. Two
inbound link LABELS were repointed accordingly: `01c` now says "06 · Window functions", and
`03c`'s CTE sentence was repointed to **`06b-ctes-and-distinct-on.md`**, which is what that
sentence was actually about.

⚠️ **Plan deviation, fourth round (the `03` group).** The planned `03-the-dsl.md` +
`03b-joins-and-aliasing.md` became FIVE files: `03` (DSL/DSLContext/Configuration, the query
anatomy, `Record1`–`Record22`, `selectFrom`), `03b` (conditions, dynamic SQL, `noCondition`,
plain SQL templating), `03c` (explicit joins, the four predicate forms, aliasing, derived
tables), `03d` (implicit path joins), `03e` (fetching, the return-type family). The planned
filename `03b-conditions-and-fetching.md` was **never created** and nothing links to it.

⚠️ **Plan deviation, third round:** the planned single migrations chunk became THREE files —
`02d` (route 1, `DDLDatabase`, no server), `02e` (route 2, migrate-then-generate against a
database you provide; the Maven POM-declaration-order trap), `02f` (route 3, the
Testcontainers codegen plugin; the three-route comparison table). The first draft of `02e`
came in at **341 lines** and was split on the boundary the page already had — "who provides
the empty database" — with every gotcha and question distributed to the half it is about,
none dropped.

🔴 **FILENAMES ALREADY FORWARD-LINKED — these are now fixed and must be used verbatim:**
`02d-generating-from-migrations.md`, `04-mapping-results.md`, `05-writes.md`,
`06-postgres-specifics.md`, `06c-jsonb-arrays-and-bindings.md`, `08-jooq-vs-jpa.md`,
`09-the-cost.md`, `02b-configuring-the-generator.md`, `02c-shaping-the-generated-api.md`.

⚠️ **Plan deviation, second round:** `02-code-generation.md` split three ways —
02 = what the generator IS and emits; 02b = how it is RUN and CONFIGURED (maven/gradle,
database matching, target, strategy); 02c = forced types + the `<generate/>` flags.
The planned migrations chunk is therefore **02d**, not 02b.

🔴 **FOOTER MARKER — coordinator correction 2026-08-26.** `<!--FOOTER-->` is invalid MDX and
broke the GitHub Pages build. **Every page ends with `{/* FOOTER */}`.** Never write a bare
`<!-- ... -->` anywhere outside a fenced code block.

## Traps found

- 🔴 **A WRONG forward link found and repaired 2026-08-26:** `01-what-jooq-is.md` linked to
  `02b-generating-from-migrations.md` — the *plan's* filename. `02b` is now
  `02b-configuring-the-generator.md`, so that link could never resolve. Repointed to
  `02d-generating-from-migrations.md`. **Every future rename must be followed by a grep for
  inbound links to the old name.**

- The plan's version guess (3.20.x) was wrong → 3.21.7.
- OSS edition needs **Java 21+** — do not write "jOOQ runs on Java 8" as a general claim.
- `<!--FOOTER-->` is invalid MDX → build failure. Use `{/* FOOTER */}`. Retrofitted to all
  files on disk 2026-08-26.

## Extra claims verified this run (not in the original research pass)

Source: https://www.jooq.org/doc/latest/manual/code-generation/codegen-object-types/codegen-records/
- Every table and view generates a `TableRecord` implementation *"or `org.jooq.UpdatableRecord`
  if there's a primary key"*.
- `<records/>` — *"Allows for turning on records generation: default true"*.
- `recordsImplementingRecordN` — *"Starting from jOOQ 3.19, the default for this flag is
  `false`"*; the manual warns it *"may impact compilation speeds"*.

Source: https://www.jooq.org/doc/latest/manual/code-generation/codegen-object-types/codegen-pojos/
- `<pojos/>` default **false**. Generated POJO = private field + *"a getter and a setter"* per
  column, with optional JPA annotations and optional JSR-303 validation annotations.
- `immutablePojos` — *"final members and no setters"*, all members via the constructor.
- 🔴 `pojosAsJavaRecordClasses` — with `JavaGenerator`, generates POJOs as *"(immutable)
  Java 16 record types"*. (This is the JDK-25-era answer to hand-written DTOs.)
- `pojosEqualsAndHashCode` — *"purely value-based"* equality; `pojosToString`.

Source: http://www.jooq.org/doc/latest/manual/code-generation/codegen-configuration/
- Top-level config elements: `<jdbc>`, `<generator>`, `<logging>`, `<onError>`.
  `<generator>` → `<name>`, `<database>`, `<generate>`, `<target>` (+ `<strategy>`).
- `<database>` → `<name>` (*"named org.jooq.meta.[database].[database]Database"*),
  `<includes>`, `<excludes>`, `<inputSchema>`, `<forcedTypes>`, `<schemata>`.
- 🔴 `<excludes>` — *"Excludes match before includes, i.e. excludes have a higher priority"*.
- `<target>` → `<packageName>` (*"The destination package of your generated classes"*),
  `<directory>`, `<encoding>`.

Source: https://www.jooq.org/doc/latest/manual/code-generation/codegen-gradle/
- 🔴 Official Gradle plugin id **`org.jooq.jooq-codegen-gradle`**, *"Starting with jOOQ 3.19,
  there's out of the box gradle support for jOOQ's code generator"*. (Before 3.19 the community
  `nu.studer.jooq` plugin was the answer — still works, not jOOQ's.)

Source: .../codegen-database-forced-types/codegen-database-forced-types-matching/
- `<forcedType>` children: `<priority>`, `<objectType>` (ATTRIBUTE|COLUMN|ELEMENT|PARAMETER|
  SEQUENCE|ALL), `<nullability>` (NULL|NOT_NULL|ALL), `<includeExpression>`/`<excludeExpression>`,
  `<includeTypes>`/`<excludeTypes>`, `<sql>`, `<name>`, `<userType>`, `<converter>`, `<binding>`.
- Verbatim example 1: `<name>BOOLEAN</name><includeExpression>.*\.IS_VALID</includeExpression>
  <includeTypes>.*</includeTypes><nullability>ALL</nullability><objectType>ALL</objectType>`.
- Verbatim example 2: `<userType>java.lang.Boolean</userType>
  <converter>com.example.YNBooleanConverter</converter><sql>SELECT owner || '.' || table_name
  || '.' || column_name FROM all_tab_cols WHERE data_default IN ('Y','N')</sql>`.

## Claims verified this run (03 · The DSL) — none of these were in the research pass

Source: https://www.jooq.org/doc/latest/manual/sql-building/dsl/
- `org.jooq.impl.DSL` is *"the main class from where you will create all jOOQ objects"* and a
  *"static factory for table expressions, column expressions (or 'fields'), conditional
  expressions and many other QueryParts"*. The manual recommends
  `import static org.jooq.impl.DSL.*;`.

Source: https://www.jooq.org/doc/latest/manual/sql-building/dsl-context/
- *"DSLContext references a `org.jooq.Configuration`, an object that configures jOOQ's
  behaviour when executing queries."*
- Overloads shown: `DSL.using(configuration)` and `DSL.using(connection, dialect)`; the
  ad-hoc overloads build a `Configuration` for you.
- A `Configuration` holds: `SQLDialect`, `Settings`, `ExecuteListenerProvider` /
  `ParseListenerProvider` / `RecordListenerProvider`, `RecordMapperProvider`,
  `FormattingProvider`, JDBC access (`Connection` / `DataSource` / `ConnectionProvider`) and
  R2DBC access (`Connection` / `ConnectionFactory`).
- 🔴 **Connection lifecycle, quoted:** with a `DataSource`, *"jOOQ will internally fetch new
  Connections from your DataSource, conveniently closing them again after query execution"*;
  with a single `Connection` it *"will be re-used for the whole lifecycle of your
  Configuration"*.

Source: https://www.jooq.org/doc/latest/manual/sql-building/queryparts/
- *"A `org.jooq.Query` and all its contained objects is a `org.jooq.QueryPart`."* Rendering
  and binding both go through `accept(Context)`.

Source: https://www.jooq.org/doc/latest/manual/sql-execution/fetching/
- The `Record1 to Record22` section is titled *"Type safe records with degree less than 22"*.
- The documented fetch family: `Result<R> fetch()`, `R fetchOne()`, `R fetchSingle()`,
  `Optional<R> fetchOptional()`, `Cursor<R> fetchLazy()`, `Stream<R> stream()`,
  `List<Result<Record>> fetchMany()`. **Reserved for `03b`.**
- ⚠️ Chapter subsection list (useful for 03b/04): Record vs. TableRecord · Record1 to Record22
  · Arrays, Maps and Lists · ResultQuery as Iterable · RecordMapper · POJOs ·
  RecordMapperProvider · Ad-hoc Converter · ConverterProvider · Lazy fetching · Lazy fetching
  with Streams · Many fetching · Later fetching · Reactive Fetching · ResultSet fetching ·
  Auto data type conversion · Custom data type conversion · Data type lookups ·
  Context Converter.

⚠️ **404s — do NOT retry these URLs:** `/manual/sql-execution/dsl-context/` and
`/manual/sql-execution/fetching/record1-to-record22/`. The DSLContext page lives under
**sql-building**, not sql-execution.

## Claims verified this run (03b / 03c / 03d)

Source: https://www.jooq.org/doc/latest/manual/sql-building/table-expressions/joined-tables/
- jOOQ organises joins as **CROSS JOIN** (cross product), **INNER JOIN** (filtered on matches),
  **OUTER JOIN** (plus unmatched rows), **SEMI JOIN** (*"checks for row existence"* via
  `EXISTS`/`IN`) and **ANTI JOIN** (non-existence via `NOT EXISTS`/`NOT IN`).
- Predicate forms: `ON` (explicit); `ON KEY` — *"explicitly or implicitly based on a `FOREIGN
  KEY`"*; `USING` — *"implicitly based on an explicit set of shared column names"*; `NATURAL`
  — *"based on an implicit set of shared column names"*.
- `APPLY` / `LATERAL`: *"ordering the join tree from left to right, allowing the right side to
  access rows from the left side"*. `PARTITION BY` on `OUTER JOIN` to *"fill the gaps in a
  report"*.

Source: .../sql-building/table-expressions/aliased-tables/aliased-generated-tables/
- 🔴 *"calling `as()` on generated tables returns an object of the same type as the table"*, so
  *"the resulting object can be used to dereference fields from the aliased table"*.
- *"quite powerful in terms of having your Java compiler check the syntax of your SQL
  statements. If you remove a column from a table, dereferencing that column from that table
  alias will cause compilation errors."*
- Verbatim example used on the page: `Author a = AUTHOR.as("a"); Book b = BOOK.as("b");` then
  `select().from(a).join(b).on(a.ID.eq(b.AUTHOR_ID))…`.

Source: .../sql-building/sql-statements/select-statement/implicit-join/
- 🔴 *"The navigation method names are: The parent table name (or child table name,
  respectively), if there is only one foreign key between child table and parent table."*
- 🔴 Join type is decided by **nullability**: INNER JOIN for to-one segments with a
  **non-nullable** parent, LEFT JOIN for to-one segments with a **nullable** parent, LEFT JOIN
  for implicit **to-many** paths not declared in `FROM`. **Overridable through `Settings`.**
- 🔴 *"From jOOQ 3.11 onwards, this syntax is supported for to-one relationship navigation, and
  from jOOQ 3.19 also for to-many relationship navigation."* (Pre-3.19 advice online is stale.)
- Limitations: *"it is not possible to write things like `FROM book IMPLICIT JOIN
  book.author`"*; and `VisitListener` SPI implementations **cannot observe** implicitly joined
  tables, because they are added after SQL generation completes.
- Syntax examples on the page: `BOOK.author().FIRST_NAME`, `BOOK.language().CD`.

⚠️ **404 — do not retry:** `/manual/sql-building/aliased-tables-and-fields/`. Aliasing lives
under `sql-building/table-expressions/aliased-tables/`.

## Claims verified this run (03e · Fetching)

Source: https://www.jooq.org/javadoc/latest/org.jooq/org/jooq/ResultQuery.html
- 🔴 The single-row family, exactly: `fetchOne()` → record or **`null`** on zero rows, throws
  **`TooManyRowsException`** on >1. `fetchSingle()` → throws **`NoDataFoundException`** on zero,
  `TooManyRowsException` on >1. `fetchOptional()` → empty `Optional` on zero,
  `TooManyRowsException` on >1. `fetchAny()` → record or `null`, **no exception on >1**.
- `fetch()` *"Execute the query and return the generated result"* — eagerly loads the whole
  JDBC `ResultSet` into memory. `fetchMany()` — *"Execute a query, possibly returning several
  result sets"*, returns `Results`. `fetchLazy()` — *"Execute the query and 'lazily' return the
  generated result"*, returns `Cursor<R>`. `fetchInto(Class)` — *"Map resulting records onto a
  custom type"*, returns `List<E>`. `fetchMap` / `fetchGroups` with single and composite keys.

Source: https://www.jooq.org/doc/latest/manual/sql-execution/fetching/lazy-fetching/
- 🔴 *"As a `org.jooq.Cursor` holds an internal reference to an open `java.sql.ResultSet`, it
  may need to be closed at the end of iteration."* It auto-closes only if fully scrolled, and
  **relying on that is discouraged**; the documented shape is try-with-resources.
- 🔴 *"your underlying JDBC driver may still"* load eagerly — the lever is
  `ResultQuery.fetchSize(int)`. (The pgJDBC preconditions belong to topic 01, which is linked
  rather than re-derived.)

## Claims verified this run (04b / 04c)

Source: https://www.jooq.org/doc/latest/manual/sql-execution/fetching/recordmapper/
- `org.jooq.RecordMapper` — *"you might want to write callbacks that map records from your
  select statement results in order to do some processing"*.
- 🔴 `org.jooq.Records` is named as *"an alternative utility"*: *"Use Java 16 record types as
  simple DTOs… `fetch(Records.mapping(Book::new))`"*. **Compile-time checked**, unlike
  `fetchInto(Class)`.

Source: https://www.jooq.org/doc/latest/manual/sql-execution/fetching/ad-hoc-converter/
- Definition: attach a converter *"to some column, just for a single query or a few local
  queries"*.
- `convertFrom` converts *"from the database"*; `convertTo` converts *"to the database"*.
  Verbatim examples on the page:
  `LANGUAGE.CD.convertFrom(Language.class, Language::valueOf)` in a select, and
  `LANGUAGE.CD.convertTo(Language.class, Language::name)` in an insert.
- 🔴 The MULTISET idiom, verbatim from the page:
  `multiset(...).as("books").convertFrom(r -> r.map(Records.mapping(Book::new)))`, described as
  providing *"strong type-checking compared to reflective mapping alternatives"*.

## Claims verified this run (05 / 05b / 05c)

Source: https://www.jooq.org/doc/latest/manual/sql-execution/batch-execution/
- Two modes: several distinct queries in one batch, and one query template with many bind sets.
  Methods named: `batch()`, `batch(Query)`, `bind()`, `batchStore()`, `batchInsert()`,
  `batchUpdate()`, `batchDelete()`.
- 🔴 Verbatim caveat: *"When creating a batch execution with a single query and multiple bind
  values, you will still have to provide jOOQ with dummy bind values for the original query…
  For subsequent calls to `bind()`, there will be no type safety provided by jOOQ."*
  **This is the one place jOOQ's compile-time guarantee is explicitly off.**

Source: https://www.jooq.org/doc/latest/manual/sql-execution/crud-with-updatablerecords/
- *"jOOQ facilitates CRUD using a specific API involving `org.jooq.UpdatableRecord` types"*.
- 🔴 `store()` chooses `INSERT` vs `UPDATE` **by the record's origin**: fetched-then-modified →
  UPDATE; created in memory → INSERT. `insert()`, `update()`, `delete()`, `refresh()` are
  explicit. Changed/dirty flags decide which columns appear in the statement.

Source: .../crud-with-updatablerecords/optimistic-locking/
- 🔴 Flag is **`executeWithOptimisticLocking`** in `Settings`. *"INSERT statements are not
  affected by this Setting flag"*.
- 🔴 **Default mechanism is NOT lock-free:** *"jOOQ will run a `SELECT .. FOR UPDATE` statement,
  pessimistically locking the record for the subsequent UPDATE / DELETE"*, and *"The data
  fetched with the previous SELECT will be compared against the data in the record being stored
  or deleted"*. This is the most counter-intuitive fact on topic 13 and the page says so.
- With a **TIMESTAMP** field configured in codegen, jOOQ *"adds a WHERE-clause to the UPDATE or
  DELETE statement, checking for TIMESTAMP's integrity"* instead of the SELECT FOR UPDATE.
  With a **VERSION** field, a numeric counter *"incremented by jOOQ upon store() calls"*.
- 🔴 Exception, verbatim: *"An `org.jooq.exception.DataChangedException` is thrown if the record
  had been modified or deleted in the meantime, or if optimistic locking is performed on an
  unversioned record that hasn't been fetched from the database."* — **two very different causes
  behind one exception**, which is what makes a blind retry loop spin.

## Claims verified this run (06 / 06b / 06c)

Source: .../sql-building/column-expressions/window-functions/
- A window function is *"an aggregate or ranking value calculated over a subset of data (the
  window) relative to the projected row"*.
- Documented functions: `ROW_NUMBER`, `RANK`, `DENSE_RANK`, `PERCENT_RANK`, `CUME_DIST`,
  `NTILE`, `LEAD`, `LAG`, `FIRST_VALUE`, `LAST_VALUE`, `NTH_VALUE`, `RATIO_TO_REPORT`, plus any
  aggregate function used with `.over(...)`.
- Frames: **`ROWS`, `RANGE` and `GROUPS`** clauses plus an **`EXCLUDE`** clause. Example shown:
  `ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING`. Named windows via *"the `WINDOW` clause of the
  `SELECT` statement"*.
- ⚠️ The default-frame fact (`RANGE UNBOUNDED PRECEDING → CURRENT ROW` when the window has an
  `ORDER BY`) is **SQL's rule**, written as such on the page rather than attributed to jOOQ.

Source: .../column-expressions/array-value-constructor/
- 🔴 *"The `ARRAY` value constructor allows for collecting the results of a single-column, non
  scalar subquery into a single nested collection value with `ARRAY` data type semantics"*.
  DSL method `array()`. Verbatim example:
  `array(selectDistinct(BOOK.language().CD).from(BOOK).where(BOOK.AUTHOR_ID.eq(AUTHOR.ID))).as("books")`.
- ⚠️ **ARRAY is NOT in the built-in data types list** (54 types, checked) — it is a modifier on
  another type. `/manual/sql-building/data-types/built-in-data-types/data-type-arrays/` is a
  **404 — do not retry**.

Source: .../column-expressions/json-functions/
- Functions documented: `JSON_ARRAY`, `JSON_ARRAY_LENGTH`, JSON_ARRAY from query,
  `JSON_GET_ATTRIBUTE`, `JSON_GET_ATTRIBUTE_AS_TEXT`, `JSON_GET_ELEMENT`,
  `JSON_GET_ELEMENT_AS_TEXT`, `JSON_INSERT`, `JSON_KEY_EXISTS`, `JSON_KEYS`, `JSON_OBJECT`,
  `JSON_QUERY`, `JSON_REMOVE`, `JSON_REPLACE`, `JSON_SET`, `JSON_VALUE`.
- *"Most functions are overloaded with a `JSON` and `JSONB` variant."*
- 🔴 `->` = `JSON_GET_ATTRIBUTE` / `JSON_GET_ELEMENT`; `->>` = the `_AS_TEXT` variants.

⚠️ **Deliberately NOT claimed** (rule 8): whether jOOQ's DSL exposes PostgreSQL 12's explicit
`MATERIALIZED` / `NOT MATERIALIZED` CTE keywords. `06b` says it was not confirmed and points at
plain SQL templating instead of inventing a method name.

## Claims verified this run (07 / 07b)

Confirms the brief's "verify rather than assume" item about Boot 4's module restructuring:
**`spring-boot-starter-jooq` still exists**; the auto-configuration moved to module
`spring-boot-jooq`, package `org.springframework.boot.jooq.autoconfigure`. Bean list and
conditions as already recorded in the research pass above — re-read, unchanged.

Source: https://www.jooq.org/doc/latest/manual/sql-execution/transaction-management/
- `dsl.transaction(TransactionalRunnable)` / `dsl.transactionResult(TransactionalCallable)`;
  the lambda gets a **derived `Configuration`** and the manual says to *avoid using the scope
  from outside the transaction* — use `trx.dsl()`.
- 🔴 **Any uncaught exception, checked or unchecked, rolls back.** That is a real divergence
  from Spring's default rule (`RuntimeException`/`Error` only), and moving code between the two
  mechanisms changes behaviour silently. Written up in `07b`.
- Nested transactions use JDBC **savepoints** via `DefaultTransactionProvider`;
  `TransactionProvider` is an SPI.
- *"When using Spring Boot, its jOOQ starter already pre-configures the correct Spring
  transaction aware data source, so Spring JDBC transactions will work out of the box with
  jOOQ."*

🔴 **The load-bearing bean is `TransactionAwareDataSourceProxy`**, wrapped around the
`DataSource` by the auto-configured `DataSourceConnectionProvider`. Every bean in the
auto-configuration is `@ConditionalOnMissingBean`, so **defining your own
`org.jooq.Configuration` bean silently removes it** and transactions stop spanning statements.
That is the sharpest practical finding on topic 13's Spring side.
