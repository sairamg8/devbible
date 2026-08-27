---
title: "Reviewing a migration is not reviewing SQL — the statement is almost always correct, and the failures this topic catalogued come from the file's name, the lock the statement takes, the transaction it does or does not run in, and whether it should have been a migration at all"
sidebar_label: "12 · The checklist"
sidebar_position: 43
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — each item links to the chunk that argues it and carries that chunk's sources.
> Cross-checked against Flyway 12's *Migration Transaction Handling*
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/migration-transaction-handling-273973399.html)),
> PostgreSQL 18's `ALTER TABLE`
> ([postgresql.org](https://www.postgresql.org/docs/18/sql-altertable.html))
> and *Explicit Locking*
> ([postgresql.org](https://www.postgresql.org/docs/18/explicit-locking.html)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**A migration arrives in a pull request as four lines of SQL that any of you could have written, and
that is exactly why it gets approved in ninety seconds. Almost none of the failures in this topic were
wrong SQL. They were a file in the wrong directory, an edit to a migration that had already run, a
statement whose lock level nobody looked up, a backfill whose runtime nobody estimated, and a change
that should never have been a migration. This chunk is the review, in four passes over the file and
the statement. [12b](12b-reviewing-the-rollout.md) is the four passes over everything around it — the
rolling deployment, the other nine pods, the tests, and what happens when it fails.**

## Pass 1 · The file, before you read a single statement

| # | Check | Why | Argued in |
|---|---|---|---|
| 1 | Does the diff **modify or delete** an existing migration file? | A migration that has run is a historical fact. Editing it breaks the checksum on every database that applied it, and `validate` fails at startup. | [04](04-checksums-and-immutability.md) |
| 2 | …including whitespace, comments, or a placeholder's *value*? | Some edits change what the migration does while leaving checksum, description and type satisfied — the tool will not save you. | [04b](04b-the-edits-nothing-catches.md) |
| 3 | Does the filename match the grammar exactly — prefix, version, double underscore, description, suffix? | All five parts are configurable, so a file that looks right can be invisible to Flyway. An invisible migration means an application that starts perfectly having applied nothing. | [02](02-the-migration-file.md) |
| 4 | Is the version unique across every open branch, not just `main`? | Two `V43` files is a merge-time failure the advisory lock does not help with, and the second one to merge is the one that breaks. | [02c](02c-choosing-version-numbers.md) |
| 5 | Is the file under a configured `locations` root? | `spring.flyway.locations` defaults to one directory nobody set, and every way of getting it wrong produces silence rather than an error. | [02b](02b-where-they-live.md) |
| 6 | Is a `{vendor}` placeholder in play? | Vendor-specific locations mean more than one set of files, and the set CI runs may not be the set production runs. | [02b](02b-where-they-live.md), [11](11-testing-migrations.md) |
| 7 | `V` or `R`, and is that the right one? | A repeatable migration re-runs when its **checksum** changes, not when the data does. Everything expensive, ordered or once-only belongs in a `V`. | [05](05-repeatable-migrations.md), [05c](05c-what-does-not-belong.md) |
| 8 | If `R`, does the file describe an end state that survives being applied twice? | `CREATE OR REPLACE` is far more restricted on PostgreSQL than its name suggests, and the failure is on the second run, in the second environment. | [05b](05b-what-belongs-in-a-repeatable-migration.md) |
| 9 | Does the description read like a sentence somebody will search for in two years? | It is what `info` prints and what a reviewer of the next incident reads. It is also compared, so changing it later is an edit. | [03c](03c-reading-the-history.md), [04](04-checksums-and-immutability.md) |

## Pass 2 · Should this be a migration at all?

Run [10c](10c-when-it-should-not-be-a-migration.md)'s seven questions. Any single yes moves the work
out of the deployment.

| # | Check | Why | Argued in |
|---|---|---|---|
| 10 | Does it touch **rows** rather than the catalogue? | Everything below applies with a different weight. A data migration's cost scales with production's row count, which CI does not have. | [10](10-data-migrations.md) |
| 11 | Does it need logic that only exists in Java — encryption, hashing, a locale rule, a library? | Reimplementing it in PL/pgSQL creates a second source of truth that will silently diverge the first time the Java changes. | [10c](10c-when-it-should-not-be-a-migration.md) |
| 12 | Does it make a **network call**? | It holds Flyway's advisory lock for the duration and makes a third party's availability a precondition for your deploy. | [10c](10c-when-it-should-not-be-a-migration.md) |
| 13 | Can the author state an **upper bound** on its runtime, from production's row count? | If not, it is unbounded, and unbounded work in the startup path fails every pod except the one running it. | [10c](10c-when-it-should-not-be-a-migration.md), [08b4](08b4-how-long-is-too-long.md) |
| 14 | Is it a one-off correction of rows only production ever had? | As a `V` file it is replayed forever against every environment where it can match nothing. | [10c](10c-when-it-should-not-be-a-migration.md) |
| 15 | If the rows moved out to a job — is the **enforcing constraint** in this PR or a named follow-up? | The `NOT VALID` constraint plus `VALIDATE CONSTRAINT` is the only thing that checks the job finished. Without it the split has genuinely lost a guarantee. | [10c3](10c3-what-the-migration-keeps.md) |
| 16 | Is there any way to reverse it if it is wrong? | `DROP COLUMN` undoes `ADD COLUMN`. Nothing undoes an overwrite, and undo migrations are Teams-only and documented as unsuited to data. | [10](10-data-migrations.md) |

## Pass 3 · The statement, and the lock it takes

This is the pass that gets skipped, and the one that produces outages. For **each statement** in the
file, name the lock and the cost.

| # | Check | Why | Argued in |
|---|---|---|---|
| 17 | What lock level does each statement acquire? | PostgreSQL queues lock requests per object, so an `ACCESS EXCLUSIVE` waiting behind one long query blocks every query that arrives after it. The `ALTER` is not slow; it is blocked, and everything inherits the block. | [08b](08b-locks-and-long-migrations.md) |
| 18 | Does it **rewrite the table**? | A rewrite is O(rows) under `ACCESS EXCLUSIVE`. Adding a nullable column is not a rewrite; changing a type usually is. | [08a](08a-adding-things-safely.md) |
| 19 | Constraint being added: is it `NOT VALID`, with `VALIDATE CONSTRAINT` in a separate migration? | `ADD CONSTRAINT` scans the whole table under `ACCESS EXCLUSIVE`; `NOT VALID` skips the scan and `VALIDATE` takes only `SHARE UPDATE EXCLUSIVE`. | [08a](08a-adding-things-safely.md), [10c3](10c3-what-the-migration-keeps.md) |
| 20 | Index being added: is it `CREATE INDEX CONCURRENTLY`? | A plain `CREATE INDEX` holds a lock that blocks writes for the whole build. `CONCURRENTLY` buys that back at the price of running outside a transaction. | [08a2](08a2-adding-indexes-and-enum-values.md) |
| 21 | Is `lock_timeout` set for this migration? | PostgreSQL ships it disabled, so by default every migration you have ever run contained an unbounded wait. A bounded wait turns an outage into a failed deploy. | [08b2](08b2-seeing-it-and-bounding-it.md) |
| 22 | If it retries on a lock timeout, does each attempt give its locks back? | A retry that keeps its locks is a queue that never drains. The subtransaction shape is the one that works. | [08b3](08b3-retrying-a-blocked-migration.md) |
| 23 | How long, against **production's** row count — not staging's? | Compare the estimate against the orchestrator's readiness deadline, the pipeline timeout and Flyway's lock retry budget. All three are shorter than people assume. | [08b4](08b4-how-long-is-too-long.md) |
| 24 | For a backfill: is there a predicate that excludes already-done rows? | It is what makes the work idempotent and resumable, and a long backfill will eventually need to be restarted. | [10b](10b-batching-a-backfill.md) |
| 25 | For a batched backfill: is the batch predicate indexed? | `WHERE col IS NULL ORDER BY pk LIMIT n` degrades into a full scan as progress accumulates, and the total cost becomes quadratic. Nobody sees it in the first hundred batches. | [10b2](10b2-keeping-each-batch-cheap.md) |
| 26 | Is there a throttle between batches? | Without one the dead tuples outpace autovacuum and the WAL outpaces the replicas, so the batching bounds transaction size and nothing else. | [10b2](10b2-keeping-each-batch-cheap.md) |

## Pass 4 · The transaction

| # | Check | Why | Argued in |
|---|---|---|---|
| 27 | Does the file mix statements that can and cannot run in a transaction? | Flyway will not run a mixed file without being told, and forcing `mixed` gives you a file that can be half-applied. | [08a2](08a2-adding-indexes-and-enum-values.md) |
| 28 | If `executeInTransaction=false` is needed, is there a `.conf` file whose name matches the migration **exactly**, with `.conf` appended? | A typo produces no error and no effect: the migration runs in a transaction and the `COMMIT` inside it fails, with a message that mentions neither Flyway nor the `.conf`. | [10b](10b-batching-a-backfill.md) |
| 29 | Is the setting scoped to that one migration rather than global? | A global `executeInTransaction=false` removes the automatic rollback from every migration in the project, including the ones that were fine. | [10b](10b-batching-a-backfill.md) |
| 30 | If it is non-transactional, what does a failure **leave behind**? | A `success = false` history row plus real committed partial data, and the next `migrate` refuses to run until somebody repairs it. | [03b](03b-when-a-migration-fails.md), [04d](04d-what-repair-actually-does.md) |
| 31 | Does the file `SET` any session parameter, and does it `RESET` it? | Outside a transaction there is no `SET LOCAL`, and Flyway does not reset the session — so the value leaks into the connection pool. | [10b](10b-batching-a-backfill.md), [02 · 7b](../02-connection-pooling/07b-what-sql-leaves-behind.md) |
| 32 | Is `statement_timeout` going to kill the whole thing? | The entire `DO $$ … $$` is one command and the timeout is measured from arrival to completion; internal `COMMIT`s do not reset it. | [10b](10b-batching-a-backfill.md) |

## Gotchas

**★ The SQL being correct is the least informative thing about a migration.** Almost every failure in
this topic was a correct statement in the wrong place, at the wrong time, holding the wrong lock, or
in a file that Flyway either could not see or had already recorded.

**★ A ninety-second review of a four-line diff is the normal path to the outage.** The diff is small
precisely because the dangerous parts — the lock level, the row count, the deployment ordering — are
not in it.

**★ "It ran fine in staging" answers none of Pass 3.** Staging has no rows, no concurrent workload and
no replicas, so every lock is granted immediately and every row-proportional statement is instant.

**★ A modification to an existing migration file is a `git diff` finding, not a SQL finding.** Read the
file list before the file contents; it is the single highest-yield thirty seconds of the review.

**★ Version collisions live in the *other* branch.** Checking that the new version is unique in `main`
proves nothing; the collision arrives when the second branch merges, and by then the first is deployed.

**★ Nobody notices a migration in the wrong directory, because the application starts.** Flyway applies
what it can see and reports success. The symptom is a missing column at runtime, days later.

**★ A `.conf` file with a mistyped name is silently not a script configuration for anything.** No
warning, no log line, no effect — and the failure it causes points at PostgreSQL's transaction rules
instead.

**★ `SET` without `RESET` outlives the migration.** Pooled connections are reused, so a
`statement_timeout` or `lock_timeout` left set becomes a property of some fraction of the
application's traffic for as long as the pool lives.

**★ An estimate is a review artefact, not a formality.** "About a minute" is not an estimate. The row
count, the measured rate and the resulting duration, written in the pull request, is what lets the
next reviewer disagree with you.

**★ Every item in Pass 2 is about the *shape* of the change, and shape is invisible in a diff.** The
same `UPDATE` statement is fine on a lookup table and an outage on a fact table, and the file does not
say which one it is.

## Interview questions

**★ You are reviewing a pull request that adds one migration. What do you look at first?**
The file list, not the file contents. A modification or deletion of an existing migration is the single
highest-severity finding available and takes seconds to spot: an applied migration is a historical
fact, and editing it breaks the checksum on every database that ran it, which fails startup. After
that, the filename grammar, the version's uniqueness across open branches, and the directory.

**★ The migration is `ALTER TABLE orders ADD COLUMN region text;` — approve it?**
Probably, and I would still ask two questions. Adding a nullable column with no default is a catalogue
change, so it is cheap, but it still takes `ACCESS EXCLUSIVE` briefly and will queue behind any long
transaction on that table — so is `lock_timeout` set? And is this deploy one of an expand/contract
sequence, meaning the application code that writes the column ships with it? A column nobody writes is
not harmless; it is half a change.

**★ How do you review a backfill?**
By asking for numbers before reading SQL. What is the production row count, what does one batch cost,
therefore how long does the whole thing take — and then whether that number fits inside the readiness
deadline, the pipeline timeout and Flyway's lock retry budget. If it does not fit, the review is not
about the SQL at all: the work belongs outside the deployment, with the enforcing constraint left
behind in a migration.

**★ What single question separates a safe migration from a dangerous one?**
"What lock does this take, and for how long?" The lock level tells you what queues behind it, and
PostgreSQL queues per object, so a single blocked `ACCESS EXCLUSIVE` request blocks every subsequent
query on that table. The duration tells you whether the queue is a blip or an outage. Almost every
migration incident in this topic reduces to one of those two answers being unknown at review time.

**★ The author says `executeInTransaction=false` is needed. What do you check?**
Three things. That the `.conf` file name matches the migration exactly with `.conf` appended, because
a typo silently does nothing. That the setting is per-migration rather than global, so the rest of the
project keeps its automatic rollback. And that the author can say what a failure leaves behind — a
`success = false` history row plus committed partial data, requiring a repair before the next
`migrate` will run — and that the migration is resumable enough for that to be survivable.

**★ A migration file `SET`s `statement_timeout` to zero. Is that a problem?**
It is if there is no matching `RESET`. Outside a transaction there is no `SET LOCAL` to be scoped, and
Flyway does not reset the session, so the value leaks into the connection pool and becomes a property
of whatever traffic later borrows that connection. The `RESET` at the end of the file is not tidiness.

**★ Why is "it ran fine in staging" not evidence?**
Because staging is missing all three things that make a migration dangerous: production's row count, a
concurrent workload, and replicas. Every row-proportional statement is instant against a thousand
rows, every lock is granted immediately when nothing else is running, and no standby has to replay the
WAL. Staging tests correctness, which the migrations test already covers; it cannot test safety.

{/* FOOTER */}
