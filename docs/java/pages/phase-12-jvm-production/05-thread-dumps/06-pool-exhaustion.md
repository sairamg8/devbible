---
title: "The most common answer a thread dump gives is a shape rather than a stack: N threads with the same name prefix, all in the same frame, where N is exactly the pool's configured maximum — and the pool is never the bug, it is the place the bug became visible"
sidebar_label: "06 · Pool exhaustion"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **`java.lang.Thread.State` API documentation** for the state
> semantics
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.State.html)),
> and the **JDK 25 Troubleshooting Guide**, "Troubleshoot Process Hangs and Loops → Diagnose a
> Hung Process"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshoot-process-hangs-loops.html)).
> 🔴 **No sandbox** — every dump fragment below is a marked schematic.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Pool exhaustion is what most "the service stopped responding" incidents turn out to be, and it
is the one finding you can make at a glance rather than by reading. You are not looking for a
thread; you are looking for a *count*. When the number of threads sharing a name prefix and a top
frame equals the pool's configured maximum, the pool is saturated — and the interesting question
immediately becomes what those threads are all waiting for, because that is the actual failure.**

## The shape

```text
"http-nio-8080-exec-1"  ... java.lang.Thread.State: RUNNABLE
        at java.base/sun.nio.ch.SocketDispatcher.read0(Native Method)
        ...
        at com.example.InventoryClient.check(InventoryClient.java:41)

"http-nio-8080-exec-2"  ... java.lang.Thread.State: RUNNABLE
        at java.base/sun.nio.ch.SocketDispatcher.read0(Native Method)
        ...
        at com.example.InventoryClient.check(InventoryClient.java:41)

   ... 198 more identical blocks ...
```

*(Schematic. Frame names are illustrative of the shape, not a captured dump.)*

🔴 **Two hundred threads named `http-nio-8080-exec-*`, all in the same frame, against a
`server.tomcat.threads.max` of 200.** That is the entire diagnosis of *what* — the request pool is
fully consumed — and it took one count.

**The three things that make it conclusive:**

1. **The count equals the configured maximum.** Not "many threads", but exactly the limit. This
   is why knowing your pool sizes matters: 200 threads is meaningless; 200 out of 200 is
   definitive.
2. **They share a name prefix**, which identifies *which* pool.
3. **They share a top frame**, which identifies what they are all waiting for.

## Read it by counting, not by reading

A 400-thread dump is unreadable linearly. The operation that matters is grouping:

- Group threads by **name prefix** — that is the pool.
- Within a pool, group by **top frame** — that is what they are doing.
- Compare each count against the pool's **configured maximum**.

The output is a handful of lines, and saturation is obvious in it. This is the "read the
distribution, not the threads" argument from [04](04-the-thread-states.md), applied to the case
where it pays off most.

⚠️ **You need the configured maximums to hand.** `server.tomcat.threads.max`, the executor's
`maximumPoolSize`, the connection pool's `maximumPoolSize`, the HTTP client's connection limits.
Without them you are looking at a number with no baseline. Recording them in the runbook is a
five-minute task that repeatedly saves an hour.

## The pool is never the bug

This is the part people get wrong, and it costs real outages.

**The instinct on finding an exhausted pool is to make it bigger.** Sometimes that is right —
the pool genuinely was undersized for the load. Far more often the pool is exhausted because
**each thread is being held far longer than it should be**, and enlarging it buys a few seconds
before the larger pool is exhausted too, while adding memory pressure and context switching.

Little's Law is the whole argument: `threads needed = arrival rate × time held`. A pool of 200
handling 1,000 requests per second is fine at 50 ms per request and saturated at 500 ms. **Nothing
about the pool changed; the time held changed.** So the diagnostic question is never "is the pool
big enough" but "why is each thread held so long", and the top frame usually answers it.

🔴 **The top frame is the finding. The pool is the messenger.**

## What the top frame tells you

| Top frames | State | What it means |
|---|---|---|
| `SocketDispatcher.read0` / socket read | `RUNNABLE` | Waiting on a remote dependency. **Missing or excessive read timeout** — [04b](04b-runnable-does-not-mean-running.md) |
| `LockSupport.park` under a connection pool | `WAITING` / `TIMED_WAITING` | Waiting for a database connection — [06b](06b-the-connection-pool-in-a-dump.md) |
| `LockSupport.park` under a queue `take()` | `WAITING` | ⚠️ Usually **idle workers**, not exhaustion |
| `- waiting to lock` on one monitor | `BLOCKED` | Lock contention; find the holder — [05](05-locks-in-a-dump.md) |
| Application code, changing across dumps | `RUNNABLE` | Genuinely busy — the pool may really be undersized |
| Application code, unchanged across dumps | `RUNNABLE` | A loop — hand off to a profiler |

⚠️ **The third row is the false positive to watch for.** A fixed thread pool with 50 idle workers
parked on an empty queue looks superficially like the exhaustion shape: 50 threads, same name
prefix, same frame. The difference is that they are parked on the *queue*, waiting for work,
rather than parked inside a task. Reading one frame deeper distinguishes them instantly.

## Cascading exhaustion, and why the outermost pool lies

Pools chain, and the failure propagates outward:

1. The database gets slow.
2. Connection-pool waiters back up — the connection pool is exhausted.
3. Request threads block waiting for connections — the request pool is exhausted.
4. The service stops responding, and its callers' request pools begin to fill.

🔴 **A dump of the outermost service shows its request pool exhausted, which is true and
useless.** The chain has to be followed inward: the request threads' frames point at the
connection pool; the connection pool points at the database. **The last pool in the chain is the
one with the real answer**, and in a distributed system it may be in a different service
entirely.

This is also why one slow dependency can take down a system that does not depend on it directly —
the exhaustion propagates along the call graph. Bulkheads exist to stop it, and phase 16 owns
them.

## What to change

In rough order of how often it is the right answer:

1. **Add or reduce a timeout.** If threads are in a socket read, the reason the pool stays
   exhausted is that nothing ends the wait. A read timeout converts an outage into errors, which
   is a large improvement.
2. **Fix the slow thing.** If each request holds a thread for 500 ms because of one query, the
   query is the bug.
3. **Isolate.** A separate pool for calls to a flaky dependency means its saturation cannot
   consume the pool serving everything else.
4. **Stop holding the thread.** Asynchronous or reactive handling, or virtual threads
   ([07](07-virtual-threads.md)), so a waiting request does not occupy a platform thread at all.
   ⚠️ Note this removes the *thread* constraint and not the downstream one — the dependency is
   still slow, and now you can have a million requests waiting on it.
5. **Enlarge the pool** — last, and only with a Little's Law calculation showing it was genuinely
   undersized.

## Gotchas

**★ The count is the finding, not the stack.**
N threads sharing a name prefix and a top frame, where N is the configured maximum. Any smaller
number is ordinary load; the equality with the limit is what makes it saturation.

**★ You need the configured maximums to interpret the count.**
Two hundred threads in one frame is meaningless without knowing the pool's limit is two hundred.
Put the pool sizes in the runbook before the incident.

**★ The pool is the messenger, not the bug.**
Exhaustion means threads are being held too long, and the top frame says by what. Enlarging the
pool without addressing the hold time buys seconds and adds memory and context-switching cost.

**★ Idle workers parked on an empty queue look like exhaustion at a glance.**
Same count, same name prefix, same frame. The distinction is that they are parked on the queue
waiting for work rather than parked inside a task — one frame deeper tells you which.

**★ The outermost pool's exhaustion is true and useless.**
Exhaustion cascades inward-out: database, connection pool, request pool, caller's request pool.
Follow the frames inward; the last pool in the chain is where the answer is.

**★ Little's Law is the whole sizing argument.**
Threads needed equals arrival rate times hold time. A pool that was correctly sized becomes
saturated purely because a dependency got slower, with nothing about the pool or the load having
changed.

**★ Unnamed pools make this diagnosis much harder.**
`pool-3-thread-1` does not tell you which subsystem is saturated when four unnamed pools exist.
Naming thread factories is the single highest-value change for dump readability
([03](03-anatomy-of-a-dump.md)).

**★ Virtual threads remove the thread limit, not the downstream limit.**
Moving to virtual threads means the request pool cannot be exhausted, but the slow dependency is
still slow, and now unbounded work can pile onto it. The constraint moves rather than disappearing
— which is why semaphores and bulkheads matter more, not less.

**★ Exhaustion at the moment of the dump does not prove it is sustained.**
A momentary spike can saturate a pool for one instant. Three dumps showing the same threads in the
same frames is what distinguishes saturation from a burst.

**★ A health check that passes during pool exhaustion is a health check that touches nothing.**
If every request thread is consumed and the probe still returns 200, the probe is not exercising
the path that is broken — which is why the failure reaches users before it reaches monitoring.

## Interview questions

**★ What does pool exhaustion look like in a thread dump?**
A count rather than a stack: N threads sharing a name prefix, all in the same top frame, where N
equals the pool's configured maximum. The name prefix identifies the pool, the top frame
identifies what they are all waiting for, and the equality with the limit is what makes it
saturation rather than ordinary load.

**★ You find the request pool exhausted. Do you make it bigger?**
Usually not first. Little's Law says threads needed equals arrival rate times hold time, so
exhaustion normally means hold time has grown rather than that the pool was wrong. The top frame
tells you what is holding them — typically a socket read on a slow dependency — and the fix is a
timeout, or fixing the slow thing, or isolating it. Enlarging the pool is the last option and
needs the arithmetic to justify it.

**★ How do you distinguish an exhausted pool from an idle one?**
Read one frame deeper. Idle workers are parked on the pool's *queue*, waiting for work to arrive;
exhausted workers are parked or blocked *inside a task*, waiting on something downstream. Both
present as many threads with the same name and the same state, so the top frames are what separate
them — and a second dump helps, since idle workers pick up work and move.

**★ Your service's request pool is exhausted and every thread is blocked getting a database
connection. Where is the bug?**
Not in the request pool, and probably not in the connection pool either. The chain runs outward
from the slowest point: the database is slow, so connections are held longer, so the connection
pool saturates, so request threads queue for connections, so the request pool saturates. The
diagnosis has to follow the frames inward to the last pool in the chain. Fixing the request pool
size changes nothing about the query that is slow.

**★ Would moving to virtual threads solve pool exhaustion?**
It removes that particular symptom — with a virtual thread per request there is no fixed pool to
exhaust. But the downstream constraint is untouched: the dependency is still slow, and now
unbounded requests can pile onto it, so you can turn a bounded queue into an unbounded one. The
constraint moves from the thread pool to the connection pool or the dependency itself, which makes
explicit limits like semaphores and bulkheads more important rather than less.

**★ How do you read a 400-thread dump quickly?**
By grouping rather than reading. Group threads by name prefix to identify pools, group by top
frame within each pool to identify what they are doing, and compare each count against the
configured maximum. That reduces the file to a handful of lines in which saturation is immediately
visible. Reading individual thread blocks comes afterwards, only for the group that looks wrong.

**★ Why does one slow dependency take down services that do not call it?**
Because exhaustion propagates along the call graph. The service that calls it has its pool consumed
waiting; it becomes unresponsive; its callers' pools fill waiting on it; and so on outward. Each
hop looks locally like "my thread pool is exhausted", which is true and points at the wrong place.
Bulkheads — separate pools per dependency — exist to stop the propagation at the first hop.

{/* FOOTER */}
