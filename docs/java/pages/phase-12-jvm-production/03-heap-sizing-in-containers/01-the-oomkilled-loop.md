---
title: "A container that dies at exit code 137 leaves no stack trace, no heap dump and no log line, because SIGKILL cannot be handled — so the first job is to prove which of the several things that send SIGKILL actually did it"
sidebar_label: "01 · The OOMKilled loop"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Kubernetes documentation**, "Resource Management for
> Pods and Containers"
> ([kubernetes.io](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)),
> whose *"My container is terminated"* section carries the `kubectl describe pod` sample
> quoted below; the **JDK 25 Troubleshooting Guide**, "Understand the OutOfMemoryError
> Exception"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshooting-memory-leaks.html));
> and the **JDK 25 `java` tool reference**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**An OOMKill is the only JVM failure mode where the JVM is not a witness. The kernel decides,
`SIGKILL` is delivered, and the process stops between two instructions — no shutdown hook, no
`finally`, no flush of the log appender's buffer, no `-XX:+HeapDumpOnOutOfMemoryError`. Every
piece of evidence you will ever get lives outside the container, and most of it is gone within
minutes. This page is about recognising the loop, extracting the evidence that does exist, and
resisting the single most common wrong turn: opening a heap dump for an incident where the heap
was never the problem.**

## What actually happens, in order

1. The JVM commits memory — heap pages it has touched, a metaspace arena, a code-cache page, a
   thread stack, a direct `ByteBuffer` — and the cgroup's charged memory rises.
2. The charge crosses `memory.max` (cgroup v2) or `memory.limit_in_bytes` (v1). The kernel first
   tries to reclaim: it writes back dirty page cache and drops clean cache belonging to that
   cgroup. Anonymous memory (which is nearly all of a JVM's footprint) cannot be dropped, and
   without swap it cannot be paged out either.
3. Reclaim fails. The cgroup OOM killer picks a victim inside the cgroup and sends `SIGKILL`.
4. The process disappears. Exit status 137 = 128 + 9.
5. The orchestrator restarts the container. `restartPolicy: Always` is the default for a
   Deployment, so this repeats, with `CrashLoopBackOff` throttling if it happens fast enough.

Step 2 is the one people mis-model. The Kubernetes documentation is explicit that the limit is
not a wall you bounce off:

> *"memory limits are enforced by the kernel with out of memory (OOM) kills. When a container
> uses more than its memory limit, the kernel may terminate it. However, terminations only
> happen when the kernel detects memory pressure. Thus, a container that over allocates memory
> may not be immediately killed. This means memory limits are enforced reactively. A container
> may use more memory than its memory limit, but if it does, it may get killed."*

That paragraph explains the most confusing property of the whole failure: **the kill is not
punctual**. A pod can sit above its limit for a while and then die at an unrelated moment, which
is why the metric graph so often shows the process apparently *below* the limit at the timestamp
of death — the sample before the kill is the last one that got scraped.

## The evidence that exists

The container's own last state is the primary record. The Kubernetes documentation's own sample
output for a container killed on memory (reproduced here from that page, not from a run of
anything):

```
State:          Running
  Started:      Tue, 07 Jul 2019 12:54:41 -0700
Last State:     Terminated
  Reason:       OOMKilled
  Exit Code:    137
  Started:      Fri, 07 Jul 2019 12:54:30 -0700
  Finished:     Fri, 07 Jul 2019 12:54:33 -0700
Ready:          False
Restart Count:  5
```

Three fields carry the whole diagnosis. **`Reason: OOMKilled`** is the kernel's verdict, not an
inference. **`Restart Count`** is the rate — the difference between a leak that takes ten minutes
and one that takes ten days, and the single most useful number for deciding whether you are
chasing a leak or a sizing error. **The gap between `Finished` and the new `Started`** tells you
whether backoff has started throttling.

Outside that, in rough order of usefulness:

- **`kubectl get events` / the kubelet log**, which record the kill and any node-pressure
  eviction. Events expire (one hour by default in many clusters), so capture them early.
- **`dmesg` on the node**, which distinguishes a *cgroup* OOM kill from a *global* one. The
  global killer prints the whole candidate table; the cgroup killer names one cgroup.
- **Your memory time series**, if you were already recording it. See the gotcha below about
  which metric you are actually looking at.
- **Nothing from inside the JVM**, unless you arranged for it in advance — an always-on JFR
  recording written to a volume, or GC logs shipped off the container as they are produced.

## The three shapes of the loop, and what each means

**Immediate, on every start, within seconds.** The JVM is committing more at startup than the
limit allows. Almost always a hard-coded `-Xmx` at or near the container limit combined with
`-XX:+AlwaysPreTouch`, or `-Xms` set equal to a `-Xmx` that was already too large. This one is
cheap to diagnose because it is deterministic — see
[03b · Why not `-Xmx`](03b-why-not-xmx.md) and [09 · `AlwaysPreTouch`](09-alwayspretouch.md).

**Slow and monotonic, hours to days, independent of traffic.** Something is accumulating. If the
heap is flat, it is native — a classloader leak growing metaspace, thread stacks from an
unbounded executor, direct buffers whose cleaners never run. The tool is Native Memory Tracking,
not a heap dump: [11 · Native Memory Tracking](../01-memory-layout/11-native-memory-tracking.md).

**Correlated with load, especially with a burst.** Something is sized per-request or
per-connection. Thread count, direct buffers on an NIO stack, an off-heap cache. The footprint
that matters is the *peak*, and a sizing exercise that used average load will never find it.

## The wrong turn

The single most expensive mistake here is treating `Reason: OOMKilled` as a synonym for
`OutOfMemoryError`. They are different failures with almost no overlapping evidence, and the
difference is the whole of
[01b · `OutOfMemoryError` vs OOMKilled](../01-memory-layout/01b-oom-error-versus-oomkilled.md).
The short version: if you have a stack trace, the JVM hit one of *its* limits and the detail
message names the region. If you have a 137, the JVM hit none of its limits and the process was
simply too big for the cgroup. Raising `-Xmx` — the reflex fix for the first — makes the second
strictly worse.

## Gotchas

**★ Exit code 137 does not mean OOMKilled. It means `SIGKILL`.**
128 + 9. The cgroup OOM killer is one source of `SIGKILL`; the kubelet sending it after
`terminationGracePeriodSeconds` expires on a shutdown that did not finish is another, and so is
an operator running `kill -9`. The field that distinguishes them is `Reason`: `OOMKilled` versus
`Error`. A runbook that keys on the exit code alone will send you memory-hunting for what is
actually a graceful-shutdown bug — which is
**12 · Graceful shutdown** *(not written yet)*, not this topic.

**★ Node-pressure eviction is not an OOMKill and behaves differently.**
When the *node* runs low, the kubelet evicts pods by QoS class and by how far each exceeds its
request; the pod is terminated with a status of `Evicted` and usually rescheduled elsewhere. An
OOMKill is the kernel acting on one cgroup, and the pod stays where it is and restarts in place.
The fixes are different: eviction is about requests and node capacity, an OOMKill is about the
limit and the process. [06 · Requests, limits and the JVM](06-requests-limits-and-the-jvm.md)
separates the two.

**★ The container that died may not be the container you care about.**
A multi-container pod has per-container limits. A log sidecar or a service-mesh proxy that gets
killed shows up as a pod-level disturbance while the JVM was entirely innocent. Read `Last
State` per container, not per pod, before touching a single JVM flag.

**★ `container_memory_working_set_bytes` is not the JVM's RSS.**
It is the cgroup's charge minus inactive file cache, which means it includes page cache
attributable to the cgroup — log files being written, a jar being read, a memory-mapped data
file. A JVM whose anonymous memory is perfectly flat can push the working set to the limit
purely through page cache. That is the metric the kernel's reclaim decision is closest to, so it
is the right one to alert on, but it is the wrong one to compare against `-Xmx`.

**★ The kernel picks a victim inside the cgroup, and it is usually but not always the JVM.**
The cgroup OOM killer scores processes; a JVM with a large RSS is the obvious candidate, but if
your entrypoint spawns a child — a shell wrapper, a sidecar-in-the-same-container agent, an
exec'd `jcmd` — the child can be chosen instead, and you get a container that survives with a
mysteriously dead helper process rather than a clean restart.

**★ Swap does not save you and usually is not there.**
Kubernetes nodes have historically run with swap disabled, and even where NodeSwap is enabled a
`Guaranteed` pod gets no swap by default. Without swap, anonymous memory is unreclaimable, so
the sequence "pressure → reclaim → kill" collapses to "pressure → kill" for a JVM.

**★ A restart resets every piece of in-container evidence.**
The container filesystem is recreated. Any heap dump, GC log or JFR file written to the
container's own writable layer is gone. The Kubernetes documentation states the rule plainly:
*"After a crash, kubelet restarts the container with a clean state."* Arranging for evidence to
survive is [08 · Getting a dump out of a container](08-getting-a-dump-out-of-a-container.md).

**★ Killing on the *first* over-limit moment is not what happens, so the timestamps lie.**
Because enforcement is reactive, the kill time is when the kernel *noticed*, which can be
seconds or minutes after the allocation that made it inevitable. Correlating the kill timestamp
with a request in the access log is therefore weak evidence; correlating the *growth* with a
traffic pattern is strong evidence.

**★ A pod that is OOMKilled but never reports a high heap is the normal case, not the anomaly.**
Heap is one region of about twenty. If your dashboard shows only heap, an OOMKill will always
look inexplicable. The map is
[01 · Heap is not the process](../01-memory-layout/01-heap-is-not-the-process.md).

**★ `CrashLoopBackOff` hides the rate.**
Once backoff kicks in, restarts slow to one every five minutes regardless of how fast the
process is actually dying. The restart *interval* stops being a measurement of the leak the
moment backoff starts; use `Restart Count` over a long window and the `Finished` minus `Started`
deltas instead.

**★ Increasing the limit is a legitimate first move, and a terrible only move.**
If the process genuinely needs more memory than it has, raising the limit is the fix. But if the
cause is unbounded growth, raising the limit only lengthens the interval between kills — and it
also lengthens the interval between the useful signal and your noticing, because a leak that
kills daily is easier to catch than one that kills weekly. Raise the limit to buy time, then
measure, using the ordered sequence in
[10 · The checklist](10-the-checklist.md).

## Interview questions

**★ A pod restarts every few hours with exit code 137. Walk me through your first five minutes.**
First I confirm what killed it: `kubectl describe pod` and read `Last State` for the *specific
container*, because 137 is `SIGKILL` and the `Reason` field is what distinguishes an OOMKill from
a grace-period timeout. If it says `OOMKilled`, I note `Restart Count` and the `Finished`
timestamps to get the rate. Then I ask whether the JVM's own limits were involved at all — is
there an `OutOfMemoryError` in the log before the kill? If yes, the JVM told me the region and I
follow that. If no, the process was simply too big for the cgroup, and the question becomes
which region grew. I check whether the heap was flat at the time; a flat heap plus a rising RSS
sends me to Native Memory Tracking rather than to a heap dump. Only then do I look at the flags,
and the first thing I look for is a hard-coded `-Xmx` sized against the container limit.

**★ Why is there no heap dump after an OOMKill, and can you arrange for one?**
There is none because `SIGKILL` cannot be caught: the JVM never runs another instruction, so
`-XX:+HeapDumpOnOutOfMemoryError` — which is a handler inside the JVM anyway, and only for heap
exhaustion — never fires. You cannot make the JVM dump on the way out. What you can do is
capture state *before* the kill: an always-on JFR recording with `dumponexit` written to a
mounted volume, periodic `jcmd VM.native_memory summary` snapshots shipped as metrics or logs, or
a memory alert that triggers a dump while the process is still alive. All of them require the
output to leave the container's writable layer, because a restart discards it.

**★ The memory graph shows the pod comfortably under its limit at the moment it was killed. Is
the graph wrong?**
Probably not, but it is answering a different question. Two things converge. First, enforcement
is reactive — the documentation says terminations happen when the kernel detects pressure, so the
process can be over the limit for some time before the kill, and the last successful scrape can
predate that. Second, scrape intervals are typically 15 to 60 seconds and a JVM can commit
hundreds of megabytes in far less than that; the peak simply was not sampled. The graph is
evidence about the trend, not about the instant of death.

**★ What is the difference between a pod being OOMKilled and a pod being evicted?**
An OOMKill is the Linux kernel's cgroup memory controller sending `SIGKILL` because that
container exceeded its own limit; the pod stays scheduled on the node and the container restarts
in place, with `Reason: OOMKilled`. An eviction is the kubelet reclaiming resources because the
*node* is under pressure; it terminates whole pods chosen by QoS class, prefers `BestEffort`
first, and the pod is marked `Evicted` and rescheduled. The first is a per-container sizing
problem. The second is a cluster capacity and requests problem, and no JVM flag fixes it.

**★ Your service is OOMKilled only under peak load, never at steady state. What does that tell
you about which region is growing?**
That the growth is proportional to concurrency rather than to time. That rules out the classic
monotonic leaks — a classloader leak or an unbounded static cache would grow at steady state
too. It points at per-request or per-connection allocation: thread stacks if the pool is
unbounded, direct buffers if there is an NIO or Netty layer sizing buffers per connection, or a
heap that is fine on average but whose *peak* live set plus GC headroom exceeds what the budget
left. The practical consequence is that any sizing measurement taken at average load is useless
here; the number to capture is peak concurrency.

{/* FOOTER */}
