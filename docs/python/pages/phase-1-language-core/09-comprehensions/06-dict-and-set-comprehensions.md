---
title: "A dict comprehension silently keeps the last value for a duplicate key, which is how a query result loses rows without an error"
sidebar_label: "6 · Dict and set comprehensions"
sidebar_position: 102
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [Dictionary displays](https://docs.python.org/3.14/reference/expressions.html#dictionary-displays),
> [Set displays](https://docs.python.org/3.14/reference/expressions.html#set-displays),
> the Library Reference
> [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict),
> [`collections.defaultdict`](https://docs.python.org/3.14/library/collections.html#collections.defaultdict),
> [`collections.Counter`](https://docs.python.org/3.14/library/collections.html#collections.Counter),
> and [PEP 448](https://peps.python.org/pep-0448/),
> [PEP 572](https://peps.python.org/pep-0572/).
> Target: **CPython 3.14**.

**`{r.email: r for r in rows}` is the most common data-loss bug in Python that
does not raise. The reference is explicit that duplicate keys are not detected
and the last one wins, so a comprehension over 10,000 rows with 300 duplicate
emails produces a dict of 9,700 entries and no indication that anything
happened. Set comprehensions do the same thing to values. This chunk covers the
collision rule, how to detect it, and the three structures — `defaultdict`,
`Counter` and a grouping comprehension — that keep the rows you were about to
throw away.**

## The collision rule, verbatim

> *"Clashes between duplicate keys are not detected; the last value (textually
> rightmost in the display) stored for a given key value prevails."*

For a comprehension "textually rightmost" means "produced last", so the winner is
the last row in iteration order:

```python
rows = [("a", 1), ("a", 2), ("b", 3)]
{k: v for k, v in rows}                  # {'a': 2, 'b': 3} — the 1 is gone
```

The same rule governs a literal display and `**` unpacking:

> *"A double asterisk `**` denotes dictionary unpacking. Its operand must be a
> mapping. Each mapping item is added to the new dictionary. Later values replace
> values already set by earlier dict items and earlier dictionary unpackings."*

So `{**defaults, **overrides}` is right-wins, which is what you want for
configuration merging and is the reason that idiom reads correctly.

## Where it costs you

```python
by_email = {u.email: u for u in load_users()}
```

Three failures live in that line, and none of them raises:

1. **Duplicate emails silently drop users.** If the column has no unique
   constraint — and in most schemas it does not — the dict is smaller than the
   query result and nothing says so.
2. **The survivor is arbitrary from the caller's perspective.** It is the last in
   iteration order, which is the database's row order, which is not stable unless
   the query has an `ORDER BY`.
3. **`None` keys collapse into one entry.** A nullable column produces one
   `None` key holding one row, no matter how many rows had no email.

The assertion that catches all three is one line:

```python
users = load_users()
by_email = {u.email: u for u in users}
assert len(by_email) == len(users), f"{len(users) - len(by_email)} rows lost to duplicate emails"
```

If the equality is not something you can assert, then a dict was the wrong shape
and you wanted a grouping.

## Detecting collisions instead of asserting

`len()` tells you *that* rows were lost, not which. To find them:

```python
from collections import Counter

dupes = [k for k, n in Counter(u.email for u in users).items() if n > 1]
```

Note the generator expression inside `Counter` — `Counter` iterates once, so
there is nothing to materialise. See
[generator expressions](05-generator-expressions.md).

## When the key is not unique, you wanted a grouping

```python
from collections import defaultdict

by_domain = defaultdict(list)
for u in users:
    by_domain[u.email.split("@")[1]].append(u)
```

That loop is the honest form and it is what most "dict comprehension" code should
have been. There is a comprehension version, and it is quadratic:

```python
# O(n²) — scans `users` once per distinct domain
{d: [u for u in users if domain(u) == d] for d in {domain(u) for u in users}}
```

It reads as one line and it is a nested scan. On a thousand users with a hundred
domains that is a hundred thousand comparisons to do what the `defaultdict` loop
does in a thousand. This is a genuine case of
[a comprehension that should have been a loop](08-when-it-should-have-been-a-loop.md).

`itertools.groupby` is the third option and it has a trap of its own: it only
groups *adjacent* equal keys, so the input must be sorted by the same key first.
`sorted` plus `groupby` is `O(n log n)` and correct; `groupby` on unsorted data
is silently wrong in the same way a duplicate key is.

## Building an inverted index

The inversion is where the collision rule bites hardest, because the inverted
mapping is almost never injective:

```python
by_id   = {u.id: u.email for u in users}
by_email = {email: uid for uid, email in by_id.items()}   # loses duplicates
```

If two users share an email, the inverse has one entry. The correct inverse of a
non-injective mapping is a mapping to *sets*:

```python
inverse = defaultdict(set)
for uid, email in by_id.items():
    inverse[email].add(uid)
```

The comprehension form is available and again quadratic. Prefer the loop.

## Gotchas

**★ Symptom — a dict built from query rows has fewer entries than the query
returned, and nothing was logged.** Cause: duplicate keys; the reference says
clashes *"are not detected; the last value […] prevails"*. Fix: assert
`len(result) == len(rows)` if the key is meant to be unique, and group into a
`defaultdict(list)` if it is not.

**★ Symptom — which row survives a duplicate key changes between runs.** Cause:
the last one produced wins, and the production order is the query's row order,
which is undefined without an `ORDER BY`. Fix: order the query explicitly, or
stop using a dict for a non-unique key.

**★ Symptom — a grouping written as a nested dict comprehension is unusably slow
on production data.** Cause: it scans the source once per distinct key, so it is
quadratic. Fix: one pass into a `defaultdict(list)`.

**Symptom — a `None` key holds exactly one row when many rows had a null
column.** Cause: all the `None`s are one key. Fix: filter them out with an `if`
clause and handle them separately — a dict keyed on a nullable column is almost
always a modelling error.

**Symptom — `itertools.groupby` produces multiple groups for the same key.**
Cause: it groups adjacent equal keys only; the input was not sorted by that key.
Fix: `sorted(rows, key=f)` first, or use a `defaultdict`, which does not care
about order.

**Symptom — a dict comprehension whose value calls an expensive function runs it
for keys that are then overwritten.** Cause: the collision is resolved after both
values were computed; there is no lookahead. Fix: deduplicate the source first,
or build the dict in a loop with an `if key not in result` guard when
first-wins is the rule you actually want.

**Symptom — you wanted the *first* value for each duplicate key, not the last.**
Cause: the language gives you last-wins and offers no switch. Fix: reverse the
input — `{k: v for k, v in reversed(rows)}` — or write the loop with an explicit
`setdefault`, which is first-wins by construction.

**Symptom — an inverted index built as a dict comprehension has fewer entries
than the original mapping.** Cause: the original mapping was not injective, so
the inverse collided. Fix: invert into a `defaultdict(set)`; the inverse of a
many-to-one mapping is one-to-many and cannot be a plain dict.

**Symptom — `len()` of the dict matches `len()` of the rows and duplicates were
still lost.** Cause: two different keys collided *and* two other rows were
filtered out by an `if` clause, so the counts coincidentally agree. Fix: assert
against the count of distinct keys — `len(result) == len({r.email for r in
rows})` — not against the row count, when the comprehension also filters.

## Interview questions

**★ Q: What happens when a dict comprehension produces the same key twice?**
The last one wins, silently. The reference says clashes *"are not detected; the
last value (textually rightmost in the display) stored for a given key value
prevails"*. For a comprehension that means the last row in iteration order. There
is no warning and no way to ask for a different policy, so `{r.email: r for r in
rows}` over a non-unique column loses rows and reports nothing.

**★ Q: How do you detect that loss?**
Compare lengths: `len(result) == len(rows)` is the assertion, and it is one line.
To find *which* keys collided, count them — `Counter(r.email for r in rows)` and
filter for counts above one. If the key genuinely is not unique, the answer is
not detection but a different structure: `defaultdict(list)`.

**★ Q: Why is a grouping dict comprehension usually the wrong tool?**
Because expressing "all the items with this key" as a nested comprehension means
re-scanning the source for every distinct key, which is quadratic. A single pass
into a `defaultdict(list)` is linear and shorter than it looks. The comprehension
form only appears better because the loop is three lines instead of one.

**Q: How do you get first-wins instead of last-wins?**
Reverse the input, or write a loop using `setdefault`, which only writes when the
key is absent. There is no dict-comprehension form of first-wins, because the
comprehension inserts unconditionally.

**Q: `groupby` or `defaultdict` for grouping?**
`defaultdict` unless the data is already sorted by the grouping key.
`itertools.groupby` groups only *adjacent* equal keys, so unsorted input silently
produces several groups per key — the same class of silent wrongness as a
duplicate dict key. `sorted` plus `groupby` is correct at `O(n log n)`;
`defaultdict` is correct at `O(n)`.

**Q: Is the survivor of a key collision well defined?**
Yes at the language level — the last value produced — but usually not at the
application level, because "last" depends on the iteration order of the source,
which for a database query without `ORDER BY` is not guaranteed. That is why the
bug is intermittent.

---

← Prev: [One-shot exhaustion](05c-one-shot-exhaustion.md) · Index: [Comprehensions](README.md) · Next → [Merging, fromkeys and hashability](06b-merging-fromkeys-and-hashability.md)
