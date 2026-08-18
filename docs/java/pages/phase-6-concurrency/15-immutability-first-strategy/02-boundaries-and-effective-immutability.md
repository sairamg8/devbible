---
title: "Boundaries, copies and effectively immutable"
sidebar_label: "2 · Boundaries and copies"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `List.copyOf`,
> `Map.copyOf`, `Set.copyOf`, `Collections.unmodifiableList` and the
> `java.util` immutable-collections spec ("Unmodifiable collections"
> package documentation), JLS SE 25 §17.5, and the Oracle Java Tutorials
> (Immutable Objects, A Strategy for Defining Immutable Objects).

**An immutable core is only as good as its borders. Data arrives from
callers who keep references, leaves toward callers who might mutate, and
sits in fields whose types (`List`, `Date`, arrays) are mutable even
when your intent is not. The border toolkit is small — `copyOf` on the
way in, unmodifiable types on the way out — but the failure modes are
subtle, because a class can *look* immutable, *behave* immutably in
every test, and still be one aliased reference away from a race.**

## In at the border: `copyOf`, not the caller's object

```java
record RolloutPlan(List<String> regions, Map<String, Integer> weights) {
    RolloutPlan {
        regions = List.copyOf(regions);
        weights = Map.copyOf(weights);
    }
}
```

`List.copyOf`/`Map.copyOf`/`Set.copyOf` do three distinct jobs at once:

- **Cut the alias.** The caller's list is theirs to keep mutating; your
  field no longer points at it.
- **Guarantee unmodifiability forever.** The result rejects all mutators
  with `UnsupportedOperationException` — there is no reference anywhere
  through which it can change.
- **Skip the copy when it's already safe.** Given an instance that is
  itself one of the JDK's immutable collections, `copyOf` returns it
  as-is (specified behavior) — repeated defensive copying of
  already-immutable data costs nothing.

Two spec details worth knowing cold: the JDK's immutable collections
**reject `null` elements** (`copyOf` throws `NullPointerException` on a
null-containing input — a legacy `ArrayList` with nulls will not convert
silently), and `Map.copyOf` iteration order is **unspecified** (unlike
the source `LinkedHashMap` a caller might have passed — ordering
assumptions break quietly).

## Out at the border: never return the mutable field

The mirror-image leak: a getter that returns the internal collection
hands every caller a mutation capability.

- Field already `List.copyOf`-ed at construction → return it directly;
  it is unmodifiable and shared safely.
- Field is a mutable working collection (a cache, an accumulator) →
  return `List.copyOf(field)` (snapshot) or an
  `Collections.unmodifiable*` **view** — and know the difference: the
  *view* is read-through, so callers see later internal mutations
  (concurrently — which reintroduces the visibility problem); the
  *snapshot* is frozen. For anything crossing a thread boundary, the
  snapshot is the answer.
- Arrays have no unmodifiable form. `clone()` on the way in and out, or
  better, don't expose arrays across boundaries at all.

## "Effectively immutable" — real, useful, fragile

Not every class you rely on is `final`-field immutable. An object is
*effectively immutable* when it is never mutated after publication, even
though its type would allow it — a `HashMap` built during startup and
only read afterward, a POJO from a framework populated once.

Effectively immutable objects are safe to share **if safely published**
— handed to other threads through a happens-before edge:
a `volatile`/`AtomicReference` write, a lock, a `Thread.start`, an
executor submission, or a concurrent collection
([safe publication](../05-java-memory-model/03-volatile-and-safe-publication.md)).
The §17.5 racy-publication bonus does **not** apply — that is the
`final`-fields-only privilege from
[chunk 1](01-why-it-deletes-the-problem.md). Racy publication of an
effectively immutable `HashMap` can expose a half-built table.

The fragility is temporal, and nothing checks it:

1. **The "never mutated after" clause is a promise, not a property.**
   One late `map.put` — a lazy cache "optimization" added two years in —
   silently converts safe sharing into a data race across the codebase.
2. **The publication requirement is invisible at the use site.** The
   reader's code looks identical whether publication was safe or racy;
   only the wiring decides.

Which is the argument for promoting effectively immutable data to
actually immutable (`Map.copyOf` at the end of the build phase): it
converts both promises into properties.

## Deep vs shallow: draw the line deliberately

Immutability is per-layer. `List.copyOf(listOfThings)` freezes the
*list*; the `Thing`s inside are as mutable as their class allows. The
practical rule: **an object is immutable when everything reachable from
it is immutable or confined.** Records of records of strings — done.
A record holding your own mutable domain class — the border moved, it
didn't disappear. Either make the inner type immutable too (usually the
right call, recursively cheap with records) or document that the graph's
leaves are confined to one thread.

## Gotchas

**Symptom:** class has final fields and no setters, yet another thread observes its list contents changing
**Cause:** constructor stored the caller's list; the caller kept mutating it — aliasing, not assignment
**Fix:** `List.copyOf` in the constructor; treat every constructor parameter of mutable type as radioactive until copied

**Symptom:** `List.copyOf` in a migration starts throwing `NullPointerException` in production
**Cause:** the legacy collection contained nulls; JDK immutable collections reject them by spec
**Fix:** decide what null *meant*, then filter or replace with a sentinel/`Optional` before copying — the crash is surfacing a latent modeling hole

**Symptom:** caller of a getter sees the collection change while iterating, `ConcurrentModificationException` under load
**Cause:** getter returned an `unmodifiableList` *view* over a still-mutated internal list — unmodifiable ≠ immutable
**Fix:** return a `List.copyOf` snapshot across thread boundaries; reserve views for single-threaded read-through cases

**Symptom:** startup-built `HashMap`, read-only forever after, still produces impossible lookups on other threads
**Cause:** effectively immutable but *racily published* — no happens-before between the build and the readers; §17.5 doesn't cover non-final fields
**Fix:** publish through `volatile`/`AtomicReference`, or better `Map.copyOf` it into a truly immutable map at the end of the build

**Symptom:** "immutable" config object's `getDate()` drifts
**Cause:** `java.util.Date` is mutable and the getter exposed the field; a caller called `setTime` on it
**Fix:** `java.time` types (immutable by design) — or copy on the way out while migrating

**Symptom:** unit tests all pass; the race only exists in production wiring
**Cause:** tests exercise one thread, where aliasing and unsafe publication are invisible by definition
**Fix:** review borders structurally (every ctor parameter and getter of mutable type), don't wait for tests to catch what they cannot see

**Symptom:** `Map.copyOf` result iterates in a different order than the `LinkedHashMap` it copied
**Cause:** JDK immutable maps have unspecified iteration order
**Fix:** if order is meaningful, keep a `List` of keys alongside, or expose entries as an ordered immutable `List`

## Interview questions

**★ `Collections.unmodifiableList(x)` vs `List.copyOf(x)` — the real difference?**
`unmodifiableList` is a *view*: no copy, read-through, so mutations of
`x` remain visible (and remain a concurrency hazard). `copyOf` is a
*snapshot*: independent, unmodifiable through every reference, and a
no-op when `x` is already a JDK immutable collection. Across thread
boundaries, the snapshot is the only one that ends the analysis.

**★ What is safe publication and why do effectively immutable objects need it when `final`-field ones don't?**
Safe publication hands a reference across threads through a
happens-before edge, guaranteeing the reader sees all writes made before
publication. §17.5 gives `final` fields that guarantee even under racy
publication; effectively immutable objects have ordinary fields, so
without the edge a reader can see partially-initialized state.

**★ A constructor does `this.items = items` with a `List` parameter. Enumerate what can go wrong under threads.**
The caller retains the reference: later caller mutations race with your
readers (no synchronization anywhere); your "immutable" hash/equals can
change while the object is a map key; iteration can throw
`ConcurrentModificationException`; and §17.5 only froze the *reference*,
not the list contents — so even final can't save it.

**★ When is a defensive copy unnecessary?**
When the input is already immutable (a record of immutables, a JDK
immutable collection — `copyOf` even detects this and skips the work),
or when the object never crosses a trust or thread boundary (truly
confined). "The caller probably won't mutate it" is not on the list.

**★ How would you harden a "built at startup, read forever" map?**
Finish the build, then `Map.copyOf` into the field that readers use —
promotion from effectively to actually immutable. Publish that field
safely (`final` field of a singleton initialized before threads start,
or a `volatile`). Now both fragility clauses — "never mutated after" and
"safely published" — are properties of the code, not promises in a
comment.

---

← Prev: [Why it deletes the problem](01-why-it-deletes-the-problem.md) · Index: [Immutability as the first strategy](README.md) · Next → [Change as replacement](03-change-as-replacement.md)
