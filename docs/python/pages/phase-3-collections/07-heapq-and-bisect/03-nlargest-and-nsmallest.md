---
title: "nlargest and nsmallest are one pass with a heap of n entries — they beat sorted() when n is small against the input and lose to it when n is large, and for n equal to 1 they are literally min and max"
sidebar_label: "03 · nlargest and nsmallest"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`heapq.nlargest` / `nsmallest`](https://docs.python.org/3.14/library/heapq.html#heapq.nlargest) and the [Sorting Techniques HOWTO — Partial Sorts](https://docs.python.org/3.14/howto/sorting.html#partial-sorts) — and CPython **v3.14.7** [`Lib/heapq.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/heapq.py) (lines 411–593: the algorithm notes, `nsmallest`, `nlargest`) plus `Lib/test/test_heapq.py` (`test_nsmallest`, `test_nlargest`). Target: **Python 3.14.7**. **No sandbox run, no timings** — the comparison counts quoted below are CPython's own, from a source comment.

**"The ten slowest requests", "the five closest warehouses", "the hundred biggest invoices": a top-K question does not need the other N − K items put in order. `heapq.nlargest(k, iterable, key=...)` walks the input once, keeps the K best so far in a heap whose root is the weakest survivor, and discards everything that cannot beat that root with a single comparison — so memory is K entries rather than N, and the comparison count approaches N as the input grows. That is why it wins for small K and why the documentation tells you to use `sorted()` instead when K is large, and `min`/`max` when K is 1 — which the implementation already does for you. This chunk is the mechanism and the cost; which of several equal items you get back, how the `key=` behaves and how to shape real top-N queries is [03b](03b-ties-keys-and-top-n-queries.md).**

## The contract

> *"Return a list with the *n* largest elements from the dataset defined by *iterable*. *key*, if
> provided, specifies a function of one argument that is used to extract a comparison key from
> each element in *iterable* (for example, `key=str.lower`). Equivalent to:
> `sorted(iterable, key=key, reverse=True)[:n]`."*

> *"Return a list with the *n* smallest elements from the dataset defined by *iterable*. […]
> Equivalent to: `sorted(iterable, key=key)[:n]`."*

"Equivalent" is meant literally — CPython's tests compare both functions against the `sorted`
expression for `n` in `0, 1, 2, 10, 100, 400, 999, 1000, 1100` on a 1,000-element input, with
and without a key. So the result is a **new list, already in order** (descending for
`nlargest`), at most `n` long, and for `n <= 0` it is empty.

> *"The latter two functions perform best for smaller values of *n*. For larger values, it is more
> efficient to use the `sorted()` function. Also, when `n==1`, it is more efficient to use the
> built-in `min()` and `max()` functions. If repeated usage of these functions is required,
> consider turning the iterable into an actual heap."*

## How one pass with n entries works

To find the K **largest**, `nlargest` keeps a **min**-heap of K entries. Its root is the smallest
of the current top K — the one that must go if something better arrives. Each later element is
compared with that root once; only a strictly larger one triggers a `heapreplace`. At the end
the K survivors are sorted once. `nsmallest` is the mirror image with a max-heap (it calls the
3.14 `heapify_max` and `heapreplace_max` — [04](04-max-heaps.md)).

The source, trimmed to the key-less path of `nlargest`:

```python
# Lib/heapq.py, v3.14.7 — nlargest, the path taken when key is None
it = iter(iterable)
result = [(elem, i) for i, elem in zip(range(0, -n, -1), it)]
if not result:
    return result
heapify(result)
top = result[0][0]
order = -n
_heapreplace = heapreplace
for elem in it:
    if top < elem:
        _heapreplace(result, (elem, order))
        top, _order = result[0]
        order -= 1
result.sort(reverse=True)
return [elem for (elem, order) in result]
```

Three details carry most of the behaviour:

- **The first K elements are taken with `zip(range(...), it)`**, range first — the source comment
  on `nsmallest` explains *"put the range(n) first so that zip() doesn't consume one too many
  elements from the iterator"*. The input is consumed exactly once and can be a generator.
- **Each entry carries a sequence number.** Without a key the entry is `(elem, order)`; with a
  key it is `(key(elem), order, elem)`. The number makes equal elements come out in the order
  they arrived — the "equivalent to `sorted`" guarantee — and, in the key form, means two
  elements themselves are **never compared**. [03b](03b-ties-keys-and-top-n-queries.md) is
  about exactly that.
- **The comparison against the root is strict** (`top < elem`). An element equal to the current
  K-th best does not displace it, so the earlier of two equal elements wins.

## The shortcuts the implementation takes

Before building a heap at all, both functions check two cases (v3.14.7, lines 483–497 and
543–557):

```python
# Lib/heapq.py, v3.14.7 — nsmallest, before the heap path
if n == 1:
    it = iter(iterable)
    sentinel = object()
    result = min(it, default=sentinel, key=key)
    return [] if result is sentinel else [result]

try:
    size = len(iterable)
except (TypeError, AttributeError):
    pass
else:
    if n >= size:
        return sorted(iterable, key=key)[:n]
```

So `nlargest(1, xs)` is `max`, and asking for at least as many items as the input holds is a
plain `sorted`. The second shortcut needs `len()`: a generator has none, so a generator always
takes the heap path. Between those two cases the heap path is used for every `n`, including an
`n` that is 99% of the input — the implementation does not pick `sorted` for you there. That
choice is yours.

## What it costs

The source carries its own analysis. Its comment headed *"Measured performance for random
inputs"* (`Lib/heapq.py` v3.14.7, lines 417–426) gives these comparison counts for the 100 most
extreme values — CPython's figures, reproduced from the comment, not measured here:

| n inputs | k | comparisons (average of 5 trials) | % more than `min()` |
|---:|---:|---:|---:|
| 1,000 | 100 | 3,317 | 231.7% |
| 10,000 | 100 | 14,046 | 40.5% |
| 100,000 | 100 | 105,749 | 5.7% |
| 1,000,000 | 100 | 1,007,751 | 0.8% |
| 10,000,000 | 100 | 10,009,401 | 0.1% |

Read the last column: for small K against large N the total approaches the N − 1 comparisons
`min()` alone would make, because almost every element loses to the root in one comparison and
is thrown away. The source's rough estimate is
`comparisons = n + k * (log(k, 2) * log(n/k) + log(k, 2) + log(n/k))`, and for the worst case it
says *"the input data is reversed sorted so that every new element must be inserted in the
heap"* — descending input for `nsmallest`, ascending for `nlargest` — costing
`1.66 * k + log(k, 2) * (n - k)` comparisons, i.e. O(N log K).

| | Time | Extra memory | Input |
|---|---|---|---|
| `max(xs)` / `min(xs)` | N − 1 comparisons | O(1) | any iterable, one pass |
| `nlargest(k, xs)` | ≈ N comparisons for K ≪ N; O(N log K) worst | K entries | any iterable, one pass |
| `sorted(xs)[:k]` | O(N log N) worst; O(N) on already-ordered runs | a full N-element list, then a K slice | materialised |
| heapify once, then pop K | O(N + K log N) | the heap is the list | a list you own |

Memory is frequently the more important column. `sorted` must materialise every row; a
generator of a million log lines fed to `nlargest(10, ...)` never holds more than ten of them
plus the one being read.

The documentation's own summary of the same trade:

> *"`heapq.nsmallest()` and `heapq.nlargest()` return the *n* smallest and largest values,
> respectively. These functions make a single pass over the data keeping only *n* elements in
> memory at a time. For values of *n* that are small relative to the number of inputs, these
> functions make far fewer comparisons than a full sort."* — Sorting HOWTO, Partial Sorts

## Choosing between them

```python
import heapq
from collections.abc import Iterable, Iterator

def request_log(path: str) -> Iterator[tuple[float, str]]:
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            request_id, latency = line.rstrip("\n").split("\t")
            yield float(latency), request_id

# Small K, huge streamed input: one pass, ten entries in memory.
slowest_ten = heapq.nlargest(10, request_log("/var/log/api/latency.tsv"))

# K == 1: say what you mean, and decide what "empty" returns.
def slowest(rows: Iterable[tuple[float, str]]) -> tuple[float, str] | None:
    return max(rows, default=None)

# K is most of a list you already hold: a full sort is cheaper and clearer.
def all_but_fastest_five(rows: list[tuple[float, str]]) -> list[tuple[float, str]]:
    return sorted(rows, reverse=True)[:-5]

# Many top-K questions against the same data: build the heap once.
def smallest_in_batches(values: list[int], batch: int) -> Iterator[list[int]]:
    heap = list(values)
    heapq.heapify(heap)                                  # O(N), once
    while heap:
        yield [heapq.heappop(heap) for _ in range(min(batch, len(heap)))]
```

There is no published crossover `k` and the documentation deliberately gives none — "smaller
values of *n*" is the whole rule. The source's numbers above are comparisons, not seconds, and
the heap path also pays for decorating each survivor with a tuple. If a top-K call sits on a hot
path with a K that is a large fraction of N, measure both on your own data rather than trusting
a rule of thumb.

## Gotchas

### `nlargest(k, xs)` with `k` close to `len(xs)`
**Symptom.** A "top 90% of scores" report is slower than the plain sort it replaced.
**Cause.** Only `k >= len(xs)` falls back to `sorted`; any smaller `k` takes the heap path,
where almost every element becomes a new survivor and pays a `heapreplace`.
**Fix.** Sort when K is a large fraction of N:

```python
cutoff = int(len(scores) * 0.9)
top_90_percent = sorted(scores, reverse=True)[:cutoff]
```

### `nlargest(1, xs)[0]` on an input that can be empty
**Symptom.** `IndexError: list index out of range` on a quiet day with no data.
**Cause.** For an empty input `nlargest` returns `[]`, and indexing it fails.
**Fix.** `max`/`min` with an explicit `default`:

```python
worst = max(latencies, default=None)
```

### Calling `nsmallest` on the same large list for every request
**Symptom.** A "next five deliveries" endpoint scans a 200,000-item list on every call; CPU climbs
with traffic, not with data changes.
**Cause.** Each call is a fresh O(N) pass. The documentation's advice for repeated use is to keep
an actual heap.
**Fix.** Keep the data as a heap — `heapify` once at load, `heappush` on arrival — and answer
"the next five" from the top of it in O(5 log N) instead of O(N):

```python
import heapq

def next_five(heap: list[tuple[float, int, str]]) -> list[tuple[float, int, str]]:
    taken = [heapq.heappop(heap) for _ in range(min(5, len(heap)))]
    for entry in taken:
        heapq.heappush(heap, entry)          # put them back; the heap is unchanged as a set
    return taken
```

### Reusing the generator you just gave to `nlargest`
**Symptom.** The top-ten list is right; the total computed on the next line is `0`.
**Cause.** `nlargest` consumed the iterator; a generator cannot be read twice.
**Fix.** Compute everything in the one pass, or materialise when the data fits:

```python
rows = list(request_log(path))          # when it fits in memory
slowest_ten = heapq.nlargest(10, rows)
total_ms = sum(latency for latency, _ in rows)
```

### `NaN` in the values being ranked
**Symptom.** A top-10 list contains ordinary values in the wrong order and misses larger ones;
nothing raises.
**Cause.** `NaN < x` and `x < NaN` are both `False`, so a `NaN` that reaches the root is never
displaced and a `NaN` elsewhere is never promoted; the final sort cannot order it either.
**Fix.** Filter before ranking: `heapq.nlargest(10, (v for v in values if v == v))` — `v == v`
is `False` only for `NaN`.

## Interview questions

**★ When is `heapq.nlargest(k, xs)` better than `sorted(xs, reverse=True)[:k]`, and when is it worse?**
It is better when K is small relative to N: it makes one pass, keeps K entries, and most
elements are rejected by a single comparison against the heap's root, so the comparison count
approaches N rather than N log N — and it works on a stream that was never materialised. It is
worse when K is a large fraction of N, because then most elements enter the heap and each costs
a logarithmic sift on top of the decoration, while Timsort would have sorted the whole list in
C, and faster still if the data has runs. For K equal to 1 use `max`, which `nlargest` calls for
you anyway.

**★ How does `nlargest` work, and what does it cost in time and memory?**
It fills a min-heap with the first K elements, decorated with a sequence number (and the key, if
one is given), heapifies it, and then compares each remaining element with the root — the
weakest of the current top K. Only a larger element replaces the root with one `heapreplace`.
At the end it sorts the K survivors and strips the decoration. Memory is O(K); time is about N
comparisons for random input and small K, O(N log K) in the worst case.

**Why does `nlargest` use a min-heap?**
Because the decision it makes for every new element is "does this beat the weakest of my current
top K?", and the weakest of the top K is their minimum. A min-heap puts that element at index 0,
where one comparison answers the question and one sift replaces it.

**What does `nlargest` do with `n == 1` and with `n >= len(iterable)`?**
It short-circuits both. `n == 1` calls `max` with a sentinel default and returns a one-element
or empty list; when the input has a length and `n` is at least that length it returns
`sorted(iterable, key=key, reverse=True)[:n]`. A generator has no length, so only the first
shortcut applies to it.

**How would you find the 10 largest values in a file too big for memory?**
Stream it through a generator into `heapq.nlargest(10, ...)`. The file is read once and at most
ten values plus the current line are held. If the question is "the 10 largest across many
files", the same call over `itertools.chain` of the file generators does it in one pass.

---

← Prev: [02b · When a comparison fails](02b-when-a-comparison-fails.md) · [Topic index](README.md) · Next → [03b · Ties, keys and top-N queries](03b-ties-keys-and-top-n-queries.md)
