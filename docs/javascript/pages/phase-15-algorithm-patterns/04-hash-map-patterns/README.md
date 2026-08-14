---
title: "04 · Hash-map patterns"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [`Map.groupBy()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/groupBy), [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)). Documentation-validated; **no timings**.

**Trade memory for time.** A hash map turns "search for what I need" into "look it up", which
turns a nested loop into a single pass — and unlike two pointers or sliding windows it needs no
sorting, no contiguity and no assumptions about signs.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Complement and seen-sets](./01-complement-and-seen.md)** | Two-sum and 🔴 **why storing after checking is what stops an element pairing with itself**; **complement lookup** as the general move, with the family it generalises to; seen-sets, and the `Set`-vs-loop trade for "is there a duplicate"; composite keys and their collisions; **prefix sums with a count map**, including 🔴 **the `{0: 1}` seed everyone forgets** — the pattern that solves subarray sums *with negative numbers*, which sliding windows cannot; and the table of when this beats the alternatives |
| 2 | **[Signatures and index maps](./02-signatures-and-index-maps.md)** | Anagram grouping with both signatures, and ⚠️ **the missing separator that makes `[1,11]` and `[11,1]` collide**; 🔴 **canonicalisation as the hard part** — reduced fractions, normalised signs, rounded floats — with `JSON.stringify` called out as a **key-order-dependent** and therefore risky signature; **`new Map(items.map(i => [i.id, i]))`** as the most useful line in application JavaScript, with its two risks (silent duplicate-key loss, staleness); and adjacency lists, where ⚠️ **isolated nodes never appear** |

## The three sentences to keep

1. **Compute the complement and look it up** — that reframing is what turns O(n²) into O(n).
2. **Prefix sums plus a count map handles negatives**, which is exactly where sliding windows fail
   silently — and the map must be seeded with the empty prefix.
3. **A signature must be equal for exactly the things that should group.** Canonicalise, or it
   fails on a subset of inputs.

## Phase gate

You are done with this topic when you can write two-sum with the correct insertion order and say
why, solve subarray-sum-equals-k including negatives with the seed explained, name why
`JSON.stringify` is a poor signature, and list the two ways an index map goes wrong.

## Where this connects

- [01 · Two pointers](../01-two-pointers/README.md) — what to use instead when O(1) space is required
- [02 · Sliding window](../02-sliding-window/README.md) — the contiguous case, and where negatives break it
- [06 · BFS](../06-bfs/README.md) — traverses the adjacency list built here
- [Phase 14 · 02 · Hash maps and hash sets](../../phase-14-data-structures/02-hash-maps-and-sets/README.md) — the structure itself, and SameValueZero
- [Phase 14 · 03 · Frequency maps and grouping](../../phase-14-data-structures/03-frequency-and-grouping/README.md) — counting and `Map.groupBy`

---

Start → [01 · Complement and seen-sets](./01-complement-and-seen.md)
