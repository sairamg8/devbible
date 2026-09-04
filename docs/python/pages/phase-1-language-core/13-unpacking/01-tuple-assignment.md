---
title: "Unpacking assignment: the right side is finished before the left side starts"
sidebar_label: "1 · Tuple assignment"
sidebar_position: 130
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [Assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements),
> [The `for` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-for-statement),
> and [PEP 3132 — Extended Iterable Unpacking](https://peps.python.org/pep-3132/).
> Target: **CPython 3.14**.

**`a, b = b, a` swaps two names with no temporary, and the reason it works is a
rule worth knowing on its own: the whole right-hand side is evaluated into a
single object *before* any target is assigned. The reference states it plainly —
the expression list is evaluated and then assigned to the targets *"from left to
right"*. Both halves of that sentence carry weight. The first half is why the
swap works. The second half is why `i, x[i] = 1, 2` does not do what almost
everyone predicts.**

## The mechanism

> *"An assignment statement evaluates the expression list (remember that this can
> be a single expression or a comma-separated list, the latter yielding a tuple)
> and assigns the single resulting object to each of the target lists, from left
> to right."*

So `a, b = b, a` builds the tuple `(b, a)` first — reading the *old* values —
and only then unpacks it into `a` and `b`. No temporary variable is needed
because the tuple *is* the temporary.

```python
a, b = b, a                      # the swap
a, b, c = c, a, b                # a three-way rotation, same rule
x[i], x[j] = x[j], x[i]          # the standard element swap in a sort
```

The same rule makes this work where an imperative sequence would not:

```python
prev, cur = cur, prev + cur      # a Fibonacci step, in one line
```

Written as two statements it needs a temporary, because the second line would
otherwise read the already-updated `prev`.

## Unpacking works on any iterable

Despite the name "tuple assignment", the right-hand side needs only to be
iterable:

```python
a, b = [1, 2]                  # a list
a, b = "hi"                    # a string — a is "h", b is "i"
a, b = {"x": 1, "y": 2}        # a dict — you get the KEYS
a, b = (n for n in range(2))   # a generator
host, port = line.split(":")   # the everyday case
```

The `dict` case is the one that surprises: iterating a mapping yields keys, so
`a, b = d` binds key names. `k, v = d.items()` is not right either — that
unpacks the *view* into two items, so it only works for a two-entry dict. What
you almost always want is `for k, v in d.items():`.

The count must match exactly, and the error messages are precise about which
direction it failed:

```python
a, b = [1, 2, 3]      # ValueError: too many values to unpack (expected 2)
a, b, c = [1, 2]      # ValueError: not enough values to unpack (expected 3, got 2)
```

Note the asymmetry: the "too many" message does not say how many there were,
because unpacking stops as soon as it has one too many and does not count the
rest — which matters when the right-hand side is an infinite generator.

## Targets are assigned left to right, and that is observable

Here is the part people get wrong, quoted from the reference:

> *"Although the definition of assignment implies that overlaps between the
> left-hand side and the right-hand side are 'simultaneous' (for example `a, b =
> b, a` swaps two variables), overlaps within the collection of assigned-to
> variables occur left-to-right, sometimes resulting in confusion."*

And its own example:

```python
x = [0, 1]
i = 0
i, x[i] = 1, 2         # i is updated, then x[i] is updated
print(x)               # [0, 2]
```

`i` becomes `1` first. Then `x[i]` — now `x[1]` — is assigned `2`. So the list
is `[0, 2]`, not `[2, 1]`. The right-hand side was fully evaluated up front, but
the *targets* are resolved one at a time, in order, using the values current at
that moment.

This is rare in ordinary code and vicious when it appears: any assignment whose
targets include both a plain name and a subscript or attribute that *uses* that
name is order-sensitive. The fix is to not write it — split into two statements
where the order is visible.

## Any assignment target works

The targets in an unpacking assignment are ordinary assignment targets, so they
can be names, subscripts, attributes, or nested patterns:

```python
obj.x, obj.y = point                 # attributes
d["a"], d["b"] = values              # subscripts
(a, b), c = (1, 2), 3                # nested — parentheses group
[a, b], c = [1, 2], 3                # brackets work identically
first, (second, third) = data
```

Nested unpacking is what makes `for` loops over structured data read well:

```python
for i, (name, score) in enumerate(pairs, start=1):
    ...
for (x1, y1), (x2, y2) in segments:
    ...
```

The parentheses around `(name, score)` are load-bearing — without them Python
tries to unpack the two-tuple `(index, pair)` into three targets and raises
`ValueError: not enough values to unpack`. That is the most common unpacking
error in real code, and [`enumerate`](../08-control-flow/02-enumerate-and-zip.md)
is where it usually appears.

## Unpacking consumes an iterator

```python
gen = (x for x in range(5))
a, b = gen              # ValueError: too many values to unpack (expected 2)
```

That raises — but the generator has already been partially consumed by the time
it does, so a `try`/`except` around it leaves you holding a half-eaten iterator.
More subtly:

```python
first, second = itertools.islice(gen, 2)   # takes exactly two, leaves the rest
```

is the shape you want when the source is a stream and you only need a prefix.
Plain unpacking demands the count be exact and will drain the iterator finding
out.

## Gotchas

**Symptom — `a, b = b, a` is claimed to be "just a tuple trick" and someone
rewrites it as two lines, breaking it.** Cause: the two-line version needs a
temporary, because the second line reads the already-updated name. The one-line
form works because the entire right-hand side is evaluated into a tuple before
any target is assigned. Fix: leave it alone; it is the idiomatic swap and it is
correct by the documented rule.

**Symptom — `i, x[i] = 1, 2` assigns to the wrong index.** Cause: targets are
assigned left to right, so `i` is updated before `x[i]` is resolved — the
reference documents this exact example, which prints `[0, 2]`. Fix: split into
two statements. Any assignment whose targets mix a name and a subscript using
that name is order-sensitive.

**Symptom — `ValueError: not enough values to unpack (expected 3, got 2)` on an
`enumerate` loop.** Cause: `enumerate` yields a 2-tuple `(index, item)`;
unpacking the item as well needs its own parentheses. Fix:
`for i, (name, score) in enumerate(pairs):`.

**Symptom — `a, b = some_dict` binds key names rather than values.** Cause:
iterating a mapping yields keys. Fix: `a, b = some_dict.values()` for values, or
— nearly always what was meant — `for k, v in some_dict.items():`.

**Symptom — a `try`/`except ValueError` around an unpack leaves a generator
partially consumed.** Cause: unpacking pulls items until the count is wrong, and
those items are gone. Fix: materialise first (`items = list(gen)`) and check
`len`, or use `itertools.islice` to take a fixed prefix.

**Symptom — unpacking an infinite generator hangs, or does not.** Cause: it does
not hang on the "too many values" path — unpacking stops one item past the
expected count and raises. It *would* hang if the target list demanded more
items than a slow-but-finite source can produce quickly. Fix: bound the source
with `islice` when it may be unbounded.

**Symptom — `a, b = "hi"` works and `a, b = "hello"` raises, and neither was
intended.** Cause: a `str` is iterable, so unpacking decomposes it into
characters. Fix: this is why `match` deliberately excludes strings from sequence
patterns; in an assignment there is no such protection, so validate before
unpacking a value that might be a string —
`host, port = line.split(":")` is fine, `host, port = line` is not.

**Symptom — an unpack that used to work starts raising after a function's return
type changes from a 2-tuple to a 3-tuple.** Cause: the count is checked at
runtime and nothing warns at the call site. Fix: return a `NamedTuple` or a
dataclass instead of a bare tuple once there are more than two or three fields —
callers then use attribute names and adding a field breaks nothing.

## Interview questions

**★ Q: Why does `a, b = b, a` swap without a temporary?**
Because the right-hand side is evaluated in full — into a single tuple, using
the old values — before any target is assigned. The reference states the
expression list is evaluated and then assigned to the targets from left to
right. The tuple is the temporary.

**★ Q: What does this print, and why?**
```python
x = [0, 1]; i = 0
i, x[i] = 1, 2
print(x)
```
`[0, 2]`. The right-hand side `(1, 2)` is built first, but the *targets* are
assigned left to right: `i` becomes `1`, and only then is `x[i]` resolved — as
`x[1]`. The reference carries this exact example precisely because "simultaneous
assignment" is the wrong mental model for the left-hand side.

**★ Q: Can you unpack anything other than a tuple?**
Any iterable — lists, strings, generators, dicts (yielding keys), file objects.
The name "tuple assignment" is historical. The count must match exactly, and the
two failure messages differ: *"not enough values to unpack (expected 3, got 2)"*
versus *"too many values to unpack (expected 2)"*, which does not report the
actual count because it stops as soon as it has one too many.

**Q: What is wrong with `a, b = my_dict`?**
It binds the first two **keys**, because iterating a mapping yields keys. For
values use `.values()`; for pairs use `.items()` — and in practice you almost
always want `for k, v in d.items():` rather than an unpack.

**Q: Why do you need the extra parentheses in `for i, (name, score) in enumerate(pairs):`?**
Because `enumerate` yields a 2-tuple: the index and the item. Without the
parentheses Python sees three targets for a two-item tuple and raises
`ValueError: not enough values to unpack`. The parentheses say "the second
target is itself a pair".

**Q: Does unpacking consume a generator?**
Yes, and it consumes it even when it then raises. Unpacking pulls items until
the count is satisfied or exceeded, so an exception leaves you with a partially
drained iterator that cannot be replayed. Materialise with `list()` first, or
take a fixed prefix with `itertools.islice`.

**Q: When should a function stop returning a tuple to unpack?**
Once there are more than two or three fields, or once the order is not obvious
from the call site. A bare tuple's arity is checked only at runtime, so adding a
field silently breaks every caller. A `NamedTuple` or dataclass lets callers use
attribute names and makes adding a field backwards-compatible.

---

← Prev: [EAFP vs LBYL](../12-eafp-vs-lbyl/README.md) · Index: [Unpacking](README.md) · Next → [Starred unpacking](02-starred-unpacking.md)
