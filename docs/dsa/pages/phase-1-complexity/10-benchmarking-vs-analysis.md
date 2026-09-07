---
title: "Analysis says which class wins as n grows; a benchmark says which code wins at the n you have — and at real sizes a linearithmic solution on a contiguous array can beat a linear one that chases pointers, because a cache miss costs two hundred times a cache hit"
sidebar_label: "10 · Benchmarking vs analysis"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07. The memory-hierarchy figures are Norvig's table
> ([norvig.com/21-days.html](https://norvig.com/21-days.html), verbatim rows below) with the
> SSD and same-datacentre rows from the circulated list credited to Dean and Norvig — orders of
> magnitude on roughly 2012 hardware, quoted as such. `performance.now()` and JMH are named as
> tools without version claims; nothing about a specific machine is asserted. **No sandbox run,
> and no timing is reported anywhere on this page** — the point of the page is when *you* would
> run one.

**Analysis and measurement answer different questions, and a candidate who knows which one to
reach for is showing judgement rather than technique.** Big-O says how cost *grows*: past some
n, the lower class wins, whatever the constants. It does not say where that n is, and at the
sizes real programs run — a thousand elements, a hundred thousand — the constants decide. The
constants are dominated by one thing analysis ignores: memory. A read from L1 cache and a read
from main memory differ by two hundred times, so an algorithm that walks a contiguous array
does its "n log n" at a fraction of the per-step cost of a "linear" one that follows pointers
to scattered nodes — and a sort followed by a scan beats a hash map more often than the
classes suggest. Benchmarking is how that is settled, and it has its own discipline: warm-up,
repetition, a realistic input, and a runtime that has stopped optimising under you. This page
is what each tool answers, the memory numbers that explain most constants, three cases where
the "worse" class wins in practice, how to benchmark without fooling yourself in Node and on
the JVM, and how to bring any of it up in a round.

## What each answers

| Question | Tool | What it cannot tell you |
|---|---|---|
| Which approach scales? | analysis — the class | where the crossover is |
| Which is faster at n = 10⁵ on this machine? | a benchmark | whether it stays faster at 10⁷, or on another machine |
| Will it run within the limit? | analysis, then the arithmetic of [05](05-the-common-classes-and-what-the-limits-imply.md) | the constant, within a factor of ten |
| Why is it slow? | a profiler | what the bound is |
| Is my "linear" code actually linear? | a benchmark at two sizes — does doubling n double the time, or quadruple it? | which line is the quadratic |

The last row is the one interviews reward: the empirical check for an accidental quadratic
([06](06-hidden-costs.md)) is to run at n and at 2n and compare; a ratio near four is the
answer, and it finds the bug without reading the code.

## The numbers behind the constants

Norvig's table is the standing reference, and the rows that decide constants are the memory
ones:

| Operation | Time |
|---|---|
| fetch from L1 cache memory | 0.5 nanosec |
| branch misprediction | 5 nanosec |
| fetch from L2 cache memory | 7 nanosec |
| fetch from main memory | 100 nanosec |
| read 1MB sequentially from memory | 250,000 nanosec |
| fetch from new disk location (seek) | 8,000,000 nanosec |

— Norvig, *"Approximate timing for various operations on a typical PC"*; the circulated list
credited to Dean and Norvig adds a random 4K SSD read at about 150,000 ns and a same-datacentre
round trip at about 500,000 ns.

Two hundred times between L1 and main memory is the whole story of "the constants". An
algorithm's step costs a nanosecond if its data is in cache and a hundred if it is not; a
structure that keeps the next element adjacent to this one — an array — gets the hardware
prefetcher on its side, and a structure that stores the next element wherever the allocator put
it — a linked list, a tree of heap-allocated nodes, a hash map's buckets — pays the miss on most
steps. Reading a megabyte sequentially at 250 µs is a quarter of a nanosecond per byte; reading
the same megabyte as scattered eight-byte nodes is a hundred nanoseconds each, four hundred
times slower. No class captures that; the benchmark does.

## Three cases where the "worse" class wins

**1. Sort-and-scan against a hash map.** Finding duplicates by sorting (n log n) and scanning is
often faster than a hash set (n) at real sizes: the sort touches memory sequentially and
allocates nothing; the set allocates a node or slot per element and hashes each one, with a
cache miss on most lookups. The crossover is large and machine-dependent; the sentence is "the
hash is the better class and the sort may be the faster code — I'd measure."

**2. Linear search against binary search on small arrays.** A linear scan of a dozen elements
in one cache line beats a binary search's branch mispredictions and pointer arithmetic; library
implementations switch to linear below a threshold for exactly this reason. Below about a
hundred elements the class is irrelevant.

**3. Insertion sort on small or nearly sorted input against anything.** Θ(n²) worst, but with
no allocation, no recursion, sequential access and a Θ(n) best case — which is why every
production sort uses it on short runs ([09](09-best-average-and-worst.md)). A candidate asked
"why does the library sort use insertion sort inside?" is being asked this page.

The general shape: **a lower class with allocation, pointers and branches loses to a higher
class with contiguous memory until n is large enough for the growth to matter.** Where "large
enough" is, only a benchmark on the real machine says.

## Benchmarking without fooling yourself

A benchmark is an experiment, and the ways it lies are well known:

- **The JIT.** V8 and HotSpot compile hot code after it has run for a while; the first
  iterations measure the interpreter, later ones the optimised code, and the two differ by an
  order of magnitude. Warm up — run the code many times before timing — and time many
  iterations, not one.
- **Dead code.** An optimiser that sees the result is unused removes the computation, and the
  benchmark measures nothing. Consume the result — accumulate it, return it, print a checksum.
- **Constant folding.** A benchmark whose input is a literal can be computed at compile time.
  Generate the input at runtime, and vary it.
- **Garbage collection.** A pause lands inside one measurement and not another. Repeat, and
  report the median or a percentile, never the mean of a few runs.
- **The wrong n.** A benchmark at n = 100 says nothing about n = 10⁶; run at two or three sizes
  and look at the ratios — that is also how a class is confirmed empirically.
- **The wrong input.** Sorted input for a sort, all-distinct keys for a hash — measure the
  distribution the code will see, including the worst case from [09](09-best-average-and-worst.md).
- **The clock.** Use a monotonic high-resolution timer — `performance.now()` in JavaScript,
  `System.nanoTime()` in Java — not wall-clock dates.

```ts
// a minimal harness: warm-up, repetitions, a consumed result, the median — nothing here is a
// result; it is the shape of a measurement that can be trusted
export function bench(label: string, fn: () => number, reps = 30, warm = 5): void {
  let sink = 0;
  for (let i = 0; i < warm; i++) sink += fn();                 // let the JIT settle
  const times: number[] = [];
  for (let i = 0; i < reps; i++) {
    const t0 = performance.now();
    sink += fn();                                              // consume the result
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  console.log(label, 'median ms', times[times.length >> 1], 'checksum', sink);
}
// run at n and 2n; a ratio near 2 is linear, near 4 quadratic, near 2.2 n log n
```

On the JVM the same pitfalls are severe enough that a harness exists for them — JMH, the Java
Microbenchmark Harness, which handles warm-up, forking, dead-code elimination via blackholes and
statistical reporting; a hand-written `System.nanoTime()` loop on HotSpot is the canonical way
to measure the wrong thing.

## In the round

Benchmarking is not something you do in a round — there is no machine, and rule one of this
track is no timings from memory. It comes up in three ways:

1. **"Which is faster in practice?"** after two solutions of different class. The answer names
   the constant — allocation, pointer chasing, cache behaviour — and ends with "I'd measure at
   the real size", which is the honest sentence and the senior one.
2. **"Why does the library do that?"** — insertion sort on short runs, linear search on small
   arrays, arrays of primitives over lists of boxes. The answer is the memory table.
3. **"Your solution is O(n); it's timing out."** The empirical check — double n, watch the
   ratio — followed by the reading of [06](06-hidden-costs.md).

In all three, analysis first and measurement second, and the boundary between them said out
loud: *"the class is decided; the constant isn't, and the constant is memory."*

## Gotchas

**★ Symptom: "the hash map is O(n), so it must be faster than sorting."** Cause: class mistaken
for speed. Fix: the class wins as n grows; at real sizes the sort's sequential access and zero
allocation often win — say both, and "I'd measure".

**★ Symptom: a benchmark that times one call, cold.** Cause: the interpreter measured, not the
compiled code. Fix: warm-up iterations, many repetitions, the median.

**Symptom: the optimised loop runs in zero time.** Cause: dead-code elimination — the result
was unused. Fix: consume it; a checksum printed at the end.

**Symptom: a linked list chosen "because insertion is O(1)".** Cause: the pointer miss
ignored. Fix: the insert is constant; finding the position and every traversal pays a cache miss
per node; an array with a shift is usually faster until n is large, and the JDK's own javadoc
recommends `ArrayDeque` over `LinkedList` for stack and queue use.

**Symptom: one benchmark at one size, reported as "twice as fast".** Cause: a constant measured
at a point. Fix: three sizes and the ratios; the crossover is the useful number.

**Symptom: benchmark input is sorted, distinct, or a literal.** Cause: best case or constant
folding measured. Fix: runtime-generated input in the real distribution, including the worst
case.

**Symptom: a timing quoted in the interview from memory.** Cause: reaching for a number. Fix:
the memory table's orders of magnitude, attributed, and "I'd measure"; never a figure for a
machine you do not have.

**Symptom: a JVM microbenchmark written with `nanoTime` in a loop.** Cause: HotSpot's
optimisations unaccounted for. Fix: JMH — it exists because the hand-rolled loop measures the
wrong thing.

## Interview questions

**★ Two solutions, one O(n) with a hash map and one O(n log n) with a sort — which is faster?**
The class says the hash map wins as n grows; the constants say the sort often wins at real
sizes, because it reads memory sequentially and allocates nothing, while the map allocates per
element and pays a cache miss on most lookups — a hundred nanoseconds against half a nanosecond
by Norvig's table. Where the crossover falls depends on the machine and the key type; the
honest answer names both effects and says "I'd measure at the size we have."

**★ How would you check empirically whether a function is linear or quadratic?**
Time it at n and at 2n, warmed up and repeated, and compare: a ratio near two is linear, near
four quadratic, a little over two for n log n. It is the fastest way to find an accidental
quadratic without reading the code, and it needs the benchmark discipline — warm-up, a consumed
result, runtime-generated input, the median of many runs.

**Why do library sorts use insertion sort on small runs?**
Because at small n the class is irrelevant and the constant is everything: insertion sort has
no allocation, no recursion, sequential access within a cache line, and a linear best case on
already-ordered runs — which merge and quick sorts produce as they go. A dozen elements sort
faster by insertion than by any recursive method's overhead. The same reasoning puts linear
search ahead of binary search below a few dozen elements.

**What makes a microbenchmark lie, and how do you prevent it?**
The JIT — warm up and time many iterations; dead-code elimination — consume the result;
constant folding — generate input at runtime; garbage-collection pauses — repeat and take the
median; the wrong size or input — measure at several sizes with the real distribution and the
worst case; the wrong clock — a monotonic high-resolution timer. On the JVM, use JMH, which
exists because a hand-written timing loop on HotSpot measures the wrong thing.

**Why is a linked list slower than its complexity suggests?**
Because each node lives wherever the allocator placed it, so every step of a traversal is
likely a cache miss at about a hundred nanoseconds, against a fraction of a nanosecond per
element for a contiguous array that the prefetcher streams. The constant-time insert is real;
the linear traversal to reach the insertion point costs two orders of magnitude more per step
than the array's linear shift. The JDK's own documentation recommends `ArrayDeque` over
`LinkedList` for stack and queue use.

---

← Prev: [09 · Best, average and worst](09-best-average-and-worst.md) · Index: [Phase 1 — Complexity analysis](README.md) · Next → **Proving optimality** *(not written yet)*
