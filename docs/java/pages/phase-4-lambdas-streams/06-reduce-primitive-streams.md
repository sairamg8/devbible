---
title: "reduce, and the primitive streams"
sidebar_label: "06 · reduce + primitive streams"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for
> `Stream#reduce` (all three overloads), `IntStream`, `LongStream`,
> `DoubleStream` (`sum`, `average`, `summaryStatistics`, `mapToObj`,
> `boxed`, `asLongStream`), `Stream#mapToInt`/`mapToLong`/`mapToDouble`,
> and `Math#addExact`/`toIntExact`.

**`reduce` folds a stream to one value; the primitive streams (`IntStream`,
`LongStream`, `DoubleStream`) make that fold cheap by keeping numbers
unboxed. The daily-work rule is short: summing a `Stream<Integer>` with
`reduce(0, Integer::sum)` allocates or unpacks a box per element, while
`mapToLong(...).sum()` runs on bare `long`s — so money, counters, and any
hot numeric path go through `mapTo*`. And money is `long` cents, never
`double`, for the phase-1 reason: binary floating point cannot represent
most decimal amounts.**

## The three overloads of `reduce`

```java
// 1 · identity + accumulator → T (total, even for an empty stream)
long total = orders.stream().reduce(0L, (acc, o) -> acc + o.totalCents(), Long::sum);

// 2 · accumulator only → Optional<T> (empty stream = empty Optional)
Optional<Order> biggest = orders.stream()
    .reduce((a, b) -> a.totalCents() >= b.totalCents() ? a : b);

// 3 · identity + accumulator + combiner → U (types differ; parallel-ready)
```

- **Overload 2** is the honest one for "largest / first-merged / longest":
  no identity exists, so an empty stream *must* produce `Optional.empty()`
  rather than a made-up zero value.
- **Overload 1**'s contract: the identity must satisfy
  `accumulator.apply(identity, t) == t` for every `t`. `0` for sum and `1`
  for product qualify; **`Integer.MIN_VALUE` for max does too — but `0` for
  max does not**: with all-negative input, `reduce(0, Math::max)` returns 0,
  a value that was never in the stream. Sequentially it's a wrong answer
  waiting for negative data; in parallel it's worse — the identity seeds
  *every* subtask, so a non-identity gets folded in once per split.
- **Overload 3** exists for type-changing folds (`Stream<Order>` →
  `long`). The combiner merges partial results; a sequential run never
  calls it, so a broken combiner passes every sequential test — same trap
  as a `Collector`'s combiner. In modern code this overload is almost
  always better written as `mapToLong(...).sum()` or a `collect`.

`reduce` is an **immutable** fold — each step makes a new value. Folding
*collections* or *strings* this way copies the accumulated result per
element (accidental O(n²)); that job belongs to
[collectors — mutable reduction](05-collectors/03-the-machine-underneath.md).

## Why `Stream<Integer>` arithmetic is slow: boxing

A `Stream<Integer>` holds pointers to `Integer` objects. Every
`reduce(0, Integer::sum)` step unboxes two, adds, and boxes the result —
an allocation per element beyond the `Integer` cache (−128..127, phase 1
topic 02). The primitive specializations hold bare values:

```java
long revenue = orders.stream()
    .mapToLong(Order::totalCents)   // LongStream — no boxes from here on
    .sum();
```

Crossings between the worlds, by name:

| From → to | Operation |
|---|---|
| `Stream<T>` → `IntStream` | `mapToInt(T → int)` (also `mapToLong`, `mapToDouble`) |
| `IntStream` → `Stream<Integer>` | `boxed()` — one box per element, on purpose |
| `IntStream` → `Stream<T>` | `mapToObj(int → T)` |
| `IntStream` → `LongStream` | `asLongStream()` — widening, lossless |
| `IntStream` → `DoubleStream` | `asDoubleStream()` — ⚠ large `long`s lose precision in the `double` world |

The primitive streams carry the numeric terminals the object stream lacks:
`sum()`, `min()`/`max()` (no comparator needed), `average()` — which
returns **`OptionalDouble`**, empty for an empty stream, because an average
of nothing has no honest default — and `summaryStatistics()`:

```java
LongSummaryStatistics stats = orders.stream()
    .mapToLong(Order::totalCents).summaryStatistics();
// stats.getCount(), getSum(), getMin(), getAverage(), getMax() — one pass
```

`IntStream.range(0, n)` / `rangeClosed(1, n)` are also the stream answer to
"I need the index" — `range(0, items.size()).mapToObj(i -> ...)`.

## Money: `long` cents, exact overflow, never `double`

The phase-1 rule (topic 05) applied to streams:

```java
long totalCents = orders.stream().mapToLong(Order::totalCents).sum();
```

- **Never `mapToDouble` for currency.** `0.1 + 0.2 != 0.3` in binary
  floating point; a million-row sum drifts by real cents. `double` also
  represents integers exactly only up to 2⁵³ — big ledgers quietly round.
- **`sum()` on `IntStream`/`LongStream` wraps on overflow** like the `+`
  it is built on (phase 1 topic 04). `int` cents overflow at ~$21 million —
  an amount real ledgers reach. Keep cents in `long` end to end; for
  ledger-grade honesty fold with `Math::addExact` so overflow throws
  `ArithmeticException` instead of going negative:

```java
long exact = orders.stream().mapToLong(Order::totalCents)
    .reduce(0L, Math::addExact);
```

- Narrowing back to `int` at an API boundary is `Math.toIntExact(value)` —
  throws on truncation, where `(int) value` silently mangles.
- Fractional-cent domains (interest, FX) are `BigDecimal` territory —
  streamed via `reduce(BigDecimal.ZERO, BigDecimal::add)`, an immutable
  fold that is genuinely fine because `BigDecimal` addition is the real
  cost, not the allocation.

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `reduce(0, Math::max)` returns 0 from an all-negative stream | 0 is not an identity for max — it's a phantom element | Overload 2 (`Optional` result), or identity `Integer.MIN_VALUE`, or `IntStream.max()` |
| Numeric pipeline allocates gigabytes, GC churn in profiles | Arithmetic on `Stream<Integer>`/`Stream<Long>` — box per step | `mapToInt`/`mapToLong` at the earliest point; `boxed()` only at the exit if a collection is needed |
| Revenue total off by cents at scale | Currency summed via `double` anywhere in the pipe | `long` cents + `mapToLong(...).sum()`; `BigDecimal` for fractional cents |
| Ledger total suddenly negative | `sum()` wrapped — silent two's-complement overflow (int cents, or astronomic longs) | `long` cents; `reduce(0L, Math::addExact)` where wrong-must-throw |
| `average()` result won't assign to `double` | It returns `OptionalDouble` — empty stream has no average | `orElse(...)` with a value you can defend, or handle emptiness explicitly |
| Parallel type-changing `reduce` gives wrong results; sequential fine | Combiner inconsistent with accumulator — never exercised sequentially | Prefer `mapToLong().sum()`/`collect`; if overload 3 stays, test the combiner directly |
| Quadratic runtime concatenating strings/lists via `reduce` | Immutable fold copies the whole accumulation per element | `Collectors.joining()` / `toList()` — mutable reduction |
| Huge `long` ids corrupted after a stream hop | `asDoubleStream()`/`mapToDouble` en route — `double` holds only 53 exact bits | Stay in `LongStream`; `double` is for measurements, not identifiers |

## Interview questions

1. **"Why does `reduce` have an overload returning `Optional`?"** — Without
   an identity, an empty stream has no defensible result; `Optional.empty()`
   is the honest encoding. The identity overload never needs it because the
   identity *is* the empty answer.
2. **"What makes a valid identity? Why is `0` wrong for max?"** —
   `acc(identity, t)` must equal `t` for all `t`; `max(0, -5) == 0 ≠ -5`.
   Wrong answers on all-negative input sequentially; in parallel the
   identity seeds every subtask, compounding the error.
3. **"Sum the totals of a million orders — fastest correct way?"** —
   `mapToLong(Order::totalCents).sum()`: unboxed `long` lane, no per-element
   allocation. Bonus points for `reduce(0L, Math::addExact)` when overflow
   must throw rather than wrap.
4. **"Why are streams of `Integer` slower than `IntStream`?"** — Pointer
   chasing plus box/unbox per operation, allocation beyond the −128..127
   cache, GC pressure — versus sequential primitive values.
5. **"`boxed()` vs `mapToObj(Integer::valueOf)`?"** — Same result;
   `boxed()` is the named shorthand. Real question: why box at all — only
   at the boundary where a `List<Integer>` or generic API demands objects.
6. **"When is the three-arg `reduce`'s combiner called?"** — Parallel
   execution only, to merge subtask results. So sequential tests can't
   validate it — same lesson as the `Collector` combiner.
7. **"Why is `double` wrong for money even though the sums 'look right'?"**
   — Most decimal fractions have no finite binary representation; error
   accumulates with scale, and beyond 2⁵³ even whole numbers stop being
   exact. Cents-in-`long` makes every value and sum exact until genuine
   overflow — which `addExact` turns from silence into a signal.
8. **"An average per group *and* the empty-group problem?"** — Per group,
   `averagingLong` (a collector, returns `Double`, never sees an empty
   group because groups form from elements); standalone,
   `LongStream.average()` returning `OptionalDouble` forces the
   empty-stream decision at the call site. Two APIs, same honesty question.

---

← Prev: [Collectors](05-collectors/README.md) · Index: [Phase 4 — Lambdas, streams and Optional](README.md) · [Next → `Optional` used correctly](07-optional/README.md)
