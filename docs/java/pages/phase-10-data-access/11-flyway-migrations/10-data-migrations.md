---
title: "A data migration is a different animal from a schema migration because its cost scales with rows rather than with the catalogue, PostgreSQL's MVCC makes one big UPDATE write a second copy of the table, and the rows keep arriving while you work"
sidebar_label: "10 · Data migrations"
sidebar_position: 31
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against PostgreSQL 18's *Routine Vacuuming*
> ([postgresql.org](https://www.postgresql.org/docs/18/routine-vacuuming.html)),
> *Heap-Only Tuples (HOT)*
> ([postgresql.org](https://www.postgresql.org/docs/18/storage-hot.html)),
> *Client Connection Defaults*
> ([postgresql.org](https://www.postgresql.org/docs/18/runtime-config-client.html)),
> Flyway 12's `batch` and *Script Configuration* reference
> ([github.com/flyway/flyway](https://github.com/flyway/flyway/tree/main/documentation/Reference))
> and Flyway's *Migration Transaction Handling*
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/migration-transaction-handling-273973399.html)).
> JDK 25, Spring Boot 4.1.1, Flyway 12.4.0, PostgreSQL 18.

**Everything in this topic so far has been about the catalogue: columns, constraints, indexes, types.
Sooner or later a migration's job is *rows* — backfill a new column, normalise a value, split a name
into two, correct data that a bug produced. It looks like the same thing, it lives in the same
directory and it gets the same `V` prefix, but almost every property you have been relying on stops
holding. This chunk is why. [10b](10b-batching-a-backfill.md) is how to run one anyway, and
[10c](10c-when-it-should-not-be-a-migration.md) is the argument that it often should not be a
migration at all.**

## Four properties that stop holding

**1 · The cost scales with data, so staging tells you nothing.** `ALTER TABLE … ADD COLUMN` takes the
same time on ten rows and ten billion. `UPDATE customers SET region = …` does not. Your staging
database has a thousand rows and your production database has ninety million, and the migration that
took forty milliseconds in CI is the one in
[08b4 · How long is too long](08b4-how-long-is-too-long.md) that gets the pod killed at minute ten.

**2 · It is not atomic in any useful sense.** Flyway wraps each migration in a transaction and on
PostgreSQL that is a real guarantee — *"failed migrations will always be rolled back (unless they
were marked as non-transactional)"*. For a schema change that is exactly what you want. For a
sixty-million-row `UPDATE` it means one transaction holding sixty million row locks, and a failure
at 99% throwing away everything. You will end up wanting to commit partway, and the moment you want
that you have left the model this topic has been describing.

**3 · The data is moving while you work.** New rows arrive during the backfill, and rows you already
processed get modified again. A schema migration operates on a catalogue nobody else is touching; a
data migration operates on a table the application is actively writing.

**4 · It usually cannot be undone.** `DROP COLUMN` undoes `ADD COLUMN`. Nothing undoes
`UPDATE customers SET name = trim(name)`, because the information required to reverse it was in the
rows you overwrote. Flyway's undo migrations are Teams-only and its own documentation is candid
about the limit: *"They work for undoing schema changes but not so well for undoing data changes."*

## What one big `UPDATE` actually does to PostgreSQL

The mechanism is MVCC, stated in the vacuuming chapter:

> *"In PostgreSQL, an `UPDATE` or `DELETE` of a row does not immediately remove the old version of
> the row. This approach is necessary to gain the benefits of multiversion concurrency control … the
> row version must not be deleted while it is still potentially visible to other transactions."*

So `UPDATE customers SET region = 'unknown' WHERE region IS NULL` over ninety million rows writes
ninety million *new* row versions and leaves ninety million dead ones behind. The table roughly
doubles in size, on disk, during the migration.

And it does not shrink afterwards:

> *"The standard form of `VACUUM` removes dead row versions in tables and indexes and marks the space
> available for future reuse. However, it will not return the space to the operating system, except
> in the special case where one or more pages at the end of a table become entirely free and an
> exclusive table lock can be easily obtained."*

Getting the space back needs `VACUUM FULL`, `CLUSTER`, or a rewriting `ALTER TABLE` — and the
documentation notes that *"All these options require an `ACCESS EXCLUSIVE` lock"*, which puts you
straight back into [08b](08b-locks-and-long-migrations.md). The realistic outcome is that you accept
the bloat and let autovacuum reuse the space over time.

⚠️ **Autovacuum cannot even start while your transaction is open.** An open transaction *"prevents
vacuuming away recently-dead tuples that may be visible only to this transaction"*. A single
transaction that spends an hour producing dead tuples is an hour in which none of them can be
reclaimed — so the peak bloat is the whole backfill, not a rolling window.

## The index amplification, and how to avoid it

Whether each updated row also rewrites every index entry depends on HOT:

> *"To help reduce the overhead of updates, PostgreSQL has an optimization called heap-only tuples
> (HOT). This optimization is possible when: The update does not modify any columns referenced by the
> table's indexes, not including summarizing indexes … There is sufficient free space on the page
> containing the old row for the updated row."*

Two consequences that decide the shape of a backfill.

🔴 **Create the index after the backfill, not before.** If you index the new column first, every one
of the ninety million updates is non-HOT and writes an index entry as well as a heap tuple. If you
backfill first and index afterwards, the updates have a chance of being HOT and the index is built
once, in one pass, by `CREATE INDEX CONCURRENTLY`
([08a2](08a2-adding-indexes-and-enum-values.md)).

⚠️ **HOT also needs free space on the page**, which a table that has never been updated does not
have. `fillfactor` is the lever, and lowering it is itself a table rewrite, so it is a decision for
table creation rather than for the migration that needs it.

## The race with the running application

A backfill and a rolling deployment are the same problem seen twice, and
[08 · Migrating a live service](08-migrating-a-live-service.md) already gave the rule. Applied to
data, the ordering is not negotiable:

| Step | What runs | Why this order |
|---|---|---|
| Deploy 1 | Add the nullable column. Application writes **both** old and new. | Otherwise rows created during the backfill have a null new column and the backfill has already passed them. |
| Migration | Backfill the rows the application did not write, `WHERE region IS NULL`. | Only touches the historical rows; new rows are already correct. |
| Deploy 2 | Application reads the new column, still writes both. | The data is now complete for every row. |
| Deploy 3 | Stop writing the old column; drop it in a later migration. | Contract. |

🔴 **Reversing the first two steps is the classic bug.** Backfill first, deploy the dual-write
second, and every row created in between is permanently wrong — and nothing detects it, because the
migration succeeded and the constraint you were about to add is not there yet.

The `WHERE region IS NULL` predicate is doing double duty here: it excludes rows the application
already handled, and it makes the migration **resumable**, which [10b](10b-batching-a-backfill.md)
depends on entirely.

## Reference data is a data migration too

Seeding `countries`, `permissions`, `feature_flags` or a lookup table from a `V` migration is the
benign end of the same category, and it inherits one rule from the rest of the topic: **an applied
migration is immutable** ([04 · Checksums and immutability](04-checksums-and-immutability.md)).
Editing `V7__Seed_countries.sql` to add a country breaks the checksum on every database that already
ran it.

The two correct answers are a new versioned migration, or a repeatable migration written to be
re-runnable — which is exactly what [05b](05b-what-belongs-in-a-repeatable-migration.md) argues, and
[05c](05c-what-does-not-belong.md) draws the line for.

For genuinely large reference-data files Flyway has a switch worth knowing:

> *"Whether to batch SQL statements when executing them. Batching can save up to 99 percent of
> network round-trips by sending up to 100 statements at once over the network to the database,
> instead of sending each statement individually."* … *"This is supported for `INSERT`, `UPDATE`,
> `DELETE`, `MERGE`, and `UPSERT` statements. All other statements are automatically executed without
> batching."*

`spring.flyway.batch: true`, default `false`, and untagged in Flyway's reference — Community. It
addresses round-trips, not the MVCC cost, so it helps a file of a hundred thousand `INSERT`
statements and does nothing for one big `UPDATE`.

## Gotchas

**★ A data migration's runtime is a function of production's row count, and CI does not have it.**
Every timing you have measured is meaningless. Estimate from `pg_class.reltuples` or a `count(*)` on
production before you decide the shape.

**★ One `UPDATE` over the whole table writes a second copy of the table.** MVCC does not update in
place. Ninety million rows updated is ninety million dead tuples, and the file on disk roughly
doubles.

**★ The dead tuples do not come back as free disk space.** Plain `VACUUM` marks the space reusable
but does not return it to the operating system. Reclaiming it needs `VACUUM FULL` or `CLUSTER`, both
of which take `ACCESS EXCLUSIVE`.

**★ Your open transaction blocks the vacuum that would have cleaned up behind you.** Recently-dead
tuples visible to your transaction cannot be reclaimed while it is open, so the bloat peaks at the
full size of the backfill rather than at whatever autovacuum could keep up with.

**★ Indexing the new column before backfilling it multiplies the write cost.** An update that
modifies an indexed column cannot be HOT, so every row rewrites index entries as well as the tuple.
Backfill, then `CREATE INDEX CONCURRENTLY`.

**★ HOT is not guaranteed even for an unindexed column** — it also requires free space on the page.
On a table that has never been updated there may be none, and `fillfactor` cannot be changed without
a rewrite.

**★ A single `UPDATE` holds a row lock on every row it touches until it commits.** The application's
own updates to those rows block. A sixty-million-row update is a sixty-million-row lock set, and
`max_locks_per_transaction` does not save you because row locks are stored on disk rather than in
the lock table — which is also why they will not show up in `pg_locks`
([08b2](08b2-seeing-it-and-bounding-it.md)).

**★ Backfilling before the application writes the new column silently corrupts the overlap.** Rows
created between the backfill and the dual-write deploy are missed, permanently, with no error. The
order in the table above is the whole safety property.

**★ `WHERE region IS NULL` is not a nicety, it is the resumability contract.** A backfill without a
predicate that excludes already-done rows cannot be restarted, and a data migration that cannot be
restarted will eventually need to be.

**★ Editing a seed-data migration to add a row breaks the checksum everywhere it has already run.**
Reference data is data, but the migration file is still immutable. New migration, or a repeatable
one.

**★ `spring.flyway.batch` helps round-trips, not row cost.** It is for files with a hundred thousand
`INSERT` statements. It does nothing for one statement that touches a hundred million rows.

**★ There is no undo.** Flyway's undo migrations are Teams-only, and Flyway's own documentation says
they *"work for undoing schema changes but not so well for undoing data changes"*. If you need to be
able to reverse it, the migration has to write the old value somewhere before overwriting it.

**★ A `DELETE`-based cleanup has all the same properties plus one.** Deleted tuples are also dead
tuples, so a large `DELETE` bloats the table just as an `UPDATE` does — and unlike `TRUNCATE` it
leaves the space to be reclaimed by vacuum. The documentation recommends `TRUNCATE` when the whole
table goes, with the caveat that *"strict MVCC semantics are violated"*.

## Interview questions

**★ What makes a data migration different from a schema migration?**
Four things. Its runtime scales with row count, so nothing you measured in CI transfers. It is not
usefully atomic, because a single transaction over tens of millions of rows holds that many row
locks and throws away all its work on failure. The data is being modified concurrently by the
application while it runs. And it generally cannot be undone, because the information needed to
reverse it was in the rows it overwrote.

**★ Why does one large `UPDATE` roughly double the size of a table?**
Because of MVCC. PostgreSQL does not modify a row in place; an `UPDATE` writes a new row version and
leaves the old one, which must stay visible to any transaction that could still see it. Updating
every row therefore produces a full second set of tuples, and they are only reclaimed later by
vacuum — which cannot run against them while the updating transaction is still open.

**★ Does the space come back after vacuum?**
Not to the operating system, in the normal case. Plain `VACUUM` marks dead row space reusable within
the table. Returning it requires `VACUUM FULL` or `CLUSTER`, both of which rewrite the table under
an `ACCESS EXCLUSIVE` lock — so on a live service you usually accept the bloat and let the space be
reused by future rows.

**★ Should you add the index before or after the backfill, and why?**
After. An update that modifies an indexed column cannot use the heap-only-tuple optimisation, so
every updated row writes new index entries as well as a new heap tuple. Backfilling first keeps the
updates eligible for HOT, and the index is then built once by `CREATE INDEX CONCURRENTLY`.

**★ In what order do the deployment and the backfill have to happen?**
The application must be writing the new column *before* the backfill runs. Deploy the dual-write
first, then backfill only the rows that are still null, then switch reads over, then stop writing
the old column. Backfilling first leaves every row created during the gap permanently wrong, and
nothing reports it.

**★ Why is `WHERE region IS NULL` more important than it looks?**
It makes the backfill idempotent and resumable. Rows already handled — by a previous run, or by the
application itself — are skipped, so a killed migration can be restarted and a partially applied one
can be finished. Without such a predicate the migration is all-or-nothing, which for something that
runs for an hour is not a viable design.

**★ Seed data needs a new country added. What do you do?**
Not edit the migration that seeded it — that changes the checksum on every database that already ran
it. Either add a new versioned migration that inserts the row, or move the seed into a repeatable
migration written to be safely re-applied, which is what repeatable migrations exist for.

**★ When is `spring.flyway.batch` the right answer?**
When the migration is a very large file of individual `INSERT`, `UPDATE`, `DELETE`, `MERGE` or
`UPSERT` statements and the bottleneck is network round-trips — reference data dumps, typically. It
batches up to a hundred statements per round-trip. It does nothing for a single statement that
touches a huge number of rows, because that was never a round-trip problem.

**★ How would you make a data migration reversible?**
By not throwing the old value away. Add the new column rather than overwriting the old one, and drop
the old one in a much later contract migration once you are confident. For a genuine in-place
correction, write the previous values to an audit table in the same transaction. Flyway will not do
this for you — undo migrations are Teams-only and its own documentation warns they do not suit data
changes.

{/* FOOTER */}
