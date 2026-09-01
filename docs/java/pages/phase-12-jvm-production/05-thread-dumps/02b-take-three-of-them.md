---
title: "One thread dump is a photograph and cannot distinguish a thread that is stuck from a thread that is merely passing through, which is why the answer to every question this topic asks is three dumps a few seconds apart rather than one"
sidebar_label: "02b · Take three of them"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 Troubleshooting Guide**, "Troubleshoot Process Hangs
> and Loops" — both the "Diagnose a Loop Process" and "Diagnose a Hung Process" procedures
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshoot-process-hangs-loops.html)),
> and the **JDK 25 `jcmd` tool reference** for `Thread.print`'s impact rating
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)).
> 🔴 **No sandbox** — no dump on this page is a captured run.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**A thread dump records what every thread was doing at one instant. That is not the same as
recording what every thread is *stuck* doing, and the difference is the whole diagnosis. A
thread sitting in a socket read might be hung forever or might be four milliseconds into a normal
call — and a single dump renders those two identically. This page is why the habit is three
dumps, what to compare between them, and the small number of conclusions that a single dump
genuinely does support.**

## The problem with one

Consider a dump showing forty threads in a database call:

```text
"http-nio-8080-exec-17" ... 
   java.lang.Thread.State: RUNNABLE
        at java.base/sun.nio.ch.SocketDispatcher.read0(Native Method)
        ...
        at com.example.OrderRepository.findByCustomer(OrderRepository.java:88)
```

*(Schematic, not a captured dump — the frame shapes are illustrative.)*

**Is that a problem?** From this alone, there is no way to know. It is entirely consistent with:

- forty threads permanently blocked on a database that stopped answering — a hang; or
- a service serving 4,000 requests per second where each query takes 10 ms, so at any instant
  about forty threads are legitimately mid-query — perfect health.

The dump is identical in both cases. **The state of a thread at an instant carries almost no
information; the *change* between instants carries nearly all of it.**

## What three dumps tell you

Take three, five to ten seconds apart:

```bash
for i in 1 2 3; do jcmd <pid> Thread.print -l > dump-$i.txt; sleep 5; done
```

Then compare each thread across the three files:

| Across three dumps | Means |
|---|---|
| **Same thread, same frame, same lock** | **Stuck.** This is your candidate. |
| Same thread, different frames | Working normally — ignore it |
| Different threads, same frame | A busy code path, not a stuck one — unless the *count* is at the pool maximum |
| Same thread, same frame, but state alternates | Contention rather than deadlock — it is getting the lock sometimes |
| Thread present, then gone | Completed. Not your problem. |

🔴 **"Same frame in all three" is the single most useful signal in this topic**, and it costs ten
seconds to obtain. Everything else on the following pages — states, locks, pool exhaustion — is
read against that baseline.

## The loop case needs it even more

The Troubleshooting Guide separates "Diagnose a Loop Process" from "Diagnose a Hung Process"
precisely because the evidence differs. For a hang, one dump plus deadlock detection can be
conclusive. For a loop, **repetition is the only evidence a thread dump can offer at all**: a
thread `RUNNABLE` in the same method across three dumps, with CPU pinned, is a loop, and a single
dump of the same thread proves nothing whatsoever.

⚠️ Even then, a dump is a poor loop-finding tool compared with a sampling profiler, because three
samples is a very small sample. It narrows the search to a thread and a rough area; JFR or
async-profiler ([topic 06](../06-jfr-and-profiling/_plan.md)) tells you where the time actually
goes. **Use dumps to identify the loop exists and which thread; use a profiler to find the line.**

## How far apart, and how many

**Five to ten seconds** is the general answer, and the reasoning is worth understanding rather
than memorising: the interval must be long relative to the operations you want to see move, and
short relative to the failure you are diagnosing.

- **Too close together** — under a second — and normal work has not had time to progress, so
  healthy threads look stuck.
- **Too far apart** — minutes — and threads that were briefly stuck have recovered, or the pool
  has recycled, and you cannot match threads between dumps at all.
- For a suspected **deadlock**, the interval barely matters; a deadlock is permanent and will be
  in every dump. Take the three anyway, because you do not yet know it is a deadlock.
- For **intermittent slowness**, more dumps over a longer window beat three close together — you
  are trying to catch the episode, not characterise a steady state.

**Three is a floor, not a ceiling.** Five or six costs nothing: `Thread.print` is rated
*"Impact: Medium --- depends on the number of threads"*, which for a normal service is
milliseconds of work. Taking too few is a much more common mistake than taking too many.

## What one dump *is* enough for

Three exceptions, and they are worth knowing because they let you conclude early:

1. **A detected deadlock.** The JVM runs its own detection after every dump and prints
   `Found one Java-level deadlock` with the cycle ([05b](05b-deadlock.md)). Deadlocks do not
   resolve, so one dump is proof.
2. **Pool exhaustion with a countable maximum.** If the pool's configured maximum is 200 and the
   dump contains 200 threads of that pool all waiting, the pool is exhausted at that instant
   regardless of what happens next ([06](06-pool-exhaustion.md)). The dump does not tell you
   *why*, but the saturation itself is established.
3. **A thread in a state that cannot be transient**, such as blocked on a lock held by a thread
   that is itself waiting on something that has clearly stopped.

Everything else needs the comparison.

## Comparing them without going mad

A dump of a busy service is thousands of lines, and reading three of them line by line is not
realistic. Two practical approaches:

**Group and count, rather than read.** The question is usually "how many threads are in the same
place", not "what is thread 17 doing". Extracting the top frame of each thread and counting
occurrences turns a 5,000-line file into a twenty-line summary, and the shape of that summary is
what identifies pool exhaustion instantly.

**Diff the dumps against each other.** Threads that appear identically in all three float to the
top as the unchanged part. This works better than it sounds, because thread names in a pool are
stable — `http-nio-8080-exec-17` is the same thread across all three files.

⚠️ **A caveat on both: thread *ids* are stable across dumps but thread *ordering* is not
guaranteed.** Match by name and id, not by position in the file.

## Gotchas

**★ One dump cannot distinguish stuck from busy.**
A thread in a socket read looks the same whether it has been there for six minutes or four
milliseconds. The state at an instant carries little information; the change between instants
carries nearly all of it.

**★ Forty threads in a database call may be perfect health.**
At sufficient throughput, a healthy service always has threads mid-query. The number in a frame is
meaningless without knowing the throughput and the operation's duration — or without a second
dump showing whether they are the *same* threads.

**★ Five seconds apart, not one.**
Too close and normal work has not progressed, so healthy threads look stuck. Too far and the
episode is over or the pool has recycled and the threads cannot be matched.

**★ Three is a floor.**
`Thread.print` is cheap — milliseconds for a normal service. Taking six costs nothing and taking
two is the common regret. Nobody has ever wished they took fewer dumps during an incident.

**★ Match threads by name and id, not by position.**
Ordering within a dump is not guaranteed to be stable, but names in a pool are. Comparing line 400
of one file against line 400 of the next compares different threads.

**★ For a loop, repetition is the only evidence a dump can give.**
A `RUNNABLE` thread in one dump proves nothing. The same thread `RUNNABLE` in the same method
across three, with CPU pinned, is a loop — and even then a profiler is the tool that finds the
line, because three samples is a very small sample.

**★ A deadlock needs only one dump.**
The JVM detects it and prints the cycle, and deadlocks do not resolve. Take three anyway, because
you do not know it is a deadlock until you have looked.

**★ Read dumps by grouping, not by reading.**
The useful question is how many threads share a top frame. Counting frames turns thousands of
lines into a twenty-line summary in which pool exhaustion is obvious at a glance.

**★ Take the dumps before you start fixing.**
Restarting the service destroys the evidence, and the pressure to restart during an incident is
enormous. Three dumps take fifteen seconds and are frequently the only artefact that survives to
the postmortem.

## Interview questions

**★ Why take three thread dumps instead of one?**
Because a single dump cannot distinguish a stuck thread from a busy one. A thread in a socket read
looks identical whether it will never return or is four milliseconds into a normal call. Comparing
dumps taken seconds apart converts the instantaneous state into a trend: same thread, same frame,
across all three means stuck; anything else means working.

**★ How far apart, and why does the interval matter?**
Five to ten seconds for a typical service. The interval has to be long relative to the operations
you want to see progress — otherwise healthy threads have not moved and look stuck — and short
relative to the failure, or the episode ends and pool threads recycle so you cannot match threads
between dumps. For a permanent condition like a deadlock the interval is irrelevant; for
intermittent slowness, more dumps across a wider window beat three close together.

**★ When is a single dump sufficient?**
When the JVM reports a deadlock, since it runs detection after every dump and deadlocks do not
resolve; when a pool with a known maximum shows exactly that many threads all waiting, which
establishes saturation at that instant; and when a thread is in a state that cannot be transient.
Everything else needs comparison.

**★ You have three dumps from a 400-thread service. How do you read them?**
Not line by line. Extract each thread's top frame and count occurrences, which turns each dump
into a short summary where pool saturation is immediately visible. Then match threads across the
three by name and id — not by position, since ordering is not guaranteed — and look for those in
the same frame in all three. Those are the candidates; everything else is noise.

**★ Your dumps show a thread whose state alternates between `BLOCKED` and `RUNNABLE`. What does
that tell you?**
That it is contention, not deadlock. The thread is acquiring the lock sometimes, so there is no
cycle — some other thread holds it often enough or long enough to hurt. The follow-up is which
thread holds it and for how long, which points at lock scope or at a slow operation performed
while holding it, rather than at a lock-ordering bug.

**★ Why is a thread dump a poor tool for a CPU loop even with three samples?**
Because three samples is a tiny sample of the execution profile. It can establish that a thread is
executing the same region repeatedly, which identifies the thread and the rough area, but it
cannot apportion time across frames — a method that appears in all three might account for 5% of
the time. Sampling profilers exist to answer the apportionment question, and the dump's job is to
narrow the search first.

**★ An incident is ongoing and there is pressure to restart. What do you do first?**
Take the dumps — three, fifteen seconds, redirected to files, copied off the host. A restart
destroys the only evidence that identifies the cause, and the failure will recur. This is the one
step during an incident that is essentially free and is unrecoverable if skipped.

{/* FOOTER */}
