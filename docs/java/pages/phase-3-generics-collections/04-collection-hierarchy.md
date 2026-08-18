---
title: "The collection hierarchy"
sidebar_label: "04 · The collection hierarchy"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for
> `java.util.Collection`, `List`, `Set`, `Map`, `Queue`, `Deque`,
> `SequencedCollection` and `SequencedMap`, and JEP 431 (Sequenced
> Collections, final in JDK 21).

**The collections framework is a small set of interfaces — the map of what
exists — and a larger set of implementations you pick per use. `Iterable`
sits on top; `Collection` splits into `List` (ordered, indexed), `Set` (no
duplicates) and `Queue`/`Deque` (ends-based access); `Map` is deliberately
*outside* the tree, because a key→value table is not a bag of elements.
Learn the interfaces and every signature in the JDK becomes readable —
implementations are a per-callsite choice, not a vocabulary.**

## The map itself

```
Iterable<T>                     ← anything a for-each can walk
 └── Collection<E>              ← size, add, remove, contains, stream
      ├── List<E>               ← positional: get(i), ordered, duplicates OK
      ├── Set<E>                ← no duplicates
      │    └── SortedSet<E> → NavigableSet<E>     (TreeSet)
      └── Queue<E>              ← head-based: offer / poll / peek
           └── Deque<E>         ← both ends: stacks AND queues (ArrayDeque)

Map<K,V>                        ← NOT a Collection
 └── SortedMap<K,V> → NavigableMap<K,V>           (TreeMap)
```

Since JDK 21 (JEP 431), three retrofitted interfaces slot into that
picture: `SequencedCollection` (a supertype of `List` and `Deque`, and
implemented by `LinkedHashSet` and `SortedSet`) adds `getFirst()`,
`getLast()`, `addFirst()`, `addLast()`, `removeFirst()`, `removeLast()` and
`reversed()`; `SequencedSet` and `SequencedMap` do the same for sets and
maps (`firstEntry()`, `pollFirstEntry()`, `reversed()`), so "the first
element of an ordered thing" finally has one spelling instead of five —
`list.get(0)`, `deque.peekFirst()`, `sortedSet.first()`, and
`iterator().next()` were all doing that job before.

| Interface | The promise | Default pick | Reach for the others when |
|---|---|---|---|
| `List` | order + index, duplicates allowed | `ArrayList` (topic 05) | `CopyOnWriteArrayList` for read-mostly concurrency (phase 6) |
| `Set` | no duplicates | `HashSet` (topic 06) | order matters → `LinkedHashSet`; sorted/range → `TreeSet` |
| `Map` | key → value, unique keys | `HashMap` (topic 07) | predictable order / LRU → `LinkedHashMap`; sorted/range → `TreeMap` |
| `Queue` | FIFO handoff | `ArrayDeque` (topic 09) | priorities → `PriorityQueue`; threads → `BlockingQueue` (phase 6) |
| `Deque` | both-ends access, stack **and** queue | `ArrayDeque` | never `Stack` — **[topic 16 explains why](16-legacy-types.md)** |

## Why `Map` is not a `Collection`

A `Collection<E>` holds *elements of one type*. What would a
`Map<K,V>`'s element type be? Keys? Values? Pairs? Each answer breaks
something — `add(E)` has no sensible meaning for a table, and `iterator()`
would have to privilege one of the three read shapes. The framework's
answer is to keep `Map` separate and expose the three shapes as **views**:

```java
Map<String, Order> byId = loadOrders();
Set<String>        keys    = byId.keySet();     // keys are unique → a Set
Collection<Order>  values  = byId.values();     // values can repeat → a Collection
Set<Map.Entry<String, Order>> entries = byId.entrySet();  // the pairs
```

The views are the bridge back into the `Collection` world — they are
**live**: removing from `keySet()` removes the mapping from the map (adding
is unsupported). And because `Map` is not `Iterable`, a for-each over "the
map" is really a for-each over a view:

```java
for (Map.Entry<String, Order> e : byId.entrySet()) {   // not `for (... : byId)`
    process(e.getKey(), e.getValue());
}
byId.forEach((id, order) -> process(id, order));        // the lambda spelling
```

Iterating `entrySet()` when you need both key and value is the right habit;
iterating `keySet()` and calling `get(key)` per element does a second
lookup per entry for nothing.

## Program to the interface

Declare variables, fields, parameters and return types as the *interface*;
choose the *implementation* once, at construction:

```java
List<Order> pending = new ArrayList<>();     // not: ArrayList<Order> pending
Map<String, User> byEmail = new HashMap<>();
```

The payoff is at the seams. A parameter typed `ArrayList<Order>` rejects
the `List.of(...)` a test wants to pass and the `LinkedList` a legacy
caller has; typed `List<Order>` it takes any of them. Widen parameters to
what you actually *use* — a method that only iterates can take
`Collection<Order>` or even `Iterable<Order>`; one that needs indexed
access needs `List<Order>`. Return types go the other way: return the most
specific type whose promises you want callers to rely on (`List` when order
is part of the contract, `Set` when uniqueness is), and see topic 05's
chunk on defensive copies for *what* you hand back.

The exception to "never name the implementation" is when the
implementation *is* the contract — a field that must be a `TreeMap`
because the class's API exposes `floorKey`-style queries, or
`LinkedHashMap` because eviction depends on its ordering (topic 08).

## Reading a JDK signature against the map

The hierarchy is also how you decode library signatures on sight:

```java
boolean contains(Object o);                 // Object, not E — pre-generics compat:
boolean remove(Object o);                   // asking is always safe, so it stays wide
static <T extends Comparable<? super T>> void sort(List<T> list);
                                            // needs index access → List, not Collection
static <T> boolean addAll(Collection<? super T> c, T... elements);
                                            // writes T → consumer → ? super T (topic 03's PECS)
```

`contains(Object)` compiles happily with an argument of the *wrong type* —
`orders.contains(orderId)` is `false` forever, no compile error. That
lenience is deliberate (a query can't corrupt the collection) but it is
also the hierarchy's sharpest edge — see the gotchas.

## One marker, one seam worth knowing

- **`RandomAccess`** — a marker interface (`ArrayList` has it,
  `LinkedList` doesn't) telling generic code that `get(i)` in a loop is
  cheap. `Collections.binarySearch` checks it to choose an indexed vs
  iterator strategy.
- **The `Abstract*` skeletons** (`AbstractList`, `AbstractSet`,
  `AbstractMap`) — implement an interface's boilerplate so a custom
  collection overrides two or three methods, not twenty. You'll meet them
  in stack traces long before you extend one; topic 15 uses the idea for
  `Iterable`.

## Gotchas

**Symptom:** `list.contains(x)` is always false, no compiler warning anywhere
**Cause:** `contains`/`remove` take `Object` — the argument is the wrong type (an ID instead of the entity, an `Integer` where elements are `Long`)
**Fix:** check the element type at the callsite; some static analyzers (Error Prone's `CollectionIncompatibleType`) flag it — the language won't

**Symptom:** `List<Integer>.remove(2)` deletes the element at *index* 2, not the value 2
**Cause:** `remove(int index)` and `remove(Object o)` overload on `List`, and an `int` argument picks the index overload without boxing
**Fix:** `list.remove(Integer.valueOf(2))` for by-value removal — the phase-1 autoboxing topic owns this trap's full story

**Symptom:** `for (var e : map)` doesn't compile
**Cause:** `Map` is not `Iterable` — only its views are
**Fix:** iterate `entrySet()` (both halves), `keySet()` or `values()`; or `map.forEach((k, v) -> ...)`

**Symptom:** clearing a `keySet()` view "mysteriously" emptied the whole map
**Cause:** views are live, both directions — mutations pass through
**Fix:** that's the feature; copy first (`new HashSet<>(map.keySet())`) when you need an independent set

**Symptom:** a utility that only loops over its input demands a `List`, so callers copy their `Set`s into lists to call it
**Cause:** parameter typed narrower than the method's needs
**Fix:** accept `Collection<T>` or `Iterable<T>` for iterate-only parameters — widest type you can honour

**Symptom:** `queue.add(x)` throws `IllegalStateException` where `offer(x)` would have returned false
**Cause:** `Queue` has paired methods — throwing (`add`/`remove`/`element`) vs status-returning (`offer`/`poll`/`peek`) — and capacity-bounded queues make the difference visible
**Fix:** pick the family that matches intent: bounded/backpressure code wants `offer`/`poll`; "this can't be empty/full or it's a bug" wants the throwing three

**Symptom:** `getFirst()` doesn't exist on a codebase's collection type
**Cause:** `SequencedCollection` arrived in JDK 21 — earlier targets don't have it, and `HashSet` (unordered) never will
**Fix:** on 21+, use it on `List`/`Deque`/`LinkedHashSet`/`SortedSet`; on unordered types the old spellings weren't possible either — that absence is the type telling you there is no "first"

## Interview questions

**★ Why is `Map` not a `Collection`?**
No coherent element type: keys, values and entries are three different
read shapes, and `add(E)`/`iterator()` would have to privilege one. The
framework keeps `Map` separate and exposes `keySet()`, `values()` and
`entrySet()` as live collection views instead.

**★ `List` vs `Set` vs `Queue`/`Deque` vs `Map` — the one-line contracts?**
`List`: order + index, duplicates. `Set`: uniqueness. `Queue`: FIFO,
head access. `Deque`: both ends — the stack *and* queue workhorse. `Map`:
unique keys to values. Everything else (sorted, navigable, sequenced) is a
refinement of these five.

**★ Why declare `List<Order>` instead of `ArrayList<Order>`?**
The interface states what callers may rely on; the implementation is a
construction-time choice. Interface-typed seams accept `List.of` fixtures,
`unmodifiableList` views and swapped implementations without edits — and
force you to decide deliberately when an implementation detail (sortedness,
access order) is actually part of the contract.

**★ Why does `contains` take `Object` instead of `E`?**
Pre-generics compatibility, kept because queries can't corrupt the
collection — asking about a wrong-typed object just returns false. The
cost is that a wrong-typed argument compiles silently; write-path methods
(`add(E)`) stay type-checked because writes *can* corrupt.

**★ What did `SequencedCollection` (JDK 21) actually fix?**
Ordered collections had no common supertype, so "first/last element" had a
different spelling per type and `reversed()` iteration mostly didn't
exist. JEP 431 retrofits `getFirst`/`getLast`/`add*`/`remove*`/`reversed`
across `List`, `Deque`, `LinkedHashSet`, `SortedSet`, with `SequencedMap`
mirroring it for ordered maps.

**★ What are the two method families on `Queue`, and when do you use which?**
`add`/`remove`/`element` throw on failure; `offer`/`poll`/`peek` return
false/null. Bounded queues and backpressure logic use the status family;
the throwing family is for when emptiness/fullness is a programming error
worth crashing on.

**What is `RandomAccess` and who reads it?**
A marker interface meaning indexed access is O(1). Generic algorithms
(`Collections.binarySearch`, shuffles) check it to pick an index-loop vs
iterator strategy — `ArrayList` implements it, `LinkedList` doesn't.

**A method needs to loop over user IDs it's given. What parameter type?**
`Iterable<String>` (or `Collection<String>` if it also needs `size`) — the
widest interface whose operations it uses. Callers then pass a `List`,
`Set`, or view without copying.

---

← Prev: [Bounds, wildcards and PECS](03-wildcards-pecs.md) · Next → [ArrayList](05-arraylist/README.md)
