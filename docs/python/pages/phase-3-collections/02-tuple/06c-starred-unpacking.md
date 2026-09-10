---
title: "`first, *rest = seq` gives you a list, not a tuple — a decision the PEP argued explicitly, and the reason `*a, = x` and `a = *x,` produce different types from the same characters"
sidebar_label: "6c · Starred unpacking"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against [PEP 3132 — Extended Iterable Unpacking](https://peps.python.org/pep-3132/)
> and [PEP 448 — Additional Unpacking Generalizations](https://peps.python.org/pep-0448/);
> the Python 3.14 language reference on
> [Assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements)
> and [Expression lists](https://docs.python.org/3.14/reference/expressions.html#expression-lists);
> [`collections.deque`](https://docs.python.org/3.14/library/collections.html#collections.deque);
> and CPython 3.14 [`Python/ceval.c`](https://github.com/python/cpython/blob/3.14/Python/ceval.c)
> for the error text. Documentation-verified — **no sandbox run**.
> Version spine: **CPython 3.14**.

**A starred target soaks up "everything else", and the single fact worth memorising is
that what it soaks up is a **list** — even when the right-hand side was a tuple, even when
every other target got a tuple element. PEP 3132 considered making it a tuple and rejected
that on the record. The consequence shows up immediately: `first, *rest = t` gives you a
mutable, unhashable `rest` that cannot go back into a set or a dict key without conversion.**

## The syntax and the rule

> *"If the target list contains one target prefixed with an asterisk, called a "starred"
> target: The object must be an iterable with at least as many items as there are targets in
> the target list, minus one.  The first items of the iterable are assigned, from left to
> right, to the targets before the starred target.  The final items of the iterable are
> assigned to the targets after the starred target.  **A list of the remaining items in the
> iterable is then assigned to the starred target (the list can be empty).**"* —
> [Assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements)

```python
header, *body, footer = read_lines(path)     # body is a LIST, possibly empty
first, *rest = ("a", "b", "c")               # first == "a"; rest == ["b", "c"]
*init, last = versions                       # star may be in any position
only, *nothing = ("solo",)                   # nothing == []  — legal, empty is fine
```

**At most one star**, anywhere in the target list. Two stars is a `SyntaxError`, because
the split point would be ambiguous.

PEP 3132's rationale is the head/tail idiom:

> *"Many algorithms require splitting a sequence in a "first, rest" pair.  With the new
> syntax, `first, rest = seq[0], seq[1:]` is replaced by the cleaner and probably more
> efficient: `first, *rest = seq`"* — [PEP 3132](https://peps.python.org/pep-3132/)

## Why `rest` is a list and not a tuple

This was argued and settled. From PEP 3132's *Acceptance* section, listing the changes that
were **rejected**:

> *"Make the starred target a tuple instead of a list.  This would be consistent with a
> function's `*args`, but make further processing of the result harder."*

So the inconsistency with `*args` is deliberate: the assignment form optimises for
"you are about to keep working with this", the parameter form optimises for
"this is an immutable snapshot of the call". The parameter side is
[6d · Stars in displays, loops, patterns and calls](06d-stars-beyond-assignment.md).

🔴 **The practical consequence** is that a starred target cannot go straight back into
anything that needs hashability:

```python
first, *rest = key_parts
cache[first, rest]          # TypeError: unhashable type: 'list'
cache[first, tuple(rest)]   # correct
```

Another rejected alternative from the same section, worth knowing because people assume it
is the behaviour:

> *"Try to give the starred target the same type as the source iterable, for example, `b` in
> `a, *b = 'hello'` would be assigned the string `'ello'`.  This may seem nice, but is
> impossible to get right consistently with all iterables."*

`a, *b = "hello"` gives `b == ['e', 'l', 'l', 'o']` — a list of characters, not `"ello"`.

## `*a, = x` versus `a = *x,` — one comma, two types

PEP 3132 first:

> *"It is also an error to use the starred expression as a lone assignment target, as in
> `*a = range(5)`. This, however, is valid syntax: `*a, = range(5)`"*

And PEP 448 puts the pair side by side, in its own *Disadvantages* section:

> *"Whilst `*elements, = iterable` causes elements to be a list, `elements = *iterable,`
> causes elements to be a tuple.  The reason for this may confuse people unfamiliar with
> the construct."* — [PEP 448](https://peps.python.org/pep-0448/)

```python
*elements, = some_iterable     # elements is a LIST  — this is unpacking
elements   = *some_iterable,   # elements is a TUPLE — this is a tuple display
```

The rule that resolves it: **the star's meaning depends on which side of the `=` it is
on.** On the left it is an unpacking *target* and the reference says the remainder becomes
a list. On the right it is iterable unpacking inside an expression list, and the expression
list yields a tuple:

> *"An asterisk `*` denotes iterable unpacking.  Its operand must be an iterable.  The
> iterable is expanded into a sequence of items, which are included in the new tuple, list,
> or set, at the site of the unpacking."* —
> [Expression lists](https://docs.python.org/3.14/reference/expressions.html#expression-lists)

⚠️ Neither spelling is worth using in application code. `list(x)` and `tuple(x)` say the
same thing and cannot be misread.

## `*_` — discarding a variable number of items is not free

`_` is an ordinary name (see [6b](06b-unpacking-library-results.md)), so `*_` is an ordinary
starred target — and the reference's rule applies to it unchanged: *"a list of the remaining
items in the iterable is then assigned to the starred target"*. Every discarded item is
still pulled from the iterable and stored in a list that you then never read.

```python
command, *_ = line.split()            # fine: a handful of words
first_row, *_ = read_csv_rows(path)   # 🔴 reads and keeps EVERY row to get the first
```

On a sequence that is merely wasteful. On a generator reading a file or a database cursor,
it drains the whole source into memory — the target list has no way to say "stop after the
first one". When you want one end of an iterable, ask for exactly that end:

```python
from collections import deque

rows = read_csv_rows(path)
first_row = next(rows, None)          # consumes one item; None if the source is empty

last_row = deque(read_csv_rows(path), maxlen=1)   # keeps only the most recent item
last_row = last_row[0] if last_row else None
```

The `deque` form is the documented use of a bounded deque — *"Bounded length deques provide
functionality similar to the `tail` filter in Unix"* — so it still iterates everything, but
holds one item at a time instead of all of them.

## Gotchas

**★ Symptom: `TypeError: unhashable type: 'list'` right after a `first, *rest = ...`.**
Cause: the starred target is always a list, even when the source was a tuple — the
reference says *"a list of the remaining items in the iterable is then assigned to the
starred target"*. Fix: convert where hashability is needed.

```python
first, *rest = key_parts
cache[first, tuple(rest)] = value
```

**★ Symptom: `ValueError: not enough values to unpack (expected at least 2, got 1)`.**
Cause: a starred target still requires the *non-starred* targets to be satisfied — the
minimum is "number of targets minus one". Fix: guard the length, or restructure so the
empty case is explicit.

```python
if not parts:
    raise ValueError("empty command line")
command, *args = parts
```

**★ Symptom: `a, *b = "hello"` produced a list of characters instead of `"ello"`.**
Cause: PEP 3132 explicitly rejected type-preserving starred targets as *"impossible to get
right consistently with all iterables"*. Fix: slice if you want the same type back.

```python
first, rest = text[0], text[1:]      # rest is a str
```

**★ Symptom: memory climbs to the size of the whole export when a job only needed the first
row.** Cause: `first, *_ = rows` is a starred target like any other; the remainder is
materialised into a list and then ignored, and on a generator that means reading the entire
source. Fix: take one item with `next()`.

```python
first = next(iter(rows), None)
if first is None:
    raise ValueError("export is empty")
```

**Symptom: `*a = some_list` is a `SyntaxError`.** Cause: PEP 3132 says *"it is also an error
to use the starred expression as a lone assignment target"* — a star needs a target *list*
to be part of. Fix: use the ordinary constructor; the `*a, =` spelling is legal but
obscure.

```python
a = list(some_list)
```

**Symptom: `x = *items,` produced a tuple where a list was expected.** Cause: on the right
of `=` the star is iterable unpacking inside an expression list, and an expression list
with a comma yields a tuple. Fix: say what you mean.

```python
x = list(items)
```

**Symptom: two starred targets in one assignment is a `SyntaxError`.** Cause: with two
"everything else" slots the split point is ambiguous, so the grammar allows at most one.
Fix: unpack in two steps.

```python
head, *tail = row
mid, *rest = tail
```

**Symptom: `header, *body, footer = lines` works in every test and raises on the one
single-line file in production.** Cause: the two fixed targets need at least two items; a
one-line file supplies one, so the minimum ("targets minus one") is not met. Fix: decide what
a short file means and handle it before the unpack.

```python
if len(lines) < 2:
    raise ValueError(f"expected header and footer, got {len(lines)} line(s)")
header, *body, footer = lines
```

## Interview questions

**★ `first, *rest = (1, 2, 3)`. What type is `rest`?**
A `list` — `[2, 3]`. Not a tuple, even though the right-hand side was one. The reference
states it directly: *"a list of the remaining items in the iterable is then assigned to the
starred target (the list can be empty)."* PEP 3132 records the decision as deliberate,
listing "make the starred target a tuple instead of a list" among the rejected
alternatives: it *"would be consistent with a function's `*args`, but make further
processing of the result harder."*

**★ What is the difference between `*a, = x` and `a = *x,`?**
The side of the `=`. On the left, the star is an unpacking target and the remainder becomes
a list. On the right, the star is iterable unpacking inside an expression list, and an
expression list containing a comma yields a tuple. PEP 448 flags exactly this pair as a
disadvantage of the design: *"Whilst `*elements, = iterable` causes elements to be a list,
`elements = *iterable,` causes elements to be a tuple."* In real code, write `list(x)` or
`tuple(x)`.

**Why can there be only one starred target?**
Because the star means "everything not claimed by a named target", and with two of them
there is no rule for where the first stops and the second begins. The grammar therefore
allows at most one, in any position — before, between or after the fixed targets. If you
genuinely need two splits, do them in two statements.

**Is `first, *rest = seq` more efficient than `seq[0], seq[1:]`?**
PEP 3132's own claim is *"cleaner and probably more efficient"* — note the hedge, which the
PEP itself wrote. Both build a new list or slice for the tail, so neither is free; the
starred form works on any iterable, including one that is not sliceable, and avoids
creating an intermediate for the head. I have no measurement to offer here and the PEP does
not provide one either; treat "cleaner" as the reliable half of that sentence.

**★ Does `first, *_ = huge_generator` avoid storing the rest?**
No. `_` is an ordinary name and `*_` an ordinary starred target, so the reference's rule
applies without exception: the remaining items are collected into a list and bound to `_`.
The generator is drained completely and every item is held in memory until `_` is rebound or
goes out of scope. The intent "give me the first one" is spelled `next(it, default)`; "give
me the last one" is a bounded `deque(it, maxlen=1)`, which still iterates everything but
keeps only one item at a time.

**What is the minimum length of the iterable in `a, *b, c = it`?**
Two — the number of targets minus one, because the starred target may be empty. One item
raises `ValueError` with the "expected at least 2, got 1" form of the message, which is
CPython's separate wording for the starred case. That makes a starred unpack a cheap
length assertion for the fixed parts only; it says nothing about how large the middle is.

---

← [Unpacking library results](06b-unpacking-library-results.md) · [Topic index](README.md) · Next → [Stars beyond assignment](06d-stars-beyond-assignment.md)
