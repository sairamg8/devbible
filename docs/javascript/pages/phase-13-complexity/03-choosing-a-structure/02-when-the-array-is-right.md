---
title: "03.2 · When the array is right"
sidebar_label: "02 · When the array is right"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Array.prototype.splice()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice), [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort) — and the V8 blog, [Elements kinds in V8](https://v8.dev/blog/elements-kinds), for packed versus holey element kinds. Documentation-validated; **no timings**.

**Having learned that `Map` and `Set` beat arrays for lookups, the next mistake is reaching for
them everywhere.** Arrays are the right answer more often than the previous chunk suggests, and
knowing when is the other half of the skill.

## The cases where an array wins outright

**Small n.** Below a few dozen elements, a linear scan over a contiguous array can outperform a
hash lookup — the constant factor of hashing plus the pointer chase is real, and the array is
cache-friendly. **This is not a licence to use arrays for lookups**; it is a reason not to
restructure a five-element list to satisfy a rule.

**Order is the point.** A rendered list, a sorted leaderboard, a queue of steps. `Map` preserves
insertion order too, but arrays give you `sort`, `slice`, indices, and every rendering API expects
one.

**Positional access.** `rows[i]`, pagination windows, sliding windows, two-pointer algorithms —
all O(1) on an array and impossible on a `Map`.

**Iteration is the only operation.** Build once, iterate many times, never look up by key: an
array is smaller, faster to iterate, and simpler.

**You are going to `JSON.stringify` it.** Arrays serialise; `Map` and `Set` **do not** — they
stringify to `{}`, silently. Anything crossing a wire, `localStorage` or `postMessage` ends up as
an array of entries anyway.

🔴 **That last one catches people.** `JSON.stringify(new Map([["a", 1]]))` produces `"{}"` with no
error. Round-tripping a `Map` means `[...map]` on the way out and `new Map(entries)` on the way
back in — which is fine, and must be deliberate.

## The hybrid that is usually correct

Most real code wants **both**: an array for order and rendering, and a `Map` for lookup.

```js
const orders = await api.get("orders");                 // array — order matters for display
const byId = new Map(orders.map((o) => [o.id, o]));     // index — built once, O(n)

render(orders);                          // ordered iteration
const one = byId.get(selectedId);        // sublinear lookup
```

**The index is derived, so it must be rebuilt when the source changes** — and that is the whole
risk of the pattern. A stale index is worse than a linear scan, because it returns a *wrong*
answer instead of a slow one. Rebuild it where the data is set, not lazily on read, and never
mutate one of the two without the other.

This is exactly what a database does — a table and its indexes — and the trade is the same: reads
get faster, writes get more expensive, and consistency becomes your problem.

## Packed versus holey, briefly

V8 tracks the "elements kind" of an array, and a **packed** array (no gaps, ideally all the same
type) uses a faster representation than a **holey** one. The V8 blog documents these kinds and the
transitions between them; the practical rule is that an array **degrades** to a slower kind and
**does not** upgrade back.

```js
const a = [1, 2, 3];
delete a[1];        // ❌ leaves a hole — a is now holey, and a.length is still 3
a[1] = undefined;   // ✅ if you must clear it — stays packed
a.splice(1, 1);     // ✅ actually removes it — O(n), but keeps the array dense
const big = new Array(1000);   // ⚠️ holey from birth
```

🔴 **`delete arr[i]` is the one to unlearn.** It does not remove the element — the length is
unchanged and a hole is left behind, so `arr.length` lies, iteration behaviour becomes
inconsistent across methods, and the array is permanently in the slower representation. Use
`splice` to remove, or `filter` to build a new array.

The full treatment is **05 · What a JavaScript array really is** *(not written yet)*; what belongs
in a structure-choice discussion is only this: **keep arrays dense, and prefer building a new
array to poking holes in an old one.**

## Two structures people reach for too early

**A sorted array as an index.** Binary search is O(log n) — but keeping the array sorted costs
O(n) per insert, because everything after the insertion point shifts. It is right for
**build-once, query-many**; wrong for anything with a steady write rate. If both are frequent, the
answer is a tree or a heap, and in a browser that usually means "hand it to a database or a
server".

**A `Map` for something enumerated three times.** The `Map` has to be built (O(n)) before it pays
back. If the lookups are fewer than a handful, the build cost exceeds the savings and you have
added a stale-index risk for nothing. **The break-even is roughly "more than a couple of lookups",
and it arrives quickly** — but it is not zero.

## The decision, compressed

1. **What operation happens most?** That one decides.
2. **Is order part of the answer?** → array (plus an index if lookups are also frequent).
3. **Is it "have I seen this?"** → `Set`.
4. **Is it "give me the one with this key?"** → `Map`.
5. **Does it cross a wire?** → array of entries; `Map`/`Set` do not serialise.
6. **Do you own the keys' lifetime?** → if not, `WeakMap`.
7. **Is n small and fixed?** → whatever is clearest. Say so, and move on.

Point 7 is not a throwaway. 🔴 **Choosing the "optimal" structure for n = 8 and making the code
harder to read is a worse outcome than the linear scan** — and being able to say *why* the simple
choice is fine is the same skill as knowing when it is not.

## Gotchas

**Symptom:** A `Map` serialises to `{}`
**Cause:** `JSON.stringify` does not support `Map`/`Set`, and does not error.
**Fix:** `[...map]` out, `new Map(entries)` back in.

**Symptom:** A lookup returns stale data
**Cause:** A derived index was not rebuilt when the source array changed.
**Fix:** Rebuild where the data is set; never mutate one view without the other.

**Symptom:** `arr.length` disagrees with what is in the array
**Cause:** `delete arr[i]` leaves a hole and does not change `length`.
**Fix:** `splice` to remove, `filter` to rebuild.

**Symptom:** Array operations get slower after one `delete`
**Cause:** The array transitioned to a holey elements kind and does not transition back.
**Fix:** Keep arrays dense; build a new array rather than poking holes.

**Symptom:** `new Array(1000)` behaves oddly with `map`/`forEach`
**Cause:** It is holey — the slots are empty, not `undefined`, and several methods skip holes.
**Fix:** `Array.from({ length: 1000 })` or `new Array(1000).fill(null)`.

**Symptom:** Converting a small list to a `Set` makes no difference
**Cause:** Below the break-even, and the build itself is O(n).
**Fix:** Leave it. Structures are chosen for repeated operations.

**Symptom:** A sorted array is slow under frequent inserts
**Cause:** Each insert shifts O(n) elements.
**Fix:** A sorted array is build-once/query-many. Use a tree or heap, or push the problem to a
database.

**Symptom:** Two structures for the same data drift apart
**Cause:** The array/`Map` hybrid updated in one place only.
**Fix:** One writer, deriving the index; treat it as a cache with a single invalidation point.

## Interview questions

**★ When is an array better than a `Map` for lookups?**
Small n, where a contiguous scan beats hashing plus a pointer chase; when order is part of the
answer; when the only operation is iteration; and when the data has to serialise, because
`JSON.stringify` turns a `Map` into `{}` without complaining.

**★ You need both ordering and fast lookup. What do you do?**
Keep the array for order and derive a `Map` index from it. Rebuild the index wherever the source
changes — a stale index returns a *wrong* answer, which is worse than a slow one. It is a table
plus an index, with the same consistency cost a database has.

**★ Why is `delete arr[i]` a mistake?**
It leaves a hole without changing `length`, so the array lies about its size, methods behave
inconsistently around holes, and V8 moves it to a slower "holey" elements kind that it will not
move back from. Use `splice` or `filter`.

**★ `JSON.stringify(new Map([["a", 1]]))` — what do you get?**
`"{}"`, silently. `Map` and `Set` have no JSON representation. Convert to entries deliberately in
both directions.

**★ When is a sorted array the right index?**
Build-once, query-many. Binary search is O(log n), but maintaining sort order costs O(n) per
insert, so a steady write rate defeats it.

**★ Is there a case for *not* optimising the structure?**
Yes, and it is common: small, fixed n where the simple choice is clearer. Being able to say why
the linear scan is fine here is the same skill as knowing when it is not — the failure mode is
using an array for lookups where n is **user-controlled**.

**What is the break-even for building a `Map`?**
Building it is O(n), so it pays back after more than a couple of lookups. That threshold arrives
almost immediately in a loop — which is exactly the case where the array version was quadratic.

---

← [01 · The decision table](./01-the-decision-table.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
