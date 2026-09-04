---
title: "Sizing a JVM container is nine questions asked in a fixed order, and the order matters because each answer eliminates a family of causes — this is the whole topic compressed into what you run before the deploy and what you run at three in the morning"
sidebar_label: "10 · The checklist"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference** and **`jcmd` tool reference**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html),
> [jcmd](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)); the **JDK 25
> Troubleshooting Guide**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/diagnostic-tools.html));
> and the **Kubernetes** resource-management documentation
> ([kubernetes.io](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)).
> Every claim on this page is argued in full in one of the chunks it links to.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**A checklist is only worth having if the order is load-bearing. This one is: each step either
eliminates a family of causes or produces the input to the next. Run part A before a deploy, part
B on anything already running, and part C when the pod is restarting and you have three minutes.**

## A · Sizing a service you have not sized before

**1. Is there a memory limit at all?**
No limit means the JVM sizes against the node — 25 percent of a 256 GiB machine, GC threads for
the whole box. Set `limits.memory`, and set `requests.memory` equal to it.
[02](02-container-awareness.md) · [06](06-requests-limits-and-the-jvm.md)

**2. Is there a CPU limit? If not, is `-XX:ActiveProcessorCount` set?**
`requests.cpu` is invisible to the JVM — shares have been ignored since JDK 19. Either set
`limits.cpu`, or set `ActiveProcessorCount` to the request.
[05](05-cpu-limits-and-ergonomics.md)

**3. Is anything setting `-Xmx`?**
Check the Dockerfile, the base image's `ENV`, `JAVA_TOOL_OPTIONS`, the chart, and whether a
buildpack built the image. An `-Xmx` from any of them disables percentage ergonomics silently.
[03c](03c-why-not-xmx.md) · [04c](04c-the-memory-calculator.md)

**4. Measure the native side under sustained realistic load.**
`-XX:NativeMemoryTracking=summary`, warm for hours not minutes, then
`jcmd <pid> VM.native_memory baseline` and `summary.diff` across a growth window. Read committed,
not reserved.
[04](04-the-memory-budget.md) · [11b](../01-memory-layout/11b-the-nmt-baseline-workflow.md)

**5. Do the subtraction and set the percentage.**
Limit minus measured non-heap minus a growth margin, expressed as `MaxRAMPercentage`. For an
ordinary Spring Boot service on 1 GiB or more, two independent methods land near 70 percent — but
that is a sanity check on your arithmetic, not a substitute for it.
[04](04-the-memory-budget.md) · [04c](04c-the-memory-calculator.md)

**6. Bound what can be bounded, so failures are diagnosable.**
`-XX:MaxDirectMemorySize` above all, because its default is a second copy of `-Xmx`. Then
`-XX:MaxMetaspaceSize`. Then `-XX:+ExitOnOutOfMemoryError`.
[04b](04b-the-direct-memory-doubling.md)

**7. Decide whether the failure should be fast.**
`-Xms` equal to `-Xmx` plus `-XX:+AlwaysPreTouch` turns a sizing mistake into a failed rollout
instead of an OOMKill days later. Adjust the readiness probe in the same change.
[09](09-alwayspretouch.md)

**8. Check what ergonomics chose for you.**
Under 2 processors or under 1792 MiB of memory, the collector is Serial, silently.
[07](07-what-ergonomics-picks-in-a-small-container.md)

**9. Arrange for evidence before you need it.**
A disk-backed volume for dumps — never `medium: Memory` — and NMT output reachable from a log.
[08](08-getting-a-dump-out-of-a-container.md)

## B · Verifying a container that is already running

```bash
# what the JVM read from the cgroup, and what it decided
jcmd <pid> VM.info                    # container block: limits, quota, period, pids
jcmd <pid> VM.flags -all              # resolved flags with provenance
jcmd <pid> VM.command_line            # everything the launcher was handed

# from a fresh process in the same image and the same limits
java -Xlog:os+container=trace -version
java -XX:+PrintFlagsFinal -version | grep -E \
  'MaxHeapSize|InitialHeapSize|MaxRAM|MaxRAMPercentage|MaxDirectMemorySize|ActiveProcessorCount|UseSerialGC|UseG1GC|UseCompressedOops'
```

Four things to confirm, in order:

1. **The limit the JVM read is the limit you set.** If it is lower, the hierarchy walk found a
   tighter ancestor cgroup — [02b](02b-cgroup-v1-v2-and-the-hierarchy.md).
2. **`MaxHeapSize` is `{ergonomic}`, not `{command line}`.** If it is the latter, something set
   `-Xmx` — [03c](03c-why-not-xmx.md).
3. **`ActiveProcessorCount` and the resulting collector are what you expect.**
   [05](05-cpu-limits-and-ergonomics.md) · [07](07-what-ergonomics-picks-in-a-small-container.md)
4. **`MaxDirectMemorySize` is not equal to `MaxHeapSize`.** If it is, nobody set it.
   [04b](04b-the-direct-memory-doubling.md)

## C · The pod is restarting and you have three minutes

**1. `SIGKILL` or `OutOfMemoryError`?**
`kubectl describe pod`, and read `Last State` **per container**. `Reason: OOMKilled` versus
`Reason: Error` versus an exception in the log. 137 alone means only `SIGKILL`, which the
grace-period timeout also produces.
[01](01-the-oomkilled-loop.md) · [01b](../01-memory-layout/01b-oom-error-versus-oomkilled.md)

**2. If it threw, the detail message names the region.**
Two of the seven documented messages are heap; the rest are not, and `-Xmx` does not help them.
`Cannot reserve … bytes of direct buffer memory` is a real message that is not on that list.
**04 · `OutOfMemoryError`** *(not written yet)*

**3. If it was killed, was the heap full?**
A flat heap next to a rising RSS is the signature of a native-footprint problem and rules out the
heap dump as a first tool.
[01](../01-memory-layout/01-heap-is-not-the-process.md)

**4. Which region grew?**
NMT `summary.diff`. `Class` is a classloader leak, `Thread` is unbounded thread creation, `Code`
is the code cache, and a total well below RSS points outside the JVM entirely.
[11](../01-memory-layout/11-native-memory-tracking.md) ·
[11c](../01-memory-layout/11c-the-footprint-that-is-not-in-any-region.md)

**5. Rate, then plateau.**
`Restart Count` over a long window and the `Finished`-to-`Started` deltas. Something that
plateaus is a sizing error; something monotonic is a leak. Do not call it a leak before you have
watched for a plateau.

## The one-page version

```bash
# the container-sizing configuration for an ordinary JVM service
-XX:MaxRAMPercentage=70            # measured, not copied
-XX:MaxDirectMemorySize=256m       # measured; otherwise it silently equals the heap
-XX:MaxMetaspaceSize=256m          # so a class leak is an error, not a 137
-XX:+ExitOnOutOfMemoryError        # so a swallowed Error cannot leave a zombie
-XX:ActiveProcessorCount=2         # ONLY if there is no CPU limit
-XX:NativeMemoryTracking=summary   # while you are measuring; off afterwards
```

```yaml
resources:
  requests: { memory: "2Gi", cpu: "1" }
  limits:   { memory: "2Gi", cpu: "1" }     # memory request == memory limit, always
```

Anything not on those two lists should be there because you can explain it, which is the argument
of **13 · JVM flags that matter in 2026** *(not written yet)*.

## Gotchas

**★ The checklist is worthless if you skip step A4.**
Every number in it is derived from a measurement of the native side. Running the rest without that
measurement produces a configuration that looks disciplined and is still a guess.

**★ Verifying in the wrong place is the most common way to waste an hour.**
`java -XX:+PrintFlagsFinal` on your laptop, in a shell on a different node, or in a debug container
with different resource limits gives a different answer. It has to be the same image with the same
limits, ideally the running process via `jcmd`.

**★ Steps A6 and A7 change the failure mode, not the failure rate.**
Bounding regions and pre-touching make problems diagnosable and early. Neither makes the service
need less memory. Do not report "we fixed the memory problem" after doing only these.

**★ Part C step 1 is the step people skip, and it decides everything after it.**
Reading `Reason` takes ten seconds and determines whether the next hour is spent on heap dumps or
on NMT. Skipping it is how an afternoon goes into a heap dump for an incident that was never about
the heap.

**★ A checklist item that always passes is not being checked.**
"Is there a memory limit?" passes in every namespace with a `LimitRange` — until the one that does
not have one. Check the resolved pod spec, not the template.

**★ None of this survives a change of architecture without re-validation.**
`-Xss` doubles from 1024 KB to 2048 KB moving from Linux/x64 to Linux/AArch64, which moves the
budget. Re-run step A4 on the architecture you are deploying to.

**★ Sizing is not a one-time exercise.**
Metaspace and the code cache ratchet upward over a process's lifetime, dependency upgrades load
more classes, and traffic patterns change. A number derived a year ago is a hypothesis, not a
setting.

## Interview questions

**★ Walk me through sizing a JVM for a container you have never seen.**
Confirm a memory limit exists and that the memory request equals it, so the JVM sizes against
something the cluster actually reserved. Confirm a CPU limit exists or set
`-XX:ActiveProcessorCount`, because requests are invisible to the JVM. Find and remove any `-Xmx`,
because it disables percentage ergonomics. Then measure: NMT summary under sustained realistic
load, warm for hours, reading committed rather than reserved totals for every non-heap category.
Subtract that plus a growth margin from the limit and express the remainder as
`MaxRAMPercentage`. Bound direct memory and metaspace explicitly so failures name themselves, add
`ExitOnOutOfMemoryError`, and consider `-Xms` equal to `-Xmx` with `AlwaysPreTouch` so a mistake
fails at rollout. Finally, check which collector ergonomics chose, because under 2 CPUs or
1792 MiB it silently picked Serial.

**★ You have three minutes and a crash-looping pod. What do you do?**
`kubectl describe pod` and read `Last State` for the specific container: `Reason: OOMKilled` versus
`Reason: Error` versus an exception in the application log. That single field decides which half of
my tools are useful. If it threw, the detail message names the region and I follow it. If it was
killed, I check whether the heap was flat — a flat heap with rising RSS means the growth is native
and a heap dump is the wrong artefact. Then NMT diff to name the region, and `Restart Count` over a
long window to get the rate, which tells me whether I am looking at a leak or at a container that
was simply sized too small.

**★ What is the shortest defensible set of JVM flags for a container?**
`-XX:MaxRAMPercentage` set from a measurement, `-XX:MaxDirectMemorySize` set from a measurement,
`-XX:MaxMetaspaceSize` set from a measurement, and `-XX:+ExitOnOutOfMemoryError`. Plus
`-XX:ActiveProcessorCount` if and only if there is no CPU limit. That is four or five flags, and
every one of them is either a measured number or a decision about failure mode. Everything else
in a typical inherited `JAVA_OPTS` is a default restated, a flag removed several releases ago, or
something nobody on the team can explain.

**★ Which single metric would you put on a dashboard to catch container-sizing problems?**
RSS as a fraction of the container memory limit, with committed heap plotted on the same axis. The
ratio tells you how close you are to the kill threshold, and the gap between the two lines is
exactly the native footprint — so the pair distinguishes "the heap is growing" from "everything
else is growing" at a glance, which is the first branch of every diagnosis in part C. I would
alert on the ratio, not on `OutOfMemoryError` in the logs, because an OOMKill produces no log line
at all.

{/* FOOTER */}
