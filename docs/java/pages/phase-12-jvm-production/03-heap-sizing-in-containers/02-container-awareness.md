---
title: "Container awareness is one boolean that redefines what the words physical memory and available processors mean inside the JVM, and everything else in this topic is a consequence of that redefinition"
sidebar_label: "02 · Container awareness"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference** —
> `-XX:-UseContainerSupport`, `-XX:ActiveProcessorCount`, `-XX:MaxRAM`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> and the JDK 25 HotSpot source at tag `jdk-25+36`:
> [`os/linux/globals_linux.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/os/linux/globals_linux.hpp),
> [`os/linux/osContainer_linux.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/os/linux/osContainer_linux.cpp),
> [`os/linux/os_linux.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/os/linux/os_linux.cpp).
> Also the **`java.lang.Runtime`** javadoc for JDK 25
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Runtime.html)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Before JDK 10 a JVM in a container sized itself against the host: a 512 MB container on a
256 GB machine chose a 64 GB heap and died immediately. Container support fixed that by changing
the answer to two questions — how much memory is there, and how many processors are there — at
the level of the operating-system abstraction layer, so that every piece of ergonomics above it
became container-correct at once without any of them knowing a container existed. Understanding
exactly which two questions changed, and the surprisingly conditional rule for when the JVM
decides it is in a container at all, is what makes the rest of this topic predictable rather than
folkloric.**

## One flag, on by default, Linux only

The man page:

> *"`-XX:-UseContainerSupport` — Linux only: The VM now provides automatic container detection
> support, which allows the VM to determine the amount of memory and number of processors that
> are available to a Java process running in docker containers. It uses this information to
> allocate system resources. **The default for this flag is true**, and container support is
> enabled by default. It can be disabled with `-XX:-UseContainerSupport`."*

The source agrees — `globals_linux.hpp` at `jdk-25+36`:

```cpp
product(bool, UseContainerSupport, true,
        "Enable detection and runtime container configuration support")
```

"Linux only" is literal: the flag is declared in the Linux-specific globals file. It does not
exist on macOS or Windows, and there is no equivalent. This matters more than it sounds, because
a developer reproducing a container sizing problem on a Mac is running a JVM with an entirely
different set of inputs — unless the Docker Desktop VM is doing the containment, in which case
the JVM inside the Linux VM *is* container-aware and the host's memory is the VM's memory, not
the Mac's.

## The two questions it changes

Container support does not intercept `-Xmx`. It changes what the JVM believes about the machine,
in `os_linux.cpp`:

```cpp
julong os::physical_memory() {
  jlong phys_mem = 0;
  if (OSContainer::is_containerized()) {
    jlong mem_limit;
    if ((mem_limit = OSContainer::memory_limit_in_bytes()) > 0) {
      log_trace(os)("total container memory: " JLONG_FORMAT, mem_limit);
      return mem_limit;
    }
  }
  phys_mem = Linux::physical_memory();
  ...
}
```

**`os::physical_memory()` returns the cgroup memory limit.** That single substitution is the
whole mechanism: every percentage-based heap sizing rule multiplies against this number, which
is why `-XX:MaxRAMPercentage` is a percentage of *your limit* rather than of the node's RAM.
See [03 · `MaxRAMPercentage`](03-maxrampercentage.md) for the arithmetic that sits on top.

Two neighbours change with it. `os::available_memory()` becomes `limit − usage` inside a
container rather than the host's `MemAvailable`, and `os::active_processor_count()` defers to
`OSContainer::active_processor_count()`, which is
[05 · CPU limits and ergonomics](05-cpu-limits-and-ergonomics.md).

## The detection rule is two-step, and the second step is the interesting one

`OSContainer::init()` carries its own explanation, verbatim from `osContainer_linux.cpp`:

```cpp
/*
 * In order to avoid a false positive on is_containerized() on
 * Linux systems outside a container *and* to ensure compatibility
 * with in-container usage, we detemine is_containerized() by two
 * steps:
 * 1.) Determine if all the cgroup controllers are mounted read only.
 *     If yes, is_containerized() == true. Otherwise, do the fallback
 *     in 2.)
 * 2.) Query for memory and cpu limits. If any limit is set, we set
 *     is_containerized() == true.
 *
 * Step 1.) covers the basic in container use-cases. Step 2.) ensures
 * that limits enforced by other means (e.g. systemd slice) are properly
 * detected.
 */
```

Read step 1 carefully: the *primary* signal that you are in a container is not a namespace, not
`/.dockerenv`, not a cgroup path — it is that **the cgroup controllers are mounted read-only**.
That is what a container runtime does and what a bare host does not. Step 2 exists because a
systemd unit with `MemoryMax=` is a real limit on a writable cgroup filesystem, and ignoring it
would have been wrong.

The consequence worth remembering: **a JVM running under a systemd slice with a memory limit is
"containerized" as far as HotSpot is concerned**, and `MaxRAMPercentage` applies to the slice's
limit. This is not a Docker-only feature.

## When there is no limit, there is no containment

If `memory_limit_in_bytes()` returns −1 (unlimited) or the read fails, `os::physical_memory()`
falls through to the host's real memory. So a container with **no memory limit set** gets exactly
the pre-JDK-10 behaviour: the JVM sizes itself against the node. On a 64-core, 256 GB node that
is a 64 GB default heap and a GC thread pool sized for the whole machine, in a pod you thought
was small. **Not setting a limit is not "letting it use what it needs"; it is telling the JVM the
node belongs to it.**

## Verifying what the JVM actually saw

Two mechanisms, both first-party.

```bash
# every cgroup value the JVM read, at startup and on refresh
java -Xlog:os+container=trace -version

# the resulting decisions
java -XX:+PrintFlagsFinal -version | grep -E 'MaxHeapSize|InitialHeapSize|MaxRAM|ActiveProcessor'
```

The man page recommends the first by name: *"Use `-Xlog:os+container=trace` for maximum logging
of container information."* The second is the general flag-verification technique that
**13 · JVM flags that matter in 2026** *(not written yet)* owns.

The same container facts are printed into the hs_err crash file and by `jcmd VM.info`. The field
list, taken from `os_linux.cpp`'s printing routine rather than from any run, is:

```
container (cgroup) information:
container_type, cpu_cpuset_cpus, cpu_memory_nodes, active_processor_count,
cpu_quota, cpu_period, cpu_shares, memory_limit_in_bytes,
memory_and_swap_limit_in_bytes, memory_soft_limit_in_bytes, memory_usage_in_bytes,
memory_max_usage_in_bytes, rss_usage_in_bytes, cache_usage_in_bytes,
maximum number of tasks, current number of tasks
```

That is a schematic of the field names, not captured output. Note `maximum number of tasks` —
the cgroup pids limit — which is the ceiling on how many threads the JVM can create regardless
of memory, and a frequent cause of `unable to create native thread`
([06d · The thread-count arithmetic](../01-memory-layout/06d-the-thread-count-arithmetic.md)).

## What Java code sees

`Runtime.getRuntime().maxMemory()` reports *"the maximum amount of memory that the Java virtual
machine will attempt to use"* — the heap ceiling, which under container support was derived from
the cgroup limit. It is **not** the container limit, and code that treats it as one is
under-counting by the entire native budget. `Runtime.availableProcessors()` does reflect the
container's CPU allocation, with a caveat the javadoc states outright:

> *"This value may change during a particular invocation of the virtual machine. Applications
> that are sensitive to the number of available processors should therefore occasionally poll
> this property and adjust their resource usage appropriately."*

## Gotchas

**★ `UseContainerSupport` is not a switch you should ever turn off.**
The only legitimate reason is to reproduce pre-JDK-10 behaviour for a comparison. Disabling it
makes the JVM size itself against the node while the cgroup still enforces the limit — that is
the exact configuration that produced the original bug.

**★ Container awareness reads memory, CPU and pids. It does not read anything else.**
It does not know about your `ephemeral-storage` limit, your network policy, or the page cache
you are about to generate. Nor does it know about *other processes in the same cgroup*: if your
container also runs an agent, a log shipper or a shell, the JVM sizes itself as though the whole
limit were its own.

**★ The values are cached, and the cache is short.**
`osContainer_linux.hpp` defines `OSCONTAINER_CACHE_TIMEOUT` as `NANOSECS_PER_SEC/50` — 20 ms —
with the comment *"20ms timeout between re-reads of memory limit and _active_processor_count"*.
That is enough to avoid re-reading a cgroup file on every allocation, and it is why in-place
resizing of a running container can be picked up at all. It is **not** a promise that the heap
will resize; `MaxHeapSize` was fixed at startup.

**★ Resizing a pod's memory limit in place does not resize the heap.**
Kubernetes in-place resource resize changes the cgroup limit under a running process. The JVM's
`MaxHeapSize` was computed once, during `Arguments::set_heap_size()`, from the limit that existed
at launch. Lowering the limit under a running JVM is a direct route to an OOMKill; raising it
gives you nothing until the next restart.

**★ Reading `/proc/meminfo` inside a container gives you the host's numbers.**
`/proc/meminfo` is not namespaced. Anything in your image that reads it — a shell script
computing `-Xmx`, an old monitoring agent, `free`, `top` — sees the node. The JVM's own container
support does not fix those; it only fixes the JVM. This is one of the reasons a startup script
that computes a heap size from `free -m` is a bug that survives for years.

**★ A cgroup limit larger than the host's memory is ignored.**
The v2 controller logs *"container memory limit ignored"* when the value read is at least the
host's physical memory, and the host value is used. Setting a limit of, say, 1 TB on a 64 GB node
therefore does not give the JVM a 1 TB view — it gives it 64 GB.

**★ `is_containerized()` can be false in a container.**
If the runtime mounted the cgroup filesystem writable *and* no memory or CPU limit is set, both
detection steps fail and the JVM behaves as if it were on the bare host. This is the ordinary
case for a plain `docker run` with no `--memory` and no `--cpus`, and it is why a laptop
reproduction of a production sizing bug so often refuses to reproduce.

**★ There is no Windows or macOS equivalent, and Windows containers do not get this.**
`UseContainerSupport` is declared in `globals_linux.hpp`. On a Windows container the JVM sizes
against the job object's view of the machine only insofar as the OS reports it; there is no
cgroup-reading layer. Do not carry Linux sizing advice across.

## Interview questions

**★ How does a JVM know it is in a container, and what does it do with that knowledge?**
On Linux, `UseContainerSupport` is on by default and `OSContainer::init()` decides in two steps:
if every relevant cgroup controller is mounted read-only, it is a container; otherwise it falls
back to asking whether any memory or CPU limit is actually set, which catches systemd slices.
When the answer is yes, `os::physical_memory()` returns the cgroup memory limit instead of the
host's RAM, `os::available_memory()` returns limit minus usage, and `os::active_processor_count()`
returns the CPU count derived from the cgroup quota. Everything above that — heap ergonomics, GC
thread counts, the common ForkJoinPool — is unchanged code operating on different numbers.

**★ Why is `MaxRAMPercentage` a percentage rather than an absolute size, given that you know your
container's limit at deploy time?**
Because the image does not. A percentage makes one image correct at every memory size it is ever
deployed at — dev at 512 MB, staging at 1 GB, production at 4 GB, and the emergency bump to 8 GB
someone applies at 3 a.m. An absolute `-Xmx` baked into the image is correct for exactly one of
those and silently wrong for the rest, and being wrong in the generous direction means the heap
alone may exceed the limit. The percentage also survives the case where the person changing the
limit is not the person who knows the JVM flags.

**★ A container is running with no memory limit. What heap does the JVM choose?**
Whatever 25 percent of the *node's* physical memory comes to, because with no limit
`is_containerized()` is likely false and, even when it is true, `memory_limit_in_bytes()` returns
unlimited and `os::physical_memory()` falls through to the host. On a large node that is a very
large heap in a pod nobody thinks of as large, and it also inflates every derived value — GC
thread counts, the default direct-memory ceiling, region sizes. The absence of a limit is a
configuration, not the absence of one.

**★ Your ops team changes the pod's memory limit from 1 Gi to 2 Gi with an in-place resize and
the heap does not grow. Why?**
Because heap sizing is a startup decision. `Arguments::set_heap_size()` runs once, reads
`os::physical_memory()` once, and sets `MaxHeapSize` ergonomically from it; the 20 ms cgroup cache
means the JVM will happily report the *new* limit if asked, but nothing recomputes the heap
ceiling. The container needs to restart for the new limit to take effect. The reverse direction
is worse: shrinking the limit under a running JVM leaves a heap ceiling above the new limit and
sets up an OOMKill.

**★ How would you prove, from inside a running container, what the JVM believed about its
limits?**
`java -Xlog:os+container=trace` on a fresh process shows every cgroup file read and the value
parsed from it, which is the direct evidence. For an already-running process, `jcmd <pid> VM.info`
prints the same container block that goes into an hs_err file — container type, quota, period,
shares, the memory limits and the pids limits. Pair either with
`jcmd <pid> VM.flags` or `-XX:+PrintFlagsFinal` to see what the ergonomics did with those inputs.
Comparing the two is how you catch the case where the JVM read the limit correctly and then a
hard-coded flag overrode the conclusion.

{/* FOOTER */}
