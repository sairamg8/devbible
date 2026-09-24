---
name: devbible-javascript-concepts-phase13
description: Load-bearing claims and sources for JavaScript phase 13 — complexity and JavaScript's real costs
metadata:
  type: reference
---

*Child of [[devbible-javascript-concepts]]. Open when working on phase 13 or the DSA phases.*

Provenance: **documentation-validated**. Complexity results are definitional; JavaScript-specific
claims are checked against MDN and the spec requirement MDN quotes, engine behaviour against the
**V8 blog**. 🔴 **No page prints a timing** — no benchmark was run, and a benchmark is exactly the
evidence that is easiest to get wrong ([[devbible-verify-your-own-measurements]]).

Phase 13 has **3 Master topics**. ✅ **All three done** (commit `9f94f3d`). 04–10 deferred.

## The citable quotes this phase rests on

- 🔴 **MDN on `Map`, quoting the spec:** *"The specification requires maps to be implemented 'that,
  on average, provide access times that are **sublinear on the number of elements** in the
  collection'. Therefore, it could be represented internally as a hash table (with O(1) lookup), a
  search tree (with O(log(N)) lookup), or any other data structure, as long as the complexity is
  better than O(N)."* → **`Map.get` is NOT specified as O(1)**; say "sublinear, hash table in
  practice". Used in three separate chunks.
- **MDN `Map` vs `Object`**: keys *"can be any value"* vs *"must be either a String or a Symbol"*;
  *"A `Map` does not contain any keys by default"* vs *"An `Object` has a prototype, so it contains
  default keys that could collide"*; `size` vs *"more roundabout and less efficient"*; Map
  *"Performs better in scenarios involving frequent additions and removals of key-value pairs"*.
- **MDN `Set`**: *"Value equality is based on the SameValueZero algorithm"* → objects compare by
  **reference**, `NaN` equals `NaN`.
- **V8 blog** (`json-stringify`): the internal **`ConsString`** representation, which *"might
  trigger a GC during flattening"*. Cited for the `+=`-in-a-loop claim.
- **V8 blog** (`elements-kinds`): packed vs holey element kinds, and that arrays **degrade and do
  not upgrade back**.

## Topic 01 · Big-O notation (2 chunks)

**01 · What the notation says**
- Definition with the two skipped clauses: *"beyond some input size"* (so O(n²) can beat O(n log n)
  at n = 20) and *"at most"* (so **every O(n) algorithm is truthfully O(n²)** — a true and useless
  answer; give the tightest bound).
- 🔴 **"Same complexity" is not "same cost."** Two passes really are twice the work; the notation
  cannot express it. And O(1) on a hash lookup vs O(1) on a round trip is eight orders of
  magnitude.
- Worst case by default. Load-bearing cases: quicksort O(n log n) avg / **O(n²) worst**; hash
  lookup O(1) avg / **O(n) worst** → real hash-collision DoS, why engines randomise seeds.
- **Amortised ≠ average**: a guarantee over a *sequence*. `push` amortised O(1) (geometric growth).
- Space includes the **call stack** → `RangeError: Maximum call stack size exceeded`.
- Ω / Θ table; "everyone says O and means Θ".
- Closing rule: **use Big-O to reject what cannot scale, then measure to make the survivor fast.**

**02 · Reading a bound off the code**
- Mechanical rules: sequential adds (largest wins), nested multiplies, halving → log, divide +
  linear per level → n log n.
- ⚠️ **A nested loop is NOT automatically O(n²)** — bound total iterations. Constant inner bound,
  bucket partitioning, sliding window and two-pointer are all linear. *"Count the work, not the
  braces."*
- 🔴 **The hidden-cost table**: `includes`/`indexOf`/`find`/`some`/`filter`/`Object.keys`/`splice(0,1)`
  and `shift`/`unshift` are each O(n) → O(n²) inside a loop. `map.get`/`set.has` and `push` are the
  safe ones.
- 🔴 **`[...acc, x]` in a `reduce` is the most common accidental O(n²) in modern JS** — it looks
  functional and immutable. Same for `{...acc, [k]: v}`.
- V8 `ConsString`: `+=` in a loop is fine **in V8**; ⚠️ stated as an engine detail, **not a
  language guarantee**, and flattening is deferred not removed. `join("")` is the portable answer.
- Worked example: `find` + `some` inside a loop → `Map` + `Set` built before it. **The
  generalisation: a scan inside a loop becomes a lookup built before the loop.**

## Topic 02 · The complexity classes (2 chunks)

**01 · O(1) to O(n log n)**
- 🔴 *"Constant" means independent of n, not fast* — an O(1) claim needs a "constant **what**".
- `push` amortised O(1) vs `shift` O(n) (reindexing).
- log₂(10⁶) ≈ 20, log₂(10⁹) ≈ 30 — ten more steps for a thousand times the data.
- 🔴 **Binary search only pays when you search repeatedly** — the enabling sort costs more than the
  scan it replaced. Same reasoning as a database index.
- Sort is **stable since ES2019** → a stable multi-key sort is two sorts, least significant first.
- Ω(n log n) is the comparison-sort floor.
- 🔴 **The comparator runs O(n log n) times** — decorate-sort-undecorate when it is non-trivial.

**02 · O(n²) and worse**
- The visible quadratic vs 🔴 **the one-liner that ships**
  (`items.filter((x,i) => items.indexOf(x) !== i)`).
- Quadratic is fine when n is small **and bounded by something other than user input** — the
  failure is the same code where n is a CSV import.
- Sorting to exploit adjacency: *if the property only involves elements that would be adjacent when
  sorted, sort and scan.*
- 🔴 **The memoisation test: does the recursion revisit states?** Yes → collapses to polynomial
  (DP). No (2ⁿ distinct outputs) → the algorithm is optimal and the requirement is wrong.
- 2⁴⁰ ≈ a trillion; a 100× faster machine buys ~7 more elements. 13! > 6 billion.
- 🔴 **Growth table's lesson: quadratic is the dangerous column**, not the exponential ones —
  exponential hangs in testing, quadratic passes review and fails in production.
- Six-step escape ladder: lookup → sort+adjacency → memoise → prune → change the question → bound n
  and document it.

## Topic 03 · Choosing a structure (2 chunks)

**01 · The decision table**
- Operation→structure map, then the full Array/Object/Map/Set table (sublinear, not O(1)).
- 🔴 **The array-as-lookup-table mistake** is the most common in application JS; the fix is one
  line before the loop.
- Object-key traps: `obj[1]` and `obj["1"]` are one property; an object key becomes
  `"[object Object]"`; inherited keys mean a user-keyed lookup answers for `"constructor"`.
- `Set` + SameValueZero → objects dedupe by **reference**; dedupe by value needs a keyed `Map`.
- 🔴 **`WeakMap` for objects whose lifetime you do not own** — a `Map` keyed by DOM nodes is the
  detached-node leak. Cost: not iterable, no `size` (enumeration would expose GC timing).

**02 · When the array is right**
- Arrays win on: small n (cache locality beats hashing), order, positional access, iteration-only,
  and 🔴 **serialisation — `JSON.stringify(new Map([["a",1]]))` is `"{}"` with no error**.
- The **array + derived `Map` index** hybrid is what most real code wants; 🔴 **a stale index
  returns a wrong answer, not a slow one** — rebuild where the data is written. It is a table plus
  an index, with the same consistency cost.
- Packed vs holey: 🔴 **`delete arr[i]` leaves a hole, does not change `length`, and the array
  never returns to the fast kind.** Use `splice`/`filter`. `new Array(1000)` is holey from birth.
- Reached for too early: a sorted array under a steady write rate (O(n) per insert); a `Map` for
  three lookups (build is O(n)).
- 🔴 Point 7 of the decision list is deliberate: **optimising the structure for n = 8 and hurting
  readability is the worse outcome** — being able to say why the simple choice is fine is the same
  skill as knowing when it is not.
