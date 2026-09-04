---
title: "There is a size below which the pool deadlocks, and it depends on how many connections one thread holds at once"
sidebar_label: "3 · The deadlock floor"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the HikariCP wiki page *About Pool Sizing*
> ([github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing))
> and the HikariCP 7.0.2 README
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)).
> JDK 25, HikariCP 7.0.2, Spring Boot 4.1.1, PostgreSQL 18.

**[Chunk 2](02-why-a-small-pool-is-faster.md) argued the pool should be small.
This chunk is the counterweight, and it is the only argument for making a pool
*bigger* that is not a mistake. If a single thread ever holds two connections at
the same time, the pool has a **floor** — a size below which the application can
lock up completely and stay locked up. Not slow down. Stop. And the way it stops
looks exactly like the pool being too small for the load, so the usual response
is to raise `connectionTimeout`, which converts a hang into a slower hang.**

## How one thread ends up holding two connections

Most code borrows one connection, uses it and returns it. That code has no floor
problem at all. The floor only appears when a borrow happens *inside* a borrow.
Here is the plainest version:

```java
void placeOrder(long customerId, List<Item> items) throws SQLException {
    try (var c = dataSource.getConnection()) {          // connection #1
        c.setAutoCommit(false);
        long orderId = insertOrder(c, customerId);

        auditLog.record("order.created", orderId);      // ← borrows #2 inside #1

        c.commit();
    }
}
```

`auditLog.record` opens its own connection because it writes to a different
table and nobody wanted to thread a `Connection` argument through it. That is a
completely ordinary piece of code. It also means every thread running
`placeOrder` needs **two** connections simultaneously to finish.

The Spring version of the same thing is even less visible, because the second
borrow is created by an annotation:

```java
@Transactional
public void placeOrder(long customerId, List<Item> items) {
    long orderId = orderRepo.insert(customerId, items);   // connection #1
    auditService.record("order.created", orderId);        // connection #2
}

@Service
class AuditService {
    @Transactional(propagation = Propagation.REQUIRES_NEW)   // ← the second borrow
    public void record(String event, long id) { ... }
}
```

🔴 **`Propagation.REQUIRES_NEW` is the single most common way a codebase acquires
a second simultaneous connection without anyone deciding to.** The outer
transaction is suspended, not ended — its connection is still held — and a new
one is borrowed for the inner call. The propagation rules are
**[topic 04 · `REQUIRES_NEW`](../04-spring-transactional/10-requires-new.md)**; what matters here
is the arithmetic.

## The formula

HikariCP's wiki states the floor directly:

```
pool size = Tn x (Cm - 1) + 1
```

where **Tn** is the maximum number of threads that can be running this code at
once, and **Cm** is the maximum number of connections a *single* thread needs at
the same time. The wiki's worked example:

> *Given a pool of 8 threads (Tn=8) that each require 3 connections (Cm=3), the
> pool size required to guarantee that deadlock is impossible is
> 8 x (3 - 1) + 1 = 17.*

⚠️ **It is a floor, not a target.** The page is explicit:

> *This is not necessarily the optimal pool size, but the minimum required to
> avoid deadlock.*

So the real sizing rule is: take the number from
[chunk 2](02-why-a-small-pool-is-faster.md), take the floor from here, and use
whichever is **larger** — then go and reduce `Cm`, because a large floor is a
design smell rather than a pool problem. [Chunk 3b](03b-reducing-cm.md) is about
reducing it.

## Why the "minus one, plus one" is right

The formula is the pigeonhole principle wearing a suit.

Suppose every thread has grabbed `Cm - 1` connections and is now waiting for its
last one. Nobody can finish, so nobody returns anything, so nobody can proceed.
That is the deadlock, and it needs `Tn x (Cm - 1)` connections to reach. Add
**one** more connection and that state becomes impossible to hold: whichever
thread gets that connection has all `Cm` it needs, finishes, and releases
everything it held — which unblocks the next thread, and so on.

| Tn | Cm | Floor | Why |
|---|---|---|---|
| 200 | 1 | **1** | one connection per thread at a time — no floor problem exists |
| 200 | 2 | **201** | 🔴 every thread can hold one and wait for a second |
| 8 | 3 | **17** | the wiki's example |
| 50 | 2 | **51** | a 50-thread executor where every task nests one borrow |

🔴 **Look at row two.** Going from `Cm = 1` to `Cm = 2` takes the floor from 1 to
201. There is no gentle middle. **The moment any code path nests a borrow, the
floor jumps to roughly your entire thread count**, which is almost never a pool
size you can afford. This is why the answer is nearly always to fix `Cm`, not to
raise `maximumPoolSize`.

## The trade-off

Sizing to the floor means running a pool larger than
[chunk 2's](02-why-a-small-pool-is-faster.md) throughput argument wants, so you
give up the throttle: the database is now allowed to do more concurrent work than
is good for it, and you are paying for a design flaw with database CPU. The
alternative — running below the floor — is not "a bit slower", it is an outage
that only appears under concurrency you cannot reproduce on a laptop. Between
those two, size to the floor and fix `Cm` this quarter.

## Gotchas

**⚠️ The deadlock does not look like a deadlock**
**Symptom:** every request fails with `SQLTransientConnectionException ...
request timed out after 30000ms`, and the service recovers only on restart.
**Cause:** all connections are held by threads waiting for connections. Nothing
will ever return one, so the pool never refills.
**Fix:** the give-away is in the exception's own numbers — `active` equals
`total`, `idle` is 0 and `waiting` is large and **not falling**.
[Chunk 5](05-connection-is-not-available.md) reads those fields properly.

**⚠️ Raising `connectionTimeout` "to give it more time"**
**Symptom:** requests now hang for 60 seconds instead of 30, and thread dumps
fill with `HikariPool.getConnection`.
**Cause:** the wait is unbounded in effect — the connection is never coming.
**Fix:** more time cannot resolve a cycle. Reduce `Cm`, or raise the pool above
the floor.

**⚠️ Applying chunk 2's advice without checking the floor**
**Symptom:** cutting `maximumPoolSize` from 50 to 10 improves latency for a week
and then produces a total outage during a traffic spike.
**Cause:** the old oversized pool was accidentally above the floor and hiding a
`Cm > 1` path.
**Fix:** compute the floor before you shrink. Shrinking is right; shrinking past
the floor is not.

**⚠️ Reproducing it locally and concluding it is fine**
**Symptom:** the nested-borrow path passes every test and every manual check.
**Cause:** with one thread, `Tn = 1` and the floor is `Cm`, which a
default pool of 10 satisfies easily. The deadlock needs `Tn` threads arriving
together.
**Fix:** it is a concurrency bug, so only a concurrent test can see it — or
read the call stack and count, which is faster and more reliable.

**⚠️ Assuming a database deadlock detector will save you**
**Symptom:** nothing in the PostgreSQL log, no `40P01 deadlock_detected`, and
the application is still wedged.
**Cause:** the cycle is entirely inside the JVM. The database has no idea these
threads exist; from its side the connections are simply idle.
**Fix:** this one is yours to find. The pool's own numbers and a thread dump are
the whole toolkit.

## Interview questions

**★ Can a connection pool deadlock, and how?**
Yes, and it needs no database locks at all. If a thread holds one connection and
then tries to borrow a second, a set of threads can each be holding some
connections and waiting for the rest, with none able to finish and therefore none
able to return anything. It is a classic hold-and-wait cycle where the contended
resource is pool entries. It requires only that some code path borrows a
connection while already holding one — a nested repository call, `REQUIRES_NEW`,
or a borrow inside a loop over an open `ResultSet`.

**★ What is the minimum pool size that makes that impossible?**
`Tn x (Cm - 1) + 1`, where `Tn` is the maximum number of threads that can run the
code concurrently and `Cm` is the maximum number of connections one thread holds
at once. HikariCP's example is 8 threads each needing 3 connections, giving
`8 x (3 - 1) + 1 = 17`. The reasoning is pigeonhole: `Tn x (Cm - 1)` is exactly
enough for every thread to be one connection short, and the extra connection
guarantees at least one thread can always complete and release what it holds.
The wiki is careful to call this the minimum to avoid deadlock, not the optimal
size.

**★ Why is going from Cm = 1 to Cm = 2 such a big deal?**
Because the floor is linear in `Tn` and the coefficient is `Cm - 1`. At `Cm = 1`
the coefficient is zero, so the floor is 1 regardless of how many threads you
run — that is why most services never meet this problem at all. At `Cm = 2` the
coefficient becomes 1 and the floor is `Tn + 1`, so a 200-thread container needs
201 connections. There is no intermediate value. That discontinuity is why the
correct response is almost always to eliminate the nested borrow rather than to
resize the pool.

**★ How do you tell a deadlocked pool from a merely undersized one?**
Look at the numbers HikariCP prints in the timeout exception, and at whether they
move. An undersized pool shows `waiting` rising and falling with load, and
requests succeed between failures. A deadlocked pool shows `active` pinned equal
to `total`, `idle` at zero and `waiting` monotonically increasing, with a success
rate of zero and no recovery until restart. A thread dump settles it: in the
deadlock case the threads parked in `HikariPool.getConnection` are the *same*
threads that appear in your own transactional code higher up the stack.

**★ Why does the database's deadlock detector not report this?**
Because there is no database deadlock. Every one of those backends is sitting
idle or inside a perfectly ordinary transaction; none of them is waiting on a
lock held by another. The cycle exists only in the JVM, between threads and pool
entries, and PostgreSQL cannot see the JVM. This is worth saying out loud in an
interview, because "deadlock" makes most people reach for `pg_locks` first, and
`pg_locks` will be empty.

**★ Is the floor the same for every pool in the application?**
No — it is per pool, because `Cm` is counted per pool. A thread that holds one
connection from the primary pool and one from a read-replica pool has `Cm = 1`
in each, so neither pool has a floor problem. That is one genuine argument for
splitting pools, and [chunk 3e](03e-two-pools-not-one-bigger.md) makes the same
argument from a different direction. What is *not* per pool is the database's own
capacity: every pool in every instance draws on one shared `max_connections`,
which is [chunk 3c](03c-the-server-side-ceiling.md).

---

← Prev: [2 · Why a small pool is faster](02-why-a-small-pool-is-faster.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [3b · Reducing Cm](03b-reducing-cm.md)
