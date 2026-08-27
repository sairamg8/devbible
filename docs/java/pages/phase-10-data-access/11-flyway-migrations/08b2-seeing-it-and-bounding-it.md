---
title: "lock_timeout is the one setting that turns a lock-queue outage into a failed deployment, and PostgreSQL ships it disabled — so every migration you have ever run has had an unbounded wait in it"
sidebar_label: "08b2 · Seeing it, and bounding it"
sidebar_position: 25
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against PostgreSQL 18's *Client Connection Defaults*
> ([postgresql.org](https://www.postgresql.org/docs/18/runtime-config-client.html)),
> *Explicit Locking*
> ([postgresql.org](https://www.postgresql.org/docs/18/explicit-locking.html)),
> `pg_locks` ([postgresql.org](https://www.postgresql.org/docs/18/view-pg-locks.html)),
> *Error Reporting and Logging*
> ([postgresql.org](https://www.postgresql.org/docs/18/runtime-config-logging.html)),
> PL/pgSQL *Transaction Management*
> ([postgresql.org](https://www.postgresql.org/docs/18/plpgsql-transactions.html)),
> Flyway 12's `initSql` and *Callback Events* reference
> ([github.com/flyway/flyway](https://github.com/flyway/flyway/tree/main/documentation/Reference))
> and Spring Boot 4.1's `FlywayProperties` / `FlywayAutoConfiguration`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/tree/main/module/spring-boot-flyway/src/main/java/org/springframework/boot/flyway/autoconfigure)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**[08b](08b-locks-and-long-migrations.md) argued that an unbounded lock wait inside a migration is
an outage waiting for a coincidence. This chunk is the defence, and it is short because PostgreSQL
already has the right feature: `lock_timeout` bounds the wait, converting a silent site-wide stall
into a loud failed deployment. The work is in knowing that it defaults to zero, knowing where to set
it so it does not leak into your connection pool, and and knowing that a bounded wait is not the same as a
bounded statement. Retrying rather than failing is [08b3](08b3-retrying-a-blocked-migration.md);
the statement that is slow once it *has* the lock is [08b4](08b4-how-long-is-too-long.md).**

## Seeing it: the query to have ready

Two views, joined on `pid`, filtered to the table:

```sql
SELECT l.pid, l.mode, l.granted, l.waitstart,
       a.state, a.xact_start, a.query
FROM pg_locks l
JOIN pg_stat_activity a USING (pid)
WHERE l.relation = 'orders'::regclass
ORDER BY l.granted DESC, l.waitstart;
```

> *"`granted` is true in a row representing a lock held by the indicated process. False indicates
> that this process is currently waiting to acquire this lock … The waiting process will sleep until
> the other lock is released (or a deadlock situation is detected). A single process can be waiting
> to acquire at most one lock at a time."*

> *"`waitstart` — Time when the server process started waiting for this lock, or null if the lock is
> held. Note that this can be null for a very short period of time after the wait started even
> though `granted` is false."*

The row with `granted = true` and the oldest `xact_start` is your blocker. `a.state` will very often
read `idle in transaction`, which means nobody is going to fix it by finishing.

⚠️ **`pg_locks` is not a consistent snapshot.** Fast-path lock data is *"gathered from each backend
one at a time, without freezing the state of the entire lock manager"*, so *"This data is not
guaranteed to be entirely consistent."* Good enough to find a blocker by hand; not a foundation for
an automated killer.

⚠️ **Row-level locks are mostly absent from it.** *"information about row-level locks is stored on
disk, not in memory, and therefore row-level locks normally do not appear in this view"* — a process
waiting on a row lock instead appears waiting on the *transaction ID* of the holder. That is
[03 · 12 · Locking and SELECT FOR UPDATE](../03-jdbc-transactions/12-locking-and-select-for-update.md)'s
territory, and it is why a query filtered on `relation` sometimes finds nothing.

## Being told instead of looking

`log_lock_waits` is the setting to turn on before you need it, because after the incident the
evidence is gone:

> *"Controls whether a log message is produced when a session waits longer than `deadlock_timeout`
> to acquire a lock. This is useful in determining if lock waits are causing poor performance. The
> default is `off`."*

`deadlock_timeout` doubles as the threshold, and the documentation says so: *"When `log_lock_waits`
is set, this parameter also determines the amount of time to wait before a log message is issued
about the lock wait. If you are trying to investigate locking delays you might want to set a shorter
than normal `deadlock_timeout`."*

## `lock_timeout` is the fix, and it is off by default

> *"Abort any statement that waits longer than the specified amount of time while attempting to
> acquire a lock on a table, index, row, or other database object. The time limit applies separately
> to each lock acquisition attempt. The limit applies both to explicit locking requests (such as
> `LOCK TABLE`, or `SELECT FOR UPDATE` without `NOWAIT`) and to implicitly-acquired locks. … A value
> of zero (the default) disables the timeout."*

> *"Unlike `statement_timeout`, this timeout can only occur while waiting for locks."*

With it set, the blocked migration gives up instead of dragging the site down. The deployment fails,
which is loud, recoverable and vastly preferable — and because the failure happens *before* the DDL
ran, on PostgreSQL the whole migration transaction rolls back and Flyway records no row at all, not
even a failed one ([03b · When a migration fails](03b-when-a-migration-fails.md)).

Scoped to the transaction, in the migration itself:

```sql
-- V43__Add_orders_region.sql
SET LOCAL lock_timeout = '3s';

ALTER TABLE orders ADD COLUMN region text;
```

🔴 **Use `SET LOCAL`, not `SET`.** A bare `SET` is session-scoped, and nothing cleans it up: Flyway's
`PostgreSQLConnection.doRestoreOriginalState` issues only a `SET ROLE` back to the original user,
never a `DISCARD ALL`. Spring Boot hands Flyway the application's own `DataSource` by default, so
that connection goes back into the pool still carrying your `lock_timeout` and hands it to the next
request. That is precisely the leak
[02 · 7b · What SQL leaves behind](../02-connection-pooling/07b-what-sql-leaves-behind.md) is about,
and [7c](../02-connection-pooling/07c-scoping-state-correctly.md) gives the rule: put the state
somewhere narrower than the session.

⚠️ **`SET LOCAL` needs a transaction to be local to.** For a Flyway migration on PostgreSQL there
normally is one — `executeInTransaction` defaults to `true`. In a migration you deliberately marked
non-transactional (the `CREATE INDEX CONCURRENTLY` of
[08a2](08a2-adding-indexes-and-enum-values.md)) `SET LOCAL` emits a warning and does nothing; there
you need a plain `SET` and a `RESET lock_timeout` at the end of the file.

## Setting it once instead of in every file

A rule that requires a line in every file fails on the first hurried pull request. Two ways to make
it the default for every Flyway connection.

**The Spring Boot property.** `FlywayProperties` exposes `initSqls`, documented as *"SQL statements
to execute to initialize a connection immediately after obtaining it"*, and
`FlywayAutoConfiguration` joins the list with newlines and passes it to Flyway's `initSql`:

```yaml
spring:
  flyway:
    init-sqls:
      - "SET lock_timeout = '3s'"
```

⚠️ Flyway 12 marks the underlying setting deprecated: *"This parameter is deprecated and will be
removed in a future release. Please use `afterConnect` callback instead."* The same page also warns
that it is *"an 'Initial SQL command', not an 'Initialization SQL command'. It may be executed
multiple times, as it runs immediately after each database connection is established"* — which for
this purpose is exactly what you want.

**The `afterConnect` callback**, which is where Flyway is pointing. The event fires *"Immediately
after Flyway connects to the database"*, and a SQL callback is created by *"nam[ing] a script after
the callback name (e.g. `afterMigrate.sql`)"* in the configured callbacks location — so
`afterConnect.sql` alongside your migrations, containing the `SET`. Spring Boot also auto-registers
any `Callback` bean, so the Java route works with no extra wiring
([07 · Boot integration](07-boot-integration.md)).

Either route sets it on the *session*, not inside a transaction, and that is correct here: it is
Flyway's connection and it is being configured deliberately for the whole run.

## Gotchas

**★ `lock_timeout` is `0` by default and nothing turns it on for you.** Not Flyway, not Spring Boot,
not any managed PostgreSQL provider's default parameter group. If you have never set it, you do not
have it, and every migration you have ever run contained an unbounded wait.

**★ `statement_timeout` is not a substitute.** It aborts statements that *run* too long; a blocked
`ALTER TABLE` is not running. The documentation notes the interaction directly: *"if
`statement_timeout` is nonzero, it is rather pointless to set `lock_timeout` to the same or larger
value, since the statement timeout would always trigger first."* If both are set, `lock_timeout`
must be the smaller of the two or it never fires.

**★ A plain `SET lock_timeout` inside a migration leaks into the connection pool.** Flyway's
PostgreSQL connection restores only the original role on close, and Boot gives Flyway the
application `DataSource` unless you tell it otherwise. Use `SET LOCAL`, or `RESET` explicitly.

**★ `SET LOCAL` in a non-transactional migration does nothing** but emit a warning. That is exactly
the `CREATE INDEX CONCURRENTLY` case, where you most want a timeout and least have a transaction.

**★ The limit applies *separately to each lock acquisition attempt*.** A migration file with six
`ALTER TABLE` statements can spend six times the timeout waiting before it gives up. The budget is
per statement, not per migration — another reason to keep migration files small.

**★ Setting `lock_timeout` in `postgresql.conf` is explicitly discouraged** — *"not recommended
because it would affect all sessions"*. It belongs on Flyway's connection, not on the cluster, or
you will be aborting the long-running reporting queries you meant to tolerate.

**★ `spring.flyway.init-sqls` maps to a setting Flyway has deprecated.** It works in 12.4.0 and Boot
still exposes it, but the reference page names `afterConnect` as the replacement. Prefer the
callback for anything new, and know why the property exists when you meet it in an old repository.

**★ `initSql` runs on *every* connection Flyway opens, not once per run.** The documentation is
emphatic that it is an "Initial", not an "Initialization", command. Do not put anything expensive or
non-idempotent in it.

**★ A short `lock_timeout` does not make a *slow* statement safe.** It bounds the wait, not the
work. `ALTER COLUMN … TYPE` still rewrites the table once it has the lock, and it holds
`ACCESS EXCLUSIVE` throughout. `lock_timeout` addresses [08b](08b-locks-and-long-migrations.md);
[08b4](08b4-how-long-is-too-long.md) addresses the rest.

**★ Failing the deployment is the good outcome, and it must be treated as one.** If a
`lock_timeout` failure is met with "just re-run the pipeline", you have reintroduced the unbounded
wait one attempt at a time. The correct response is to find the blocker.

## Interview questions

**★ What is the difference between `lock_timeout` and `statement_timeout`?**
`lock_timeout` aborts a statement that has spent too long *waiting to acquire a lock*, and the limit
applies separately to each acquisition attempt. `statement_timeout` aborts a statement that has
spent too long *executing*. A blocked DDL statement is doing the first and none of the second, so
`statement_timeout` alone does not protect you — and if it is the smaller of the two it fires first
and makes `lock_timeout` unreachable.

**★ Where do you set `lock_timeout` for a Flyway migration, and why not in `postgresql.conf`?**
Either as `SET LOCAL lock_timeout` at the top of the migration file, or once for every Flyway
connection via `spring.flyway.init-sqls` or an `afterConnect` callback. Not in `postgresql.conf`,
which the documentation discourages because it applies to every session in the cluster — including
the long analytics queries you actually intend to allow to wait.

**★ Why `SET LOCAL` rather than `SET`?**
`SET` is session-scoped and nothing resets it. Flyway's PostgreSQL connection restores only the
original role when it finishes, and under Spring Boot that connection is normally one of the
application pool's, so the setting returns to the pool and silently applies to unrelated application
queries. `SET LOCAL` reverts at the end of the transaction, on commit and on rollback alike.

**★ You set `SET LOCAL lock_timeout` and it had no effect. What happened?**
The migration was not running in a transaction — either `executeInTransaction` was set to `false`
for it, or it contains a statement PostgreSQL cannot run in a transaction block, such as
`CREATE INDEX CONCURRENTLY`. `SET LOCAL` outside a transaction is a warning and a no-op. Use a plain
`SET` plus an explicit `RESET`.

**★ A migration failed with a lock timeout. What is the correct next action?**
Find and clear the blocker, not re-run the pipeline. Join `pg_locks` to `pg_stat_activity` on the
table, look for the granted row with the oldest `xact_start`, and deal with whatever it is — usually
a session `idle in transaction` or a long report. Re-running blindly puts the same unbounded wait
back in the queue behind whatever is still there.

**★ Does a lock timeout leave a failed row in `flyway_schema_history`?**
On PostgreSQL, no. The statement aborts before any DDL was applied and the migration's transaction
rolls back, and Flyway only writes a `success = false` row when the migration could not be run
transactionally. So the history table is untouched and the next attempt sees the migration as simply
pending.

{/* FOOTER */}
