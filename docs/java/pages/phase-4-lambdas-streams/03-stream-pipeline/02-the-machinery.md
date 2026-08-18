---
title: "The machinery"
sidebar_label: "2 · The machinery"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 Javadoc for `Spliterator`,
> `BaseStream`, `Stream.unordered`, and the `java.util.stream` package
> summary ("Ordering", "Low-level stream construction").

**Under the fluent API there are exactly three moving parts: a
`Spliterator` that knows how to traverse (and split) the source, a linked
chain of operation objects your calls build up, and a terminal-triggered
drive loop that pushes elements from the spliterator down the chain. You
don't need the internals to *use* streams — you need them to answer the
"why" questions: why a stream dies after one use, why encounter order
sometimes costs real money, and why `count()` can answer without looking
at a single element.**

## `Spliterator` — the source's contract

Every stream source supplies a `Spliterator<T>` (JDK 8's iterator-for-
streams). Its Javadoc defines the pieces the pipeline machinery uses:

- `tryAdvance(Consumer)` — hand me one element (the sequential drive).
- `trySplit()` — split off a chunk for another thread (the parallel
  drive; a `HashMap`'s spliterator splits by bucket ranges, an
  `ArrayList`'s by index halving).
- `estimateSize()` / `getExactSizeIfKnown()` — how much is coming.
- `characteristics()` — a bit set the pipeline optimizes against:
  `ORDERED`, `SORTED`, `SIZED`, `SUBSIZED`, `DISTINCT`, `NONNULL`,
  `IMMUTABLE`, `CONCURRENT`.

Characteristics are why identical-looking pipelines perform differently by
source: an `ArrayList` spliterator reports `ORDERED | SIZED | SUBSIZED`
(perfect splitting, exact sizes); a `HashSet`'s reports `SIZED` but not
`ORDERED` (no order to preserve — cheaper); an infinite
`Stream.generate` reports neither (nothing to optimize).

## The pipeline is a linked chain of ops

Each intermediate call allocates a small object referencing its upstream
stage — building `source → filter → map → distinct` is four allocations
and zero data movement. When the terminal op runs, the chain is walked
once to compose the per-element behaviour, then the drive loop starts:
pull from the spliterator, push through the composed stages.

Two practical consequences:

- **Stages fuse.** There is no per-stage queue or buffer (stateless ops);
  `filter`+`map` execute as one composed function per element. The
  performance model is "one virtual call chain per element", not "N
  passes".
- **The chain records, it doesn't copy.** Reassigning
  `stream = stream.filter(...)` in a loop builds a deeper chain — legal,
  and each element will traverse every accumulated stage.

## One use only — `IllegalStateException`

A stream is bound to its spliterator; driving it consumes it. The
`BaseStream` Javadoc: a stream should be operated on only once, and a
reuse "may throw `IllegalStateException`" — in practice the JDK
implementation does:

```java
Stream<String> s = names.stream();
long n = s.count();
// s.forEach(...)   // ✗ IllegalStateException: stream has already been operated upon or closed
```

The subtle version is aliasing through a variable or a helper that
"returns the stream" twice. If two consumers need the data, the data —
not the stream — must be reusable: re-call `collection.stream()`, or
collect once and stream the collection twice. A `Supplier<Stream<T>>` is
the idiom when the source itself is re-streamable:

```java
Supplier<Stream<Order>> big = () -> orders.stream().filter(o -> o.total() > 100);
long count = big.get().count();
List<Order> list = big.get().toList();   // a fresh pipeline each time
```

## Encounter order — and paying for it

*Encounter order* is the order the source presents elements — a `List`
has one, a `HashSet` doesn't. The package doc's "Ordering" section sets
the rules:

- An **ordered** stream must produce results *as if* processed in
  encounter order. Sequentially this is free — that's the order anyway.
- In **parallel**, preserving order costs: `limit(n)` on an ordered
  parallel stream must buffer and coordinate to return the *first* n, not
  *any* n; `distinct()` must keep the first duplicate, not an arbitrary
  one; `forEach` explicitly abandons order (use `forEachOrdered` to buy
  it back).
- `unordered()` is an intermediate op that *removes* the ORDERED
  characteristic — a declaration that any n / any representative will do,
  unlocking the cheap implementations. It never *shuffles* anything; it
  only releases a promise.
- Sorting *imposes* order: after `sorted()`, the stream is ordered
  regardless of source.

The design consequence: if your logic is order-insensitive (counting,
summing, set-building), say so — source from a `Set`, or add
`unordered()` — and the machinery may go faster; if it is
order-sensitive, never source it from a `HashSet` and hope.

## Sized streams and the shortcuts they enable

`SIZED` means the spliterator knows exactly how many elements are coming;
`SUBSIZED` means splits will too. The machinery exploits this:

- `toArray`/`toList` on a SIZED pipeline allocates the result array once,
  exactly — no growth copies.
- `count()` on a SIZED source *with no size-changing or effectful stages*
  returns `estimateSize()` without traversing (the documented `peek`
  eraser from chunk 1).
- Parallel splitting can hand out perfectly balanced index ranges instead
  of guessing.

`filter` and `flatMap` *clear* SIZED (the size is no longer known);
`map` and `sorted` keep it. This is why moving a `filter` later — or
replacing it with a `map` to a sentinel plus downstream handling — can
change allocation behaviour, and why `mapMulti` (JDK 16+) documents
itself as an alternative to `flatMap` partly on such grounds.

## Gotchas

**Symptom:** `IllegalStateException: stream has already been operated upon or closed`
**Cause:** two terminal ops (or a terminal plus a reuse) on one stream object — often hidden behind a field or helper method returning a cached stream
**Fix:** streams are one-shot; hold the *source* (or a `Supplier<Stream<T>>`) and build a fresh pipeline per consumption

**Symptom:** storing a stream in a field "for later" fails intermittently
**Cause:** something else consumed it first — a stream is consumable state, not a reusable view
**Fix:** store the collection; expose `Stream<T> items() { return list.stream(); }` so every caller gets a fresh one

**Symptom:** `parallelStream().limit(10)` far slower than expected on a huge list
**Cause:** ordered + parallel + `limit` = the machinery must identify the *first* ten in encounter order, buffering and cancelling across threads
**Fix:** if any ten will do, add `.unordered()`; if the first ten are required, take them sequentially — `stream().limit(10)` is O(10)

**Symptom:** results from a `HashSet`-sourced pipeline come out in a different order across runs/JDKs
**Cause:** the source has no encounter order, so the stream never promised one
**Fix:** if order matters, sort explicitly (`sorted(...)`) or source from an order-carrying collection (`List`, `LinkedHashSet`)

**Symptom:** `unordered()` "didn't shuffle" the stream in a test asserting randomness
**Cause:** misread contract — `unordered()` only clears the ORDERED promise; implementations may still happen to preserve order
**Fix:** it is an optimization hint, never a shuffle; use `Collections.shuffle` on a list for actual randomization

**Symptom:** identical pipeline much slower sourced from a generator than from an `ArrayList`
**Cause:** characteristics — no SIZED/SUBSIZED means result buffers grow by copying and parallel splits are lopsided
**Fix:** when the size is knowable, use a sized source (`IntStream.range`, a collection); check `spliterator().characteristics()` when diagnosing

**Symptom:** after `filter`, `toArray` shows growth-copy behaviour that wasn't there before
**Cause:** `filter` clears SIZED — the machinery can no longer preallocate exactly
**Fix:** usually accept it; if hot, count first or collect into a presized structure — and measure before optimizing

## Interview questions

**★ What three things does a `Spliterator` provide beyond an `Iterator`, and which stream feature does each enable?**
`trySplit()` (divides the source — parallel execution),
size estimation (`estimateSize`/`getExactSizeIfKnown` — exact result
preallocation, traversal-free `count`), and `characteristics()`
(ORDERED/SIZED/DISTINCT/SORTED… — per-source optimizations like skipping
order bookkeeping for a `HashSet`).

**★ Why exactly is a stream single-use, when a collection isn't?**
A stream wraps a *traversal in progress* — a spliterator with a position —
plus a composed op chain; after the terminal op the spliterator is spent.
A collection owns its data and can mint unlimited fresh spliterators.
That's the API split: data lives in collections, computation descriptions
in streams; re-computing means re-streaming.

**★ What does `unordered()` actually do, and when would you call it?**
It clears the ORDERED characteristic — no reordering, just releasing the
promise that results reflect encounter order. Call it on parallel
pipelines whose semantics are order-free (counting, set-building,
`limit`-any-n, `distinct`-any-representative) so the implementation can
skip the coordination that order preservation costs.

**★ Why is `limit` cheap sequentially and potentially expensive in parallel?**
Sequentially it's a counter: stop after n pulls. In parallel *with
encounter order*, "the first n" is a global property — chunks processed
out of order must buffer results until the machinery knows which are the
first n, and later chunks' work may be discarded. Unordered parallel
`limit` collapses back to "any n" and is cheap again.

**★ How can `count()` return without executing your `peek`, and what rule does that teach?**
The pipeline consults characteristics: a SIZED source with no
size-changing stages means the answer is `estimateSize()` — the drive
loop never runs, so no behavioural parameter does either. The rule: ops
promise *results*, not *execution*; anything you need to happen must be
the terminal op's job.

**What happens, mechanically, between `list.stream().filter(f).map(m)` and `.toList()` returning?**
The three calls before the terminal built a chain of stage objects — no
data touched. `toList()` walks the chain to compose a per-element sink
(filter wrapping map wrapping the accumulator), asks the source for its
spliterator, then drives `tryAdvance` until exhausted, pushing each
element through the composed sink; SIZED info, if intact, preallocated
the result.

**A code review shows `Stream<User> users` as a method return type. Argue for and against.**
For: lazily conveys possibly-large or I/O-backed data without
materializing; the caller composes further stages cheaply. Against: it's
one-shot (a second consumer breaks), can't be inspected/sized without
consuming, and if it wraps a resource the *caller* inherits an
undocumented close obligation. Default to returning the collection;
return a stream only when laziness is the point and document the
single-use/closing contract.

---

← Prev: [Lazy until terminal](01-lazy-until-terminal.md) · Next → [Pipelines in practice](03-pipelines-in-practice.md)
