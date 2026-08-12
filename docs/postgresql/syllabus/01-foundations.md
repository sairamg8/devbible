---
title: "Part 1 — Foundations"
sidebar_label: "1 · Foundations"
sidebar_position: 1
---

> **Phases 0–3 · 63 topics · 19 Master**
> Architecture, the `psql` client mastered, the type system, and schema design.

Nothing here is Node-specific, but every page still carries its Node `pg`
counterpart per the [example policy](../README.md#example-policy)
— a type page shows what `pg` hands back to JavaScript, a DDL page shows the same
statement issued from a migration.

---

## Phase 0 — PostgreSQL and its architecture

📖 **Explanation written:** [Phase 0 — Architecture](../pages/phase-0-architecture/)


*12 topics.* What the server actually is, before any SQL. Short on purpose — but
the process model row explains pooling, and the namespace row prevents a week of
`search_path` confusion.


| Topic | Tier |
|---|---|
| **The client/server model** — one OS process per connection, and why that makes connections expensive enough to pool | <span className="db-tier t-master">Master</span> |
| **Cluster → database → schema → table** — the four-level namespace, and `search_path` | <span className="db-tier t-master">Master</span> |
| What PostgreSQL is, what "object-relational" buys you, and the license/governance model | <span className="db-tier t-understand">Understand</span> |
| Shared buffers, the OS page cache, and where a row lives when you read it | <span className="db-tier t-understand">Understand</span> |
| **WAL** — why every change is written twice, and what durability means concretely | <span className="db-tier t-understand">Understand</span> |
| Roles, users and groups — one concept wearing three names | <span className="db-tier t-understand">Understand</span> |
| Installing for local development: Podman/Docker, ports, volumes, and why not to install natively | <span className="db-tier t-understand">Understand</span> |
| **Connection strings, `PG*` env vars, `.pgpass`, and `pg_hba.conf` auth modes** | <span className="db-tier t-understand">Understand</span> |
| Postmaster, backends, background workers, WAL writer, checkpointer, autovacuum launcher | <span className="db-tier t-know">Know</span> |
| Version policy — majors, minors, the five-year window, and what PostgreSQL 18 changed | <span className="db-tier t-know">Know</span> |
| PostgreSQL vs MySQL vs SQLite — the differences that actually change your design | <span className="db-tier t-know">Know</span> |
| `template0`/`template1`, the `postgres` database, and what `CREATE DATABASE` copies | <span className="db-tier t-when">When Needed</span> |

---

## Phase 1 — `psql`, mastered

📖 **Explanation written:** [Phase 1 — psql](../pages/phase-1-psql/)


*15 topics.* A dedicated phase by instruction, and it earns it: `psql` is the
tool you verify every other page in, and the one that turns "I think this worked"
into "I watched it work". Every row here is a shell skill, not SQL.

| Topic | Tier |
|---|---|
| **Connecting** — conninfo strings, URIs, `-h/-p/-U/-d`, and connecting into a container | <span className="db-tier t-master">Master</span> |
| **The daily meta-commands** — `\l \c \dt \dn \df \di \dv \ds` | <span className="db-tier t-master">Master</span> |
| **`\d` and `\d+ table` read in full** — columns, defaults, indexes, constraints, FKs, triggers | <span className="db-tier t-master">Master</span> |
| **Output control** — `\x` expanded mode, `\pset`, aligned vs unaligned, `\t`, `--csv` | <span className="db-tier t-master">Master</span> |
| **`\?` and `\h <SQL>`** — the built-in reference that removes most documentation lookups | <span className="db-tier t-master">Master</span> |
| **Scripting `psql`** — `-c`, `-f`, `-A -t`, `ON_ERROR_STOP=1`, and exit codes in CI | <span className="db-tier t-understand">Understand</span> |
| The query buffer and editor — `\e`, `\p`, `\r`, `\g`, `\gx`, and semicolon discipline | <span className="db-tier t-understand">Understand</span> |
| Variables — `\set`, `:var`, `:'var'`, `:"var"`, and the interpolation traps | <span className="db-tier t-understand">Understand</span> |
| **`\copy` vs server-side `COPY`** — who reads the file, and why `\copy` is usually the one you want | <span className="db-tier t-understand">Understand</span> |
| `\timing` and `\watch` — measuring a query honestly from the shell | <span className="db-tier t-understand">Understand</span> |
| `\i` and `\ir` — running SQL files, and building a re-runnable seed script | <span className="db-tier t-understand">Understand</span> |
| `\conninfo`, `\du`, `\dp`/`\z` — who am I, and what am I allowed to touch | <span className="db-tier t-understand">Understand</span> |
| `.psqlrc`, prompt configuration, `HISTFILE`, and autocomplete | <span className="db-tier t-know">Know</span> |
| `\errverbose` and `VERBOSITY verbose` — the full error with SQLSTATE, which is what you match on in Node | <span className="db-tier t-know">Know</span> |
| Piping `psql` into other tools and generating reports | <span className="db-tier t-when">When Needed</span> |

---

## Phase 2 — Data types and the relational model

📖 **Explanation written:** [Phase 2 — Types](../pages/phase-2-types/)


*17 topics.* Type choices are the hardest thing in the schema to change later,
and three of them (`timestamptz`, `numeric`, `text`) decide whether the
application has a whole class of bug. Each row also states **what `pg` returns to
JavaScript**, which is where most surprises live.

| Topic | Tier |
|---|---|
| **`integer` / `bigint` / `smallint`** — ranges, overflow, and why identifiers are `bigint` | <span className="db-tier t-master">Master</span> |
| **`numeric` vs `real`/`double precision`** — money never goes in a float, and what `pg` returns for each | <span className="db-tier t-master">Master</span> |
| **`text` vs `varchar(n)` vs `char(n)`** — why `text` is the default answer in PostgreSQL | <span className="db-tier t-master">Master</span> |
| **`timestamptz` vs `timestamp`** — the single most consequential type choice in a schema | <span className="db-tier t-master">Master</span> |
| **Time zones** — what `timestamptz` actually stores, `AT TIME ZONE`, session `timezone` | <span className="db-tier t-master">Master</span> |
| **`NULL` semantics** — `IS NULL` vs `= NULL`, `COALESCE`, `NULLIF`, NULL in aggregates and unique keys | <span className="db-tier t-master">Master</span> |
| **`uuid`** — `gen_random_uuid()`, UUIDv7 in PostgreSQL 18, and uuid vs `bigint` as a primary key | <span className="db-tier t-understand">Understand</span> |
| **`jsonb` vs `json`** — storage, key ordering, deduplication, and which to pick | <span className="db-tier t-understand">Understand</span> |
| `boolean` and three-valued logic | <span className="db-tier t-understand">Understand</span> |
| `date`, `time`, `interval`, and date arithmetic | <span className="db-tier t-understand">Understand</span> |
| **Arrays** — declaration, 1-based indexing, `ANY`/`ALL`, `unnest`, and when they beat a child table | <span className="db-tier t-understand">Understand</span> |
| `enum` types vs `CHECK` constraints vs lookup tables — the real trade-off, including how each fails on change | <span className="db-tier t-understand">Understand</span> |
| **Casting** — `::`, `CAST`, implicit vs explicit, and the cast that silently kills an index | <span className="db-tier t-understand">Understand</span> |
| `bytea` and binary data — and why files usually do not belong in the database | <span className="db-tier t-know">Know</span> |
| Network types (`inet`, `cidr`), geometric types, and `citext` | <span className="db-tier t-know">Know</span> |
| Domains and composite types | <span className="db-tier t-know">Know</span> |
| Range types (`int4range`, `tstzrange`) and exclusion constraints | <span className="db-tier t-when">When Needed</span> |

---

## Phase 3 — DDL: tables, constraints, schema design

📖 **Explanation written:** [Phase 3 — DDL](../pages/phase-3-ddl/)


*19 topics.* Creating tables is the first thing the user asked for by name, so
this phase is deliberately thorough — and Phase 8 then does all of it again from
Node, in migrations.

| Topic | Tier |
|---|---|
| **`CREATE TABLE`** — columns, types, and the shape of a table you will not regret | <span className="db-tier t-master">Master</span> |
| **Primary keys** — natural vs surrogate, and `GENERATED ALWAYS AS IDENTITY` vs `serial` | <span className="db-tier t-master">Master</span> |
| **Foreign keys** — `REFERENCES`, every `ON DELETE`/`ON UPDATE` action, and **index the referencing column** (see Phase 10) | <span className="db-tier t-master">Master</span> |
| **`NOT NULL`, `DEFAULT`, `UNIQUE`, `CHECK`** — pushing invariants into the schema instead of the app | <span className="db-tier t-master">Master</span> |
| **`ALTER TABLE`** — add/drop/rename, type changes, and which are instant vs which rewrite the table | <span className="db-tier t-master">Master</span> |
| **Modeling relationships** — 1-1, 1-N, and N-N through a join table with a composite key | <span className="db-tier t-master">Master</span> |
| **DDL is transactional in PostgreSQL** — wrap a migration in `BEGIN`/`COMMIT` and a failure leaves nothing behind | <span className="db-tier t-understand">Understand</span> |
| Unique constraints vs unique indexes, and NULLs in unique columns (`NULLS NOT DISTINCT`) | <span className="db-tier t-understand">Understand</span> |
| **Adding a `NOT NULL` column with a default to a large table** — the safe sequence | <span className="db-tier t-understand">Understand</span> |
| Schemas as namespaces, `search_path`, and multi-tenant layouts | <span className="db-tier t-understand">Understand</span> |
| **Naming conventions that survive** — tables, columns, constraints, indexes | <span className="db-tier t-understand">Understand</span> |
| **Normalization to 3NF — and when to denormalize on purpose** | <span className="db-tier t-understand">Understand</span> |
| `DROP`, `CASCADE`, `RESTRICT` — and how not to lose a table you needed | <span className="db-tier t-understand">Understand</span> |
| Sequences as real objects — ownership, gaps, and why gaps are not a bug | <span className="db-tier t-understand">Understand</span> |
| Generated columns (`GENERATED ALWAYS AS ... STORED`) | <span className="db-tier t-know">Know</span> |
| `TEMPORARY` and `UNLOGGED` tables — speed traded against durability | <span className="db-tier t-know">Know</span> |
| `COMMENT ON` — documenting the schema where it lives, and reading it back with `\d+` | <span className="db-tier t-know">Know</span> |
| Deferrable constraints — `DEFERRABLE INITIALLY DEFERRED` and circular FKs | <span className="db-tier t-when">When Needed</span> |
| Table inheritance, and why declarative partitioning replaced it | <span className="db-tier t-when">When Needed</span> |

---

## Where this connects

- **Phase 1 (`psql`)** is the verification tool for every phase that follows.
- **Phase 3 → Phase 8** — the same DDL, issued from Node as versioned migrations.
- **Phase 2 → Phase 7** — type mapping is where `pg` surprises you (`bigint` and
  `numeric` arrive as strings).
- **Deliberately not here:** connection *pooling* (Node Phase 6), and indexes,
  which wait for Phase 10 so they can be taught against a real planner.

---

← [Overview](../README.md) · Next: [Part 2 — SQL](./02-sql.md) →
