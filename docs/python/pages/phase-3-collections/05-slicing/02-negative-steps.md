---
title: "A negative step flips which ends the defaults point at, and the omitted stop becomes a position no number can spell — which is why s[::-1] reverses everything, s[-1:0:-1] silently loses the first element, and a computed backwards slice goes empty at zero"
sidebar_label: "02 · Negative steps"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations)
> (note 5); and CPython 3.14
> [`Objects/sliceobject.c`](https://github.com/python/cpython/blob/3.14/Objects/sliceobject.c)
> (`PySlice_Unpack`, `PySlice_AdjustIndices`) for the mechanism the documentation summarises as
> "end values". Documentation-verified — **no sandbox run, no program output**.

**With a positive step, an omitted `start` means "the beginning" and an omitted `stop` means "the
end". With a negative step the documentation says only that they *"become "end" values (which
end depends on the sign of k)"* — and the implementation shows what that hides: the omitted stop
of a backwards slice is a position *before index 0*, which no integer you can write denotes,
because every negative integer is re-based from the end. That single asymmetry explains why
`s[::-1]` reaches the first element, why `s[-1:0:-1]` does not, why `s[3:-1:-1]` is empty, and
why a helper that reverses "from `i` down to `lo`" works for every `lo` except zero.**

## What the documentation says

Note (5) of the sequence table:

> *"The slice of *s* from *i* to *j* with step *k* is defined as the sequence of items with index
> `x = i + n*k` such that `0 <= n < (j-i)/k`.  In other words, the indices are `i`, `i+k`,
> `i+2*k`, `i+3*k` and so on, stopping when *j* is reached (but never including *j*).  When *k*
> is positive, *i* and *j* are reduced to `len(s)` if they are greater. When *k* is negative, *i*
> and *j* are reduced to `len(s) - 1` if they are greater.  If *i* or *j* are omitted or `None`,
> they become "end" values (which end depends on the sign of *k*).  Note, *k* cannot be zero. If
> *k* is `None`, it is treated like `1`."* —
> [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations)

Two rules carry over unchanged from positive steps: `start` is included and `stop` is excluded.
With a negative step, "excluded" means the walk stops *before reaching* `stop` coming from above,
so `stop` is the post on the low side.

## What "end values" are, in CPython 3.14

`PySlice_Unpack` turns `None` into sentinels chosen by the sign of the step, and
`PySlice_AdjustIndices` clamps them against the length:

```c
/* PySlice_Unpack — defaults */
if (r->start == Py_None) {
    *start = *step < 0 ? PY_SSIZE_T_MAX : 0;
}
if (r->stop == Py_None) {
    *stop = *step < 0 ? PY_SSIZE_T_MIN : PY_SSIZE_T_MAX;
}

/* PySlice_AdjustIndices — the same treatment for start and stop */
if (*stop < 0) {
    *stop += length;
    if (*stop < 0) {
        *stop = (step < 0) ? -1 : 0;
    }
}
else if (*stop >= length) {
    *stop = (step < 0) ? length - 1 : length;
}
```

Read the negative-step branch. An omitted start becomes `PY_SSIZE_T_MAX`, clamped to `length - 1`
— the last element. An omitted stop becomes `PY_SSIZE_T_MIN`, which is still negative after
adding the length, so it is set to **-1: an internal "before index 0"**. You cannot pass that -1
yourself: a `-1` you write is re-based to `length - 1` before any of this happens. The only ways
to reach it are to omit the stop, pass `None`, or pass something below `-len(s)`, which the clamp
turns into the same sentinel. This is an implementation detail of CPython's arithmetic, but it is
the exact reading of the documented "end value" rule, and every behaviour below follows from it.

## `s[::-1]`, and the slices that look like it

```python
word = "Python"                        # positions 0..5

assert word[::-1] == "nohtyP"          # both ends are "end values"
assert word[-1:0:-1] == "nohty"        # stop 0 is excluded: the P is lost
assert word[5:2:-1] == "noh"           # 5, 4, 3 — start in, stop out
assert word[3::-1] == "htyP"           # omitted stop: down to and including 0
assert word[3:-1:-1] == ""             # -1 means position 5, which is above 3
assert word[3:-7:-1] == "htyP"         # below -len(s): clamped to "before 0"
assert word[3:None:-1] == "htyP"       # None is the readable spelling
```

`word[5:2:-1]` is worth reading twice: it is *not* `word[2:5]` reversed (that would be `"hty"`).
The start is still the included post and the stop the excluded one; only the direction changed.
If what you mean is "this range, backwards", say that — `word[2:5][::-1]` — and pay for two
copies, or use `reversed(range(2, 5))` for the positions.

## Computed bounds going backwards

The sentinel matters the moment a bound is arithmetic. Reversing the span `seq[start:stop]` in
one slice is `seq[stop - 1:start - 1:-1]`, and it is correct — until `start` is 0, where
`start - 1` is `-1`, which means "the last element", and the result is empty. Patching that with
`None` fixes one edge and exposes the other: when the span is empty and `stop` is 0, `stop - 1` is
also `-1`, now used as a *start*, and the "empty" span returns the whole sequence reversed.

```python
def reversed_span_one_slice(seq, start, stop):
    """Looks right. Wrong at start == 0, and wrong again after the obvious patch."""
    return seq[stop - 1:start - 1:-1]


def reversed_span(seq, start, stop):
    """seq[start:stop] in reverse order."""
    if not 0 <= start <= stop <= len(seq):
        raise ValueError("need 0 <= start <= stop <= len(seq)")
    return seq[start:stop][::-1]


word = "Python"
assert reversed_span_one_slice(word, 1, 4) == "hty"      # fine away from zero
assert reversed_span_one_slice(word, 0, 3) == ""          # bug: should be "tyP"
assert reversed_span(word, 0, 3) == "tyP"
assert reversed_span(word, 0, 0) == ""
```

The two-step version copies twice, and it is still the right default: it has no edge cases, and a
reversed span is rarely the hot loop. When it is, iterate `reversed(range(start, stop))` and index,
which copies nothing. Strides other than ±1, the forbidden step of zero, and reversing without a
slice at all are [02b](02b-strides-and-reversal.md).

## Gotchas

**★ Symptom: a "reverse everything except the header" loop never processes the first record.**
Cause: `rows[-1:0:-1]` excludes position 0 — the stop is always excluded, and a stop of `0` is
position 0. (If the intent really is "all but the first, reversed", that slice is right; the bug
is using it for "all, reversed".) Fix: omit the stop.

```python
rows = ["r0", "r1", "r2"]
assert rows[::-1] == ["r2", "r1", "r0"]
assert rows[:0:-1] == ["r2", "r1"]          # all but the first, reversed — say it this way
```

**★ Symptom: a helper that reverses `seq[lo:hi]` returns an empty result whenever `lo` is 0.**
Cause: `seq[hi - 1:lo - 1:-1]` turns `lo - 1` into `-1`, which is re-based to the last position.
Patching the stop with `None` then breaks empty spans at `hi == 0`. Fix: two slices, or indices.

```python
def reversed_span(seq, lo, hi):
    return seq[lo:hi][::-1]

def reversed_positions(lo, hi):
    return reversed(range(lo, hi))
```

**★ Symptom: "the newest k events, newest first" shows the entire history when k is 0.**
Cause: `events[-k:][::-1]` inherits the `-0` trap of [01](01-the-three-numbers.md) — `events[-0:]`
is every event. Fix: a front-relative, clamped start before reversing.

```python
def newest_first(events, k):
    if k < 0:
        raise ValueError("k must be non-negative")
    return events[max(len(events) - k, 0):][::-1]
```

**Symptom: a backwards walk "from the cursor down to the start of the line" stops one short or
returns nothing when the cursor is at column 0.** Cause: the same sentinel — the walk was written
`line[cursor:-1:-1]` or `line[cursor:start - 1:-1]`, and a stop of `-1` means the last column.
Fix: express "down to and including 0" as an omitted stop.

```python
def back_to_line_start(line, cursor):
    """Characters from cursor back to column 0, nearest first."""
    if not 0 <= cursor < len(line):
        raise ValueError("cursor outside the line")
    return line[cursor::-1]
```

## Interview questions

**★ Why can't you write the stop of `s[::-1]` as a number?**
Because the stop it needs is the post *before* index 0, and every negative number you can write is
re-based from the end: `-1` means `len(s) - 1`. CPython represents the omitted stop of a
backwards slice internally as -1 after clamping, which is only reachable by omitting the stop,
passing `None`, or passing something below `-len(s)`. The practical consequence is for computed
bounds: a backwards slice whose stop is computed as `lo - 1` works for every `lo` except 0, so
either pass `None` there or reverse a forward slice instead.

**★ What does `s[5:2:-1]` select, and is it `s[2:5]` reversed?**
Positions 5, 4 and 3. The start is included and the stop excluded, exactly as with a positive
step; only the direction of the walk changes. `s[2:5]` reversed is positions 4, 3, 2 — you would
write it `s[2:5][::-1]` or `s[4:1:-1]`.

**What are the defaults for `start` and `stop` when the step is negative?**
The documentation calls them "end" values whose end depends on the sign of the step: an omitted
start means the last element, and an omitted stop means "past the first element", so the walk
includes position 0. With a positive step they are the first element and the length.

**Why does `s[3:-7:-1]` reach position 0 on a six-element sequence when `s[3:-1:-1]` is empty?**
Both stops are re-based by adding the length. `-1` becomes 5, which lies above the start of 3, so
a downward walk from 3 has nowhere to go and the slice is empty. `-7` becomes -1, still negative,
and a negative stop that survives re-basing is clamped to the "before index 0" sentinel for a
negative step — so the walk runs 3, 2, 1, 0. Any stop below `-len(s)` behaves like an omitted
stop; `None` says the same thing readably.

---

← Prev: [01 · The three numbers](01-the-three-numbers.md) · [Topic index](README.md) · Next → [02b · Strides and reversal](02b-strides-and-reversal.md)
