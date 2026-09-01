---
title: "The Troubleshooting Guide's first sentence about Java heap space is that it \"does not necessarily imply a memory leak\", and the failure to take that seriously is why teams spend days hunting a retention bug in a service that simply needs more memory than it was given"
sidebar_label: "06 · When it is not a leak"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 Troubleshooting Guide**, "Understand the
> OutOfMemoryError Exception" and "Detecting a Memory Leak"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshooting-memory-leaks.html)),
> and the **HotSpot Garbage Collection Tuning Guide, Release 25** for the weak generational
> hypothesis and soft-reference policy
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/)).
> **No sandbox** — no heap figure below is measured; the arithmetic shown is arithmetic.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**The guide leads with it: *"This error does not necessarily imply a memory leak. The problem can be
as simple as a configuration issue, where the specified heap size (or the default size, if it is not
specified) is insufficient for the application."* Half the `OutOfMemoryError`s in production are
that sentence, and the half that are not look identical in a single heap dump. Before spending a day
in a dominator tree, it is worth ten minutes establishing which one you have — because the two have
nothing in common except the message.**

## The one discriminator

> *"For detecting memory leaks, it is important to monitor the live set of the application that is,
> the amount of Java heap space or Metaspace being used **after a full garbage collection**. If the
> live set increases over time **after the application has reached a stable state and is under a
> stable load**, that could be a strong indication of a memory leak."*

Three conditions, all load-bearing:

**After a full collection.** Heap *utilisation* rises and falls constantly — that is a collector
doing its job. Only the post-collection figure is the working set.

**After the application has reached a stable state.** Warm-up legitimately grows the live set for
minutes: JIT profiles, class loading, connection pools filling, caches priming, framework metadata.
A live set measured during warm-up rises for reasons that are not a bug.

**Under a stable load.** A live set that rises with traffic is a working set. It is only a leak if
it rises while traffic does not.

```bash
# the whole test, and it costs nothing to have been running
-Xlog:gc*:file=/var/log/gc.log:uptime,level,tags:filecount=5,filesize=20M
```

The GC log after a full collection is the measurement. `jcmd <pid> GC.heap_info` is the same
question asked at one instant.

| Post-collection live set over hours, at constant load | Diagnosis |
|---|---|
| flat, well below `-Xmx` | Heap is fine. The failure is elsewhere or was a spike. |
| flat, just below `-Xmx` | **Under-sized heap.** Not a leak. Give it more, or reduce the working set. |
| ratcheting upward, never returning | **A leak.** Take the dump. |
| sawtooth with a rising floor | A leak plus normal churn. Look at the floor, not the peaks. |

## Five things that are not leaks

### 1 · A working set that is genuinely larger than the heap

The classic form is a batch job or report that loads a whole result set:

```java
List<Order> all = repository.findAll();          // 4 million rows, each with a lazy graph
```

Nothing is retained after the method returns. The heap simply cannot hold what one operation
demands. The fix is streaming, paging or a cursor — not a bigger heap, which only raises the row
count at which it fails.

```java
try (Stream<Order> orders = repository.streamAll()) {
    orders.forEach(this::process);               // bounded memory, unbounded input
}
```

⚠️ Streaming from a database is only bounded if the *driver* streams. A JDBC driver that
materialises the whole result set before returning it makes `Stream` a lie, and the fix is the
driver's fetch-size or cursor configuration rather than the Java code.

### 2 · A load spike

Concurrency times per-request footprint is a multiplication, and both factors move. Two hundred
concurrent requests each holding a five-megabyte deserialised payload is a gigabyte that exists for
as long as the slowest one takes. The live set after collection returns to normal afterwards, so
this is invisible in any measurement taken later.

The tell is correlation: the `OutOfMemoryError` timestamp lines up with a traffic peak, a batch
window, a retry storm or a downstream slowdown that raised concurrency. The fixes are all about
bounding concurrency — a bounded queue, a semaphore, a request size limit, a connection-pool cap —
rather than about memory.

### 3 · A query or a payload that grew

Yesterday's `findByStatus` returned two hundred rows; today an upstream change means it returns two
hundred thousand. Nothing in your code changed and nothing is retained. The same shape appears with
an API response that gained a field, a file upload limit that was raised, or a batch size that was
tuned upward by someone optimising throughput.

This is the case where the OOM stack trace is unusually useful, because the frame that failed is
genuinely close to the operation that grew.

### 4 · A cache doing exactly what it was told

A cache sized for a heap that was later reduced, or sized in entries when the entries got bigger, is
not leaking — it is full, which is its correct terminal state. The distinguishing feature is that
the live set is flat: it rose to the configured bound and stopped.

⚠️ A `SoftReference`-based cache is a special case worth knowing. The tuning guide:

> *"The rate of clearing can be controlled with the command-line option
> `-XX:SoftRefLRUPolicyMSPerMB=<N>`, which specifies the number of milliseconds (ms) a soft
> reference will be kept alive (once it is no longer strongly reachable) for each megabyte of free
> space in the heap. The default value is 1000 ms per megabyte."*

and:

> *"the value of the `-Xmx` option has a significant effect on how quickly soft references are
> garbage collected."*

🔴 **So a soft cache grows to fill whatever heap you give it, by design.** Raising `-Xmx` makes it
hold more and clear later. Heap usage that tracks `-Xmx` exactly, whatever you set it to, is a soft
cache doing its job and is not a leak — and it will still throw `OutOfMemoryError` if the collector
cannot clear references fast enough during a burst.

### 5 · Warm-up that has not finished

A JVM's live set legitimately grows for a long time after start: classes load lazily, JIT profiles
and compiled code accumulate, connection pools grow to their configured maximum on demand,
framework caches populate per first-use. A dashboard showing "memory climbing since deploy" over
the first fifteen minutes is showing a JVM starting up.

## The trap in the other direction

None of this means "assume it is not a leak". The failure mode of over-applying this chunk is a
service restarted nightly for two years with a genuine retention bug that nobody investigated
because "it just needs a big heap". The measurement is what decides, not the prior.

🔴 **And there is a specific reason a leak can masquerade as under-sizing for a long time: a leak
that plateaus.** A bounded-but-too-large cache, or a leak whose key space is finite (per-tenant,
per-endpoint, per-day), rises and then flattens — at a level above what the heap can hold. It fails
the "ratcheting" test and is still a bug.

## Deciding, in order

1. **Read the message.** Only three of the nine are about the heap at all
   ([02e](02e-the-message-decides-the-fix.md)).
2. **Plot post-collection live set against time,** from the GC log, across several load cycles.
3. **Plot it against traffic.** Rising with load is a working set; rising without is retention.
4. **Check whether it plateaus.** Plateauing above `-Xmx` is a sizing decision; plateauing below it
   and still failing means a spike.
5. **Correlate the failure timestamp** with deploys, traffic peaks, batch windows and upstream
   changes.
6. **Only then take the dump.**

Steps 1 to 5 use data you either already have or will never have, which is the argument for
permanent GC logging made in [`../01-memory-layout/12-the-checklist.md`](../01-memory-layout/12-the-checklist.md).

## Gotchas

**★ The guide's own first sentence about `Java heap space` is that it may not be a leak.**
*"This error does not necessarily imply a memory leak."* It is the most-skipped sentence in the
document and the one that would save the most time.

**★ Heap utilisation is not the live set, and dashboards show utilisation.**
A heap that sawtooths to 95 percent and back is healthy. Alerting on utilisation pages you for
correct behaviour and stays silent for a slow leak whose peaks have not yet changed.

**★ A live set measured during warm-up is meaningless.**
Class loading, JIT compilation, pool growth and cache priming all legitimately raise it for the
first minutes. Take the baseline after the application has reached a stable state, which is the
guide's own qualifier.

**★ A leak that plateaus passes the "is it ratcheting" test and is still a leak.**
Per-tenant, per-endpoint and per-day key spaces are finite, so the growth flattens — above what the
heap can hold. Flatness is only reassuring if the plateau is comfortably below `-Xmx`.

**★ A `SoftReference` cache grows to fill whatever heap you give it.**
`SoftRefLRUPolicyMSPerMB` defaults to 1000 ms per free megabyte, and the tuning guide says `-Xmx`
*"has a significant effect on how quickly soft references are garbage collected"*. Heap usage that
tracks `-Xmx` at every setting is that mechanism, not a bug — and it can still OOM under a burst.

**★ Streaming a query is only bounded if the driver streams.**
`Stream<T>` from a repository looks like constant memory and is not, if the JDBC driver materialises
the result set first. The fix is fetch size or a cursor at the driver level; the Java code is
already correct.

**★ A spike leaves no evidence in a measurement taken afterwards.**
By the time you look, the live set is back to normal and everything appears healthy. Correlating the
failure timestamp with traffic is the only way to see it, and that requires having recorded both.

**★ "Add heap" and "it is not a leak" are different conclusions.**
A working set larger than the heap can be fixed by more heap *or* by making the operation stream.
In a container the first takes memory from every native region and raises the direct-memory ceiling
with it, so the second is usually the better answer even when the first would work.

**★ Restarting nightly makes every one of these look identical.**
A scheduled restart resolves an under-sized heap, a slow leak, a soft cache and a spike, and
diagnoses none of them. It is a legitimate stopgap and it should be recorded as one, with a date,
rather than closed as resolved.

## Interview questions

**★ How do you decide whether an `OutOfMemoryError: Java heap space` is a leak?**
By measuring the live set — heap used after a full collection — over time, under stable load, after
warm-up has finished. All three qualifiers come from the Troubleshooting Guide and all three matter:
utilisation between collections tells you nothing, warm-up legitimately grows the live set, and
growth that tracks traffic is a working set rather than retention. If the post-collection figure is
flat, the heap is correctly reflecting a working set that is simply too large for `-Xmx`, and the
fix is sizing or streaming. If it ratchets upward at constant load and never returns, it is
retention and a dump will name it. The measurement takes hours of history, which is why the real
answer is "because GC logging was already on".

**★ A service is restarted nightly and never OOMs. Is there a problem?**
Unknown, and that is the problem. A nightly restart resolves an under-sized heap, a slow leak, a
soft-reference cache filling its allowance and an occasional load spike, all identically, and
distinguishes none of them. It is a legitimate way to buy time and an illegitimate way to close a
ticket. The way to find out is to let one instance run past the restart window with GC logging on
and watch the post-collection live set: flat means sizing, ratcheting means a leak. Until that
measurement exists, "we restart it nightly" is a statement about the schedule, not about the
service.

**★ Your heap usage graph rises to almost exactly `-Xmx` no matter what you set `-Xmx` to. What is
happening?** Almost certainly a `SoftReference`-based cache. The tuning guide explains the mechanism:
`SoftRefLRUPolicyMSPerMB` keeps a softly reachable object alive for a number of milliseconds per
megabyte of free heap — a default of one second per free megabyte — and it notes that *"the value of
the `-Xmx` option has a significant effect on how quickly soft references are garbage collected"*.
So the cache expands to consume the headroom you give it and clears later when there is more. That
is the design working, not a leak. It also means the cache offers no protection against a burst that
allocates faster than references can be cleared, which is how a soft cache still produces an
`OutOfMemoryError`.

**★ What kind of leak passes the "is the live set ratcheting" test?**
One with a finite key space. Cache entries keyed by tenant, by endpoint, by day or by any bounded
dimension grow until the dimension is exhausted and then flatten — which looks exactly like a large
working set, except that the plateau is above what the heap can hold. The refinement to the test is
therefore to ask not only "is it flat" but "is it flat at a level that leaves comfortable headroom".
A plateau at 97 percent of `-Xmx` is not reassuring regardless of its flatness, and the dominator
tree will show a container whose contents nobody intended to keep permanently.

**★ You have an OOM and no history at all. What can you still do?**
Read the detail message, which is free and eliminates most of the possibilities. Correlate the
timestamp with the deploy log, the traffic graph and any batch schedule, since a failure that lines
up with a peak or a release is a different investigation from one at three in the morning under no
load. Look for a heap dump, because if `HeapDumpOnOutOfMemoryError` was set the JVM wrote exactly
one and it belongs to the first failure. And then fix the absence: permanent rotated GC logging, a
`HeapDumpPath` on a real volume, and `-XX:+ExitOnOutOfMemoryError` so the next occurrence is clean —
because the honest answer is that most of what you needed had to have been recorded before you were
paged.

{/* FOOTER */}
