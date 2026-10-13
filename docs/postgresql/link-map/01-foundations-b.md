---
title: "Link map · PostgreSQL · Part 1 (phase 3)"
sidebar_label: "01b · Foundations (DDL)"
sidebar_position: 2
---

# Link map · PostgreSQL · Part 1 (phase 3)

Continues `01-foundations.md`: phase 3, the 20 topic rows T03-01 to T03-20 of `docs/postgresql/syllabus/01-foundations.md` (the file was split to stay under the 300-line cap).
All 20 are ✅ written. *read* = passage read; *headings only* = fetched, headings/size checked. `#anchors` appear only where the id was found in the page HTML (the manual writes them in capitals). Manual links use `/docs/current/`, which showed PostgreSQL 18.6 on 2026-10-12.

---

## Phase 3 — DDL: tables, constraints, schema design

### T03-01 · `CREATE TABLE` — Master · ✅ written `docs/postgresql/pages/phase-3-ddl/01-create-table.md`
- **Read this:** [Table Basics](https://www.postgresql.org/docs/current/ddl-basics.html) · postgresql.org · the minimum `CREATE TABLE` with names and types (*read*) · covers our angle: **partial** — "a table you will not regret" is our argument · fetched 2026-10-12
- **Also good:** [CREATE TABLE](https://www.postgresql.org/docs/current/sql-createtable.html) · postgresql.org · the full reference; ids `SQL-CREATETABLE-PARMS-LIKE`, `SQL-CREATETABLE-PARMS-DEFAULT` (*read* the synopsis)

### T03-02 · Primary keys — natural vs surrogate, identity vs `serial` — Master · ✅ written `docs/postgresql/pages/phase-3-ddl/02-primary-keys.md`
- **Read this:** [UUID, serial or identity columns for PostgreSQL auto-generated primary keys?](https://www.cybertec-postgresql.com/en/uuid-serial-or-identity-columns-for-postgresql-auto-generated-primary-keys/) · CYBERTEC · published 2021-05-20, modified 2024-03-05 · `GENERATED ALWAYS AS IDENTITY` and `BY DEFAULT`, sequences behind the scenes (*read* the identity part) · covers our angle: **partial** — natural vs surrogate is not argued · fetched 2026-10-12
- **Also good:** [Don't Do This · serial](https://wiki.postgresql.org/wiki/Don%27t_Do_This) · postgresql.org wiki · "For new applications, identity columns should be used instead" (*read*; last edited 2024-11-21) · [Primary Keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-PRIMARY-KEYS) · postgresql.org (headings only)
- **Beyond the docs:** [Database Normalization and Primary Keys](https://tapoueh.org/blog/2018/03/database-normalization-and-primary-keys/) · Dimitri Fontaine (tapoueh.org) · 2018-03-09 · argues the natural-vs-surrogate trade-off with a duplicate-rows example and lands on a surrogate key plus a `UNIQUE` constraint on the natural columns, which the docs never argue · fetched 2026-10-13 (*read*)
- **Our delta:** UUIDv7 in 18 changes the uuid-vs-bigint answer (see T02-07).

### T03-03 · Foreign keys — actions, and index the referencing column — Master · ✅ written `docs/postgresql/pages/phase-3-ddl/03-foreign-keys.md` (also `03b-references-and-foreign-key.md`, `03c-match-and-column-subsets.md`)
- **Read this:** [Constraints · Foreign Keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK) · postgresql.org · declaring a foreign key "does not automatically create an index on the referencing columns" (*read*) · covers our angle: full for the index warning; `ON DELETE` actions are in the reference · fetched 2026-10-12
- **Also good:** [CREATE TABLE · REFERENCES](https://www.postgresql.org/docs/current/sql-createtable.html#SQL-CREATETABLE-PARMS-REFERENCES) · postgresql.org · ids for each action, e.g. `SQL-CREATETABLE-PARMS-REFERENCES-REFACT-CASCADE`, `-SET-NULL`, `-RESTRICT` (headings only)
- **Beyond the docs:** [PostgreSQL: Indexes and foreign keys](https://www.cybertec-postgresql.com/en/postgresql-indexes-and-foreign-keys/) · CYBERTEC (Hans-Jürgen Schönig) · published 2017-07-20 · a 5-million-row test where one cascading delete takes over 300 ms without an index on the referencing column and a fraction of a millisecond with one, so the manual's warning gets a measured cost · fetched 2026-10-13 (*read*)

### T03-04 · `NOT NULL`, `DEFAULT`, `UNIQUE`, `CHECK` — Master · ✅ written `docs/postgresql/pages/phase-3-ddl/04-constraints.md`
- **Read this:** [Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) · postgresql.org · check, not-null, unique, primary and foreign keys, exclusion, each with examples (*read*; ids `DDL-CONSTRAINTS-CHECK-CONSTRAINTS`, `DDL-CONSTRAINTS-NOT-NULL`) · covers our angle: **partial** — `DEFAULT` lives on a separate page · fetched 2026-10-12
- **Also good:** [Default Values](https://www.postgresql.org/docs/current/ddl-default.html) · postgresql.org (headings only)

### T03-05 · `ALTER TABLE` — instant vs rewrite — Master · ✅ written `docs/postgresql/pages/phase-3-ddl/05-alter-table.md`
- **Read this:** [ALTER TABLE · Notes](https://www.postgresql.org/docs/current/sql-altertable.html) · postgresql.org · a non-volatile `DEFAULT` is stored in metadata with no rewrite; a volatile default, stored generated or identity column, or constrained domain rewrites the table (*read*) · covers our angle: full for the rewrite rules · fetched 2026-10-12
- **Also good:** [Modifying Tables](https://www.postgresql.org/docs/current/ddl-alter.html) · postgresql.org · add, drop, rename, change type; ids `DDL-ALTER-COLUMN-TYPE` (headings only)
- **Beyond the docs:** [Which Postgres Operation causes a table rewrite](https://www.bytebase.com/blog/postgres-table-rewrite/) · Bytebase (Adela) · 2025-09-06 · one list of operations that rewrite versus those that only change metadata, plus which statements still take an ACCESS EXCLUSIVE lock, which the manual scatters across notes · fetched 2026-10-13 (*read*)
- **Our delta:** which type changes rewrite is not tabulated on either page.

### T03-06 · Modeling relationships — 1-1, 1-N, N-N — Master · ✅ written `docs/postgresql/pages/phase-3-ddl/06-relationships.md`
- **Read this:** [Constraints · Foreign Keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK) · postgresql.org · "more than one foreign key constraint" implements many-to-many, with a products and orders example (*read*) · covers our angle: **partial** — no 1-1 pattern, no composite-key join-table advice · fetched 2026-10-12
- **Also good:** none opened beyond this. A search for junction-table tutorials returned a short course page and cheatsheets only, which I did not read.
- *Not opened:* [Stanza: Primary and Foreign Keys](https://www.stanza.dev/courses/postgresql-fundamentals/table-relationships/postgresql-fundamentals-foreign-keys) (headings only).

### T03-07 · DDL is transactional — Understand · ✅ written `docs/postgresql/pages/phase-3-ddl/07-transactional-ddl.md`
- **Read this:** [Transactional DDL in PostgreSQL: A Competitive Analysis](https://wiki.postgresql.org/wiki/Transactional_DDL_in_PostgreSQL:_A_Competitive_Analysis) · postgresql.org wiki · `BEGIN; CREATE TABLE; INSERT; ROLLBACK;` leaves nothing behind (*read* the PostgreSQL example; last edited 2012-06-11) · covers our angle: **partial** — a comparison page, no migration advice · fetched 2026-10-12
- **Also good:** [node-postgres Transactions](https://node-postgres.com/features/transactions) · node-postgres.com · you issue `BEGIN`/`COMMIT`/`ROLLBACK` yourself and must use the same client (*read*)
- **Our delta:** the wiki is old; check the 18 behaviour in `psql` before quoting its output.

### T03-08 · Unique constraints vs unique indexes, NULLs (`NULLS NOT DISTINCT`) — Understand · ✅ written `docs/postgresql/pages/phase-3-ddl/08-unique-nulls.md`
- **Read this:** [Constraints · Unique Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS) · postgresql.org · duplicates with a null are allowed by default; `NULLS NOT DISTINCT` changes that; a unique constraint creates a unique B-tree index; partial unique index for subsets (*read*) · covers our angle: full · fetched 2026-10-12
- **Beyond the docs:** [Waiting for PostgreSQL 15 – Add UNIQUE null treatment option](https://www.depesz.com/2022/02/06/waiting-for-postgresql-15-add-unique-null-treatment-option/) · depesz · 2022-02-06 · shows the default of many NULLs allowed against `UNIQUE NULLS NOT DISTINCT` allowing one, with runnable examples, for both constraints and unique indexes · fetched 2026-10-13 (*read*)

### T03-09 · Adding a `NOT NULL` column with a default to a large table — Understand · ✅ written `docs/postgresql/pages/phase-3-ddl/09-add-not-null.md`
- **Read this:** [ALTER TABLE · Notes and `SET NOT NULL`](https://www.postgresql.org/docs/current/sql-altertable.html) · postgresql.org · non-volatile default means no rewrite; `SET NOT NULL` scans unless a valid `CHECK` proves no NULLs (or `NOT VALID` is used) (*read*) · covers our angle: **partial** — the step-by-step sequence is ours · fetched 2026-10-12
- **Also good:** [A Missing Link in Postgres 11: Fast Column Creation with Defaults](https://www.brandur.org/postgres-default) · brandur.org · 2018-08-28 · `attmissingval` and why a volatile default like `random()` still rewrites (*read*)
- **Our delta:** 🔴 the manual says a *volatile* default rewrites the table; do not generalise "default = fast".

### T03-10 · Schemas as namespaces, `search_path`, multi-tenant layouts — Understand · ✅ written `docs/postgresql/pages/phase-3-ddl/10-schemas-tenancy.md`
- **Read this:** [Schemas](https://www.postgresql.org/docs/current/ddl-schemas.html) · postgresql.org · creating a schema, the public schema, the search path, privileges, usage patterns (*read* the intro; ids `DDL-SCHEMAS-PATH`, `DDL-SCHEMAS-PATTERNS`) · covers our angle: **partial** — tenant layouts are in T03-20 · fetched 2026-10-12
- **Beyond the docs:** [What surprised us in Postgres-schema multitenancy](https://blog.arkency.com/what-surprised-us-in-postgres-schema-multitenancy/) · Arkency (Tomasz Wróbel) · 2020-10-01 · field report on `search_path` per tenant: extensions needing a schema on the path, PgBouncer transaction mode mixing tenants, and shared job tables · fetched 2026-10-13 (*read*)

### T03-11 · Naming conventions that survive — Understand · ✅ written `docs/postgresql/pages/phase-3-ddl/11-naming.md`
- **Read this:** none found — tried: three searches for PostgreSQL naming-convention guides. Results were aggregator and company style guides (one URL 404ed, the rest not opened), so none was chosen.
- **Also good:** [Don't Do This · upper case names](https://wiki.postgresql.org/wiki/Don%27t_Do_This) · postgresql.org wiki · section "Don't use upper case table or column names" (headings only) · [Identifiers and Key Words](https://www.postgresql.org/docs/current/sql-syntax-lexical.html) · postgresql.org (headings only)
- **Our delta:** the whole convention (plurals, `_id`, `_pkey`/`_key`/`_idx` suffixes) is our own call.

### T03-12 · Normalization to 3NF, and denormalizing on purpose — Understand · ✅ written `docs/postgresql/pages/phase-3-ddl/12-normalization.md`
- **Read this:** [Description of the database normalization basics](https://learn.microsoft.com/en-us/previous-versions/troubleshoot/microsoft-365/microsoft-365-apps/access/database-normalization-description) · Microsoft Learn (previous-versions section; page metadata dated 2025-05-26) · first to third normal form; calls 3NF "the highest level necessary for most applications" (*read* the intro; headings checked) · covers our angle: **partial** — nothing on denormalizing · fetched 2026-10-12
- **Also good:** [How to Use PostgreSQL for Data Normalization](https://www.tigerdata.com/learn/how-to-use-postgresql-for-data-normalization) · Tiger Data · published 2024-12-23, modified 2026-09-07 · has a "Denormalization: When and why" part (headings only)

### T03-13 · `DROP`, `CASCADE`, `RESTRICT` — Understand · ✅ written `docs/postgresql/pages/phase-3-ddl/13-drop-cascade.md`
- **Read this:** [Dependency Tracking](https://www.postgresql.org/docs/current/ddl-depend.html) · postgresql.org · `RESTRICT` is the default and blocks dropping objects others depend on; `CASCADE` drops dependents (*read*) · covers our angle: full for the mechanism · fetched 2026-10-12
- **Also good:** [DROP TABLE](https://www.postgresql.org/docs/current/sql-droptable.html) · postgresql.org (headings only)
- **Beyond the docs:** [Managing object dependencies in PostgreSQL: Removing dependent objects (Part 2)](https://aws.amazon.com/blogs/database/managing-object-dependencies-in-postgresql-removing-dependent-objects-part2/) · AWS Database Blog · 2024-05-06 · walks `pg_depend` and its dependency types, then nested view and foreign key chains that `CASCADE` follows · fetched 2026-10-13 (*headings only*)

### T03-14 · Sequences as real objects — Understand · ✅ written `docs/postgresql/pages/phase-3-ddl/14-sequences.md`
- **Read this:** [CREATE SEQUENCE · Notes](https://www.postgresql.org/docs/current/sql-createsequence.html) · postgresql.org · "nextval and setval calls are never rolled back", so no gapless numbers (*read*) · covers our angle: **partial** — ownership is not covered · fetched 2026-10-12
- **Also good:** [Sequence Manipulation Functions](https://www.postgresql.org/docs/current/functions-sequence.html) · postgresql.org · `nextval` is atomic across sessions (*read*)

### T03-15 · Generated columns — Know · ✅ written `docs/postgresql/pages/phase-3-ddl/15-generated-columns.md`
- **Read this:** [Generated Columns](https://www.postgresql.org/docs/current/ddl-generated-columns.html) · postgresql.org · stored columns are computed on write and take space; virtual columns are computed on read and take none (*read*) · covers our angle: full · fetched 2026-10-12
- **Beyond the docs:** [Waiting for PostgreSQL 18 – Virtual generated columns](https://www.depesz.com/2025/02/28/waiting-for-postgresql-18-virtual-generated-columns/) · depesz · 2025-02-28 · measures table size for stored versus virtual (712kB with a virtual column against 11,788,288 bytes with a stored one in the post's test) and lists limits such as no index on a virtual column · fetched 2026-10-13 (*read*)
- **Our delta:** 🔴 the 18 manual has two kinds, stored and virtual, and says a generated column is by default of the **virtual** kind (*read*). Always write `STORED` or `VIRTUAL` explicitly, and say which PostgreSQL version introduced virtual columns only after checking the release notes (**not confirmed** here).

### T03-16 · `TEMPORARY` and `UNLOGGED` tables — Know · ✅ written `docs/postgresql/pages/phase-3-ddl/16-temp-unlogged.md`
- **Read this:** [CREATE TABLE · UNLOGGED](https://www.postgresql.org/docs/current/sql-createtable.html#SQL-CREATETABLE-UNLOGGED) · postgresql.org · not written to WAL, so faster, but truncated after a crash and not replicated (*read*); temporary tables are `#SQL-CREATETABLE-TEMPORARY` (headings only) · covers our angle: full for `UNLOGGED` · fetched 2026-10-12
- **Beyond the docs:** [Unlogged tables in Postgres: Is their data truly gone after a crash?](https://pganalyze.com/blog/5mins-postgres-unlogged-tables) · pganalyze (Lukas Fittl) · 2023-02-23 · pgbench numbers for the speed gain and Andres Freund's explanation of why crash state cannot be recovered · fetched 2026-10-13 (*read*)

### T03-17 · `COMMENT ON` — Know · ✅ written `docs/postgresql/pages/phase-3-ddl/17-comments.md`
- **Read this:** [COMMENT](https://www.postgresql.org/docs/current/sql-comment.html) · postgresql.org · comments are seen with psql's `\d` family; `obj_description` and `col_description` read them (*read*) · covers our angle: full · fetched 2026-10-12

### T03-18 · Deferrable constraints and circular foreign keys — When Needed · ✅ written `docs/postgresql/pages/phase-3-ddl/18-deferrable.md`
- **Read this:** [Foreign keys in PostgreSQL: Circular dependencies](https://www.cybertec-postgresql.com/en/foreign-keys/) · CYBERTEC · published 2024-06-04, modified 2026-05-07 · why two tables that reference each other cannot be filled, and `INITIALLY DEFERRED` as the fix (*read* the opening) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Deferrable SQL Constraints in Depth](https://begriffs.com/posts/2017-08-27-deferrable-sql-constraints.html) · begriffs.com · 2017-08-27 · has "Cyclic Foreign Keys" and "Reasons Not to Defer" (headings only) · [CREATE TABLE · DEFERRABLE](https://www.postgresql.org/docs/current/sql-createtable.html#SQL-CREATETABLE-PARMS-DEFERRABLE) · postgresql.org (synopsis *read*)

### T03-19 · Table inheritance, and why partitioning replaced it — When Needed · ✅ written `docs/postgresql/pages/phase-3-ddl/19-inheritance.md`
- **Read this (1/2):** [Inheritance](https://www.postgresql.org/docs/current/ddl-inherit.html) · postgresql.org · links inheritance to partitioning, with a caveats section `DDL-INHERIT-CAVEATS` (*read* the partition mention) · covers our angle: **partial** · fetched 2026-10-12
- **Read this (2/2):** [Table Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html) · postgresql.org · declarative partitioning and "Partitioning Using Inheritance" as separate sections (headings only; ids `DDL-PARTITIONING-DECLARATIVE`, `DDL-PARTITIONING-USING-INHERITANCE`) · fetched 2026-10-12
- **Also good:** [Don't Do This · table inheritance](https://wiki.postgresql.org/wiki/Don%27t_Do_This) · postgresql.org wiki (headings only)
- **Beyond the docs:** [PostgreSQL 11: Partitioning Evolution from Postgres 9.6 to 11](https://www.enterprisedb.com/blog/postgresql-11-partitioning-evolution-postgres-96-11) · EnterpriseDB (David Rowley) · 2018-10-24 · why inheritance-based partitioning needed trigger routing and was slow, and what declarative partitioning added in 10 and 11 · fetched 2026-10-13 (*read*)

### T03-20 · Multi-tenancy as a decision — Understand · ✅ written `docs/postgresql/pages/phase-3-ddl/20-multi-tenancy/` (`README.md`, `01-choosing-a-model.md`, `02-models-compared.md`, `03-operating-it.md`)
- **Read this:** [Designing Your Postgres Database for Multi-tenancy](https://www.crunchydata.com/blog/designing-your-postgres-database-for-multi-tenancy) · Crunchy Data · page shows Nov 14, 2023 · database per customer, schema per customer, tenant discriminator in shared tables, with pros and cons; says 50 or more customers is too many databases (*read* the first two approaches) · covers our angle: **partial** — vendor piece (it leads to Citus) and no operating-cost detail · fetched 2026-10-12
- **Also good:** [Choose the right PostgreSQL data access pattern for your SaaS application](https://aws.amazon.com/blogs/database/choose-the-right-postgresql-data-access-pattern-for-your-saas-application/) · AWS Database Blog · 2023-03-06 · silo, bridge and pool isolation (headings only) · [How to architect multi-tenant SaaS on Postgres](https://clickhouse.com/resources/engineering/multi-tenant-saas-postgres-architecture) · ClickHouse · last updated 2026-05-25, says schema-per-tenant bloats `pg_catalog` (*read* that passage; vendor)
- **Our delta:** the cost thresholds differ by source (50 databases, hundreds of schemas), so state them as rules of thumb, not facts.
