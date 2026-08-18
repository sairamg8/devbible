---
title: "What a thread costs"
sidebar_label: "1 · What a thread costs"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JEP 444 (goals, motivation and
> implementation sections), the JDK 25 Javadoc for `java.lang.Thread`
> (platform/virtual distinction, scheduler notes) and the `java` launcher
> reference (`-Xss`), and the JDK 25 Core Libraries virtual-threads guide.

**Every `Thread` before JDK 21 was a *platform thread*: created 1:1 over an
OS thread, holding a contiguous stack the OS reserves up front, scheduled
by the kernel. That 1:1 binding is what made threads a scarce resource —
and scarcity, not complexity, is what shaped classic server Java: pools,
sharing, and the async detour all exist because threads were too expensive
to use one-per-task. Virtual threads attack the cost directly: the stack
moves to the heap, the scheduling moves into the JVM, and the OS thread is
borrowed only while the thread is actually running.**

## The platform thread bill

Three costs, all consequences of 1:1 OS binding:

- **Memory reserved per thread.** Each platform thread gets a
  fixed-maximum contiguous stack (the `-Xss` launcher option; the default
  is platform-dependent, on the order of a megabyte on mainstream 64-bit
  systems). Reserve is not all resident, but address space, guard pages
  and kernel bookkeeping scale linearly with thread count.
- **Creation and teardown are syscalls.** Starting a platform thread asks
  the kernel to create a schedulable entity. It is expensive enough that
  the JDK's own advice for decades was: create them at startup, reuse
  forever — the thread pool.
- **The kernel schedules them.** Context switches traverse the kernel;
  tens of thousands of runnable OS threads degrade the scheduler itself.
  In practice a JVM holds platform threads to the low thousands.

The consequence JEP 444 opens with: a server doing thread-per-request
saturates its *thread count* long before CPU or bandwidth. The hardware is
idle; the thread ledger is full.

## What the industry did about it — and the tax

Two workarounds, both taxed:

- **Share threads through pools** ([topic 06](../06-executorservice-pools/README.md)): a
  request *borrows* a worker for each processing step. But a borrowed
  thread blocked on a database call is still consumed — pool capacity, not
  request count, becomes the throughput ceiling the moment latency rises
  anywhere downstream.
- **Go asynchronous**: never block; express the continuation as callbacks
  or `CompletableFuture` chains ([topic 07](../07-completablefuture/README.md)). The
  thread bill drops; the tax moves into the code — stack traces stop
  describing the request, debuggers and profilers see event loops instead
  of tasks, and every library in the path must speak async too.

Virtual threads exist to delete the dilemma: keep the *code* synchronous,
make the *thread* cheap.

## The virtual thread model

A virtual thread is still a `java.lang.Thread` — same API, same
`Thread.currentThread()`, same interruption protocol. The implementation
differs in three linked ways:

1. **Its stack lives on the heap**, as resizable segments rather than a
   contiguous OS reservation. A virtual thread starts with a shallow stack
   and grows/shrinks as it runs — memory tracks *actual* depth, so
   idle-shallow threads cost little, and millions are feasible.
2. **It runs by *mounting* a carrier.** The JDK keeps a small scheduler
   pool of platform threads — the *carriers* (a `ForkJoinPool` in FIFO
   mode; parallelism defaults to the number of available processors).
   Executing a virtual thread means mounting it on a carrier; the carrier
   runs its frames like any code.
3. **Blocking unmounts.** When a mounted virtual thread hits a blocking
   operation in the JDK — `Socket` read, `queue.take()`, `sleep`,
   `Future.get` — the runtime parks the *virtual* thread: its stack
   segments stay on the heap, the carrier is released to run another
   virtual thread, and no OS thread waits. When the I/O completes or the
   lock frees, the thread becomes runnable and mounts again — possibly on
   a *different* carrier.

The blocked-thread cost inversion is the entire feature: a blocked
platform thread holds an OS thread hostage; a blocked virtual thread holds
only heap memory. JEP 444 states the resulting law directly — virtual
threads make blocking cheap, so code can afford to block *per task*.

```java
// The demonstration shape from JEP 444: submit far more concurrent
// blocking tasks than any OS could hold as native threads.
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    IntStream.range(0, 100_000).forEach(i ->
        executor.submit(() -> {
            Thread.sleep(Duration.ofSeconds(1));   // parks the VIRTUAL thread only
            return fetchQuote(i);                  // plain blocking call
        }));
}   // close() waits for all tasks — 100k threads, a handful of carriers
```

On platform threads this needs a 100,000-thread pool nobody can run. On
virtual threads it needs heap for 100,000 shallow stacks and roughly
one carrier per core.

## Where the model shows through

Cheap has edges — places the abstraction is visibly not a platform thread:

- **Mounting isn't free, it's just cheap.** The carrier switch is a JVM
  operation, far cheaper than an OS context switch — but a task that
  blocks millions of times per second still pays it millions of times.
- **Some operations don't unmount.** Native frames (JNI/FFM) on the stack
  prevent unmounting, and *file* I/O on many platforms blocks in the
  kernel where the JVM can't intercept — the runtime may compensate by
  temporarily growing the carrier pool. `synchronized` used to pin the
  carrier too; JEP 491 removed that in JDK 24
  ([chunk 3](03-using-them-well.md) has the practical rules, the deep
  dive is [topic 14](../14-virtual-thread-pinning.md)).
- **The scheduler is not the kernel.** Carriers are scheduled
  cooperatively among virtual threads at blocking points; there is no
  time-slicing between virtual threads. A virtual thread that neither
  blocks nor yields occupies its carrier for the duration — CPU-bound
  work gains nothing and can crowd the carrier pool
  ([chunk 2](02-what-changed-what-didnt.md)).
- **Thread identity habits break.** Virtual threads are always daemons,
  have no permanent OS identity, and by default an empty name — tooling
  that keyed on "thread = long-lived worker with a name" needs the task,
  not the thread, as its unit ([chunk 2](02-what-changed-what-didnt.md)).

## Gotchas

**Symptom:** capacity math done as `threads × stack-size` predicts your virtual-thread service can't fit in memory — but it runs fine
**Cause:** the arithmetic assumed platform-style reserved contiguous stacks; virtual stacks are heap segments sized by actual depth
**Fix:** measure heap under load instead; deep recursion and fat frames — not thread count — are what make virtual threads expensive

**Symptom:** creating platform threads per request "works" in the load test, collapses in production
**Cause:** the test peaked below the OS thread ceiling; production didn't — 1:1 threads exhaust kernel limits before CPU
**Fix:** platform threads are pooled or counted deliberately; per-task creation is exactly the pattern reserved for virtual threads

**Symptom:** a virtual thread's stack trace shows the same task on different carrier threads at different moments; a log's "thread id" analysis makes no sense
**Cause:** unmount/remount may resume the virtual thread on a different carrier — carrier identity is an implementation detail
**Fix:** log the *virtual* thread (it is the `Thread.currentThread()`) or better a task/request id; never key logic or logs on carriers

**Symptom:** heavy `Thread.sleep`-based rate limiting across a million virtual threads shows scheduler overhead, not the expected idleness
**Cause:** every wake is a mount; a million timed wakes per tick is a million carrier switches
**Fix:** cheap ≠ free — coarsen wake granularity, or centralize timing in fewer coordinating threads

**Symptom:** virtual-thread service stalls hard while a batch job hammers `synchronized`-heavy legacy code — on JDK 21
**Cause:** pre-JDK 24, blocking inside `synchronized` pinned the carrier; enough pinned carriers starves every other virtual thread
**Fix:** run JDK 24+ (JEP 491 removes synchronized pinning); on 21, that hot path needed `ReentrantLock` — the migration detail lives in [chunk 3](03-using-them-well.md)

## Interview questions

**★ Why can a JVM run millions of virtual threads but only thousands of platform threads?**
Platform threads bind 1:1 to OS threads: reserved contiguous stacks,
syscall creation, kernel scheduling — all linear in thread count and
capped by the kernel. Virtual threads keep their stacks on the heap as
resizable segments and only occupy one of a small carrier pool while
actually executing; a blocked virtual thread consumes heap only, so the
count is bounded by memory, not by the OS.

**★ Walk through what happens when a virtual thread calls a blocking socket read.**
The JDK's I/O implementation detects the virtual-thread context, registers
interest for the socket, and *parks* the virtual thread: its stack stays
on the heap, and its carrier is freed to mount another virtual thread —
no OS thread blocks. When data arrives, the virtual thread is scheduled
and mounts a carrier (not necessarily the previous one) and the read
returns. To the code it was an ordinary blocking call.

**★ What is a carrier thread, and how many are there?**
An ordinary platform thread owned by the virtual-thread scheduler — a
FIFO `ForkJoinPool` sized by default to the number of available
processors. Carriers execute mounted virtual threads; the pool can grow
temporarily to compensate for operations that block a carrier without
unmounting (e.g. certain file I/O).

**★ Why did thread pools become the universal server pattern, and which premise did virtual threads remove?**
Pools amortize the platform thread's creation cost and cap its count —
both consequences of 1:1 OS binding. Virtual threads remove the premise:
creation is cheap and count is nearly unbounded, so the amortization
buys nothing and the cap moves to where it belongs — explicit limits on
*work in flight*, not on threads.

**★ Name situations where a virtual thread does NOT release its carrier while blocked.**
Native frames on the stack (JNI / foreign functions) prevent unmounting;
file I/O commonly blocks in the kernel (the scheduler may grow the
carrier pool to compensate); and on JDK 21–23, blocking inside a
`synchronized` block or method pinned the carrier — eliminated by JEP 491
in JDK 24. Interruptible blocking in the `java.util.concurrent` and
networking stacks unmounts cleanly.

**★ "Virtual threads are green threads / async-await under the hood" — correct the comparison.**
Unlike 1990s green threads, virtual threads run across *multiple* carrier
OS threads in parallel and integrate with the JDK's blocking APIs rather
than replacing them. Unlike async/await, there is no language-level split
between sync and async functions — the *same* blocking code runs on both
thread kinds, and the suspension points are inside the JDK, invisible to
the programmer. The continuation-parking machinery is comparable; the
programming model is not.

---

← Prev: [Topic index](README.md) · Next → [What changed, what didn't](02-what-changed-what-didnt.md)
