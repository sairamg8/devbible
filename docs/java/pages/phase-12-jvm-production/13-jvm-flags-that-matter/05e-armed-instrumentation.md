---
title: "Native Memory Tracking and Flight Recorder are the two flags here with a running cost, and they buy the one thing a heap dump cannot — the period before the symptom, which cannot be reconstructed after it"
sidebar_label: "05e · Armed instrumentation"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the JDK 25 `java` tool reference —
> [`-XX:NativeMemoryTracking`](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html),
> its three modes quoted verbatim — and the JDK 25 `jcmd` tool reference
> ([jcmd](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)) for
> `VM.native_memory` and its documented `Impact: Medium`. Target: **JDK 25 (LTS)**.
> Documentation-validated; **no sandbox run**.

**The flags on [the diagnostics page](05d-the-live-list-diagnostics.md) fire at the moment of
failure and cost nothing until then. These two are different: they instrument the JVM
continuously, they have a real running cost, and what they buy is the period *leading up* to
the symptom — the allocation rate climbing, the threads accumulating, the native footprint
growing while the heap sits flat. That is routinely where the cause is, and it is the one thing
no post-mortem artefact contains. They share the group's defining property in a harsher form:
not only can they not be turned on retroactively, the data they would have collected does not
exist and cannot be reconstructed.**

## `-XX:NativeMemoryTracking` — the one with a running cost

> *"Specifies the mode for tracking JVM native memory usage. Possible `mode` arguments for this
> option include the following:*
>
> *`off` — Instructs not to track JVM native memory usage. This is the default behavior if you
> don't specify the `-XX:NativeMemoryTracking` option.*
>
> *`summary` — Tracks memory usage only by JVM subsystems, such as Java heap, class, code, and
> thread.*
>
> *`detail` — In addition to tracking memory usage by JVM subsystems, track memory usage by
> individual `CallSite`, individual virtual memory region and its committed regions."*

This is the answer to the single most misdiagnosed symptom in the phase — **the pod is
OOMKilled and the heap looks healthy** — and it is the one flag here with a real continuous
cost, because it instruments allocation rather than waiting for an event.

🔴 **It cannot be enabled retroactively.** `jcmd <pid> VM.native_memory` on a JVM launched
without it reports that tracking is not enabled, and the accounting for the period you care
about does not exist and cannot be reconstructed. On an intermittent native leak, "restart with
tracking and wait for it to recur" can mean weeks.

```bash
# At launch:
-XX:NativeMemoryTracking=summary

# Then, on the running process:
jcmd <pid> VM.native_memory summary

# For a slow leak — establish a baseline, compare later:
jcmd <pid> VM.native_memory baseline
# ... hours pass ...
jcmd <pid> VM.native_memory summary.diff
```

⚠️ **`VM.native_memory` is documented at `Impact: Medium`** — the only command on the `jcmd`
page that is not `Low` — and `detail` walks *"memory allocation >= 1K by each callsite"*. Use
`summary` unless you have a specific reason; `detail` is a deliberate act with a known cost,
not a more thorough version of the same free command.

## `-XX:StartFlightRecording` — the minutes before the symptom

Everything else on this page captures the *moment* of failure. Flight Recorder captures the
period leading up to it, which is frequently where the cause is: allocation rate climbing,
threads accumulating, a lock getting hot.

⚠️ **This page does not reproduce the option's full syntax**, which is long and version-
sensitive — topic 06 owns JFR and JDK Mission Control in depth and is the place to configure
it properly. The point here is only that it belongs in the same category as the rest:
**armed in advance or useless.**

## The principle these flags share

They are not tuning. They do not change how the service behaves, and none of them will ever
show up in a benchmark. What they change is **what exists after a failure**, and that is a
property you can only buy in advance.

The argument that wins in review is the asymmetry: the cost of having them is near zero and
continuous; the cost of not having them is paid once, during an incident, and is unbounded,
because the alternative to evidence is guessing followed by "let's add the flag and wait for it
to happen again."

🔴 **This is the one group in the live list where the default answer is *on*.**
[Ergonomics](03-ergonomics.md) argues for fewer flags than you have — and these are the
exception, because they override no ergonomic decision at all.

## Gotchas

**★ Symptom: `jcmd <pid> VM.native_memory summary` reports that tracking is not enabled, on the
process that is currently misbehaving.** Cause: `-XX:NativeMemoryTracking` is a launch-time
flag; the accounting was never collected and cannot be produced after the fact. Fix: none for
this process. This is the argument for arming `summary` pre-emptively — the class of problem it
answers is the one where nothing else will tell you.

**★ Symptom: `-XX:NativeMemoryTracking=detail` is enabled in production and latency degrades.**
Cause: `detail` tracks *"memory allocation >= 1K by each callsite"*, and `VM.native_memory` is
the only `jcmd` command rated `Impact: Medium`. Fix: `summary` is the production setting; keep
`detail` for a reproduction environment or a deliberate, time-boxed window.

**★ Symptom: nobody can agree whether these flags are "safe for production", and the discussion
recurs every quarter.** Cause: they are being argued as tuning, where the burden of proof is a
benchmark. They are not tuning — they change no behaviour and will never appear in one. Fix:
argue the asymmetry instead. Continuous near-zero cost against an unbounded one-off cost paid
during an incident, when the alternative is to add the flag and wait for the failure to happen
again.

**★ Symptom: NMT's summary is read as the process's memory usage and does not match what the container reports.** Cause: NMT accounts for what the **JVM** reserved and committed, and the two numbers mean different things — reserved is address space, committed is backed memory. Neither equals the container's RSS, which also contains the native allocator's own overhead, mapped files and anything a JNI library allocated outside the JVM's accounting. Fix: read NMT for *which JVM subsystem is growing*, and the container's own metric for *how close to the limit you are*. They answer different questions and disagreeing is normal.

**★ Symptom: a Flight Recorder recording is configured and the file is empty or absent after a crash.** Cause: a recording is written when it is stopped or dumped, and a process killed by the kernel — `SIGKILL` on an OOMKill — gets no chance to do either. Fix: configure the recording to write continuously to disk rather than relying on a dump at exit, and put it on a volume that survives the pod. A recording that only materialises on a clean shutdown is absent for exactly the failures worth recording.

**★ Symptom: NMT is enabled and the overhead is blamed for a latency regression that predates it.** Cause: `summary` has a real but small continuous cost, which makes it an easy suspect and a hard one to exonerate once suspected. Fix: settle it with the change history rather than by argument — the flag is a launch-time setting, so the question "was it on before the regression started" has a definite answer. Removing instrumentation to see whether it was the cause destroys the evidence for the actual cause.

## Interview questions

**★ Why can't you enable Native Memory Tracking on a process that is already misbehaving?**
Because it is instrumentation rather than a report. `-XX:NativeMemoryTracking` tells the JVM to
*record* subsystem allocations as they happen, so with the flag off there is no accounting for
the period you care about and none can be reconstructed. `jcmd VM.native_memory` on such a
process tells you tracking is not enabled — it is not refusing, there is genuinely nothing to
show. That leaves two bad options: restart with tracking on and wait for recurrence, which on an
intermittent native leak can be weeks, or proceed without it. The asymmetry is the argument for
arming `summary` by default, since the symptom it uniquely answers — the pod is OOMKilled while
the heap looks healthy — is one where a heap dump actively misleads you.

**★ You have one flag's worth of budget for a service with no diagnostics at all. Which?**
`-XX:+HeapDumpOnOutOfMemoryError` with `-XX:HeapDumpPath` pointed at a durable volume — treating
that pair as one flag, because the first without the second frequently produces a dump nobody
can retrieve. It costs nothing until it fires, and the artefact it produces is the only one that
answers *what* filled the heap rather than *that* it filled. If the service is containerised and
has ever been OOMKilled with a healthy-looking heap, I would argue for
`-XX:NativeMemoryTracking=summary` instead, because that symptom is the one where a heap dump
sends you in the wrong direction — but that is a real trade, since it is the only flag here with
a continuous cost.

**★ Why does this group escape the "fewer flags" argument that the rest of the topic makes?**
Because the argument against flags is that each one freezes an override of a decision the JVM
would otherwise make better as it improves. These flags override no ergonomic decision — they
change what evidence survives a failure, not how the service runs, which is why they never
appear in a benchmark and why arguing them as tuning goes in circles. The right frame is the
asymmetry between when the cost is paid and when the benefit arrives: near-zero and continuous
against unbounded and one-off, at the exact moment when the only alternative is to add the flag
and wait for the incident to happen a second time.

**★ Native Memory Tracking or a heap dump — which one answers "why did the container get killed"?**
Neither on its own, and knowing which to reach for first is the point. A heap dump answers *what objects are in the Java heap*, which is the wrong question when the heap is healthy and the process still died — it will show you a perfectly ordinary heap and send you looking for a leak that is not there. NMT answers *which JVM subsystem is consuming native memory*, which is where an OOMKill with a flat heap actually lives: metaspace, code cache, thread stacks, GC structures, direct buffers. The catch is the asymmetry in when you can get them: a heap dump can be taken on demand from a running process with `jcmd GC.heap_dump`, whereas NMT must have been armed at launch or its data does not exist. That is precisely why NMT is the one to turn on speculatively and the heap dump is the one you can afford to take later.

{/* FOOTER */}
