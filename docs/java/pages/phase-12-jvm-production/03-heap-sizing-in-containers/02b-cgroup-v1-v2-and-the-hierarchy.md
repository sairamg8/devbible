---
title: "The JVM reads four or five specific files out of the cgroup filesystem, the file names are entirely different between v1 and v2, and since JDK 24 it walks up the hierarchy looking for a lower limit than the one in your own cgroup"
sidebar_label: "02b · cgroup v1, v2, hierarchy"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the JDK 25 HotSpot source at tag `jdk-25+36`:
> [`cgroupV1Subsystem_linux.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/os/linux/cgroupV1Subsystem_linux.cpp),
> [`cgroupV2Subsystem_linux.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/os/linux/cgroupV2Subsystem_linux.cpp),
> [`cgroupUtil_linux.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/os/linux/cgroupUtil_linux.cpp),
> [`cgroupSubsystem_linux.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/os/linux/cgroupSubsystem_linux.cpp);
> and the **JDK 25 `java` tool reference** for `-Xlog:os+container=trace`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**"The JVM reads the cgroup limit" is true but useless when you are trying to work out why it
read the wrong one. What it actually reads is a small, enumerable set of pseudo-files whose names
changed completely between cgroup v1 and cgroup v2, whose sentinel values for "no limit" differ,
and — since the hierarchy-adjustment work that landed for JDK 24 — which are not necessarily the
files in your own cgroup directory. This page is the map of exactly which bytes become your heap
size.**

## Which version am I on?

cgroup v2 (the "unified hierarchy") has been the default on all mainstream distributions for
several years; v1 survives in older clusters and in some managed Kubernetes node images. The
cheap checks:

```bash
# v2 if this prints cgroup2fs; v1 if it prints tmpfs
stat -fc %T /sys/fs/cgroup

# v2 has a single unified tree with this file at the root
ls /sys/fs/cgroup/cgroup.controllers
```

The JVM decides for itself in `CgroupSubsystemFactory::create()` and reports the answer as
`container_type` in the container block of `jcmd VM.info` and in hs_err files. A hybrid
configuration — v2 mounted with some controllers still on v1 — is possible and is why the
detection code is as long as it is.

## The files, side by side

| What the JVM wants | cgroup v1 | cgroup v2 |
|---|---|---|
| Memory limit | `memory.limit_in_bytes` | `memory.max` |
| Memory usage | `memory.usage_in_bytes` | `memory.current` |
| Memory soft limit | `memory.soft_limit_in_bytes` | `memory.low` |
| Memory + swap limit | `memory.memsw.limit_in_bytes` | `memory.swap.max` (added to `memory.max`) |
| Swappiness | `memory.swappiness` | — |
| CPU quota | `cpu.cfs_quota_us` | first field of `cpu.max` |
| CPU period | `cpu.cfs_period_us` | second field of `cpu.max` |
| CPU shares / weight | `cpu.shares` | `cpu.weight` |
| Pids limit | `pids.max` | `pids.max` |

Of these, **only the memory limit and the CPU quota and period change any sizing decision.**
Shares and weight are read and reported but no longer feed the processor count — see
[05 · CPU limits and ergonomics](05-cpu-limits-and-ergonomics.md). The soft limit is read for
reporting only.

## "No limit" is spelled differently in each version

cgroup v2 writes the literal string `max` into `memory.max` when there is no limit, and the JVM's
`CONTAINER_READ_NUMBER_CHECKED_MAX` macro maps that to −1, which `read_memory_limit_in_bytes`
logs as *"Memory Limit is: Unlimited"*.

cgroup v1 has no such sentinel; it writes an enormous number instead. HotSpot compensates with a
comparison, and says so in its own comment:

```cpp
// caps it at host_mem since Cg v1 has no value to represent 'max'.
```

so `read_memory_limit_in_bytes` returns −1 whenever the value read is greater than or equal to
the host's physical memory. **A limit set at or above the node's RAM is therefore treated as no
limit at all**, on both versions — v1 by that comparison, v2 by the same "ignored" path in the
v2 controller's debug logging. Setting `memory: 1Ti` on a 64 GB node does not give the JVM a 1 TB
view; it gives it 64 GB and a debug log line nobody reads.

## The hierarchy walk

The subtlest behaviour in the whole mechanism. When a controller's cgroup path suggests the
process's own cgroup may not be where the binding limit lives, `CgroupUtil::adjust_controller`
walks **up** the hierarchy, reading the limit at each ancestor, and points the controller at
whichever level has the lowest limit:

```cpp
while ((last_slash = strrchr(cg_path, '/')) != cg_path) {
  *last_slash = '\0'; // strip path
  mem->set_subsystem_path(cg_path);
  limit = mem->read_memory_limit_in_bytes(phys_mem);
  if (limit >= 0 && limit < lowest_limit) {
    lowest_limit = limit;
    limit_cg_path = os::strdup(cg_path);
  }
}
```

This is correct and desirable: in Kubernetes the pod-level cgroup often carries a limit that the
container-level cgroup does not, and before this the JVM could miss it entirely. It also means
**the number the JVM used may come from a cgroup directory you did not look at**, which is worth
knowing before you conclude the JVM read the wrong value.

There is a guard for the case where the cgroup was moved after the mount was taken, and it logs
loudly:

> *"Cgroup memory controller path at '%s' seems to have moved to '%s', detected limits won't be
> accurate"*

If you ever see that warning, the JVM is telling you its own numbers are suspect. It falls back
to the mount root.

## Detection requires read-only mounts, or an actual limit

Recall from [02 · Container awareness](02-container-awareness.md) that
`OSContainer::is_containerized()` is the gate on all of this. For v2:

```cpp
bool CgroupV2Subsystem::is_containerized() {
  return _unified.is_read_only() &&
         _memory->controller()->is_read_only() &&
         _cpu->controller()->is_read_only();
}
```

and v1 requires the same of `memory`, `cpu`, `cpuacct` and `cpuset`, with the comment
*"containerized iff all required controllers are mounted read-only"*. When that fails, the
fallback asks whether a memory or CPU limit is set at all. Both paths have to fail before the
JVM decides it is on a bare machine.

## Gotchas

**★ `memory.high` is invisible to the JVM.**
cgroup v2 has two ceilings. `memory.max` is the hard limit that triggers the OOM killer, and the
JVM reads it. `memory.high` is a throttling threshold — the kernel puts the cgroup under heavy
reclaim pressure and stalls allocating threads instead of killing them. The JVM never reads
`memory.high`, so a container whose `memory.high` is set well below `memory.max` will not be
OOMKilled; it will just get inexplicably, unattributably slow, and the JVM will size itself as
though nothing were wrong. Kubernetes' `MemoryQoS` feature sets `memory.high`.

**★ The soft limit is read and then ignored for sizing.**
`memory_soft_limit_in_bytes` (v1 `memory.soft_limit_in_bytes`, v2 `memory.low`) appears in the
container info block, which makes it look like an input. It is not: only
`memory_limit_in_bytes` reaches `os::physical_memory()`.

**★ Swap arithmetic differs between versions and can surprise you.**
On v1 the JVM reads `memory.memsw.limit_in_bytes`, which is memory *plus* swap as a single
number; on v2 it reads `memory.swap.max` and **adds** it to `memory.max`. v1 additionally resets
the combined limit back to the memory limit when `memory.swappiness` is 0, with the log line
*"Memory and Swap Limit has been reset to … because swappiness is 0"*. None of this changes the
heap size — heap ergonomics uses `memory_limit_in_bytes`, not the swap-inclusive figure — but it
does change what the container block reports, and mistaking one for the other during an incident
costs time.

**★ Nested containers report their innermost limit, but only if it is lower.**
The hierarchy walk takes the *minimum* over ancestors. A container-in-container arrangement, or
a Kubernetes pod cgroup with a limit above the container's, resolves to the tighter of the two,
which is what you want. A pod cgroup with a limit *below* the container's also resolves
correctly, and that is the case people do not expect: your container says 2 Gi, the JVM sized for
1 Gi, and both are right.

**★ cgroup v1 will happily hand you a limit from a controller that is not the one enforcing.**
v1's controllers are separate hierarchies and can be mounted at unrelated paths. That is exactly
the class of bug the read-only check and the hierarchy walk exist to contain, and it is a good
reason to prefer v2 nodes for JVM workloads if you have the choice.

**★ `-Xlog:os+container=trace` is the only first-party answer to "which file did you read?".**
It logs each read with the parsed value. `-Xlog:os+container=debug` is quieter and still carries
the "unlimited"/"ignored"/"failed" reasons. Neither costs anything at startup, and adding the
`debug` level permanently to a container image is a defensible choice.

**★ A cgroup namespace makes the paths inside the container look like the root.**
Docker and containerd normally give the container its own cgroup namespace, so
`/proc/self/cgroup` reads `0::/` rather than the long path the node sees. That is fine for the
JVM — it reads through its own mount point — but it means correlating what you see inside the
container with `systemd-cgls` on the node needs the node's view, not the container's.

**★ On v1 the "unlimited" test is a comparison against host memory, so it is affected by the
node you land on.**
The identical limit value can be treated as a real limit on a 256 GB node and as "unlimited" on a
32 GB node. This only bites at absurd limit values, but it is a genuine source of
"works on that node, not on this one".

## Interview questions

**★ Which cgroup files does a JVM actually read, and which of them change the heap size?**
The memory limit (`memory.max` on v2, `memory.limit_in_bytes` on v1), the memory usage
(`memory.current` / `memory.usage_in_bytes`), the CPU quota and period (`cpu.max` on v2, the two
`cpu.cfs_*_us` files on v1), the shares (`cpu.weight` / `cpu.shares`), the pids limit and the
swap limits. Only the memory limit changes the heap size, by becoming the return value of
`os::physical_memory()`; the quota and period change the processor count, which changes GC and
pool thread counts. Shares, the soft limit and the swap figures are read for reporting and do not
feed sizing.

**★ Your pod has `limits.memory: 2Gi`, but the JVM chose a heap consistent with 1 Gi. How is that
possible?**
Most likely the hierarchy walk found a lower limit on an ancestor cgroup — a pod-level cgroup, a
parent slice, or a nested containment layer — and `CgroupUtil::adjust_controller` deliberately
points the controller at the lowest limit it finds in the hierarchy. Confirm with
`-Xlog:os+container=trace`, which logs the adjusted subsystem path and the lowest limit it
settled on. The other possibilities are that something is passing `-XX:MaxRAM` or an explicit
`-Xmx` that you have not found, or that `MaxRAMPercentage` is not the value you think.

**★ What is the difference between `memory.high` and `memory.max`, and why does it matter to a
Java service?**
`memory.max` is the hard limit: exceed it and the kernel's cgroup OOM killer terminates a process
in the cgroup. `memory.high` is a throttle: the kernel forces aggressive reclaim and stalls the
allocating thread, so the container survives but slows down, sometimes dramatically. The JVM
reads only `memory.max`, so it sizes itself against the hard limit and is entirely unaware of the
throttle. The symptom is a service with normal memory metrics, no restarts, no GC anomaly and
latency that has quietly doubled — a shape that sends people looking for a lock contention
problem that is not there.

**★ Would you rather run a JVM on a cgroup v1 or a cgroup v2 node, and does it matter?**
v2, though not dramatically. v2 gives a single unified hierarchy, an explicit `max` sentinel
instead of a "compare against host memory" heuristic for "no limit", and the pressure-stall and
`memory.high` machinery that makes the kernel's behaviour easier to observe. v1's separate
hierarchies are the source of most of the awkward code in HotSpot's container layer. In practice
the JVM handles both, and the choice is usually made by the node image rather than by you.

{/* FOOTER */}
