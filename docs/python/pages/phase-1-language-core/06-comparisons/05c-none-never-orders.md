---
title: "One None in a column is enough to make sorted() raise, and every fix is a decision about where nulls belong in the order"
sidebar_label: "5c · `None` never orders"
sidebar_position: 72
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 language reference
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons),
> [What's New In Python 3.0 — Ordering Comparisons](https://github.com/python/cpython/blob/3.14/Doc/whatsnew/3.0.rst),
> [`sorted()`](https://docs.python.org/3.14/library/functions.html#sorted),
> [`min()`/`max()`](https://docs.python.org/3.14/library/functions.html#min),
> and the [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html).
> Version spine: **CPython 3.14**.

**`None` supports equality and nothing else. `None == None` is `True`, `None < None`
raises `TypeError`, and `None < 5` raises `TypeError` — which means one missing value
in ten thousand rows is enough to take down a sort that has worked for a year. The
crash is not the problem; the fix is, because "sort with nulls in it" is not a
technical question. It is a product question about whether missing data goes first,
goes last, or is not sorted at all, and Python makes you answer it where SQL and
pandas quietly answer it for you.**

## The rule

`None` is a singleton of `NoneType`, which defines `__eq__` (by identity, inherited)
and no ordering methods at all. So:

```python
None == None      # True
None is None      # True
None != 5         # True
None < None       # TypeError: '<' not supported between instances of
                  #            'NoneType' and 'NoneType'
None < 5          # TypeError
5 < None          # TypeError
```

The 3.0 release notes name this case explicitly: *"expressions like `1 < ''`, `0 >
None` or `len <= len` are no longer valid, and e.g. `None < None` raises `TypeError`
instead of returning `False`."* In Python 2, `None` sorted before everything, which
is why so much ported code assumed a null-first ordering that no longer exists.

## Where it bites

```python
rows = [
    {"name": "ada",   "score": 91},
    {"name": "grace", "score": None},     # opted out
    {"name": "linus", "score": 74},
]
sorted(rows, key=lambda r: r["score"])
# TypeError: '<' not supported between instances of 'NoneType' and 'int'
```

The characteristic shape of this failure:

- It appears **in production, not in tests**, because the fixture data has no nulls.
- It appears **on one particular day**, when the first null-bearing row arrives.
- The traceback points at `sorted()` in your code and at a `<` you never wrote.
- Retrying does not help, and neither does a bigger machine.

The same applies to `min()`, `max()`, `heapq.nsmallest`, `bisect.insort`,
`list.sort()`, `sorted()` inside `itertools.groupby` preprocessing, and any
`operator.attrgetter` key over an optional field.

## The four fixes, and what each one decides

**1 · Nulls last** — the usual choice for "worst" or "unknown", and the default in
most SQL dialects for `ORDER BY ... DESC`:

```python
sorted(rows, key=lambda r: (r["score"] is None, r["score"]))
# TypeError-free: False (0) sorts before True (1), so non-nulls come first;
# within the null group the second element is always None, compared only
# against other Nones... which never happens, because tuple comparison
# stops as soon as the first elements differ, and when they are equal
# (both True) it does compare None to None — with `==`, which is fine —
# and then, if equal, moves on. Ordering of two Nones is never requested
# because they compare equal at that position.
```

The mechanism is worth being precise about: tuple comparison walks element-wise using
`==` first and only calls `<` on the first *unequal* pair. Two `None`s at position 1
are equal, so no ordering comparison of `None` against `None` ever happens. That is
why this idiom is safe rather than merely lucky.

**2 · Nulls first**:

```python
sorted(rows, key=lambda r: (r["score"] is not None, r["score"]))
```

**3 · Substitute a value** — only when the domain has a defensible one:

```python
sorted(rows, key=lambda r: r["score"] if r["score"] is not None else -1)
sorted(rows, key=lambda r: r["score"] or 0)         # 🔴 WRONG: 0 is falsy,
                                                    # so a real score of 0 is also
                                                    # replaced. Use `is not None`.
sorted(rows, key=lambda r: r["score"] if r["score"] is not None else math.inf)
```

`float("inf")` and `-math.inf` are the honest sentinels for "sorts last" and "sorts
first" in a numeric column, because they compare correctly against every finite float
and every int. `-1` is a bug the moment negative scores are legal. And `or 0` is the
classic falsy trap: it also rewrites `0`, `0.0`, `""` and `False`.

**4 · Partition and do not sort them together**:

```python
scored  = [r for r in rows if r["score"] is not None]
unscored = [r for r in rows if r["score"] is None]
result = sorted(scored, key=lambda r: r["score"]) + unscored
```

More code, and the only version where a reader can see the decision without knowing
the tuple trick. It is also the only one that lets you render the two groups
differently.

## `reverse=True` does not reverse the null group the way you expect

```python
sorted(rows, key=lambda r: (r["score"] is None, r["score"]), reverse=True)
```

`reverse=True` reverses the *whole* comparison, including the `is None` partition —
so nulls move to the **front**. If you want "descending scores, nulls still last",
reverse only the value:

```python
sorted(rows, key=lambda r: (r["score"] is None, -r["score"] if r["score"] is not None else 0))
```

or sort ascending and reverse the non-null part explicitly. This interaction is the
most common follow-up bug after the first fix lands. See
[08](08-sorting.md) for `reverse=` versus negating a key in general.

## `min` and `max` have a cleaner escape

They take a `key=` too, and also a `default=`:

> *"The `key` argument specifies a one-argument ordering function like that used for
> `list.sort()`. The `default` argument specifies an object to return if the provided
> iterable is empty. If the iterable is empty and `default` is not provided, a
> `ValueError` is raised."* —
> [`min()`](https://docs.python.org/3.14/library/functions.html#min)

`default=` solves the *empty* case, not the *null* case. For nulls, filter:

```python
scores = [r["score"] for r in rows if r["score"] is not None]
best = max(scores, default=None)        # None when everything was null
```

That composition — filter the nulls, then `default=None` for the empty result — is
the idiom, and it makes "no data at all" and "no non-null data" produce the same
answer deliberately rather than by accident.

## The SQL contrast: `NULL` is not `None`

This is worth holding side by side, because the same data goes through both.

| | Python `None` | SQL `NULL` |
|---|---|---|
| `x == x` | `True` (`None == None`) | `UNKNOWN` — `NULL = NULL` is not true |
| `x IS x` | `True` | `NULL IS NULL` is `TRUE` |
| `x < y` | `TypeError` | `UNKNOWN` |
| in `ORDER BY` | raises | sorts, position dialect-defined |
| in `WHERE` | n/a | a row with `UNKNOWN` is not returned |
| `x != 5` | `True` | `UNKNOWN` — the row is filtered out |

SQL uses **three-valued logic**: every comparison involving `NULL` yields `UNKNOWN`,
and `WHERE` keeps only rows where the predicate is `TRUE`. So `WHERE score != 100`
silently drops every row whose score is `NULL` — the row is neither returned by that
query nor by `WHERE score = 100`. Python has no `UNKNOWN`; it has `True`, `False` and
an exception.

Two practical consequences when data crosses the boundary:

- A filter written in Python (`[r for r in rows if r["score"] != 100]`) **keeps** the
  null rows. The same filter pushed down to SQL **drops** them. Moving a predicate
  between the two changes the result set, silently.
- `ORDER BY` sorts nulls without complaint — PostgreSQL puts them last for `ASC` by
  default and offers `NULLS FIRST` / `NULLS LAST`; other engines differ. Pull the same
  rows into Python and sort them there and you get a `TypeError`. The database was
  making a decision on your behalf that Python insists you make yourself.

pandas is a third system again: it uses `NaN`/`NaT`/`pd.NA` for missing values, and
`sort_values` takes `na_position="first"|"last"`, defaulting to `"last"`. `pd.NA`
propagates like SQL's `UNKNOWN` (`pd.NA == pd.NA` is `pd.NA`), while `np.nan` follows
IEEE 754 (`nan != nan`). Three missing-value models in one pipeline is normal, and
each has its own comparison rules.

## Gotchas

**★ `TypeError: '<' not supported between instances of 'NoneType' and 'int'` from a
`sorted()` that has worked for months.** The first row with a null in that column just
arrived. Fix: a partitioning key — `key=lambda r: (r["x"] is None, r["x"])` for nulls
last — and decide deliberately which end they belong at.

**★ `key=lambda r: r["x"] or 0` also rewriting real zeros.** `or` tests truthiness,
and `0`, `0.0`, `""`, `[]` and `False` are all falsy. Fix: `r["x"] if r["x"] is not
None else 0`.

**★ Nulls jumping to the front when you added `reverse=True`.** `reverse=True`
reverses the entire key, including the `is None` flag. Fix: negate only the value
component, or sort ascending and reverse the non-null slice yourself.

**★ `min(scores)` raising on a column that is mostly populated.** One `None` is
enough; `min` uses the same `<`. Fix: filter first, then `min(..., default=None)` so
the all-null and empty cases are both handled.

**★ A Python filter and its SQL equivalent returning different row counts.** `x != 5`
in Python is `True` for `None`; `x <> 5` in SQL is `UNKNOWN` for `NULL`, and `WHERE`
drops it. Fix: write the SQL predicate as `(x <> 5 OR x IS NULL)` when you mean the
Python semantics, and test the boundary case explicitly.

**★ Ordering that changes when a query moves from the database to the application.**
`ORDER BY` places nulls per the engine's rule; Python raises. Fix: pin it in SQL with
`NULLS LAST` and mirror it in the Python key, so the two agree by construction rather
than by luck.

**★ `sorted(rows, key=attrgetter("closed_at"))` on optional timestamps.** Same bug,
harder to see because `attrgetter` hides the field. Fix: a lambda with the null
partition, or a model-level default of `datetime.max` if the domain allows one.

**★ A `None` sneaking into a tuple key and only exploding on ties.** `key=lambda r:
(r["dept"], r["hired_at"])` sorts fine until two rows share a department and one has
`hired_at = None`. Fix: null-guard every element of a composite key, not just the
first.

**★ Assuming `None` sorts first because "it did in Python 2".** It does not sort at
all now; the 3.0 notes changed `None < None` from `False` to `TypeError`. Fix: stop
porting the assumption and write the partition explicitly.

**★ `pd.NA` and `np.nan` in the same DataFrame behaving differently under
comparison.** `np.nan != np.nan` is `True` (IEEE 754); `pd.NA == pd.NA` is `pd.NA`
(three-valued). Fix: normalise the missing-value representation on ingest, and use
`.isna()` rather than `==` for the test.

## Interview questions

**★ Q: What happens if you `sorted()` a list of dicts on a field that is sometimes
`None`?**
`TypeError: '<' not supported between instances of 'NoneType' and ...`. `None` has no
ordering methods and Python 3 removed the arbitrary cross-type ordering that used to
place it first. The error appears inside `sorted()`, at a `<` you did not write, on
the first day real data contains a null.

**★ Q: Give the idiomatic fix for "sort with nulls last".**
`sorted(rows, key=lambda r: (r["x"] is None, r["x"]))`. `False` is `0` and `True` is
`1`, so non-nulls sort first; and because tuple comparison only reaches the second
element when the first elements are *equal*, the second element for two nulls is
compared with `==` and never with `<`. That is why the idiom cannot raise.

**★ Q: Why is `key=lambda r: r["x"] or 0` wrong?**
`or` returns the right operand whenever the left is *falsy*, not whenever it is
`None`. A genuine `0`, `0.0`, `""`, `[]` or `False` is rewritten too, so real zeros
sort as if they were missing. Use an explicit `is not None` test.

**★ Q: How does SQL's `NULL` differ from Python's `None` in comparisons?**
SQL uses three-valued logic: any comparison with `NULL` yields `UNKNOWN`, `NULL =
NULL` is not `TRUE`, and `WHERE` keeps only `TRUE` rows — so `WHERE x <> 5` silently
drops nulls. Python has no third value: `None == None` is `True`, and ordering raises
`TypeError`. Moving a predicate between the two layers changes the result set.

**Q: What does `reverse=True` do to a null-partitioning key?**
It reverses the whole comparison, including the `is None` flag, so nulls move to the
front. To keep nulls last while sorting descending, negate only the value component
of the key, or sort ascending and reverse the non-null part.

**Q: How do you take the maximum of a column that may be entirely null?**
Filter the nulls out and use `default=`:
`max((v for v in values if v is not None), default=None)`. `default=` handles the
empty iterable — including the case where everything was null — and returns your
chosen "no answer" value instead of raising `ValueError`.

**Q: Why does pandas not have this problem?**
Because it decided for you: `sort_values` takes `na_position`, defaulting to
`"last"`. It uses `NaN`/`NaT`/`pd.NA` rather than `None` for missing values, and
those have their own comparison semantics — `np.nan != np.nan` per IEEE 754, `pd.NA`
propagating like SQL's `UNKNOWN`. Convenient, and a third set of rules to keep
straight.

**Q: A sort worked in staging and crashed in production. What is your first
hypothesis?**
A null in a sort key. It is the highest-prior-probability cause: fixtures rarely
contain nulls, the failure is data-dependent rather than load-dependent, and the
traceback names a comparison the application code does not contain.

---

← Prev: [Text, sequences, time and enums](05b-text-sequences-time-and-enums.md) · Index: [Comparisons](README.md) · Next → [NaN and the comparison protocol](06-nan-and-the-protocol.md)
