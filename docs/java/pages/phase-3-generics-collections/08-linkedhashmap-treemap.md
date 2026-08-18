---
title: "LinkedHashMap and TreeMap"
sidebar_label: "08 · LinkedHashMap and TreeMap"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for
> `java.util.LinkedHashMap` (access-order and `removeEldestEntry` class
> docs), `TreeMap`, `SortedMap` and `NavigableMap`.

**Two maps that remember order, by opposite means. `LinkedHashMap` is a
`HashMap` with a doubly-linked list threaded through its entries — order is
*remembered* (insertion order, or access order if you ask), lookups stay
O(1), and overriding one method turns it into an LRU cache.
`TreeMap` is a red-black tree — order is *computed* from a comparator,
lookups are O(log n), and the prize is the navigation API: `floorKey`,
`ceilingKey`, `headMap`, `subMap` — range queries a hash table cannot
answer.**

## `LinkedHashMap` — remembered order

Same bucket machinery as topic 07's `HashMap`, plus each entry carries
`before`/`after` pointers maintaining one global list. Iteration walks that
list, so order is exactly insertion order — stable across resizes, JDK
versions and hash seeds:

```java
Map<String, String> headers = new LinkedHashMap<>();   // response headers,
headers.put("content-type", "application/json");        // emitted in the order
headers.put("cache-control", "no-store");               // you set them
```

That predictability is the everyday use: JSON whose field order matches
the code that built it, config dumps, CSV columns, any output a human
diffs. Cost: one extra pair of pointers per entry and a hair more work per
mutation — `get`/`put`/`remove` remain O(1).

Re-inserting an existing key **keeps its original position** (the value is
replaced, the order is not) — insertion order means *first* insertion.

### Access order, and the 10-line LRU cache

The three-argument constructor flips the list to access order: every
`get`/`getOrDefault`/`put` on an existing key moves that entry to the tail, so the head is
always the least-recently-used entry. Pair it with the one protected hook
`HashMap` doesn't have, and eviction is automatic:

```java
class LruCache<K, V> extends LinkedHashMap<K, V> {
    private final int maxEntries;

    LruCache(int maxEntries) {
        super(16, 0.75f, true);            // true = access order
        this.maxEntries = maxEntries;
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > maxEntries;        // evict head after each insert
    }
}

Map<String, User> recent = new LruCache<>(1_000);
```

`removeEldestEntry` is called by `put` after each insertion; returning
`true` makes the map delete its head entry itself. The class doc shows
exactly this override as the intended use. What this cache is *not*:
thread-safe (wrap in `Collections.synchronizedMap` or use Caffeine in real
services — phase 6 territory), and it has no expiry — it is the
interview-canonical LRU and a fine per-request/per-thread memo.

⚠️ In access-order mode **`get` is a structural modification** for
iteration purposes — it reorders the list. Reading the map while someone
iterates it throws `ConcurrentModificationException` even though nothing
was "written". The class doc calls this out; it is the trap that makes
access-order maps unshareable without locking.

## `TreeMap` — computed order

A red-black tree keyed by `compareTo` (or a constructor `Comparator`).
Every operation walks root→leaf: O(log n) `get`/`put`/`remove` — slower
than hashing, but the keys are always sorted, and that buys the
`NavigableMap` API:

```java
TreeMap<Instant, BigDecimal> priceHistory = loadPrices();

priceHistory.floorEntry(t);            // latest price AT OR BEFORE t
priceHistory.ceilingKey(t);            // earliest change at or after t
priceHistory.firstEntry();             // oldest
priceHistory.lastEntry();              // newest
priceHistory.headMap(cutoff);          // everything before cutoff (view)
priceHistory.subMap(from, true, to, false);   // range [from, to) (view)
priceHistory.pollFirstEntry();         // read-and-remove oldest
```

`floorEntry` is the shape production reaches for: *the value in effect at
time t* — price at order time, config active at deploy time, the tax rate
on a date. A `HashMap` can only answer exact-key questions; answering
"at or before" with one means scanning every key.

Three consequences of comparison-based keys:

- **No null keys** under natural ordering — compare must be callable
  (`NullPointerException` on `put(null, v)`). Values may be null.
- **Membership is `compareTo == 0`**, not `equals` — `new BigDecimal("1.0")`
  and `new BigDecimal("1.00")` are the *same key* here and different keys
  in a `HashMap` (the `SortedMap` doc's "consistent with equals" warning;
  topics 06 and 10 dissect it).
- **Keys must be mutually comparable** — the first `put` of a key that
  can't be compared with the others throws `ClassCastException`.

The sub-map methods return **live views**: writes through them hit the
backing map, and inserting a key outside a view's range throws
`IllegalArgumentException`. A view is a window, not a copy.

## Choosing between the three maps

| Need | Pick |
|---|---|
| just key→value, no order anyone reads | `HashMap` (topic 07) |
| iteration order humans/diffs/tests see · LRU eviction | `LinkedHashMap` |
| sorted iteration · range / nearest-key queries · first/last | `TreeMap` |

If you find yourself calling `keySet().stream().sorted()` on every read of
a `HashMap`, the data wanted a `TreeMap`; if you sort once at the end for
display, sorting at the read point is cheaper than paying O(log n) per
write. Topic 14's decision table folds this into the wider collection
choice.

## Gotchas

**Symptom:** `ConcurrentModificationException` from code that only ever *reads* the map
**Cause:** access-order `LinkedHashMap` — `get` reorders the entry list, which counts as structural modification during someone's iteration
**Fix:** don't share an access-order map without synchronization; iterate over a copy (`Map.copyOf(map)`), or keep access-order maps thread-confined

**Symptom:** LRU cache evicts nothing and grows forever
**Cause:** `removeEldestEntry` overridden but the two-arg constructor used — the map is in insertion-order mode, so "eldest" is just the oldest insert; or the override mutates the map itself instead of returning true
**Fix:** `super(cap, 0.75f, true)` for true LRU; return `true` from the hook and let the map delete — the doc says the override must not modify the map directly

**Symptom:** copying a cache with `new LinkedHashMap<>(cache)` silently changed its behaviour
**Cause:** the copy constructor always produces an **insertion-ordered** map — the access-order flag is not copied
**Fix:** construct with the three-arg constructor and `putAll`; entries arrive in the source's current order

**Symptom:** `NullPointerException` from `treeMap.put(key, value)` with a non-null key
**Cause:** it's the *first* entry and the key is null — or a comparator that can't handle the key; natural ordering must call `compareTo`
**Fix:** no null keys in sorted maps; `Comparator.nullsFirst` exists but modelling absence differently is almost always better

**Symptom:** `TreeMap` reports fewer entries than the `HashMap` it was built from
**Cause:** keys that are `compareTo`-equal but not `equals`-equal collapsed (`BigDecimal` scales, case-insensitive comparators)
**Fix:** intended for dedupe-by-rule; otherwise make the ordering consistent with equals — `comparing(...).thenComparing(...)` until all real ties break (topic 10)

**Symptom:** `IllegalArgumentException: key out of range` on a plain `put`
**Cause:** the "map" is a `headMap`/`subMap`/`tailMap` view, and the key falls outside its window
**Fix:** put through the backing map, or widen the view; views are for reading/removing ranges more than inserting

**Symptom:** `ClassCastException` deep inside `TreeMap.put`
**Cause:** mixed key types (or a key not `Comparable`) with natural ordering — the tree must compare every new key against existing ones
**Fix:** one key type per map; supply a `Comparator` when the type has no natural order

**Symptom:** entry "in the map" but `get` misses it (`TreeMap`), or order corrupts (`LinkedHashMap` is immune, `TreeMap` isn't)
**Cause:** a field feeding `compareTo` mutated while the object was a key — the tree's search path is stale
**Fix:** immutable keys, same rule as hashing (topic 07); remove → mutate → re-insert if unavoidable

## Interview questions

**★ Implement an LRU cache in Java without writing a data structure.**
Extend `LinkedHashMap`, construct with `accessOrder = true`, override
`removeEldestEntry` to `return size() > max;`. Access order moves each
touched entry to the tail; the hook evicts the head after each `put`.
Caveats worth volunteering: not thread-safe, no TTL — Caffeine for a real
service.

**★ How does `LinkedHashMap` keep order without losing O(1) lookups?**
It *is* a `HashMap` — same buckets, same hashing — with each entry
additionally linked into a doubly-linked list (`before`/`after`). Lookup
uses the buckets; iteration uses the list. Order costs two pointers per
entry, not a different algorithm.

**★ `floorKey` vs `ceilingKey` vs `get` — and a real use for floor?**
`get` answers exact-key only. `floorKey(k)` = greatest key ≤ k,
`ceilingKey(k)` = least key ≥ k, defined even when k is absent. Canonical
floor use: point-in-time lookup — "the price/config/rate in effect at t"
from a `TreeMap<Instant, V>`.

**★ Why does `TreeMap` forbid null keys when `HashMap` allows one?**
`HashMap` special-cases null's hash. A tree must call
`compareTo`/`compare` on every insert and lookup, and null can't be
compared — so natural-ordering `TreeMap` throws `NullPointerException` on
a null key.

**★ When is `get()` a mutation?**
On an access-order `LinkedHashMap` — it splices the entry to the list
tail. That's what makes LRU work, and what makes concurrent iteration
throw `ConcurrentModificationException` under pure reads.

**What do `headMap`/`subMap` return — copy or view — and what follows?**
Live views backed by the map: removals through the view hit the source,
out-of-range inserts throw `IllegalArgumentException`, and the view stays
current as the backing map changes. Copy explicitly (`new TreeMap<>(view)`)
when you need a snapshot.

**Why might two maps built from the same entries disagree on size?**
Different equality: `HashMap` keys collapse by `equals`/`hashCode`,
`TreeMap` keys by `compareTo == 0`. Orderings inconsistent with equals
(`BigDecimal`, `String.CASE_INSENSITIVE_ORDER`) make the counts diverge.

**Where does `LinkedHashMap` beat `TreeMap` even though both are "ordered"?**
When the order you need is insertion/access order, not sort order — and
whenever O(1) beats O(log n). `TreeMap` only wins when the *comparator's*
order or range navigation is the requirement.

---

← Prev: [HashMap internals](07-hashmap-internals.md) · Next → [Queues and deques](09-queues-deques.md)
