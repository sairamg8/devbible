---
title: "A service that has stopped responding while burning no CPU is the one production failure where a single command usually contains the whole answer, and the reason people reach for it last is that nothing in the metrics tells you the problem is a thread"
sidebar_label: "01 · The service that stopped responding"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 Troubleshooting Guide**, "Troubleshoot Process Hangs
> and Loops → Diagnose a Hung Process"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshoot-process-hangs-loops.html))
> and "Diagnostic Tools → The jstack Utility"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/diagnostic-tools.html)),
> and the **JDK 25 `jcmd` tool reference**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)).
> 🔴 **No sandbox.** Every dump fragment on these pages is quoted from Oracle's documentation and
> attributed, or is explicitly labelled a schematic. Nothing is a captured run.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**The service is up. The health check may even be passing. Requests go in and nothing comes back,
CPU is near zero, the heap is flat, GC is quiet, and every dashboard you own says the system is
fine. This is the failure mode a thread dump was built for, and it is the one where a single
command frequently contains the entire answer — the stack of every thread, what each is waiting
for, and which of them holds the thing the others want. This page is why the dump belongs first
in the ordered plan rather than last, and what its absence of CPU actually tells you.**

## The shape of the symptom

Two failures look identical from outside and could not be more different underneath:

| | **Hung** | **Looping** |
|---|---|---|
| CPU | Near zero | Pinned, often one core per stuck thread |
| Threads are | Waiting for something that never arrives | Executing, forever |
| The dump shows | Threads parked, blocked, or in `Object.wait` | The same frames on repeated dumps, *running* |
| The tool after the dump | Usually none — the dump names the cause | A profiler (**topic 06** *(not written yet)*) |

🔴 **Look at CPU before you do anything else, because it splits the problem in half.** Idle means
something is waiting: a lock, a socket, a pool, a latch. Busy means something is executing:
an infinite loop, pathological backtracking, an unbounded retry. The Troubleshooting Guide
separates its own procedure the same way — "Diagnose a Loop Process" and "Diagnose a Hung
Process" are different sections with different tools.

**This topic is the idle half.** The busy half needs sampling, which is topic 06's subject,
because a thread dump of a looping process tells you where it is but not how much time it spends
there.

## Why the dump comes first

A thread dump is the cheapest high-information diagnostic the JVM offers.

- **It is one command and it is fast** — `Thread.print` is rated *"Impact: Medium --- depends on
  the number of threads"*, which for a service with a few hundred threads is milliseconds.
- **It requires nothing set up in advance.** No agent, no flag, no recording started yesterday.
  Unlike a heap dump it does not need disk space, and unlike JFR it does not need to have been
  running before the incident.
- **It does its own deadlock analysis.** The Troubleshooting Guide: *"After printing the thread
  dump, the HotSpot VM executes a deadlock detection algorithm."* If the answer is a deadlock,
  the JVM finds it and prints the cycle, and you have not had to reason about anything
  ([05b](05b-deadlock.md)).
- **It is complete.** Every thread, every stack, every lock — not a sample, not an aggregate.
  Whatever the process is doing right now is in that file.

**The reason it is reached for late is cultural, not technical.** No dashboard has a "threads"
panel that goes red. Nothing pages you about a thread state. The metrics that exist — CPU, heap,
GC, request rate — all look *normal* during precisely this failure, which reads as "no signal"
rather than as "signal". So people work the dashboards they have and arrive at the dump after an
hour, when it would have answered the question in the first minute.

## What "not responding" usually turns out to be

Five causes cover the overwhelming majority of idle hangs, and every one of them is visible in a
dump:

1. **Pool exhaustion.** All N threads in the same frame, waiting on the same thing —
   [06](06-pool-exhaustion.md). The dump shape is unmistakable and it is the single most common
   answer for a web service.
2. **A connection pool with no free connections**, which is pool exhaustion one layer down and
   has its own signature — [06b](06b-the-connection-pool-in-a-dump.md).
3. **A missing timeout on a remote call.** Threads sitting in a socket read forever, holding
   whatever they hold. This is the cause that propagates: one slow dependency consumes the
   thread pool of everything that calls it.
4. **A deadlock**, which the JVM detects and prints for you.
5. **A wait that is never notified** — the Troubleshooting Guide's "Deadlock Not Detected" case:
   *"the issue might be a bug in which a thread is waiting for a monitor that is never notified.
   This could be a timing issue or a general logic bug."*

⚠️ Note what is *not* on that list: garbage collection. A long GC pause looks like a hang, but it
is a different investigation with different evidence — the GC log — and it does not present with
idle CPU. If the process is unresponsive *and* burning CPU in GC threads, you are in topic 02's
territory, not this one.

## The one command

```bash
jcmd <pid> Thread.print
```

That is the whole of getting started. [02](02-taking-one.md) covers the alternatives — the
Control+Break handler, `SIGQUIT`, `jhsdb` — and, more importantly, which of them still to prefer
on JDK 25, because the tool most tutorials name has changed status.

🔴 **A preview of that, because it changes what you should type today:** the JDK 25 `jstack` man
page opens *"Note: This command is experimental and unsupported"*, and the Troubleshooting Guide
says directly: *"Use the `jcmd` or `jhsdb jstack` utility, instead of the `jstack` utility to
diagnose problems with JVM and Java applications."*

## Take more than one

A single dump is a photograph of one instant. It tells you what threads were doing at that
moment; it cannot tell you whether they are *stuck* there or merely *passing through*.

**Three dumps a few seconds apart converts a photograph into a diagnosis** — a thread in the same
frame across all three is stuck; a thread in different frames is working. That distinction is the
difference between a cause and a coincidence, and it costs ten extra seconds.
[02b](02b-take-three-of-them.md) is the argument in full, and it is the single most valuable habit
in this topic.

## Gotchas

**★ Idle CPU and pinned CPU are different investigations.**
Idle means waiting — a thread dump usually contains the whole answer. Pinned means executing — a
dump tells you where but not for how long, and you need a sampling profiler. Checking CPU first
splits the problem in half before you have spent anything.

**★ Every dashboard looks healthy during a hang.**
CPU low, heap flat, GC quiet, error rate zero, because nothing is failing — things are waiting.
The absence of a signal is read as the absence of a problem, which is why the correct first tool
is reached for last.

**★ A passing health check does not mean the service is working.**
A liveness probe that returns a static 200 from a dedicated thread, or from a path that touches no
pool, keeps reporting healthy while every request thread is blocked. That is not a monitoring
gap so much as a health check that does not exercise anything —
**topic 12's graceful shutdown** *(not written yet)* and topic 08's metrics both
touch this, and the dump is what proves it.

**★ One dump cannot distinguish stuck from busy.**
A thread in `SocketRead` might be hung forever or might be halfway through a normal 50 ms call.
Only repetition tells you which, which is why the answer is always three dumps, not one.

**★ The JVM runs deadlock detection for you after every dump.**
*"After printing the thread dump, the HotSpot VM executes a deadlock detection algorithm."* If
there is a `synchronized` or `java.util.concurrent` deadlock, the JVM names it and prints the
cycle. Nobody needs to reason it out by hand, and yet people frequently do.

**★ A hang in one service is often a missing timeout in another.**
Threads blocked in a socket read on a slow dependency exhaust the caller's pool, which makes the
caller unresponsive, which exhausts *its* caller's pool. The dump of the outermost service names
the failure but not the cause; the stack frames name the dependency.

**★ GC pauses are not this failure.**
They look like a hang from outside but present with busy GC threads and are diagnosed from the GC
log, not a thread dump. Reaching for a dump during a GC pause also usually fails, because the
request itself needs the VM to reach a state it is not reaching.

**★ The output may not go where you expect.**
With the Control+Break handler or `SIGQUIT`, the guide says the dump *"is printed to the standard
output of the target process"* — which in a container is the container log, and in a service
managed by a supervisor may be somewhere nobody is reading. `jcmd` returns it to your terminal
instead, which is one more reason to prefer it.

## Interview questions

**★ A service stops responding. What is the first thing you check, and why?**
CPU, because it splits the problem in two. Near-zero CPU means threads are waiting for something —
a lock, a pool, a socket — and a thread dump usually contains the entire answer. Pinned CPU means
threads are executing and the question is what they are spending time on, which needs a sampling
profiler rather than a dump. The two are different sections of Oracle's own troubleshooting
procedure, with different tools.

**★ Why is a thread dump such a high-value first tool?**
It is one command, it is fast, it needs nothing configured in advance, and it is complete rather
than sampled — every thread, every stack, every lock held and waited for. It also runs the JVM's
own deadlock detection afterwards, so an entire class of cause is identified for you. Compared
with a heap dump, which needs disk and pauses the process, or JFR, which needs to have been
recording before the incident, it is nearly free.

**★ Why do people reach for it late, then?**
Because nothing in ordinary monitoring points at threads. During an idle hang, CPU, heap, GC and
error rate all look normal, so the dashboards read as "no problem found" rather than "look
somewhere else". There is no thread panel that turns red, so the tool that would answer the
question in a minute is reached for after an hour of eliminating things that were never wrong.

**★ Why take three dumps instead of one?**
Because one dump cannot distinguish a thread that is stuck from a thread that is simply executing
that frame right now. A thread in the same frame across three dumps taken seconds apart is stuck;
one that moves is working. Without the repetition, a perfectly normal socket read looks identical
to one that will never return.

**★ Your service is unresponsive and CPU is at 100%. Is a thread dump still useful?**
Somewhat, but it is the wrong primary tool. It will show you which frames threads are in, and
repeated dumps showing the same *running* frames point at a loop. What it cannot give you is the
distribution of time across frames, which is what identifies a hot path, so the right tool is a
sampling profiler or JFR. The dump narrows the search; the profiler answers it.

**★ The hang is in service A, and the dump shows all its threads blocked in a socket read to
service B. Whose bug is it?**
Both, and the distinction matters. Service B is slow or hung — that is one investigation, run the
same way on B. But service A is the one that fell over because it had no timeout on the call and
no bulkhead around it, so a slow dependency consumed its entire thread pool. Fixing B restores
service today; fixing A's missing timeout is what stops the next slow dependency from taking it
down. Resilience patterns for exactly this are phase 16's subject.

{/* FOOTER */}
