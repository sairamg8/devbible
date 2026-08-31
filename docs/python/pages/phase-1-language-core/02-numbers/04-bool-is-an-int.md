---
title: "bool is a subclass of int, so True really is 1 — and that is a feature before it is a bug"
sidebar_label: "4 · bool is an int"
sidebar_position: 40
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Python 3.14 library reference
> ([Boolean Type — `bool`](https://docs.python.org/3.14/library/stdtypes.html#boolean-type-bool),
> [`bool()`](https://docs.python.org/3.14/library/functions.html#bool),
> [Numeric Types — int, float, complex](https://docs.python.org/3.14/library/stdtypes.html#typesnumeric))
> and [PEP 285 — Adding a bool type](https://peps.python.org/pep-0285/).
> Version spine: **Python 3.14.7**.

**`bool` is not a separate type that happens to look numeric. It is a subclass of
`int`, and the library reference says so in one sentence: *"`bool` is a subclass of
`int`"*, with *"In many numeric contexts, `False` and `True` behave like the integers
0 and 1, respectively."* That inheritance is load-bearing rather than incidental —
`sum(p(x) for x in xs)` counts matches because `True` adds as `1`, `xs[flag]` picks
between two branches because a `bool` is a valid index, and `sorted(key=lambda i: not
i.pinned)` works because `False` sorts before `True`. The same sentence has a second
half the docs put right after it: *"However, relying on this is discouraged;
explicitly convert using `int()` instead."* This chunk is the half that is a feature.
The next two are the traps — [inside Python](04b-bool-identity-traps.md), and
[at a boundary](04e-booleans-at-a-boundary.md).**

## What the language actually promises

Two constants, one type, one parent. From the library reference:

> *"Booleans represent truth values. The `bool` type has exactly two constant
> instances: `True` and `False`."*

and, in the same section:

> *"`bool` is a subclass of `int` (see Numeric Types — int, float, complex). In many
> numeric contexts, `False` and `True` behave like the integers 0 and 1,
> respectively. However, relying on this is discouraged; explicitly convert using
> `int()` instead."*

`bool()`'s own entry adds the two structural guarantees:

> *"The `bool` class is a subclass of `int`. It cannot be subclassed further. Its
> only instances are `False` and `True`."*

So there are exactly three facts to hold, and everything in this topic is a
consequence of one of them:

1. **`True` and `False` are `int` instances** — every `int` operation works on them.
2. **`bool` is a closed type** — you cannot subclass it, and you cannot create a
   third instance. `True` and `False` are singletons, which is what makes `x is True`
   a meaningful test at all rather than an accident of caching.
3. **`True` equals `1` and `False` equals `0`** — not "compares equal in some
   contexts". They *are* those values, carrying a different `__repr__`.

PEP 285, which introduced the type in Python 2.3, is explicit that this was the
design and not an accident: *"The bool type would be a straightforward subclass (in
C) of the int type, and the values `False` and `True` would behave like 0 and 1 in
most respects."* The PEP also records why the arithmetic was left alone —
comparisons had always returned integers, and *"there's no way of telling what uses
existing applications make of these values."* So `True + True` is `2`, deliberately,
and every idiom below is downstream of that decision.

## The consequences you want

All of this follows from `True == 1`.

**Counting predicates.** No filter, no `len`, no intermediate list:

```python
errors = sum(r.status >= 400 for r in responses)
```

`sum` adds the `bool`s as integers. This is the idiomatic count-matching-items form
in Python — it reads better than `len([r for r in responses if r.status >= 400])`
and allocates nothing. The two related forms are `any(...)` and `all(...)`, which
short-circuit and return a real `bool`.

**Indexing with a flag.** A `bool` is a valid sequence index, because it is an `int`:

```python
LABEL = ("disabled", "enabled")
print(LABEL[feature_on])          # feature_on is a bool
```

Useful, and worth using sparingly. A dict or a conditional expression is usually
clearer, and this form breaks the moment `feature_on` becomes something
truthy-but-not-boolean — a `1` read from a config file, or a non-empty string — at
which point the index is out of range or, worse, silently valid.

**Multiplication as a mask.** `price * is_taxable` is `0` or `price`, with no branch.
The same trick sums a subset: `sum(v * include(v) for v in values)`.

**Sorting and grouping by a predicate.** `sorted(items, key=lambda i: not i.pinned)`
puts pinned items first, because `False` sorts before `True`. A `bool` key is the
cheapest possible two-way partition in a sort.

**`Counter` over a predicate** gives you both arms at once:

```python
from collections import Counter
Counter(r.status >= 400 for r in responses)   # keys are True and False
```

**`operator.index` accepts a `bool`**, which is why booleans work anywhere an integer
index or a repeat count is wanted — `"ab" * flag`, `range(flag)`, `list[flag:]`.

## Bitwise operators: when the result stays a `bool`

The library reference is precise, and the precision matters:

> *"When applying the bitwise operators `&`, `|`, `^` to two booleans, they return a
> bool equivalent to the logical operations 'and', 'or', 'xor'. However, the logical
> operators `and`, `or` and `!=` should be preferred over `&`, `|` and `^`."*

Two consequences.

**Both operands must be booleans.** `True & True` is `True` — a `bool`. `True & 1`
is `1` — an `int`. There is no promotion rule that keeps the boolean-ness alive
through a mixed operation, so a value that "should be a boolean" quietly becomes a
number as soon as one operand comes from somewhere numeric.

**They do not short-circuit.** `and` and `or` do; `&` and `|` evaluate both sides.
That is the practical reason the docs prefer the logical operators — `x is not None
and x.value` is safe, `x is not None & x.value` is not — quite apart from `&`
binding more tightly than a comparison, which makes `a == 1 & b == 1` parse in a way
almost nobody intends.

`^` is the pithy way to write "exactly one of these". The docs nudge you to `!=`
instead, which reads the same and returns a `bool` regardless of operand types.

## `~` is deprecated and becomes an error in 3.16

> *"Deprecated since version 3.12: The use of the bitwise inversion operator `~` is
> deprecated and will raise an error in Python 3.16."*

`~True` is `-2`, because `~x == -(x+1)` on an integer of infinite width — see
[bitwise on an infinite width](01b-bitwise-operations.md). That is never what someone
writing `~is_valid` meant; the intended operator is `not`. Today this is a
`DeprecationWarning`; on 3.16 it is a hard error, so find them before the upgrade
does:

```bash
python -W error::DeprecationWarning -m pytest
```

## Formatting: the repr is the only thing that differs

`str(True)` and `repr(True)` are both `"True"` — PEP 285 specifies the capitalised
words, with `__str__` aliased to `__repr__`. But the format mini-language treats the
value as the integer it is, so a presentation type changes what you see:

```python
f"{True}"        # 'True'   — no format spec, so str() is used
f"{True:d}"      # '1'      — integer presentation
f"{True:b}"      # '1'      — binary presentation
f"{True:05.2f}"  # '01.00'  — float presentation
"%d" % True      # '1'
"%s" % True      # 'True'
```

This is the quiet cause of a `1` appearing in a rendered template where the author
expected `True`: someone added a format spec for alignment, and the spec pulled the
value onto the numeric path. Format the string, not the boolean, when you want the
word *and* the padding:

```python
f"{str(flag):>8}"
```

## Gotchas

### `True & 1` is not a `bool`

**Symptom.** A value that should be a boolean serialises as `1`, or fails an
`is True` check downstream.
**Cause.** The bool-preserving behaviour of `&`, `|` and `^` requires *both* operands
to be booleans. Any mixed operand falls back to ordinary integer bitwise.
**Fix.** Prefer `and`, `or` and `!=` as the docs recommend, or wrap the result:

```python
flag = bool(a & b)
```

### `&` and `|` evaluate both sides

**Symptom.** An `AttributeError` on `None`, in a guard that "obviously" short-circuits.
**Cause.** `&` and `|` are arithmetic operators, not control flow. Only `and` and
`or` short-circuit.
**Fix.** Use `and`/`or` for guards:

```python
if x is not None and x.value:   # not:  x is not None & x.value
    ...
```

### `a == 1 & b == 1` does not mean what it looks like

**Symptom.** A compound condition is always false, or raises.
**Cause.** `&` binds more tightly than `==`, so this parses as `a == (1 & b) == 1` —
a chained comparison.
**Fix.** Parenthesise, or use `and`: `a == 1 and b == 1`.

### A `DeprecationWarning` on `~flag`

**Symptom.** `~is_valid` warns, and will stop working in 3.16.
**Cause.** `~` on a `bool` is integer inversion — `~True` is `-2` — and the docs
deprecated it in 3.12.
**Fix.** `not is_valid`. Run the suite under `-W error::DeprecationWarning` to find
the rest before the upgrade does.

### `f"{flag:>8}"` prints `1` instead of `True`

**Symptom.** Adding alignment to a template swapped the word for a digit.
**Cause.** A format spec routes the value through the numeric presentation path
rather than `str()`.
**Fix.** `f"{str(flag):>8}"` — format the string.

### `LABEL[flag]` breaks when the flag comes from config

**Symptom.** `IndexError`, or the wrong label, after a value moved from code into a
settings file.
**Cause.** Indexing with a boolean relies on the value being exactly `0` or `1`. A
config loader returns `"1"`, `2`, or `"true"`.
**Fix.** Normalise at the edge — `LABEL[bool(flag)]` — or use a conditional
expression, which works for any truthy value.

## Interview questions

**Is `bool` a subclass of `int`, or does it just behave like one?**
It is a genuine subclass. The library reference states *"`bool` is a subclass of
`int`"*, `isinstance(True, int)` is `True`, and `int` is in `bool.__mro__`. It is
also a closed one: the docs say it *"cannot be subclassed further"* and *"Its only
instances are `False` and `True`."*

**Why is `True + True` equal to `2` rather than `True`?**
Because `bool` inherits `int`'s arithmetic and PEP 285 deliberately left it alone.
The PEP's reasoning was backwards compatibility — comparisons had always returned
integers, and *"there's no way of telling what uses existing applications make of
these values."* The upside is the `sum(predicate(x) for x in xs)` counting idiom.

**When do `&`, `|` and `^` return a `bool`, and when an `int`?**
A `bool` only when *both* operands are booleans — the docs say they *"return a bool
equivalent to the logical operations 'and', 'or', 'xor'."* Any mixed operand makes it
ordinary integer bitwise, so `True & 1` is `1`. The docs still prefer `and`, `or` and
`!=`, partly because those short-circuit and partly because `&` binds tighter than a
comparison.

**Why is `~flag` deprecated, and what does it currently evaluate to?**
It is integer bitwise inversion: `~True` is `-2`, since `~x == -(x+1)` on an integer
of unlimited width. It was deprecated in 3.12 and becomes an error in 3.16. The
intended operator is `not`.

**Why does `f"{True:d}"` print `1` while `f"{True}"` prints `True`?**
With no format spec, formatting falls back to `str()`, and PEP 285 specifies the
capitalised word with `__str__` aliased to `__repr__`. A presentation type such as
`d`, `b` or `f` selects the numeric path, where the value is the integer `1`.

**Is there any way to create a third `bool` instance, or to subclass `bool`?**
No. The docs state both restrictions: *"It cannot be subclassed further. Its only
instances are `False` and `True`."* That singleton guarantee is what makes
`x is True` a meaningful test rather than a bet on interpreter caching — unlike
`x is 1`, which depends on the small-integer cache (see
[identity and boundaries](01c-identity-and-boundaries.md)).

**The docs say relying on `True == 1` is discouraged. So is `sum(p(x) for x in xs)`
wrong?**
It is a judgement call, and the idiom is widely used and clear. The docs' advice —
*"explicitly convert using `int()` instead"* — is aimed at code where the boolean
crosses something that will remember the integer: a stored value, a serialised
payload, a dict key, a dispatch decision. Inside a single expression that immediately
consumes the sum, the idiom is fine. Where the number escapes the expression,
convert.

**Give three idioms that only work because `bool` is an `int`.**
`sum(p(x) for x in xs)` to count matches; `sorted(items, key=lambda i: not i.pinned)`
to partition in one pass, because `False` sorts before `True`; and `price *
is_taxable` as a branchless mask. A fourth is `("off", "on")[flag]`, which is the one
worth using least.

---

← Prev: [Underscores and constructors](03b-underscores-and-constructors.md) · Index: [Numbers](README.md) · Next → [Identity traps](04b-bool-identity-traps.md)
