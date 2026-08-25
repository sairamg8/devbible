---
title: "The only thing that reliably bounds a runaway transaction is the database, because it is the participant no application code can bypass"
sidebar_label: "17b · What actually bounds it"
sidebar_position: 47
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the PostgreSQL 18 manual *Client Connection Defaults*
> ([postgresql.org/docs/18/runtime-config-client.html](https://www.postgresql.org/docs/18/runtime-config-client.html)),
> the `TransactionTimedOutException` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionTimedOutException.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/TransactionTimedOutException.html)),
> the `DataSourceTransactionManager` javadoc
> ([.../jdbc/datasource/DataSourceTransactionManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceTransactionManager.html))
> and the HikariCP README
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)).
> JDK 25, Spring Framework 7.0.8, HikariCP 7.0.2, pgjdbc 42.7.13, PostgreSQL 18.

**Spring's `timeout` attribute is enforced at points Spring controls, which means
application code can walk around it without trying. The server's timeouts are
enforced against the session, so nothing in the JVM can evade them. Every
production system wants both, and they do different jobs.**

## Four PostgreSQL settings, and what each one actually kills

All four default to zero, which disables them. All four take milliseconds when no
unit is given. And PostgreSQL says the same thing about three of them: setting
them in `postgresql.conf` "is not recommended because it would affect all
sessions" — they belong on a role, a database, or a session.

**`statement_timeout`** — the workhorse.

> Abort any statement that takes more than the specified amount of time.

> The timeout is measured from the time a command arrives at the server until it
> is completed by the server. If multiple SQL statements appear in a single
> simple-query message, the timeout is applied to each statement separately.

This is the one that bounds a single runaway query, and it is the server-side
twin of what Spring pushes down as a JDBC statement timeout. The difference is
that the server applies it to *every* statement in the session, including ones
from a raw connection Spring never saw.

**`lock_timeout`** — waiting, specifically.

> Abort any statement that waits longer than the specified amount of time while
> attempting to acquire a lock on a table, index, row, or other database object.
> The time limit applies separately to each lock acquisition attempt.

And a piece of tuning advice from the manual itself:

> Note that if `statement_timeout` is nonzero, it is rather pointless to set
> `lock_timeout` to the same or larger value, since the statement timeout would
> always trigger first.

`lock_timeout` earns its place when you want to fail fast on contention while
still allowing slow-but-progressing queries — a migration that must not block
writers, for example.

**`idle_in_transaction_session_timeout`** — the one that saves your database.

> Terminate any session that has been idle (that is, waiting for a client query)
> within an open transaction for longer than the specified amount of time.

This is the setting that catches the pattern this whole topic keeps warning about:
a transaction left open while the application does something slow that is not a
query. The manual explains why it matters beyond lock-holding:

> Even when no significant locks are held, an open transaction prevents vacuuming
> away recently-dead tuples that may be visible only to this transaction; so
> remaining idle for a long time can contribute to table bloat.

Note the verb: **terminate the session**, not abort the statement. The connection
is killed, and the pool has to notice and replace it.

**`transaction_timeout`** — the total span.

> Terminate any session that spans longer than the specified amount of time in a
> transaction. The limit applies both to explicit transactions (started with
> `BEGIN`) and to an implicitly started transaction corresponding to a single
> statement.

This is the closest server-side analogue of Spring's `@Transactional(timeout =
…)`, and unlike Spring's it cannot be bypassed. Two details from the manual:

> If `transaction_timeout` is shorter or equal to
> `idle_in_transaction_session_timeout` or `statement_timeout` then the longer
> timeout is ignored.

> Prepared transactions are not subject to this timeout.

## Which to reach for

| Failure | Setting | Effect |
|---|---|---|
| one query scanning far too much | `statement_timeout` | aborts that statement |
| a query stuck behind a lock | `lock_timeout` | aborts that statement, faster |
| a transaction open while the app does something slow | `idle_in_transaction_session_timeout` | terminates the session |
| a transaction that is simply too long, however it got there | `transaction_timeout` | terminates the session |
| a diagnostic naming the transaction rather than the socket | Spring `timeout` | `TransactionTimedOutException` |

The pairing that covers most systems is a `statement_timeout` on the application
role, an `idle_in_transaction_session_timeout` a little larger than any legitimate
transaction, and Spring `timeout` on the operations where a specific, shorter
bound is meaningful.

Set the server-side ones on the **role** the application connects as, so they
apply to every session it opens without touching migrations, admin tools or
analytics users:

```sql
ALTER ROLE app_service SET statement_timeout = '10s';
ALTER ROLE app_service SET idle_in_transaction_session_timeout = '30s';
```

## What the connection pool contributes, and what it does not

HikariCP's `connectionTimeout` is frequently confused with a transaction timeout.
It is not one:

> This property controls the maximum number of milliseconds that a client (that's
> you) will wait for a connection from the pool. If this time is exceeded without
> a connection becoming available, a `SQLException` will be thrown.

It bounds *waiting to borrow*, not using. A thread that has already borrowed a
connection and started a transaction is past this check entirely. So
`connectionTimeout` is the setting that turns pool exhaustion into a fast failure
rather than a hang — valuable, and unrelated to how long a transaction may run.

The relationship worth internalising: a long transaction holds a pooled connection
for its whole duration. Every other thread is then waiting on
`connectionTimeout`. That is why an unbounded transaction is not a local problem —
it converts into failures in code that has nothing to do with it.

## A JTA aside

Everything above assumes local transactions. Under JTA the picture changes, and
the `TransactionTimedOutException` javadoc says so:

> In a JTA environment, it is up to the JTA transaction coordinator to apply
> transaction timeouts. Usually, the corresponding JTA-aware connection pool will
> perform timeout checks and throw corresponding native resource exceptions (for
> example, JDBC `SQLException`s).

## The trade-off

Server-side timeouts are unbypassable, which is exactly what makes them
uncomfortable: they will eventually kill something legitimate. A nightly report
that grew past `statement_timeout`, a migration that needs a long lock, a batch
job that was fine last quarter. The failures are abrupt and arrive as driver
exceptions rather than as anything the application chose.

The alternative is worse and less visible. Without them, one slow query holds one
connection, that connection is not returned, other threads queue on
`connectionTimeout`, and a single bad query plan becomes an outage. Set them at a
value that is comfortably above any legitimate work, give long-running jobs a
different role with different settings, and treat a timeout in production as a
signal to investigate rather than a limit to raise.

## Gotchas

**⚠️ Assuming a Spring timeout protects the connection pool**
**Symptom:** pool exhaustion under load despite `@Transactional(timeout = …)`
everywhere.
**Cause:** the connection is held for the whole transaction; the Spring timeout
only governs when Spring will refuse the *next* operation.
**Fix:** keep blocking work out of the transaction, and set
`idle_in_transaction_session_timeout` so the database enforces what the code did
not.

**⚠️ `statement_timeout` set in `postgresql.conf`**
**Symptom:** backups, migrations and analytics queries start failing.
**Cause:** the manual warns against it precisely because it affects all sessions.
**Fix:** set it per role, per database or per session, so the application's limit
does not become everyone's.

**⚠️ `lock_timeout` set to the same value as `statement_timeout`**
**Symptom:** `lock_timeout` never fires.
**Cause:** the manual — with a nonzero `statement_timeout`, "the statement timeout
would always trigger first".
**Fix:** make `lock_timeout` meaningfully smaller, or do not set it.

**⚠️ Confusing `connectionTimeout` with a transaction or query timeout**
**Symptom:** an expectation that HikariCP will bound how long a transaction runs.
**Cause:** `connectionTimeout` is how long a caller waits to *borrow* a
connection. Once borrowed, it is out of the picture.
**Fix:** three distinct settings, three distinct jobs: borrow wait, statement
duration, transaction span.

**⚠️ `transaction_timeout` set below the other two and expecting all three to
apply**
**Symptom:** a session killed by the transaction timeout while an intended
statement timeout appears not to work.
**Cause:** documented behaviour — "If `transaction_timeout` is shorter or equal
to `idle_in_transaction_session_timeout` or `statement_timeout` then the longer
timeout is ignored."
**Fix:** order them deliberately, shortest first for the narrowest scope.

**⚠️ Expecting `idle_in_transaction_session_timeout` to abort a statement**
**Symptom:** a long-running query survives a short idle timeout.
**Cause:** *idle* means waiting for the client. A session executing a query is not
idle.
**Fix:** `statement_timeout` bounds execution; the idle timeout bounds the gaps.

**⚠️ Raising a timeout because it fired**
**Symptom:** limits that grow every quarter and eventually protect nothing.
**Cause:** a timeout firing is information about the workload, not about the
limit.
**Fix:** investigate what got slower. Raise the limit only when the longer
duration is genuinely correct — and if it is correct for one job, give that job
its own role.

**⚠️ Forgetting that an idle-in-transaction kill destroys the connection**
**Symptom:** a burst of connection errors in the application after a timeout, not
a single clean exception.
**Cause:** the setting terminates the session rather than aborting a statement, so
the pooled connection is dead and the pool must detect and replace it.
**Fix:** nothing to fix, but expect the failure to look like a connection problem
rather than a timeout, and do not chase the pool for it.

## Interview questions

**★ Spring's transaction timeout can be bypassed. What cannot be?**
The database's own settings, because they are enforced by the server against the
session rather than by the framework at points the framework controls. On
PostgreSQL that is `statement_timeout` for the duration of a single statement,
`lock_timeout` for lock waits, `idle_in_transaction_session_timeout` for a
transaction sitting open while the client does something else, and
`transaction_timeout` for the total span. Application code can obtain a raw
connection, hand-build a statement and skip every Spring check; it cannot skip
these.

**★ What is the difference between `statement_timeout` and
`idle_in_transaction_session_timeout`?**
`statement_timeout` aborts a statement that has been *executing* too long; the
session survives and the client gets an error. `idle_in_transaction_session_timeout`
terminates the whole session when it has been *idle inside an open transaction* —
that is, the server is waiting for the client to send something. They cover
opposite failures: one is the database working too hard, the other is the
application not coming back. The second is the one that catches an HTTP call made
inside a transaction, and the manual points out it also matters for vacuuming,
because an open transaction blocks cleanup of recently-dead tuples and contributes
to bloat.

**★ Where would you set these, and why not in `postgresql.conf`?**
On the role the application connects as, with `ALTER ROLE … SET`. The manual
recommends against `postgresql.conf` for `statement_timeout`, `lock_timeout` and
`transaction_timeout` on the grounds that it would affect all sessions — which
would mean migrations, backups, analytics queries and psql sessions inherit limits
chosen for request handling. Per-role settings give the application a tight bound
and let a batch or reporting role have a different one.

**★ Is HikariCP's `connectionTimeout` a transaction timeout?**
No. It is the maximum time a caller will wait *to obtain* a connection from the
pool before a `SQLException` is thrown — the README's own wording is "the maximum
number of milliseconds that a client (that's you) will wait for a connection from
the pool". Once a thread has a connection, the setting is irrelevant to how long
it keeps it. Its real value is turning pool exhaustion into a prompt failure
instead of an unbounded hang, which is a different and complementary job.

**★ How do a long transaction and pool exhaustion connect?**
Directly, and it is the mechanism behind a lot of outages. A transaction holds its
connection for its entire duration, so a transaction that blocks on something slow
removes a connection from the pool for that long. With enough concurrent requests
doing the same, the pool empties, and every other thread — including ones running
fast, correct code — starts failing on `connectionTimeout`. The failure surfaces
far from its cause, which is why the discipline of keeping slow work out of
transactions matters more than any individual timeout setting.

**★ You inherit a service with no timeouts anywhere. What do you set first?**
`statement_timeout` and `idle_in_transaction_session_timeout` on the application's
database role, at values comfortably above anything legitimate — because they are
one command each, cannot be bypassed, and immediately convert the two worst
unbounded failures into ordinary errors. Then HikariCP's `connectionTimeout`, so
exhaustion fails fast rather than hanging. Spring's per-method `timeout` comes
last: it is the most precise and the most useful diagnostic, but it is also the
one that requires the code to be well-behaved to mean anything, and on an
unfamiliar codebase that is the assumption I would trust least.

---

← Prev: [17 · Timeouts](17-timeouts.md) · Index: [Spring @Transactional](README.md) · Next → [18 · Threads and @Async](18-threads-and-async.md)
