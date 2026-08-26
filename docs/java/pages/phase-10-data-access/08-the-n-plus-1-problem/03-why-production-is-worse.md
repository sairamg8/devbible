---
title: "The same hundred queries that cost nothing on your laptop cost a connection, a thread and a round trip each in production"
sidebar_label: "3 · Why production is worse"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *A Short Guide to Hibernate 7*
> §8.3 *Batch updates* and §8.4 *Association fetching*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html))
> and the Hibernate ORM 7.4 user guide §31.3 *JDBC batching*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, HikariCP 7.0.2, PostgreSQL 18.

**A local database on loopback and a production database across a network are
not the same machine with different specs — they differ in the one cost that
N+1 multiplies. This chunk is why the bug that was invisible in development
becomes the incident in production, and why the damage lands on endpoints that
have nothing to do with the offending query.**

## Round trips do not compose the way computation does

Ordinary code gets faster on faster hardware. A round trip does not: it is
dominated by latency, and latency is a property of the path, not of the work.

The Hibernate guide states the goal in a single sentence, and it is not about
query cost at all:

> *"Achieving high performance in ORM means minimizing the number of round trips
> to the database. This goal should be uppermost in your mind whenever you're
> writing data access code with Hibernate."*

**Number of round trips.** Not query complexity, not index quality, not row
count. That is the metric N+1 attacks directly, and it is the metric that
changes most between a laptop and a datacentre:

| | Local, loopback | Same availability zone | Cross-zone |
|---|---|---|---|
| What dominates | process scheduling | network + kernel | network + kernel |
| N+1 with 100 parents | 101 × a very small number | 101 × a larger number | 101 × a larger number still |

I am not putting figures in that table, because there is no database on this
machine and inventing them would be worse than leaving them out. The shape is
what matters and the shape is robust: **the multiplier is the same 101 everywhere,
but the thing being multiplied grows by orders of magnitude as the database moves
away from the process.** Development is the environment in which that multiplier
costs least, which is precisely why the bug is written there and discovered
elsewhere.

The same reasoning is why Hibernate has a JDBC batching feature at all for
writes. The user guide's justification for batching is one sentence, and it is
the write-side statement of the identical principle:

> *"JDBC allows us to batch multiple SQL statements and to send them to the
> database server into a single request. This saves database round trips, and so
> it reduces response time significantly."*

N+1 is the read-side version of the problem batching solves for writes. Every fix
in this topic is, mechanically, a way of turning many round trips into few.

## They are serialised, and that is the whole cost

The hundred statements are not concurrent. Statement *k+1* cannot be sent until
statement *k*'s result has come back, because the code that triggers it is the
next iteration of a loop in a single thread. So the costs add rather than
overlapping, and the request's latency is the **sum** of a hundred round trips.

This is also why the obvious mitigation does not exist. You cannot fix N+1 by
making the queries parallel: they are issued from one thread, on one JDBC
`Connection`, inside one transaction — and a JDBC `Connection` is not safe for
concurrent use, so there is nowhere to put the concurrency even if you wanted it.
Virtual threads do not help either: the problem is not that the thread is
expensive to block, it is that the round trips are sequential and each one is
real elapsed time.

The only way to reduce the sum is to reduce the count of terms. That is what
[chunk 8](08-join-fetch.md) does by making it one, and
[10 · `@BatchSize`](10-batch-size.md)
does by making it N/K.

## It holds a connection the whole time

This is the effect that turns a slow endpoint into an outage, and it is the part
most people miss.

The hundred statements all run inside one transaction, so they all run on one
pooled `Connection`, and that connection is **held for the entire duration** —
from the first statement to the commit. See
[Topic 04 · Spring `@Transactional`](../04-spring-transactional/README.md) for
how the connection becomes bound to the thread for the life of the transaction,
and [Topic 02 · Connection pooling with HikariCP](../02-connection-pooling/README.md)
for why the pool is small and fixed.

That gives the following, which is the real mechanism of the incident:

1. The pool has a small fixed number of connections — a pool sized in the tens is
   normal and correct.
2. Each in-flight request that hits the N+1 path holds one of them for roughly
   101 round trips instead of 1.
3. So the endpoint's *throughput capacity* falls by roughly that factor, because
   capacity is pool size divided by hold time.
4. When demand exceeds it, requests queue for a connection rather than for the
   database.
5. **Every other endpoint in the application queues too**, because they share the
   pool.

Step 5 is why the symptom is misleading. The page that times out is often not the
page with the bug — it is whichever page was unlucky enough to ask for a
connection while the orders report was holding four of them. Teams chase the
symptom endpoint for days. The tell is that the *database* is idle: low CPU, no
slow queries, no lock waits, and an application that is nevertheless timing out.
When the database looks bored and the application looks saturated, suspect
connection hold time, and suspect this.

## It scales with the data, not with the traffic

Every other capacity problem you plan for is a function of **requests per
second**, and you can watch that number and provision against it. This one is a
function of **rows returned per request**, which:

- nobody graphs,
- has no alert on it,
- grows monotonically as the product succeeds, and
- can jump discontinuously when a customer imports a large dataset or a filter
  is loosened.

So the failure arrives without a traffic spike to explain it. The classic
presentation is an endpoint that has been fine for a year degrading over a
fortnight with flat traffic, or a single large tenant making an endpoint slow for
everybody. Neither looks like a load problem, and neither responds to adding
application instances — more instances multiply the number of processes issuing
101 round trips against the same database and the same connection budget.

## The transaction is long, and long transactions have their own costs

The 101 round trips do not just hold a connection — they hold an **open
transaction**, and on PostgreSQL an open transaction has consequences beyond the
connection:

- It pins a snapshot, which holds back the horizon that `VACUUM` can clean up to,
  so dead tuples accumulate for the duration.
- Any locks the transaction has taken are held to commit.
- Under `REPEATABLE READ` or `SERIALIZABLE`, a longer transaction has a longer
  window in which to conflict and be aborted.

A read-only report is the mildest case of this, which is why `readOnly = true`
matters and why [Topic 04 · Spring `@Transactional`](../04-spring-transactional/README.md)
spends time on transaction duration. But the general rule stands: **N+1 converts
a short transaction into a long one, and everything that is bad about long
transactions becomes true of a page that merely renders a list.**

## Gotchas

**⚠️ Concluding the database needs to be bigger.**
Scaling the database up does nothing here. The database is not the bottleneck —
it is executing fast queries with capacity to spare. You are paying for the trips,
not for the work at the far end, and a larger instance does not shorten a round
trip. Money spent here buys nothing, which makes this a particularly expensive
misdiagnosis.

**⚠️ Enlarging the connection pool to make the queueing stop.**
It relieves the queueing briefly and then makes things worse: more concurrent
connections means more concurrent work on the database, more context switching,
and a pool that no longer protects the database from the application. Pool size
is a limit chosen deliberately; treating it as the variable when hold time is the
actual problem inverts the design.

**⚠️ Adding application instances.**
Horizontal scaling helps when the constraint is CPU in the application. Here the
constraint is round trips against a shared database and a shared connection
budget, so more instances means more processes doing the same wasteful thing to
the same server. The endpoint may even get slower.

**⚠️ Testing against a database on loopback and calling it representative.**
Loopback removes the single cost N+1 multiplies. A benchmark run against a local
container measures a version of the system in which this bug is nearly free, and
will report that the fetch join is barely worth doing. Any measurement of an N+1
fix must be made where the network is.

**⚠️ Assuming virtual threads or reactive code make it acceptable.**
They change what the *thread* costs while blocked, not what the *round trips*
cost in elapsed time, and not how long the connection is held. A virtual thread
parked on 101 sequential round trips still holds one pooled connection for the
whole sequence. The arithmetic is untouched.

**⚠️ Missing it because the endpoint is asynchronous.**
Moving the report to a background job removes the user-visible latency and keeps
every other cost: the connection is still held, the transaction is still long, and
the pool is still shared with the requests that are user-visible. It converts a
slow page into an intermittent slowdown of everything, which is harder to
diagnose, not easier.

**⚠️ Reading low database CPU as proof the application is at fault elsewhere.**
It is proof of exactly this shape. An idle database and a saturated application
is the signature of connection hold time, and N+1 is the most common cause of
connection hold time in a Java service.

## Interview questions

**★ Why is N+1 much worse in production than in development?**
Because the cost it multiplies is the network round trip, and that is the one
cost that is nearly free locally and substantial in production. On a laptop the
database is on loopback in the same machine; in production it is across a network
in a different host and possibly a different availability zone. The multiplier —
101 statements — is identical in both places, but the thing being multiplied grows
by orders of magnitude. That is why the bug gets written in the environment where
it costs least. There is a second, compounding reason: development runs one
request at a time against a tiny dataset, so neither the fan-out nor the
contention that turns this into an incident is present.

**★ Why can't you fix N+1 by running the queries in parallel?**
Because there is nowhere to put the parallelism. The statements are issued from a
single thread iterating a collection, on a single JDBC `Connection`, inside a
single transaction — and a `Connection` is not safe for concurrent use, so you
cannot fan the statements out across it. You could in principle open more
connections, but then the work is in separate transactions with separate
snapshots, you have multiplied your connection consumption by N, and you have
traded a correctness-preserving problem for a consistency one. The only real
lever is reducing the number of round trips, which is what fetch joins, batch
fetching and projections all do by different means.

**★ An endpoint is timing out, but the database shows low CPU, no slow queries
and no lock waits. What do you suspect?**
Connection hold time, and N+1 as the most likely cause of it. The signature is
exactly that combination: the database is bored because every individual
statement is a trivial indexed lookup, while the application is saturated because
each in-flight request is holding a pooled connection for a hundred sequential
round trips instead of one. Throughput capacity is pool size divided by hold
time, so multiplying hold time by a hundred divides capacity by a hundred, and
requests then queue for a connection rather than for the database. The other tell
is that the endpoint that times out is often not the endpoint with the bug —
everything sharing the pool degrades together.

**★ Would increasing the connection pool size help?**
Almost never, and it usually hurts. The queueing is a symptom of hold time, not
of an under-sized pool, so enlarging the pool lets more requests hold connections
for a hundred round trips each, which pushes more concurrent work onto the
database and removes the pool's function as a limiter that protects it. You get a
short reprieve and a worse steady state. The pool size was chosen to match what
the database can usefully serve concurrently; the correct variable to change is
how long each request holds a connection, which means fixing the fetch.

**★ Why is "it scales with the data, not with the traffic" such an important
property?**
Because it defeats capacity planning. Everything else you provision against is a
function of requests per second — a number you graph, alert on, and load test.
This one is a function of rows returned per request, which nobody graphs and
which grows on its own as the product succeeds. So the failure arrives with no
traffic spike to explain it: a flat-traffic endpoint degrades over a fortnight,
or one large tenant makes a page slow for everyone. It also means the usual
remedy is inverted — adding instances multiplies the number of processes issuing
101 round trips against the same database, so horizontal scaling can make it
worse rather than better.

**★ Does the transaction boundary matter, or only the query count?**
Both, and the boundary is the part that turns a slow page into an outage. The N
statements run inside one transaction, so they hold one pooled connection and one
open transaction from the first statement to the commit. Holding the connection
is what starves every other endpoint sharing the pool. Holding the transaction
open has its own costs on PostgreSQL: the snapshot is pinned, so `VACUUM` cannot
clean up past it and dead tuples accumulate; any locks taken are held to commit;
and under the stricter isolation levels there is a longer window in which to hit
a serialisation conflict. So N+1 does not just make a request slow — it converts
a short transaction into a long one and inherits every problem long transactions
have.

---

← Prev: [2 · Why nobody sees it](02-why-nobody-sees-it.md) · Index: [08 · The N+1 problem](README.md) · Next → [4 · The shapes it hides in](04-the-shapes-it-hides-in.md)
