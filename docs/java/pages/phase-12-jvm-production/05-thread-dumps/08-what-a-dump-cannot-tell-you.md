---
title: "A thread dump has no time axis, so it cannot tell you where CPU goes, what is allocating, how long anything took or what happened five minutes ago — and knowing the boundary is what stops you spending an afternoon taking dumps of a problem no number of dumps can answer"
sidebar_label: "08 · What a dump cannot tell you"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 Troubleshooting Guide**, "Troubleshoot Process Hangs
> and Loops" — its separation of the loop and hang procedures, and its "No Thread Dump" guidance
> on `VMThread` and `SafepointSynchronize::begin`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshoot-process-hangs-loops.html)),
> and the **JDK 25 `jcmd` tool reference** for `Thread.print`'s impact rating
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)).
> 🔴 **No sandbox** — nothing below is a captured run.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**A thread dump is an instant. Everything it is good at follows from that, and so does everything
it is bad at: it can tell you exactly what every thread was doing at one moment, and it can tell
you nothing whatsoever about duration, rate, history or cost. This page is the boundary — the
questions dumps genuinely cannot answer, and which tool owns each of them — because the expensive
mistake in this topic is not misreading a dump, it is continuing to take dumps of a problem no
number of dumps will explain.**

## The one limitation everything else follows from

**There is no time axis.** A dump records state, not elapsed time. Three dumps give you three
instants, which is enough to distinguish "stuck" from "moving" ([02b](02b-take-three-of-them.md))
and nothing more. Three samples cannot apportion time, estimate a rate, or reconstruct what
happened before you looked.

Every item below is a consequence of that single fact.

## What it cannot answer, and what can

| Question | Why the dump fails | The tool that answers it |
|---|---|---|
| **Where is CPU going?** | Three samples cannot apportion time across frames | JFR, async-profiler — topic 06 |
| **What is allocating?** | Allocation is invisible; the stack shows position, not what it created | JFR allocation events, async-profiler `alloc` — topic 06 |
| **How long did this take?** | No duration is recorded anywhere | Metrics/timers — topic 08; tracing — topic 09 |
| **Is this method slow?** | A frame's presence says nothing about time spent in it | A profiler |
| **What happened five minutes ago?** | Dumps are on demand; there is no history | Continuous JFR, logs — topic 07 |
| **Why is GC pausing?** | GC threads have no application stack | `-Xlog:gc*` — topic 02 |
| **What is on the heap?** | Dumps contain stacks, not objects | Heap dump — topic 04 |
| **Which request was this?** | No request context in a stack | Tracing and MDC — topics 07 and 09 |
| **How much memory is this using?** | No memory data at all | NMT — [topic 01](../01-memory-layout/11-native-memory-tracking.md) |

🔴 **The first two rows are where most wasted effort goes.** "The service is slow, take a thread
dump" is a reasonable first move and a terrible fifth one. If the dumps show threads *working* —
different frames, real CPU — the dump has told you everything it can, and the answer requires
sampling.

## The distinction that matters: position versus time

A stack frame in a dump means **a thread was at this position when I looked**. It does not mean
the thread spends time there.

Consider a method appearing in all three dumps. That is consistent with:

- the method taking 99% of the time — a genuine hotspot; or
- the method being on the stack of a long-running outer call that spends its time elsewhere; or
- a coincidence, at three samples.

**A profiler resolves this by taking thousands of samples**, which converts presence into
proportion. A dump cannot, and no amount of taking more dumps by hand turns three samples into a
profile — at which point you are hand-building a bad profiler.

⚠️ **This is why "it appears in every dump" feels like strong evidence and is not, for the loop
case.** For the *stuck* case it is decisive, because a stuck thread is not sampling at all — it is
genuinely not moving. The evidence is strong for hangs and weak for hotspots, and telling those
apart is the skill.

## The cost you cannot ignore at scale

`Thread.print` is rated *"Impact: Medium --- depends on the number of threads"*, and
`Thread.dump_to_file` likewise. For a few hundred platform threads that is milliseconds. For a
service with a very large number of virtual threads ([07](07-virtual-threads.md)) it is not
nothing.

🔴 **So "just take dumps in a loop" is not a monitoring strategy.** It is an incident technique.
Continuous visibility is what JFR is for — it is designed to run always-on at low overhead, which
a repeated dump is not.

## What a dump *is* uniquely good at

Stating this fairly matters, because the boundary cuts both ways. Nothing else gives you:

- **Complete state.** Every thread, not a sample. A profiler shows you where time goes and can
  miss a single thread that is stuck doing nothing.
- **Lock ownership.** Who holds what, right now ([05](05-locks-in-a-dump.md)).
- **Free deadlock detection**, performed by the JVM after every dump
  ([05b](05b-deadlock.md)).
- **Zero prerequisites.** No agent, no flag set yesterday, no recording started before the
  incident.

**A profiler is better at "where does the time go". A dump is better at "why is nothing
happening".** Those are different questions and the mistake is bringing one tool to the other.

## When to stop taking dumps

Four signals that the dump has given you everything it has:

1. **Threads are moving across dumps.** Different frames each time means they are working; the
   question has become where the time goes, which is a profiler's.
2. **The dumps look healthy and the problem is real.** Nothing blocked, nothing saturated, no
   deadlock — the failure is not thread-shaped. Look at GC, at memory, at the network, at the
   dependency.
3. **You have identified the frame and need to know why it is slow.** The dump has done its job;
   the next question is inside that method.
4. **`VMThread` is the anomaly.** The Troubleshooting Guide singles it out: if it is stuck in
   `SafepointSynchronize::begin`, this is a safepoint problem, not an application one, and more
   application-thread dumps will not help.

## The handoff, concretely

Once a dump has narrowed the problem, the next tool is determined by what it narrowed to:

- **Threads waiting on a dependency** → the dependency's own investigation, plus a review of your
  timeouts and bulkheads (phase 16).
- **Threads waiting on a lock** → the holder's stack, then a profiler if the holder is slow rather
  than blocked.
- **Threads working** → JFR or async-profiler for CPU, and JFR allocation events if the suspicion
  is allocation pressure.
- **Threads look fine** → GC log first, since a long pause looks like a hang from outside and is
  invisible in a thread dump; then memory ([topic 01](../01-memory-layout/12-the-checklist.md)).
- **Nothing in the JVM looks wrong** → the problem is probably outside it: the load balancer, the
  network, the dependency, the database.

## Gotchas

**★ A dump has no time axis, and every other limitation follows from that.**
It records state, not duration. Three dumps give three instants — enough to tell stuck from
moving, and nothing more.

**★ A frame's presence says nothing about time spent in it.**
"It appears in every dump" is decisive evidence for a *stuck* thread and weak evidence for a
hotspot, because three samples cannot apportion time. Telling those two readings apart is the
central skill of this page.

**★ Taking dumps in a loop is hand-building a bad profiler.**
If you find yourself scripting dumps every few seconds to find where time goes, the answer is JFR
or async-profiler. They exist because thousands of samples are needed, and they are designed for
continuous low overhead in a way repeated dumps are not.

**★ A dump cannot see allocation at all.**
The stack shows where a thread is, not what it created. Allocation pressure — a common cause of
latency problems — is entirely invisible and needs JFR's allocation events or a profiler's alloc
mode.

**★ GC pauses look like a hang and are invisible in a thread dump.**
GC threads have no application stack, and application threads are simply stopped. The GC log is
the evidence, and a thread dump taken during a long pause frequently does not even return.

**★ There is no history.**
Dumps are on demand. A question about five minutes ago cannot be answered by a dump taken now,
which is the strongest argument for running JFR continuously — the evidence for an incident that
has already ended.

**★ `Thread.print` is not free at very large thread counts.**
Rated Impact: Medium, depending on thread count. On a virtual-thread service that is a real
caveat, and it is another reason repeated dumps are not a monitoring strategy.

**★ A dump cannot tell you which request a thread is serving.**
There is no request context in a stack. Correlation ids in the MDC (topic 07) and tracing
(topic 09) are what connect a thread to a request, and without them a dump of a busy service is
anonymous.

**★ If `VMThread` is stuck in `SafepointSynchronize::begin`, stop looking at application threads.**
The guide flags this specifically: it indicates a problem bringing the VM to a safepoint, which is
a JVM-level issue and a completely different investigation.

**★ The dump is uniquely good at exactly what a profiler is bad at.**
Complete state rather than a sample, lock ownership, free deadlock detection, and no prerequisites.
A profiler can miss the one thread that is stuck doing nothing precisely because it is doing
nothing.

## Interview questions

**★ What can a thread dump not tell you?**
Anything involving time. It has no duration, no rate and no history, so it cannot say where CPU
goes, what is allocating, how long an operation took, or what happened before you took it. It also
contains no heap data, no GC information and no request context. All of those belong to other
tools — profilers, GC logs, heap dumps, metrics and tracing.

**★ When do you stop taking thread dumps and reach for a profiler?**
When threads are moving between dumps. Different frames each time means they are working, and the
question has shifted from "why is nothing happening" to "where is the time going" — which needs
thousands of samples rather than three. Also when the dumps look healthy and the problem is real,
which means the failure is not thread-shaped at all.

**★ A method appears in all three of your dumps. How strong is that evidence?**
It depends entirely on which question you are asking. For a hang it is decisive: a stuck thread is
not being sampled, it genuinely is not moving. For a hotspot it is weak, because three samples
cannot distinguish a method that consumes 99% of the time from one that happens to be on the stack
of a long outer call. Presence is not proportion, and only a profiler converts one into the other.

**★ Why is a thread dump useless for diagnosing a long GC pause?**
Because GC threads have no application stack to show, and application threads are simply stopped
at a safepoint, so the dump shows them wherever they happened to stop — which is uninformative. The
evidence for GC behaviour is the GC log. In practice the dump often cannot even be taken during a
pause, because the request needs the VM to reach a state it is not reaching.

**★ Would you script thread dumps every ten seconds as monitoring?**
No. Both `Thread.print` and `Thread.dump_to_file` are rated Impact: Medium depending on thread
count, which is significant on a virtual-thread service, and three-samples-at-a-time is a poor
substitute for a profiler regardless. Continuous visibility is what JFR is designed for — always-on
at low overhead — and it also gives you history, which is the thing dumps most conspicuously lack.

**★ What is a thread dump uniquely better at than a profiler?**
Completeness and lock information. It shows every thread rather than a statistical sample, so it
catches the single thread that is stuck doing nothing — which a profiler, by construction, sees no
samples from. It shows lock ownership directly, and the JVM performs deadlock detection after
every dump. And it needs nothing set up beforehand, which matters when the incident is happening
now and no recording was running.

**★ Your dumps show nothing wrong but the service is definitely degraded. What next?**
Accept that the failure is not thread-shaped and move on rather than taking more dumps. The GC log
first, since a long pause presents as a hang and is invisible here; then memory via NMT, since
native growth can degrade a process without touching thread state; then outside the JVM entirely —
the load balancer, the network, the dependency. And check `VMThread` on the way past, because a
safepoint problem shows up there and nowhere else.

{/* FOOTER */}
