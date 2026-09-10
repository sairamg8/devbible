---
title: "07 · heapq and bisect — a heap answers 'what is smallest right now' for O(log n) per change, a binary search answers 'where does this go' for O(log n) per question, and neither one owns the list it works on"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`heapq`](https://docs.python.org/3.14/library/heapq.html), [`bisect`](https://docs.python.org/3.14/library/bisect.html), [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html), [`queue`](https://docs.python.org/3.14/library/queue.html), [time complexity](https://docs.python.org/3.14/library/time-complexity.html) — and CPython source at the [**v3.14.7**](https://github.com/python/cpython/tree/v3.14.7) tag (`Lib/heapq.py`, `Modules/_heapqmodule.c`, `Lib/bisect.py`, `Modules/_bisectmodule.c`), labelled as implementation detail wherever the documentation is silent. Target: **Python 3.14.7**. Documentation-validated — **no sandbox run, no timings, no program output on any page in this topic**.

**Two small modules that operate on a plain `list` you own. `heapq` keeps a list in *heap order* — the smallest element at index 0 and nothing else promised — so a priority queue, a scheduler, a streaming top-K or a k-way merge costs O(log n) per change instead of a sort per change. `bisect` does binary search on a list that is *already sorted*, returning an insertion point rather than a match, which makes it the tool for range queries, breakpoint tables and "which bucket does this value fall in". Neither module checks its precondition: a heap whose items were mutated, or a list that was never sorted, produces confident wrong answers rather than errors. And both sit on top of a `list`, so the moment the workload is "insert and delete in the middle, constantly", the O(n) list shift underneath is the real cost — and the answer is a different structure, or the database.**

:::caution In progress
This topic is being written. The chunks below are complete and verified; the rest of the plan,
listed under *Still to come*, is not written yet and will be linked here as each chunk lands.
:::

## Chunks

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[01 · The heap invariant](01-the-heap-invariant.md)** | a heap is a plain `list` with one promise — `heap[0]` is the smallest; 🔴 `heap[1]` is not the runner-up, iteration and slicing are unordered, and `append`, `sort(reverse=True)` or mutating an entry's priority break it silently; the functions accept only a real `list` |
| 2 | **[01b · Building and sifting](01b-building-and-sifting.md)** | `heapify` is O(n) bottom-up, n pushes are O(n log n); CPython's sift-to-leaf pop; only `<` is ever called and there is no `key=`; 🔴 each comparison is a call into your objects, so precompute the priority; `heapify` returns `None`; the cost table; heapsort is not stable |
| 3 | **[02 · push, pop, replace, pushpop](02-push-pop-replace-pushpop.md)** | `heappush`/`heappop` and the empty-heap decision; `heapreplace` pops first and always returns the old root, `heappushpop` pushes first and hands back an item that is not larger without touching the heap; 🔴 a streaming top-K needs `heappushpop`, not `heapreplace`; recurring jobs are `heapreplace` |
| 4 | **[02b · When a comparison fails](02b-when-a-comparison-fails.md)** | 🔴 no rollback: per the v3.14.7 source a push that raises has already appended its item and a pop that raises has already dropped the root; `(priority, dict)` ties are how it happens; comparisons that resize the heap raise `RuntimeError`; a `NaN` priority corrupts the heap without raising |
| 5 | **[03 · `nlargest` and `nsmallest`](03-nlargest-and-nsmallest.md)** | one pass, a heap of K decorated entries, the root as the weakest survivor; `n == 1` is `min`/`max` and `n >= len` is `sorted`; CPython's own comparison counts; 🔴 wins for small K and streams, loses to `sorted` when K is most of N; repeated queries want a real heap |
| 6 | **[03b · Ties, keys and top-N queries](03b-ties-keys-and-top-n-queries.md)** | first-seen wins ties, so ties are only as deterministic as input order; `key` runs once per element and the elements are never compared; 🔴 a dict ranks its keys; score-desc/name-asc via `nsmallest` and negation; per-group top-N; `ORDER BY … LIMIT` when the rows live in a database |

## Still to come

- **04 · Max-heaps in 3.14** *(not written yet)*
- **05 · Priority queues — ties and the counter** *(not written yet)*
- **05b · Removing and re-prioritising entries** *(not written yet)*
- **05c · Heaps shared by threads and tasks** *(not written yet)*
- **06 · `heapq.merge` — k-way merge as a stream** *(not written yet)*
- **07 · `bisect_left` and `bisect_right`** *(not written yet)*
- **07b · The `key=` parameter and its asymmetry** *(not written yet)*
- **08 · `insort` and the cost of keeping a list sorted** *(not written yet)*
- **09 · Range queries, breakpoint tables and lookup rings** *(not written yet)*
- **10 · When the answer is not `heapq` or `bisect`** *(not written yet)*

## Phase gate

You are done with this topic when you can return the ten slowest requests out of a log of
millions without sorting it and say why `nlargest` beats `sorted()[:10]` there but not for the
top 900,000; build a job queue whose equal-priority jobs come out first-in-first-out, whose jobs
can be cancelled and re-prioritised, and whose memory does not grow with every cancellation;
merge twelve sorted log files into one stream without loading any of them; and answer "how many
orders fall between these two timestamps" and "which pricing tier is this amount in" with
`bisect` — then explain why a sorted `list` maintained with `insort` is the wrong structure once
the inserts outnumber the reads.

## Where this connects

- **[Phase 3 — Collections in depth](../README.md)** is the phase this topic belongs to.
- [01 · `list` internals](../01-list-internals/README.md) — the O(n) insert that `insort` cannot avoid, the partial-sort recognition in [3d](../01-list-internals/03d-partial-sorts-and-counting.md), and the merge and galloping machinery that `heapq.merge` and `bisect` mirror.
- [02 · `tuple`](../02-tuple/README.md) — tuple comparison, which is what orders every `(priority, count, item)` entry.
- [06 · `collections`](../06-collections-module/README.md) — `Counter.most_common(n)` is `nlargest` underneath ([3b](../06-collections-module/03b-counter-top-n.md)); `deque` is the FIFO a heap is not.
- [Phase 1 — `min`, `max`, `heapq`, `bisect`, `groupby`](../../phase-1-language-core/06-comparisons/08c-min-max-heapq-bisect-groupby.md) — the `key=` contract these tools share.
- **10 · Sorting compound data** *(not written yet)* owns `key=`, `itemgetter` and multi-key sorts; **11 · Choosing a structure** *(not written yet)* owns the decision table.

---

← [Phase index](../README.md) · Start → [01 · The heap invariant](01-the-heap-invariant.md)
