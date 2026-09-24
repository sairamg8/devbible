---
name: progress-java-p10-t11-flyway
description: devbible · Java Phase 10 · Topic 11 · Migrations with Flyway
metadata:
  type: progress
---

# devbible · Java Phase 10 · Topic 11 · Migrations with Flyway

**Fork session** started 2026-08-26. Tier: **Understand**. Directory owned:
`docs/java/pages/phase-10-data-access/11-flyway-migrations/` — mine alone.

Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Hibernate ORM 7.4.1 ·
Spring Data JPA 4.1.0 · HikariCP 7.0.2 · **Flyway 12.4.0** · **PostgreSQL 18** · pgJDBC 42.7.x.

## Scope and boundary

- **11 owns**: versioned schema change — the migration file, the history table, ordering,
  checksums, repeatable migrations, baselining, running migrations against a live service,
  locks, many instances, data migrations, testing, the review checklist.
- **06 owns `ddl-auto`** — `../06-jpa-hibernate-model/17-ddl-auto.md` and
  `17b-why-update-is-never-production.md` are WRITTEN and already argue `update` is never
  production. I pick up at "so what do you do instead" and link back. Confirmed on disk.
- Liquibase: named and contrasted in a sentence or two, never taught.
- **Linkable (confirmed on disk 2026-08-26):** `../02-connection-pooling/`,
  `../03-jdbc-transactions/` (esp. `13b-the-four-clocks.md`, `12-locking-and-select-for-update.md`,
  `04-postgresql-has-three-levels.md`), `../05-sql-first-access/`
  (esp. `12f-the-real-database.md`, `12g-testcontainers-and-serviceconnection.md`),
  `../06-jpa-hibernate-model/`.
- **NOT linkable — bold plain text + *(not written yet)*:** topics 09, 10, 12, 13, 14 of this
  phase (concurrent forks), and **Phase 11 · Testing**.

## Rules in force

- 300-line FILE cap, never a content budget. Footer costs 4 lines → write to ≤296 body lines.
- Depth never capped by section count. Gotchas / Q&A run to as many as the topic has.
- 🔴 NO console blocks. No Flyway output, no migration logs, no timings. SQL + config source only.
- Do not touch README.md / _category_.json / _plan.md / any board. Do not commit in devbible.
- End every file with a bare `<!--FOOTER-->`.

## File table

| # | File | Lines | Gotchas | Qs | Status |
|---|---|---|---|---|---|
| 1 | `01-why-schema-is-code.md` | 272 | 8 | 8 | ✅ |
| 2 | `02-the-migration-file.md` | 276 | 11 | 8 | ✅ |
| 3 | `02b-where-they-live.md` | 287 | 10 | 8 | ✅ |
| 4 | `02c-choosing-version-numbers.md` | 268 | 10 | 8 | ✅ |
| 5 | `03-the-history-table.md` | 264 | 12 | 10 | ✅ |
| 6 | `03b-when-a-migration-fails.md` | 263 | 12 | 11 | ✅ |
| 7 | `03c-reading-the-history.md` | 246 | 12 | 11 | ✅ |
| 8 | `04-checksums-and-immutability.md` | 265 | 11 | 8 | ✅ |
| 9 | `04b-the-edits-nothing-catches.md` | 215 | 7 | 7 | ✅ |
| 10 | `04c-where-the-comparison-does-not-run.md` | 231 | 13 | 11 | ✅ |
| 11 | `04d-what-repair-actually-does.md` | 242 | 9 | 8 | ✅ |
| 12 | `04e-when-repair-is-the-right-answer.md` | 278 | 13 | 12 | ✅ |
| 13 | `05-repeatable-migrations.md` | 265 | 12 | 11 | ✅ |
| 14 | `05b-what-belongs-in-a-repeatable-migration.md` | 222 | 8 | 8 | ✅ |
| 15 | `05c-what-does-not-belong.md` | 175 | 13 | 10 | ✅ |
| 16 | `06-baselining.md` | 244 | 12 | 12 | ✅ |
| 17 | `06b-adopting-flyway-on-an-existing-database.md` | 228 | 12 | 11 | ✅ |
| 18 | `06c-baseline-migrations-and-collapsing-history.md` | 263 | 13 | 12 | ✅ |
| 19 | `07-boot-integration.md` | 264 | 12 | 12 | ✅ |
| 20 | `07b-validate-not-update.md` | 278 | 13 | 12 | ✅ |

## Load-bearing claims and their sources

(to be filled as verified)

## RESUME HERE

🔴 **FOOTER MARKER CHANGED 2026-08-26** — a bare `<!--FOOTER-->` is invalid MDX and broke the
Docusaurus build. Every page now ends with `{/* FOOTER */}`. Existing four files were sed-fixed
and committed. **Never write a bare `<!-- -->` comment outside a fenced code block.**

Next file: **`08-migrating-a-live-service.md`** (`sidebar_position: 21`).
Then: 08b locks (`08b-locks-and-long-migrations.md` — the NAME IS LOAD-BEARING, two files
already link to it), 09 many instances (`09-many-instances-one-database.md`, linked from 01
and 02b),
10 data migrations, 11 testing, 12 checklist.

⚠️ **`04` was planned as ONE file and became FIVE** (04 / 04b / 04c / 04d / 04e) — split on real concept
boundaries: 04 = what the checksum is and what `validate` compares; 04b = the edits nothing
catches (null checksum, Java migrations, placeholder asymmetry); 04c = where the comparison does
not run (baseline cut-off, description truncation, no ignore pattern) plus the "why the rule
survives" argument and the write-V8 answer. `04` forward-links to `04d` for repair.
Extra chunk added beyond the plan: `02c-choosing-version-numbers.md` (sequential vs timestamp,
out-of-order, target, reserved bands).

---

## VERIFIED CLAIMS (research pass, 2026-08-26)

### Flyway naming grammar
- Versioned: `prefix VERSION separator DESCRIPTION suffix` → `V1__My_description.sql`.
  Prefix `V` (`sqlMigrationPrefix`), separator `__` (`sqlMigrationSeparator`), suffix `.sql`
  (`sqlMigrationSuffixes`, a LIST). "Any version is valid as long as it conforms to the usual
  dotted notation or an underscore separated notation." "Versions are sorted numerically as
  you would normally expect." Source: https://documentation.red-gate.com/fd/versioned-migrations-273973333.html
  and https://documentation.red-gate.com/fd/migrations-271585107.html
- Undo: `U` prefix (`undoSqlMigrationPrefix`). **EDITION: TEAMS** — quoted from
  https://documentation.red-gate.com/flyway/flyway-concepts/migrations/undo-migrations
  Doc warnings: "They work for undoing schema changes but not so well for undoing data changes";
  "Undo migrations assume the whole migration succeeded and should now be undone."
- Repeatable: `R` prefix (`repeatableSqlMigrationPrefix`), NO version.
  "(re-)applied to a database on migrate every time their checksum changes."
  "within a single migration run, repeatable migrations are always applied last, after all
  pending versioned migrations have been executed." "applied in the order of their description
  (i.e. alphabetically)." "It is your responsibility to ensure the same repeatable migration
  can be applied multiple times. This usually involves making use of `CREATE OR REPLACE`."
  Source: https://documentation.red-gate.com/flyway/flyway-concepts/migrations/repeatable-migrations
- Baseline migration: `B` prefix (`baselineMigrationPrefix`). "B5__my_database.sql represents
  the state of your database after applying all versioned migrations up to and including V5."
  "Baseline migrations are not affiliated with the `baseline` command and are executed during
  the `migrate` process." Page carries NO edition tag (checked).
  Source: https://documentation.red-gate.com/fd/baseline-migrations-273973336.html

### Checksums / validate / repair
- Checksum algorithm: **CRC32 for SQL migrations**. validate "validates the applied migrations
  against the available ones", fails on "differences in migration names, types or checksums".
  Source: https://documentation.red-gate.com/flyway/reference/commands/validate
- repair does exactly three things (quoted):
  1. "Remove any failed migrations (User objects left behind must still be cleaned up manually)"
  2. "Realign the checksums, descriptions and types of the applied migrations with the ones of
     the available migrations"
  3. "Mark all missing migrations as **deleted**"
  Plus: "repair must be given the same locations as migrate".
  Source: https://documentation.red-gate.com/fd/repair-277578892.html

### Transactions
- "Flyway executes each migration in its own transaction"; `group=true` wraps ALL pending
  migrations in one; `mixed` applies to "PostgreSQL, Aurora PostgreSQL, SQL Server and SQLite".
  With clean DDL transaction support "failed migrations will always be rolled back (unless they
  were marked as non-transactional)". Without it → manual cleanup + `repair`.
  Source: https://documentation.red-gate.com/fd/migration-transaction-handling-273973399.html
- `executeInTransaction` default `true`, settable per-script via a `.conf` file named after the
  migration. Source: https://documentation.red-gate.com/fd/flyway-execute-in-transaction-setting-277578997.html

### Flyway on PostgreSQL
- "By default Flyway uses a transactional lock with PostgreSQL, however this can cause issues
  with certain SQL statements, most notably `CREATE INDEX CONCURRENTLY`." Fix:
  `flyway.postgresql.transactional.lock=false` → session-level locks. Uses
  `pg_try_advisory_xact_lock`. PostgreSQL support is a **separate module**:
  `org.flywaydb:flyway-database-postgresql`.
  Source: https://documentation.red-gate.com/flyway/reference/database-driver-reference/postgresql-database

### Spring Boot 4.1 (verified against FlywayProperties.java + FlywayAutoConfiguration.java on main)
- 🔴 **`spring.flyway.clean-disabled` DEFAULTS TO `true` in Boot** (`private boolean cleanDisabled = true;`)
  — the generic appendix table says `false`; that is Flyway's own default, not Boot's.
- 🔴 **`spring.flyway.ignore-migration-patterns` defaults to `["*:future"]`** in Boot.
- `target` default `"latest"`. `lock-retry-count` 50. `connect-retries` 0,
  `connect-retries-interval` 120s. `encoding` UTF-8. `table` `flyway_schema_history`.
  `baseline-version` "1", `baseline-description` "<< Flyway Baseline >>", `baseline-on-migrate` false.
  `validate-on-migrate` true. `validate-migration-naming` false. `create-schemas` true.
  `execute-in-transaction` true. `placeholder-prefix` `${`, `placeholder-suffix` `}`,
  `placeholder-separator` `:`; `script-placeholder-prefix` `FP__`, suffix `__`.
  `loggers` = `{"slf4j"}`. `out-of-order` false. `group` false. `mixed` false.
  `spring.flyway.postgresql.transactional-lock` → PostgreSQLConfigurationExtension.setTransactionalLock.
  Teams-only fields flagged in javadoc: `dry-run-output`, `error-overrides`, `kerberos-config-file`,
  `sqlserver.kerberos-login-file`.
  Source: https://github.com/spring-projects/spring-boot/blob/main/module/spring-boot-flyway/src/main/java/org/springframework/boot/flyway/autoconfigure/FlywayProperties.java
- `@AutoConfiguration(after = DataSourceAutoConfiguration.class)`,
  `@ConditionalOnBooleanProperty(name = "spring.flyway.enabled", matchIfMissing = true)`,
  `@Import(DatabaseInitializationDependencyConfigurer.class)`.
  Beans: `Flyway`, `FlywayMigrationInitializer` (implements `InitializingBean, Ordered`;
  `afterPropertiesSet()` calls `flyway.migrate()` or the `FlywayMigrationStrategy`),
  `FlywaySchemaManagementProvider`.
  **Ordering guarantee** = `FlywayMigrationInitializerDatabaseInitializerDetector` (order 1) marks
  the initializer as a database initializer; `DatabaseInitializationDependencyConfigurer` adds a
  `dependsOn` from every bean detected as `@DependsOnDatabaseInitialization` to it. So the
  EntityManagerFactory is built AFTER migrate() has run — which is why `ddl-auto: validate` is a
  real assertion. Source: FlywayAutoConfiguration.java (link above) +
  https://docs.spring.io/spring-boot/api/java/org/springframework/boot/sql/init/dependency/DatabaseInitializationDependencyConfigurer.html
- Boot how-to: default location `classpath:db/migration`; `{vendor}` placeholder; Java migrations
  via `JavaMigration` beans; `Callback` beans auto-registered and `@Order`-able; `@FlywayDataSource`;
  "Setting either `spring.flyway.url` or `spring.flyway.user` is sufficient to cause Flyway to use
  its own DataSource." Source: https://docs.spring.io/spring-boot/how-to/data-initialization.html

### PostgreSQL 18
- ALTER TABLE: "An `ACCESS EXCLUSIVE` lock is acquired unless explicitly noted."
  Weaker: ADD FOREIGN KEY = SHARE ROW EXCLUSIVE; VALIDATE CONSTRAINT / SET STATISTICS /
  per-attribute options / cluster options / ATTACH PARTITION (on parent) = SHARE UPDATE EXCLUSIVE;
  ENABLE/DISABLE TRIGGER = SHARE ROW EXCLUSIVE.
- ADD COLUMN with a **non-volatile** DEFAULT (or none): "In neither case is a rewrite of the table
  required." ADD COLUMN with a **volatile** DEFAULT, a **stored** generated column, an identity
  column, or a domain type with constraints → "will cause the entire table and its indexes to be
  rewritten." "Adding a virtual generated column never requires a rewrite." (PG18: virtual
  generated columns are the DEFAULT kind now.)
  "Changing the type of an existing column will normally cause the entire table and its indexes
  to be rewritten." "Adding a `CHECK` or `NOT NULL` constraint requires scanning the table to
  verify that existing rows meet the constraint, but does not require a table rewrite."
  DROP COLUMN "does not physically remove the column".
  Source: https://www.postgresql.org/docs/18/sql-altertable.html
- PG18 NEW: "Allow ALTER TABLE to set the `NOT VALID` attribute of `NOT NULL` constraints";
  NOT NULL now stored in `pg_constraint` so it can be named; `ALTER TABLE ... ALTER CONSTRAINT
  ... [NO] INHERIT`. Source: https://www.postgresql.org/docs/18/release-18.html
- CREATE INDEX: normal build "locks the table to be indexed against writes". CONCURRENTLY: two
  table scans, waits for existing transactions, "a regular CREATE INDEX command can be performed
  within a transaction block, but CREATE INDEX CONCURRENTLY cannot", and on failure "leave behind
  an 'invalid' index" which `\d` reports as INVALID; recovery = drop and retry, or
  `REINDEX INDEX CONCURRENTLY`. Source: https://www.postgresql.org/docs/18/sql-createindex.html
- `lock_timeout`: default 0 (disabled), ms. "Abort any statement that waits longer than the
  specified amount of time while attempting to acquire a lock… The time limit applies separately
  to each lock acquisition attempt." "if `statement_timeout` is nonzero, it is rather pointless to
  set `lock_timeout` to the same or larger value". `statement_timeout`, `transaction_timeout`,
  `idle_in_transaction_session_timeout` all default 0.
  Source: https://www.postgresql.org/docs/18/runtime-config-client.html

---

## SECOND RESEARCH PASS (2026-08-26) — Flyway 12 SOURCE, which beats the rendered docs

🔴 The Redgate docs are **in the flyway/flyway repo** as markdown:
`documentation/Reference/**.md` on `main`. Raw-fetchable, and they carry the **edition tags**
as Jekyll includes (`{% include teams.html %}` / `enterprise.html`). This is the authoritative
way to settle the edition split — do not guess from the rendered site.

### 🔴 EDITION MAP, measured by grepping all 222 Commands + Flyway-Namespace docs

- **Teams-tagged:** `undo` command, `undoSqlMigrationPrefix`, `cherryPick`, `dryRunOutput`,
  `errorOverrides`, `kerberosConfigFile`, `sqlserver.kerberosLoginFile`, Oracle SQL*Plus /
  wallet / checksumIncludeReferencedScripts, `check dryrun`, GCS (`gcs:`) locations only —
  the `locations` and `callbackLocations` pages are Community except their **Google Cloud
  Storage** sections.
- **Enterprise-tagged:** `check changes`, `check drift`, `diff`, `diff text`, `generate`,
  `model`, `prepare`, `snapshot`, the whole `check.*` and `tags.*` namespaces, Azure Key
  Vault / Vault / Dapr / GCSM secrets namespaces, `snapshot.*`.
- 🔴 **NOT tagged → COMMUNITY, safe to teach as free:** `migrate`, `info`, `validate`,
  `repair`, `baseline`, `clean`, `outOfOrder`, `group`, `mixed`, `executeInTransaction`,
  `ignoreMigrationPatterns`, `lockRetryCount`, `table`, `baselineOnMigrate`,
  `baselineVersion`, `baselineDescription`, **`baselineMigrationPrefix` (the `B` prefix)**,
  `repeatableSqlMigrationPrefix`, `validateOnMigrate`, `validateMigrationNaming`,
  `cleanDisabled`, **`skipExecutingMigrations`**, `postgresql.transactionalLock`, S3 locations.

### The ten history-table columns — from `SchemaHistoryItem` (authoritative)

`installedRank, version, description, type, script, checksum, installedBy, installedOn,
executionTime, success`. `JdbcTableSchemaHistory.refreshCache()` reads them by lower-cased
name: `installed_rank, version, description, type, script, installed_by, execution_time,
success, checksum, installed_on`. Column *names* are the contract, not ordinal position.
Source: flyway-core/src/main/java/org/flywaydb/core/internal/{nc/schemahistory/SchemaHistoryItem,schemahistory/JdbcTableSchemaHistory}.java

### 🔴 A FAILED MIGRATION ON POSTGRESQL LEAVES **NO ROW** — verified in `DbMigrate.java`

```java
if (database.supportsDdlTransactions() && executeGroupInTransaction) {
    LOG.error(failedMsg + " Changes successfully rolled back.");
    migrateResult.markAsRolledBack(...);
} else {
    LOG.error(failedMsg + " Please restore backups and roll back database and code!");
    schemaHistory.addAppliedMigration(..., false);   // success = false
}
```

So `success = false` rows only ever appear when the migration could **not** run in a
transaction (`executeInTransaction: false`, `mixed`, `CREATE INDEX CONCURRENTLY`). And a
failed row is a hard stop: `"Schema " + schema + " contains a failed migration to version "`.
`repair`'s "remove failed migrations" therefore only ever matters in the non-transactional case.
Source: flyway-core/src/main/java/org/flywaydb/core/internal/command/DbMigrate.java

### `type` values — from `CoreMigrationType` + `BaselineMigrationType`

`SCHEMA, BASELINE, DELETE, SQL, JDBC, SCRIPT, UNDO_SCRIPT, CUSTOM` + `SQL_BASELINE,
JDBC_BASELINE`. **Synthetic** (`synthetic=true`, javadoc: *"only ever present in the schema
history table, but never discovered by migration resolvers"*): `SCHEMA`, `BASELINE`, `DELETE`.

### `MigrationState` — the full 19, from `MigrationState.java`

PENDING "Pending" · ABOVE_TARGET "Above Target" · BELOW_BASELINE "Below Baseline" ·
BASELINE_IGNORED "Ignored (Baseline)" · BASELINE "Baseline" · IGNORED "Ignored" ·
MISSING_SUCCESS "Missing" · MISSING_FAILED "Failed (Missing)" · SUCCESS "Success" ·
UNDONE "Undone" · AVAILABLE "Available" · FAILED "Failed" · OUT_OF_ORDER "Out of Order" ·
FUTURE_SUCCESS "Future" · FUTURE_FAILED "Failed (Future)" · OUTDATED "Outdated" ·
SUPERSEDED "Superseded" · DELETED "Deleted".
Each carries flags `resolved / applied / failed`. Javadoc for IGNORED: *"This migration was not
applied against this DB, because a migration with a higher version has already been applied.
This probably means some checkins happened out of order."* MISSING_SUCCESS: *"applied against
this DB, but it is not available locally. This usually results from multiple older migration
files being consolidated into a single one."*

### `ignoreMigrationPatterns` — the grammar

`type:status`, comma-separated, `*` wildcards both halves. type ∈ {repeatable, versioned, *};
status ∈ {Missing, Pending, Ignored, Future, *}. Default `"*:future"`. *"Only `Missing`
migrations are ignored during `repair`."* Clear it with an empty string.

### `lockRetryCount` — quoted

*"At the start of a migration, Flyway will attempt to take a lock to prevent competing instances
executing in parallel. If this lock can't be obtained straight away, Flyway will retry at 1s
intervals, until this count is reached, at which point it will abandon the migration. A value of
-1 indicates that Flyway should keep retrying indefinitely."* Default `50`.

### `baselineOnMigrate` — quoted, with the warning

*"Whether to automatically call baseline when migrate is executed against a non-empty schema
with no schema history table."* … *"Only migrations above baselineVersion will then be applied."*
🔴 *"Be careful when enabling this as it removes the safety net that ensures Flyway does not
migrate the wrong database in case of a configuration mistake!"* Default `false`.

### `skipExecutingMigrations` — COMMUNITY, and the answer to out-of-band changes

*"Whether Flyway should skip migration execution. The remainder of the operation will run as
normal - including updating the schema history table"* … *"can be used to bring an out-of-process
change into Flyway's change control process. For instance, a script run against the database
outside of Flyway (like a hotfix) can be turned into a migration."* Default `false`.

### `cleanDisabled` — 🔴 Flyway's OWN default is now `true` too

The Flyway reference page says default `true`: *"This is especially useful for production
environments where running clean can be a career limiting move."* So Boot's `true` is not an
override any more — the earlier note in this file that "the appendix says false" refers only to
Boot's generated appendix table, which is stale.

### `group` / `mixed` — quoted

group: *"Whether to group all pending migrations together in the same transaction when applying
them (only recommended for databases with support for DDL transactions)"*; *"If
executeInTransaction is set to false, this parameter will have no impact"*; *"does not apply to
callbacks, which can't be included in the same transaction"*. Default `false`.
mixed: *"Whether to allow mixing transactional and non-transactional statements within the same
migration. Enabling this automatically causes the entire affected migration to be run without a
transaction."* *"only applicable for PostgreSQL, Aurora PostgreSQL, SQL Server and SQLite"*.
Default `false`. `DbMigrate.migrateAll()` warns when `group` is on without DDL transactions.

### `table` — quoted

*"By default (single-schema mode) the schema history table is placed in the default schema for
the connection provided by the datasource."* Default `"flyway_schema_history"`.

### History-table creation is retried

`JdbcTableSchemaHistory.create()` loops `while (!exists())`, catching `FlywayException` and
sleeping 1s, up to **10 retries** — inside `connection.lock(table, …)`. Relevant to the
many-instances chunk.

### PostgreSQLParser — the NON-TRANSACTIONAL statement list (source-verified)

`detectCanExecuteInTransaction` returns false for:
`^(CREATE|DROP) (DATABASE|TABLESPACE|SUBSCRIPTION)` · `^ALTER SYSTEM` ·
`^(CREATE|DROP)( UNIQUE)? INDEX CONCURRENTLY` · `^REINDEX( VERBOSE)? (SCHEMA|DATABASE|SYSTEM)` ·
`^VACUUM` · `^DISCARD ALL`. **And `^ALTER TYPE( .*)? ADD VALUE` ONLY when the server is
below version 12** — so on PG18 enum additions ARE transactional. Also `^COPY( .*)? FROM STDIN`
is a special statement type (not a transaction concern).
Source: flyway-database/flyway-database-postgresql/.../PostgreSQLParser.java

`DbMigrate` special-cases exactly ONE failed migration in state `FUTURE_FAILED` when `future` is
in `ignoreMigrationPatterns` → warning, not exception. Everything else with `success=false`
throws before anything is applied.


---

## THIRD RESEARCH PASS (2026-08-26) — checksum + validate INTERNALS, all source-verified

### `ChecksumCalculator` — the whole mechanism, and it is eight lines
`flyway-core/src/main/java/org/flywaydb/core/internal/resolver/ChecksumCalculator.java`
(⚠️ **`internal/resolver/`, NOT `internal/util/`** — that path 404s.)

```java
final CRC32 crc32 = new CRC32();
BufferedReader bufferedReader = new BufferedReader(resource.read(), 4096);
String line = bufferedReader.readLine();
if (line != null) {
    line = BomFilter.FilterBomFromString(line);
    do { crc32.update(line.getBytes(StandardCharsets.UTF_8)); }
    while ((line = bufferedReader.readLine()) != null);
}
```

Javadoc on `calculate(...)`: *"Calculates the checksum of these resources. The checksum is
encoding and line-ending independent."*

🔴 Four consequences, all derivable and all written up in `04`:
1. **Line terminators are NEVER hashed** → LF↔CRLF, `.gitattributes`, `dos2unix` are invisible.
2. **Decoded with `encoding`, re-encoded to UTF-8** → encoding change with matching config is invisible.
3. **BOM filtered from the FIRST line only.**
4. 🔴 **A blank line contributes ZERO bytes** (`"".getBytes()` → `update` no-op) → inserting or
   deleting blank lines does NOT change the checksum. Nobody documents this.
   Trailing spaces INSIDE a line DO change it.
- Multi-resource form: CRC32 over the 4-byte big-endian ints of each resource's checksum.

### 🔴 `isChecksumMatching()` — a NULL on either side is a MATCH
`flyway-core/src/main/java/org/flywaydb/core/api/MigrationInfo.java` (default method):
```java
default boolean isChecksumMatching() {
    return getResolvedChecksum() == null || getAppliedChecksum() == null
        || getResolvedChecksum().equals(getAppliedChecksum());
}
```
Same shape for `isDescriptionMatching()` and `isTypeMatching()`. **Absence is never a failure.**

### 🔴🔴 `BaseJavaMigration.getChecksum()` RETURNS `null`
Verified: `flyway-core/src/main/java/org/flywaydb/core/api/migration/BaseJavaMigration.java`
returns `null`; `canExecuteInTransaction()` returns `true`.
**So editing a Java migration's body is COMPLETELY undetectable** — combined with the null-is-a-match
rule above. This is the largest hole in Flyway's model and it is not stated in the docs.
Remedy taught: override `getChecksum()` returning a hand-bumped int; enforce with a reflection test.

### 🔴 PLACEHOLDER ASYMMETRY — versioned vs repeatable (source-verified, undocumented)
`SqlMigrationResolver.getChecksumForLoadableResource`:
```java
if (repeatable && placeholderReplacement) {
    return ChecksumCalculator.calculate(createPlaceholderReplacingLoadableResources(loadableResources));
}
return ChecksumCalculator.calculate(loadableResources.toArray(LoadableResource[]::new));
```
- **Repeatable + placeholders on** → checksum of the **SUBSTITUTED** text (so a changed placeholder
  RE-RUNS it — which is exactly what you want for a view defined over `${schema}`).
- **Every versioned migration** → checksum of the **RAW** file. So changing a placeholder VALUE
  changes what a versioned migration did with an IDENTICAL checksum. Applies to `${flyway:user}`,
  `${flyway:timestamp}`, `${flyway:defaultSchema}` too.
- `getEquivalentChecksumForLoadableResource` returns the RAW checksum for repeatables only (back-compat).
- `script` = `resource.getRelativePath()` (path within the location, not the bare filename).

### 🔴 `MigrationInfoImpl.validate()` — the THREE comparisons and their ORDER
`flyway-core/src/main/java/org/flywaydb/core/internal/info/MigrationInfoImpl.java`
Order is **type → checksum → description**, and it **returns on the first failure**, so a type
mismatch MASKS a checksum mismatch. Error codes: `TYPE_MISMATCH`, `CHECKSUM_MISMATCH`,
`DESCRIPTION_MISMATCH`.

Shared message format string (`createMismatchMessage`) — quoted on the page as SOURCE, not output:
```
Migration <mismatch> mismatch for migration %s
-> Applied to database : %s
-> Resolved locally    : %s
Either revert the changes to the migration, or run repair to update the schema history.
```

🔴 **All three checks are wrapped in:**
```java
if (getVersion() == null || getVersion().compareTo(context.appliedBaseline) > 0) { ... }
```
→ **NOTHING at or below the APPLIED baseline is ever compared.** Not checksum, not description,
not type. The boundary is a per-database fact (the `BASELINE` row), not a repository property.

🔴 **No ignore pattern can suppress a mismatch.** `ignorePatterns.matchesMigration` is tested
against the *state*, and an edited migration is still `SUCCESS`. Statuses are only Missing /
Pending / Ignored / Future. Confirmed by reading the order of checks in `validate()`.

Other verbatim messages in `validate()` worth reusing later:
- `"Detected applied migration not resolved locally: <v>.\nIf you removed this migration
  intentionally, run repair to mark the migration as deleted."`
- `"Detected resolved migration not applied to database: <v>.\nTo ignore this migration, set
  -ignoreMigrationPatterns='*:ignored'. To allow executing this migration, set -outOfOrder=true."`
- `"Detected failed migration to version <v> (<desc>).\nPlease remove any half-completed changes
  then run repair to fix the schema history."`

### `AbbreviationUtils` — the truncation limits
`abbreviateDescription`: `<= 200` unchanged, else `substring(0,197) + "..."`.
`abbreviateScript`: `<= 1000` unchanged, else `"..." + substring(3,1000)`.
The **resolved** side is abbreviated before the description comparison → two descriptions differing
only past char 197 compare equal. Neither limit is configurable.

### `descriptionMismatch` and `SchemaHistory.NO_DESCRIPTION_MARKER`
Some databases cannot store an empty description; the marker stands in, and an applied marker
matches a resolved `""`.

### Tooling note
`gh api repos/flyway/flyway/contents/<path> --jq '.content' | base64 -d` works without a token
prompt here and beats WebFetch for source files. `gh api -X GET search/code -f q='<sym> repo:flyway/flyway'`
finds a path in one call — use it rather than guessing (the `ChecksumCalculator` guess was wrong).


## FOURTH PASS (2026-08-26) — `repair` INTERNALS, source-verified

`DbRepair.repair()` runs THREE actions in a fixed order inside ONE execution template:
```java
completedActions.removedFailedMigrations = schemaHistory.removeFailedMigrations(repairResult, configuration.getCherryPick());
migrationInfoService.refresh();
completedActions.deletedMissingMigrations = deleteMissingMigrations();
completedActions.alignedAppliedMigrationChecksums = alignAppliedMigrationsWithResolvedMigrations();
```
Completion messages (from `CompletedRepairActions`): *"Removed failed migrations"* /
*"Marked missing migrations as deleted"* / *"Aligned applied migration checksums"*.

🔴 **Action 1 is a REAL `DELETE`** (`getDeleteStatement`, per row, filtered by `cherryPick`).
No tombstone; the row simply ceases to exist.

🔴🔴 **Action 2's "delete" is an `INSERT`.** `JdbcTableSchemaHistory.delete(applied)` inserts a NEW
row with a fresh `installed_rank`, type **`"DELETE"`**, the SAME version/description/script/checksum,
`execution_time = 0`, and the original row's `success`. The original row STAYS. That is why
`MigrationState.DELETED` exists and why `validate()` returns early on `DELETED`.
Consequences: the table GROWS; `WHERE version = '7'` returns TWO rows; only the highest
`installed_rank` is current.

🔴 **Action 2 also covers FUTURE, not just MISSING:**
```java
state == MISSING_SUCCESS || state == MISSING_FAILED || state == FUTURE_SUCCESS || state == FUTURE_FAILED
```
then filtered by the user's `ignoreMigrationPatterns`. So Boot's default `*:future` is the ONLY
thing stopping `repair` tombstoning rollback residue. Clearing that setting to tighten validation
makes `repair` destructive. Synthetic + undo types are skipped.
⚠️ Note repair's own `MigrationInfoServiceImpl` is built with `ValidatePatternUtils.getIgnoreAllPattern()`
— the user's patterns are re-applied only inside `deleteMissingMigrations`, which is exactly what the
doc sentence *"Only Missing migrations are ignored during repair"* is describing.

**Action 3 is an `UPDATE` keyed on `installed_rank`**, setting description / type / checksum from the
RESOLVED migration (`type` from resolved unless the applied type is synthetic). `updateNeeded` =
checksum || description || type. Skips synthetic applied types and states `UNDONE` / `IGNORED`.
Repeatables take a separate branch guarded by `checksumMatchesWithoutBeingIdentical` (the
equivalentChecksum / placeholder case).

**Two follow-up log lines, quoted on the pages:**
- *"Please ensure the previous contents of the deleted migrations are removed from the database, or moved into an existing migration."*
- *"Manual cleanup of the remaining effects of the failed migration may still be required."* (only when `!database.supportsDdlTransactions()`)

### Spring Boot — verified against `FlywayProperties.java` on main
- 🔴 **`skipExecutingMigrations` EXISTS in Boot** as `spring.flyway.skip-executing-migrations`,
  `private @Nullable Boolean` (no Boot default). Javadoc: *"Whether Flyway should skip executing the
  contents of the migrations and only update the schema history table."* **No Teams tag** → Community.
- 🔴 **There is NO `spring.flyway.repair` property.** The in-process route is a
  `FlywayMigrationStrategy` bean (`flyway.repair(); flyway.migrate();`) — written up as
  *recognise-and-argue-about*, explicitly NOT recommended.
- `ignoreMigrationPatterns = Collections.singletonList("*:future")` re-confirmed.


## FIFTH PASS (2026-08-26) — repeatable migrations + PG replace semantics

### 🔴 A CLAIM I COULD NOT CONFIRM, and the page says so (rule 8 working)
Whether a numeric **`target`** that leaves versioned migrations unrun also prevents a CHANGED
repeatable migration from being applied in that run. The docs only say repeatables run *"after all
pending versioned migrations have been executed"*. Source reading did not settle it:
`DbMigrate` iterates `infoService.pending()` which returns state `PENDING` only, and
`MigrationInfoServiceImpl.pending()` has no target logic of its own.
✅ **What IS settled:** `ResolvedMigration.getState()` guards the `ABOVE_TARGET` branch with
`getVersion() != null`, so **a repeatable migration is NEVER `ABOVE_TARGET`** — it falls through to
`PENDING`. `05` states the settled half and marks the rest unconfirmed.

### PostgreSQL 18 — `CREATE OR REPLACE VIEW`, verbatim
*"the same columns that were generated by the existing view query (that is, the same column names in
the same order and with the same data types), but it may add additional columns to the end of the
list."* … *"the calculations giving rise to the output columns may be completely different"* …
*"only the view's defining SELECT rule, plus any WITH ( ... ) parameters and its CHECK OPTION are
changed. Other view properties, including ownership, permissions, and non-SELECT rules, remain
unchanged."*
→ So: rename / remove / reorder / retype a column ALL need a `DROP VIEW`, and the drop LOSES
ownership, permissions and non-SELECT rules. Source: https://www.postgresql.org/docs/18/sql-createview.html

### PostgreSQL 18 — `CREATE OR REPLACE FUNCTION`, verbatim
*"It is not possible to change the name or argument types of a function this way (if you tried, you
would actually be creating a new, distinct function). Also, CREATE OR REPLACE FUNCTION will not let
you change the return type of an existing function. To do that, you must drop and recreate the
function."* … *"If you drop and then recreate a function, the new function is not the same entity as
the old; you will have to drop existing rules, views, triggers, etc. that refer to the old function."*
🔴 The asymmetry taught: changing ARGUMENT types **silently creates a second overload** (succeeds!),
changing the RETURN type **errors**. Source: https://www.postgresql.org/docs/18/sql-createfunction.html

### Repeatable mechanics, quoted (from the concept page)
*"(re-)applied to a database on migrate every time their checksum changes."* ·
*"within a single migration run, repeatable migrations are always applied last, after all pending
versioned migrations have been executed."* · *"applied in the order of their description (i.e.
alphabetically)."* · *"It is your responsibility to ensure the same repeatable migration can be
applied multiple times. This usually involves making use of CREATE OR REPLACE."*
Failure message (from `MigrationInfoImpl.validate()`): *"Detected failed repeatable migration: <desc>.
Please remove any half-completed changes then run repair to fix the schema history."*


## SIXTH PASS (2026-08-26) — baselining, source-verified

### `DbBaseline.baseline()` — four outcomes, THREE of them refusals
1. **No history table** → `schemaHistory.create(true)` → writes the synthetic `BASELINE` row. Runs
   NO SQL of yours.
2. **Already baselined, SAME version + description** → *"Schema history table <t> already
   initialized with (<v>,<d>). Skipping."* → **idempotent**, safe in a bootstrap script.
3. 🔴 **Already baselined, DIFFERENT version or description** → `FlywayException`
   *"Unable to baseline schema history table <t> with (<v>,<d>) as it has already been baselined
   with (<v>,<d>)"* + a link to its REBASELINING topic. **You CANNOT move a baseline by re-running
   `baseline`.**
4. 🔴 **`hasNonSyntheticAppliedMigrations()`** → `FlywayException` *"…as it already contains
   migrations"*. **You cannot baseline a DB Flyway already manages.** Synthetic rows (SCHEMA,
   BASELINE, DELETE) do not count.
5. Narrow: baseline at version **0** when `hasSchemasMarker()` → *"version 0 as this version was
   used for schema creation"*.

### `ResolvedMigration.getState` — the baseline is compared FIRST
`version < appliedBaseline` → `BELOW_BASELINE`; `== appliedBaseline` → `BASELINE_IGNORED`.
(Uses `pendingBaseline` when `lastApplied == MigrationVersion.EMPTY`, else `appliedBaseline`.)
→ *"excluding all migrations up to AND INCLUDING baselineVersion"* is literally inclusive: baseline
at 5 means V5 never runs.
`ABOVE_TARGET` is checked only when `getVersion() != null` (see FIFTH PASS).

### 🔴🔴 `BaselineResolvedMigration.getState` — the rule that makes `B` migrations safe
```java
if (migrationState == PENDING && migrationsAppliedOrBaselineExists(context)) return IGNORED;
...
private boolean migrationsAppliedOrBaselineExists(ctx) {
    return ctx.appliedBaseline != null || ctx.lastApplied != MigrationVersion.EMPTY;
}
```
**A `B` migration is PENDING only on a database with NO applied migrations and NO baseline row.**
Anything else → `IGNORED`. And `MigrationInfoImpl.validate()` guards the IGNORED error with
`!resolvedMigration.getType().isBaseline()`, so **an ignored baseline migration does NOT fail
validate** — unlike every other IGNORED migration.
`canCompareWith` returns true only for another `BaselineResolvedMigration`; resolved versioned
migrations are keyed on `Pair<version, type>`, so a `V5` and a `B5` are distinct entries.
Types: `SQL_BASELINE` / `JDBC_BASELINE`.

### Boot defaults re-confirmed
`baseline-version` **`1`** (almost always wrong for a real adoption), `baseline-description`
**`<< Flyway Baseline >>`**, `baseline-on-migrate` **`false`**.
`baseline-on-migrate` warning quoted verbatim on 06b: *"Be careful when enabling this as it removes
the safety net that ensures Flyway does not migrate the wrong database in case of a configuration
mistake!"* — written up as: it silently ADOPTS the wrong database instead of failing at startup.

### Link confirmed on disk
`../06-jpa-hibernate-model/17-ddl-auto.md` exists (used from 06b).


## SEVENTH PASS (2026-08-26) — Boot integration + the two `validate`s

### Boot 4.1 Flyway wiring, re-verified
- **Dependencies: TWO artifacts.** *"In-memory and file-based databases are supported by the
  `spring-boot-starter-flyway` starter. Other cases require also a database-specific module. For
  example, use `org.flywaydb:flyway-database-postgresql` with PostgreSQL."*
- `@AutoConfiguration(after = DataSourceAutoConfiguration.class)` ·
  `@ConditionalOnBooleanProperty(name = "spring.flyway.enabled", matchIfMissing = true)` ·
  `@Import(DatabaseInitializationDependencyConfigurer.class)`.
  Beans: `Flyway`, `FlywayMigrationInitializer`, `FlywaySchemaManagementProvider`.
- 🔴 **The ordering guarantee, spelled out:** `FlywayMigrationInitializerDatabaseInitializerDetector`
  marks the initializer as a database initializer; `DatabaseInitializationDependencyConfigurer` adds
  a `dependsOn` from every `@DependsOnDatabaseInitialization` bean (incl. the EntityManagerFactory)
  to it. **That edge is why `ddl-auto: validate` is an assertion and not a race** — and
  `@DependsOnDatabaseInitialization` is the fix for a user's own startup bean that reads the DB.
- `@FlywayDataSource` + *"remember to set the `defaultCandidate` attribute of the `@Bean` annotation
  to `false`"*. · *"Setting either `spring.flyway.url` or `spring.flyway.user` is sufficient to cause
  Flyway to use its own DataSource. If any of the three properties has not been set, the value of its
  equivalent `spring.datasource` property will be used."* (the partial-fallback trap)
- `JavaMigration` beans auto-registered; `Callback` beans auto-registered and `@Order`/`Ordered`-able.
- `locations` REPLACES the default, it does not extend it. `{vendor}` resolves to the detected DB.

### 🔴 THE FRAMING FOR 07b, and it is the page's whole value
**Two tools, two commands both called `validate`, comparing DIFFERENT PAIRS:**
- **Flyway `validate`** = migration FILES ↔ HISTORY TABLE.
- **Hibernate `ddl-auto: validate`** = ENTITY MAPPING ↔ LIVE SCHEMA.
- 🔴 **NOTHING compares the migration files against the live schema.** That is the gap where a
  hand-run `ALTER TABLE` lives. Closing it needs a schema diff against a replayed build (→ topic 11
  testing).
⚠️ Boundary respected: topic 06's `17b` already owns Hibernate's `Schema validation:` message list
and what `validate` catches/misses. 07b links to it and does NOT restate the messages.

### `validate-migration-naming` — Boot default `false`
*"Whether to validate migrations and callbacks whose scripts do not obey the correct naming
convention."* → with the default, **a misnamed file (one underscore instead of two) is SILENTLY not
a migration**: no error, absent from `info`, deployment reports success having applied nothing.
Turning it on can fail startup on stray non-migration files in a migration location.

### Repoint done
`03b-when-a-migration-fails.md` linked `04b-repair-and-when-it-is-legitimate.md` (never existed —
the repair chunks landed as `04d`/`04e`). Read in its own sentence; the sentence was about *what
repair does and does not touch* → repointed to **`04d`**, with `04e` added for the "when".

🔴 **Filenames later chunks must keep, because earlier chunks already link to them:**
`08b-locks-and-long-migrations.md` (from `03b` and `05c`) ·
`09-many-instances-one-database.md` (from `01` and `02b`) ·
`08-migrating-a-live-service.md` (from `01`) · `11-testing-migrations.md` (from `06b`).

---

## ✅ TOPIC CLOSED — 44 chunks + index, session `0f9ee927`, 2026-08-27

`63d413e5` · `fe783c1d` · `8a43b9b0` · `168fbebd` (README) · boards `478ca0bd`.
Positions 0–44, unique and gap-free. **This closed Phase 10 at 14/14.**

### The QC defect was not what the note said

The recorded defect was *"`09-many-instances-one-database.md` is missing its Interview
questions section"*. It was not missing the questions — **six of them were physically inside
the `## Gotchas` block; the heading had been lost, not the content.** The heading was restored
and four more questions added that the chunk's material carried but had not asked. 279 lines,
no split, no renumbering. **Read the file before trusting a defect note about it.**

### Two coordinator reconciliations, both resolved

1. **The fork created 10c/10c2/10c3, which the original dispatch did not name**, shifting
   `11-testing-migrations` from position 34 to 37. That was correct and deliberate: I sent it
   mid-run after the filesystem link audit found `10-data-migrations.md:26` and
   `10b-batching-a-backfill.md:193` both linking `10c-when-it-should-not-be-a-migration.md`,
   which had never been written. `_plan.md` does not name it either.
2. **The fork reported `_moved_bits.txt` / `_moved_body.txt` vanishing mid-session and warned
   its 10c chunks might duplicate them.** They do not. **I deleted those files (`58364fc2`)**
   after verifying passage by passage that their content had landed in
   `09b-what-the-lock-actually-covers.md`. Their subject is the advisory-lock loop and the
   history-table creation race; `10c*`'s subject is whether a data change belongs in a
   migration at all. `10c` *applies* the lock behaviour and links back to `09` for the
   mechanism. Checked before accepting the close.

### Corrections to widely-repeated advice, both documentation-verified

- 🔴 **`@DataJpaTest` never runs Flyway.** `AutoConfigureDataJpa.imports` is two entries
  (`DataJpaRepositoriesAutoConfiguration`, `HibernateJpaAutoConfiguration`);
  `AutoConfigureJdbc.imports` is six. **`FlywayAutoConfiguration` is on neither.** Combined
  with Boot's *"If an embedded database is identified and no schema manager (Flyway or
  Liquibase) has been detected, `ddl-auto` defaults to `create-drop`"*, the slice tests a
  schema **Hibernate generated from the entities** — which makes `ddl-auto: validate` in that
  slice a comparison of Hibernate against Hibernate. Written up in `11c`.
- **`@AutoConfigureTestDatabase(replace = NONE)` is usually unnecessary on Boot 4.** The
  javadoc default is `Replace.NON_TEST`, which explicitly exempts *"Any bean definition that
  includes `ContainerImageMetadata` (including `@ServiceConnection` annotated Testcontainers
  databases…)"*, `@DynamicPropertySource`-backed URLs and Testcontainers JDBC-syntax URLs.
  This confirms the same correction made against topic 04 in an earlier batch.

### Could not confirm — no edition or version claim was made

- **Flyway edition of `executeInTransaction`, `batch`, `target`, `cleanDisabled`.** Red-gate's
  reference pages carry no edition tag on any of them. Defaults and behaviour stated; **no
  edition claimed.** The only edition claim in the topic remains the banked one: undo is Teams.
- **Testcontainers `PostgreSQLContainer` package at the exact 2.0.5 tag.** Verified on `main`
  (the generic `org.testcontainers.containers.PostgreSQLContainer<SELF>` is `@Deprecated` in
  favour of `org.testcontainers.postgresql.PostgreSQLContainer`); Boot 4.1 pins
  `testcontainers-postgresql:2.0.5`. Written as "moved in Testcontainers 2", not as a
  2.0.5-specific assertion.
- **Whether H2's `MODE=PostgreSQL` supports any individual construct.** H2 documents only what
  the mode *changes*, never a full unsupported list, so the table says "on H2's published
  PostgreSQL-mode list: No" and nothing stronger.

### Quotes banked

- **H2** (*Features · Compatibility Modes*): *"only a small subset of the differences between
  databases are implemented in this way."*
- **Boot** (*Database Initialization*): *"If an embedded database is identified and no schema
  manager (Flyway or Liquibase) has been detected, `ddl-auto` defaults to `create-drop`. In all
  other cases, it defaults to `none`."*
- **Boot** (*Testcontainers*): *"the connection details take precedence over any
  connection-related configuration properties."*
- **PostgreSQL 18** (`ALTER TABLE`): *"if a valid `CHECK` constraint exists (and is not dropped
  in the same command) which proves no `NULL` can exist, then the table scan is skipped."*
- **Testcontainers** (*Reusable Containers*): *"Reusable containers are not suited for CI usage
  and as an experimental feature not all Testcontainers features are fully working."*
- **Flyway** (`cleanDisabled`, default `true`): *"especially useful for production environments
  where running clean can be a career limiting move."*
- **Source fact worth reusing:** `PostgreSQLContainer` starts the server with
  `setCommand("postgres", "-c", "fsync=off")` — **the container is never a place to measure
  write cost.**
