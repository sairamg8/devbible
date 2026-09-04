---
title: "info does not print the history table — it prints the join between the history table and the files, and the nineteen states it can report are the complete vocabulary Flyway has for describing how those two sides disagree"
sidebar_label: "03c · Reading the history"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Flyway 12's `MigrationState` enum
> ([MigrationState.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/api/MigrationState.java)),
> the *Info* command reference
> ([documentation.red-gate.com](https://documentation.red-gate.com/flyway/reference/commands/info)),
> the *Ignore Migration Patterns* setting
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/flyway-ignore-migration-patterns-setting-277579006.html))
> and Spring Boot 4.1's `FlywayProperties`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/main/module/spring-boot-flyway/src/main/java/org/springframework/boot/flyway/autoconfigure/FlywayProperties.java)).
> JDK 25, Spring Boot 4.1.1, Flyway 12.4.0, PostgreSQL 18.

**A row in `flyway_schema_history` has no state. A file in `db/migration` has no state. A *state*
only exists for a pairing of the two, and it is Flyway's answer to one question: does this pair
agree? Nineteen answers is more than it sounds, because most of them are ways of saying "one side
has something the other does not" — and knowing which side is missing is the whole of diagnosing
a migration problem.**

## The four categories, and then the nineteen

Every state in `MigrationState` carries three flags in the source: `resolved` (there is a file),
`applied` (there is a row), and `failed`. That gives the states a natural grouping, and the
grouping is more useful than the alphabet.

### Resolved but not applied — a file with no row

| State | Display | Means |
|---|---|---|
| `PENDING` | Pending | it will be applied on the next `migrate` |
| `ABOVE_TARGET` | Above Target | it will not be applied, because `target` is set lower |
| `BELOW_BASELINE` | Below Baseline | it will not be applied, because the baseline is higher |
| `BASELINE_IGNORED` | Ignored (Baseline) | a baseline migration covers this version |
| `IGNORED` | Ignored | ⚠️ see below — usually a problem |
| `AVAILABLE` | Available | an undo migration that could be applied *(Teams)* |

`IGNORED` is the one to read carefully. Its javadoc says it *"usually indicates a problem"*: the
migration *"was not applied against this DB, because a migration with a higher version has already
been applied. This probably means some checkins happened out of order."* An `IGNORED` migration
will never be applied by any future deployment unless you enable `out-of-order` — it is silently
skipped forever.

### Applied and resolved — the pair agrees

| State | Display | Means |
|---|---|---|
| `SUCCESS` | Success | applied, file present, checksums match |
| `OUT_OF_ORDER` | Out of Order | applied, but after a higher version had already run |
| `BASELINE` | Baseline | the synthetic row the `baseline` command wrote |
| `UNDONE` | Undone | applied and later undone *(Teams)* |
| `OUTDATED` | Outdated | a repeatable whose file has changed since it last ran |
| `SUPERSEDED` | Superseded | an older run of a repeatable that has since been re-applied |
| `FAILED` | Failed | applied, and it did not complete |

`OUT_OF_ORDER` carries a warning in the source worth repeating verbatim: *"Rerunning the entire
migration history might produce different results!"* That is the real cost of `out-of-order` — the
database you have is no longer reproducible by replaying the migrations in version order.

### Applied but not resolved — a row with no file

| State | Display | Means |
|---|---|---|
| `MISSING_SUCCESS` | Missing | the file is gone; the row says it ran |
| `MISSING_FAILED` | Failed (Missing) | the file is gone; the row says it failed |
| `FUTURE_SUCCESS` | Future | applied, and its version is higher than anything local |
| `FUTURE_FAILED` | Failed (Future) | the same, and it failed |
| `DELETED` | Deleted | `repair` marked this row as deliberately missing |

The javadoc for `MISSING_SUCCESS` names the innocent cause: *"This usually results from multiple
older migration files being consolidated into a single one."* That is exactly the baseline
migration workflow — [06 · Baselining](06-baselining.md). The guilty cause is somebody deleting a
migration from the repository because it looked old, which is
[04 · Checksums and immutability](04-checksums-and-immutability.md)'s subject.

`FUTURE_SUCCESS` has one dominant cause: a rollback. Version 4.2 deployed, applied `V31`, then was
rolled back to 4.1 whose jar contains only up to `V30`. The row for `V31` is now a future
migration, and Boot's default `ignore-migration-patterns` of `*:future` is precisely what stops
that rollback from being blocked.

## `info`, and how to narrow it

`info` *"prints the details and status information about all the migrations"*. Its per-migration
fields — visible in the documented JSON shape — are `category`, `version`, `description`, `type`,
`installedOnUTC`, `state`, `undoable`, `filepath`, `installedBy` and `executionTime`.

Note `category` and `filepath`: neither is a history-table column. `category` is `Versioned` or
`Repeatable`, and `filepath` is the resolved file on disk. That is the join being printed —
history columns on one side, file facts on the other.

Four filters are worth remembering, because `info` on a long-lived schema is unreadable otherwise:

| Parameter | Effect |
|---|---|
| `infoSinceVersion` | *"only migrations greater than or equal to this version, and any repeatable migrations"* |
| `infoUntilVersion` | the mirror image |
| `infoSinceDate` / `infoUntilDate` | by `installed_on`, formatted `dd/MM/yyyy HH:mm` |
| `infoOfState` | a case-insensitive comma-separated list of the display names above |

`infoOfState=failed,missing,out_of_order` is the closest thing Flyway has to a health check.

## Which disagreements are tolerated: `ignore-migration-patterns`

The setting takes patterns of the form `type:status`, comma-separated, where `type` is
`versioned`, `repeatable` or `*`, and `status` is one of `Missing`, `Pending`, `Ignored`, `Future`
or `*`.

```yaml
spring:
  flyway:
    ignore-migration-patterns:
      - "*:future"          # Boot's default
      - "repeatable:missing"
```

Two details that decide whether a configuration does what its author intended:

- **Boot defaults this to `["*:future"]`**, which is not Flyway's own listed default of `*:future`
  by coincidence — Boot carries the same value in `FlywayProperties`. Setting the property at all
  **replaces** the list, so adding `repeatable:missing` without re-stating `*:future` turns future
  tolerance off.
- *"Only `Missing` migrations are ignored during `repair`."* The patterns are a `validate`
  mechanism first; `repair` honours exactly one of the statuses.

⚠️ **`versioned:missing` is the pattern to be suspicious of.** It makes `validate` stop caring that
a migration which ran against production no longer exists in the repository. That is legitimate
after a deliberate history collapse and it is a disaster when it is hiding an accidental deletion,
because both look identical from the outside.

## Reading it directly, which is often faster

`flyway info` needs a shell with the tool, the configuration and the credentials. A `psql` session
needs only the last of those, and during an incident that difference is minutes.

```sql
-- what happened, in the order it actually happened
SELECT installed_rank, version, description, type,
       success, execution_time, installed_on, installed_by
  FROM flyway_schema_history
 ORDER BY installed_rank DESC
 LIMIT 20;
```

```sql
-- the one-line health check: anything but zero blocks the next deployment
SELECT count(*) FROM flyway_schema_history WHERE success = false;
```

```sql
-- what version does this database think it is at?
SELECT max(version::text) FROM flyway_schema_history
 WHERE success AND version IS NOT NULL;
```

⚠️ That last one is **wrong in a subtle way** and is shown because it is the query everybody
writes. `version` is text, so `'10'` sorts before `'9'`, and Flyway's own ordering is numeric per
dotted part. For a definitive answer, order by `installed_rank` and take the most recent row with
a non-null version — or ask `info`, which parses versions properly.

⚠️ **Never `ORDER BY version` when reconstructing an incident.** It gives you the intended order,
not the real one. `installed_rank` is the only column that records reality.

## What the table is not

- **It is not a rollback mechanism.** It records that `V7` ran; it does not record what `V7` did,
  and nothing in it can undo `V7`. Roll-forward is a consequence of this shape rather than a
  policy — [01 · Why schema is code](01-why-schema-is-code.md) argues that in full.
- **It is not a description of the schema.** If somebody ran `ALTER TABLE` by hand, the history
  table is unchanged and perfectly self-consistent, and completely wrong about the database.
  Detecting that needs a check against the live schema, which is what
  [07b · Validate, not update](07b-validate-not-update.md) is for.
- **It is not shared between databases.** Staging's table and production's table are different
  facts, which is why the same migration can be in-order in one environment and out-of-order in
  another.
- **It is not a deployment log.** A deployment that pulled an image, waited nine minutes for a
  lock and applied nothing leaves no trace here at all.

## Gotchas

**★ `IGNORED` means "will never be applied", not "not applied yet".** It is the state of a
migration that has been permanently skipped because a higher version already ran. Nothing will
pick it up later unless `out-of-order` is enabled.

**★ `OUT_OF_ORDER` means the database is no longer reproducible from the migrations in version
order.** The source says so directly. Any environment rebuilt from scratch may end up different.

**★ `MISSING` has an innocent cause and a guilty one, and they look identical.** Consolidating old
migrations produces it deliberately; deleting a migration because it "looked old" produces it
accidentally.

**★ Setting `ignore-migration-patterns` replaces Boot's default rather than adding to it.** Adding
`repeatable:missing` without re-stating `*:future` silently makes rollbacks fail.

**★ `versioned:missing` hides exactly the failure you most want to see.** After a deliberate
collapse it is correct; the rest of the time it is suppressing evidence that history was
rewritten.

**★ Only `Missing` is honoured by `repair`.** A pattern list tuned for `validate` does much less
during `repair` than its author expects.

**★ `SUPERSEDED` and `OUTDATED` only ever apply to repeatable migrations.** Seeing either against
a `V` migration means you are reading the wrong row.

**★ `ORDER BY version` is a text sort.** `'10'` before `'9'`, `'1.10'` before `'1.9'`. Flyway
compares versions numerically part by part; SQL does not.

**★ `info`'s `category` and `filepath` are not columns in the table.** They come from the file
side of the join, which is why `info` from a machine with a different set of migrations tells a
different story about the same database.

**★ A future migration can sit in a database indefinitely without anyone noticing.** It is ignored
by default, so every deployment reports success while the schema carries a change nothing in the
repository describes.

**★ `flyway info` needs the tool, the config and the credentials; `psql` needs one of the three.**
During an incident, reach for SQL.

**★ `installed_on` in `info` is labelled `installedOnUTC` and the column is the database's local
timestamp.** They are not necessarily the same reading, and the difference is exactly the sort of
thing that makes two people disagree about a timeline.

## Interview questions

**★ What does `flyway info` actually show?**
The join between the history table and the migrations resolvable from `locations`. Every row is a
pairing, and its *state* is Flyway's description of how the two sides agree or disagree. Fields
like `category` and `filepath` come from the file side and are not columns in the table.

**★ What is the difference between `Pending` and `Ignored`?**
`Pending` will be applied on the next `migrate`. `Ignored` will not be applied by anything, ever,
because a higher version has already run — it is the state of a migration that arrived too late,
and only `out-of-order` rescues it.

**★ You see a migration in the `Missing` state. What does it mean and is it a problem?**
The database has a row saying it ran, and there is no matching file. It is intended after
consolidating old migrations into a baseline, and it is a serious problem if it means somebody
deleted a migration from the repository — in which case the schema can no longer be rebuilt from
scratch.

**★ What is a `Future` migration and why does Spring Boot ignore it by default?**
A row whose version is higher than any local migration, almost always the residue of a rolled-back
release. Boot sets `ignore-migration-patterns` to `*:future` so redeploying the previous version
still starts rather than failing validation.

**★ Why does `OUT_OF_ORDER` carry a warning about reproducibility?**
Because the migrations no longer produce this database when replayed in version order. A fresh
environment built from the same repository may end up with a different schema, which breaks the
main promise of having migrations at all.

**★ How do you check quickly whether a database is safe to deploy to?**
`SELECT count(*) FROM flyway_schema_history WHERE success = false` — anything above zero means the
next deployment will refuse to start. `flyway info -infoOfState=failed,missing,out_of_order` is
the richer version if the tooling is to hand.

**★ What does `ignore-migration-patterns` control, and what is its grammar?**
Which disagreements `validate` tolerates. Patterns are `type:status` — `versioned`, `repeatable`
or `*` on the left; `Missing`, `Pending`, `Ignored`, `Future` or `*` on the right — comma
separated. During `repair` only `Missing` is honoured.

**★ Why is `ORDER BY version` the wrong way to read the table?**
Two reasons. It is a text sort, so `'10'` precedes `'9'`. And even sorted properly it gives the
intended order rather than the order this database applied things, which diverge the moment
anything runs out of order.

**★ Can you tell from the history table whether the schema is correct?**
No. It records which migrations ran, not what the schema contains. A hand-run `ALTER TABLE` leaves
it entirely consistent and entirely wrong. Detecting drift needs a comparison against the live
schema.

**★ Which states apply only to repeatable migrations?**
`OUTDATED` — the file has changed since it last ran — and `SUPERSEDED`, an older run that a newer
one has replaced. Both are normal; neither can appear for a versioned migration.

**★ A deployment hung for nine minutes and applied nothing. What does the history table say?**
Nothing at all. Lock waiting is not recorded anywhere in it, which is why "the history table looks
fine" is compatible with a badly broken deployment.

{/* FOOTER */}
