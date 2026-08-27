---
title: "A migration that blocks nothing can still be fatal, because it runs inside a deployment that has its own patience and inside a transaction that has four clocks pointed at it — and the honest limit for a migration in the startup path is whatever your orchestrator will wait"
sidebar_label: "08b4 · How long is too long"
sidebar_position: 27
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against PostgreSQL 18's *Client Connection Defaults*
> ([postgresql.org](https://www.postgresql.org/docs/18/runtime-config-client.html)),
> *Routine Vacuuming*
> ([postgresql.org](https://www.postgresql.org/docs/18/routine-vacuuming.html)),
> *Progress Reporting*
> ([postgresql.org](https://www.postgresql.org/docs/18/progress-reporting.html)),
> Flyway's *Migration Transaction Handling*
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/migration-transaction-handling-273973399.html))
> and Spring Boot 4.1's `FlywayAutoConfiguration`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/main/module/spring-boot-flyway/src/main/java/org/springframework/boot/flyway/autoconfigure/FlywayAutoConfiguration.java)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**[08b](08b-locks-and-long-migrations.md) through [08b3](08b3-retrying-a-blocked-migration.md) were
about contention. This one is about duration. A `CREATE INDEX CONCURRENTLY` or a `VALIDATE
CONSTRAINT` blocks nobody and can still run for an hour, and an hour is longer than every timeout
between your pipeline and your database. The question this page answers is not "how do I make it
faster" but "where does work of this length belong", and the answer is almost never "in the path
that a container start-up is waiting on".**

## What actually kills a long migration

Nothing in Flyway. Flyway will wait indefinitely for the migration to finish. What kills it is one
of the clocks around it, and there are more of them than people expect.

**Above the JVM.** The orchestrator's patience: a Kubernetes `startupProbe` with a finite
`failureThreshold`, a Helm `--wait --timeout`, an ECS health-check grace period, a CI job timeout.
When one of those expires the container is killed mid-migration.

**In the JVM.** Nothing, by default. Boot's `FlywayMigrationInitializer` is an `InitializingBean`
whose `afterPropertiesSet()` calls `flyway.migrate()`; there is no timeout on it. The application
context is simply not finished, so nothing is listening on the port, so every probe fails.

**In the database.** Four independent settings, all defaulting to `0`, any of which may be non-zero
because your platform team or your managed provider set it:

> *"`statement_timeout` — Abort any statement that takes more than the specified amount of time."*

> *"`transaction_timeout` — Terminate any session that spans longer than the specified amount of
> time in a transaction. The limit applies both to explicit transactions (started with `BEGIN`) and
> to an implicitly started transaction corresponding to a single statement."*

> *"`idle_in_transaction_session_timeout` — Terminate any session that has been idle (that is,
> waiting for a client query) within an open transaction for longer than the specified amount of
> time."*

> *"`lock_timeout` — Abort any statement that waits longer than the specified amount of time while
> attempting to acquire a lock."*

⚠️ They interact, and the documentation spells out the precedence: *"If `transaction_timeout` is
shorter or equal to `idle_in_transaction_session_timeout` or `statement_timeout` then the longer
timeout is ignored."* [03 · 13b · The four clocks](../03-jdbc-transactions/13b-the-four-clocks.md)
works through the general case; the migration-specific consequence is that a `statement_timeout` of
`60s` set cluster-wide by a well-meaning platform team makes every migration longer than a minute
impossible, and the error will name the statement rather than the policy.

🔴 **Find out what these are set to before you write a long migration, not after.** `SHOW
statement_timeout` on the connection Flyway will actually use — the value can differ between the
server default, the database, the role and a connection pooler's own configuration.

## The failure that loops

The interesting failure is not that the migration dies. It is what happens next.

1. The orchestrator kills the pod at minute ten of a forty-minute index build.
2. PostgreSQL eventually notices the connection is gone and aborts the transaction. If the migration
   was transactional, nothing was applied and Flyway wrote nothing — *"failed migrations will always
   be rolled back (unless they were marked as non-transactional)"*. The migration is `Pending`
   again.
3. The orchestrator starts a replacement pod. It runs the migration from the beginning.
4. Ten minutes later, go to 1.

The deployment never completes and never fails, and each iteration does ten minutes of work that is
thrown away. Nothing in the logs says "this cannot succeed" because every individual step is
behaving exactly as designed.

⚠️ **The non-transactional variant is worse.** `CREATE INDEX CONCURRENTLY` is not rolled back; each
killed attempt leaves an `INVALID` index behind and a `success = false` history row that stops the
next run dead ([03b](03b-when-a-migration-fails.md),
[08a2](08a2-adding-indexes-and-enum-values.md)). The loop terminates, but only because the second
attempt fails immediately for a different reason.

🔴 **And for the whole time, Flyway's advisory lock is held.** Every other instance in the rollout
is spending its `lockRetryCount` — 50 retries at one-second intervals by default — waiting on a
migration that is going to be killed anyway. See
[09 · Many instances, one database](09-many-instances-one-database.md).

## The cost of an open transaction, independent of locks

Even a migration that takes no blocking lock costs something simply by keeping a transaction open.
The `idle_in_transaction_session_timeout` documentation states the mechanism:

> *"This option can be used to ensure that idle sessions do not hold locks for an unreasonable
> amount of time. Even when no significant locks are held, an open transaction prevents vacuuming
> away recently-dead tuples that may be visible only to this transaction; so remaining idle for a
> long time can contribute to table bloat."*

A forty-minute migration transaction is forty minutes during which autovacuum cannot reclaim dead
tuples anywhere in the database that this transaction might still be able to see. On a busy system
that is a measurable amount of bloat produced by a migration that touched nothing.

That is also why `group: true` is a bad default. Wrapping all pending migrations in one transaction
means the transaction's duration is the sum of every migration in the deployment.

## Where the work belongs instead

There are three placements and the choice is not stylistic.

**1 · In the application's startup path** — Boot's default, and correct for the overwhelming
majority of migrations, which are catalogue changes measured in milliseconds. The property that
makes it correct is that the migration finishes long before any probe cares. If you cannot state an
upper bound shorter than your `startupProbe` budget, it does not belong here.

**2 · As a separate step before the rollout** — an init container, a Kubernetes `Job`, a pipeline
stage running Flyway's CLI or Maven plugin. Migrations get their own timeout, their own logs and
their own failure, and the application pods start with the schema already correct. Turn the
in-application run off:

```yaml
spring:
  flyway:
    enabled: false
```

`FlywayAutoConfiguration` is annotated
`@ConditionalOnBooleanProperty(name = "spring.flyway.enabled", matchIfMissing = true)`, so this
removes the `Flyway` bean and the initializer entirely.

⚠️ Doing this gives up the ordering guarantee that [07b](07b-validate-not-update.md) relies on —
Boot no longer has a database initializer to make the `EntityManagerFactory` depend on, so
`ddl-auto: validate` stops being an assertion about a schema that Flyway definitely just migrated
and becomes an assertion about whatever the schema happens to be. That is still worth having; it is
just weaker, and the migration step must be *ordered before* the rollout by the pipeline rather than
by Spring.

**3 · Not as a migration at all.** A backfill over fifty million rows, a `CREATE INDEX
CONCURRENTLY` on a terabyte table, a `VACUUM FULL` — these are operational tasks that happen to
change the database. Running them as a Flyway migration buys you exactly one thing, a row in
`flyway_schema_history`, and costs you the ability to pause, resume, monitor and abort. Run them
deliberately, then record the fact with a migration that only writes history —
`skipExecutingMigrations` exists for precisely this and is Community
([04e](04e-when-repair-is-the-right-answer.md)). [10](10-data-migrations.md) makes the same argument
for data.

## Watching one that is already running

PostgreSQL reports progress for exactly the operations that are long:

- *"Whenever `CREATE INDEX` or `REINDEX` is running, the `pg_stat_progress_create_index` view will
  contain one row for each backend that is currently creating indexes."*
- *"Whenever `VACUUM` is running, the `pg_stat_progress_vacuum` view will contain one row for each
  backend (including autovacuum worker processes) that is currently vacuuming."*
- *"Whenever `CLUSTER` or `VACUUM FULL` is running, the `pg_stat_progress_cluster` view will contain
  a row for each backend that is currently running either command."*
- *"Whenever `COPY` is running, the `pg_stat_progress_copy` view will contain one row for each
  backend that is currently running a `COPY` command."*

Those four cover most of what makes a migration slow. A plain `ALTER TABLE … TYPE` rewrite has no
progress view, which is one more reason to prefer the expand/contract route in
[08](08-migrating-a-live-service.md) over rewriting a column in place.

## Gotchas

**★ Flyway has no migration timeout, and neither does Spring Boot.** The initializer calls
`migrate()` and waits. Every bound on a migration's duration comes from the database or from the
thing that started the JVM.

**★ A killed long migration produces a loop, not a failure.** Roll back, restart, run again from
zero, get killed again. Nothing reports an error because nothing has errored. Look for a deployment
that has been "in progress" for an unreasonable time before you look for exceptions.

**★ A cluster-wide `statement_timeout` silently caps every migration you will ever write.** Check
`SHOW statement_timeout` on the connection Flyway uses, not on your psql session — role, database
and pooler settings can all differ.

**★ `transaction_timeout` can make the other two irrelevant.** *"If `transaction_timeout` is shorter
or equal to `idle_in_transaction_session_timeout` or `statement_timeout` then the longer timeout is
ignored."* Reading only `statement_timeout` can leave you confused about why a migration died early.

**★ A long transaction blocks vacuum globally, not just on the table it touched.** Dead tuples that
might still be visible to it cannot be reclaimed anywhere. A long migration is a bloat event even
when it takes no lock.

**★ `group: true` makes the transaction as long as the whole deployment's migrations.** All the
duration costs — vacuum, locks, exposure to a timeout — become the sum rather than the maximum.

**★ Turning off `spring.flyway.enabled` also removes the ordering edge Boot gave you.** No Flyway
bean means no database initializer for the `EntityManagerFactory` to depend on, so
`ddl-auto: validate` no longer asserts anything about a migration that just ran
([07b](07b-validate-not-update.md)). Order the migration step in the pipeline instead, and know that
you are doing so.

**★ An init container runs on every pod, not once per rollout.** That is usually fine — Flyway's
advisory lock serialises them and the losers find nothing to do — but it is not the same as a
`Job`, and with a slow first migration the later pods can exhaust `lockRetryCount` and crash-loop
([09](09-many-instances-one-database.md)).

**★ Non-transactional long migrations do not merely fail, they leave debris.** An interrupted
`CREATE INDEX CONCURRENTLY` leaves an `INVALID` index and a `success = false` row, and the next
attempt fails on the name collision rather than retrying cleanly.

**★ "It only takes twenty minutes" is a statement about today's row count.** The table that takes
twenty minutes to rewrite this quarter takes fifty next year, and the migration was written once. If
duration scales with data, the design has to be resumable rather than merely fast enough.

**★ A migration that fails at minute thirty-nine of forty restarts at minute zero.** Long migrations
should be split into several files that each commit, so a failure loses one step and not the run —
which is the same argument [10b](10b-batching-a-backfill.md) makes about batching, one level up.

**★ There is no progress view for an `ALTER TABLE` rewrite.** `CREATE INDEX`, `VACUUM`, `CLUSTER`
and `COPY` report progress; a column type change does not. If you cannot observe it, you cannot
decide whether to wait — another argument for adding a new column instead of retyping an old one.

## Interview questions

**★ How long is a migration allowed to take?**
Less than the shortest timeout between it and the outside world. In the default Boot arrangement
that is your orchestrator's start-up patience, because the application context does not finish and
no port is listening until `migrate()` returns. If you cannot state an upper bound shorter than
that, the migration does not belong in the startup path — regardless of whether it takes any locks.

**★ What times a migration out?**
Not Flyway and not Spring — neither imposes any limit. Either a database setting
(`statement_timeout`, `transaction_timeout`, `idle_in_transaction_session_timeout`, `lock_timeout`,
all zero by default but frequently set by a platform team or a managed provider) or the process
manager killing the JVM.

**★ Describe the failure mode when a long migration exceeds the orchestrator's timeout.**
The pod is killed, PostgreSQL rolls the transaction back, Flyway wrote nothing, so the migration is
`Pending` again. The orchestrator starts a replacement, which runs the same migration from the
start, and is killed at the same point. The deployment loops indefinitely doing throwaway work, and
because every component is behaving correctly there is no error in any log to find.

**★ Why is a long migration expensive even when it takes no blocking lock?**
Because an open transaction prevents vacuum from reclaiming dead tuples that might still be visible
to it. The documentation says so directly. A forty-minute migration is forty minutes of accumulating
bloat across the database, plus forty minutes holding Flyway's advisory lock against every other
instance.

**★ Where would you run a `CREATE INDEX CONCURRENTLY` on a very large table?**
Not in the deployment. It takes no blocking lock, so it is safe to run at any time — which means
there is no reason for it to be inside the path that a rollout is waiting on. Run it deliberately as
an operational task with monitoring via `pg_stat_progress_create_index`, then record it in Flyway's
history with a migration configured to skip execution, so the schema history stays honest.

**★ What do you give up by setting `spring.flyway.enabled: false` and migrating from a separate
job?**
Boot's dependency edge. `FlywayAutoConfiguration` normally registers the migration initializer as a
database initializer, and everything annotated `@DependsOnDatabaseInitialization` — including the
`EntityManagerFactory` — is made to depend on it. Without the Flyway bean that edge disappears, so
`ddl-auto: validate` still checks the mapping against the live schema but no longer does so with a
guarantee that migrations ran first. The pipeline has to provide that ordering instead.

**★ How do you decide between splitting a migration and making it faster?**
By asking whether the duration scales with the data. If it does, "faster" is temporary and
"resumable" is permanent: split it into steps that each commit, so a failure loses one step. If it
is a fixed cost — a rewrite of a small table, a constraint validation on a bounded set — making it
faster is a real fix.

**★ You inherit a deployment that has been "rolling out" for two hours with no errors. What do you
check?**
Whether a migration is running and being repeatedly killed. Look at `pg_stat_activity` for a
long-lived backend running migration SQL, at the progress views if it is an index build or a vacuum,
and at whether the pod has restarted several times with the same elapsed time before each restart.
An identical time-to-kill on each attempt is the signature.

{/* FOOTER */}
