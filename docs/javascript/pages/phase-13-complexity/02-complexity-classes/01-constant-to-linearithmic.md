---
title: "02.1 · O(1) to O(n log n)"
sidebar_label: "01 · O(1) to O(n log n)"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort), [`Array.prototype.push()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push). Documentation-validated; **no timings**.

**These four classes cover almost everything you will write.** The exponential ones in
[02 · O(n²) and worse](./02-quadratic-and-worse.md) are what you are trying to avoid; these are
what you are trying to reach.

## O(1) — constant

The cost does not depend on n.

```js
arr[i];                      // index access
arr.length;
obj.key;                     // property access on a plain object
map.get(key);                // sublinear — see the caveat below
set.has(value);
arr.push(x);                 // amortised O(1)
arr.pop();
```

🔴 **"Constant" means "independent of n", not "fast".** A network round trip is O(1) and takes
100 ms; a hash lookup is O(1) and takes nanoseconds. The notation cannot tell them apart, which
is why an O(1) claim in a design discussion should be followed by "…of what?"

⚠️ **`Map.get` is not specified as O(1).** MDN, quoting the requirement:

> "The specification requires maps to be implemented 'that, on average, provide access times that
> are **sublinear** on the number of elements in the collection'."

Hash tables in practice, sublinear by guarantee. In an interview, "sublinear — hash table in every
real engine" is the answer that shows you have read the spec rather than a blog post.

**The `push` caveat is amortisation.** A backing array occasionally has to grow, which copies
everything — but the growth is geometric, so any n pushes cost O(n) in total. That is why `push`
counts as O(1) and `shift` does not.

## O(log n) — logarithmic

Each step discards a constant fraction of what is left. Doubling the input adds *one* step.

```js
function binarySearch(sorted, target) {          // requires sorted input
  let lo = 0, hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] === target) return mid;
    if (sorted[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}
```

The intuition worth carrying: **log₂ of a million is about 20, and log₂ of a billion is about
30.** Ten more steps for a thousand times more data. Logarithmic algorithms effectively do not
care how big your input is.

**Where you meet it:** binary search, balanced tree operations, heap insert and extract, and
"halve the search space" problems generally.

🔴 **The precondition is usually the cost.** Binary search needs sorted input, and sorting is
O(n log n). Searching a sorted array once is not a win over a linear scan — you paid n log n to
save n. It becomes a win when you search many times against the same sorted data, which is the
same reasoning that justifies an index in a database.

## O(n) — linear

Every element is touched a constant number of times.

```js
arr.map(f);  arr.filter(p);  arr.find(p);  arr.includes(x);  arr.indexOf(x);
arr.reduce(f, init);
Object.keys(obj);  Object.entries(obj);
[...map];  new Set(arr);
JSON.parse(text);  JSON.stringify(value);
str.split(",");  str.includes(sub);
```

**Two linear passes are still linear**, and so are ten — the constant is dropped. Chaining
`.filter().map().slice()` is three passes and O(n); it is not a complexity problem, though it is
three allocations, which is a different conversation.

**The linear class is where most application code lives, and where it should stay.** The work of
this phase is mostly noticing when something that looks linear is not
([01 · 02 · Reading a bound](../01-big-o/02-reading-a-bound.md)).

## O(n log n) — linearithmic

Linear work at each of log n levels. In practice this class means **sorting**.

```js
arr.sort((a, b) => a.price - b.price);
[...arr].sort(cmp);              // sort mutates — copy first if that matters
```

MDN notes the sort is **stable** (equal elements keep their relative order), which the
specification has required since ES2019 — so a stable multi-key sort is just two sorts, least
significant first.

**This is the practical floor for "look at everything and impose an order".** No comparison sort
can beat Ω(n log n), which is one of the few lower bounds worth memorising: it is why "sort it
first" is a legitimate O(n log n) step in a solution and not a thing to apologise for.

⚠️ **Sorting to solve a problem that a `Set` solves is the common over-reach.** "Find duplicates"
does not need a sort — one pass with a `Set` is O(n). Reach for the sort when *order* is genuinely
part of the answer.

**The comparator is a hidden multiplier.** `sort` calls it O(n log n) times, so a comparator that
parses a date string or calls `toLowerCase()` does that work a million times on a 65,000-element
array. Precompute the sort key once per element — the decorate-sort-undecorate pattern — when the
comparator is not trivial.

## The growth, side by side

| n | O(1) | O(log n) | O(n) | O(n log n) |
|---|---|---|---|---|
| 10 | 1 | ~3 | 10 | ~33 |
| 1,000 | 1 | ~10 | 1,000 | ~10,000 |
| 1,000,000 | 1 | ~20 | 1,000,000 | ~20,000,000 |

The gap between O(n) and O(n log n) is a factor of 20 at a million — noticeable but survivable.
The gap that ends a feature is in the next chunk.

## Gotchas

**Symptom:** An O(1) operation is the bottleneck
**Cause:** Constant does not mean fast — a round trip is O(1).
**Fix:** Ask "constant *what*"; profile rather than reasoning from the symbol.

**Symptom:** `Map.get` is described as guaranteed O(1)
**Cause:** The spec requires only *sublinear* access.
**Fix:** Say "sublinear, hash table in practice".

**Symptom:** Binary search does not speed anything up
**Cause:** The sort that made it possible cost O(n log n), more than the scan it replaced.
**Fix:** Sort once, search many times — otherwise scan.

**Symptom:** A sort mutates the caller's array
**Cause:** `sort` sorts in place.
**Fix:** `[...arr].sort(cmp)` or `arr.toSorted(cmp)`.

**Symptom:** Sorting is far slower than expected
**Cause:** An expensive comparator, called O(n log n) times.
**Fix:** Precompute the key per element, sort on that, then discard it.

**Symptom:** A "find duplicates" solution sorts first
**Cause:** Reaching for order when membership was the question.
**Fix:** One pass with a `Set` — O(n).

**Symptom:** Chained `.filter().map()` is flagged as a complexity problem in review
**Cause:** Confusing passes with growth. It is O(n).
**Fix:** Combine them for allocation reasons if measurement justifies it, not for Big-O.

## Interview questions

**★ What does O(1) actually promise?**
That the cost is independent of n — not that it is fast. A network call is O(1). The symbol says
nothing about the constant, so an O(1) claim needs a "constant *what*" follow-up.

**★ Is `Map.get` O(1)?**
The specification requires only that access times be *"sublinear on the number of elements"*, so
it could be a hash table (O(1)) or a search tree (O(log n)). Engines use hash tables. Say
sublinear if you want to be exactly right.

**★ Why is `push` O(1) but `shift` O(n)?**
`push` writes at the end and only occasionally grows the backing store, geometrically — amortised
O(1). `shift` removes from the front, so every remaining element's index changes: O(n) each time.

**★ When is binary search actually worth it?**
When you search the same sorted data many times. A single search does not repay the O(n log n)
sort that enabled it — a linear scan is cheaper. It is the same trade as building a database
index.

**★ Why is O(n log n) the floor for sorting?**
For comparison-based sorts, Ω(n log n) is a proven lower bound — there are n! possible orderings
and each comparison yields one bit. Non-comparison sorts (counting, radix) beat it by exploiting
the structure of the keys, which is why they are not general.

**★ Your sort is slow. Where do you look first?**
The comparator — it runs O(n log n) times. Anything non-trivial inside it (parsing, `toLowerCase`,
property lookups through getters) is multiplied. Precompute the sort key per element.

**How much does log n really save?**
log₂(1,000,000) ≈ 20 and log₂(1,000,000,000) ≈ 30. A thousand times more data costs ten more
steps — which is why logarithmic algorithms effectively stop caring about input size.

---

[Topic index](./README.md) · Next → [02 · O(n²) and worse](./02-quadratic-and-worse.md)
