---
title: "Every pause number the GC log gives you measures the work done at the safepoint and not the time spent getting there — the JVM cannot start collecting until the last application thread has stopped, that wait is unbounded, and it is reported by a different log tag most people have never enabled"
sidebar_label: "10 · Safepoints"
sidebar_position: 38
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`runtime/safepoint.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/runtime/safepoint.cpp)
> for the `-Xlog:safepoint` record's exact fields and the `SafepointSynchronize: Finished after`
> warning, and
> [`runtime/globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/runtime/globals.hpp)
> for the declared defaults and descriptions of `SafepointTimeout`, `SafepointTimeoutDelay`,
> `AbortVMOnSafepointTimeout`, `GuaranteedSafepointInterval`, `SafepointALot` and
> `HandshakeTimeout`. JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**A garbage collection pause has two parts, and the GC log shows you one of them. Before the
collector can touch a single object, every application thread has to reach a point where the JVM
can make sense of its stack — and the JVM cannot force that; it has to ask, and wait. That wait
is time-to-safepoint, it is not in any pause figure you have been reading, and when it goes wrong
it goes wrong by orders of magnitude while every GC metric on the dashboard stays green.**

## Why safepoints have to exist

The JVM regularly needs to answer questions that are only answerable when the application is not
running: *which of these machine registers and stack slots hold object references?* Between
instructions, a compiled method's stack frame is a mixture of references and raw values with no
runtime tag distinguishing them, and the mapping changes constantly as the code executes.

HotSpot solves this by having the JIT record an **oop map** — a description of where the
references are — but only at specific instruction boundaries. Those boundaries are safepoints. At
one, the thread's stack is parseable; between them, it is not.

The operations that need this are more numerous than most people assume, and garbage collection
is only the most famous:

- Any stop-the-world collection phase, and the start and end of concurrent ones.
- **Deoptimisation** — discarding a compiled method whose speculative assumption was violated.
- **Thread dumps and heap dumps** — [05 · Thread dumps](../05-thread-dumps/README.md) and
  [04 · OutOfMemoryError](../04-out-of-memory-error/README.md). A dump is a global consistency
  requirement, which is why `jcmd Thread.print` is not free on a large application.
- **Class redefinition** — every agent that instruments classes at runtime, which in a typical
  Spring service means the APM agent.
- **Code cache maintenance** and various VM-internal bookkeeping.

So safepoints are not a GC feature. They are the mechanism by which the JVM gets a coherent view
of a running program, and the GC is one of its customers.

## Getting there is cooperative, and that is the whole problem

The JVM cannot suspend a thread at an arbitrary instruction — a signal-suspended thread is stopped
somewhere with no oop map, which is useless. Instead, threads **poll**: the compiler inserts a
cheap check at method returns and loop back-edges, and when the VM wants a safepoint it arms the
poll so that the next check traps into the runtime.

Three consequences follow directly, and they explain nearly everything about safepoint pathology:

1. **A thread stops only when it reaches a poll.** If the compiled code it is executing has no
   poll for a long stretch, nothing can be done about it. The VM waits.
2. **Everyone waits for the slowest thread.** The safepoint is global: threads that arrive early
   sit idle until the last one arrives. One thread in a poll-free region stalls the entire
   application, including threads that were doing nothing wrong.
3. **A thread already in native code is treated as safe.** It cannot touch Java objects while it
   is in a JNI call or blocked in a syscall, so its stack is not in the way; it is marked as
   safepoint-safe and the VM does not wait for it. This is why a service with a hundred threads
   blocked on socket reads reaches safepoints instantly, and why "we have too many threads" is
   usually the wrong explanation for a slow one.

Since **JEP 312 · Thread-Local Handshakes** (JDK 10), the JVM can also perform a callback on one
thread at a time without a global safepoint at all. This removed a large class of global pauses —
many operations that once stopped the world now handshake per thread — and it is why safepoint
counts are much lower on modern JVMs than the older literature assumes. The polling mechanism is
the same; only the scope changed. `HandshakeTimeout` in `globals.hpp` is the diagnostic
counterpart to `SafepointTimeout` for these.

## The pause you measure and the pause the user gets

This is the practical heart of the topic. A safepoint operation has four measurable phases, and
`-Xlog:safepoint` reports all of them. From `safepoint.cpp`, the record is emitted with exactly
these fields:

```
"Safepoint \"%s\", "
"Time since last: " JLONG_FORMAT " ns, "
"Reaching safepoint: " JLONG_FORMAT " ns, "
"At safepoint: " JLONG_FORMAT " ns, "
"Leaving safepoint: " JLONG_FORMAT " ns, "
"Total: " JLONG_FORMAT " ns, "
"Threads: %d runnable, %d total"
```

Read what those names mean against the source's own arithmetic:

| Field | Computed as | What it is |
|---|---|---|
| **Time since last** | `_last_app_time_ns` | How long the application ran uninterrupted before this safepoint |
| **Reaching safepoint** | sync time − begin time | 🔴 **Time-to-safepoint.** Waiting for the last thread to arrive |
| **At safepoint** | leave time − sync time | The actual work — the collection, the dump, the deopt |
| **Leaving safepoint** | end time − leave time | Releasing the threads |
| **Total** | end time − begin time | What the application actually lost |

🔴 **The GC log's pause figure corresponds to "At safepoint". "Total" is what your users
experienced.** If reaching the safepoint took 400 ms and the collection took 8 ms, `-Xlog:gc`
reports a healthy 8 ms pause and the request that was in flight lost 408 ms. Every dashboard
built on GC pause metrics — including the Micrometer ones in
**08 · Metrics with Micrometer** *(not written yet)* — inherits this blind
spot, because they are sourced from GC notifications rather than from safepoint records.

This is the concrete answer to the question raised in
[01b · What the pause number leaves out](01b-what-the-pause-number-leaves-out.md): a p99 latency
that does not match a healthy GC log is very often here, and the reason it is hard to find is
that no amount of staring at `-Xlog:gc` will reveal it. You have to enable a different tag.

**`-Xlog:safepoint` is `info` level and one line per safepoint**, which makes it far cheaper than
the age or ergo tracing elsewhere in this topic, and one of the few diagnostics genuinely
defensible to leave on in production. `-Xlog:safepoint+stats` adds the aggregate summary, and
there are JFR events for the same data if you would rather have it in a recording —
[06 · JFR and profiling](../06-jfr-and-profiling/README.md). Adding and dropping the tag at
runtime is `jcmd VM.log`, per [07b](07b-decorators-and-runtime-control.md).

Also worth noting from the field list: **`Threads: %d runnable, %d total`**. The runnable count is
what matters for time-to-safepoint, because those are the threads that must actually be waited
for; the total includes everything parked or in native. A large gap between them is normal and
healthy.

## Safepoints without any collection at all

Two things surprise people here.

**Not every safepoint is a GC.** The `%s` in the record is the VM operation's name, so the log
tells you what the safepoint was *for* — a thread dump, a deoptimisation, a class redefinition,
an agent's instrumentation. A service can be pausing regularly with a completely clean GC log,
and the safepoint log is the only place that shows it. This is a common and badly-diagnosed
outcome of attaching a profiling or APM agent.

**There is no periodic safepoint by default on JDK 25.** `GuaranteedSafepointInterval` is
declared in `globals.hpp` as a `DIAGNOSTIC` flag with a default of **0**, described as
*"Guarantee a safepoint (at least) every so many milliseconds (0 means none)"*. Older material
describes a cleanup safepoint every second; that is not the current default, and it is also not a
flag you can set casually, because `DIAGNOSTIC` flags require
`-XX:+UnlockDiagnosticVMOptions`. The related `SafepointALot` and `HandshakeALot` are debugging
aids that force constant safepoints — useful for reproducing a race, catastrophic in production,
and both `DIAGNOSTIC` for that reason.

## Gotchas

**★ The GC pause number is "At safepoint"; the application lost "Total".**
Time-to-safepoint is not included in any figure `-Xlog:gc` prints, nor in the GC-notification
metrics that dashboards are built from. A 400 ms stall with an 8 ms collection reports as 8 ms.
This is the single most useful thing on this page.

**★ `-Xlog:safepoint` is the only place time-to-safepoint appears, and it is not on by default.**
It is `info` level and one line per safepoint, so it is cheap enough to leave enabled — which
makes it one of the few genuinely free wins in production JVM configuration.

**★ Not every safepoint is a garbage collection.**
The record names the VM operation. Thread dumps, deoptimisation, class redefinition and agent
instrumentation all stop the world, and a service can be pausing constantly with a spotless GC
log. Attaching an APM agent and then hunting the GC log for the new latency is a common and
entirely fruitless afternoon.

**★ Every thread waits for the slowest one.**
The safepoint is global, so a single thread in a poll-free region stalls the whole application.
The other threads are not slow, not busy and not at fault, and nothing in a thread dump taken
afterwards will indicate which one was the straggler.

**★ Threads in native code do not delay a safepoint.**
A thread blocked in a syscall or inside a JNI call cannot touch Java objects, so it is already
safepoint-safe and is not waited for. This is why hundreds of threads parked on socket reads cost
nothing here, and why thread count is usually a red herring in a time-to-safepoint
investigation — with the exception of JNI critical sections, covered in
[10b](10b-what-makes-time-to-safepoint-long.md).

**★ There is no guaranteed periodic safepoint on JDK 25 — the default is 0, meaning none.**
`GuaranteedSafepointInterval` is a `DIAGNOSTIC` flag defaulting to 0, described in the source as
*"0 means none"*. Advice built on "the JVM safepoints every second anyway" is describing an older
default, and setting the flag requires `-XX:+UnlockDiagnosticVMOptions`.

**★ Thread-local handshakes (JEP 312) mean far fewer global safepoints than the old literature
assumes.**
Since JDK 10 many operations run per-thread without stopping the world. Reasoning about modern
pause behaviour from pre-10 sources overestimates safepoint frequency substantially — and
`HandshakeTimeout` exists as the per-thread analogue of `SafepointTimeout` for diagnosing the
ones that remain.

**★ "Leaving safepoint" is real time too, and it is usually small — but not always.**
The record splits it out separately from the work. Resuming threads is normally negligible; when
it is not, it points at scheduling pressure on the machine rather than at anything the JVM is
doing, which is a different investigation entirely.

**★ `Threads: N runnable, M total` is the number to read when the safepoint is slow.**
Only the runnable ones must be waited for. A high total with a low runnable count is healthy;
time-to-safepoint problems live entirely in the runnable column.

**★ A thread dump is itself a safepoint operation, so taking one perturbs what you are measuring.**
`jcmd Thread.print` on a large heap with many threads is not free, and repeated dumps during an
investigation add pauses of their own. It is a real observer effect, and it is worth knowing
about before concluding that the act of investigating made things worse — because it did.

**★ `SafepointALot` and `HandshakeALot` are debugging flags, not tuning flags.**
They force constant safepoints to shake out races. They are `DIAGNOSTIC` for a reason and have no
production use whatsoever, but they turn up in copied flag lists.

## Interview questions

**★ What is a safepoint and why can the JVM not simply suspend threads whenever it likes?**
A safepoint is an instruction boundary at which a thread's stack is parseable — the JIT has
recorded an oop map saying which registers and stack slots hold object references. Between such
points that mapping does not exist, so a thread stopped at an arbitrary instruction is useless to
the garbage collector: it cannot tell a reference from an integer, and it must know, because it
is about to move objects and rewrite pointers. That is why suspension is cooperative rather than
imposed. The compiler inserts cheap polls at method returns and loop back-edges, the VM arms the
poll when it wants a safepoint, and each thread traps into the runtime at its next poll. It also
explains why the mechanism is not GC-specific: anything needing a coherent view of a running
program — thread dumps, heap dumps, deoptimisation, class redefinition by an agent — uses the
same machinery.

**★ Your GC log shows 8 ms pauses and your p99 latency shows 400 ms stalls that correlate with
collections. Where do you look?**
At the safepoint log, because the GC pause figure and the application's lost time are different
numbers. `-Xlog:gc` reports the work done at the safepoint; it does not report the time spent
getting every application thread to stop. The safepoint record splits this out explicitly:
"Reaching safepoint" is time-to-safepoint, "At safepoint" is the collection itself, and "Total"
is what the application actually lost. If reaching the safepoint took 400 ms and the collection
took 8, the GC log is telling the truth and answering a different question. Enable
`-Xlog:safepoint` — it is `info` level and one line per safepoint, so it is cheap enough to leave
on — and compare the two columns. The same blind spot exists in metrics dashboards, because those
are sourced from GC notifications rather than from safepoint records, which is why this failure
survives so long in production.

**★ Does a thread blocked on a socket read delay a safepoint?**
No, and understanding why is the useful part. A thread inside a native call or blocked in a
syscall cannot touch Java objects, so its Java stack is not going to change and is not in the
collector's way — the JVM marks it safepoint-safe on the way out and does not wait for it. It
transitions properly when it returns. So a service with hundreds of threads parked on I/O reaches
safepoints promptly, and thread count is usually a red herring when diagnosing a slow one; the
number that matters is the "runnable" count in the safepoint record, not the total. The important
exception is a JNI critical section — code inside `GetPrimitiveArrayCritical` holds a direct
pointer into the heap, so the collector genuinely cannot proceed, and that region *does* block
the safepoint for as long as it runs.

**★ You attach an APM agent and latency gets worse, but the GC log is unchanged. What is your
hypothesis?**
That the added pauses are safepoints that are not collections. Agents redefine classes to
instrument them, and class redefinition is a stop-the-world VM operation; some agents also
trigger deoptimisation by invalidating compiled code, which is another one. None of that appears
in `-Xlog:gc`, because none of it is garbage collection — so the GC log being unchanged is
consistent with the hypothesis rather than evidence against it. The confirming measurement is
`-Xlog:safepoint`, because the record names the VM operation that caused each safepoint; if the
new pauses are attributed to redefinition or deoptimisation rather than to a collection, the
agent is the cause. It is worth knowing this pattern specifically, because the instinct on seeing
new latency is to look at the GC log, and here the GC log will exonerate the JVM correctly and
unhelpfully.

**★ Why does taking repeated thread dumps during an investigation sometimes make the problem
worse?**
Because a thread dump is itself a safepoint operation. Producing a consistent snapshot of every
thread's stack requires all of them to stop, so `jcmd Thread.print` imposes a stop-the-world
pause whose cost scales with thread count and stack depth. On a large application that is
measurable, and a script taking a dump every few seconds is adding pauses to a system you are
investigating *for* pauses. It is a genuine observer effect and worth stating out loud in an
incident, both so nobody attributes the added latency to the underlying fault and so the dumps
get taken deliberately rather than in a loop. The same applies to heap dumps, far more severely,
and it is one reason JFR is often the better instrument during an incident — it is designed to
run continuously at low overhead rather than to stop the world on demand.

**★ What changed about safepoints with thread-local handshakes, and why does it matter when
reading older material?**
JEP 312 in JDK 10 introduced the ability to execute a callback on a single thread at a safepoint
of its own, without bringing every other thread to a global safepoint. A large class of
operations that previously required stopping the world — various kinds of per-thread bookkeeping,
stack scanning and revocation work — became per-thread handshakes. The mechanism is the same
polling infrastructure; what changed is the scope. It matters when reading older material because
pre-10 sources reason about safepoint frequency and cost from a world where far more operations
were global, and their advice — periodic cleanup safepoints, tuning intervals, worrying about
safepoint count as a first-class metric — describes a JVM that no longer exists. It is also why
`HandshakeTimeout` exists alongside `SafepointTimeout` in `globals.hpp`: the diagnostic surface
had to grow a per-thread counterpart.

{/* FOOTER */}
