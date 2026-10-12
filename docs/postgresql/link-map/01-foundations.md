---
title: "Link map · PostgreSQL · Part 1 (phases 0–2)"
sidebar_label: "01 · Foundations"
sidebar_position: 1
---

# Link map · PostgreSQL · Part 1 (phases 0–2)

Covers the topic rows of `docs/postgresql/syllabus/01-foundations.md` for phase 0 (T00-01 to T00-12), phase 1 (T01-01 to T01-15) and phase 2 (T02-01 to T02-18). Phase 3 (T03-01 to T03-20) continues in `01-foundations-b.md`, because one file would pass the 300-line cap.
All 45 are ✅ written here. *read* = passage read; *headings only* = fetched, headings/size checked. `#anchors` appear only where the id was found in the page HTML (the manual writes them in capitals).

🔴 **Version note.** On 2026-10-12 postgresql.org/support/versioning/ lists **18.6** as the current minor of major 18 (first release 2025-09-25, final release 2030-11-14), and the `/docs/current/` footer reads 18.6. Our syllabus README still says 18.4: bump the `> Verified:` lines to the minor you actually tested. PostgreSQL 19 is in beta (Beta 4 on the home page, 2026-09-24), so `/docs/current/` is still 18. Manual links below use `/docs/current/`.

---

## Phase 0 — PostgreSQL and its architecture

### T00-01 · The client/server model — Master · ✅ written `docs/postgresql/pages/phase-0-architecture/02-client-server-model.md`
- **Read this:** [How to Manage Connections Efficiently in Postgres](https://brandur.org/postgres-connections) · brandur.org · postmaster forks a backend per connection, each starting around 5 MB, then why pools and PgBouncer follow (*read*; published 2018-10-15) · covers our angle: full
- **Also good:** [Architectural Fundamentals](https://www.postgresql.org/docs/current/tutorial-arch.html) · postgresql.org · short official statement that the server forks a new process per connection (*read*) · [Number Of Database Connections](https://wiki.postgresql.org/wiki/Number_Of_Database_Connections) · postgresql.org wiki · why throughput falls past a "knee" (*read*; last edited 2014-03-14) · fetched 2026-10-12
- **Our delta:** the 2018 article predates PostgreSQL 18; keep the per-backend size as "order of 5 MB, grows" and measure on 18.

### T00-02 · Cluster → database → schema → table — Master · ✅ written `docs/postgresql/pages/phase-0-architecture/03-namespace.md`
- **Read this (1/2):** [Managing Databases · Overview](https://www.postgresql.org/docs/current/manage-ag-overview.html) · postgresql.org · states the full hierarchy cluster, database, schema, table and which objects are cluster-wide (*read*) · covers our angle: full for the four levels · fetched 2026-10-12
- **Read this (2/2):** [Schemas](https://www.postgresql.org/docs/current/ddl-schemas.html) · postgresql.org · schema creation, the public schema and the search path (headings only; ids `DDL-SCHEMAS-PATH`, `DDL-SCHEMAS-PUBLIC`) · fetched 2026-10-12
- **Our delta:** the `search_path` confusion week (unqualified names, a role-named schema) is ours.

### T00-03 · What PostgreSQL is, "object-relational", license and governance — Understand · ✅ written `docs/postgresql/pages/phase-0-architecture/01-what-postgresql-is.md`
- **Read this:** [What Is PostgreSQL?](https://www.postgresql.org/docs/current/intro-whatis.html) · postgresql.org · calls it an object-relational DBMS descended from POSTGRES 4.2 at Berkeley (*read*) · covers our angle: **partial** — nothing on license or governance · fetched 2026-10-12
- **Also good:** [PostgreSQL License](https://www.postgresql.org/about/licence/) · postgresql.org · "a liberal Open Source license, similar to the BSD or MIT" (*read*) · fetched 2026-10-12
- **Our delta:** "what object-relational buys you" (types, inheritance, extensibility) and the governance model: no governance page was opened, so it stays **not confirmed**.

### T00-04 · Shared buffers, the OS page cache, where a row lives — Understand · ✅ written `docs/postgresql/pages/phase-0-architecture/04-shared-buffers.md`
- **Read this:** [Resource Consumption · Memory](https://www.postgresql.org/docs/current/runtime-config-resource.html) · postgresql.org · `shared_buffers` default 128 MB, 25% of RAM as a start, and PostgreSQL also relies on the OS cache (*read*) · covers our angle: **partial** — a config reference, not a walk of a read · fetched 2026-10-12
- **Also good:** [Database Page Layout](https://www.postgresql.org/docs/current/storage-page-layout.html) · postgresql.org · tables and indexes are arrays of fixed pages, usually 8 kB (*read*) · [pg_buffercache](https://www.postgresql.org/docs/current/pgbuffercache.html) · postgresql.org · inspect the shared buffer cache live (*read* intro) · fetched 2026-10-12
- **Our delta:** the double-buffering story (shared buffers plus OS cache) as one picture.

### T00-05 · WAL — why every change is written twice — Understand · ✅ written `docs/postgresql/pages/phase-0-architecture/05-wal.md`
- **Read this:** [Write-Ahead Logging · Reliability](https://www.postgresql.org/docs/current/wal-intro.html) · postgresql.org · log first, no data-page flush per commit, REDO after a crash (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Reliability](https://www.postgresql.org/docs/current/wal-reliability.html) · postgresql.org · fsync and what a durable commit needs (headings only)
- **Our delta:** `synchronous_commit` as the knob behind "durability, concretely" is not in the page above.

### T00-06 · Roles, users and groups — Understand · ✅ written `docs/postgresql/pages/phase-0-architecture/06-roles.md`
- **Read this:** [Database Roles](https://www.postgresql.org/docs/current/database-roles.html) · postgresql.org · roles are separate from OS users and global to the cluster (*read*) · covers our angle: full for "one concept" · fetched 2026-10-12
- **Also good:** [Role Membership](https://www.postgresql.org/docs/current/role-membership.html) · postgresql.org · groups are roles; the `INHERIT` option decides whether privileges flow (*read*) · fetched 2026-10-12
- **Our delta:** "user" and "group" are only a `LOGIN` attribute and membership.

### T00-07 · Installing for local development — Understand · ✅ written `docs/postgresql/pages/phase-0-architecture/07-local-install.md`
- **Read this:** [postgres (Docker Official Image)](https://hub.docker.com/_/postgres) · hub.docker.com · env vars, compose example, and the 18 change: `PGDATA` is now version-specific and the `VOLUME` is `/var/lib/postgresql` (*read*) · covers our angle: **partial** — Docker only, no Podman, no "why not native" · fetched 2026-10-12
- **Our delta:** 🔴 the volume path moved in 18, so a mount copied from older tutorials hides the data. Podman, the `127.0.0.1` binding and the argument against a native install are ours.

### T00-08 · Connection strings, `PG*` env vars, `.pgpass`, `pg_hba.conf` — Understand · ✅ written `docs/postgresql/pages/phase-0-architecture/08-connection-and-auth.md`
- **Read this (1/2):** [Database Connection Control Functions](https://www.postgresql.org/docs/current/libpq-connect.html) · postgresql.org · key/value strings and `postgresql://` URIs, parameter keywords (*read*; ids `LIBPQ-CONNSTRING`, `LIBPQ-PARAMKEYWORDS`) · covers our angle: **partial** — libpq, not `pg` · fetched 2026-10-12
- **Read this (2/2):** [The pg_hba.conf File](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html) · postgresql.org · method list: `trust` lets anyone log in as any user (*read*) · fetched 2026-10-12
- **Also good:** [Environment Variables](https://www.postgresql.org/docs/current/libpq-envars.html) · postgresql.org · `PGHOST` etc. mirror the connection parameters (*read*) · [The Password File](https://www.postgresql.org/docs/current/libpq-pgpass.html) · postgresql.org · ignored unless mode is `0600` (*read*)
- **Our delta:** how `pg` reads `PG*` variables and connection URIs: not opened, **not confirmed**.

### T00-09 · Postmaster, backends, background workers, WAL writer, checkpointer, autovacuum — Know · ✅ written `docs/postgresql/pages/phase-0-architecture/09-process-model.md`
- **Read this:** [Glossary](https://www.postgresql.org/docs/current/glossary.html) · postgresql.org · defines instance, postmaster, backend, auxiliary processes (autovacuum launcher, background writer, checkpointer, WAL writer) (*read*) · covers our angle: full as definitions · fetched 2026-10-12
- **Our delta:** a live `pg_stat_activity` listing by `backend_type` on 18 (page not opened).

### T00-10 · Version policy — majors, minors, five-year window, what 18 changed — Know · ✅ written `docs/postgresql/pages/phase-0-architecture/10-version-policy.md`
- **Read this (1/2):** [Versioning Policy](https://www.postgresql.org/support/versioning/) · postgresql.org · table of current minors and final-release dates; 18 runs to 2030-11-14 (*read*) · covers our angle: full · fetched 2026-10-12
- **Read this (2/2):** [Release 18](https://www.postgresql.org/docs/current/release-18.html) · postgresql.org · release date 2025-09-25, overview and migration notes (*read* intro; ids `RELEASE-18-HIGHLIGHTS`, `RELEASE-18-MIGRATION`) · fetched 2026-10-12
- **Our delta:** the table is dated: re-read it before each `> Verified:` bump.

### T00-11 · PostgreSQL vs MySQL vs SQLite — Know · ✅ written `docs/postgresql/pages/phase-0-architecture/11-vs-other-databases/` (`README.md`, `01-outdated-folklore.md`, `02-real-differences.md`)
- **Read this:** [Appropriate Uses For SQLite](https://www.sqlite.org/whentouse.html) · sqlite.org · SQLite is not directly comparable to client/server engines; one writer at a time (*read*) · covers our angle: **partial** — SQLite side only, written by SQLite's authors · fetched 2026-10-12
- **Our delta:** no neutral, current MySQL comparison was found (tried: three searches that returned only vendor and aggregator posts). The MySQL column must come from MySQL's own manual, **not confirmed**.

### T00-12 · `template0`/`template1`, the `postgres` database, what `CREATE DATABASE` copies — When Needed · ✅ written `docs/postgresql/pages/phase-0-architecture/12-templates.md`
- **Read this:** [Template Databases](https://www.postgresql.org/docs/current/manage-ag-templatedbs.html) · postgresql.org · `CREATE DATABASE` copies `template1`; `template0` is the pristine copy (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Creating a Database](https://www.postgresql.org/docs/current/manage-ag-createdb.html) · postgresql.org · the initial `postgres` database (*read*) · [CREATE DATABASE](https://www.postgresql.org/docs/current/sql-createdatabase.html) · postgresql.org · `TEMPLATE` and `STRATEGY` options in the synopsis (*read*)

---

## Phase 1 — `psql`, mastered

The manual's `psql` reference is one long page, so each block gives the anchor of the part to read.

### T01-01 · Connecting — Master · ✅ written `docs/postgresql/pages/phase-1-psql/01-connecting.md`
- **Read this (1/2):** [psql · Connecting to a Database](https://www.postgresql.org/docs/current/app-psql.html) · postgresql.org · host, port, user, database from flags, URI or conninfo (*read*; options `#APP-PSQL-OPTION-DBNAME`) · covers our angle: **partial** — nothing on containers · fetched 2026-10-12
- **Read this (2/2):** [Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING) · postgresql.org · URI grammar `postgresql://[user[:password]@][host][:port][/dbname]` (*read*) · fetched 2026-10-12
- **Our delta:** `podman exec -it … psql` and the `127.0.0.1` rule.

### T01-02 · The daily meta-commands — Master · ✅ written `docs/postgresql/pages/phase-1-psql/02-daily-meta-commands.md`
- **Read this:** [psql · Meta-Commands](https://www.postgresql.org/docs/current/app-psql.html#APP-PSQL-META-COMMANDS) · postgresql.org · `\l`, `\c`, `\dt`, `\dn`, `\df`, `\di`, `\dv`, `\ds` each defined; ids `APP-PSQL-META-COMMAND-LIST`, `-C-LC`, `-DT`, `-DN` (*read* the command list) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the `S` and `+` suffixes and patterns (`#APP-PSQL-PATTERNS`) as one cheat table.

### T01-03 · `\d` and `\d+ table` in full — Master · ✅ written `docs/postgresql/pages/phase-1-psql/03-describe-table.md`
- **Read this:** [psql · `\d`](https://www.postgresql.org/docs/current/app-psql.html#APP-PSQL-META-COMMAND-D) · postgresql.org · what `\d[S+] name` shows and what `+` adds (headings only: the `\d` text was located by id, not read to the end) · covers our angle: **partial** · fetched 2026-10-12
- **Our delta:** reading each output section (columns, indexes, constraints, FKs, triggers) by example is ours.

### T01-04 · Output control — `\x`, `\pset`, `\t`, `--csv` — Master · ✅ written `docs/postgresql/pages/phase-1-psql/04-output-control.md`
- **Read this:** [psql · `\pset`](https://www.postgresql.org/docs/current/app-psql.html#APP-PSQL-META-COMMAND-PSET) · postgresql.org · every format option; `--csv` equals `\pset format csv` (*read* the `--csv` entry) · covers our angle: full · fetched 2026-10-12
- **Also good:** `\x` at `#APP-PSQL-META-COMMAND-X`, `\t` at `#APP-PSQL-META-COMMAND-T-LC`, option `#APP-PSQL-OPTION-CSV` (same page)

### T01-05 · `\?` and `\h <SQL>` — Master · ✅ written `docs/postgresql/pages/phase-1-psql/05-help.md`
- **Read this:** [psql · `\?` and `\h`](https://www.postgresql.org/docs/current/app-psql.html#APP-PSQL-META-COMMAND-HELP) · postgresql.org · `\h` prints SQL syntax help; `\?` lists backslash commands (id `APP-PSQL-META-COMMAND-QUESTION-MARK`) (headings only) · covers our angle: **partial** · fetched 2026-10-12
- **Our delta:** showing that `\h` output matches the installed 18.x server is the point of the page.

### T01-06 · Scripting `psql` — `-c`, `-f`, `-A -t`, `ON_ERROR_STOP`, exit codes — Understand · ✅ written `docs/postgresql/pages/phase-1-psql/06-scripting.md`
- **Read this:** [psql · Exit Status and `ON_ERROR_STOP`](https://www.postgresql.org/docs/current/app-psql.html#APP-PSQL-VARIABLES-ON-ERROR-STOP) · postgresql.org · exit code 3 when a script errors with `ON_ERROR_STOP` set, 2 for a bad connection in a non-interactive session; `-1` wraps a script in one transaction (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** a CI snippet. The doc says `-1` does not combine with `BEGIN`/`COMMIT` inside the file.

### T01-07 · The query buffer — `\e`, `\p`, `\r`, `\g`, `\gx`, semicolons — Understand · ✅ written `docs/postgresql/pages/phase-1-psql/07-query-buffer.md`
- **Read this:** [psql · Meta-Commands](https://www.postgresql.org/docs/current/app-psql.html#APP-PSQL-META-COMMANDS) · postgresql.org · ids `APP-PSQL-META-COMMAND-EDIT`, `-PRINT`, `-RESET`, `-G`, `-GX`, `-SEMICOLON` (ids found in the HTML; entries not read) · covers our angle: **partial** · fetched 2026-10-12
- **Our delta:** "semicolon discipline" is ours; `\;` is a documented entry.

### T01-08 · Variables — `\set`, `:var`, `:'var'`, `:"var"` — Understand · ✅ written `docs/postgresql/pages/phase-1-psql/08-variables.md`
- **Read this:** [psql · SQL Interpolation](https://www.postgresql.org/docs/current/app-psql.html#APP-PSQL-INTERPOLATION) · postgresql.org · the three colon forms, `:{?name}` to test a variable (*read*) · covers our angle: **partial** — the trap list is ours · fetched 2026-10-12
- **Also good:** `#APP-PSQL-VARIABLES` (same page) for the special variables.

### T01-09 · `\copy` vs server-side `COPY` — Understand · ✅ written `docs/postgresql/pages/phase-1-psql/09-copy.md`
- **Read this (1/2):** [psql · `\copy`](https://www.postgresql.org/docs/current/app-psql.html#APP-PSQL-META-COMMANDS-COPY) · postgresql.org · a frontend copy: the client reads or writes the file (*read*) · covers our angle: full · fetched 2026-10-12
- **Read this (2/2):** [COPY](https://www.postgresql.org/docs/current/sql-copy.html) · postgresql.org · with a file name the server reads or writes it, and the file must be accessible to the server's user (*read*) · fetched 2026-10-12

### T01-10 · `\timing` and `\watch` — Understand · ✅ written `docs/postgresql/pages/phase-1-psql/10-timing-watch.md`
- **Read this:** [psql · `\watch`](https://www.postgresql.org/docs/current/app-psql.html#APP-PSQL-META-COMMAND-WATCH) · postgresql.org · `interval`, `count`, `min_rows` parameters; stops on error (*read*); `\timing` is `#APP-PSQL-META-COMMAND-TIMING` · covers our angle: **partial** · fetched 2026-10-12

### T01-11 · `\i` and `\ir` — Understand · ✅ written `docs/postgresql/pages/phase-1-psql/11-include-files.md`
- **Read this:** [psql · `\ir`](https://www.postgresql.org/docs/current/app-psql.html#APP-PSQL-META-COMMAND-INCLUDE-RELATIVE) · postgresql.org · from a script, `\ir` resolves names relative to the script (*read*); `\i` is `#APP-PSQL-META-COMMAND-INCLUDE` · covers our angle: **partial** — no re-runnable seed pattern · fetched 2026-10-12
- **Our delta:** the idempotent seed script.

### T01-12 · `\conninfo`, `\du`, `\dp`/`\z` — Understand · ✅ written `docs/postgresql/pages/phase-1-psql/12-who-and-privileges.md`
- **Read this:** [Privileges](https://www.postgresql.org/docs/current/ddl-priv.html) · postgresql.org · the aclitem format and the table of letters (`arwdDxtm`) that `\dp` prints (*read*) · covers our angle: **partial** — `\conninfo` and `\du` are in the psql page · fetched 2026-10-12
- **Also good:** psql entries `#APP-PSQL-META-COMMAND-CONNINFO`, `#APP-PSQL-META-COMMAND-DU`, `#APP-PSQL-META-COMMAND-DP-LC`, `#APP-PSQL-META-COMMAND-Z`

### T01-13 · `.psqlrc`, prompt, `HISTFILE`, autocomplete — Know · ✅ written `docs/postgresql/pages/phase-1-psql/13-psqlrc.md`
- **Read this:** [psql · Files · `psqlrc`](https://www.postgresql.org/docs/current/app-psql.html#APP-PSQL-FILES-PSQLRC) · postgresql.org · startup file rules; prompting is `#APP-PSQL-PROMPTING`, `HISTFILE` is `#APP-PSQL-VARIABLES-HISTFILE` (headings only) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [Magic Tricks for Postgres psql](https://www.crunchydata.com/blog/magic-tricks-for-postgres-psql-settings-presets-cho-and-saved-queries) · Crunchy Data · worked `.psqlrc` with `\x auto`, `HISTFILE`, `PROMPT1` (*read*; undated page; one snippet carries a stray "CHECK IF THIS IS RIGHT" note) · [Customizing My Postgres Shell](https://www.citusdata.com/blog/2017/07/16/customizing-my-postgres-shell-using-psqlrc/) · Citus Data · 2017-07-16 (headings only)

### T01-14 · `\errverbose` and `VERBOSITY verbose` — Know · ✅ written `docs/postgresql/pages/phase-1-psql/14-errverbose.md`
- **Read this (1/2):** [psql · `\errverbose`](https://www.postgresql.org/docs/current/app-psql.html#APP-PSQL-META-COMMAND-ERRVERBOSE) · postgresql.org · repeats the last error at maximum verbosity (*read*) · covers our angle: **partial** — nothing on Node · fetched 2026-10-12
- **Read this (2/2):** [PostgreSQL Error Codes](https://www.postgresql.org/docs/current/errcodes-appendix.html) · postgresql.org · test the five-character SQLSTATE, not the message text (*read*) · fetched 2026-10-12
- **Our delta:** reading `err.code` in `pg`: not opened, **not confirmed**.

### T01-15 · Piping `psql` into other tools and reports — When Needed · ✅ written `docs/postgresql/pages/phase-1-psql/15-piping.md`
- **Read this:** [psql · Options](https://www.postgresql.org/docs/current/app-psql.html#APP-PSQL-OPTION-NO-ALIGN) · postgresql.org · `-A`, `-t`, `-F`, `--csv` for machine-readable output; stdin works as in the heredoc example (*read*) · covers our angle: **partial** · fetched 2026-10-12

---

## Phase 2 — Data types and the relational model

`pg` hands most types back as strings unless a parser is registered; the node-postgres [Data Types](https://node-postgres.com/features/types) page says so for unregistered types and shows uuid, json/jsonb and date/timestamp/timestamptz (*read*, fetched 2026-10-12). It does **not** name `int8` or `numeric` in the text I read, so "bigint and numeric arrive as strings" is **not confirmed** there.

### T02-01 · `integer` / `bigint` / `smallint` — Master · ✅ written `docs/postgresql/pages/phase-2-types/01-integers.md`
- **Read this:** [Numeric Types · Integer Types](https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-INT) · postgresql.org · range table: smallint ±32767, integer ±2147483647, bigint ±9223372036854775807 (*read*) · covers our angle: **partial** — why identifiers are `bigint` is not argued · fetched 2026-10-12
- **Our delta:** overflow behaviour and the `pg` return type for `bigint`.

### T02-02 · `numeric` vs `real`/`double precision` — Master · ✅ written `docs/postgresql/pages/phase-2-types/02-numeric-vs-float.md`
- **Read this:** [Numeric Types](https://www.postgresql.org/docs/current/datatype-numeric.html) · postgresql.org · `numeric` is exact up to 131072 digits before the point; ids `DATATYPE-NUMERIC-DECIMAL`, `DATATYPE-FLOAT` (*read* the table, headings only for the float notes) · covers our angle: **partial** — nothing on `pg` · fetched 2026-10-12
- **Also good:** [Working with Money in Postgres](https://www.crunchydata.com/blog/working-with-money-in-postgres) · Crunchy Data · shows `0.0001::float4` summed three times giving 0.00029999999 (*read*; undated)

### T02-03 · `text` vs `varchar(n)` vs `char(n)` — Master · ✅ written `docs/postgresql/pages/phase-2-types/03-text.md`
- **Read this:** [Character Types](https://www.postgresql.org/docs/current/datatype-character.html) · postgresql.org · "no performance difference among these three types" apart from padding storage (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Don't Do This](https://wiki.postgresql.org/wiki/Don%27t_Do_This) · postgresql.org wiki · sections "Don't use char(n)" and "Don't use varchar(n) by default" (*read* the varchar section; page last edited 2024-11-21)

### T02-04 · `timestamptz` vs `timestamp` — Master · ✅ written `docs/postgresql/pages/phase-2-types/04-timestamptz.md`
- **Read this:** [Don't Do This · timestamp](https://wiki.postgresql.org/wiki/Don%27t_Do_This) · postgresql.org wiki · `timestamptz` stores a point in time (microseconds since 2000-01-01 UTC), not a zone (*read*; last edited 2024-11-21) · covers our angle: full for the choice · fetched 2026-10-12
- **Also good:** [Date/Time Types](https://www.postgresql.org/docs/current/datatype-datetime.html) · postgresql.org · "stored internally in UTC", shown in `TimeZone` (*read*)
- **Our delta:** what `pg` returns: a JavaScript `Date` for `timestamptz` per the node-postgres types page.

### T02-05 · Time zones — Master · ✅ written `docs/postgresql/pages/phase-2-types/05-time-zones.md`
- **Read this (1/2):** [Date/Time Types · Time Zones](https://www.postgresql.org/docs/current/datatype-datetime.html#DATATYPE-TIMEZONES) · postgresql.org · three ways to name a zone; conversion on output by `TimeZone` (*read*) · covers our angle: **partial** · fetched 2026-10-12
- **Read this (2/2):** [AT TIME ZONE and AT LOCAL](https://www.postgresql.org/docs/current/functions-datetime.html#FUNCTIONS-DATETIME-ZONECONVERT) · postgresql.org · (headings only) · fetched 2026-10-12
- **Also good:** [Don't Do This](https://wiki.postgresql.org/wiki/Don%27t_Do_This) · heading "Don't use +/-HH:mm as a text Time Zone name" (headings only)

### T02-06 · `NULL` semantics — Master · ✅ written `docs/postgresql/pages/phase-2-types/06-null.md`
- **Read this (1/2):** [Comparison Functions and Operators](https://www.postgresql.org/docs/current/functions-comparison.html) · postgresql.org · `IS DISTINCT FROM` treats null as comparable (*read*) · covers our angle: **partial** · fetched 2026-10-12
- **Read this (2/2):** [Conditional Expressions](https://www.postgresql.org/docs/current/functions-conditional.html) · postgresql.org · `COALESCE` and `NULLIF` (headings only; ids `FUNCTIONS-COALESCE-NVL-IFNULL`, `FUNCTIONS-NULLIF`) · fetched 2026-10-12
- **Also good:** [The NULL in your NOT IN](https://boringsql.com/posts/not-in-null/) · boringSQL · 2026-06-14 · says a fix is landing in PostgreSQL 19: **not confirmed** (headings only)
- **Our delta:** NULL in aggregates and in unique keys (see T03-08).

### T02-07 · `uuid` — `gen_random_uuid()`, UUIDv7 in 18, uuid vs `bigint` — Understand · ✅ written `docs/postgresql/pages/phase-2-types/07-uuid.md`
- **Read this:** [A deeper look at old UUIDv4 vs new UUIDv7 in PostgreSQL 18](https://www.credativ.de/en/blog/postgresql-en/a-deeper-look-at-old-uuidv4-vs-new-uuidv7-in-postgresql-18/) · credativ · 2025-12-05 · `uuidv7()` is new in 18, `uuidv4()` aliases `gen_random_uuid()`, v7 is time-ordered (*read* the intro) · covers our angle: **partial** — I did not read its benchmark section · fetched 2026-10-12
- **Also good:** [UUID Functions](https://www.postgresql.org/docs/current/functions-uuid.html) · postgresql.org · `uuidv7([shift interval])` (*read*) · [UUID Type](https://www.postgresql.org/docs/current/datatype-uuid.html) · postgresql.org · RFC 9562 (*read*)
- **Our delta:** uuid vs `bigint` as a key is argued in the Cybertec article under T03-02.

### T02-08 · `jsonb` vs `json` — Understand · ✅ written `docs/postgresql/pages/phase-2-types/08-jsonb.md`
- **Read this:** [JSON Types](https://www.postgresql.org/docs/current/datatype-json.html) · postgresql.org · `jsonb` drops whitespace, key order and duplicate keys (last wins); prefer `jsonb` (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** `pg` parses both into JavaScript objects.

### T02-09 · `boolean` and three-valued logic — Understand · ✅ written `docs/postgresql/pages/phase-2-types/09-boolean-dates.md`
- **Read this:** [Logical Operators](https://www.postgresql.org/docs/current/functions-logical.html) · postgresql.org · SQL uses true, false and null as "unknown", with AND/OR/NOT truth tables (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Boolean Type](https://www.postgresql.org/docs/current/datatype-boolean.html) · postgresql.org (headings only)

### T02-10 · `date`, `time`, `interval`, date arithmetic — Understand · ✅ written `docs/postgresql/pages/phase-2-types/09-boolean-dates.md`
- **Read this (1/2):** [Date/Time Types](https://www.postgresql.org/docs/current/datatype-datetime.html) · postgresql.org · input and output formats, interval input; ids `DATATYPE-INTERVAL-INPUT`, `DATATYPE-DATETIME-INPUT` (headings only) · covers our angle: **partial** · fetched 2026-10-12
- **Read this (2/2):** [Date/Time Functions and Operators](https://www.postgresql.org/docs/current/functions-datetime.html) · postgresql.org · `EXTRACT`, `date_trunc`, `date_bin` (headings only) · fetched 2026-10-12

### T02-11 · Arrays — Understand · ✅ written `docs/postgresql/pages/phase-2-types/10-arrays.md`
- **Read this:** [Arrays](https://www.postgresql.org/docs/current/arrays.html) · postgresql.org · declaration, accessing, searching; tip: searching for elements "can be a sign of database misdesign", use a child table (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Array Functions and Operators](https://www.postgresql.org/docs/current/functions-array.html) · postgresql.org (headings only)

### T02-12 · `enum` vs `CHECK` vs lookup table — Understand · ✅ written `docs/postgresql/pages/phase-2-types/11-enum-check-lookup.md`
- **Read this:** [What is better: a lookup table or an enum type?](https://www.cybertec-postgresql.com/en/lookup-table-or-enum-type/) · CYBERTEC · 2025-12-02 · compares string plus `CHECK`, enum and lookup table, including `ALTER TYPE … RENAME VALUE` (*read* the enum part) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Enums vs Check Constraints in Postgres](https://www.crunchydata.com/blog/enums-vs-check-constraints-in-postgres) · Crunchy Data · undated (headings only) · [We need to talk about ENUMs](https://notso.boringsql.com/posts/postgresql-enums) · boringSQL · 2024-09-04 (headings only)
- **Our delta:** how each fails on change, shown from `pg`.

### T02-13 · Casting — Understand · ✅ written `docs/postgresql/pages/phase-2-types/12-casting.md`
- **Read this:** [Type Conversion](https://www.postgresql.org/docs/current/typeconv.html) · postgresql.org · implicit conversions "can affect the results of a query"; tailor with explicit conversion (*read* the intro) · covers our angle: **partial** — nothing on the cast that disables an index · fetched 2026-10-12
- **Also good:** [Type Casts](https://www.postgresql.org/docs/current/sql-expressions.html#SQL-SYNTAX-TYPE-CASTS) · postgresql.org · `::` and `CAST` (headings only)
- **Our delta:** the index-killing cast is ours.

### T02-14 · `bytea` and binary data — Know · ✅ written `docs/postgresql/pages/phase-2-types/13-bytea.md`
- **Read this:** [Binary Data Types](https://www.postgresql.org/docs/current/datatype-binary.html) · postgresql.org · hex and escape formats (headings only; ids `DATATYPE-BINARY-BYTEA-HEX-FORMAT`) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [BinaryFilesInDB](https://wiki.postgresql.org/wiki/BinaryFilesInDB) · postgresql.org wiki · "When should files be stored in the database?" (headings only)

### T02-15 · Network types, geometric types, `citext` — Know · ✅ written `docs/postgresql/pages/phase-2-types/14-network-geo-citext.md`
- **Read this (1/2):** [Network Address Types](https://www.postgresql.org/docs/current/datatype-net-types.html) · postgresql.org · `inet`, `cidr`, and `inet` vs `cidr` (headings only; id `DATATYPE-INET-VS-CIDR`) · covers our angle: **partial** · fetched 2026-10-12
- **Read this (2/2):** [citext](https://www.postgresql.org/docs/current/citext.html) · postgresql.org · calls `lower` when comparing; tip suggests nondeterministic collations as an alternative (*read* the intro) · fetched 2026-10-12
- **Also good:** [Geometric Types](https://www.postgresql.org/docs/current/datatype-geometric.html) · postgresql.org (headings only)

### T02-16 · Domains and composite types — Know · ✅ written `docs/postgresql/pages/phase-2-types/15-domains-composites.md`
- **Read this (1/2):** [CREATE DOMAIN](https://www.postgresql.org/docs/current/sql-createdomain.html) · postgresql.org · (headings only) · covers our angle: **partial** · fetched 2026-10-12
- **Read this (2/2):** [Composite Types](https://www.postgresql.org/docs/current/rowtypes.html) · postgresql.org · declaring, constructing, accessing (headings only; ids `ROWTYPES-DECLARING`, `ROWTYPES-ACCESSING`) · fetched 2026-10-12

### T02-17 · Range types and exclusion constraints — When Needed · ✅ written `docs/postgresql/pages/phase-2-types/16-ranges.md`
- **Read this:** [Range Types](https://www.postgresql.org/docs/current/rangetypes.html) · postgresql.org · built-in range and multirange types, bounds, indexing, and a "Constraints on Ranges" part (headings only; id `RANGETYPES-CONSTRAINT`) · covers our angle: full by headings · fetched 2026-10-12
- **Also good:** [Constraints · Exclusion Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-EXCLUSION) · postgresql.org · `EXCLUDE USING gist` builds an index automatically (*read*)

### T02-18 · Modelling money — Master · ✅ written `docs/postgresql/pages/phase-2-types/17-modelling-money/` (`README.md`, `01-storing-money.md`, `02-arithmetic-and-rounding.md`, `03-ledgers-and-node.md`)
- **Read this:** [Working with Money in Postgres](https://www.crunchydata.com/blog/working-with-money-in-postgres) · Crunchy Data · money, floats, integers and numeric compared; integer math makes 100/3 equal 33 (*read*; undated) · covers our angle: **partial** — nothing on a ledger shape · fetched 2026-10-12
- **Also good:** [Don't Do This · money](https://wiki.postgresql.org/wiki/Don%27t_Do_This) · postgresql.org wiki · `money` follows `lc_monetary`, so changing it makes stored values wrong (*read*) · [Why Is numeric So Popular in PostgreSQL Databases?](https://www.pgedge.com/blog/why-is-numeric-so-popular-in-postgresql-databases) · pgEdge · long argument for `numeric` (headings only)
- **Our delta:** the ledger shape and rounding rule for splits.
