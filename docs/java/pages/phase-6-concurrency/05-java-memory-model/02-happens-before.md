---
title: "Happens-before"
sidebar_label: "2 · Happens-before"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against JLS SE 25 §17.4.4 (Synchronization Order),
> §17.4.5 (Happens-before Order), and the JDK 25 Javadoc for
> `java.util.concurrent` (package "Memory Consistency Properties" section)
> and `Thread.start`/`Thread.join`.

**Happens-before is the JMM's only currency. It is a relation between two
actions saying "the first is visible to and ordered before the second" —
and every visibility guarantee in Java, from `volatile` to executors to
`ConcurrentHashMap`, is specified as nothing more than which edges it
creates. Learn the short list of edges and the transitivity rule and you
can *derive* the answer to any "will thread B see this?" question instead
of guessing.**

## The edges the language gives you

From JLS §17.4.5 and §17.4.4, the ones that matter in practice:

| Edge | From | To |
|---|---|---|
| **Program order** | each action in a thread | every later action *in that same thread* |
| **Monitor** | an unlock of monitor *m* | every *subsequent* lock of *m* |
| **`volatile`** | a write to a volatile field | every *subsequent* read of that field |
| **Thread start** | `t.start()` in the parent | the first action in `t` |
| **Thread termination** | the last action in `t` | any other thread's `t.join()` returning (or `isAlive()` returning false) |
| **Interruption** | `t2.interrupt()` | the point where `t2` detects it (throw/`isInterrupted`) |
| **Default writes** | the write of a field's default value (`0`, `null`, `false`) | the first action in every thread |
| **Transitivity** | if A *hb* B and B *hb* C | then A *hb* C |

"Subsequent" in the monitor and volatile rows is defined by the
*synchronization order* — a global order over all lock/unlock/volatile
operations that every execution has (JLS §17.4.4). That is what makes the
edge cross threads: writer's unlock, then reader's lock of the same
monitor, in that global order, gives the reader everything the writer did
before unlocking.

## Transitivity is where the power is

The monitor and volatile edges would be nearly useless if they only covered
the locked writes themselves. Combined with program order and transitivity
they cover *everything before the edge*:

```java
// Thread A                          // Thread B
data = buildExpensive();  // 1
ready = true;             // 2 volatile write
                                     if (ready) {          // 3 volatile read
                                         use(data);        // 4 sees ALL of 1
                                     }
```

1 *hb* 2 (program order), 2 *hb* 3 (volatile edge), 3 *hb* 4 (program
order) ⇒ 1 *hb* 4. The plain, non-volatile `data` field is fully visible
to B — carried across on `ready`'s edge. This is **piggybacking**: one
volatile/monitor operation publishes an arbitrary amount of prior plain
state. It is also why the *order* of the two writes in A is load-bearing —
swap lines 1 and 2 and the guarantee evaporates.

## The guarantee you actually program against

JLS §17.4.5: if a program's sequentially-consistent executions are free of
data races, **all** its executions appear sequentially consistent. The
practical reading:

1. List every field shared between threads.
2. For each, make sure every write→read pair crosses on some edge (same
   monitor, volatile, executor handoff, `start`/`join`…).
3. If you succeeded, stop thinking about reordering and store buffers —
   interleaving semantics is now the truth.

Failing step 2 for even one field puts you back in
[chunk 1](01-reordering-and-visibility.md)'s "any value any write put
there" territory — for that field *and* anything you reasoned transitively
through it.

## The edges the library adds

The `java.util.concurrent` package documentation extends the same relation
so you rarely need raw `volatile`:

- Submitting a task (`executor.execute`/`submit`) *hb* the task starting —
  everything the submitter did is visible to the task
  ([ExecutorService](../06-executorservice-pools/README.md)).
- A task's completion *hb* `Future.get` returning its result.
- Placing an object in any concurrent collection *hb* another thread
  reading it from that collection — **topic 11 · Concurrent collections**
  *(not written yet)*.
- `CountDownLatch.countDown()` *hb* `await()` returning; the same pattern
  for semaphores and barriers — **topic 16 · Coordination primitives**
  *(not written yet)*.

The habit to build: when handing data between threads, *name the edge*.
If you can't name it, you don't have one.

## What happens-before is not

- **Not wall-clock order.** "Thread A wrote it a full second before B
  read it" creates no edge; B may still see the stale value. Time is not
  in the model.
- **Not mutual exclusion.** Edges order and publish; they don't make
  compound actions atomic. `volatile` gives edges with no exclusion;
  a lock gives both — that split is topic 04's *(not written yet)*.
- **Not a fence you call.** You get edges from *paired* operations on the
  *same* monitor/field. An unlock of lock X and a lock of lock Y create
  no edge between their threads.

## Gotchas

**Symptom:** reader thread sees `ready == true` but `data` is null/stale
**Cause:** `ready` isn't volatile (no edge), or the writer set `ready` *before* filling `data` (edge exists but program order doesn't put the data write before it)
**Fix:** volatile flag, and write the payload strictly before the flag; read the flag strictly before the payload

**Symptom:** two threads synchronize conscientiously — on different lock objects — and still race
**Cause:** monitor edges pair unlock and lock of the *same* monitor; different monitors create no cross-thread edge
**Fix:** one shared lock object for one shared mutable thing; document which lock guards which fields

**Symptom:** state written by a `Runnable` is stale in the thread that called `executor.submit` and then read the fields directly
**Cause:** submit gives submitter→task edges; it gives nothing for task→submitter until completion is *observed* through `Future.get`/`join`
**Fix:** read results via the `Future`, or hand data back through a concurrent structure — never through plain fields on the side

**Symptom:** parent thread populates a config object, calls `t.start()`, then keeps mutating the config; worker sees an inconsistent mix
**Cause:** the `start()` edge covers only writes made *before* `start()`; later parent writes race with worker reads
**Fix:** finish all initialization before `start()`, or switch the shared object to a properly synchronized/immutable structure

**Symptom:** replacing `join()` with a sleep "long enough for the worker to finish" produces occasional garbage reads of its results
**Cause:** sleeping creates no edge — termination visibility comes from `join()`/`isAlive()`, not from the worker being *actually* done
**Fix:** `join()` (or a `Future`/latch); never trade an edge for a timer

**Symptom:** team reasons "the write is inside `synchronized`, so it's visible" — but readers don't lock
**Cause:** half an edge: unlock *hb* subsequent lock; a reader that never locks the monitor is not on the edge at all
**Fix:** readers and writers must use the same monitor (or make the field volatile); one-sided synchronization is a race with extra steps

## Interview questions

**★ List the happens-before edges you use in a normal service without writing `volatile` once.**
Program order; executor submit → task and task → `Future.get`; monitor
edges inside `synchronized` services; `ConcurrentHashMap`/queue insert →
read; latch countDown → await; `Thread.start`/`join` in tests. The
`j.u.c` package documentation defines all of them as happens-before, which
is why idiomatic code rarely touches the raw keyword.

**★ Explain piggybacking — publishing plain fields over one volatile write.**
Program order puts the plain writes before the volatile write; the volatile
edge crosses to the reader's volatile read; program order continues to the
plain reads; transitivity chains them, so every write before the volatile
store is visible after the volatile load. Order is essential: flag last on
the writer, flag first on the reader.

**★ Thread A writes under `synchronized(lockA)`; thread B reads under `synchronized(lockB)`. Safe?**
No. The monitor edge pairs unlock and lock of the *same* monitor. Distinct
monitors give mutual exclusion against themselves only and no cross-thread
visibility edge between A and B — it's a data race wearing two locks.

**★ Does `Thread.sleep` or wall-clock time create any ordering?**
None. The JMM has no notion of elapsed time; an edge comes only from the
enumerated operations. "It's been running for a second, the write must be
visible" is precisely the reasoning the model rejects.

**★ Why is a one-sided `synchronized` getter-less pattern (locked writes, unlocked reads) broken?**
Readers that never acquire the monitor aren't part of any unlock→lock
pair, so their reads race with the locked writes — stale or reordered
values are permitted. Either both sides lock, or the field is volatile.

**★ What does `t.join()` guarantee beyond "t finished"?**
An edge: everything `t` did happens-before `join()` returning, so all of
`t`'s writes are visible to the joiner without further synchronization.
The same visibility holds for `isAlive() == false`, and per-task via
`Future.get`.

---

← Prev: [Reordering and visibility](01-reordering-and-visibility.md) · Next → [`volatile` and safe publication](03-volatile-and-safe-publication.md)
