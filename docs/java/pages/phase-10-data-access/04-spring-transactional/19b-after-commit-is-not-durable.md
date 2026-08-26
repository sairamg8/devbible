---
title: "AFTER_COMMIT runs after the commit, which means a crash in between loses the side effect forever — the outbox is what survives that"
sidebar_label: "19b · After-commit is not durable"
sidebar_position: 52
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Transaction-bound
> events*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/event.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/event.html)),
> the `TransactionSynchronization` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronization.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronization.html))
> and the `Propagation` javadoc
> ([.../transaction/annotation/Propagation.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Propagation.html)).
> The outbox argument below is reasoning about failure windows, not a measured
> claim; nothing here is a benchmark.
> JDK 25, Spring Framework 7.0.8, Spring Boot 4.1.0, PostgreSQL 18.

**`AFTER_COMMIT` guarantees the listener will not run if the transaction failed.
It guarantees nothing about the listener running if the transaction succeeded.
The commit and the side effect are two separate events with a gap between them,
and anything that kills the process in that gap loses the side effect with no
trace.**

## The window

Put the sequence next to each other:

1. The transaction commits. The row is durable.
2. The thread returns from the commit and Spring invokes the `AFTER_COMMIT`
   listeners.
3. The listener publishes to the broker / sends the email / calls the other
   service.

Between 1 and 3 the process can be killed, the pod evicted, the node lost, the
JVM hit by an `OutOfMemoryError`. The order exists and nobody was ever told. There
is no retry, because the thing that would have retried died, and no record that
anything was owed — the event object lived only in memory.

The `TransactionSynchronization` javadoc describes the intended use of this phase
as committing "further operations that are supposed to follow on a successful
commit of the main transaction, like confirmation messages or emails", which is
exactly right and exactly the case with the problem: the message is *supposed* to
follow, and nothing makes it.

It is also not only about crashes. If the broker is unreachable when the listener
runs, the publish throws. The exception is propagated to the caller, but the
transaction has already committed, so all you have achieved is a failed response
for a successful operation — and still no message.

## Why you cannot fix it by moving the publish inside the transaction

The obvious response is to publish *before* the commit, in `BEFORE_COMMIT`, so
that a failure to publish rolls the transaction back. That trades one failure for
its mirror image: now the message can be published and the transaction can still
roll back afterwards — the javadoc warns that `beforeCommit` "does not mean that
the transaction will actually be committed. A rollback decision can still occur
after this method has been called." So the consumer acts on an order that does not
exist.

This is the **dual-write problem**, and it is not solvable by ordering. You have
two systems — a database and a broker — with no shared transaction, and any
sequence of two writes has a window in the middle. Distributed transactions (XA
/ two-phase commit) close the window in theory, at the cost of a coordinator, a
protocol every participant must support, blocking in-doubt states, and operational
complexity that most teams correctly refuse.

## The outbox: make it one write

The trick is to stop writing to two systems. Instead of publishing, the
transaction writes the *intent to publish* into a table in the same database:

```java
@Transactional
public void place(NewOrder cmd) {
    Order order = orderRepository.save(Order.from(cmd));
    outboxRepository.save(OutboxMessage.of("order.placed", order.id()));
}
```

```sql
CREATE TABLE outbox (
    id           bigserial PRIMARY KEY,
    topic        text        NOT NULL,
    payload      jsonb       NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz
);
```

Now there is exactly **one** write, to one system, under one transaction. The
order and the obligation to announce it commit together or not at all. There is no
window, because there is no second participant.

A separate relay then reads unpublished rows, publishes them, and marks them
published. That relay can be a scheduled job in the same application, a separate
process, or a change-data-capture tool reading the write-ahead log. Whichever it
is, it can crash and restart freely: the obligation is in the database, so it is
still there when the relay comes back.

The mechanics of the relay, the schema variations, ordering guarantees and CDC
belong to **Phase 15 — Messaging** *(not written yet)*. What matters here is the
principle and the one property it changes.

## What the outbox actually gives you, and what it does not

It gives you **at-least-once** delivery. The message will be published, eventually,
however many restarts it takes.

It does not give you exactly-once, and it cannot. The relay can publish a message
and die before marking the row published; on restart it publishes again. So
**every consumer must be idempotent** — keyed on a message id or on the business
key, so that handling the same message twice is the same as handling it once. That
requirement is not a defect of the outbox; it is the honest price of not running a
distributed transaction, and any design claiming exactly-once without a
coordinator is hiding it rather than avoiding it.

It also costs a table, a relay, a little write amplification on every transaction,
and latency between the commit and the publish. For a confirmation email that
latency is invisible. For something a user is watching for, it is a design
constraint.

## When `AFTER_COMMIT` on its own is the right answer

The outbox is not the default. `AFTER_COMMIT` alone is correct whenever losing the
side effect is acceptable:

- **Cache invalidation** where the cache has a TTL, so a missed invalidation
  self-heals.
- **Metrics and analytics events**, where a lost sample does not matter.
- **Best-effort notifications** that the user can trigger again.
- **Anything reconstructible** from the committed data by a later job.

The question to ask is precise: *if this side effect never happens, and nobody is
told, what breaks?* If the answer is "nothing important", use `AFTER_COMMIT` and
move on. If the answer is "a payment is never captured" or "another service never
learns the order exists", it needs the outbox.

And a listener that writes to **this** database is a separate case again: it does
not need an outbox, it needs `REQUIRES_NEW` (see
[19 · Transactional events](19-transactional-events.md)) — or, better, to be part
of the original transaction in the first place, because if it belongs in the same
database it probably belongs in the same unit of work.

## The trade-off

`AFTER_COMMIT` is one annotation and no infrastructure. The outbox is a table, a
relay, a monitoring concern (how many unpublished rows are there, and how old is
the oldest?), a cleanup job, and idempotent consumers.

That is a large amount of machinery, and it is why the pattern should be applied
to the handful of side effects that genuinely must not be lost rather than to
every event in the system. The failure mode of over-applying it is an application
where every trivial notification carries a distributed-systems tax; the failure
mode of under-applying it is a silently missing payment. Both are real, and the
line between them is the question in the previous section.

## Gotchas

**⚠️ Treating `AFTER_COMMIT` as a delivery guarantee**
**Symptom:** occasional missing messages that correlate with deploys or restarts.
**Cause:** the listener runs after the commit, in memory, with no record of the
obligation. A crash in the gap loses it.
**Fix:** the outbox for anything that must not be lost. For everything else,
decide explicitly that loss is acceptable.

**⚠️ Publishing to the broker in `BEFORE_COMMIT` to make it atomic**
**Symptom:** consumers acting on entities that do not exist.
**Cause:** the transaction can still roll back after `beforeCommit` runs — the
javadoc says so directly.
**Fix:** this is the mirror-image bug, not a fix. Write the intent to the database
instead.

**⚠️ Believing an outbox gives exactly-once**
**Symptom:** duplicate side effects — two emails, two charges — under retry.
**Cause:** the relay can publish and then fail before marking the row, so it
republishes on restart. At-least-once is what the pattern provides.
**Fix:** make consumers idempotent, keyed on the message id or the business key.
This is a requirement, not an optimisation.

**⚠️ No monitoring on the outbox table**
**Symptom:** a relay that has been dead for a day, discovered by a customer.
**Cause:** the pattern moves the failure from "message lost" to "message pending",
which is strictly better *and* invisible unless someone looks.
**Fix:** alert on the count and the age of unpublished rows. The oldest
unpublished row is the single most useful number.

**⚠️ No cleanup for published rows**
**Symptom:** an outbox table that becomes the largest table in the database.
**Cause:** rows are inserted on every business transaction and never removed.
**Fix:** delete or archive published rows on a schedule. On PostgreSQL, watch the
bloat: a high-churn table needs its autovacuum settings looked at.

**⚠️ `fallbackExecution = true` on a listener whose whole point was the commit**
**Symptom:** confirmation emails for orders that were never created.
**Cause:** the flag makes the listener run when there is no transaction, which is
precisely the case the default was protecting you from.
**Fix:** use it only where running without a transaction is meaningful. If you set
it to make a test pass, fix the test instead — give the test a transaction.

**⚠️ Publishing the event before the state it describes exists**
**Symptom:** an `AFTER_COMMIT` listener that sees a null id or stale data.
**Cause:** ordering inside the method. The *listener* is deferred; the event's
payload is captured where you call `publishEvent`.
**Fix:** publish after the state the listener needs is established.

**⚠️ Reaching for XA because the outbox sounds like work**
**Symptom:** a two-phase-commit setup nobody can operate.
**Cause:** XA does close the window, and on paper it is less code.
**Fix:** count the cost honestly — a coordinator to run, every participant needing
XA support, in-doubt transactions holding locks when the coordinator is
unreachable, and a recovery procedure someone has to know. For a single database
plus a broker, the outbox is the smaller system.

## Interview questions

**★ `AFTER_COMMIT` guarantees the listener runs only if the transaction
committed. Does it guarantee the listener runs?**
No, and that asymmetry is the whole point. The commit and the listener are two
separate steps with a gap between them; anything that kills the process in that
gap — a deploy, an eviction, an OOM — loses the side effect entirely, because the
event existed only in memory and nothing recorded that it was owed. It is a
correct *ordering* guarantee and not a delivery guarantee.

**★ Why not publish in `BEFORE_COMMIT` so a publish failure rolls the transaction
back?**
Because it swaps the failure for its mirror image. The javadoc is explicit that
`beforeCommit` "does not mean that the transaction will actually be committed. A
rollback decision can still occur after this method has been called." So you can
publish successfully and then roll back, leaving consumers acting on an entity
that does not exist. There is no ordering of two writes to two systems that has no
window; that is the dual-write problem, and it is why the answer is to stop making
two writes.

**★ Explain the transactional outbox in one paragraph.**
Instead of writing to the database and then publishing to the broker, the
transaction writes both the business change and a row describing the message to
send into the same database, in the same transaction. There is now one write to
one system, so they commit together or not at all and there is no window. A
separate relay reads unpublished rows, publishes them, and marks them published;
it can crash and restart freely because the obligation is durable. The result is
at-least-once delivery with no distributed transaction and no coordinator.

**★ What does the outbox require of consumers?**
Idempotency. The relay can publish a message and fail before recording that it
did, so on restart it publishes again — at-least-once is the guarantee, and
exactly-once is not available without a coordinator. Consumers therefore have to
be safe to run twice on the same message, keyed on a message id or on the business
key. Any design that claims exactly-once delivery over a plain broker is hiding
that requirement rather than removing it.

**★ When would you *not* use an outbox?**
Whenever losing the side effect is acceptable, which is more often than people
expect: cache invalidation behind a TTL, metrics, analytics events, best-effort
notifications the user can retrigger, and anything a later job can reconstruct
from the committed data. The test is to ask what breaks if the side effect never
happens and nobody is told. The outbox costs a table, a relay, monitoring, cleanup
and idempotent consumers, and applying that tax to every notification in a system
is its own kind of failure.

**★ A listener needs to write to the same database. Outbox or not?**
Not — that is a different problem. Writing to the same database from an
`AFTER_COMMIT` listener needs `REQUIRES_NEW`, because the transactional resources
are still bound with no commit following, so a plain write silently vanishes. But
the better question is why it is in a listener at all: if the write belongs to the
same database, it can usually belong to the same transaction, which is simpler and
actually atomic. The outbox exists for the case where the other side is a
*different* system.

**★ What would you monitor once an outbox is in place?**
The age of the oldest unpublished row, above everything else — it is one number
that detects a dead relay, a broker outage and a poison message all at once. Then
the count of unpublished rows, to see backlog growth, and the table's size and
bloat, because it takes an insert per business transaction and needs a cleanup or
archive job. The pattern converts "messages are being lost" into "messages are
pending", which is a much better failure — but only if somebody is looking at it.

---

← Prev: [19 · Transactional events](19-transactional-events.md) · Index: [04 · Spring @Transactional](README.md) · Next → [20 · Transactions in tests](20-transactions-in-tests.md)
