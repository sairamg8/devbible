---
name: research-dsa-phase0
description: Banked primary-source quotes for docs/dsa/pages/phase-0-the-interview-and-practice/ (14 pages) — MDN Array.prototype.sort (stability, default order, comparator contract), MDN MAX_SAFE_INTEGER / BigInt, MDN too-much-recursion error strings, JDK 25 javadoc for PriorityQueue, TreeMap and Arrays.sort. Fetched once on 2026-09-07 by session 9602e64d. Do not re-derive.
metadata:
  type: reference
---

# Research bank — DSA phase 0 (fetched 2026-09-07, session `9602e64d`)

**Do not re-fetch.** Interview-format claims (what rounds grade, ladder names) have **no primary
source** — tendencies, never statistics; ladder sizes only as the syllabus already phrases them
("the 75-problem core", "the 150-problem set"). Runtime on this machine: `node -v` → **v24.20.0**
(T1 probe; corpus pin is Node 24 LTS). TypeScript is **not installed** here — no T1 probes on it.

## MDN — `Array.prototype.sort()`
URL: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
- *"Since version 10 (or ECMAScript 2019), the specification dictates that `Array.prototype.sort` is stable."*
- *"The default sort order is ascending, built upon converting the elements into strings, then comparing their sequences of UTF-16 code unit values."*
- compareFn: *"A negative value indicates that `a` should come before `b`. A positive value indicates that `a` should come after `b`. Zero or `NaN` indicates that `a` and `b` are considered equal."*
- *"A comparator conforming to the constraints above will always be able to return all of `1`, `0`, and `-1`, or consistently return `0`."*
- *"The time and space complexity of the sort cannot be guaranteed as it depends on the implementation."*

## MDN — `Number.MAX_SAFE_INTEGER`
URL: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER
- Value `9007199254740991`.
- *"Double precision floating point format only has 52 bits to represent the mantissa, so it can only safely represent integers between -(2^53 – 1) and 2^53 – 1. "Safe" in this context refers to the ability to represent integers exactly and to compare them correctly. For example, `Number.MAX_SAFE_INTEGER + 1 === Number.MAX_SAFE_INTEGER + 2` will evaluate to true, which is mathematically incorrect."*
- *"For larger integers, consider using `BigInt`."*

## MDN — "InternalError: too much recursion"
URL: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion
- Error strings: Chrome/V8 *"RangeError: Maximum call stack size exceeded"*; Firefox *"InternalError: too much recursion"*; Safari *"RangeError: Maximum call stack size exceeded"*.
- *"When there are too many function calls, or a function is missing a base case, JavaScript will throw this error."*
- ⚠️ MDN gives **no number** for the V8 stack depth. Do not state one. Say "a few thousand to low tens of thousands of frames depending on frame size" only as an unverified order of magnitude, or say "the limit is implementation-defined and small enough that a 10⁵-deep recursion fails".

## JDK 25 — `java.util.PriorityQueue`
URL: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/PriorityQueue.html
- *"The elements of the priority queue are ordered according to their natural ordering, or by a `Comparator` provided at queue construction time, depending on which constructor is used."*
- *"The head of this queue is the least element with respect to the specified ordering. If multiple elements are tied for least value, the head is one of those elements -- ties are broken arbitrarily."*
- *"Implementation note: this implementation provides O(log(n)) time for the enqueuing and dequeuing methods (`offer`, `poll`, `remove()` and `add`); linear time for the `remove(Object)` and `contains(Object)` methods; and constant time for the retrieval methods (`peek`, `element`, and `size`)."*
- *"Note that this implementation is not synchronized."* — use `PriorityBlockingQueue` across threads.
- *"The Iterator provided in method `iterator()` and the Spliterator provided in method `spliterator()` are not guaranteed to traverse the elements of the priority queue in any particular order."*

## JDK 25 — `java.util.TreeMap`
URL: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/TreeMap.html
- *"A Red-Black tree based `NavigableMap` implementation."*
- *"This implementation provides guaranteed log(n) time cost for the `containsKey`, `get`, `put` and `remove` operations."*
- *"Note that the ordering maintained by a tree map, like any sorted map, and whether or not an explicit comparator is provided, must be consistent with `equals` if this sorted map is to correctly implement the `Map` interface."*

## JDK 25 — `java.util.Arrays.sort`
URL: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Arrays.html
- `sort(int[])`: Dual-Pivot Quicksort (Yaroslavskiy, Bentley, Bloch); *"O(n log(n)) performance on all data sets"*.
- `sort(Object[])`: *"The algorithm used by `sort(Object[])` does not have to be a MergeSort, but it does have to be stable."* (from the Arrays class description). The per-method text says "This sort is guaranteed to be stable" — the fetch summary confirmed the class-level sentence only; quote that one.

## Not fetched
- Blind 75 / NeetCode / Striver pages — third-party lists; name them, no counts beyond the syllabus wording.
- V8 stack-size docs — none primary; see the MDN note above.

## Addendum 2026-09-07 — three more JDK 25 javadocs (fetched once, for page 12)
**`ArrayDeque`** — https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ArrayDeque.html
- *"This class is likely to be faster than Stack when used as a stack, and faster than LinkedList when used as a queue."*
- *"Null elements are prohibited."*
- *"Most ArrayDeque operations run in amortized constant time. Exceptions include remove, removeFirstOccurrence, removeLastOccurrence, contains, iterator.remove(), and the bulk operations, all of which run in linear time."*
**`HashMap`** — https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/HashMap.html
- *"This implementation provides constant-time performance for the basic operations (`get` and `put`), assuming the hash function disperses the elements properly among the buckets."*
- *"Iteration over collection views requires time proportional to the "capacity" of the `HashMap` instance (the number of buckets) plus its size (the number of key-value mappings)."*
- *"This implementation provides all of the optional map operations, and permits `null` values and the `null` key."*
- *"This class makes no guarantees as to the order of the map; in particular, it does not guarantee that the order will remain constant over time."*
**`ArrayList`** — https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ArrayList.html
- *"The `size`, `isEmpty`, `get`, `set`, `getFirst`, `getLast`, `removeLast`, `iterator`, `listIterator`, and `reversed` operations run in constant time."*
- *"The `add`, and `addLast` operations runs in amortized constant time, that is, adding n elements requires O(n) time."*
- *"All of the other operations run in linear time (roughly speaking)."*
- *"The iterators returned by this class's `iterator` and `listIterator` methods are fail-fast: if the list is structurally modified at any time after the iterator is created, in any way except through the iterator's own `remove` or `add` methods, the iterator will throw a `ConcurrentModificationException`."*
