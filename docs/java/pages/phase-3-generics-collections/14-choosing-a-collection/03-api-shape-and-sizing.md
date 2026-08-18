---
title: "API shape and sizing"
sidebar_label: "3 · API shape and sizing"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 Javadoc for `HashMap` (capacity and
> load-factor documentation), `ArrayList` (`ensureCapacity`), `List.copyOf`
> / `Collections.unmodifiableList`, and the Collections Framework overview's
> guidance on interface types.

**The type you *choose* and the type you *show* are different decisions.
Fields and signatures name the interface (`List`, `Map`, `Set` — or the
narrower `Collection`/`Iterable` when that's all you need); the
implementation is a constructor-site detail you can swap in one line. And
what you hand a caller is a copy or an immutable view — never the live
internal structure.**

## Interface-typed everywhere but `new`

```java
private final Map<UserId, User> byId = new HashMap<>();   // field: interface
public List<Order> ordersFor(UserId id) { ... }           // return: interface

// the one legitimate exception — the *implementation* is the contract:
private final LinkedHashMap<K, V> lru = ...;              // access-order behaviour is the point
```

- Callers code against `List`; swapping `ArrayList` → `CopyOnWriteArrayList`
  ([Phase 6](../../phase-6-concurrency/README.md)) touches one line.
- Take the **widest parameter** that works: a method that only iterates
  should take `Collection<T>` or `Iterable<T>`, not `List<T>` — every set
  and custom iterable ([topic 15](../15-writing-an-iterable.md)) becomes a
  valid argument for free.
- Return the **narrowest honest promise**: if callers need order, return
  `List`; if they need "no duplicates", `Set`; declaring `NavigableMap`
  promises navigation forever — widen with care, narrow never.

## What you hand out

Returning the internal list gives every caller a mutation handle on your
state — the classic encapsulation leak
([Phase 2, immutable design](../../phase-2-classes-objects/12-immutable-design/README.md)):

| Hand out | Meaning | Cost |
|---|---|---|
| `List.copyOf(internal)` | independent immutable snapshot | O(n) per call |
| `Collections.unmodifiableList(internal)` | read-only **live view** — sees later internal changes | O(1), but aliasing is now part of your API |
| `new ArrayList<>(internal)` | mutable copy, caller may edit freely | O(n), caller edits don't reach you |
| the internal reference | a bug in waiting | free, until it isn't |

Default to `List.copyOf` on reads; document it if a hot path deliberately
returns a view.

## Sizing hints — when and why

- **`new ArrayList<>(n)`** when n is known: skips the grow-and-copy
  ladder. Growth is amortized O(1) regardless, so this is a real but small
  win — do it when n is available, don't contort to compute it.
- **`new HashMap<>(expected / 0.75f + 1)`**, or
  `HashMap.newHashMap(expected)` (JDK 19+), which does that arithmetic for
  you (documented): a `HashMap` resizes when size exceeds
  capacity × load factor, and each resize rehashes everything. Sizing a
  million-entry load correctly removes ~20 rehash storms.
- **Load factor stays 0.75** unless you can argue otherwise from the
  Javadoc's own space/time trade-off paragraph — lower trades memory for
  fewer collisions, higher the reverse; changing it is almost never the fix.
- `ensureCapacity` exists on `ArrayList` for the mid-life bulk-add; on
  `HashMap` the constructor hint is the only lever.

## When the general types are the wrong call

- **Enum keys/members** → `EnumMap`/`EnumSet`
  ([Phase 2's chunk](../../phase-2-classes-objects/10-enums/03-collections-boundaries-persistence.md)).
- **Primitive sequences in bulk** → arrays or `IntStream` pipelines —
  `List<Integer>` pays boxing per element
  ([Phase 1, autoboxing](../../phase-1-language-core/02-autoboxing-integer-cache/README.md));
  the memory multiple is what kills heaps, not the CPU.
- **Fixed-size byte/char buffers at I/O edges** → arrays, by the API's own
  shape ([Phase 7](../../phase-7-io-time-stdlib/README.md)).
- **Cross-thread structures** → the `java.util.concurrent` types, not
  synchronized wrappers — [Phase 6's whole subject](../../phase-6-concurrency/README.md).

## Gotchas

**Symptom:** caller mutates your "internal" list; state corrupts far from the writer
**Cause:** a getter returned the live reference
**Fix:** `List.copyOf` on the way out (and on the way *in* for constructor params — defensive both directions)

**Symptom:** API declared `ArrayList<Order>` in a signature; changing the implementation breaks binary/source compatibility
**Cause:** implementation type leaked into the contract
**Fix:** interfaces in signatures; the concrete class appears exactly once, at `new`

**Symptom:** `unmodifiableList` result "changes by itself"
**Cause:** it is a view — the producer kept the backing list and kept writing
**Fix:** decide which you're selling: snapshot (`List.copyOf`) or live read-only feed (view, documented as such)

**Symptom:** bulk load of n known entries spends its time in `resize`/`rehash`
**Cause:** default 16-capacity `HashMap` doubling its way up
**Fix:** `HashMap.newHashMap(n)` (or the ÷0.75 arithmetic pre-19); same idea for `new ArrayList<>(n)`

**Symptom:** a method takes `List<T>` and callers keep writing `new ArrayList<>(set)` at every call site
**Cause:** parameter over-demands — the body only iterates
**Fix:** accept `Collection<T>` (or `Iterable<T>`); the copies vanish

**Symptom:** `Map<Status, Handler>` as `HashMap` with a comment "TODO handle all statuses"
**Cause:** general-purpose map where the key space is a closed enum
**Fix:** `EnumMap` + an exhaustiveness check at startup (`EnumSet.complementOf` of the key set names what's missing)

## Interview questions

**★ Why `List` in the field but `ArrayList` at `new`?**
The field type is a promise to readers of the class; the constructor is a
private performance decision. Interface-typed fields make the swap
(`ArrayList` → immutable copy → concurrent type) a one-line diff with no
ripple — and they stop you accidentally using implementation-only methods
that lock the choice in.

**★ `List.copyOf` vs `unmodifiableList` vs `new ArrayList<>` on a getter — pick one and defend it.**
`copyOf` by default: immutable, independent, and cheap to reason about.
The view when the caller genuinely wants a live feed and you document the
aliasing. The mutable copy when the API's point is "here's yours to edit".
The wrong answer is not having a policy.

**★ What exactly does `HashMap`'s load factor control?**
The fill ratio that triggers a resize: capacity × loadFactor entries. The
Javadoc frames it as the time/space trade-off — 0.75 is the documented
sweet spot. Sizing via `newHashMap(expected)` is the practical takeaway;
tuning the factor itself almost never is.

**★ When would you take `Iterable<T>` as a parameter — and what does it cost you?**
When the body only enhanced-for-loops. It admits every collection and every
custom source ([topic 15](../15-writing-an-iterable.md)) — but gives you no
`size`, no `contains`, no second pass without re-iterating; if you need
those, `Collection<T>` is the honest floor.

**A constructor takes `List<Item> items` and stores it. What's the review comment?**
Defensive copy: `this.items = List.copyOf(items)` — otherwise the caller
still holds a write handle into your invariants, and `copyOf` also
null-checks elements. Same reasoning as Phase 2's immutable-design rules.

---

← Prev: [Worked scenarios](02-worked-scenarios.md) · Index: [Choosing a collection](README.md) · Next → [Writing an Iterable](../15-writing-an-iterable.md)
