---
title: "07 · heapq and bisect — a heap answers 'what is smallest right now' for O(log n) per change, a binary search answers 'where does this go' for O(log n) per question, and neither one owns the list it works on"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`heapq`](https://docs.python.org/3.14/library/heapq.html), [`bisect`](https://docs.python.org/3.14/library/bisect.html), [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html), [`queue`](https://docs.python.org/3.14/library/queue.html), [time complexity](https://docs.python.org/3.14/library/time-complexity.html) — and CPython source at the [**v3.14.7**](https://github.com/python/cpython/tree/v3.14.7) tag (`Lib/heapq.py`, `Modules/_heapqmodule.c`, `Lib/bisect.py`, `Modules/_bisectmodule.c`), labelled as implementation detail wherever the documentation is silent. Target: **Python 3.14.7**. Documentation-validated — **no sandbox run, no timings, no program output on any page in this topic**.

**Two small modules that operate on a plain `list` you own. `heapq` keeps a list in *heap order* — the smallest element at index 0 and nothing else promised — so a priority queue, a scheduler, a streaming top-K or a k-way merge costs O(log n) per change instead of a sort per change. `bisect` does binary search on a list that is *already sorted*, returning an insertion point rather than a match, which makes it the tool for range queries, breakpoint tables and "which bucket does this value fall in". Neither module checks its precondition: a heap whose items were mutated, or a list that was never sorted, produces confident wrong answers rather than errors. And both sit on top of a `list`, so the moment the workload is "insert and delete in the middle, constantly", the O(n) list shift underneath is the real cost — and the answer is a different structure, or the database.**

## Chunks

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[01 · The heap invariant](01-the-heap-invariant.md)** | a heap is a plain `list` with one promise — `heap[0]` is the smallest; 🔴 `heap[1]` is not the runner-up, iteration and slicing are unordered, and `append`, `sort(reverse=True)` or mutating an entry's priority break it silently; the functions accept only a real `list` |
| 2 | **[01b · Building and sifting](01b-building-and-sifting.md)** | `heapify` is O(n) bottom-up, n pushes are O(n log n); CPython's sift-to-leaf pop; only `<` is ever called and there is no `key=`; 🔴 each comparison is a call into your objects, so precompute the priority; `heapify` returns `None`; the cost table; heapsort is not stable |
| 3 | **[02 · push, pop, replace, pushpop](02-push-pop-replace-pushpop.md)** | `heappush`/`heappop` and the empty-heap decision; `heapreplace` pops first and always returns the old root, `heappushpop` pushes first and hands back an item that is not larger without touching the heap; 🔴 a streaming top-K needs `heappushpop`, not `heapreplace`; recurring jobs are `heapreplace` |
| 4 | **[02b · When a comparison fails](02b-when-a-comparison-fails.md)** | 🔴 no rollback: per the v3.14.7 source a push that raises has already appended its item and a pop that raises has already dropped the root; `(priority, dict)` ties are how it happens; comparisons that resize the heap raise `RuntimeError`; a `NaN` priority corrupts the heap without raising |
| 5 | **[03 · `nlargest` and `nsmallest`](03-nlargest-and-nsmallest.md)** | one pass, a heap of K decorated entries, the root as the weakest survivor; `n == 1` is `min`/`max` and `n >= len` is `sorted`; CPython's own comparison counts; 🔴 wins for small K and streams, loses to `sorted` when K is most of N; repeated queries want a real heap |
| 6 | **[03b · Ties, keys and top-N queries](03b-ties-keys-and-top-n-queries.md)** | first-seen wins ties, so ties are only as deterministic as input order; `key` runs once per element and the elements are never compared; 🔴 a dict ranks its keys; score-desc/name-asc via `nsmallest` and negation; per-group top-N; `ORDER BY … LIMIT` when the rows live in a database |
| 7 | **[04 · Max-heaps in 3.14](04-max-heaps.md)** | `heapify_max`, `heappush_max`, `heappop_max`, `heapreplace_max`, `heappushpop_max` are new in 3.14 (3.13 had three private ones, kept as aliases); the negation trick and its four failures; 🔴 a max-heap is an unmarked list — `heappop` on it corrupts it — and a `(priority, count, item)` tie-break turns LIFO unless the count is negated; running median; K-smallest with a max-heap |
| 8 | **[05 · Priority queues — ties and the counter](05-priority-queues.md)** | the documentation's four challenges; `(priority, count, item)` gives FIFO ties and never compares the item — `sched` does it, asyncio's timer heap does not and documents *undefined* order; 🔴 the `order=True` dataclass wrapper stops the `TypeError` but is not FIFO; priorities that do not order (`Enum`, `None`, strings); direction; starvation fixed by pushing a start-by deadline |
| 9 | **[05b · Removing and re-prioritising entries](05b-removal-and-update.md)** | a heap has no index, so removal is O(n) — `sched.cancel` does `remove` + `heapify`; the documentation's lazy-deletion recipe (dict of task → list entry, mark the payload slot, skip on pop) and why each piece is shaped that way; 🔴 never overwrite a compared field; an identity-only sentinel; bulk cancel as one rebuild |
| 10 | **[05c · Stale entries and compaction](05c-stale-entries-and-compaction.md)** | 🔴 dead entries make `len()`, peeks and memory lie — cancelled timeouts grow a heap without bound; compaction at half dead, as asyncio's event loop does; a self-compacting queue class; Dijkstra without decrease-key is the same stale-entry skip |
| 11 | **[05d · Heaps shared by threads and tasks](05d-heaps-across-threads.md)** | 🔴 the `heapq` docs promise nothing about threads; CPython 3.14's per-call critical section is an implementation detail and never makes check-then-pop atomic; `queue.PriorityQueue` is `heappush`/`heappop` behind a lock; a `Condition`-guarded delay queue for retries; `asyncio.PriorityQueue` is not thread-safe; processes need a `SKIP LOCKED` table or a broker |
| 12 | **[06 · `heapq.merge` — k-way merge as a stream](06-merge.md)** | one pending item per input in a heap of k, O(N log k), lazy enough for endless inputs; stable because the input index breaks ties; 🔴 never checks that an input is sorted, and `reverse=True` needs largest-first inputs; log files, shard scatter-gather, dedupe with `groupby`; open files, bad lines and when `sorted` is the better call |
| 13 | **[07 · `bisect_left` and `bisect_right`](07-bisect-left-and-right.md)** | an insertion point, not a match — the documented partition for each side, the equal run as `[left, right)`; the loop and why only `<` is called (and which operand is on the left); any `__len__` + `__getitem__` sequence; `lo`/`hi` are not slice bounds; the documentation's five lookups; 🔴 unsorted, descending or `NaN` input returns a confident wrong index |
| 14 | **[07b · The `key=` parameter and its asymmetry](07b-the-key-parameter.md)** | 🔴 search functions apply `key` to elements only — pass a key value; `insort` applies it to `x` — pass the record; the key runs on every probe, so precompute a parallel key list (and keep it in step); `functools.cache` needs hashable elements; binary search on the answer with `range` and a monotonic boolean key; case-folded and descending searches |
| 15 | **[08 · `insort` and the cost of keeping a list sorted](08-insort-and-sorted-list-cost.md)** | O(log n) to find the slot, O(n) to open it — 🔴 n insorts are quadratic, so batches are `extend` + `sort` (or `heapq.merge`); left vs right among equal keys; insort calls the object's `insert`; removing by bisect; the documented thread-safety warning; the leaderboard test for when a sorted list is the wrong structure |
| 16 | **[09 · Range queries on sorted data](09-range-queries.md)** | two bisects make a range — the table of which side for each bound; 🔴 half-open time windows so boundary values are counted once; per-hour counts from one set of edges; nearest value compares both neighbours; tuple-prefix ranges; naive vs aware datetimes; the B-tree index when the rows live in a database |
| 17 | **[09b · Breakpoint tables and lookup rings](09b-breakpoint-tables-and-rings.md)** | the documentation's grade table; 🔴 `bisect` for "*n* and up", `bisect_left` for "above *n*", and one more outcome than breakpoints; validated tier tables in `Decimal`; progressive brackets with cumulative totals; `le` histogram buckets; IP range tables; a consistent-hashing ring on a `hashlib` digest, never the salted `hash()` |
| 18 | **[10 · When the answer is not `heapq` or `bisect`](10-when-the-answer-is-not-heapq-or-bisect.md)** | the decision table; 🔴 a leaderboard (rank + range + constant updates) defeats both — a sorted container such as the third-party `sortedcontainers.SortedList`, pinned, or shared storage; FIFO is `deque`, exact lookup is `dict`/`set`; per-process structures in multi-worker deployments; the database operation for each in-process one |

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
