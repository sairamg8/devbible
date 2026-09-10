---
title: "Inside a merge, once one run wins seven comparisons in a row timsort stops comparing pairs and gallops — exponential search that turns lumpy, duplicate-heavy data into block copies and backs off on its own when the data is random"
sidebar_label: "07c · Galloping"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against CPython's
> [`Objects/listsort.txt`](https://github.com/python/cpython/blob/3.14/Objects/listsort.txt)
> (*Merge Algorithms*, *Galloping*, *Galloping with a Broken Leg*, *Galloping
> Complication*, *LEFT OR RIGHT*) and
> [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`MIN_GALLOP`, `struct s_MergeState`), plus
> [`bisect`](https://docs.python.org/3.14/library/bisect.html).
> Documentation-validated; **no sandbox run, no timings, no comparison counts of my
> own** — every count below is quoted from `listsort.txt`. Target: **CPython 3.14**
> (3.14.7).

**A textbook merge compares the heads of two runs and moves the smaller, one element
per comparison, forever. Timsort starts that way, but counts how many times in a row
the same run wins. At seven, it concludes the data is clustered and *gallops*: it
probes the other run at positions 0, 1, 3, 7, 15… until it overshoots, binary-searches
the last gap, and moves the whole winning block in one copy. That is how data with
long stretches from one side — duplicates, glued-together sorted batches, one run
mostly above the other — sorts in far fewer comparisons than n log n. The threshold is
not fixed: it rises when galloping fails to pay and falls when it pays, which is why
random data barely notices it exists.**

## One pair at a time, then gallop

> *"a lovely thing about merging is that many kinds of clustering \"reveal
> themselves\" by how many times in a row the winning merge element comes from the
> same run."*

A merge starts in *one pair at a time* mode, counting consecutive wins per side:

> *"If that count reaches MIN_GALLOP, we switch to \"galloping mode\". Here we *search*
> B for where A[0] belongs, and move over all the B's before that point in one chunk
> to the merge area, then move A[0] to the merge area."*

`MIN_GALLOP` is `7` in 3.14. The search itself is exponential, then binary:

> *"In galloping mode, we first look for A[0] in B. We do this via \"galloping\",
> comparing A[0] in turn to B[0], B[1], B[3], B[7], ..., B[2**j - 1], ..., until
> finding the k such that B[2**(k-1) - 1] < A[0] <= B[2**k - 1]."*

> *"Note that no matter where A[0] belongs in B, the combination of galloping + binary
> search finds it in no more than about 2*lg(B) comparisons."*

It leaves galloping mode when *"both searches find slices to copy less than MIN_GALLOP
elements long"*.

### Why exponential search, not a plain binary search

A binary search over all of B would take the same number of comparisons wherever
`A[0]` belongs. Galloping is cheap when the answer is *near the front*, which is the
common case inside a merge:

> *"If we did a straight binary search, we could find it in no more than
> ceiling(lg(B+1)) comparisons -- but straight binary search takes that many
> comparisons no matter where A[0] belongs. Straight binary search thus loses to
> galloping unless the run is quite long, and we simply can't guess whether it is in
> advance."*

`merge_hi`, which merges right to left, gallops from the *end* of a run instead; the
gallop functions take a "hint" index so that either direction starts at the right
place (*"Galloping Complication"*).

### Why not gallop all the time

> *"So why don't we always gallop? Because it can lose, on two counts"* — a function
> call per probe, and *"Galloping can-- alas --require more comparisons than linear
> one-at-time search, depending on the data."*

The document's table of probe counts ends in the conclusion that galloping *"doesn't
win at all until i=6. Before then, it loses twice (at i=2 and i=4), and ties at the
other values."* On random data long winning streaks are rare — *"a consecutive winning
sub-run in B of length k occurs with probability 1/2**(k+1)"* — so the threshold
adapts:

> *"whenever the gallop loop doesn't pay, min_gallop is increased by one, making it
> harder to transition back to galloping mode (and again both within a merge and
> across merges). For random data, this all but eliminates the gallop penalty"*

The `MergeState` field that carries it is commented *"merge_lo and merge_hi tend to
nudge it higher for random data, and lower for highly structured data."* And the
honest footnote: *"in all it's a minor improvement over using a fixed MIN_GALLOP
value."*

### Two searches, because of stability

> *"gallop_left() and gallop_right() are akin to the Python bisect module's
> bisect_left() and bisect_right(): they're the same unless the slice they're
> searching contains a (at least one) value equal to the value being searched for."*

`gallop_left` searches B for an element of A and lands *before* any equal B elements;
`gallop_right` searches A for an element of B and lands *after* any equal A elements.
Either way, the element from the earlier run wins ties — *"The distinction is needed
to preserve stability."* It is the same distinction you choose between when you call
`bisect.bisect_left` or `bisect.bisect_right` yourself, and the same mistake is
available to you there (see the Gotchas).

## What this means for real data

- **Lumpy data, many duplicates, sorted batches glued together** — long winning
  streaks, so galloping pays: *"if data is lopsided or lumpy or contains many
  duplicates, long stretches of winning sub-runs are very likely, and cutting the
  number of comparisons needed to find one from O(B) to O(log B) is a huge win."*
- **Random data** — runs boosted to `minrun`, balanced merges, pair-at-a-time mode,
  `min_gallop` drifting up. The O(n log n) you were promised, no more.
- **Two sorted lists** — `a + b` is two runs, so `(a + b).sort()` is one merge, done
  in C, with galloping if the ranges interleave in blocks.

The practical rule: **do not destroy order you already have before you sort.**
Arrival order is frequently close to sorted order — timestamps, sequence numbers,
auto-increment ids — and every step that scrambles it (a `set`, a shuffle, a
hash-partitioned fan-in) hands timsort random data it would not otherwise have had.

## Gotchas

### Expecting galloping to rescue an expensive `__lt__` on random data
**Symptom.** Sorting objects with a costly comparison is as slow as the O(n log n)
estimate, even though "timsort is adaptive".
**Cause.** Galloping only pays on long winning streaks; on random data `min_gallop`
climbs until galloping all but stops. The comparison count is whatever the data
dictates.
**Fix.** Make each comparison cheap by computing the expensive part once, as a key:

```python
rows.sort(key=lambda r: r.expensive_score())   # n calls, then cheap comparisons
```

### Deduplicating through a `set` right before sorting
**Symptom.** A dedupe-then-sort step over mostly-ordered data (log lines, event ids
arriving in time order) costs a full random-data sort.
**Cause.** A `set` iterates in hash order, not insertion order, so the arrival order
— which was nearly the sorted order — is gone before `sorted` sees it. The HOWTO warns
about set order in exactly these terms: *"the elements contained in set types do not
have a deterministic order."*
**Fix.** Deduplicate with an order-preserving structure, so the runs survive:

```python
unique_ids = sorted(dict.fromkeys(event_ids))   # keeps first-seen order, then sorts
```

### Looking for a knob to tune `MIN_GALLOP` or `minrun`
**Symptom.** Time spent searching for a `sys` setting or a `sort()` argument.
**Cause.** They are C `#define`s and a private struct field. There is no Python-level
interface to any of it.
**Fix.** Change the data, not the algorithm — keep inputs in the order they already
have, and sort once:

```python
rows = []
for batch in batches:              # each batch arrives in timestamp order
    rows.extend(batch)             # no shuffling, no set, no re-sort per batch
rows.sort(key=lambda r: r.ts)
```

### Benchmarking the sort on shuffled data and quoting it for production
**Symptom.** A benchmark predicts a sort cost that production never shows, or shows
only on the one endpoint whose data really is random.
**Cause.** Timsort's cost depends on the data's existing order at least as much as on
n. `random.sample` or `random.shuffle` in a benchmark removes exactly the structure
that runs and galloping exploit.
**Fix.** Benchmark on a contiguous slice of real data, in its real order:

```python
sample = production_rows[:200_000]       # order preserved
# NOT: random.sample(production_rows, 200_000)
```

### `bisect.insort_left` where arrival order among equals matters
**Symptom.** A hand-maintained sorted list of jobs processes equal-priority jobs
newest-first, when the intent was first-come-first-served.
**Cause.** The same left/right distinction timsort uses for stability. `insort_left`
runs `bisect_left` and so inserts *before* existing equal entries; `insort` and
`insort_right` are documented together as *"Similar to insort_left(), but inserting x
in a after any existing entries of x."*
**Fix.** Use the right-hand variant for FIFO among equals:

```python
import bisect
bisect.insort(queue, job, key=lambda j: j.priority)   # insort == insort_right
```

The bisect docs add the caveat that keeps this in its lane: *"Keep in mind that the
O(log n) search is dominated by the slow O(n) insertion step."* — a real queue is a
`heapq` with a tiebreaking counter, or a `deque` per priority.

## Interview questions

**★ What is galloping, and when does timsort switch to it?**
Exponential search inside a merge: instead of comparing one pair at a time, probe
positions 0, 1, 3, 7, 15… in the other run until you overshoot, then binary-search
the last gap, and move the whole block in one copy. Timsort enters it after one run
wins `MIN_GALLOP` (7) consecutive comparisons, and leaves when both sides' blocks drop
below that. The threshold then adapts per sort: raised when galloping fails to pay,
lowered when it pays.

**Why not gallop all the time?**
Because it loses on short streaks. `listsort.txt` tabulates it: galloping needs more
comparisons than linear search at i=2 and i=4, ties elsewhere below 6, and only wins
from i=6 on — and each probe is a function call. On random data a long streak is
unlikely, so always galloping would cost comparisons, which are expensive in Python.

**★ Which data shapes does timsort handle best, and which worst?**
Best: data that is already sorted or reverse-sorted (one run), a few sorted runs
concatenated, and data with many duplicates or large blocks from one side — runs and
galloping both pay. Worst, in the sense of "gets no help": uniformly random data, where
runs are boosted to `minrun` by insertion sort, merges are balanced, and `min_gallop`
drifts up until galloping barely happens. That is still O(n log n); it is simply the
case the adaptivity cannot improve.

**Why does galloping use an exponential search rather than a binary search over the
whole run?**
Because binary search costs about lg(B) comparisons wherever the target is, while
galloping costs about 2·lg(i) for a target at position i — far fewer when the target
is near the front, which inside a merge it usually is. `listsort.txt` says a straight
binary search *"loses to galloping unless the run is quite long, and we simply can't
guess whether it is in advance."*

**Why are there two gallop functions, `gallop_left` and `gallop_right`?**
Stability. When the value being placed equals values in the run being searched, one
function lands before the equal block and the other after it. Timsort uses
`gallop_left` to place A's elements into B and `gallop_right` to place B's into A, so
in both directions the element from the earlier run ends up first. It is exactly the
`bisect_left` / `bisect_right` distinction.

**How does `min_gallop` adapt, and why bother?**
It starts at `MIN_GALLOP` (7). Each time the gallop loop fails to pay, it goes up by
one, making galloping harder to re-enter both within the current merge and in later
ones; the longer galloping keeps paying, the lower it goes — *"as low as 1"* for the
highly structured cases the source names. The effect is that random data stops paying the galloping penalty
and structured data starts galloping sooner. The source itself calls the gain *"a
minor improvement over using a fixed MIN_GALLOP value"*.

---

← [Merging and merge memory](07b-merging-and-galloping.md) · [Topic index](README.md) · Next → [`reverse=True` and the pre-sort check](07d-reverse-and-the-pre-sort-check.md)
