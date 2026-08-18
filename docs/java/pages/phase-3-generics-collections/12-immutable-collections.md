---
title: "Immutable collections"
sidebar_label: "12 · Immutable collections"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JDK 25 API documentation:
> `java.util.List#of`, `java.util.Set#of`, `java.util.Map#of`,
> `List#copyOf`/`Map#copyOf`, the `java.util` package's "Unmodifiable
> collections" section, `java.util.Collections#unmodifiableList`, and
> `java.util.Arrays#asList`.

**Java has two things that both get called "immutable", and confusing them
is the bug: `List.of(...)`/`List.copyOf(...)` build collections that
*cannot change* — no one holds a mutable handle to their storage — while
`Collections.unmodifiableList(list)` builds a read-only **view** of a list
that absolutely can still change, through the original reference. One is a
value you can hand out safely; the other is a window onto someone else's
mutable state.**

## The factories: `List.of`, `Set.of`, `Map.of`

```java
List<String> roles  = List.of("admin", "editor", "viewer");
Set<Integer> ports  = Set.of(80, 443, 8080);
Map<String, Integer> limits = Map.of("free", 10, "pro", 1000);
Map<String, Integer> many   = Map.ofEntries(
        Map.entry("free", 10),
        Map.entry("pro", 1000),
        Map.entry("enterprise", 100_000));   // past 10 pairs, ofEntries
```

Since Java 9, these produce the JDK's *unmodifiable collections* — compact
dedicated implementations (not wrappers), with rules the `java.util`
package doc spells out:

- **Every mutator throws `UnsupportedOperationException`** — `add`,
  `remove`, `set`, `put`, `clear`, `sort`, `replaceAll`, an iterator's
  `remove`, all of them, always.
- **`null` is rejected everywhere.** Not just as an element at creation —
  `List.of("a").contains(null)` and `Set.of(1).contains(null)` are
  *permitted by contract* to throw `NullPointerException`, and the JDK
  implementations do. A membership probe with a possibly-null needle is a
  landmine.
- **Duplicates are rejected at creation**: `Set.of("a", "a")` and
  `Map.of("k", 1, "k", 2)` throw `IllegalArgumentException` — at
  *construction*, not first use. A refactor that merges two constant lists
  into a `Set.of` can start throwing at class-init time.
- **`Set.of` and `Map.of` iteration order is unspecified — and
  deliberately randomized between JVM runs**, so order-dependent code
  fails visibly rather than on the customer's JVM.
- They are **value-based**: identity operations (`==` on two `List.of()`
  results, locking on one) are meaningless; factories may return cached
  instances — `List.of()` returns the same empty singleton.

## `copyOf` — the defensive copy that knows when not to copy

```java
public final class Route {
    private final List<Segment> segments;
    Route(List<Segment> segments) {
        this.segments = List.copyOf(segments);   // defensive copy, once
    }
    public List<Segment> segments() { return segments; }  // safe to return as-is
}
```

`List.copyOf` / `Set.copyOf` / `Map.copyOf` copy their argument into an
unmodifiable collection — **unless the argument already is one, in which
case they return it unchanged**. That optimization makes the
copy-on-the-way-in idiom effectively free along call chains that already
pass unmodifiable collections: only the first boundary pays for a copy.
Two consequences worth knowing:

- `copyOf` of a collection containing `null` throws NPE — same
  null-hostility as the factories.
- `Set.copyOf`/`Map.copyOf` deduplicate/reject like their factories
  (`Set.copyOf(listWithDupes)` silently dedupes; `Map.copyOf` can't have
  duplicate keys by construction).

The stream-side sibling is `Stream.toList()`, which also returns an
unmodifiable list — **`toList()` vs `Collectors.toList()`** *(not written
yet)* is the phase 4 topic.

## `unmodifiableList` — a live view, not a copy

```java
List<Segment> internal = new ArrayList<>(loadSegments());
List<Segment> exposed  = Collections.unmodifiableList(internal);

exposed.add(seg);          // UnsupportedOperationException — callers can't write
internal.add(seg);         // fine — and 'exposed' now shows the new element
```

`Collections.unmodifiableList` (and its `Set`/`Map`/`Collection`/
`SortedMap`... siblings) wraps the argument: reads delegate, writes throw.
The wrapped list remains fully mutable through the original reference, and
**every change is visible through the view** — the Javadoc's phrase is
that the view gives "read-only access" while allowing changes to show
through.

The aliasing bug this produces:

```java
class Catalog {
    private final List<Product> products = new ArrayList<>();
    List<Product> products() {
        return Collections.unmodifiableList(products);   // caller can't mutate...
    }
    void add(Product p) { products.add(p); }             // ...but this mutates
}

List<Product> snapshot = catalog.products();
int before = snapshot.size();
catalog.add(newProduct);
// snapshot.size() != before — the "snapshot" was never a snapshot
```

A caller who cached `products()` as a stable value now has a collection
that changes underneath them — including **mid-iteration**, where a
structural change in `internal` triggers the fail-fast machinery of
[topic 11](11-concurrent-modification/01-fail-fast-machinery.md) through
the view.

When is the view *right*? When live read-through is the point: exposing a
mutating internal registry read-only, without paying a copy per call. Name
it accordingly and don't let callers mistake it for a snapshot.

`Arrays.asList` sits in a third position: a **fixed-size but writable**
view of an array — `set` writes through to the array, `add`/`remove`
throw. It predates all of the above (Java 1.2) and is now mostly a
stepping stone: `new ArrayList<>(Arrays.asList(...))` for a mutable list,
`List.of(...)` for an immutable one.

## Shallow, always

Immutability stops at the references the collection holds:

```java
List<StringBuilder> steps = List.of(new StringBuilder("step 1"));
steps.get(0).append(" — DONE");   // fine: the *list* never changed
```

`List.of` freezes membership, not elements. Deep immutability is
compositional: an unmodifiable collection **of immutable elements**
([records](../phase-2-classes-objects/08-records/README.md), `String`,
value types) — that combination is what you can share across threads and
cache without thinking, and it's the shape
[immutable design](../phase-2-classes-objects/12-immutable-design.md)
argues for at the class level.

## Choosing

| Need | Reach for | Copy? | Mutators |
|---|---|---|---|
| Constant collection, known elements | `List.of` / `Set.of` / `Map.of` | — | throw |
| Freeze incoming data at a boundary (field, return) | `List.copyOf` / `Map.copyOf` | yes, unless already unmodifiable | throw |
| Expose internal mutable state read-only, **live** | `Collections.unmodifiableX` | no — view | throw (through view only) |
| Stream result nobody should mutate | `Stream.toList()` | produces unmodifiable | throw |
| Mutable working list from known elements | `new ArrayList<>(List.of(...))` | yes | work |
| Array as a fixed-size list | `Arrays.asList` | no — view over the array | `set` works, `add`/`remove` throw |

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `UnsupportedOperationException` deep in code that "just sorts a list" | The list arrived from `List.of`, `copyOf`, `Stream.toList` or `Map.entry` values — all unmodifiable | Copy before mutating: `new ArrayList<>(list)`; APIs should document mutability of what they return |
| `NullPointerException` from `contains(null)` / `remove(null)` | Unmodifiable collections may reject `null` *queries*, not just null elements | Null-check the needle first, or use a null-tolerant collection if nulls are real data |
| `IllegalArgumentException: duplicate element` at class-init | `Set.of`/`Map.of` with duplicate elements/keys — checked at construction, often in a `static` initializer | Deduplicate first (`Set.copyOf(list)` dedupes silently) or fix the constants |
| Test passes locally, fails in CI on iteration order | `Set.of`/`Map.of` order is randomized per JVM run by design | Never depend on their order; sort at use, or use `LinkedHashSet`/`LinkedHashMap` |
| A "snapshot" from a getter changes after later service calls | Getter returned `unmodifiableList(internal)` — a live view, not a copy | Return `List.copyOf(internal)` for value semantics, or document the view-ness loudly |
| CME while iterating a list nobody (visibly) mutates | Iterating an unmodifiable *view* while the backing list mutates elsewhere | Iterate a copy, or fix the sharing — the view inherits the backing list's fail-fast iterators |
| Elements of an "immutable" list keep changing | Shallow immutability — membership is frozen, element state isn't | Make elements immutable (records, final fields) or store defensive copies of them |
| `Route`'s constructor copy "costs nothing" in one path, allocates in another | `copyOf` returns unmodifiable inputs as-is, copies everything else | That's the design — pay once at the first boundary; don't "optimize" it away |

## Interview questions

1. **`List.copyOf(x)` vs `Collections.unmodifiableList(x)` — the real
   difference?** `copyOf` detaches: an independent unmodifiable collection
   (skipping the copy if `x` already is one). `unmodifiableList` wraps: a
   read-only *view* through which every later change to `x` is visible.
   Value vs window.
2. **Why does returning `unmodifiableList(field)` from a getter not make
   the class immutable?** The field is still mutated internally, and every
   mutation shows through the returned view — callers get read-only access
   to *changing* state. Immutability needs `copyOf` (or an already-frozen
   field).
3. **What are three ways `List.of`/`Map.of` fail *at creation* rather than
   at use?** Null element/key/value → NPE; duplicate `Set.of` elements or
   `Map.of` keys → `IllegalArgumentException`; more than 10 `Map.of` pairs
   → doesn't compile (switch to `Map.ofEntries`). Failing at construction
   is the feature — the constant is wrong, so the program shouldn't start.
4. **Why might `unmodifiableCollection.contains(null)` throw NPE?** The
   unmodifiable collections' contract permits rejecting null on *queries*,
   and the JDK implementations do — they never contain null, and the
   contract chooses loud over silent-false.
5. **Is an immutable collection thread-safe?** Yes — no mutation exists to
   race. Safe publication of the *reference* (a `final` field, a
   `volatile` swap) is the remaining concern; whole read-mostly designs
   are built on swapping successive immutable snapshots.
6. **Where should the defensive copy happen — in, out, or both?** Copy
   **in** at the constructor (`List.copyOf(arg)`) so no caller retains a
   mutable handle; then returning the field as-is is safe *because* it's
   unmodifiable. Copy-out per getter is the fallback when the field must
   stay mutable internally.
7. **`Arrays.asList` vs `List.of` — both "make a list from elements";
   pick one.** `Arrays.asList` is a live fixed-size view over an array —
   `set` writes through, nulls allowed. `List.of` is fully immutable and
   null-hostile. New code that doesn't need write-through wants `List.of`;
   the interop case (an array you keep using) is `asList`'s remaining job.
8. **Why does `Set.of`/`Map.of` randomize iteration order?** To break
   order-dependence *early and locally*: code that accidentally relies on
   unspecified order fails on the developer's machine at the next JVM
   restart, not months later on a JDK upgrade. `HashMap` merely doesn't
   promise order; the immutable factories actively scramble it.

---

← Prev: [Iteration and `ConcurrentModificationException`](11-concurrent-modification/README.md) · Index: [Phase 3 — Generics and collections](README.md) · Next → [`Collections` and `Arrays` utilities](13-collections-arrays-utilities.md)
