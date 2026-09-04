---
title: "A connection is not a worker — it is permission to make the database work, and handing out more of it makes everything slower"
sidebar_label: "2 · Why a small pool is faster"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the HikariCP wiki page *About Pool Sizing*
> ([github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing))
> and the HikariCP 7.0.2 README
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)).
> JDK 25, HikariCP 7.0.2, Spring Boot 4.1.1, PostgreSQL 18.

**Almost every connection pool that has ever been tuned in a panic was tuned
upward, and almost every one of those changes made the system slower. The
instinct is natural: requests are queuing for connections, so add connections.
But a connection is not a worker. It is permission to make the database do work,
and the database can only do so much at once. Past that point extra connections
add no throughput — they add context switching between backend processes, more
lock contention and more memory pressure, so every query gets slower, every
connection is held longer, and the queue you were trying to drain gets longer.
HikariCP's default `maximumPoolSize` is **10**, and for a great many production
services 10 is not a placeholder to be raised. It is already about right.**

## The demonstration everyone should see once

HikariCP's *About Pool Sizing* page opens with a video from the Oracle Real-World
Performance group, and summarises the result:

> *You can see from the video that reducing the connection pool size alone, in
> the absence of any other change, decreased the response times of the
> application from ~100ms to ~2ms — over 50x improvement.*

The change was from **2048 connections down to 96**. Nothing else was touched.
The same page notes that in a PostgreSQL benchmark chart *"TPS rates start to
flatten out at around 50 connections"*, and adds that *"even 96 is probably too
high, unless you're looking at a 16 or 32-core box."*

⛔ **I am not reproducing a benchmark of my own.** There is no database and no
running application on this machine, so any chart or millisecond figure I
produced here would be invented. The numbers above are quoted from HikariCP's
documentation. The reasoning below is what you should actually carry away,
because it generalises — and a number measured on somebody else's hardware does
not.

## Why fewer is faster

The argument is ordinary computer science, applied in a place people forget to
apply it.

**A CPU core executes one thread at a time.** Everything else is the operating
system time-slicing, which is a trick, not extra capacity. The wiki puts it
directly:

> *It is a basic Law of Computing that given a single CPU resource, executing A
> and B sequentially will always be faster than executing A and B
> "simultaneously" through time-slicing. Once the number of threads exceeds the
> number of CPU cores, you're going slower by adding more threads, not faster.*

**But database work blocks on I/O**, and that is the exception that lets you go
above core count. While one connection's query waits for a disk seek or for the
network, its core is free to run another. So the useful number of connections is
core count *plus* however much blocking there is to fill — no more.

On PostgreSQL there is a second reason the number should stay small, specific to
its architecture: each connection is a separate operating-system **process**, not
a thread ([topic 01 chunk 4](../01-jdbc/04-connection-is-expensive.md)). More
connections therefore means more processes for the kernel to schedule and more
private memory allocated, both of which cost the database directly.

⚠️ **This is why SSDs mean you want *fewer* connections, not more** — a point the
wiki makes explicitly, and one people reliably get backwards:

> *Don't be tricked into thinking, "SSDs are faster and therefore I can have more
> threads". That is exactly 180 degrees backwards. Faster, no seeks, no
> rotational delays means less blocking and therefore fewer threads [closer to
> core count] will perform better than more threads.*

Fast storage removes the waiting. Removing the waiting removes the reason to have
extra connections.

## The formula

HikariCP quotes a formula that comes from the PostgreSQL project:

```
connections = ((core_count * 2) + effective_spindle_count)
```

and reproduces the original wording, which contains two conditions people drop:

> *A formula which has held up pretty well across a lot of benchmarks for years
> is that for optimal throughput the number of active connections should be
> somewhere near ((core_count * 2) + effective_spindle_count). **Core count
> should not include HT threads, even if hyperthreading is enabled.** Effective
> spindle count is **zero if the active data set is fully cached**, and
> approaches the actual number of spindles as the cache hit rate falls. ...
> There hasn't been any analysis so far regarding how well the formula works with
> SSDs.*

Both of those clauses push the answer **down**:

| Input | The careless reading | What the formula says |
|---|---|---|
| `core_count` | whatever `nproc` prints | **physical cores**, hyperthreads excluded |
| `effective_spindle_count` | "we have fast disks, call it 8" | **0** when the working set is cached — it models seek-blocking, which flash does not have |
| whose machine? | the application server | the **database** server |

🔴 **`core_count` is the database server's core count, not your application
server's.** The pool limits how much simultaneous work you ask the database to
do. Sizing it from the machine running Java sizes it against the wrong
bottleneck entirely — and on a big application node against a small database, it
sizes it wildly too high.

Worked, using the wiki's own example: a four-core database server with one hard
disk gives `((4 * 2) + 1) = 9`, and the page says to *"call it 10 as a nice round
number"* — which is exactly HikariCP's default. It then makes a claim about that
setup worth quoting, because it is so far from most people's intuition:

> *Seem low? Give it a try, we'd wager that you could easily handle 3000
> front-end users running simple queries at 6000 TPS on such a setup.*

⚠️ **Treat the formula as a starting point to test around, not an answer.** The
wiki says so — *"You should test your application, i.e. simulate expected load,
and try different pool settings around this starting point"* — and the quoted
text admits it has never been analysed for SSDs.

## The axiom

> **Axiom: You want a small pool, saturated with threads waiting for
> connections.**

That word *saturated* is the part that reads as wrong and is not. **Threads
queuing at the pool is the design, not a symptom.** The queue is where excess
load is absorbed — inside your application, where it is cheap, visible and
measurable per request. If you enlarge the pool until nobody waits, the waiting
has not gone away. It has moved into the database, where it is expensive and
where you cannot instrument it.

The wiki finishes the thought:

> *If you have 10,000 front-end users, having a connection pool of 10,000 would
> be shear insanity. 1000 still horrible. Even 100 connections, overkill. You
> want a small pool of a few dozen connections at most, and you want the rest of
> the application threads blocked on the pool awaiting connections.*

and, on the habit this page exists to break:

> *We never cease to amaze at the in-house web applications we've encountered,
> with a few dozen front-end users performing periodic activity, and a connection
> pool of 100 connections. Don't over-provision your database.*

🔴 **The pool is a throttle, and choosing its size is choosing how much work the
database is ever asked to do at once.** Once you see it that way, "set it to 100
to be safe" reads as what it is: removing the throttle.

## Gotchas

**⚠️ Raising `maximumPoolSize` because requests are timing out**
**Symptom:** the timeouts get worse after the change, and database CPU climbs.
**Cause:** the queue was a symptom of slow queries or held connections, not of
too few connections. More connections means more concurrent work on a database
that was already saturated.
**Fix:** find what is holding connections first —
[chunk 5](05-connection-is-not-available.md) shows how to tell which case you are
in from the exception message itself.

**⚠️ Sizing from the application's thread count**
**Symptom:** a pool of 200 to match a 200-thread web container, or one connection
per virtual thread.
**Cause:** treating a connection as a per-thread resource.
**Fix:** threads are *meant* to queue at the pool. That is the axiom, not a
failure. This matters more, not less, with virtual threads, where the thread
count can run to hundreds of thousands.

**⚠️ Sizing from the application server's cores**
**Symptom:** a pool that scales with the wrong machine.
**Cause:** the formula's `core_count` was read as the local machine's.
**Fix:** it is the database server's physical core count.

**⚠️ Counting hyperthreads**
**Symptom:** a pool exactly twice the size it should be.
**Cause:** `nproc` and most dashboards report logical CPUs.
**Fix:** the quoted formula says core count *"should not include HT threads, even
if hyperthreading is enabled"*.

**⚠️ Adding spindles for flash storage**
**Symptom:** an inflated `effective_spindle_count` on an all-NVMe database.
**Cause:** reading the term as "how fast is the disk".
**Fix:** it models seek-blocking. Fully-cached working set → **0**; flash has no
seeks, so the term trends to zero.

**⚠️ Taking the formula's output as final**
**Symptom:** a number defended in review that was never load-tested.
**Cause:** the formula is quoted more often than the sentence next to it.
**Fix:** the wiki calls it a starting point and tells you to test around it.

**⚠️ Copying a pool size between environments**
**Symptom:** staging is fine, production is not — or the reverse.
**Cause:** the formula's inputs are the database's cores and its cache hit rate,
and those differ per environment.
**Fix:** size per environment. It is one number in configuration; it is allowed
to differ.

## Interview questions

**★ Why does a bigger pool often make throughput worse?**
Because a connection is not a worker, it is permission to make the database work
concurrently, and the database has a fixed amount of concurrency in it. Past the
point where its CPUs and disks are saturated, extra connections do not create
capacity — they create context switching between backend processes, more lock
contention and more memory in use. On PostgreSQL each connection is a separate
process, so the cost is unusually direct. Every query then slows down, so each
connection is held longer, so the queue you were trying to shorten grows. Oracle's
demonstration showed response times falling from about 100 ms to about 2 ms
purely by cutting the pool from 2048 to 96, with no other change.

**★ What is the pool sizing formula, and what do people get wrong in it?**
`((core_count * 2) + effective_spindle_count)`, quoted by HikariCP from the
PostgreSQL project. Three things get dropped. First, `core_count` is the
*database* server's cores, not the application server's. Second, it excludes
hyperthreads, which is exactly what `nproc` reports, so people routinely double
it by accident. Third, `effective_spindle_count` is zero when the active data set
is fully cached and models seek-blocking rather than disk speed, so on flash or a
well-cached database it contributes nothing. For a four-core server the formula
gives nine, which HikariCP rounds to ten — its default.

**★ What does "you want a small pool saturated with threads waiting" mean?**
That threads queuing for a connection is the intended state, not an incident. The
queue is where excess load is held, in your application, where it is cheap and
where you can see it per request. If you enlarge the pool so that nobody waits,
the waiting has not disappeared — it has moved into the database, where it is
more expensive and effectively invisible. The pool is a deliberate throttle on
how much work the database is ever asked to do simultaneously, and sizing it is
setting that throttle.

**★ Your database has moved to NVMe storage. Does that mean a bigger pool?**
The opposite, and this is the question that catches people. The reason a pool can
usefully exceed the core count at all is that connections *block* on I/O, freeing
a CPU to run another. Fast storage removes the blocking, so there is less idle
CPU to fill, and the ideal number moves back toward the core count. HikariCP's
wiki calls the opposite intuition *"exactly 180 degrees backwards"*. The same
logic applies to a working set that fits in cache, which is why
`effective_spindle_count` is zero in that case.

**★ Does the answer change with virtual threads?**
Not in the direction people hope. Virtual threads make it cheap to have a million
threads in the JVM, but they do nothing to the database's capacity — it still has
the same cores and the same storage. So the pool size stays where the formula
puts it, and far more threads than before end up waiting at it. That is
consistent with the axiom, but it does raise the stakes on two other settings:
`connectionTimeout`, because a million threads can now pile up behind a pool of
ten, and whatever limits admission at the edge of your service, because the pool
is no longer the first thing that runs out.

**★ Ten connections for three thousand users sounds impossible. Explain it.**
Each connection is only busy for the duration of a query, which for a normal
request-path query is milliseconds. A user "using the database" is really a
sequence of very short bursts separated by network time, think time and
application work. So a small number of connections, kept busy back-to-back,
serves a very large number of users — HikariCP's page wagers that a four-core
server with a pool of ten handles 3000 front-end users at 6000 TPS. The intuition
that fails is treating a connection as something a user *holds*, when it is
something a query *borrows*.

---

← Prev: [1 · What the pool hands you](01-what-the-pool-hands-you.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [3 · The deadlock floor](03-the-connection-budget.md)
