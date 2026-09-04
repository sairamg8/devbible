---
title: "There is exactly one situation in which repair is honest — the record is wrong and the database is right — and every other use of it converts a correct error into silence over a record that no longer describes anything"
sidebar_label: "04e · When repair is the right answer"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the *Repair* command reference
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/repair-277578892.html)),
> the *Skip Executing Migrations* setting
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/flyway-skip-executing-migrations-setting-277579025.html)),
> Flyway 12's `DbRepair`
> ([DbRepair.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/internal/command/DbRepair.java))
> and Spring Boot 4.1's `FlywayAutoConfiguration` / `FlywayMigrationStrategy`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/main/module/spring-boot-flyway/src/main/java/org/springframework/boot/flyway/autoconfigure/FlywayAutoConfiguration.java)).
> JDK 25, Spring Boot 4.1.1, Flyway 12.4.0, PostgreSQL 18.

**[04d](04d-what-repair-actually-does.md) is what the command does. This is the part that decides
whether running it was a fix or a cover-up, and the test is a single question asked honestly:
is the record wrong, or is the database wrong? `repair` can only ever address the first. Every
argument for running it that does not begin by answering that question is an argument for making
an error message disappear.**

## What `repair` never does

- **It never changes your schema.** Not one table, index, constraint or row. All three of its
  actions are DML against one bookkeeping table.
- **It never re-runs a migration.** `repair` followed by `migrate` is two commands, and only the
  second one runs anything.
- **It never reverts a file.** The file on disk is the input to the alignment, never the output.
- **It never tells you whether the alignment was correct.** Action 3 makes the recorded checksum
  equal the file's checksum. Whether the database actually contains what the file describes is a
  question it does not ask and cannot answer.

That last point is the whole risk, and it deserves stating as flatly as possible: **`repair` after
an accidental edit converts a loud, correct error into silence over a wrong record.** The mismatch
was the only signal that the schema and the repository had diverged. `repair` removes the signal
and leaves the divergence.

## The test: is the record wrong, or is the database wrong?

| Situation | Which is wrong | `repair`? |
|---|---|---|
| Somebody edited an applied migration by accident | the **record would become** wrong | ⛔ revert the file |
| Old migrations deliberately consolidated into a baseline | the record | ✅ yes — tombstone the missing ones |
| A non-transactional migration failed and you cleaned up by hand | the record | ✅ yes — after the cleanup, not before |
| A migration was renamed and you have established the SQL is byte-identical | the record | ✅ yes, and it is cosmetic |
| A hotfix was applied to the database outside Flyway | the record | ⚠️ not `repair` — see below |
| The build fails and the release is late | neither has been established | ⛔ **stop** |

The last row is not a joke; it is the situation `repair` is actually run in most of the time. The
useful discipline is to require the answer out loud, in the pull request or the incident channel,
before the command is typed: *the record is wrong because ___, and the database is right because
___.* If neither blank can be filled, the correct action is to revert the file and let the build go
green honestly.

## The three legitimate uses, concretely

### 1. After a deliberate history collapse

You have squashed `V1`–`V40` into `B41__baseline.sql` and deleted the originals
([06 · Baselining](06-baselining.md)). Every long-lived database now has forty rows with no files,
which is state `Missing`, and `validate` fails on the first one:

> *"Detected applied migration not resolved locally: 1.
> If you removed this migration intentionally, run repair to mark the migration as deleted."*

The message is telling you exactly this case. The database is right — it genuinely ran those
forty migrations — and the record needs to say that they are gone on purpose. `repair` appends
forty tombstones and the next `validate` passes.

### 2. After a genuinely non-transactional failure

`V22` contains `CREATE INDEX CONCURRENTLY`, cannot run in a transaction, and failed halfway
([03b · When a migration fails](03b-when-a-migration-fails.md)). There is a `success = false` row
and an invalid index in the database.

**The order matters and it is the opposite of what people do.** Clean up first — drop the invalid
index — *then* `repair` to remove the failed row, *then* `migrate` to re-run `V22`. Running
`repair` first and `migrate` immediately after re-runs the migration against a database that still
has the wreckage, and the retry fails on the object that already exists.

### 3. After a rename you have positively established is cosmetic

`V7__Add_index.sql` became `V7__Add_index_on_orders.sql`, producing a description mismatch and no
checksum mismatch ([04](04-checksums-and-immutability.md)). The SQL is unchanged, so the database
is right and the record is stale. This is the one case where `repair` is genuinely trivial — and
the word doing the work is *established*: a checksum match proves the file's lines are unchanged,
which is exactly what makes this case safe and the accidental-edit case not.

## The case `repair` cannot handle: an out-of-band change

Someone ran `ALTER TABLE orders ADD COLUMN status text` by hand during an incident. The database
has a column no migration describes. `repair` is useless here — there is no row and no file for it
to reconcile, and the history table is already perfectly self-consistent
([03c](03c-reading-the-history.md)).

The documented tool is `skipExecutingMigrations`, and it is Community rather than a paid feature:

> *"Whether Flyway should skip migration execution. The remainder of the operation will run as
> normal — including updating the schema history table"* … *"can be used to bring an out-of-process
> change into Flyway's change control process. For instance, a script run against the database
> outside of Flyway (like a hotfix) can be turned into a migration."*

So the workflow is: write the migration that describes the hotfix, run it **once** with
`skip-executing-migrations: true` against the database that already has the change, and run it
normally everywhere else.

```yaml
# ONE run, against ONE database, then remove this. It is not a setting to leave in a config file.
spring:
  flyway:
    skip-executing-migrations: true
```

⚠️ **It skips every pending migration, not the one you have in mind.** There is no per-migration
form. If three migrations are pending, all three get history rows and none of them run, and the
two you did want are now recorded as applied without ever having executed. Get the database to a
state where exactly the intended migration is pending before using it.

## `repair` needs the same configuration as `migrate`

From the reference: *"repair must be given the same locations as migrate"*. It is not a stylistic
hint. All three actions are computed by joining the history table against the migrations resolvable
from `locations` — the same join `info` prints. Point `repair` at a different or empty `locations`
and **every applied migration looks missing**, which puts every one of them in scope for a
tombstone.

```yaml
# The invariant: whatever migrate sees, repair must see.
spring:
  flyway:
    locations:
      - "classpath:db/migration"
      - "classpath:db/migration/{vendor}"
```

The same applies to `ignore-migration-patterns`, `cherry-pick`, `table` and the schema settings. A
`repair` run from a laptop with a partial checkout against a production database is the worst-case
version of this, and it does not error — it does precisely what it was asked.

## How you actually run it in a Spring Boot service

There is no `spring.flyway.repair` property, and that absence is deliberate. Three ways, in
descending order of how much you should like them:

**The Flyway command line or the Maven/Gradle plugin, run by a human, against one database.** The
best option, because it forces someone to be present.

**A `FlywayMigrationStrategy` bean**, which replaces what `FlywayMigrationInitializer` does at
startup:

```java
@Bean
FlywayMigrationStrategy repairThenMigrate() {
    return flyway -> {
        flyway.repair();
        flyway.migrate();
    };
}
```

⚠️ **This is shown so it can be recognised in a codebase and argued about, not recommended.** It
ratifies whatever mismatch exists on every start of every instance, which is the opposite of what
validation is for. A defensible variant guards it behind a profile that only ever exists on a
throwaway environment.

**Never in production automatically.** Every legitimate use of `repair` involves a human deciding
that the record is wrong. Automating it removes the only step that made it safe.

## Gotchas

**★ `repair` edits the history table and nothing else — it cannot undo a migration.** Everybody
expects otherwise the first time.

**★ Aligning a checksum makes the error go away without making the database right.** The error was
the only signal you had; deleting the signal is not resolving the cause.

**★ `repair` succeeds silently when it has nothing to do.** A successful run is not evidence that
anything was wrong, or that anything was fixed.

**★ Clean up a failed non-transactional migration *before* `repair`, not after.** `repair` then
`migrate` re-runs the migration against the wreckage, and the retry fails on the object that
already exists.

**★ `repair` must be run with the same `locations` as `migrate`.** With the wrong or an empty
locations list every applied migration looks missing, and all of them become tombstone candidates.

**★ It also needs the same `table`, schema, `cherry-pick` and `ignore-migration-patterns`.** Any
configuration that changes the join changes what `repair` decides to do.

**★ There is no `spring.flyway.repair` property**, and the absence is intentional. Running it
requires the CLI, a build plugin, or a bean you wrote on purpose.

**★ A `FlywayMigrationStrategy` that repairs before migrating ratifies every mismatch on every
pod start.** It is the most common way a team disables validation without realising they have.

**★ `skip-executing-migrations` skips *every* pending migration, not a chosen one.** Three pending
migrations means three history rows and zero executions. There is no per-migration form.

**★ `skip-executing-migrations` is a one-run flag, not a configuration setting.** Leaving it in a
config file means the next real migration is recorded as applied and never runs.

**★ It is Community, not Teams.** Verified against the reference documentation, which carries no
edition tag on that setting — worth knowing, because the answer to "we cannot afford the paid
edition" is often that this is the feature people assumed was paid.

**★ Neither `repair` nor `skip-executing-migrations` helps with drift you have not noticed.** Both
require you to already know what the database contains. Finding that out is a schema comparison,
not a history-table operation.

**★ "The build is red and the release is late" is not one of the legitimate cases.** It is the
situation the command gets run in most often, and the situation in which it does the most damage.

## Interview questions

**★ Does `repair` undo a migration?**
No. It cannot change your schema at all. If a failed migration left half a table behind, that half
is still there afterwards — the command's own output says manual cleanup may be required.

**★ What is the test for whether running `repair` is legitimate?**
Whether the *record* is wrong or the *database* is wrong. `repair` can only address the first. If
you cannot state why the record is wrong and why the database is right, the answer is to revert the
file instead.

**★ Give three cases where `repair` is the correct command.**
After deliberately consolidating old migrations into a baseline, so the missing rows get
tombstoned. After a non-transactional migration failed and you have cleaned up its effects by hand.
After a rename you have established is cosmetic, where the checksum still matches and only the
description moved.

**★ In what order do you clean up after a failed `CREATE INDEX CONCURRENTLY`?**
Drop the invalid index first, then `repair` to remove the failed row, then `migrate` to re-run it.
Doing `repair` first and `migrate` immediately means the retry runs against a database that still
holds the wreckage.

**★ Someone applied a hotfix to production with `psql`. How do you bring it under control?**
Write the migration that describes the change, then run it once against that database with
`skip-executing-migrations` so it is recorded without executing, and run it normally everywhere
else. `repair` is no help — there is nothing for it to reconcile.

**★ What is the danger of `skip-executing-migrations`?**
It skips everything pending, not one chosen migration, and there is no per-migration form. If three
migrations are pending, all three are recorded as applied and none of them run. It is a
one-invocation flag, never a setting to leave in a config file.

**★ Why must `repair` be given the same `locations` as `migrate`?**
Because all three of its actions come from the join between the history table and the resolvable
migrations. With the wrong locations every applied migration looks missing, and every one becomes a
tombstone candidate. It will not error; it will do exactly what you asked.

**★ How do you run `repair` in a Spring Boot service?**
Not through a property — there is none. Through the Flyway CLI or a build plugin, run deliberately
by a person; or, if it genuinely must happen in-process, a `FlywayMigrationStrategy` bean confined
to a throwaway profile.

**★ What is wrong with a `FlywayMigrationStrategy` that calls `repair()` then `migrate()`?**
It ratifies whatever mismatch exists, silently, on every start of every instance. It is validation
turned off with extra steps, and it is usually written by someone solving a one-off problem who did
not realise it would run forever.

**★ Is `repair` safe to run automatically at application start?**
No. Every legitimate use of it involves a human deciding the record is wrong. Automating it removes
the only step that made it safe, and guarantees the next accidental edit is accepted without
anybody seeing it.

**★ You have a checksum mismatch on a production database and a release waiting. What do you do?**
Revert the migration file to what actually ran, and ship the intended change as a new migration.
That is almost always faster than establishing that `repair` is safe, and it is the only option
that leaves the history true.

**★ What can neither `repair` nor `skip-executing-migrations` do for you?**
Tell you what the database actually contains. Both require you to already know. Detecting drift you
have not noticed is a comparison against the live schema, which is a different tool and a different
question.

{/* FOOTER */}
