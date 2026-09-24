---
name: progress-java-p10-t05-sqlfirst
description: devbible Java Phase 10 Topic 05 - SQL-first access (JdbcTemplate / JdbcClient) - fork progress, chunk plan, load-bearing claims and sources
metadata:
  type: project
---

# Java P10 · Topic 05 · SQL-first access (`JdbcTemplate` / `JdbcClient`)

Directory: `docs/java/pages/phase-10-data-access/05-sql-first-access/`
Tier: **Understand** (`t-understand`). Coordinator writes `README.md` + all footers.
Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Hibernate ORM 7.4.1 ·
Spring Data JPA 4.1.0 · HikariCP 7.0.2 · PostgreSQL 18 · pgJDBC 42.7.x.

## Chunk plan (revise as material demands; letter suffixes on split)

| # | File | Status |
|---|---|---|
| 01 | 01-why-sql-first-exists.md | ✅ 212 |
| 01b | 01b-the-three-apis.md | ✅ 143 |
| 02 | 02-jdbctemplate.md | ✅ 294 |
| 02b | 02b-settings-and-logging.md | ✅ 121 |
| 03 | 03-rowmapper.md | ✅ 292 |
| 03b | 03b-the-fan-out-problem.md | ✅ 208 |
| 03c | 03c-two-queries-and-limit.md | ✅ 160 |
| 03d | 03d-automatic-mappers.md | ✅ 293 |
| 04 | 04-jdbcclient.md | ✅ 295 |
| 04b | 04b-the-result-specs.md | ✅ 257 |
| 05 | 05-named-parameters.md | ✅ 279 |
| 05b | 05b-in-lists-and-the-statement-cache.md | ✅ 243 |
| 06 | 06-the-exception-hierarchy.md | ✅ 254 |
| 06b | 06b-the-translator-chain.md | ✅ 280 |
| 06c | 06c-what-to-catch-on-postgresql.md | ✅ 225 |
| 07 | 07-queryforobject-and-empty.md | ✅ 256 |
| 08 | 08-writes-and-generated-keys.md | ✅ 274 |
| 08b | 08b-batches-and-bulk-writes.md | ✅ 234 |
| 09 | 09-transactions-and-the-connection.md | ✅ 239 |
| 10 | 10-when-sql-first-beats-an-entity.md | ✅ 269 |
| 10b | 10b-what-you-give-up.md | ✅ 213 |
| 11 | 11-mixing-both.md | ⏳ planned |
| 12 | 12-testing-and-the-shape-of-a-repository.md | ⏳ planned |

## Files written

| File | Lines | Gotchas | Questions |
|---|---|---|---|
| 01-why-sql-first-exists.md | 212 | 4 | 4 |
| 01b-the-three-apis.md | 143 | 2 | 3 |
| 02-jdbctemplate.md | 294 | 5 | 5 |
| 02b-settings-and-logging.md | 121 | 3 | 2 |
| 03-rowmapper.md | 292 | 5 | 6 |
| 03b-the-fan-out-problem.md | 208 | 6 | 3 |
| 03c-two-queries-and-limit.md | 160 | 2 | 3 |
| 03d-automatic-mappers.md | 293 | 6 | 7 |
| 04-jdbcclient.md | 295 | 7 | 6 |
| 04b-the-result-specs.md | 257 | 7 | 6 |
| 05-named-parameters.md | 279 | 8 | 7 |
| 05b-in-lists-and-the-statement-cache.md | 243 | 7 | 6 |
| 06-the-exception-hierarchy.md | 254 | 6 | 7 |
| 06b-the-translator-chain.md | 280 | 6 | 6 |
| 06c-what-to-catch-on-postgresql.md | 225 | 7 | 6 |
| 07-queryforobject-and-empty.md | 256 | 8 | 7 |
| 08-writes-and-generated-keys.md | 274 | 7 | 7 |
| 08b-batches-and-bulk-writes.md | 234 | 7 | 6 |
| 09-transactions-and-the-connection.md | 239 | 7 | 6 |
| 10-when-sql-first-beats-an-entity.md | 269 | 6 | 6 |
| 10b-what-you-give-up.md | 213 | 6 | 6 |

## Load-bearing claims + sources

- **Spring's who-does-what table** (Spring opens connection / prepares+runs statement /
  loops results / processes exception / handles transactions / closes everything; YOU
  define connection params, specify SQL, declare+provide parameters, do work per row) —
  Spring Framework 7.0 ref, `data-access/jdbc.html`.
- **`JdbcTemplate` javadoc**: "This is the central delegate in the JDBC core package";
  "An instance of this template class is thread-safe once configured."
  Ref adds: "stateful, in that it maintains a reference to a DataSource, but this state
  is not conversational state." — `data-access/jdbc/core.html`.
- **`JdbcClient` @since 6.1**, javadoc: "A fluent JdbcClient with common JDBC query and
  update operations, supporting JDBC-style positional as well as Spring-style named
  parameters with a convenient unified facade for JDBC PreparedStatement execution."
  Delegates to `JdbcTemplate` and `NamedParameterJdbcTemplate`; points at
  `SimpleJdbcInsert`/`SimpleJdbcCall` for batch inserts and stored procs.
  `JdbcClient.create(NamedParameterJdbcOperations, ConversionService)` is **@since 7.0**.
- **`StatementSpec` 7.0 additions**: `withFetchSize(int)`, `withMaxRows(int)`,
  `withQueryTimeout(int)` — all **@since 7.0**. Also `param(Object)`, `param(int,Object)`,
  `param(int,Object,int)`, `param(String,Object)`, `param(String,Object,int)`,
  `params(Object...)`, `params(List)`, `params(Map)`, `paramSource(Object)`,
  `paramSource(SqlParameterSource)`, `query()`, `query(Class)`, `query(RowMapper)`,
  `query(RowCallbackHandler)`, `query(ResultSetExtractor)`, `update()`,
  `update(KeyHolder)`, `update(KeyHolder, String...)`.
- **`MappedQuerySpec`**: `stream()`, `list()`, `set()`, `single()` (enforces non-null as
  of 6.2), `optional()`. **`ResultQuerySpec`**: `rowSet()`, `listOfRows()`, `singleRow()`,
  `singleColumn()`, `singleValue()` (non-null as of 6.2), `optionalValue()` (@since 6.2).
- **`queryForObject` @throws**: "IncorrectResultSizeDataAccessException if the query does
  not return exactly one row" — `JdbcOperations` source javadoc, verbatim.
- **`DataAccessUtils.requiredSingleResult`**: `EmptyResultDataAccessException(1)` when the
  collection is empty; `IncorrectResultSizeDataAccessException(1, results.size())` when
  size > 1. `singleResult` returns null on 0. `optionalResult` → `Optional.empty()` on 0.
- **`JdbcTemplate` fetchSize/maxRows/queryTimeout default = `-1`** = "use the JDBC
  driver's default configuration". Source javadoc.
- **Deprecated since 5.3, still present in 7.0**: `query(String, Object[], RowMapper)`,
  `query(String, Object[], ResultSetExtractor)`, `query(String, Object[],
  RowCallbackHandler)`, `queryForObject(String, Object[], RowMapper)`,
  `queryForObject(String, Object[], Class)`, `queryForList(String, Object[], Class)`.
- **Logging**: "All SQL issued by this class is logged at the DEBUG level under the
  category corresponding to the fully qualified class name of the template instance."
  (parameters are `StatementCreatorUtils` at TRACE).
- **`DataSourceUtils.getConnection`** javadoc: "Is aware of a corresponding Connection
  bound to the current thread… Will bind a Connection to the thread if transaction
  synchronization is active." `releaseConnection`: "Close the given Connection… if it is
  not managed externally (that is, not bound to the thread)." `applyTimeout`: "the
  specified timeout - overridden by the current transaction timeout, if any".
- **`SimplePropertyRowMapper`** @since 6.1 — precedence "constructor arguments take
  precedence over property setter methods which in turn take precedence over direct
  field mappings"; javadoc: "similar to SimplePropertySqlParameterSource and is
  similarly **used for JdbcClient**". 🔴 So `JdbcClient.query(Class)` maps with
  `SimplePropertyRowMapper`, NOT `DataClassRowMapper`/`BeanPropertyRowMapper`.
- **`SingleColumnRowMapper`** @since 1.2 — "Expects to operate on a ResultSet that just
  contains a single column"; >1 column → `IncorrectResultSetColumnCountException`.
- **`RowMapper`**: "should not call next() on the ResultSet". **`ResultSetExtractor`**:
  "Implementations should not close this: it will be closed by the calling JdbcTemplate";
  "typically stateless and thus reusable, as long as it doesn't … keep result state
  within the object". **`RowCallbackHandler`**: "typically stateful: it keeps the result
  state within the object" (`RowCountCallbackHandler` is the shipped example).
- **`RowMapperResultSetExtractor`** source: `int rowNum = 0; while (rs.next())
  results.add(rowMapper.mapRow(rs, rowNum++));` → **rowNum is 0-based** and **nulls are
  added to the list unfiltered**.
- **`DataClassRowMapper`** @since 5.3: mapped class "must be a top-level class or static
  nested class"; data class = "Java records, Kotlin data classes, and any class which has
  a constructor with named parameters"; **constructor arguments take precedence over
  property setter methods**; extends `BeanPropertyRowMapper`; "designed to provide
  convenience rather than high performance".
- **`BeanPropertyRowMapper`** @since 2.5: needs default/no-arg constructor; matches column
  name to setter "either directly or by transforming a name separating the parts with
  underscores to the same name using camel case"; NULL into a primitive →
  `TypeMismatchException` unless `primitivesDefaultedForNullValue=true`;
  `checkFullyPopulated` default false; default `DefaultConversionService` (@since 4.3).
- **IN list expansion**: `NamedParameterJdbcTemplate` "takes the approach of dynamic SQL
  generation"; ref warns "The JDBC standard does not guarantee that you can use more than
  100 values for an IN expression list… Oracle's limit is 1000."
  — `data-access/jdbc/parameter-handling.html`.
- **Exception translation**: default translator as of 6.0 is `SQLExceptionSubclassTranslator`
  ("detecting JDBC 4 SQLException subclasses with a few extra checks, and with a fallback
  to SQLState introspection through SQLStateSQLExceptionTranslator").
  `SQLErrorCodeSQLExceptionTranslator` "is used by default when a file named
  sql-error-codes.xml is present in the root of the classpath".
- **`SQLStateSQLExceptionTranslator` class-code sets** (source): BAD_SQL_GRAMMAR 07,21,2A,37,42,65 ·
  DATA_INTEGRITY_VIOLATION 01,02,22,23,27,44 · PESSIMISTIC_LOCKING_FAILURE 40,61 ·
  DATA_ACCESS_RESOURCE_FAILURE 08,53,54,57,58 · TRANSIENT_DATA_ACCESS_RESOURCE JW,JZ,S1.
- **`SQLExceptionSubclassTranslator` mapping** (source): SQLTransientConnectionException →
  TransientDataAccessResourceException · SQLTransactionRollbackException →
  CannotAcquireLockException / PessimisticLockingFailureException · SQLTimeoutException →
  QueryTimeoutException · SQLNonTransientConnectionException →
  DataAccessResourceFailureException · SQLDataException → DataIntegrityViolationException ·
  SQLIntegrityConstraintViolationException → DuplicateKeyException /
  DataIntegrityViolationException · SQLInvalidAuthorizationSpecException →
  PermissionDeniedDataAccessException · SQLSyntaxErrorException → BadSqlGrammarException ·
  SQLFeatureNotSupportedException → InvalidDataAccessApiUsageException ·
  SQLRecoverableException → RecoverableDataAccessException.
- **`DefaultJdbcClient` source**: mixing parameter styles throws with the messages
  `"Configure either named or indexed parameters, not both"` and `"Configure either
  individual named parameters or a SqlParameterSource, not both"`. `query(Class)`
  branches on `BeanUtils.isSimpleProperty(mappedClass)` →
  `new SingleColumnRowMapper<>(mappedClass, conversionService)` else
  `new SimplePropertyRowMapper<>(mappedClass, conversionService)`. `StatementSpec` is
  **mutable** — every `param()` mutates and returns `this`.
- **`queryForStream` javadoc**: "the result Stream, containing mapped objects, needing to
  be closed once fully processed (for example, through a try-with-resources clause)".
- **`NamedParameterUtils` source**: `START_SKIP = {"'", "\"", "--", "/*", "`"}`,
  `STOP_SKIP = {"'", "\"", "\n", "*/", "`"}` — 🔴 **dollar-quoting `$$…$$` is NOT in the
  skip list**. Explicit `::` cast skip with the source comment
  `// Postgres-style "::" casting operator should be skipped`.
  `PARAMETER_SEPARATORS = "\"':&,;()|=+-*%/\\<>^"` plus whitespace. A duplicate name
  expands to two `?` but is only asked of the parameter source **once** (tracked in a
  `Set<String> namedParameters`). `substituteNamedParameters` expands an `Iterable` to
  one `?` per element joined by `", "`, and an `Object[]` element to a `(?, ?)` tuple.
  🔴 An **empty** Iterable therefore emits `in ()` — a syntax error.
- **Boot 4.1**: `JdbcTemplate` + `NamedParameterJdbcTemplate` auto-configured; `JdbcClient`
  auto-configured "based on the presence of a NamedParameterJdbcTemplate"; "Any
  customization using spring.jdbc.template.* properties is applied to the client as well."
- **Jakarta Persistence 3.2 `FlushModeType.AUTO`**: flushing "to occur at query
  execution"; the provider ensures updates that could affect query results are visible
  **to the query processing** — i.e. to queries it runs, which a `JdbcTemplate` query is
  not. This is the flush-ordering trap for chunk 11.

- **`JdbcAccessor.getExceptionTranslator()`** source: if
  `SQLErrorCodeSQLExceptionTranslator.hasUserProvidedErrorCodesFile()` → that translator
  with the DataSource; **else `SQLExceptionSubclassTranslator`**. So dropping a
  `sql-error-codes.xml` on the classpath switches the WHOLE application.
- 🔴 **`SQLStateSQLExceptionTranslator.indicatesDuplicateKey`** source, verbatim:
  `return ("23505".equals(sqlState) || ("23000".equals(sqlState) &&
  DUPLICATE_KEY_ERROR_CODES.contains(errorCode)));` — so **PostgreSQL DOES get
  `DuplicateKeyException` for 23505** despite `getErrorCode()==0`. Also an explicit
  `57014` → query timeout check, and `BatchUpdateException` unwrapping.
- 🔴 **Classes absent from every Spring set → `UncategorizedSQLException` on PostgreSQL**:
  `55P03` lock_not_available (class 55 — `FOR UPDATE NOWAIT`!), `25P02`
  in_failed_sql_transaction (class 25), `0A000` feature_not_supported (class 0A).
- **`PersistenceExceptionTranslationPostProcessor`** javadoc: applies to `@Repository`
  beans via `PersistenceExceptionTranslationAdvisor`, "Autodetects beans that implement
  the PersistenceExceptionTranslator interface"; "All of Spring's applicable resource
  factories (for example, LocalContainerEntityManagerFactoryBean) implement the
  PersistenceExceptionTranslator interface out of the box." 🔴 Deduction stated on the
  page: this is the **ORM** mechanism; `JdbcTemplate` translates inside itself, so
  `@Repository` adds nothing to a JdbcTemplate DAO's translation.
- **`PersistenceExceptionTranslationAutoConfiguration`** (Spring Boot API javadoc):
  registers the post-processor under `spring.dao.exceptiontranslation.enabled` with
  `matchIfMissing = true`. ⚠️ Confirmed on the Boot javadoc pages for 2.x/3.x — the
  **4.1 javadoc page 404'd**, and the page says so.
- **`org.springframework.dao` package javadoc**: full class list + the three second-level
  branches' definitions (non-transient "would fail unless the cause … is corrected";
  transient "might be able to succeed when the operation is retried without any
  intervention by application-level functionality"; recoverable "if the application
  performs some recovery steps"). `EmptyResultDataAccessException` **extends**
  `IncorrectResultSizeDataAccessException`. `DeadlockLoserDataAccessException` and
  `CannotSerializeTransactionException` are **deprecated as of 6.0.3**.

- 🔴 **`KeyHolder.getKey()`** javadoc: "If there are multiple columns, then the Map will
  have multiple entries as well. If this method encounters multiple entries in either the
  map or the list … then an `InvalidDataAccessApiUsageException` is thrown." Combined with
  topic 01's `RETURN_GENERATED_KEYS` → `RETURNING *` fact, this is the concrete failure:
  **the convenient constant makes `getKey()` throw on PostgreSQL**. `getKeyAs(Class)` is
  **@since 5.3** (needed for UUID keys — `getKey()` returns `Number`).
- **`SimpleJdbcInsert`** @since 2.5: "multi-threaded, reusable"; "The meta-data processing
  is based on the `DatabaseMetaData` provided by the JDBC driver"; `executeAndReturnKey`
  "requires that the name of the columns with auto generated keys have been specified".
- **`batchUpdate` javadoc**: the returned array "may also contain special JDBC-defined
  negative values for affected rows such as `Statement.SUCCESS_NO_INFO` (-2) /
  `Statement.EXECUTE_FAILED` (-3)".
- **`DataAccessUtils` table** (used in chunk 07): `requiredSingleResult` /
  `nullableSingleResult` → `EmptyResultDataAccessException(1)` on 0,
  `IncorrectResultSizeDataAccessException(1, size)` on >1; `singleResult` → null on 0;
  `optionalResult` → `Optional.empty()` on 0, delegates for >1.

### Reused from Topic 01 (already established, link don't re-teach)
- pgJDBC `getErrorCode()` is always `0` — `../01-jdbc/21c-what-pgjdbc-throws.md`.
- `Statement.RETURN_GENERATED_KEYS` becomes `RETURNING *` on pgJDBC —
  `../01-jdbc/20-generated-keys.md`.
- A `RETURNING` clause silently disables `reWriteBatchedInserts` —
  `../01-jdbc/19c-insert-rewriting.md`.

## Traps found

- The brief's memory-commit loop (`git commit -m … -- <file>`) fails forever on a file
  git does not track yet. `git add <file>` first, then loop on `git commit`.

## Still owed

Chunks 11 and 12 (+ splits). Plan expansion so far: 01→01+01b, 02→02+02b, 03→03+03b+03c+03d, 04→04+04b, 05→05+05b, 06→06+06b+06c, 08→08+08b, 10→10+10b.

Two gotchas were cut from 03d to fit the cap and are parked in the session scratchpad
for re-insertion: the `IncorrectResultSetColumnCountException` vs
`IncorrectResultSizeDataAccessException` contrast (→ chunk 07) and the
`ConversionService` one (→ chunk 04, since `JdbcClient.create(npjt, conversionService)`
is @since 7.0).

---

# SESSION 2026-08-26 — the final chunk (12 · Testing and the shape of a repository)

**Scope, absolute:** `12-testing-and-the-shape-of-a-repository.md` and any splits of it
(`12b-…`, `12c-…`, `12d-…`) in
`docs/java/pages/phase-10-data-access/05-sql-first-access/`.
**Nothing else.** The other 23 chunks are finished and link-clean; do not touch them,
do not touch `README.md` / `_category_.json` / any board (coordinator wires those).
Tier `t-understand`. `sidebar_position` starts at **24** and increments.

## Planned split (revise as material demands)

| # | File | Argues | Status |
|---|---|---|---|
| 12 | `12-testing-and-the-shape-of-a-repository.md` | the repository is a plain class, not an interface Spring implements — where the SQL lives, where the mapper lives, what it returns | ⏳ |
| 12b | `12b-the-jdbctest-slice.md` | what `@JdbcTest` actually auto-configures, what it does not, rollback, `@AutoConfigureTestDatabase` and why `Replace.NONE` | ⏳ |
| 12c | `12c-testcontainers-and-serviceconnection.md` | `@ServiceConnection` (Boot 4.1) replaces `@DynamicPropertySource`; H2 proves nothing about PostgreSQL SQL | ⏳ |
| 12d | `12d-what-to-assert.md` (if needed) | what a SQL-first test can assert that an entity test cannot, the schema-parse test nobody writes, testing exception translation, the review checklist | ⏳ |

## Links that must stay bold plain text — targets DO NOT EXIST on disk

- Phase 10 topic **11 · Flyway / migrations** — `phase-10-data-access/` has only
  `01-jdbc` … `08-the-n-plus-1-problem`. Verified with `ls` 2026-08-26.
- **Phase 11 · Testing** — `docs/java/pages/phase-11-testing/` contains only
  `_category_.json` and `README.md`. No topic directories. So `@DataJpaTest`,
  `@SpringBootTest`, Testcontainers-in-general, AssertJ, JUnit 5 → all bold plain text
  with *(not written yet)*.

## FINAL split as written (2026-08-26) - chunk 12 became TEN files

| # | File | pos | Lines | Gotchas | Q&A | Status |
|---|---|---|---|---|---|---|
| 12 | `12-testing-and-the-shape-of-a-repository.md` | 24 | 281 | 10 | 6 | DONE |
| 12b | `12b-the-mapper-and-the-return-type.md` | 25 | 250 | 9 | 6 | DONE |
| 12c | `12c-where-the-sql-lives.md` | 26 | 277 | 9 | 6 | DONE |
| 12d | `12d-the-jdbctest-slice.md` | 27 | 274 | 11 | 5 | DONE |
| 12e | `12e-wiring-the-test.md` | 28 | 292 | 8 | 6 | DONE |
| 12f | `12f-the-real-database.md` | 29 | 197 | 10 | 5 | DONE |
| 12g | `12g-testcontainers-and-serviceconnection.md` | 30 | 280 | 12 | 6 | DONE |
| 12h | `12h-what-to-assert.md` | 31 | 185 | 10 | 5 | DONE |
| 12i | `12i-the-parse-test.md` | 32 | 266 | 9 | 6 | DONE |
| 12j | `12j-the-review-checklist.md` | 33 | 242 | 5 | 4 | DONE |

**2,544 lines, 10 files, max 292, 0 over the 296 body cap, 0 broken links** (every
`](...md)` target resolved against the filesystem; the `../04-spring-transactional/`
ones too). No console blocks anywhere; the only fenced blocks are Java, SQL, a
properties line, a classpath tree and two auto-configuration import lists quoted from
Spring Boot's own appendix.

RENUMBERED TWICE while writing, because two drafts blew the cap on a concept boundary:
- draft 12 = 355 lines -> split into 12 (the class) + 12b (mapper and return types)
- draft 12d = 384 lines -> split into 12d (slice contents) + 12e (wiring)
- draft 12f = 314 lines -> split into 12f (why not H2) + 12g (Testcontainers)
- draft 12h = 327 lines -> split into 12h (what to assert) + 12i (parse test) + 12j (checklist)
All forward references were sed-rewritten after each renumber and re-verified by a
filesystem link check.

WARNING FOR THE COORDINATOR: `_plan.md` in the topic directory is STALE. Its table
still lists only `12-testing-and-the-shape-of-a-repository.md` and its RESUME HERE says
"the ONLY file left is 12-...". It is not my file to edit (scope: my chunk and its
splits only), so it needs the ten rows above. Same for `README.md`, which still carries
a ":::caution Topic in progress - 23 of 24 chunks written" banner and a 23-row chunk
table.

## 🔴 Load-bearing claims found THIS session, with the URL that settles each

- 🔴🔴 **Boot 4.1 `@JdbcTest` no longer imports Flyway, Liquibase, Cache or SQL
  initialisation.** The 4.1 appendix lists exactly:
  `DataSourceAutoConfiguration`, `DataSourceTransactionManagerAutoConfiguration`,
  `JdbcClientAutoConfiguration`, `JdbcTemplateAutoConfiguration`,
  `TransactionAutoConfiguration`, `TransactionManagerCustomizationAutoConfiguration`,
  `optional:ServiceConnectionAutoConfiguration`, `DataSourceAutoConfiguration` (again,
  from the `@AutoConfigureTestDatabase` block), `TestDatabaseAutoConfiguration`,
  `optional:ServiceConnectionAutoConfiguration`.
  The **3.5** appendix for the same slice listed
  `CacheAutoConfiguration`, **`FlywayAutoConfiguration`**, **`LiquibaseAutoConfiguration`**
  and **`SqlInitializationAutoConfiguration`** as well.
  → **Nothing in the 4.1 slice builds a schema.**
  Sources: <https://docs.spring.io/spring-boot/appendix/test-auto-configuration/slices.html>
  vs <https://docs.spring.io/spring-boot/3.5/appendix/test-auto-configuration/slices.html>
  ⚠️ **I could not find a release-note or migration-guide entry announcing this.**
  Checked the 4.0 Release Notes and the 4.0 Migration Guide wikis — neither mentions
  test slices losing Flyway/Liquibase. The page says so in those words.
  Package for adding it back: `org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration`
  (URL 200s).
- **`@JdbcTest` javadoc**, package `org.springframework.boot.jdbc.test.autoconfigure`,
  **@since 4.0.0**, verbatim: "Annotation for a JDBC test that focuses **only** on
  JDBC-based components. Using this annotation only enables auto-configuration that is
  relevant to JDBC tests. Similarly, component scanning is configured to skip regular
  components and configuration properties. By default, tests annotated with `@JdbcTest`
  are transactional and roll back at the end of each test. They also use an embedded
  in-memory database (replacing any explicit or usually auto-configured DataSource)."
  Meta-annotations: `@BootstrapWith(JdbcTestContextBootstrapper.class)`,
  `@ExtendWith(SpringExtension.class)`, `@OverrideAutoConfiguration(enabled = false)`,
  `@TypeExcludeFilters(JdbcTypeExcludeFilter.class)`, `@Transactional`,
  `@AutoConfigureJdbc`, `@AutoConfigureTestDatabase`, `@ImportAutoConfiguration`.
  Attributes: `properties`, `includeFilters`, `excludeFilters`,
  `excludeAutoConfiguration` — all default `{}`.
  <https://docs.spring.io/spring-boot/api/java/org/springframework/boot/jdbc/test/autoconfigure/JdbcTest.html>
- 🔴 **`@AutoConfigureTestDatabase.replace` defaults to `Replace.NON_TEST`** in Boot 4.x
  (package `org.springframework.boot.jdbc.test.autoconfigure`, @since 4.0.0). Enum
  javadoc, verbatim:
  - `ANY` — "Replace the DataSource bean whether it was auto-configured or manually defined."
  - `AUTO_CONFIGURED` — "Only replace the DataSource if it was auto-configured."
  - `NON_TEST` — "Replace the DataSource bean unless it is auto-configured and connecting
    to a test database. The following types of connections are considered test databases:
    Any bean definition that includes `ContainerImageMetadata` (including
    `@ServiceConnection` annotated Testcontainers databases, and connections created using
    Docker Compose) · Any connection configured using a `spring.datasource.url` backed by a
    `@DynamicPropertySource` · Any connection configured using a `spring.datasource.url`
    with the Testcontainers JDBC syntax"
  - `NONE` — "Don't replace the application default DataSource."
  <https://docs.spring.io/spring-boot/api/java/org/springframework/boot/jdbc/test/autoconfigure/AutoConfigureTestDatabase.Replace.html>
  ⚠️ **This makes the widespread advice "always add `replace = NONE` with Testcontainers"
  STALE on Boot 4.** Boot 3.4 introduced the detection (3.4 Release Notes: "now attempts to
  detect if a database has been sourced from a container… should remove the need to add
  `replace=Replace.NONE`"; revert with `replace=Replace.AUTO_CONFIGURED`).
  ⚠️ Note this contradicts nothing in topic 04 chunk 20j, but 20j's advice to add
  `replace = NONE` is now belt-and-braces rather than required — do NOT edit 20j (out of
  scope), just be accurate here.
- **`@ServiceConnection`**, package
  `org.springframework.boot.testcontainers.service.connection`, **@since 3.1.0**,
  `@Target({FIELD, METHOD, ANNOTATION_TYPE})`. Javadoc: "Indicates that a field or method
  is a `ContainerConnectionSource` which provides a service that can be connected to."
  Attributes `value`/`name` (aliases) and `type`. 🔴 "**All `@ServiceConnection` `@Bean`
  methods that need to match on the connection name *must* declare this attribute**"
  because "`Container` instances are *not* available early enough when the container is
  defined as a `@Bean` method."
  <https://docs.spring.io/spring-boot/api/java/org/springframework/boot/testcontainers/service/connection/ServiceConnection.html>
- **Boot 4.1 ref, Testcontainers**: "A service connection is a connection to any remote
  service. Spring Boot's auto-configuration can consume the details of a service connection
  and use them to establish a connection to a remote service. When doing so, the connection
  details take precedence over any connection-related configuration properties."
  `@DynamicPropertySource` is described as "a slightly more verbose but also more flexible
  alternative to service connections." Factories: "Service connection annotations are
  processed by `ContainerConnectionDetailsFactory` classes registered with
  `spring.factories`."
  <https://docs.spring.io/spring-boot/reference/testing/testcontainers.html>
- **Testcontainers JDBC URL scheme**: `jdbc:tc:<database>:<version>:///<databasename>`,
  e.g. `jdbc:tc:postgresql:9.6.8:///databasename`. `?TC_INITSCRIPT=somepath/init.sql`
  (or `file:`-prefixed), `?TC_INITFUNCTION=fqcn::method`, `?TC_DAEMON=true`.
  <https://java.testcontainers.org/modules/databases/jdbc/>
- **PostgreSQL 18 `PREPARE`**: "When the `PREPARE` statement is executed, the specified
  statement is parsed, analyzed, and rewritten. When an `EXECUTE` command is subsequently
  issued, the prepared statement is planned and executed." Parameter types "inferred from
  the context in which the parameter is first referenced (if possible)". "Prepared
  statements only last for the duration of the current database session."
  <https://www.postgresql.org/docs/18/sql-prepare.html>
  → This is the mechanism for the parse-against-the-real-schema test in 12f.
- **Spring Framework 7.0 `@Sql`** — default script convention
  `classpath:com/example/MyTest.sql` (class level) /
  `classpath:com/example/MyTest.testMethod.sql` (method level), `IllegalStateException` if
  no default can be detected; `executionPhase` = `BEFORE_TEST_METHOD` (default),
  `AFTER_TEST_METHOD`, `BEFORE_TEST_CLASS`, `AFTER_TEST_CLASS` (the last two @since 6.1);
  `@SqlMergeMode(MERGE|OVERRIDE)`, method-level overrides class-level by default;
  support from `SqlScriptsTestExecutionListener`.
  <https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/executing-sql.html>
- **Spring Framework 7.0 TestContext tx**: "Annotating a test method with `@Transactional`
  causes the test to be run within a transaction that is, by default, automatically rolled
  back after completion of the test." `@Commit`/`@Rollback`, `@BeforeTransaction`/
  `@AfterTransaction`, `TestTransaction.flagForCommit()/end()/start()/isActive()`.
  🔴 The "Avoid false positives when testing ORM code" caution: "When you test application
  code that manipulates the state of a Hibernate session or JPA persistence context, make
  sure to flush the underlying unit of work within test methods that run that code. Failing
  to flush the underlying unit of work can produce false positives".
  → **That entire category does not exist for SQL-first**, which is the strongest "what a
  SQL-first test can assert that an entity test cannot" point. Use it in 12f.
  <https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html>
- **`Resource.getContentAsString(Charset)`** and `getContentAsByteArray()` are **@since
  6.0.5** — the clean way to load an external `.sql` from the classpath in 12c.
  <https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/core/io/Resource.html>

## ⚠️ Overlap discovered — do NOT re-teach, LINK instead

Topic 04 (`../04-spring-transactional/`) chunks **20 → 20j** are a Master-tier run on
transactions in tests, and they already cover: the rollback default, `@Commit`/`@Rollback`,
`TestTransaction`, the ORM flush false positive, `@Sql` `transactionMode`
(`INFERRED`/`ISOLATED`/`DEFAULT`), the default-script-name convention, `@SqlMergeMode`, the
list of things an in-memory database cannot test, `@AutoConfigureTestDatabase(replace = NONE)`,
and a `@ServiceConnection` + `PostgreSQLContainer` example. Files:
`20-transactions-in-tests.md`, `20b`…`20j-the-fixture-and-the-real-database.md`,
`22-the-checklist.md`, `22b-reviewing-a-service.md`.
→ Chunks 12d/12e/12f must add only what is **SQL-first specific**: the `@JdbcTest` slice
contents, the Boot 4.1 schema-is-empty change, `Replace.NON_TEST`, the parse test, the
exception-translation test, and the repository review checklist.

## RESUME HERE - NOTHING. TOPIC 05 IS COMPLETE.

All 33 chunks of topic 05 are on disk (23 pre-existing + the 10 written 2026-08-26).
The only outstanding work is COORDINATOR work: wire `README.md` (the caution banner and
the chunk table are stale at 23 of 24), refresh `_plan.md`, generate the Prev/Next
footers for the ten new files, and renormalise `sidebar_position` if needed (mine run
24-33 contiguously).

### Claims I could NOT confirm, stated as uncertain on the page

1. **No release note announces the Boot 4 test-slice change.** I checked the Spring
   Boot 4.0 Release Notes wiki and the 4.0 Migration Guide wiki; neither mentions test
   slices losing Flyway/Liquibase/SQL-init. 12d says so in those words and tells the
   reader to trust the appendix for their own Boot version.
2. **H2 feature absence was not verified item by item.** The page argues only what the
   H2 docs support: the PostgreSQL mode is a documented list of adjustments, so anything
   not on the list is H2's own behaviour. It does not claim "H2 lacks RETURNING".
3. **The `jsonb ?` / JDBC `?` clash has no note in the PostgreSQL manual.** The
   operators are documented; the clash is a consequence I derive, and 12i says so
   explicitly.

## More load-bearing claims (session 2026-08-26, part 2)

- **H2 has eleven compatibility modes** - REGULAR, STRICT, LEGACY, DB2, Derby, HSQLDB,
  MS SQL Server, MariaDB, MySQL, Oracle, PostgreSQL. PostgreSQL mode URL:
  `jdbc:h2:~/test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH`,
  and "Do not change value of DATABASE_TO_LOWER after creation of database."
  RED: the documented adjustment list includes "ON CONFLICT DO NOTHING is supported in
  INSERT statements" and does NOT mention DO UPDATE, RETURNING, FOR UPDATE SKIP LOCKED,
  jsonb, date_trunc or full-text search. Other verified entries used on the page:
  aliased columns -> getColumnName() returns the alias and getTableName() returns null;
  float->int conversion rounds rather than truncates; ctid/oid supported; LOG(x) is
  base 10; LIMIT/OFFSET supported; legacy SERIAL/BIGSERIAL supported; NUMERIC/DECIMAL
  without parameters treated like DECFLOAT; MONEY treated like NUMERIC(19,2);
  EXTRACT(DOW) returns 0-6 with Sunday 0; UPDATE ... FROM partially supported;
  GROUP BY accepts 1-based positions.
  <https://www.h2database.com/html/features.html>
  WARNING: the page frames the mode as a LIST OF ADJUSTMENTS, so the honest claim on
  the page is "anything not on the list is H2's own behaviour" - NOT "feature X is
  absent", which I did not verify item by item and said so in the text.
- **Testcontainers JUnit 5**: "@Testcontainers ... finds all fields that are annotated
  with @Container and calls their container lifecycle methods." Static fields "will be
  shared between test methods. They will be started only once before any test method is
  executed and stopped after the last test method has executed." Instance fields "will
  be started and stopped for every test method." RED: "This extension has only been
  tested with sequential test execution. Using it with parallel test execution is
  unsupported and may have unintended side effects."
  <https://java.testcontainers.org/test_framework_integration/junit_5/>
- **JDK 25 text blocks**: incidental indentation is computed across all lines INCLUDING
  the line holding the closing delimiter - "The entire contents of the text block is
  shifted to the left until the line with the least leading white space has no leading
  white space", and the guide's worked example shows the closing-delimiter line
  participating. Closing delimiter on its own line keeps the trailing newline;
  "placing the closing delimiter on the last visible line effectively drops the last"
  newline.
  <https://docs.oracle.com/en/java/javase/25/text-blocks/index.html>
