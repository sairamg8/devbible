---
title: "A B-prefixed baseline migration is a real SQL file that runs only against a database with no history at all, which is exactly what makes it the tool for collapsing four hundred migrations into one without breaking the databases that ran them"
sidebar_label: "06c · Baseline migrations"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the *Baseline migrations* reference
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/baseline-migrations-273973336.html)),
> Flyway 12's `BaselineResolvedMigration`
> ([BaselineResolvedMigration.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/api/migration/baseline/BaselineResolvedMigration.java)),
> `MigrationInfoImpl.validate()`
> ([MigrationInfoImpl.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/internal/info/MigrationInfoImpl.java))
> and the *Repair* command reference
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/repair-277578892.html)).
> JDK 25, Spring Boot 4.1.1, Flyway 12.4.0, PostgreSQL 18.

**The `baseline` command of [06](06-baselining.md) solves the existing database. A baseline
*migration* solves the opposite case — the empty one, which would otherwise have to replay every
migration ever written. It is an ordinary SQL file with a `B` prefix, it contains real DDL, and it
runs during `migrate` like anything else. Its one unusual property is a condition in
`BaselineResolvedMigration.getState`: it is only ever `Pending` on a database with no applied
migrations and no baseline row. Everywhere else it is `Ignored`, silently and correctly.**

## The naming, and what the version means

```
B5__Initial_schema.sql
│ └─ version 5 — and the meaning of that number is specific
└─── the baseline-migration prefix (`baselineMigrationPrefix`, default `B`)
```

From the reference:

> *"`B5__my_database.sql` represents the state of your database after applying all versioned
> migrations up to and including `V5`."*

So `B5` is not "version 5 of something". It is **the collapsed equivalent of `V1` through `V5`**,
and its version number is a claim about which migrations it replaces.

And the sentence that settles the confusion with [06](06-baselining.md):

> *"Baseline migrations are not affiliated with the `baseline` command and are executed during the
> `migrate` process."*

Two different mechanisms, one word, opposite directions. The command says *do not run these*; the
migration says *run this instead of those*.

Its type in the history table is `SQL_BASELINE` (or `JDBC_BASELINE` for a Java one), which is why
[03](03-the-history-table.md)'s type list has entries most people never see.

## The one rule that makes it work

```java
@Override
public MigrationState getState(final MigrationInfoContext context) {
    final MigrationState migrationState = super.getState(context);
    if (migrationState == MigrationState.PENDING && migrationsAppliedOrBaselineExists(context)) {
        return MigrationState.IGNORED;
    }
    ...
}

private boolean migrationsAppliedOrBaselineExists(final MigrationInfoContext context) {
    return context.appliedBaseline != null || context.lastApplied != MigrationVersion.EMPTY;
}
```

**A baseline migration runs only when the database has no applied migrations and no baseline row.**
Any history at all — one applied migration, or a `BASELINE` marker from the command — and it
becomes `IGNORED`.

That single condition is what makes the whole feature safe:

| Database | `B5` | `V6`, `V7`, … |
|---|---|---|
| empty | ✅ runs | ✅ run after it |
| already at `V5` | ⛔ `Ignored` | ✅ run |
| already at `V3` | ⛔ `Ignored` | ⚠️ so do `V4` and `V5`, **if their files still exist** |
| baselined by the command | ⛔ `Ignored` | ✅ per the baseline version |

⚠️ **`IGNORED` normally fails `validate`** ([03c](03c-reading-the-history.md)) — but not here.
`validate()` guards that branch with `!resolvedMigration.getType().isBaseline()`, so an ignored
baseline migration is expected and silent.

⚠️ **The third row is the one to think about.** A database stuck at `V3` needs `V4` and `V5`, and
those are exactly the files a history collapse deletes. Collapsing is only safe once every
long-lived database has passed the version you are collapsing to.

## Collapsing a long history: the procedure

Four hundred migrations is not a performance problem — an unchanged migration set costs a resolve
and nothing else. It is a comprehension problem: nobody can see what the schema is, and the first
twenty files describe tables that were dropped in year two.

### 1. Establish the floor

Find the lowest version any database you care about has applied. That is the highest version you
may collapse to. Getting this wrong strands the database below it with migrations that no longer
exist.

```sql
-- run on every environment; take the lowest answer
SELECT version, installed_on
  FROM flyway_schema_history
 WHERE success AND version IS NOT NULL
 ORDER BY installed_rank DESC
 LIMIT 1;
```

### 2. Produce `B<n>__…sql` and verify it from empty

Same discipline as [06b](06b-adopting-flyway-on-an-existing-database.md) step 2, and the same
reason: build an empty database with `B<n>`, build another by replaying `V1`–`V<n>`, and **diff the
two schemas**. If they differ, the collapse is a schema change disguised as a tidy-up.

⚠️ This is where a dump is *not* good enough on its own. `pg_dump` of a database built by
migrations includes anything the migrations did that you forgot about — a stray index, a column
left `NOT NULL` by a later fix — and that is exactly what you want captured, which is why the
comparison is against the replayed schema and not against your memory of it.

### 3. Delete `V1`–`V<n>` and keep everything above

The deleted files are the point of the exercise. `B<n>` replaces them for new databases; existing
databases already ran them.

### 4. Repair every existing database

Every deleted file leaves an applied row with nothing to resolve to — state `Missing` — and
`validate` stops the next deployment:

> *"Detected applied migration not resolved locally: 1.
> If you removed this migration intentionally, run repair to mark the migration as deleted."*

That is [04d](04d-what-repair-actually-does.md)'s action 2, and this is the case it exists for. One
`repair` per environment appends the tombstones and validation passes again.

⚠️ **`repair` must be run with the new `locations`**, meaning the checkout that no longer has the
deleted files. Running it against the old checkout resolves them and does nothing.

### 5. Decide what happens to the environment you forgot

There is always one — an old QA database, a personal copy, a disaster-recovery replica. Its options
are: catch it up before the collapse, rebuild it from `B<n>` plus the survivors, or accept that it
is no longer manageable by Flyway. Deciding after the fact means deciding under pressure.

## What a collapse costs

**The replay path changes.** Before the collapse, a fresh database was built by the same sequence
production ran. After it, a fresh database runs `B<n>` — a file that was verified once, on the day
of the collapse, and never again. Every collapse widens the gap between "what production ran" and
"what a new environment runs", and the only thing holding them together is step 2.

**Tombstones accumulate.** Four hundred deleted migrations means four hundred appended `DELETE`
rows in every existing database's history table ([04d](04d-what-repair-actually-does.md)). Harmless,
and surprising the first time somebody counts the rows.

**History is genuinely lost.** The record that `V37` added a column with a particular default is
now only in version control. That is usually fine — and it is worth being deliberate rather than
discovering it during an incident.

## Gotchas

**★ `B5` means "the state after `V1` through `V5`", not "version 5 of the schema".** The number is a
claim about which migrations the file replaces.

**★ Baseline migrations and the `baseline` command are unrelated.** The documentation says so
outright. One runs SQL during `migrate`; the other writes a row and runs nothing.

**★ A baseline migration runs only on a database with no applied migrations and no baseline row.**
Any history at all makes it `Ignored`.

**★ An ignored baseline migration does not fail `validate`**, unlike every other `Ignored`
migration. The check is guarded on the baseline type.

**★ A database below the collapse version is stranded.** It still needs the files you deleted.
Establish the floor across every environment before collapsing, not after.

**★ Verify `B<n>` by diffing against a replayed schema, not against a dump of production.**
Production may have drifted; the replayed schema is what the migration set actually claims.

**★ Every deleted migration leaves a `Missing` row and blocks the next deployment until `repair`
runs.** That is expected, and it is the documented purpose of `repair`'s second action.

**★ `repair` has to run against the checkout that no longer contains the deleted files.** With the
old `locations` they resolve and nothing is tombstoned.

**★ Every environment needs its own `repair`.** The tombstones are rows in each database, not a
property of the repository.

**★ A collapse creates four hundred appended `DELETE` rows per environment.** Harmless, permanent,
and startling to whoever queries the table next.

**★ After a collapse, a fresh database and production no longer took the same path.** They agree
only as far as the verification on the day of the collapse established.

**★ `B` migrations have their own history types — `SQL_BASELINE` and `JDBC_BASELINE`.** A `V` file
rewritten as a `B` file is a *type* change, which `validate` reports before it looks at anything
else ([04](04-checksums-and-immutability.md)).

**★ Collapsing for performance is solving the wrong problem.** Unchanged migrations cost a resolve.
Collapse for comprehension, and say so, because the honest reason survives review better.

## Interview questions

**★ What is a baseline migration and how does it differ from the `baseline` command?**
A `B`-prefixed SQL file containing real DDL that builds the schema up to a given version. It runs
during `migrate`, but only against a database with no history at all. The `baseline` command is
unrelated: it writes one synthetic row into an existing database and executes nothing.

**★ What does the number in `B5__…sql` mean?**
That the file produces the state you would get by applying `V1` through `V5`. It is a claim about
which migrations it stands in for, not a version of the file itself.

**★ When exactly does a baseline migration run?**
Only when there are no applied migrations and no baseline row — `context.appliedBaseline == null &&
context.lastApplied == EMPTY`. Otherwise its state is `Ignored`.

**★ Why does an ignored baseline migration not fail validation, when `Ignored` normally does?**
Because `validate()` excludes baseline types from that check explicitly. Being ignored is the
normal, expected state of a baseline migration on any database with history.

**★ How do you collapse four hundred migrations into one?**
Establish the lowest version any live database has reached, write `B<n>` at or below it, verify it
by building an empty database and diffing against a replay of `V1`–`V<n>`, delete those files, and
run `repair` against every existing database so the now-missing rows are tombstoned.

**★ What breaks if you collapse to a version some database has not reached?**
That database still needs the deleted migrations and can no longer get them. Its baseline migration
is ignored because it has history, and the files that would move it forward are gone. It has to be
rebuilt or restored from a checkout that predates the collapse.

**★ Why must `repair` run with the new `locations`?**
Because the migrations are only "missing" relative to what `locations` resolves. Run it against the
old checkout and every file is found, so nothing is tombstoned and the next deployment fails again.

**★ Why verify `B<n>` against a replayed schema rather than against production?**
Because production may have drifted from what the migrations describe — a hand-run `ALTER TABLE`,
a hotfix. The replay is what the migration set actually claims, and the collapse must preserve the
claim, not the drift.

**★ What do you permanently lose by collapsing?**
The guarantee that a fresh database took the same path production did. After the collapse a new
environment runs one file that was verified once. You also lose the readable record of individual
changes, which now exists only in version control.

**★ Is collapsing worth doing for performance?**
Almost never. An unchanged migration set costs a resolve and no execution. The real motive is that
nobody can read four hundred files, and stating that motive honestly is what makes the review of
the collapse useful.

**★ Can a `V5` and a `B5` coexist in the same project?**
They are different types, so Flyway distinguishes them — but it is not a state to aim for. The
whole point of `B5` is that `V1`–`V5` have been removed; keeping both means two files claim the
same version and the type check has to arbitrate.

**★ How many tombstone rows does a collapse of four hundred migrations produce?**
Four hundred per existing database, appended by `repair`. They are harmless and permanent, and they
are why the history table of a long-lived, twice-collapsed schema is much larger than the number of
migrations that ever ran.

{/* FOOTER */}
