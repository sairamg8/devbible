---
title: "There is exactly one test that proves a migration set is correct — apply every file, in order, to a database that has never seen any of them — and it is worthless against H2, because H2's own documentation says its PostgreSQL mode implements only a small subset of the differences"
sidebar_label: "11 · Testing migrations"
sidebar_position: 37
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against H2 2's *Features · Compatibility Modes*
> ([h2database.com](https://www.h2database.com/html/features.html)),
> Testcontainers for Java's *Database containers*
> ([java.testcontainers.org](https://java.testcontainers.org/modules/databases/)),
> Spring Boot 4.1's *Database Initialization* how-to
> ([docs.spring.io](https://docs.spring.io/spring-boot/how-to/data-initialization.html))
> and Spring Boot 4.1's `FlywayProperties`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/tree/main/module/spring-boot-flyway)).
> JDK 25, Spring Boot 4.1.1, Flyway 12.4.0, PostgreSQL 18, Testcontainers 2.0.5.

**Every chunk in this topic has argued about what happens when a migration meets a real database:
locks, transactions, MVCC, advisory locks, `CONCURRENTLY`, PL/pgSQL. The test that protects all of it
is embarrassingly simple to describe — start an empty PostgreSQL, run every migration you have, see
whether it works — and almost every codebase's version of it is subtly not that test, because the
database it runs against is H2 in PostgreSQL compatibility mode. This chunk is what the test is for,
what it cannot tell you, and why the container is not optional.
[11b](11b-wiring-the-container.md) is how the container gets wired,
[11c](11c-the-slice-that-skips-your-migrations.md) is the Spring test slice that silently does not
run migrations at all, and [11d](11d-what-the-test-should-assert.md) is what to assert once the
database is real.**

## What the test is actually for

Your unit tests exercise the application against a schema. This test exercises the **schema's
construction**. They are different artefacts, and nothing else in the suite covers the second one.

Specifically, "apply every migration to an empty database" is the only mechanism that catches:

| Failure | Why nothing else catches it |
|---|---|
| A migration whose SQL does not parse | Migrations are strings; the compiler never sees them |
| Two migrations with the same version | Flyway rejects it at resolve time, and only then |
| A migration that depends on an object a *later* migration creates | Order is only exercised by running in order |
| A migration correct against today's production schema but not against empty | Production carries drift you inherited; empty does not |
| A file in the wrong `locations` directory | The application starts fine having applied nothing ([02b](02b-where-they-live.md)) |
| A repeatable migration that is not actually re-runnable | It only re-runs when its checksum changes ([05c](05c-what-does-not-belong.md)) |
| A schema that no longer matches the entity mappings | `ddl-auto: validate` only runs against a real schema ([07b](07b-validate-not-update.md)) |

🔴 **The last row is the one that pays for the whole exercise.** Migrations plus `validate` is the
loop [07b](07b-validate-not-update.md) closed: Flyway builds the schema, Hibernate asserts the
mapping matches it, and that assertion is worth exactly as much as the database it runs against.

⚠️ **Every environment you create later runs this test for real.** A new region, a new tenant
database, a restored-from-scratch staging environment — each of those is "apply every migration to an
empty database", executed in production conditions. If CI never does it, the first time anybody does
it is the day it has to work.

## What the test does not prove

Worth stating plainly, because a green migrations test is routinely read as "the migration is safe",
and it is not that at all.

- **It says nothing about duration.** An empty database has no rows, so a backfill matches nothing,
  an index build is instantaneous and `VALIDATE CONSTRAINT` scans zero rows. Every argument in
  [08b4](08b4-how-long-is-too-long.md) is invisible here.
- **It says nothing about locks.** With no concurrent workload, `ACCESS EXCLUSIVE` is granted
  immediately every time. The queue behind it ([08b](08b-locks-and-long-migrations.md)) cannot form.
- **It says nothing about the rolling deployment.** The compatibility argument in
  [08](08-migrating-a-live-service.md) is about two application versions running at once, which a
  schema build does not simulate.
- **It says nothing about production's existing data.** A `NOT NULL` that succeeds against an empty
  table is exactly the statement that fails against ninety million rows with one null.
- **It says nothing about the advisory lock.** One process, one migrate call; the ten-pod behaviour
  from [09](09-many-instances-one-database.md) needs concurrency the test does not have.

None of that is a reason to skip the test. It is a reason not to let its passing end the review —
which is what [12 · The checklist](12-the-checklist.md) is for.

## Why the database has to be PostgreSQL

H2 with `MODE=PostgreSQL` is fast, needs no Docker, and is wrong. H2's own documentation says so in
the first two sentences of the section that introduces it:

> *"For certain features, this database can emulate the behavior of specific databases. However, only
> a small subset of the differences between databases are implemented in this way."*

The PostgreSQL mode's list of differences is short enough to read in a minute: aliased-column
metadata, rounding on float-to-integer conversion, `ctid` and `oid`, `GREATEST`/`LEAST` null handling,
`LOG(x)` base, `REGEXP_REPLACE` semantics, `LIMIT`/`OFFSET`, `SERIAL`/`BIGSERIAL`,
`ON CONFLICT DO NOTHING`, `CHAR` padding, `NUMERIC` without parameters, `MONEY`, datetime functions
within a transaction, `ARRAY_SLICE` bounds, `EXTRACT(DOW …)`, partial `UPDATE … FROM`, and 1-based
positions in `GROUP BY`.

That is a syntax-compatibility list. Compare it against what this topic has spent thirty chunks on:

| This topic used | On H2's PostgreSQL-mode list |
|---|---|
| `DO $$ … $$` PL/pgSQL blocks with `COMMIT` ([10b](10b-batching-a-backfill.md)) | No |
| `CREATE INDEX CONCURRENTLY` ([08a2](08a2-adding-indexes-and-enum-values.md)) | No |
| `pg_try_advisory_xact_lock` ([09](09-many-instances-one-database.md)) | No |
| `lock_timeout` and `ACCESS EXCLUSIVE` queueing ([08b](08b-locks-and-long-migrations.md)) | No |
| `ADD CONSTRAINT … NOT VALID` / `VALIDATE CONSTRAINT` ([08a](08a-adding-things-safely.md)) | No |
| `ALTER TYPE … ADD VALUE` on an enum ([08a2](08a2-adding-indexes-and-enum-values.md)) | No |
| Partial indexes for a backfill ([10b2](10b2-keeping-each-batch-cheap.md)) | No |
| MVCC bloat and vacuum behaviour ([10](10-data-migrations.md)) | No |

Testcontainers' own database page states the trade in one sentence:

> *"Instead of H2 database for DAO unit tests that depend on database features that H2 doesn't
> emulate. Testcontainers is not as performant as H2, but does give you the benefit of 100% database
> compatibility (since it runs a real DB inside of a container)."*

⚠️ **Flyway also behaves differently, not just the database.** Flyway selects a database-specific
module from the connection ([09](09-many-instances-one-database.md) used
`flyway-database-postgresql`), so an H2 test exercises a different parser, a different lock
implementation and a different set of statements-that-cannot-run-in-a-transaction. The tool under
test is not the tool you ship either.

### The vendor-locations escape hatch makes it worse, not better

The usual response is `spring.flyway.locations: classpath:db/migration/{vendor}`, so the H2 tests get
H2 migrations and production gets PostgreSQL ones ([02b](02b-where-they-live.md) covers the
placeholder). Read what that actually buys:

🔴 **You now have two sets of migration files, and CI tests the set that never runs in production.**
The checksums differ, the statements differ, and the one property you wanted — *these files, applied
in this order, build a working schema* — is asserted about the wrong files. That is not a compromise
between speed and fidelity. It is the complete abandonment of the fidelity, with the appearance of a
test.

⚠️ And it doubles the maintenance permanently. Every future migration has to be written twice, by
somebody who remembers that the second copy exists, and the failure mode when they forget is that the
H2 build goes green because there is nothing new to run.

## Gotchas

**★ H2 in PostgreSQL mode is not PostgreSQL, and H2 says so.** Its documentation states that *"only a
small subset of the differences between databases are implemented"*, and the published list for
`MODE=PostgreSQL` is a syntax list — nothing in it is PL/pgSQL, `CONCURRENTLY`, advisory locks, lock
levels, `NOT VALID`, enum extension or MVCC behaviour.

**★ Vendor-specific migration locations do not rescue an H2 test — they invalidate it.** Two sets of
files means CI proves something about the set that never reaches production, while reporting green,
and every future migration has to be written twice.

**★ On H2 you are not even testing the same Flyway.** The database-specific module differs, so the
parser, the locking strategy and the list of statements Flyway believes cannot run in a transaction
all differ from production.

**★ A passing migrations test says nothing about how long a migration takes.** An empty table makes
every row-proportional statement instantaneous — the backfill, the index build, the constraint
validation. The `08b4` clocks are entirely untested by it.

**★ It says nothing about locks either.** With no concurrent workload every lock is granted
immediately, so the queue-behind-the-`ALTER` failure from
[08b](08b-locks-and-long-migrations.md) cannot occur in the test.

**★ `ALTER TABLE … SET NOT NULL` always succeeds on an empty table.** So does adding a unique
constraint, and a foreign key, and a check. The statements that fail in production are precisely the
ones whose failure depends on data the test does not have.

**★ The migrations test is not a test of your queries.** It is a test of the schema's construction.
Loading it up with business assertions makes it slow and flaky, and a slow flaky test gets disabled —
removing the only coverage the migration set has.

**★ Every new environment runs this test for real.** A new region or a rebuilt staging database *is*
"apply every migration from empty". If CI never does it, that day is the first attempt, performed
under time pressure.

**★ A green migrations build is routinely misread as "the migration is safe to deploy".** It proves
the files apply to nothing. Everything about locks, duration, concurrency and existing data is still
a review question.

## Interview questions

**★ What exactly does a "run the migrations from empty" test prove?**
That the ordered set of migration files, applied to a database that has never seen any of them,
produces a schema — and, if the test also lets Hibernate validate, that the schema matches the entity
mappings. Nothing else in a normal suite covers that. Unit tests exercise the application against a
schema; this exercises the construction of the schema, which is a separate artefact with its own ways
of being broken.

**★ And what does it not prove?**
Anything that depends on data or on concurrency. On an empty database every row-proportional statement
is instantaneous, every lock is granted immediately, every `NOT NULL` succeeds because there are no
rows to violate it, and there is exactly one process so the advisory lock is never contended. The
test protects the *correctness* of the migration set and says nothing about its *safety* against
production.

**★ Why is H2 in PostgreSQL compatibility mode not good enough?**
Because H2's own documentation says the emulation covers *"only a small subset of the differences
between databases"*, and the published list for `MODE=PostgreSQL` is syntax-level: `LIMIT`/`OFFSET`,
`SERIAL`, `ON CONFLICT DO NOTHING`, `CHAR` padding, a few function semantics. Nothing in it is
PL/pgSQL, `CREATE INDEX CONCURRENTLY`, advisory locks, lock levels, `NOT VALID` constraints, enum
extension or partial indexes — which is most of what a real migration set contains. Flyway also loads
a different database module for H2, so the parser and the locking behave differently too.

**★ Somebody suggests keeping H2 for speed and using `{vendor}` locations. What do you say?**
That it converts a weak test into a meaningless one. With vendor-specific locations there are two sets
of migration files, and CI is asserting that the H2 set builds a working H2 schema — a fact about
files that never run anywhere. The green build now means less than no build at all, because it is
mistaken for coverage. It also doubles the writing cost of every future migration, and when somebody
forgets the second copy the H2 build passes precisely because nothing new ran.

**★ Your migrations test passes and the deployment still takes the site down. Is the test useless?**
No — it was answering a different question. It proved the files build a schema; the outage was about
lock contention, duration, or a `NOT NULL` meeting data the test did not have. That is why a
migration gets a review as well as a test: the test covers what can be checked mechanically, and the
checklist covers what only a human comparing the statement to production's row count can.

{/* FOOTER */}
