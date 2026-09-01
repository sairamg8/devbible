---
title: "OutOfMemoryError is a VirtualMachineError, which is the JVM's way of saying that the contract between your code and the runtime has already been broken — and the thread holding the stack trace is almost never the thread that broke it"
sidebar_label: "01 · Error, not exception"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 API documentation** for `java.lang.Error`,
> `java.lang.VirtualMachineError`, `java.lang.OutOfMemoryError` and `java.lang.StackOverflowError`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/OutOfMemoryError.html)),
> the **JDK 25 Troubleshooting Guide**, "Troubleshoot Memory Leaks → Understand the
> OutOfMemoryError Exception"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshooting-memory-leaks.html)),
> and the JDK 25 source at tag `jdk-25+36` — `java/util/concurrent/FutureTask.java`
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/java.base/share/classes/java/util/concurrent/FutureTask.java)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Every part of the type hierarchy above `OutOfMemoryError` is a warning label. `Throwable` →
`Error` → `VirtualMachineError` → `OutOfMemoryError`, and each level narrows the claim: this is
not a condition your code caused at this line, it is not a condition your code can fix at this
line, and the machine underneath you may already be in a state where the next line cannot run
either. Almost everything people get wrong about `OutOfMemoryError` follows from reading it as
an exception with an unusual name.**

## The three sentences in the javadoc that decide how you treat it

`java.lang.Error`:

> *"An `Error` is a subclass of `Throwable` that indicates serious problems that a reasonable
> application should not try to catch. Most such errors are abnormal conditions."*

`java.lang.VirtualMachineError`:

> *"Thrown to indicate that the Java Virtual Machine is broken or has run out of resources
> necessary for it to continue operating."*

`java.lang.OutOfMemoryError`:

> *"Thrown when the Java Virtual Machine cannot allocate an object because it is out of memory,
> and no more memory could be made available by the garbage collector."*

Read the last one closely: **the collector already ran and already failed.** An
`OutOfMemoryError` is not "the heap filled up"; a heap filling up is the normal, healthy state
of a JVM between collections. It is "the heap filled up, a collection was attempted, and after
the collection there was still no room". By the time you see the error, every cheap remedy the
runtime has has already been tried.

## The stack trace names the victim, not the culprit

This is the single most consequential thing to understand before opening a log.

A heap allocation fails for whichever thread happens to ask next. If a background scheduler has
been accumulating a hundred thousand cached responses over six hours, the allocation that finally
fails is likely to be an eight-byte `Integer` box in an unrelated HTTP handler, because that
handler allocates on every request and the scheduler allocates once a minute. The stack trace you
get is the handler's.

Schematically — this is the *shape* of such a trace, not a captured one — the top frame is
whatever grew a buffer: an `Arrays.copyOf` inside a collection resize, a `StringBuilder` append, a
deserialiser reading the next field.

A trace like that is real evidence of exactly one thing: **the allocation rate at the moment of
failure**. It tells you nothing about retention. The frames are chosen by arrival order, not by
size. This is why "grep the OOM stack trace and fix that class" is a method that works
occasionally and by luck.

Two exceptions worth naming, because for these the trace *is* the bug:

- **`Requested array size exceeds VM limit`** — thrown for one specific allocation whose length
  exceeded a hard VM limit regardless of free memory. The frame that asked for it is the frame
  to fix.
- **`Cannot reserve N bytes of direct buffer memory …`** — thrown by `java.nio.Bits` on the
  thread that asked for the buffer, which is usually the code holding the buffers open.

Both are covered in [02d · The messages that are not on the list](02d-the-messages-that-are-not-on-the-list.md)
and [02 · The seven documented messages](02-the-seven-documented-messages.md).

## Whether you can recover depends on which message it was

"Never catch `OutOfMemoryError`" is good advice and a bad rule, because the nine things that can
throw it are not equally fatal.

| Failure | Is the JVM still healthy afterwards? |
|---|---|
| `Java heap space` | No. The heap is exhausted; the next allocation is likely to fail too. |
| `GC overhead limit exceeded` | No, and it has been unhealthy for some time. |
| `Requested array size exceeds VM limit` | **Yes.** One request was absurd; nothing else changed. |
| `Metaspace` / `Compressed class space` | Usually no — the region stays full until a loader dies. |
| `Cannot reserve … direct buffer memory` | **Often yes**, if the caller can back off and retry. |
| `unable to create native thread …` | **Often yes** — the running threads are unaffected. |
| `request size bytes for reason. Out of swap space?` | No, and the JVM writes an `hs_err` log. |

So a bulk-import job that catches `OutOfMemoryError` around a single oversized array read, logs
the offending record and continues is defensible. A framework that catches `OutOfMemoryError`
around every request and continues serving is not, because for the two heap messages it produces
a process that is alive, passing its liveness probe and failing a fraction of requests forever.

🔴 **The rule that actually holds: never catch it in a place that will keep running afterwards
without proving the resource came back.**

## Four places your code catches it without meaning to

**1 · `catch (Throwable)` in a framework thread pool.** Servlet containers, Netty pipelines,
message-listener containers and scheduled-task runners all wrap user code in a `Throwable` catch
so that one bad handler cannot kill a worker thread. That is correct for a `NullPointerException`
and wrong for a `VirtualMachineError`, and most of them do not distinguish.

**2 · `ExecutorService.submit(...)`, which swallows it into the `Future`.** This is not a
framework's fault; it is `FutureTask`'s documented design, and the JDK 25 source is explicit:

```java
try {
    result = c.call();
    ran = true;
} catch (Throwable ex) {
    result = null;
    ran = false;
    setException(ex);          // the Error is now the Future's outcome
}
```

An `OutOfMemoryError` thrown inside a submitted task **never reaches the thread's uncaught
exception handler**, never appears in a log, and is only observed if somebody calls
`Future.get()` and unwraps the `ExecutionException`. `execute(Runnable)` does not have this
problem, because there is no `Future` to put the failure in.

```java
// silent: the Error lands in the Future and nobody looks
executor.submit(() -> rebuildCache());

// loud: the Error propagates to the thread's UncaughtExceptionHandler
executor.execute(() -> rebuildCache());

// or keep submit() and actually inspect the result
CompletableFuture.runAsync(() -> rebuildCache(), executor)
        .whenComplete((v, t) -> { if (t != null) log.error("cache rebuild failed", t); });
```

**3 · A `finally` block that allocates.** `finally` runs, and then throws its own
`OutOfMemoryError` while building a log message, replacing the original. The error you see is
the second one, from the cleanup path.

**4 · Retry logic.** `@Retryable`, a resilience library's fallback, an HTTP client's automatic
retry — anything configured to catch broadly and try again will hammer a JVM that has no memory
with more of the work that ran it out.

## Turning it back into a visible failure

The JVM has flags for exactly this, and they are the subject of
[03 · The OOM hooks are one function](03-the-oom-hooks-are-one-function.md). The short version:
`-XX:+ExitOnOutOfMemoryError` makes the process die on the first one the JVM throws, which is
almost always the right behaviour under an orchestrator and almost always the wrong behaviour in
a desktop tool or a long batch job with no supervisor.

If you do want a targeted catch, make it narrow and make it prove recovery:

```java
byte[] payload;
try {
    payload = readWholeRecord(in);           // bounded by the record's declared length
} catch (OutOfMemoryError e) {
    if (!(e.getMessage() != null && e.getMessage().startsWith("Requested array size"))) {
        throw e;                              // not the benign one — do not swallow it
    }
    log.warn("record {} too large to buffer, skipping", recordId);
    return SKIPPED;
}
```

Matching on the detail message is ugly, and it is ugly because the JDK gives you no typed
subclass to catch. That ugliness is the honest signal that this is a narrow special case rather
than a pattern.

## Gotchas

**★ The thread in the stack trace is the thread that asked next, not the thread that retained.**
Allocation failure lands on whoever allocates most frequently, which is almost never whatever is
holding the memory. Treating the trace as the bug report is the commonest wasted hour in a heap
incident. The trace is useful for the *allocation rate* question and nothing else.

**★ `executor.submit()` makes an `OutOfMemoryError` completely silent.**
`FutureTask.run()` catches `Throwable` and calls `setException(ex)`. The error becomes the
`Future`'s result. No uncaught-exception handler, no log line, no dump. If you never call
`get()`, the JVM ran out of memory and nothing anywhere recorded it. `execute()` propagates.

**★ `catch (Exception)` does not catch it, and people write it thinking it does.**
`OutOfMemoryError` extends `Error`, not `Exception`. A `catch (Exception e)` around the whole
request is not protection against it; a `catch (Throwable t)` is, and that is the problem.

**★ An `OutOfMemoryError` swallowed by a pool leaves a service that passes its health check.**
The worker thread survives, the next request is served, and a fraction of requests fail forever
with no restart and no alert. That is strictly worse than a crash: a crash is noticed. This is
the argument for `-XX:+ExitOnOutOfMemoryError` in a container.

**★ Two `OutOfMemoryError`s in one log usually have one cause and two victims.**
Once memory is tight, the failure cascades: the handler throws, the logger cannot allocate its
buffer, the metrics exporter cannot allocate its array. The **first** error in the file is the
evidence. Everything after it is the aftermath, and reading the last one is reading noise.

**★ `StackOverflowError` is the sibling that looks like a memory bug and is not.**
It is also a `VirtualMachineError`, but it means one thread recursed past its own stack, not that
the process is out of memory. Process RSS barely moves. `-XX:+HeapDumpOnOutOfMemoryError` does
nothing for it. See [`../01-memory-layout/06-thread-stacks.md`](../01-memory-layout/06-thread-stacks.md).

**★ Not every `OutOfMemoryError` in your log came from the JVM.**
Any library can `throw new OutOfMemoryError(...)`, and some do — a buffer pool refusing to grow,
a codec rejecting a declared length. Those are ordinary Java throws: they do not trigger the JVM's
OOM hooks at all, because those hooks live in HotSpot's `report_java_out_of_memory` and are
called from the VM, not from `throw`. The man page says this explicitly, in the sentence quoted
in [03](03-the-oom-hooks-are-one-function.md).

**★ Recovery is only meaningful if you can show the memory came back.**
A `catch` block that logs and continues has asserted that the resource is available again. For
`Requested array size exceeds VM limit` that is true by construction. For `Java heap space` it is
a hope. If you cannot name why the memory is back, you are not recovering, you are deferring.

**★ The error object may be reused, so `==` identity and suppressed exceptions are unreliable.**
HotSpot pre-allocates its `OutOfMemoryError` objects at startup and hands the same instances out
repeatedly. Two distinct failures can give you the *same object*. The javadoc warns about the
consequence: *"`OutOfMemoryError` objects may be constructed by the virtual machine as if
suppression were disabled and/or the stack trace was not writable."* See
[01b · The error with no stack trace](01b-the-error-with-no-stack-trace.md).

## Interview questions

**★ Why is `OutOfMemoryError` an `Error` rather than an `Exception`, and what follows from that?**
Because the checked/unchecked distinction in Java is about who is expected to recover.
`Exception` says "a condition this method's caller could reasonably handle"; `Error` says, in the
javadoc's words, *"serious problems that a reasonable application should not try to catch"*; and
`VirtualMachineError` narrows it further to *"the Java Virtual Machine is broken or has run out
of resources necessary for it to continue operating"*. What follows practically is that no method
has to declare it, `catch (Exception)` will not see it, and any code that does catch it has taken
on the burden of proving the resource is available again — which for heap exhaustion it almost
never can.

**★ You have an OOM stack trace pointing at `ArrayList.grow`. What have you learned?**
That an array copy was the allocation that happened to be next when the heap was already
exhausted. Nothing about what was retaining the heap. Allocation failure is assigned by arrival
order, so the frame you get is biased towards whatever allocates most frequently — request
handling, serialisation, logging — and against whatever accumulates slowly, which is what leaks
look like. The trace answers "what is the allocation rate", and the heap dump answers "what is
retained". Only the second question has the fix in it.

**★ A colleague reports that their service "handled" an `OutOfMemoryError` and kept serving.
What do you tell them?**
That it depends entirely on which detail message it was, and that the default assumption should
be that they did not handle it, they hid it. If it was `Requested array size exceeds VM limit` on
one oversized input then the JVM is genuinely fine and skipping the record is reasonable. If it
was `Java heap space` then the heap was full after a collection, is still full, and the process
is now alive, passing liveness checks, and failing a fraction of requests with no restart and no
alert — which is worse than crashing, because a crash gets noticed and restarted. The fix is to
narrow the catch to the case they can prove, and to add `-XX:+ExitOnOutOfMemoryError` so the
other cases become a clean, visible death.

**★ Why might an `OutOfMemoryError` never appear in your logs at all even though it was thrown?**
Most often because it was thrown inside a task passed to `ExecutorService.submit(...)`.
`FutureTask.run()` catches `Throwable` and stores it via `setException`, so it becomes the
`Future`'s completion state rather than an uncaught exception. The thread's
`UncaughtExceptionHandler` never fires and nothing is logged unless somebody calls `get()`. Two
other routes: a framework's `catch (Throwable)` around user code, and a `finally` block that
itself fails while trying to log, replacing the original error with its own.

**★ Is it ever correct to catch `Throwable`?**
At a process boundary whose job is to record and then stop — a top-level `main`, an
uncaught-exception handler, a shutdown path — yes, provided the handler re-throws or exits rather
than resuming work. It is not correct in a worker loop that will pick up the next task, because
that converts a fatal condition into a permanent partial outage. If a framework you use does it,
the mitigation is not to argue with the framework but to make the JVM terminate first:
`-XX:+ExitOnOutOfMemoryError` calls `os::_exit(3)` before the catch block ever runs.

{/* FOOTER */}
