---
title: "What `if x:` costs: a condition is a method call, and it can be slow, raise, or refuse"
sidebar_label: "1c · What `if x:` costs"
sidebar_position: 52
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [Truth Value Testing](https://docs.python.org/3.14/library/stdtypes.html#truth-value-testing),
> [Built-in Constants](https://docs.python.org/3.14/library/constants.html),
> [`unittest.mock`](https://docs.python.org/3.14/library/unittest.mock.html),
> and [`logging`](https://docs.python.org/3.14/library/logging.html#logging.Logger.isEnabledFor).
> Target: **CPython 3.14**.

**`if x:` looks like the cheapest line in the language and is not. It dispatches
to `__bool__`, or failing that to `__len__`, and whatever those methods do — a
database round trip, a tree walk, a deliberate refusal to answer — happens
inside your condition. The docs say the quiet part out loud: if either method
raises, *"the exception is propagated and the object does not have a truth
value"*. This chunk is the caller's half of the protocol: the three ways a
condition behaves like something other than a condition, and the 3.14 change
that turned one long-standing silent bug into a loud one.**

## It can be slow

A `__len__` that counts a linked list, walks a tree, or — worst — issues a
database query turns `if results:` into I/O. Django's `QuerySet` is the
canonical example:

```python
if qs:              # evaluates the ENTIRE queryset and caches every row
    ...

if qs.exists():     # issues SELECT 1 ... LIMIT 1
    ...
```

The two lines look equally innocent and differ by the size of your table. The
same shape appears with SQLAlchemy `Query`, with `pathlib` globs materialised
into lists, and with any lazily-paginated API client that fetches on `__len__`.

The general rule: **if the object is lazy, do not truth-test it.** Ask the cheap
question the API provides, or take one item:

```python
first = next(iter(candidates), None)
if first is not None:
    ...
```

That works for generators too, where truthiness is not merely expensive but
meaningless — a generator defines neither method, so `if gen:` is always `True`
regardless of whether it will ever yield.

## It can raise

Anything `__bool__` or `__len__` touches can throw, and the traceback will point
at an `if` statement that looks incapable of failing. A `__len__` that reads
`self._cached_rows` raises `AttributeError` from inside a condition if the cache
was never populated; a `__bool__` that consults a connection raises whatever the
driver raises.

This is why a `try` around a condition is occasionally the right code rather
than a smell:

```python
try:
    has_work = bool(queue)
except ConnectionError:
    has_work = False        # a broker we cannot reach has no work for us
```

It is also why `__bool__` should be cheap and pure — see
[the protocol chunk](01b-the-truthiness-protocol.md).

## It can be ambiguous by design

`numpy` defines `__bool__` on arrays to raise for any array with more than one
element:

```python
import numpy as np
arr = np.array([1, 2, 3])
if arr:            # ValueError: the truth value of an array with more than
    ...            # one element is ambiguous. Use a.any() or a.all()
```

That is a deliberate refusal, and a good one — `numpy` will not guess whether
you meant "any" or "all". `pandas` does the same for `Series` and `DataFrame`.
The fix is to say which you meant:

```python
if arr.any():      # at least one non-zero
if arr.all():      # every element non-zero
if arr.size > 0:   # the array is non-empty  ← usually what was meant
if len(df.index):  # the frame has rows
```

Note the asymmetry that catches people mid-debug: a **zero**-element array is
falsy, and a **one**-element array takes that element's truth value without
complaint. Only two or more elements raise. So the same line can work for months
against single-row fixtures and raise the first time two rows come back — which
is exactly how this error reaches production instead of development.

The related trap is `and`/`or` on arrays. Because those operators truth-test
their left operand, `mask_a and mask_b` raises for the same reason, and the
element-wise operators `&` and `|` are what you want — with parentheses, since
they bind tighter than the comparisons:

```python
subset = df[(df.age > 18) & (df.country == "IN")]   # not `and`
```

[Chunk 3](03-and-or-return-operands.md) covers why `and`/`or` cannot be
overloaded to fix this.

## `NotImplemented` is now a hard error — new in 3.14

`NotImplemented` is the sentinel a rich comparison returns to say "I don't know
how to compare with that type; try the other operand". It was never meant to be
truth-tested, and as of this release it refuses to be. From the Built-in
Constants page:

> *"Changed in version 3.14: Evaluating `NotImplemented` in a boolean context now
> raises a `TypeError`. It previously evaluated to `True` and emitted a
> `DeprecationWarning` since Python 3.9."*

The mistake that produces it is common and quiet:

```python
class Money:
    def __eq__(self, other):
        if not isinstance(other, Money):
            return NotImplemented          # correct
        return self.cents == other.cents

# and then, somewhere else, someone calls the dunder directly:
if a.__eq__(b):        # 3.9–3.13: silently True for a str! 3.14: TypeError
    ...
```

Calling `a == b` is fine — the interpreter handles `NotImplemented` for you and
falls back to the reflected operand. Calling `a.__eq__(b)` yourself skips that
machinery and hands you the raw sentinel. For six releases that sentinel quietly
evaluated to `True`, so a comparison that had *failed* looked like it had
*succeeded*. On 3.14 it raises instead, which is a straight upgrade: a loud bug
beats a silent one. [Comparisons](../06-comparisons/README.md) covers the protocol
itself.

The same trap exists one level up, in test code that asserts on a dunder's
result:

```python
assert a.__eq__(b)          # do not; use assert a == b
assert not a.__ne__(b)      # likewise
```

If you are upgrading a codebase to 3.14, `grep -rn '\.__eq__(\|\.__lt__(\|\.__ne__(' ` over
the test suite finds most of these in one pass.

## Gotchas

**Symptom — a page of code that reads a database gets slow after you add a
harmless-looking `if rows:`.** Cause: `rows` is a lazy queryset or cursor whose
`__bool__`/`__len__` materialises the whole result set. Fix: ask the cheap
question the API provides — `.exists()`, `LIMIT 1`, `next(iter(...), None)` —
rather than truth-testing the lazy object.

**Symptom — adding a debug log line doubles your query count.** Cause:
`logger.debug("have rows: %s", bool(qs))` truth-tests a lazy object, and the
argument is evaluated even when the level filters the message out — logging only
defers *formatting*, never argument evaluation. Fix: keep expensive objects out
of log arguments, pass the cheap question (`qs.exists()`), or guard with
`logger.isEnabledFor(logging.DEBUG)`.

**Symptom — `if x:` raises `ValueError: The truth value of an array with more
than one element is ambiguous`.** Cause: `x` is a `numpy` array or a `pandas`
`Series`/`DataFrame`, whose `__bool__` deliberately refuses to guess between
"any element" and "all elements". Fix: say which you mean — `x.any()`,
`x.all()`, `x.size > 0`, or `len(x) > 0`. Never patch it as
`if x is not None and x:`; that only moves the raise.

**Symptom — a numpy- or pandas-using branch worked for months and then started
raising in production.** Cause: the array had exactly one element in every test
fixture, so `__bool__` returned that element's truth value; the first
two-element array raised. Fix: as above, plus a fixture with more than one row.
This is the single most common way the ambiguity error escapes development.

**Symptom — `mask_a and mask_b` raises on numpy arrays while `mask_a & mask_b`
works.** Cause: `and` truth-tests its left operand and cannot be overloaded —
there is no `__and_bool__`. Only the bitwise operators have dunders (`__and__`,
`__or__`), which is why the array libraries co-opt them. Fix: use `&` and `|`,
and parenthesise the comparisons, because those operators bind more tightly than
`>` and `==`.

**Symptom — an `AttributeError` or `ConnectionError` whose traceback points at
an `if` statement.** Cause: the condition called a `__bool__`/`__len__` that
touched uninitialised state or a remote resource; the docs state the exception
propagates and the object simply has no truth value. Fix: make `__bool__` read
only already-materialised state, or wrap the specific condition in `try` and
decide what "cannot tell" should mean.

**Symptom — a comparison that should have failed silently succeeded on 3.13 and
raises `TypeError` on 3.14.** Cause: code calls `a.__eq__(b)` (or `__lt__`,
`__add__` …) directly and truth-tests the result, which is `NotImplemented`
whenever the types do not match. Fix: use the operator — `a == b` — and let the
interpreter do the reflected-operand fallback. The 3.14 `TypeError` is telling
you about a bug that was always there.

**Symptom — `if some_mock:` behaves differently in tests than the real object
does.** Cause: `unittest.mock.Mock` is truthy by default and auto-creates
attributes; a `MagicMock` additionally configures `__len__`/`__bool__` with
default return values. So a mock standing in for an empty container is truthy
where the real thing is falsy, and the test passes for the wrong reason. Fix:
configure the truth value explicitly (`m.__bool__.return_value = False` on a
`MagicMock`), or use `spec=`/`autospec=` so the mock only carries the protocol
the real class has.

**Symptom — a health check that "just checks the connection" is the slowest
endpoint you have.** Cause: `if db:` or `if cache:` on a client object whose
`__bool__` performs a round trip, called on every request. Fix: truth-test a
cached flag, or call the driver's explicit `ping()` on a schedule and read the
last result.

## Interview questions

**★ Q: What does `if x:` cost?**
Whatever `x.__bool__` or `x.__len__` costs, which is arbitrary. For a `list` it
is O(1). For a Django `QuerySet` it is a database round trip that materialises
every row. For a linked-list class with a counting `__len__` it is O(n). A
condition is a method call, and it can be slow, and it can raise — the docs
state that an exception from either method propagates and the object simply has
no truth value.

**★ Q: Why does `if numpy_array:` raise?**
Because `numpy` defines `__bool__` to raise for any array with more than one
element. The truth value is genuinely ambiguous — "any element is truthy" and
"all elements are truthy" are different questions — and `numpy` refuses to pick
one. Use `.any()`, `.all()`, or a size check. The same applies to pandas
`Series` and `DataFrame`. A zero- or one-element array does *not* raise, which is
why this reaches production rather than development.

**Q: Why must you write `&` instead of `and` when filtering a DataFrame?**
Because `and` truth-tests its left operand, and a multi-element `Series` refuses
to produce a truth value. `and`/`or`/`not` cannot be overloaded — there is no
dunder for them — so the array libraries overload the bitwise operators
instead. The parentheses are required because `&` binds more tightly than the
comparison operators.

**Q: What changed about `NotImplemented` in 3.14?**
Evaluating it in a boolean context now raises `TypeError`. From 3.9 to 3.13 it
evaluated to `True` with a `DeprecationWarning`. The code that hits this is
almost always calling a comparison dunder directly (`a.__eq__(b)`) instead of
using the operator, and it was silently reporting failed comparisons as
successful the whole time.

**Q: How would you check "are there any results" against a lazy database query?**
Use the API's own cheap predicate — `qs.exists()` in Django, `session.query(...).first() is not None`
or a `SELECT 1 ... LIMIT 1` in SQLAlchemy. Truth-testing the lazy object
materialises the full result set. For a plain iterator, `next(iter(x), None) is not None`
takes one item instead of all of them.

**Q: Does `logger.debug("%s", expensive)` avoid the cost when debug is off?**
No. Logging defers *formatting*, not argument evaluation — `expensive` is
evaluated at the call. If the argument truth-tests a queryset or builds a large
string, that work happens regardless of level. Guard with
`logger.isEnabledFor(logging.DEBUG)` or pass something cheap.

**Q: Your test passes but the production code path is wrong. The condition is `if items:` and `items` is a mock. Why?**
`Mock` is truthy by default, so `if items:` takes the true branch no matter what
the real object would have done. A `MagicMock` supports `__len__`/`__bool__` but
with default return values that may not match the real type either. Use
`spec=`/`autospec=`, or configure `__bool__.return_value` explicitly, so the
mock's truth value matches the real class's protocol.

---

← Prev: [The truthiness protocol](01b-the-truthiness-protocol.md) · Index: [Truthiness](README.md) · Next → [Empty versus missing](02-empty-versus-missing.md)
