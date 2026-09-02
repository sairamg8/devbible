---
title: "The `for` statement: iterate over the thing, not over its indices"
sidebar_label: "1 · The `for` statement"
sidebar_position: 80
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `for` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-for-statement),
> the Library Reference
> [Ranges](https://docs.python.org/3.14/library/stdtypes.html#ranges),
> [`iter()`](https://docs.python.org/3.14/library/functions.html#iter),
> [`reversed()`](https://docs.python.org/3.14/library/functions.html#reversed),
> and the [Glossary](https://docs.python.org/3.14/glossary.html#term-iterable).
> Target: **CPython 3.14**.

**Python's `for` is not C's. It does not count; it consumes an iterator. The
reference is precise about the mechanism: the expression is evaluated **once**,
an iterator is created from it, and each item the iterator provides is assigned
to the target list using ordinary assignment rules. Everything else about
looping in Python follows from those two facts — why `for i in range(len(xs)):`
is a code smell, why the loop variable is still bound after the loop, why
mutating the list you are iterating goes wrong, and why `enumerate` and `zip`
exist at all.**

## The mechanism, from the reference

> *"The `starred_expression_list` expression is evaluated once; it should yield
> an iterable object. An iterator is created for that iterable. The first item
> provided by the iterator is then assigned to the target list using the
> standard rules for assignments […] and the suite is executed. This repeats for
> each item provided by the iterator."*

Three consequences worth having in mind:

**The iterable expression runs once.** `for row in expensive_query():` calls the
function a single time, not once per iteration. That is why a `for` over a
function call is fine and a `while i < len(expensive_query()):` is not.

**Assignment is ordinary assignment.** The target can be anything that can
appear on the left of `=`, including a tuple pattern, a subscript, or an
attribute:

```python
for name, score in pairs: ...           # tuple unpacking
for (a, b), c in nested: ...            # nested patterns
for obj.attr in values: ...             # legal, and almost always a mistake
for d["key"] in values: ...             # also legal, also a mistake
```

The last two are valid because the grammar says "target list", not "name". They
are worth knowing so you can read them, not so you can write them.

**Starred targets work since 3.11.** `for a, *rest in rows:` unpacks a variable
number of trailing values, the same as in a plain assignment.

## The loop variable outlives the loop

The reference states it plainly:

> *"Names in the target list are not deleted when the loop is finished, but if
> the sequence is empty, they will not have been assigned to at all by the
> loop."*

Both halves matter, and together they produce a specific bug:

```python
for user in users:
    if user.is_admin:
        break
send_notice(user)          # if `users` was EMPTY: NameError
                           # if no admin was found: the LAST user, silently
```

The loop leaks `user` on purpose — that is what makes the `for`/`else` and
`break` idiom work at all — but the leak is only meaningful when the loop
actually ran and actually broke. An empty iterable raises `NameError`; a loop
that finished without breaking leaves the *last* item bound, which is a
plausible-looking wrong answer. [`for`/`else`](03-for-else-and-while-else.md) is
the construct designed for exactly this, and
`next((u for u in users if u.is_admin), None)` is the expression form.

This is the opposite of a comprehension, which gets its own scope and leaks
nothing:

```python
[x for x in range(3)]
x                       # NameError — comprehension targets are local
for x in range(3): pass
x                       # 2 — loop targets are not
```

## Reassigning the loop variable does nothing

The reference includes its own example of this, and it is worth reproducing
because people genuinely try it:

```python
for i in range(10):
    print(i)
    i = 5             # this will not affect the for-loop
                      # because i will be overwritten with the next
                      # index in the range
```

The loop rebinds the target at the top of every iteration from the iterator, so
any assignment you make inside the body is discarded. There is no way to "skip
ahead" by changing the variable; the iterator holds the position, not the name.
To skip items, filter the iterable (`for i in range(0, 10, 2):`), use
`continue`, or use `itertools.islice`.

## `range` is a sequence, not a generator

The docs are explicit that *"rather than being a function, `range` is actually
an immutable sequence type"*. That has practical consequences people miss:

```python
r = range(1_000_000)
len(r)              # 1000000  — O(1), no iteration
r[500]              # 500      — indexable
r[::-1]             # range(999999, -1, -1) — slicing gives another range
500 in r            # True     — O(1) for ints: it does arithmetic, not a scan
"500" in r          # False    — O(n) for non-ints: it falls back to a scan
r == range(1_000_000)   # True — ranges compare by the sequence they represent
```

The containment asymmetry is the interesting one. `x in range(...)` is constant
time when `x` is an integer, because `range` can compute the answer; for any
other type it degrades to a linear scan that will never match. So
`if user_id in range(1, 1000):` is fast, and `if user_input in range(1, 1000):`
where `user_input` is a *string* is both slow and always false.

Two `range` objects compare equal when they represent the same sequence, even
with different arguments — `range(0) == range(2, 2, 3)` is `True`. That is a
sequence-semantics decision, not an identity one.

### Negative and empty ranges

```python
range(5, 0)         # empty — start >= stop with a positive step
range(5, 0, -1)     # 5, 4, 3, 2, 1
range(0, 10, 0)     # ValueError: range() arg 3 must not be zero
```

An empty range is falsy, iterates zero times, and — per the rule above — leaves
the loop target unassigned. That is the `NameError` path.

## The rule: iterate the thing

`for i in range(len(xs)):` is the single most common non-Pythonic loop, and
almost every instance has a better form:

| You wrote | You wanted |
|---|---|
| `for i in range(len(xs)): use(xs[i])` | `for x in xs: use(x)` |
| `for i in range(len(xs)): use(i, xs[i])` | `for i, x in enumerate(xs):` |
| `for i in range(len(a)): use(a[i], b[i])` | `for x, y in zip(a, b, strict=True):` |
| `for i in range(len(xs)-1, -1, -1):` | `for x in reversed(xs):` |
| `for i in range(len(xs)): if p(xs[i]):` | `for x in xs: if p(x):` |

It is not only style. The index form assumes the object supports `len` and
`[]` — so it breaks on a generator, a `set`, a file handle, or any iterator —
and it introduces an index that can go out of step with the data. The direct
form works on everything iterable.

The legitimate uses of `range(len(...))` are narrow: when you genuinely need to
*assign back* by index (`xs[i] = f(xs[i])`, though a comprehension is usually
better), and when you need the index without the element at all.

## The two-argument `iter`, the loop nobody knows

`iter` has a second form that turns a callable plus a sentinel into an iterable,
which replaces a whole class of `while True:` loops:

```python
# read fixed-size blocks until read() returns b""
for block in iter(lambda: f.read(4096), b""):
    process(block)

# consume a queue until it yields the sentinel
for job in iter(queue.get, None):
    handle(job)
```

It calls the zero-argument callable repeatedly and stops — without yielding it —
when the result equals the sentinel. Note **equals**, not "is falsy": this is the
one loop-until-sentinel construct in the language that does not have the
truthiness trap that [`while chunk := ...`](../05-truthiness/05-the-walrus-operator.md)
does.

## Gotchas

**Symptom — `NameError` on the loop variable after the loop.** Cause: the
iterable was empty, so the target was never assigned; the reference says names
are not deleted at the end but an empty sequence never binds them at all. Fix:
initialise before the loop, or use `for`/`else`, or use
`next((x for x in xs if p(x)), None)` which has an explicit no-match value.

**Symptom — code after a `for`/`break` loop uses the *last* item instead of the
matching one.** Cause: the loop completed without breaking, leaving the target
bound to the final item, which looks like a successful match. Fix: use
[`for`/`else`](03-for-else-and-while-else.md) so the "not found" path is
explicit, or set a flag, or use the `next(...)` expression form.

**Symptom — assigning to the loop variable inside the body has no effect.**
Cause: the target is rebound from the iterator at the top of every iteration;
the reference documents this with its own example. Fix: change the *iterable*
(`range(0, 10, 2)`, `itertools.islice`) or use `continue`.

**Symptom — `x in range(...)` is unexpectedly slow, or always `False`.** Cause:
the containment test is O(1) only for integers; for any other type it falls back
to a linear scan that cannot match. Fix: convert first (`int(user_input)` inside
a `try`), or use an explicit comparison — `1 <= n < 1000` reads better than a
`range` membership test anyway.

**Symptom — a loop over a function call re-runs the call every iteration.**
Cause: it does not — the iterable expression is evaluated once. If you are
seeing repeated calls, the call is inside the *body* or inside a `while`
condition. Fix: hoist it out of the `while` condition; a `for` already does this
for you.

**Symptom — `range(0, 10, 0)` raises `ValueError`.** Cause: a zero step would
never terminate, so it is rejected at construction. Fix: guard a computed step
before building the range; a step derived from data can be zero.

**Symptom — a loop over a `set` or `dict` gives a different order between two
runs of the program.** Cause: `set` iteration order depends on hashes, and
string hashing is randomised per process unless `PYTHONHASHSEED` is set. `dict`
is insertion-ordered and stable; `set` is not. Fix: `sorted(s)` when the order
is part of the output. Never rely on set order in a test assertion.

**Symptom — `for obj.attr in values:` compiles and does something surprising.**
Cause: the grammar allows any assignment target, not just a name, so each
iteration writes to the attribute. Fix: it is almost never intentional — use a
plain name and assign after the loop.

## Interview questions

**★ Q: How does a Python `for` loop actually work?**
The iterable expression is evaluated **once**, an iterator is created from it
with `iter()`, and each item from `__next__` is assigned to the target using
ordinary assignment rules until `StopIteration`. It never counts and never
indexes — which is why it works identically over a list, a file, a generator and
a database cursor.

**★ Q: Is the loop variable available after the loop?**
Yes. The reference states that names in the target list are not deleted when the
loop finishes — but if the iterable was empty they were never assigned, so
referring to them raises `NameError`. Both halves cause bugs: an empty iterable
gives a `NameError`, and a loop that ends without `break` leaves the *last*
item bound, which looks like a match.

**Q: Why doesn't a comprehension leak its variable when a `for` loop does?**
Because a comprehension has its own scope in Python 3 and a `for` statement does
not — the loop is executing in the enclosing function's namespace. (A walrus
inside a comprehension *does* leak, deliberately; see
[the walrus scoping rules](../05-truthiness/05b-walrus-rules-and-scope.md).)

**★ Q: What is wrong with `for i in range(len(items)):`?**
It assumes the object supports both `len()` and `[]`, so it breaks on
generators, sets, files and iterators; it introduces an index that can drift out
of step with the data; and it is longer than the alternatives. Use `for x in
items:`, `enumerate` when you need the index, `zip` when you are walking two
sequences, `reversed` when you are going backwards.

**Q: Is `range` a generator?**
No — it is an immutable **sequence type**. It has O(1) `len`, supports indexing
and slicing (slicing returns another `range`), compares equal to any range
representing the same sequence, and does O(1) containment for integers by
arithmetic. A generator has none of those.

**Q: Why is `500 in range(10**9)` fast but `"500" in range(10**9)` slow?**
For an integer, `range.__contains__` computes the answer from start/stop/step in
constant time. For any other type it cannot, so it falls back to iterating and
comparing — a scan that in this case will also never match.

**Q: What does the two-argument form of `iter` do?**
`iter(callable, sentinel)` calls the zero-argument callable repeatedly and stops
when the result **equals** the sentinel, without yielding it. It replaces
`while True: … if x == sentinel: break` and, unlike the `while chunk := read():`
idiom, it tests equality rather than truthiness — so a legitimately falsy item
does not end the loop.

**Q: Can you change the loop variable to skip ahead?**
No. The target is rebound from the iterator at the start of every iteration, so
any assignment in the body is overwritten — the reference includes exactly this
example. Change the iterable, or use `continue` or `itertools.islice`.

---

← Prev: [Assignment semantics and aliasing](../07-assignment-and-aliasing/README.md) · Index: [Control flow](README.md) · Next → [`enumerate` and `zip`](02-enumerate-and-zip.md)
