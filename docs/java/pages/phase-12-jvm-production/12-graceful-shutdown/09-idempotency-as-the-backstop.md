---
title: "Every page in this topic shrinks the window in which work is repeated or its outcome is unknown, and not one of them closes it — and because the repeat always lands on a different instance than the one that was shut down, none of the in-process tricks that usually paper over duplicates can work here"
sidebar_label: "09 · Idempotency as the backstop"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 — this page assembles conclusions established and sourced in the preceding
> chunks rather than introducing new claims about shutdown; each ambiguity links to the page
> carrying its evidence. The one external source quoted directly is **RFC 9110**, *Idempotent
> Methods* ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.html#name-idempotent-methods)).
> The wire-level mechanics — the specification's retry rule, the idempotency-key pattern and the
> three routes to making an operation repeatable — belong to **Phase 14** and are not re-taught
> here; see
> [Phase 14 · Idempotency on the wire](../../phase-14-microservice-architecture/04-sync-vs-async/07d-idempotency-on-the-wire.md).
> 🔴 **No sandbox.** JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Everything in this topic has been an exercise in making a window smaller. The drain shrinks the
set of requests cut off. `stopImmediate` shrinks the batch that gets replayed. The `preStop` sleep
shrinks the traffic that arrives after you stopped accepting. Not one of them reaches zero, and
the arithmetic in [08b](08b-prestop-and-termination-grace-period.md) shows why: every mechanism is
a timeout, and a timeout that expires produces exactly the outcome it was there to prevent.**

So the honest framing is not "graceful shutdown prevents duplicates and lost outcomes". It is:
**graceful shutdown makes them rare enough that a correct system stays correct, and idempotency is
what makes the system correct.** Take idempotency away and every number in this topic becomes a
probability of corruption rather than a probability of a retry.

## The four ambiguities this topic produced

| Where | What the other side sees | Page |
|---|---|---|
| A request cut off at the socket when the server stopped accepting | a transport error — no status code, no retry semantics | [08](08-readiness-and-the-load-balancer.md) |
| A consumer stopped mid-batch with the offset uncommitted | the whole poll batch redelivered, successful records included | [06b](06b-message-consumers.md) |
| A query aborted when the pool closed | `SQLException` — *"either progress to completion or throw"* | [07](07-connection-pools.md) |
| A `preStop` hook delivered more than once | the hook's side effect repeated | [08b](08b-prestop-and-termination-grace-period.md) |

**★ Three of those four are *unknown outcomes*, not *failures*.** A failure is easy: nothing
happened, retry it. An unknown outcome is the hard case — the write may have landed, and the only
party who could have told you has exited. That distinction is the reason this page exists as
something other than a summary.

## The property that makes shutdown different

RFC 9110's definition is the standard one:

> *"A request method is considered 'idempotent' if the intended effect on the server of multiple
> identical requests with that method is the same as the effect for a single such request."*

**★ The shutdown-specific twist is *where* the repeat lands: never on the instance that was shut
down.** That instance is gone. The retried HTTP request is routed to a different replica; the
redelivered Kafka record is read by whichever instance now owns the partition; the requeued AMQP
message goes to any consumer on the queue.

That single fact invalidates most of the ways teams actually handle duplicates in practice:

- **An in-memory "already processed" set** is on a JVM that no longer exists.
- **A `synchronized` block or a local `ReentrantLock`** never sees the second attempt.
- **A local cache with a short TTL** — same problem.
- **"We check whether we already did it" using a field the same process set** — the field is gone.

**★ At shutdown, the deduplication state must be in the same durable store as the effect, or it is
not deduplication.** A row with a unique constraint on a request id, written in the same
transaction as the work, is the shape that survives. A Redis key is better than memory and still a
second store that can disagree with the first.

## What "make it repeatable" means for each ambiguity

**The cut-off request.** The client cannot distinguish "not received" from "applied but the
response was lost", so it must be safe for it to send again. The mechanics — natural idempotency,
an idempotency key, or detecting whether it was applied — are Phase 14's subject:
[Idempotency on the wire](../../phase-14-microservice-architecture/04-sync-vs-async/07d-idempotency-on-the-wire.md).
What this topic adds is that **your own deploys generate this case on a schedule**, so it is not a
rare-failure concern to defer.

**The redelivered batch.** The consumer will see records it has already processed. The fix is at
the handler, not at the container: derive a key from the record — its own business id, or
topic-partition-offset — and make the write conditional on that key not having been seen. Narrowing
`ackMode` to `RECORD` reduces how many records repeat; it does not make any one of them safe.

**The aborted query.** The caller cannot tell whether the transaction committed. If the operation
is retried by anyone — the client, a message redelivery, a scheduled reconciliation — the same
conditional-write shape applies. **★ This is the one where the transaction boundary is doing most
of the work for you already**: an aborted connection means an uncommitted transaction means no
partial write, so a retry starts from a clean state. It is only unsafe when the unit of work was
not in a transaction at all ([07](07-connection-pools.md)).

**The repeated hook.** Keep `preStop` to a sleep and the problem does not arise. That is the
reasoning behind the recommendation, not an aesthetic preference.

## The test that tells you whether you have it

**★ Run the operation twice with the same input and assert the system state is identical, not that
the second call fails.** The second call returning a 409 is one valid design; returning the
original result is another; silently doing nothing is a third. What must not happen is a second
row, a second charge, a second email. A test that only asserts "the second call threw" passes for
a system that threw *after* writing.

**★ Then run the two calls from two different threads, and if you can, two different processes.**
The single-threaded version passes for check-then-act code that a real duplicate — arriving
concurrently at two replicas during a rolling deploy — would break. The database constraint is
what makes it safe; the application-level check is an optimisation that avoids the exception in the
common case.

## What this topic is not responsible for

- **Retry policy, backoff and circuit breaking** belong to
  [Phase 16 · Resilience and operating the fleet](../../phase-16-resilience-operations/README.md).
  This topic only establishes that retries will happen during your deploys whether you configured
  them or not — a browser, a mesh sidecar or a broker will do it for you.
- **The wire-level contract** — which methods are idempotent, the key header, what a provider owes
  you — is Phase 14's, linked above.
- **Exactly-once semantics.** Nothing here delivers them, and the honest position is that
  end-to-end exactly-once across a broker, your process and a database is achieved by at-least-once
  delivery plus idempotent effects, not by a delivery guarantee.

## Gotchas

**★ "We have graceful shutdown, so we don't get duplicates" is the belief this page exists to
break.** Graceful shutdown reduces the rate. Every mechanism in it is a timeout, and the arithmetic
in [08b](08b-prestop-and-termination-grace-period.md) shows the timeouts are not even coordinated
with each other.

**★ In-process deduplication cannot work for shutdown duplicates, by construction.** The retry
lands on a different instance. Any state in the dying JVM's heap is unreachable to it.

**★ A unique constraint is deduplication; a `SELECT` before an `INSERT` is not.** Two replicas can
both pass the `SELECT`. The constraint is the only thing that holds under the concurrency a rolling
deploy creates, and catching its violation is the correct implementation, not a workaround.

**★ The dedup key must be written in the same transaction as the effect.** A key in Redis and a row
in Postgres can disagree in exactly the window this topic is about — the process died between the
two writes.

**★ Idempotency keys need an expiry policy, and the expiry is a correctness decision.** Too short
and a legitimate late retry is treated as new; too long and the table grows without bound. Deploy
frequency is the wrong input; the client's maximum retry horizon is the right one.

**★ Logging "I already did this" is not evidence unless it is queryable.** The instance that
processed the original is gone, and its logs are in an aggregator, not in the path of the retry.
The check has to read the same store the effect was written to.

**★ At-least-once plus a non-idempotent side effect outside your database is the case with no
clean answer.** Sending an email, charging a card, calling a third party — none of it participates
in your transaction. The mitigations (an outbox, a provider-side idempotency key) are Phase 14's
and Phase 15's; what this topic contributes is that shutdown is a *routine* trigger for it, not an
exotic one.

**★ Reconciliation is a legitimate substitute for prevention, and it is often cheaper.** A periodic
job that detects and repairs duplicates can be the right design for a low-volume, high-complexity
operation. It has to be written and run, though — "we'll notice" is not reconciliation.

**★ The same duplicates occur without any shutdown at all.** A Kafka rebalance reassigns partitions
whenever group membership changes; a client retries on any timeout. Shutdown is the reliable,
scheduled way to encounter these, which makes it a good forcing function — but fixing it fixes a
class of bug, not a deployment concern.

## Interview questions

**★ Graceful shutdown is configured correctly. Do you still need idempotency?**
Yes, and that is the point of the whole topic. Every mechanism in a graceful shutdown is a timeout,
and a timeout that expires produces the outcome it was meant to prevent — a cut-off request, an
uncommitted offset, an aborted query. Graceful shutdown changes the rate, not the possibility. If
correctness depends on the timeouts never expiring, the system is not correct, it is lucky.

**★ Why can't you deduplicate shutdown-induced retries in memory?**
Because the retry never reaches the instance that was shut down — that JVM is gone. The HTTP retry
is routed to another replica, the Kafka record is read by the new owner of the partition, the
requeued AMQP message goes to another consumer. Any `Set`, lock or cache in the dying process is
unreachable to the process that actually handles the duplicate, so the deduplication state has to
live in the same durable store as the effect.

**★ What is the difference between a failure and an unknown outcome, and which does shutdown
produce?**
A failure means nothing happened; retrying is obviously safe. An unknown outcome means the work may
or may not have been applied and the only party that could say has exited. Shutdown produces the
second in three of its four ambiguities — the socket reset, the uncommitted offset, the aborted
query — which is why "just retry" is not automatically safe and why the receiver has to be able to
absorb a repeat.

**★ How do you actually test that an operation is idempotent?**
Call it twice with the same input and assert the resulting *state* is identical — one row, one
charge, one email — rather than asserting that the second call threw. A system that throws after
writing passes the weak test and fails in production. Then run the two calls concurrently from
different threads or processes, because a check-then-act implementation passes sequentially and
breaks under the concurrency a rolling deploy creates.

**★ Where does the deduplication key come from for a Kafka consumer?**
Preferably from the business payload — an order id, a payment reference — because that survives
replay, re-partitioning and reprocessing from an earlier offset. Topic-partition-offset works and
is easy, but it ties your correctness to the physical layout: it changes if the topic is
re-partitioned or the data is replayed from a mirror. Either way the key is written in the same
transaction as the effect, guarded by a unique constraint.

**★ Which parts of this problem does the transaction already solve for you?**
The database half. An aborted connection means an uncommitted transaction, so there is no partial
write to clean up and a retry starts from a clean state — the data is safe even though the caller's
knowledge is not. What the transaction cannot cover is a unit of work that ran with autocommit
across several statements, or any effect outside the database: an email, a card charge, a call to a
third party. Those need an outbox or a provider-side key.

**★ A team proposes raising `terminationGracePeriodSeconds` to 300 so duplicates stop happening.
Respond.**
It reduces the frequency and costs five minutes per pod on every deploy, every restart and every
eviction — which is a large operational price for a probabilistic improvement. It also does nothing
for the duplicates that have no relationship to shutdown: a Kafka rebalance on any membership
change, a client retry on any timeout. Size the grace period from the shutdown arithmetic and fix
correctness at the handler.

**★ Is exactly-once achievable here?**
Not as a delivery guarantee across a broker, your process and a database. What is achievable, and
what people usually mean, is at-least-once delivery combined with effects that are idempotent, so
that the observable outcome is exactly once. Framing it that way puts the work where it can
actually be done — in the handler and the schema — rather than in a configuration flag.

{/* FOOTER */}
