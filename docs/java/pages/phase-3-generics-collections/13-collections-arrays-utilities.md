---
title: "Collections and Arrays utilities"
sidebar_label: "13 · Collections/Arrays utilities"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JDK 25 API documentation for
> `java.util.Collections` and `java.util.Arrays` (including the sort and
> `binarySearch` contracts and the dual-pivot quicksort / TimSort notes in the
> Javadoc), and `java.util.Objects`.

**Two static utility classes carry the algorithms the collection types
themselves don't: `Collections` for anything that is a `Collection` or
`List`, `Arrays` for raw arrays. The methods are small, old, and heavily
contracted — `binarySearch` is undefined on unsorted input, `asList` is a
fixed-size view, `shuffle` needs a `RandomGenerator` you control if a test
ever has to reproduce it. Knowing the contract line of each is the whole
skill.**

## `Collections` — the `List`/`Collection` algorithms

| Method | What it does | The contract line that bites |
|---|---|---|
| `sort(list)` / `sort(list, cmp)` | stable sort in place | list must be modifiable; elements mutually comparable or the comparator total ([topic 10 · Comparable vs Comparator](10-comparable-comparator/README.md)) |
| `binarySearch(list, key)` | O(log n) lookup | **list must already be sorted in the same order** — otherwise the result is undefined, not an exception |
| `shuffle(list)` / `shuffle(list, rnd)` | random permutation | pass your own `Random`/generator for reproducible tests |
| `reverse`, `rotate`, `swap` | in-place rearrangement | need a modifiable list |
| `fill(list, obj)` | overwrite every element | does **not** grow the list — size stays what it was |
| `nCopies(n, obj)` | immutable list of n references to *one* object | mutate the object and every "copy" changes |
| `frequency(coll, obj)` | count `equals` matches | O(n) scan — inside a loop it is O(n²) |
| `disjoint(a, b)` | true if no element in common | uses `equals`; cost depends on the second argument's `contains` |
| `max`/`min` | extreme by natural order or comparator | throws `NoSuchElementException` on empty |
| `unmodifiableList` etc. | read-only **view** | the backing list can still change under it ([topic 12](12-immutable-collections.md)) |
| `emptyList`, `singletonList` | legacy fixed instances | superseded by `List.of()` in new code |

The sort behind `Collections.sort` and `list.sort(cmp)` is the same
algorithm: a stable, adaptive TimSort, as the Javadoc documents — sorted and
nearly-sorted inputs run close to O(n).

## `Arrays` — the same jobs for raw arrays

- **`Arrays.sort(int[])`** — dual-pivot quicksort for primitives (the
  Javadoc's own description): fast, in place, **not stable** — irrelevant for
  primitives, since equal ints are indistinguishable.
- **`Arrays.sort(T[])` / `sort(T[], cmp)`** — TimSort, stable, because for
  objects stability is observable and callers depend on it.
- **`Arrays.binarySearch`** — same sorted-input contract as the
  `Collections` version; the negative return is `-(insertionPoint) - 1`, so
  a "not found" result still tells you where the element would go.
- **`Arrays.fill(arr, v)`**, **`Arrays.setAll(arr, i -> f(i))`** — bulk
  initialize; `setAll` gets the index, so it can compute per-slot values.
- **`Arrays.copyOf(arr, n)`**, **`copyOfRange(arr, from, to)`** — the copy
  methods everything else is built on; `to` may exceed `length` and pads
  with defaults. Both shallow.
- **`Arrays.equals` / `deepEquals` / `hashCode` / `deepHashCode` /
  `toString` / `deepToString`** — the `Object` methods arrays never
  overrode, as functions. `deep*` variants recurse into nested arrays; the
  plain ones compare nested arrays by reference.

The traps of `Arrays.asList` — the fixed-size view, the primitive-array
one-element surprise, the write-through to the backing array — are covered
with the array story itself in
[Phase 1's arrays topic](../phase-1-language-core/09-arrays.md); the modern
replacements are `List.of` and `Arrays.stream(...).toList()`.

## Choosing between the overloads

```java
List<Order> byDate = new ArrayList<>(orders);
byDate.sort(comparing(Order::placedAt));          // modern: method on List

int i = Collections.binarySearch(byDate, probe,
        comparing(Order::placedAt));              // same comparator — or undefined
```

The rule for `binarySearch` in both classes: **search with exactly the order
you sorted with.** Sorting by date and searching by natural order compiles
fine and returns garbage — the contract makes the result undefined rather
than throwing, because detecting unsortedness would cost the O(n) the method
exists to avoid.

`Objects` (not `Collections`) carries the null-safe scalar helpers —
`Objects.equals`, `hashCode`, `requireNonNull`
([Phase 1, topic 13](../phase-1-language-core/13-null-and-npe/README.md)) —
worth knowing as the third utility class in the same spirit.

## Gotchas

**Symptom:** `binarySearch` misses an element that is definitely in the list
**Cause:** the list wasn't sorted, or was sorted with a different comparator than the search uses — the contract says the result is *undefined*, so nothing throws
**Fix:** sort and search with the same comparator object; if the data arrives unsorted, a `HashSet`/`HashMap` lookup beats sort-then-search anyway

**Symptom:** `UnsupportedOperationException` from `Collections.sort`
**Cause:** the list is unmodifiable (`List.of`, `unmodifiableList`) or fixed-size-with-`set` (`Arrays.asList` allows `sort` — but `List.of` does not)
**Fix:** copy first: `new ArrayList<>(list)`, sort the copy — or build sorted with `stream().sorted().toList()`

**Symptom:** every element of a `nCopies`/`fill` result changes at once
**Cause:** both install n references to the **same** object, not n copies
**Fix:** fine for immutable values; for mutable ones, generate per-slot — `Stream.generate(Foo::new).limit(n).toList()` or `Arrays.setAll`

**Symptom:** a shuffled-order bug cannot be reproduced in a test
**Cause:** `Collections.shuffle(list)` uses a fresh default randomness source per call
**Fix:** `shuffle(list, new Random(seed))` — inject the seed in tests; treat unseeded shuffle as production-only

**Symptom:** `Arrays.equals` says two `String[][]`s differ though every element matches
**Cause:** plain `equals` compares nested arrays by reference — one level deep only
**Fix:** `Arrays.deepEquals` (and `deepHashCode`/`deepToString` for the same reason)

**Symptom:** test flakiness after replacing `Collections.sort` with a hand-rolled comparator sort on primitives boxed into objects
**Cause:** primitive `Arrays.sort` is unstable; object sorts are stable — code that silently depended on stability breaks when elements move between the two worlds
**Fix:** when equal elements' relative order matters, sort objects (TimSort) or add a tiebreaker to the comparator

**Symptom:** `Collections.frequency` in a loop makes a page time out
**Cause:** each call is a full O(n) scan — the loop is O(n²)
**Fix:** one pass into a count map: `groupingBy(identity(), counting())`

## Interview questions

**★ Why is `binarySearch` on an unsorted list "undefined" instead of an exception?**
Verifying sortedness costs O(n), which would erase the O(log n) the method
exists for. The contract shifts responsibility to the caller — the classic
Java-library pattern of documenting a precondition rather than checking it.

**★ Why does Java use two different sort algorithms in `Arrays.sort`?**
Stability is observable only for objects — equal primitives are
indistinguishable. So primitives get dual-pivot quicksort (fast, in place,
unstable) and objects get TimSort (stable, adaptive, at the cost of a
working buffer). The Javadoc states both.

**★ What does a negative return from `binarySearch` encode?**
`-(insertionPoint) - 1`. It is always negative (even for insertion point 0),
and one decode — `-(result) - 1` — gives where the key belongs, which makes
sorted-insert possible without a second search.

**★ `Collections.unmodifiableList(list)` vs `List.copyOf(list)`?**
The first is a live read-only *view* — mutations to the backing list show
through it. The second is an independent immutable snapshot. Passing a view
to a caller while you keep the backing reference is how "immutable" lists
change under the reader — [topic 12](12-immutable-collections.md) works the
distinction.

**Why does `Arrays.asList` support `set` but `List.of` doesn't?**
`asList` is a *view over the caller's array* — writes are its purpose;
size can't change because the array's can't. `List.of` is a from-scratch
immutable value with no backing structure to write through to.

**When is `Collections.swap`/`rotate` worth knowing?**
In-place algorithm work over a `List` without dropping to arrays —
`rotate(list, k)` is the idiomatic "shift by k" and is O(n) with O(1) space,
which a slice-and-concat rewrite is not.

---

[← Prev: Immutable collections](12-immutable-collections.md) · Next → [Choosing a collection](14-choosing-a-collection/README.md)
