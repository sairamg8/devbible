---
title: "The default list"
sidebar_label: "1 · The default list"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation for
> `java.util.ArrayList` (class doc and per-method costs) and the OpenJDK
> `ArrayList.java` source for the growth arithmetic the Javadoc leaves
> unspecified.

**An `ArrayList` is an `Object[]` with a `size` field and a growth policy.
Every behaviour that matters in production — what's fast, what's secretly
O(n), when memory spikes, why iteration is cheap — falls out of that one
sentence. The Javadoc commits to the costs: `get`, `set`, `size` in constant
time; `add` at the end in *amortized* constant time; everything that inserts
or removes in the middle pays a shift.**

## The mental model

```java
List<Order> orders = new ArrayList<>();   // capacity is an internal detail
orders.add(o1);                           // element 0
orders.get(0);                            // array index — constant time
```

Internally: a backing array (`elementData`), a `size` (how many slots are
real elements), and spare **capacity** (slots allocated but unused). The
distinction matters:

- **`size()`** — elements you added. The only number your code should care
  about.
- **Capacity** — the backing array's length. Invisible through the `List`
  interface, managed automatically, and only worth touching (constructor
  argument, `ensureCapacity`, `trimToSize`) in measured hot paths.

`new ArrayList<>()` starts logically at a capacity of ten, but OpenJDK
allocates lazily — the array is created on the first `add`, so a thousand
empty lists cost almost nothing. `new ArrayList<>(10_000)` pre-allocates in
one step — the right move when the final size is known.

## Growth: unspecified on purpose, 1.5× in practice

The Javadoc promises exactly one thing about growth: *"adding an element has
constant amortized time cost"* — the details are explicitly not specified.
In OpenJDK the new capacity is `oldCapacity + (oldCapacity >> 1)` — one and
a half times — and growth copies the whole backing array
(`Arrays.copyOf`).

Two production consequences:

- **Amortized is not uniform.** Most `add` calls are a store and an
  increment; occasionally one call pays for an allocation plus a full copy.
  Averaged over the sequence it is constant; an individual call is not.
- **Appending n elements to a default-sized list re-copies the data
  O(log n) times.** Harmless at small n, measurable when building
  million-element lists in a loop — which is why the sized constructor and
  `ensureCapacity` exist, and why `stream().toList()` or
  `new ArrayList<>(knownCollection)` (which sizes exactly) beat
  add-in-a-loop when the size is knowable.

Capacity never shrinks on its own. `clear()` nulls the elements but keeps
the array; a list that once held a million elements holds a million-slot
array until `trimToSize()` or the list itself is garbage collected.

## What each operation really costs

| Operation | Cost | Why |
|---|---|---|
| `get(i)`, `set(i, e)` | O(1) | array index |
| `add(e)` at the end | O(1) amortized | store + rare grow-and-copy |
| `add(i, e)` in the middle | O(n) | shifts everything after `i` right |
| `remove(i)` / `remove(Object)` | O(n) | shift left; `remove(Object)` also scans to find it |
| `contains`, `indexOf` | O(n) | linear scan calling `equals` |
| iteration | O(n), fast constant | contiguous memory — see chunk 2 |

The one that surprises people: **`remove(0)` in a loop is O(n²)** — each
call shifts the whole remainder. Draining from the front wants an
`ArrayDeque`; filtering wants `removeIf` (one compacting pass) or a stream
`filter` into a new list.

```java
orders.removeIf(o -> o.status() == Status.CANCELLED);  // one O(n) pass
```

Watch the two `remove` overloads on `List<Integer>`:
`list.remove(2)` removes *index* 2 (`remove(int)` wins overload resolution —
**[Phase 1, topic 10](../../phase-1-language-core/10-methods.md)**);
`list.remove(Integer.valueOf(2))` removes the *value* 2.

## Semantics worth stating once

- **Nulls and duplicates are both allowed** — unlike `List.of` (rejects
  null) and unlike `Set`s (reject duplicates).
- **It stores references, not copies.** Mutating an element mutates it for
  every holder of the list —
  **[Phase 2's immutability topic](../../phase-2-classes-objects/12-immutable-design.md)**
  is what makes list-sharing safe.
- **Not thread-safe, and not "slightly" so.** Concurrent structural
  modification can lose updates or throw; even one writer with one reader
  is a data race. Phase 6 covers `CopyOnWriteArrayList` and the real
  alternatives; `Collections.synchronizedList` is rarely what you want.
- **Iterators are fail-fast on a best-effort basis** — structural
  modification outside the iterator throws `ConcurrentModificationException`
  as a *bug detector*, not a guarantee (topic 11 of this phase).

## Gotchas

**Symptom:** heap dump shows a huge `Object[]` behind a list whose `size()` is small
**Cause:** capacity never shrinks — the list grew once (a burst import, a bad query) and kept the array; `clear()` keeps it too
**Fix:** `trimToSize()` after the burst, or replace the list wholesale (`List.copyOf`) so the oversized array is collectable

**Symptom:** batch job slows quadratically as input grows; profiler shows `System.arraycopy`
**Cause:** `add(0, e)` or `remove(0)` in a loop — every call shifts the whole tail
**Fix:** `ArrayDeque` for queue/stack access patterns; `removeIf` for filtering; build in natural order and reverse once if needed

**Symptom:** `list.remove(2)` deleted the wrong thing from a `List<Integer>`
**Cause:** overload resolution picked `remove(int index)` over `remove(Object)` — no boxing happens when an exact primitive match exists
**Fix:** `remove(Integer.valueOf(2))` for by-value removal — and add a test, because this reads correctly and isn't

**Symptom:** million-element load measurably slower than expected; allocation profiler shows repeated array copies
**Cause:** default capacity plus 1.5× growth re-copies the data roughly `log₁.₅(n)` times
**Fix:** `new ArrayList<>(expectedSize)` when the size is known; `new ArrayList<>(sourceCollection)` sizes exactly in one copy

**Symptom:** `IndexOutOfBoundsException: Index 10 out of bounds for length 10` right after constructing `new ArrayList<>(10)`
**Cause:** the constructor argument is *capacity*, not size — the list is still empty; `set(9, x)` needs nine prior adds
**Fix:** `add` to grow the size, or `new ArrayList<>(Collections.nCopies(10, null))` when a pre-sized, index-writable list is genuinely wanted

**Symptom:** two threads appending; final size is less than the number of adds, no exception thrown
**Cause:** `ArrayList` is not synchronized — concurrent `add` calls can both read the same `size`, write the same slot, and silently lose one element
**Fix:** confine the list to one thread, collect per-thread and merge, or use the Phase 6 concurrent collections — do not sprinkle `synchronized` and hope

## Interview questions

**★ What does "amortized constant time" mean for `add`, precisely?**
Most adds are O(1); occasionally one add triggers a grow — allocate a bigger
array (1.5× in OpenJDK), copy everything. Averaged over any long sequence of
adds the cost per element is constant, because the copies are geometric.
Any *individual* add may be O(n) — relevant for latency-sensitive paths.

**★ Why is `remove(0)` in a loop O(n²), and what replaces it?**
Each removal shifts the entire remaining tail left by one — n removals do
n²/2 element moves. `ArrayDeque.pollFirst` for draining from the front,
`removeIf` for filtering in one pass, or iterate and collect the survivors.

**★ `new ArrayList<>(1000)` — what exactly did you buy?**
A 1000-slot backing array and nothing else: `size()` is 0, `get(0)` throws.
It removes the grow-and-copy cycles while appending the first thousand
elements — a capacity hint, not a pre-filled list.

**★ Why does the Javadoc refuse to specify the growth factor?**
It is an implementation detail the spec keeps free so implementations can
change it without breaking anyone. Code that "knows" it is 1.5× is coupling
to OpenJDK internals; the only portable contract is amortized-constant
append.

**★ When does capacity shrink?**
Never automatically. `remove`/`clear` only null slots; `trimToSize()` is
the explicit shrink. A long-lived list that had one large burst is a memory
leak shaped like a valid object.

**Does `clear()` help the garbage collector?**
It nulls every element slot, so the *elements* become collectable while the
list object and its (unshrunk) backing array live on. If the list itself is
about to go out of scope, `clear()` adds nothing.

**Why is reading an `ArrayList` from two threads without synchronization
still wrong if nobody writes "at the same time"?**
Visibility, not just atomicity: without a happens-before edge, a reader may
see a stale `size` and a fresh array (or vice versa) from an earlier write.
Safe publication — or an immutable snapshot like `List.copyOf` — is the fix;
Phase 6 owns the details.

---

← Index: [ArrayList](README.md) · Next → [vs LinkedList — the honest comparison](02-arraylist-vs-linkedlist.md)
