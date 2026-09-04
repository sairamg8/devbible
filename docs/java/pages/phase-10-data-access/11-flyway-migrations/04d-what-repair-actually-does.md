---
title: "repair edits the record and never the database, it does exactly three things in a fixed order, and two of them do not mean what their names suggest — one is a real DELETE and the other is an INSERT"
sidebar_label: "04d · What repair actually does"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Flyway 12's `DbRepair`
> ([DbRepair.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/internal/command/DbRepair.java)),
> `JdbcTableSchemaHistory`
> ([JdbcTableSchemaHistory.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/internal/schemahistory/JdbcTableSchemaHistory.java))
> and the *Repair* command reference
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/repair-277578892.html)).
> JDK 25, Spring Boot 4.1.1, Flyway 12.4.0, PostgreSQL 18.

**`repair` is the command people reach for when a deployment will not start, and it is almost
always reached for without knowing what it does. The one sentence worth memorising before ever
running it: it modifies the schema history table and nothing else. It does not undo a migration,
does not re-run one, does not touch a table, an index or a row of your data. It edits the record of
what happened — and whether that record then becomes more true or less true is entirely your
decision, which the command itself cannot tell the difference between.**

## The three actions, in order

The documentation lists three things, and the source runs them in exactly that order inside a
single transaction where the database supports one:

```java
completedActions.removedFailedMigrations =
    schemaHistory.removeFailedMigrations(repairResult, configuration.getCherryPick());
migrationInfoService.refresh();
completedActions.deletedMissingMigrations = deleteMissingMigrations();
completedActions.alignedAppliedMigrationChecksums = alignAppliedMigrationsWithResolvedMigrations();
```

The three completion messages name them, and they are the vocabulary to think in:

| Action | Message | What it does to the table |
|---|---|---|
| 1 | *"Removed failed migrations"* | **`DELETE`** the rows where `success = false` |
| 2 | *"Marked missing migrations as deleted"* | **`INSERT`** a tombstone row of type `DELETE` |
| 3 | *"Aligned applied migration checksums"* | **`UPDATE`** description, type and checksum |

Two of the three names are misleading, and both misdirections point the same way — towards
thinking `repair` removes more than it does.

## Action 1 — removing failed migrations is a real `DELETE`

`removeFailedMigrations` finds every applied migration with `success = false` and issues an actual
delete statement per row. The row is gone; nothing records that it was ever there.

This is the one action whose scope is genuinely narrow, and for a reason established in
[03b · When a migration fails](03b-when-a-migration-fails.md): on PostgreSQL, a migration that
fails inside a transaction is rolled back and **no row is written at all**. A `success = false` row
only ever exists when the migration could not run transactionally — `execute-in-transaction: false`,
`mixed: true`, or a statement PostgreSQL refuses to run in a transaction block such as
`CREATE INDEX CONCURRENTLY`.

So on PostgreSQL, action 1 usually finds nothing to do, and when it does find something the
half-applied DDL is still sitting in the database. The command says so itself when the database
lacks DDL transactions:

> *"Manual cleanup of the remaining effects of the failed migration may still be required."*

The documentation is blunter: *"User objects left behind must still be cleaned up manually."*
Running `repair` and then `migrate` without doing that cleanup re-runs the migration against a
database that already has half of it — which is how a failed `CREATE TABLE` becomes a
`relation already exists` on the retry.

## Action 2 — "marked as deleted" is an `INSERT`, not a delete

This is the one that surprises everybody who looks at the table afterwards. `delete(AppliedMigration)`
does not delete:

```java
jdbcTemplate.update(database.getInsertStatement(table),
    calculateInstalledRank(appliedMigration.getType()),
    versionObj,
    appliedMigration.getDescription(),
    "DELETE",                          // <- the type of the NEW row
    appliedMigration.getScript(),
    checksumObj,
    database.getInstalledBy(),
    0,                                 // execution_time
    appliedMigration.isSuccess());
```

A **new row** is appended with a fresh `installed_rank` and type `DELETE`. The original row is
untouched and stays exactly where it was. That is why `DELETE` appears in
[03 · The history table](03-the-history-table.md)'s list of synthetic types, and why `MigrationState.DELETED`
exists at all: the pair is now "an applied migration plus a tombstone that cancels it", and
`validate()` returns early on `DELETED` without comparing anything.

The append-only shape is the right design — it keeps the history a log rather than a mutable
picture — but it has consequences worth stating:

- **The table grows.** Every `repair` that tombstones a migration adds a row rather than removing
  one, and a schema with a long history of collapsed migrations accumulates them.
- **Both rows show up in a naive query.** `SELECT * FROM flyway_schema_history WHERE version = '7'`
  now returns two rows, and only the higher `installed_rank` is current.
- **The tombstone carries the old checksum**, so the record of what actually ran is preserved even
  though nothing will compare against it again.

And a follow-up warning the command prints, which is the important half:

> *"Please ensure the previous contents of the deleted migrations are removed from the database, or
> moved into an existing migration."*

Marking `V7` as deleted does not remove `V7`'s table. If nothing else creates that table, the
migration set no longer reproduces the schema — which is the exact failure the whole apparatus
exists to prevent.

### It tombstones future migrations too, not just missing ones

The selection is broader than the name suggests:

```java
final boolean isMigrationMissing = state == MigrationState.MISSING_SUCCESS
    || state == MigrationState.MISSING_FAILED
    || state == MigrationState.FUTURE_SUCCESS
    || state == MigrationState.FUTURE_FAILED;
```

**A `Future` migration — the residue of a rolled-back release — is in scope for action 2.** The
only thing standing between it and a tombstone is the ignore-pattern filter applied on the next
line, and under Spring Boot that filter defaults to `*:future`
([03c](03c-reading-the-history.md)). So Boot's default protects you here, and clearing
`ignore-migration-patterns` in order to tighten validation quietly makes `repair` destructive to
exactly the rows a rollback left behind.

⚠️ Synthetic types (`SCHEMA`, `BASELINE`, `DELETE`) and undo migrations are skipped, so `repair`
cannot tombstone the baseline row or a previous tombstone.

## Action 3 — aligning is an `UPDATE`, by `installed_rank`

The third action is the one people actually want when a build says *checksum mismatch*. It
rewrites the applied row to agree with the file:

```java
jdbcTemplate.update(database.getUpdateStatement(table),
    description,                       // from the RESOLVED migration
    type.name(),
    checksumObj,
    appliedMigration.getInstalledRank());   // the WHERE key
```

Three fields change — `description`, `type`, `checksum` — and `updateNeeded` fires if **any** of
the three differs. `installed_rank` is the key, which is another reason
[03c](03c-reading-the-history.md) insists it is the only column that records reality.

Two details in the selection matter:

- **`type` is taken from the resolved side unless the applied type is synthetic.** A `BASELINE`
  row keeps its type; an ordinary migration adopts the file's.
- **States `UNDONE` and `IGNORED` are skipped**, as are synthetic applied types. An `IGNORED`
  migration is one that will never run ([03c](03c-reading-the-history.md)); aligning its checksum
  would be recording agreement about something that did not happen.

Repeatable migrations take a separate branch with a narrower condition —
`checksumMatchesWithoutBeingIdentical` — which exists for the placeholder asymmetry described in
[04b](04b-the-edits-nothing-catches.md), where a repeatable migration has both a substituted and a
raw checksum.

## The three actions are the whole mechanism — using it is a separate question

Everything above is what the command *does*. What it deliberately does not do, the configuration
it has to be given to do it correctly, and the far harder question of when running it is honest
rather than merely convenient, are
[04e · When repair is the right answer](04e-when-repair-is-the-right-answer.md).

## Gotchas

**★ `repair` edits the history table and nothing else.** It cannot undo a migration, roll back a
change, or clean up half-applied DDL. Everybody expects one of those the first time.

**★ "Marked missing migrations as deleted" is an `INSERT`.** A new row of type `DELETE` is
appended; the original row stays. The table grows and a naive query by version returns two rows.

**★ Only the highest `installed_rank` for a version is current.** After a tombstone, reading the
table without ordering by `installed_rank` gives you the wrong answer.

**★ `repair` tombstones `Future` migrations as well as `Missing` ones.** Boot's default
`ignore-migration-patterns` of `*:future` is what stops it. Clearing that setting to tighten
validation makes `repair` destructive to rollback residue.

**★ Removing failed migrations is a real `DELETE` and it is unrecorded.** Unlike action 2 there is
no tombstone — the row simply ceases to exist.

**★ On PostgreSQL, action 1 usually has nothing to do.** A transactional failure leaves no row at
all, so `success = false` only appears for non-transactional migrations. If `repair` did remove a
failed row, half-applied DDL is almost certainly still in the database.

**★ `repair` then `migrate` without manual cleanup re-runs the failed migration against a database
that already has part of it.** That is where `relation already exists` on a retry comes from.

**★ Action 3 aligns three fields, not one.** Description, type and checksum all move to match the
file, and a difference in any one triggers the update. "Repairing the checksum" understates it.

**★ `installed_rank` is the update key.** Not version, not script. Another reason to treat it as
the identity of a row.

**★ `IGNORED` and `UNDONE` migrations are skipped by alignment.** A migration that will never run
does not get its checksum agreed with.

## Interview questions

**★ What does `flyway repair` do?**
Three things to the schema history table, in order: physically deletes rows with `success = false`,
appends a `DELETE`-type tombstone row for missing (and future) migrations, and updates the
description, type and checksum of applied rows to match the files. It never touches the schema
itself.

**★ Why does "marked as deleted" not delete the row?**
Because the history is append-only by design. `delete()` inserts a new row with a fresh
`installed_rank` and type `DELETE`, which is what puts the pair into state `DELETED` and makes
`validate` skip it. Keeping the original row preserves the record that the migration really ran.

**★ You run `repair` and the table has more rows than before. Is that a bug?**
No, that is action 2 working as designed. Tombstones are appended. Only removing a *failed*
migration actually deletes.

**★ A rolled-back release left a `Future` migration in the table. What does `repair` do to it?**
Under Spring Boot's defaults, nothing — `ignore-migration-patterns` is `*:future` and the filter
skips it. Clear that setting and `repair` will tombstone it, because future states are in the same
selection as missing ones.

**★ Which fields does the alignment step actually change?**
`description`, `type` and `checksum`, keyed on `installed_rank`, and it fires if any one of the
three differs. The type comes from the resolved migration unless the applied type is synthetic, so
a `BASELINE` row keeps its own type.

**★ Why are `IGNORED` and `UNDONE` migrations skipped by the alignment?**
Because aligning them would record agreement about something that did not happen. An `IGNORED`
migration is one that will never be applied, so its checksum has nothing to agree with.

**★ On PostgreSQL, when does a `success = false` row exist at all?**
Only when the migration could not run in a transaction — `execute-in-transaction: false`, `mixed`,
or a statement such as `CREATE INDEX CONCURRENTLY`. Anything that fails inside a transaction rolls
back and writes no row, so action 1 is usually a no-op there.

{/* FOOTER */}
