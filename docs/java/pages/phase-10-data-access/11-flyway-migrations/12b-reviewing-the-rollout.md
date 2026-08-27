---
title: "The second half of reviewing a migration is not in the migration — it is whether the currently deployed code survives the new schema, how long the file holds an advisory lock that ten other pods are polling for, whether anything actually tested it, and what the recovery looks like when it fails at three in the morning"
sidebar_label: "12b · Reviewing the rollout"
sidebar_position: 44
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — each item links to the chunk that argues it and carries that chunk's sources.
> Cross-checked against the Flyway *lockRetryCount* reference
> ([documentation.red-gate.com](https://documentation.red-gate.com/flyway/reference/configuration/flyway-namespace/flyway-lock-retry-count-setting)),
> Spring Boot 4.1's `FlywayProperties`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/tree/main/module/spring-boot-flyway))
> and PostgreSQL 18's *Explicit Locking*
> ([postgresql.org](https://www.postgresql.org/docs/18/explicit-locking.html)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**[12](12-the-checklist.md) reviewed the file and the statement. Everything left is outside the diff
entirely: the version of your application that is still running when the migration lands, the nine
instances waiting on the advisory lock, whether the test suite exercised any of this, and what the
person paged at 03:00 is supposed to do. These four passes are where a technically perfect migration
becomes an incident, and none of them can be answered by reading SQL.**

## Pass 5 · The rolling deployment

During any rolling deployment two versions of your code run against one database at the same time.
Every item here is a consequence of that one fact.

| # | Check | Why | Argued in |
|---|---|---|---|
| 33 | Is this schema compatible with the code that is **currently deployed**, not just the code in this PR? | Old pods keep serving traffic against the new schema for the length of the rollout — and for the length of a rollback. | [08](08-migrating-a-live-service.md) |
| 34 | Is a column being **dropped or renamed** in the same deploy that stops using it? | A rename is three deploys: add, dual-write and backfill, then drop. One deploy is an outage for every request the old pods serve. | [08](08-migrating-a-live-service.md) |
| 35 | Is a `NOT NULL` or a new required column arriving before the code that populates it? | Old pods do not know about the column, so their inserts fail the moment the constraint lands. | [08](08-migrating-a-live-service.md), [08a](08a-adding-things-safely.md) |
| 36 | For a backfill: does the application **already write** the new column? | Rows created between the backfill passing them and the dual-write deploy are permanently wrong, silently, with the migration reporting success. | [10](10-data-migrations.md) |
| 37 | Which deploy of the expand/contract sequence is this, and where are the others? | "We will drop the old column later" is where contract migrations go to die, and a half-finished expand is a schema nobody can reason about. | [08](08-migrating-a-live-service.md) |
| 38 | Does a rollback of the *application* leave the schema in a state the previous version can use? | Deployments get rolled back; migrations do not. Backward compatibility has to survive the reverse direction too. | [08](08-migrating-a-live-service.md) |

## Pass 6 · Many instances, one database

| # | Check | Why | Argued in |
|---|---|---|---|
| 39 | How long does this migration hold Flyway's advisory lock, versus `lockRetryCount` × 1 s? | The default budget is about fifty seconds, from a hard-coded 50 and a fixed one-second sleep. Exceed it and every instance except the winner fails its context and crash-loops. | [09](09-many-instances-one-database.md) |
| 40 | Is `spring.flyway.lock-retry-count` being raised, and is the readiness deadline behind it also raised? | Flyway's budget is the first of three clocks. Moving one wall leaves the other two. | [09](09-many-instances-one-database.md), [08b4](08b4-how-long-is-too-long.md) |
| 41 | Does this migration need `CREATE INDEX CONCURRENTLY`? | It forces the whole application onto session-level advisory locks via `spring.flyway.postgresql.transactional-lock: false`, and a session lock is released by a `finally` block that a killed process never runs. | [08a2](08a2-adding-indexes-and-enum-values.md), [09c](09c-what-the-lock-does-not-cover.md) |
| 42 | Does another service share this database or this history table? | The lock excludes runs that share a history table name and nothing else — not a second service, not a second schema, not a DBA's `psql`. | [09c](09c-what-the-lock-does-not-cover.md) |
| 43 | Is anything being run by hand alongside the deploy? | `repair` does not take the lock, and neither does a human. | [09c](09c-what-the-lock-does-not-cover.md) |

## Pass 7 · Did anything actually test this?

| # | Check | Why | Argued in |
|---|---|---|---|
| 44 | Does a test apply **every** migration to an empty database? | It is the only mechanism that catches an unparseable file, a version collision, an ordering dependency or a file in the wrong directory. | [11](11-testing-migrations.md) |
| 45 | Does that test run against **PostgreSQL**, not H2? | H2's documentation says its compatibility modes implement *"only a small subset of the differences"*, and none of what this topic uses is in the list. | [11](11-testing-migrations.md) |
| 46 | Is `ddl-auto: validate` on in that test? | Without it the test proves the SQL ran and says nothing about whether the schema matches the mappings. | [11d](11d-what-the-test-should-assert.md), [07b](07b-validate-not-update.md) |
| 47 | Is the test a `@DataJpaTest`? | Then it is not running the migrations at all — `FlywayAutoConfiguration` is not in the slice — and Hibernate built the schema from the entities. | [11c](11c-the-slice-that-skips-your-migrations.md) |
| 48 | For a data migration: is there a `target`-staged test with rows seeded in the pre-migration shape? | A backfill against an empty database matches zero rows and reports success. | [11d2](11d2-testing-a-data-migration.md) |
| 49 | Does that test assert the rows the migration should have **left alone**? | A backfill missing its `WHERE … IS NULL` predicate passes a test that only checks the row it was meant to change. | [11d2](11d2-testing-a-data-migration.md) |
| 50 | Does an entity mapping change ship in the same PR? | Flyway and Hibernate have to agree at startup; splitting the two halves across PRs means whichever merges first breaks `validate`. | [07b](07b-validate-not-update.md) |

## Pass 8 · What happens when it fails

The last pass, and the one that is never in the pull request template.

| # | Check | Why | Argued in |
|---|---|---|---|
| 51 | If it fails mid-way, what is left in the database? | On PostgreSQL a transactional migration usually leaves nothing — no schema change and no history row. A non-transactional one leaves both partial data and a `success = false` row. | [03b](03b-when-a-migration-fails.md) |
| 52 | Does recovery need a `repair`, and does the author know what `repair` does? | It edits the record and never the database: one `DELETE`, one `INSERT`, one checksum update. Using it to silence a real error leaves a record that describes nothing. | [04d](04d-what-repair-actually-does.md), [04e](04e-when-repair-is-the-right-answer.md) |
| 53 | Is the migration **resumable** if it is killed halfway? | For anything long this is the difference between "restart it" and "restore a backup". A predicate that excludes finished rows is the whole mechanism. | [10b](10b-batching-a-backfill.md) |
| 54 | Is there any way back if the change turns out to be wrong rather than broken? | Undo migrations are Teams-only and documented as unsuited to data changes. Reversibility has to be designed in — add a column rather than overwriting one. | [10](10-data-migrations.md) |
| 55 | When is it deploying, and who is watching? | A migration whose worst case is a locked table should not land at 17:55 on a Friday, and the person who can answer questions about it should be awake. | [08b4](08b4-how-long-is-too-long.md) |

## The red flags

Things that should stop a review immediately, without further discussion:

- **An existing migration file appears in the diff.** [04](04-checksums-and-immutability.md)
- **`spring.flyway.clean-disabled: false` in a file a deployed profile can load.** Flyway's own
  documentation calls enabling clean in production *"a career limiting move"*.
  [11b2](11b2-making-it-fast.md)
- **`spring.flyway.target` set in a shared profile.** Migrations silently stop applying and the
  application starts perfectly. [11d2](11d2-testing-a-data-migration.md)
- **`spring.jpa.hibernate.ddl-auto: update`.** The whole reason this topic exists.
  [07b](07b-validate-not-update.md)
- **`spring.flyway.out-of-order: true` turned on to unblock a merge.** It makes the history's order a
  property of when people happened to run things. [02c](02c-choosing-version-numbers.md)
- **`baseline-on-migrate: true` added to make an error go away.** It writes a synthetic row that
  declares everything below it already done, and everything below it will never run.
  [06](06-baselining.md)
- **A `repair` in a runbook with no explanation of which of its three actions is wanted.**
  [04d](04d-what-repair-actually-does.md)
- **An `UPDATE` with no `WHERE`, in any file, ever.** [10](10-data-migrations.md)

## Gotchas

**★ Backward compatibility has to hold in both directions.** Everyone checks that the new code works
with the new schema. The rollout also runs old code against the new schema, and a rollback runs old
code against the new schema for much longer.

**★ "We will drop the old column in the next sprint" is where contract migrations die.** The expand
half ships because it unblocks a feature; the contract half has no advocate. Review the expand with
the contract already written, or accept that the column is permanent.

**★ The advisory lock question is about the *other* pods, and the author is thinking about theirs.**
The instance running the migration always succeeds. The failure is nine crash-looping pods and an
error message naming `lockRetryCount`.

**★ `CREATE INDEX CONCURRENTLY` in one migration is an application-wide configuration change.** You
cannot have both a transactional advisory lock and a statement that refuses to run in a transaction,
so the entire application moves to session-level locks — and a session lock is released by a `finally`
block that a `SIGKILL` never reaches.

**★ A `@DataJpaTest` that passes is not evidence that migrations work.** The slice does not import
`FlywayAutoConfiguration`, so Hibernate built the schema from the entities and the migrations were
never involved.

**★ Splitting the migration and the entity change across two pull requests breaks `validate` in
whichever merges first.** They are one change to one thing described twice; they merge together.

**★ Nobody plans the recovery until they need it.** Ask what a mid-way failure leaves behind while the
author still remembers the migration, not at 03:00 while somebody reads
[03b](03b-when-a-migration-fails.md) for the first time.

**★ Resumability is a property you design, not one you discover.** A long migration will be killed
eventually — by a readiness probe, by a node eviction, by somebody. Whether that is survivable was
decided when the predicate was written.

**★ A migration that is reversible in principle is not reversible in practice unless somebody has
written down how.** "We could drop the column" is not a rollback plan; the plan is a file.

**★ The deploy window is a review item.** The worst case of a migration that takes an
`ACCESS EXCLUSIVE` lock is bounded by how quickly somebody notices, and that is a scheduling decision
as much as a technical one.

**★ Every red flag above has a legitimate use somewhere.** `out-of-order`, `baseline-on-migrate`,
`clean` and `repair` all exist for real reasons ([04e](04e-when-repair-is-the-right-answer.md),
[06b](06b-adopting-flyway-on-an-existing-database.md)). They are red flags in a routine pull request
because their legitimate uses are never routine.

## Interview questions

**★ A migration adds a `NOT NULL` column with a default. What do you ask before approving?**
Whether the currently deployed code knows about the column. During the rollout old pods are still
inserting rows without it, and if they use an explicit column list that is fine, but if the constraint
arrives before the code that populates it, every insert from an old pod fails. Then: what lock the
statement takes and for how long against production's row count, and whether this is the expand half
of a pair whose contract half exists.

**★ How long is too long for a migration to hold Flyway's lock?**
Longer than the losing instances' retry budget, which by default is about fifty seconds — fifty
attempts at a fixed one-second interval. Past that the other pods throw, fail their contexts and
crash-loop, and the symptom looks like a stuck rollout rather than a slow migration. Raising
`lock-retry-count` moves that wall but leaves the orchestrator's readiness deadline and the pipeline
timeout standing behind it.

**★ The pull request adds `spring.flyway.out-of-order: true`. What is your response?**
That it is almost certainly being used to unblock a merge conflict between two branches that both
claimed a version, and that the fix is renumbering, not reconfiguring. Out-of-order makes the
history's order depend on when people happened to deploy rather than on what depends on what — and the
history table is the one record you rely on being an accurate account of what happened to this
database.

**★ Someone adds `baseline-on-migrate: true` because a migration failed. Approve?**
No. It writes a synthetic baseline row declaring everything at or below that version already applied,
so the migrations below it will never run and the checksum comparison never runs against them either.
It is the correct tool for adopting Flyway on a database that already exists, and it is a way of
making an error disappear along with the work it was reporting.

**★ How do you review the test coverage of a migration?**
Three questions. Does a test apply every migration to an empty PostgreSQL — a real one, not H2 — with
`ddl-auto: validate` on? If it is a `@DataJpaTest`, it does not, because the slice never imports
Flyway's auto-configuration and Hibernate built the schema from the entities. And if the migration
touches rows, is there a `target`-staged test that seeds pre-migration data and asserts both what
changed and what did not?

**★ What is the last question on the checklist?**
What happens when it fails. What is left in the database — nothing, for a transactional migration on
PostgreSQL; partial data and a `success = false` row for a non-transactional one. Whether recovery
needs a `repair` and whether the author knows what `repair` actually does. Whether the migration can
simply be re-run. And whether anyone who can answer those questions will be awake when it deploys.

**★ Someone argues this checklist is too heavy for a one-line migration. Are they right?**
Partly, and the answer is that the passes are cheap when the answers are obvious. A nullable column on
a small table clears Pass 2 and Pass 3 in seconds. The checklist earns its cost on the migration that
*looks* like that one and is not — the same `ALTER TABLE` against a table with ninety million rows and
a long-running reporting query holding a lock on it. The point of running the passes every time is
that you cannot tell which kind you have by looking at the diff.

{/* FOOTER */}
