---
title: "A single NMT report tells you how memory is distributed, which is almost never the question — the technique is a baseline taken after warm-up and a diff taken after the growth, and it is the difference between \"the process is growing\" and \"the Class category grew by 400 MB\""
sidebar_label: "11b · The NMT baseline workflow"
sidebar_position: 70
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JDK 25 Troubleshooting Guide**, "Diagnostic Tools" and the
> Native Memory Tracking sections
> ([docs.oracle.com/en/java/javase/25/troubleshoot/](https://docs.oracle.com/en/java/javase/25/troubleshoot/)) —
> the `baseline`, `summary.diff` and `detail.diff` subcommands and the documented overhead
> figures are taken from it. JDK 25 · Spring Boot 4.1.0.
> **No sandbox** — commands and their described behaviour only. **No captured NMT output.**

**[11](11-native-memory-tracking.md) covered what NMT accounts for and how to read a report.
This chunk is the part that actually finds things. Nearly everyone who uses NMT for the first
time collects one snapshot during an incident, looks at large-seeming numbers with nothing to
compare them against, and confirms whatever they already suspected. The baseline/diff workflow
is what turns the tool from a curiosity into a diagnosis, and the discipline it requires —
warm up first, baseline before theorising — is where it usually goes wrong.**

## The baseline/diff workflow, which is the actual technique

A single NMT report tells you how memory is distributed. That is rarely the question. The
question is almost always **what is growing**, and for that the snapshot is nearly useless while
the diff is decisive:

```bash
# 1. Once the service has warmed up and reached steady state:
jcmd <pid> VM.native_memory baseline

# 2. Wait. Long enough for the growth you are chasing to happen —
#    minutes for a fast leak, hours for a slow one.

# 3. Now ask what changed:
jcmd <pid> VM.native_memory summary.diff
```

The diff report shows each category with its delta. **One category will usually dominate, and
that category is your answer** — it converts "the process is growing" into "the Class category
grew by 400 MB", which is a specific, actionable finding with a specific next tool.

🔴 **Take the baseline after warm-up, not at startup.** A JVM's first minutes involve
class loading, JIT compilation and pool creation that all legitimately grow these numbers.
Baselining at startup means your diff is dominated by normal warm-up and hides the real signal.

The corollary is a habit worth building: **take a baseline as part of the investigation, before
you start theorising.** The most common failure with NMT is to collect one snapshot during an
incident, stare at large-looking numbers with nothing to compare them against, and conclude
whatever you already suspected.

## What it costs

The troubleshooting guide is explicit, and both figures matter:

- **A 5–10% JVM performance drop** when NMT is enabled.
- **Two machine words added to every malloc** as a tracking header — so it also increases the
  footprint of the thing you are measuring.
- NMT's own memory usage is itself tracked by NMT, which is why the category exists.

⚠️ **This is why NMT is not a permanent production setting.** It changes both the throughput and
the memory profile of the process, so leaving it on means every future measurement of that
service carries the overhead and every comparison against another service is unfair. Turn it on
to answer a question; turn it off when you have the answer.

The `detail` mode costs more than `summary` on both counts. If you are reaching for `detail`,
be able to say what question `summary` failed to answer.

## Gotchas

**★ A snapshot without a baseline usually tells you nothing.** Every category has a
legitimately large number in a healthy JVM. The signal is in the *delta*, so `baseline` followed
by `summary.diff` is the technique; a single report is the thing people collect instead and then
cannot interpret.

**★ Baselining at startup wastes the diff.** Class loading, JIT compilation and pool
initialisation dominate the first minutes. Warm up first, then baseline, or the growth you
measure is just the JVM starting.

**★ NMT costs 5–10% throughput and adds two words to every malloc.** It perturbs what it
measures. That is acceptable for a bounded investigation and not acceptable as a default.

**★ The baseline does not survive a restart.** It is state inside the running JVM. A process that
restarts — including one the orchestrator restarted for you because it was killed — loses it, and
you begin again. On a service that is being OOMKilled every few minutes, this is a real
constraint on the technique and an argument for raising the limit temporarily so the process
lives long enough to be measured.

**★ Diffing over too short an interval finds nothing.** A leak of a few megabytes an hour is
invisible over five minutes and obvious over a day. Match the interval to the growth rate you
observed in the container's memory graph, and if you do not know the rate, get it first.

**★ `detail.diff` requires `detail` mode at startup.** You cannot ask for call-site deltas from a
JVM started with `summary`. If there is any chance you will want them, that decision was made at
launch — which is the same "decide before the incident" problem as enabling NMT at all.

**★ Do not leave NMT on because the diff was useful.** The investigation ending is the moment to
turn it off. Every future benchmark, capacity calculation and cross-service comparison made on a
JVM running with NMT carries a 5–10% penalty that nothing in the output reminds you about.

## Interview questions

**★ Walk me through using NMT to find a leak.**
Enable `summary` at startup. Let the service reach steady state — past class loading, JIT warm-up
and pool creation — then `jcmd <pid> VM.native_memory baseline`. Wait long enough for the growth
to occur: minutes for a fast leak, hours for a slow one. Then run
`jcmd <pid> VM.native_memory summary.diff` and read which category grew. One usually dominates, and it tells you which tool
comes next: Class points at metaspace and a possible classloader leak, Thread points at thread
count times stack size, Code at the code cache, Other most often at direct byte buffers, and Java
Heap sends you to a heap dump. The diff is the technique; a single snapshot is what people
collect instead and then cannot interpret.

**★ Why must the baseline be taken after warm-up?**
Because a JVM's first minutes legitimately grow almost every category NMT reports. Classes are
being loaded, the JIT is compiling and filling the code cache, connection and thread pools are
being created, and caches are filling. A baseline taken at startup produces a diff dominated by
normal warm-up, in which the actual leak — often much smaller in absolute terms — is buried.
Warm-up growth is real growth; it is just not the growth you are looking for.

**★ Why should NMT not be left on permanently?**
Because the documentation puts numbers on the cost: a 5–10% JVM performance drop, plus two
machine words added to every malloc as a tracking header. It therefore changes both the
throughput and the memory footprint of the process it is measuring. Leaving it on means every
subsequent performance measurement of that service carries the penalty and every comparison
against another service is unfair. It is a deliberate, bounded diagnostic setting.

**★ Your NMT diff shows the `Class` category growing steadily over hours. What do you suspect and
how do you confirm it?**
Class metadata growth, which has two explanations that need distinguishing: legitimately loading
more classes, or a classloader leak where old classes are never unloaded. I would look at the
loaded-class count over time — if it only ever rises and never falls across collections, that
points at a leak — and at whether the application does anything that creates classloaders
repeatedly: redeploys in a shared container, dynamic proxying, script or expression compilation,
or a framework generating classes per request. A heap dump then confirms it by showing multiple
live instances of the same classloader with paths to GC roots keeping them alive.

**★ The service you are investigating is OOMKilled every three minutes. How does that change your
NMT plan?**
It largely defeats the baseline workflow, because the baseline is state inside the JVM and dies
with the process — and three minutes is not enough for a slow leak to show a signal anyway. So
the first move is to buy time rather than collect data: raise the container's memory limit
temporarily so the process survives long enough to be measured, or reproduce the load in an
environment with a larger limit. Only then is the baseline/diff cycle usable. Trying to diff
across restarts produces nothing, and each restart also re-incurs the warm-up growth that would
pollute the measurement.

**★ The diff shows no category growing meaningfully, yet the container keeps being killed. Now
what?**
That is a strong, positive result rather than a dead end: it says the growth is not in memory the
JVM allocated, because NMT accounts for all of that and *"does not track memory allocations by
non-JVM code"*. The investigation moves outside the JVM — native libraries, the allocator's
arenas and fragmentation, memory-mapped files, an agent, or something else in the pod sharing the
limit. [11c](11c-the-footprint-that-is-not-in-any-region.md) is where that goes. It is also worth
confirming the trivial explanations first: that the limit is what you think it is, and that the
JVM is actually the process being killed.

{/* FOOTER */}
