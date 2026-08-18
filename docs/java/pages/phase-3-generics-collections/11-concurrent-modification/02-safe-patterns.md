---
title: "The safe patterns"
sidebar_label: "2 · The safe patterns"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation for
> `java.util.Iterator#remove`, `java.util.Collection#removeIf`,
> `java.util.ListIterator`, `java.util.Map.Entry#setValue` and
> `java.util.Map#values` (view removal semantics).

**Every safe way to mutate-while-iterating is one of four moves: let the
*iterator* do the deletion (`Iterator.remove`, `ListIterator`), let the
*collection* run the loop itself (`removeIf`, `values().removeIf`),
**separate the passes** (collect what to change, change it after), or
**iterate a snapshot** and mutate the original freely. Pick by what you're
doing — and for bulk deletion from an `ArrayList`, the choice changes the
complexity, not just the style.**

## 1 · `Iterator.remove` — the sanctioned single deletion

```java
Iterator<Order> it = orders.iterator();
while (it.hasNext()) {
    Order o = it.next();
    if (o.isCancelled()) {
        it.remove();          // deletes the element last returned by next()
    }
}
```

`remove()` deletes the element **last returned by `next()`**, then re-syncs
its `expectedModCount` — so iteration continues legally. Its rules, from
the Javadoc: callable **once per `next()`**, and not before the first
`next()` — otherwise `IllegalStateException`. It's also `default` and
throws `UnsupportedOperationException` where removal isn't supported
(immutable collections, `CopyOnWriteArrayList`'s iterator).

You must use the *explicit* iterator form — a `for`-each hides its
iterator, so there's nothing to call `remove()` on.

The same move works on maps through the views:

```java
Iterator<Map.Entry<String, Session>> it = sessions.entrySet().iterator();
while (it.hasNext()) {
    if (it.next().getValue().isExpired()) it.remove();   // removes the mapping
}
```

Removal through `keySet()`, `values()` or `entrySet()` iterators writes
through to the map — the views are live in both directions.

## 2 · `removeIf` — the bulk form, and the complexity win

```java
orders.removeIf(Order::isCancelled);
sessions.values().removeIf(Session::isExpired);   // map, by value predicate
words.removeIf(w -> w.length() < 3);
```

`Collection.removeIf(Predicate)` is the internal-iteration version: the
collection walks itself and deletes matches. Beyond reading better, on
`ArrayList` it is **algorithmically better**: the override does one pass
marking survivors and one compaction — **O(n)** total. An
`Iterator.remove` loop on an `ArrayList` calls the array-shifting removal
per match — **O(n²)** when many elements go. Deleting 100k of 1M elements
is the difference between milliseconds and minutes of pointless
`System.arraycopy`.

Rules of engagement: the predicate must not itself modify the collection
(that's a CME from inside `removeIf`), and on an immutable or fixed-size
list `removeIf` throws `UnsupportedOperationException` if anything
matches.

## 3 · `ListIterator` — replace and insert, not just delete

```java
ListIterator<String> it = lines.listIterator();
while (it.hasNext()) {
    String line = it.next();
    if (line.isBlank())        it.remove();          // delete
    else if (line.endsWith("\\")) it.set(line.strip()); // replace in place
    else if (line.startsWith("#include")) it.add("// expanded"); // insert after
}
```

`ListIterator` (lists only) adds `set` — replace the last-returned element
— and `add` — insert at the cursor — both legal mid-iteration, plus
backward traversal (`hasPrevious`/`previous`). It's the answer when the
transformation is positional: expanding one element into two, in-place
rewriting. (For pure replacement, `list.replaceAll(unary)` is the bulk
sibling of `removeIf`.)

On maps, the in-place counterpart is `entry.setValue(...)` during an
`entrySet()` walk — a value write is non-structural
([chunk 1](01-fail-fast-machinery.md)) and explicitly supported:

```java
for (Map.Entry<String, Integer> e : counts.entrySet()) {
    e.setValue(e.getValue() * 2);      // fine — no structural change
}
```

## 4 · Two passes — collect, then mutate

When the *decision* needs iteration but the *mutation* is awkward mid-walk
(you're adding elements, or mutating a different index, or the loop body
is deep in helper calls):

```java
List<User> toDeactivate = users.stream()
        .filter(u -> u.lastLogin().isBefore(cutoff))
        .toList();
users.removeAll(toDeactivate);              // or: toDeactivate.forEach(this::archive)

Map<String, Integer> updates = new HashMap<>();
for (var e : prices.entrySet()) {
    if (e.getValue() < 100) updates.put(e.getKey() + "-promo", e.getValue());
}
prices.putAll(updates);                     // additions happen after the walk
```

**Adding while iterating has no `Iterator.add` escape hatch** outside
`ListIterator` — collect-then-`putAll`/`addAll` is *the* pattern for
grow-during-scan logic. (`removeAll` on `ArrayList` is bulk and one-pass,
like `removeIf`.)

## 5 · Iterate a snapshot

```java
for (Listener l : List.copyOf(listeners)) {   // snapshot — cheap, one array copy
    l.onEvent(event);                          // handlers may add/remove listeners freely
}
```

Copy first, walk the copy, mutate the original at will. This is the fix
for **re-entrancy** — callbacks that mutate the collection that's
dispatching them — and for "I genuinely need index math and mutation at
once". Cost: one O(n) copy per traversal, and the walk sees the membership
as of the copy, which for listener dispatch is usually exactly the
semantics you want. (When *every* traversal needs this, the collection
itself should be a `CopyOnWriteArrayList` —
[chunk 3](03-the-boundaries.md).)

The functional sibling: don't mutate at all — `filter` into a new list and
swap the reference. With immutable collections
([Immutable collections](../12-immutable-collections.md)) that's the only option, by design.

## Choosing

| You want to | Use |
|---|---|
| Delete some elements, predicate known up front | `removeIf` (list, set, or `map.values()/keySet()`) |
| Delete during a walk whose body does more than filter | explicit `Iterator` + `it.remove()` |
| Replace elements in place | `replaceAll`, `ListIterator.set`, or `entry.setValue` |
| Insert while walking a list | `ListIterator.add`, or collect-then-`addAll` |
| Add keys while walking a map | collect-then-`putAll` — there is no other safe way |
| Mutate freely while others iterate (re-entrancy, listeners) | iterate a snapshot (`List.copyOf`), or `CopyOnWriteArrayList` |
| Not mutate at all | stream → `filter`/`map` → new collection |

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `IllegalStateException` from `it.remove()` | Called before any `next()`, or twice for one `next()` | One `remove` per `next`, after it |
| `UnsupportedOperationException` from `removeIf`/`it.remove` | Immutable collection (`List.of`), fixed-size view (`Arrays.asList`), or `CopyOnWriteArrayList` iterator | Mutate a mutable copy, or swap the reference to a rebuilt collection |
| Bulk deletion from a big `ArrayList` is mysteriously slow | `Iterator.remove` per element = O(n²) array shifting | `removeIf` / `removeAll` — single-pass compaction |
| CME thrown *from inside* `removeIf` | The predicate mutates the collection it's filtering | Predicates must be side-effect-free on the receiver; do secondary mutations in a second pass |
| `keySet().removeIf(...)` works but you needed the values to decide | Wrong view — `keySet` predicates only see keys | Iterate `entrySet()` with `it.remove()`, or `entrySet().removeIf(e -> ...)` |
| Listener that unsubscribes itself during dispatch breaks the loop | Re-entrant mutation of the iterated collection | Snapshot iteration (`List.copyOf`) or `CopyOnWriteArrayList` |
| `it.remove()` compiles nowhere in a `for`-each | The enhanced `for` hides its iterator | Rewrite as explicit `while (it.hasNext())`, or use `removeIf` |

## Interview questions

1. **Why is `Iterator.remove` legal when `list.remove` isn't, mid-loop?**
   The iterator performs the deletion itself and re-syncs its
   `expectedModCount` with the collection's `modCount` — the bookkeeping
   that an external removal invalidates.
2. **`removeIf` vs an `Iterator.remove` loop on `ArrayList` — any real
   difference?** Yes, complexity: the loop shifts the tail array once per
   removal (O(n²) for many removals); `removeIf` marks-and-compacts in one
   pass (O(n)). Same result, different asymptotics.
3. **How do you remove entries from a map while iterating it?** Iterate
   `entrySet()` with an explicit iterator and call `it.remove()`, or use
   `entrySet().removeIf(...)` / `values().removeIf(...)` — view removals
   write through to the map. Never `map.remove(key)` inside the walk.
4. **How do you *add* to a collection you're iterating?** For lists,
   `ListIterator.add`. For maps and sets there is no iterator-add: collect
   additions into a side collection and `putAll`/`addAll` after the walk —
   or iterate a snapshot and mutate the original directly.
5. **Is `entry.setValue(...)` during entry-set iteration safe?** Yes —
   replacing a value is not a structural modification; only adding/removing
   mappings is. Same reason `list.set(i, x)` is safe while `add`/`remove`
   aren't.
6. **A listener list where handlers can unsubscribe during dispatch — what
   do you reach for?** Snapshot-per-dispatch (`List.copyOf`) if dispatches
   are rare, `CopyOnWriteArrayList` if reads dominate writes — it's the
   textbook use case, and its iterator never throws CME.
7. **When is the right answer "don't mutate at all"?** Transformation
   logic: build the new state with `stream().filter(...).toList()` and swap
   the reference. Mandatory once the data lives in immutable collections;
   often clearer even when it doesn't.

---

← Prev: [The fail-fast machinery](01-fail-fast-machinery.md) · Index: [Iteration and `ConcurrentModificationException`](README.md) · Next → [The boundaries](03-the-boundaries.md)
