---
title: "The advisory lock excludes Flyway runs that share a schema history table name and absolutely nothing else — not your DBA's psql session, not the same application deployed into a second schema, and not repair"
sidebar_label: "09c · What the lock does not cover"
sidebar_position: 30
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Flyway 12's `PostgreSQLConnection`, `PostgreSQLAdvisoryLockTemplate`,
> `RetryStrategy`, `FlywayExecutor`, `DbMigrate` and `DbRepair`
> ([github.com/flyway/flyway](https://github.com/flyway/flyway/tree/main/flyway-core/src/main/java/org/flywaydb/core)),
> PostgreSQL 18's *Advisory Locks*
> ([postgresql.org](https://www.postgresql.org/docs/18/explicit-locking.html)) and
> *System Administration Functions*
> ([postgresql.org](https://www.postgresql.org/docs/18/functions-admin.html)),
> and Spring Boot 4.1's `FlywayProperties`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/main/module/spring-boot-flyway/src/main/java/org/springframework/boot/flyway/autoconfigure/FlywayProperties.java)).
> JDK 25, Spring Boot 4.1.1, Flyway 12.4.0, PostgreSQL 18.

**A lock is only as useful as the set of things it excludes, and Flyway's excludes a much narrower
set than its reputation suggests. It is an advisory lock, which PostgreSQL is explicit is not
enforced by the system; its key is derived from one string; and only the `migrate` command takes it
at all. This chunk is the list of things that walk straight past it, and the deployment shape that
stops relying on it.**

## "Advisory" is not a technicality

> *"PostgreSQL provides a means for creating locks that have application-defined meanings. These are
> called advisory locks, because the system does not enforce their use — it is up to the application
> to use them correctly."*

The lock is a number in shared memory. It stops another process that asks about the same number. It
does not stop, and cannot stop:

- a DBA in `psql` running `ALTER TABLE` by hand during your deployment;
- a Liquibase changelog, a jOOQ code-generation script, an ORM's `ddl-auto`, or a Rails migration in
  a sibling service;
- `pg_restore`, a schema sync tool, a managed-database console's "add index" button;
- your own application's runtime SQL.

The only thing on the other side of Flyway's advisory lock is another Flyway `migrate` asking for
the same key. Everything else is your process, not the database's.

## The key is one string, and the string is the history table's name

From [09](09-many-instances-one-database.md), the key is
`"Flyway" + table.toString().hashCode()`, where `table` is the schema history table. That has three
consequences people are routinely surprised by.

**1 · Two applications in one database do not exclude each other.** Service A migrates
`public.flyway_schema_history`; service B, configured with `spring.flyway.table: billing_history` or
running in schema `billing`, migrates a different qualified name and therefore takes a different
lock. Their `migrate()` calls run fully concurrently. That is usually right — they own different
tables — and it is catastrophic in the one case where it is not: two services that both migrate the
same shared table.

**2 · Changing `spring.flyway.table` or the default schema splits the lock domain mid-rollout.** For
the duration of a rolling deployment, the old pods lock on the old name and the new pods lock on the
new one. Neither sees the other. A migration to rename the history table is one of the very few
changes that genuinely needs the fleet scaled to one instance first.

**3 · The default schema is resolved per connection, so the JDBC URL matters.**
`PostgreSQLConnection.doGetCurrentSchema()` reads `current_schema`, falling back to `search_path`, so
a pod started with a different `currentSchema` in its URL uses a different qualified name — a
different history table *and* a different lock. Two halves of one fleet can migrate the same logical
schema in parallel because one half's URL differs.

⚠️ **`String.hashCode()` is 32 bits.** Two different history table names can in principle produce
the same discriminator, in which case two unrelated applications would exclude each other for no
reason. That is a design consequence, not something I have observed; the failure mode is extra
waiting, never corruption, so it is a curiosity rather than a risk.

## Only `migrate` takes the lock

`DbMigrate` is the only command that calls `schemaHistory.lock(…)`. `FlywayExecutor`, the wrapper
every command runs through, sets the retry count and nothing else:

```java
RetryStrategy.setNumberOfRetries(configuration.getLockRetryCount());
```

🔴 **`DbRepair` never locks.** `Flyway.repair()` goes through `flywayExecutor.execute(…)` to
`DbRepair.repair()`, which wraps its three actions in an `ExecutionTemplate` — a transaction, not a
lock. So a `repair` run from a laptop while pods are migrating is not serialised against them at
all. Given what repair does — a real `DELETE` of failed rows, tombstone inserts, and `UPDATE`s of
checksums keyed on `installed_rank` ([04d](04d-what-repair-actually-does.md)) — that is the single
most dangerous unsynchronised operation available to you.

⚠️ Baselining is a partial exception: `baseline` writes through
`JdbcTableSchemaHistory.create(…)`, which *does* take the lock around table creation. The safety
there is incidental to creating the table, not a property of the command.

## The lock survives a crash — sometimes

With the default **transactional** lock, a killed JVM is harmless: the transaction aborts and the
lock is released with it, because *"Transaction-level lock requests … are automatically released at
the end of the transaction"*.

With `spring.flyway.postgresql.transactional-lock: false`, the release is a `finally` block in the
JVM, and a `finally` block does not run on `SIGKILL`. PostgreSQL still cleans up:

> *"`pg_advisory_unlock_all` … Releases all session-level advisory locks held by the current session.
> (This function is implicitly invoked at session end, even if the client disconnects ungracefully.)"*

🔴 **But the session only ends when the server notices.** A backend whose client vanished without a
`FIN` stays alive until it next tries to write to the socket or until TCP keepalives expire, which
on default kernel settings is a long time. So an OOM-killed pod holding a session-level advisory
lock can lock out the rest of the fleet long enough to exhaust every other instance's
`lockRetryCount`. If you have turned the transactional lock off for `CREATE INDEX CONCURRENTLY`
([08a2](08a2-adding-indexes-and-enum-values.md)), you have accepted this.

## `lockRetryCount` is a static field

```java
private static int numberOfRetries = 50;

public static void setNumberOfRetries(final int retries) {
    numberOfRetries = retries;
    unlimitedRetries = (retries < 0);
}
```

`RetryStrategy` holds the setting in a **static**, set at the start of every `FlywayExecutor.execute`.
In an application with two `Flyway` beans over two `DataSource`s
([07 · Boot integration](07-boot-integration.md) and `@FlywayDataSource`), the two configurations
share one static. Whichever executes last wins, and if they ever execute concurrently the value is
whatever the race produced. Configure them identically, or do not rely on the difference.

## The things a lock was never going to solve

**Two code versions migrating at once.** Blue/green and canary rollouts run version N and N+1
together by design. The lock serialises their `migrate()` calls; it does nothing about N+1's `V43`
being applied while N is still serving traffic. That is expand/contract's problem
([08 · Migrating a live service](08-migrating-a-live-service.md)), and Boot's default
`ignore-migration-patterns: ["*:future"]` is what stops the old pods failing `validate` against a
schema that is now ahead of them ([04c](04c-where-the-comparison-does-not-run.md)).

**Two branches choosing the same version number.** Both merge, both produce `V43`, and the lock is
irrelevant because the conflict happened in git. [02c](02c-choosing-version-numbers.md) is where that
lives.

**A migration that is wrong.** Serialisation guarantees it runs once. It does not make it correct,
and because every instance re-reads the history inside the lock, a `success = false` row stops all
of them identically ([09b](09b-what-the-lock-actually-covers.md)).

## The shape that does not need any of this

Stop migrating from N application instances. Run migrations exactly once, as their own step:

```yaml
spring:
  flyway:
    enabled: false
```

and run Flyway from a Kubernetes `Job`, a pipeline stage, or the CLI before the rollout begins.
`FlywayAutoConfiguration` is conditional on `spring.flyway.enabled` with `matchIfMissing = true`, so
this removes the `Flyway` bean and the initializer entirely.

[08b4 · How long is too long](08b4-how-long-is-too-long.md) makes the same recommendation from the
duration side and spells out what you give up: Boot's dependency edge from the
`EntityManagerFactory` to the migration initializer, which is what makes `ddl-auto: validate` an
assertion rather than a race ([07b](07b-validate-not-update.md)). The pipeline has to provide that
ordering instead.

⚠️ **An init container is not the same as a `Job`.** An init container runs on every pod, so you are
back to N concurrent runs — the lock handles it, but you have not removed the dependency on it. A
`Job` runs once.

## Gotchas

**★ The lock is advisory and the documentation says so in its first sentence.** Nothing in
PostgreSQL enforces it. A human with `psql` and DDL privileges is outside it, always.

**★ Two services sharing one database do not exclude each other unless they share a history table
name.** Different `spring.flyway.table` values, or different schemas, mean different lock keys and
fully concurrent migrations.

**★ Renaming the history table splits the lock domain for the length of the rollout.** Old pods lock
on the old name, new pods on the new one, and neither is aware of the other. Scale to one instance
before making that change.

**★ A different `currentSchema` in the JDBC URL is a different lock and a different history table.**
The default schema is resolved from the connection, not from configuration you can read in one
place.

**★ `repair` does not take the lock.** `DbRepair` runs inside a transaction only. Running it against
a database that pods are migrating is unsynchronised, and repair deletes rows, inserts tombstones
and rewrites checksums. Take the fleet out of the migration path first.

**★ `lockRetryCount` lives in a `static` field shared by every Flyway instance in the JVM.** Two
`Flyway` beans over two data sources do not have independent retry budgets.

**★ A session-level lock can outlive the process that took it.** The `finally` that releases it does
not run on `SIGKILL`, and PostgreSQL only reclaims it when it notices the session is gone — which
can take as long as TCP keepalives. This is the cost of `transactional-lock: false`.

**★ You are on `transactional-lock: false` the moment any migration in your history needs
`CREATE INDEX CONCURRENTLY`.** The setting is global to the application, not per migration, so one
concurrent index changes the crash semantics of every deployment thereafter.

**★ The lock does not make a rolling deployment schema-compatible.** It serialises migrations; it
does not stop the new schema reaching the old code. That is entirely
[08](08-migrating-a-live-service.md)'s subject.

**★ The lock does not resolve a version-number collision between branches.** Two `V43` files is a
merge problem, not a concurrency problem.

**★ "It has never gone wrong" is weak evidence here.** The failure needs two instances to reach the
same lock-free window simultaneously, which is rare until the day a slow migration and a large
replica count coincide. Rarity is what makes it a production-only bug.

**★ An init container does not reduce the number of concurrent runs.** Every pod runs it. If the
goal is "migrate once", the mechanism is a `Job` or a pipeline stage, not an init container.

## Interview questions

**★ What exactly does Flyway's advisory lock exclude?**
Another Flyway `migrate` that computes the same lock key — that is, one configured against a schema
history table with the same qualified name. Nothing else. It is an advisory lock, which PostgreSQL
documents as not enforced by the system, so a person or another tool doing DDL concurrently is
entirely outside it.

**★ Two microservices share a PostgreSQL database. Does Flyway stop them migrating at the same
time?**
Only if they use the same history table name in the same schema. The lock key is derived from the
`hashCode()` of the qualified table name, so distinct history tables mean distinct keys and fully
concurrent runs. That is normally desirable — they own different objects — but it means the lock
gives you no protection at all if the two services ever migrate the same table.

**★ Is it safe to run `flyway repair` while the application is deploying?**
No. `DbRepair` runs inside a transaction but never acquires the advisory lock, so it is not
serialised against `migrate` at all. Repair deletes failed rows, inserts `DELETE`-type tombstones
and updates checksums keyed on `installed_rank`; doing that concurrently with a run that is writing
new rows is asking for a history table that describes something that never happened. Stop the
migration path first.

**★ What happens to the lock if the pod holding it is `SIGKILL`ed?**
With the default transaction-level lock, nothing bad: the transaction aborts and the lock goes with
it. With `transactional-lock: false` the JVM's `finally` never runs, and PostgreSQL only releases
session-level advisory locks at session end — which it documents as happening even on an ungraceful
disconnect, but only once it notices, potentially not until TCP keepalives expire. Meanwhile the
rest of the fleet is burning its retry budget.

**★ Why might two Flyway configurations in one application share a retry budget?**
Because `RetryStrategy` stores `numberOfRetries` in a static field, and `FlywayExecutor` sets it
from the configuration at the start of every execution. Two `Flyway` beans over two data sources
therefore write to the same static; the last one to start wins.

**★ Does the lock protect a blue/green deployment?**
Not in the sense people mean. It ensures the two versions' migrations do not run simultaneously, but
the whole point of blue/green is that both versions are live, so the new schema is immediately
visible to the old code. Only expand/contract makes that safe, and Boot's default
`ignore-migration-patterns` of `*:future` is what stops the old instances failing validation against
a schema that has moved ahead of them.

**★ How do you stop depending on the lock altogether?**
Set `spring.flyway.enabled: false` in the application and run migrations once, as their own
pipeline stage or Kubernetes `Job`, before the rollout starts. The cost is Boot's ordering edge:
without the Flyway bean there is no database initializer for the `EntityManagerFactory` to depend
on, so `ddl-auto: validate` no longer implies "migrations ran first". The pipeline has to guarantee
that instead.

**★ Why is an init container not a substitute for a `Job`?**
Because it runs on every pod. You still get N concurrent Flyway runs and you are still relying on
the advisory lock, the retry budget and everything on this page. You have only moved the runs out of
the application process.

{/* FOOTER */}
