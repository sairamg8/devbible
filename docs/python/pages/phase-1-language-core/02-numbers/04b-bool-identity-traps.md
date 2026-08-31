---
title: "Because True is 1, a dict has one key where you wrote two and every isinstance(x, int) check has a hole"
sidebar_label: "4b · Identity traps"
sidebar_position: 41
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Python 3.14 library reference
> ([Boolean Type — `bool`](https://docs.python.org/3.14/library/stdtypes.html#boolean-type-bool),
> [`bool()`](https://docs.python.org/3.14/library/functions.html#bool),
> [`isinstance()`](https://docs.python.org/3.14/library/functions.html#isinstance),
> [`functools.singledispatch`](https://docs.python.org/3.14/library/functools.html#functools.singledispatch)),
> the language reference
> ([Structural pattern matching](https://docs.python.org/3.14/reference/compound_stmts.html#the-match-statement)),
> and [PEP 285](https://peps.python.org/pep-0285/).
> Version spine: **Python 3.14.7**.

**Every trap on this page is the same trap wearing a different coat: something in
Python asks "is this an integer?" and a boolean answers yes. Dictionaries ask it
through `__hash__` and `__eq__`, so `{1: "a", True: "b"}` is a one-key dict.
`isinstance` asks it through the subclass rule, which the docs state explicitly —
*"an instance of the classinfo argument, or of a (direct, indirect, or virtual)
subclass thereof"* — so every hand-rolled numeric validator accepts `True`.
`match`/`case` and `functools.singledispatch` ask it through the MRO, so a `bool`
arm written after an `int` arm is unreachable and a `bool` implementation that was
never registered silently resolves to the `int` one. None of these warn. The
common fix is the same in all four places: handle `bool` first, because the `int`
check cannot exclude it.**

## `True` and `1` are the same dict key

`hash(True) == hash(1)` and `True == 1`, which together are the whole contract for
key identity in a `dict` or a `set`. So this is a one-entry dictionary:

```python
d = {1: "one", True: "yes"}
# d is {1: 'yes'}
```

Note the asymmetry, because it is the part people get wrong when they reason it
through: the *value* is replaced, the *key object* is not. The dict still holds the
integer `1`. `list(d) == [1]`, and `True in d` is nonetheless `True`, because
membership also goes through `__eq__`. Sets behave identically — `{1, True}` has one
element, `{True, 1}` has one element, and which object survives depends purely on
insertion order.

The same collision extends across the numeric tower, since `1 == 1.0 ==
Decimal(1) == Fraction(1)` and all four hash equal. A dict is not keyed by type; it
is keyed by hash-and-equality.

Where this actually shows up:

- A lookup table keyed on a status code that also carries a `True` sentinel.
- A `Counter` that mixes counts of the integer `1` with counts of `True`.
- A "seen" set that mixes record IDs with flags.
- A memoisation cache keyed on an argument tuple where one position is sometimes
  `1` and sometimes `True` — two logically different calls sharing one cache entry.

The fix is not to be careful. It is to make the key carry its meaning:

```python
d = {("code", 1): "one", ("flag", True): "yes"}
```

## `isinstance(x, int)` accepts `True`

The `isinstance()` docs are explicit that subclasses count:

> *"Return `True` if the object argument is an instance of the classinfo argument, or
> of a (direct, indirect, or virtual) subclass thereof."*

So this validator has a hole:

```python
def set_retries(n):
    if not isinstance(n, int):
        raise TypeError("retries must be an int")
    ...

set_retries(True)      # accepted; you now retry once, silently
```

When you genuinely mean "an integer that is not a boolean", exclude the subclass
explicitly, and **check `bool` first** — the `int` check cannot distinguish them:

```python
def set_retries(n):
    if isinstance(n, bool) or not isinstance(n, int):
        raise TypeError("retries must be an int")
```

`type(n) is int` also works and is shorter, at a real cost: it rejects every other
legitimate `int` subclass — `IntEnum`, `IntFlag`, and any domain type like
`class UserId(int)`. Use it only when you mean *exactly* `int` and nothing else.

Where it matters most is anywhere a number becomes a quantity: a retry count, a
page size, a timeout, a port, a price in minor units. `True` passes every range check
you would write, because `0 <= True <= 10` is true.

## `match`/`case` has the same hole

Class patterns match subclasses, and `case` arms are tried in order. So this is
wrong:

```python
match value:
    case int():
        ...        # booleans land here
    case bool():
        ...        # unreachable
```

and this is right:

```python
match value:
    case bool():
        ...
    case int():
        ...
```

Nothing warns about the unreachable arm. The identical ordering rule applies to any
`if isinstance(...) / elif isinstance(...)` ladder, and to a `try`/`except` ladder
over an exception hierarchy — same mechanism, different syntax.

## `singledispatch` dispatches booleans to the `int` implementation

`functools.singledispatch` resolves an implementation by walking the argument type's
MRO, and `bool.__mro__` contains `int`. Registering `int` and forgetting `bool` is
the standard form of this bug, and it is invisible until a boolean arrives:

```python
from functools import singledispatch

@singledispatch
def render(v):
    raise TypeError(f"no renderer for {type(v).__name__}")

@render.register
def _(v: int) -> str:
    return str(v)

@render.register
def _(v: bool) -> str:            # required, or True renders as "1"
    return "yes" if v else "no"
```

Registering a subclass is required even when the parent is already registered —
dispatch stops at the *most specific* registered type, and without a `bool`
registration the most specific one is `int`. The same applies to any dispatch table
you build by hand: one keyed on `type(x)` misses subclasses entirely, one that walks
the MRO catches booleans on the `int` entry.

## Gotchas

### A dictionary silently loses an entry

**Symptom.** `len(d)` is one less than the number of literal pairs written, or a
lookup returns a value belonging to a different key.
**Cause.** `True == 1` and `hash(True) == hash(1)`, which is the full contract for
key identity. The first key inserted is retained; the last value assigned wins.
**Fix.** Never mix them in one mapping; tag the keys with their meaning:

```python
d = {("code", 1): "one", ("flag", True): "yes"}
```

### A validator accepts `True` where it wanted a number

**Symptom.** `set_timeout(True)` succeeds and the timeout becomes one second.
**Cause.** `isinstance(True, int)` is `True`, because `isinstance` honours subclasses.
**Fix.** Exclude the subclass first:

```python
if isinstance(n, bool) or not isinstance(n, int):
    raise TypeError("expected an int")
```

### A range check passes for a boolean

**Symptom.** `page_size=True` sails through `if not 1 <= n <= 100: raise`.
**Cause.** `True` is `1`, so it is inside every range that contains 1.
**Fix.** The type check must reject booleans before the range check runs; a range
check alone can never catch this.

### A `match` statement's `bool` arm never runs

**Symptom.** Booleans are handled by the `case int():` branch.
**Cause.** Class patterns match subclasses, and arms are tried in order.
**Fix.** Put `case bool():` before `case int():`. Same rule for an
`isinstance` ladder and for `except` clauses over an exception hierarchy.

### `singledispatch` renders booleans as `1` and `0`

**Symptom.** `render(True)` produces `"1"`.
**Cause.** Dispatch walks the MRO and `bool`'s MRO contains `int`; only `int` was
registered.
**Fix.** Register a `bool` implementation explicitly. Registering the subclass is
required even when the parent is already registered.

### A hand-rolled `type(x)` dispatch table misses subclasses entirely

**Symptom.** The opposite failure — `True` falls through to the default handler and
raises, even though `int` is in the table.
**Cause.** `type(True)` is `bool`, not `int`; an exact-type table has no MRO walk.
**Fix.** Either add a `bool` entry, or dispatch with `singledispatch`, which does
walk the MRO. Pick one model and be consistent about it.

### A cache returns the wrong entry for `True` and `1`

**Symptom.** `f(1)` and `f(True)` share a memoised result.
**Cause.** `functools.lru_cache` keys on the argument tuple, and the tuple's hash and
equality inherit the boolean/integer collision.
**Fix.** If the two calls are genuinely different, normalise the argument before it
reaches the cached function, or include a discriminator in the key.

## Interview questions

**What does `{1: "a", True: "b"}` evaluate to, and why?**
`{1: "b"}`. `True == 1` and `hash(True) == hash(1)`, which is the whole contract for
key identity, so the second pair overwrites the first pair's *value*. The key object
retained is the one inserted first — the integer `1` — not `True`.

**Does `True in {1: "x"}` return `True`?**
Yes. Membership goes through hashing and equality, exactly like assignment, so the
boolean finds the integer key.

**How do you write a check that accepts an integer but rejects a boolean?**
Check `bool` first, because the `int` check cannot exclude it:
`if isinstance(n, bool) or not isinstance(n, int): raise TypeError(...)`. The
alternative, `type(n) is int`, is shorter but also rejects `IntEnum`, `IntFlag` and
any other legitimate `int` subclass, so use it only when you mean exactly `int`.

**Why is a range check not enough to reject `True` from a `page_size` parameter?**
Because `True` *is* `1`, so it satisfies `1 <= n <= 100`. The rejection has to happen
in the type check, before the range check ever runs.

**A `singledispatch` function registered on `int` is being reached by booleans. Is
that expected?**
Yes — dispatch walks the MRO and `bool`'s MRO includes `int`. Register a `bool`
implementation explicitly if booleans need different handling. The same reasoning
explains why `case bool():` must precede `case int():` in a `match` statement, and
why the opposite failure happens with a hand-rolled `type(x)` table, which does no
MRO walk at all and misses booleans entirely.

---

← Prev: [bool is an int](04-bool-is-an-int.md) · Index: [Numbers](README.md) · Next → [is True and the type system](04c-is-true-and-the-type-system.md)
