---
title: "Reordering and visibility"
sidebar_label: "1 · Reordering and visibility"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against JLS SE 25 §17.4 (Memory Model), §17.4.5
> (Happens-before Order — the data-race definition), §17.7 (Non-Atomic
> Treatment of double and long), and JLS §17.4.1's shared-memory
> definitions.

**Within one thread, Java promises your program behaves *as if* statements
ran in source order. Across threads, it promises no such thing: the JIT
compiler, the CPU and the cache hierarchy are all free to reorder and delay
memory operations, provided the executing thread itself can't tell the
difference. A second thread *can* tell the difference — and what it sees is
constrained only by the JMM's rules, not by the order you wrote.**

## Why reordering exists at all

Three layers between your source and RAM each reorder for speed:

- **The JIT compiler** hoists loads out of loops, sinks stores, eliminates
  reads it has proven redundant, and keeps values in registers. If nothing
  tells it a field is shared, "read `done` once, reuse the register" is a
  *correct* single-threaded optimization.
- **The CPU** executes out of order and writes through **store buffers** —
  a write becomes visible to the local core immediately but reaches shared
  cache later. Two cores can each see their own write first and the other's
  second: neither order is "the real one".
- **The cache hierarchy** propagates invalidations asynchronously. There is
  no single global moment at which a write "happens" for everyone.

The JMM exists so that the platform can keep all of that speed *and* you
can still write correct code: it defines exactly which optimizations must
be given up, and only where you ask for it (`volatile`, monitors, the
`j.u.c` primitives).

## The flag that never stops

The canonical visibility failure — no exception, no error, just a loop
that never exits:

```java
class Worker {
    private boolean stop = false;      // plain field — no volatile

    void run() {
        while (!stop) {
            doWork();
        }
    }

    void shutdown() {                  // called from another thread
        stop = true;
    }
}
```

The JMM permits the JIT to compile `run()` as if it read `stop` once and
tested a register forever after — hoisting the load out of the loop is
legal precisely because no happens-before edge connects `shutdown()`'s
write to `run()`'s reads. The loop may also *appear* to work for months:
a deoptimization, a GC pause or plain luck can make the write visible.
"Works in testing" is exactly what the model predicts. The fix is one
keyword — `volatile boolean stop` — and *why* that fixes it is
[chunk 3](03-volatile-and-safe-publication.md).

## Visibility and atomicity are different failures

Two properties get conflated under "thread safety", and they fail
independently:

| Property | Question it answers | Fails as |
|---|---|---|
| **Visibility** | Will another thread *see* this write at all / in time? | stale reads, infinite loops, half-built objects |
| **Atomicity** | Can another thread observe this operation *half-done*? | lost updates, torn values |

`counter++` is three actions — read, add, write — and two threads can
interleave them so one increment is lost. Making `counter` `volatile`
fixes *visibility* (each thread reads the latest value) and does nothing
for *atomicity*: both threads can still read the same value, add one, and
write the same result. This is the single most common `volatile`
misconception, and it comes up in [chunk 3](03-volatile-and-safe-publication.md)
and again with the atomics — **topic 10 · Atomics** *(not written yet)*.

## Word tearing: the 64-bit fine print

JLS §17.7 permits a JVM to treat a non-`volatile` `long` or `double` write
as **two separate 32-bit writes**. A reader can observe a value that is
the high half of one write and the low half of another — a number nobody
ever wrote. The same section *requires* atomic treatment for `volatile`
`long`/`double`, and for references always (no torn pointers). 64-bit
JVMs implement plain `long` writes atomically in practice, but the spec
does not promise it — one more reason shared mutable primitives need
`volatile` even before you think about ordering.

## What a data race actually is

The JLS definition is precise (§17.4.5): two accesses to the same variable
**conflict** when they are from different threads and at least one is a
write. A program contains a **data race** when two conflicting accesses
are not ordered by happens-before. Then the two headline rules:

- A read in a data race is allowed to return *any* value some write put
  there — not necessarily the latest, not necessarily one you can
  reproduce.
- A program whose sequentially-consistent executions contain **no** data
  races is **correctly synchronized**, and the JMM guarantees such a
  program only ever exhibits sequentially consistent behaviour — you may
  reason about it as simple interleaving and forget this entire chunk.

That second rule is the deal the JMM offers: eliminate data races (with
the edges of [chunk 2](02-happens-before.md)) and the weird behaviours —
reordering, staleness, tearing — become invisible to you.

Note what a data race is *not*: a **race condition** (check-then-act on a
bank balance) is a logic-level interleaving bug that can happen even in a
correctly synchronized program — **topic 03 · Race conditions**
*(not written yet)* owns that distinction.

## Gotchas

**Symptom:** worker thread never observes `stop = true`; jstack shows it healthy and running
**Cause:** plain field, no happens-before edge from writer to reader — the JIT legally hoisted the read out of the loop
**Fix:** `volatile boolean stop`, or interrupt the thread (interruption's edge is delivered by the runtime) — see topic 01's cooperative cancellation

**Symptom:** the same concurrency test passes 10,000 times locally, fails weekly in production
**Cause:** a data race whose bad interleaving needs real parallelism, a JIT tier or cache timing your laptop doesn't hit
**Fix:** treat "can't reproduce" as confirmation, not absolution — audit the shared fields for missing edges instead of rerunning the test

**Symptom:** adding a `System.out.println` in the loop "fixes" the stale-flag bug
**Cause:** `println` is internally synchronized — its monitor traffic happens to flush and re-read memory, masking the race
**Fix:** the bug is still there; the print changed the timing and the JIT's decisions. Add the real edge (`volatile`), delete the print

**Symptom:** a shared `long` sequence number occasionally reads as an enormous garbage value on a 32-bit or embedded JVM
**Cause:** JLS §17.7 — non-`volatile` `long`/`double` writes may be two 32-bit halves; the reader saw a mix of two writes
**Fix:** declare it `volatile` (spec-guaranteed atomic) or use `AtomicLong`

**Symptom:** code reviewer says "this race is fine, worst case we read a slightly old value"
**Cause:** under a data race the JMM does not promise "slightly old" — it permits any value any write put there, and the surrounding reads can be reordered too
**Fix:** either prove the field independent (then make it `volatile` anyway for the tear/staleness bound) or add the proper edge; "benign data race" claims need JMM-level argument, not intuition

**Symptom:** singleton "initialized" in one thread arrives half-built in another — fields still at defaults
**Cause:** publishing the reference raced with the constructor's field writes; without an edge the reader may see the reference before the fields
**Fix:** safe publication — [chunk 3](03-volatile-and-safe-publication.md); or make the object immutable with `final` fields ([immutable design](../../phase-2-classes-objects/12-immutable-design/README.md))

## Interview questions

**★ Why does a plain `boolean` stop-flag loop sometimes never terminate?**
No happens-before edge connects the writer's `stop = true` to the loop's
reads, so the JIT may hoist the read out of the loop (one register test
forever), and even unhoisted reads may see the stale cached value. The
JMM explicitly permits this; `volatile` forbids it.

**★ Visibility vs atomicity — define both and give a failure of each.**
Visibility: whether one thread's write is *seen* by another (failure: the
stale stop flag). Atomicity: whether an operation can be observed
half-done (failure: `counter++` losing updates when two threads interleave
read-add-write). `volatile` fixes only the first; locks and atomics fix
both.

**★ What exactly is a data race in JLS terms?**
Two conflicting accesses (same variable, different threads, at least one a
write) not ordered by happens-before. Distinct from a race condition,
which is a logic bug in the interleaving of correct operations.

**★ What does the JMM guarantee for a correctly synchronized program?**
If no sequentially consistent execution has a data race, then *all*
executions are sequentially consistent — you may reason as if operations
simply interleave in some global order. The entire model's complexity is
only visible to programs with races.

**★ Why can't you just test for memory-model bugs?**
Because racy behaviour is *permitted*, not required: a JVM is free to give
you the intuitive result every time on your hardware and the broken one on
different hardware, a different JIT tier, or under different load. Absence
of failures is evidence about the platform's mood, not the program's
correctness.

**★ Is `long x = someValue;` atomic in Java?**
Not guaranteed for a plain field: JLS §17.7 permits two 32-bit writes
(word tearing), so a racing reader may see a value nobody wrote. It *is*
guaranteed atomic if the field is `volatile` — and reference writes are
always atomic regardless.

**★ A colleague inserts logging and the "bug disappears". What happened?**
The logger's internal synchronization (monitor acquire/release) added
incidental memory edges and changed JIT decisions, masking the race.
Heisenbugs of this shape are near-diagnostic of a visibility problem:
the fix is an intentional edge, not the accidental one.

---

← Prev: [The Java Memory Model](README.md) · Next → [Happens-before](02-happens-before.md)
