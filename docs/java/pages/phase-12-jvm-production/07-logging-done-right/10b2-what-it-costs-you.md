---
title: "The async appender's two quiet side effects are that every pattern referring to file, method or line silently renders nothing, and that shutdown waits exactly one second for the queue before abandoning it — so the configuration bought latency at the cost of the two things you reach for when a service is dying"
sidebar_label: "10b2 · What it costs you"
sidebar_position: 23
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Logback** sources on the `master` branch as of this date —
> [`AsyncAppender`](https://github.com/qos-ch/logback/blob/master/logback-classic/src/main/java/ch/qos/logback/classic/AsyncAppender.java),
> whose `preprocess` calls `eventObject.prepareForDeferredProcessing()` and then
> `eventObject.getCallerData()` only when `includeCallerData` is set; and
> [`AsyncAppenderBase`](https://github.com/qos-ch/logback/blob/master/logback-core/src/main/java/ch/qos/logback/core/AsyncAppenderBase.java),
> whose `stop()` calls `worker.join(maxFlushTime)` with `DEFAULT_MAX_FLUSH_TIME = 1000` and then
> warns *"Max queue flush timeout (… ms) exceeded. Approximately …"*.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**[10b](10b-async-appender.md) covered the queue and its discard policy — the behaviours that lose
events under load. This page is the two side effects that are not about load at all: caller data
that silently stops being captured, and a shutdown window of one second. Both are correct
engineering decisions by Logback, both are invisible in the configuration that triggers them, and
both remove information at the moment a service is in trouble.**

## Caller data disappears

`preprocess` in logback-classic:

```java
protected void preprocess(ILoggingEvent eventObject) {
    eventObject.prepareForDeferredProcessing();
    if (includeCallerData)
        eventObject.getCallerData();
}
```

Caller data — the class, method, file and line number — can only be captured on the thread that
logged, because it comes from that thread's stack. The worker thread does not have it. With
`includeCallerData` false, which is the default, **any pattern using `%class`, `%method`, `%file`
or `%line` silently renders unavailable values for every event through this appender.**

That is the correct default: capturing caller data means walking the stack per event, which is the
same expense as [09b](09b-stack-traces-that-cost-you.md)'s stack trace and would defeat the point
of the async appender several times over. The problem is that the loss is silent — a configuration
that adds an async appender to an existing pattern containing `%line` degrades the output of every
line with nothing to indicate it.

## The memory the queue holds

The queue holds `ILoggingEvent` objects, not rendered strings — encoding happens downstream, on
the worker thread. Each retained event holds its message, its argument array, its MDC map copy and,
if present, its `Throwable`. That has two consequences people do not anticipate when they raise
`queueSize` from 256 to 100,000 as a fix for a full queue:

- **The queue is a heap cost proportional to event size, not event count alone.** Events carrying
  exceptions are large — a `Throwable` retains its frames — so a queue full of errors is
  dramatically heavier than a queue full of INFO lines, and a queue fills with errors precisely
  during an incident.
- **The argument array keeps your objects alive.** A parameterised message holds references to
  the arguments until the event is encoded. A large object passed as a log argument is therefore
  retained for as long as the event sits in the queue, which turns a logging buffer into an
  unexpected contributor to the live set — [02 · GC in practice](../02-gc-in-practice/README.md).

`prepareForDeferredProcessing()` exists to bound some of this: it forces the MDC copy and the
formatted message to be materialised on the logging thread rather than lazily on the worker, which
is what makes deferred processing safe when the MDC is about to change. It does not detach the
argument references.

## Shutdown

`stop()` calls `worker.join(maxFlushTime)` — 1000 ms by default — and if the queue has not drained
it warns:

```java
"Max queue flush timeout (" + maxFlushTime + " ms) exceeded. Approximately ..."
```

**Events still in the queue at that point are lost.** For a service being shut down because
something is wrong, the final seconds of logging are the interesting ones, and one second is not
long. This interacts directly with graceful shutdown — **12 · Graceful
shutdown** *(not written yet)* — and with the fact that a SIGKILL gives `stop()` no
opportunity to run at all.

## Configuring it deliberately

If you keep an async appender, the defaults to revisit are all of them:

- **`queueSize`** — 256 is a smoothing buffer. Thousands is a buffer that survives a stall. The
  cost is memory: the events are retained objects, so a very large queue under a burst is a heap
  consideration.
- **`discardingThreshold=0`** — disables level-based discarding entirely, so the queue behaves as
  a pure buffer and the `neverBlock` decision governs the full-queue case alone. Worth doing if
  losing INFO silently is unacceptable, at the price of hitting the blocking-or-dropping boundary
  sooner.
- **`neverBlock`** — decided explicitly, per the trade above.
- **`maxFlushTime`** — raised, if a longer shutdown is acceptable.
- **`includeCallerData`** — left `false`, with the pattern audited to make sure it does not claim
  to print what will not be there.

## Gotchas

**★ `%line`, `%method`, `%class` and `%file` render nothing through an async appender by
default.**
Caller data is only available on the logging thread, and `includeCallerData` is `false`. Adding an
async appender to an existing pattern silently degrades every line it touches.

**★ Enabling `includeCallerData` walks the stack per event.**
It restores the fields at a cost comparable to filling in a stack trace — for every log event, not
just errors. It usually defeats the purpose of having the async appender at all.

**★ Shutdown waits 1000 ms and then abandons the queue.**
`worker.join(maxFlushTime)`, then a warning naming the approximate loss. The final seconds of
logging before a shutdown are the interesting ones, and one second is not long.

**★ A SIGKILL means `stop()` never runs, so the whole queue is lost.**
Anything not yet written by the worker thread is gone with the process. That is the queue's depth
worth of events, which is another reason a very large queue is not a free improvement.

**★ The queue holds event objects, not rendered strings, so its memory cost scales with event
size.**
A queue full of exceptions is far heavier than a queue full of INFO lines — and a queue fills with
exceptions during exactly the incident that filled it. Raising `queueSize` to a very large number
is a heap decision, not just a buffering one.

**★ A log argument stays reachable for as long as its event sits in the queue.**
The event retains its argument array until encoding. Passing a large object as a parameter turns
the logging buffer into a contributor to the live set, which is an unexpected way for logging to
show up in a heap dump.

**★ `prepareForDeferredProcessing()` materialises the MDC and the message on the logging
thread.**
That is what makes deferred processing correct when the MDC changes before the worker runs — see
[06b](06b-mdc-and-thread-pools.md). It does not release the argument references, so it bounds the
correctness problem and not the memory one.

**★ The one-second flush window and the graceful-shutdown period are two different timers.**
A pod given 30 seconds to drain still gives Logback 1000 ms for its queue. Raising the platform's
grace period does nothing for the appender unless `maxFlushTime` is raised too.

**★ Auditing the pattern is part of adding an async appender.**
If the pattern contains `%line`, `%method`, `%class` or `%file`, either remove them or accept that
they will be empty. Leaving them produces output that claims to carry information it does not.

## Interview questions

**★ You add an async appender and `%line` stops working. Why?**
Because caller data can only be obtained from the stack of the thread that logged, and the async
appender's worker thread is not that thread. Logback handles this in `preprocess`, which calls
`event.getCallerData()` only when `includeCallerData` is set — and it defaults to false. So the
class, method, file and line fields are never captured, and any pattern referring to them renders
unavailable values for every event through that appender. The default is the right one, because
capturing caller data means walking the stack on every single log event, which costs roughly what
filling in a stack trace costs and would comfortably exceed the savings the async appender was
providing. What makes it a trap is that it is silent: adding an async appender to an existing
configuration degrades the output of every line matching that pattern with nothing to indicate a
change, and the person who notices is a future reader trying to locate a message.

**★ What happens to queued events when the application shuts down?**
`stop()` calls `worker.join(maxFlushTime)`, which defaults to 1000 ms, and if the queue has not
drained by then it logs a warning naming approximately how many events were affected and gives up
— those events are lost. That is a short window, and the events at risk are the last ones written,
which during a shutdown triggered by a problem are the ones you most want. It also assumes
`stop()` runs at all: an orderly shutdown gives Logback its shutdown hook, but a SIGKILL — after a
graceful-shutdown timeout expires, or from an OOMKill — does not, and then the entire queue goes
with the process. That is worth factoring into the queue-size decision, because a very large queue
increases burst tolerance and simultaneously increases how much is lost when the process dies
abruptly. It also argues for treating the async appender's shutdown as part of the graceful
shutdown design rather than as an independent setting.

**★ Raising `queueSize` from 256 to 100,000 — what have you actually changed?**
Three things, only one of which is the intended one. You have increased burst tolerance, which is
the goal: a downstream stall now has to last far longer before discarding or blocking begins. You
have also increased the amount of memory the logging subsystem can hold, and in a way that is not
proportional to the number alone — the queue holds `ILoggingEvent` objects rather than rendered
strings, each retaining its message, its argument array, its MDC copy and any attached
`Throwable`, so a queue full of exceptions during an incident is very much heavier than the same
queue full of INFO lines. And you have increased how much is lost when the process dies abruptly,
because everything in the queue goes with a SIGKILL and only one second of it is flushed on an
orderly stop. So the honest framing is that a bigger queue trades a larger heap footprint and a
larger potential loss for tolerance of longer stalls — which is a good trade if stalls are brief
and rare, and a way of postponing a diagnosis if the queue is persistently full.

**★ Your pod has a 30-second termination grace period. Does the async appender use it?**
No — those are two independent timers, and the appender's is 1000 ms regardless of what the
platform allows. `AsyncAppenderBase.stop()` calls `worker.join(maxFlushTime)`, and
`DEFAULT_MAX_FLUSH_TIME` is 1000; if the queue has not drained it warns and abandons the
remainder. So a generous grace period configured for connection draining does nothing for log
completeness unless `maxFlushTime` is raised deliberately to match. It is worth checking the
ordering too: the appender only gets its second when Logback's shutdown runs, which is at the end
of the JVM's shutdown sequence, so a shutdown that hangs elsewhere can consume the entire grace
period and then be SIGKILLed — at which point `stop()` never runs at all and the whole queue is
lost rather than most of it. Treating the logging flush as part of the graceful-shutdown design,
rather than as an unrelated appender setting, is the fix.

{/* FOOTER */}
