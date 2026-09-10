---
title: "heapq.merge is a lazy k-way merge that holds one pending item per input and trusts every input to be sorted already — stable, O(N log k), able to merge streams that never end, and silently wrong the moment one input is not in order"
sidebar_label: "06 · heapq.merge — k-way merge as a stream"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 [`heapq.merge` documentation](https://docs.python.org/3.14/library/heapq.html#heapq.merge) and CPython **v3.14.7** [`Lib/heapq.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/heapq.py) (lines 330–408) plus `Lib/test/test_heapq.py` (`test_merge`, `test_merge_stability`, `test_merge_does_not_suppress_index_error`). Target: **Python 3.14.7**. **No sandbox run, no timings.**

**Twelve log files, each already in timestamp order; the first page of results from each of eight database shards, each sorted by `created_at`; the sorted runs of an external sort. Combining k sorted inputs into one sorted output does not need a sort — at every step the next output item is the smallest of the k current heads, and a heap of k entries finds it in O(log k). `heapq.merge(*iterables, key=None, reverse=False)` is exactly that, as a generator: it reads one item ahead from each input, never materialises anything, and breaks ties in favour of the earlier input, so it is stable. The price of laziness is trust. `merge` never checks that an input is sorted; one out-of-order line in one file produces output that is out of order from that point on, with no exception. `reverse=True` does not reverse anything either — it requires inputs that are already sorted largest-first.**

## The contract

> *"Merge multiple sorted inputs into a single sorted output (for example, merge timestamped
> entries from multiple log files). Returns an iterator over the sorted values."*

> *"Similar to `sorted(itertools.chain(*iterables))` but returns an iterable, does not pull the
> data into memory all at once, and assumes that each of the input streams is already sorted
> (smallest to largest)."*

> *"Has two optional arguments which must be specified as keyword arguments."*

> *"*reverse* is a boolean value. If set to `True`, then the input elements are merged as if each
> comparison were reversed. To achieve behavior similar to
> `sorted(itertools.chain(*iterables), reverse=True)`, all iterables must be sorted from largest
> to smallest."*

## How it works

The key-less path of the v3.14.7 source, which the keyed path mirrors:

```python
# Lib/heapq.py, v3.14.7 — merge, key is None
h = []
h_append = h.append
# (reverse=True swaps in heapify_max / heappop_max / heapreplace_max and direction = -1)
for order, it in enumerate(map(iter, iterables)):
    try:
        next = it.__next__
        h_append([next(), order * direction, next])
    except StopIteration:
        pass
_heapify(h)
while len(h) > 1:
    try:
        while True:
            value, order, next = s = h[0]
            yield value
            s[0] = next()           # raises StopIteration when exhausted
            _heapreplace(h, s)      # restore heap condition
    except StopIteration:
        _heappop(h)                 # remove empty iterator
if h:
    # fast case when only a single iterator remains
    value, order, next = h[0]
    yield value
    yield from next.__self__
```

Reading it closely gives the whole behaviour:

- **One entry per non-empty input**: `[current_value, input_number, next_function]`. Memory
  is O(k) regardless of how long the inputs are.
- **Each output step** yields the root's value, pulls the next value from *the same input*, and
  sifts it into place with one `heapreplace` — O(log k). N items total cost O(N log k).
- **Ties go to the earlier input.** The input number is the second field, so two equal values
  compare by it and the lower-numbered input's value comes first. CPython's test suite checks
  exactly this (`test_merge_stability`) — the merge is stable.
- **An exhausted input is popped**, and when only one input is left the generator stops using the
  heap and `yield from`s the rest of it directly.
- **With a key**, the entry is `[key(value), order, value, next]` and the key is computed once per
  element as it is read. The elements themselves are never compared — only keys and input
  numbers.
- **With `reverse=True`**, the same loop runs on a max-heap with the input number negated, which
  keeps earlier inputs winning ties.

Nothing in that loop compares a value with the *previous value from the same input*. There is no
check that an input is sorted, and there could not be one without buffering.

## Real merges

Log files, each in timestamp order, merged into one stream without reading any of them into
memory. `ExitStack` closes every file even if the consumer stops early:

```python
import heapq
from collections.abc import Iterator
from contextlib import ExitStack
from datetime import datetime

def parse(line: str) -> tuple[datetime, str]:
    stamp, _, message = line.rstrip("\n").partition(" ")
    return datetime.fromisoformat(stamp), message

def merged_logs(paths: list[str]) -> Iterator[tuple[datetime, str]]:
    with ExitStack() as stack:
        streams = [map(parse, stack.enter_context(open(p, encoding="utf-8"))) for p in paths]
        yield from heapq.merge(*streams)     # tuples compare by datetime first
```

Scatter-gather across shards: each shard returns its newest 50 rows ordered by `created_at`
descending; merging with `reverse=True` and a key gives the global newest 50 with one heap of
`len(shards)` entries:

```python
import heapq
import itertools
from operator import itemgetter

def newest_across_shards(shard_pages: list[list[dict]], limit: int = 50) -> list[dict]:
    # every page is already sorted newest-first: that is what reverse=True requires
    merged = heapq.merge(*shard_pages, key=itemgetter("created_at"), reverse=True)
    return list(itertools.islice(merged, limit))
```

Infinite inputs are fine, because nothing is read before it is needed — merging the future
occurrences of several recurring schedules, for instance, and taking the next ten.

## Merge keeps duplicates

`merge` interleaves; it does not combine. When the same key can appear in several inputs — the
same user in two exports, the same event delivered by two replicas — follow the merge with
`itertools.groupby` on the same key, which works precisely because the merged stream is sorted:

```python
import heapq
import itertools
from operator import itemgetter

def latest_per_user(*exports: list[dict]) -> list[dict]:
    """Each export sorted by user_id; keep the record with the highest version per user."""
    merged = heapq.merge(*exports, key=itemgetter("user_id"))
    return [
        max(records, key=itemgetter("version"))
        for _user_id, records in itertools.groupby(merged, key=itemgetter("user_id"))
    ]
```

## `merge` or `sorted`

For inputs that are already lists in memory, `sorted(a + b)` is a real competitor: Timsort
detects each input as a run and merges runs in C with galloping, which is the subject of
[01 · `list` — merging and galloping](../01-list-internals/07b-merging-and-galloping.md). `merge`
wins when the inputs are streams, when they do not fit in memory together, when k is large, or
when you only want the first few items of the merged order. The documentation makes no speed
claim either way, and neither does this page.

## Gotchas

### One input is not actually sorted
**Symptom.** The merged audit log has a block of entries from one service appearing minutes
late; every individual file "looks sorted".
**Cause.** `merge` only ever compares the current heads. A value that is smaller than its
predecessor in the same input comes out when that input's head reaches it — late — and nothing
reports it.
**Fix.** Validate each input as it streams, and fail loudly:

```python
import heapq
from collections.abc import Iterable, Iterator
from typing import Any

def assert_sorted(items: Iterable[Any], source: str) -> Iterator[Any]:
    previous = None
    for index, item in enumerate(items):
        if index and item < previous:
            raise ValueError(f"{source}: item {index} is out of order")
        previous = item
        yield item

def merged_checked(sources: dict[str, Iterable[Any]]) -> Iterator[Any]:
    return heapq.merge(*(assert_sorted(items, name) for name, items in sources.items()))
```

### `reverse=True` on ascending inputs
**Symptom.** "Newest first" output that is neither newest-first nor oldest-first.
**Cause.** `reverse=True` reverses the comparisons; it requires every input sorted largest to
smallest already.
**Fix.** Ask the sources for descending order (`ORDER BY created_at DESC`), or merge ascending and
reverse the materialised result: `list(heapq.merge(*pages, key=k))[::-1]`.

### Inputs sorted by one key, merged by another
**Symptom.** Correct-looking output for a while, then disorder.
**Cause.** Each input was sorted by `(tenant_id, created_at)` and the merge uses `key=created_at`;
the inputs are not sorted by the merge key.
**Fix.** Merge with the key the inputs are actually sorted by, or re-sort each input by the merge
key first.

### Timestamps merged as strings
**Symptom.** Events stamped `…Z` and `…+00:00`, or with and without fractional seconds, interleave
wrongly.
**Cause.** String comparison is lexicographic; equal instants in different ISO 8601 spellings do
not sort together.
**Fix.** Merge on parsed values: `heapq.merge(*streams, key=lambda e: datetime.fromisoformat(e["ts"]))`
— and make sure every parsed value is timezone-aware, or every one naive, since the two do not
order against each other.

### Stopping early leaves files open
**Symptom.** `ResourceWarning: unclosed file` in tests, or a long-running process that
accumulates open descriptors.
**Cause.** Breaking out of the merged generator suspends it; the input files stay open until the
generator is garbage-collected.
**Fix.** Open inputs in an `ExitStack` inside a generator, as in `merged_logs` above, and close the
merged generator when stopping early (`merged.close()`), or consume it inside the `with`.

### One bad input aborts the whole merge
**Symptom.** A single malformed line in one of twelve files stops the merged report.
**Cause.** An exception raised by any input iterator propagates out of `merge` — the test suite
checks that it is not swallowed — and the generator is finished.
**Fix.** Decide per source what "bad" means, in the input generator, before the merge sees it:

```python
import logging

logger = logging.getLogger("log_merge")

def parsed_lines(path: str) -> Iterator[tuple[datetime, str]]:
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            try:
                yield parse(line)            # parse() from merged_logs above
            except ValueError:
                logger.warning("rejected line in %s: %r", path, line)
```

### Iterating the merge twice
**Symptom.** The second pass over the merged result — a count, a second report — is empty.
**Cause.** `merge` returns a generator.
**Fix.** Materialise once with `list(...)` if it fits, or compute everything in one pass.

## Interview questions

**★ How would you merge k sorted files into one sorted output without loading them?**
Stream each file through a generator and pass them to `heapq.merge`. It keeps one pending line per
file in a heap of k entries, yields the smallest, and replaces it with the next line from the same
file, so memory is O(k) and time O(N log k). The inputs must each be sorted by the key you merge on,
and the files should be opened so they are closed even if the consumer stops early.

**★ Is `heapq.merge` stable, and why?**
Yes. Each heap entry carries the index of the input it came from as its second field, so when two
values are equal the one from the earlier input compares smaller and is yielded first; the same
holds with `reverse=True`, where the index is negated along with the heap direction. CPython's test
suite has a dedicated stability test.

**What happens if one of the inputs to `merge` is not sorted?**
The output is wrong from that point, silently. `merge` only compares the current head of each
input, so an item smaller than its predecessor in the same input is emitted when that input's head
reaches it, after larger items from other inputs. There is no check; validate inputs yourself if
you cannot trust them.

**When would you use `sorted(itertools.chain(...))` instead of `merge`?**
When the inputs are lists that fit in memory and you want the whole result at once. Timsort
recognises each input as a run and merges the runs efficiently in C. `merge` is the choice for
streams, for data larger than memory, for many inputs, or when you only need the first part of
the merged order.

**What does `reverse=True` require of the inputs?**
That each input is already sorted from largest to smallest. It makes the merge compare in reverse;
it does not reverse the inputs or the output.

---

← Prev: [05d · Heaps shared by threads and tasks](05d-heaps-across-threads.md) · [Topic index](README.md) · Next → [07 · `bisect_left` and `bisect_right`](07-bisect-left-and-right.md)
