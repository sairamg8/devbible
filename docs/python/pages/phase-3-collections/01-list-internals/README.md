---
title: "01 · list internals — a resizable array of pointers, and every cost, sort behaviour and concurrency rule that follows from it"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation —
> [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html#list)
> and [Thread Safety Guarantees](https://docs.python.org/3.14/library/threadsafety.html)
> (both new in 3.14), the [Design FAQ](https://docs.python.org/3.14/faq/design.html#how-are-lists-implemented-in-cpython),
> [Built-in types — sequences](https://docs.python.org/3.14/library/stdtypes.html#sequence-types-list-tuple-range),
> the [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html), [`copy`](https://docs.python.org/3.14/library/copy.html),
> [`array`](https://docs.python.org/3.14/library/array.html) and [`sys.getsizeof`](https://docs.python.org/3.14/library/sys.html#sys.getsizeof) —
> and CPython 3.14 sources: [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c),
> [`Objects/listsort.txt`](https://github.com/python/cpython/blob/3.14/Objects/listsort.txt),
> [`Include/cpython/listobject.h`](https://github.com/python/cpython/blob/3.14/Include/cpython/listobject.h).
> Target: **CPython 3.14.7**. Documentation-validated — **no sandbox run, no timings, no
> byte counts on any page in this topic**.

**A Python `list` is one contiguous C array of object pointers plus a length and a
capacity. Everything in this topic is a consequence of that sentence. Indexing is O(1)
because it is arithmetic; `insert(0, x)` and `pop(0)` are O(n) because everything
after the index must move; `append` is O(1) only *amortised*, because CPython buys
spare slots about 1/8 at a time and occasionally pays for a full copy. The sort is
timsort — adaptive, stable, natural — so sorted input costs one pass, stability is a
documented guarantee you can build multi-key sorts on, and an inconsistent `<` returns
a wrong order without raising. Iterating is an index that keeps counting, so mutating
the list you are walking skips or repeats elements silently. And since 3.14 the docs
say, operation by operation, what is atomic without the GIL. Master tier because every
one of these shows up as a production bug — a queue drained with `pop(0)`,
`x = x.sort()`, a filter loop that leaves every other bad row behind, a shared list read
empty mid-sort.**

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The dynamic array](01-the-dynamic-array.md)** | the FAQ's *"variable-length arrays, not Lisp-style linked lists"*, the `PyListObject` struct (`ob_item`, `ob_size`, `allocated`), 🔴 why a list of ints is not compact |
| 2 | **[The complexity table](01b-the-complexity-table.md)** | 🔴 the first-party 3.14 table replacing the wiki, footnotes [1]–[5] verbatim, the CPython-and-exact-type scope, slicing copies pointers |
| 3 | **[Over-allocation and amortised append](02-overallocation-and-amortised-append.md)** | `list_resize`'s `newsize + (newsize >> 3) + 6` rule rounded to a multiple of 4, 🔴 not 2×, why a mild factor still gives amortised O(1), `MemoryError` timing |
| 4 | **[Shrinking and preallocation](02b-shrinking-and-preallocation.md)** | the half-capacity shrink rule, `list_preallocate_exact`, `__length_hint__`, `[None] * n`, 🔴 `clear()` vs `xs = []` |
| 5 | **[The O(n) shift](03-the-o-n-shift.md)** | `ins1`'s backward loop, `pop`'s `memmove`, slice assignment's two costs, 🔴 `pop()` vs `pop(0)` |
| 6 | **[The queue problem, and deque](03b-quadratic-patterns-and-deque.md)** | five accidentally-quadratic front-of-list patterns, 🔴 when a list must become a `deque` |
| 7 | **[Linear scans inside loops](03c-linear-scans-in-loops.md)** | `in` / `index` / `remove` inside a loop, set and dict indexes, order-preserving dedupe |
| 8 | **[Partial sorts and counting](03d-partial-sorts-and-counting.md)** | re-sorting per insert, repeated `max`, `count()` per value — `bisect`, `heapq`, `Counter` |
| 9 | **[Adding and combining](04-adding-and-combining.md)** | `append` / `extend` / `+` / `+=`, 🔴 `+=` mutates what every holder sees, `xs += "abc"` |
| 10 | **[Repetition and lazy combination](04b-repetition-and-lazy-combination.md)** | 🔴 `[[0] * 8] * 8`, `sum(lists, [])`, unpacking, `itertools.chain` |
| 11 | **[Removing from a list](05-removing-and-searching.md)** | `pop` / `remove` / `del` / `clear`, the real error strings, 🔴 `remove` runs your `__eq__` |
| 12 | **[Searching, identity and reversing](05b-searching-identity-and-reversing.md)** | identity-first comparison, 🔴 NaN found in a list, `False` removing `0`, three ways to reverse |
| 13 | **[`sorted` versus `.sort()`](06-sorted-versus-sort.md)** | 🔴 `x = x.sort()`, the `None`-return convention, `sorted` *is* `list()` + `.sort()` |
| 14 | **[During the sort](06b-during-the-sort.md)** | 🔴 the list appears empty, `list modified during sort`, a failed comparison leaves a permutation |
| 15 | **[Timsort — runs and minrun](07-timsort.md)** | natural runs, descending runs reversed in place, binary insertion below 64, choosing `minrun` |
| 16 | **[Merging and merge memory](07b-merging-and-galloping.md)** | adjacent-only merges, powersort and the invariant a proof broke, 🔴 up to N/2 extra pointers, the full memory bill of `sort(key=…)` |
| 17 | **[Galloping](07c-galloping.md)** | `MIN_GALLOP` 7, exponential search, why not always gallop, adaptive `min_gallop`, 🔴 do not destroy existing order before sorting |
| 18 | **[`reverse=True` and the pre-sort check](07d-reverse-and-the-pre-sort-check.md)** | 🔴 reverse ≠ `[::-1]` on ties, the exact-type homogeneity scan, `bool` among `int` keys |
| 19 | **[Stability and multi-key sorts](08-stability-and-multi-key-sorts.md)** | the language-level guarantee, tuple keys, negation, 🔴 least-significant-first passes, the HOWTO's `multisort` |
| 20 | **[Ties, DSU and determinism](08b-ties-and-determinism.md)** | 🔴 stable is not deterministic, dict-order ties, `max`/`groupby` tie rules, DSU with an index |
| 21 | **[Key functions](09-key-functions-and-cmp-to-key.md)** | 🔴 exactly n key calls, all up front, a failed key leaves the list untouched, `operator` helpers, keys that look things up |
| 22 | **[Sorting text](09b-sorting-text.md)** | code-point order, `casefold`, NFC vs NFD, `locale.strxfrm`, 🔴 natural sort and `"3.10" < "3.9"` |
| 23 | **[Comparisons and `cmp_to_key`](09c-comparisons-and-cmp-to-key.md)** | only `<`, reflection, `total_ordering`, what `cmp_to_key` builds, 🔴 when a comparator is genuinely needed |
| 24 | **[Unorderable values](09d-unorderable-values.md)** | 🔴 NaN and sets fail silently, `None` / dicts / mixed types fail loudly, keys that place them explicitly |
| 25 | **[Copies and aliasing](10-copies-and-aliasing.md)** | five shallow copies, 🔴 `.copy()` loses subclasses where `copy.copy` does not, grids, tuples as free copies |
| 26 | **[Mutating while iterating](11-mutating-while-iterating.md)** | 🔴 the iterator is an index, hand-traced skips and infinite loops, lists do not detect what dicts do |
| 27 | **[Safe ways to mutate while walking](11b-safe-ways-to-mutate.md)** | rebuild + slice-assign, copy, backward index, manual index, worklist `deque` — 🔴 and what each costs |
| 28 | **[Thread safety under free threading](11c-thread-safety-under-free-threading.md)** | the 3.14 list guarantee table, safe vs atomic, 🔴 `sort` appears empty, the GIL-era FAQ |
| 29 | **[Sharing a list between threads](11d-sharing-a-list-between-threads.md)** | 🔴 pop instead of check, snapshot with `copy()`, locks around compound steps, `queue.Queue` |
| 30 | **[Memory: list, tuple and array](12-memory-list-tuple-array.md)** | three layouts from the source, type-code minimum sizes, 🔴 an `array` creates an object on every read |
| 31 | **[Measuring memory honestly](12b-measuring-memory.md)** | 🔴 `getsizeof` counts capacity and no elements, the small-int cache, `tracemalloc` started early |

## Phase gate

You are done with this topic when you can look at list-heavy code and name its cost
and its failure mode without running it. Concretely, without looking anything up:

- Why `pop(0)` in a loop is quadratic and `pop()` is not, and what replaces it.
- What `x = x.sort()` does, and why the `None` is deliberate.
- Why `sorted(rows, key=score)[::-1]` and `sorted(rows, key=score, reverse=True)`
  differ, and on which rows.
- How to sort by descending date then ascending name when neither key can be negated.
- Why a `for` loop that calls `remove` leaves every other bad element behind, and the
  one-line fix that is also linear.
- Which list operations the 3.14 thread-safety page calls atomic, and why
  `if lst: lst.pop()` is still a race.
- What `sys.getsizeof(big_list)` does and does not include.

## Where this connects

- **[Phase 3 — Collections in depth](../README.md)** — this topic opens the phase; the
  complexity page it cites has tables for the other built-ins too.
- [02 · `tuple`](../02-tuple/README.md) — the immutable sequence: no spare capacity,
  O(1) copy, hashable if its items are.
- [03 · `dict`](../03-dict/README.md) and **04 · `set` and `frozenset`** *(not written
  yet)* — the structures that replace `in` on a list, and whose iterators do detect
  mutation.
- [05 · Slicing deeply](../05-slicing/README.md) — slice assignment and slices as copies,
  beyond the costs covered here.
- [06 · `collections`](../06-collections-module/README.md) — `deque`, the queue a list only pretends
  to be.
- **07 · `heapq` and `bisect`** *(not written yet)* — top-K and sorted insertion
  without a full sort.
- **08 · `copy` vs `deepcopy`** *(not written yet)* — the whole-graph copy chunk 25
  points at.
- **10 · Sorting compound data** *(not written yet)* — `key=`, `itemgetter` and
  multi-key sorts applied to records.
- **12 · `array` and `memoryview`** *(not written yet)* — compact numeric storage and
  zero-copy buffers.
- **[Phase 1 — Assignment and aliasing](../../phase-1-language-core/07-assignment-and-aliasing/README.md)**
  — the name/object model that chunks 9, 10 and 25 rely on.

---

← Prev: [Phase 3 — Collections in depth](../README.md) · Next → [01 · The dynamic array](01-the-dynamic-array.md)
