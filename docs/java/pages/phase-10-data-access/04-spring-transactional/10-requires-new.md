---
title: "REQUIRES_NEW starts a genuinely separate transaction on a second connection, and Spring's own documentation states the arithmetic that stops it deadlocking your pool"
sidebar_label: "10 · REQUIRES_NEW"
sidebar_position: 26
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Transaction
> propagation*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html))
> and the `Propagation` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html)),
> and `JpaTransactionManager.doSuspend` / `doResume` in the Spring Framework source
> ([github.com/spring-projects/spring-framework/.../orm/jpa/JpaTransactionManager.java](https://github.com/spring-projects/spring-framework/blob/main/spring-orm/src/main/java/org/springframework/orm/jpa/JpaTransactionManager.java)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, HikariCP 7.0.2,
> PostgreSQL 18.

**`REQUIRES_NEW` is the propagation that does what people already believed
`@Transactional` did: it starts a real, separate transaction that commits or rolls
back on its own. It is also the propagation most likely to take an application
down, because a separate transaction needs a **second connection** while the first
is still held — and Spring's documentation states the pool-sizing rule that
follows, in a sentence worth memorising verbatim. This chunk is the mechanism and
the cost; [chunk 10b](10b-when-requires-new-is-right.md) is when to pay it.**

## What it actually does

The `Propagation` javadoc, in full:

> *"Create a new transaction, and suspend the current transaction if one exists.
> Analogous to the EJB transaction attribute of the same name."*
>
> ***"NOTE:** Actual transaction suspension will not work out-of-the-box on all
> transaction managers. This in particular applies to `JtaTransactionManager`,
> which requires the `jakarta.transaction.TransactionManager` to be made available
> to it (which is server-specific in standard Jakarta EE)."*

And the reference, on the semantics:

> *"`PROPAGATION_REQUIRES_NEW`, in contrast to `PROPAGATION_REQUIRED`, always uses
> an independent physical transaction for each affected transaction scope, never
> participating in an existing transaction for an outer scope. In such an
> arrangement, the underlying resource transactions are different and, hence, can
> commit or roll back independently, with an outer transaction not affected by an
> inner transaction's rollback status and with an inner transaction's locks
> released immediately after its completion. Such an independent inner transaction
> can also declare its own isolation level, timeout, and read-only settings and
> not inherit an outer transaction's characteristics."*

Four things in that paragraph, each of them the opposite of `REQUIRED`:

| | `REQUIRED` | `REQUIRES_NEW` |
|---|---|---|
| physical transactions | one | **two** |
| connections | one | **two** |
| inner failure affects outer | yes — marks it rollback-only | **no** |
| inner locks released | at the outermost commit | **immediately on inner completion** |
| inner isolation / timeout / read-only | ignored | **honoured** |

```
outer          BEGIN #1 ──────────────────────── suspended ──────── COMMIT #1
                  connection A held throughout          ▲
  └── inner              BEGIN #2 ── COMMIT #2 ──────────┘
                            connection B
```

🔴 **"Suspend" does not mean "release".** The outer transaction's connection stays
checked out of the pool for the whole time the inner transaction runs. That is the
entire source of the danger below, and it has costs beyond the pool —
[chunk 10c](10c-what-suspension-costs.md) is what the database is still holding
while Spring calls the transaction suspended.

## The warning, verbatim

The reference states the failure and the rule in one paragraph:

> *"The resources attached to the outer transaction will remain bound there while
> the inner transaction acquires its own resources such as a new database
> connection. This may lead to exhaustion of the connection pool and potentially
> to a deadlock if several threads have an active outer transaction and wait to
> acquire a new connection for their inner transaction, with the pool not being
> able to hand out any such inner connection anymore. **Do not use
> `PROPAGATION_REQUIRES_NEW` unless your connection pool is appropriately sized,
> exceeding the number of concurrent threads by at least 1.**"*

## Why it deadlocks — the arithmetic

Take a pool of 10 connections and 10 request threads, each running an outer
`@Transactional` method that calls a `REQUIRES_NEW` method.

1. All 10 threads enter their outer transaction. Each takes one connection.
   **Pool: 0 free.**
2. All 10 threads reach the inner call and ask for a second connection.
3. There are none. Every thread blocks, holding the connection the others need.
4. Nothing can complete, because completing requires the second connection, and
   the second connection requires somebody to complete.

**Nobody has done anything wrong. There is no bug in any thread.** The deadlock is
purely a consequence of every participant holding one resource while waiting for
another — the textbook circular wait, arrived at by ordinary code.

The rule "exceeding the number of concurrent threads by at least 1" is the escape:
with 11 connections and 10 threads, one thread always gets its second connection,
completes, releases both, and the queue drains.

⚠️ **"Concurrent threads" means threads that can be inside an outer transaction at
once** — the servlet thread pool, the `@Async` executor, the scheduler pool, added
together. Not the number of CPU cores, and not the pool size. The general form of
this arithmetic — the pool size below which deadlock is possible, given how many
connections one thread holds at once — is
[Topic 02 · 3 · The deadlock floor](../02-connection-pooling/03-the-connection-budget.md);
this is the specific case where a single annotation adds one to every thread's
requirement.

🔴 **Nesting `REQUIRES_NEW` twice makes it three per thread.** The requirement is
not "pool > threads"; it is "pool > threads × (maximum simultaneously-held
connections per thread)", and each `REQUIRES_NEW` in a call chain adds one.

## The trade-off

`REQUIRES_NEW` is the only propagation that gives an inner method a genuine
guarantee about its own transaction — its own isolation, its own timeout, its own
commit, immune to the outer scope's fate. Everything else in this chunk is the
price of that guarantee. **Two connections per thread, an outer transaction held
open while a second one runs, and a pool-sizing rule that turns a wrong
configuration into a deadlock rather than a slowdown.** The independence is real
and so is the cost; the mistake is taking the first without pricing the second.
[Chunk 10b](10b-when-requires-new-is-right.md) is where the price is worth
paying and the three places it usually is not.

## Gotchas

**⚠️ Adding `REQUIRES_NEW` and not resizing the pool**
**Symptom:** the application works in testing and hangs under load, with threads
blocked in `getConnection`.
**Cause:** every thread now needs two connections and the pool has one per
thread.
**Fix:** the documented rule — the pool must exceed the number of concurrent
threads by at least 1.

**⚠️ Counting only servlet threads**
**Symptom:** the pool is sized to the web thread pool and the deadlock happens
anyway, at a quiet time.
**Cause:** scheduled jobs and `@Async` executors have their own threads and their
own outer transactions.
**Fix:** count every pool that can be inside an outer transaction concurrently.

**⚠️ Two levels of `REQUIRES_NEW`**
**Symptom:** the same deadlock on a pool sized correctly for one level.
**Cause:** each nesting level adds a connection per thread.
**Fix:** the multiplier is per-thread maximum simultaneous connections, not a
constant.

**⚠️ Expecting the inner transaction to see the outer one's uncommitted work**
**Symptom:** an inner method cannot find a row the outer method just inserted.
**Cause:** they are separate transactions on separate connections; the outer
one's writes are uncommitted and invisible at any isolation level below read
uncommitted, which PostgreSQL does not implement anyway.
**Fix:** pass the data as arguments. This is the most common functional surprise
with `REQUIRES_NEW`, as opposed to the operational one.

**⚠️ Two transactions taking the same row lock**
**Symptom:** a self-deadlock — one thread, blocked forever, waiting for a lock it
holds in its own suspended transaction.
**Cause:** the outer transaction locked a row; the inner transaction, on a
different connection, asks for the same lock; the outer cannot release it because
it is waiting for the inner to finish.
**Fix:** never touch the same rows from an inner `REQUIRES_NEW` transaction. This
one deadlocks with a pool of any size.

**⚠️ Using it with a transaction manager that cannot suspend**
**Symptom:** an exception, or behaviour that is not what the annotation says.
**Cause:** the javadoc's note — suspension "will not work out-of-the-box on all
transaction managers", in particular `JtaTransactionManager` without a
`jakarta.transaction.TransactionManager`.
**Fix:** confirm suspension support before relying on it in a JTA environment.

**⚠️ Self-invoking a `REQUIRES_NEW` method**
**Symptom:** one transaction where two were expected, and no error.
**Cause:** the annotation was never read — [chunk 3](03-the-self-invocation-trap.md).
**Fix:** the propagation is irrelevant if the proxy was bypassed. Check
reachability first.

## Interview questions

**★ What does `REQUIRES_NEW` do, and how is it different from `REQUIRED`?**
It always starts an independent physical transaction, suspending any existing one
rather than joining it. The reference's summary is that "the underlying resource
transactions are different and, hence, can commit or roll back independently,
with an outer transaction not affected by an inner transaction's rollback status
and with an inner transaction's locks released immediately after its completion",
and that the inner transaction "can also declare its own isolation level, timeout,
and read-only settings and not inherit an outer transaction's characteristics".
So it inverts every one of `REQUIRED`'s properties: two physical transactions
instead of one, two connections instead of one, independent commit outcomes
instead of a shared fate, locks released early instead of at the outer boundary,
and its own settings honoured instead of silently discarded.

**★ Why can `REQUIRES_NEW` deadlock a connection pool?**
Because suspending the outer transaction does not release its connection. The
reference is explicit: "the resources attached to the outer transaction will
remain bound there while the inner transaction acquires its own resources such as
a new database connection". So each thread inside an outer transaction that calls
a `REQUIRES_NEW` method holds one connection and needs a second. With a pool of
ten and ten concurrent threads, all ten take their outer connection, all ten ask
for an inner one, none is available, and every thread is blocked holding exactly
what the others need — a circular wait produced by entirely correct code. The
documented rule is the escape: "do not use `PROPAGATION_REQUIRES_NEW` unless your
connection pool is appropriately sized, exceeding the number of concurrent threads
by at least 1", because one spare connection lets one thread finish and the queue
drain.

**★ Can the inner transaction see uncommitted work from the outer one?**
No. They are separate transactions on separate connections and separate database
sessions, so the outer transaction's uncommitted writes are invisible to the inner
one at any isolation level a real database offers — PostgreSQL's manual notes that
its "Read Uncommitted mode behaves like Read Committed", so there is not even a
setting that would expose them. This is the most common *functional* surprise with
`REQUIRES_NEW`, as distinct from the operational one: an inner method that queries
for a row the outer method just inserted finds nothing. The fix is to pass the
data as arguments rather than expecting it to be readable, and the deeper point is
that "independent transaction" means independent in both directions — it cannot
see your work and you cannot roll back its work.

**★ Is there a deadlock `REQUIRES_NEW` can cause that a bigger pool will not
fix?**
Yes, and it is worse than the pool one because it involves a single thread. If the
outer transaction has taken a row lock and the inner `REQUIRES_NEW` transaction
asks for the same lock, the inner one waits — on a different connection, in a
different session — for a lock that the outer transaction holds and cannot
release, because the outer transaction is suspended waiting for the inner to
complete. One thread, deadlocked with itself, and no pool size helps. The database
will usually time out or detect it eventually, but the arrangement is simply
wrong. The rule that avoids it is that an inner `REQUIRES_NEW` transaction must
not touch rows the outer transaction has modified — which is another reason the
safe uses are all appends to a separate table.

**★ What does "suspend" mean, mechanically, and why is it not "release"?**
Suspending an outer transaction means the manager unbinds its resources from the
thread and stashes them in a suspended-resources holder, so that the inner
transaction can bind its own connection to the same thread without collision.
When the inner transaction completes, the outer resources are restored. What
does **not** happen is that the outer connection goes back to the pool — the
outer transaction still has uncommitted work on it, statements already executed
and locks already held, so returning it would destroy the transaction. That is
the whole reason the pool arithmetic exists: suspension is a thread-binding
operation, not a resource-release operation, and Spring says so directly —
"the resources attached to the outer transaction will remain bound there while
the inner transaction acquires its own resources".

**★ How would you size a pool for an application that uses `REQUIRES_NEW`?**
Start from the documented floor: the pool must exceed the number of concurrent
threads by at least one. Then correct the two things people get wrong about that
sentence. "Concurrent threads" is not the servlet pool alone — it is every thread
pool whose threads can be inside an outer transaction at the same moment, so the
web container's pool plus the `@Async` executor plus the scheduler, added
together. And "by at least one" assumes a single level of nesting; each further
`REQUIRES_NEW` in a call chain adds another simultaneously-held connection per
thread, so the real requirement is the pool exceeding threads multiplied by the
maximum number of connections one thread can hold at once. Sizing against that
number is the difference between a slow application and one that stops entirely,
because the failure mode is a deadlock rather than queueing.


**★ You use `REQUIRES_NEW` with JPA. What happens to the persistence context?**
The inner transaction gets a different one, and that surprises people more than
the second connection does. `JpaTransactionManager.doSuspend` unbinds the
`EntityManagerHolder` from the thread —
`TransactionSynchronizationManager.unbindResource(obtainEntityManagerFactory())`
— along with the `ConnectionHolder` for the `DataSource` if one is bound, and
returns both in a `SuspendedResourcesHolder`; `doResume` binds them back. So the
inner method runs against a fresh `EntityManager` with an empty first-level cache.
Entities the outer method loaded are not managed there. Loading the same row
inside gives a second, distinct Java object, read through the second transaction's
snapshot, which cannot see the outer transaction's uncommitted work — flushed or
not. The sharp edge is passing a *managed* entity into the `REQUIRES_NEW` method
and calling `save` on it: that merges the object's current in-memory state,
including edits the outer transaction has not committed and may yet roll back,
into the inner persistence context, which then commits them independently. The
outer rollback leaves them durably written. The rule that avoids all of it is to
pass identifiers and immutable values across a `REQUIRES_NEW` boundary, never a
managed entity.

---

← Prev: [9b · Fixing the rollback-only trap](09b-fixing-the-rollback-only-trap.md) · Index: [04 · Spring @Transactional](README.md) · Next → [10b · When REQUIRES_NEW is right](10b-when-requires-new-is-right.md)
