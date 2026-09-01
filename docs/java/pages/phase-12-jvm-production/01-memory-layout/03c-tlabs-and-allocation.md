---
title: "Allocating an object in Java is a comparison and an addition on a pointer the thread owns privately, which is why `new` costs less than most method calls and why the object pools people write to avoid allocation are usually slower than allocating"
sidebar_label: "03c · TLABs and allocation"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference** for `-XX:-UseTLAB` and
> `-Xlog`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> the **HotSpot Virtual Machine Garbage Collection Tuning Guide, Release 25**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/)),
> and the JDK 25 HotSpot source at tag `jdk-25+36` —
> `src/hotspot/share/gc/shared/threadLocalAllocBuffer.inline.hpp` and
> `threadLocalAllocBuffer.cpp`
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/threadLocalAllocBuffer.inline.hpp)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Eden is shared by every thread in the process, and yet allocation involves no lock, no
compare-and-swap and no free list. The mechanism is the thread-local allocation buffer: each
thread is handed a private slice of eden and allocates inside it by moving a pointer. This page
is that mechanism and its three tiers of cost. The flags that size it — and the one everybody
cites that does not exist — are
[03c2 · TLAB sizing and the flags](03c2-tlab-sizing-and-the-flags.md).**

## The problem TLABs solve

Eden is one contiguous region. Allocation is "take the next N bytes". With a hundred threads
doing that concurrently, the naive implementation is an atomic compare-and-swap on a shared
bump pointer for every single `new`.

That would work, and it would be a disaster. Every allocation would be a contended atomic
write to one cache line shared by every core in the machine — the worst access pattern modern
hardware has. Allocation is the single most frequent operation a typical Java program performs;
putting a contended CAS in it would make object creation scale *negatively* with core count,
so adding cores would make the application slower.

The fix is to make the common case private. **Each thread reserves a chunk of eden in advance
— one CAS — and then allocates inside that chunk with no synchronisation at all**, because
nobody else can see it. Synchronisation happens once per buffer instead of once per object.

## Pointer-bump allocation, in eight lines

The fast path is `ThreadLocalAllocBuffer::allocate`, in
`threadLocalAllocBuffer.inline.hpp`, verbatim:

```cpp
inline HeapWord* ThreadLocalAllocBuffer::allocate(size_t size) {
  invariants();
  HeapWord* obj = top();
  if (pointer_delta(end(), obj) >= size) {
    // successful thread-local allocation
    ...
    set_top(obj + size);
    invariants();
    return obj;
  }
  return nullptr;
}
```

That is the entire cost of a successful allocation: **read a pointer, compare it against the
buffer's end, add the size, store it back.** No lock. No atomic. No free-list search. No
coalescing. No size classes. The JIT inlines this directly into the calling method, so a `new`
that fits in the current TLAB compiles down to a handful of instructions and a bounds check.

This is the answer to "why is allocation in Java cheaper than `malloc`". `malloc` must search a
size-class free list, handle fragmentation, and synchronise against other threads on shared
arenas. A copying-collector heap has **no fragmentation to handle** — the collector compacts by
construction, so free space is always one contiguous run — which means the allocator can be a
pointer rather than a data structure.

⚠️ **`return nullptr` is the interesting branch.** It means the object does not fit in what is
left of this thread's buffer, and that is where all the cost lives.

## What "does not fit" costs

When the fast path fails there are two possible outcomes, and they are very different.

**A refill.** The thread retires its remaining buffer space — the tail becomes unusable waste
until the next young collection — takes a fresh TLAB from eden (this one *is* an atomic
operation on the shared eden pointer), and retries the bump. This is cheap and happens
continuously. It is normal steady-state behaviour, not a problem to be tuned away.

**A slow-path allocation.** If the object is too large to justify handing the thread a whole
new buffer, it is allocated directly in eden, outside any TLAB, with exactly the shared-pointer
synchronisation the TLAB was invented to avoid. Objects larger still may be allocated straight
into the old generation, and under G1 an object exceeding half a region becomes a *humongous*
allocation with its own placement rules and its own collection costs.

So there are three tiers of allocation cost, and code-review intuition should track them:

| Path | Cost | When |
|---|---|---|
| **TLAB bump** | A compare and an add, inlined into the caller | The overwhelming majority of allocations |
| **TLAB refill** | One atomic on eden, plus the wasted tail | Once per TLAB-worth of allocation per thread |
| **Slow path / direct eden** | Shared synchronisation; possibly straight to old gen or humongous | Objects too big for a buffer |

The practical consequence: **"allocation is a pointer bump" is a statement about the first
row.** It is true of the objects you allocate by the million and false of the 2 MB `byte[]` —
which is precisely the allocation somebody is asking about when they come to you worried about
allocation cost.

## What this means for "avoid allocation" advice

The fast path is cheap enough that the usual mitigations are frequently net losses.

**Object pools** replace a compare-and-add with a data structure that must be thread-safe,
must be checked for correctness on borrow and return, and — worst of all — keeps objects alive.
A pooled object is by construction *not* short-lived, so it violates the hypothesis in
[03b](03b-the-weak-generational-hypothesis.md), gets promoted to the old generation, and
converts cheap young-generation garbage into expensive old-generation garbage. Pools are
justified when the object is expensive to *construct* (a connection, a thread, a large
pre-computed buffer), never when it is merely expensive to imagine allocating.

**Reusing a mutable object across calls** trades an allocation for a lifetime you now have to
reason about, and for a field that keeps a reference alive between requests. That is a memory
leak with extra steps unless the reuse is genuinely scoped.

What *does* help is allocating **less**, not allocating **cleverly**: streaming instead of
materialising an intermediate `List`, avoiding boxed types in hot loops, not building a string
you immediately discard. That reduces pressure on eden and on collection frequency, which is a
real effect, and it does not require you to out-engineer the allocator.

## Why an allocation page sits in a memory-layout topic

Because allocation decides *where* an object lands, and "where" is what this topic is about.
An object that fits a TLAB is in eden, in a thread-private slice, and will die there if the
hypothesis in [03b](03b-the-weak-generational-hypothesis.md) holds. An object that does not fit
may never be in eden at all. The heap map in [02](02-the-process-map.md) tells you the regions
exist; this page is how an object gets into one.

## Gotchas

**★ A large object does not get a TLAB at all.**
It goes through the slow path into shared eden, or directly to the old generation, or becomes a
G1 humongous allocation. The pointer-bump story does not describe it. Any measurement of
"allocation cost" that uses large arrays is measuring the third row of the table, not the
first.

**★ Escape analysis may mean there is no allocation to make cheap.**
If a JIT-compiled method proves an object cannot escape, it can scalar-replace it — the object
is never created and no TLAB is touched. This is why allocation microbenchmarks are so
unreliable: the thing being timed may have been deleted by the compiler, which is also why JMH
has `Blackhole` (topic 14 owns that).

**★ TLAB tail waste is deliberate and budgeted.**
Seeing wasted bytes in TLAB statistics is not a defect; it is the price of lock-free
allocation, and the JVM sets an explicit budget for it —
[03c2](03c2-tlab-sizing-and-the-flags.md) has the number. Only waste far above the budget is
worth investigating.

**★ Objects are zeroed, but not usually by the buffer.**
The JVM guarantees fields start at their default values, but the TLAB is not pre-zeroed on
handout by default. Zeroing happens per object at allocation, where the JIT can often fold it
into the initialising stores. Moving that work to buffer handout is a flag, and it moves the
cost rather than removing it.

**★ Promotion has its own buffers, and they are not TLABs.**
GC worker threads copying survivors use *promotion* LABs — a separate mechanism with the same
idea. They do not appear in application-thread TLAB statistics, and tuning one has no effect on
the other.

**★ An object pool usually makes GC worse, not better.**
It converts short-lived objects into long-lived ones, which is exactly the profile the
generational heap is worst at. Pool things that are expensive to construct, not things that are
merely allocated often.

**★ "Allocation is free" is as wrong as "allocation is expensive".**
The bump is nearly free; the *consequence* — filling eden, triggering a young collection,
copying whatever survived — is the real cost, and it is paid by allocation rate rather than by
any single `new`. The right mental model is that you are not charged for allocating, you are
charged for filling.

## Interview questions

**★ Why is allocating an object in Java usually cheaper than `malloc`?**
Because the heap is compacted by a copying collector, so there is no fragmentation and no free
list — allocation is a bump of a pointer. And because each thread owns a private slice of eden,
a TLAB, so the bump needs no synchronisation. The fast path is a compare against the buffer
end, an add and a store, inlined into the caller by the JIT.

**★ If eden is shared by all threads, how can allocation be lock-free?**
It is lock-free in the common case because at that moment the memory is not shared. A thread
takes an entire TLAB from eden with one atomic operation and then allocates privately inside
it. The synchronisation is amortised over a whole buffer's worth of objects rather than paid
per object.

**★ What happens when an object does not fit in the current TLAB?**
Either the thread retires the buffer — wasting the unused tail — and takes a new one, or, if
the object is large enough that a fresh buffer would be mostly wasted, it is allocated outside
any TLAB using the shared eden pointer. Very large objects may be allocated directly in the old
generation or, under G1, become a humongous allocation.

**★ Is `-XX:-UseTLAB` ever the right production setting?**
No. It makes every allocation contend on the shared eden pointer, which is the exact problem
TLABs exist to solve, and the cost grows with core count. It is a diagnostic used to prove
whether a behaviour is TLAB-related, and it should never survive into a deployment.

**★ A colleague proposes an object pool for request DTOs to reduce GC pressure. Argue the other
side.**
Allocating a DTO is a pointer bump, and discarding it costs nothing at collection time because
dead objects are never visited. Pooling replaces that with a thread-safe data structure on
every borrow and return, and it keeps the objects alive across requests — so they survive young
collections, get promoted, and become old-generation garbage, which is the expensive kind. The
pool has converted the cheapest thing the heap does into the most expensive. Pool what is
costly to construct, not what is merely frequent.

**★ Where does the real cost of a high allocation rate show up, if the allocation itself is a
pointer bump?**
In collection frequency. Eden fills in proportion to allocation rate, and each fill triggers a
young collection whose cost is proportional to the survivors. So a service allocating 2 GB/s
is not paying for the `new` calls — it is paying for a young collection every fraction of a
second, and for whatever survives each one. That is why allocation-rate reduction is a real
optimisation and allocation-cost micro-optimisation usually is not.

**★ Why does a copying collector make the allocator simpler?**
Because compaction guarantees free space is contiguous. There is no fragmentation, so there is
nothing to search: the allocator does not need size classes, free lists, best-fit policies or
coalescing. All of that machinery in a `malloc` implementation exists to manage fragmentation
that a moving collector never allows to form. The cost is paid elsewhere — copying survivors —
which is the trade the generational design makes.

{/* FOOTER */}
