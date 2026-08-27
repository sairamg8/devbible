---
title: "Taking the rows out of Flyway is only safe because a later migration puts the guarantee back — the constraint added NOT VALID and validated afterwards is simultaneously the schema change, the assertion that the job finished, and the reason the deployment stops if it did not"
sidebar_label: "10c3 · What the migration keeps"
sidebar_position: 36
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against PostgreSQL 18's `ALTER TABLE`
> ([postgresql.org](https://www.postgresql.org/docs/18/sql-altertable.html)),
> PostgreSQL 18's *Explicit Locking*
> ([postgresql.org](https://www.postgresql.org/docs/18/explicit-locking.html))
> and Spring Boot 4.1's Flyway auto-configuration
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/tree/main/module/spring-boot-flyway)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**[10c2](10c2-where-the-work-goes-instead.md) moved the loop into a one-shot job and left an obvious
hole: a job is not reviewed, ordered, recorded and applied everywhere the way a migration is, so
moving work out of Flyway looks like trading a guarantee for convenience. It is not, provided you
keep three things in the migration history — the column, the constraint, and the validation of the
constraint — because the third one fails the deployment if the job did not do its work. This chunk is
the part that stays, and why the two-statement form of adding a constraint is the whole mechanism.**

## The four artefacts, in order

```sql
-- V44__Add_customer_region.sql          deploy 1 · milliseconds
ALTER TABLE customers ADD COLUMN region text;
```

Deploy 1 also ships the application change that writes `region` on every insert and update.
[10](10-data-migrations.md)'s ordering table is not negotiable and does not care where the backfill
lives: rows created after the backfill has passed them are permanently wrong otherwise.

Then the job runs — outside the deployment, for as long as it takes
([10c2](10c2-where-the-work-goes-instead.md)).

```sql
-- V47__Enforce_customer_region.sql      deploy 3 · milliseconds
ALTER TABLE customers ADD CONSTRAINT customers_region_present
    CHECK (region IS NOT NULL) NOT VALID;
```

```sql
-- V48__Validate_customer_region.sql     deploy 4, or later the same day
ALTER TABLE customers VALIDATE CONSTRAINT customers_region_present;
```

Four artefacts, three of them migrations. The one that is not a migration is the only one whose
duration is unbounded.

## Why the constraint arrives in two pieces

PostgreSQL states exactly what `NOT VALID` buys:

> *"Normally, this form will cause a scan of the table to verify that all existing rows in the table
> satisfy the new constraint. But if the `NOT VALID` option is used, this potentially-lengthy scan is
> skipped. The constraint will still be applied against subsequent inserts or updates … But the
> database will not assume that the constraint holds for all rows in the table, until it is validated
> by using the `VALIDATE CONSTRAINT` option."*

and exactly what the second half costs:

> *"The validation step does not need to lock out concurrent updates, since it knows that other
> transactions will be enforcing the constraint for rows that they insert or update; only
> pre-existing rows need to be checked. Hence, validation acquires only a `SHARE UPDATE EXCLUSIVE`
> lock on the table being altered."*

So the pair is: a catalogue-sized statement that commits immediately and starts enforcing the rule
against all new writes, followed by a row-sized statement that takes a lock ordinary readers and
writers do not queue behind. [08a](08a-adding-things-safely.md) argues this pattern in full for
constraints generally; here it is doing a second job.

🔴 **`VALIDATE CONSTRAINT` is the assertion that the backfill finished.** If the job missed rows, this
migration fails — in a deployment, loudly, naming the constraint, with the deployment refusing to
proceed. That is the entire reason the enforcement stays inside Flyway. It converts "did anybody check
that the job completed?" from a question somebody has to remember to ask into a pipeline that stops.

⚠️ **It is an assertion, not a repair.** When it fails you still have to find and fix the rows, and
the migration is now a failed one that needs the whole
[03b](03b-when-a-migration-fails.md)/[04d](04d-what-repair-actually-does.md) recovery path. That is
the correct outcome; it is not a pleasant one, which is why the job's own completion check should
have been run first.

## `CHECK (col IS NOT NULL)` or a real `NOT NULL`?

Both express the rule and they are different catalogue objects. The choice matters for one reason
PostgreSQL 18 spells out under `SET NOT NULL`:

> *"`SET NOT NULL` may only be applied to a column provided none of the records in the table contain a
> `NULL` value for the column. Ordinarily this is checked during the `ALTER TABLE` by scanning the
> entire table, unless `NOT VALID` is specified; however, if a valid `CHECK` constraint exists (and is
> not dropped in the same command) which proves no `NULL` can exist, then the table scan is skipped."*

Three usable consequences.

**You can have both, cheaply.** Add the `CHECK … NOT VALID`, validate it, and *then* `SET NOT NULL` —
the table scan for the not-null conversion is skipped, because the validated `CHECK` already proves
it. You end up with a genuine `NOT NULL` column without ever paying for a scan under
`ACCESS EXCLUSIVE`.

**Or skip the `CHECK` entirely, on 18.** PostgreSQL 18 accepts `NOT VALID` on not-null constraints
directly, so `ALTER TABLE … ALTER COLUMN region SET NOT NULL NOT VALID` followed by a
`VALIDATE CONSTRAINT` is the shorter road to the same place. [08a](08a-adding-things-safely.md) is
where that is argued; if the database you deploy to is not 18, the `CHECK` route above is the one that
works everywhere.

**Neither is checked by Hibernate.** [07b](07b-validate-not-update.md) established that
`ddl-auto: validate` is a shape check — tables, columns, types — and that nullability, check
constraints, foreign keys and defaults are outside it entirely. So do not choose between the two forms
on the basis that one of them will be caught by startup validation. Neither will.

## The completion contract

The arrangement is only safe if three things hold, and all three are review items rather than
mechanisms — which is precisely why they get skipped.

**1 · The job is idempotent, by predicate.** `WHERE region IS NULL` is not decoration; it is what makes
"run it again" a correct instruction, and it is the same property
[10b](10b-batching-a-backfill.md) depended on for a batched migration. It survives the move unchanged.

**2 · Completion is checkable from SQL, by anyone.**

```sql
SELECT count(*) FROM customers WHERE region IS NULL;
```

That count is the entire interface between the job and the person reviewing the enforcement
migration. If completion can only be established from the job's private state — a Batch metadata
table, a log line, somebody's memory — then the reviewer of `V47` has no way to check it and will
approve on trust.

**3 · A migration enforces the result.** The `NOT VALID` constraint plus `VALIDATE CONSTRAINT`. Without
this step the split genuinely has lost a guarantee, and the standard objection to moving work out of
Flyway is correct rather than merely conservative.

The three together restore the property the migration had — *the deployment refuses to proceed on
incomplete data* — without the properties it did not have.

## Gotchas

**★ The failure mode of this entire approach is that deploy three never ships.** Team adds the column,
runs the backfill, closes the ticket, moves on. Nothing then checks the job, and the schema quietly
permits the state the whole exercise was meant to eliminate. The enforcement migration is not
tidying-up; it is the only part that verifies anything.

**★ `ADD CONSTRAINT` without `NOT VALID` puts the long lock straight back.** The verification scan is
row-sized and holds `ACCESS EXCLUSIVE` for its duration. You moved the backfill out precisely to avoid
that, and then reintroduced it in the migration that was supposed to be the cheap one.

**★ `VALIDATE CONSTRAINT` is not free — it is a full scan.** It is *safe* because of the lock it takes,
not because it is quick. On a very large table it is still a migration whose duration is proportional
to the data, so it belongs in its own deploy and it still has to be checked against
[08b4](08b4-how-long-is-too-long.md)'s clocks.

**★ A failed `VALIDATE CONSTRAINT` leaves you with a failed migration, not just bad data.** You now
need the [03b](03b-when-a-migration-fails.md) recovery path as well as the missing rows. Run the
completion count *before* merging the enforcement migration, so the assertion is a formality rather
than a discovery.

**★ `CHECK (col IS NOT NULL)` and a `NOT NULL` column are different catalogue objects.** They enforce
the same rule, appear differently in `information_schema`, and are reported differently by every tool
that inspects the schema. Pick one deliberately and say which one the mapping expects.

**★ Neither form is verified by `ddl-auto: validate`.** Hibernate's check covers tables, columns and
types; nullability and check constraints are outside it ([07b](07b-validate-not-update.md)). Startup
validation will not tell you the constraint is missing.

**★ Adding the `CHECK` and dropping it in the same command defeats the scan-skipping rule.** The
documentation's condition is that a *valid* `CHECK` constraint exists **and is not dropped in the same
command**. Tidying it away in the same `ALTER TABLE` that sets `NOT NULL` puts the full scan back.

**★ The `NOT VALID` constraint is enforced against new writes from the moment it commits.** That is
usually what you want, and it means the application had better already be writing the column — if a
code path still inserts `NULL`, deploy three breaks it, immediately, in production.

**★ Deploy one still has to ship the dual write.** Moving the backfill out of Flyway does not touch
[08](08-migrating-a-live-service.md)'s ordering rule, and it widens the window in which getting that
wrong is possible, because the migration and the job are no longer in the same pipeline and no longer
fail together.

**★ A completion check that only the job can answer is not a check.** "The Batch job reported
`COMPLETED`" is evidence about the job. The count of rows still matching the backfill predicate is
evidence about the database, and only the second one is what the constraint is going to assert.

## Interview questions

**★ You have moved the backfill out of Flyway. What stays in the migration?**
The catalogue and the proof. A migration adds the column, a migration adds any index the job needs, a
migration adds the constraint asserting the backfill completed — as `NOT VALID` first, then
`VALIDATE CONSTRAINT`. Only the row-touching loop moves out. The schema never drifts, and the
deployment still refuses to proceed if the data is not what the job claimed it was.

**★ Why `NOT VALID` and then `VALIDATE CONSTRAINT` rather than one statement?**
Because `ADD CONSTRAINT` normally scans the whole table to prove existing rows satisfy it, holding
`ACCESS EXCLUSIVE` throughout. With `NOT VALID` that scan is skipped and the command commits
immediately, while the constraint is still enforced against every subsequent insert and update. The
scan then happens in `VALIDATE CONSTRAINT`, which PostgreSQL documents as acquiring only a
`SHARE UPDATE EXCLUSIVE` lock, because concurrent transactions are already enforcing the rule and only
pre-existing rows need checking.

**★ How does a reviewer verify that a job outside Flyway actually ran?**
By running the predicate. The job has to be idempotent on a condition expressible in SQL —
`WHERE region IS NULL` — so anybody can count the rows still outstanding, and the reviewer of the
enforcement migration checks that the count is zero before merging. If completion can only be
determined from the job's own state, that check is not available to the person who needs it, and the
enforcement migration becomes a bet rather than a formality.

**★ What happens when `VALIDATE CONSTRAINT` fails?**
Exactly what it should: the deployment stops, naming the constraint. It is an assertion, not a repair,
so you still have to find the rows the job missed and fix them — and you now have a failed migration
to recover from as well, which means the whole `success = false` path and possibly a `repair`. That is
the correct outcome and an unpleasant one, which is why the row count is checked before the migration
is merged.

**★ `CHECK (col IS NOT NULL)` or `ALTER COLUMN … SET NOT NULL`?**
Either enforces the rule; they are different catalogue objects. The useful trick is that PostgreSQL
skips the not-null table scan if a valid `CHECK` constraint already proves no `NULL` can exist and is
not dropped in the same command — so `CHECK … NOT VALID`, then validate, then `SET NOT NULL` gets you
a genuine not-null column having never taken a long `ACCESS EXCLUSIVE` scan. On PostgreSQL 18 you can
also put `NOT VALID` directly on the not-null constraint and skip the `CHECK` entirely.

**★ Will `ddl-auto: validate` catch it if the constraint is missing?**
No. Hibernate's schema validation is a shape check over tables, columns and types; nullability,
check constraints, foreign keys and defaults are outside it. So the enforcement migration is not
backed up by startup validation — it is the only thing checking the rule, which is another reason it
cannot be the step that gets dropped.

**★ Summarise the whole argument in three sentences.**
A migration is a good mechanism for a bounded change to the catalogue and a bad one for an unbounded
change to the rows, so the rows move to a job that can be watched, throttled and restarted. The
catalogue stays in Flyway, because that is what a migration history is for. And a constraint added
`NOT VALID` and validated afterwards puts the guarantee back, because a deployment that will not
proceed on incomplete data is exactly what you gave up when the loop left the migration.

{/* FOOTER */}
