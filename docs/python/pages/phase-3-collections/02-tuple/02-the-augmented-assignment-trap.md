---
title: "t[0] += [1] raises TypeError and appends anyway — because augmented assignment is an assignment, and the mutation happens before the assignment fails"
sidebar_label: "2 · The `+=` that raises and mutates"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 FAQ —
> [Why does a_tuple[i] += ['item'] raise an exception when the addition works?](https://docs.python.org/3.14/faq/programming.html#why-does-a-tuple-i-item-raise-an-exception-when-the-addition-works);
> the language reference on
> [Augmented assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#augmented-assignment-statements)
> and [`object.__iadd__`](https://docs.python.org/3.14/reference/datamodel.html#object.__iadd__);
> the [tutorial on tuples](https://docs.python.org/3.14/tutorial/datastructures.html#tuples-and-sequences);
> and CPython 3.14 [`Objects/abstract.c`](https://github.com/python/cpython/blob/3.14/Objects/abstract.c)
> for the exact error text. Documentation-verified — **no sandbox run**.
> Version spine: **CPython 3.14**.

**`some_tuple[0] += ['x']` is the only construct in Python that both raises an exception
and completes the operation you asked for. The list *is* extended. The `TypeError` *is*
raised. Both are true, in that order, and if the exception is caught and logged by a
generic handler three frames up, the data change survives and the error looks
transient. This page is the mechanism, verbatim from the FAQ that exists because of how
often it bites, and every safe way to write what you meant.**

## The two cases the FAQ separates

### Case 1 — no surprise

```python
a_tuple = (1, 2)
a_tuple[0] += 1
```

> *"The reason for the exception should be immediately clear: ``1`` is added to the object
> ``a_tuple[0]`` points to (``1``), producing the result object, ``2``, but when we attempt
> to assign the result of the computation, ``2``, to element ``0`` of the tuple, we get an
> error because we can't change what an element of a tuple points to."* —
> [the FAQ](https://docs.python.org/3.14/faq/programming.html#why-does-a-tuple-i-item-raise-an-exception-when-the-addition-works)

The error text is `TypeError: 'tuple' object does not support item assignment` — the
same string the tutorial prints for `t[0] = 88888`, and it comes from a single
`type_error("'%.200s' object does not support item assignment", s)` call in CPython's
`Objects/abstract.c`. Nothing was changed; `int` has no in-place add, so `1 + 1` built a
new `2` and the write is what failed.

### Case 2 — the one that costs a night

```python
a_tuple = (['foo'], 'bar')
a_tuple[0] += ['item']
```

Same exception. Different aftermath:

> *"The exception is a bit more surprising, and even more surprising is the fact that even
> though there was an error, **the append worked**"* — the FAQ

`a_tuple[0]` is now `['foo', 'item']`. The traceback says the operation is not supported.
The list disagrees.

## Why, exactly

Two facts combine. The FAQ states both:

> *"To see why this happens, you need to know that **(a) if an object implements an
> `__iadd__` magic method, it gets called when the `+=` augmented assignment is executed,
> and its return value is what gets used in the assignment statement**; and **(b) for
> lists, `__iadd__` is equivalent to calling `extend` on the list and returning the
> list.**"*

So the statement decomposes into two steps, and the FAQ writes the decomposition out:

```python
# What `a_tuple[0] += ['item']` actually does, per the FAQ:
result = a_tuple[0].__iadd__(['item'])   # step 1: mutates the list in place,
                                         #         returns that same list
a_tuple[0] = result                      # step 2: TypeError — tuples are immutable
```

> *"The `__iadd__` succeeds, and thus the list is extended, but even though ``result``
> points to the same object that ``a_tuple[0]`` already points to, that final assignment
> still results in an error, because tuples are immutable."*

**Step 1 has already happened when step 2 raises.** There is no rollback. Python does not
know or care that the assignment would have been a no-op — the store-to-subscript is
attempted unconditionally, and the tuple rejects it.

The general rule is in the language reference:

> *"An augmented assignment evaluates the target (which, unlike normal assignment
> statements, cannot be an unpacking) and the expression list, performs the binary
> operation specific to the type of assignment on the two operands, and **assigns the
> result to the original target**.  The target is only evaluated once."* —
> [Augmented assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#augmented-assignment-statements)

> *"An augmented assignment statement like ``x += 1`` can be rewritten as ``x = x + 1`` to
> achieve a similar, but not exactly equal effect. In the augmented version, ``x`` is only
> evaluated once. Also, **when possible, the actual operation is performed *in-place***,
> meaning that rather than creating a new object and assigning that to the target, the old
> object is modified instead."*

*"Assigns the result to the original target"* is the load-bearing clause. `+=` is an
assignment statement first and an operator second.

## What "it worked" looks like in production

The mutation survives because it happened before the exception, and exceptions get caught:

```python
def apply_overrides(config, extra_scopes):
    # config is ("prod", ["read"]) — a tuple someone called immutable
    try:
        config[1] += extra_scopes
    except TypeError:
        logger.warning("config is immutable, skipping overrides")
        return config
    return config
```

The log line says the overrides were skipped. `config[1]` is `["read", "write",
"admin"]`. This is not a hypothetical shape — a `try/except TypeError` around a
config-merge path is exactly the kind of defensive code that gets written after the *first*
`TypeError`, and it converts a loud failure into a silent one.

The four safe ways to write what you actually meant, the fact that `+=` on a *name*
bound to a tuple is perfectly legal, and the full list of operators that behave this way
are on the next page: [2b · Writing what you meant](02b-writing-what-you-meant.md).

## Gotchas

**★ Symptom: a `TypeError: 'tuple' object does not support item assignment` in the logs,
and the data changed anyway.** Cause: `t[i] += mutable` — `__iadd__` ran and mutated in
place before the store to the tuple slot failed. Fix: decide which half you meant and
write only that half.

```python
# meant to mutate:
t[i].extend(more)
# meant to rebuild:
t = t[:i] + (t[i] + more,) + t[i + 1:]
```

**★ Symptom: `except TypeError: pass` around a config merge turned a crash into corrupt
config.** Cause: the exception is raised *after* the mutation, so swallowing it hides a
completed write. Fix: never catch this one — it is a programming error, not a runtime
condition. Remove the handler and fix the line it was hiding.

```python
# Before
try:
    config[1] += extra
except TypeError:
    pass
# After — no exception to catch, because nothing illegal is attempted
config[1].extend(extra)
```

**Symptom: the same code works on a list-of-lists and fails on a tuple-of-lists.** Cause:
`lst[0] += [...]` succeeds because a list *does* support item assignment, so step 2
completes; the tuple version fails at step 2. Fix: if the outer container is genuinely
being modified, it should be a list — the tuple was documenting an intent the code does
not honour.

**Symptom: a unit test asserts `pytest.raises(TypeError)` and passes, but the fixture is
polluted for the next test.** Cause: the mutation escaped the `raises` block; the list is
shared with the fixture. Fix: assert on the contents too, so the test actually pins the
behaviour you rely on.

```python
with pytest.raises(TypeError):
    record[0] += ["x"]
assert record[0] == ["x"]     # 🔴 this is what really happened
```

## Interview questions

**★ `t = (['a'], 'b')` and then `t[0] += ['c']`. What happens?**
Both things happen. `list.__iadd__(['c'])` runs first, extends the list in place to
`['a', 'c']` and returns that same list object; then Python performs the assignment part
of the augmented assignment — `t[0] = result` — and the tuple raises `TypeError: 'tuple'
object does not support item assignment`. The exception propagates, the mutation stays.
The FAQ's own words: *"The `__iadd__` succeeds, and thus the list is extended, but … that
final assignment still results in an error, because tuples are immutable."*

**★ Why does `t[0] += 1` on `t = (1, 2)` behave differently from the list case?**
It does not, mechanically — the same two steps run — but `int` has no `__iadd__`, so step
1 computes a brand-new `2` and mutates nothing. Only step 2 is observable, and it fails.
The difference in outcome comes entirely from whether the contained object supports
in-place modification, which is the same "references frozen, objects not" distinction
from [1 · What immutability freezes](01-what-immutability-freezes.md).

**Should you catch the `TypeError` from a tuple item assignment?**
No. It signals that the code is trying to mutate something declared immutable, which is a
bug in the code, not a condition in the data. Worse, catching it specifically hides the
fact that a mutation already happened — the handler suppresses the *report* without
suppressing the *effect*. Fix the assignment; delete the handler.

**Why can't the interpreter just skip the assignment when the result is the same
object?**
Because `+=` is defined as an assignment statement, and the assignment is what gives it
its meaning — `d['k'] += 1` must write back. The interpreter would have to special-case
"the returned object is identical to the one already stored, therefore skip the store",
which would silently make an illegal mutation legal for some types and not others. The
FAQ's framing is that the current behaviour is the consistent one: *"It is the assignment
part of the operation that produces the error, since a tuple is immutable."*

---

← [Thread safety and identity](01b-thread-safety-and-identity.md) · [Topic index](README.md) · Next → [Writing what you meant](02b-writing-what-you-meant.md)
