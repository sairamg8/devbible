---
title: "Flyway takes its advisory lock around one migration and releases it before the next, so a ten-pod rollout can apply V42 from one instance and V43 from another — and the retry budget only ever has to cover the longest single migration"
sidebar_label: "09b · What the lock actually covers"
sidebar_position: 29
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Flyway 12's `DbMigrate`, `JdbcTableSchemaHistory` and
> `PostgreSQLAdvisoryLockTemplate`
> ([github.com/flyway/flyway](https://github.com/flyway/flyway/tree/main/flyway-core/src/main/java/org/flywaydb/core/internal)),
> the Flyway `group` and `lockRetryCount` reference pages
> ([github.com/flyway/flyway](https://github.com/flyway/flyway/tree/main/documentation/Reference/Configuration)),
> and PostgreSQL 18's *Advisory Locks*
> ([postgresql.org](https://www.postgresql.org/docs/18/explicit-locking.html)).
> JDK 25, Spring Boot 4.1.1, Flyway 12.4.0, PostgreSQL 18.

**[09](09-many-instances-one-database.md) established that Flyway serialises concurrent runs with a
PostgreSQL advisory lock and that a losing instance polls for about fifty seconds before failing
startup. The natural reading of that is "one instance runs the deployment's migrations and the
others wait". That reading is wrong by default, and the correct one changes what `lockRetryCount`
has to be big enough for, explains a history table whose `installed_by` column tells no single
story, and is the reason `group: true` is more dangerous than it looks.**

## The lock is taken per migration, not per run

`DbMigrate.migrateAll()` is a loop, and the lock is *inside* it:

```java
final int count = configuration.isGroup()
    // With group active a lock on the schema history table has already been acquired.
    ? migrateGroup(firstRun)
    // Otherwise acquire the lock now. The lock will be released at the end of each migration.
    : schemaHistory.lock(() -> migrateGroup(firstRun));
```

The comment is Flyway's own. `migrateGroup` is documented in its javadoc as *"Migrate a group of one
(`group = false`) or more (`group = true`) migrations"*, and the first thing it does inside the lock
is construct a fresh `MigrationInfoServiceImpl` and call `infoService.refresh()`. It re-reads the
history table every time it holds the lock.

So the default cycle is:

> **acquire → re-read history → apply exactly one migration → write its history row → commit →
> release → repeat**

and the loop exits when an acquisition comes back having applied zero migrations.

With `group: true` the lock moves outside the loop and is held for the whole run — which is exactly
what the source comment means by *"a lock on the schema history table has already been acquired"*.

## What a rollout actually looks like

1. All ten pods call `migrate()`. One wins `pg_try_advisory_xact_lock`; nine get `false` and sleep
   for a second.
2. The winner applies **one** pending migration, commits, and releases the lock.
3. Any of the ten — including one of the nine — wins the next round, re-reads the history table, and
   applies the next pending migration.
4. Eventually some acquisition finds nothing pending, `count` comes back `0`, and that instance's
   loop breaks. It proceeds with startup.
5. Every remaining instance reaches the same conclusion on its own next acquisition.

Step 4 is why the whole design works. `migrate()` is safe to call concurrently not because the tenth
call is prevented, but because by the time it runs it is a query that finds nothing to do. The lock
provides serialisation; the history table provides idempotence. Neither alone is sufficient.

🔴 **A ten-pod rollout can therefore interleave migrations across pods.** Pod 3 applies `V42`, pod 7
applies `V43`, pod 1 applies `V44`. Every one is correct and in order, because each acquisition
re-reads the history before deciding what is pending. But `installed_by` in `flyway_schema_history`
([03 · The history table](03-the-history-table.md)) will name whichever session happened to win each
round, so "who ran this deployment" has no single answer.

## What `lockRetryCount` has to cover

`PostgreSQLAdvisoryLockTemplate.lock()` constructs a **new** `RetryStrategy` on every acquisition:

```java
private void lock(final SqlCallable<Boolean> tryLock) throws SQLException {
    final RetryStrategy strategy = new RetryStrategy();
    strategy.doWithRetries(tryLock, ...);
}
```

So the fifty-second default budget is per acquisition, not per run. Combine that with per-migration
locking and the requirement is precise:

| Configuration | The retry budget must outlast |
|---|---|
| `group: false` (default) | the **longest single migration** |
| `group: true` | the **entire deployment's migrations, combined** |

That is a real argument against `group`, separate from the lock-exposure argument in
[08b](08b-locks-and-long-migrations.md). A deployment with twenty fast migrations is completely
safe at the default `lockRetryCount` when they are locked individually, and can crash-loop every
instance except one when they are locked together.

⚠️ Flyway's own `group` documentation is lukewarm about it for a different reason — *"only
recommended for databases with support for DDL transactions"*, and *"If `executeInTransaction` is set
to false, this parameter will have no impact"*. Both are true; neither is the reason you are most
likely to get hurt by it.

## The other race: creating the history table

There is a second concurrency hazard that happens before the lock is any use. On a brand-new
database the history table does not exist yet, and every instance wants to create it.
`JdbcTableSchemaHistory.create()` handles it with a retry loop **inside** `connection.lock(table,
…)`: it loops while the table does not exist, catching `FlywayException`, sleeping one second, and
giving up after **10** attempts.

Two things about that are worth holding on to.

**The lock is taken on a table that does not exist**, and that is fine precisely because the lock is
advisory. The key is `hashCode()` of the table's *name*
([09](09-many-instances-one-database.md)); PostgreSQL never looks at the table. This is the clearest
demonstration of what "advisory" means:

> *"PostgreSQL provides a means for creating locks that have application-defined meanings. These are
> called advisory locks, because the system does not enforce their use — it is up to the application
> to use them correctly."*

**That budget is ten seconds and it is not configurable.** It is not `lockRetryCount`; it is a
literal `10` in the loop. On a first deployment against a database that is slow to create a table —
a heavily loaded cluster, a schema-creation grant that has to be checked, a pooler in the middle —
that is the number that bites, and no property will move it.

## Gotchas

**★ The lock covers one migration, not the run.** By default Flyway acquires it, applies a single
migration, and releases it before looping. Every mental model built on "one pod does the
deployment" is wrong in a way that only shows up in the history table and in retry budgets.

**★ `group: true` turns a per-migration lock into a per-run lock**, and therefore turns a
per-migration retry budget into a per-run one. Every losing instance must now outlast the entire
deployment's migrations on a single fifty-second allowance.

**★ `installed_by` will not identify "the pod that ran the migrations".** Different rows in one
deployment can be written by different instances. If you use `installed_by` for auditing, audit the
*value*, not the assumption that it is constant within a version range.

**★ The history table is re-read on every acquisition.** That is what makes the design safe, and it
is also a real query per lock acquisition per instance. On a history table with thousands of rows
([03c · Reading the history](03c-reading-the-history.md)) that cost is multiplied by replica count
during the most sensitive minute of a deployment.

**★ Nine instances doing nothing still each open a connection, take the lock, and read the history.**
"Found nothing to do" is not free. At two hundred replicas it is two hundred lock acquisitions and
two hundred history scans.

**★ The history table's own creation has a separate, hard-coded budget of ten attempts at one
second.** It is not `lockRetryCount` and there is no property for it. A first deployment that cannot
create the table within ten seconds fails, and raising `lock-retry-count` does not help.

**★ The winner of each round is arbitrary and does not persist.** There is no leader; whichever
`pg_try_advisory_xact_lock` lands first wins that round. Do not build ordering, logging or
notification on "the migrating instance".

**★ Interleaving is safe but non-deterministic, which matters for callbacks.** A `beforeMigrate` or
`afterMigrate` callback runs per Flyway *run*, not per migration, so with ten instances it runs ten
times — nine of them around a run that applied nothing. Anything with a side effect in a callback
needs to tolerate that.

**★ `migrateGroup` throws before applying anything if it finds a failed migration.** The check is
inside the lock, so every instance in turn acquires the lock, re-reads the history, sees the
`success = false` row and fails identically. A single bad migration crash-loops the whole fleet, not
one pod ([03b](03b-when-a-migration-fails.md)).

**★ `target: next` also exits the loop after one migration.** If you have configured a target of
`next`, each `migrate()` call applies exactly one migration and stops — which under ten replicas
means ten instances each apply at most one, and the deployment may finish under-migrated without
anything failing.

## Interview questions

**★ Does one instance apply all the migrations in a deployment?**
Not by default. Flyway acquires the advisory lock, applies one migration, releases it, and loops, so
a different instance can win the next round. All migrations still run exactly once and in version
order, but `installed_by` in the history table can name several different sessions for a single
deployment. Setting `group: true` is what makes one instance apply everything.

**★ Why is it safe for nine instances to run `migrate()` after the tenth has already migrated?**
Because `migrate()` decides what to do from `flyway_schema_history`, which it re-reads inside the
lock on every acquisition. By the time the nine acquire it, the history already records every
migration as applied, so they resolve zero pending migrations and do nothing. Serialisation plus a
durable record of what was applied is what makes the operation idempotent.

**★ What does `lockRetryCount` actually have to be big enough for?**
The longest single migration, because a fresh retry budget is created for each acquisition and the
lock is released between migrations. With `group: true` it has to cover the entire run instead. That
distinction is the difference between a default of fifty seconds being ample and being nowhere near
enough.

**★ What is the second race, before the lock is useful?**
Creating the history table on an empty database. `JdbcTableSchemaHistory.create()` loops while the
table does not exist, catching the exception and sleeping a second, up to ten attempts — inside the
same advisory lock. That budget is hard-coded and entirely separate from `lockRetryCount`.

**★ How can Flyway lock a table that does not exist yet?**
Because it is not locking the table. The advisory lock's key is derived from the `hashCode()` of the
table's qualified *name*; PostgreSQL never resolves it to an object. That is what "advisory" means —
the documentation says the system does not enforce the lock's use, it is up to the application to
use it correctly.

**★ One migration in a deployment is broken. How many pods fail?**
All of them. The failed-migration check happens inside the lock in `migrateGroup`, after re-reading
the history, so every instance in turn acquires the lock, sees the `success = false` row and throws
the same exception. This is not a case where nine pods survive on stale state.

**★ You see `installed_by` values from three different sessions across one deployment's migrations.
Is something wrong?**
No. That is the expected consequence of per-migration locking with several replicas starting
together. It would only be surprising with `group: true`, where a single instance holds the lock for
the whole run.

**★ Why is `group: true` risky beyond the lock-duration argument?**
Because it converts the retry budget from per-migration to per-run *and* holds every table lock the
migrations take until the last one commits. A deployment of twenty individually-fast migrations that
is completely safe at defaults can crash-loop every replica but one, and hold `ACCESS EXCLUSIVE` on
several tables for the total runtime, purely from flipping that flag.

{/* FOOTER */}
