---
title: "most_common(n) is a heap selection and most_common() is a full sort, ties fall back to arrival order, and sorted(c) and max(c) look at the keys not the counts — the top-N, per-group and rolling-window tallies a service actually needs, written so the answer is right and deterministic"
sidebar_label: "03b · Counter — top-N and per-group tallies"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`Counter.most_common`](https://docs.python.org/3.14/library/collections.html#collections.Counter.most_common), the Counter common-patterns block, [`heapq.nlargest`](https://docs.python.org/3.14/library/heapq.html#heapq.nlargest), [`collections.deque`](https://docs.python.org/3.14/library/collections.html#deque-objects). `most_common` read from CPython **v3.14.7** [`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/collections/__init__.py) (lines 628–645). Target: **Python 3.14.7**. **No sandbox run, no timings.**

**The reason to count is almost always to rank: the top ten endpoints by errors, the users with the most page views today, the least-used feature flags. `Counter.most_common(n)` is the tool, and its two code paths behave differently: with an `n` it is `heapq.nlargest` — a selection that never sorts the whole counter — and without one it is a full `sorted()`. Ties are broken by the order elements were first seen, which is deterministic for one input and different for the same data arriving in a different order. And two built-ins that look like ranking are not: `sorted(c)` sorts the *keys*, `max(c)` returns the largest *key*. This chunk is the ranking layer — top-N, least-common, per-group, merged across days and rolling over a time window — including the phase gate's "page views per user per day, then the top ten users".**

## `most_common`: two code paths

> *"Return a list of the *n* most common elements and their counts from the most common to the
> least. If *n* is omitted or `None`, `most_common()` returns *all* elements in the counter.
> Elements with equal counts are ordered in the order first encountered"*

The `v3.14.7` body is nine lines:

```python
# Lib/collections/__init__.py, v3.14.7 — Counter.most_common
if n is None:
    return sorted(self.items(), key=_itemgetter(1), reverse=True)

# Lazy import to speedup Python startup time
global heapq
if heapq is None:
    import heapq

return heapq.nlargest(n, self.items(), key=_itemgetter(1))
```

`heapq.nlargest` is documented as *"Equivalent to: `sorted(iterable, key=key, reverse=True)[:n]`"* — same answer, same tie order, without sorting the elements that cannot make the cut. So the rule is simply: **always pass the `n` you want.** `c.most_common()[:10]` sorts everything and throws most of it away; `c.most_common(10)` does not. The list topic's [03d · Partial sorts and counting](../01-list-internals/03d-partial-sorts-and-counting.md) covers when a full sort wins anyway — which is when `n` is close to the number of elements. Topic **07 · `heapq` and `bisect`** *(not written yet)* is the heap itself.

The result is a list of `(element, count)` tuples. For a JSON response, `dict(c.most_common(10))` keeps the ranking order and serialises as an object; the list itself serialises as an array of arrays.

## Ties, and why "first encountered" is not "deterministic"

Tie order is insertion order — which is the order the input arrived in. For a log file read top to bottom that is stable. For counts merged from concurrent workers, from a `set`, or from a query without `ORDER BY`, the same totals can rank differently on every run, and a "top 10" at a boundary of equal counts flickers. When the ranking is shown to users or compared in tests, break ties explicitly:

```python
from collections import Counter
import heapq


def top_n(counts: Counter[str], n: int) -> list[tuple[str, int]]:
    """Highest count first; equal counts in alphabetical order — the same answer every run."""
    return heapq.nsmallest(n, counts.items(), key=lambda kv: (-kv[1], kv[0]))
```

Negating the count turns "largest count" into "smallest key", so one `nsmallest` call orders by count descending and element ascending.

## The least common

The documentation's common-patterns block gives the idiom:

```python
c.most_common()[:-n-1:-1]       # n least common elements
```

— a full sort, then the last `n` reversed. `heapq.nsmallest(n, c.items(), key=itemgetter(1))` is the selection version. Both include zero and negative counts, because those are real entries ([03](03-counter.md)); for "the least-used feature that *was* used", strip them first with `+c`.

## The built-ins that rank keys, not counts

A Counter iterates its keys, so every function that consumes an iterable sees keys:

```python
errors = Counter({"timeout": 12, "dns": 3, "tls": 40})

sorted(errors)                         # ['dns', 'timeout', 'tls'] — alphabetical keys
max(errors)                            # 'tls' — the largest string, which only happens to be the top
max(errors, key=errors.get)            # 'tls' — the most common, by count
sorted(errors, key=errors.get, reverse=True)   # keys ranked by count
```

`max(c, key=c.get)` is the one-pass way to get the single top element without building a list.

## Per-group tallies: `defaultdict(Counter)`

The phase gate — *"count page views per user per day, then the top 10 users"* — is two nested counts and a merge:

```python
from collections import Counter, defaultdict
from datetime import date
from typing import NamedTuple


class PageView(NamedTuple):
    user_id: str
    day: date
    path: str


def views_per_user_per_day(views: list[PageView]) -> dict[date, Counter[str]]:
    per_day: defaultdict[date, Counter[str]] = defaultdict(Counter)
    for view in views:
        per_day[view.day][view.user_id] += 1
    return dict(per_day)


def top_users(per_day: dict[date, Counter[str]], n: int = 10) -> list[tuple[str, int]]:
    overall: Counter[str] = Counter()
    for day_counts in per_day.values():
        overall.update(day_counts)            # adds counts — see 03 for update vs dict.update
    return overall.most_common(n)


def top_users_each_day(per_day: dict[date, Counter[str]], n: int = 10) -> dict[date, list[tuple[str, int]]]:
    return {day: counts.most_common(n) for day, counts in sorted(per_day.items())}
```

No index arithmetic anywhere: `defaultdict(Counter)` creates each day's counter on first sight, `+= 1` inserts each user on first sight, `update` adds a day's counts into the total, and `most_common(n)` ranks.

A flat alternative is one counter keyed by a tuple — `Counter((v.day, v.user_id) for v in views)` — which is fine for lookups and for "the top user-days overall", and awkward for "the top users *within* each day", which is why the nested shape is usually right.

## Merging many counters

Three ways to combine a list of counters, and why the obvious one is wrong:

```python
daily: list[Counter[str]] = load_daily_counts()

total = sum(daily)                     # 🔴 TypeError — sum starts from the int 0, and 0 + Counter is undefined
total = sum(daily, Counter())          # works; builds a new Counter at every step, and drops ≤ 0 counts

total = Counter()
for counts in daily:
    total.update(counts)               # in place, keeps every count including zeros and negatives
```

`sum(..., Counter())` uses the `+` operator, which is multiset addition: each step allocates a fresh result, and the documentation says the output *"will exclude results with counts of zero or less"* ([03c · `Counter` — multiset arithmetic](03c-counter-multiset-math.md)). A loop of `update` is in place and keeps the counts as they are. For positive counts the totals agree; pick `update` unless you want the multiset semantics.

## A rolling window: a deque of per-minute counters

"Errors by type over the last hour, updated every minute" is a bounded deque of per-minute Counters plus one running total — add the new minute, subtract the one that falls out:

```python
from collections import Counter, deque


class RollingCounts:
    """Counts per key over the last `window` buckets (e.g. minutes)."""

    def __init__(self, window: int) -> None:
        self.buckets: deque[Counter[str]] = deque()
        self.window = window
        self.total: Counter[str] = Counter()

    def close_bucket(self, bucket: Counter[str]) -> None:
        self.buckets.append(bucket)
        self.total.update(bucket)
        if len(self.buckets) > self.window:
            expired = self.buckets.popleft()
            self.total.subtract(expired)
            self.total = +self.total        # drop the keys that fell to zero

    def top(self, n: int) -> list[tuple[str, int]]:
        return self.total.most_common(n)
```

`subtract` leaves zero counts behind, so without the `+self.total` a key that has not occurred for an hour stays in `total` forever — present in `len`, in iteration and at the bottom of `most_common()`. The deque is not bounded with `maxlen` here on purpose: a bounded deque discards the oldest bucket silently on `append` ([04b · Bounded deques](04b-bounded-deques.md)), and the total needs to see what was discarded.

## Gotchas

**★ Symptom: a "top errors" report is in alphabetical order.** Cause: `sorted(counter)` sorts the keys — iteration over a Counter yields keys. Fix: rank by count.

```python
ranked = errors.most_common()                            # (key, count), by count
ranked_keys = sorted(errors, key=errors.get, reverse=True)
```

**★ Symptom: `max(errors)` returns an element that is not the most frequent.** Cause: `max` compares the keys. Fix: give it the count as the key.

```python
most_frequent = max(errors, key=errors.get)
```

**★ Symptom: the tenth and eleventh entries of a leaderboard swap between runs with identical totals.** Cause: equal counts are ordered by first appearance, and the input order varies between runs. Fix: break ties on something stable.

```python
leaders = heapq.nsmallest(10, scores.items(), key=lambda kv: (-kv[1], kv[0]))
```

**★ Symptom: `TypeError: unsupported operand type(s) for +: 'int' and 'Counter'` from `sum(daily_counters)`.** Cause: `sum` starts at `0`. Fix: accumulate with `update`, or give `sum` a Counter start (and accept the multiset semantics).

```python
total = Counter()
for counts in daily_counters:
    total.update(counts)
```

**Symptom: the "least used features" list is all zeros.** Cause: features whose counts were decremented to zero, or pre-seeded with zero, are real entries and sort last. Fix: decide whether zero means "unused" (keep) or "absent" (strip).

```python
least_used = (+usage).most_common()[:-6:-1]
```

**Symptom: a top-10 computed every request is the slowest line on a large counter.** Cause: `most_common()` with no argument sorts every element, then the caller slices. Fix: pass `n`, which uses a heap selection.

```python
top = counts.most_common(10)
```

**Symptom: a rolling "last hour" counter still lists keys that have not appeared for hours.** Cause: `subtract` brings expired counts to zero and leaves the keys. Fix: strip non-positive counts after subtracting.

```python
total.subtract(expired)
total = +total
```

**Symptom: an endpoint returns `[["timeout", 12], ["dns", 3]]` and the front end expected an object.** Cause: `most_common` returns a list of tuples, which JSON encodes as nested arrays. Fix: convert, keeping the ranking order.

```python
return {"top_errors": dict(errors.most_common(10))}
```

## Interview questions

**★ How do you get the ten most common items efficiently, and what does it cost?**
`counter.most_common(10)`. With an `n` it calls `heapq.nlargest(n, items, key=count)`, a heap selection over all *m* elements that keeps only *n* candidates — O(*m* log *n*) — while `most_common()` with no argument sorts all *m*. Building the counter in the first place is one pass over the input. When *n* approaches *m*, the full sort is as good; the list topic's partial-sorts chunk has the trade-off.

**★ How does `most_common` break ties, and when is that a problem?**
The documentation: *"Elements with equal counts are ordered in the order first encountered."* Both code paths preserve it — `nlargest` is documented as equivalent to a stable `sorted(...)[:n]`. The problem is that "first encountered" depends on input order, so counts merged from concurrent sources, from a set, or from an unordered query can rank equal counts differently on each run. For anything displayed or tested, sort by `(-count, key)` explicitly.

**★ Why is `max(counter)` usually wrong?**
Because iterating a Counter yields its keys, so `max` compares keys — it returns the alphabetically (or numerically) largest element, not the most frequent. `max(counter, key=counter.get)` compares counts and is a single O(*m*) pass; `counter.most_common(1)[0]` gives the element and its count.

**How would you compute the top users overall from per-day counters?**
Merge, then rank: create an empty `Counter`, `update` it with each day's counter — `update` adds counts in place — and call `most_common(10)`. `sum(days, Counter())` also works but builds a new Counter at each step and drops non-positive counts because it uses multiset `+`; `sum(days)` fails outright because it starts from `0`.

**How do you keep counts over a sliding time window?**
Keep one Counter per time bucket in a deque and a running total. When a bucket closes, append it and `update` the total; when the deque exceeds the window, `popleft` the oldest and `subtract` it from the total, then drop the keys that reached zero with `+total`. Using `deque(maxlen=...)` directly would silently discard the old bucket before you could subtract it.

**Is a `Counter` suitable for counting distinct IP addresses on a busy public endpoint?**
Only if the number of distinct keys is bounded, because a Counter stores one entry per distinct element for as long as it lives — its memory grows with cardinality, not with traffic volume. Pruning it to the current top *k* is not a fix: it discards the counts that would let a late-rising key overtake, so the result is no longer a correct top *k*. The standard library has no approximate counting structure; either bound the key space (bucket by network prefix), reset per interval, or use a purpose-built heavy-hitters structure outside the standard library.

---

← Prev: [03 · `Counter` — counting semantics](03-counter.md) · [Topic index](README.md) · Next → [03c · `Counter` — multiset arithmetic](03c-counter-multiset-math.md)
