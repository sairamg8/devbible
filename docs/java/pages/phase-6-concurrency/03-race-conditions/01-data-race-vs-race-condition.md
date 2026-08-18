---
title: "Data race vs race condition"
sidebar_label: "1 · Data race vs race condition"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JLS SE 25 §17.4.1 (Shared Variables),
> §17.4.5 (Happens-before Order — "When a program contains two conflicting
> accesses that are not ordered by a happens-before relationship, it is
> said to contain a *data race*"), and the Oracle Java Tutorials
> concurrency lesson (Thread Interference, Memory Consistency Errors).

**Java has two distinct concepts that both get called "a race", and the
distinction is not pedantry — each can occur without the other, and they
have different cures. A *data race* is a memory-model term: two conflicting
accesses (same variable, at least one a write) not ordered by
happens-before. A *race condition* is a semantic term: the program's
correctness depends on which thread wins. You can eliminate every data
race with `volatile` and still double-charge a customer, because
visibility was never the bug — the unguarded *gap between steps* was.**

## The data race — the JLS definition

JLS §17.4.5: two accesses to the same variable *conflict* if at least one
is a write. A program contains a **data race** when two conflicting
accesses are not ordered by a happens-before relationship. The
consequences are the memory-consistency errors the tutorials warn about:
a thread may read a stale value, or observe writes in a surprising order.
What happens-before is and how you establish it belongs to **topic 05 ·
The Java Memory Model** *(not written yet)* — this chunk needs only the
definition.

Two facts worth fixing early:

- **A data race is defined per *access pair*, not per program run.** The
  racy read might return the fresh value every time on your laptop —
  the program still *contains* a data race, and the JLS gives it weaker
  guarantees whether or not today's hardware exposed that.
- **Data-race-free programs get the strong guarantee.** The JMM's central
  promise (JLS §17.4.3): if a program is correctly synchronized (no data
  races), all executions appear *sequentially consistent* — as if all
  reads and writes happened in one global order. Remove the races and you
  may reason about interleavings only; leave one in and even
  line-by-line interleaving reasoning is unsound.

## The race condition — a semantic bug

A race condition needs no memory-model vocabulary: the outcome depends on
scheduling. The canonical demonstration is the counter:

```java
class Counter {
    private int count = 0;
    void increment() { count++; }   // looks atomic; is not
    int value() { return count; }
}
```

`count++` is **read → modify → write**: fetch the current value, add one,
store the result. (The Oracle tutorial decomposes it exactly this way; you
can confirm with `javap -c` that it compiles to separate load, add and
store instructions.) Two threads both read `41`, both compute `42`, both
store `42` — one increment is lost. Nothing crashes. The count is simply
wrong, by an amount that depends on load.

## Independent axes — all four quadrants exist

| | No race condition | Race condition |
|---|---|---|
| **No data race** | correctly synchronized, correct logic | `volatile` check-then-act: every access visible, gap still unguarded |
| **Data race** | benign-looking stat counter nobody reads for decisions | unsynchronized `count++` — both bugs at once |

The top-right cell is the one that breaks intuition and interviews:

```java
private volatile boolean initialized = false;

void ensureInit() {
    if (!initialized) {        // both threads read false — visibly, correctly
        expensiveInit();       // ...and both run this
        initialized = true;
    }
}
```

`volatile` removes the data race (every read sees the latest write, and
**topic 05** *(not written yet)* explains why). The race *condition*
remains: between one thread's read and its write, the other thread reads.
Visibility tools cannot close a compound gap — only mutual exclusion
([topic 04](../04-synchronized-intrinsic-locks/README.md)) or an atomic
compound operation ([chunk 3](03-the-cures.md)) can.

The bottom-left cell matters for honesty in the other direction: a racy
`int` metrics counter that only feeds a dashboard has a data race and no
consequential race condition. The JLS still calls it incorrect; fixing it
costs one `LongAdder`. "It's just stats" is how the pattern spreads to a
variable that *does* decide something.

## Why these bugs hide

Races are the canonical *works-on-my-machine* defect, for reasons worth
being able to recite:

- **The interleaving space is enormous.** Two threads of *n* steps each
  have combinatorially many schedules; a test run samples a handful. The
  failing schedule needs the preempt to land inside a window a few
  instructions wide.
- **Load widens the window.** More threads, fuller queues, longer GC
  pauses — production traffic explores schedules your test suite never
  reached. This is why races surface at peak, on Black Friday, during the
  incident you least want them in.
- **The debugger un-races it.** Breakpoints and single-stepping serialize
  the threads; logging adds synchronization of its own (a shared stream's
  internal lock) that can accidentally order the racing accesses. The act
  of observing hides the bug.
- **Hardware is more forgiving than the spec.** x86 gives stronger
  ordering than the JMM requires, so a program with data races can run
  clean for years on x86 and fail on ARM — a real migration hazard in the
  Graviton/Apple-silicon era.
- **The JIT is allowed to make it worse.** For racy code, the compiler may
  hoist a read out of a loop (turning "stale for a moment" into "stale
  forever"). The infamous non-`volatile` stop-flag loop that never stops
  is this — **topic 05** *(not written yet)* shows it.

The practical consequence: **absence of failing tests is not evidence of
thread safety.** Reviewing for the shapes in
[chunk 2](02-the-shapes.md) — and running racy suspicions through a tool
built to explore schedules, like OpenJDK's
[jcstress](https://openjdk.org/projects/code-tools/jcstress/) — is the
honest check.

## Gotchas

**Symptom:** counter under-counts in production; every unit test passes
**Cause:** `count++` is read-modify-write across three steps; concurrent increments interleave and one write clobbers the other
**Fix:** `AtomicLong.incrementAndGet()` (or `LongAdder` for hot counters — **topic 10** *(not written yet)*), or `synchronized` around the compound step

**Symptom:** team declares a class thread-safe "because we made everything `volatile`"
**Cause:** conflating the two races — `volatile` orders and publishes individual accesses; it cannot make a read-then-write sequence atomic
**Fix:** classify each member's *usage*: single independent reads/writes may be `volatile`; any check-then-act or read-modify-write needs exclusion or an atomic compound

**Symptom:** race reproduces on the new ARM fleet but never did on x86
**Cause:** the program always contained a data race; x86's stronger hardware ordering masked it, and the JMM never promised what x86 happened to deliver
**Fix:** fix the race, not the fleet — the JLS-defined guarantee is the only portable one

**Symptom:** adding a log line inside the suspect method makes the bug vanish
**Cause:** the logger's internal synchronization orders the racing accesses as a side effect — a Heisenbug
**Fix:** treat vanishing-under-observation as *evidence of* a race; find the unguarded compound access by review rather than by instrumenting it away

**Symptom:** code review flags a racy stats field; author replies "harmless, it's only metrics"
**Cause:** genuinely low-stakes today — but the pattern normalizes unguarded shared writes, and the field's consumers change
**Fix:** `LongAdder` costs one line; spend it and keep the codebase's invariant simple: no unsynchronized shared mutation, ever

**Symptom:** intermittent test failure marked `@Disabled("flaky")` for months
**Cause:** the test found a real race; the schedule that fails arrives rarely, so it was filed as infrastructure noise
**Fix:** flaky concurrent tests are bug reports — minimize the failing case, or port the scenario to a jcstress-style harness that searches schedules deliberately

## Interview questions

**★ What is the difference between a data race and a race condition?**
A data race is the JLS §17.4.5 condition: two conflicting accesses (same
variable, one a write) unordered by happens-before — a memory-model
property. A race condition is a semantic bug: correctness depends on
scheduling. Each occurs without the other: a `volatile` check-then-act is
race-condition-without-data-race; an unread racy stats counter is
data-race-without-consequence. The distinction picks the fix — visibility
tools for one, atomicity/exclusion for the other.

**★ Why does `count++` lose updates?**
It is three operations — read, add, write. Two threads read the same
value, both add one, both write; the second write overwrites the first
and one increment vanishes. No exception, no corruption signal — just a
wrong number.

**★ If every field is `volatile`, is the class thread-safe?**
No. `volatile` gives visibility and ordering per access; thread safety
usually needs *atomicity across* accesses. The volatile lazy-init
check-then-act still runs `expensiveInit()` twice. Compound operations
need `synchronized`, an atomic class's compound methods, or a redesign
that removes the sharing.

**★ Why do races show up in production but not in tests?**
Tests sample a tiny corner of the interleaving space, on one hardware
memory model, at low load. Production adds threads, load, GC pauses and
possibly weaker-ordered CPUs — all of which explore schedules tests never
hit. Debuggers and logging serialize threads and hide the bug further.
Correctness must come from analysis (happens-before, guarded invariants),
not from green runs.

**★ What does "correctly synchronized" buy you under the JMM?**
Sequential consistency: if a program has no data races, every execution
behaves as if all operations ran in some single global order consistent
with program order (JLS §17.4.3). That is what licenses ordinary
interleaving reasoning. With even one data race, the model permits
counter-intuitive outcomes that no interleaving explains.

---

← Index: [Race conditions](README.md) · Next → [The shapes](02-the-shapes.md)
