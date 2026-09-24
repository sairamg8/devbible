---
name: devbible-javascript-concepts-phase14
description: Load-bearing claims and sources for JavaScript phase 14 — core data structures
metadata:
  type: reference
---

*Child of [[devbible-javascript-concepts]]. Open when working on phase 14 or any DSA phase.*

Provenance: **documentation-validated** against MDN, the spec requirement MDN quotes, and the V8
blog. 🔴 **No page prints a timing.** Phase 14 has **5 Master topics**; ✅ **all done**
(commit `68d3b49`). 06–17 deferred.

⚠️ **The syllabus phase gate is not reachable from the Master tier alone** — it asks for a min-heap
and an LRU cache, which are deferred Understand rows (10 · Heaps, 08 · Doubly linked list). Stated
plainly on the phase README rather than papered over.

## Topic 01 · Dynamic arrays
- Cost table; 🔴 **the whole topic turns on `push`/`pop` cheap at the end, `shift`/`unshift` linear
  at the front**.
- Amortised O(1) = a guarantee over a *sequence* (geometric growth), not an average.
- **The O(1) queue and its two omitted lines**: null the vacated slot (else a worker retains every
  processed message) and compact with `slice(head)` (else the array grows forever while `size`
  stays small).
- Packed vs holey (V8 elements kinds, one-way transitions). 🔴 **`delete arr[i]` removes the
  *property*, not the element** — `length` unchanged, permanent slow representation.
- `new Array(5).map(f)` is a no-op (holes are skipped); `Array.from({length:5}, f)` is packed.
- Mutating vs non-mutating table; 🔴 **`sort`/`reverse` mutate *and* return** — ES2023
  `toSorted`/`toReversed`/`toSpliced`/`with` are the new default.
- Every array copy is **shallow**; `structuredClone` for deep (throws on functions, loses class
  identity); structural sharing via `with` + spread is usually what you actually want.
- `Array.from` accepts array-likes, spread requires **iterable**. Array methods are generic — MDN:
  `push` *"only expects the `this` value to have a `length` property and integer-keyed
  properties"*. Live `HTMLCollection` → infinite loop; copy first.

## Topic 02 · Hash maps and hash sets
- The spec quote again (**sublinear, not O(1)**); insertion order **is** guaranteed.
- ⚠️ **`set` on an existing key keeps its position** → the LRU touch is delete-then-set.
- **SameValueZero** table vs `===` and `Object.is`: `NaN` equals `NaN`, `+0`/`-0` same key,
  objects by **reference**. Also explains `[NaN].includes(NaN)` true vs `indexOf` −1.
- `Object.create(null)` when an object must be a dictionary.
- `map.get(k) ??= []` is **invalid syntax** (method call, not an assignable reference) — the
  has/set/get idiom.
- Set algebra: built-in methods are recent; the manual `intersection` is O(|a|) only because
  `b.has` is sublinear — `[...b].includes(x)` looks identical and is quadratic.
- **The HashMap implementation and its three JS-specific details**: 🔴 `Math.imul` (plain `*`
  overflows into floats and the hash stops distributing), `>>> 0` (bitwise results are signed →
  negative bucket index), and a resize that **rehashes everything** (bucket = hash % capacity).
- Load factor ~0.75, doubling → amortised O(1), same argument as `push`.
- Chaining vs open addressing; 🔴 **O(1) average / O(n) worst** and hash-collision DoS → randomised
  seeds.
- 🔴 **Four named ways the toy differs from a real `Map`** — object keys by identity (the toy's
  `String(key)` collapses them to `"[object Object]"`), `===` not SameValueZero, no insertion
  order, and the spec does not require a hash table at all. *Say these in an interview.*
- ⚠️ `has` implemented as `get(k) !== undefined` is wrong for a map storing `undefined`.

## Topic 03 · Frequency maps and grouping
- The two lines; `?? 0` not `|| 0` (the habit matters in the *summing* variant where `0` is real).
- Answers in one pass; ⚠️ **do not sort to find one maximum** (O(n log n) for an O(n) question) —
  the reflex to unlearn. Top-K: sort O(n log n) vs heap O(n log k); say which and why.
- 🔴 **Canonical key → group by it** generalises anagrams, case-insensitive matching, "same shape".
- Character counting: `.length` counts UTF-16 code units; spread/`for…of` for code points;
  `Intl.Segmenter` for grapheme clusters. (Escapes written explicitly in the page so the two
  "café" forms are distinguishable in source.)
- 🔴 `items.reduce((acc,x) => ({...acc, [x]: …}), {})` is **O(n²)** and is the most common form of
  it, because it reads as "the functional version".
- **`Object.groupBy`** — MDN: groups *"according to the string values returned by"* the callback;
  returns 🔴 **a null-prototype object** (so `hasOwnProperty` throws — use `Object.hasOwn`/`in`);
  keys *"coerced to strings"* → every object becomes `"[object Object]"`.
- **`Map.groupBy`** — MDN's own rule: `Object.groupBy` *"should be used when group names can be
  represented by strings"*; for *"some arbitrary value"* use `Map.groupBy`.
- ⚠️ Grouping by `Date` fails even with `Map.groupBy` — distinct objects. Key on an ISO string.
- Both are **ES2024** — check support; the four-line helper is the fallback and is required anyway
  for non-array accumulations (sums, `Set`s).

## Topic 04 · Stack
- The array *is* the stack; `pop()` on empty returns `undefined` (ambiguous with a stored
  `undefined`).
- Call stack = same idea → traces bottom-up, depth is space, `RangeError`.
- 🔴 **Proper tail calls are specified but unimplemented outside JavaScriptCore** — rewriting into
  tail position does **not** avoid the limit. Stated carefully because folklore says otherwise.
- Recursion→iteration is mechanical; ⚠️ **push children in reverse** or the visit order flips.
- Bracket matching: `stack.pop() !== PAIRS[ch]` catches both failures; the final `length === 0`
  check is required (`"((("`); `ch in PAIRS` is only safe with known keys.
- Undo/redo: 🔴 **clearing the redo stack in `do` is the whole design**; unbounded undo is a leak.
- **Monotonic stack**: 🔴 push **indices**; the inner `while` is still O(n) (each index pushed once,
  popped once). 🔴 **Recognition rule — "for each element, scan until a comparison holds" = a
  monotonic stack.** Six-problem family table.
- RPN: ⚠️ **the second pop is the LEFT operand** (invisible for `+`/`*`, wrong for `-`/`/`);
  `Math.trunc` not `Math.floor` for truncation toward zero.

## Topic 05 · Queue and deque
- `[].shift()` → O(n²) drain; **the most common "worked in testing" perf bug**, because a queue's
  size is set by production load.
- Three implementations with their individual bugs: head-index (null the slot, compact), ring
  buffer (🔴 **needs a separate size counter** — `head === tail` is both empty and full; **the
  bound is backpressure, a feature**), linked list (⚠️ **reset `tail` to `null` on the last
  dequeue** or items are counted but unreachable).
- Choosing table, ending with "n in the dozens → `shift` is fine".
- **Two-stack queue**: 🔴 transfer only when the outbox is empty; amortised O(1) because each
  element sees exactly **four operations over its lifetime**. Worth knowing as the clearest
  amortised-analysis demonstration, **not** as production code.
- **Sliding-window maximum**: deque of indices, front is the max; 🔴 **critique your own solution —
  `deque.shift()` on a plain array breaks the O(n) claim.** Noticing that is the strong signal.
- **BFS**: 🔴 **mark as seen on ENQUEUE, not dequeue** (otherwise the queue blows up on a dense
  graph), and use a head index. Queue → shortest path; stack → DFS, which does not.
