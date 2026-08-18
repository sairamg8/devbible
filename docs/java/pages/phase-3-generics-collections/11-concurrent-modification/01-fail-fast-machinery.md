---
title: "The fail-fast machinery"
sidebar_label: "1 · The fail-fast machinery"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation for
> `java.util.ConcurrentModificationException`, `java.util.ArrayList`
> (fail-fast paragraph and "structural modification" definition),
> `java.util.HashMap`, and `java.util.Iterator`.

**`ConcurrentModificationException` is not (primarily) about threads. It is
an `ArrayList` or `HashMap` noticing — *best-effort, on the next iterator
step* — that the collection was structurally changed by something other
than the iterator itself, and refusing to continue with a now-meaningless
cursor. The most common trigger is one thread: a `for`-each loop that calls
`list.remove(...)` on the list it is walking. The exception is the good
outcome; the alternative is silently skipping or repeating elements.**

## What "structural modification" means

The `ArrayList` class doc defines it: any operation that **adds or deletes
elements**, or otherwise perturbs the backing structure so that an
in-progress iteration would go wrong. Concretely, per class:

| Collection | Structural (bumps the count) | NOT structural |
|---|---|---|
| `ArrayList` | `add`, `remove`, `clear`, `removeIf`, `sort`, `trimToSize`, `ensureCapacity` growth | `set(i, x)` — replaces in place |
| `LinkedList` | `add`, `remove`, `clear`, `addFirst`… | `set(i, x)` |
| `HashMap` | `put` of a **new** key, `remove`, `clear`, `merge` that inserts/deletes | `put` over an **existing** key, `Entry.setValue` |
| `HashSet` | `add` of a new element, `remove`, `clear` | `add` of an already-present element (no-op) |

The non-structural column is why some "modification during iteration" code
is legal: overwriting the value under an existing map key, or `set`-ting a
list slot, is safe mid-iteration. Adding or deleting is not.

## The mechanism: `modCount`

Every fail-fast collection keeps a modification counter. The OpenJDK field
is `modCount` (a `protected transient int` on `AbstractList`, and an
internal field on `HashMap`), incremented by every structural modification.

When you create an iterator, it copies the current value into its own
`expectedModCount`. Then **every `next()` (and `remove()`) first checks**
`modCount == expectedModCount` — and throws `ConcurrentModificationException`
if they differ. The iterator's *own* `remove()` re-syncs
`expectedModCount = modCount` after deleting, which is exactly why it is
the one deletion allowed during iteration
([chunk 2](02-safe-patterns.md)).

```java
for (Order o : orders) {          // desugars to: Iterator<Order> it = orders.iterator();
    if (o.isCancelled()) {        //              while (it.hasNext()) { Order o = it.next(); ... }
        orders.remove(o);         // modCount++ — iterator's expectedModCount is now stale
    }
}                                 // next it.next() → ConcurrentModificationException
```

The enhanced `for` loop **is** an iterator — the JLS defines it as sugar
over `iterator()` for any `Iterable`. There is no separate "for-each mode"
that tolerates modification; the hidden iterator throws like any other.

## Why it sometimes *doesn't* throw — the missed-removal quirk

The check lives in `next()`, not in `hasNext()`. `ArrayList`'s
`hasNext()` is just `cursor != size`. Remove the **second-to-last**
element mid-loop and `size` shrinks by one exactly as `cursor` reaches it:
`hasNext()` returns `false`, the loop ends early — **no exception, and the
last element was never visited**.

```java
List<String> tags = new ArrayList<>(List.of("a", "b", "c"));
for (String t : tags) {
    if (t.equals("b")) tags.remove(t);   // no CME — but "c" is silently skipped
}
```

This is the single most instructive CME fact: the same illegal pattern
either throws or **silently corrupts the traversal**, depending on *which
index* you removed. Code that "works in the test" (removed an early
element → threw → got fixed) versus "works in prod until it doesn't"
(removed near the end → skipped data). Treat the exception as the friendly
version of the bug, not the bug itself.

## Best-effort, by contract

The `ConcurrentModificationException` Javadoc is explicit twice over:

- **Fail-fast behavior cannot be guaranteed.** Unsynchronized concurrent
  modification can miss the check entirely. The doc's words: it would be
  wrong to write a program that *depended on this exception for its
  correctness* — "should be used only to detect bugs."
- **The name overpromises.** It is thrown by single-threaded code far more
  often than by genuinely concurrent code, and the doc says so ("if a
  single thread issues a sequence of method invocations that violates the
  contract of an object, the object may throw this exception").

Under real multi-thread access without synchronization, you may get a CME,
or a wrong answer, or an infinite loop (the classic pre-Java-8 unsynchronized
`HashMap` resize loop), or nothing. CME is a tripwire, not a lock. Actual
concurrent iteration belongs to the concurrent collections in
[chunk 3](03-the-boundaries.md).

## Where else the check fires

- **`Map` views**: iterating `keySet()`, `values()` or `entrySet()` while
  `put`-ting a new key or `remove`-ing throws from the view's iterator.
- **`forEach(Consumer)`**: `ArrayList.forEach` and `HashMap.forEach` check
  `modCount` after (and during) the run — mutating the receiver inside the
  lambda throws even though no explicit iterator is in sight.
- **Streams**: a stream over a list is lazy; mutate the list between
  building the pipeline and the terminal operation and the terminal op
  throws ([chunk 3](03-the-boundaries.md)).
- **`subList` views**: structurally modify the *parent* list, then touch
  the sublist — the sublist's own `modCount` check throws, even outside
  iteration.
- **`Collections.synchronizedList`**: wrapping in `synchronized` does
  **not** help — iteration is many calls, each individually locked, with
  gaps between them. The Javadoc requires you to hold the lock manually
  around the whole traversal.

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| CME from a loop with no threads anywhere | `list.remove`/`map.put`(new key) inside a `for`-each over the same collection | `Iterator.remove`, `removeIf`, or collect-then-remove ([chunk 2](02-safe-patterns.md)) |
| The same removal loop throws on some inputs, silently skips an element on others | Check lives in `next()`; removing the second-to-last element makes `hasNext()` end the loop early | Same fix — never structurally modify the collection you're iterating, whether or not it happens to throw |
| CME from `map.forEach((k, v) -> ...)` | The lambda mutates the map it's iterating (`put` of a new key, `remove`) | Collect keys to act on, mutate after; or use `entry.setValue` / value-overwrite `put`, which are non-structural |
| CME from code that only ever calls `list.set(...)`... on a `subList` | The **parent** list was structurally modified after the sublist view was made | Re-create the sublist after parent mutations; treat sublists as short-lived views |
| `synchronizedList` still throws CME during iteration | The wrapper locks per method call, not per traversal | `synchronized (list) { for (...) {...} }` exactly as its Javadoc instructs — or use `CopyOnWriteArrayList` |
| CME appears intermittently under load, never in tests | Real concurrent modification — fail-fast is best-effort and timing-dependent | Don't chase the exception; fix the sharing: confinement, synchronization, or a concurrent collection ([chunk 3](03-the-boundaries.md)) |
| CME (or nothing, wrongly) when a listener added during event dispatch | Callback re-enters and mutates the collection being iterated | Iterate a snapshot — `List.copyOf` — or `CopyOnWriteArrayList`, built for exactly this |

## Interview questions

1. **Does `ConcurrentModificationException` mean two threads touched the
   collection?** No — most CMEs are single-threaded: structural
   modification of a collection from inside its own iteration. The Javadoc
   itself notes the single-thread case and calls fail-fast a bug detector.
2. **What exactly triggers it, mechanically?** Structural modifications
   bump an internal `modCount`; each iterator snapshots it as
   `expectedModCount` and compares on every `next()`/`remove()`. Mismatch
   → throw. The iterator's own `remove()` re-syncs the snapshot, which is
   why it's legal.
3. **What counts as a structural modification — is `list.set(i, x)` one?
   `map.put` over an existing key?** No and no: replacing an element or a
   value in place doesn't add or delete, so it doesn't bump `modCount` and
   is safe mid-iteration. `add`, `remove`, `clear`, inserting a *new* key —
   structural.
4. **Can removing during a for-each ever *not* throw?** Yes — remove the
   second-to-last element and `hasNext()` (which only compares cursor to
   size) returns false early: loop ends, last element silently unvisited,
   no exception. That's why the pattern is wrong even when it doesn't
   throw.
5. **Why can't you rely on CME for correctness?** The contract says
   fail-fast is best-effort: under unsynchronized concurrent access the
   check can be missed and behavior is undefined (wrong results, historic
   infinite-loop resizes). It exists to surface bugs early, not to make
   concurrent mutation safe.
6. **Why does wrapping with `Collections.synchronizedList` not fix
   iteration?** Each method call is atomic, but a traversal is many calls
   with unlocked gaps; another thread (or your own loop body) can modify
   between them. The wrapper's doc requires manually synchronizing on the
   list around the whole iteration.
7. **A `for`-each loop has no visible iterator — why does it still
   throw?** The enhanced `for` statement is compiler sugar over
   `iterator()`/`hasNext()`/`next()`; the hidden iterator carries the same
   `expectedModCount` check as an explicit one.

---

← Index: [Iteration and `ConcurrentModificationException`](README.md) · Next → [The safe patterns](02-safe-patterns.md)
