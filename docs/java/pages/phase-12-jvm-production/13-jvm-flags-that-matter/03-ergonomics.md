---
title: "The JVM sizes itself from the machine it finds, and the thresholds are specific numbers — two processors and 1792 MB, a quarter of memory for the heap — so a small container silently gets a different collector, not a smaller G1"
sidebar_label: "03 · Ergonomics"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the JDK 25 HotSpot GC Tuning Guide —
> [Ergonomics](https://docs.oracle.com/en/java/javase/25/gctuning/ergonomics.html), quoted
> verbatim below, and the JDK 25 `java` tool reference. Target: **JDK 25 (LTS)**.
> Documentation-validated; **no sandbox run**.

**Before a single flag of yours is read, the JVM has already chosen a garbage collector, an
initial heap size and a maximum heap size by inspecting the machine. That process is called
ergonomics, and its thresholds are not vague — they are exact, documented numbers with
sharp edges. Two processors and 1792 MB of memory is the line between *server-class* and
not, and crossing it does not give you a smaller G1 heap; it gives you **the Serial
collector instead of G1**. Most flags you inherit exist to override one of these decisions,
which means every one of them is frozen at the quality of the ergonomics on the day it was
added, while the ergonomics themselves have improved with every release since.**

## What ergonomics is, in the tuning guide's words

> *"Ergonomics is the process by which the Java Virtual Machine (JVM) and garbage collection
> heuristics, such as behavior-based heuristics, improve application performance."*

And the three defaults it selects, quoted exactly:

> *"Garbage-First (G1) Collector on server-class machines, Serial Collector otherwise."*

> *"Initial heap size of 1/64 of physical memory"*

> *"Maximum heap size of 1/4 of physical memory"*

## The server-class threshold is a cliff, not a slope

This is the sentence worth memorising, because almost nothing else in the JVM has a
threshold this specific and this consequential:

> *"The VM considers machines as server-class if the VM detects two or more processors and
> physical memory larger than or equal to 1792 MB."*

**Both conditions, not either.** One CPU disqualifies a machine with 64 GB. 1791 MB
disqualifies a machine with 32 cores.

And the consequence of failing the test is not a proportionally smaller configuration — it
is a **different collector**. Serial GC is a good collector for what it is designed for: a
small heap, a single processor, and a workload that does not mind stop-the-world pauses
proportional to the live set. It is a very poor match for a latency-sensitive HTTP service
that someone has scheduled into a modest container.

| Container | Server-class? | Collector |
|---|---|---|
| 2 CPU, 4 GiB | ✅ both conditions met | **G1** |
| 1 CPU, 8 GiB | ❌ one processor | **Serial** |
| 4 CPU, 1.5 GiB | ❌ below 1792 MB | **Serial** |
| 2 CPU, 1792 MB exactly | ✅ *"larger than or equal to"* | **G1** |

🔴 **This is the mechanism behind a whole genre of mysterious latency reports.** A service is
fine in staging on a 4 GiB pod and slow in a cost-reduced environment at 1.5 GiB, and the
team looks for a memory problem — more GC, more pressure, a smaller heap — because that is
the obvious hypothesis. The heap is smaller, but the *collector changed*, and nothing in the
application logs says so. `05b-the-live-list-gc.md` *(not written yet)* covers collector
selection as a deliberate decision; here the point is only that a default was silently made
for you and it moved.

⚠️ **The tuning guide's ergonomics page says nothing about containers** — the phrase it uses
is *"physical memory"*. The container behaviour is documented elsewhere: HotSpot has been
container-aware since JDK 10 and, with `UseContainerSupport` on by default, reads the cgroup
limit rather than the host's memory. So on a containerised platform "physical memory" in the
sentences above means **your cgroup limit**, and the 1792 MB threshold is tested against the
pod's limit, not the node's. That is what makes the cliff reachable in normal operation:
almost no bare-metal server fails the test, and a great many containers do.

## A quarter of memory, and why the number is smaller than people expect

*"Maximum heap size of 1/4 of physical memory"* surprises teams sizing containers for the
first time. Give the pod 2 GiB and the default maximum heap is roughly 512 MiB — the JVM has
deliberately left three quarters of the limit unused.

That is not waste, and this is the point most often missed: **the heap is not the process.**
Metaspace, the code cache, thread stacks, GC structures, direct and mapped buffers and the
native allocator all live outside `-Xmx`, and the container limit has to cover all of them.
A conservative default keeps the JVM's own growth from pushing the *process* past the cgroup
limit, where the kernel kills it outright rather than throwing `OutOfMemoryError`.

25% is nonetheless conservative for a dedicated container running one JVM, which is the
normal shape today. Raising it is one of the few overrides that is nearly always justified —
via `-XX:MaxRAMPercentage`, not `-Xmx`, so it survives a resize. Topic 03 owns the arithmetic
and the OOMKilled-versus-`OutOfMemoryError` distinction;
`05-the-live-list-memory.md` *(not written yet)* covers the flag.

*"Initial heap size of 1/64 of physical memory"* is the other half. The gap between initial
and maximum is why a JVM grows its heap during warm-up, and why `-Xms` set equal to `-Xmx`
is a real technique for latency-sensitive services — it trades memory for the absence of
resize pauses.

## The argument for fewer flags

Ergonomics is not a fallback for people who have not tuned. It is a set of heuristics that
is revised every release against a large body of real workloads, using information your flag
string does not have: the actual processor count, the actual memory limit, and increasingly
the observed behaviour of your application.

A flag is a permanent override of one of those decisions. That is sometimes correct — you
know something the heuristic cannot, such as that this service must never pause for 200 ms.
But it has a standing cost that people do not price in:

- **It is frozen.** The heuristic improves with each release; your number does not.
- **It does not travel.** A number correct for a 2 GiB pod is wrong the day capacity
  planning gives you 8 GiB, and nothing will tell you.
- **It compounds.** Overriding heap size changes what the collector's own heuristics see, so
  the second flag is added to fix what the first one caused. Long flag strings are usually a
  chain of these, not a set of independent decisions.

🔴 **The default position on JDK 25 is fewer flags than you have.** Not zero — the diagnostics
in `05c-the-live-list-diagnostics.md` *(not written yet)* cost nothing and pay for themselves
once — but every flag that overrides an ergonomic decision should be able to name the
measurement that justified it. `08-the-discipline.md` *(not written yet)* is that rule as a
practice.

## Ergonomics is visible, not inferred

You never have to guess which decisions were ergonomic. The JVM reports the origin of every
flag value, and `{ergonomic}` is one of the origins it distinguishes from `{default}` and
`{command line}`. That is the subject of `04-printflagsfinal.md` *(not written yet)*, and it
is the tool that turns this page from background into something actionable: you can ask a
running service which of its settings it chose for itself, and which one of your flags is
overriding a choice it would have made better.

## Gotchas

**★ Symptom: a service gets noticeably slower after its container memory limit is reduced
from 2 GiB to 1.5 GiB, by much more than the memory change suggests.** Cause: 1.5 GiB is
below the 1792 MB server-class threshold, so ergonomics selected the **Serial collector**
instead of G1. This is a collector change, not a heap-size change, and nothing in the
application log mentions it. Fix: confirm before theorising, then choose the collector
explicitly if the limit must stay:

```bash
jcmd <pid> VM.flags | tr ' ' '\n' | grep -i 'UseG1GC\|UseSerialGC\|UseZGC\|UseParallelGC'
```

**★ Symptom: a single-CPU container runs Serial GC despite having 8 GiB of memory, and
raising memory further changes nothing.** Cause: the server-class test requires *two or more
processors* **and** ≥1792 MB. Both conditions must hold; memory cannot compensate for the
processor count. Fix: give the container at least two CPUs, or select the collector
explicitly — but understand that G1 on a single CPU is a deliberate trade, not a free win,
since its concurrent phases have nowhere to run.

**★ Symptom: a pod with a 2 GiB limit reports a maximum heap of about 512 MiB and the team
concludes the container limit is not being detected.** Cause: it is being detected, and this
is the documented default — *"Maximum heap size of 1/4 of physical memory"*. Container
awareness is working exactly as intended; 25% is simply a conservative share. Fix: raise the
share deliberately rather than setting an absolute:

```bash
-XX:MaxRAMPercentage=75.0
```

**★ Symptom: `-Xmx3g` works in production and the same image OOMKills in a smaller
environment.** Cause: an absolute heap ceiling ignores the cgroup limit entirely. The JVM
will honour `-Xmx3g` in a 2 GiB container and the kernel will kill the process when the
footprint exceeds the limit. Fix: percentage, not absolute — one image is then correct at
every size. This is topic 03's subject in full.

**★ Symptom: heap usage climbs steadily during warm-up and settles, and it reads as a leak on
a dashboard.** Cause: the gap between the initial heap (*"1/64 of physical memory"*) and the
maximum (*"1/4"*). The JVM starts small and grows, so early growth is expected behaviour, not
accumulation. Fix: if the resize pauses matter, remove the gap deliberately rather than
treating the growth as a fault:

```bash
-XX:InitialRAMPercentage=75.0 -XX:MaxRAMPercentage=75.0
```

**★ Symptom: a flag string tuned carefully on one instance size performs badly after a
capacity change, with no code or config change in between.** Cause: absolute flag values do
not scale with the machine, while every ergonomic default does. The tuning was correct for
the machine it was measured on and became wrong the moment the machine changed. Fix: prefer
the percentage-based and adaptive forms over absolutes wherever both exist, so a resize
carries the tuning with it.

**★ Symptom: adding one GC flag makes things worse, and adding a second fixes it back to
roughly where it started.** Cause: ergonomic decisions are interdependent — the collector's
own heuristics adapt to heap size, pause targets and processor count, so overriding one
input changes what the rest of the system sees. Fix: recognise the pattern, and treat a flag
added only to compensate for another flag as evidence that the first one should be
reconsidered rather than as a second independent tuning decision.

## Interview questions

**★ What exactly makes a machine "server-class", and why does it matter more in 2026 than it
did in 2015?**
The tuning guide states it precisely: *"The VM considers machines as server-class if the VM
detects two or more processors and physical memory larger than or equal to 1792 MB."* Both
conditions must hold. It matters more now because of containers. On bare metal essentially
every server passed the test, so the distinction was invisible for years; on a container
platform, a 1 CPU or 1.5 GiB pod is entirely ordinary, HotSpot reads the cgroup limit rather
than the host's memory, and those pods fail the test. The consequence is not a smaller
configuration but the **Serial collector instead of G1**, which is a different latency
profile arriving with no warning, no log line and no config change to point at.

**★ Why is the default maximum heap only a quarter of available memory?**
Because `-Xmx` bounds the Java heap and the operating system kills you on the *process*.
Metaspace, the code cache, thread stacks, GC structures, direct and mapped byte buffers and
the native allocator all sit outside the heap, and in a container all of it has to fit under
one cgroup limit. A conservative default leaves headroom so the JVM's own non-heap growth
does not push the process over the edge, where the failure is an abrupt kernel kill rather
than a catchable `OutOfMemoryError` with a heap dump. For a dedicated container running a
single JVM the 25% default is more conservative than it needs to be, which is why raising it
via `MaxRAMPercentage` is one of the few overrides that is nearly always justified.

**★ Should a well-tuned production service have more flags or fewer, and why?**
Fewer, and the reason is about time rather than performance. Every flag is a permanent
override of a decision the JVM makes from information the flag does not have — the real
processor count, the real memory limit, the observed behaviour of the application — and that
decision is re-tuned by the JDK team every release while your override stays at the value
someone chose years ago. Flags also fail to travel: a number correct for a 2 GiB pod is
silently wrong at 8 GiB. And they compound, because overriding one ergonomic input changes
what the remaining heuristics see, which is how a two-flag fix becomes a nine-flag string.
The defensible position is not zero flags — the cheap diagnostics earn their place — but
that each flag overriding an ergonomic decision can name the measurement behind it.

**★ A service is slow after moving to a smaller container. Walk through the diagnosis.**
Check which collector is actually running before anything else, because the cheap hypothesis
is wrong here. Reducing the limit below 1792 MB moves the JVM off G1 onto Serial, so the
symptom is a collector change wearing the costume of a memory-pressure problem — and every
memory-shaped investigation will find memory-shaped evidence and confirm itself. `jcmd <pid>
VM.flags` settles it in one command. If the collector did change, the options are to restore
the limit above the threshold, give the pod a second CPU if that is what failed, or select
the collector explicitly and accept the trade. Only once the collector is known to be
constant is it worth comparing heap sizing, because until then you are comparing two
different runtimes.

**★ How can you tell which of a JVM's settings it chose for itself and which you imposed?**
By reading the *origin* of each flag rather than its value. The JVM records where every
setting came from and distinguishes an ergonomic choice from a compiled-in default and from
a command-line override, so you can ask a running service which decisions it made for itself
and which of your flags is overriding one. That turns a flag audit from an argument about a
string into an inspection of resolved state, and it is the only way to find the flag that is
overriding an ergonomic choice with a worse value.
`04-printflagsfinal.md` *(not written yet)* is the mechanism.

{/* FOOTER */}
