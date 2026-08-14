---
title: "04.2 · Signatures and index maps"
sidebar_label: "02 · Signatures and index maps"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Map.groupBy()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/groupBy), [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort), [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)). Documentation-validated; **no timings**.

**A signature is a value that is equal exactly when two things should be considered the same.**
Getting the signature right is the whole problem; the map around it is three lines.

## Grouping by a derived key

```js
function groupAnagrams(words) {
  const groups = new Map();
  for (const word of words) {
    const signature = [...word].sort().join("");     // "eat" and "tea" → "aet"
    if (!groups.has(signature)) groups.set(signature, []);
    groups.get(signature).push(word);
  }
  return [...groups.values()];
}
```

O(n · m log m) for n words of length m — the sort per word dominates. The **counting signature** is
O(n · m):

```js
const signature = (word) => {
  const counts = new Array(26).fill(0);
  for (const ch of word) counts[ch.charCodeAt(0) - 97]++;
  return counts.join(",");                            // ⚠️ the separator matters
};
```

⚠️ **`counts.join("")` without a separator is a real bug** — `[1,11]` and `[11,1]` both become
`"111"`. With a comma they differ. It is the composite-key collision from the previous chunk, in
its most compact form.

🔴 **`[...word]` rather than `word.split("")`** so astral characters survive; and the 26-slot array
assumes lowercase ASCII, which is a stated assumption rather than a general solution.

`Map.groupBy(words, signature)` does the same thing in one line where it is available
([Phase 14 · 03 · 02](../../phase-14-data-structures/03-frequency-and-grouping/02-grouping-built-ins.md)).

## Signatures for structured data

The general problem: two objects should group together when some *derived* value matches.

```js
// group points by the line they lie on, by slope
const key = (dx, dy) => {
  const g = gcd(Math.abs(dx), Math.abs(dy)) || 1;
  const sx = dx / g, sy = dy / g;
  return sy < 0 || (sy === 0 && sx < 0) ? `${-sx}/${-sy}` : `${sx}/${sy}`;   // canonical sign
};
```

🔴 **Canonicalisation is the hard part, and it is where the bugs are.** Two representations of the
same thing must produce the *same* string: reduce the fraction, normalise the sign, sort the
components, round consistently. A signature that is "usually" equal is worse than no signature,
because it fails on a subset of inputs.

⚠️ **`JSON.stringify` is a tempting signature and a dangerous one.** Object key order affects the
output, so `{a:1,b:2}` and `{b:2,a:1}` produce different strings for equal objects. It is usable
**only** when you control construction order, or after sorting the keys explicitly.

⚠️ **Floating-point values must not be signature components without rounding.** `0.1 + 0.2` is not
`0.3`, so two mathematically identical points can produce different keys. Round to a fixed number
of decimals, or scale to integers.

## Index maps: from array scans to lookups

The most common real-world use, and the fix for the accidental quadratic from
[Phase 13 · 01 · 02](../../phase-13-complexity/01-big-o/02-reading-a-bound.md):

```js
// ❌ O(n · m)
const enriched = orders.map((o) => ({
  ...o,
  customer: customers.find((c) => c.id === o.customerId),
}));

// ✅ O(n + m)
const byId = new Map(customers.map((c) => [c.id, c]));
const enriched = orders.map((o) => ({ ...o, customer: byId.get(o.customerId) }));
```

**`new Map(array.map(x => [key, x]))` is the single most useful line in application JavaScript.**
It is the join a database would do for you, and it is one line.

⚠️ **On duplicate keys, the last one wins** — silently. If ids should be unique, that is an
assumption worth asserting rather than discovering later. If they are not unique, group into arrays
instead.

🔴 **A derived index must be rebuilt when its source changes**
([Phase 13 · 03 · 02](../../phase-13-complexity/03-choosing-a-structure/02-when-the-array-is-right.md)).
A stale index returns a *wrong* answer, not a slow one — which is strictly worse than the scan it
replaced.

## Adjacency lists — the same line again

A graph built from an edge list is an index map whose values are arrays:

```js
function buildGraph(edges, { directed = false } = {}) {
  const adj = new Map();
  const add = (a, b) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push(b);
  };
  for (const [a, b] of edges) {
    add(a, b);
    if (!directed) add(b, a);
  }
  return adj;
}
```

⚠️ **Nodes with no edges never appear** — so `adj.get(node)` is `undefined`, not `[]`, and
`for (const n of adj.get(x))` throws. Either seed every node up front, or read with
`adj.get(x) ?? []`. It is the most common bug in graph setup, and it only shows on inputs with an
isolated node.

This is what [06 · BFS](../06-bfs/README.md) traverses.

## Gotchas

**Symptom:** Anagram signatures collide
**Cause:** `counts.join("")` with no separator — `[1,11]` and `[11,1]` both give `"111"`.
**Fix:** Join with a separator.

**Symptom:** Two equal objects get different signatures
**Cause:** `JSON.stringify` depends on key insertion order.
**Fix:** Sort the keys before stringifying, or build the signature explicitly.

**Symptom:** Grouping by a computed number fails for some inputs
**Cause:** Floating-point representation — `0.1 + 0.2 !== 0.3`.
**Fix:** Round to fixed decimals, or scale to integers.

**Symptom:** Slope-based grouping misses collinear points
**Cause:** The fraction was not reduced or the sign not normalised, so `1/2` and `2/4` differ.
**Fix:** Divide by the GCD and canonicalise the sign.

**Symptom:** An index map loses records
**Cause:** Duplicate keys — the last wins silently.
**Fix:** Assert uniqueness, or group into arrays.

**Symptom:** A lookup returns stale data
**Cause:** The index was not rebuilt when the source array changed.
**Fix:** Rebuild where the data is written; treat it as a cache with one invalidation point.

**Symptom:** `adj.get(node)` is `undefined` for an isolated node
**Cause:** Nodes with no edges are never inserted.
**Fix:** Seed all nodes, or read with `?? []`.

**Symptom:** An anagram check fails on non-ASCII text
**Cause:** The 26-slot counting signature assumes lowercase ASCII.
**Fix:** A `Map` of code points, and state the assumption either way.

## Interview questions

**★ Group anagrams, and give both signature options.**
Sorted letters — O(m log m) per word — or a character-count signature, O(m). The counting version
must join with a **separator**, or `[1,11]` and `[11,1]` collide.

**★ What makes a signature correct?**
It must be equal for exactly the things that should group together, which means canonicalising
every representation of the same value: reduce fractions, normalise signs, sort components, round
floats consistently. A signature that is *usually* equal fails on a subset of inputs and is worse
than none.

**★ Why is `JSON.stringify` a risky signature?**
Its output depends on key insertion order, so `{a:1,b:2}` and `{b:2,a:1}` differ despite being
equal objects. It is safe only when you control construction order or sort the keys first.

**★ What is the most useful line in application JavaScript?**
`new Map(items.map(i => [i.id, i]))`. It converts a scan inside a loop into a lookup — the join a
database would do — and it is the standard fix for an accidental quadratic.

**★ What are the two risks of an index map?**
Duplicate keys, where the last silently wins; and staleness, because a derived index that is not
rebuilt when its source changes returns a **wrong** answer rather than a slow one.

**★ Build an adjacency list from an edge list. What is the classic bug?**
A `Map` from node to an array of neighbours, adding both directions when undirected. The bug is
that nodes with **no edges never appear**, so `adj.get(node)` is `undefined` and iterating it
throws — seed all nodes or read with `?? []`.

**When does a signature beat a direct comparison?**
When you need to group or deduplicate rather than compare two things: a signature turns an O(n²)
all-pairs comparison into one hash-map pass.

---

← [01 · Complement and seen-sets](./01-complement-and-seen.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
