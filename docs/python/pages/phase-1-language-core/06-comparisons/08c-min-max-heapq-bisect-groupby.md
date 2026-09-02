---
title: "min, max, heapq, bisect and groupby all take the same key argument, and each one adds a constraint that sorted() does not have"
sidebar_label: "8c · min, max, heapq, bisect, groupby"
sidebar_position: 78
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14
> [`min()`/`max()`](https://docs.python.org/3.14/library/functions.html#min),
> [`heapq`](https://docs.python.org/3.14/library/heapq.html),
> [`bisect`](https://docs.python.org/3.14/library/bisect.html),
> and [`itertools.groupby`](https://docs.python.org/3.14/library/itertools.html#itertools.groupby).
> Version spine: **CPython 3.14**.

**A key function is the common currency of every ordering tool in the standard
library, but four of them attach conditions `sorted()` does not: `min`/`max` need a
`default=` for the empty case, `heapq`'s push and pop take no key at all, `bisect`
applies the key to the array elements and deliberately *not* to the search value, and
`groupby` groups contiguous runs rather than distinct keys — so it is wrong unless you
sorted first with the same key.**

## `min` and `max` take the same key

```python
newest = max(records, key=attrgetter("updated_at"))
cheapest = min(offers, key=lambda o: o.price, default=None)
```

Two documented behaviours worth relying on:

> *"If multiple items are minimal, the function returns the first one encountered. This
> is consistent with other sort-stability preserving tools such as
> `sorted(iterable, key=keyfunc)[0]`"* —
> [`min()`](https://docs.python.org/3.14/library/functions.html#min)

`max()` says the same for maximal items. So `max(xs, key=k)` and
`sorted(xs, key=k, reverse=True)[0]` agree on ties, and both pick the *first*
occurrence.

And `default=` for the empty case, which `sorted(...)[0]` cannot express without a
guard.

## `heapq`

`heapq.nlargest` and `nsmallest` take `key=`. The heap functions themselves
(`heappush`, `heappop`, `heapify`) do **not** — they compare the elements directly
with `<`. That is why the tuple-with-tiebreaker pattern exists:

```python
import heapq, itertools
counter = itertools.count()
heapq.heappush(heap, (priority, next(counter), task))
```

Without the counter, two equal priorities send the comparison to `task`, which may not
be orderable — an error that appears only under the specific data that produces a tie.

For "top n", `heapq.nlargest(n, xs, key=k)` beats `sorted(xs, key=k)[:n]` when n is
small relative to len(xs), and loses when n approaches len(xs).

## `bisect`, and its one sharp edge

> *"key specifies a key function of one argument that is used to extract a comparison
> key from each element in the array. **To support searching complex records, the key
> function is not applied to the x value.**"*
>
> *"Changed in version 3.10: Added the key parameter."* —
> [`bisect`](https://docs.python.org/3.14/library/bisect.html)

The key is applied to the **array elements only**, never to the value you are
searching for. So you pass a already-extracted key as `x`:

```python
by_year = attrgetter("released")
movies[bisect.bisect(movies, 1960, key=by_year)]     # 1960, not Movie(...)
```

Passing a whole record as `x` here silently compares a record against extracted keys,
which is either a `TypeError` or a wrong answer. And `bisect` requires the list to be
sorted *by that same key* already — it does no checking, and an unsorted input
produces a plausible index that is simply wrong.

For `insort_left`/`insort_right` the rule shifts slightly: *"the key function (if any)
is applied to x for the search step but not for the insertion step"* — you pass the
record, it is keyed for the search, and inserted whole.

## `itertools.groupby` needs the sort first

> *"Generally, the iterable needs to already be sorted on the same key function."*
>
> *"It generates a break or new group every time the value of the key function changes
> (which is why it is usually necessary to have sorted the data using the same key
> function). That behavior differs from SQL's GROUP BY which aggregates common elements
> regardless of their input order."*
>
> *"The returned group is itself an iterator that shares the underlying iterable with
> `groupby()`. Because the source is shared, when the `groupby()` object is advanced,
> the previous group is no longer visible. So, if that data is needed later, it should
> be stored as a list."* —
> [`itertools.groupby`](https://docs.python.org/3.14/library/itertools.html#itertools.groupby)

Two independent traps in one function:

```python
rows = sorted(rows, key=keyfunc)                 # 1. sort with the SAME key
for k, g in itertools.groupby(rows, keyfunc):
    process(list(g))                             # 2. materialise before advancing
```

Skipping the sort gives you one group per *run*, not one per distinct key — so a key
that appears in three separate places produces three groups, silently. And holding a
group iterator past the next loop iteration gives you an empty or partial group.

## Gotchas

**★ `max(xs, key=k)` on a possibly-empty sequence raising `ValueError`.** Fix:
`max(xs, key=k, default=None)`. It is keyword-only and easy to forget.

**★ Expecting `max` to return the *last* maximal item.** The docs state it returns the
first one encountered, consistently with `sorted(..., reverse=True)[0]`. Fix: reverse
the input, or sort with an explicit tie-break key, if you need the last.

**★ `heapq.heappush(h, (priority, obj))` raising only under specific data.** Tuple
comparison reaches `obj` only when priorities tie, and `heappush` takes no `key=`. Fix:
a monotonic `next(itertools.count())` in the middle slot.

**★ Passing `key=` to `heapq.heappush` and getting a `TypeError`.** Only
`nlargest`/`nsmallest` accept a key; the heap operations compare elements directly.
Fix: put the key value into the tuple you push.

**★ `sorted(xs, key=k)[:n]` used for a small top-n on a large list.** Sorting is
O(n log n) for an answer that `heapq.nlargest(n, xs, key=k)` gets more cheaply for
small n. Fix: use `nlargest`/`nsmallest` — they take the same `key=`, so the migration
is one word.

**★ `bisect(records, some_record, key=attrgetter("ts"))` giving a wrong index.** The
key is documented as *not* applied to `x`, so you compared a whole record against
extracted timestamps. Fix: pass the extracted value — `bisect(records, ts,
key=attrgetter("ts"))`.

**★ `bisect` on a list that is not sorted by the key.** It does no validation and
returns a confidently wrong insertion point, so a lookup silently misses. Fix: sort by
the same key first, and keep the list sorted with `insort` rather than `append`.

**★ `insort` used with a key and the record inserted in the wrong place.** The rule
differs from `bisect`: the key is applied to `x` for the *search* step but not for the
*insertion* step, so you pass the whole record and it is keyed on the way in. Passing
an extracted key instead inserts the key itself into the list. Fix: read the two
signatures separately; they are not symmetric.

**★ `groupby` producing duplicate groups for the same key.** The input was not sorted
by that key, so each contiguous *run* became its own group. The docs warn that this
differs from SQL's `GROUP BY`. Fix: `sorted(rows, key=keyfunc)` first, with the same
key.

**★ A `groupby` group that is empty by the time you read it.** The group shares the
underlying iterator, so advancing `groupby` discards the previous group. Fix:
`list(g)` inside the loop body, before the next iteration — the docs give exactly this
code.

**★ `{k: g for k, g in groupby(rows, keyfunc)}` producing empty groups.** The dict
comprehension advances `groupby` fully before anything reads the group iterators, so
every stored group is exhausted. Fix: `{k: list(g) for k, g in groupby(...)}`.

**★ `groupby` used where a `defaultdict(list)` was wanted.** If you do not need the
sort and only need aggregation, one pass over a `defaultdict(list)` is simpler, does
not require sorted input, and is O(n) instead of O(n log n). Fix: use `groupby` when
the data is already ordered or the order matters; otherwise use a dict.

## Interview questions

**★ Q: Why does `itertools.groupby` need sorted input?**
Because it starts a new group every time the key value *changes*, like Unix `uniq`,
rather than aggregating across the whole input like SQL's `GROUP BY`. Unsorted input
produces one group per contiguous run, so the same key can yield several groups. The
documentation says the iterable generally needs to already be sorted on the same key
function.

**★ Q: In `bisect(a, x, key=f)`, is `f` applied to `x`?**
No — the docs are explicit that the key function is not applied to the `x` value, so
that you can search complex records with an already-extracted key. `insort` differs:
the key *is* applied to `x` for the search step but not for the insertion step, so
there you pass the whole record.

**★ Q: Why does `groupby` sometimes give you an empty group?**
Because the group is an iterator sharing the underlying source. Once `groupby` is
advanced to the next group, the previous one is no longer visible. Anything that
consumes the `groupby` object before reading the groups — a dict comprehension, a
`list()` of the pairs — leaves you with exhausted iterators. Materialise with
`list(g)` inside the loop.

**Q: `sorted(xs)[:n]` or `heapq.nsmallest(n, xs)`?**
`nsmallest` when n is small relative to the length; sorting when n approaches the
length or you need the whole ordering anyway. Both take the same `key=` argument, so
switching is a one-word change.

**Q: What does `min()` return when several items tie?**
The first one encountered — documented, and deliberately consistent with
`sorted(iterable, key=keyfunc)[0]` and `heapq.nsmallest(1, ...)`. `max()` likewise
returns the first maximal item.

**★ Q: How do you build a priority queue whose payloads are not orderable?**
Push `(priority, next(itertools.count()), payload)`. `heappush`/`heappop` accept no
`key=` and compare elements directly, so the tuple *is* the key; the monotonic counter
guarantees the comparison is decided before it reaches the payload.

**Q: Which `heapq` functions take a `key=`?**
`nlargest` and `nsmallest` only. `heappush`, `heappop`, `heapify`, `heappushpop` and
`heapreplace` compare the elements themselves with `<`.

**Q: When would you use `groupby` rather than a `defaultdict(list)`?**
When the data is already sorted by the key, when you want to stream rather than
materialise everything, or when contiguity itself is the thing you are detecting
(runs, session boundaries, consecutive duplicates). For plain aggregation of unsorted
data, a `defaultdict(list)` is one O(n) pass and needs no sort.

---

← Prev: [Sort keys in practice](08b-sort-keys-in-practice.md) · Index: [Comparisons](README.md) · Next → [`total_ordering` and dataclasses](09-total-ordering-and-dataclasses.md)
