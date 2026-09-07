---
title: "Java's collections for interviews — PriorityQueue, TreeMap and TreeSet, ArrayDeque, HashMap, ArrayList — the handful of APIs to know cold, with the complexities the JDK documents and the traps each one carries"
sidebar_label: "12 · Java's collections"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the JDK 25 API documentation —
> [`PriorityQueue`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/PriorityQueue.html),
> [`TreeMap`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/TreeMap.html),
> [`ArrayDeque`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ArrayDeque.html),
> [`HashMap`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/HashMap.html),
> [`ArrayList`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ArrayList.html),
> [`Arrays`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Arrays.html).
> Every complexity claim below is quoted from those pages. Code targets Java 25 and is written to
> be runnable; **nothing was run**. The [Java track's collections phase](../../../java/pages/phase-3-generics-collections/README.md)
> owns the full API; this page is the interview subset.

**Five classes cover almost every Java interview solution, and the JDK documents their costs —
so in Java you can say what a structure guarantees rather than what you assume.** `PriorityQueue`
is the heap: logarithmic offer and poll, and an iterator that is *not* in order. `TreeMap` and
`TreeSet` are the sorted structures JavaScript lacks: guaranteed logarithmic operations plus
floor, ceiling, first and last. `ArrayDeque` is the stack and the queue — faster than `Stack`
and than `LinkedList`, and it refuses nulls. `HashMap` is constant-time on average with a
documented caveat about hashing, and its iteration order is not a promise. `ArrayList` is
constant-time by index and amortised constant to append, and linear for everything else. Each
has one trap an interviewer knows, and the page lists them beside the API.

## The five, at a glance

| Class | Use it for | Documented cost | The trap |
|---|---|---|---|
| **`PriorityQueue<E>`** | top-k, merge-k, scheduling, Dijkstra | O(log n) offer/poll/add; linear `remove(Object)` and `contains`; constant `peek`/`size` | iterating it is not sorted order; no decrease-key |
| **`TreeMap<K,V>` / `TreeSet<E>`** | floor/ceiling, range queries, ordered iteration, "smallest key ≥ x" | guaranteed log n for `containsKey`/`get`/`put`/`remove` | comparator must be consistent with `equals` or keys are lost |
| **`ArrayDeque<E>`** | stack, queue, sliding-window deque, BFS frontier | amortised constant for most ops; linear for `remove(Object)`, `contains`, bulk ops | nulls prohibited — a `null` sentinel throws |
| **`HashMap<K,V>` / `HashSet<E>`** | counting, complements, seen-sets, memo tables | constant-time `get`/`put` assuming good hashing | no order guarantee; iteration cost is capacity plus size; boxed keys |
| **`ArrayList<E>`** | dynamic array, result lists | constant `get`/`set`/`size`; amortised constant `add`; linear otherwise | `remove(int)` and insert-at-index are linear; fail-fast iterators |

## `PriorityQueue`

The heap, with a comparator or natural ordering, and the head is the least element:

> *"The head of this queue is the least element with respect to the specified ordering. If
> multiple elements are tied for least value, the head is one of those elements -- ties are
> broken arbitrarily."*

> *"Implementation note: this implementation provides O(log(n)) time for the enqueuing and
> dequeuing methods (`offer`, `poll`, `remove()` and `add`); linear time for the `remove(Object)`
> and `contains(Object)` methods; and constant time for the retrieval methods (`peek`, `element`,
> and `size`)."*

Two consequences for interviews. A max-heap is a min-heap with a reversed comparator —
`new PriorityQueue<>(Comparator.reverseOrder())` — and there is no decrease-key, so Dijkstra
pushes a new entry and skips stale ones on poll. And iteration is unordered:

> *"The Iterator provided in method `iterator()` and the Spliterator provided in method
> `spliterator()` are not guaranteed to traverse the elements of the priority queue in any
> particular order."*

```java
import java.util.PriorityQueue;

// k-th largest: a min-heap of size k; the head is the answer
public final class KthLargest {
    public static int kthLargest(int[] nums, int k) {
        PriorityQueue<Integer> heap = new PriorityQueue<>();      // min-heap by natural order
        for (int n : nums) {
            heap.offer(n);                                        // O(log k)
            if (heap.size() > k) heap.poll();                     // keep only the k largest
        }
        return heap.peek();                                        // O(1)
    }
}
```

## `TreeMap` and `TreeSet`

A red-black tree; the sorted map JavaScript does not have:

> *"A Red-Black tree based `NavigableMap` implementation."* · *"This implementation provides
> guaranteed log(n) time cost for the `containsKey`, `get`, `put` and `remove` operations."*

The interview value is the navigation methods — `floorKey`, `ceilingKey`, `lowerKey`,
`higherKey`, `firstKey`, `lastKey`, `headMap`, `tailMap`, `subMap` — each logarithmic. They
answer "the largest key not exceeding x" in one call, which is a binary search over a mutable
set that a sorted array cannot offer cheaply. The trap is the comparator contract:

> *"Note that the ordering maintained by a tree map, like any sorted map, and whether or not an
> explicit comparator is provided, must be consistent with `equals` if this sorted map is to
> correctly implement the `Map` interface."*

A comparator on one field that ties for two distinct keys makes the map treat them as one key;
break ties on something unique.

```java
import java.util.TreeMap;

// "my calendar": book [start, end) if it does not overlap an existing booking
public final class Calendar {
    private final TreeMap<Integer, Integer> booked = new TreeMap<>(); // start -> end

    public boolean book(int start, int end) {
        Integer prevStart = booked.floorKey(start);      // the booking that starts at or before start
        if (prevStart != null && booked.get(prevStart) > start) return false;
        Integer nextStart = booked.ceilingKey(start);    // the booking that starts at or after start
        if (nextStart != null && nextStart < end) return false;
        booked.put(start, end);                          // O(log n)
        return true;
    }
}
```

## `ArrayDeque`

The stack and the queue, and the JDK says which to use instead of the legacy classes:

> *"This class is likely to be faster than Stack when used as a stack, and faster than
> LinkedList when used as a queue."*

> *"Most ArrayDeque operations run in amortized constant time. Exceptions include remove,
> removeFirstOccurrence, removeLastOccurrence, contains, iterator.remove(), and the bulk
> operations, all of which run in linear time."*

Use `push`/`pop`/`peek` for a stack and `offer`/`poll`/`peek` for a queue; `offerFirst`,
`pollLast` and friends for a monotonic deque. The trap:

> *"Null elements are prohibited."*

A BFS that pushes `null` as a level marker throws; use the level size instead.

```java
import java.util.ArrayDeque;
import java.util.Deque;

// valid parentheses: the stack pattern, on ArrayDeque
public final class Brackets {
    public static boolean isValid(String s) {
        Deque<Character> stack = new ArrayDeque<>();
        for (char c : s.toCharArray()) {
            switch (c) {
                case '(' -> stack.push(')');
                case '[' -> stack.push(']');
                case '{' -> stack.push('}');
                default -> { if (stack.isEmpty() || stack.pop() != c) return false; }
            }
        }
        return stack.isEmpty();
    }
}
```

## `HashMap` and `HashSet`

Constant time with the caveat the documentation attaches:

> *"This implementation provides constant-time performance for the basic operations (`get` and
> `put`), assuming the hash function disperses the elements properly among the buckets."*

Say the assumption in the complexity statement — "O(1) average per operation, assuming good
hashing" — because the interviewer knows the worst case exists. Two more facts to have ready:
`null` keys and values are permitted, and order is not:

> *"This class makes no guarantees as to the order of the map; in particular, it does not
> guarantee that the order will remain constant over time."*

If insertion order matters — an LRU cache, "first unique" — `LinkedHashMap` keeps it, and its
access-order constructor plus `removeEldestEntry` is the standard LRU answer in Java. The
counting idiom is `merge`:

```java
Map<Integer, Integer> count = new HashMap<>();
for (int n : nums) count.merge(n, 1, Integer::sum);     // increment, creating on first sight
```

The boxing trap from [04b](04b-java-traps-and-sorting.md) applies: keys and values are objects,
`==` on them is a reference comparison, and a hot loop over a `Map<Integer, Integer>` allocates
where an `int[]` would not.

## `ArrayList`

The dynamic array:

> *"The `size`, `isEmpty`, `get`, `set`, `getFirst`, `getLast`, `removeLast`, `iterator`,
> `listIterator`, and `reversed` operations run in constant time."* · *"The `add`, and `addLast`
> operations runs in amortized constant time, that is, adding n elements requires O(n) time."* ·
> *"All of the other operations run in linear time (roughly speaking)."*

So `remove(0)` and `add(0, x)` are linear — use `ArrayDeque` for a queue — and removing while
iterating with a for-each throws:

> *"The iterators returned by this class's `iterator` and `listIterator` methods are fail-fast: if
> the list is structurally modified at any time after the iterator is created, in any way except
> through the iterator's own `remove` or `add` methods, the iterator will throw a
> `ConcurrentModificationException`."*

Remove through the iterator, or `removeIf`, or iterate by index from the end.

## Sorting

From [04b](04b-java-traps-and-sorting.md): `Arrays.sort(int[])` is Dual-Pivot Quicksort,
O(n log n) on all data; `Arrays.sort(Object[])` and `List.sort` are required to be stable;
comparators use `Integer.compare`, never subtraction; `Comparator.comparingInt(...)
.thenComparing(...)` composes keys. Sorting an `int[]` descending needs boxing or a manual
reverse — say which you chose.

## Gotchas

**★ Symptom: iterating a `PriorityQueue` and getting unsorted output.** Cause: the iterator is
documented as unordered; only `poll` yields sorted order. Fix: poll in a loop, or copy and sort.

**★ Symptom: a `TreeMap` keyed by a comparator on one field "loses" entries.** Cause: the
ordering is not consistent with `equals`, so two distinct keys compare equal and share a slot.
Fix: break ties on a unique field in the comparator.

**Symptom: `NullPointerException` from an `ArrayDeque` used as a BFS queue.** Cause: a `null`
level marker; nulls are prohibited. Fix: iterate the level by its size at the start of each
round.

**Symptom: a queue built on `ArrayList` with `remove(0)`, and a quadratic BFS.** Cause: removal
from the front is linear. Fix: `ArrayDeque` with `poll`.

**Symptom: `ConcurrentModificationException` while removing from a list in a for-each.** Cause:
fail-fast iterators. Fix: `removeIf`, the iterator's own `remove`, or index from the end.

**Symptom: Dijkstra with "decrease-key" that does not exist.** Cause: `PriorityQueue` has no
such operation, and `remove(Object)` is linear. Fix: push a new entry with the better distance
and skip stale entries on poll by checking against the current best.

**Symptom: an LRU built on `HashMap` plus a hand-rolled list, in a round where time ran out.**
Cause: not knowing `LinkedHashMap`'s access order. Fix: `new LinkedHashMap<>(cap, 0.75f, true)`
with `removeEldestEntry` overridden — the documented idiom, ten lines.

**Symptom: "O(1) for the map" and the interviewer's "always?"** Cause: the hashing assumption
unstated. Fix: "constant on average, assuming the hash function disperses keys — the JDK's own
caveat."

## Interview questions

**★ Which Java collections do you reach for in interviews, and what does each cost?**
`PriorityQueue` for heaps — logarithmic offer and poll, unordered iteration, no decrease-key;
`TreeMap` and `TreeSet` for sorted structures — guaranteed logarithmic operations plus floor,
ceiling, first and last; `ArrayDeque` for stacks and queues — amortised constant, faster than
`Stack` and `LinkedList` per the JDK, nulls prohibited; `HashMap` and `HashSet` — constant on
average assuming good hashing, no order guarantee; `ArrayList` — constant by index, amortised
constant append, linear for insertion and removal elsewhere. Each figure is from the class
documentation, which is the advantage of Java in a round: the costs are quotable.

**★ Why `ArrayDeque` rather than `Stack` or `LinkedList`?**
Because the JDK says so: `ArrayDeque` is documented as likely faster than `Stack` when used as a
stack and faster than `LinkedList` when used as a queue, with amortised constant time for the
operations a stack or queue needs. `Stack` is a legacy synchronised class; `LinkedList` allocates
a node per element. The one constraint is that `ArrayDeque` prohibits nulls, so a BFS uses level
sizes rather than a null marker.

**How do you do Dijkstra with `PriorityQueue` given there is no decrease-key?**
Push a new entry whenever a shorter distance to a node is found, and when polling, skip any entry
whose distance is worse than the best already recorded for that node. The queue may hold stale
entries, which costs O(E log E) rather than O(E log V), and the skip is the line that keeps it
correct. `remove(Object)` is linear, so removing the stale entry is never the right move.

**What does `TreeMap` give you that a sorted array does not?**
Logarithmic insertion and removal alongside logarithmic navigation — `floorKey`, `ceilingKey`,
`higherKey`, `lowerKey`, `headMap`, `tailMap`. A sorted array answers floor and ceiling by binary
search but inserts in linear time, so any problem that interleaves updates with "the nearest key
to x" queries — calendar booking, a sliding-window with ordered values, order books — is a
`TreeMap` problem in Java and an awkward one in JavaScript.

**What is the standard LRU cache in Java, and why does it work?**
`LinkedHashMap` constructed with access order true, with `removeEldestEntry` overridden to return
true when the size exceeds the capacity. Access order moves an entry to the end on every `get`
and `put`, so the eldest is the least recently used, and the map removes it on insertion. It is
ten lines, and it is the answer an interviewer expects unless they ask for the doubly linked
list explicitly.

---

← Prev: [11 · Communication mechanics](11-communication-mechanics.md) · Index: [Phase 0 — The DSA interview and the practice system](README.md) · Next → [13 · This track and the JS track](13-how-this-track-relates-to-javascript.md)
