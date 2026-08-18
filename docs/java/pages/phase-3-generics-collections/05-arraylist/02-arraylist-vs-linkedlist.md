---
title: "vs LinkedList — the honest comparison"
sidebar_label: "2 · vs LinkedList"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation for
> `java.util.LinkedList`, `java.util.ArrayList` and `java.util.ArrayDeque` —
> including the `ArrayList` class doc's own sentence comparing its constant
> factor to `LinkedList`'s, and the `ArrayDeque` doc's claim that it is
> "likely to be faster than LinkedList when used as a queue".

**The big-O table says `LinkedList` inserts in O(1) and `ArrayList` in O(n),
and the big-O table is not wrong — it is answering a different question than
the one production performance asks. On real hardware, `ArrayList` wins
almost every workload, `ArrayDeque` wins the queue-shaped remainder, and the
honest cases for `LinkedList` are so narrow that its own author has said he
uses `ArrayDeque`. This chunk is the argument, made carefully, because "just
use ArrayList" without the why fails the interview follow-up.**

## What each structure actually is

- **`ArrayList`** — one contiguous `Object[]`. An element access is: index
  arithmetic, one memory read.
- **`LinkedList`** — a doubly-linked chain of node objects, each holding
  `item`, `next`, `prev`. An element access is: pointer-hop from the nearer
  end, one node at a time. The Javadoc says exactly this: operations that
  index into the list "will traverse the list from the beginning or the end,
  whichever is closer".

So `get(i)` is O(1) vs O(n) — the table's first column already goes to
`ArrayList`. The interesting argument is about *insertion*, where the table
appears to favour `LinkedList`.

## Why O(1) insertion loses anyway

**The O(1) is conditional: it assumes you are already holding the node.**
`list.add(i, e)` on a `LinkedList` must first *walk to position i* — O(n) —
before its O(1) splice. Only insertion during iteration (via
`ListIterator.add`) or at the ends genuinely skips the walk. Meanwhile
`ArrayList.add(i, e)` is an `arraycopy` shift — O(n) too, but a bulk move of
a contiguous block, which hardware does extraordinarily well.

**The constant factors are not close, and the Javadoc says so.** The
`ArrayList` doc: *"The constant factor is low compared to that for the
`LinkedList` implementation."* The reasons are physical:

- **Cache locality.** `ArrayList` iteration touches consecutive memory —
  each cache line fetched carries the next several references, and the
  hardware prefetcher sees the pattern. `LinkedList` nodes are separate
  heap objects allocated at different times: every hop is a potential cache
  miss into an unpredictable address.
- **Memory per element.** A `LinkedList` node is an object header plus
  three references (`item`, `next`, `prev`) — several times `ArrayList`'s
  one array slot per element (plus spare capacity). More memory means more
  cache pressure means slower everything nearby.
- **Allocation and GC.** Every `LinkedList.add` allocates a node object;
  a million-element list is a million nodes for the collector to trace.
  `ArrayList` allocates O(log n) arrays total.

The result, qualitatively (no fabricated benchmark numbers — run your own
with JMH, Phase 12): middle-insertion workloads that "should" favour
`LinkedList` are usually won by `ArrayList` because the walk-to-position
cost dominates, and iteration-heavy workloads are not close.

## Where `LinkedList` genuinely wins — and what wins harder

1. **Removal/insertion *during* iteration via `ListIterator`** — O(1) splice
   with no walk, no shift. Real, but rare — and `removeIf` or
   collect-survivors covers most such workloads with `ArrayList` anyway.
2. **Queue/deque usage — both ends, O(1) guaranteed.** Real, but this is a
   *deque* workload, and **`ArrayDeque` is the right tool**: contiguous
   circular buffer, same O(1) ends, cache-friendly. Its Javadoc claims it is
   "likely to be faster than `LinkedList` when used as a queue". `LinkedList`
   keeps two niches even here: it permits `null` elements (`ArrayDeque`
   rejects them) and implements `List` and `Deque` simultaneously.
3. **No resize spikes** — no grow-and-copy pause on any single add. Rarely
   decisive; pre-sizing the `ArrayList` addresses the same concern.

The working rule the phase gate expects: **`ArrayList` for lists,
`ArrayDeque` for stacks and queues, `LinkedList` when you can articulate the
`ListIterator`-splice or null-in-a-deque reason — which is almost never.**

## Gotchas

**Symptom:** "optimized" a hot loop by switching to `LinkedList` for its O(1) inserts; it got slower
**Cause:** the inserts were positional (`add(i, e)`) — the O(n) walk to `i` replaced the O(n) shift, and lost the constant-factor war with `arraycopy`
**Fix:** measure with JMH before structural swaps; if inserts happen mid-iteration, use `ListIterator.add` — that is the only insert that is genuinely O(1)

**Symptom:** `list.get(i)` inside a `for (int i = 0; ...)` loop is fine in tests, quadratic in production
**Cause:** the list is a `LinkedList` behind the `List` interface — each `get(i)` walks from an end, and the loop is O(n²)
**Fix:** iterate with for-each/iterator (O(n) on both implementations); never index-loop over a `List` you don't know to be random-access — that is what the `RandomAccess` marker interface exists to signal

**Symptom:** `NullPointerException` from `ArrayDeque.addFirst` after migrating from `LinkedList`
**Cause:** `ArrayDeque` rejects null elements; `LinkedList` accepts them — and code was using null as an in-band "empty" marker
**Fix:** model the sentinel explicitly (`Optional`, a marker object, or don't store it); nulls in collections are a Phase 1 topic-13 smell either way

**Symptom:** memory usage several times the payload for a large `LinkedList`
**Cause:** per-element node objects — header + three references each — versus one array slot
**Fix:** `ArrayList` (or an array); for millions of primitives, a primitive array or a specialized library, since `List<Integer>` boxing (Phase 1 topic 02) stacks on top

**Symptom:** `Stack` used for stack semantics on new code review
**Cause:** legacy habit — `java.util.Stack` extends `Vector`, synchronized and slow, and its own Javadoc points to `Deque`
**Fix:** `ArrayDeque` with `push`/`pop`/`peek` — this phase's topic 16 covers the legacy types

## Interview questions

**★ `LinkedList` has O(1) insert — why does `ArrayList` still win insert-heavy benchmarks?**
Because the O(1) only covers the splice, not the O(n) walk to the position;
because `ArrayList`'s O(n) shift is a bulk `arraycopy` of contiguous memory
with excellent constants; and because linked nodes lose on cache locality,
per-element memory, and allocation pressure. The only insert `LinkedList`
does in true O(1) is at the ends or through a `ListIterator` already
standing at the spot.

**★ When would you actually reach for `LinkedList`?**
Heavy splicing through `ListIterator` during iteration; or a deque that must
hold nulls or be a `List` at the same time. Otherwise `ArrayDeque` for
queue/stack shapes and `ArrayList` for everything else.

**★ What is the `RandomAccess` interface for?**
A marker (no methods) declaring that indexed access is effectively constant
time — `ArrayList` implements it, `LinkedList` doesn't. Generic algorithms
check it to choose index-loops versus iterators; it is also the honest
answer to "how would library code avoid the accidental-O(n²) index loop?"

**★ Why is iteration over an `ArrayList` so much faster than the same loop over a `LinkedList`, when both are O(n)?**
Hardware. Consecutive array slots share cache lines and trigger prefetching;
list nodes are scattered heap objects, so each `next` risks a cache miss.
Same complexity class, very different constants — the recurring lesson that
big-O ranks growth, not speed.

**Why does `ArrayDeque` beat `LinkedList` as a queue when both offer O(1) at both ends?**
`ArrayDeque` is a circular buffer over one array: no per-element allocation,
contiguous memory, and its resize is amortized like `ArrayList`'s. Its
Javadoc makes the faster-than-`LinkedList` claim explicitly.

**A teammate says "big-O says LinkedList, case closed." What's the one-sentence rebuttal?**
Big-O compares growth rates, not running times — and on real memory
hierarchies the constant factors it discards are routinely the whole
decision.

---

← Prev: [The default list](01-the-default-list.md) · Index: [ArrayList](README.md) · Next → [Construction, copies and views](03-construction-copies-views.md)
