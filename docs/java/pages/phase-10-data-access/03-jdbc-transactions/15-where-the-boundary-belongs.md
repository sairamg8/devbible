---
title: "A transaction's length is a concurrency budget you are spending on behalf of everybody else"
sidebar_label: "15 · Where the boundary belongs"
sidebar_position: 26
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 manual §13.2.3 *Serializable
> Isolation Level* and its performance recommendations
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html)),
> §13.3.4 *Deadlocks*
> ([postgresql.org/docs/18/explicit-locking.html](https://www.postgresql.org/docs/18/explicit-locking.html)),
> §25.1 *Routine Vacuuming*
> ([postgresql.org/docs/18/routine-vacuuming.html](https://www.postgresql.org/docs/18/routine-vacuuming.html)),
> and the `idle_in_transaction_session_timeout` entry in *Client Connection
> Defaults*
> ([postgresql.org/docs/18/runtime-config-client.html](https://www.postgresql.org/docs/18/runtime-config-client.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no console
> output, no timings.

**Everything in this topic converges on one decision: where the transaction starts
and where it ends. A transaction holds locks other writers wait on, pins a snapshot
that stops the whole database reclaiming space, occupies a pooled connection, and —
above Read Committed — enlarges the window in which somebody has to be aborted. All
four of those costs scale with **duration**, and none of them is paid by the code
that opened it. That is what makes transaction length a shared resource rather than
a local performance question, and it is why the manual's advice keeps arriving in
the same shape: *"don't put more into a single transaction than needed for integrity
purposes"*, and *"it is a bad idea for applications to hold transactions open for
long periods of time (e.g., while waiting for user input)."***

## The four costs, and who pays them

| Cost | Who pays | Where it was established |
|---|---|---|
| Row locks are held until the transaction ends | every other writer to those rows | [chunk 12](12-locking-and-select-for-update.md) |
| A snapshot is pinned, so vacuum cannot reclaim superseded rows | **the whole database**, not just your tables | [chunk 6b](06b-what-repeatable-read-still-cannot-promise.md) |
| A pooled connection is occupied | every request queued behind the pool | **Topic 02 — Connection pooling** *(not written yet)* |
| The conflict window widens | every concurrent transaction's abort rate | [chunk 7b](07b-making-serializable-perform.md) |

🔴 **Not one of those appears in the latency of the request that caused it.** A
handler that holds a transaction open for four seconds looks like a four-second
handler. The bloat, the blocked writers and the raised abort rate land on other
code, later, and are attributed to the database.

## What must never be inside the transaction

The rule has one sentence: **the transaction contains database work and nothing
else.** The list is what that excludes.

| Inside the transaction | Why not |
|---|---|
| An HTTP call to another service | its latency becomes lock duration, its timeout becomes yours, and a rollback does not un-send it |
| Sending an email or an SMS | not rolled back, and a retry sends it again — to a human |
| Publishing to a queue or topic | consumers act on an event for work that may have been rolled back |
| Writing a file | no rollback, and a retry writes it twice |
| A long computation in the JVM | pure lock duration with no database work happening |
| Waiting for user input | the manual names this one explicitly as a bad idea |
| Mutating in-memory application state | the rollback does not undo your `HashMap` |
| Acquiring another lock — a JVM lock, a distributed lock | two lock hierarchies interleaving, which is a deadlock nobody can see |

Two independent reasons underlie the whole list.

**They are not transactional.** A rollback undoes database work and nothing else, so
every non-database effect inside the boundary is an action that can outlive a
transaction that never happened.

**They are repeated by retries.** With `40001` or `40P01` in play
([chunk 14](14-retrying-safely.md)), the block may execute several times. A side
effect inside it happens once per attempt.

And at Serializable there is a third, from the manual: data read from a permanent
user table *"not be considered valid until the transaction which read it has
successfully committed"*. Acting on a value before the commit returns is acting on
a state that may never have existed.

## The shape that fixes it

```java
// ❌ the payment provider's latency is now this row's lock duration
try (Connection c = ds.getConnection()) {
    c.setAutoCommit(false);
    Order o = loadForUpdate(c, orderId);        // row locked here
    PaymentResult r = paymentClient.charge(o);  // 200ms … or 30s … or a timeout
    markPaid(c, o, r);
    c.commit();                                 // row unlocked here
}
```

```java
// ✅ three phases: read, act, record — and only two of them are transactions
Order o;
try (Connection c = ds.getConnection()) {       // phase 1: read (short)
    o = load(c, orderId);
}

PaymentResult r = paymentClient.charge(o);      // phase 2: no transaction open

try (Connection c = ds.getConnection()) {       // phase 3: record (short)
    c.setAutoCommit(false);
    int rows = markPaidIfStillUnpaid(c, orderId, r);   // guard in the WHERE clause
    if (rows == 0) reconcile(orderId, r);              // somebody else got there
    c.commit();
}
```

🔴 **Phase 3 must re-check what phase 1 read**, because the two are different
transactions and the world moved between them. That is
[chunk 5](05-read-committed-in-practice.md)'s guarded `UPDATE` with the update count
checked — the same technique, applied at a larger scale.

⚠️ **This is genuinely harder to write**, and that is the honest trade. The single
long transaction is easier to reason about and impossible to run at scale. What you
gain in exchange is that the row is locked for the duration of one `UPDATE` instead
of for the duration of somebody else's API.

## When a side effect must be atomic with the write: the outbox

Sometimes "publish this event if and only if the order was created" is a real
requirement. The answer is not to publish inside the transaction — it is to make
the *intent* database work, so it inherits atomicity:

```java
c.setAutoCommit(false);
insertOrder(c, order);
insertOutboxRow(c, "OrderCreated", payload);   // ← an ordinary INSERT
c.commit();
// a separate process reads the outbox table and publishes, then marks it sent
```

The publish now cannot happen for an order that rolled back, because the row that
triggers it rolled back too. And the retry problem moves to the publisher, where it
is a well-understood at-least-once delivery with an idempotency key on the consumer
— [chunk 14b](14b-when-the-commit-is-in-doubt.md).

## Where the boundary belongs in the code

**One layer owns it, and it is not the repository.**

- **A repository or DAO takes a `Connection` and never touches its transaction
  state.** No `setAutoCommit`, no `commit`, no `rollback`, no isolation level. This
  is what stops two pieces of code disagreeing about who owns the boundary — the
  `25P01` failure from [chunk 2](02-commit-rollback-and-the-shape-that-survives.md).
- **A service method owns one unit of work** and is where the boundary is drawn.
- **A single outer boundary owns the retry**, because you cannot predict which units
  of work will need it — the manual's *"generalized way of handling serialization
  failures"* from [chunk 7b](07b-making-serializable-perform.md).

In a Spring application that boundary already exists as an annotation, and it is
where propagation, rollback rules and the isolation level are declared —
**Topic 04 — Spring `@Transactional`** *(not written yet)*. Everything on this page
is what that annotation is doing underneath, and knowing it is what makes the
annotation debuggable rather than magic.

## Gotchas

**⚠️ An HTTP call inside the transaction**
**Symptom:** lock contention and `idle in transaction` sessions that correlate with
a third party's latency rather than with your own load.
**Cause:** the transaction is open for the duration of a network call you do not
control, so their p99 is your lock duration.
**Fix:** three phases — read, call, record — with a guard in the recording
statement's `WHERE` clause.

**⚠️ Publishing an event inside the transaction**
**Symptom:** consumers react to an order that does not exist, or react twice.
**Cause:** a message broker has no idea your transaction rolled back, and a retry
publishes again.
**Fix:** the outbox — write the message to a table in the same transaction and let a
separate process deliver it.

**⚠️ Opening the transaction at the top of the handler**
**Symptom:** transaction duration equal to request duration, including validation,
deserialisation and response building.
**Cause:** the boundary was placed where it was convenient rather than where the
database work is.
**Fix:** open it immediately before the first statement and commit immediately after
the last. Everything else belongs outside.

**⚠️ Repositories that manage their own transactions**
**Symptom:** `Cannot commit when autoCommit is enabled.` (`25P01`), or a unit of
work that partially commits because a helper committed early.
**Cause:** two layers both believe they own the boundary.
**Fix:** repositories accept a `Connection` and never touch its transaction state.
One owner per unit of work.

**⚠️ A read-only report sharing the main pool**
**Symptom:** a nightly job exhausts the pool and API requests time out waiting for a
connection.
**Cause:** long transactions and short ones competing for the same fixed resource.
**Fix:** a separate `DataSource` for long-running work, and declare it read-only —
[chunk 11b](11b-read-only-that-earns-its-keep.md).

**⚠️ Growing the transaction to make the code tidier**
**Symptom:** a refactor that wraps three previously independent operations in one
transaction "for consistency", followed by a rise in lock waits and `40001`.
**Cause:** the manual's advice inverted — more was put into a single transaction
than integrity required.
**Fix:** ask what invariant actually needs them to be atomic. If there is not one,
they should not share a boundary.

**⚠️ Treating `idle_in_transaction_session_timeout` as the boundary policy**
**Symptom:** the alert is quiet and requests now fail with terminated sessions.
**Cause:** the timeout bounds the damage; it does not shorten the transaction.
**Fix:** set it as a floor and fix the boundary — [chunk 13b](13b-the-four-clocks.md).

## Interview questions

**★ Why must side effects live outside the transaction?**
Because the transaction can be rolled back and it can be retried, and neither of
those undoes an HTTP call, an email, a published message or a file write. Without
retries, a side effect inside the block happens once for work that may have been
discarded. With retries it happens once per attempt. At Serializable there is a
stronger argument still: the manual says data read from a permanent user table is
not valid until the reading transaction commits, so acting on it before the commit
returns means acting on a state that may never have existed. The pattern is to
collect the intent inside the transaction — an outbox row for a message, a list of
notifications — and act after the commit succeeds.

**★ Why is transaction length a shared resource rather than a local concern?**
Because every cost it incurs is paid by other code. Row locks are held until the
transaction ends, so other writers wait. The snapshot is pinned, so vacuum cannot
reclaim superseded row versions anywhere in the database — not just in the tables
you touched. A pooled connection is occupied, so requests queue. And above Read
Committed the conflict window is wider, so everybody's abort rate rises. None of
that shows up in the latency of the request that caused it, which is why long
transactions get diagnosed as "the database is slow" rather than as an application
design decision.

**★ Where does the transaction boundary belong in a layered application?**
At the service layer, around one unit of work, with the retry at a single outer
boundary above it. Repositories take a `Connection` and never touch its transaction
state — no `setAutoCommit`, no `commit`, no isolation level — because the moment two
layers both believe they own the boundary you get partial commits and `25P01`
errors. The retry has to be at one place rather than per call site because you
cannot predict which transactions will be chosen as the loser of a dependency cycle;
the manual insists on a "generalized way of handling serialization failures" for
exactly that reason.

**★ How do you make "create the order and publish the event" atomic?**
With an outbox, not with a publish inside the transaction. Insert the order and
insert a row describing the event into an outbox table, in the same transaction, so
they commit or roll back together. A separate process reads the outbox, publishes,
and marks the row sent. That gives you the atomicity you wanted — no event for a
rolled-back order — and it moves the delivery problem to a place where it is
well-understood: at-least-once delivery, with the consumer deduplicating on an
idempotency key. Publishing inside the transaction gives you the opposite of what
you wanted: an event that can outlive a rollback and be re-sent on every retry.

**★ A handler holds a transaction open across a payment API call. What do you tell
the team?**
That the payment provider's latency is now the lock duration on that order row, and
their timeout is the ceiling on how long a session sits `idle in transaction`
holding it — so a slow third party becomes lock contention, pool exhaustion and
table bloat in a system that has nothing to do with payments. The fix is three
phases: a short transaction to read what is needed, the API call with no transaction
open, and a second short transaction to record the result with a guard in the
`WHERE` clause so it cannot double-apply if something changed in between. It is more
code, and that is the actual trade — the simpler version does not survive
concurrency.

**★ Is "wrap it in a transaction for consistency" always an improvement?**
No, and it is a common refactor that makes things worse. A transaction should span
exactly the statements that must be atomic with each other for an invariant to hold;
the manual's own advice is not to put more into a single transaction than is needed
for integrity purposes. Merging three independent operations into one boundary
lengthens the lock hold, widens the conflict window, and makes a failure in the
third roll back the first two — which may not be what anybody wanted. The question
to ask is which invariant requires them to succeed or fail together. If there is
not one, they should not share a transaction.

---

← Prev: [14b · The commit in doubt](14b-when-the-commit-is-in-doubt.md) · Index: [Transactions at the JDBC level](README.md) · Next → [15b · Checklist and debugging order](15b-a-debugging-order-and-a-checklist.md)
