---
title: "A transaction is a lock on shared state, so its duration is a concurrency budget — and an HTTP call inside one spends that budget at another company's discretion"
sidebar_label: "21 · What belongs in a transaction"
sidebar_position: 62
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Transaction
> propagation*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)),
> the `DataSourceTransactionManager` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceTransactionManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/DataSourceTransactionManager.html)),
> the HikariCP README
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP))
> and the PostgreSQL 18 manual *Client Connection Defaults*
> ([postgresql.org/docs/18/runtime-config-client.html](https://www.postgresql.org/docs/18/runtime-config-client.html)).
> JDK 25, Spring Framework 7.0.8, HikariCP 7.0.2, PostgreSQL 18.

**An open transaction holds three scarce things at once: a pooled connection, any
locks it has taken, and a snapshot the database cannot vacuum past. All three are
released at commit and not before. So the only question that matters about a
transactional method is how long it stays open — and the fastest way to make that
number unbounded is to call another service from inside it.**

## What is actually held

**A connection.** The transaction is a connection, bound to your thread from
`BEGIN` to commit. HikariCP's pool is finite, and every other thread wanting one
waits up to `connectionTimeout` — "the maximum number of milliseconds that a
client (that's you) will wait for a connection from the pool. If this time is
exceeded without a connection becoming available, a `SQLException` will be
thrown."

**Locks.** Every row you have updated is locked against other writers until the
transaction ends. A transaction that updates a hot row and then does something
slow serialises every other transaction that wants that row.

**A snapshot.** PostgreSQL cannot clean up row versions that an open transaction
might still need. The manual makes the point when explaining
`idle_in_transaction_session_timeout`: "Even when no significant locks are held, an
open transaction prevents vacuuming away recently-dead tuples that may be visible
only to this transaction; so remaining idle for a long time can contribute to table
bloat."

None of those costs are visible in the method you are reading. That is what makes
this the most consequential design rule in the topic.

## The canonical outage

```java
@Transactional
public void checkout(long cartId) {
    Order order = orderRepository.save(Order.from(cartId));
    PaymentResult result = paymentGateway.charge(order);   // ← HTTP to a third party
    order.markPaid(result.reference());
}
```

This is correct-looking code, and it reads as though the payment and the order are
atomic. They are not — the payment is not transactional and cannot be rolled back
— and meanwhile the transaction is open for as long as the gateway takes to
answer.

On a normal day the gateway answers in 200ms and nobody notices. On a bad day it
degrades to 30 seconds. Now trace it:

1. Each in-flight checkout holds a pooled connection for 30 seconds.
2. With a pool of 10 and more than 10 concurrent checkouts, the pool is empty.
3. Every other request in the application — product pages, login, health checks —
   fails on `connectionTimeout`, because they share the pool.
4. The application is down. Nothing in it is broken.

The third-party's latency became your outage, and it reached parts of the system
that have nothing to do with payments. This is the single most common shape of
database-related incident, and the fix is one line of structure: the HTTP call
does not go inside the transaction.

## The list, with the failure each one causes

| Inside a transaction | What it costs you |
|---|---|
| **An HTTP call to another service** | their latency becomes your connection-hold time; their outage becomes your pool exhaustion |
| **Sending mail** | SMTP is slow and unreliable, and the mail cannot be un-sent if the transaction rolls back |
| **Publishing to a broker** | the same, plus the dual-write problem — see [19b](19b-after-commit-is-not-durable.md) |
| **File I/O** | not transactional, so it survives a rollback; on a network filesystem it can also block indefinitely |
| **Long computation** | holds locks and a connection while doing nothing that needs either |
| **Waiting on a user** | unbounded by definition; the classic "open a transaction on the edit screen" mistake |
| **`Thread.sleep`, or a retry loop with a backoff** | deliberately holding everything for the duration of the wait |
| **A lock acquisition on something else** | two lock orders, and a distributed deadlock nobody can see |

The common thread is that none of them needs the database, and all of them are
either slow, unbounded, or impossible to roll back.

## The test to apply

For each statement in a transactional method, two questions:

1. **Does this need to be atomic with the database writes?** If not, it can be
   outside.
2. **Is its duration bounded by us?** If the answer depends on another party's
   availability, it must be outside.

An operation that fails both is unambiguous. An operation that passes the first
and fails the second — say, a slow internal computation whose result is written to
the database — should be done *before* the transaction opens, with the transaction
holding only the write.

## Where the work goes instead

Three placements cover almost everything:

**Before the transaction.** Fetch, compute, validate, call whatever you need to
call. Then open a short transaction that writes the result. This is the
read-then-act shape and it is the subject of
[21b · Shaping the work](21b-shaping-the-work.md).

**After the commit.** For side effects that must only happen if the operation
succeeded — an `AFTER_COMMIT` listener, or an outbox row if it must not be lost.
See [19 · Transactional events](19-transactional-events.md).

**In a separate transaction.** For work that genuinely must be durable regardless
of the outer outcome, such as an audit of the attempt.

## The resource that outlives the transaction

Transactions are not the only thing that holds a resource for longer than the work
needs. In a Spring Boot web application there is a second mechanism, on by default,
that is easy to miss:

> If you are running a web application, Spring Boot by default registers
> `OpenEntityManagerInViewInterceptor` … If you do not want this behavior, you
> should set `spring.jpa.open-in-view` to `false`.

Open-Entity-Manager-in-View keeps a JPA persistence context open for the whole
request, so lazy associations can still be loaded while the response is being
rendered. It is convenient, and it is why a `LazyInitializationException` that
should have happened often does not.

The cost is that the persistence context — and, once anything touches the database
during rendering, a connection — is held past the service call, for the whole
duration of serialisation and response writing. The transaction ended; the resource
did not. Turning it off makes lazy-loading failures appear at development time,
where they can be fixed with an explicit fetch, rather than being paid for on every
request in production.

## The trade-off

Keeping external work out of the transaction costs atomicity you never actually
had. The payment call could not be rolled back anyway; what changes is that the
code stops pretending it could, which forces you to decide what happens when the
charge succeeds and the order write fails. That is real design work, and it
usually ends in idempotency keys and reconciliation.

The alternative is a method that reads as atomic, is not, and additionally couples
your availability to somebody else's. The pretence is not free — it is paid for
with an outage, at a time chosen by a third party.

## Gotchas

**⚠️ A third-party HTTP call inside a transactional method**
**Symptom:** an application-wide outage during someone else's incident, with
`connectionTimeout` failures in unrelated endpoints.
**Cause:** every in-flight request holds a pooled connection for the duration of
the external call, and the pool is shared by the whole application.
**Fix:** call outside the boundary. If the call must happen only on success, do it
in an `AFTER_COMMIT` listener or via an outbox.

**⚠️ `RestTemplate` or an HTTP client injected into a `@Transactional` service**
**Symptom:** the problem above, waiting to happen.
**Cause:** the dependency itself is the smell — a service whose transactional
methods can reach the network.
**Fix:** it is a useful review heuristic: an HTTP client and `@Transactional` on
the same class deserve a second look. (Note that `RestTemplate` is deprecated in
Framework 7 in any case.)

**⚠️ A long computation between two writes**
**Symptom:** lock contention and pool pressure with no slow query in sight.
**Cause:** the transaction is open for the computation, holding locks and a
connection while doing nothing that needs them.
**Fix:** compute first, then open the transaction to write.

**⚠️ Sending a confirmation email inside the transaction**
**Symptom:** emails about orders that do not exist.
**Cause:** the send is not transactional, so a later rollback cannot recall it.
**Fix:** `AFTER_COMMIT`. This is the textbook use of a transactional event
listener.

**⚠️ Opening a transaction across a user interaction**
**Symptom:** transactions that live for minutes, and a database that will not
vacuum.
**Cause:** the "pessimistic lock while the user edits" design, which is unbounded
by construction.
**Fix:** optimistic locking — a version column, and a conflict detected at write
time. The transaction then lasts milliseconds.

**⚠️ Assuming a `@Transactional(timeout = …)` makes this safe**
**Symptom:** timeouts declared everywhere and the outage happens anyway.
**Cause:** the timeout is checked at Spring-controlled resource operations, and a
thread blocked in a socket read reaches none of them — see
[17 · Timeouts](17-timeouts.md).
**Fix:** a timeout is not a substitute for a short transaction. Set the HTTP
client's own timeouts *and* keep the call outside the boundary.

## Interview questions

**★ Why is calling another service inside a transaction such a bad idea?**
Because an open transaction holds a pooled connection, any locks it has taken, and
a snapshot the database cannot vacuum past — and all three are released only at
commit. Putting a network call in the middle means another party's latency decides
how long you hold them. When that party degrades, every in-flight request holds a
connection for the duration, the pool empties, and unrelated parts of the
application start failing on `connectionTimeout`. Their incident becomes your
outage, in endpoints that have nothing to do with them.

**★ How would you restructure the checkout example?**
Split it into three phases. First a short transaction that creates the order in a
pending state and commits. Then the payment call, outside any transaction, with
its own client-level timeouts and an idempotency key so a retry cannot double
charge. Then a second short transaction that records the outcome. The two writes
are no longer atomic with the charge, which was always true and is now visible, so
the design has to say what happens if the charge succeeds and the second write
fails — usually a reconciliation job over orders left pending.

**★ What is the test for whether something belongs inside a transaction?**
Two questions per statement. Does it need to be atomic with the database writes —
if not, it can be outside. And is its duration bounded by us — if the answer
depends on somebody else's availability, it must be outside. Work that needs
atomicity but is slow and internal, like a computation whose result is written,
should be done before the transaction opens so the boundary only wraps the write.

**★ Does a `@Transactional(timeout = 5)` protect you from a slow external call?**
No. Spring's timeout is checked when it is asked for a transactional resource and
is pushed down as a JDBC statement timeout on statements it creates. A thread
blocked in a socket read is doing neither, so the deadline is not consulted until
the call returns — at which point it fires, having already held the connection for
the whole duration. The protections that actually work here are the HTTP client's
own connect and read timeouts, and PostgreSQL's
`idle_in_transaction_session_timeout`, which will terminate a session that sits in
an open transaction without sending anything.

**★ Beyond the connection, what else does a long transaction cost?**
Lock duration and vacuum. Every row the transaction has written stays locked
against other writers until it ends, so a long transaction touching a hot row
serialises everything behind it. And PostgreSQL cannot reclaim row versions that
an open transaction might still be able to see; the manual notes when discussing
`idle_in_transaction_session_timeout` that "an open transaction prevents vacuuming
away recently-dead tuples… so remaining idle for a long time can contribute to
table bloat". Those costs land on the database as a whole, not on the request that
caused them.

**★ Someone argues the external call must be inside the transaction so it can be
rolled back. What do you say?**
That it cannot be rolled back either way. A rollback undoes writes to the
transactional resource; it does not un-send an HTTP request, un-send an email, or
un-publish a message. Keeping the call inside the transaction does not give
atomicity — it gives the *appearance* of atomicity while adding a coupling to
someone else's availability. The real answers are idempotency on the remote side
plus compensation, or moving the call after the commit and accepting at-least-once
delivery.

**★ How would you find these in an existing codebase?**
Look for classes that have both `@Transactional` and a client of something remote
— an HTTP client, a mail sender, a broker template, a file writer. That single
heuristic finds most of them. Then, in production, look for transaction duration
rather than query duration: a slow query shows up in the database's own logs, but a
transaction that is fast in SQL and slow in wall-clock shows up only as connections
held and, on PostgreSQL, as sessions sitting idle in transaction.

**★ What is Open-Entity-Manager-in-View, and what does it cost?**
It is an interceptor Spring Boot registers by default in web applications that
keeps the JPA persistence context open for the entire request, so lazy
associations can still be initialised while the response is being rendered. The
Boot reference says so directly and tells you the switch: set
`spring.jpa.open-in-view` to `false` if you do not want it. The cost is that a
resource outlives the transaction — the persistence context stays open past the
service call, and any lazy load during rendering issues queries and holds a
connection while the response is written. It also hides mapping problems: a
`LazyInitializationException` that would have told you to fetch explicitly never
happens, so the extra queries are discovered in production as N+1 rather than in
development as an error.

**★ Is there a version of "call another service inside a transaction" that is
acceptable?**
Only where the call is to something you control, is bounded by a short and enforced
client timeout, and the atomicity genuinely requires it — and even then it is a
compromise rather than a good design, because the transaction's duration is now
partly someone else's decision. The honest cases are rare. Far more often the claim
that atomicity requires it is wrong, because the remote call was never
transactional and could not have been rolled back anyway. The question to force is:
what happens today, in the existing code, if the remote call succeeds and the
commit then fails? If nobody knows, the code was not atomic, and moving the call
out costs nothing that was real.

---

← Prev: [20j · The fixture and the real database](20j-the-fixture-and-the-real-database.md) · Index: [Spring @Transactional](README.md) · Next → [21b · Shaping the work](21b-shaping-the-work.md)
