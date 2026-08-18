---
title: "Boxing at scale"
sidebar_label: "3 · Boxing at scale"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 `IntStream`/`LongStream` and
> `Collectors` API documentation, the JLS SE 25 §5.1.7, and the JDK 25
> wrapper-class documentation; object-size arithmetic per JEP 519 and the
> HotSpot compressed-oops documentation (see [topic 01 chunk 2](../01-primitives-vs-references/02-references-and-memory.md)).

**One box is free. A million boxes are a data-structure decision. Boxing's
cost is not the conversion call — it is that every boxed value is a
separate heap object with a header, reached through a pointer, allocated at
the boxing site and collected later. This chunk is the map of where that
cost concentrates and the escape hatches, in the order you should reach for
them.**

## The accumulator loop — the canonical self-inflicted wound

```java
Long sum = 0L;                          // wrapper accumulator
for (long i = 0; i < n; i++) sum += i;  // unbox, add, RE-BOX — every pass
```

Each iteration is `sum = Long.valueOf(sum.longValue() + i)` — an allocation
per pass for every value outside the −128…127 cache. The fix costs one
character class: `long sum = 0L`. In streams the same mistake is
`stream.reduce(0L, Long::sum)` over a `Stream<Long>` — the primitive form
is `mapToLong(...).sum()`.

This is the shape to internalize: **a wrapper on the *left* of compound
assignment in a loop**. It appears in real code as running totals, counters
in maps, and "I made the field `Long` because it's nullable, then looped
over it".

## Where the boxes hide

| Site | What boxes | The primitive alternative |
|---|---|---|
| `List<Integer>`, `Set<Long>` | every element | `int[]`/`long[]` when the collection API isn't needed |
| `Map<Long, T>` keys | every key probe and entry | keep keys `long` in arrays / specialized structures — or accept it, maps are rarely the hot path |
| `Stream<Integer>` | every element through the pipeline | `IntStream`/`LongStream`/`DoubleStream`, `mapToInt`/`mapToLong` |
| `Collectors.counting()` | the counts are `Long` | fine — one box per group, not per element |
| varargs `Object...` (e.g. log params) | each primitive argument | guard hot-path logging (Phase 12), or the SLF4J two-arg forms |
| ternaries/mixed arithmetic | operands re-boxed | keep expressions all-primitive or all-wrapper |

The memory arithmetic behind the table (from
[topic 01](../01-primitives-vs-references/02-references-and-memory.md)):
an `Integer` is ~16 bytes plus the 4-byte reference to reach it — ~5× the
4-byte `int`, before cache-locality effects, which usually dominate: a
`long[]` iterates over contiguous memory, a `List<Long>` pointer-chases
across the heap.

## The escape hatches, in order

1. **Primitive locals and fields** — most boxing is accidental and local;
   fixing the declaration fixes the loop.
2. **Primitive streams** for pipelines: `mapToLong(...).sum()`,
   `average()`, `summaryStatistics()` — the terminal shortcuts only exist
   on the primitive specializations (Phase 4).
3. **Primitive arrays** where the structure is really "N numbers":
   `long[]`, plus `Arrays.sort`/`binarySearch` ([topic 09](../09-arrays.md)).
4. **Boxed collections when N is small — which it usually is.** A
   `List<Integer>` of request ids per page is not a problem and never will
   be. Readability wins.

**Measure before contorting** (Phase 12's JMH), but *know* where the cost
lives — the point of this chunk is that when the profiler shows allocation
in `Long.valueOf`, you recognize the shape in seconds.

## What not to do

- Don't hand-roll "primitive collections" — if profiling genuinely shows a
  boxed `Map<Long, T>` hot, the known third-party primitive-collection
  libraries exist; a bespoke open-addressing map in application code is a
  maintenance liability with a benchmark attached.
- Don't replace readable boxed code with arrays *speculatively* — the 5×
  memory factor matters at millions of elements, not dozens.
- Don't cache wrappers yourself (`static final Integer FORTY_TWO`) for
  "performance" — `valueOf` already caches the range that matters, and
  identity-sensitive code is the bug, not the optimization.

## Gotchas

**Symptom:** hot accumulation loop is slow and allocation-heavy in the profiler
**Cause:** a wrapper accumulator (`Long sum`) boxes and unboxes every iteration — one allocation per pass
**Fix:** primitive accumulator; for streams, `mapToLong(...).sum()` instead of `reduce` over boxed values

**Symptom:** allocation profile dominated by `Long.valueOf`/`Integer.valueOf`
**Cause:** a hot pipeline or loop boxing per element — usually a `Stream<Long>` where `LongStream` was available, or a wrapper-typed field forcing conversions
**Fix:** move the pipeline to the primitive specialization at the earliest `mapToX` point; check field types for accidental wrappers

**Symptom:** heap several times larger than the "sum of the data" back-of-envelope
**Cause:** boxed element storage — header + padding + reference per value, plus lost locality
**Fix:** primitive arrays for bulk numeric state; verify with a heap histogram (Phase 12), which will show the wrapper class at the top

**Symptom:** `stream.reduce(0L, Long::sum)` measurably slower than the loop it replaced
**Cause:** the reduce runs over boxed `Long`s — allocation per element — while the loop was primitive
**Fix:** `mapToLong(x -> x).sum()` — same declarative shape, primitive execution

**Symptom:** micro-optimization review: `List<Integer>` flagged in code handling 20 elements
**Cause:** cargo-culting this chunk without the scale condition
**Fix:** nothing — boxed collections at small N are idiomatic Java; the cost is real only in bulk

## Interview questions

**★ What is the performance story of boxed collections?**
Each element is a heap object (~16 bytes for an `Integer` plus the reference
— roughly 5× the primitive) allocated at boxing time and collected later,
reached by pointer rather than sitting contiguously. Fine at small N;
measurable in bulk pipelines — where `IntStream`/`LongStream` or primitive
arrays keep the numbers unboxed.

**★ Why is `Long sum = 0L` in a loop a classic mistake, and what exactly
happens per iteration?**
Compound assignment unboxes the wrapper, adds, and re-boxes:
`Long.valueOf(sum.longValue() + i)` — an allocation per pass outside the
cache range. The primitive declaration removes all of it.

**★ When do you reach for `IntStream` over `Stream<Integer>`?**
Whenever the pipeline is genuinely numeric — sums, averages, ranges
(`IntStream.range` for indexed iteration), statistics. Convert at the
earliest `mapToInt` and stay primitive until a terminal op or an
unavoidable `boxed()`.

**Why not always use arrays instead of boxed lists, then?**
Because the cost only matters at scale, and collections buy resizing,
richer APIs and clearer code. The engineering answer is a default
(collections) plus a known escape hatch (primitives) applied where
measurement — not superstition — says so.

**Where does boxing hide in logging and varargs APIs?**
`Object...` parameters box every primitive argument at the call site, even
when the log level filters the message out. Hot paths guard the call or use
the fixed-arity overloads the logging APIs provide for exactly this reason.

---

← Prev: [Unboxing NPEs and overload ambushes](02-unboxing-npes-overloads.md) · Index: [Autoboxing and the integer cache](README.md) · Next → [`var` — local-variable type inference](../03-var.md)
