---
title: "Garbage collection: the working model"
sidebar_label: "08 · Garbage collection"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JDK 25 HotSpot Garbage Collection Tuning Guide
> ([docs.oracle.com/en/java/javase/25/gctuning/](https://docs.oracle.com/en/java/javase/25/gctuning/)),
> the `java.lang.ref.Cleaner` Javadoc, and JEP 421 (Deprecate Finalization
> for Removal, 18).

**Garbage collection frees you from `free()`, not from memory management. The
JVM reclaims an object when it becomes *unreachable* — not when you are "done
with it" — and it decides *when* to do that work, paying for the convenience
in pauses, CPU and heap headroom. The bug class does not disappear; it
changes shape: instead of use-after-free, Java programs suffer *unintentional
retention* — a reference somebody forgot to drop, keeping a whole object
graph alive. This page is the model; the tuning, the collectors and the
diagnosis tools are Phase 12.**

## Liveness is reachability, nothing else

An object is eligible for collection when it cannot be reached from any **GC
root** — live thread stacks (local variables and parameters of every frame
currently executing), static fields, JNI references, and a few JVM-internal
anchors. Reachability is transitive: if a root reaches a `Map`, the map's
entries and everything *they* reference are all alive.

Three consequences worth internalizing:

- **There is no "delete".** You cannot free an object; you can only drop
  references and let unreachability happen. Setting a local variable to
  `null` is almost never needed (the frame ends anyway); clearing a
  *long-lived* reference — a static cache entry, a field on a singleton — is
  exactly what memory management now means.
- **Cycles are fine.** Two objects referencing each other but reachable from
  no root are garbage — reachability tracing, unlike reference counting,
  handles cycles for free.
- **Alive-by-accident is the leak.** A GC'd language cannot leak by *losing*
  pointers; it leaks by *keeping* them (patterns below).

## Allocation is cheap — the generational bargain

`new` in Java is a few instructions: each thread allocates by bumping a
pointer inside its own **TLAB** (thread-local allocation buffer) — no lock,
no free-list search, typically cheaper than a `malloc`. This is deliberate,
because Java programs allocate constantly.

The design leans on the **generational hypothesis** — the empirical
observation that *most objects die young* (a request's DTOs, streams,
`String` temporaries are garbage milliseconds later). So the heap is managed
generationally: new objects go to a **young generation** collected often and
cheaply (cost proportional to the *survivors*, which are few); what keeps
surviving is promoted to an **old generation** collected rarely.

The working conclusions for a developer:

- **Do not fear short-lived objects.** The per-request allocation churn of
  idiomatic Java is what the collector is optimized for — and C2's escape
  analysis often eliminates allocations it can prove don't leave a method.
- **Be suspicious of accidentally long-lived objects** — mid-lifetime bulges
  (a per-request object held for the whole request batch) are what actually
  stresses collectors.

## What GC costs, and what it never does

The bill has three lines: **pauses** (every collector stops application
threads at least briefly — G1, the default, targets short pauses; ZGC makes
them sub-millisecond; none makes them zero), **CPU** (collection is real work,
concurrent collectors do it alongside your threads), and **headroom** (a heap
run near 100% full collects constantly and badly — the working rule of thumb
is to leave meaningful free space; Phase 12 quantifies it).

Just as important is the negative space — GC does **not**:

- **Close resources.** Files, sockets, connections are OS constructs; an
  unreferenced-but-unclosed `FileInputStream` leaks its file descriptor until
  some eventual collection *maybe* runs a cleanup. Deterministic cleanup is
  try-with-resources (Phase 5), full stop.
- **Run finalizers dependably — and finalization is gone as a design.**
  `finalize()` was deprecated for removal by JEP 421; `java.lang.ref.Cleaner`
  exists as a *last-resort safety net* behind an explicit `close()`, never a
  substitute for it.
- **Reclaim what you still reference.** The collector is not clairvoyant; a
  reachable object is, by definition, not garbage.

`System.gc()` is a *request*, not a command — the JVM may ignore it, and
honoring it usually means a large, badly-timed pause. In application code it
is a smell (ops can neutralize it with `-XX:+DisableExplicitGC`); the JVM's
own scheduling is nearly always better informed than the caller.

## The retention patterns — leaks in a GC'd language

Every Java memory leak in practice is one of a few reference-holding shapes:

| Shape | How it holds |
|---|---|
| **The static collection** | a `static Map`/`List` used as a cache or registry, only ever added to — reachable from a class, forever |
| **The unremoved listener** | observer registered on a long-lived subject, never unregistered — the subject's listener list pins the whole subscriber graph |
| **The unbounded cache** | cache with no eviction policy — a memory leak with a flattering name; real caches bound size or use weak/soft references |
| **`ThreadLocal` in a thread pool** | pool threads live for the process lifetime, so per-thread values set and never `remove()`d accumulate per thread |
| **The inner-class capture** | a non-static inner class or anonymous listener silently holds its enclosing instance (Phase 2's nested-classes topic) |

Diagnosis — heap dumps, dominator trees, Eclipse MAT — is Phase 12's
`OutOfMemoryError` topic. Recognition of the shapes is this phase's job.

`OutOfMemoryError: Java heap space` itself has two honest readings: the live
set genuinely exceeds the heap (undersized `-Xmx` — not a leak), or retention
is growing without bound (a leak — the dump tells you which). Other OOME
variants (metaspace, unable to create native thread, GC overhead limit) are
different diagnoses entirely — Phase 12 separates them.

## Gotchas

**Symptom:** file descriptors exhaust (`too many open files`) while heap looks healthy
**Cause:** relying on GC to close resources — the collector reclaims memory on its schedule, not fds on yours; unclosed streams outlive their usefulness by whole GC cycles
**Fix:** try-with-resources for everything `AutoCloseable` (Phase 5); GC is not a resource manager

**Symptom:** heap usage climbs for days and never comes back down; eventually `OutOfMemoryError: Java heap space`
**Cause:** a retention shape from the table — most often a static map, an unbounded cache or listeners never unregistered
**Fix:** heap dump on OOME and a dominator-tree read (Phase 12); the leak is whatever holds the biggest retained graph. The fix is dropping the reference (eviction, unregister, `remove()`)

**Symptom:** intermittent wrong data or bloated memory per worker thread in a servlet/executor environment
**Cause:** `ThreadLocal` set per task, never removed — pool threads survive tasks, so values leak *and* bleed into the next task on that thread
**Fix:** `try { ... } finally { threadLocal.remove(); }` — always paired, exactly like a resource

**Symptom:** someone "fixes" a memory problem by sprinkling `System.gc()` and latency gets worse
**Cause:** explicit GC forces badly-timed (often full) collections and fixes nothing about retention
**Fix:** remove the calls (or neutralize with `-XX:+DisableExplicitGC`) and diagnose what actually holds memory

**Symptom:** OOME after a traffic increase, and the team hunts for a leak that isn't there
**Cause:** the live set legitimately grew past `-Xmx` — undersizing, not retention; the heap dump shows expected objects in expected quantities
**Fix:** size the heap for the real working set (Phase 12's container-aware sizing) — not every OOME is a leak

**Symptom:** the process's memory (RSS) far exceeds `-Xmx` and someone declares the GC broken
**Cause:** `-Xmx` caps only the Java *heap* — metaspace, thread stacks, code cache, direct buffers and the JVM itself live outside it
**Fix:** account for total footprint when sizing containers (Phase 12); the GC is doing its job on the region it owns

**Symptom:** performance-motivated code avoids allocation with object pools and gets slower and buggier
**Cause:** fighting the collector's strengths — young-gen allocation and death is near-free, while pooled objects live long, get promoted and add old-gen pressure plus aliasing bugs
**Fix:** allocate freely for short-lived objects; pool only genuinely expensive resources (connections, threads, buffers), which is what pooling is for

**Symptom:** cleanup code in `finalize()` never runs, or runs far too late
**Cause:** finalization is deprecated for removal (JEP 421) and was never guaranteed prompt — or run at all — by specification
**Fix:** explicit `close()` via try-with-resources; a `Cleaner` registered as the belt-and-braces backstop for the caller who forgot

## Interview questions

**★ When does an object become eligible for garbage collection?**
When no chain of references reaches it from any GC root — live thread
stacks, static fields, JNI references. Not when it goes out of "logical" use,
and not on any schedule you control. Cycles don't prevent it: two objects
referencing only each other are collectible.

**★ Can Java programs leak memory? Give the classic shapes.**
Yes — by unintentional retention: static collections that only grow,
listeners never unregistered, caches without eviction, `ThreadLocal`s never
removed in pooled threads, inner classes pinning their enclosing instance.
The collector cannot free what the program still references.

**★ Why is allocation in Java so cheap?**
Each thread bump-allocates in its own TLAB — a pointer increment, no lock,
no free-list search. The generational design then makes *death* cheap too:
young collections cost proportional to survivors, and most objects don't
survive. Escape analysis can eliminate allocations entirely.

**★ What does `System.gc()` actually do, and should you call it?**
It *suggests* a collection; the JVM may comply (often with an expensive full
pause) or ignore it. In application code it is a smell — the JVM schedules
collections with far better information. `-XX:+DisableExplicitGC` exists
because enough libraries got this wrong.

**★ Does garbage collection close files or sockets?**
No. GC manages memory only, on its own schedule; OS resources need
deterministic release via try-with-resources. Finalization — the historical
blur between the two — is deprecated for removal (JEP 421), with `Cleaner`
as an explicit, last-resort backstop.

**What is the generational hypothesis and what follows from it?**
Most objects die young. Therefore: collect the young region often and
cheaply, promote survivors, touch the old region rarely. For developers:
short-lived allocation is idiomatic and cheap; *mid-length* lifetimes and
accidental promotion are what stress the system.

**Is every `OutOfMemoryError: Java heap space` a leak?**
No — the live set may simply exceed the configured heap (undersizing,
traffic growth). A heap dump distinguishes them: a leak shows one
unexpectedly huge retained graph; undersizing shows expected data at
expected sizes. Different fixes entirely.

**Why did object pooling stop being a general optimization?**
Modern young-gen allocation/collection is near-free, while pooled objects
promote to the old generation and add pressure where collection is
expensive — plus reset bugs. Pooling survives only where the resource itself
is dear: connections, threads, large buffers.

---

← Prev: [JIT compilation](07-jit-compilation.md) · Next → [Version managers](09-version-managers.md)
