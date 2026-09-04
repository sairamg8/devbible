---
title: "Most GC problems are allocation problems wearing a collector's clothes, the defaults are the product of far more measurement than you are about to do, and the flag that fixed it for somebody else describes their heap and their live set — the honest first question is not which knob but whether the code should have allocated that at all"
sidebar_label: "11 · When tuning is the wrong answer"
sidebar_position: 41
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25** — "Ergonomics", for the behaviour-based tuning model, the default selections and
> the guide's own tuning strategy
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/ergonomics.html)), and
> "Factors Affecting Garbage Collection Performance" for the heap-sizing guidance quoted here
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/factors-affecting-garbage-collection-performance.html)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**This topic has spent thirty pages on collectors, flags and logs. This page is the argument that
most of it should stay unused. The collector is a consumer of what your code produces; the
overwhelming majority of "GC problems" are the collector accurately reporting an allocation
problem, and the tuning that follows a misdiagnosis does not merely fail — it hides the signal
that would have led to the fix.**

## What ergonomics already did for you

The defaults are not a neutral starting point somebody forgot to tune. They are a control system.
The guide describes the model directly:

> *"The Java HotSpot VM garbage collectors can be configured to preferentially meet one of two
> goals: maximum pause-time and application throughput. If the preferred goal is met, the
> collectors will try to maximize the other."*

And it describes what happens continuously, without you:

> *"The heap grows or shrinks to a size that supports the chosen throughput goal… A change in the
> application's behavior can cause the heap to grow or shrink. For example, if the application
> starts allocating at a higher rate, then the heap grows to maintain the same throughput."*

The starting selections are also ergonomic — G1 on server-class machines, an initial heap of 1/64
of physical memory and a maximum of 1/4, where server-class means *"two or more processors and
physical memory larger than or equal to 1792 MB"*.

The consequence is the one people find hardest to accept: **a flag does not add a capability, it
removes a degree of freedom.** Pinning `-Xmn` stops G1 sizing the young generation for its pause
goal. Setting `-Xms` equal to `-Xmx` stops the heap shrinking — the guide is explicit that this
*"increases predictability by removing the most important sizing decision from the virtual
machine. However, the virtual machine is then unable to compensate if you make a poor choice."*
That is a fair trade sometimes. It is a trade every time.

The guide's own advice, worth quoting because it is more conservative than most people's
practice:

> *"Don't choose a maximum value for the heap unless you know that you need a heap greater than
> the default maximum heap size."*

## The tuning that is nearly always right

Two settings survive this argument, and they are not really tuning:

- **A heap size that reflects the real live set**, chosen from measurement — or, in a container,
  `-XX:MaxRAMPercentage` rather than a fixed `-Xmx`, so one image is correct at every size
  ([03](../03-heap-sizing-in-containers/README.md)).
- **The diagnostics**: GC logging with rotation ([07d](07d-rotating-and-shipping-gc-logs.md)),
  `-Xlog:safepoint` ([10](10-safepoints.md)), `-XX:+HeapDumpOnOutOfMemoryError` with a writable
  path, `-XX:+ExitOnOutOfMemoryError` for a service. None of these change behaviour under load;
  all of them decide whether the next incident is diagnosable.

Everything after that needs a measurement naming the specific constraint being relieved.

## Why the flag from the blog post will not work

A flag that helped someone else encodes their live set, their allocation rate, their object
lifetime distribution, their heap size, their core count and their JDK version. None of those are
yours. And the failure mode is worse than "no improvement": a flag that was right in 2018 may now
be removed — an unrecognised `-XX:` option **fails the launch** on JDK 25 unless
`-XX:+IgnoreUnrecognizedVMOptions` is set, which is itself a bad idea because it silences the
next one too. The retired inventory is
**13 · JVM flags that matter** *(not written yet)*, and the flags that survive
are [02c2 · Flags that still work](02c2-flags-that-still-work.md).

There is also a compounding effect specific to this area. Each flag removes an ergonomic
decision, so a JVM with twelve inherited flags is running a hand-built policy assembled by people
who are no longer present, for a workload that has changed, and nobody can say which flag is load
bearing. Removing them one at a time is a multi-week exercise nobody funds. **The cheapest moment
to not have a flag is before you add it.**

## What the fix usually is instead

The list is short and it is nearly always on it:

- **A cache without a bound.** The most common cause of a growing old generation in a real
  service, and no collector setting addresses it.
- **Allocation on a hot path**, per [08b](08b-where-allocation-comes-from.md): boxing, string
  building, unparameterised logging, defensive copies, per-request buffers, collections not
  pre-sized. The bytes the collector is struggling with were produced by code that could have not
  produced them.
- **Retention**: a `ThreadLocal` on a pooled thread, a listener never unregistered, a static map
  used as a scratchpad. This is [04 · OutOfMemoryError](../04-out-of-memory-error/README.md) and
  the tool is a heap dump.
- **A payload or batch size that grew.** Fetching ten thousand rows to return ten is an
  allocation-rate problem, a humongous-allocation problem
  ([03d](03d-humongous-allocations.md)) and a latency problem at once.
- **Something that is not GC at all** — a lock, a slow dependency, time-to-safepoint
  ([10](10-safepoints.md)). GC is over-blamed because it is the most visible subsystem with the
  best logging, which is a cruel reward for being well instrumented.

The asymmetry is the argument. A flag change buys headroom proportional to the resource you added
and expires as traffic grows. Removing the allocation removes the pressure permanently and keeps
removing it.

## When tuning genuinely is the answer

Being honest about the other direction, because the argument is not "never touch a flag":

- **The pause goal is genuinely wrong for the service.** A trading system needing predictable
  single-digit milliseconds, or a batch job that wants throughput and does not care about pauses,
  are real cases where the default target is not yours — [06 · Choosing](06-choosing.md).
- **The collector is wrong for the shape.** Large heap plus strict latency is ZGC's case, and
  choosing it is a decision rather than a tweak.
- **The container arithmetic is wrong.** `MaxRAMPercentage` in place of an inherited `-Xmx` is
  correcting a bug, not tuning.
- **A measured, specific constraint.** Humongous allocations against a region size, a documented
  evacuation failure, a metaspace ceiling — cases where you can name the mechanism, predict the
  effect and check it afterwards.

The test that separates these from cargo cult: **can you say, before changing anything, what
measurement will move and by roughly how much?** If not, you are not tuning, you are sampling the
configuration space with production as the test harness.

## Gotchas

**★ A flag does not add a capability; it removes a degree of freedom.**
Ergonomics is a control system adjusting heap size and generation sizes continuously. Every
explicit setting pins one of its inputs. Sometimes correct — always a trade, and the guide says so
about `-Xms`/`-Xmx` in as many words.

**★ The guide's own advice is not to set a maximum heap unless you know you need one.**
*"Don't choose a maximum value for the heap unless you know that you need a heap greater than the
default maximum heap size."* Nearly universal practice ignores this, usually for good reasons in
a container — but "we always set `-Xmx`" is a habit, not a conclusion.

**★ Flags compound: twelve inherited options are a hand-built policy nobody can explain.**
Each removes an ergonomic decision, and their interactions are not documented anywhere because
nobody designed the combination. Auditing them later costs far more than not adding them.

**★ An unrecognised `-XX:` flag fails the launch on JDK 25.**
Copied flags from older material do not degrade gracefully. `-XX:+IgnoreUnrecognizedVMOptions`
makes the failure silent, which converts a startup error into a permanently misconfigured JVM.

**★ GC is over-blamed because it is the best-instrumented subsystem.**
It has a detailed log, exported metrics and a rich vocabulary, so a latency investigation starts
there and often stops there. Locks, slow dependencies and time-to-safepoint have none of that and
cause plenty of the same symptoms.

**★ The fix that survives traffic growth is almost never a flag.**
Extra headroom expires; removed allocation does not. Two years later the flag is a mystery in a
Helm chart and the allocation change is still working.

**★ "It worked for them" encodes their live set, not a property of the JVM.**
Every published flag recommendation is conditioned on a heap size, an object lifetime
distribution, a core count and a JDK version that are not yours.

**★ Tuning can hide the signal that would have found the cause.**
Raising the heap makes the graph stop looking alarming while the leak continues, so the incident
closes and recurs with a larger heap and a longer collection. That is strictly worse than not
acting.

**★ You can tell tuning from guessing with one question, asked beforehand.**
Name the measurement that will move and roughly by how much. If you cannot, you are searching the
configuration space in production.

**★ The two settings that are always defensible are diagnostics, not tuning.**
GC logging with rotation, safepoint logging, heap dump on OOM, exit on OOM. They change nothing
under load and decide whether the next incident is diagnosable at all.

## Interview questions

**★ A service has p99 latency spikes. Why is "tune the GC" a bad first move?**
Because it presumes the diagnosis. Latency spikes have several common causes — a lock, a slow
downstream call, connection-pool exhaustion, time-to-safepoint, and genuine GC pauses — and GC
gets blamed disproportionately because it is the best-instrumented of them: it has a detailed log
and exported metrics, so it is the first place anyone looks and often the last. The ordered
approach is to establish *whether* collections correlate with the spikes at all, which means
comparing pause timestamps against the latency histogram; then, if they do, whether the pause
time is the collection or the wait to reach the safepoint, which the GC log cannot tell you and
`-Xlog:safepoint` can. Only after both is a flag change even addressed to the right subsystem. And
if the answer turns out to be GC, the next question is still whether the collector is
misconfigured or is accurately reporting that the application allocates too much — because those
have completely different fixes and only one of them lasts.

**★ Why is raising the heap a dangerous response to a memory problem?**
Because it works well enough to close the incident and does nothing about the cause. If the real
problem is retention, a bigger heap extends the time to failure proportionally to the memory
added, so the leak recurs later with a larger heap to trace and a longer collection when it does.
It also actively degrades the diagnosis: the occupancy graph stops looking alarming, so the
signal that would have prompted a heap dump disappears. In a container it is worse still, because
raising `-Xmx` against an unchanged cgroup limit converts an `OutOfMemoryError` — which is
diagnosable, and can be configured to leave a heap dump — into an OOMKill, which arrives as exit
code 137 with no diagnostics at all. There is a legitimate version of this action: sizing the
heap for a live set you have actually measured. The dangerous version is reaching for it because
the graph looked bad, which is the common one.

**★ How do you decide whether a GC problem is a tuning problem or a code problem?**
By asking what the collector is being asked to do, not how it is doing it. Three measurements
separate them. Allocation rate against yesterday's: a step change correlated with a deploy is a
code problem with a timestamp on it. Live data size after collection: flat means churn and the
collector is coping with what it is given, rising means retention and no flag will help. And the
tenuring threshold from `-Xlog:gc+age=trace`: collapsed means the survivor space cannot absorb
the surviving set, which is at least partly a sizing question. If allocation rate is high, live
data is flat and the pauses are the cost of churn, the honest answer is that the application
produces more garbage than it needs to, and the fix is boxing, string building, logging and
per-request buffers — not a collector setting. Tuning is warranted when you can name the
mechanism being relieved and predict the measurement that will move; otherwise you are treating
production as a search space.

**★ Your predecessor left twelve JVM flags in the deployment. How do you approach them?**
Carefully, and with the assumption that most are inert, some are harmful and one is load bearing.
First establish what they actually do now, which is not what they did when they were added:
`-XX:+PrintFlagsFinal -version` shows the effective values, and it will usually reveal that
several flags are setting things ergonomics would have set anyway, and possibly that one is
overriding a collector default in a way nobody intended — the `FLAG_IS_DEFAULT` guard on
`UseCountedLoopSafepoints` is the sharp example, where an explicit setting silently disables a
protection the collector would have enabled. Second, check whether any are deprecated or removed
in the current JDK, because an unrecognised `-XX:` option fails the launch and a JDK upgrade will
surface them all at once. Third, remove them in small batches with a measurement between, in a
non-production environment first, treating each removal as a change that needs the same evidence
you would demand for an addition. The real lesson is preventative: the reason this is a
multi-week exercise is that each flag was added without recording what measurement justified it,
so the cheapest moment to avoid the cost was before the first one.

**★ Give a case where tuning genuinely is the right answer.**
A large-heap, latency-sensitive service — say a 64 GB heap where the SLO is a p99 under 10 ms.
G1's default behaviour is to meet a pause goal by controlling how much it evacuates per pause, and
at that heap size the full-heap phases and the evacuation work will not fit inside 10 ms
reliably. This is a shape problem, not an allocation problem: the application could be allocating
perfectly reasonably and still miss the target, because the constraint is the relationship
between heap size and stop-the-world work. Switching to ZGC is the correct response, and it is a
decision rather than a tweak — it comes with a measurable CPU and footprint cost that has to be
accepted deliberately. What makes it legitimate tuning rather than guessing is that you can state
beforehand what will move and by how much: pause times should become largely independent of heap
size, and CPU utilisation should rise. Both are checkable afterwards, which is exactly the test
that a cargo-culted flag fails.

**★ What does it mean that ergonomics is "behaviour-based", and why does that argue against
static flag lists?**
It means the JVM is running a feedback loop rather than applying a configuration. The guide
describes two goals — maximum pause time and throughput — with the collector preferring one and
maximising the other once it is met, and it describes the heap growing and shrinking continuously
in response to the application's actual behaviour: *"if the application starts allocating at a
higher rate, then the heap grows to maintain the same throughput."* A static flag list is a
snapshot of a decision taken once, against a workload that has since changed. So the flags that
age worst are precisely the ones that pin an input the loop wants to adjust — a fixed young
generation, `-Xms` equal to `-Xmx`, an explicit `-Xmn`. It is not that these are wrong; it is
that each converts an adaptive parameter into a permanent commitment, and the commitment is
evaluated against a workload nobody re-measures. Which is why the two settings that are always
defensible — logging and dump-on-OOM — are the ones that constrain nothing.

{/* FOOTER */}
