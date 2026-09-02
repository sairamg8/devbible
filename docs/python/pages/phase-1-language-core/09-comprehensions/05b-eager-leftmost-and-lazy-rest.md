---
title: "A generator expression evaluates its leftmost iterable immediately and defers absolutely everything else to consumption time"
sidebar_label: "5b · Eager leftmost, lazy rest"
sidebar_position: 100
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [Generator expressions](https://docs.python.org/3.14/reference/expressions.html#generator-expressions),
> [Displays for lists, sets and dictionaries](https://docs.python.org/3.14/reference/expressions.html#displays-for-lists-sets-and-dictionaries),
> the [Glossary — iterator](https://docs.python.org/3.14/glossary.html#term-iterator),
> the Library Reference
> [`itertools.tee`](https://docs.python.org/3.14/library/itertools.html#itertools.tee),
> and [PEP 289](https://peps.python.org/pep-0289/).
> Target: **CPython 3.14**.

**A generator expression's evaluation is split in a way the syntax gives no hint
of. The iterable expression of the leftmost `for` clause is evaluated the moment
the expression is written, along with the `iter()` call on it — and everything
else is deferred: later iterables, every filter, the element expression, and
every free variable any of them mentions. That split decides where your
exceptions appear, which value of a changing variable the generator sees, and
whether a `try` block that looks like it wraps the work actually does.**

## The split, documented with its own examples

The reference states the eager half:

> *"The iterable expression in the leftmost `for` clause is evaluated
> immediately, so that an error raised by this expression will be emitted at the
> point where the generator expression is defined, rather than at the point where
> the first value is retrieved"*

```python
>>> (x ** 2 for x in nonexistent_iterable)
Traceback (most recent call last):
  ...
NameError: name 'nonexistent_iterable' is not defined
```

And that the `iter()` call is eager too:

> *"After the expression is evaluated, an iterator is created from the result, as
> if `iter()` was called on it. Any error raised when creating the iterator is
> also emitted immediately"*

```python
>>> (x ** 2 for x in None)
Traceback (most recent call last):
  ...
TypeError: 'NoneType' object is not iterable
```

Then the lazy half:

> *"All other expressions are evaluated lazily, in the same fashion as normal
> generators (that is, when the iterator is asked to yield a value)"*

with two documented cases — a free variable in the element expression, and a
later iterable:

```python
>>> iterator = (nonexistent_value for x in range(10))
>>> iterator
<generator object <genexpr> at ...>
>>> list(iterator)
Traceback (most recent call last):
  ...
NameError: name 'nonexistent_value' is not defined

>>> iterator = (x * y for x in range(10) for y in nonexistent_iterable)
>>> iterator
<generator object <genexpr> at ...>
>>> list(iterator)
Traceback (most recent call last):
  ...
NameError: name 'nonexistent_iterable' is not defined
```

All four blocks above are quoted from the reference. The pattern to take away:
**the only thing a genexp does eagerly is `iter(leftmost)`.** Everything else,
including the correctness of every other name it mentions, is deferred to
consumption time.

PEP 289 records why it was designed this way rather than making everything lazy —
Guido's reasoning, quoted in the PEP: *"I'd be surprised if the one in `sum()`
was raised rather the one in `foo()`, since the call to `foo()` is part of the
argument to `sum()`, and I expect arguments to be processed before the function
is called."*

## Late binding: the free variables are read when consumed

The lazy half has a consequence beyond error timing. A genexp reads its free
variables at consumption time, not at definition time, so anything that changes
in between changes the result:

```python
factor = 2
doubled = (x * factor for x in nums)
factor = 10
list(doubled)                          # multiplies by 10, not 2
```

That is the same closure-capture rule as
[the lambda trap](03-scope-and-the-target.md), and it is why building generator
expressions inside a loop over a variable that the loop is changing produces
values from whichever iteration happened to be current when someone consumed
them:

```python
gens = []
for prefix in ("a", "b"):
    gens.append(f"{prefix}{x}" for x in range(3))   # both see prefix == "b"
```

The fix is the same as for closures: consume immediately (`list(...)`), or bind
the value with a default argument on a real generator function, or build from a
snapshot local.

The *leftmost iterable*, by contrast, is captured at definition — rebinding the
name afterwards does not affect the genexp:

```python
rows = [1, 2, 3]
g = (r for r in rows)
rows = [9, 9]                          # g still walks the original list object
```

But *mutating* the original object does affect it, because `iter()` was called on
that object and the iterator is watching it:

```python
rows = [1, 2, 3]
g = (r for r in rows)
rows.append(4)                         # g will yield 4 as well
```

Both behaviours follow from "an iterator over the object was created at
definition time"; neither is a special rule.

## Gotchas

**★ Symptom — a `NameError` or `AttributeError` whose traceback points at a
`sum(...)` or `list(...)` line, naming something defined in a comprehension
several functions away.** Cause: everything except the leftmost iterable is
evaluated lazily, so the error surfaces where the generator is consumed, not
where it was written. Fix: read the genexp at the *definition* site; and consider
materialising earlier so failures happen near their cause.

**★ Symptom — a generator expression yields values computed with a variable's
*later* value.** Cause: free variables are read at consumption time. Fix: consume
immediately, snapshot the value into a default argument on a generator function,
or use a factory.

**★ Symptom — `TypeError: 'NoneType' object is not iterable` on the line where a
generator expression is *defined*, before anything consumes it.** Cause: the
reference says an iterator is created from the leftmost iterable immediately, *"as
if `iter()` was called on it"*, and any error from that is *"emitted
immediately"*. Fix: the bug is in the expression producing the iterable, and the
traceback is pointing at the right line for once.

**★ Symptom — a filter in a genexp raises for an element that a list
comprehension of the same text handled fine.** Cause: it did not — the list
comprehension raised too, at the point of definition, where it was caught by a
`try` that no longer wraps the lazy version. Fix: the exception handling must
wrap the *consumption*, not the definition.

**Symptom — appending to a list after building a genexp over it changes what the
genexp yields.** Cause: `iter()` was called on the list object itself, and a
list iterator reads the live list. Fix: `iter(list(rows))` or build the genexp
over a copy if you need a snapshot — and see
[mutation during iteration](../08-control-flow/04-break-continue-and-mutation.md)
for what happens when you *remove* items instead.

**Symptom — rebinding the source name does not change the genexp's output.**
Cause: the leftmost iterable is evaluated at definition, so the genexp holds an
iterator over the original object, not the name. Fix: nothing — this is the
documented eager half, and it is the useful half.

**Symptom — a genexp defined inside a `with` block raises `ValueError: I/O
operation on closed file` when consumed outside it.** Cause: `iter(file)` was
eager, but reading is lazy, and the `with` closed the handle in between. Fix:
consume inside the block, or return the generator *function* so the caller drives
it while the `with` is on the stack.

**Symptom — a genexp over `dict.items()` raises `RuntimeError: dictionary
changed size during iteration` at a consumption site far from any dict
mutation.** Cause: the view is live and the genexp is lazy; the dict was modified
between definition and consumption. Fix: materialise the items at definition —
`(f(k, v) for k, v in list(d.items()))` — or do not mutate the dict in between.

## Interview questions

**★ Q: What does a generator expression evaluate immediately?**
Exactly the iterable expression of the leftmost `for` clause, and the `iter()`
call on the result. The reference says errors from it are *"emitted at the point
where the generator expression is defined, rather than at the point where the
first value is retrieved"*, and that any error creating the iterator is *"also
emitted immediately"*. Filters, later iterables, the element expression and all
free variables are lazy.

**★ Q: Why is that asymmetry there rather than making everything lazy?**
So that an obvious argument error is reported where it was written. PEP 289
records the reasoning: an argument to a call is expected to be processed before
the call happens, so `sum(x for x in undefined_name)` should fail at the `sum`
line. Everything after the first `in` may depend on values from that iterable and
therefore cannot be evaluated early.

**Q: `g = (x for x in rows)` and then `rows.append(4)` — does `g` yield 4?**
Yes. `iter()` was called on the list object at definition time, and a list
iterator reads the live list, so appended items are seen. Rebinding the *name*
`rows` afterwards would not affect `g`, because the genexp holds the object, not
the name.

**Q: Where does an exception raised inside a genexp's element expression show up
in a traceback?**
At the consumption site — the `sum`, `list` or `for` that pulled the value — with
a `<genexpr>` frame for the expression itself. Generator expressions were not
inlined by PEP 709, so that frame is still there, unlike a list comprehension's.

**Q: Does the same eager/lazy split apply to a list comprehension?**
The scoping rule is identical — the reference gives the leftmost iterable the
same special treatment in both — but you cannot observe the timing difference,
because a list comprehension runs to completion as part of the same expression.
The split only becomes visible when the evaluation can be deferred, which is what
a genexp does.

**Q: How would you make a genexp fail fast on a bad argument?**
Put the thing you want validated in the leftmost iterable, since that is the only
eagerly evaluated part — or validate before building the expression. There is no
switch to make the rest eager short of materialising it.

---

← Prev: [Generator expressions](05-generator-expressions.md) · Index: [Comprehensions](README.md) · Next → [One-shot exhaustion](05c-one-shot-exhaustion.md)
