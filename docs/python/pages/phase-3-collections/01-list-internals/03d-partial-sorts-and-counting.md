---
title: "Sorting to find the top ten, or counting by scanning once per value, are the two loops that do the most unnecessary work — and the standard library already has both answers"
sidebar_label: "03d · Partial sorts and counting"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the
> [Sorting HOWTO — Partial Sorts](https://docs.python.org/3.14/howto/sorting.html#partial-sorts),
> [`bisect` — Performance Notes](https://docs.python.org/3.14/library/bisect.html#performance-notes),
> [`heapq`](https://docs.python.org/3.14/library/heapq.html),
> [`collections.Counter`](https://docs.python.org/3.14/library/collections.html#collections.Counter),
> and [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html#list).
> Documentation-validated; **no sandbox run, no timings**.
> Target: **CPython 3.14** (3.14.7).

**Two loops account for most of the wasted work in list-heavy code. One sorts the
whole collection to answer a question about a handful of elements. The other asks
"how many of these are there?" once per distinct value, walking the list every time.
The standard library answers both in a single pass — and the documentation
recommends the answers explicitly, which is worth knowing because both fixes look
like premature optimisation until you can quote the page.**

## Pattern 1 · Re-sorting after every insertion

```python
# n sorts of a growing list
for item in stream:
    ranked.append(item)
    ranked.sort(key=score)

# insert in the right place — but read the cost note below
import bisect

for item in stream:
    bisect.insort(ranked, item, key=score)
```

🔴 `insort` is **not** a magic fix, and the `bisect` docs say so plainly:

> *"The `insort()` functions are O(n) because the logarithmic search step is
> dominated by the linear time insertion step."*

It replaces an O(n log n) sort per item with an O(n) shift per item — better, still
linear each time. There is a second documented caveat that turns into its own
performance trap:

> *"To support inserting records in a table, the key function (if any) is applied to
> x for the search step but not for the insertion step."*

> *"The search functions are stateless and discard key function results after they
> are used. Consequently, if the search functions are used in a loop, the key
> function may be called again and again on the same array elements. If the key
> function isn't fast, consider wrapping it with `@functools.cache` to avoid
> duplicate computations."*

If the list only has to be ordered *at the end*, do not maintain order at all —
append everything and sort once:

```python
ranked = [item for item in stream]
ranked.sort(key=score)          # one O(n log n), not n of them
```

## Pattern 2 · Repeatedly taking the maximum

```python
# quadratic — max() is a full scan, remove() is another scan plus a shift
top = []
for _ in range(10):
    best = max(candidates, key=score)
    candidates.remove(best)
    top.append(best)

# one pass, and the docs recommend exactly this
import heapq
top = heapq.nlargest(10, candidates, key=score)
```

The Sorting HOWTO's *Partial Sorts* section makes the case:

> *"`heapq.nsmallest()` and `heapq.nlargest()` return the n smallest and largest
> values, respectively. These functions make a single pass over the data keeping
> only n elements in memory at a time. For values of n that are small relative to
> the number of inputs, these functions make far fewer comparisons than a full
> sort."*

When n is 1, the answer is simpler still:

> *"`min()` and `max()` return the smallest and largest values, respectively. These
> functions make a single pass over the input data and require almost no auxiliary
> memory."*

And when you need an ongoing priority queue rather than a one-shot top-K:

> *"`heapq.heappush()` and `heapq.heappop()` create and maintain a partially sorted
> arrangement of data that keeps the smallest element at position 0. These functions
> are suitable for implementing priority queues which are commonly used for task
> scheduling."*

Topic 07 of this phase owns `heapq` and `bisect` properly. What belongs here is the
recognition: **a full sort to answer a top-K question is the wrong shape.**

## Pattern 3 · Counting occurrences with `count()`

```python
# quadratic — count() walks the whole list for every distinct value
frequencies = {v: xs.count(v) for v in set(xs)}

# linear — one pass
from collections import Counter
frequencies = Counter(xs)
```

`Counter` also gives you the ranking for free with `most_common(k)`, which is the
same partial-sort idea as `nlargest`. Topic 06 owns it.

The same trap appears without `count`, whenever a "group by" is written as a nested
loop:

```python
# quadratic — the inner comprehension re-walks rows for every distinct key
grouped = {k: [r for r in rows if r.key == k] for k in {r.key for r in rows}}

# linear — one pass, buckets created on demand
from collections import defaultdict
grouped = defaultdict(list)
for r in rows:
    grouped[r.key].append(r)
```

## Pattern 4 · `sorted()` inside a comprehension over the same data

```python
# the sort runs once per row
ranks = [sorted(scores).index(s) for s in scores]

# sort once, then look up
order = {s: i for i, s in enumerate(sorted(scores))}
ranks = [order[s] for s in scores]
```

## Gotchas

### `heapq.nlargest(n, xs)` where n is close to `len(xs)`
**Symptom.** The "optimisation" is no better than sorting, and possibly worse.
**Cause.** The HOWTO's recommendation is scoped: *"For values of n that are small
relative to the number of inputs"*. A heap of nearly everything is a sort with
overhead.
**Fix.** Pick the tool by the ratio, and say so in the code:

```python
# top-K where K is a small constant
top = heapq.nlargest(10, rows, key=score)

# "give me everything in order" — just sort
ranked = sorted(rows, key=score, reverse=True)
```

### `bisect.insort` into a list that is not sorted
**Symptom.** No error, and an output list that is quietly in the wrong order.
**Cause.** Every `bisect` function assumes the list is already sorted; a binary
search on unsorted data returns a meaningless position.
**Fix.** Establish the invariant once, at construction, and never break it:

```python
ranked = sorted(initial, key=score)     # invariant established here
bisect.insort(ranked, item, key=score)  # invariant preserved
```

### `bisect.insort(..., key=…)` with an expensive key
**Symptom.** A "fast insert" whose profile is dominated by the key function.
**Cause.** The docs: *"the key function may be called again and again on the same
array elements"*, because the search is stateless and discards its results.
**Fix.** Cache the key, or search a parallel array of precomputed keys:

```python
import functools

@functools.cache
def score(row):
    return expensive(row)
```

### `Counter` on unhashable elements
**Symptom.** `TypeError: unhashable type: 'dict'` from a counting helper.
**Cause.** `Counter` is a `dict` subclass; its keys must be hashable, exactly like
`set` members.
**Fix.** Count a hashable projection, not the object:

```python
from collections import Counter
by_status = Counter(row["status"] for row in rows)
```

### `most_common()` with no argument on a huge counter
**Symptom.** A memory and latency spike where a top-10 was wanted.
**Cause.** The two calls take different code paths in
[`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/3.14/Lib/collections/__init__.py):
with `n is None` it returns `sorted(self.items(), key=_itemgetter(1), reverse=True)`,
a full sort of every distinct key; with an `n` it delegates to `heapq.nlargest`.
**Fix.** Always pass the k you actually want:

```python
top_ten = counts.most_common(10)
```

### Sorting to test "is this the maximum?"
**Symptom.** `if x == sorted(xs)[-1]:` inside a loop.
**Cause.** A full O(n log n) sort to answer a question `max` answers in one pass,
repeated per element.
**Fix.** Compute the extreme once, above the loop:

```python
highest = max(xs)
for x in xs:
    if x == highest:
        ...
```

## Interview questions

**★ Does `bisect.insort` make "keep this list sorted" cheap?**
No, and the docs say so: *"The `insort()` functions are O(n) because the logarithmic
search step is dominated by the linear time insertion step."* It finds the position
in O(log n) and then performs an ordinary list insert, which shifts the tail. It
still beats re-sorting the whole list per item, but if the list only needs to be
ordered at the end, append everything and sort once; and if you only need the
smallest or largest few, use a heap.

**★ A loop calls `max(candidates)` then `candidates.remove(best)`, ten times. What is
the cost, and what is the fix?**
Each `max` is a full O(n) scan, and each `remove` is an O(n) scan plus an O(n)
shift, so ten iterations cost on the order of 30n — linear in n with a poor
constant, and quadratic if the "ten" grows with n. `heapq.nlargest(10, candidates)`
makes a single pass keeping only ten elements resident, which the Sorting HOWTO
recommends for exactly this shape.

**Why is `{v: xs.count(v) for v in set(xs)}` a bad way to build a frequency table?**
Because `count` walks the entire list once per distinct value, so the cost is
`O(n · d)` where `d` is the number of distinct values — quadratic when most elements
are distinct. `collections.Counter(xs)` does it in a single pass, and gives you
`most_common(k)` on top, which is a partial sort rather than a full one.

**When is `sorted()` the right answer and `heapq.nlargest` the wrong one?**
When you need the whole thing ordered, or when K is a large fraction of n. The
HOWTO's recommendation is explicitly conditional — *"For values of n that are small
relative to the number of inputs"* — because a heap of size K carries per-element
overhead that only pays off when K is small. "Top 10 of a million" is `nlargest`;
"rank all million" is `sorted`.

**You must maintain a leaderboard that is queried after every insert. Heap, sorted
list, or re-sort?**
It depends on what the query is. "Top 1" or "top K" after every insert is a heap —
`heappush` plus `heap[0]`, both cheap. "The whole list in order" after every insert
means you genuinely need the order maintained, and `bisect.insort` is the least-bad
option at O(n) per insert. "The whole list in order at the end" means neither: append
and sort once, and let Timsort exploit whatever order the data already had.

**Why does grouping written as a nested comprehension go quadratic?**
Because `{k: [r for r in rows if r.key == k] for k in keys}` walks all of `rows`
once per key, so the cost is `O(n · d)`. A single pass that appends into a
`defaultdict(list)` visits each row exactly once and creates each bucket on first
use. The general rule is the same as everywhere else on these pages: build the index
once, do not re-derive it per key.

---

← [Linear scans inside loops](03c-linear-scans-in-loops.md) · [Topic index](README.md) · Next → [Adding and combining](04-adding-and-combining.md)
