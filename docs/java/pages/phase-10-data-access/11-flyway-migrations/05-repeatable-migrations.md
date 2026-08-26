---
title: "A repeatable migration has no version, is re-applied whenever its checksum changes, always runs last, and is ordered alphabetically by description — four mechanics that between them explain every surprise people have with them"
sidebar_label: "05 · Repeatable migrations"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the *Repeatable migrations* concept page
> ([documentation.red-gate.com](https://documentation.red-gate.com/flyway/flyway-concepts/migrations/repeatable-migrations)),
> the *Migrations* reference
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/migrations-271585107.html)),
> Flyway 12's `SqlMigrationResolver` and `MigrationInfoImpl.validate()`
> ([github.com/flyway/flyway](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/internal/resolver/sql/SqlMigrationResolver.java)),
> and Spring Boot 4.1's `FlywayProperties`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/main/module/spring-boot-flyway/src/main/java/org/springframework/boot/flyway/autoconfigure/FlywayProperties.java)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**Everything so far has been about the versioned migration: it runs once, in order, and never
again. A repeatable migration inverts every one of those properties. It has no version, it runs
after everything else, its order among its peers is alphabetical rather than numeric, and it runs
again every time you change it. That is not a variant of the versioned migration — it is a
different tool for a different class of object, and using it for the wrong class is the source of
almost every problem people have with it.**

## The naming, and the one thing missing from it

```
R__Create_order_summary_view.sql
│ │  └─ description
│ └──── the separator, unchanged
└────── the repeatable prefix (`repeatableSqlMigrationPrefix`, default `R`)
```

Set against a versioned migration — `V12__Add_orders_table.sql` — exactly one component is
absent: **there is no version**. Nothing else about the grammar changes, and that single absence
drives everything below.

The consequence in the history table is immediate. `version` is `NULL` for every repeatable row
([03 · The history table](03-the-history-table.md)), so a repeatable migration is identified by
its **description**. That is why renaming one behaves so differently from renaming a versioned
migration: `V12` renamed is still `V12`, but `R__Create_order_summary_view` renamed is a different
migration entirely, and the old one becomes `Missing`.

## Four mechanics, and every surprise comes from one of them

### 1. It is re-applied when its checksum changes

The concept page's own sentence: repeatable migrations are

> *"(re-)applied to a database on migrate every time their checksum changes."*

Not on every run — on every run where the file is different from what was recorded. An unchanged
repeatable migration is a no-op, so leaving fifty of them in the project costs nothing but the
resolve.

The state vocabulary from [03c](03c-reading-the-history.md) exists for exactly this: `OUTDATED`
means the file has changed since it last ran and `migrate` will re-apply it; `SUPERSEDED` marks an
earlier run that a newer one has replaced. **Both states are exclusive to repeatable migrations** —
seeing either against a `V` file means you are reading the wrong row.

⚠️ **The checksum is taken *after* placeholder substitution**, which is the asymmetry established
in [04b](04b-the-edits-nothing-catches.md). A repeatable migration whose text contains `${schema}`
is re-applied when the schema value changes, and that is the point: a view defined over a
configurable schema has to be rebuilt when the schema moves. Versioned migrations behave the
opposite way.

### 2. It always runs last

> *"within a single migration run, repeatable migrations are always applied last, after all
> pending versioned migrations have been executed."*

This is a guarantee and it is the reason repeatable migrations work at all for views. A view over
`orders` can be defined in a repeatable migration in the same deployment that adds a column to
`orders`, because the `ALTER TABLE` is a versioned migration and runs first.

⚠️ It is *within a single run*. Across two runs there is no such relationship — the repeatable
migration from deployment 1 ran before the versioned migration in deployment 2.

### 3. Among themselves, they are ordered alphabetically by description

> *"applied in the order of their description (i.e. alphabetically)."*

Alphabetically, on the description text — not the file's position on disk, not creation time, not
anything you can configure. `R__Alpha_view` runs before `R__Beta_view` because `A` precedes `B`,
and for no other reason.

That is fine until one object depends on another. A view built on top of another view has an
ordering requirement that the alphabet knows nothing about, and the standard answer is to encode
it in the description:

```
R__010_base_customer_activity.sql
R__020_customer_activity_summary.sql
R__030_customer_activity_report.sql
```

Numeric prefixes inside the description, padded so the string sort matches the numeric one.
`R__10_…` sorts before `R__9_…` for the same reason `'10'` sorts before `'9'` in
[03c](03c-reading-the-history.md) — it is a text comparison throughout.

### 4. Idempotency is entirely your problem

The documentation is direct about where the responsibility sits:

> *"It is your responsibility to ensure the same repeatable migration can be applied multiple
> times. This usually involves making use of `CREATE OR REPLACE`."*

Flyway does not check, cannot check, and will not warn. It runs the file. If the file is
`CREATE VIEW`, the second run fails with `relation already exists`; if it is
`INSERT INTO countries`, the second run doubles your reference data.

This is the whole design contract of the feature and it is worth being blunt about: **a repeatable
migration is a file you are promising can run any number of times with the same end state.** Every
guideline in [05b](05b-what-belongs-in-a-repeatable-migration.md) is a consequence of that promise.

## What it looks like in practice

```sql
-- R__010_order_summary_view.sql
CREATE OR REPLACE VIEW order_summary AS
SELECT o.customer_id,
       count(*)        AS order_count,
       sum(o.total)    AS lifetime_value,
       max(o.placed_at) AS last_order_at
  FROM orders o
 WHERE o.status <> 'cancelled'
 GROUP BY o.customer_id;
```

Change the `WHERE` clause, and the next `migrate` re-applies it — one row appended to the history
with a new `installed_rank` and the old row moved to `SUPERSEDED`. The view definition in the
repository is now the single readable description of what the view is, which is the real benefit:
a `CREATE VIEW` buried in `V38` from two years ago is not.

## When a repeatable migration fails

It gets its own error code and its own message, quoted from `MigrationInfoImpl.validate()`:

> *"Detected failed repeatable migration: `<description>`.
> Please remove any half-completed changes then run repair to fix the schema history."*

The remedy is [04d](04d-what-repair-actually-does.md)'s action 1 — but note the same PostgreSQL
caveat: a repeatable migration that fails inside a transaction is rolled back and writes no row at
all, so a `success = false` repeatable row means it was running non-transactionally.

## Configuration worth knowing

| Setting | Default | Note |
|---|---|---|
| `repeatableSqlMigrationPrefix` | `R` | changing it is almost always a mistake |
| `spring.flyway.ignore-migration-patterns` | `["*:future"]` | the `repeatable:` type selector targets these specifically |
| `outOfOrder` | `false` | irrelevant here — repeatable migrations have no order to be out of |
| `target` | `latest` | ⚠️ see below — the interaction is not what most people assume |

The `target` row needs care, and one half of it is settled while the other is not.

**Settled, from `ResolvedMigration.getState`:** the `ABOVE_TARGET` branch is guarded by
`getVersion() != null`, so **a repeatable migration is never `ABOVE_TARGET`.** It has no version to
compare against the target, and it falls straight through to `PENDING`.

**Not settled:** whether a numeric `target` that leaves versioned migrations unrun also prevents a
changed repeatable from being applied in that run. The documentation says only that repeatables run
*"after all pending versioned migrations have been executed"*, which does not say what happens when
some are deliberately not going to be executed, and reading the resolver and `DbMigrate` did not
settle it either. **I could not confirm this from documentation or source**, so treat a numeric
`target` combined with changed repeatable migrations as a case to verify against your own Flyway
version before relying on it.

## Gotchas

**★ A repeatable migration is identified by its description, because its `version` is `NULL`.**
Renaming the file creates a new migration and leaves the old one `Missing` — which is not how
renaming a versioned migration behaves.

**★ Editing one is the *mechanism*, not a violation.** Everything
[04](04-checksums-and-immutability.md) says about not touching applied migrations is about
versioned ones. Changing a repeatable migration is how you are meant to use it.

**★ They run last, but only within one run.** Across deployments there is no ordering relationship
between a repeatable migration and a later versioned one.

**★ Ordering among repeatables is alphabetical on the description**, and there is no way to
configure it. Encode dependencies as zero-padded numeric prefixes in the description.

**★ `R__10_…` sorts before `R__9_…`.** It is a string comparison. Pad the numbers.

**★ Idempotency is not checked and never warned about.** A `CREATE VIEW` without `OR REPLACE`
fails on the second run; an `INSERT` without a conflict clause duplicates data silently.

**★ The checksum is computed after placeholder substitution** — the opposite of a versioned
migration. Changing a placeholder value re-applies the repeatable migration.

**★ A repeatable migration is never `ABOVE_TARGET`.** The state requires a version and it has
none. What a numeric `target` does to a *changed* repeatable in the same run is not documented and
is worth checking rather than assuming.

**★ `OUTDATED` and `SUPERSEDED` only ever apply to repeatable migrations.** If you see either
against a `V` migration, you are reading the wrong row.

**★ An unchanged repeatable migration costs nothing on a run.** There is no reason to prune them
for performance; prune them because they no longer describe anything.

**★ A repeatable migration that fails gets a distinct error code and message**, and on PostgreSQL a
`success = false` repeatable row means it was running outside a transaction.

**★ `repair` can tombstone a repeatable migration by description**, and the `repeatable:missing`
ignore pattern exists specifically for the case where one was deleted on purpose.

## Interview questions

**★ What is a repeatable migration and how does it differ from a versioned one?**
A migration with an `R` prefix and no version. It is re-applied whenever its checksum changes
rather than exactly once, it runs after every pending versioned migration in the same run, and it
is ordered alphabetically by description rather than numerically by version.

**★ When does a repeatable migration actually run?**
On the first `migrate` after it appears, and on every `migrate` where its checksum differs from
what was last recorded. If nothing changed it is a no-op.

**★ Is it not a contradiction to say you must never edit an applied migration and then edit a
repeatable one?**
No — the rule is about versioned migrations, whose whole promise is that replaying them reproduces
the schema. A repeatable migration describes a *current desired state* rather than a step, so its
history is the sequence of definitions it has had, and editing it is the intended interface.

**★ Two views, one built on the other. How do you make them apply in the right order?**
Encode the order in the description with zero-padded numeric prefixes —
`R__010_base_view.sql`, `R__020_derived_view.sql`. The ordering is alphabetical on the description
and there is no setting that changes that.

**★ Why does `R__10_…` run before `R__9_…`?**
Because it is a string comparison, character by character, and `'1'` precedes `'9'`. The same trap
as sorting the `version` column as text.

**★ Whose job is it to make a repeatable migration idempotent?**
Yours, entirely. The documentation says so explicitly and suggests `CREATE OR REPLACE`. Flyway does
not inspect the SQL and will happily run a plain `CREATE VIEW` a second time.

**★ You renamed a repeatable migration's file. What happens?**
Flyway sees a new migration that has never been applied, plus an applied row whose description no
longer resolves to a file — state `Missing`. The new one runs and `validate` complains about the
old one until you `repair` or restore the name.

**★ Can a repeatable migration be `Above Target`?**
No. The `ABOVE_TARGET` state is only reachable for a migration with a version, and a repeatable has
none — it falls through to `PENDING`. What a numeric `target` does to a changed repeatable in the
same run is genuinely not documented, and is the sort of thing to establish on your own version
rather than reason about.

**★ Which migration states are exclusive to repeatable migrations?**
`OUTDATED` — the file changed since it last ran — and `SUPERSEDED`, an earlier run replaced by a
later one. Neither can appear for a versioned migration.

**★ A repeatable migration references `${schema}`. What happens when that value changes?**
It is re-applied, because a repeatable migration's checksum is computed on the substituted text.
This is deliberate and is the opposite of a versioned migration, whose checksum is taken on the raw
file.

**★ How many repeatable migrations is too many?**
There is no runtime cost to one that has not changed, so the limit is comprehension rather than
performance. The number that matters is how many *have* changed in a deployment, because those all
run.

{/* FOOTER */}
