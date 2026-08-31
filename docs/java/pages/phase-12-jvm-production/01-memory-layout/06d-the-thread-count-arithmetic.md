---
title: "The only bound on a JVM's thread-stack footprint is thread count multiplied by -Xss, and every one of the numbers in that product is set somewhere other than your JVM flags"
sidebar_label: "06d · The thread-count arithmetic"
sidebar_position: 34
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against **JVMS SE 25 §2.5.2**
> ([docs.oracle.com](https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-2.html)); the
> **JDK 25 `java` tool reference** (`-Xss`, `-XX:ThreadStackSize`)
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html));
> the **JDK 25 `Thread.Builder.OfPlatform`** javadoc
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.Builder.OfPlatform.html));
> and the OpenJDK `jdk-25+36` sources — `src/hotspot/share/runtime/os.hpp`
> (`OS_NATIVE_THREAD_CREATION_FAILED_MSG`), `src/hotspot/share/prims/jvm.cpp`
> (`JVM_StartThread`), `src/hotspot/share/runtime/globals.hpp` (`VMThreadStackSize`,
> `CompilerThreadStackSize`), and `src/hotspot/os/linux/os_linux.cpp` with
> `src/hotspot/os/linux/globals_linux.hpp` (`AdjustStackSizeForTLS`).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**There is no `-XX:MaxThreadStackTotal`. The thread-stack term in a JVM's memory bill is a
product of two numbers and the JVM owns only one of them: `-Xss` is a flag, but the thread count
is decided by your web container, your connection pools, your executors, your HTTP clients and
every library that quietly starts a daemon thread in a static initialiser. This chunk is the
arithmetic, the inventory that feeds it, the ways the operating system says no before memory runs
out, and the two places on Linux where the number you set is not the number you get.**

## The product, and where each factor comes from

```text
native thread-stack footprint  ~  (Java threads      x -Xss)
                               +  (GC + VM threads   x -XX:VMThreadStackSize)
                               +  (C1/C2 threads     x -XX:CompilerThreadStackSize)
```

Only the right-hand factors are JVM flags, and only the first is the one people reach for. The
left-hand factors are application configuration. In a typical Spring Boot 4.1 service the
inventory looks like this — every row is a thread count someone chose, usually by accepting a
default:

| Source | Typical knob |
|---|---|
| Embedded Tomcat worker threads | `server.tomcat.threads.max` (default 200) |
| Tomcat acceptor and poller threads | container internals, a handful |
| HikariCP | `spring.datasource.hikari.maximum-pool-size`, plus a housekeeping thread and the JDBC driver's own |
| `@Async` / `TaskExecutor` | `spring.task.execution.pool.max-size` |
| `@Scheduled` | `spring.task.scheduling.pool.size` |
| `ForkJoinPool.commonPool()` | `availableProcessors() - 1`, used by every parallel stream |
| Reactor Netty event loops | `reactor.netty.ioWorkerCount`, defaults to the processor count |
| Kafka / RabbitMQ / JMS listeners | one or more per configured concurrent consumer |
| HTTP client connection managers | idle-eviction and keep-alive threads |
| Metrics, tracing, async log appenders | one or two each |
| JVM internals | GC workers, JIT compiler threads, the VM thread, service threads, JFR |

The point is not the numbers, which are yours. The point is that **the first column has eleven
rows and the second column has eleven different owners**, so "how many threads does this service
run" is not answerable from JVM configuration. It is answerable from a thread dump. Take one,
count, multiply.

## The operating system says no before memory does

The JVM specification anticipates the failure:

> *"If Java Virtual Machine stacks can be dynamically expanded, and expansion is attempted but
> insufficient memory can be made available to effect the expansion, **or if insufficient memory
> can be made available to create the initial Java Virtual Machine stack for a new thread, the
> Java Virtual Machine throws an `OutOfMemoryError`**."*

HotSpot implements exactly that. `JVM_StartThread` constructs the `JavaThread`, checks whether an
OS thread came back, and if not:

```cpp
if (native_thread->osthread() == nullptr) {
  ResourceMark rm(thread);
  log_warning(os, thread)("Failed to start the native thread for java.lang.Thread \"%s\"",
                          JavaThread::name_for(JNIHandles::resolve_non_null(jthread)));
  native_thread->smr_delete();
  ...
  THROW_MSG(vmSymbols::java_lang_OutOfMemoryError(),
            os::native_thread_creation_failed_msg());
}
```

The message it throws is a single compile-time constant in `os.hpp`:

```cpp
#define OS_NATIVE_THREAD_CREATION_FAILED_MSG \
  "unable to create native thread: possibly out of memory or process/resource limits reached"
```

🔴 **Read the whole message.** `OutOfMemoryError` is the exception type, but the detail message
hedges deliberately: *"possibly out of memory **or process/resource limits reached**"*. On Linux
the resource limit is more often the cause than memory, and none of the limits are JVM settings:

| Limit | What it caps | Where it is set |
|---|---|---|
| `RLIMIT_NPROC` | threads and processes per user | `ulimit -u`, `/etc/security/limits.conf` |
| cgroup `pids.max` | tasks in the container | the container runtime or Kubernetes |
| `RLIMIT_AS` | total virtual address space | `ulimit -v` |
| `vm.max_map_count` | virtual memory areas per process | `sysctl` |

That last one is the sneakiest: on Linux each thread stack occupies its own memory mapping,
alongside a guard region, so a process with tens of thousands of threads is also a process with
tens of thousands of mappings. I could not find a JDK document stating the exact number of
mappings HotSpot creates per thread, so treat the count as an OS-level property to measure rather
than a number to compute — but the direction is certain, and `vm.max_map_count` is a real ceiling
a thread-per-request service can meet.

Note the log line above as well: HotSpot emits `log_warning(os, thread)` naming the thread that
failed to start. Running with `-Xlog:os+thread=warning` puts that in your log **with the thread's
name**, which frequently identifies the leaking pool in one line — considerably faster than a heap
dump, and it is not a heap problem anyway.

## The two Linux subtleties that make `-Xss` not the number you get

**Guard and shadow zones are subtracted.** HotSpot carves red, yellow, reserved and shadow zones
out of the low end of every Java thread stack, so the depth you can actually reach is less than
`-Xss` divided by your average frame size. Bounded and small, but not zero.

**glibc's static TLS may be subtracted too.** From `os_linux.cpp`:

```cpp
// On Linux, glibc places static TLS blocks (for __thread variables) on
// the thread stack. This decreases the stack size actually available
// to threads.
//
// For large static TLS sizes, this may cause threads to malfunction due
// to insufficient stack space. This is a well-known issue in glibc:
// ...
// As a workaround, we call a private but assumed-stable glibc function,
// __pthread_get_minstack() to obtain the minstack size and derive the
// static TLS size from it. We then increase the user requested stack
// size by this TLS size.
//
// Due to compatibility concerns, this size adjustment is opt-in and
// controlled via AdjustStackSizeForTLS.
```

The flag it names is **off by default**:

```cpp
product(bool, AdjustStackSizeForTLS, false,
        "Increase the thread stack size to include space for glibc "
        "static thread-local storage (TLS) if true")
```

So by default, on Linux, whatever glibc needs for `__thread` variables comes *out of* your `-Xss`
rather than being added to it. That normally does not matter — until a native library loaded into
your process declares large `__thread` storage, at which point every Java thread quietly loses
that much stack. The symptom is threads overflowing at a depth that used to be fine, after a
dependency upgrade that changed nothing in Java. `-XX:+AdjustStackSizeForTLS` is the documented
opt-in, and it makes each thread's real reservation *larger* than `-Xss`, which then has to be
folded back into the arithmetic above.

## Gotchas

**★ `OutOfMemoryError: unable to create native thread…` is usually not about memory.**
The full detail message is *"unable to create native thread: possibly out of memory or
process/resource limits reached"*. On Linux the resource limit — `ulimit -u`, the container's
`pids.max`, or `vm.max_map_count` — is the more common cause. Raising the container's memory limit
in response fixes nothing.

**★ Adding heap to fix a thread-creation `OutOfMemoryError` makes it worse.**
Thread stacks are native. Inside a fixed container limit, every megabyte given to `-Xmx` is a
megabyte no longer available for stacks. This is one of the few situations where the correct
response to an `OutOfMemoryError` is to *shrink* the heap.

**★ There is no flag that caps total thread-stack memory.**
`-Xmx` bounds the heap, `-XX:MaxMetaspaceSize` bounds metaspace, `-XX:ReservedCodeCacheSize`
bounds the code cache. Nothing bounds thread stacks. The only control is the thread count, and it
lives in application configuration.

**★ `AdjustStackSizeForTLS` is off by default, so glibc's static TLS comes out of your `-Xss`.**
HotSpot's own comment says static TLS blocks on the thread stack *"decreases the stack size
actually available to threads"* and that the adjustment is *"opt-in"*. A native dependency that
declares large `__thread` storage silently reduces every Java thread's usable depth, with no
Java-side change to blame for it.

**★ The thread count is not in your JVM flags, so it is not in your JVM-flag review.**
Ten independent libraries each defaulting to "one thread per processor" on a 16-core node is 160
threads nobody chose. The only reliable inventory is a thread dump of the running service, grouped
by name prefix.

**★ `-Xlog:os+thread=warning` names the thread that failed to start.**
HotSpot logs *"Failed to start the native thread for java.lang.Thread \"%s\""* immediately before
throwing. That name usually identifies the leaking pool — `pool-47-thread-1` tells you someone is
creating a new `ExecutorService` per request — and enabling it costs nothing.

**★ Thread pools that are never shut down leak stacks, not heap.**
An `ExecutorService` created per request and never closed keeps its non-daemon threads alive
forever. The heap graph stays flat, because a `Thread` object is small; the native footprint
climbs by `-Xss` per leaked thread until the container is killed or thread creation fails.

**★ On a 32-bit JVM the binding constraint is address space, not RAM.**
`threads × -Xss` plus the heap plus everything else has to fit in a ~2–3 GB address space. This is
the one environment where reserved-but-uncommitted address space genuinely costs you, and it is
why 32-bit JVMs cap out at a few hundred threads at the default `-Xss`.

**★ Container CPU limits change the thread count, and therefore the memory footprint.**
GC worker counts, the fork-join common pool, Netty event loops and the virtual-thread scheduler's
parallelism are all derived from `availableProcessors()`, which is container-aware. Doubling a
pod's CPU limit to fix latency also increases its baseline native memory, and the two changes get
attributed to each other.

## Interview questions

**★ You raised `-Xss` from 1 MB to 8 MB and the container started getting OOMKilled. Why?**
Because `-Xss` is per thread. At 400 threads the reserved stack footprint moved from roughly
400 MB to roughly 3.2 GB of address space, and the committed portion grew in proportion to how
deep those threads actually run. Nothing about `-Xmx` changed, so heap graphs look identical and
the kill looks unexplained. The targeted fix is to leave `-Xss` alone and give the one deep code
path its own thread with `Thread.ofPlatform().stackSize(...)`, or its own small pool built from
that builder's `factory()`.

**★ Your service throws `OutOfMemoryError: unable to create native thread: possibly out of memory
or process/resource limits reached`. Walk me through the diagnosis.**
Start by reading the second half of the message: it is telling you a resource limit is as likely
as memory. Check `ulimit -u` and the container's `pids.max` for a task limit, and
`vm.max_map_count` for a mapping limit. Then count threads — take a thread dump and group by name
prefix, because the usual cause is a pool created per request instead of per application, and the
prefix identifies it. `-Xlog:os+thread=warning` gives you the failing thread's name directly. Only
if the limits are clear and the thread count is legitimate do you look at memory, and then the fix
is often to *lower* `-Xmx`, because the heap is competing with stacks for the same container
budget.

**★ Why does the message say "possibly", and what does that tell you about the JVM's knowledge?**
Because HotSpot genuinely does not know. It asked the OS for a thread, the OS refused, and HotSpot
does not interpret the refusal further. The message is a single compile-time constant in `os.hpp`
used for every failure path, so it cannot be more specific than "memory or limits". That is
precisely why the diagnosis has to start outside the JVM, with the OS and cgroup limits.

**★ A pod is being OOMKilled, the heap is flat at 40% of `-Xmx`, and the thread count has been
climbing all week. What is happening?**
A thread leak. Each leaked platform thread costs `-Xss` of reserved address space and whatever
fraction of it gets committed, all of it outside the heap, so heap metrics stay perfectly healthy
while RSS climbs. The classic source is an `ExecutorService`, HTTP client or Kafka consumer created
per request or per job instead of once per application, with non-daemon threads that never
terminate. A thread dump grouped by name prefix identifies it in seconds, and the fix is a
lifecycle fix — one shared executor, closed once — not a memory-limit fix.

**★ Two identical services, same flags, same image: one runs 2,000 threads happily, the other
fails to create the 900th. What differs?**
Something outside the JVM. In order of likelihood: a different `ulimit -u` or cgroup `pids.max`; a
different `vm.max_map_count`; a different CPU allocation, which changes GC worker and common-pool
thread counts; a different architecture, since Linux/AArch64 defaults `-Xss` to 2048 KB against
x64's 1024 KB; or a different container memory limit against the same `-Xmx`, leaving less room for
native reservations. None of those appear in JVM configuration, which is exactly why "same flags"
is not "same environment".

**★ Where would you look to confirm how much thread-stack memory a running JVM is actually using?**
Native Memory Tracking — `-XX:NativeMemoryTracking=summary` at launch, then
`jcmd <pid> VM.native_memory summary`. Its `Thread` category reports reserved and committed
separately, which is the distinction the arithmetic cannot give you: `threads × -Xss` is the
reserved number and only the committed number is in RSS. Do not reach for a heap dump — platform
thread stacks are not in the heap at all. The exception is a virtual-thread service, where the
stacks *are* heap objects and a heap dump is exactly the right tool.

**★ Your team wants to raise the container CPU limit to improve latency. What should you check
about memory first?**
That the thread count is not derived from the processor count in more places than anyone expects.
GC worker threads, `ForkJoinPool.commonPool()`, Netty event loops and the virtual-thread
scheduler's parallelism all scale with `availableProcessors()`, which is container-aware on a
modern JDK. Doubling the CPU limit therefore raises the baseline native footprint through the
thread-stack term without touching a single memory setting, and if the memory limit stays where it
was, the latency fix arrives with an OOMKill attached.

{/* FOOTER */}
