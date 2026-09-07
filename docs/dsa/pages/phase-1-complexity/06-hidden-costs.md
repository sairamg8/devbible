---
title: "The accidental quadratic hides in one token — a string built with +=, an array copied by slice or spread inside a loop, includes or indexOf where a set was needed, shift from the front of a queue, a substring taken per iteration — and it passes every small test and fails the large one"
sidebar_label: "06 · Hidden costs"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against MDN —
> [`includes`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes)
> (SameValueZero, element by element), [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set)
> (`has` faster than `includes` at equal size), [`shift`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift)
> (*"shifts all values to the left by 1"*) — and the JDK 25 javadocs for
> [`StringBuilder`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/StringBuilder.html)
> (capacity, *"automatically made larger"*), [`HashMap`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/HashMap.html)
> (load factor, rehash) and [`ArrayList`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ArrayList.html)
> (*"All of the other operations run in linear time (roughly speaking)"*). ⚠️ MDN documents **no**
> complexity for `push`, `slice`, `concat`, string `+` or `substring`; the costs below are the
> mechanism each call performs, and engine optimisations (rope strings, small-array fast paths)
> are named as unguaranteed. `String` immutability in Java is cited by class name, not quoted.
> **No sandbox run; no timings.**

**The quadratic that fails the large test is almost never a nested loop the candidate wrote; it
is a linear loop with a linear operation inside it, disguised as a single token.** `s += ch`
copies the string so far; `[...acc, x]` and `acc.concat(x)` copy the array so far;
`arr.includes(x)` and `arr.indexOf(x)` scan the array so far; `queue.shift()` moves every
remaining element; `s.substring(i)` copies the tail; `Object.keys(o)` builds an array of every
key; a hash map with a bad key function degrades toward a scan. Each is Θ(k) at the k-th
iteration and sums to Θ(n²), and each passes the small tests — the test with n = 10 cannot tell
n from n² — so the failure arrives on the last case, with no error, as a timeout. The
discipline is the one from [02](02-reading-complexity-off-code.md): a method call in a loop is a
loop in a loop until proven otherwise, and this page is the list of the ones that are — copies, scans
and shifts — in both languages, with the constant-time replacement for each; its sibling
[06b](06b-hash-keys-and-the-test-for-hidden-loops.md) is the hash map that stops being constant,
the object used as a map, and the test that catches every one of them.

## The list

| Inside a loop of n | What it does per call | Sum | Replace with |
|---|---|---|---|
| `s += ch` (JS), `s = s + ch` (Java) | builds a new string of the current length | Θ(n²) worst case | push to an array and `join` (JS); `StringBuilder` (Java) |
| `acc = [...acc, x]`, `acc.concat([x])` | copies the array | Θ(n²) | `acc.push(x)` — amortised constant |
| `arr.includes(x)`, `arr.indexOf(x)`, `list.contains(x)` | scans | Θ(n²) | `Set.has`, `HashSet.contains` |
| `queue.shift()` | shifts every remaining element left | Θ(n²) for a BFS | an index pointer, or a deque |
| `arr.splice(i, 1)`, `list.remove(i)` on an `ArrayList` | shifts the tail | Θ(n²) if done n times | swap-with-last and pop when order does not matter; a linked structure; mark-and-skip |
| `arr.unshift(x)`, `list.add(0, x)` | shifts everything right | Θ(n²) | push and reverse at the end; a deque |
| `s.substring(i)`, `s.slice(i)` per iteration | copies the tail (in Java, since 7u6, a copy) | Θ(n²) | indices into the original string |
| `arr.slice(lo, hi)` in a recursion | copies the range | adds Θ(n) per level; can make Θ(n) into Θ(n²) | pass `lo`, `hi` |
| `Object.keys(o)`, `Object.entries(o)` | builds an array of every key | Θ(k) per call | build once outside the loop; a `Map` |
| `arr.sort()` inside a loop | n log n per call | Θ(n² log n) | sort once; maintain order with a heap or a sorted structure |
| `JSON.stringify(key)` as a map key | serialises the object | Θ(size) per call — and it allocates | a composite primitive key: `` `${a},${b}` ``, or nested maps |
| `map.get(k)` with a hostile or bad hash | collides | toward Θ(n) per call | a key with a real hash; in Java, override `hashCode` with `equals` |

The right-hand column is the whole page; the rest is why.

## Strings: the += loop

A string is immutable in both languages — `String` in Java is documented as constant, and
JavaScript strings cannot be modified in place — so `s += ch` conceptually allocates a new
string holding all of `s` and `ch`. Over n iterations that is 1 + 2 + … + n copies, Θ(n²).

```ts
// quadratic in principle — each += is a copy of everything so far
export function joinSlow(parts: string[]): string {
  let s = '';
  for (const p of parts) s += p;
  return s;
}

// Θ(n): collect, then one join
export function joinFast(parts: string[]): string {
  return parts.join('');
}
// building character by character: push to an array of chars, join once at the end
```

The honest footnote for JavaScript: V8 and other engines represent many concatenations as a
*rope* — a tree of pieces flattened lazily — which makes the `+=` loop linear in practice much
of the time. That is an optimisation, not a guarantee, MDN documents none, and a candidate who
says "engines optimise it" without also saying "so I'd use `join` to be safe" has claimed a
bound the specification does not give. In Java there is no such rescue: each `+` in a loop
produces a new `String`, and the fix is the class built for it:

> *"Every string builder has a capacity. As long as the length of the character sequence
> contained in the string builder does not exceed the capacity, it is not necessary to allocate
> a new internal buffer. If the internal buffer overflows, it is automatically made larger."*
> — JDK 25, `StringBuilder`

```java
// Θ(n²): a new String per iteration
static String joinSlow(List<String> parts) {
    String s = "";
    for (String p : parts) s = s + p;
    return s;
}
// Θ(n): the builder grows geometrically — the dynamic-array argument of topic 03
static String joinFast(List<String> parts) {
    StringBuilder sb = new StringBuilder();
    for (String p : parts) sb.append(p);
    return sb.toString();
}
```

## Arrays: the copies that look like appends

```ts
// Θ(n²): a new array per element — the functional-looking accumulator is a copy loop
export function evensSlow(a: number[]): number[] {
  let acc: number[] = [];
  for (const x of a) if (x % 2 === 0) acc = [...acc, x];   // spread copies acc
  return acc;
}
// Θ(n): push is amortised constant
export function evens(a: number[]): number[] {
  const acc: number[] = [];
  for (const x of a) if (x % 2 === 0) acc.push(x);
  return acc;
}
```

`reduce((acc, x) => [...acc, x], [])` is the same quadratic in a shape that reads as idiomatic;
`acc.concat([x])` likewise. The reading rule catches all three: a fresh array literal or
`concat` in the body copies what it spreads.

`slice` in recursion is the same cost one level up — [02b](02b-recursion-as-a-tree.md) — and
the fix is the same: indices, not copies.

## Membership: includes where a set was needed

MDN describes `includes` as a comparison against the elements, and describes `Set.prototype.has`
as faster than it at equal size:

> *"The `includes()` method compares `searchElement` to elements of the array using the
> SameValueZero algorithm."* — MDN, `Array.prototype.includes`

> *"In particular, it is, on average, faster than the `Array.prototype.includes` method when
> an array has a `length` equal to a set's `size`."* — MDN, `Set`

So `seen.includes(x)` in a loop over n elements is Θ(n²) and `seen.has(x)` is expected Θ(n).
Java's `ArrayList.contains` is in the javadoc's "all of the other operations run in linear time
(roughly speaking)" — the replacement is `HashSet`. The subtle version: `indexOf` used to
*deduplicate* (`a.indexOf(x) === i`) or to find a position inside a loop over the same array —
quadratic in a single expression.

## Queues: shift from the front

> *"The `shift()` method shifts all values to the left by 1 and decrements the length by 1,
> resulting in the first element being removed."* — MDN, `Array.prototype.shift`

A BFS that dequeues with `shift` does that shift on every dequeue — Θ(V²) on a graph that
should be Θ(V + E). The fix costs one variable:

```ts
// Θ(V + E): the queue is an array that only grows; `head` is the front
export function bfsOrder(adj: number[][], start: number): number[] {
  const order: number[] = [];
  const seen = new Uint8Array(adj.length);
  const queue: number[] = [start];
  seen[start] = 1;
  for (let head = 0; head < queue.length; head++) {   // no shift — the array is never mutated at the front
    const u = queue[head];
    order.push(u);
    for (const v of adj[u]) if (!seen[v]) { seen[v] = 1; queue.push(v); }
  }
  return order;
}
```

`unshift` is the mirror — Θ(n) per call — and `splice(i, 1)` in a loop is the same shape in the
middle. In Java, `ArrayList.remove(0)` shifts too; `ArrayDeque` is the queue, amortised constant
at both ends per its javadoc.

## Substrings

`s.substring(i)` or `s.slice(i)` per iteration copies the remaining tail — Java's `String`
makes a copy on `substring` since 7u6, and JavaScript engines may or may not share the buffer
(sliced strings exist in V8; again unguaranteed). A loop that takes a substring per step to
"consume" input is Θ(n²); the fix is an index, and every parser and two-pointer solution is
written that way. The same goes for `split` inside a loop and for regular expressions compiled
per iteration.

## Gotchas

**★ Symptom: every visible test passes; the large hidden test times out.** Cause: an accidental
quadratic — one token in the loop body copying, scanning or shifting. Fix: read the body call by
call against the table above; the replacement is a `Set`, a `push`, an index, a builder.

**★ Symptom: `s += ch` in a loop and the interviewer asks "what does that cost?"** Cause:
immutable strings — a copy per concatenation in principle. Fix: array-and-`join` in JavaScript
(engines' rope optimisation is real but not guaranteed); `StringBuilder` in Java, whose buffer
grows geometrically.

**★ Symptom: `queue.shift()` in a BFS, and it is Θ(V²).** Cause: `shift` moves every remaining
element. Fix: an index into a grow-only array, or `ArrayDeque` in Java.

**Symptom: `acc = [...acc, x]` in a reduce, "because it's functional".** Cause: spread copies the
accumulator. Fix: `push` on a local array; return it at the end.

**Symptom: `a.indexOf(x) === i` to deduplicate.** Cause: a scan per element. Fix: a `Set` — or
`[...new Set(a)]` when order does not matter.

**Symptom: `substring(1)` per character to consume the input.** Cause: a copy of the tail per
step. Fix: an index; the string is never modified.

**Symptom: `arr.sort()` inside the loop to keep things ordered.** Cause: n log n per iteration.
Fix: a heap, or a binary-search insert into a sorted array when n is small, or sort once at the
end.

**Symptom: `splice(i, 1)` in a loop to remove matches.** Cause: a tail shift per removal — and
skipped elements when iterating forwards. Fix: `filter`, or iterate backwards, or swap-with-last
and pop when order does not matter.

## Interview questions

**★ Why does a solution pass all the visible tests and fail the hidden one?**
Because the visible tests are small and n is indistinguishable from n² at n = 10; a loop with a
linear operation inside it — a string concatenation, an array spread, an `includes`, a `shift`,
a `substring` — is quadratic and only shows it at the large size. The check is to read every
call in the loop body and ask whether its cost depends on something that grows with the loop;
if so, the call is a loop, and the fix is the constant-time replacement: a `Set`, a `push`, an
index, a builder.

**★ What does `s += ch` in a loop cost, and what is the fix in each language?**
In principle Θ(n²): strings are immutable, so each concatenation is a copy of everything so
far, and 1 + 2 + … + n copies is quadratic. In JavaScript, push the pieces to an array and
`join` once — engines often make `+=` linear with rope strings, but MDN documents no bound and
the optimisation is not guaranteed. In Java, `StringBuilder`, whose javadoc says the internal
buffer is automatically made larger when it overflows — the geometric growth of a dynamic array,
amortised constant per append.

**★ Why is BFS with `queue.shift()` slow, and what is the fix?**
MDN says `shift` shifts all values to the left by one, so each dequeue is linear in the queue's
length and the traversal is Θ(V²) instead of Θ(V + E). Keep the queue as a grow-only array with
an index for the front — `queue[head++]` — or use a deque; in Java, `ArrayDeque`, whose
javadoc gives amortised constant time at both ends.

**Is `acc.concat([x])` or `[...acc, x]` in a loop really quadratic?**
Yes: both produce a new array containing every element of `acc`, so the k-th iteration copies k
elements and the sum is Θ(n²). The functional shape hides it — `reduce` with a spread
accumulator reads as idiomatic — but the copy is in the semantics. `push` onto a local array is
amortised constant, and returning that array at the end gives the same result in Θ(n).

---

← Prev: [05 · The common classes and the limits](05-the-common-classes-and-what-the-limits-imply.md) · Index: [Phase 1 — Complexity analysis](README.md) · Next → [06b · Hash keys, and the test for hidden loops](06b-hash-keys-and-the-test-for-hidden-loops.md)
