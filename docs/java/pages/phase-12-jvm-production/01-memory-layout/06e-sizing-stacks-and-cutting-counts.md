---
title: "You almost never want a global -Xss change: the supported levers are a per-thread stack size for the one deep path, the JVM's separate flags for its own threads, and — best of all — fewer threads"
sidebar_label: "06e · Sizing stacks, cutting counts"
sidebar_position: 35
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JDK 25 `Thread.Builder.OfPlatform`** javadoc
> (`stackSize(long)`, and the full method list, which is where `OfVirtual`'s omission of it shows
> up)
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.Builder.OfPlatform.html)
> and
> [OfVirtual](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.Builder.OfVirtual.html));
> the **JDK 25 `java` tool reference** for `-Xss` and `-XX:ThreadStackSize`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)); and the
> OpenJDK `jdk-25+36` source `src/hotspot/share/runtime/globals.hpp` (`VMThreadStackSize`,
> `CompilerThreadStackSize`, both declared `product_pd`).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[06d](06d-the-thread-count-arithmetic.md) gave the product; this chunk gives the levers, in the
order you should actually pull them. `-Xss` is the lever everyone reaches for and the worst one
available, because it multiplies across every thread in the process. There is a per-thread
alternative that most people do not know exists, a pair of flags for the JVM's own threads that
your budget probably forgot, and one change that reduces memory, scheduling cost and latency
variance at the same time: running fewer threads.**

## Sizing one thread instead of all of them

`-Xss` is global. If exactly one thread needs a deep stack, size that thread rather than inflating
every thread in the process:

```java
Thread parser = Thread.ofPlatform()
        .name("deep-parser")
        .stackSize(8L * 1024 * 1024)          // 8 MB, for this thread only
        .unstarted(() -> parse(document));
parser.start();
```

The javadoc promises very little, and you should read it exactly as written:

> *"Sets the desired stack size. The stack size is the approximate number of bytes of address
> space that the Java virtual machine is to allocate for the thread's stack. **The effect is
> highly platform dependent and the Java virtual machine is free to treat the `stackSize`
> parameter as a "suggestion".** If the value is unreasonably low for the platform then a platform
> specific minimum may be used. If the value is unreasonably high then a platform specific maximum
> may be used. A value of zero is always ignored."*

If the deep work is pool-shaped rather than one-off, give the pool its own thread factory:

```java
ThreadFactory deepStackFactory = Thread.ofPlatform()
        .name("xml-worker-", 0)
        .stackSize(4L * 1024 * 1024)
        .factory();

ExecutorService xmlPool = Executors.newFixedThreadPool(4, deepStackFactory);
```

Four threads at 4 MB is 16 MB of reserved address space. Setting `-Xss4m` globally on a service
with 400 threads is 1.6 GB. The gap between those two numbers is the whole argument for the
factory, and the reason a global `-Xss` bump is the most expensive way to serve one deep call
path. The same escape hatch does **not** exist for virtual threads — `Thread.Builder.OfVirtual`
has no `stackSize` method, as [06b](06b-virtual-thread-stacks.md) covers.

## Threads the JVM creates for itself have their own flags

`-Xss` sizes *Java* threads. The JVM's internal threads are sized separately, and both flags are
platform-defaulted in the same way:

```cpp
product_pd(intx, VMThreadStackSize,
        "Non-Java Thread Stack Size (in Kbytes)")

product_pd(intx, CompilerThreadStackSize,
        "Compiler Thread Stack Size (in Kbytes)")
```

`-XX:VMThreadStackSize` covers the VM thread, the GC worker threads and the service threads;
`-XX:CompilerThreadStackSize` covers the C1 and C2 compiler threads, which need deep stacks
because C2's parsing and inlining are themselves recursive. A budget built only from
`-Xss × Java threads` therefore systematically under-counts, and the under-count grows with the
GC's worker count — which is derived from the processor count, so it also grows when someone
raises the container's CPU limit.

## Reducing the product, in order of preference

1. **Reduce the thread count.** A 200-thread Tomcat pool serving a workload that never exceeds 40
   concurrent requests is 160 stacks of pure overhead — and 160 more entries in every scheduler
   decision. This is the only change on this list that reduces memory, context-switch cost and
   latency variance together.
2. **Move to virtual threads** where the workload is I/O-bound thread-per-request. That replaces
   `requests × -Xss` with `carriers × -Xss` plus heap-resident stack chunks —
   [06b](06b-virtual-thread-stacks.md) and [06c](06c-carriers-mounting-and-pinning.md).
3. **Size the one deep thread**, using the builder above, rather than the whole process.
4. **Lower `-Xss`**, last, and only after measuring committed rather than reserved. It reduces
   address space reliably, reduces RSS only if the threads were actually deep, and lowers the
   depth at which every thread in the process overflows.

The ordering is not arbitrary. Steps 1 and 2 change the *multiplier*, which is where the leverage
is; steps 3 and 4 change the *multiplicand*, which is bounded by how small a stack the JVM will
accept. A pool halved from 200 to 100 saves as much as `-Xss` halved from 1m to 512k and costs
nothing in stack depth.

### What "reduce the thread count" looks like in a Spring Boot service

```properties
# Sized to observed concurrency, not to the framework default of 200.
server.tomcat.threads.max=50
server.tomcat.threads.min-spare=10

# A pool is only as useful as the database behind it: a Hikari pool larger than the
# database's own connection budget queues in a second place instead of the first.
spring.datasource.hikari.maximum-pool-size=10

spring.task.execution.pool.max-size=8
spring.task.scheduling.pool.size=2
```

The failure mode being avoided here is not memory alone. An oversized worker pool converts a
downstream slowdown into a thundering herd: 200 threads all blocked on the same slow dependency,
200 stacks resident, and a queue that has moved from the acceptor — where it is visible and
bounded — into the thread pool, where it is neither.

## Gotchas

**★ A budget built from `-Xss × Java threads` under-counts by the JVM's own threads.**
GC workers, the VM thread and service threads use `-XX:VMThreadStackSize`; C1 and C2 use
`-XX:CompilerThreadStackSize`. Both are platform-defaulted and neither moves when you set `-Xss`.
The GC worker count scales with the processor count, so this term grows when the container's CPU
limit does.

**★ Lowering `-Xss` to fit more threads lowers the overflow depth for every thread.**
It is a global trade. A service comfortable at `-Xss1m` and moved to `-Xss256k` to double its
thread count will start throwing `StackOverflowError` in its deepest framework path — which, in
practice, is usually an error-handling path that only runs in production.

**★ `stackSize` is a suggestion, in the builder and in the `Thread` constructor alike.**
The javadoc says the JVM *"is free to treat the `stackSize` parameter as a 'suggestion'"*, that
unreasonably low values may be raised to a platform minimum, that unreasonably high values may be
clamped to a platform maximum, and that zero is always ignored. There is no API that reports the
size you actually got, so never write a test that asserts on it.

**★ Virtual threads have no per-thread size, so the targeted lever disappears.**
`Thread.Builder.OfVirtual` declares only `name`, `inheritInheritableThreadLocals` and
`uncaughtExceptionHandler`. On a virtual-thread service the only stack-depth knob is the global
`-Xss`, which makes "rewrite the recursion" a more important tool than it was.

**★ Shrinking `-XX:CompilerThreadStackSize` to save memory can crash the JIT.**
C2's parser and inliner recurse on the structure of the method being compiled. There are only a
handful of compiler threads, so the saving is negligible and the failure — a fatal error report
naming a compiler thread while compiling one large method — is spectacular and intermittent.

**★ A thread pool sized larger than the resource behind it just moves the queue.**
A 200-thread worker pool in front of a 10-connection database gives you 190 threads parked on the
pool's own queue, each holding a stack and a request's worth of retained objects. Sizing the pool
to the bottleneck makes the backlog visible at the front door, where you can shed it.

**★ Non-daemon threads keep the JVM alive and keep their stacks allocated.**
`Thread.ofPlatform()` produces non-daemon threads by default. A pool that is never closed neither
releases its stacks nor lets the process exit; if you build threads by hand for a background task,
`.daemon()` on the builder is usually what you meant.

**★ Naming your threads is a memory tool, not a cosmetic one.**
`Thread.ofPlatform().name("xml-worker-", 0)` gives every thread in the pool a common prefix, which
is what makes a thread dump groupable and a leak countable. Unnamed pools show up as
`pool-N-thread-M` with no indication of which component created them, and identifying the culprit
then means reading stack traces instead of counting names.

## Interview questions

**★ How would you estimate a JVM's total memory footprint before deploying it?**
Sum the regions rather than quoting `-Xmx`: heap, metaspace and compressed class space, the code
cache, GC-internal structures, direct and mapped buffers, and thread stacks — thread count times
`-Xss`, plus the JVM's own threads at `-XX:VMThreadStackSize` and `-XX:CompilerThreadStackSize`,
plus the native allocator's overhead. The thread-stack term is the one people omit, because it is
the only one whose multiplier lives outside the JVM. Then verify rather than trust the sum: Native
Memory Tracking reports reserved and committed per category, and the gap between NMT's total and
the process RSS is itself a diagnosis.

**★ How do you give one code path a bigger stack without paying for it on every thread?**
Create that thread with `Thread.ofPlatform().stackSize(n)`, or build a small pool from that
builder's `factory()` and hand it to `Executors.newFixedThreadPool`. Four threads at 4 MB is 16 MB;
`-Xss4m` on a 400-thread service is 1.6 GB. The javadoc is explicit that the value is a
platform-dependent *suggestion* and that zero is ignored, so treat it as a hint that usually works
rather than a guarantee — and note there is no equivalent for virtual threads, because
`Thread.Builder.OfVirtual` has no `stackSize` method at all.

**★ Why does HotSpot need separate flags for compiler and VM thread stacks?**
Because those threads run C++ code whose recursion has nothing to do with your application. C2's
parser and inliner recurse on the shape of the method being compiled, so compiler threads need
generous stacks regardless of `-Xss`; the VM thread, GC workers and service threads have their own
requirements. Keeping them on `-XX:CompilerThreadStackSize` and `-XX:VMThreadStackSize` means an
application tuning `-Xss` down to fit thousands of threads does not accidentally break the JIT. The
corollary for capacity planning is that a budget computed only from `-Xss` is systematically too
low, by an amount that grows with the processor count.

**★ Your service is memory-constrained and thread-heavy. Rank the changes you would make.**
Reduce the thread count first — it is the multiplier, and it improves scheduling and tail latency
as well as memory. Then consider virtual threads if the work is I/O-bound thread-per-request, which
converts the per-request native stack into a heap-resident stack chunk that `-Xmx` bounds and the
GC can reclaim. Then size the specific deep threads individually. Only then lower `-Xss`, and only
after confirming with NMT that the committed figure — not just the reserved arithmetic — actually
falls, because on shallow stacks it will not.

**★ A team lowers `-Xss` to 256k in production and three weeks later gets `StackOverflowError` in
an exception handler. Explain.**
`-Xss` is a global ceiling on depth, and the deepest call path in a service is rarely the happy
path. Error handling, serialisation of a deeply nested object graph, a stack-trace-building
exception constructor and a validation framework walking a recursive schema are all deeper than
normal request handling and all run rarely, so they are the last thing to be exercised at the new
setting. The general lesson is that a `-Xss` reduction is only safe if you have exercised the
deepest path you have, and you usually do not know which one that is.

{/* FOOTER */}
