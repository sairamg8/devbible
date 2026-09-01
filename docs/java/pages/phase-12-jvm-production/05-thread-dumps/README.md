---
title: "Thread dumps: the service that stopped responding is the one production failure where a single command usually contains the whole answer, and the reason people reach for it last is that nothing in the metrics says the problem is a thread"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 Troubleshooting Guide**, "Troubleshoot Process Hangs
> and Loops" and "Diagnostic Tools"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshoot-process-hangs-loops.html)),
> the **JDK 25 `jcmd` tool reference** for the `Thread.*` subcommands
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)), the
> **JDK 25 `jstack` tool reference** — *"This command is experimental and unsupported"*
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jstack.html)), the
> **`java.lang.Thread.State` API documentation**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.State.html)),
> **JEPs 444 and 491** ([openjdk.org](https://openjdk.org/jeps/491)), and the **HikariCP 6.3.0
> sources** for the connection-pool call chain
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP/blob/HikariCP-6.3.0/src/main/java/com/zaxxer/hikari/util/ConcurrentBag.java)).
> 🔴 **No sandbox.** Every dump fragment in this topic is either quoted from Oracle's
> documentation with attribution, or explicitly labelled a schematic. No captured runs, no
> fabricated stacks, no invented numbers.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**A thread dump is the highest information-per-second diagnostic the JVM offers: one command, no
setup, no agent, no flag set yesterday — and it returns the complete state of every thread plus
the JVM's own deadlock analysis. It is also the tool people reach for last, because during an idle
hang every dashboard they own looks healthy. This topic is how to take one on JDK 25, how to read
it, the five failures it names, and the boundary where it stops being the right tool.**

Three things changed recently enough that most published material is wrong about them, and each
gets argued from the source rather than asserted: **`jstack` is now experimental and unsupported**
and the Troubleshooting Guide says to use `jcmd` instead; **`Thread.print` does not show virtual
threads** and fails silently on services that use them; and **`jdk.tracePinnedThreads` was removed
by JEP 491**, so the standard pinning runbook now produces no output at all.

**15 chunks, ~3,650 lines, 248 gotchas and interview questions.** Read in order; each chunk links
to the next. [09 · The checklist](09-the-checklist.md) is the page to open during an incident.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[The service that stopped responding](01-the-service-that-stopped-responding.md)** | <span className="db-tier t-understand">Understand</span> | Why the dump is first, and what idle CPU already tells you |
| 2 | **[Taking one](02-taking-one.md)** | <span className="db-tier t-understand">Understand</span> | Five mechanisms, and why `jstack` is not one to build a runbook on |
| 3 | **[Take three of them](02b-take-three-of-them.md)** | <span className="db-tier t-understand">Understand</span> | One dump is a photograph; three are a diagnosis |
| 4 | **[Anatomy of a dump](03-anatomy-of-a-dump.md)** | <span className="db-tier t-understand">Understand</span> | Two state lines that can disagree, and `nid` as the bridge to the OS |
| 5 | **[The thread states](04-the-thread-states.md)** | <span className="db-tier t-understand">Understand</span> | What each of the six implicates, and who can fix it |
| 6 | **[`RUNNABLE` does not mean running](04b-runnable-does-not-mean-running.md)** | <span className="db-tier t-understand">Understand</span> | The most consequential misreading in dump analysis |
| 7 | **[Locks in a dump](05-locks-in-a-dump.md)** | <span className="db-tier t-understand">Understand</span> | Matching waiter to holder, and the flag that hides half the locks |
| 8 | **[Deadlock](05b-deadlock.md)** | <span className="db-tier t-understand">Understand</span> | The JVM does the analysis; what it covers and what it cannot see |
| 9 | **[Livelock and lock convoys](05c-livelock-and-lock-convoys.md)** | <span className="db-tier t-understand">Understand</span> | Busy, unblocked, undetected, and making no progress |
| 10 | **[Pool exhaustion](06-pool-exhaustion.md)** | <span className="db-tier t-understand">Understand</span> | A count, not a stack — and the pool is never the bug |
| 11 | **[The connection pool in a dump](06b-the-connection-pool-in-a-dump.md)** | <span className="db-tier t-understand">Understand</span> | HikariCP's signature, and the exception that reports the whole pool |
| 12 | **[Virtual threads](07-virtual-threads.md)** | <span className="db-tier t-understand">Understand</span> | `Thread.print` misses them silently; what to run instead |
| 13 | **[Pinning in a dump](07b-pinning-in-a-dump.md)** | <span className="db-tier t-understand">Understand</span> | JEP 491 removed both the main cause and the diagnostic property |
| 14 | **[What a dump cannot tell you](08-what-a-dump-cannot-tell-you.md)** | <span className="db-tier t-understand">Understand</span> | No time axis — and every limitation follows from that |
| 15 | **[The checklist](09-the-checklist.md)** | <span className="db-tier t-understand">Understand</span> | From "it is hung" to a named cause in eight questions |

## The seven things this topic is really about

1. **Take the dumps before you do anything else.** Three, five seconds apart, with `-l`, to files.
   Fifteen seconds, and unrecoverable if skipped — a restart destroys every piece of evidence this
   topic depends on, and the pressure to restart peaks exactly when the evidence matters most.

2. **One dump cannot distinguish stuck from busy.** A thread in a socket read looks identical
   whether it will never return or is four milliseconds into a normal call. The state at an
   instant carries little information; the change between instants carries nearly all of it.

3. **`RUNNABLE` does not mean running.** The API's own definition allows a `RUNNABLE` thread to be
   waiting on an OS resource, and every blocking socket read reports it. So the most common stuck
   thread in production wears the state that reads as healthy, and the instinct to worry about
   `BLOCKED` and relax about `RUNNABLE` is backwards.

4. **The default dump hides the locks modern code actually uses.** Without `-l`, monitors are
   shown and `java.util.concurrent` ownership is not — so severe `ReentrantLock` contention
   presents as a set of idle-looking parked threads. "We took a dump and saw no contention" always
   needs the follow-up question.

5. **Count, do not read.** Threads per name prefix, per top frame, against the configured maximum.
   That reduces a 400-thread file to a handful of lines in which pool saturation — the most common
   finding in this topic — is visible at a glance.

6. **There are always two causes, and only one is yours.** A slow dependency explains today's
   incident; the missing timeout, absent bulkhead or unbounded pool explains why it became an
   outage. Fixing only the remote one guarantees a repeat with a different dependency.

7. **A dump has no time axis.** It cannot tell you where CPU goes, what is allocating, how long
   anything took, or what happened five minutes ago. Knowing that boundary is what stops an
   afternoon spent taking dumps of a problem no number of dumps can answer.

## Where this connects

- **[01 · Memory layout](../01-memory-layout/README.md)** owns thread stacks themselves —
  [`-Xss` and the thread-count arithmetic](../01-memory-layout/06-thread-stacks.md), and
  [virtual thread stack chunks on the heap](../01-memory-layout/06b-virtual-thread-stacks.md),
  which is the memory cost this topic's virtual-thread pages assume.
- **02 · GC in practice** owns the GC log. A long pause presents as a hang from outside and is
  invisible in a thread dump, so it is the first exit when the dumps look healthy.
- **04 · `OutOfMemoryError`** owns heap dumps. Different dump, different question — objects rather
  than stacks.
- **06 · JFR and profiling** owns everything with a time axis: where CPU goes, what allocates,
  and the history a dump cannot have. Every "stop taking dumps" exit in
  [08](08-what-a-dump-cannot-tell-you.md) points there.
- **Phase 6 · Concurrency** owns the constructs themselves — monitors, `java.util.concurrent`,
  virtual threads. This topic reads their consequences under failure.
- **Phase 16 · Resilience** owns the timeouts, bulkheads and circuit breakers that are the answer
  to most findings here.

{/* FOOTER */}
