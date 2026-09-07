---
title: "The cost of every built-in you call is a fact about the library, not a guess — sort is n log n and stable in both languages, a JavaScript Map is sublinear by spec and hashed in practice, ArrayList.get is constant and LinkedList.get is not, removing from the front of an array is linear, and the javadoc states each one"
sidebar_label: "07 · Complexity of the built-ins"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against MDN —
> [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort),
> [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map),
> [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set),
> [`shift`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift) —
> and the JDK 25 API documentation for
> [`Arrays`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Arrays.html),
> [`List.sort`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/List.html#sort(java.util.Comparator)),
> [`ArrayList`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ArrayList.html),
> [`LinkedList`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/LinkedList.html),
> [`ArrayDeque`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ArrayDeque.html),
> [`HashMap`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/HashMap.html),
> [`TreeMap`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/TreeMap.html),
> [`PriorityQueue`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/PriorityQueue.html)
> — all verbatim below. ⚠️ MDN states **no** bound for `push`, `pop`, `slice`, `splice`,
> `indexOf`, `includes`; those rows give the mechanism and say so. **No sandbox run; no timings.**

**A solution's bound is the sum of the built-ins it calls, and their costs are documented; a
candidate who guesses them is guessing the answer.** The JDK's API documentation states the
bound of nearly every collection operation in words — *"amortized constant"*, *"log(n) time
cost"*, *"linear time (roughly speaking)"*, *"traverse the list from the beginning or the end,
whichever is closer"* — and MDN states the ones the ECMAScript specification guarantees, which
are fewer: `sort` is stable and its complexity is *not* guaranteed, `Map` and `Set` are
sublinear on average and hashed in every real engine, and `shift` moves every element. For the
JavaScript methods MDN does not bound, the mechanism is the answer — `slice` copies, `splice`
shifts, `indexOf` scans — said as mechanism, not as a quoted bound. This page is the table in
each language, the quotes that back it, the three places candidates most often get a built-in
wrong, and the habit of saying the bound of a call as it is written.

## JavaScript

| Call | Bound | Basis |
|---|---|---|
| `a[i]`, `a.length` | Θ(1) | array semantics |
| `a.push(x)`, `a.pop()` | amortised Θ(1) | dynamic array — mechanism; MDN states no bound |
| `a.shift()`, `a.unshift(x)` | Θ(n) | MDN: *"shifts all values to the left by 1"* |
| `a.slice(lo, hi)`, `[...a]`, `a.concat(b)`, `Array.from(a)` | Θ(k) copied | copy — mechanism |
| `a.splice(i, k)` | Θ(n − i) | tail shift — mechanism |
| `a.indexOf(x)`, `a.includes(x)`, `a.find(f)` | Θ(n) | scan — MDN describes element-by-element comparison for `includes` |
| `a.sort(cmp)`, `a.toSorted(cmp)` | Θ(n log n) in every major engine; **stable** | MDN: stable since ES2019; *"The time and space complexity of the sort cannot be guaranteed"* |
| `a.reverse()`, `a.map`, `a.filter`, `a.reduce`, `a.forEach`, `a.join` | Θ(n) | one pass |
| `a.flat(d)` | Θ(total elements) | one pass over the result |
| `m.get(k)`, `m.set(k, v)`, `m.has(k)`, `m.delete(k)`; `s.has(x)`, `s.add(x)` | expected Θ(1); **sublinear by spec** | MDN: *"access times that are sublinear on the number of elements"*; hash table in practice |
| `for (const [k, v] of m)`, `m.size` | Θ(n), Θ(1) | insertion order preserved |
| `Object.keys(o)` | Θ(k) | builds an array of every key |
| `s.length` (string), `s[i]`, `s.charCodeAt(i)` | Θ(1) | UTF-16 code units |
| `s.slice`, `s.substring`, `s.split`, `s + t`, `s.repeat(n)` | Θ(result) | copy — mechanism; engines may use ropes or sliced strings, unguaranteed |
| `s.indexOf(t)`, `s.includes(t)` | up to Θ(n · m) naive; engines do better | search — mechanism; no bound documented |
| `Number(x)`, `parseInt`, `x.toString()` | Θ(digits) | — |

The three quotes the table rests on:

> *"Since version 10 (or ECMAScript 2019), the specification dictates that
> `Array.prototype.sort` is stable."* — *"The time and space complexity of the sort cannot be
> guaranteed as it depends on the implementation."* — MDN, `Array.prototype.sort()`

> *"The specification requires maps to be implemented "that, on average, provide access times
> that are sublinear on the number of elements in the collection". Therefore, it could be
> represented internally as a hash table (with O(1) lookup), a search tree (with O(log(N))
> lookup), or any other data structure, as long as the complexity is better than O(N)."* — MDN,
> `Map`

> *"The `shift()` method shifts all values to the left by 1 and decrements the length by 1,
> resulting in the first element being removed."* — MDN, `Array.prototype.shift`

What JavaScript does **not** have, and what to say instead: no heap (`PriorityQueue`), no
sorted map (`TreeMap`), no deque with constant-time front removal — a binary heap is written by
hand in fifteen lines, a sorted structure is emulated with a sorted array plus binary search
(Θ(n) insert) or written as a tree, a queue is an array with a head index
([phase 0's language page](../phase-0-the-interview-and-practice/04-language-choice-and-runtime-traps.md)).

## Java

| Call | Bound | The javadoc |
|---|---|---|
| `ArrayList.get(i)`, `set(i, x)`, `size()` | Θ(1) | *"The `size`, `isEmpty`, `get`, `set`, `getFirst`, `getLast`, `removeLast`, `iterator`, `listIterator`, and `reversed` operations run in constant time."* |
| `ArrayList.add(x)` | amortised Θ(1) | *"The `add`, and `addLast` operations runs in amortized constant time, that is, adding n elements requires O(n) time."* |
| `ArrayList.add(i, x)`, `remove(i)`, `contains`, `indexOf`, `remove(Object)` | Θ(n) | *"All of the other operations run in linear time (roughly speaking)."* |
| `LinkedList.get(i)` | Θ(n) — traverses from the nearer end | *"Operations that index into the list will traverse the list from the beginning or the end, whichever is closer to the specified index."* |
| `LinkedList.addFirst/Last`, `removeFirst/Last` | Θ(1) | doubly-linked — *"Doubly-linked list implementation of the `List` and `Deque` interfaces."* |
| `ArrayDeque.push/pop/offer/poll/peek` | amortised Θ(1) | *"Most `ArrayDeque` operations run in amortized constant time."* — and it *"is likely to be faster than `Stack` when used as a stack, and faster than `LinkedList` when used as a queue."* |
| `ArrayDeque.remove(Object)`, `contains` | Θ(n) | the same sentence's exceptions list |
| `HashMap.get/put/containsKey/remove`, `HashSet.add/contains` | expected Θ(1) | *"constant-time performance for the basic operations (`get` and `put`), assuming the hash function disperses the elements properly among the buckets."* |
| iterating a `HashMap` | Θ(capacity + size) | *"Iteration over collection views requires time proportional to the "capacity" of the `HashMap` instance (the number of buckets) plus its size"* |
| `TreeMap.get/put/remove/containsKey`, `TreeSet` | Θ(log n) **guaranteed** | *"This implementation provides guaranteed log(n) time cost for the `containsKey`, `get`, `put` and `remove` operations."* |
| `TreeMap.firstKey/lastKey/floorKey/ceilingKey` | Θ(log n) | navigable-map operations on a red-black tree |
| `PriorityQueue.offer/poll/add/remove()` | Θ(log n) | *"O(log(n)) time for the enqueuing and dequeuing methods"* |
| `PriorityQueue.peek/size` | Θ(1) | *"constant time for the retrieval methods"* |
| `PriorityQueue.remove(Object)`, `contains` | Θ(n) | *"linear time for the `remove(Object)` and `contains(Object)` methods"* |
| `Arrays.sort(int[])` | Θ(n log n), **not stable** (irrelevant for primitives) | dual-pivot quicksort, *"O(n log(n)) performance on all data sets"* |
| `Arrays.sort(Object[])`, `Collections.sort`, `List.sort` | Θ(n log n), **stable**; ~n on nearly sorted input | *"a stable, adaptive, iterative mergesort … If the input array is nearly sorted, the implementation requires approximately n comparisons."* — TimSort |
| `String.charAt(i)`, `length()` | Θ(1) | — |
| `String.substring`, `+`, `split`, `toCharArray` | Θ(result) | copies; `String` is immutable |
| `StringBuilder.append` | amortised Θ(1) | *"If the internal buffer overflows, it is automatically made larger."* |
| `Collections.reverse`, `Collections.max`, `String.indexOf` | Θ(n) | one pass |

And one sentence about `List.sort` on a `LinkedList` that is worth knowing because it is
counter-intuitive — the sort copies to an array first, on purpose:

> *"The default implementation obtains an array containing all elements in this list, sorts
> the array, and iterates over this list resetting each element from the corresponding position
> in the array. (This avoids the n² log(n) performance that would result from attempting to
> sort a linked list in place.)"* — JDK 25, `List.sort`

## The three built-ins candidates get wrong most

**1. `LinkedList` as a fast list.** Its `get(i)` walks from the nearer end — Θ(n) — so a loop
that indexes a `LinkedList` is quadratic; and as a queue or stack the javadoc says `ArrayDeque`
is likely faster. The honest uses of `LinkedList` in an interview are few: a `ListIterator`
that removes in the middle while walking, and nothing else that `ArrayDeque` or `ArrayList` does
not do better.

**2. `PriorityQueue.remove(Object)` as a heap operation.** Removing an arbitrary element is a
linear scan followed by a sift — the javadoc says linear — so a Dijkstra that "decreases a key"
by removing and re-adding is Θ(V) per update. The standard fix is lazy deletion: push the new
entry, and when an entry is polled, skip it if it is stale.

**3. JavaScript's `sort` on numbers without a comparator.** MDN: the default order converts
elements to strings and compares UTF-16 code units, so `[10, 9, 1].sort()` gives `[1, 10, 9]`.
The bound is the same n log n; the *answer* is wrong. `a.sort((x, y) => x - y)` — and in Java,
the equivalent trap is `Arrays.sort(Integer[])` with a comparator that subtracts and overflows
(`Integer.compare` instead).

```ts
// a heap, since JavaScript has none — Θ(log n) push and pop, Θ(1) peek
export class MinHeap {
  private h: number[] = [];
  get size(): number { return this.h.length; }
  peek(): number | undefined { return this.h[0]; }
  push(x: number): void {
    const h = this.h; h.push(x);
    for (let i = h.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (h[p] <= h[i]) break;
      [h[p], h[i]] = [h[i], h[p]]; i = p;
    }
  }
  pop(): number | undefined {
    const h = this.h;
    if (h.length === 0) return undefined;
    const top = h[0], last = h.pop()!;
    if (h.length) {
      h[0] = last;
      for (let i = 0;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < h.length && h[l] < h[m]) m = l;
        if (r < h.length && h[r] < h[m]) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]]; i = m;
      }
    }
    return top;
  }
}
```

```java
// Java: the same job is one line, with the javadoc's O(log n) offer/poll
PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> Integer.compare(a[0], b[0]));
```

## Saying the bound as you write the call

The habit that makes the final complexity statement easy: say the bound of each built-in as
the line goes down. "Sort — n log n, stable." "A map — expected constant per lookup." "`shift`
here — that's linear, I'll use an index instead." An interviewer hearing the costs arrive with
the code does not need to ask for them at the end, and a candidate saying them catches the
`includes`-in-a-loop before it is written rather than after the large test fails.

## Gotchas

**★ Symptom: `LinkedList.get(i)` inside a loop.** Cause: the list assumed to index in constant
time. Fix: the javadoc says it traverses from the nearer end — Θ(n) per call; use `ArrayList`,
or iterate with the iterator.

**★ Symptom: Dijkstra with `PriorityQueue.remove(entry)` to decrease a key.** Cause:
`remove(Object)` assumed logarithmic; it is linear per the javadoc. Fix: lazy deletion — push
the improved entry and skip stale ones on poll.

**★ Symptom: `[10, 9, 1].sort()` returns `[1, 10, 9]`.** Cause: MDN's default order — string
conversion, UTF-16 code-unit comparison. Fix: a numeric comparator, always.

**Symptom: "Map lookup is O(1), guaranteed."** Cause: engine behaviour stated as specification.
Fix: "sublinear by spec, hash table in practice — expected constant."

**Symptom: `Arrays.sort` on `int[]` cited as stable.** Cause: the two `Arrays.sort` families
conflated. Fix: primitives use dual-pivot quicksort, not stable (and it cannot matter);
objects use the stable TimSort — the class-level javadoc requires stability for `sort(Object[])`.

**Symptom: `list.remove(i)` in a loop over an `ArrayList`.** Cause: the tail shift per removal —
"linear time (roughly speaking)". Fix: `removeIf`, iterate backwards, or swap-with-last.

**Symptom: a `TreeMap` used where a `HashMap` would do.** Cause: "sorted map is safer". Fix:
guaranteed log n against expected constant — take the log n only when order, floor or ceiling
is needed.

**Symptom: a Java comparator `(a, b) -> a - b` on large ints.** Cause: overflow flips the sign.
Fix: `Integer.compare(a, b)`; the bound is unchanged, the order is wrong.

**Symptom: `ArrayDeque` rejected because "it's a deque, I need a stack".** Cause: the javadoc's
guidance unknown. Fix: *"likely to be faster than `Stack` when used as a stack"* — use it for
both.

**Symptom: `HashMap` iterated as if Θ(size).** Cause: the capacity term forgotten. Fix: the
javadoc's *"capacity plus size"*; an over-provisioned map iterates slowly, so do not set an
initial capacity far above the expected size.

## Interview questions

**★ What is the complexity of sorting in JavaScript and in Java, and is it stable?**
JavaScript: `Array.prototype.sort` is stable since ES2019 by specification, and n log n in every
major engine, but MDN says its time and space complexity cannot be guaranteed — say "n log n in
practice, stable by spec". Java: `Arrays.sort` on primitives is dual-pivot quicksort with
documented O(n log n) on all data sets and is not stable; on objects, and for `List.sort` and
`Collections.sort`, it is a stable adaptive mergesort — TimSort — that needs about n comparisons
on nearly sorted input.

**★ Why is `LinkedList` rarely the right answer in Java?**
Because indexing walks the list — the javadoc says operations that index traverse from the
nearer end — so `get(i)` is linear and a loop over indices is quadratic; and for its natural uses,
stack and queue, the `ArrayDeque` javadoc says it is likely faster than both `Stack` and
`LinkedList`. The one thing `LinkedList` does that `ArrayDeque` cannot is constant-time removal
in the middle through a `ListIterator`, which interviews rarely need.

**★ Is a JavaScript `Map` lookup O(1)?**
Expected constant in every real engine, which use hash tables; guaranteed only to be sublinear
on average by the specification, and MDN says a conforming engine could use a search tree with
logarithmic lookup. Say "O(1) expected, sublinear by spec". The Java parallel: `HashMap`'s
javadoc gives constant time assuming the hash function disperses the keys, and `TreeMap` gives
guaranteed log n.

**How do you decrease a key in Java's `PriorityQueue`, given that `remove(Object)` is linear?**
Lazy deletion: push a new entry with the better key and leave the old one in the heap; when an
entry is polled, compare it to the current best known value and skip it if stale. Each vertex
may have several entries, so the heap holds up to E entries and Dijkstra is Θ(E log E) — the
same class as with a decrease-key heap for the graphs interviews use.

**What does removing from the front of an array cost in each language, and what replaces it?**
Linear in both: JavaScript's `shift` shifts every remaining value left by one per MDN, and
`ArrayList.remove(0)` is in the javadoc's linear-time group. Replace with an index pointer into
a grow-only array, or a real deque — `ArrayDeque` in Java, which the javadoc documents as
amortised constant at both ends.

**Which JavaScript built-ins have no documented bound, and what do you say about them?**
`push`, `pop`, `slice`, `splice`, `concat`, `indexOf`, `includes`, string concatenation and
`substring` — MDN describes what they do, not how fast. Say the mechanism as the bound: `push`
is amortised constant as a dynamic array, `slice` and spread copy their range, `splice` shifts
the tail, `indexOf` and `includes` scan; and name the engine optimisations — ropes for string
concatenation, sliced strings — as unguaranteed, so the safe code uses `join` and indices.

---

← Prev: [06b · Hash keys, and the test for hidden loops](06b-hash-keys-and-the-test-for-hidden-loops.md) · Index: [Phase 1 — Complexity analysis](README.md) · Next → [08 · Recurrences and the master theorem](08-recurrences-and-the-master-theorem.md)
