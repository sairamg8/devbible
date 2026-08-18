---
title: "HashMap internals"
sidebar_label: "07 · HashMap internals"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JDK 25 API documentation for
> `java.util.HashMap` (class doc: capacity, load factor, iteration-order
> caveat) and the OpenJDK `HashMap.java` implementation notes for the
> bucket/treeification details the Javadoc doesn't surface (hash spreading,
> `TREEIFY_THRESHOLD = 8`, `MIN_TREEIFY_CAPACITY = 64`).

**`get` on a `HashMap` is: compute the key's hash, pick a bucket by masking
the hash, walk that bucket comparing keys. Everything you need to know
operationally falls out of that pipeline — why `hashCode` must spread, why
keys must be immutable, what the load factor buys, why a bucket becomes a
red-black tree under attack-grade collisions, and why iteration order is
noise. This is Understand-tier: enough internals to reason about behaviour
and defend the defaults, not a source-code tour.**

## The lookup pipeline

```java
map.get(key)
// 1. h = key.hashCode(), then spread: h ^ (h >>> 16)
// 2. bucket = h & (table.length - 1)     — table length is a power of two
// 3. walk the bucket: first == check, then equals(), until hit or end
```

Three details, each carrying a consequence:

- **The spread (step 1).** Because the mask keeps only the *low* bits, a
  `hashCode` whose variation lives in high bits would collide massively.
  OpenJDK XORs the high half down to mix them in — cheap insurance, not a
  substitute for a decent `hashCode`
  (**[Phase 2's contract topic](../phase-2-classes-objects/06-equals-hashcode/README.md)**).
- **Power-of-two masking (step 2).** Capacity is always 2ⁿ so the modulo is
  a single AND. Requested capacities round up to the next power of two.
- **`==` before `equals` (step 3).** Same-reference keys short-circuit;
  interned/cached keys make lookups cheaper without any `equals` call.

A million entries with a well-spread hash means buckets of ~0–2 entries:
constant-time lookups *in expectation*. Everything degrading from there is
a story about collisions.

## Load factor and resize

Two constructor knobs, both with sane defaults: **capacity 16, load factor
0.75**. When `size > capacity × loadFactor`, the table doubles and every
entry is redistributed (rehashed to its new bucket). So:

- The 0.75 default is the documented space/time trade — fuller tables save
  memory but collide more; the Javadoc endorses the default.
- **Resize is the expensive moment** — O(n) redistribution. Bulk-loading a
  map of known size wants a sized constructor:
  `new HashMap<>((int) (expected / 0.75f) + 1)` — or in practice
  `HashMap.newHashMap(expected)` (since 19) which does that arithmetic for
  you.
- Iteration cost is O(capacity + size), not O(size) — an over-sized,
  mostly-empty map iterates slowly. (One more reason not to "fix"
  collisions with a huge initial capacity.)

## Treeification — the collision floor

If a single bucket accumulates **8+** entries and the table has at least
**64** buckets, OpenJDK converts that bucket's list into a red-black tree,
turning worst-case per-bucket walks from O(n) to O(log n); buckets shrink
back to lists when they fall to 6. (Below 64 buckets it resizes instead.)
Notes, not spec — these constants are implementation detail.

Why it exists: a *bad* `hashCode` — or a deliberately crafted set of
colliding string keys, the classic hash-flooding DoS against servers that
put attacker-controlled strings in maps — used to degrade `HashMap` into a
linked list. Treeification puts a logarithmic floor under the worst case.
There's a subtlety worth knowing: tree bins compare best when keys are
`Comparable` (`String` is); incomparable keys in a tree bin fall back to
identity-ish tie-breaking — one more small reason good `hashCode`s matter
more than the safety net.

## The rules the pipeline imposes

- **Keys must be immutable** — or at least their `hashCode`-feeding fields
  must be. The bucket index is computed at `put`; mutate the key and the
  entry is stranded where `get` will never look
  (**[the production-breakage chunk](../phase-2-classes-objects/06-equals-hashcode/03-where-it-breaks-in-production.md)**).
  Records (Phase 2) are the default key shape for a reason.
- **`equals`-equal keys must hash equal** — the contract; the map trusts it
  blindly. Violate it and "the same" key stored twice lands in two buckets.
- **One null key, any null values** — null hashes to bucket 0 by
  special-case. But `get` returning null is ambiguous (absent, or present
  as null?); prefer `containsKey` for the distinction, or better, don't
  store null values — `getOrDefault`, `computeIfAbsent`, and `merge` all
  read more clearly with real values, and `Map.of`/`ConcurrentHashMap`
  reject nulls outright anyway.
- **Iteration order is unspecified noise.** It's a function of hash values
  and capacity history, changes on resize, and the Javadoc says plainly not
  to depend on it. Order needs → `LinkedHashMap`/`TreeMap` (topic 08).
- **Not thread-safe** — concurrent structural modification is a data race;
  historical versions could even corrupt the table into infinite loops.
  Phase 6's `ConcurrentHashMap` is the answer; `Collections.synchronizedMap`
  is the blunt fallback.

## Gotchas

**Symptom:** map "loses" an entry — `containsKey` false, yet the key shows in `keySet()` iteration
**Cause:** key mutated after `put`; it now hashes to a different bucket than it's stored in
**Fix:** immutable keys (records, String, boxed primitives); if mutation is unavoidable: remove → mutate → re-put

**Symptom:** the same logical key appears twice in `entrySet()`
**Cause:** `equals` overridden without `hashCode` (or vice versa) — equal keys landed in different buckets
**Fix:** implement the pair together, always — Phase 2's contract topic; records generate both correctly

**Symptom:** p99 latency spikes on a service that maps request strings; CPU in `HashMap.getNode`
**Cause:** attacker-chosen keys colliding (hash flooding) — or just a catastrophically bad custom `hashCode` — degrading buckets to long walks; treeification caps but doesn't erase the cost
**Fix:** don't key maps directly on unbounded attacker-controlled strings (bound, hash with a keyed hash, or use a different structure); fix the `hashCode` spread

**Symptom:** `get(key)` returns null — team debates "missing" vs "mapped to null" in production
**Cause:** null values make the two indistinguishable through `get`
**Fix:** never store null values: `getOrDefault`, `computeIfAbsent`, or model the state explicitly; `containsKey` is the disambiguator where legacy data forces it

**Symptom:** bulk load of n known entries shows resize churn in profiles
**Cause:** default capacity 16 with load factor 0.75 → repeated double-and-rehash on the way up
**Fix:** `HashMap.newHashMap(n)` (19+) or the `(n / 0.75) + 1` sized constructor

**Symptom:** iterating a map is slow though it holds few entries
**Cause:** iteration is O(capacity + size) — the map was built with a huge initial capacity
**Fix:** size for the expected load, not for collision paranoia; copy into a right-sized map if one inflated historically

**Symptom:** occasional `ConcurrentModificationException` — or worse, a hung thread — under load with no obvious concurrent writer
**Cause:** `HashMap` shared across threads; a rare racing put during resize
**Fix:** `ConcurrentHashMap` (Phase 6), or confine the map to one thread; "it mostly works" is the race talking

## Interview questions

**★ Walk through `map.get(key)`.**
Hash the key; spread high bits into low (`h ^ (h >>> 16)`); mask by table
length (a power of two) to pick the bucket; walk the bucket comparing with
`==` then `equals`. Expected O(1) with a spreading hash; treeified buckets
bound the pathological case at O(log n).

**★ Why must `equals`-equal objects have equal hash codes — mechanically, in this class?**
Bucket choice is derived from `hashCode` alone. If equal keys hash
differently, they live in different buckets, and `get` walks the wrong one:
duplicates on write, misses on read. The map never cross-checks — it's a
contract, and `HashMap` is implemented against it.

**★ What are load factor and treeification each defending against?**
Load factor bounds *average* bucket occupancy — it trades memory for fewer
collisions by resizing at 75% full. Treeification bounds the *worst-case*
bucket — 8+ collisions in one bucket (with ≥64 buckets) become a red-black
tree, turning O(n) adversarial walks into O(log n). One is statistics, the
other is a security floor.

**★ Why are records the ideal map key?**
Immutable by construction (the bucket address can never go stale) with
generated, contract-correct `equals`/`hashCode` over all components. The
two map-key failure modes — mutation and a broken contract — are both
eliminated at the language level.

**Why does `HashMap` capacity stay a power of two?**
So bucket selection is `hash & (n-1)` — one AND instead of a modulo — and
resize splits each bucket cleanly into exactly two. It's also why the
high-bits spread exists: masking only ever reads low bits.

**How would you get "expected constant time" to fail even with treeification?**
Keys that are equal-hash but incomparable (no `Comparable`, no useful tie
break) — tree bins can't order them well; or unbounded growth with no
resize headroom (memory pressure), or sharing the map across threads
(undefined behaviour, not just slowness).

**`HashMap.newHashMap(50)` vs `new HashMap<>(50)` — difference?**
The static factory (since 19) sizes the table so that *50 entries fit
without resizing* — it does the load-factor arithmetic. The constructor's
50 is raw initial capacity: it resizes at 37 entries (50 × 0.75) — the
subtle off-by-a-third that the factory was added to end.

---

← Prev: [Sets](06-sets.md) · [Next → LinkedHashMap and TreeMap](08-linkedhashmap-treemap.md)
