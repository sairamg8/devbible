---
title: "Stability decides where ties go, and it sends them wherever the input put them — so a reproducible sort needs a total order, and every tie-sensitive consumer, from `max` to `groupby` to a pagination cursor, inherits the input's order"
sidebar_label: "08b · Ties, DSU and determinism"
sidebar_position: 20
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the
> [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html) — *Decorate-Sort-Undecorate*
> and *Strategies For Unorderable Types and Values*,
> [`min`](https://docs.python.org/3.14/library/functions.html#min) /
> [`max`](https://docs.python.org/3.14/library/functions.html#max),
> [`itertools.groupby`](https://docs.python.org/3.14/library/itertools.html#itertools.groupby),
> and [Mapping types — `dict`](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict).
> Documentation-validated; **no sandbox run** — the only outputs shown are the HOWTO's
> own doctests, quoted. Target: **Python 3.14** (3.14.7).

**[08](08-stability-and-multi-key-sorts.md) used stability as a tool. This chunk is
about the thing stability actually controls: the order of elements the key says are
equal. The rule is simple — ties come out in input order — and everything
interesting follows from where the input order came from. From a `dict`, it is
insertion order, guaranteed. From a `set`, a parallel fan-in or an unordered query, it
is noise, and a perfectly stable sort faithfully reproduces the noise. The fix is
always the same: make the key a *total* order by ending it with something unique. And
the tools downstream of a sort — `max`, `min`, `groupby`, top-N, cursors — all resolve
ties by position, so they inherit whatever the sort left behind.**

## Stability is not determinism

Stability promises that ties keep their *input* order. It says nothing about what
that input order was. If it came from a `set`, from `concurrent.futures.as_completed`,
from a database query with no `ORDER BY`, or from merging results of parallel
workers, the tie order in your output changes from run to run while every individual
sort is perfectly stable. The HOWTO's own warning about sets:

> *"This is needed because the elements contained in set types do not have a
> deterministic order. For example, list(\{'a', 'b'\}) may produce either ['a', 'b'] or
> ['b', 'a']."*

When output must be reproducible — snapshot tests, diffs, cache keys, cursor
pagination — end every sort key with something unique:

```python
report.sort(key=lambda r: (r.region, -r.revenue, r.account_id))   # total order
```

## Where input order *is* defined: `dict`

> *"Dictionaries preserve insertion order. Note that updating a key does not affect
> the order. Keys added after deletion are inserted at the end."*

> *"Changed in version 3.7: Dictionary order is guaranteed to be insertion order."*

So sorting a dict's items by value is deterministic, and ties are in insertion order —
not because of anything the sort does, but because the input order is defined:

```python
votes = {"alice": 3, "bob": 5, "carol": 3}
ranking = sorted(votes.items(), key=lambda kv: kv[1], reverse=True)
# bob first; alice before carol, because alice was inserted first
```

Note the second sentence of the quote: updating `votes["alice"]` later does *not* move
alice, but deleting and re-adding her does — which silently changes the tie order in
every ranking computed afterwards.

## Tools that resolve ties by position

**`min` and `max`** — the first one encountered:

> *"If multiple items are minimal, the function returns the first one encountered.
> This is consistent with other sort-stability preserving tools such as
> sorted(iterable, key=keyfunc)[0] and heapq.nsmallest(1, iterable, key=keyfunc)."*

**`itertools.groupby`** — groups only *consecutive* equal keys:

> *"Make an iterator that returns consecutive keys and groups from the iterable. …
> Generally, the iterable needs to already be sorted on the same key function."*

Sort then group is the standard pairing, and stability is what keeps each group's
members in their original order:

```python
from itertools import groupby
from operator import attrgetter

events.sort(key=attrgetter("day"))                 # stable: time order kept inside a day
for day, todays in groupby(events, key=attrgetter("day")):
    first, *rest = todays                          # first = earliest event of that day
```

Sort on a *different* key than you group on and `groupby` quietly produces a group per
run of equal keys, which can mean the same day appearing several times.

## Decorate-Sort-Undecorate: stability by construction

Before `key=` existed, the idiom was to wrap each item in a tuple, sort the tuples,
and unwrap. The HOWTO keeps it because of one detail — the index:

```python
>>> decorated = [(student.grade, i, student) for i, student in enumerate(student_objects)]
>>> decorated.sort()
>>> [student for grade, i, student in decorated]               # undecorate
[('john', 'A', 15), ('jane', 'B', 12), ('dave', 'B', 10)]
```

> *"It is not strictly necessary in all cases to include the index i in the decorated
> list, but including it gives two benefits: The sort is stable … The original items do
> not have to be comparable because the ordering of the decorated tuples will be
> determined by at most the first two items. So for example the original list could
> contain complex numbers which cannot be sorted directly."*

> *"Now that Python sorting provides key-functions, this technique is not often
> needed."*

It is still the right tool in one case: when you need the keys *afterwards* — to
display the score next to each row, or to group by it — and computing them twice is
expensive:

```python
scored = [(risk_score(acct), i, acct) for i, acct in enumerate(accounts)]
scored.sort(reverse=True)            # reverse=True here would flip index ties…
```

…which is the trap in that last line: with `reverse=True` on a decorated list, the
index is reversed too, so equal scores come out in *reverse* input order. Negate the
score instead and keep the index ascending:

```python
scored = [(-risk_score(acct), i, acct) for i, acct in enumerate(accounts)]
scored.sort()                        # highest risk first; ties in input order
report = [(-neg, acct) for neg, _, acct in scored]
```

## Gotchas

**★ Symptom: a snapshot test of a sorted report flakes, with rows of equal score
swapping places.** Cause: the input order came from a `set` or a parallel fan-in, and
stability faithfully preserved that nondeterminism. Fix: add a unique final key:

```python
rows.sort(key=lambda r: (-r.score, r.id))
```

**★ Symptom: page two of a sorted listing repeats a row from page one and skips
another.** Cause: the list was re-sorted per request on a non-unique key, from inputs
whose order differed between requests; the page boundary fell inside a block of ties.
Fix: sort — and build the cursor — on a total order:

```python
page = sorted(rows, key=lambda r: (r.created_at, r.id))
cursor = (page[-1].created_at, page[-1].id)
```

**Symptom: rows bucketed with a coarse key are not ordered by score inside each
bucket.** Cause: `key=lambda r: r.score // 10` makes every row in a bucket *equal*, and
stability then keeps them in input order, not score order. Fix: say what you want
inside the bucket:

```python
rows.sort(key=lambda r: (r.score // 10, -r.score))
```

**Symptom: `max(events, key=ts)` picks the *first* of several simultaneous events when
the code wanted the latest-arrived.** Cause: documented — *"If multiple items are
maximal, the function returns the first one encountered."* Fix: scan from the other
end, or put arrival position into the key:

```python
latest = max(reversed(events), key=lambda e: e.ts)                 # last of the ties
latest = max(enumerate(events), key=lambda p: (p[1].ts, p[0]))[1]  # explicit
```

**Symptom: case-insensitive sorting puts `"apple"` before `"Apple"` in one run and
after it in another.** Cause: under `key=str.casefold` the two are equal, so their
order is whatever the input order was. Fix: add the original as a tiebreaker:

```python
names.sort(key=lambda s: (s.casefold(), s))
```

**Symptom: `groupby` yields the same key twice.** Cause: the data was sorted on a
different key — or not at all — and `groupby` only merges *consecutive* equal keys.
Fix: sort on exactly the grouping key first:

```python
key = attrgetter("customer_id")
orders.sort(key=key)
per_customer = {cid: list(grp) for cid, grp in groupby(orders, key=key)}
```

**Symptom: after an admin "renames" a user by deleting and re-adding their entry, that
user drops to the bottom of every tie in the leaderboard.** Cause: *"Keys added after
deletion are inserted at the end"* — the dict's insertion order changed, and stable
sorts over `d.items()` carry it forward. Fix: do not let a dict's incidental order
break ties; use an explicit field:

```python
board = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))   # ties by name
```

**Symptom: a decorated list sorted with `reverse=True` puts equal-scored rows in
reverse input order.** Cause: the index inside each tuple is reversed along with the
score. Fix: negate the numeric part and sort ascending, as shown above:

```python
decorated = [(-score(x), i, x) for i, x in enumerate(items)]
decorated.sort()
```

## Interview questions

**★ Why is a stable sort not enough to make output deterministic?**
Stability fixes tie order *relative to the input*. If the input order varies — a set,
concurrent completions, an unordered query — the output's tie order varies with it.
Deterministic output needs a total order: end the key with a unique field.

**What does DSU buy that a `key=` function does not, and why include the index?**
Today, mainly that the computed keys are still available afterwards. Historically it
was how you sorted by a derived value at all. The index serves two purposes the HOWTO
names: it makes the sort stable regardless of the algorithm, and it guarantees that
comparison never reaches the original items — so items that cannot be compared, like
complex numbers, can still be sorted.

**`max(rows, key=score)` with a tie — which row comes back?**
The first one encountered, by documentation, consistent with
`sorted(rows, key=score, reverse=True)[0]`. To get the last, scan `reversed(rows)` or
add the position to the key.

**You sort a dict's items by value. Is the order of equal values defined?**
Yes. Dict iteration order is insertion order — guaranteed since 3.7 — and the sort is
stable, so equal values appear in the order their keys were first inserted. Updating a
value leaves the key's position alone; deleting and re-inserting moves it to the end,
which changes tie order in every later sort.

**Why does `groupby` need sorted input, and what does stability add?**
`groupby` only merges consecutive elements with equal keys, so equal keys must be
adjacent — which sorting by the same key guarantees. Stability adds that within each
group, elements keep their original relative order, so "the first element of each
group" means the earliest one in the input, not an arbitrary one.

**A decorated list is sorted with `reverse=True`. What happens to the index
tiebreaker?**
It is reversed with everything else, so equal primary keys come out in reverse input
order — the index is now breaking ties the wrong way. Negate the primary key and sort
ascending, so the index keeps its natural direction.

---

← [Stability and multi-key sorts](08-stability-and-multi-key-sorts.md) · [Topic index](README.md) · Next → [Key functions, comparisons and `cmp_to_key`](09-key-functions-and-cmp-to-key.md)
