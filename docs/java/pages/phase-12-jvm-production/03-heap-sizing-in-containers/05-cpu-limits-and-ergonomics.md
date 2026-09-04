---
title: "The JVM's processor count in a container is the CPU quota divided by the period and rounded UP, CPU shares have been ignored since JDK 19, and a pod with a CPU request but no CPU limit sees the entire node"
sidebar_label: "05 · CPU limits and ergonomics"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the JDK 25 HotSpot source at tag `jdk-25+36` —
> [`os/linux/cgroupUtil_linux.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/os/linux/cgroupUtil_linux.cpp),
> [`os/linux/os_linux.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/os/linux/os_linux.cpp),
> [`os/linux/cgroupV2Subsystem_linux.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/os/linux/cgroupV2Subsystem_linux.cpp),
> [`gc/shared/gc_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gc_globals.hpp);
> the **JDK 25 `java` tool reference** for `-XX:ActiveProcessorCount`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html));
> **JDK-8281181** *"Do not use CPU Shares to compute active processor count"*, `fixVersion` 19,
> resolution Fixed, from the OpenJDK issue tracker
> ([bugs.openjdk.org](https://bugs.openjdk.org/browse/JDK-8281181)); and the **Kubernetes**
> documentation on resource management
> ([kubernetes.io](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Memory sizing is what gets a container killed; CPU sizing is what makes it slow in ways nobody
can attribute. One integer — `os::active_processor_count()` — decides how many GC threads, JIT
compiler threads, common ForkJoinPool workers and virtual-thread carriers the JVM creates, and in
a container that integer comes from a very specific piece of arithmetic that ignores half of what
you configured. Knowing exactly which half is the difference between a pool sized for your
container and a pool sized for the node.**

## The arithmetic

`CgroupUtil::processor_count`, verbatim from `jdk-25+36`:

```cpp
int CgroupUtil::processor_count(CgroupCpuController* cpu_ctrl, int host_cpus) {
  assert(host_cpus > 0, "physical host cpus must be positive");
  int limit_count = host_cpus;
  int quota  = cpu_ctrl->cpu_quota();
  int period = cpu_ctrl->cpu_period();
  int quota_count = 0;
  int result = 0;

  if (quota > -1 && period > 0) {
    quota_count = ceilf((float)quota / (float)period);
    log_trace(os, container)("CPU Quota count based on quota/period: %d", quota_count);
  }

  // Use quotas
  if (quota_count != 0) {
    limit_count = quota_count;
  }

  result = MIN2(host_cpus, limit_count);
  log_trace(os, container)("OSContainer::active_processor_count: %d", result);
  return result;
}
```

Four things are true of that function and only one of them is widely known.

1. **Only quota and period are used.** `cpu_shares()` is not called. It is read elsewhere, for
   reporting, and it changes nothing.
2. **The division rounds up.** `ceilf(quota / period)`.
3. **The result is capped at the host's CPU count**, which itself comes from
   `os::Linux::active_processor_count()` — `sched_getaffinity` where available, so a `cpuset`
   narrows it too.
4. **With no quota, `limit_count` stays at `host_cpus`.** No quota means the whole node.

`ceilf` deserves a table. **Arithmetic derived from the code above:**

| Kubernetes `limits.cpu` | `cpu.max` quota / period | `ceil` | JVM sees |
|---|---|---|---|
| `100m` | 10000 / 100000 | 0.1 → 1 | **1** |
| `500m` | 50000 / 100000 | 0.5 → 1 | **1** |
| `1` | 100000 / 100000 | 1.0 → 1 | 1 |
| `1500m` | 150000 / 100000 | 1.5 → **2** | 2 |
| `2500m` | 250000 / 100000 | 2.5 → **3** | 3 |
| *(none)* | −1 / 100000 | — | **every CPU on the node** |

Note the last two rows together. A pod limited to 2.5 CPUs gets a JVM that believes it has 3 and
sizes its pools accordingly — mild over-provisioning, generally harmless. A pod with **no** CPU
limit gets a JVM that believes it has the whole node, which on a 64-core machine is not mild at
all.

## CPU shares have been ignored since JDK 19

This is the change that invalidates most articles written before 2022. **JDK-8281181, "Do not use
CPU Shares to compute active processor count"**, fixed in **JDK 19**. Its own description explains
why the old behaviour was wrong:

> *"From the above excerpt, it's clear that `cpu.shares` should be interpreted as relative values.
> … The exact numerical value of `cpu.shares` doesn't matter. Also, if process B is idle, then
> process A will get all available CPUs, regardless of the `cpu.shares` value."*

and names the old, incorrect mapping:

> *"0 … 1023 = 1 CPU · 1024 = (no limit) · 2048 = 2 CPUs · 4096 = 4 CPUs"*

The opt-in flag that JDK 19 added to restore the old behaviour, `UseContainerCpuShares`, **is not
present in JDK 25**: it does not appear in `globals_linux.hpp`, and it is not in `arguments.cpp`'s
deprecated-or-obsolete table either, which means on JDK 25 it is simply an unrecognised `-XX:`
option and **will fail the launch** unless `-XX:+IgnoreUnrecognizedVMOptions` is set.

## Why this collides with Kubernetes

Kubernetes maps the two resource fields onto two different cgroup knobs:

- `requests.cpu` → `cpu.shares` (v1) / `cpu.weight` (v2) — used by the scheduler for placement and
  by the kernel for proportional sharing under contention.
- `limits.cpu` → `cpu.cfs_quota_us` / the quota field of `cpu.max` — a hard cap enforced by
  throttling.

Since the JVM ignores shares, **`requests.cpu` has no effect whatsoever on any JVM sizing
decision.** The extremely common pattern of "set a request, leave the limit off so we can burst"
therefore produces a JVM that sizes every pool for the entire node. On a 64-core node, that is 64
CPUs' worth of GC threads and a common ForkJoinPool with 63 workers, in a pod that was requested
at 500 millicores.

The Kubernetes documentation is explicit about what the limit does:

> *"`cpu` limits are enforced by CPU throttling. When a container approaches its `cpu` limit, the
> kernel will restrict access to the CPU corresponding to the container's limit. Thus, a `cpu`
> limit is a hard limit the kernel enforces."*

Throttling is per period — the default period is 100 ms — so a JVM with far more runnable threads
than its quota allows burns the whole quota early in each period and is then frozen for the
remainder. That presents as *latency*, not as CPU saturation, and it is one of the most
misdiagnosed shapes in production Java. Which pools are involved is
[05b · The pools sized from that number](05b-the-pools-sized-from-that-number.md).

## The override

```bash
-XX:ActiveProcessorCount=2
```

> *"Overrides the number of CPUs that the VM will use to calculate the size of thread pools it
> will use for various operations such as Garbage Collection and ForkJoinPool. … **This flag is
> honored even if `UseContainerSupport` is not enabled.**"*

The flag's declaration is `product(int, ActiveProcessorCount, -1, ...)` — `-1` meaning "work it
out". `os::active_processor_count()` checks it first, before anything container-related:

```cpp
int os::active_processor_count() {
  if (ActiveProcessorCount > 0) {
    ...
    return ActiveProcessorCount;
  }
  ...
}
```

**Set it when you have a CPU request but no limit**, which is the case the detection cannot
handle. Set it to the request, rounded to a sensible integer. It costs nothing and it removes the
worst mismatch available in a Kubernetes JVM deployment.

## Gotchas

**★ `requests.cpu` is invisible to the JVM. Only `limits.cpu` is not.**
This is the single most consequential CPU fact in the topic and it inverts the advice in every
pre-JDK-19 article. If your platform team's policy is "requests always, limits never", every JVM
in the cluster is sizing its pools for the node.

**★ `UseContainerCpuShares` will not start on JDK 25.**
It was JDK 19's escape hatch back to the old behaviour, and it is gone. Pasting it from a 2022
blog post gives you `Unrecognized VM option`, and the JVM refuses to launch. Retired flags are
**13 · JVM flags that matter in 2026** *(not written yet)*.

**★ `ceilf` means a fractional limit rounds up, so the JVM always thinks it has at least as much
CPU as it does.**
`limits.cpu: 1500m` yields 2. That is deliberate — rounding down to 1 would leave half a CPU
unusable — but it means pools are consistently sized a fraction above the quota, which is exactly
the condition that produces throttling.

**★ `limits.cpu: 100m` gives a JVM that believes it has one whole CPU.**
`ceil(0.1)` is 1, and one is also the floor. A JVM at 100 millicores is throttled for roughly 90
percent of every period while believing it has a full processor. It will still start a JIT
compiler thread and a GC thread and behave as though it could use them. Sub-CPU limits and JVMs
are a poor combination; if you must, `-XX:ActiveProcessorCount=1` plus a small collector is the
honest configuration — [07 · What ergonomics picks in a small container](07-what-ergonomics-picks-in-a-small-container.md).

**★ A `cpuset` narrows the count even without a quota.**
`os::Linux::active_processor_count()` uses `sched_getaffinity`, and the final result is
`MIN2(host_cpus, limit_count)`. Kubernetes' static CPU manager policy, `taskset`, `numactl` and a
`cpuset` cgroup all bite here. The source comments on exactly this, noting that tools altering CPU
affinity *"do not update cgroup subsystem cpuset configuration files"*, which is why the minimum
of both is taken.

**★ The value is cached for 20 ms and can change during the process's life.**
`OSCONTAINER_CACHE_TIMEOUT` is 20 ms, and the `Runtime.availableProcessors()` javadoc says the
value *"may change during a particular invocation of the virtual machine"* and that sensitive
applications should *"occasionally poll this property"*. But GC thread counts and the common
ForkJoinPool's parallelism are fixed at initialisation. A CPU limit changed under a running JVM
changes what Java code sees and not what the JVM already built.

**★ Throttling looks like a latency problem, not a CPU problem.**
Average CPU utilisation can sit at 40 percent of the limit while the container is throttled for
part of every 100 ms period, because the average hides the within-period burst. The metric to look
at is the cgroup's throttling counters — `cpu.stat`'s `nr_throttled` and `throttled_usec` on v2 —
not utilisation.

**★ More threads is the wrong response to throttling.**
The instinct on seeing latency under a CPU limit is to raise pool sizes. Under a quota that makes
it strictly worse: more runnable threads consume the same quota faster, so the frozen part of each
period grows. Either raise the limit or reduce concurrency.

**★ `-XX:ActiveProcessorCount` is honoured even with container support disabled.**
The man page says so explicitly. That makes it the reliable last resort in odd environments — a
VM, a shared host, a runtime whose cgroup layout the JVM cannot parse — where the detection is
producing a number you do not believe.

## Interview questions

**★ How does a JVM decide how many processors it has inside a container?**
Through `os::active_processor_count()`. If `-XX:ActiveProcessorCount` is set to a positive value,
that wins outright. Otherwise, if the process is containerized, the JVM computes
`ceil(cpu_quota / cpu_period)` and takes the minimum of that and the host's CPU count, where the
host count itself comes from `sched_getaffinity` and so respects a `cpuset`. If there is no quota,
the limit count stays at the host count. Crucially, CPU shares and weight are not part of the
calculation — that was removed in JDK 19 by JDK-8281181 on the grounds that shares are a relative
value and cannot be converted into an absolute processor count.

**★ Your pods set `requests.cpu: 500m` and no limit, on 64-core nodes. What is wrong?**
Every JVM believes it has 64 processors. Requests map to `cpu.weight`, which the JVM ignores, and
with no limit there is no quota to derive a count from, so the container-aware path returns the
host count. The consequences are all sizing: a large number of parallel GC threads, several JIT
compiler threads, a common ForkJoinPool with 63 workers, and a virtual-thread scheduler with 64
carriers — all inside a pod that is entitled to half a CPU under contention. Under load the pod
context-switches heavily and its GC pauses lengthen because the parallel phases cannot get the
threads they assumed. The fix is either to set a CPU limit or to set
`-XX:ActiveProcessorCount` to match the request.

**★ Is it better to set a CPU limit or to set `-XX:ActiveProcessorCount`?**
They solve different halves. The limit changes what the kernel enforces *and* what the JVM
computes; `ActiveProcessorCount` only changes what the JVM computes. If your platform deliberately
runs without CPU limits so that pods can burst into idle node capacity — a defensible policy —
then `ActiveProcessorCount` is the right tool, because it makes the JVM size its pools for the
guaranteed share while still letting the process use spare capacity when it exists. If you do set
limits, you generally do not need the flag, except to correct the `ceil` rounding on a fractional
limit.

**★ A service has high p99 latency, its CPU utilisation averages 40 percent of its limit, and
adding threads made it worse. What is happening?**
Almost certainly CFS throttling. The quota is enforced within each 100 ms period, so the container
can exhaust its entitlement in the first 40 ms and be frozen for the remaining 60, while the
one-minute average still reads 40 percent. Adding threads makes the quota drain faster and the
frozen window longer, which is why it got worse. The evidence is in the cgroup's throttling
counters rather than in utilisation. The fixes are to raise the limit, to lower concurrency so the
burst fits inside the period, or — where the platform permits it — to remove the limit and pin
`-XX:ActiveProcessorCount` instead.

**★ Why did OpenJDK stop using CPU shares, and what broke as a result?**
Because shares are relative, not absolute: the bug report points out that two cgroups with equal
shares each get half the CPU regardless of the numeric value, and that an idle neighbour means you
get everything. Converting a relative weight into an absolute processor count produced systematic
under-utilisation — most sharply where Kubernetes sets `cpu.weight` to 1, which the old mapping
read as one CPU. What broke is every configuration that had been *relying* on shares to size the
JVM: those deployments got a much larger processor count on JDK 19 and later, with correspondingly
larger thread pools, and had to start setting either a CPU limit or `-XX:ActiveProcessorCount`.

{/* FOOTER */}
