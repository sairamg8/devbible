---
title: "A hash map's constant time is conditional — on a key that hashes well and is cheap to make — and an object used as a map with Object.keys in the loop is a hidden copy; the test that catches every hidden loop is to read the body call by call and ask whether its cost grows with the loop"
sidebar_label: "06b · Hash keys, and the test for hidden loops"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the JDK 25 javadoc for
> [`HashMap`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/HashMap.html)
> (constant time *"assuming the hash function disperses the elements properly"*; load factor and
> rehash, verbatim) and MDN [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)
> (the Map-versus-Object comparison). Second half of topic 06 — [06](06-hidden-costs.md) is
> the copies, scans and shifts. **No sandbox run; no timings.**

**The hash map is the structure every linear solution leans on, and its constant time is a
conditional: the key must hash well, and it must be cheap to make.** A Java key class with
`equals` overridden and `hashCode` left alone puts equal keys in different buckets and lookups
miss; a `hashCode` that returns a constant puts every key in one bucket and lookups scan; a
JavaScript key built with `JSON.stringify` on every call keeps the class and adds a
serialisation and an allocation to each lookup. Beside the map sits the object used as one,
where `Object.keys` inside a loop rebuilds the key list every iteration. And under all of
[06](06-hidden-costs.md)'s cases is one test that finds the rest: read the loop body call by
call and ask, for each, whether its cost depends on a size that grows with the loop. This page
is the map's conditions, the object trap, and that test.

## Hash maps: when constant time is not

A hash map's constant time is expected, and it rests on the hash function spreading keys. Three
ways it stops holding:

1. **Object keys serialised.** `map.get(JSON.stringify([r, c]))` costs the serialisation on every
   call and allocates; a composite primitive — `r * cols + c`, or `` `${r},${c}` `` — is
   constant and allocation-free.
2. **A bad `hashCode`.** In Java, a key class with `equals` overridden and `hashCode` left as the
   identity hash puts equal keys in different buckets — lookups miss; a `hashCode` returning a
   constant puts every key in one bucket — lookups scan. The javadoc's constant time is
   *"assuming the hash function disperses the elements properly"*.
3. **Growth.** The rehash is amortised into the inserts, per the load-factor rule:
   > *"When the number of entries in the hash table exceeds the product of the load factor and
   > the current capacity, the hash table is rehashed (that is, internal data structures are
   > rebuilt) so that the hash table has approximately twice the number of buckets."* — JDK 25,
   > `HashMap`
   A known final size can be passed as the initial capacity to avoid the rehashes entirely —
   a constant-factor gain, not a class change, and worth naming when the estimate is tight.

## Objects used as maps, and Object.keys in a loop

`Object.keys`, `Object.values` and `Object.entries` build a fresh array of every key on each
call. Inside a loop over the same keys they are quadratic; inside a hot loop they are an
allocation per iteration even when the count is small. Build the key list once, or use a `Map`,
which MDN describes as performing better for frequent additions and removals than an object.

## The test that catches all of them

Before saying "linear", read every call in the loop body and ask what it does to the data it
touches — copy, scan, shift, serialise, allocate. If the answer depends on the size of something
that grows with the loop, the call is a loop. The tell in practice is a solution that passes
every visible test and times out on the hidden one: the visible tests are small, and n and n²
are indistinguishable at n = 10.

## Gotchas

**Symptom: `JSON.stringify([r, c])` as a map key in a grid search.** Cause: serialisation and
allocation per lookup. Fix: `r * cols + c` as a number key, or a `Uint8Array` visited grid.

**Symptom: a Java `HashMap` with a key class whose `equals` is overridden and `hashCode` is
not.** Cause: equal keys hash differently; lookups miss. Fix: override both together; the javadoc's
constant time assumes a dispersing hash.

**Symptom: `Object.keys(o)` inside a loop over `o`'s keys.** Cause: a fresh array of all keys per
iteration. Fix: compute once, or use a `Map`.

## Interview questions

**★ When does a hash map stop being constant time?**
When the hash does not disperse the keys: a Java key class with `equals` overridden and
`hashCode` not — equal keys land in different buckets and lookups miss — or a constant
`hashCode`, which puts every key in one bucket and makes lookups scan; the javadoc's constant
time assumes the hash function disperses the elements. Also when the key is expensive to make —
`JSON.stringify` of a pair per lookup — which keeps the class but adds serialisation and
allocation to every call; a composite primitive key is the fix. Rehashing is amortised into the
inserts by the load-factor rule and does not change the class.

**How would you find the hidden quadratic in someone else's linear-looking loop?**
Read the body call by call and classify each against the data it touches: copies (`slice`,
spread, `concat`, `substring`, `Object.keys`), scans (`includes`, `indexOf`, `contains`),
shifts (`shift`, `unshift`, `splice`, `ArrayList.remove(i)`), serialisations
(`JSON.stringify` keys) and per-iteration sorts. Any whose cost depends on a size that grows
with the loop is a nested loop in disguise; the replacement is in the same row — a `Set`, a
`push`, an index pointer, a builder, a composite key.

---

← Prev: [06 · Hidden costs](06-hidden-costs.md) · Index: [Phase 1 — Complexity analysis](README.md) · Next → **Complexity of the built-ins** *(not written yet)*
