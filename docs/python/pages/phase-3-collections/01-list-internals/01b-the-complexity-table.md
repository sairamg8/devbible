---
title: "Python 3.14 shipped a first-party complexity table for built-in types, which replaces the community wiki everyone was quoting — and its two footnotes are the whole of this topic"
sidebar_label: "01b · The complexity table"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against
> [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html#list)
> (new in 3.14 — the same URL returns 404 under `/3.13/`),
> [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations),
> and the tutorial's
> [Using Lists as Queues](https://docs.python.org/3.14/tutorial/datastructures.html#using-lists-as-queues).
> Documentation-validated; **no sandbox run, no timings**.
> Target: **CPython 3.14** (3.14.7).

**Before 3.14, the table every Python programmer quoted for list and dict costs was
a wiki page — community-edited, not release-gated, not part of the documentation
build. Python 3.14 shipped the real thing at `library/time-complexity.html`, and it
is better than the wiki in the way that matters: it explains *why* each cost is what
it is, in footnotes you can hand to a colleague. This chunk reproduces the `list`
half verbatim, then reads the two footnotes that the rest of this topic exists to
unpack.**

## The framing paragraph is the shortest correct summary of this topic

> *"Lists are mutable sequences; for more detail on the implementation see How are
> lists implemented in CPython?. The largest costs come from growing beyond the
> current allocation size (because everything must move), or from inserting or
> deleting somewhere near the beginning (because everything after that must move).
> If you need to add or remove at both ends, consider using a `collections.deque`
> instead."*

Two costs, one cause each. **Growth** moves everything because a bigger contiguous
block has to be found and filled — [02](02-overallocation-and-amortised-append.md).
**Position** moves everything after the touched index because the array has no holes
— [03](03-the-o-n-shift.md).

## The table, verbatim

| Operation | Complexity |
|---|---|
| Copy (`l.copy()`) | O(n) |
| Append (`l.append(x)`) [1] | O(1) |
| Pop (`l.pop(k)`) [1] [2] | O(n - k) |
| Insert (`l.insert(k, x)`) [1] [2] | O(n - k) |
| Get item (`l[k]`) | O(1) |
| Set item (`l[k] = x`) | O(1) |
| Delete item (`del l[k]`) [2] | O(n - k) |
| Iteration | O(n) |
| Get slice (`l[i:j]`) | O(j - i) |
| Set slice (`l[i:j] = t`) [1] | O(j - i) if `len(t) == j - i`, otherwise O(n - i + len(t)) |
| Delete slice (`del l[i:j]`) | O(n - i) |
| Extend (`l.extend(t)`) [1] [3] | O(len(t)) |
| Sort (`l.sort()`) [4] | O(n log n) |
| Concatenate (`l1 + l2`) | O(len(l1) + len(l2)) |
| Multiply (`l * k`) | O(nk) |
| `x in l` | O(n) |
| `min(l)`, `max(l)` | O(n) |
| Get length (`len(l)`) [5] | O(1) |

Notice what the table does *not* say. There is no row for `l.remove(x)` and none for
`l.index(x)` — `index` is O(n) by the `x in l` row's logic, and `remove` is a scan
followed by a delete, so it is O(n) whichever way it lands. And notice that
`l.pop(k)` and `l.insert(k, x)` are written as **O(n - k)**, not O(n): the cost is a
function of *how far from the end you touched*, which is the fact people lose when
they memorise "insert is O(n)".

## Footnote [1] — the word "amortised", exactly

> *"Amortized. An individual operation may occasionally be O(n) when the underlying
> storage is resized, but this cost is spread over many operations, depending on the
> history of the container."*

Two things are hiding in there.

*"An individual operation may occasionally be O(n)"* — so **any single `append` can
be slow**. If you are writing latency-sensitive code with a p99.9 target, "amortised
O(1)" is not the same promise as "O(1)". One append in a long run pays for a full
copy of the pointer block.

*"depending on the history of the container"* — the over-allocation slack is not a
function of the current length alone; it depends on how the list got to that length.
A list built by `append` carries slack; a list built by `list(range(n))` was
preallocated exactly and may carry none. [02](02-overallocation-and-amortised-append.md)
shows both code paths in CPython's source.

## Footnote [2] — the O(n - k) shift, spelled out

> *"Popping or deleting the element at index k of a list of size n shifts all
> elements after k one slot to the left, moving n - k - 1 elements; inserting at
> index k shifts the elements from k onwards one slot to the right, moving n - k
> elements. The worst case is index 0, where the whole rest of the list has to be
> moved; the average case, an index in the middle of the list, takes O(n/2) = O(n)
> operations; and operating at the end of the list moves nothing and is O(1)."*

This is the sentence to quote in a code review. It gives you three regimes, not one:

| Where you touch | Elements moved | Cost |
|---|---|---|
| The end (`append`, `pop()`) | 0 | O(1) |
| The middle | ~n/2 | O(n) |
| The front (`insert(0, x)`, `pop(0)`) | n - 1 | O(n), worst case |

## Footnotes [3], [4] and [5]

> *"[3] Plus the cost of iterating over t, which may be expensive for an arbitrary
> iterable."*

`l.extend(t)` is O(len(t)) *in list work*. If `t` is a generator doing a database
round trip per item, the O(len(t)) is not where your time goes. The complexity of a
container operation never covers the cost of producing the data.

> *"[4] This is the worst case scenario. Sorting is adaptive and input that is
> already sorted or reverse-sorted takes only O(n) comparisons. See
> Objects/listsort.txt for more information."*

O(n log n) is the ceiling, not the expectation. That single footnote is the reason
[07](07-timsort.md) exists, and the reason the two-pass multi-key sort in
[08](08-stability-and-multi-key-sorts.md) is not as wasteful as it looks.

> *"[5] The number of elements is stored in the object, so `len()` does not need to
> count them."*

## The scope limits — read them before you quote the table

> *"This page documents the time complexity of various operations on built-in types
> in CPython. Other Python implementations may have different performance
> characteristics. Additionally, the listed costs assume exact built-in types, as
> instances of subclasses may have different costs."*

> *"We use Big O notation to describe how the running time of an operation grows with
> the size of its inputs. Unless stated otherwise, n denotes the number of elements
> currently in the container, and k is the value of a numeric parameter, such as an
> index or a repeat count."*

So `k` in `O(n - k)` is *the index you passed*, and `k` in `O(nk)` is *the repeat
count*. Same letter, two meanings, one page — worth reading slowly.

## Slicing copies pointers, and only pointers

`l[i:j]` allocates a new list of `j - i` slots and copies the pointers into it. It
does **not** copy the objects, and it does not create a view:

```python
rows = [{"id": 1}, {"id": 2}, {"id": 3}]
head = rows[:2]

head.append({"id": 99})     # rows is unaffected — different pointer blocks
head[0]["id"] = 111         # rows[0] IS head[0] — same dict object
```

That is the same shallow-copy behaviour `list(x)`, `x[:]` and `x.copy()` all share,
and [10](10-copies-and-aliasing.md) works through every spelling of it. The cost
matters too: `l[i:j]` is O(j - i), so a "cheap" chunking loop copies the entire list
once, not zero times.

## Gotchas

### Quoting the wiki table in 2026
**Symptom.** A design doc cites `wiki.python.org/moin/TimeComplexity` and a reviewer
cannot tell which Python version the numbers describe.
**Cause.** That page is a community wiki, not part of the documentation build, and
carries no version. It was the only option before 3.14.
**Fix.** Cite the first-party page and its version, in the form the docs use:

```markdown
CPython 3.14 — https://docs.python.org/3.14/library/time-complexity.html#list
`list.insert(k, x)` is O(n - k); `list.append(x)` is amortised O(1).
```

### Reading "amortised O(1)" as a latency guarantee
**Symptom.** A tail-latency spike in an append-heavy hot loop, with no obvious cause
in the profile's averages.
**Cause.** The docs say *"An individual operation may occasionally be O(n) when the
underlying storage is resized"*. Amortisation is a statement about totals, not about
any one call.
**Fix.** If a bounded per-call cost matters, size the container once instead of
growing it:

```python
# instead of growing inside the latency-critical section
buf = [None] * expected_count      # one allocation, no resize inside the loop
for i, item in enumerate(source):
    buf[i] = transform(item)
```

Or move the growth out of the request path entirely — build in a worker, hand over
the finished list.

### Chunking a big list with slices and calling it free
**Symptom.** Memory doubles while "streaming" a large list in blocks.
**Cause.** `Get slice (l[i:j])` is O(j - i) and allocates; slicing the whole list in
blocks copies the whole pointer array, and all the chunks can be alive at once.
**Fix.** Use a lazy view rather than a copy:

```python
from itertools import batched, islice

for chunk in batched(big, 1000):     # tuples, produced lazily; 3.12+
    handle(chunk)

window = islice(big, 10, 20)         # no copy at all, read-once
```

### Expecting a list slice to behave like a NumPy slice
**Symptom.** Mutating `data[10:20]` has no effect on `data`; or an algorithm ported
from NumPy silently stops sharing state.
**Cause.** A NumPy slice is a **view** over the same buffer. A list slice is a
**copy** of the pointer block. The syntax is identical.
**Fix.** Mutate through slice *assignment*, which is a method call on the original:

```python
data[10:20] = [x * 2 for x in data[10:20]]   # writes back into data
```

### Assuming `set slice` is always cheap because "it is just assignment"
**Symptom.** A loop doing `xs[i:i+1] = replacement` degrades badly as `xs` grows.
**Cause.** The table gives two cases: O(j - i) when the replacement is the *same
length*, otherwise **O(n - i + len(t))** — because a length change shifts the whole
tail, exactly like an insert.
**Fix.** Keep same-length slice assignment (it is genuinely local), and batch
length-changing edits into one pass:

```python
xs[i:i+1] = [new]                  # same length — local, O(1)-ish
xs[:] = [f(x) for x in xs if keep(x)]   # one rebuild instead of n shifts
```

## Interview questions

**★ Where does the official complexity table live, and why does that matter?**
Since Python 3.14, at `docs.python.org/3.14/library/time-complexity.html`. Before
3.14 the widely-cited table was a community wiki page, which is not a primary source
and was not release-gated. If you are quoting complexities in a code review, quote
the first-party page — and quote its caveats too: CPython only, exact built-in types
only, and the same URL does not exist for 3.13 or earlier.

**★ What does "amortised O(1)" actually promise, and what does it not?**
It promises that a long run of `append` calls costs O(n) in total, so the *average*
per call is constant. It does not promise that any individual call is constant — the
documentation says outright that an individual operation *"may occasionally be O(n)
when the underlying storage is resized"*. For throughput that distinction is
irrelevant; for a p99.9 latency budget it is the whole story.

**Why is `insert` documented as O(n - k) rather than O(n)?**
Because the cost is the number of elements that have to move, and that is `n - k`
where `k` is the index. Inserting at the end moves nothing and is O(1); inserting in
the middle moves about half the list; inserting at 0 moves all of it. Collapsing all
three to "O(n)" is technically true for the worst case and actively misleading for
the common one — `list.append` is literally `insert` at the end.

**A colleague says `extend` is O(len(t)), so extending from a generator is cheap.
What do you say?**
That the footnote adds *"Plus the cost of iterating over t, which may be expensive
for an arbitrary iterable."* The O(len(t)) counts only the list-side work: making
room and storing pointers. If the generator does I/O or heavy computation per item,
the container complexity tells you nothing useful about the runtime.

**The table says sort is O(n log n). When is it not?**
When the input has exploitable order. The footnote is explicit: *"This is the worst
case scenario. Sorting is adaptive and input that is already sorted or reverse-sorted
takes only O(n) comparisons."* Timsort finds ascending and descending runs and merges
them, so already-ordered or nearly-ordered data costs close to a single pass — which
is exactly what makes the sort-twice idiom for multi-key sorts practical.

**Why is there no row for `list.remove(x)`?**
Because it is two documented costs composed: a linear scan to find the first equal
element (the `x in l` row, O(n)), then a delete at that index (the `del l[k]` row,
O(n - k)). Worst case O(n) either way. It is worth knowing that the scan uses `==`,
so it can execute arbitrary Python through `__eq__` — a detail
[05](05-removing-and-searching.md) returns to.

---

← [The dynamic array](01-the-dynamic-array.md) · [Topic index](README.md) · Next → [Over-allocation and amortised `append`](02-overallocation-and-amortised-append.md)
