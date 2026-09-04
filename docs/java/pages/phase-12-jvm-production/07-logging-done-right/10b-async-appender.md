---
title: "Logback's async appender holds 256 events, starts silently discarding everything at INFO and below once it is 80% full, blocks your application thread when it is completely full, and drops file-and-line information from every line it handles — and all four of those are the documented defaults nobody configures"
sidebar_label: "10b · The async appender"
sidebar_position: 22
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Logback** sources on the `master` branch as of this date —
> [`AsyncAppenderBase`](https://github.com/qos-ch/logback/blob/master/logback-core/src/main/java/ch/qos/logback/core/AsyncAppenderBase.java),
> which declares `DEFAULT_QUEUE_SIZE = 256`, `discardingThreshold = UNDEFINED (-1)` resolved in
> `start()` to `queueSize / 5`, `neverBlock = false`, `DEFAULT_MAX_FLUSH_TIME = 1000`, the
> `append()` guard `isQueueBelowDiscardingThreshold() && isDiscardable(eventObject)`, the
> definition `remainingCapacity() < discardingThreshold`, and `put()` choosing between
> `blockingQueue.offer()` and a `putUninterruptibly()` loop around `blockingQueue.put()`; and
> [`AsyncAppender`](https://github.com/qos-ch/logback/blob/master/logback-classic/src/main/java/ch/qos/logback/classic/AsyncAppender.java),
> whose `isDiscardable` returns `level.toInt() <= Level.INFO_INT` and whose `preprocess` calls
> `getCallerData()` only when `includeCallerData` is set.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**`AsyncAppender` is added to configurations as an unqualified good: move logging off the request
thread, get the latency back. It does do that. It also introduces a bounded queue with a discard
policy, a blocking policy, and a data-loss behaviour at shutdown — and every one of those is
governed by a default that is smaller or more aggressive than people assume. This page is what the
defaults actually are, read out of the source, because the difference between the belief and the
behaviour is where the incidents come from.**

## The four defaults

From `AsyncAppenderBase`:

```java
public static final int DEFAULT_QUEUE_SIZE = 256;
int queueSize = DEFAULT_QUEUE_SIZE;

static final int UNDEFINED = -1;
int discardingThreshold = UNDEFINED;
boolean neverBlock = false;

public static final int DEFAULT_MAX_FLUSH_TIME = 1000;
int maxFlushTime = DEFAULT_MAX_FLUSH_TIME;
```

and, in `start()`:

```java
if (discardingThreshold == UNDEFINED)
    discardingThreshold = queueSize / 5;
```

So the effective defaults are:

| Property | Default | What it means |
|---|---|---|
| `queueSize` | **256** | The whole buffer. Not 256 KB — 256 *events* |
| `discardingThreshold` | **51** (`queueSize / 5`) | Discarding begins when free capacity drops below this — i.e. at **80% full** |
| `neverBlock` | **false** | When the queue is completely full, the application thread **blocks** |
| `maxFlushTime` | **1000 ms** | How long `stop()` waits for the queue to drain before abandoning it |
| `includeCallerData` | **false** | File, line and method are **not** captured |

**256 events is the number that surprises everyone.** A service handling a few hundred requests
per second with a handful of log lines each fills that in well under a second if the appender
stalls at all. The queue is a smoothing buffer for brief hiccups, not a reservoir.

## What "discarding" actually discards

The `append()` path is:

```java
if (isQueueBelowDiscardingThreshold() && isDiscardable(eventObject)) {
    return;
}
preprocess(eventObject);
put(eventObject);
```

with

```java
public boolean isQueueBelowDiscardingThreshold() {
    return (blockingQueue.remainingCapacity() < discardingThreshold);
}
```

and, in logback-classic's `AsyncAppender`:

```java
protected boolean isDiscardable(ILoggingEvent event) {
    Level level = event.getLevel();
    return level.toInt() <= Level.INFO_INT;
}
```

Three consequences, and they are the heart of this page:

1. 🔴 **TRACE, DEBUG and INFO are dropped. WARN and ERROR are not.** The policy is deliberate and
   sensible — keep the important events, shed the routine ones — and it is also invisible. There is
   no exception, no error, and no log line saying it happened.
2. 🔴 **Discarding begins at 80% full, not at 100%.** With the defaults, once 205 of the 256 slots
   are occupied, every INFO-and-below event is dropped. A service that is briefly busy loses its
   INFO logging without any indication.
3. **`return` is silent.** The event does not reach the encoder or the appender. Nothing counts
   it. The only way to know is to notice the absence — which, for INFO-level logging, means
   noticing that a line you expected is missing from a log you were not reading at the time.

That last one deserves the sharpest statement available: **your INFO logging is best-effort, and
it degrades first under exactly the load conditions that make you want to read it.**

## `neverBlock`, and the choice it forces

When the queue is genuinely full and the event is not discardable — a WARN or an ERROR — `put()`
decides:

```java
protected void put(E eventObject) {
    if (neverBlock) {
        blockingQueue.offer(eventObject);
    } else {
        putUninterruptibly(eventObject);
    }
}
```

`offer()` on a full bounded queue returns `false` immediately and the event is dropped.
`putUninterruptibly()` loops around `blockingQueue.put()`, swallowing interrupts and restoring the
interrupt flag afterwards — so it **blocks the application thread until space appears**.

The default is `neverBlock = false`, which means blocking. Read that against the reason the
appender was added: it was introduced to keep logging off the request thread's critical path, and
under sufficient pressure it puts the request thread back on it — while queued, so the block is
now behind a queue rather than behind a single write. This is the mechanism behind the incident in
[10c](10c-the-log-that-became-the-bottleneck.md).

So there is a genuine choice with no default-correct answer:

- **`neverBlock = false`** (the default): never lose a WARN or ERROR, at the cost of application
  threads stalling when the downstream appender cannot keep up.
- **`neverBlock = true`**: never stall the application, at the cost of silently losing WARN and
  ERROR events under pressure — including, quite possibly, the ones describing the pressure.

For a request-serving application where availability outranks log completeness, `neverBlock=true`
with a much larger `queueSize` is usually the better configuration, provided the audit-grade
events of [08b](08b-masking-and-the-audit-trail.md) are not in this pipeline. For a system where a
missing WARN is a compliance problem, it is the wrong choice — and the right answer there is that
those events should not be going through an async appender at all.

## Gotchas

**★ `queueSize` defaults to 256 events, and that is smaller than almost anyone assumes.**
It is a smoothing buffer for a momentary stall, not a reservoir. A moderately busy service fills
it in a fraction of a second if the downstream appender pauses at all.

**★ Discarding starts at 80% full, not when the queue is full.**
`discardingThreshold` resolves to `queueSize / 5`, and the test is `remainingCapacity() <
discardingThreshold`. With the defaults, INFO and below start disappearing once 205 of 256 slots
are used.

**★ TRACE, DEBUG and INFO are discarded; WARN and ERROR are not.**
`isDiscardable` returns `level.toInt() <= Level.INFO_INT`. The policy is sensible and completely
silent — no exception, no warning, no counter.

**★ Your INFO logging is best-effort, and it degrades under exactly the load you want to observe.**
The discard behaviour engages when the system is busy, which is when the log matters. Nothing in
the log indicates a gap.

**★ With the default `neverBlock=false`, a full queue blocks the application thread.**
`putUninterruptibly()` loops on `blockingQueue.put()` and swallows interrupts. The appender added
to keep logging off the request path puts it back on the request path under pressure.

**★ `neverBlock=true` silently drops WARN and ERROR when the queue is full.**
`offer()` returns `false` and the event is gone. It is the right trade for many services and it
must be a decision, because the events lost are the ones describing the incident.

**★ Audit-grade events must not go through this appender.**
Discarding is by design at two separate points. Any event with a delivery requirement needs a
different path — [08b](08b-masking-and-the-audit-trail.md).

**★ Wrapping a slow appender does not make it fast.**
The async appender relocates the work to a single worker thread. If that thread cannot keep up
with the sustained rate, the queue fills and you reach the discard-or-block boundary — the async
appender bought you burst tolerance, not throughput.

**★ `discardingThreshold=0` turns off level-based discarding.**
Then the queue is a pure buffer and only the full-queue case matters. It is the right setting when
silent INFO loss is unacceptable, and it makes the `neverBlock` decision more consequential rather
than less.

## Interview questions

**★ What are Logback's `AsyncAppender` defaults, and which one surprises people most?**
`queueSize` is 256 events; `discardingThreshold` is unset and resolves in `start()` to `queueSize
/ 5`, so 51; `neverBlock` is false; `maxFlushTime` is 1000 ms; `includeCallerData` is false. The
one that surprises people most is the combination of the first two, because it means discarding
begins when the queue is 80% full rather than when it is full — the check is `remainingCapacity()
< discardingThreshold` — and what gets discarded is everything at INFO and below, since
`isDiscardable` returns true for `level.toInt() <= Level.INFO_INT`. So on a default configuration,
once 205 of 256 slots are occupied, all INFO logging is silently dropped. There is no exception,
no warning and no counter; `append()` simply returns. The practical statement is that INFO
logging in this configuration is best-effort and degrades first under exactly the load conditions
that make someone want to read it.

**★ `neverBlock` — true or false, and why?**
It depends on whether availability or log completeness matters more, and the honest answer is that
neither default is universally right. With `neverBlock=false`, the default, a full queue sends the
application thread into `putUninterruptibly()`, which loops on `blockingQueue.put()` until space
appears — so no WARN or ERROR is ever lost, and your request threads stall behind logging, which
is precisely the outcome the async appender was added to prevent. With `neverBlock=true`, `put()`
becomes `offer()`, which returns false on a full queue and discards the event — so the application
never stalls, and you can lose WARN and ERROR events under pressure, quite possibly the ones
describing the pressure. For a request-serving application I would generally choose
`neverBlock=true` with a substantially larger `queueSize`, because a stalled request thread
degrades the actual service while a lost log line degrades the record of it. The exception is
anything with a delivery requirement — audit events, compliance-relevant records — and the correct
answer there is that those should not be flowing through an async appender at all.

**★ Your async appender's queue is constantly full. What is the actual problem?**
The downstream appender cannot keep up with the sustained log rate, and the async appender was
never going to fix that — it converts a per-event cost on the request thread into a queue plus a
single worker thread, which buys tolerance for bursts and adds no throughput. So a queue that is
persistently full means the worker is saturated, and there are only three real remedies: log less,
make the destination faster, or accept the loss deliberately. Log less is usually the correct one
and is the least popular: the double-logged exceptions of [09](09-exceptions-in-logs.md), DEBUG
left enabled on a package, and per-request INFO lines that nobody reads are the usual composition.
Making the destination faster generally means finding out why it is slow — a synchronous network
appender, a full disk, a flush per event — which is [10c](10c-the-log-that-became-the-bottleneck.md).
Raising `queueSize` treats a sustained problem with a buffer, which delays the symptom by exactly
the added capacity and then behaves identically.

**★ Why is silent discarding worse than a visible error?**
Because it removes the signal that would tell you to act, and it does so under precisely the
conditions where you would have acted. A visible error — an exception, a warning, a metric — makes
the loss a known quantity: you can alert on it, you can quantify the gap, and you know not to
trust the log for that window. Silent discarding produces a log that looks complete and is not, so
an investigator reconstructs a timeline from it and reaches a conclusion supported by absence
rather than by evidence. "The service did not process that request, because there is no log line"
is an inference the discard behaviour invalidates, and nothing in the log signals that. It is
worse still because the discarding is load-triggered: the gaps are concentrated exactly in the
busy periods that incidents happen in, so the log is least reliable precisely when it is being
used most carefully.

{/* FOOTER */}
