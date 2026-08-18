---
title: "Worked scenarios"
sidebar_label: "2 · Worked scenarios"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 Javadoc for `LinkedHashMap`
> (access-order mode and `removeEldestEntry`), `TreeMap`/`TreeSet`
> (navigation methods), `PriorityQueue`, `String.CASE_INSENSITIVE_ORDER`,
> and `EnumSet`/`EnumMap`.

**Six shapes that cover most collection decisions a service actually makes.
Each is argued from the three axes — lookup, order, mutation — so the
reasoning transfers to the seventh shape, the one the interview invents.**

## 1 · The phase-gate scenario

*"Look up users by id, keep signup order for display, dedupe emails
case-insensitively."* Three requirements, three different axes — so three
structures, not one:

```java
Map<UserId, User> byId = new HashMap<>();              // lookup: by key, O(1)
List<User> bySignup = new ArrayList<>();               // order: insertion; mutation: append-only
NavigableSet<String> emails =
        new TreeSet<>(String.CASE_INSENSITIVE_ORDER);  // membership with custom equality
```

- Registration appends to `bySignup`, puts into `byId`, and `emails.add`
  returns `false` on a case-insensitive duplicate — the dedupe *is* the
  return value.
- Cost per registration: O(1) + O(1) expected + O(log n).
- The comparator makes `TreeSet`'s equality differ from `String.equals` —
  `"Ada@x.io"` and `"ada@x.io"` are one element. That is the requirement
  here, but the same property is a bug when unintentional; say it out loud
  in the design.
- Alternative dedupe: normalize instead —
  `HashSet<String>` of `email.toLowerCase(Locale.ROOT)`. O(1) instead of
  O(log n), at the cost of storing a transformed value. Both are
  defensible; naming both is the senior answer.

**One structure can't serve all three** because each pins a different axis:
`LinkedHashMap<UserId, User>` merges the first two (keyed lookup *and*
insertion-order iteration) — take that merge when display always walks the
full set; keep the separate list when display needs `get(i)` paging.

## 2 · An LRU cache in ten lines

`LinkedHashMap`'s access-order mode is a ready-made LRU:

```java
var cache = new LinkedHashMap<K, V>(16, 0.75f, true) {   // true = access order
    @Override protected boolean removeEldestEntry(Map.Entry<K, V> e) {
        return size() > MAX;                              // evict on insert
    }
};
```

Every `get` moves the entry to the tail; `removeEldestEntry` (a documented
protected hook) evicts the head on insert past capacity. Single-threaded
only — the concurrent version is a different topic (**Phase 6 · caches**
*(not written yet)*).

## 3 · "Next most urgent" — job scheduling

`PriorityQueue<Job>` with `comparing(Job::deadline)`: O(log n) offer/poll,
`peek` O(1). The two contract lines that matter: its iterator is **not** in
priority order, and ties are broken arbitrarily — add
`.thenComparing(Job::id)` when replay determinism matters. Unbounded; a
bounded work queue is Phase 6's `BlockingQueue` (**not written yet**).

## 4 · Range queries — "latest version ≤ x"

```java
NavigableMap<Version, Artifact> releases = new TreeMap<>();
Artifact best = releases.floorEntry(requested).getValue();   // O(log n)
SortedMap<Version, Artifact> line2 = releases.subMap(v2_0, v3_0);
```

`floorEntry`, `ceilingKey`, `headMap`, `subMap` — questions hash types
cannot ask. `subMap` returns a **live view**: writes through, and inserting
outside its bounds throws `IllegalArgumentException`.

## 5 · Recognize-the-enum shapes

Keys or members drawn from an enum → `EnumMap` / `EnumSet`, argued fully in
[Phase 2's enum collections chunk](../../phase-2-classes-objects/10-enums/03-collections-boundaries-persistence.md):
array-indexed and bit-vector backed, faster and smaller than the hash types,
iteration in declaration order. `Map<OrderStatus, Handler>` as a `HashMap`
in a diff is the tell that the author didn't know.

## 6 · Membership at scale, once built

A read-only membership check built at startup (feature flags, stop-words,
allowed country codes): `Set.copyOf(source)` — immutable, safely shareable
across threads without synchronization
(**topic 12** *(not written yet)*), and honest: no caller can
mutate what the signature hands out.

## Gotchas

**Symptom:** the case-insensitive `TreeSet` "loses" an email when code later does `set.contains(input.trim())` with different casing conventions elsewhere
**Cause:** two equality regimes in one codebase — comparator equality inside the set, `String.equals` outside it
**Fix:** normalize once at the boundary (lowercase at intake) and use plain sets, or route *every* membership decision through the same comparator-backed set

**Symptom:** LRU cache never evicts
**Cause:** the three-arg `LinkedHashMap` constructor's `accessOrder` flag left `false` (the default) — it's insertion-order, eldest never changes on `get`
**Fix:** pass `true`; and override `removeEldestEntry`, not `put`

**Symptom:** LRU works in tests, corrupts under load
**Cause:** `LinkedHashMap` is unsynchronized and access-order mode mutates on *reads* — even `get` is a structural write
**Fix:** confine to one thread, wrap in `Collections.synchronizedMap` (documented as required for access-order maps shared across threads), or use a purpose-built concurrent cache

**Symptom:** scheduler replays differently on re-run with "identical" input
**Cause:** `PriorityQueue` tie order is unspecified
**Fix:** total order — `.thenComparing(stable id)` — whenever downstream effects depend on drain order

**Symptom:** `IllegalArgumentException: key out of range` deep in code that "just puts into a map"
**Cause:** the map is a `subMap`/`headMap` view with bounds; inserting outside them throws by contract
**Fix:** put into the backing map, or take `new TreeMap<>(view)` when you meant a snapshot

**Symptom:** `floorEntry` gives stale results after artifact updates
**Cause:** someone snapshotted the `TreeMap` into a sorted `ArrayList` "for speed" and the copy aged
**Fix:** query the live map — O(log n) is already the design point; copies need an invalidation story

## Interview questions

**★ Walk the phase-gate scenario end to end.**
The answer above: three axes → three structures, per-operation costs named,
the `TreeSet`-comparator equality caveat and the normalize-instead
alternative both stated. Bonus points for the `LinkedHashMap` merge and
when you would take it.

**★ Design an LRU cache without writing a doubly-linked list.**
Access-ordered `LinkedHashMap` + `removeEldestEntry` — both behaviours are
documented API, not tricks. Follow-up you should volunteer: reads mutate,
so thread-sharing needs synchronization; at real concurrency use a
dedicated cache library.

**★ Why is `PriorityQueue`'s iterator allowed to be "wrong"?**
The backing structure is a binary heap — only the root is ordered;
guaranteeing sorted iteration would cost O(n log n) per pass or a different
structure. The contract exposes the heap honestly: `poll` for order,
iterator for contents.

**★ When do you store sorted vs sort at the edge?**
Store sorted when queries are *about* order (floor/range/first) or
read-to-write ratio is high; sort at the edge when order is presentation
and varies by caller. Canonical storage plus per-view sorting keeps two
screens from fighting over one order.

**A teammate proposes `List<User>` + `stream().filter(u -> u.id().equals(id))` for lookup. Cost, and when is it fine?**
O(n) per lookup vs `HashMap`'s O(1). Fine when n is tens and lookups are
rare — the map's win is real but the constant work of maintaining two
structures isn't free either; say the break-even out loud.

**How would you dedupe preserving *first-seen* order?**
`LinkedHashSet` — membership O(1), iteration in first-insertion order;
re-adding a duplicate does not move it (documented). With a case rule,
normalize keys first, or keep a `TreeSet` sentinel alongside an
`ArrayList` of survivors.

---

← Prev: [The decision table](01-the-decision-table.md) · Index: [Choosing a collection](README.md) · Next → [API shape and sizing](03-api-shape-and-sizing.md)
