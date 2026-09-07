---
title: "Java's traps are the ones that never throw — int overflow wraps silently, == on Integer compares references, a TreeMap comparator that ties loses keys, and String concatenation in a loop is quadratic — and its sorts are documented, so say what they guarantee"
sidebar_label: "04b · Java traps and sorting"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the JDK 25 API documentation for
> [`PriorityQueue`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/PriorityQueue.html),
> [`TreeMap`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/TreeMap.html) and
> [`Arrays`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Arrays.html), and MDN
> [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)
> for the stability comparison. Second half of topic 04; the JavaScript half is
> [04 · Language choice and traps](04-language-choice-and-runtime-traps.md). Code targets Java 25 and is
> written to be runnable; **nothing was run**.

**Java's interview traps share one property: none of them throws. An `int` that overflows wraps
to a negative number and the loop continues; `==` between two `Integer` objects returns `false`
for equal values outside the cached range and the branch is simply not taken; a `TreeMap` whose
comparator considers two distinct keys equal keeps one of them and drops the other; a `String`
built with `+=` in a loop finishes correctly and quadratically.** Each is a one-sentence
follow-up an interviewer can ask about working code, and each has a one-line habit that prevents
it — `long` and `Math.addExact`, `equals` or unboxing, a tie-breaking comparator, `StringBuilder`.
The compensation is that Java's sorts and collections are *documented*: `Arrays.sort` on objects
is required to be stable, `PriorityQueue` states its logarithmic cost, `TreeMap` guarantees
log n — so in Java you can say what a built-in guarantees rather than what you assume.

## Java trap 1 — `int` overflow is silent

`int` is 32-bit and wraps on overflow with no exception. A sum of two values near 2 × 10⁹, a
product of two values near 5 × 10⁴, or a midpoint computed as `(lo + hi) / 2` on large indices
all overflow. The habits: `long` for sums and products whose bound you have not checked;
`lo + (hi - lo) / 2` for midpoints; `Math.addExact` and `Math.multiplyExact` when you want the
exception rather than the wrap.

```java
int mid = lo + (hi - lo) / 2;          // never (lo + hi) / 2 on large arrays
long sum = 0;                          // accumulate in long, then check the range once
for (int x : nums) sum += x;
int checked = Math.multiplyExact(a, b); // throws ArithmeticException instead of wrapping
```

## Java trap 2 — boxing and `==`

Collections hold objects, so an `int` in a `List<Integer>` is boxed. Two consequences:

- **`==` on `Integer` compares references** outside the small cached range, so
  `list.get(i) == list.get(j)` can be false for equal values. Use `equals`, or unbox to `int`.
- **Boxing in a hot loop allocates.** A `Map<Integer, Integer>` counting frequencies over 10⁷
  values is measurably slower than an `int[]` when the key range allows; say the trade — the map
  is general, the array is fast — and pick by the constraints.

`TreeMap` is the sorted structure JavaScript lacks, with documented cost —
*"This implementation provides guaranteed log(n) time cost for the `containsKey`, `get`, `put`
and `remove` operations"* — and one requirement that bites when a comparator is supplied:
*"the ordering maintained by a tree map … must be consistent with `equals` if this sorted map is
to correctly implement the `Map` interface."* A comparator that considers two distinct keys
equal makes the map treat them as one key.

## Java trap 3 — strings copy

`String` is immutable, so `s += ch` in a loop builds a new string each time — O(n²) over the
loop. `StringBuilder` is the fix, and saying it aloud is expected. The same trap exists in
JavaScript in principle; engines optimise concatenation heavily, but a reviewer still prefers
`parts.push(ch)` then `parts.join('')` for clarity. Also in Java: `charAt` returns UTF-16 code
units, so a character outside the basic plane is two of them — the same caveat as JavaScript's
string indexing, and worth one sentence when the problem says "Unicode".

## Sorting in Java

`Arrays.sort` on primitives is Dual-Pivot Quicksort — *"O(n log(n)) performance on all data
sets"* per the JDK documentation — and on objects it is stable:

> *"The algorithm used by `sort(Object[])` does not have to be a MergeSort, but it does have to be
> stable."* — JDK 25, `java.util.Arrays`

So `Arrays.sort(int[])` is fast and unstable (irrelevant for primitives), `Arrays.sort(Object[])`
and `List.sort` are stable, and a comparator on `Integer` objects must return a consistent sign —
`Integer.compare(a, b)`, never `a - b`, which overflows for large values of opposite sign.

## Gotchas

**★ Symptom: Java two-sum returns the wrong pair on large inputs, no exception.** Cause: `int`
overflow in `target - nums[i]` or in a sum. Fix: `long` for the arithmetic, or `Math.addExact`;
state the bound assumption aloud when you keep `int`.

**Symptom: `list.get(i) == list.get(j)` is false for equal values.** Cause: `Integer` compared
by reference outside the cached range. Fix: `equals`, or unbox to `int` before comparing.

**Symptom: a `TreeMap` with a comparator on one field "loses" entries.** Cause: the comparator
considers two distinct keys equal, and the map, whose ordering must be consistent with `equals`,
treats them as one. Fix: break ties on a unique field in the comparator.

**Symptom: Java string building is quadratic.** Cause: `+=` on an immutable `String` in a loop.
Fix: `StringBuilder`; in TypeScript, collect parts and `join`.

**Symptom: `(lo + hi) / 2` returns a negative midpoint.** Cause: `lo + hi` overflowed `int`.
Fix: `lo + (hi - lo) / 2`, and say why.

**Symptom: a comparator `(a, b) => a - b` on Java `Integer`s sorts wrongly for extreme values.**
Cause: the subtraction overflows for operands of opposite sign. Fix: `Integer.compare(a, b)`.

## Interview questions

**★ What are the Java traps an interviewer expects you to know?**
Silent `int` overflow — use `long`, `Math.addExact`, and `lo + (hi - lo) / 2` for midpoints;
boxing — `==` on `Integer` compares references, and boxed collections allocate in hot loops, so
prefer primitive arrays when the key range allows; immutable strings — `StringBuilder` for
building; comparators — `Integer.compare`, never subtraction; and `TreeMap`'s requirement that
ordering be consistent with `equals`, so comparators must break ties on a unique field.

**Is Java's sort stable? Is JavaScript's?**
Java: `Arrays.sort` on object arrays and `List.sort` are required to be stable by the
documentation; `Arrays.sort` on primitives uses Dual-Pivot Quicksort, where stability is
meaningless. JavaScript: stable since ES2019 per the specification. Stability matters whenever a
solution sorts by one key after another — intervals by start then by end, or events by time then
by type — and relies on the earlier order surviving.

---

← Prev: [04 · Language choice and traps](04-language-choice-and-runtime-traps.md) · Index: [Phase 0 — The DSA interview and the practice system](README.md) · Next → **Reading the constraints** *(not written yet)*
