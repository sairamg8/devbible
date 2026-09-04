---
title: "A thread blocked forever on a socket read reports `RUNNABLE`, because the JVM cannot see past the operating system call it is sitting in — which makes the most common stuck thread in production wear the state that means everything is fine"
sidebar_label: "04b · RUNNABLE does not mean running"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **`java.lang.Thread.State` API documentation** for the
> `RUNNABLE` definition
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.State.html)),
> and the **JDK 25 Troubleshooting Guide**, "Troubleshoot Process Hangs and Loops → No Thread
> Dump", which states that *"Threads in the `RUNNABLE` state might also be blocked"*
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshoot-process-hangs-loops.html)).
> 🔴 **No sandbox** — the stack fragments below are labelled schematics, not captured dumps.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**This is the most consequential misreading in thread-dump analysis, and it is built into the API.
`RUNNABLE` does not mean the thread is running, making progress, or consuming CPU. It means the
JVM has no reason to believe otherwise — and when a thread descends into a native call, the JVM
stops being able to tell. Since almost every remote call in a Java service ends in a native socket
read, the single most common stuck thread in production reports the state that reads as healthy.**

## The definition says so

`java.lang.Thread.State.RUNNABLE`, verbatim:

> *"Thread state for a runnable thread. A thread in the runnable state is executing in the Java
> virtual machine but it may be waiting for other resources from the operating system such as
> processor."*

🔴 **"May be waiting for other resources from the operating system."** That clause is doing
enormous work. It is usually read as "waiting for a CPU timeslice", which is harmless. But the
operating system has many resources, and one of them is **a byte arriving on a socket**.

The Troubleshooting Guide is blunter, in its section on diagnosing a hang:

> *"Threads in the `RUNNABLE` state might also be blocked."*

## Why the JVM cannot tell

The enum describes what the *JVM* knows about the thread, not what the *operating system* knows.

When Java code calls into a native method, the JVM hands control to code it does not model. It
knows the thread entered native code and it knows it has not come back. It does not know whether
that native code is computing a hash, waiting for a disk, or blocked in `recv()` on a socket that
will never produce another byte.

**Given that, `RUNNABLE` is the only honest answer available.** `BLOCKED` would be wrong — the
thread is not waiting for a monitor. `WAITING` would be wrong — it did not call `park` or `wait`.
There is no `IN_NATIVE_AND_POSSIBLY_STUCK` state, so the thread stays in the bucket for "as far as
the JVM is concerned, executing".

⚠️ This is not a bug or an oversight. It is a boundary: the state enum is defined in terms of Java
constructs, and blocking I/O happens below them.

## What it looks like

```text
"http-nio-8080-exec-31" #74 daemon prio=5 nid=0x2f1c runnable [0x00007f2a1c3fe000]
   java.lang.Thread.State: RUNNABLE
        at java.base/sun.nio.ch.SocketDispatcher.read0(Native Method)
        at java.base/sun.nio.ch.SocketDispatcher.read(SocketDispatcher.java:46)
        ...
        at com.example.PaymentClient.authorize(PaymentClient.java:64)
        at com.example.CheckoutService.checkout(CheckoutService.java:118)
```

*(Schematic. The frame names are illustrative of the shape, not a captured dump.)*

**That thread may have been there for forty minutes.** The state says `RUNNABLE`, the header says
`runnable`, and nothing in the block distinguishes it from a thread that started the same call
three milliseconds ago.

🔴 **`Native Method` at the top of a `RUNNABLE` stack is the tell.** When the innermost frame is
native and the frames below it are I/O machinery — `SocketDispatcher`, `SocketInputStream`,
`EPoll`, a JDBC driver's socket layer — the thread is almost certainly waiting on the network, not
computing.

## How to tell waiting from working

Three techniques, in increasing order of certainty.

**1 · Read the top frames.** Native I/O frames mean waiting. Application frames doing arithmetic
mean running. This is instant and usually sufficient.

**2 · Take three dumps** ([02b](02b-take-three-of-them.md)). A `RUNNABLE` thread in the *same*
native read across three dumps is stuck; one that has moved is working. This is the decisive test
and it costs ten seconds.

**3 · Check CPU per thread.** If `top -H` shows the process near-idle while forty threads report
`RUNNABLE`, those threads are not executing anything. Convert a busy thread's decimal id to hex
and match it against `nid` in the dump ([03](03-anatomy-of-a-dump.md)) — the *absence* of any
busy thread is itself the finding.

**The combination is conclusive:** many threads `RUNNABLE`, all in the same native I/O frame, all
unchanged across three dumps, with the process consuming no CPU. That is a hang on a remote
dependency, and the enum said `RUNNABLE` throughout.

## The consequences that make this worth a page

**Counting `RUNNABLE` threads tells you nothing about load.** A monitoring dashboard that graphs
"runnable threads" as a proxy for busyness will read a total outage as peak activity — every
thread blocked on a dead dependency is `RUNNABLE`.

**It inverts the natural conclusion.** Someone reading a dump for the first time sees `BLOCKED`
threads and worries, then sees `RUNNABLE` threads and relaxes. The correct instinct is nearly the
opposite: `BLOCKED` names a culprit and is usually tractable, while a wall of `RUNNABLE` threads
in a socket read is an outage in a dependency you may not control.

**It hides the missing timeout.** The thread is `RUNNABLE` and will stay that way until the socket
returns something, which — with no read timeout configured — may be never. TCP does not
necessarily notice a peer that has silently vanished, so "the connection will fail eventually" is
an assumption rather than a guarantee.

🔴 **Which makes this the diagnostic that most often ends in the same recommendation: set a read
timeout.** The state is a symptom of a dependency; the reason it can last forever is a missing
timeout in your own code. Phase 16 owns the resilience patterns; this page is where you see the
need for them.

## The exception: `RUNNABLE` that really is running

Not every `RUNNABLE` thread is a lie. A genuinely running thread also reports `RUNNABLE`, and the
distinguishing features are:

- **Top frames are application or library code**, not `Native Method` I/O.
- **The frames change across dumps** — or, if they do not, they are the same *computational*
  frames, which is a loop.
- **The process is consuming CPU**, and `top -H` names the thread.

That combination — same non-I/O frames across three dumps, CPU pinned — is the loop case, and the
tool for it is a sampling profiler rather than more dumps
([08](08-what-a-dump-cannot-tell-you.md)).

## Gotchas

**★ `RUNNABLE` does not mean running.**
The API defines it as executing in the VM but possibly *"waiting for other resources from the
operating system"*, and the Troubleshooting Guide says outright that *"threads in the `RUNNABLE`
state might also be blocked"*. It is the state of a thread the JVM has lost sight of.

**★ Blocking socket reads are the case that matters, and they are everywhere.**
Every HTTP client, every JDBC driver, every message consumer ends in a native read. So the most
common stuck thread in a Java service wears the state that reads as healthy.

**★ `Native Method` at the top of a `RUNNABLE` stack is the tell.**
Innermost frame native, frames below it I/O machinery — `SocketDispatcher`, `EPoll`, a driver's
socket layer — means waiting on the network. Application frames doing arithmetic mean running.

**★ Counting `RUNNABLE` threads as a load metric inverts reality.**
During a total dependency outage every request thread is `RUNNABLE`. A dashboard using that count
as a busyness proxy shows peak activity at the moment nothing is working.

**★ The instinct to worry about `BLOCKED` and relax about `RUNNABLE` is backwards.**
`BLOCKED` names a specific monitor and a specific holder, which is tractable. A wall of `RUNNABLE`
threads in one socket read is an outage in something you may not control.

**★ A thread can be `RUNNABLE` in a socket read forever.**
With no read timeout, there is nothing to end the wait. TCP does not reliably detect a peer that
has vanished, so "it will fail eventually" is an assumption. This is why the finding so often
resolves to a missing timeout.

**★ The absence of CPU is evidence.**
If the process is near-idle while dozens of threads report `RUNNABLE`, none of them is executing.
Checking process CPU alongside the dump turns an ambiguous state into a definite one.

**★ Three dumps settle it and one cannot.**
Same native frame across all three means stuck. This is the same argument as
[02b](02b-take-three-of-them.md), and this state is the reason it is not optional.

**★ Not every `RUNNABLE` is a lie.**
A genuinely looping thread is also `RUNNABLE`, with non-I/O frames and real CPU. That is the loop
case, and it needs a profiler rather than more dumps.

## Interview questions

**★ Why is `RUNNABLE` a misleading state in a thread dump?**
Because it describes what the JVM knows, not what the thread is doing. Its own definition says a
`RUNNABLE` thread is executing in the VM but *"may be waiting for other resources from the
operating system"* — and when a thread enters a native call, the JVM cannot see whether it is
computing or blocked in a socket read. Since virtually every remote call bottoms out in a native
read, the most common stuck thread in production reports `RUNNABLE`.

**★ Why does the JVM not report a thread blocked in a socket read as `BLOCKED`?**
Because `BLOCKED` has a precise meaning — waiting to enter a `synchronized` block — and the thread
is not doing that. Nor has it called `park` or `wait`, so `WAITING` is wrong too. The enum is
defined in terms of Java constructs, and blocking I/O happens below them, so the only available
answer is `RUNNABLE`. It is a boundary in the model rather than a defect.

**★ How do you distinguish a `RUNNABLE` thread that is stuck from one that is working?**
Read the top frames — `Native Method` over socket machinery means waiting, application frames
doing work mean running. Then take three dumps: the same native frame in all three means stuck.
Then check CPU: if the process is near-idle while many threads report `RUNNABLE`, none of them is
executing. Together those three are conclusive.

**★ A dashboard graphs runnable thread count as a load indicator. What is wrong with it?**
It reads an outage as peak load. When a dependency stops responding, every request thread blocks
in a socket read and reports `RUNNABLE`, so the metric peaks exactly when the service is doing
nothing. The count measures threads the JVM has lost sight of, not threads doing work.

**★ Your dump shows 200 `RUNNABLE` threads all in `SocketDispatcher.read0`, and the pool maximum
is 200. What do you conclude, and what do you change?**
That the service is fully saturated waiting on a remote dependency — the pool is exhausted and
every thread is parked in the network. Immediately, the investigation moves to that dependency,
identified from the frames below the socket layer. But the durable fix is in this service: a read
timeout so those threads cannot be held indefinitely, and a bulkhead or circuit breaker so one
slow dependency cannot consume the entire pool. The dependency caused today's incident; the
missing timeout is why it became an outage.

**★ Can a thread stay `RUNNABLE` in a socket read forever?**
Yes, if no read timeout is set. There is nothing in the JVM that ends the wait, and TCP does not
reliably detect a peer that has silently disappeared — a half-open connection can persist
indefinitely. That is precisely why "it will time out eventually" is an assumption rather than a
guarantee, and why the read timeout is a configuration item rather than an optimisation.

**★ Does a `RUNNABLE` thread always mean there is nothing to fix in your own code?**
No — it usually means the opposite. The state points at a dependency, but the reason your service
fell over is local: no timeout, no bulkhead, an unbounded pool, or a synchronous call that should
not have been. The dump tells you where the threads went; what it should prompt is a review of why
they could go there without limit.

{/* FOOTER */}
