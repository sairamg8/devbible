---
title: "03.1 · The frequency map"
sidebar_label: "01 · The frequency map"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [`Array.prototype.reduce()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce), [`Intl.Segmenter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter). Documentation-validated; **no timings**.

**"Count the things, then answer the question from the counts."** It is the single most useful
pattern in interview problems and it turns up constantly in real code — and the whole thing is
four lines.

## The four lines

```js
const counts = new Map();
for (const x of items) counts.set(x, (counts.get(x) ?? 0) + 1);
```

That is it. Every variation below is a decoration on those two lines.

🔴 **`?? 0` rather than `|| 0`.** They behave identically here because a count is never `0`
before the increment — but `||` would also replace a legitimate `0`, and in the sibling pattern
of *summing* values (where `0` is a real total) it is a bug. Use `??` for "absent" and keep the
habit.

**Why `Map` and not an object:** the keys are runtime data. An object coerces them to strings, so
`1` and `"1"` merge, `{}` becomes `"[object Object]"`, and a key of `"constructor"` finds
something inherited
([Phase 13 · 03](../../phase-13-complexity/03-choosing-a-structure/01-the-decision-table.md)). For
counting characters or known strings an object is fine — for anything else, `Map`.

## What the counts answer

Once you have the map, most questions are a single pass over it.

**Is there a duplicate?**

```js
const hasDuplicate = new Set(items).size !== items.length;   // no counting needed at all
```

**Which items appear more than once?**

```js
const dupes = [...counts].filter(([, n]) => n > 1).map(([x]) => x);
```

**The most frequent item:**

```js
let best = null, bestCount = 0;
for (const [x, n] of counts) if (n > bestCount) { best = x; bestCount = n; }
```

⚠️ **Do not sort to find one maximum.** `[...counts].sort((a, b) => b[1] - a[1])[0]` is O(n log n)
for something a single O(n) pass answers. It matters more than it looks, because the sorting
version is what people reach for.

**The top K**, where sorting *is* reasonable:

```js
const topK = [...counts].sort((a, b) => b[1] - a[1]).slice(0, k);
```

O(n log n). A heap gives O(n log k), which is better when k is much smaller than n
(**Phase 14 · 10 · Heaps and priority queues**, *not written yet*) — and for most application
sizes the sort is fine and clearer. Say which you would use and why.

**The first non-repeating item** — two passes, because insertion order is preserved:

```js
for (const x of items) if (counts.get(x) === 1) return x;
```

## Anagrams, and the canonical-key idea

```js
const key = (word) => [...word].sort().join("");           // "eat" → "aet"

const groups = new Map();
for (const word of words) {
  const k = key(word);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(word);
}
```

🔴 **The general move is: reduce each item to a canonical key, then group by that key.** Anagrams
sort their letters; case-insensitive grouping lowercases; "same shape" problems normalise the
shape. Recognising that a problem is *"group by a derived key"* is most of solving it.

An alternative key is the character frequency itself — a 26-slot count array joined into a string
— which is O(m) per word rather than O(m log m) for the sort. Worth mentioning; rarely worth
writing.

## Two comparisons that need care

**Counting characters is not counting `length`.**

```js
"café".length;                   // 4  — é as one precomposed code point
"café".length;                  // 5  — e + combining accent, identical on screen
"\u{1F44D}".length;                   // 2  — one emoji, two UTF-16 code units
[..."\u{1F44D}"].length;              // 1  — spread iterates code points
```

⚠️ **Iterate with `for…of` or spread** to count code points rather than code units, and reach for
`Intl.Segmenter` when you need *grapheme clusters* — the user-perceived characters, where an emoji
with a skin-tone modifier is one thing and several code points
([Phase 1 · Values, types and coercion](../../phase-1-values-and-coercion/README.md)).

**Counting objects counts identities.** A `Map` keyed by objects counts references, not equal
contents — SameValueZero again
([02 · Using the built-ins](../02-hash-maps-and-sets/01-using-the-built-ins.md)). To count by
value, key on something canonical: an id, or a normalised string.

## `reduce` versus a loop

```js
// the reduce version people write
const counts = items.reduce((acc, x) => acc.set(x, (acc.get(x) ?? 0) + 1), new Map());

// the accumulate-into-an-object version — 🔴 quadratic
const counts = items.reduce((acc, x) => ({ ...acc, [x]: (acc[x] ?? 0) + 1 }), {});
```

The first is fine — `set` returns the map, so the accumulator is threaded without copying. **The
second is O(n²)**: the object spread copies every key on every iteration. It is the same trap as
`[...acc, x]` from
[Phase 13 · 01 · 02](../../phase-13-complexity/01-big-o/02-reading-a-bound.md), and it appears
most often in exactly this counting pattern because it reads as the "functional" version.

**A plain `for…of` loop is clearer than either**, and this is one of the places where the loop
genuinely wins on readability. Reserve `reduce` for when the accumulation is the interesting part.

## Gotchas

**Symptom:** Counts merge for `1` and `"1"`
**Cause:** An object was used as the counter — keys coerce to strings.
**Fix:** `Map`.

**Symptom:** A count of `0` is replaced by a default
**Cause:** `|| 0` in a *sum* rather than a count.
**Fix:** `?? 0`.

**Symptom:** Counting is O(n²)
**Cause:** `reduce` with object spread — `{...acc, [x]: …}` copies every key each iteration.
**Fix:** Mutate a `Map` (or one object), or use a loop.

**Symptom:** Finding the maximum is slower than the counting
**Cause:** Sorting the entries to take the first.
**Fix:** One linear pass.

**Symptom:** Emoji counts are wrong
**Cause:** `.length` counts UTF-16 code units.
**Fix:** `[...str]` for code points; `Intl.Segmenter` for grapheme clusters.

**Symptom:** Identical-looking objects count separately
**Cause:** Object keys compare by reference.
**Fix:** Key on an id or a canonical string.

**Symptom:** The "first non-repeating" answer varies between runs
**Cause:** Iterating an object whose key order is not the insertion order you assumed.
**Fix:** `Map`, whose iteration order is insertion order.

**Symptom:** Anagram grouping misses pairs
**Cause:** The canonical key was not canonical — case, whitespace or accents differ.
**Fix:** Normalise before keying (`toLowerCase`, `normalize("NFC")`, trim).

## Interview questions

**★ Write a frequency map.**
`const counts = new Map(); for (const x of items) counts.set(x, (counts.get(x) ?? 0) + 1);` — a
`Map` because the keys are runtime data, and `??` rather than `||` so a legitimate `0` survives in
the summing variant of the same pattern.

**★ Find the most frequent element. What is the complexity?**
One linear pass over the counts, tracking the best so far — O(n). Sorting the entries to take the
first is O(n log n) for no benefit, and it is what most people reach for.

**★ Top K frequent elements?**
Sorting the entries is O(n log n) and usually fine. A min-heap of size k is O(n log k), which wins
when k ≪ n. Say which you would use and why rather than only naming the optimal one.

**★ Group anagrams.**
Reduce each word to a canonical key — sorted letters, or a character-count signature — and group
by it in a `Map`. The general pattern is *derive a canonical key, then group*; recognising that is
most of the solution.

**★ Why is `items.reduce((acc, x) => ({...acc, [x]: (acc[x] ?? 0) + 1}), {})` a bad idea?**
The object spread copies every existing key on every iteration, so it is O(n²). Threading a `Map`
through `reduce` is fine because `set` returns the map; a plain loop is clearer than both.

**★ How do you count characters correctly?**
Not with `.length`, which counts UTF-16 code units — `"👍".length` is 2. Spread or `for…of`
iterates code points; `Intl.Segmenter` gives grapheme clusters, which is what a user means by "a
character".

**Why does the "first non-repeating character" solution rely on ordering?**
Because it re-walks the original input (or a `Map`, whose iteration is insertion-ordered) after
counting. A plain object's key order is not something to rely on for this.

---

[Topic index](./README.md) · Next → [02 · Grouping, and the built-ins](./02-grouping-built-ins.md)
