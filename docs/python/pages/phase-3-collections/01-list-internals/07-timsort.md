---
title: "Timsort is an adaptive, stable, natural mergesort: it finds the ordered runs your data already contains, so O(n log n) is the ceiling and already-sorted input costs a single pass"
sidebar_label: "07 · Timsort"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against CPython's
> [`Objects/listsort.txt`](https://github.com/python/cpython/blob/3.14/Objects/listsort.txt)
> and [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`count_run`, `binarysort`, `merge_compute_minrun`, `list_sort_impl`,
> `MAX_MINRUN`), plus
> [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html#list)
> footnote [4] and [`list.sort`](https://docs.python.org/3.14/library/stdtypes.html#list.sort).
> Documentation-validated; **no sandbox run, no timings, no comparison counts of my
> own**. Target: **CPython 3.14** (3.14.7).

**Python's sort is not quicksort and not a textbook mergesort. It is Tim Peters'
timsort, described in CPython's own `listsort.txt` as *"an adaptive, stable, natural
mergesort"* — three words that each buy you something. *Natural* means it looks for
ordered runs that already exist in your data instead of imposing a structure.
*Adaptive* means it does less work when it finds them, which is why the docs say
already-sorted input costs O(n) comparisons rather than O(n log n). *Stable* means
equal elements keep their relative order, which is a guarantee you can build multi-key
sorts on. This chunk is how runs are found and sized;
[07b](07b-merging-and-galloping.md) is how they are merged and what that costs in
memory, [07c](07c-galloping.md) is galloping inside a merge,
[07d](07d-reverse-and-the-pre-sort-check.md) is what `reverse=True` and the key types
change, and [08](08-stability-and-multi-key-sorts.md) is the third word.**

## The algorithm's own description

> *"This describes an adaptive, stable, natural mergesort, modestly called timsort
> (hey, I earned it `<wink>`). It has supernatural performance on many kinds of
> partially ordered arrays (less than lg(N!) comparisons needed, and as few as N-1),
> yet as fast as Python's previous highly tuned samplesort hybrid on random arrays."*

> *"In a nutshell, the main routine marches over the array once, left to right,
> alternately identifying the next run, then merging it into the previous runs
> \"intelligently\". Everything else is complication for speed, and some hard-won
> measure of memory efficiency."*

The documentation's complexity footnote gives the user-facing summary:

> *"This is the worst case scenario. Sorting is adaptive and input that is already
> sorted or reverse-sorted takes only O(n) comparisons. See Objects/listsort.txt for
> more information."*

**"As few as N-1 comparisons"** is the sorted case: one pass confirming that each
element is not less than the one before it.

## Step 1 — find a run

> *"`count_run()` returns the # of elements in the next run, and, if it's a descending
> run, reverses it in-place. A run is either \"ascending\", which means
> non-decreasing: `a0 <= a1 <= a2 <= ...` or \"descending\", which means
> non-increasing: `a0 >= a1 >= a2 >= ...`"*

> *"Note that a run is always at least 2 long, unless we start at the array's last
> element. If all elements in the array are equal, it can be viewed as both ascending
> and descending. Upon return, the run `count_run()` identifies is always ascending."*

Two things matter here for real data.

**Descending runs are free.** A reverse-sorted list is one descending run, reversed
in place — hence *"already sorted or reverse-sorted takes only O(n) comparisons"*.

**Reversing a descending run must not break stability**, and that constrains the
definition. `listsort.txt` explains the trade:

> *"Reversal is done via the obvious fast \"swap elements starting at each end, and
> converge at the middle\" method. That can violate stability if the slice contains
> any equal elements. For that reason, for a long time the code used strict
> inequality (\">\" rather than \">=\") in its definition of descending."*

> *"Removing that restriction required some complication: when processing a descending
> run, all-equal sub-runs of elements are reversed in-place, on the fly. Their
> original relative order is restored \"by magic\" via the final \"reverse the entire
> run\" step."*

And a refinement that pays off on real, lumpy data:

> *"There's one more trick added since the original: after reversing a descending run,
> it's possible that it can be extended by an adjacent ascending run. For example,
> given `[3, 2, 1, 3, 4, 5, 0]`, the 3-element descending prefix is reversed in-place,
> and then extended by `[3, 4, 5]`."*

## Step 2 — boost a short run to `minrun`

Random data has short runs. Merging thousands of two-element runs would cost more in
per-merge overhead than it saves, so timsort extends any short run with a binary
insertion sort:

> *"If an array is random, it's very unlikely we'll see long runs. If a natural run
> contains less than minrun elements (see next section), the main loop artificially
> boosts it to minrun elements, via a stable binary insertion sort applied to the
> right number of array elements following the short natural run. In a random array,
> *all* runs are likely to be minrun long as a result."*

Which has two stated benefits:

> *"1. Random data strongly tends then toward perfectly balanced (both runs have the
> same length) merges, which is the most efficient way to proceed when data is
> random."*

> *"2. Because runs are never very short, the rest of the code doesn't make heroic
> efforts to shave a few cycles off per-merge overheads."*

`binarysort` is the routine that does the boosting, and its own comment explains why a
quadratic-movement algorithm is the right choice at this size:

> *"binarysort is the best method for sorting small arrays: it does few compares, but
> can do data movement quadratic in the number of elements."*

> *"Note that the number of bytes moved doesn't seem to matter. MAX_MINRUN of 64 is so
> small that the key and value pointers all fit in a corner of L1 cache, and moving
> things around in that is very fast."*

## Step 3 — choose `minrun`

```c
#define MAX_MINRUN 64
```

> *"If N < MAX_MINRUN, minrun is N. IOW, binary insertion sort is used for the whole
> array then; it's hard to beat that given the overheads of trying something
> fancier"*

So **a list shorter than 64 elements is sorted entirely by binary insertion sort** —
no merging at all. For everything larger:

> *"Instead we pick a minrun in range(MAX_MINRUN / 2, MAX_MINRUN + 1) such that
> N/minrun is exactly a power of 2, or if that isn't possible, is close to, but
> strictly less than, a power of 2."*

The reason is balance. `listsort.txt` works through N = 2112: with minrun 32 you get
66 runs, and the last merge only has 64 elements to place against 2048 — *"a lot more
data movement (O(N) copies just to get 64 elements into place)"*. With minrun 33 you
get 64 runs and every merge is perfectly balanced.

⚠️ `listsort.txt` still carries an older paragraph reading *"We pick 32 as a good
value in the sweet range"*. The live constant in 3.14 is `MAX_MINRUN 64`, so minrun
lands in 32…64. Cite the `#define`, not that sentence.

## Gotchas

### Expecting O(n log n) to be the *typical* cost
**Symptom.** A capacity plan that budgets a full sort for data that is nearly
ordered, or a decision to avoid sorting that was never necessary.
**Cause.** O(n log n) is the documented *worst case*: *"Sorting is adaptive and input
that is already sorted or reverse-sorted takes only O(n) comparisons."*
**Fix.** Let the adaptivity work for you — append and sort once rather than
maintaining order:

```python
rows.extend(new_batch)     # new_batch arrives sorted; rows was sorted
rows.sort(key=score)       # two runs; the merge is close to a single pass
```

### Assuming small lists take the merge path
**Symptom.** A micro-benchmark of "timsort's merging" that never merges anything.
**Cause.** `merge_compute_minrun` returns N itself when `N < MAX_MINRUN`, so lists
below 64 elements are sorted purely by binary insertion.
**Fix.** There is nothing to fix in the code — only in the claim. If you are
reasoning about merge behaviour, reason about lists larger than 64.

### Sorting to "normalise" data that arrives in runs
**Symptom.** A pipeline sorts every batch defensively, and the sorts dominate.
**Cause.** Not a bug, but wasted work: timsort already exploits existing order, so
sorting *once at the end* over concatenated sorted batches is close to a merge.
**Fix.** Concatenate then sort once:

```python
all_rows = []
for batch in batches:          # each batch already sorted
    all_rows.extend(batch)
all_rows.sort(key=score)       # runs are found, not created
```

### Reading `<wink>` and the comparison tables in `listsort.txt` as current benchmarks
**Symptom.** A design document quoting comparison counts from `listsort.txt` as
current performance data.
**Cause.** Those tables compare timsort against Python's *previous* samplesort hybrid,
on a machine from the early 2000s. They are historical justification, not a
benchmark of 3.14.
**Fix.** Quote the mechanism and the complexity statement, and measure your own
workload if a number is needed. Nothing on this page is a timing.

## Interview questions

**★ What sorting algorithm does Python use, and what does it buy you?**
Timsort — described in CPython's `listsort.txt` as *"an adaptive, stable, natural
mergesort"*. Natural: it detects ascending and descending runs that already exist in
the data. Adaptive: it does less work when it finds them, so already-sorted or
reverse-sorted input costs O(n) comparisons rather than O(n log n). Stable: equal
elements keep their relative order, which makes multi-key sorting by repeated passes
correct. Worst case is O(n log n), which is what the documentation's table reports.

**★ Why is sorting an already-sorted list cheap?**
Because the first thing timsort does is scan for a run, and an already-sorted list is
one run covering the whole array. There is nothing to merge, so the cost is the single
pass that established that fact — the docs say *"as few as N-1"* comparisons in the
best case. The same holds for reverse-sorted input, because a descending run is
detected and reversed in place.

**Is a small list sorted by a mergesort?**
No. `merge_compute_minrun` returns N when `N < MAX_MINRUN`, and `MAX_MINRUN` is 64 in
CPython 3.14 — so a list of fewer than 64 elements is sorted entirely by a stable
binary insertion sort, with no merging at all. `listsort.txt` explains the choice:
*"it's hard to beat that given the overheads of trying something fancier."*

**Why does `minrun` land between 32 and 64 rather than being a fixed number?**
Because merge balance depends on the ratio N/minrun. `listsort.txt` walks through
N = 2112: with minrun 32 you get 66 runs, so after 64 perfectly balanced merges you
are left merging 2048 against 64 — lots of data movement to place very few elements.
Choosing minrun so that N/minrun is exactly, or just under, a power of two makes every
merge balanced. The rule is *"pick a minrun in range(MAX_MINRUN / 2, MAX_MINRUN + 1)"*.

**What does "stable" let you do that "sorted" alone does not?**
Sort by several keys with several passes, which is the subject of
[08](08-stability-and-multi-key-sorts.md): sort by the least significant key first,
then by the more significant one, and the earlier ordering survives inside each group
of ties. It also makes sorts reproducible across runs for equal-comparing but distinct
objects, which matters for deterministic output, diffs and caching.

---

← [During the sort](06b-during-the-sort.md) · [Topic index](README.md) · Next → [Merging and merge memory](07b-merging-and-galloping.md)
