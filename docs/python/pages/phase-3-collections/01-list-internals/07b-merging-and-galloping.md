---
title: "Timsort merges only neighbouring runs, decides when with the powersort policy, and borrows temp memory equal to the smaller run after trimming both — so a sort that is \"in place\" can still hold N/2 extra pointers"
sidebar_label: "07b · Merging and merge memory"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against CPython's
> [`Objects/listsort.txt`](https://github.com/python/cpython/blob/3.14/Objects/listsort.txt)
> (*The Merge Pattern*, *Merge Memory*) and
> [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`MERGESTATE_TEMP_SIZE`, `MAX_MERGE_PENDING`, `struct s_MergeState`,
> `merge_getmem`, `list_sort_impl`), plus
> [`heapq.merge`](https://docs.python.org/3.14/library/heapq.html#heapq.merge).
> Documentation-validated; **no sandbox run, no timings, no comparison counts of my
> own** — every count below is quoted from `listsort.txt`. Target: **CPython 3.14**
> (3.14.7).

**[07](07-timsort.md) found the runs. This chunk is how they are combined, and what
that costs in memory. Stability forbids merging anything but two *adjacent* runs, so
the only freedom is *when* to merge — and in 3.14 that decision is made by the
powersort strategy rather than Tim Peters' original Fibonacci-flavoured invariants,
which a correctness-proof attempt showed were not actually preserved. A merge needs
temporary memory equal to the *smaller* run, after both runs have been trimmed of
elements already in their final place, so one sort can hold up to N/2 extra pointers
on top of the list — and a `key=` sort holds every key object at once as well. What
happens *inside* a merge, galloping, is [07c](07c-galloping.md).**

⚠️ I could not pin the exact release in which powersort replaced the old merge
invariants from the 3.14 sources alone; `listsort.txt` records the change without a
version. Treat "powersort" as *what 3.14 does*, not as a dated claim.

## Only neighbours may merge

> *"Stability constrains permissible merging patterns. For example, if we have 3
> consecutive runs of lengths A:10000 B:20000 C:10000 we dare not merge A with C
> first, because if A, B and C happen to contain a common element, it would get out
> of order wrt its occurrence(s) in B. The merging must be done as (A+B)+C or
> A+(B+C) instead."*

> *"So merging is always done on two consecutive runs at a time, and in-place,
> although this may require some temp memory (more on that later)."*

That rules out the obvious "merge the two smallest runs first" heuristic, which is
what an unstable mergesort could do. What remains is a *stack* of pending runs, each
adjacent to the next, and a policy for when to collapse the top of it.

## When to merge: the pending-run stack and powersort

The tension is stated directly:

> *"We would like to delay merging as long as possible in order to exploit patterns
> that may come up later, but we like even more to do merging as soon as possible to
> exploit that the run just found is still high in the memory hierarchy. We also
> can't delay merging \"too long\" because it consumes memory to remember the runs
> that are still unmerged, and the stack has a fixed size."*

The fixed size is `MAX_MERGE_PENDING`, defined as the number of bits in a `size_t`,
with the comment that a list of n elements *"needs at most floor(log2(n)) + 1
entries"*. The stack is part of a `MergeState` struct on the C stack — no allocation.

The policy has a history worth knowing because it is the rare case of a
production sort being corrected by a proof attempt:

> *"The original version of this code used the first thing I made up that didn't
> obviously suck ;-) It was loosely based on invariants involving the Fibonacci
> sequence."*

> *"It worked OK, but it was hard to reason about, and was subtle enough that the
> intended invariants weren't actually preserved. Researchers discovered that when
> trying to complete a computer-generated correctness proof."*

> *"The code now uses the \"powersort\" merge strategy from: \"Nearly-Optimal
> Mergesorts: Fast, Practical Sorting Methods That Optimally Adapt to Existing Runs\"
> J. Ian Munro and Sebastian Wild"*

Powersort gives each boundary between two adjacent runs a small integer, its
**power** — *"the depth of the node connecting the two runs in an ideal binary merge
tree"*, computed from where the two runs' midpoints fall in the whole array. When a
new run arrives, the power of the boundary before it is computed, and runs on the
stack are merged while their saved power is greater than that new one:

> *"A key invariant is that powers on the run stack are strictly decreasing (starting
> from the run at the top of the stack)."*

Two caveats in the source are worth quoting because they stop you over-claiming:

> *"Note that even powersort's strategy isn't always truly optimal. It can't be."*

> *"powersort's is the only one that's always truly optimal for a collection of 3 run
> lengths (for three lengths A B C, it's always optimal to first merge the shorter of
> A and C with B)."*

## Merge memory: the smaller run, after trimming

> *"Merging adjacent runs of lengths A and B in-place, and in linear time, is
> difficult. Theoretical constructions are known that can do it, but they're too
> difficult and slow for practical use. But if we have temp memory equal to
> min(A, B), it's easy."*

If A is the smaller run, `merge_lo` copies A to the temp area and merges left to
right into the space A vacated; if B is smaller, `merge_hi` is its mirror image,
copying B and merging right to left. Before either, both runs are trimmed:

> *"A refinement: When we're about to merge adjacent runs A and B, we first do a form
> of binary search (more on that later) to see where B[0] should end up in A. Elements
> in A preceding that point are already in their final positions, effectively
> shrinking the size of A. Likewise we also search to see where A[-1] should end up in
> B, and elements of B after that point can also be ignored. This cuts the amount of
> temp memory needed by the same amount."*

The source is candid that this is a bet: *"we're willing to gamble a little to win a
lot, even though the net expectation is negative for random data."*

The ceiling, from the top of the document:

> *"timsort can require a temp array containing as many as N//2 pointers, which means
> as many as 2*N extra bytes on 32-bit boxes."*

Small sorts never touch the allocator for it — `MERGESTATE_TEMP_SIZE` is 256, with the
comment *"Avoid malloc for small temp arrays."* — and that same stack buffer holds the
keys array when a `key=` sort has fewer than 128 elements.

### The full memory bill of one `sort()` call

| What | Size | Source |
|---|---|---|
| Merge temp area | up to N//2 pointers (x2 with `key=`, since keys and values move together) | `listsort.txt`, `merge_getmem` |
| Keys array, only with `key=` | N pointers | `list_sort_impl` |
| The key objects themselves | N objects, all alive at once | one `key()` call per element, up front |
| Pending-run stack, `MergeState` | fixed, on the C stack | `MAX_MERGE_PENDING` |

The third row is the one that surprises people: `key=lambda r: (r.region, r.day,
r.score)` builds N tuples *before the first comparison* and keeps them all until the
sort ends. [09](09-key-functions-and-cmp-to-key.md) has the key path in full.

### What the temp area does on an exception

> *"The only tricky bit is that if a comparison raises an exception, we have to
> remember to copy the remaining elements back in from the temp area, lest the array
> end up with duplicate entries from B. But that's exactly the same thing we need to
> do if we reach the end of B first, so the exit code is pleasantly common to both the
> normal and error cases."*

That paragraph is where the guarantee [06b](06b-during-the-sort.md) quotes — *"the
list will be some permutation of its input state (nothing is lost or duplicated)"* —
is actually earned.

## Gotchas

### Assuming `list.sort()` needs no extra memory because it is "in place"
**Symptom.** A worker that holds a very large list is killed, or raises `MemoryError`,
during `rows.sort(key=…)` — not while building the list.
**Cause.** "In place" describes where the result ends up. The merge needs up to N//2
pointers of temp space, a `key=` sort adds an N-pointer keys array, and every key
object is alive at once.
**Fix.** Sort chunks that fit, then stream-merge them — `heapq.merge` *"does not pull
the data into memory all at once"*:

```python
import heapq
from itertools import batched

def sorted_stream(rows, key, chunk=500_000):
    runs = [sorted(batch, key=key) for batch in batched(rows, chunk)]
    return heapq.merge(*runs, key=key)       # an iterator; nothing merged up front
```

For data that does not fit at all, write the sorted chunks to disk and merge the
files; the shape is identical.

### Hand-writing a two-pointer merge of two sorted lists
**Symptom.** A Python `while i < len(a) and j < len(b)` loop in a hot path, with its
own off-by-one history in `git blame`.
**Cause.** Porting an algorithm from a language without an adaptive sort. Timsort
detects each input as a run and merges them in C, galloping through blocks.
**Fix.** Concatenate and sort, or merge lazily:

```python
merged = a + b
merged.sort(key=ts)                        # two runs, one merge

merged_iter = heapq.merge(a, b, key=ts)    # when you want it streamed
```

### Believing an exception mid-merge can duplicate or drop rows
**Symptom.** Defensive code that re-fetches the whole dataset after a failed sort
"in case it was corrupted".
**Cause.** Reasonable fear, unfounded here: the merge copies the temp area back on the
error path exactly as it does on the normal path.
**Fix.** Retry with a fixed key on the same list — every element is still there:

```python
try:
    rows.sort(key=lambda r: r.priority)
except TypeError:
    rows.sort(key=lambda r: (r.priority is None, r.priority or 0))
```

## Interview questions

**★ How does timsort merge runs without breaking stability?**
It only ever merges two *adjacent* runs — never A with C across B, because an element
equal to one in B could jump past it. Within a merge, ties are always resolved in
favour of the earlier run: `gallop_left` and `gallop_right` differ exactly in which
side of an equal block they land on, the same distinction as `bisect_left` and
`bisect_right`. The remaining freedom is only *when* to merge, which is the powersort
policy.

**★ How much extra memory does `list.sort()` use?**
Up to N//2 pointers for the merge temp area — `listsort.txt` says so directly — because
a merge needs temp space equal to the smaller of the two runs, and trimming the
already-placed elements first often shrinks that. With `key=`, add an N-pointer keys
array and the N key objects themselves, all alive for the whole sort. Small sorts use a
256-slot buffer on the C stack instead of calling the allocator.

**What is powersort, and why did CPython adopt it?**
A merge policy by Munro and Wild that assigns each run boundary a "power" — its depth
in an ideal binary merge tree — and merges while the stack's powers exceed the new
boundary's, keeping powers strictly decreasing on the stack. CPython adopted it because
the original Fibonacci-flavoured invariants were hard to reason about and, as
researchers found while attempting a machine-checked proof, were not actually
preserved. Powersort is near-optimal, not optimal, and the source says so.

**What happens to the list if a comparison raises in the middle of a merge?**
The merge copies whatever is left in the temp area back into the array, the same exit
path it uses when one run is exhausted normally. So no element is lost or duplicated;
the order is whatever the merge had reached. The documentation's *"partially modified
state"* and the C comment's *"some permutation of its input state"* are both
consequences of that one code path.

**You have two sorted lists. What is the idiomatic way to merge them?**
`(a + b).sort()` if you want a list — timsort sees two runs and performs one merge in
C. `heapq.merge(a, b)` if you want a lazy iterator or have many sorted inputs, since it
*"does not pull the data into memory all at once"*. A hand-written two-pointer loop is
the one answer that is both slower and easier to get wrong.

**Why does a merge trim both runs before copying anything?**
Because elements of A that precede where `B[0]` belongs, and elements of B that follow
where `A[-1]` belongs, are already in their final positions. Finding them costs two
binary-ish searches, and every element trimmed is one fewer to copy into temp memory
and one fewer to compare. On random data it rarely trims much; on runs that barely
overlap it can shrink the merge to almost nothing.

---

← [Timsort — runs and minrun](07-timsort.md) · [Topic index](README.md) · Next → [Galloping](07c-galloping.md)
