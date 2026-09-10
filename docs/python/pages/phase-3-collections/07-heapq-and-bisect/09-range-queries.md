---
title: "A range query on sorted data is two bisects — the left one for the lower bound, and the left or right one for the upper bound depending on whether the end is inclusive — and half-open windows are the convention that stops adjacent ranges double-counting the boundary"
sidebar_label: "09 · Range queries on sorted data"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 [`bisect` documentation](https://docs.python.org/3.14/library/bisect.html) (the partition statements for [`bisect_left`](https://docs.python.org/3.14/library/bisect.html#bisect.bisect_left) and [`bisect_right`](https://docs.python.org/3.14/library/bisect.html#bisect.bisect_right), [Performance Notes](https://docs.python.org/3.14/library/bisect.html#performance-notes)) and [time complexity — `list`](https://docs.python.org/3.14/library/time-complexity.html#list) (get slice). Target: **Python 3.14.7**. **No sandbox run, no timings.**

**The documentation's first performance note is the reason this module exists in a service: *"Bisection is effective for searching ranges of values. For locating specific values, dictionaries are more performant."* A dict cannot answer "how many orders between 09:00 and 10:00", "which readings fall inside this window", or "what is the nearest sample to this timestamp"; a sorted list with two bisects answers each in O(log n), plus O(k) if you want the k items themselves. The whole technique is choosing the right side for each bound. The lower bound is always `bisect_left` — the first element not below it. The upper bound is `bisect_left` for an exclusive end and `bisect_right` for an inclusive one. Get that wrong and the error is exactly the boundary values: counted twice across adjacent windows, or not at all.**

## Two bisects make a range

From the documented partitions, for a list sorted ascending:

- `bisect_left(a, lo)` is the first index whose element is `>= lo`;
- `bisect_left(a, hi)` is the first index whose element is `>= hi`, so everything before it is `< hi`;
- `bisect_right(a, hi)` is the first index whose element is `> hi`, so everything before it is `<= hi`.

| Range | Start index | End index |
|---|---|---|
| `lo <= v < hi` (half-open) | `bisect_left(a, lo)` | `bisect_left(a, hi)` |
| `lo <= v <= hi` (closed) | `bisect_left(a, lo)` | `bisect_right(a, hi)` |
| `lo < v <= hi` | `bisect_right(a, lo)` | `bisect_right(a, hi)` |
| `lo < v < hi` (open) | `bisect_right(a, lo)` | `bisect_left(a, hi)` |

The count is `end - start` — never negative for a sorted list and `lo <= hi` — and the items are
`a[start:end]`. The count costs two binary searches. The slice costs O(end − start) because it
copies the references; iterate `range(start, end)` or `itertools.islice(a, start, end)` if you do
not need a list.

```python
from bisect import bisect_left, bisect_right

response_ms = sorted([12, 48, 50, 50, 51, 120, 250, 250, 300, 1200])

slow = len(response_ms) - bisect_right(response_ms, 250)            # > 250 ms: 2
in_sla = bisect_right(response_ms, 50) - bisect_left(response_ms, 0) # 0..50 ms inclusive: 4
band = response_ms[bisect_left(response_ms, 50):bisect_left(response_ms, 250)]  # [50, 250)
```

## Time windows: half-open, always

Timestamps are the common case, and they make the boundary question concrete: an order placed at
exactly 10:00:00 belongs to the 10:00 window or the 09:00 window, never both. Half-open windows —
`[start, end)` — give every instant exactly one window, and consecutive windows share a boundary
without sharing an element:

```python
from bisect import bisect_left
from datetime import datetime, timedelta, timezone

class OrderTimeline:
    """Order timestamps kept sorted; counts per half-open window in O(log n)."""

    def __init__(self, placed_at: list[datetime]) -> None:
        self._t = sorted(placed_at)                   # all timezone-aware

    def count_between(self, start: datetime, end: datetime) -> int:
        return bisect_left(self._t, end) - bisect_left(self._t, start)

    def hourly_counts(self, day_start: datetime) -> list[int]:
        edges = [day_start + timedelta(hours=h) for h in range(25)]
        idx = [bisect_left(self._t, e) for e in edges]  # 25 searches, not a scan per hour
        return [idx[h + 1] - idx[h] for h in range(24)]

timeline = OrderTimeline([datetime(2026, 9, 10, 9, 59, 59, tzinfo=timezone.utc),
                          datetime(2026, 9, 10, 10, 0, 0, tzinfo=timezone.utc)])
```

`hourly_counts` computes each boundary once and subtracts neighbours, so the 25 edges partition
the day with no gaps and no overlaps. The same pattern gives histogram buckets, per-minute rates
and any other "group a sorted series into consecutive ranges" question.

## Nearest value

`bisect_left(a, x)` lands between the two candidates — the last element below `x` and the first
at or above it. The nearest is whichever of those two is closer, and either may not exist:

```python
from bisect import bisect_left
from datetime import datetime

def nearest_sample(sample_times: list[datetime], at: datetime) -> datetime:
    """sample_times sorted and non-empty; ties go to the earlier sample."""
    i = bisect_left(sample_times, at)
    if i == 0:
        return sample_times[0]
    if i == len(sample_times):
        return sample_times[-1]
    before, after = sample_times[i - 1], sample_times[i]
    return before if at - before <= after - at else after
```

This is how a metrics service aligns an event to the closest scrape, or how a pricing service picks
the exchange-rate sample nearest to a transaction time. "The latest value at or before `t`" — the
rate that was in force — is the documentation's `find_le` recipe instead:
[07](07-bisect-left-and-right.md).

## Composite keys: ranges within a group

When the list holds `(group, value)` tuples sorted as tuples, a range within one group is still two
bisects, with tuple bounds. A shorter tuple sorts before every longer tuple it is a prefix of, so
`(tenant,)` is the lower bound of the whole group ([02 · `tuple` — sort keys](../02-tuple/09b-sort-keys-and-priority-queues.md)):

```python
from bisect import bisect_left

def tenant_range(keys: list[tuple[str, int]], tenant: str, lo: int, hi: int) -> list[tuple[str, int]]:
    """keys sorted; returns (tenant, v) with lo <= v < hi."""
    return keys[bisect_left(keys, (tenant, lo)):bisect_left(keys, (tenant, hi))]
```

## When the range lives in a database

Everything above assumes the sorted list is already in memory. If it is a table, the same two
bounds are a `WHERE placed_at >= %s AND placed_at < %s` on a B-tree index, which is a range scan of
exactly the matching rows — and it stays correct while other processes insert
([PostgreSQL — B-tree indexes](../../../../postgresql/pages/phase-10-indexes/02-btree.md)). Keep the
in-memory version for data that is already in the process: a cache refreshed periodically, a file
loaded at start-up, results merged from several services.

## Gotchas

**★ Symptom: orders placed exactly on the hour are counted in two hourly buckets (or in neither).**
Cause: windows computed as closed ranges `[start, end]` with `bisect_right` for the end, so each
boundary value falls in both neighbours — or open ranges so it falls in none. Fix: half-open
windows, `bisect_left` for both bounds, one computed edge per boundary (`hourly_counts` above).

**★ Symptom: "requests up to and including 250 ms" misses the requests that took exactly 250 ms.**
Cause: `bisect_left(a, 250)` for an inclusive upper bound; it stops before the equal run. Fix:
`bisect_right(a, 250)` for `<=`, `bisect_left` for `<`.

**Symptom: `TypeError: can't compare offset-naive and offset-aware datetimes` from a range query.**
Cause: the list or the bounds mix naive and aware datetimes, which do not order against each other.
Fix: normalise once at ingestion — every timestamp aware, in UTC:

```python
from datetime import timezone

placed_at = sorted(t if t.tzinfo else t.replace(tzinfo=timezone.utc) for t in raw_times)
```

**Symptom: nearest-sample lookups are off by one interval.** Cause: returning `a[bisect_left(a, x)]`
— the first sample *at or after* `x` — as "nearest", ignoring the one before. Fix: compare both
neighbours, and handle the two ends, as `nearest_sample` does.

**Symptom: a per-window count over a large list is slow although it "uses bisect".** Cause: the
code slices `a[i:j]` and takes `len()` of the slice, copying every element in the window. Fix:
`j - i`.

**Symptom: range results are wrong after new data was appended to the cached list.** Cause: the
list is no longer sorted; bisect assumes it is. Fix: insert with `insort`, or append and re-sort
before the next query ([08](08-insort-and-sorted-list-cost.md)).

## Interview questions

**★ How do you count the values in `[lo, hi]` of a sorted list in O(log n)?**
`bisect_right(a, hi) - bisect_left(a, lo)`. `bisect_left(a, lo)` is the first index whose value is
at least `lo`; `bisect_right(a, hi)` is the first index whose value is greater than `hi`; the values
between those indices are exactly the ones in range. For a half-open `[lo, hi)`, use `bisect_left`
for both.

**★ Why are half-open intervals the default for time windows?**
Because consecutive half-open windows partition the timeline: every instant belongs to exactly one
window, the end of one window is the start of the next, and window lengths add up. Closed windows
double-count values that sit exactly on a boundary; open windows lose them.

**How do you find the value nearest to `x` in a sorted list?**
Take `i = bisect_left(a, x)`; the candidates are `a[i - 1]` and `a[i]`, when they exist. Return the
closer one, with an explicit rule for ties. Handle `i == 0` and `i == len(a)` separately.

**When should a range query not be done with `bisect` at all?**
When the data lives in a database or is shared between processes — a B-tree index answers the same
two-bound query without shipping the rows — and when the question is an exact lookup, which the
documentation points out a dictionary does better.

---

← Prev: [08 · `insort` and the cost of keeping a list sorted](08-insort-and-sorted-list-cost.md) · [Topic index](README.md) · Next → [09b · Breakpoint tables and lookup rings](09b-breakpoint-tables-and-rings.md)
