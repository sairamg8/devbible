---
title: "Starred unpacking: `first, *rest` and the list you always get"
sidebar_label: "2 · Starred unpacking"
sidebar_position: 131
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [Assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements)
> and [The `for` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-for-statement),
> and [PEP 3132 — Extended Iterable Unpacking](https://peps.python.org/pep-3132/).
> Target: **CPython 3.14**.

**One target in an unpacking assignment may be starred, and it absorbs whatever
is left over. The reference is exact about the arithmetic — the iterable must
have *"at least as many items as there are targets in the target list, minus
one"* — and about the result: **a list**, always, even when the source was a
tuple, a string or a generator, and even when it ends up empty. That last
detail is the one that catches people: `first, *rest = [1]` succeeds and leaves
`rest` as `[]` rather than raising.**

## The three positions

```python
first, *rest = [1, 2, 3, 4]        # first=1     rest=[2, 3, 4]
*init, last = [1, 2, 3, 4]         # init=[1,2,3] last=4
first, *middle, last = [1, 2, 3, 4]  # first=1  middle=[2,3]  last=4
```

The reference describes the algorithm directly:

> *"The first items of the iterable are assigned, from left to right, to the
> targets before the starred target. The final items of the iterable are
> assigned to the targets after the starred target. A list of the remaining
> items in the iterable is then assigned to the starred target (the list can be
> empty)."*

So the non-starred targets are filled first, from both ends, and the star takes
the middle. Three consequences:

**The minimum length is the number of plain targets.** `first, *rest = []`
raises `ValueError: not enough values to unpack (expected at least 1, got 0)` —
note that the message says *at least*, which is how you can tell a starred
unpack from a plain one in a traceback.

**There is no maximum.** A starred target is why `head, *tail = huge_list`
cannot raise "too many values".

**The star always produces a `list`.** Not a tuple, not the source type:

```python
first, *rest = (1, 2, 3)        # rest is [2, 3] — a LIST, from a tuple
first, *rest = "hello"          # rest is ['e','l','l','o'] — chars, in a list
first, *rest = range(5)         # rest is [1, 2, 3, 4]
```

If you needed a tuple back, convert explicitly: `rest = tuple(rest)`.

## Only one star

```python
a, *b, *c = [1, 2, 3]     # SyntaxError: two starred expressions in assignment
```

Two stars would be ambiguous — there is no rule for how to divide the middle —
so the grammar rejects it. The same applies inside a nested target: one star per
target list, though each nesting level gets its own:

```python
(a, *b), (c, *d) = [1, 2, 3], [4, 5]     # fine — one star per inner list
```

## `*_` — absorb and discard

`_` is a name like any other, so `*_` binds a list you intend to ignore:

```python
first, *_ = get_row()                 # I only want the first field
*_, last = path.split("/")            # I only want the last segment
name, _, _, salary, *_ = csv_row      # positional skipping
```

This is a convention, not a language feature — the list is still built, so
`*_ = enormous_iterable` really does allocate. For a big source, prefer
`next(iter(x))` for the first item or `itertools.islice` for a window.

The convention has one real hazard: in code that also uses `_` for
internationalisation (`gettext` installs `_` as a builtin), unpacking into `_`
shadows the translation function. That is a genuine bug in web codebases and the
usual fix is `__` or a descriptive name.

## Starred targets in `for` loops

The `for` statement's target list follows the same rules, and starred targets
have been allowed there since 3.0 for the target and — per the reference —
starred elements are allowed in the *expression* list since 3.11:

```python
for name, *scores in rows:            # variable-width rows
    print(name, sum(scores) / len(scores) if scores else 0)

for first, *_ in records:             # only the first column
    ...
```

`for name, *scores in rows:` is the readable way to handle a CSV where each row
has a label and an unknown number of measurements — the alternative is
`row[0], row[1:]` with the index arithmetic
[topic 08](../08-control-flow/01-the-for-statement.md) argues against.

## Where it replaces slicing

Starred unpacking and slicing overlap, and the unpack is usually clearer because
it names the pieces:

| Slicing | Unpacking |
|---|---|
| `head, tail = xs[0], xs[1:]` | `head, *tail = xs` |
| `init, last = xs[:-1], xs[-1]` | `*init, last = xs` |
| `a, b, rest = xs[0], xs[1], xs[2:]` | `a, b, *rest = xs` |

Two real differences, though:

**Unpacking validates the length; slicing does not.** `head, *tail = []` raises;
`xs[0]` on an empty list also raises, but `xs[1:]` quietly gives `[]`. So the
sliced version of a two-element expectation can silently produce nonsense where
the unpack would have told you.

**Slicing works only on sequences.** Unpacking works on any iterable, which is
why `first, *rest = some_generator` is legal and `some_generator[0]` is not.
The cost is that unpacking a generator **consumes it entirely** — the star has
to reach the end to know what is left — so `first, *rest = infinite_gen` never
returns.

## Gotchas

**Symptom — `rest` is a list when you expected a tuple.** Cause: the starred
target is documented to receive *"a list of the remaining items"*, regardless of
the source type. Fix: convert explicitly — `rest = tuple(rest)` — and be aware
that code comparing `rest == (2, 3)` will silently be `False`.

**Symptom — `first, *rest = [1]` does not raise, and `rest` is empty.** Cause:
the star's list *"can be empty"*; the minimum length is only the count of
non-starred targets. Fix: if an empty remainder is an error, check it —
`if not rest: raise`. The unpack will not do it for you.

**Symptom — `ValueError: not enough values to unpack (expected at least 1, got
0)`.** Cause: a starred unpack over an empty iterable. The words *at least* are
the signal that a star was involved, which is useful when reading someone else's
traceback. Fix: guard the empty case before unpacking.

**Symptom — `SyntaxError: two starred expressions in assignment`.** Cause: more
than one star in a single target list; there is no rule for splitting the middle
between them. Fix: one star per target list — nesting gets you a second one:
`(a, *b), (c, *d) = ...`.

**Symptom — `first, *rest = my_generator` never returns.** Cause: the star must
reach the end of the iterable to know what remains, so an infinite or very slow
generator is drained forever. Fix: `first = next(gen)` and keep the generator,
or bound it with `itertools.islice`.

**Symptom — unpacking into `_` breaks translations.** Cause: `gettext.install()`
puts `_` in builtins, and `first, *_ = row` rebinds it in the local scope,
shadowing the translation function for the rest of that function. Fix: use `__`
or a descriptive name in any module that uses `_()` for i18n.

**Symptom — `*_ = big_iterable` uses a lot of memory.** Cause: the discard
convention still builds the list; `_` is an ordinary name. Fix: use
`next(iter(x))` for a first item, `itertools.islice` for a prefix, or
`collections.deque(x, maxlen=1)` for the last.

**Symptom — a starred unpack on a `dict` produces keys.** Cause: iterating a
mapping yields keys, and the star inherits that. Fix: `.values()` or `.items()`,
as with any other unpack.

**Symptom — code using a starred element in a `for`'s expression list fails on
an older interpreter.** Cause: starred elements in the `for` *expression* list
(`for x in *a, *b:`) are 3.11+; starred *targets* have been allowed much longer.
Fix: `itertools.chain(a, b)`, which reads better anyway and works everywhere.

## Interview questions

**★ Q: What type is `rest` in `first, *rest = (1, 2, 3)`?**
A **list**, `[2, 3]` — always a list, whatever the source type. The reference
says a list of the remaining items is assigned to the starred target. So
unpacking a tuple gives you a list, unpacking a string gives you a list of
characters, and an equality test against a tuple will silently fail.

**★ Q: Does `first, *rest = [1]` raise?**
No. The starred target's list *"can be empty"*, and the minimum length is just
the number of non-starred targets — here, one. `rest` is `[]`. If an empty
remainder is an error in your domain, you have to check for it yourself.

**★ Q: Can you have two starred targets?**
No — `SyntaxError: two starred expressions in assignment`, because there is no
rule for how to divide the middle between them. You get one star per target
list, so nesting is the way to have more than one:
`(a, *b), (c, *d) = ...`.

**Q: How do you tell from a traceback whether a star was involved?**
The message says *at least*: `not enough values to unpack (expected at least 1,
got 0)` for a starred unpack, versus `(expected 3, got 2)` for a plain one.

**Q: `head, *tail = xs` or `head, tail = xs[0], xs[1:]` — which is better?**
Usually the unpack: it names both pieces in one expression, and it *validates*
the length, where the sliced form silently produces `[]` for a short input.
Slicing is the right choice when you need a tuple back rather than a list, or
when the source is a sequence you must not consume — unpacking a generator
drains it.

**Q: Why does `first, *rest = infinite_generator` hang?**
Because the star has to reach the end of the iterable to know which items are
"remaining". There is no lazy starred unpack. Use `next(gen)` to take one item
and keep the generator, or `itertools.islice` for a bounded prefix.

**Q: What is wrong with `first, *_ = row` in a Django or Flask app?**
Possibly nothing — but if the project calls `gettext.install()`, `_` is the
translation function in builtins, and the unpack shadows it locally for the rest
of the function. Any later `_("Hello")` in that function raises `TypeError`.
Use `__` or a real name.

---

← Prev: [Tuple assignment](01-tuple-assignment.md) · Index: [Unpacking](README.md) · Next → [`*` and `**` in calls and literals](03-star-args-and-literals.md)
