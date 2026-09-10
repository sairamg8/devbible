---
title: "enumerate, zip, divmod, partition and items all hand you tuples, and the safe way to consume each one differs — partition never raises, split always might"
sidebar_label: "6b · Unpacking library results"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 built-ins
> [`enumerate`](https://docs.python.org/3.14/library/functions.html#enumerate),
> [`zip`](https://docs.python.org/3.14/library/functions.html#zip) and
> [`divmod`](https://docs.python.org/3.14/library/functions.html#divmod);
> [`str.partition`](https://docs.python.org/3.14/library/stdtypes.html#str.partition),
> [`str.split`](https://docs.python.org/3.14/library/stdtypes.html#str.split) and
> [`dict.items`](https://docs.python.org/3.14/library/stdtypes.html#dict.items);
> [`os.path.splitext`](https://docs.python.org/3.14/library/os.path.html#os.path.splitext);
> and the [glossary entry for *named tuple*](https://docs.python.org/3.14/glossary.html#term-named-tuple).
> Documentation-verified — **no sandbox run**. Version spine: **CPython 3.14**.

**Most tuples in a Python program are not written by you — they are returned by the
standard library, which uses a tuple wherever a function has more than one result. Each of
those APIs has a documented arity, and the difference between a *fixed* arity and a
*data-dependent* one decides whether unpacking it is safe. `str.partition` is documented to
return three items always; `str.split` returns as many as the input contains. One of those
is safe to unpack into three names and one is a `ValueError` waiting for a malformed line.**

## The standard library hands you tuples constantly

Unpacking is the intended way to consume them:

```python
for index, page in enumerate(pages, start=1):        # enumerate yields 2-tuples
    ...
for name, count in zip(names, counts):               # zip yields tuples
    ...
pages, remainder = divmod(total_items, per_page)     # divmod returns a pair
head, sep, tail = "key=value".partition("=")         # partition returns a 3-tuple
```

The docs for each say so: `enumerate` *"returns a tuple containing a count … and the values
obtained from iterating over iterable"*; `zip` *"returns an iterator of tuples, where the
i-th tuple contains the i-th element from each of the argument iterables"*; `divmod`
returns *"a pair of numbers consisting of their quotient and remainder"*; `str.partition`
returns *"a 3-tuple containing the part before the separator, the separator itself, and the
part after the separator"*.

⚠️ `str.partition` **always** returns three items, even when the separator is absent —
*"If the separator is not found, return a 3-tuple containing the string itself, followed by
two empty strings."* That is what makes it unpack-safe where `split("=")` is not.

## `_` is a convention, not a keyword

```python
_, region, _ = record          # only region is wanted
name, _, _ = parse_row(row)
```

`_` is an ordinary name and the last assignment wins, so `_` after the first line holds the
*last* discarded value, not all of them. Nothing in the language treats it specially — the
convention exists so a reader knows the value is deliberately unused, and so linters can
stop reporting it. For discarding a variable number of items, see `*_` in
[6c · Starred unpacking](06c-starred-unpacking.md).

## When to unpack and when not to

Unpack when the arity is **fixed and small** and the names are meaningful at the call site:

```python
host, port = parse_addr(addr)          # good: two, named, obvious
```

Do not unpack when the arity is drifting or the names stop meaning anything:

```python
name, email, tier, region, created, active = load_user(uid)   # unreadable, fragile
user = load_user(uid)                                          # give it a type instead
```

That boundary is the subject of
[7 · Multiple return values](07-multiple-return-values.md).

## Fixed arity versus data-dependent arity

This is the distinction that decides whether a direct unpack is safe:

| Call | Arity | Safe to unpack? |
|---|---|---|
| `divmod(a, b)` | always 2 | ✅ |
| `s.partition(sep)` | always 3 | ✅ |
| `os.path.splitext(p)` | always 2 | ✅ |
| `enumerate(it)` | always 2 per item | ✅ |
| `zip(a, b)` | always *n* per item, *n* = number of iterables | ✅ |
| `s.split(sep)` | depends on the input | ❌ unless bounded with `maxsplit` |
| `s.rsplit(sep, 1)` | at most 2 | ✅ with the bound |
| `dict.items()` | always 2 per item | ✅ |

`os.path.splitext` is the one people forget is in this family:

> *"Split the pathname *path* into a pair `(root, ext)` such that `root + ext == path`"* —
> [`os.path.splitext`](https://docs.python.org/3.14/library/os.path.html#os.path.splitext)

```python
root, ext = os.path.splitext(filename)     # always two, even with no dot
```

## Some of these are named tuples, and you can use the names

Several library results are `namedtuple`-like, which means the same object supports both
positional unpacking and attribute access:

> *"Several built-in types are named tuples, including the values returned by
> `time.localtime` and `os.stat`."* —
> [glossary — *named tuple*](https://docs.python.org/3.14/glossary.html#term-named-tuple)

```python
import os

st = os.stat(path)
size = st.st_size            # by name — self-documenting
mode, ino, dev, *_ = st      # by position — legal, and much worse to read
```

🔴 **When the result has names, use them.** Positional unpacking of a 10-field `stat_result`
is correct, compiles, and is unreadable. This is the same argument that
[7 · Multiple return values](07-multiple-return-values.md) makes about your own functions.

## Gotchas

**Symptom: unpacking a `dict` gave you the keys, not the items.** Cause: iterating a dict
yields keys; unpacking is iteration. Fix: name what you want.

```python
for key, value in config.items():      # not `for key, value in config:`
    ...
```

**Symptom: `head, tail = line.split("=")` raises for a line with two `=` signs.** Cause:
`split` returns as many parts as there are separators. Fix: bound the split, or use
`partition`, which is documented to always return three items.

```python
head, tail = line.split("=", 1)         # at most two parts
head, sep, tail = line.partition("=")   # always three, even with no separator
```

**Symptom: `_` held the wrong value when reused twice in one statement.** Cause: `_` is an
ordinary name and the later assignment overwrites the earlier one. Fix: if you need two
discarded values, that is fine — just do not read `_` afterwards expecting either of them.

**Symptom: `for i, item in enumerate(items)` produced an off-by-one against a report that
counts from 1.** Cause: `enumerate` starts at 0 by default. Fix: it takes a `start`
argument — the docs describe it as *"a count (from *start* which defaults to 0)"*.

```python
for line_no, line in enumerate(lines, start=1):
    ...
```

**Symptom: `zip` silently produced fewer pairs than either input had.** Cause: `zip` stops
at the shortest input by default, so a length mismatch is invisible. Fix: pass
`strict=True` so an unequal length raises instead — the mechanics of that flag belong to
**Phase 3 · 09 — Iteration idioms** *(not written yet)*.

```python
for name, count in zip(names, counts, strict=True):
    ...
```

**Symptom: positional unpacking of `os.stat()` bound the wrong fields after a refactor.**
Cause: the result is a named tuple with ten-plus fields, and position is not a stable
interface for a reader. Fix: use the attribute names.

```python
st = os.stat(path)
if st.st_size > limit:
    ...
```

## Interview questions

**★ What does `for key, value in some_dict:` do?**
It raises, usually `ValueError: too many values to unpack` — iterating a dict yields keys,
and unpacking a key that is not a 2-element iterable fails. If the keys happen to be
2-tuples it will "work" and bind the two halves of each key, which is worse. The intended
form is `for key, value in some_dict.items():`, because `items()` is documented to return a
view of *"`(key, value)` pairs"*.

**Is `_` special in Python?**
Not as an assignment target. It is an ordinary identifier, bound like any other, and the
last assignment in a statement wins — so `a, _, _ = t` leaves `_` holding `t[2]`, not both
discarded values. The convention signals intent to readers and linters. (In the interactive
interpreter `_` additionally holds the last result, and in `match` statements `_` *is* a
real wildcard pattern that binds nothing — two different, unrelated meanings.)

**Why does `str.partition` unpack more safely than `str.split`?**
Because its arity is fixed by contract. The docs say it returns a 3-tuple and that *"if the
separator is not found, return a 3-tuple containing the string itself, followed by two empty
strings"* — so `head, sep, tail = s.partition("=")` cannot raise regardless of the input.
`split` returns however many parts the input contains, so a 3-target unpack of it is a
`ValueError` waiting for the first malformed line.

**★ How do you decide whether a library result is safe to unpack directly?**
Ask whether the arity is fixed by contract or determined by the data. `divmod`,
`str.partition` and `os.path.splitext` document a fixed shape, so unpacking them can never
raise. `str.split` returns however many parts the separator produced, so unpacking it into
a fixed number of names is a `ValueError` waiting for the first unusual input — bound it
with `maxsplit`, or switch to `partition`, whose contract is three items regardless.

**Why prefer `st.st_size` over unpacking `os.stat()` positionally?**
Because the result is a named tuple — the glossary lists `os.stat` among the built-in named
tuples — so the names are already there and cost nothing. Positional unpacking of a
ten-field record forces the reader to count commas to find out what field four is, and it
breaks silently if a future version of the record reorders or extends the positional part.
Names are the interface; positions are an implementation detail that happens to be
observable.

**What does `enumerate(items, start=1)` change?**
Only the count, not the iteration — the docs describe the yielded tuple as *"a count (from
*start* which defaults to 0) and the values obtained from iterating over iterable"*. It is
the correct way to produce 1-based line numbers or row numbers for a human-facing report,
and it removes the `i + 1` that otherwise appears in the format string and gets forgotten
in one branch.

---

← [Packing and unpacking](06-packing-and-unpacking.md) · [Topic index](README.md) · Next → [Starred unpacking](06c-starred-unpacking.md)
