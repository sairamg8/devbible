---
title: "11 · Migrations with Flyway"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: see each chunk's own `> Verified:` line.

**Versioned schema change, end to end: a file naming grammar, a table that remembers what
this database has had done to it, and the long argument about what happens when you apply
one of those files to a database that is serving traffic.**

:::tip Complete — 44 chunks
Seven parts. **The mechanism** — why the schema is code, the five-part filename grammar,
where the files live and how version numbers get chosen. **The record** —
`flyway_schema_history` column by column, what a failed migration leaves behind, and the
nineteen states `info` can report. **Immutability** — checksums, the edits nothing catches,
where the comparison does not run at all, and the two chunks on what `repair` really does
and the one time it is honest. **Repeatable migrations** — the four mechanics, what belongs
in an `R__` and what does not. **Adoption** — `baseline` the command versus `B__` the
migration, taking Flyway onto an existing database, and collapsing four hundred files into
one. **Boot** — the three beans, the ordering guarantee, and `ddl-auto: validate` as the
other half of the loop. **The live service** — expand/contract, adding columns, constraints,
indexes and enum values safely, `ACCESS EXCLUSIVE` and the queue behind it, `lock_timeout`,
retrying, how long is too long, the advisory lock and everything it does not cover, data
migrations and batched backfills, and the argument that most of those should not be
migrations at all. It closes on testing them against a real PostgreSQL — including the test
slice that silently runs none of them — and a fifty-five item review checklist.
:::

Boundaries this topic keeps: **06** owns `ddl-auto` and already argues `update` is never
production, so 11 picks the argument up at "what do you do instead". **02** owns connection
pooling, including what a `SET` leaves behind on a pooled connection. **Phase 11** owns
testing doctrine — slices versus full-context tests, the pyramid, Testcontainers in general —
and this topic borrows only what a migrations test needs. Liquibase is named and contrasted,
not taught.

{/* CHUNKS */}

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[01 · Why schema is code](01-why-schema-is-code.md)** | the schema is the one part of your application that survives every deployment, so it is the one part that most… |
| 2 | **[02 · The migration file](02-the-migration-file.md)** | a Flyway migration file name is a five-part grammar — prefix, version, separator, description, suffix — and every… |
| 3 | **[02b · Where they live](02b-where-they-live.md)** | spring.flyway.locations is a list of classpath and filesystem roots, it defaults to one directory nobody… |
| 4 | **[02c · Choosing version numbers](02c-choosing-version-numbers.md)** | sequential version numbers give you a readable history and a merge conflict on every parallel branch; timestamp… |
| 5 | **[03 · The history table](03-the-history-table.md)** | flyway_schema_history is not a log — it is the authoritative record of what this particular database has actually… |
| 6 | **[03b · When a migration fails](03b-when-a-migration-fails.md)** | on PostgreSQL a failed migration usually leaves nothing behind at all — no schema change and no history row — and… |
| 7 | **[03c · Reading the history](03c-reading-the-history.md)** | info does not print the history table — it prints the join between the history table and the files, and the… |
| 8 | **[04 · Checksums and immutability](04-checksums-and-immutability.md)** | A migration that has run is a historical fact, and the checksum is the only mechanism Flyway has for noticing that… |
| 9 | **[04b · The edits nothing catches](04b-the-edits-nothing-catches.md)** | There is a whole category of change that alters what a migration does while leaving the checksum, the description… |
| 10 | **[04c · Where the comparison does not run](04c-where-the-comparison-does-not-run.md)** | Two conditions switch the whole comparison off — everything at or below the baseline, and everything past the… |
| 11 | **[04d · What repair actually does](04d-what-repair-actually-does.md)** | repair edits the record and never the database, it does exactly three things in a fixed order, and two of them do… |
| 12 | **[04e · When repair is the right answer](04e-when-repair-is-the-right-answer.md)** | There is exactly one situation in which repair is honest — the record is wrong and the database is right — and… |
| 13 | **[05 · Repeatable migrations](05-repeatable-migrations.md)** | A repeatable migration has no version, is re-applied whenever its checksum changes, always runs last, and is… |
| 14 | **[05b · What belongs in one](05b-what-belongs-in-a-repeatable-migration.md)** | The test for whether something belongs in a repeatable migration is whether the file describes a desired end state… |
| 15 | **[05c · What does not belong](05c-what-does-not-belong.md)** | Everything on the do-not-put-this-in-a-repeatable-migration list fails loudly on the second run except one entry,… |
| 16 | **[06 · Baselining](06-baselining.md)** | Two different mechanisms share the word baseline — a command that writes one synthetic row and a migration file… |
| 17 | **[06b · Adopting it on an existing database](06b-adopting-flyway-on-an-existing-database.md)** | Adopting Flyway on a database that already exists is a five-step procedure whose whole difficulty is one decision… |
| 18 | **[06c · Baseline migrations](06c-baseline-migrations-and-collapsing-history.md)** | A B-prefixed baseline migration is a real SQL file that runs only against a database with no history at all, which… |
| 19 | **[07 · Boot integration](07-boot-integration.md)** | Spring Boot's Flyway auto-configuration is three beans and one ordering guarantee, and the ordering guarantee is… |
| 20 | **[07b · Validate, not update](07b-validate-not-update.md)** | Two completely different things are called validate — Flyway compares the history table against the files,… |
| 21 | **[08 · Migrating a live service](08-migrating-a-live-service.md)** | During any rolling deployment two versions of your code run against one database at the same time, so every… |
| 22 | **[08a · Adding columns and constraints safely](08a-adding-things-safely.md)** | Adding a column, a CHECK constraint or a foreign key to a live table each have a safe form and an obvious form,… |
| 23 | **[08a2 · Adding indexes and enum values](08a2-adding-indexes-and-enum-values.md)** | An index and an enum value cannot be deferred the way a constraint can — CREATE INDEX CONCURRENTLY buys you the… |
| 24 | **[08b · Locks and the queue behind them](08b-locks-and-long-migrations.md)** | The ALTER TABLE that took the site down was not slow — it was blocked, and because PostgreSQL queues lock requests… |
| 25 | **[08b2 · Seeing it, and bounding it](08b2-seeing-it-and-bounding-it.md)** | lock_timeout is the one setting that turns a lock-queue outage into a failed deployment, and PostgreSQL ships it… |
| 26 | **[08b3 · Retrying a blocked migration](08b3-retrying-a-blocked-migration.md)** | Once the wait is bounded you get to choose what happens when it expires, and the two useful answers are to take… |
| 27 | **[08b4 · How long is too long](08b4-how-long-is-too-long.md)** | A migration that blocks nothing can still be fatal, because it runs inside a deployment that has its own patience… |
| 28 | **[09 · Many instances, one database](09-many-instances-one-database.md)** | Ten pods starting at once all call migrate() against one database, and the only thing standing between them and… |
| 29 | **[09b · What the lock actually covers](09b-what-the-lock-actually-covers.md)** | Flyway takes its advisory lock around one migration and releases it before the next, so a ten-pod rollout can… |
| 30 | **[09c · What the lock does not cover](09c-what-the-lock-does-not-cover.md)** | The advisory lock excludes Flyway runs that share a schema history table name and absolutely nothing else — not… |
| 31 | **[10 · Data migrations](10-data-migrations.md)** | A data migration is a different animal from a schema migration because its cost scales with rows rather than with… |
| 32 | **[10b · Batching a backfill](10b-batching-a-backfill.md)** | A backfill has to commit between batches, PostgreSQL forbids COMMIT inside a transaction block, and Flyway puts… |
| 33 | **[10b2 · Keeping each batch cheap](10b2-keeping-each-batch-cheap.md)** | The batching loop that works on batch one is a full table scan by batch nine thousand, because the predicate that… |
| 34 | **[10c · When it should not be a migration](10c-when-it-should-not-be-a-migration.md)** | Most of the data changes people write as migrations should not be migrations at all, and the test is not how hard… |
| 35 | **[10c2 · Where the work goes instead](10c2-where-the-work-goes-instead.md)** | There are four plausible homes for a backfill that has left Flyway, and they differ in exactly one respect that… |
| 36 | **[10c3 · What the migration keeps](10c3-what-the-migration-keeps.md)** | Taking the rows out of Flyway is only safe because a later migration puts the guarantee back — the constraint… |
| 37 | **[11 · Testing migrations](11-testing-migrations.md)** | There is exactly one test that proves a migration set is correct — apply every file, in order, to a database that… |
| 38 | **[11b · Wiring the container](11b-wiring-the-container.md)** | @ServiceConnection is not a shortcut for setting spring.datasource.url — it contributes a ConnectionDetails bean… |
| 39 | **[11b2 · Making it fast](11b2-making-it-fast.md)** | The reason teams abandon container-backed tests is start-up time, and the three answers are not equivalent — the… |
| 40 | **[11c · The slice that skips your migrations](11c-the-slice-that-skips-your-migrations.md)** | @DataJpaTest does not import Flyway's auto-configuration at all, so in the slice most teams reach for first the… |
| 41 | **[11d · What the test should assert](11d-what-the-test-should-assert.md)** | The strongest assertion in a migrations test is one you never write — if Flyway builds the schema from empty and… |
| 42 | **[11d2 · Testing a data migration](11d2-testing-a-data-migration.md)** | A from-empty run cannot test a data migration at all, because a backfill against an empty table matches zero rows… |
| 43 | **[12 · The checklist](12-the-checklist.md)** | Reviewing a migration is not reviewing SQL — the statement is almost always correct, and the failures this topic… |
| 44 | **[12b · Reviewing the rollout](12b-reviewing-the-rollout.md)** | The second half of reviewing a migration is not in the migration — it is whether the currently deployed code… |

{/* FOOTER */}
