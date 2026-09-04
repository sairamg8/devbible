---
title: "JFR's OldObjectSample event records the one thing a heap dump structurally cannot contain — where the leaked object was allocated — and it does it continuously, at under one percent overhead, with no pause and no multi-gigabyte file"
sidebar_label: "04d · OldObjectSample"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 Troubleshooting Guide**, "Diagnosing Java Memory Leaks
> → Analysis Tools → JDK Mission Control" and "→ The jfr tool"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshooting-memory-leaks.html)),
> and the **Eclipse Memory Analyzer documentation**, "Concepts → Heap Dump", for the statement
> that a dump contains no allocation information
> ([help.eclipse.org](https://help.eclipse.org/latest/topic/org.eclipse.mat.ui.help/concepts/heapdump.html)).
> **No sandbox** — the event structure below is quoted from the Troubleshooting Guide's own
> documented example; no recording was made and no field value is invented.
> **Topic 06 · JFR, JMC and async-profiler** *(not written yet)* owns JFR generally; this chunk
> owns only its use as a leak tool.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Memory Analyzer's documentation states the limitation plainly: *"A heap dump does not contain
allocation information so it cannot resolve questions like who had created the objects and where
they have been created."* That question — where was this allocated — is the one you actually need
answered, and the JDK has a tool that answers it. `jdk.OldObjectSample` samples objects that have
survived, and records for each one the allocation time, the allocation stack trace and the path
back to a GC root. It costs under one percent, needs no pause, and produces a file measured in
megabytes.**

## The catch, stated first

> *"To detect a memory leak, JFR must be running at the time that the leak occurs."*

There is no retroactive mode. This is a decision you make before the incident, which is exactly
the same shape as the Native Memory Tracking decision in
[`../01-memory-layout/11`](../01-memory-layout/11-native-memory-tracking.md) and the GC-logging
decision — three "you had to have turned it on" facts that between them account for most of the
evidence missing from a real post-mortem.

The counter-argument is the cost:

> *"The overhead of JFR is very low, less than 1%, and it has been designed to be **safe to have
> always on in production**."*

## Turning it on

```bash
java -XX:StartFlightRecording ...
```

and a fact almost nobody knows:

> *"When the JVM runs out of memory and exits due to a `java.lang.OutOfMemoryError` error, a
> recording with the prefix `hs_oom_pid` is **often, but not always**, written to the directory in
> which the JVM was started."*

🔴 **So a JVM launched with `-XX:StartFlightRecording` may leave an `hs_oom_pid<pid>.jfr` behind
after an OOM, in the working directory.** The guide's own hedge — *"often, but not always"* — means
you should not depend on it, but you should certainly look for it, and you should note that it
lands in the *working directory* with all the container-ephemerality problems that implies
([03d](03d-the-dump-you-could-not-take.md)).

The deliberate route, which does not depend on the process dying:

```bash
jcmd <pid> JFR.dump filename=recording.jfr path-to-gc-roots=true
```

`path-to-gc-roots=true` is the option that makes the recording useful for a leak: without it the
`OldObjectSample` events carry the allocation stack but not the chain that is keeping the object
alive.

## Enabling heap statistics, which is not on by default

> *"Flight Recordings collected with heap statistics enabled can be helpful in troubleshooting a
> memory leak, showing you the Java objects and the top growers in the Java heap over time."*
>
> *"Heap Statistics can also be enabled by manually editing the `.jfc` file, and setting
> `heap-statistics-enabled` to `true`."*

```xml
<event path="vm/gc/detailed/object_count">
  <setting name="enabled" control="heap-statistics-enabled">true</setting>
  <setting name="period">everyChunk</setting>
</event>
```

In JMC the same switch lives under **Window → Flight Recording Template Manager**. And the
Troubleshooting Guide names the setting to select before starting a leak-hunting recording:

> *"Before starting a flight recording, make sure that the option **Object Types + Allocation Stack
> Traces + Path to GC Root** is selected from the Memory Leak Detection setting."*

## Reading it without a UI

```bash
jfr print --events OldObjectSample recording.jfr
```

The guide documents the event's structure, and the field list is the reason this tool exists:

| Field | What it gives you |
|---|---|
| `allocationTime` | when the object was created |
| `objectAge` | how long it has survived |
| `lastKnownHeapUsage` | heap size at the time of the sample — **the growth curve, per sample** |
| `object` | the reference chain, printed as a nested path |
| `arrayElements` | array length where applicable |
| `root` | the GC root, with `description`, `system` and `type` |
| `eventThread` | the thread that allocated it |

🔴 **`lastKnownHeapUsage` across a series of samples is a growth curve annotated with allocation
sites.** That is strictly more information than any single heap dump contains, and it is the field
people skip.

The `root` block gives the same information MAT's Path to GC Roots gives — `description`, `system`
(for example `"Threads"`) and `type` (for example `"Stack Variable"`) — but without the pause and
without the file.

## Where it beats a dump, and where it does not

| Question | Heap dump | `OldObjectSample` |
|---|---|---|
| What is retained right now? | **the tool** | sampled only |
| How big is the retained set? | **exact** | not measured |
| Where was it allocated? | **impossible** | **the tool** |
| Which thread allocated it? | no | **yes** |
| How did the heap grow over time? | one point | **a series** |
| What keeps it alive? | exact, all paths | one root path per sample |
| Cost | a full-heap pause and a huge file | *"less than 1%"*, no pause |
| Available after the fact? | yes, if you can take one | **only if it was already recording** |

The honest summary: **`OldObjectSample` tells you *why* an object exists; a heap dump tells you
*how much* there is of it.** For a leak you usually want the first, and the reason dumps dominate
practice is that they can be taken after the fact.

## The JMC route, for completeness

The guide's own workflow, quoted so the vocabulary matches what you will see on screen:

> *"Look at the Automated Analysis Results page. To detect a memory leak focus on the **Live
> Objects** section of the page."*
>
> *"You can observe that in the **Heap Live Set Trend** section, the live set on the heap seems to
> increase rapidly and the analysis of the reference tree detected a leak candidate."*
>
> *"For further analysis, see the **Old Object Sample** event in the Results tab that contains
> sampling of the objects that have survived. This event contains the time of allocation, the
> allocation stack trace, and the path back to the GC root."*
>
> *"When a potentially leaking class is identified, look at the **TLAB Allocations** page in the JVM
> Internals page for some samples of where objects were allocated."*

And the caveat the guide attaches to that last step, which is the honest limitation of sampling:

> *"If the leak is slow, there may be a few allocations of this object and may be no samples. Also,
> it may be that only a specific allocation site is leading to a leak."*

## Gotchas

**★ JFR must already have been running. There is no retroactive recording.**
*"To detect a memory leak, JFR must be running at the time that the leak occurs."* Like Native
Memory Tracking, this is a launch-time decision, and like NMT the moment you need it is the moment
it is too late to enable.

**★ `path-to-gc-roots=true` is not the default and the events are much weaker without it.**
`jcmd <pid> JFR.dump filename=x.jfr path-to-gc-roots=true`. Without it you get allocation stacks
and no explanation of why the object is still alive, which is half the diagnosis.

**★ Heap statistics are off by default.**
`heap-statistics-enabled` in the `.jfc`, or the Memory Leak Detection setting in JMC's template
manager. A default `profile` recording is not configured for leak hunting.

**★ The `hs_oom_pid` recording is written "often, but not always", to the working directory.**
The guide's hedge is real, and the working directory in a container is ephemeral. It is worth
looking for and worth not depending on.

**★ Sampling misses slow leaks, and the guide says so.**
*"If the leak is slow, there may be a few allocations of this object and may be no samples."* A leak
of one object per minute over three days is invisible to allocation sampling and obvious in a heap
dump. The two tools fail in opposite directions, which is the argument for having both.

**★ `lastKnownHeapUsage` is the field that turns samples into a trend and it is easy to miss.**
Each `OldObjectSample` carries the heap usage at the time it was taken. Sorted by
`allocationTime`, the series is a growth curve with an allocation stack attached to each point —
information no dump can contain.

**★ `OldObjectSample` does not measure retained size.**
It tells you what survived and where it came from, not how many bytes it holds. If the question is
"which of these three candidates accounts for the four gigabytes", you still need a dump.

**★ Two tools, two different meanings of "leak".**
MAT's Leak Suspects report finds *large retained sets*; `OldObjectSample` finds *objects that
survived unexpectedly long*. A large, legitimate cache is a leak suspect and not an old-object
anomaly; a slow trickle of small objects is the reverse. Disagreement between them is signal.

## Interview questions

**★ A heap dump tells you what is retained. What does it not tell you, and what fills the gap?**
It cannot tell you where anything was allocated. MAT's documentation is explicit: *"A heap dump does
not contain allocation information so it cannot resolve questions like who had created the objects
and where they have been created."* The format records objects, classes, references, GC roots and
thread stacks — not a creation site. JFR's `jdk.OldObjectSample` event fills that gap: for objects
that have survived, it records the allocation time, the allocation stack trace, the allocating
thread and, with `path-to-gc-roots=true`, the chain keeping them alive. The trade is that it
samples rather than enumerating, and that it has to have been running before the incident.

**★ You are asked to make a service diagnosable for memory problems before it has any. What do you
turn on?** Four things, all launch-time. Rotated `-Xlog:gc*`, because live-set-after-full-GC is the
only reliable leak signal and it is unavailable retroactively.
`-XX:+HeapDumpOnOutOfMemoryError` with `-XX:HeapDumpPath` on a mounted volume, plus
`-XX:+ExitOnOutOfMemoryError` so the failure is clean and the dump belongs to the first error.
`-XX:StartFlightRecording` with heap statistics and path-to-GC-roots enabled, since JFR is
documented at *"less than 1%"* overhead and *"safe to have always on in production"*, and it is the
only source of allocation sites. And a decision about Native Memory Tracking, which also cannot be
attached to a running JVM. Every one of those is a decision that must be made before you are paged.

**★ Compare `OldObjectSample` and a heap dump as leak tools.**
They answer complementary questions and fail in opposite directions. A dump is exact, complete and
retrospective: it enumerates every reachable object, gives exact retained sizes, and can be taken
after the fact — at the cost of a full-heap pause, a file the size of the live set, and no
allocation information whatsoever. `OldObjectSample` is sampled, continuous and prospective: it
names the allocation site, the allocating thread, the object's age and the heap usage at sampling
time, at negligible cost and with no pause — but it measures no sizes, misses slow leaks because it
is sampling, and is useless unless it was already running. In practice you want the dump for "how
much" and the JFR event for "why", and a mature service is configured for both.

**★ What is `lastKnownHeapUsage` and why does it matter?**
It is a field on each `jdk.OldObjectSample` event recording the heap usage at the moment the sample
was taken. Its value is that a series of samples, ordered by allocation time, is a heap-growth
curve in which every point carries the stack trace of an object that was allocated then and is
still alive. That is a shape no heap dump can produce, because a dump is one instant. If the curve
rises and the same stack trace keeps appearing at successive points, you have both the growth and
its cause in one artefact.

**★ Why might JMC report a leak candidate that MAT's Leak Suspects report does not, or the
reverse?** Because they define "leak" differently. MAT works from a single snapshot and flags
objects whose *retained size* exceeds a share of the heap — so a large, entirely legitimate cache is
a suspect and a slow trickle of small objects is not. JFR's old-object sampling flags objects that
*survived longer than expected* and gives their allocation sites — so the slow trickle shows up and
the big static cache does not, because it is not growing. Disagreement between the two is
informative rather than contradictory: it usually means the heap contains one large legitimate
structure and one small growing one, and only the second is the bug.

{/* FOOTER */}
