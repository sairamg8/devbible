---
title: "01.2 · Reading a bound off the code"
sidebar_label: "02 · Reading a bound"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Array.prototype.shift()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift), [`Array.prototype.includes()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes), [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) — and the V8 blog ([Elements kinds in V8](https://v8.dev/blog/elements-kinds), [How we made `JSON.stringify` more than twice as fast](https://v8.dev/blog/json-stringify), which names the internal `ConsString` representation). Documentation-validated; **no timings**.

**Most bounds can be read straight off the code**, and the ones that cannot are almost always
hidden inside an innocent-looking method call. This chunk is both halves.

## The mechanical rules

**Sequential blocks add**, and the largest wins:

```js
sort(rows);                          // O(n log n)
for (const r of rows) touch(r);      // O(n)
// total: O(n log n + n) = O(n log n)
```

**Nested loops multiply**:

```js
for (const a of xs)                  // n
  for (const b of ys)                // m
    compare(a, b);                   // O(1)
// O(n · m) — and O(n²) when both are the same array
```

**Halving the remaining work each step is logarithmic**:

```js
while (lo <= hi) {
  const mid = (lo + hi) >> 1;        // binary search
  …
}
// O(log n) — the number of times n can be halved before reaching 1
```

**Divide the input, then do linear work at each level → n log n.** That is merge sort, and the
shape of every efficient comparison sort: log n levels, O(n) per level.

⚠️ **A nested loop is not automatically O(n²).** Bound the *total* iterations, not the nesting
depth:

```js
for (let i = 0; i < n; i++)
  for (let j = 0; j < 10; j++) …     // O(10n) = O(n)

for (const bucket of buckets)         // buckets partition the input
  for (const item of bucket) …        // total items = n → O(n)
```

The second is the classic false positive: two loops, one pass over the data. **Count the work,
not the braces.** Sliding-window and two-pointer algorithms look quadratic and are linear for
exactly this reason — each pointer only ever moves forward.

## Recursion: count the calls

```js
function fib(n) {                    // two calls per level, depth n
  return n < 2 ? n : fib(n - 1) + fib(n - 2);   // O(2ⁿ)
}

function walk(node) {                // one call per node
  for (const child of node.children) walk(child);  // O(n) over the tree
}
```

The question is always **how many calls, times the work per call**. A binary recursion that
halves the input is O(log n) calls; one that recurses on both halves and does linear work per
level is O(n log n); one that branches without shrinking is exponential.

## The costs JavaScript hides

🔴 **This is the part that turns a "clearly O(n)" loop into O(n²).** Each of these is one method
call that iterates:

| Inside a loop over n items | Cost of the call | Total |
|---|---|---|
| `arr.includes(x)` / `indexOf` / `find` / `some` | O(n) | **O(n²)** |
| `arr.filter(...)` | O(n) | **O(n²)** |
| `[...acc, item]` or `acc.concat(item)` | O(n) copy | **O(n²)** |
| `arr.shift()` / `unshift()` | O(n) — every element reindexes | **O(n²)** |
| `Object.keys(obj)` | O(n) | **O(n²)** |
| `arr.splice(0, 1)` | O(n) | **O(n²)** |
| `map.get(x)` / `set.has(x)` | sublinear (see below) | **O(n)** ✅ |
| `arr.push()` | amortised O(1) | **O(n)** ✅ |

The two that appear most in review:

```js
// ❌ O(n · m) — includes rescans the whole array each time
const missing = candidates.filter((c) => !existing.includes(c));

// ✅ O(n + m)
const seen = new Set(existing);
const missing = candidates.filter((c) => !seen.has(c));
```

```js
// ❌ O(n²) — reduce with spread copies the accumulator every step
const merged = items.reduce((acc, item) => [...acc, transform(item)], []);

// ✅ O(n)
const merged = items.map(transform);
```

🔴 **The spread-in-a-reduce pattern is the most common accidental O(n²) in modern JavaScript**,
because it looks functional and immutable and reads beautifully. Every iteration allocates and
copies the entire accumulator so far. The same applies to `{ ...acc, [key]: value }` in a reduce
over object entries.

**Why `Set`/`Map` are the fix** — MDN, quoting the specification requirement:

> "The specification requires maps to be implemented 'that, on average, provide access times that
> are **sublinear on the number of elements** in the collection'. Therefore, it could be
> represented internally as a hash table (with O(1) lookup), a search tree (with O(log(N))
> lookup), or any other data structure, as long as the complexity is **better than O(N)**."

Note what that does *not* promise: the spec guarantees sublinear, not O(1). In practice engines
use hash tables, but the citable guarantee is "better than linear".

## Two JavaScript-specific surprises

**String building with `+=` in a loop is not O(n²) in V8.** The naive analysis says each `+=`
copies the whole string so far. V8 instead represents a concatenation lazily as an internal
**`ConsString`** — a node pointing at two pieces — and only *flattens* it into contiguous memory
when something needs the actual characters. The V8 blog names this behaviour explicitly when
describing why `JSON.stringify`'s fast path must check for it: a `ConsString`
*"might trigger a GC during flattening"* and so falls back to a slow path.

⚠️ **State this carefully.** The optimisation is an engine implementation detail, not a language
guarantee, and the flattening cost is real — it is deferred, not removed. `array.join("")` is the
portable answer when it matters, and the honest position is: `+=` in a loop is fine in V8, and
"fine" is not a specified property.

**`arr.shift()` is O(n) and `arr.push()` is not.** A queue built on `shift` reindexes every
remaining element on every dequeue, turning an O(n) drain into O(n²). Use two indices into an
array, or push/pop at the same end
(**Phase 14 · Core data structures**, *not written yet*).

## Worked example

```js
function findDuplicateOrders(orders, customers) {
  const result = [];
  for (const order of orders) {                                   // n
    const customer = customers.find((c) => c.id === order.cid);   // m  ← the problem
    if (result.some((r) => r.cid === order.cid)) continue;        // k  ← and this
    if (customer) result.push({ ...order, customer });
  }
  return result;
}
```

Reading it: an outer loop of n, containing a linear `find` over m and a linear `some` over the
result. **O(n · (m + k))** — quadratic in practice. The fix is two lookups instead of two scans:

```js
function findDuplicateOrders(orders, customers) {
  const byId = new Map(customers.map((c) => [c.id, c]));   // O(m)
  const seen = new Set();
  const result = [];
  for (const order of orders) {                            // O(n)
    if (seen.has(order.cid)) continue;                     // sublinear
    const customer = byId.get(order.cid);                  // sublinear
    if (customer) { seen.add(order.cid); result.push({ ...order, customer }); }
  }
  return result;
}
// O(n + m)
```

**The pattern generalises: a scan inside a loop becomes a lookup built before the loop.** Almost
every accidental quadratic in application code is fixed by exactly this move.

## Gotchas

**Symptom:** A "simple loop" is quadratic
**Cause:** `includes`/`indexOf`/`find`/`filter` inside it — each is a full scan.
**Fix:** Build a `Set` or `Map` before the loop.

**Symptom:** A `reduce` with spread is slow on large inputs
**Cause:** `[...acc, x]` copies the accumulator every iteration → O(n²).
**Fix:** `map`, or `push` into an array and return it.

**Symptom:** `{ ...acc, [k]: v }` in a reduce is slow
**Cause:** Same shape, with objects.
**Fix:** Mutate a single object, or `Object.fromEntries`.

**Symptom:** A queue gets slower as it drains
**Cause:** `shift()` is O(n) — every element reindexes.
**Fix:** Two indices into an array, or a real deque.

**Symptom:** A nested loop is assumed quadratic and is not
**Cause:** The inner loop is bounded by a constant, or the loops partition the same n items.
**Fix:** Count total iterations, not nesting depth.

**Symptom:** Two-pointer code is described as O(n²) in review
**Cause:** Nesting depth again. Each pointer moves forward at most n times.
**Fix:** Bound total pointer movement.

**Symptom:** String building is "optimised" from `+=` to array-join with no measurable change
**Cause:** V8's `ConsString` already defers the copying.
**Fix:** Nothing to fix — but keep `join` where portability across engines matters, and remember
flattening is deferred, not free.

**Symptom:** A `Map` is assumed O(1) and a bound is stated as such
**Cause:** The spec requires only *sublinear* access.
**Fix:** Say "sublinear, hash table in practice" if precision matters.

## Interview questions

**★ How do you read a bound off a loop nest?**
Sequential blocks add and the largest dominates; nested loops multiply; halving the remaining work
each step is logarithmic; dividing the input with linear work per level is n log n. Then count
total iterations rather than nesting depth — a loop bounded by a constant, or loops that partition
the same n items, is still linear.

**★ Why is `candidates.filter(c => !existing.includes(c))` slow?**
`includes` is a linear scan run once per candidate — O(n · m). Build a `Set` from `existing`
first, then membership is sublinear and the whole thing is O(n + m).

**★ What is wrong with `items.reduce((acc, x) => [...acc, f(x)], [])`?**
The spread copies the entire accumulator every iteration, so it is O(n²). It is the most common
accidental quadratic in modern JavaScript precisely because it reads well. `items.map(f)` is O(n).

**★ Is `Map.get` O(1)?**
The specification only requires access times *"sublinear on the number of elements"* — MDN notes
it could be a hash table with O(1) lookup or a search tree with O(log n), *"as long as the
complexity is better than O(N)"*. Engines use hash tables; "sublinear" is what is actually
guaranteed.

**★ Why is building a string with `+=` in a loop not the disaster the analysis suggests?**
V8 represents concatenation lazily as an internal `ConsString` and flattens it only when the
characters are needed — the V8 blog names this when explaining why `JSON.stringify`'s fast path
must detect it. It is an engine optimisation, not a language guarantee, and the flattening cost is
deferred rather than removed.

**★ Why does a queue built on `shift()` degrade?**
`shift` is O(n) because every remaining element is reindexed. Draining n items is O(n²). Use two
indices, or push and pop at the same end.

**A nested loop over the same array — always O(n²)?**
No. If the inner loop's total iterations across the whole outer loop are bounded by n — sliding
window, two pointers, bucket partitioning — it is linear. Count the work, not the braces.

---

← [01 · What the notation says](./01-what-the-notation-says.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
