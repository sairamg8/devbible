---
title: "Flush sends the SQL; commit ends the transaction — they are different events, they usually happen microseconds apart, and every confusing thing about JPA writes lives in that gap"
sidebar_label: "15 · Flush"
sidebar_position: 29
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §7 *Flushing*, §7.1–§7.4
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)),
> the Hibernate ORM 7.4 *Introduction* §5.10 *Flushing the session*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/))
> and the Jakarta Persistence 3.2 specification §3.2.4 *Synchronization to the Database*
> and the `FlushModeType` javadoc
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**A flush turns the persistence context's pending state changes into `INSERT`, `UPDATE` and
`DELETE` statements and sends them on the current connection. A commit ends the database
transaction. A flush without a commit is a set of statements the database will throw away.
A commit always triggers a flush first, which is why the two look like one event until
something forces them apart — a constraint violation at flush, a query that sees your
unflushed change, or a rollback after the statements already went.**

## What a flush is

The User Guide opens its flushing chapter with the model that makes the rest obvious:

> The persistence context acts as a **transactional write-behind cache**, queuing any
> entity state change. Like any write-behind cache, changes are first applied in-memory and
> synchronized with the database during the flush time. The flush operation takes every
> entity state change and translates it to an `INSERT`, `UPDATE` or `DELETE` statement.

Three things follow immediately.

**Your `persist` call did not insert anything.** It made the instance managed and queued
an insert action. The *Introduction*: "persist() and remove() have no immediate effect on
the database, and instead simply schedule a command for later execution." (`IDENTITY` is
the documented exception — [7 · `@GeneratedValue` and `IDENTITY`](07-generatedvalue-identity.md).)

**Your setter did not update anything either.** It made the entity differ from its
snapshot; the `UPDATE` is produced by the comparison at flush —
[14 · Dirty checking](14-dirty-checking.md).

**Batching is a consequence of the queue, not a feature bolted on.** "Because DML
statements are grouped together, Hibernate can apply batching transparently." Statements
that were never held could not have been batched.

## Flush is not commit

| | Flush | Commit |
|---|---|---|
| what it does | sends queued SQL on the connection | ends the transaction |
| visible to other transactions? | no (subject to isolation) | yes |
| durable? | no | yes |
| can it fail? | yes — constraint violations surface here | yes |
| triggers the other? | no | yes, always flushes first |

The asymmetry in the last row is the whole thing. **Commit implies flush; flush implies
nothing.** So:

```java
entityManager.persist(order);
entityManager.flush();          // INSERT goes to the database now
throw new IllegalStateException();   // rollback → the row is gone
```

The `INSERT` genuinely executed. It was also genuinely undone. A flush buys you *earlier
feedback*, not durability.

That earlier feedback is the main honest reason to call `flush()` by hand: a unique
constraint or a not-null violation that would otherwise surface at commit — outside your
method, wrapped by the transaction infrastructure — surfaces at the line you flushed on,
where you can still catch it and where the stack trace points at your code.

## The four flush modes

Jakarta Persistence defines two. Hibernate defines four, and the *Introduction*'s table
lines them up:

| Hibernate `FlushMode` | JPA `FlushModeType` | Interpretation |
|---|---|---|
| `MANUAL` | — | Never flush automatically |
| `COMMIT` | `COMMIT` | Flush before transaction commit |
| `AUTO` | `AUTO` | Flush before commit, and before a query whose results might be affected by modifications held in memory |
| `ALWAYS` | — | Flush before commit, and before **every** query |

`AUTO` is the default. The User Guide's one-line summaries are worth having verbatim,
because two of them contain warnings:

- **`ALWAYS`** — "Flushes the `Session` before every query." Only available on the native
  `Session` API.
- **`AUTO`** — "This is the default mode, and it flushes the `Session` only if necessary."
- **`COMMIT`** — "The `Session` tries to delay the flush until the current `Transaction` is
  committed, **although it might flush prematurely too**."
- **`MANUAL`** — "The `Session` flushing is delegated to the application, which must call
  `Session.flush()` explicitly in order to apply the persistence context changes."

### `COMMIT` is a hedge, not a guarantee

Two independent sources say so. The specification, quoted in the User Guide: "If
`FlushModeType.COMMIT` is set, the effect of updates made to entities in the persistence
context upon queries is unspecified." And Hibernate's own summary: "although it might flush
prematurely too."

So `COMMIT` buys you a *likely* reduction in flushes at the price of *possibly* stale query
results, and neither half is promised. The *Introduction* is direct about when that trade
is worth taking:

> Since flushing is a somewhat expensive operation (the session must dirty-check every
> entity in the persistence context), setting the flush mode to `COMMIT` can occasionally be
> a useful optimization. But take care — in this mode, queries might return stale data.

"Occasionally" is doing real work in that sentence.

### `MANUAL` — and where you already have it

`MANUAL` means no automatic flush at all: the write only happens if you call `flush()`. The
User Guide's use case is "multi-request logical transactions, and only the last request
should flush the persistence context."

You are almost certainly already using it without choosing it. Spring's
`HibernateJpaDialect` sets `FlushMode.MANUAL` for any `@Transactional(readOnly = true)`
transaction, which is why writes silently do not happen in read-only service methods —
[14f · Turning it off](14f-turning-dirty-checking-off.md).

### Setting it

```java
entityManager.setFlushMode(FlushModeType.COMMIT);            // JPA, session scope
query.setFlushMode(FlushModeType.COMMIT);                    // JPA, one query
session.setHibernateFlushMode(FlushMode.MANUAL);             // Hibernate, session scope
query.setQueryFlushMode(QueryFlushMode.NO_FLUSH);            // Hibernate 7, one query
```

`QueryFlushMode.NO_FLUSH` is the modern per-query form; the *Introduction* introduces it
alongside `FlushModeType.COMMIT` and warns about both together: "Setting the flush mode to
`NO_FLUSH`, `COMMIT`, or `MANUAL` might cause the query to return stale results."

## The statements come out in Hibernate's order, not yours

A flush does not replay your method. It drains an action queue in a fixed order that has
nothing to do with the sequence of calls you made. That is
[15c · Flush operation order](15c-flush-operation-order.md), and it is the source of the
single most confusing exception in this topic — a constraint violation on a `DELETE` you
wrote *before* the `INSERT` that collides with it.

## Where the flush actually happens, in Spring

Nothing in an application typically calls `flush()`. The chain is:

1. Your `@Transactional` method returns.
2. Spring's transaction interceptor calls `commit` on the transaction manager.
3. `JpaTransactionManager` calls `commit` on the `EntityTransaction`.
4. Hibernate flushes as part of that commit, then commits on the JDBC connection.

Two consequences worth holding on to. A constraint violation raised at step 4 is thrown
*after* your method's last line, so it cannot be caught inside the method — see
[topic 04 · 14 · The caught exception](../04-spring-transactional/14-the-caught-exception.md).
And because Spring translates it, what you actually see is a
`DataIntegrityViolationException`, not the JDBC exception —
[topic 05 · 6 · The exception hierarchy](../05-sql-first-access/06-the-exception-hierarchy.md).

## Gotchas

**★ `flush()` does not commit, and calling it to "make sure the data is saved" is
superstition.** A rollback afterwards discards everything it wrote.

**★ `flush()` does not clear.** The entities stay managed and snapshotted, so the next
flush walks them all again. Batching loops need `clear()` too —
[14e · What dirty checking costs](14e-what-dirty-checking-costs.md).

**★ A flush inside a `try` block moves where the exception is thrown, which changes which
`catch` sees it.** That is sometimes the goal and sometimes an accident. If a
`DataIntegrityViolationException` started appearing inside your service instead of at the
boundary, look for a `flush()` or a `saveAndFlush`.

**★ Spring Data's `saveAndFlush` is `save` followed by `flush` on the whole context**, not
a targeted write of that one entity. Everything else pending is written too.

**★ `FlushModeType.COMMIT` does not promise to delay anything.** Both the specification
("unspecified") and Hibernate ("might flush prematurely too") decline to guarantee it.

**★ `ALWAYS` and `MANUAL` do not exist in JPA.** `FlushModeType` has only `AUTO` and
`COMMIT`. Reaching for the other two means unwrapping to `Session`, which ties that code to
Hibernate.

**★ Your read-only service methods are running with `MANUAL`.** Spring sets it. A write
that "did nothing" in a `readOnly = true` method has this as its cause far more often than
anything in the mapping.

**★ An exception from any `EntityManager` method poisons the persistence context.** The
*Introduction*: "a session is considered to be unusable after any of its methods throws an
exception." Catching a flush failure and continuing to use the same `EntityManager` is not
recovery; the transaction must end.

**★ Flushing does not make your changes visible to another transaction.** That is what
commit and the isolation level decide —
[topic 03 · JDBC transactions](../03-jdbc-transactions/README.md).

## Interview questions

**★ What is the difference between `flush` and `commit`?**
`flush` synchronises the persistence context with the database by executing the queued
DML on the current connection. `commit` ends the database transaction and makes the work
durable and visible. Commit always flushes first; flushing never commits.

**★ If I call `flush()` and then the transaction rolls back, what happens to the data?**
It is discarded. The statements really ran, and the rollback really undid them. The only
thing the flush bought was that any constraint violation surfaced at the `flush()` call
rather than at commit.

**★ Why does JPA queue statements instead of executing them immediately?**
Because the persistence context is a write-behind cache. Queuing lets Hibernate order the
statements correctly, batch identical ones, coalesce repeated modifications of the same
entity into one `UPDATE`, and avoid writing at all when a change is reverted before flush.

**★ What are the flush modes and which is the default?**
`AUTO` is the default: flush before commit and before any query whose results the pending
changes could affect. `COMMIT` tries to flush only at commit. Hibernate adds `ALWAYS`
(before every query) and `MANUAL` (never automatically); neither exists in JPA.

**★ Is `FlushModeType.COMMIT` a safe optimisation?**
Only where you can tolerate a query returning stale in-memory-unsynchronised data. The
specification says the effect on queries is "unspecified" and Hibernate says it "might
flush prematurely too", so you get neither a guarantee that it delays nor a guarantee that
your queries see your changes.

**★ Why does an exception sometimes appear after the last line of a `@Transactional`
method?**
Because the flush happens as part of commit, which Spring performs after your method
returns. Constraint violations detected at that point cannot be caught inside the method.
Calling `flush()` explicitly moves the failure earlier, into code you control.

**★ When is calling `flush()` yourself justified?**
When you need the database's verdict — a constraint check, or a database-generated value —
before the method ends; when you need a row present for a subsequent native query or a
`JdbcClient` call in the same transaction; and in batching loops, paired with `clear()`. It
is not justified as reassurance that data is saved.

**★ Why is a session unusable after an exception?**
Because there is no way to resynchronise the persistence context with the database once an
operation has failed part-way. The documentation's instruction is to close and discard the
session immediately and let the transaction roll back.

---

← Prev: [14f · Turning it off](14f-turning-dirty-checking-off.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [15b · What triggers a flush](15b-what-triggers-a-flush.md)
