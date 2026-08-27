---
title: "The batching loop that works on batch one is a full table scan by batch nine thousand, because the predicate that finds unprocessed rows has to skip everything already processed — so a backfill's real design decisions are the index, the window and the throttle"
sidebar_label: "10b2 · Keeping each batch cheap"
sidebar_position: 33
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against PostgreSQL 18's `CREATE INDEX`
> ([postgresql.org](https://www.postgresql.org/docs/18/sql-createindex.html)),
> *Partial Indexes* ([postgresql.org](https://www.postgresql.org/docs/18/indexes-partial.html)),
> `SELECT` ([postgresql.org](https://www.postgresql.org/docs/18/sql-select.html)),
> *Routine Vacuuming*
> ([postgresql.org](https://www.postgresql.org/docs/18/routine-vacuuming.html))
> and *Hot Standby*
> ([postgresql.org](https://www.postgresql.org/docs/18/hot-standby.html)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**[10b](10b-batching-a-backfill.md) got the loop to commit. That makes the backfill survivable, and
it does nothing at all for its cost. The loop as written re-derives "what is left to do" from the
data on every iteration, which is exactly what makes it resumable and exactly what makes it
quadratic — each batch has to step over every row a previous batch already fixed. This chunk is the
three decisions that turn it back into a linear job: how the predicate is indexed, how the window is
chosen, and how hard you let it push.**

## The degradation, and why it is invisible at first

```sql
UPDATE customers SET region = 'unknown'
WHERE  id IN (SELECT id FROM customers
              WHERE region IS NULL ORDER BY id LIMIT 5000 FOR UPDATE);
```

Batch one reads the first five thousand rows and finds five thousand nulls. Batch nine thousand has
to read past forty-five million already-updated rows before it finds the next null. The work per
batch grows linearly with progress, so the total work grows with the square of the table.

The reason nobody catches this in review is that the first hundred batches are fast, and the reason
nobody catches it in staging is that staging has a thousand rows and reaches the end before the
degradation starts.

## Option one: a partial index for the duration

PostgreSQL's partial indexes are made for this. The documentation's framing is the general case:

> *"A partial index is an index built over a subset of a table; the subset is defined by a conditional
> expression (called the predicate of the partial index). The index contains entries only for those
> table rows that satisfy the predicate."*

So index exactly the rows the backfill still has to find:

```sql
-- V43__Index_for_region_backfill.sql        (its own migration)
-- V43__Index_for_region_backfill.sql.conf   -> executeInTransaction=false
CREATE INDEX CONCURRENTLY customers_region_backfill_idx
    ON customers (id) WHERE region IS NULL;
```

Every batch now finds its five thousand ids by an index scan of an index that only contains
unprocessed rows — and that index *shrinks* as the backfill runs, because updating a row to a
non-null `region` removes it from the index. The last batch is as cheap as the first.

Drop it when the backfill is done:

```sql
-- V45__Drop_region_backfill_index.sql       (.conf -> executeInTransaction=false)
DROP INDEX CONCURRENTLY customers_region_backfill_idx;
```

⚠️ Both statements need their own non-transactional migration: Flyway's PostgreSQL parser treats
`^(CREATE|DROP)( UNIQUE)? INDEX CONCURRENTLY` as unable to run in a transaction
([08a2](08a2-adding-indexes-and-enum-values.md)).

⚠️ **The index is not free while it exists.** Every insert and every update of `region` maintains
it, for as long as the backfill takes. On a write-heavy table that is a real cost, deliberately
accepted for a bounded period — which is why dropping it afterwards is a step, not an afterthought.

## Option two: a key range, which needs no new index

```sql
DECLARE
    lo bigint := 0;
    hi bigint;
BEGIN
    SELECT max(id) INTO hi FROM customers;
    WHILE lo <= hi LOOP
        UPDATE customers
        SET    region = 'unknown'
        WHERE  id > lo AND id <= lo + 5000
          AND  region IS NULL;
        lo := lo + 5000;
        COMMIT;
    END LOOP;
END
```

Each batch is a bounded primary-key range, so the cost per batch is constant and no extra index is
needed. The trade is that the work is proportional to the **key range** rather than to the number of
rows that need updating: on a dense sequence that is the same thing, and on a table with large gaps —
years of deleted rows, an id space shared with another tenant — you spend batches finding nothing.

🔴 **The key-range loop is only resumable if you can find `lo` again.** Restarting from `0` is
correct but wastes everything already done. Either keep `AND region IS NULL` in the predicate so the
re-run is cheap and idempotent (as above), or persist the cursor in a small table that the loop
updates and commits alongside each batch.

⚠️ **`max(id)` is read once, at the start.** Rows inserted during the backfill fall above `hi` and
are never visited — which is correct only because the application is already writing the new column
by the time the backfill runs ([10](10-data-migrations.md)'s ordering table). If it is not, this
loop is where that mistake becomes permanent.

## Choosing the batch size

The batch is a miniature of the original problem, so size it by what one batch costs, not by how
many there will be:

| Too small | Too large |
|---|---|
| Commit overhead per batch dominates | Row locks held long enough to block the application |
| Index lookup per batch dominates | A large dead-tuple burst between vacuums |
| The `pg_sleep` throttle dwarfs the work | One long statement, exposed to `statement_timeout` |

Row **width** matters more than row count: five thousand narrow rows and five thousand rows with a
`jsonb` column are different amounts of WAL by an order of magnitude. Low thousands is a reasonable
place to start measuring from, and the measurement that matters is what happens to application
latency while it runs, not how long the backfill takes.

## The throttle, and what it is protecting

`PERFORM pg_sleep(0.05)` between batches is not politeness. Three things need the gap.

**Autovacuum.** Each batch leaves dead tuples ([10](10-data-migrations.md)); autovacuum reclaims
them, but only if it gets scheduled and only if no transaction of yours is holding them visible. A
backfill running flat out produces dead tuples faster than they can be reclaimed, and the table
bloats anyway despite the batching.

**Replicas.** Every updated row is WAL, and a physical standby must replay all of it. The
documentation is explicit that replay and standby queries contend:

> *"When the `hot_standby` parameter is set to true on a standby server, it will begin accepting
> connections once the recovery has brought the system to a consistent state. All such connections
> are strictly read-only."*

and that conflicts between replay and those queries are resolved by delay or cancellation, governed
by `max_standby_streaming_delay`. A backfill at full speed is a lag event on every read replica, and
the alert fires on the reporting service rather than on the deployment.

**The application.** Batches take locks and buffers that the live workload also wants. A sleep is the
cheapest possible admission control.

## Watching it run

The migration produces nothing observable while it runs — Flyway logs the start and the finish, and
the `DO` block is opaque in between. What makes the backfill watchable is precisely the thing that
makes it resumable:

```sql
SELECT count(*) FROM customers WHERE region IS NULL;
```

This works only because the batches commit. With a single large `UPDATE` there is nothing to see
until it is over. Run it from another session at intervals and you have a rate, an estimate, and an
early warning that the batches are slowing down.

## Gotchas

**★ A naive `WHERE col IS NULL ORDER BY pk LIMIT n` degrades into a full scan.** Each batch skips
everything already done, so the cost per batch grows with progress and the total is quadratic. It
looks fine for the first few minutes, which is the problem.

**★ Staging cannot show you the degradation.** A thousand-row table finishes before the predicate
gets expensive. This is a failure mode you have to reason about, not measure locally.

**★ A partial index on the backfill predicate shrinks as the backfill runs** — updating a row out of
the predicate removes its index entry. That is why it stays cheap to the last batch, and it is the
strongest argument for this option over key ranges.

**★ The backfill index costs writes for as long as it exists.** It is maintained by every insert and
every update to the indexed columns. Dropping it after the backfill is a required step, not
tidiness.

**★ `CREATE INDEX CONCURRENTLY` and `DROP INDEX CONCURRENTLY` each need their own non-transactional
migration.** Flyway's parser recognises both as unable to run in a transaction, so mixing either
with anything else forces `mixed: true` or produces a half-applied file.

**★ Key-range batching does work proportional to the key space, not the row count.** On a table with
a sparse or heavily-deleted id range, most batches update nothing and you have converted a data-sized
job into a key-space-sized one.

**★ `SELECT max(id)` is evaluated once.** Rows inserted during the backfill are above it and are
never visited. That is safe only if the application is already populating the new column — if it is
not, this is where the gap becomes permanent and silent.

**★ Keep the `IS NULL` predicate even in the key-range form.** Without it the loop is not idempotent,
a restart redoes everything, and every redone row is another dead tuple.

**★ `FOR UPDATE SKIP LOCKED` looks like an upgrade and can end the loop early.** If the application
happens to hold locks on all remaining candidate rows, the `UPDATE` affects zero rows, the exit
condition triggers, and the migration reports success with work outstanding. Plain `FOR UPDATE`
waits, which is what a one-shot backfill wants.

**★ Batch size is a decision about one batch, not about the total.** Row width and index count drive
it far more than row count. The number to watch while tuning it is application latency, not backfill
duration.

**★ Running flat out defeats the batching.** Without a gap between batches, dead tuples accumulate
faster than autovacuum reclaims them and the table bloats as if you had used one big `UPDATE`. The
sleep is part of the design.

**★ A backfill at full speed is a replica lag incident.** Every updated row becomes WAL that standbys
must replay, and replay conflicts with read-only queries on the standby. The page that alerts is
usually the reporting service, and nobody connects it to the deployment.

**★ Nothing reports progress unless you go and look.** Counting the rows still matching the backfill
predicate from another session is the whole observability story, and it only works because the
batches commit.

**★ A slowing batch rate is the signal to stop and fix the index, not to wait it out.** The quadratic
term does not level off. If batch nine thousand is ten times slower than batch one, batch eighteen
thousand will be twenty times slower.

## Interview questions

**★ Your batched backfill gets slower and slower. What is happening?**
The predicate that finds unprocessed rows has no supporting index, so each batch scans past
everything already done to find the next window. The cost per batch grows with progress and the
total cost is quadratic in table size. It is not visible early, and it is not visible in staging.

**★ How do you fix it with an index?**
A partial index on the batching key restricted to the rows that still need work — `ON customers (id)
WHERE region IS NULL`. It contains only unprocessed rows, so lookups are cheap, and it shrinks as
the backfill proceeds because each updated row leaves the predicate. Build it with `CREATE INDEX
CONCURRENTLY` in its own non-transactional migration and drop it in another one afterwards.

**★ When is key-range batching the better option?**
When the primary key is dense and you would rather not add an index to a write-heavy table for the
duration. Each batch reads a bounded key range, so its cost is constant without any new index. It is
the wrong choice when the key space is sparse relative to the rows needing work, because then most
batches do nothing and the job is sized by the key range instead of by the data.

**★ What is wrong with reading `max(id)` once at the start of a key-range loop?**
Nothing, provided the application is already writing the new column. Rows inserted after that read
are above the upper bound and are never visited by the backfill — which is fine when they are
already correct and a permanent silent gap when they are not. It is the ordering rule from
[10](10-data-migrations.md) showing up as a specific line of code.

**★ Why keep `AND region IS NULL` in a key-range loop that already bounds by id?**
Because it is what makes a restart cheap and correct. Without it, a re-run updates every row again,
producing a second full set of dead tuples for no benefit, and the migration stops being idempotent.

**★ Would you use `SKIP LOCKED` in the batch select?**
No. It looks like an improvement but changes the exit condition's meaning: if all remaining candidate
rows are locked by the application, the update affects zero rows and the loop concludes it is
finished. `SKIP LOCKED` suits queue consumers, where another worker will take the row; a one-shot
backfill has no other worker.

**★ Why sleep between batches at all?**
To leave room for autovacuum to reclaim the dead tuples the last batch created, for standbys to
replay the WAL it generated, and for the application to get its share of the buffers and locks.
Without the gap the batching still bounds transaction size but no longer bounds impact, and the table
bloats and the replicas lag exactly as they would have under one large `UPDATE`.

**★ How do you know a backfill is halfway?**
Count the rows that still match the backfill predicate, from a separate session. That is only
possible because the batches commit; a single large `UPDATE` is invisible until it finishes.
Sampling that count at intervals also gives you the rate, which is how you detect the quadratic
degradation before it costs you the deployment window.

**★ How do you size a batch?**
By what one batch costs, not by how many there will be. A batch holds row locks, creates dead
tuples, generates WAL and runs as a single statement, so it has to be small enough that none of
those matter. Row width and the number of indexes on the table dominate; the metric to tune against
is application latency during the run.

{/* FOOTER */}
