---
title: "Ten pods starting at once all call migrate() against one database, and the only thing standing between them and ten concurrent schema changes is a single PostgreSQL advisory lock whose key is derived from your history table's name"
sidebar_label: "09 · Many instances, one database"
sidebar_position: 28
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Flyway 12's `PostgreSQLAdvisoryLockTemplate`, `PostgreSQLConnection`,
> `RetryStrategy` and `JdbcTableSchemaHistory`
> ([github.com/flyway/flyway](https://github.com/flyway/flyway)),
> the Flyway *PostgreSQL Database* driver reference
> ([documentation.red-gate.com](https://documentation.red-gate.com/flyway/reference/database-driver-reference/postgresql-database)),
> PostgreSQL 18's *Advisory Locks*
> ([postgresql.org](https://www.postgresql.org/docs/18/explicit-locking.html)) and
> *System Administration Functions*
> ([postgresql.org](https://www.postgresql.org/docs/18/functions-admin.html)),
> and Spring Boot 4.1's `FlywayProperties`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/main/module/spring-boot-flyway/src/main/java/org/springframework/boot/flyway/autoconfigure/FlywayProperties.java)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**Every page so far has quietly assumed one Flyway run at a time. In production that assumption is
false the first time a deployment scales past one replica: Boot runs `migrate()` in every instance's
startup, so a ten-pod rollout is ten concurrent `migrate()` calls against one database, arriving
within milliseconds of each other. Flyway does have an answer, it is a PostgreSQL advisory lock, and
every part of it is worth knowing precisely: what the key is derived from, why it polls instead of
waiting, and how much patience it has before it fails your pod's startup.**

## What would happen without a lock

Nothing subtle. Two instances read `flyway_schema_history`, both see `V42` as pending, both execute
it, and one of two things follows. If `V42` is `ALTER TABLE orders ADD COLUMN region text`, the
second one fails with a duplicate-column error and takes that pod's startup down with it. If `V42`
is `INSERT INTO countries …`, both succeed and you have every row twice. Both instances then try to
insert a history row for version 42, and the winner is whichever committed first.

That is why the lock exists. This page is how it is taken and how long it will wait;
[09b](09b-what-the-lock-actually-covers.md) is what it covers, which is less than most people
assume, and [09c](09c-what-the-lock-does-not-cover.md) is what it does not protect at all.

## The lock, exactly

Flyway's PostgreSQL support is a separate module — `org.flywaydb:flyway-database-postgresql` — and
locking lives in `PostgreSQLAdvisoryLockTemplate`. The key is built from a constant and a
discriminator:

```java
private static final long LOCK_MAGIC_NUM = (0x46L << 40)  // F
    + (0x6CL << 32)   // l
    + (0x79L << 24)   // y
    + (0x77 << 16)    // w
    + (0x61 << 8)     // a
    + 0x79;           // y
```

The magic number is the ASCII bytes of the word *Flyway* packed into a 48-bit integer. The
discriminator comes from `PostgreSQLConnection`:

```java
@Override
public <T> T lock(final Table table, final Callable<T> callable) {
    return new PostgreSQLAdvisoryLockTemplate(database.getConfiguration(),
        jdbcTemplate,
        table.toString().hashCode()).execute(callable);
}
```

🔴 **`table` here is the schema history table**, and `table.toString()` is its qualified name. So the
lock key is `"Flyway" + hashCode(qualified name of flyway_schema_history)`. Everything that follows
from that — which runs exclude each other and which do not — is on
[09c](09c-what-the-lock-does-not-cover.md).

## Two lock modes, and why there are two

```java
if (configurationExtension.isTransactionalLock()) {
    return new TransactionalExecutionTemplate(jdbcTemplate.getConnection(), true)
        .execute(() -> execute(callable, this::tryLockTransactional));
} else {
    RuntimeException rethrow = null;
    try {
        return execute(callable, this::tryLock);
    } catch (RuntimeException e) {
        rethrow = e;
        throw rethrow;
    } finally {
        unlock(rethrow);
    }
}
```

**Transactional (the default)** runs `SELECT pg_try_advisory_xact_lock(n)` inside a transaction that
wraps the whole run. PostgreSQL describes that family as:

> *"Transaction-level lock requests … are automatically released at the end of the transaction, and
> there is no explicit unlock operation. This behavior is often more convenient than the
> session-level behavior for short-term usage of an advisory lock."*

Automatic release is exactly what you want when the process holding it might be killed.

**Session-level** runs `SELECT pg_try_advisory_lock(n)` and releases it in a `finally` with
`pg_advisory_unlock(n)`. It exists because the transactional form cannot work when the migration
itself cannot be in a transaction. Flyway's own PostgreSQL page states the case:

> *"By default Flyway uses a transactional lock with PostgreSQL, however this can cause issues with
> certain SQL statements, most notably `CREATE INDEX CONCURRENTLY`."*

Under Spring Boot the switch is `spring.flyway.postgresql.transactional-lock`, whose javadoc reads
*"Whether transactional advisory locks should be used. If set to false, session-level locks are used
instead."*

```yaml
spring:
  flyway:
    postgresql:
      transactional-lock: false
```

⚠️ This is the setting you need in any application whose migrations include a `CREATE INDEX
CONCURRENTLY` ([08a2](08a2-adding-indexes-and-enum-values.md)), and it changes the lock's failure
behaviour — see [09c](09c-what-the-lock-does-not-cover.md).

## It never waits in the database. It polls.

Both branches call `pg_try_advisory_*`, not `pg_advisory_*`. The distinction matters:

> *"`pg_try_advisory_xact_lock` … Obtains an exclusive transaction-level advisory lock if available.
> This will either obtain the lock immediately and return true, or return false without waiting if
> the lock cannot be acquired immediately."*

So a losing instance does not block on the server; it gets `false` and comes back. The coming-back
is `RetryStrategy`, and it is as simple as it looks:

```java
private int nextWaitInMilliseconds() {
    return 1000;
}

public void doWithRetries(final SqlCallable<Boolean> callable,
    final String interruptionMessage, final String retriesExceededMessage) throws SQLException {
    while (!callable.call()) {
        try {
            Thread.sleep(nextWaitInMilliseconds());
        } catch (InterruptedException e) {
            throw new FlywayException(interruptionMessage, e);
        }
        if (!hasMoreRetries()) {
            throw new FlywayException(retriesExceededMessage);
        }
        nextRetry();
    }
}
```

A **fixed one-second** wait — no backoff, no jitter — and a hard-coded default of 50 retries. The
Flyway reference for `lockRetryCount` puts the behaviour in words:

> *"At the start of a migration, Flyway will attempt to take a lock to prevent competing instances
> executing in parallel. If this lock can't be obtained straight away, Flyway will retry at 1s
> intervals, until this count is reached, at which point it will abandon the migration. A value of
> -1 indicates that Flyway should keep retrying indefinitely."*

🔴 **So the default patience of a losing instance is about fifty seconds.** Not a minute you chose —
a minute that came from `private static int numberOfRetries = 50;`. Spring Boot re-declares the same
default in `FlywayProperties` as `private int lockRetryCount = 50;` and exposes it:

```yaml
spring:
  flyway:
    lock-retry-count: 200      # -1 for "wait forever"
```

When the budget runs out, the message is not ambiguous:

```java
"Number of retries exceeded while attempting to acquire PostgreSQL advisory lock. "
    + "Configure the number of retries with the 'lockRetryCount' configuration option: " + ...
```

That exception propagates out of `flyway.migrate()`, out of `FlywayMigrationInitializer`, and fails
the application context. The pod does not start.

## Gotchas

**★ The lock is a *try* lock plus a sleep loop, not a database wait.** Nine instances polling once a
second is nine queries a second against your database for the duration of the migration. Harmless at
ten replicas; worth knowing at two hundred.

**★ The retry interval is a fixed 1000 ms with no backoff and no jitter.** `nextWaitInMilliseconds()`
returns the constant. Every losing instance polls in lockstep, and they stay in lockstep.

**★ The default budget is about fifty seconds and it is not derived from anything.** If your first
migration on a fresh production database takes two minutes, every instance except the winner fails
to start with the default `lockRetryCount`.

**★ Exceeding the budget is a startup failure, not a warning.** The `FlywayException` propagates
through `FlywayMigrationInitializer.afterPropertiesSet()` and the context never refreshes. Under
Kubernetes that is a `CrashLoopBackOff`, and the restart is an accidental retry that may well
succeed — which is why this failure is often seen as "slow rollouts" rather than as a lock problem.

**★ `lock-retry-count: -1` means wait forever, and forever is a long time.** It converts a
crash-loop into a hang, which is harder to see. Prefer a large finite number.

**★ The winner is arbitrary.** There is no leader election and no ordering; whichever instance's
`pg_try_advisory_xact_lock` lands first wins. Do not build anything on "the first pod runs the
migrations".

**★ The transactional lock is released by the commit, so it covers exactly the migration
transaction.** With `transactional-lock: false` the release is a `finally` block in the JVM
instead — and a `finally` block does not run if the process is killed.

**★ `CREATE INDEX CONCURRENTLY` forces you off the default lock mode.** You cannot have both a
transactional advisory lock and a statement that refuses to run in a transaction. If any migration
in your history needs `CONCURRENTLY`, the whole application runs with session-level locks.

## Interview questions

**★ Ten pods start simultaneously and all run Flyway. What stops them corrupting the schema?**
A PostgreSQL advisory lock taken around the entire migration run. One instance acquires it and
applies the pending migrations; the others poll until it is released, then acquire it themselves,
find nothing pending, and continue. `migrate()` is safe concurrently because the lock serialises it
and the history table makes the second run a no-op.

**★ What is the advisory lock's key?**
A constant plus a discriminator. The constant is the ASCII bytes of "Flyway" packed into a 48-bit
number; the discriminator is the Java `hashCode()` of the qualified name of the schema history
table. So the scope of mutual exclusion is "runs that share a history table", which is not the same
as "runs against the same database".

**★ Does a losing instance block inside PostgreSQL?**
No. Flyway calls `pg_try_advisory_xact_lock`, which the documentation describes as returning false
without waiting if the lock is unavailable. The waiting happens in the JVM: a fixed one-second sleep
between attempts, bounded by `lockRetryCount`.

**★ What is `lockRetryCount` and what is its default?**
The number of one-second retries a Flyway run will make before abandoning the migration. It defaults
to 50 in Flyway's own `RetryStrategy` and Spring Boot re-declares the same default, so out of the
box an instance waits about fifty seconds. `-1` retries indefinitely.

**★ What happens when the retry budget is exhausted?**
Flyway throws with a message naming `lockRetryCount`. Under Spring Boot that comes out of
`FlywayMigrationInitializer`, the application context fails to refresh and the process exits, so the
pod crash-loops. The restart re-attempts the migration, which is why the symptom usually looks like
a slow or flapping rollout rather than an error.

**★ Why are there two lock modes, and when do you need the non-default one?**
The default is a transaction-level advisory lock, released automatically at commit, which is the
safest option because it survives the process being killed. It cannot be used when the migration
itself must not run in a transaction — most commonly `CREATE INDEX CONCURRENTLY` — so Flyway offers
session-level locks via `spring.flyway.postgresql.transactional-lock: false`, released explicitly in
a `finally` block.

**★ Concretely, what goes wrong if the lock is not there?**
Two instances both read the history table, both see `V42` as pending and both execute it. If it is
a DDL statement the second one fails on a duplicate object and takes that pod's startup with it; if
it is an `INSERT` of reference data both succeed and every row exists twice — which nothing reports,
because both migrations "worked". Both then race to write a history row for the same version. The
DDL case is loud and survivable; the data case is silent and is the one that reaches production.

**★ Nine pods are polling once a second for the length of the migration. Is that a problem?**
At ten replicas, no — it is nine trivial queries a second. It becomes worth thinking about at large
replica counts, because the retry is a fixed 1000 ms with no backoff and no jitter, so every losing
instance polls in lockstep and stays in lockstep for the whole run. The load is constant rather than
decaying, and it is at its highest exactly while the winner is doing the expensive work.

**★ Would you set `lock-retry-count: -1`?**
Rarely. `-1` means retry indefinitely, which converts a crash-loop into a hang: the pod stays alive,
never becomes ready, and emits no error. A crash-loop is at least visible in the deployment's status
and in the restart count. A large finite value — enough to cover the longest migration you expect,
with margin — gives you the patience without giving up the failure signal.

**★ Your first deployment against a fresh production database fails on every pod but one. Why?**
Because the initial migration run is long — it is every migration you have ever written, applied in
sequence — and the default retry budget is about fifty one-second attempts. The winner is still
working when the other instances exhaust `lockRetryCount` and throw, which fails their application
contexts. It is a configuration mismatch, not a bug: raise `spring.flyway.lock-retry-count` for the
first rollout, or apply the baseline migrations from a separate job before the deployment starts.

{/* FOOTER */}
