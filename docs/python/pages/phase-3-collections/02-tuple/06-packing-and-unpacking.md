---
title: "Multiple assignment is tuple packing followed by sequence unpacking — which is why the swap needs no temporary, and why the arity mismatch is a ValueError rather than a truncation"
sidebar_label: "6 · Packing and unpacking"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 language reference on
> [Assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements);
> the tutorial on [Tuples and Sequences](https://docs.python.org/3.14/tutorial/datastructures.html#tuples-and-sequences)
> and [First Steps Towards Programming](https://docs.python.org/3.14/tutorial/introduction.html#first-steps-towards-programming);
> [`enumerate`](https://docs.python.org/3.14/library/functions.html#enumerate),
> [`zip`](https://docs.python.org/3.14/library/functions.html#zip) and
> [`divmod`](https://docs.python.org/3.14/library/functions.html#divmod);
> [`str.partition`](https://docs.python.org/3.14/library/stdtypes.html#str.partition)
> and [`dict.items`](https://docs.python.org/3.14/library/stdtypes.html#dict.items);
> and CPython 3.14 [`Python/ceval.c`](https://github.com/python/cpython/blob/3.14/Python/ceval.c)
> for the unpacking error strings. Documentation-verified — **no sandbox run**.
> Version spine: **CPython 3.14**.

**The tutorial defines multiple assignment as *"really just a combination of tuple packing
and sequence unpacking"*, and everything surprising about it follows from that one
sentence. The right-hand side is fully evaluated into a tuple before any name is bound —
so `a, b = b, a` swaps without a temporary. The left-hand side demands exactly the right
number of targets — so a shape change becomes a `ValueError` at the boundary instead of a
wrong value a hundred lines later. And the targets are bound left-to-right, which is where
the one genuinely confusing case lives.**

## Packing and unpacking, from the tutorial

> *"The statement ``t = 12345, 54321, 'hello!'`` is an example of *tuple packing*: the
> values ``12345``, ``54321`` and ``'hello!'`` are packed together in a tuple.  The reverse
> operation is also possible … This is called, appropriately enough, *sequence unpacking*
> and works for any sequence on the right-hand side.  Sequence unpacking requires that there
> are as many variables on the left side of the equals sign as there are elements in the
> sequence.  **Note that multiple assignment is really just a combination of tuple packing
> and sequence unpacking.**"* —
> [Tuples and Sequences](https://docs.python.org/3.14/tutorial/datastructures.html#tuples-and-sequences)

```python
record = "acme", "eu-west-1", 42     # packing: builds a 3-tuple
tenant, region, count = record       # unpacking: three names, three items
```

The reference generalises "any sequence" to any *iterable*:

> *"The object must be an iterable with the same number of items as there are targets in
> the target list, and the items are assigned, from left to right, to the corresponding
> targets."* —
> [Assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements)

So a generator, a `set`, a `dict` (yielding its keys) and a `str` all unpack:

```python
first, second = {"a": 1, "b": 2}            # 'a', 'b' — the KEYS
lo, hi = (n * 2 for n in (3, 7))            # 6, 14 — a generator unpacks fine
h, m, s = "07:30:15".split(":")             # three strings
x, y = "hi"                                 # 'h', 'i' — a str is a sequence too
```

⚠️ That last one is a bug factory. `x, y = value` succeeds when `value` is any 2-character
string, so a function that "returns a pair" and one day returns `"ok"` unpacks silently
into `'o'` and `'k'`.

## The swap, and why it works

> *"Although the definition of assignment implies that overlaps between the left-hand side
> and the right-hand side are 'simultaneous' (for example ``a, b = b, a`` swaps two
> variables), overlaps *within* the collection of assigned-to variables occur left-to-right,
> sometimes resulting in confusion."* —
> [Assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements)

The tutorial states the mechanism:

> *"the expressions on the right-hand side are all evaluated first before any of the
> assignments take place.  The right-hand side expressions are evaluated from the left to
> the right."* —
> [First Steps Towards Programming](https://docs.python.org/3.14/tutorial/introduction.html#first-steps-towards-programming)

So there is no temporary because the *tuple* is the temporary:

```python
a, b = b, a                       # the right side packs (b, a) first, then unpacks
lo, hi = hi, lo                   # normalise a reversed range in one line
prev, curr = curr, prev + curr    # the Fibonacci step, straight from the tutorial
```

### The case the reference warns about

The *right* side is simultaneous. The *left* side is not:

```python
x = [0, 1]
i = 0
i, x[i] = 1, 2         # i is updated, THEN x[i] is updated
# x is [0, 2] — because by the time x[i] is assigned, i is already 1
```

That is the reference's own example and its own answer. If a target depends on another
target, split the statement.

## Arity is checked, and the errors say what is wrong

CPython's `Python/ceval.c` carries three distinct messages, and each one tells you the
shape mismatch directly:

- **`ValueError: not enough values to unpack (expected 3, got 2)`**
- **`ValueError: too many values to unpack (expected 2)`**
- **`ValueError: not enough values to unpack (expected at least 2, got 1)`** — the starred
  form, see [6c](06c-starred-unpacking.md)

This is a feature, not friction. A function that changes from returning a pair to returning
a triple breaks at every call site immediately, with a message naming both numbers, rather
than silently feeding a wrong third value into something downstream.

🔴 **The counterexample is `str` and any 2-element iterable**, which is why "unpacking
validates the shape" is only *mostly* true. The arity is checked; the element types are
not.

## Nested unpacking

Targets nest, and the parentheses on the left are structural rather than decorative:

```python
for (tenant, day), count in sorted(views.items()):
    report(tenant, day, count)

((a, b), (c, d)) = ((1, 2), (3, 4))
```

`dict.items()` yields `(key, value)` pairs —

> *"Return a new view of the dictionary's items (`(key, value)` pairs)."* —
> [`dict.items`](https://docs.python.org/3.14/library/stdtypes.html#dict.items)

— so when the key is itself a tuple, the loop target needs two levels. Square brackets work
identically; the reference's grammar allows a target list *"optionally enclosed in
parentheses or square brackets"*.

What the standard library hands you as tuples — `enumerate`, `zip`, `divmod`,
`str.partition`, `dict.items()` — and where the `_` convention helps or misleads, is
[6b · Unpacking what the library gives you](06b-unpacking-library-results.md).

## Gotchas

**★ Symptom: `ValueError: too many values to unpack (expected 2)` after a function grew a
third return value.** Cause: unpacking checks arity exactly; the callers were written for
the old shape. Fix: this is the error doing its job — update the call sites, or return a
named record so adding a field is not a breaking change.

```python
result = fetch_user(uid)          # a NamedTuple: new fields do not break callers
print(result.name, result.email)
```

**★ Symptom: `x, y = value` succeeded and produced two single characters.** Cause: `value`
was a 2-character string, and a string is a sequence — the arity matched. Fix: validate the
type, not just the shape.

```python
if not isinstance(value, tuple):
    raise TypeError(f"expected a pair, got {type(value).__name__}")
x, y = value
```

**★ Symptom: `a, b = b, a` works but `i, x[i] = 1, 2` gives a result nobody predicted.**
Cause: the right side is evaluated first and is therefore simultaneous, but *"overlaps
within the collection of assigned-to variables occur left-to-right"* — `i` is already the
new value when `x[i]` is assigned. Fix: split the statement so the dependency is visible.

```python
new_i, new_val = 1, 2
x[i] = new_val
i = new_i
```

**Symptom: unpacking a `set` bound values in an order that changed between runs.** Cause: a
set has no order, so which element lands in which name is not defined. Fix: never unpack a
set positionally; sort it first, or use a sequence.

```python
first, second = sorted(unique_ids)
```

**Symptom: unpacking a generator consumed it, and the next consumer saw nothing.** Cause:
unpacking iterates, and a generator is exhausted by iteration. Fix: materialise it once if
two consumers need it.

```python
values = tuple(gen)
lo, hi = values
```

## Interview questions

**★ How does `a, b = b, a` work without a temporary variable?**
The right-hand side is an expression list, so it packs into a tuple *before* any assignment
happens — the tutorial says *"the expressions on the right-hand side are all evaluated first
before any of the assignments take place"*. That tuple is the temporary. The reference calls
the effect 'simultaneous' for overlaps between the two sides, and then warns that overlaps
*within* the left-hand targets are left-to-right, which is the one case where the
simultaneity intuition fails.

**★ Why is `a, b = some_function()` better than indexing the result?**
Because it asserts the arity at the boundary. If the function starts returning three
things, every call site raises `ValueError: too many values to unpack (expected 2)` with
both numbers in the message, rather than silently continuing with a wrong `result[1]`. It
also names the values, which `result[0]` does not. The limit is that it validates *shape*,
not *type* — a 2-character string unpacks just as happily as a pair.

**Why does unpacking work on a generator but not always give you what you want?**
Because unpacking is defined in terms of iterables, not sequences — the reference says the
object *"must be an iterable with the same number of items as there are targets"*. A
generator satisfies that, but iterating it consumes it, so anything downstream sees an
exhausted generator. If two consumers need the values, materialise into a tuple or list
first.

**What happens if you unpack a `set`?**
It works, and the assignment order is not defined — a set has no ordering, so which element
gets bound to which name is an implementation artefact that can change between runs and
between insertion histories. Unpacking a set positionally is almost always a bug; sort it
into a sequence first if the positions are meant to mean something.

---

← [When a library requires the tuple](05c-when-a-library-requires-the-tuple.md) · [Topic index](README.md) · Next → [Unpacking what the library gives you](06b-unpacking-library-results.md)
