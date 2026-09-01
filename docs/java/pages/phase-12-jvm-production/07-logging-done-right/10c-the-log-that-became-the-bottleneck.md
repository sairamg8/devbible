---
title: "Every log write takes the same lock, so logging turns an embarrassingly parallel workload into a serialised one — and because the contention is inside a library nobody profiles, the thread dump shows two hundred threads blocked on a monitor in `ch.qos.logback` and the team spends the afternoon looking at the database"
sidebar_label: "10c · When logging is the bottleneck"
sidebar_position: 24
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Logback** sources on the `master` branch as of this date —
> [`OutputStreamAppender`](https://github.com/qos-ch/logback/blob/master/logback-core/src/main/java/ch/qos/logback/core/OutputStreamAppender.java),
> which extends `UnsynchronizedAppenderBase`, declares
> `protected final ReentrantLock streamWriteLock = new ReentrantLock(false)` with the comment
> *"All synchronization in this class is done via the lock object"*, takes that lock in
> `writeBytes`, and whose `writeByteArrayToOutputStreamWithPossibleFlush` performs
> `outputStream.write(byteArray)` followed by `outputStream.flush()` when `immediateFlush` is set
> (default `true`); and
> [`AsyncAppenderBase`](https://github.com/qos-ch/logback/blob/master/logback-core/src/main/java/ch/qos/logback/core/AsyncAppenderBase.java)
> for the blocking `putUninterruptibly()` path. Also the JDK 25 tool reference for
> `jcmd Thread.print`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)).
> 🔴 **No sandbox.** No timing, throughput or latency figure on this page is a measurement; the
> shapes described are derived from the quoted source, not observed.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**A service that scales linearly to some number of concurrent requests and then flatly refuses to
go further has a serialisation point somewhere. Logging is a candidate that almost nobody
considers, because logging is not thought of as shared mutable state — and yet every thread in the
application writes to the same appender, which writes to the same stream, behind the same lock.**

## The mechanism

Logback's `OutputStreamAppender` is explicit about it:

```java
protected final ReentrantLock streamWriteLock = new ReentrantLock(false);
```

with the class comment *"All synchronization in this class is done via the lock object"*. Every
write goes through:

```java
streamWriteLock.lock();
try {
    if (isStarted()) {
        writeByteArrayToOutputStreamWithPossibleFlush(byteArray);
        updateByteCount(byteArray);
    }
} finally {
    streamWriteLock.unlock();
}
```

and, with the default `immediateFlush = true`, that inner call is:

```java
this.outputStream.write(byteArray);
if (immediateFlush) {
    this.outputStream.flush();
}
```

So the critical section contains a **write and a flush** — a syscall — and it is held by one
thread at a time across the entire application. Two structural facts follow:

- **Logging throughput has a ceiling that does not improve with more cores.** Adding threads adds
  contenders for one lock, not additional log throughput.
- 🔴 **`new ReentrantLock(false)` is an *unfair* lock.** That is the right choice for throughput —
  fair locks are substantially slower — and it means there is no queueing guarantee: an unlucky
  thread can wait considerably longer than average. The symptom is therefore in the **tail**, not
  the mean, which is why it evades average-based dashboards and shows up as p99 latency.

## Why the destination decides everything

The lock is held for the duration of the write, so **how slow the destination is directly sets how
long the lock is held**:

| Destination | Character of the write |
|---|---|
| Console, to a collected stream | A pipe write. Fast — until the reader stops draining |
| File on a local SSD | Fast, until the page cache is under pressure or the disk is contended |
| File on network storage | Network latency, per event, inside the lock |
| A socket appender to a collector | The collector's availability is now on your request path |

The console case has a trap worth naming, because it contradicts the advice in
[10](10-appenders-and-async.md) at exactly one point: **a pipe has a buffer, and if the process
reading it stops draining, the write blocks.** A log collector that stalls can therefore block the
application writing to stdout. Writing to the stream is still the right default for all the
reasons in [10](10-appenders-and-async.md) — but "stdout is always fast" is not one of them.

## What it looks like from outside

The diagnosis is quick once you suspect it, and essentially impossible if you do not. The
signature in a thread dump — `jcmd <pid> Thread.print`,
[05 · Thread dumps](../05-thread-dumps/README.md):

- Many threads in `BLOCKED` or `WAITING`, with `ch.qos.logback` frames near the top of the stack.
- One thread actually inside the write, frequently in a syscall.
- The blocked threads spread across unrelated endpoints — which is the tell that this is
  infrastructure rather than a hot code path.

Two dumps a few seconds apart make it conclusive: the same lock, different waiters.

The metric signature is a specific and counter-intuitive combination:

- **Throughput flat as concurrency rises.** More load, same completion rate.
- **CPU well below saturation.** Threads are waiting, not computing — which is why "add more CPU"
  does nothing and is usually tried first.
- **Latency degradation in the tail only**, because of the unfair lock.
- **No corresponding change in database or downstream metrics**, which is what sends people
  looking in the wrong place: every dependency looks healthy, because every dependency *is*
  healthy.

## How it starts

It is rarely present from day one. The usual sequences:

- **A level was raised** and never lowered — [08](08-what-never-to-log.md)'s temporary DEBUG.
  Volume goes up by an order of magnitude with no code change and no deploy to correlate against.
- **An exception became common.** Each one is a large log event with a stack trace, and if it is
  double-logged ([09](09-exceptions-in-logs.md)) it is several. The failure that caused the
  exceptions and the slowdown caused by logging them are then hard to disentangle, and the logging
  cost keeps the system slow after the original fault is fixed.
- **The destination got slower.** The disk filled, the collector degraded, the volume mount became
  contended. Nothing in the application changed.
- **A logging call moved onto a hot path.** A line added inside a loop, or a method that became
  much more frequently called.

The middle one is the important pattern: **logging turns a fault into a bigger fault**, because
the response to an error is to produce a large log event, and errors arrive in bursts.

## The remedies, in the order they are worth trying

1. **Log less.** Almost always available and almost never the first suggestion. The composition is
   usually double-logged exceptions, a DEBUG level left on, and per-request INFO lines nobody
   reads.
2. **Fix the destination.** A full disk, a contended mount or a stalled collector is the cause in
   a large fraction of cases, and no logging configuration change addresses it.
3. **Async, with its defaults understood.** This moves the write off the request thread and is the
   remedy people reach for first. It bounds the damage rather than removing it — the queue is 256
   events by default, discarding begins at 80% full, and the default `neverBlock=false` puts the
   application thread back into a blocking wait when the queue is full.
   [10b](10b-async-appender.md) is required reading before enabling it, because a misconfigured
   async appender converts a throughput problem into silent data loss.
4. **Sampling.** Keep the first N occurrences per signature per interval and count the rest.
   Preserves the diagnosis and removes the bulk.
5. **`immediateFlush=false`** — last, and reluctantly, because it costs you the lines before a
   crash ([10](10-appenders-and-async.md)).

Note what is *not* on the list: more CPU, more replicas, or a bigger instance. A serialisation
point is not relieved by adding capacity on the other side of it.

## Gotchas

**★ Every appender write takes one lock, so logging serialises an otherwise parallel
application.**
`OutputStreamAppender` holds `streamWriteLock` across the write and the flush. Threads do not log
in parallel; they queue.

**★ The lock is unfair, so the damage lands in the tail rather than the mean.**
`new ReentrantLock(false)` is correct for throughput and offers no queueing guarantee. Average
latency can look fine while p99 is badly degraded, which is exactly the profile that evades
mean-based dashboards.

**★ The critical section contains a flush syscall by default.**
`immediateFlush` is `true`, so every event writes *and* flushes while holding the lock. The lock
hold time is therefore a syscall's duration, not a memcpy's.

**★ How slow the destination is sets how long the lock is held.**
Network storage or a socket appender puts remote latency inside a lock every thread in the
application needs. That is the shape of the worst version of this problem.

**★ Writing to stdout can block if the collector stops draining the pipe.**
A pipe has a finite buffer. Stdout is still the right default for a container, but "stdout is
always fast" is not the reason — it is fast until something stops reading.

**★ CPU below saturation with flat throughput is the signature, and it makes people add CPU.**
Threads are blocked, not computing. Scaling up does nothing, scaling out multiplies the
configuration without fixing it, and both are tried before anyone looks at logging.

**★ Downstream metrics all look healthy, which sends the investigation to the database.**
Every dependency is fine, because the contention is inside the process. The absence of a
downstream signal is evidence *for* this diagnosis and is universally read as evidence against it.

**★ An error burst makes the logging cost worst exactly when the system is already failing.**
Errors produce large events with stack traces, often logged several times. The logging cost then
outlives the original fault and keeps the system slow after it is fixed.

**★ A level raised for debugging can produce this with no code change to correlate against.**
Volume rises by an order of magnitude, there is no deploy, and the change that caused it is a
configuration edit nobody recorded.

**★ Async is the fix people reach for first and it bounds the damage rather than removing it.**
The queue is 256 events, discarding starts at 80% full, and the default full-queue behaviour is to
block the application thread. Enabling it without reading [10b](10b-async-appender.md) trades a
throughput problem for silent data loss.

**★ Logging appears in no profile anyone runs, because nobody profiles infrastructure.**
A CPU profile shows little — the threads are blocked, not burning cycles — and a wall-clock
profile or a thread dump is what reveals it. That instrument mismatch is most of why this
diagnosis takes so long.

**★ More replicas do not fix a per-process serialisation point.**
Each replica has its own lock and its own ceiling, so horizontal scaling multiplies the ceiling
without raising any individual instance's. It looks like it worked, right up until per-instance
load rises again.

## Interview questions

**★ How can logging become a throughput bottleneck?**
Because every thread in the application writes through the same appender, and the appender
serialises. Logback's `OutputStreamAppender` holds a single `ReentrantLock` across the write, and
with `immediateFlush` defaulting to true that critical section contains a flush — a syscall — so
the lock is held for the duration of an I/O operation rather than a memory copy. Once the log rate
is high enough that threads arrive at the lock faster than it can be released, the application's
throughput is capped by the appender, and adding threads or cores adds contenders rather than
capacity. The lock is deliberately unfair, which is the right choice for throughput and means
there is no queueing guarantee, so the visible damage is in the latency tail rather than the mean.
What makes it hard to find is that nobody thinks of logging as shared mutable state — it looks
like a side effect, not a synchronisation point.

**★ Throughput is flat, CPU is at 40%, and every downstream dependency looks healthy. What do you
check?**
That combination is close to diagnostic of an in-process serialisation point, and logging is one
of the two or three usual suspects. Flat throughput with spare CPU means threads are waiting
rather than working; healthy downstreams mean they are not waiting on anything external. So the
next step is a thread dump — `jcmd <pid> Thread.print` — and specifically what the blocked threads
have in common. If many of them are BLOCKED with `ch.qos.logback` frames near the top, spread
across unrelated endpoints, that is the answer: unrelated endpoints is the tell that the
contention is infrastructural rather than a hot path in one feature. Two dumps a few seconds apart
confirm it by showing the same lock with different waiters. The reason this takes teams a long
time is that the healthy downstream metrics feel like the absence of a lead, when they are
actually the strongest piece of evidence — they rule out everything outside the process.

**★ Why does adding CPU or replicas not help?**
Because the constraint is a lock, and a lock is not relieved by capacity on either side of it.
Adding cores gives you more threads arriving at the same single-threaded critical section, which
increases contention rather than throughput — the classic shape where a scaling change makes the
tail worse. Adding replicas is subtler: each replica has its own appender and its own lock, so
horizontal scaling does multiply total capacity, and it looks like a fix. What it does not do is
raise any individual instance's ceiling, so per-instance load creeping back up reproduces the
problem at a higher cost, and the underlying defect is now spread across more machines. The
remedies that actually work reduce the work inside the lock or the number of times it is taken:
log less, make the destination faster, move the write off the request thread with a properly
configured async appender, or sample repetitive events.

**★ You enable an async appender to fix this and the problem partially persists. Why?**
Most likely because the async appender's queue is full and the default configuration blocks. The
queue is 256 events by default, and when it is full `AsyncAppenderBase.put()` calls
`putUninterruptibly()` unless `neverBlock` is set — which loops on `blockingQueue.put()` and
therefore stalls the application thread, putting the request path back behind logging with a queue
in front of it. So under sustained load you have relocated the contention rather than removed it,
because the async appender adds burst tolerance and a single worker thread, not throughput: if the
destination cannot keep up with the sustained rate, nothing downstream of the queue got faster.
The second possibility is that it partially worked and hid the rest — discarding begins at 80%
full and silently drops everything at INFO and below, so some of the apparent improvement may be
events no longer being written at all. Both point at the same conclusion: async is a buffer for a
temporary stall, and a persistently full buffer means the real problem is the log volume or the
destination.

**★ An error burst starts and the whole service slows down, then stays slow after the errors stop.
Explain.**
The errors produced log events, and error log events are large — a stack trace through a framework
stack is dozens of lines, a `Caused by:` chain multiplies it, and if the exception is logged at
several layers on its way up, one failure becomes several hundred lines. That volume hits the
appender's lock, so the logging serialisation point saturates and every thread in the application
— including ones handling requests that are succeeding — queues behind it. The reason it persists
after the errors stop is queueing: the backlog of log events still has to be written, and if an
async appender is in front of it, that backlog is bounded by the queue while the worker drains at
the destination's speed. Meanwhile the slowdown itself may generate more errors — timeouts
downstream, rejected executions — which produces more log events, which is a feedback loop. It is
a good illustration of why the double-logging rule in [09](09-exceptions-in-logs.md) is a
production-reliability rule and not a tidiness one.

**★ Is writing to stdout immune to this?**
No, and it is worth being precise because the container guidance in
[10](10-appenders-and-async.md) can be over-read. Stdout in a container is a pipe, a pipe has a
finite buffer, and a write to a full pipe blocks until the reader drains it. So if the platform's
log collector stalls — it is restarting, its own destination is unavailable, it is being throttled
— the application's writes block, inside the appender's lock, and you get exactly the contention
described here with no disk and no file appender involved. The reason stdout is still the right
default is everything in [10](10-appenders-and-async.md): the platform owns rotation, retention,
shipping and disk, and a local file re-creates four problems while removing none. But "stdout is
always fast" is not part of the argument, and a team that believes it will not check the collector
when this happens.

{/* FOOTER */}
