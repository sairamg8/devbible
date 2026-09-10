---
title: "A step of k takes every k-th element from wherever the walk starts — so a backwards stride picks positions by the length's parity, a computed step can hit the one value the language forbids, and most reversals are better done with no slice at all"
sidebar_label: "02b · Strides and reversal"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations)
> (note 5), [`zip()`](https://docs.python.org/3.14/library/functions.html#zip),
> [`reversed()`](https://docs.python.org/3.14/library/functions.html#reversed),
> [`sequence.reverse()`](https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types)
> and the [Unicode HOWTO](https://docs.python.org/3.14/howto/unicode.html); CPython 3.14
> [`Objects/sliceobject.c`](https://github.com/python/cpython/blob/3.14/Objects/sliceobject.c)
> for the zero-step error text. Documentation-verified — **no sandbox run, no program output**.

**The step is the least-used of the three numbers and the one with the most surprising
arithmetic. A positive stride is simple — every `k`-th element from `start` — and it is the
standard way to de-interleave flat key/value data. A negative stride starts at the *last*
element, so which positions it selects depends on whether the length is odd or even. A step
computed by division can become zero, which the language rejects, or can be rounded the wrong way
and return twice the data you asked for. And the most common use of a negative step — reversing —
usually does not need a slice: `reversed()` walks backwards without copying, and `list.reverse()`
reorders in place.**

## Strides other than ±1

Note (5) defines the positions as `i`, `i+k`, `i+2*k` and so on — starting wherever the walk
starts. With a negative step, [02](02-negative-steps.md) showed that the walk starts at the last
element, so its parity follows the length:

```python
word = "Python"                        # length 6

assert word[::2] == "Pto"              # positions 0, 2, 4
assert word[1::2] == "yhn"             # positions 1, 3, 5
assert word[::-2] == "nhy"             # positions 5, 3, 1 — the odd ones
assert word[::2][::-1] == "otP"        # "the even positions, reversed"

odd_length = "Pythons"                 # length 7
assert odd_length[::-2] == "sotP"      # positions 6, 4, 2, 0 — now the even ones
```

`[::2]` and `[1::2]` are the standard way to split an interleaved flat list — the
`[key, value, key, value]` shape that some wire formats and Redis-style replies use:

```python
reply = ["region", "eu-west", "tier", "gold", "seats", "40"]
settings = dict(zip(reply[::2], reply[1::2]))
assert settings == {"region": "eu-west", "tier": "gold", "seats": "40"}
```

`zip` stops at the shorter input — the documentation: *"By default, `zip()` stops when the
shortest iterable is exhausted. It will ignore the remaining items in the longer iterables"* — so
an odd-length reply silently drops its last key. If the format guarantees pairs, say so; with
`strict=True`, *"it raises a `ValueError` if one iterable is exhausted before the others"*:

```python
def pairs_to_dict(flat):
    return dict(zip(flat[::2], flat[1::2], strict=True))
```

The number of elements a stride selects is the ceiling of the span divided by the step, which is
easy to get wrong by hand; `len(range(*slice(start, stop, step).indices(len(s))))` is exact for
every combination, for the reason [04b](04b-slice-indices.md) gives.

## Step zero

*"Note, k cannot be zero."* CPython raises `ValueError` with the message `slice step cannot be
zero` (from `PySlice_Unpack` in `Objects/sliceobject.c`). A literal zero step is obvious; a
computed one is not — the classic source is down-sampling for a chart, where the step is the
number of points divided by the number wanted, and there are fewer points than wanted. Floor
division has a second flaw: it can return nearly twice the requested number of points.

```python
def downsample(points, max_points):
    """At most max_points evenly spaced points, keeping the first."""
    if max_points < 1:
        raise ValueError("max_points must be at least 1")
    step = max(1, -(-len(points) // max_points))      # ceiling division, never 0
    return points[::step]


assert len(downsample(list(range(199)), 100)) == 100     # floor division would give 199
assert len(downsample(list(range(50)), 100)) == 50       # floor division would give step 0
assert downsample([], 10) == []
```

The ceiling step `ceil(n / m)` guarantees at most `m` points because a stride of `s` over `n`
elements selects `ceil(n / s)` of them; the floor step can be as small as 1 when `n` is just under
`2m`, returning every point.

## Reversing without slicing

`[::-1]` builds a reversed copy, which costs time and memory proportional to the length. Two
alternatives exist, with different contracts:

> *"Return a reverse iterator.  The argument must be an object which has a `__reversed__` method
> or supports the sequence protocol"* — [`reversed()`](https://docs.python.org/3.14/library/functions.html#reversed)

> *"Reverse the items of *sequence* in place. This method maintains economy of space when
> reversing a large sequence.  To remind users that it operates by side-effect, it returns
> `None`."* — [`sequence.reverse()`](https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types)

Use `reversed(s)` to walk backwards, `s.reverse()` to reorder a list you own, and `s[::-1]` when
you need a reversed *value* — a string, a tuple, or a new list. The cost comparison of the three
is in [`list` internals · 05b](../01-list-internals/05b-searching-identity-and-reversing.md).

```python
events = ["login", "view", "purchase", "logout"]

for event in reversed(events):         # no copy; the list is unchanged
    print(event)

newest_first = events[::-1]            # a new list; events is unchanged
events.reverse()                       # events itself is now reversed; returns None
assert events == newest_first
```

Reversal of *text* has a hazard no slice can fix: a `str` is a sequence of code points, and the
documentation's own example of one visible letter written as two is *"'ê' can be represented as a
single code point U+00EA, or as U+0065 U+0302, which is the code point for 'e' followed by a code
point for 'COMBINING CIRCUMFLEX ACCENT'"* ([Unicode HOWTO](https://docs.python.org/3.14/howto/unicode.html)).
Reversing the code points moves the combining mark onto the wrong base letter.

## Gotchas

**Symptom: `samples[::-2]` returns the odd positions for some inputs and the even ones for
others.** Cause: a negative-step walk starts at the last element, so its parity follows the
length. Fix: choose the positions first, then reverse.

```python
evens_reversed = samples[::2][::-1]
odds_reversed = samples[1::2][::-1]
```

**Symptom: `ValueError: slice step cannot be zero` from a chart endpoint, only for short time
ranges.** Cause: `step = len(points) // max_points` is 0 when there are fewer points than
requested. Fix: the ceiling-division `downsample` above — `max(1, -(-len(points) // max_points))`.

**Symptom: the "at most 100 points" chart sometimes gets 199.** Cause: floor division rounds the
step down, and a step of 1 selects everything. Fix: round the step *up*, as `downsample` does, so
`ceil(n / step)` can never exceed the maximum.

**Symptom: a flat Redis-style reply turned into a dict is missing its last field, with no
error.** Cause: an odd number of elements, and `zip` silently stops at the shorter of
`reply[::2]` and `reply[1::2]`. Fix: `strict=True`, which the `zip` documentation recommends
*"in cases where the iterables are assumed to be of equal length"*.

```python
settings = dict(zip(reply[::2], reply[1::2], strict=True))
```

**Symptom: reversing a user's display name moves an accent onto the wrong letter.** Cause: the
accent is a separate combining code point, and reversal puts it after a different base. Fix:
compose to NFC first, which merges pairs that have a precomposed form.

```python
import unicodedata

decomposed = "e\N{COMBINING CIRCUMFLEX ACCENT}te"
assert decomposed[::-1] == "et\N{COMBINING CIRCUMFLEX ACCENT}e"          # accent now on the t
composed = unicodedata.normalize("NFC", decomposed)
assert composed[::-1] == "et\N{LATIN SMALL LETTER E WITH CIRCUMFLEX}"
```

NFC does not help sequences that have no precomposed form (emoji joined with zero-width joiners,
flag pairs); the 3.14 `unicodedata` documentation describes no grapheme segmentation, so reversing
arbitrary user text correctly needs a third-party segmenter or, better, not reversing it.

**★ Symptom: iterating backwards over a large list doubles memory for the duration of the loop.**
Cause: `for row in rows[::-1]` builds a full reversed copy first. Fix: `reversed()` returns an
iterator over the existing list.

```python
for row in reversed(rows):
    process(row)
```

## Interview questions

**★ What do `s[::-1]`, `reversed(s)` and `s.reverse()` cost, and when do you use each?**
`s[::-1]` builds a new reversed sequence of the same type — linear time and a full copy — and is
the only one that works on immutable types to produce a value. `reversed(s)` returns an iterator
over the existing sequence, allocating nothing proportional to its length; use it to loop
backwards. `list.reverse()` reorders the list in place, returns `None`, and is for when you own
the list and want it reversed permanently.

**Why is a step of zero an error rather than an empty slice?**
Because the definition `i + n*k` never advances when `k` is 0, so the slice would either be
infinite or have no meaningful definition; the documentation simply states that *k cannot be
zero*, and CPython raises `ValueError` at unpack time. It shows up in practice through a computed
step — a division that floors to zero — so clamp computed steps with `max(1, ...)`.

**How do you split a flat `[key, value, key, value]` list into a dict, and what can go wrong?**
`dict(zip(flat[::2], flat[1::2]))`: the even positions are keys and the odd positions values. An
odd-length input drops its last key silently because `zip` stops at the shorter argument; pass
`strict=True` to `zip` to turn that into a `ValueError` when the format promises pairs.

**Which positions does `s[::-2]` select?**
It depends on the length. The walk starts at the last element, position `len(s) - 1`, and steps
down by two, so for an even length it selects the odd positions and for an odd length the even
ones. If you mean a fixed parity, select it with a forward stride and then reverse:
`s[::2][::-1]` or `s[1::2][::-1]`.

**How would you down-sample a series to at most `m` points with a slice?**
`s[::step]` with `step = max(1, ceil(len(s) / m))`. The ceiling guarantees the result has at most
`m` elements, because a stride of `step` selects `ceil(len(s) / step)` of them; the `max(1, ...)`
guards the zero step that floor division produces for short series. Integer ceiling division is
`-(-n // m)`, which avoids floating point.

---

← Prev: [02 · Negative steps](02-negative-steps.md) · [Topic index](README.md) · Next → [03 · Out of range never raises](03-out-of-range-never-raises.md)
