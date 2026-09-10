---
title: "A slice is two fence posts and a stride — start is in, stop is out, negative numbers count back from the end, and -0 is still 0, which is how 'the last n lines' returns the whole log when n is zero"
sidebar_label: "01 · The three numbers"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations)
> (notes 3, 4, 5 and 8), the data model's
> [Sequences](https://docs.python.org/3.14/reference/datamodel.html#datamodel-sequences),
> [Slicings](https://docs.python.org/3.14/reference/expressions.html#slicings) and the
> [tutorial on strings](https://docs.python.org/3.14/tutorial/introduction.html#text).
> Documentation-verified — **no sandbox run, no program output**; every result on this page is
> written as an `assert` derived from the documented rules.

**`s[start:stop:step]` selects the elements whose positions run from `start`, included, up to
`stop`, excluded, taking every `step`-th one. That half-open interval is not a convention you
memorise; it is what makes `s[:i] + s[i:]` equal `s` for every `i`, what makes the length of a
slice `stop - start`, and what lets two adjacent ranges share a boundary without overlapping.
Negative numbers are positions measured from the end — the language substitutes `len(s) + i` —
and the documentation adds a warning in four words that most readers skim: *"`-0` is still
`0`"*. Every slicing bug with a computed bound traces back to one of those three facts.**

## What the documentation defines

The whole of basic slicing is note (4) of the sequence-operations table:

> *"The slice of *s* from *i* to *j* is defined as the sequence of items with index *k* such that
> `i <= k < j`.*
> *• If *i* is omitted or `None`, use `0`.*
> *• If *j* is omitted or `None`, use `len(s)`.*
> *• If *i* or *j* is less than `-len(s)`, use `0`.*
> *• If *i* or *j* is greater than `len(s)`, use `len(s)`.*
> *• If *i* is greater than or equal to *j*, the slice is empty."* —
> [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations)

Negative positions come from note (3), which applies to indexing and slicing alike:

> *"If *i* or *j* is negative, the index is relative to the end of sequence *s*: `len(s) + i` or
> `len(s) + j` is substituted.  But note that `-0` is still `0`."*

And the language reference states the result type: *"When used as an expression, a slice is a
sequence of the same type."* A slice of a list is a list, of a string a string — even when it has
one element or none. The step, and how it changes the defaults, is note (5) and the subject of
[02 · Negative steps](02-negative-steps.md).

## Fence posts, not elements

The tutorial's picture is the right mental model: the numbers label the gaps *between* elements,
not the elements themselves.

> *"One way to remember how slices work is to think of the indices as pointing *between*
> characters, with the left edge of the first character numbered 0. Then the right edge of the
> last character of a string of *n* characters has index *n*"* —
> [An Informal Introduction to Python](https://docs.python.org/3.14/tutorial/introduction.html#text)

```text
 +---+---+---+---+---+---+
 | P | y | t | h | o | n |
 +---+---+---+---+---+---+
 0   1   2   3   4   5   6
-6  -5  -4  -3  -2  -1
```

*(The tutorial's own diagram, reproduced.)* A slice `s[i:j]` is everything between post `i` and
post `j`. Three consequences follow, and all three are load-bearing in real code:

```python
word = "Python"

# 1. Splitting at any post loses nothing and duplicates nothing.
assert all(word[:i] + word[i:] == word for i in range(-10, 11))

# 2. Between two in-range posts, the length is the difference.
assert len(word[1:3]) == 3 - 1
assert word[0:2] == "Py" and word[2:5] == "tho"

# 3. Every post has an empty slice: an empty slice is a *position*.
assert word[3:3] == ""
```

The first line holds even for `i = 10` or `i = -10`, because out-of-range posts clamp to the ends
(note 4 — [03](03-out-of-range-never-raises.md) is about when that clamping hides a bug). The
third consequence is why slice *assignment* can insert: `items[3:3] = [...]` writes into a
position rather than over an element, which **10** *(not written yet)* builds on.

The tutorial states the design reason in one sentence: *"Note how the start is always included,
and the end always excluded.  This makes sure that `s[:i] + s[i:]` is always equal to `s`"*. The
same half-open rule governs `range(start, stop)`, which is why `range(len(s))` and `s[0:len(s)]`
describe the same positions.

## The syntax is sugar for an object

The colon form is not a special operation the sequence implements; the interpreter packs the
three expressions into a `slice` object and hands it to `__getitem__`:

> *"When a slice is evaluated, the interpreter constructs a `slice` object whose `start`, `stop`
> and `step` attributes, respectively, are the results of the expressions between the colons.
> Any missing expression evaluates to `None`."* —
> [Slicings](https://docs.python.org/3.14/reference/expressions.html#slicings)

So `s[2:]` is `s[slice(2, None, None)]`, `s[:]` and `s[::]` are both `s[slice(None, None, None)]`,
and the grammar insists only that *"a slice must contain at least one colon"*. Everything about
defaults is therefore decided at the moment the sequence interprets `None` — which is why the
defaults can depend on the sign of the step. [04 · `slice` objects](04-slice-objects.md) covers
the object itself; **13** *(not written yet)* covers receiving one in your own class.

## Negative numbers count from the end

```python
word = "Python"

assert word[-1] == "n"            # the last element
assert word[-2:] == "on"          # the last two
assert word[:-1] == "Pytho"       # all but the last
assert word[1:-1] == "ytho"       # strip one from each end
assert word[-len(word)] == "P"    # -len(s) is position 0
```

The substitution is purely arithmetic: `-2` becomes `len(s) - 2`, so a negative bound depends on
the length of the sequence at the moment you slice. For literal constants that is exactly what
you want. For a bound you *computed*, it is a trap with two jaws.

## `-0` is `0`

Zero has no negative form, so the substitution cannot distinguish "zero from the end" from "zero
from the start". The tutorial puts it as *"since -0 is the same as 0, negative indices start from
-1"*. In practice it means the two most common "from the end" idioms invert when the count is
zero:

```python
lines = ["boot", "ready", "request", "error"]
n = 0

assert lines[-n:] == lines        # "the last 0 lines" is every line
assert lines[:-n] == []           # "all but the last 0" is nothing
```

`n` is zero in production more often than anyone expects: a `tail_lines` setting left at its
default, a "strip the trailer records" count of zero for a file format without a trailer, a
retention window computed as `len(history) - keep` that happens to hit zero. The fix is to compute
the start post from the front, and to clamp it, because a count larger than the length would
otherwise go negative and be re-based from the end all over again:

```python
def last(items, n):
    """The last n items: empty for n == 0, everything when n exceeds the length."""
    if n < 0:
        raise ValueError("n must be non-negative")
    return items[max(len(items) - n, 0):]


def all_but_last(items, n):
    """Everything except the last n items."""
    if n < 0:
        raise ValueError("n must be non-negative")
    return items[:max(len(items) - n, 0)]


lines = ["boot", "ready", "request", "error"]
assert last(lines, 0) == []
assert last(lines, 2) == ["request", "error"]
assert last(lines, 10) == lines
assert all_but_last(lines, 0) == lines
assert all_but_last(lines, 1) == ["boot", "ready", "request"]
assert all_but_last(lines, 10) == []

# Why the max(..., 0) is not optional: 4 - 6 is -2, which is re-based to position 2.
assert lines[len(lines) - 6:] == ["request", "error"]     # two items, not four
```

## How long is a slice?

For two non-negative posts inside the sequence, `stop - start`, as the tutorial says: *"For
non-negative indices, the length of a slice is the difference of the indices, if both are within
bounds."* The qualifier is the whole story. Once either bound is out of range, negative, or the
step is not 1, the only reliable length is the one the sequence computes. You can ask for it
without building the slice — `len(range(*slice(start, stop, step).indices(len(s))))` — and
[04b](04b-slice-indices.md) shows why that expression is exact for every case.

## Gotchas

**★ Symptom: "show the last N log lines" returns the entire log when N is configured as 0.**
Cause: `log_lines[-n:]` with `n == 0` is `log_lines[0:]` — note (3): *"`-0` is still `0`"*. Fix:
compute the start from the front and clamp it at zero.

```python
def tail(log_lines, n):
    if n < 0:
        raise ValueError("n must be non-negative")
    return log_lines[max(len(log_lines) - n, 0):]
```

**★ Symptom: stripping "the last n trailer rows" from a batch file deletes every row when the
format has no trailer.** Cause: `rows[:-n]` with `n == 0` is `rows[:0]`, the empty slice. Fix:
the same front-relative, clamped bound.

```python
def strip_trailer(rows, trailer_count):
    return rows[:max(len(rows) - trailer_count, 0)]
```

**★ Symptom: the fix for the two bugs above returns the wrong rows when the count exceeds the
length.** Cause: `rows[len(rows) - n:]` with `n > len(rows)` produces a negative start, which is
re-based from the end instead of meaning "from the beginning". Fix: `max(len(rows) - n, 0)`, as
in both functions above — never the bare subtraction.

**Symptom: a date extracted from an ISO timestamp is missing its last digit.** Cause: the
developer counted the last position *inclusively*; `stamp[0:9]` stops before position 9. Fix:
for a slice starting at 0, `stop` is the length you want.

```python
stamp = "2026-09-10T14:05:00"
assert stamp[0:9] == "2026-09-1"      # the inclusive-thinking bug
assert stamp[:10] == "2026-09-10"     # ten characters: posts 0 to 10
```

**Symptom: a UI label reads "Rows 21–40 of 25".** Cause: the label computed the end as
`start + size`, but the slice clamped silently at the length (note 4), so the page holds five
rows. Fix: describe what the slice returned, not what was asked for.

```python
def describe_page(rows, start, size):
    page = rows[start:start + size]
    if not page:
        return f"No rows after {len(rows)}"
    return f"Rows {start + 1}–{start + len(page)} of {len(rows)}"
```

**Symptom: `if parts[-1:] == "current":` is never true, though the last part is `"current"`.**
Cause: a slice of a list is a list — *"a slice is a sequence of the same type"* — so a
one-element list is being compared with a string. (The same test on a *string* works, because a
string slice is a string.) Fix: compare like with like, or index.

```python
parts = ["srv", "app", "releases", "current"]
assert parts[-1:] == ["current"]
assert parts and parts[-1] == "current"
```

## Interview questions

**★ Why does Python exclude the stop position from a slice?**
Because the positions are fence posts between elements, and the half-open rule makes the
arithmetic close. `s[:i] + s[i:]` reassembles `s` exactly for every `i`, so splitting at a
boundary never loses or duplicates an element; the length of an in-range slice is `stop - start`
with no `+ 1`; adjacent ranges `s[a:b]` and `s[b:c]` share the boundary `b` without overlapping;
and an empty slice `s[i:i]` exists at every position, which is what makes insertion by slice
assignment possible. `range` uses the same convention, so positions from `range(a, b)` and the
slice `s[a:b]` agree.

**★ What does `items[-n:]` return when `n` is 0, and how do you write it correctly?**
Every item. Note (3) of the sequence table substitutes `len(s) + i` for a negative `i`, and `-0`
is `0`, so `items[-0:]` is `items[0:]`. The correct form counts from the front and clamps:
`items[max(len(items) - n, 0):]`. The clamp matters too, because without it an `n` larger than
the length produces a negative start that is re-based from the end and returns too few items.

**What does `s[a:b:c]` actually pass to the object being sliced?**
A `slice` object, `slice(a, b, c)`, as the argument of `__getitem__`; any omitted part becomes
`None`, so `s[2:]` passes `slice(2, None, None)`. The sequence decides what `None` means, which is
how the defaults for `start` and `stop` can depend on the sign of the step. There is no separate
slicing method on the object — `__getslice__` was removed in Python 3.

**What is the difference between `s[-1]` and `s[-1:]`?**
`s[-1]` is an element and raises `IndexError` on an empty sequence. `s[-1:]` is a sequence of the
same type as `s`, holding at most one element, and on an empty sequence it is simply empty. That
makes `line[-1:] == "\n"` a safe test on a string that might be empty, and makes
`parts[-1:] == "x"` a permanent `False` on a list, because a list never equals a string.

**How do you know the length of a slice without building it?**
For non-negative bounds inside the sequence and a step of 1, it is `stop - start`. In every other
case — out-of-range or negative bounds, other steps — ask the `slice` object:
`len(range(*slice(start, stop, step).indices(len(s))))`. `indices()` applies exactly the clamping
rules the sequence uses and returns arguments that `range` interprets the same way.

**Why is the "indices point between elements" picture better than "indices name elements"?**
Because it makes every rule a counting fact instead of an exception to remember. The stop is
excluded because it is the post after the last selected element. `s[i:i]` is empty because a post
has nothing between it and itself. `len(s)` is a valid slice bound but not a valid index, because
there is a post after the last element but no element after it. Negative numbers are just the
same posts labelled from the right, which is why `-len(s)` is post 0.

---

← Prev: [Topic index](README.md) · Next → [02 · Negative steps](02-negative-steps.md)
