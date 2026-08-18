---
title: "The decision table"
sidebar_label: "1 · The decision table"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 class-level Javadoc for `ArrayList`,
> `LinkedList`, `ArrayDeque`, `HashSet`, `LinkedHashSet`, `TreeSet`,
> `HashMap`, `LinkedHashMap`, `TreeMap`, `PriorityQueue` — each of which
> documents its own cost model — and the Collections Framework overview.

**Three questions, asked in order: (1) how do you *look up* — by index, by
key, by membership, by "next most urgent"? (2) what *order* must come back
out — none, insertion, sorted, access-recency? (3) how does it *mutate* —
append-only, random insert/remove, remove-while-iterating, never? The type
falls out. Big-O from the Javadoc settles ties.**

## Axis 1 — lookup pattern

| You look up by | Family | Type that answers it |
|---|---|---|
| position (`get(i)`) | `List` | `ArrayList` — O(1) documented |
| key → value | `Map` | `HashMap` — O(1) expected |
| "is X present?" | `Set` | `HashSet` — O(1) expected |
| next most urgent | `Queue` | `PriorityQueue` — O(log n) insert/poll |
| both ends (stack/queue) | `Deque` | `ArrayDeque` — amortized O(1) |
| nearest / range (`floorKey`, `subMap`) | `NavigableMap`/`Set` | `TreeMap` / `TreeSet` — O(log n) |

If nothing is ever looked up — the data is only iterated — an `ArrayList`
in whatever order you built it is already the answer.

## Axis 2 — ordering need

| Order out | List world | Set world | Map world |
|---|---|---|---|
| don't care | `ArrayList` | `HashSet` | `HashMap` |
| insertion order | `ArrayList` | `LinkedHashSet` | `LinkedHashMap` |
| sorted (natural / comparator) | sort on read, or `TreeSet` | `TreeSet` | `TreeMap` |
| access recency | — | — | `LinkedHashMap(cap, lf, true)` |

The hash types make **no ordering promise at all** — the Javadoc says
iteration order can even change over time as the table resizes. Any test or
UI that accidentally depends on `HashMap` order is broken already and merely
hasn't failed yet.

**Sorted-on-read vs sorted-storage:** if you sort once and read many times,
hold it sorted (`TreeSet`/`TreeMap`, or a sorted `ArrayList` +
`binarySearch`). If you sort once per request, `list.sort(...)` at the read
site is simpler and cache-friendlier than paying O(log n) per insert all day.

## Axis 3 — mutation pattern

- **Append-heavy, read-heavy** → `ArrayList`. Amortized O(1) append; the
  occasional grow-and-copy is documented and irrelevant in practice.
- **Insert/remove in the middle** → still usually `ArrayList` (O(n)
  arraycopy beats `LinkedList`'s O(n) *walk* — pointer chasing loses to
  `System.arraycopy` on real hardware; the big-O table's O(1) insert only
  starts *after* an O(n) traversal to the spot).
- **Remove while iterating** → `Iterator.remove` / `removeIf` on any type
  (**topic 11 · ConcurrentModificationException** *(not written yet)*), or a
  `LinkedList` **only** when you hold a `ListIterator` positioned there.
- **Both-ends mutation** → `ArrayDeque`, never `Stack`/`LinkedList`
  (**topic 16** *(not written yet)*).
- **Never mutates after build** → the immutable factories
  (**topic 12** *(not written yet)*): `List.of`, `Map.copyOf` — 
  smaller, safe to share, honest in the signature.

## The cost lines worth knowing cold

The class Javadoc documents each of these — this is the table interviewers
probe:

| Operation | `ArrayList` | `LinkedList` | `HashMap`/`HashSet` | `TreeMap`/`TreeSet` | `ArrayDeque` | `PriorityQueue` |
|---|---|---|---|---|---|---|
| `get(i)` / by key | O(1) | O(n) | O(1) expected | O(log n) | — | — |
| `contains` | O(n) | O(n) | O(1) expected | O(log n) | O(n) | O(n) |
| add at end / put | amortized O(1) | O(1) | O(1) expected | O(log n) | amortized O(1) | O(log n) |
| insert/remove middle | O(n) | O(1)*after O(n) walk* | — | — | — | — |
| min / max | O(n) | O(n) | O(n) | O(1)-ish (`first`/`last`) | — | `peek` O(1) |
| memory per element | array slot | node + 2 refs | entry + table slot | node + 3 refs + color | array slot | array slot |

"Expected" on the hash types assumes a `hashCode` that spreads
([Phase 2's contract](../../phase-2-classes-objects/06-equals-hashcode/README.md));
adversarial or degenerate keys push toward the treeified bucket's O(log n)
(**topic 07 · HashMap internals** *(not written yet)*).

## The defaults

When the axes don't force anything exotic: **`ArrayList`, `HashMap`,
`HashSet`, `ArrayDeque`** — one list, one map, one set, one deque. Reaching
past these four is a decision with a stated reason ("needs range queries" →
`TreeMap`; "needs insertion order in the response" → `LinkedHashMap`), never
a default.

## Gotchas

**Symptom:** code review argues `LinkedList` "because inserts are O(1)"
**Cause:** the big-O table omits the O(n) walk to the insertion point and the cache-hostility of node hopping; `ArrayList`'s O(n) arraycopy is a single contiguous memcpy
**Fix:** default to `ArrayList`; `LinkedList` wins only with a positioned `ListIterator` doing many local edits — a shape real code almost never has

**Symptom:** response order changes between environments; a test asserts JSON key order and fails on CI only
**Cause:** `HashMap` iteration order is unspecified and can differ per run and per resize
**Fix:** `LinkedHashMap` when order is part of the contract; otherwise fix the test to compare as maps, not strings

**Symptom:** `TreeSet.add` throws `ClassCastException` at runtime
**Cause:** sorted types need natural ordering or a comparator at construction — elements that aren't `Comparable` fail on the *second* insert (the first has nothing to compare with)
**Fix:** pass the comparator to the constructor; the compiler cannot catch this — sortedness is a runtime contract

**Symptom:** `PriorityQueue` iteration is "wrong"
**Cause:** its iterator traverses the heap array, **not** priority order — only `poll` drains in order (the Javadoc says so explicitly)
**Fix:** drain with `poll` in a loop, or copy and sort if you need ordered iteration without consuming

**Symptom:** a `TreeMap` "loses" entries that a `HashMap` kept
**Cause:** `TreeMap` uses `compareTo`/comparator for equality — a comparator inconsistent with `equals` merges keys that `equals` distinguishes
**Fix:** make the comparator's zero agree with `equals`, or accept the documented "inconsistent with equals" behaviour knowingly

**Symptom:** memory blows up holding millions of small values
**Cause:** every boxed element or node-based entry pays object-header + reference tax — `LinkedList`/`TreeMap` per-element overhead is several times the payload for small values
**Fix:** arrays or `ArrayList` of primitives-in-records; measure with the heap tools (**Phase 12** *(not written yet)*) before and after

## Interview questions

**★ Users by id, signup order for display, emails deduped case-insensitively — what do you reach for?**
`HashMap<UserId, User>` for O(1) lookup; the display either iterates a
`LinkedHashMap` (insertion order preserved in the same structure) or a
separate `ArrayList` kept in arrival order; the dedupe is a
`TreeSet<String>(String.CASE_INSENSITIVE_ORDER)` — with the caveat that its
equality now differs from `String.equals`, which chunk 2 argues in full.

**★ Why does `ArrayList` beat `LinkedList` even at its own game?**
`LinkedList`'s O(1) insert requires already standing at the node; getting
there is O(n) pointer-chasing with a cache miss per hop. `ArrayList`'s
"expensive" O(n) shift is one `System.arraycopy` over contiguous memory.
The Javadoc's own class comment steers the same way — and `ArrayDeque`
covers the queue shapes people used to buy `LinkedList` for.

**★ What breaks first if your key's `hashCode` returns a constant?**
Every entry lands in one bucket; expected O(1) degrades to a linked scan,
then to O(log n) once the bucket treeifies (for `Comparable` keys). Nothing
*fails* — it just gets slow, which is why it ships. The fix is the Phase 2
contract, not a different map.

**★ When is `TreeMap` the only correct answer?**
When the query is about *order itself*: floor/ceiling ("latest version ≤
x"), range views (`subMap(from, to)`), first/last. Hash types cannot answer
these at all; sorting an `ArrayList` per query re-pays O(n log n) each time.

**How do you choose between `LinkedHashMap` and sorting at the edge?**
By who owns the order. If insertion order *is* the meaning (an audit trail),
`LinkedHashMap` stores the truth. If order is presentation (sort by price
for this response), sort in the handler — storage stays canonical and two
screens can sort two ways.

**What's your default and why does having one matter?**
`ArrayList`/`HashMap`/`HashSet`/`ArrayDeque`. A stated default turns every
other choice into a visible signal — a `TreeMap` in a diff *means
something* — and reviewers read collection types as design intent.

---

← Index: [Choosing a collection](README.md) · Next → [Worked scenarios](02-worked-scenarios.md)
