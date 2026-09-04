---
title: "Two different mechanisms share the word baseline — a command that writes one synthetic row and a migration file with a B prefix that builds a schema from empty — and confusing them is why adopting Flyway on an existing database goes wrong so often"
sidebar_label: "06 · Baselining"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Flyway 12's `DbBaseline`
> ([DbBaseline.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/internal/command/DbBaseline.java)),
> `ResolvedMigration.getState`
> ([ResolvedMigration.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/api/resolver/ResolvedMigration.java)),
> the *Baseline* command reference
> ([documentation.red-gate.com](https://documentation.red-gate.com/flyway/reference/commands/baseline)),
> the *Baseline migrations* reference
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/baseline-migrations-273973336.html))
> and Spring Boot 4.1's `FlywayProperties`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/main/module/spring-boot-flyway/src/main/java/org/springframework/boot/flyway/autoconfigure/FlywayProperties.java)).
> JDK 25, Spring Boot 4.1.1, Flyway 12.4.0, PostgreSQL 18.

**Every migration tool has to answer one awkward question: what do you do about the database that
already exists? Flyway answers it twice, with two mechanisms that share a word and solve opposite
halves of the problem. The `baseline` *command* tells an existing database "you are already at
version 5, do not run anything up to and including 5". A *baseline migration* — a file with a `B`
prefix — tells an *empty* database "here is version 5 in one file, so you need not replay the five
that produced it". Neither is a substitute for the other, and the documentation says outright that
they "are not affiliated".**

## The problem, stated once

You have a production database with forty tables and no migration tooling. Every environment was
built by hand or by a dump. You want Flyway.

Running `migrate` against it is not an option: Flyway sees a schema history table that does not
exist, decides the database is at version zero, and tries to apply `V1__Create_users_table.sql`
against a database that already has `users`. The first statement fails.

What you need is a way to say **"this database is already at version 5"** without running anything.
That is the `baseline` command, and everything else on this page follows from it.

## What the `baseline` command actually does

> *"Baselines an existing database, excluding all migrations up to and including
> `baselineVersion`."*

Mechanically it writes exactly one row: a synthetic migration of type `BASELINE`
([03 · The history table](03-the-history-table.md)), carrying `baseline-version` and
`baseline-description`. It runs no SQL against your schema, creates no tables of yours and touches
no data — the only thing it creates is the history table itself.

The defaults, from Boot's `FlywayProperties`:

| Property | Default |
|---|---|
| `spring.flyway.baseline-version` | `1` |
| `spring.flyway.baseline-description` | `<< Flyway Baseline >>` |
| `spring.flyway.baseline-on-migrate` | `false` |

⚠️ **`baseline-version` defaults to `1`, and `1` is almost never what you want.** It means "this
database already contains everything up to and including `V1`", so `V1` will never run and `V2`
onwards will. For an existing production database with forty tables, the honest number is whatever
version your first *new* migration will be, minus one.

## The three states baselining creates

From `ResolvedMigration.getState`, the baseline is compared before anything else:

```java
if (getVersion().compareTo(context.appliedBaseline) < 0) {
    return MigrationState.BELOW_BASELINE;
}
if (getVersion().compareTo(context.appliedBaseline) == 0) {
    return MigrationState.BASELINE_IGNORED;
}
```

| State | Display | Which migrations |
|---|---|---|
| `BELOW_BASELINE` | Below Baseline | version **strictly below** the baseline — will never run |
| `BASELINE_IGNORED` | Ignored (Baseline) | version **equal to** the baseline — will never run |
| `BASELINE` | Baseline | the synthetic row itself |

So the boundary is inclusive on both sides of the word "excluding": baseline at `5` and `V5` itself
does not run. That matches the command's own description — *"excluding all migrations up to **and
including** `baselineVersion`"* — and it is the detail people get wrong by one.

⚠️ Note which baseline the comparison uses: `context.appliedBaseline`, read from the `BASELINE`
**row in this database's history table**. It is a per-database fact, not a property of your
configuration or your repository. Two environments baselined at different versions verify different
amounts of the same migration set, and both report cleanly.

## When `baseline` refuses

`DbBaseline.baseline()` has four outcomes and three of them are refusals worth recognising:

**1. No history table → it baselines.** The normal path.

**2. Already baselined at the *same* version and description → it skips, idempotently.**

> *"Schema history table `<table>` already initialized with (`<version>`,`<description>`).
> Skipping."*

That is what makes `baseline` safe to leave in a deployment script.

**3. Already baselined at a *different* version or description → `FlywayException`.**

> *"Unable to baseline schema history table `<table>` with (`<v>`,`<d>`) as it has already been
> baselined with (`<v>`,`<d>`)"*

🔴 **You cannot move a baseline by running `baseline` again.** This is the single most useful fact
on the page, because "just re-baseline it" is the reflex answer to a history that has got messy and
it does not work. Flyway calls the deliberate version of this *rebaselining* and points at its own
documentation for it; doing it by hand means editing the history table, which is a decision, not a
command.

**4. The history table exists and contains real migrations → `FlywayException`.**

> *"Unable to baseline schema history table `<table>` as it already contains migrations"*

The check is `hasNonSyntheticAppliedMigrations()`, so synthetic rows — `SCHEMA`, `BASELINE`,
`DELETE` — do not count. In plain terms: **you cannot baseline a database Flyway is already
managing.** Baselining is a one-time act of adoption.

⚠️ A fifth, narrower refusal: baselining at version `0` when a `SCHEMA` marker row exists fails with
*"version 0 as this version was used for schema creation"*. Version `0` is reserved for the row
Flyway writes when it creates the schema itself.

## What baselining costs you

It is not free, and the price is the one established in
[04c · Where the comparison does not run](04c-where-the-comparison-does-not-run.md): **nothing at or
below the applied baseline is ever compared.** Not the checksum, not the description, not the type.

That is not a defect — it is what makes the mechanism work at all, since a baselined database
deliberately never ran those migrations. But it means the reproducibility promise
([01 · Why schema is code](01-why-schema-is-code.md)) applies only above the line, and the line is
invisible unless somebody queries the `BASELINE` row.

The practical consequence: **a baselined database and a database built by replaying every migration
are not verified to be the same thing.** Whether they actually are depends entirely on how careful
you were the day you baselined, which is [06b](06b-adopting-flyway-on-an-existing-database.md)'s
subject.

## Gotchas

**★ The `baseline` command and a baseline (`B` prefix) migration are different mechanisms.** The
documentation says they *"are not affiliated"*. One writes a row and runs nothing; the other is a
real SQL file that runs during `migrate`.

**★ `baseline-version` defaults to `1`.** For a real existing database that is almost always wrong,
and the failure is quiet — everything from `V2` runs against a schema that already has it.

**★ "Excluding all migrations up to and including `baselineVersion`" is inclusive.** Baseline at
`5` and `V5` never runs. Off-by-one here means one migration silently skipped or one applied twice.

**★ `baseline` runs no SQL against your schema.** It creates the history table and writes one
synthetic row. It cannot build anything.

**★ You cannot re-baseline by running `baseline` again.** A different version or description against
an existing baseline marker throws. "Just re-baseline it" is not an available answer.

**★ You cannot baseline a database Flyway already manages.** Any non-synthetic applied migration
makes the command throw.

**★ Re-running `baseline` with the *same* version and description is a documented no-op**, which is
what makes it safe in an idempotent bootstrap script.

**★ Version `0` is reserved** for the schema-creation marker, and baselining at `0` when that marker
exists is refused explicitly.

**★ The baseline that matters is the one recorded in the database, not the one in your config.**
`context.appliedBaseline` is read from the `BASELINE` row, so two environments can be baselined
differently and both look clean.

**★ Everything at or below the baseline stops being validated forever.** That is the price of the
mechanism, and nothing reports it — you have to know to look.

**★ A baselined database and a replayed one are not verified to match.** Whether they do is a
consequence of how carefully the baseline version was chosen, not of anything Flyway checks.

**★ `<< Flyway Baseline >>` is the default description and it appears in the history table.**
Changing it later is itself a reason `baseline` will refuse to run, because the description is part
of the marker's identity.

## Interview questions

**★ What is baselining and why does it exist?**
It is how Flyway is adopted on a database that already has a schema. The `baseline` command writes
a single synthetic row saying "this database is already at version N", so that migrations up to and
including N are never applied. Without it, `migrate` would try to create tables that already exist.

**★ What is the difference between the `baseline` command and a baseline migration?**
The command writes a history row and runs no SQL — it is for a database that already has the
schema. A baseline migration is a `B`-prefixed file containing real SQL that builds the schema up
to that version — it is for a database that has nothing. The documentation states explicitly that
they are not affiliated.

**★ Does `baseline` create any tables?**
Only the schema history table. It runs none of your migrations and executes no DDL of yours.

**★ Is the baseline version inclusive or exclusive?**
Inclusive. "Excluding all migrations up to and including `baselineVersion`" means a baseline at
`5` also prevents `V5` from running. The migration at exactly the baseline gets state
`Ignored (Baseline)`.

**★ What version should you baseline at?**
The version representing what the database already contains — in practice one below the first new
migration you intend to run. The default of `1` is a placeholder, and taking it means everything
from `V2` onward runs against a schema that already has it.

**★ You baselined at the wrong version. Can you fix it by running `baseline` again?**
No. `DbBaseline` throws when an existing baseline marker has a different version or description.
Correcting it means changing the history table deliberately — Flyway's own term for the supported
version of this is rebaselining — not re-running the command.

**★ What happens if you run `baseline` twice with identical settings?**
Nothing. It logs that the table is already initialised with that version and description and skips.
That idempotency is what makes it safe in an automated bootstrap.

**★ Can you baseline a database Flyway is already managing?**
No. The command checks for non-synthetic applied migrations and throws if there are any. Synthetic
rows — `SCHEMA`, `BASELINE`, `DELETE` — do not count.

**★ What does baselining cost you?**
Validation below the line. Nothing at or below the applied baseline is ever compared for checksum,
description or type, so the reproducibility guarantee applies only above it — and no output tells
you where the line is.

**★ Two environments both pass `validate`. Can they still have been verified differently?**
Yes, if they were baselined at different versions. The comparison boundary comes from each
database's own `BASELINE` row, so it is a per-database fact rather than a property of the
repository.

**★ Why is version `0` special?**
It is used for the schema-creation marker Flyway writes when it creates the schema itself, and
baselining at `0` when that marker exists is refused with a message naming exactly that reason.

**★ Someone suggests baselining production to make a checksum error go away. What is wrong with
that?**
Two things. It will not work — the command refuses on a database that already has applied
migrations — and if it somehow did, it would silence the comparison for everything below the line
rather than address why the file and the row disagree.

{/* FOOTER */}
