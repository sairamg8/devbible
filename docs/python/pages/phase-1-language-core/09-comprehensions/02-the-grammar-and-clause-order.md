---
title: "Clause order: the for clauses read left to right exactly like nested loops, while the output expression sits in front of them"
sidebar_label: "2 · Grammar and clause order"
sidebar_position: 91
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [Displays for lists, sets and dictionaries](https://docs.python.org/3.14/reference/expressions.html#displays-for-lists-sets-and-dictionaries),
> the [Functional Programming HOWTO](https://docs.python.org/3.14/howto/functional.html#generator-expressions-and-list-comprehensions),
> and the Library Reference
> [`itertools`](https://docs.python.org/3.14/library/itertools.html).
> Target: **CPython 3.14**.

**A comprehension is a nested loop with the innermost body hoisted to the front.
Read it in two passes: skip to the first `for`, read every clause left to right
as if they were nested `for` and `if` statements, then come back to the head and
read the element expression as the loop body. Getting the clause order backwards
is the single most common comprehension bug, and it does not fail loudly — with
two same-typed iterables it produces a wrong-shaped result that looks plausible.**

## The grammar, exactly

The reference gives four productions:

```text
comprehension : assignment_expression comp_for
comp_for      : ["async"] "for" target_list "in" or_test [comp_iter]
comp_iter     : comp_for | comp_if
comp_if       : "if" or_test [comp_iter]
```

Five things fall out of this that are worth reading off the grammar rather than
memorising:

**At least one `for`, then anything.** `comprehension` requires exactly one
`comp_for`; that clause may be followed by a `comp_iter`, which is itself either
another `for` or an `if`, recursively. So `for`, `if`, `if`, `for`, `if` is legal
and `if` first is not.

**The head is an `assignment_expression`, not a plain expression.** That is why a
walrus is legal in the element position — `[(y := f(x)) for x in xs]` — and why
it binds outside the comprehension. It is also why `yield` is not there: the
reference bans it separately.

**The iterable is an `or_test`, not a full expression.** That is why a bare
conditional expression or a lambda after `in` needs parentheses:
`[x for x in (a if flag else b)]` is required; without the parentheses the
grammar cannot reach the `if`. It is also why `:=` is banned in that position —
see [the walrus rules](../05-truthiness/05b-walrus-rules-and-scope.md).

**The filter is also an `or_test`.** Same restriction: `[x for x in xs if (y if
p else z)]` needs its parentheses. And there is no `else` branch anywhere in
`comp_if` — a filter keeps or skips, and that is all it can do.

**The target is a `target_list`.** Everything you can put on the left of `=` in
a `for` statement works here — tuple unpacking, nested patterns, starred targets:

```python
[name for name, score in pairs]
[a + b for (a, b), c in nested]
[first for first, *rest in rows]
```

## The expansion, from the documentation

The reference states the semantics in one sentence:

> *"the elements of the new container are those that would be produced by
> considering each of the `for` or `if` clauses a block, nesting from left to
> right, and evaluating the expression to produce an element each time the
> innermost block is reached."*

The Functional HOWTO gives the mechanical translation, which is the thing to
hold in your head:

```python
for expr1 in sequence1:
    if not (condition1):
        continue   # Skip this element
    for expr2 in sequence2:
        if not (condition2):
            continue   # Skip this element
        ...
        for exprN in sequenceN:
            if not (conditionN):
                continue   # Skip this element

            # Output the value of
            # the expression.
```

That block is quoted verbatim from the HOWTO. The rule to take away: **strip the
element expression off the front, put `for` and `if` on their own lines in the
order written, and put the element expression at the bottom.** If the result is
a loop you would not have written, the comprehension is wrong.

```python
# comprehension
[f(x, y) for x in outer if p(x) for y in inner(x) if q(y)]

# the loop it means
result = []
for x in outer:
    if p(x):
        for y in inner(x):
            if q(y):
                result.append(f(x, y))
```

Note that the HOWTO's expansion uses `continue`, not an `if` block. That is not
just a stylistic choice on the documentation's part — it is the shape that makes
the "each clause is a block, nesting from left to right" rule obvious, because
every clause becomes one level regardless of whether it is a `for` or an `if`.

## Flattening: the order everyone gets backwards

```python
grid = [[1, 2], [3, 4], [5, 6]]

[cell for row in grid for cell in row]     # correct → [1, 2, 3, 4, 5, 6]
[cell for cell in row for row in grid]     # NameError: name 'row' is not defined
```

The wrong version raises here only because `row` happens not to exist yet. That
is luck. The reason people write it backwards is that the *element* expression
comes first, so the eye reads `cell` and then reaches for the thing `cell` comes
from — but `cell` is the innermost variable and its `for` clause must be
**last**. The mnemonic that survives: **outer loop first, same as if you had
typed the loops.**

When both names *do* exist, the mistake is silent:

```python
rows = [[1, 2], [3, 4]]
row = [9, 9]                                # a leftover name from earlier code

[cell for cell in row for row in rows]      # runs; produces 4 elements of 9
```

No exception, wrong data. This is the honest argument for `itertools.chain`
when flattening is all you are doing:

```python
from itertools import chain
list(chain.from_iterable(grid))             # unambiguous, and no clause order to get wrong
```

`chain.from_iterable` takes one iterable of iterables and yields their
concatenation. There is nothing to reverse, so there is nothing to get backwards.

## `[x for x in xs]` is not how you copy a list

The identity comprehension is a real pattern in code that should not be there:

```python
copied = [x for x in xs]      # works
copied = list(xs)             # what you meant
copied = xs[:]                # equivalent for a list, and no name to invent
```

`list(xs)` goes through the list constructor, which can size the result up front
from `len(xs)` when the argument is sized; the comprehension appends one element
at a time and cannot. More importantly, `list(xs)` says "copy" and the
comprehension says "transform" while doing nothing — a reader has to check the
head expression to find out it is a no-op. Both produce a shallow copy, with all
the aliasing consequences that implies; see
[Shallow copy](../07-assignment-and-aliasing/08-shallow-copy.md).

## Gotchas

**★ Symptom — flattening a list of lists produces the wrong values, or a
`NameError` naming the outer variable.** Cause: the `for` clauses were written
inner-first. The element expression comes first but the clauses must be in
outer-to-inner order, the same order you would type the nested `for` statements.
Fix: `[cell for row in grid for cell in row]`; or sidestep the ordering entirely
with `list(itertools.chain.from_iterable(grid))`.

**★ Symptom — the inner-first mistake runs without error and produces
plausible-looking data.** Cause: a name from earlier in the function happens to
be bound to something iterable, so the reversed clause order resolves against the
wrong object. Fix: there is no runtime defence — this is why the two-pass reading
discipline matters, and why a flatten should be `chain.from_iterable`.

**Symptom — `SyntaxError` on `[x for x in a if flag else b]` where you wanted to
choose the *iterable*.** Cause: the grammar allows only an `or_test` after `in`,
and a conditional expression is not one. Fix: parenthesise it —
`[x for x in (a if flag else b)]`.

**Symptom — `SyntaxError` on a comprehension that starts with `if`.** Cause:
`comprehension` is `assignment_expression comp_for` — the element expression and
then at least one `for` are mandatory, and every `if` is a `comp_iter` hanging
off a `for`. Fix: there is no filter-only comprehension; you want
`filter(pred, xs)` or `[x for x in xs if pred(x)]`.

**Symptom — `TypeError: 'int' object is not iterable` from a single-clause
comprehension.** Cause: the iterable expression is not iterable — very often a
`len(...)` where `range(len(...))` was meant, or a scalar returned by a function
that returns `None` or a count on some paths. Fix: check what the function
actually returns on the failing input; and prefer iterating the object over
iterating its length, as in
[The `for` statement](../08-control-flow/01-the-for-statement.md).

**Symptom — `[x for x in xs]` shows up in review and nobody can say why it is
there.** Cause: it is an identity comprehension — a copy written as a transform.
Fix: `list(xs)` if you want a copy, or delete it if the original was already a
list you did not need to copy.

**Symptom — a comprehension over `d.items()` unpacks into one name and every
element is a tuple.** Cause: the target list is `for pair in d.items()` rather
than `for k, v in d.items()`; both are legal so nothing raises until you index
the tuple. Fix: unpack in the target — the grammar allows any assignment target,
which is exactly what target-list unpacking is for.

**Symptom — a comprehension assigns to an attribute or a subscript and a
reviewer calls it clever.** Cause: `target_list` permits `obj.attr` and
`d[key]`, so `[0 for obj.attr in values]` compiles. Fix: do not. It is legal for
the same reason it is legal in a `for` statement, and it is a mistake for the
same reason — see the target-list note in
[The `for` statement](../08-control-flow/01-the-for-statement.md).

## Interview questions

**★ Q: In `[y for row in grid for y in row]`, why is that the correct order and
not the reverse?**
Because the `for` clauses execute left to right as nested blocks: the leftmost
clause is the outer loop. The reference says the elements are those produced by
*"considering each of the `for` or `if` clauses a block, nesting from left to
right"*. The confusing part is that the *element* expression is written first
even though it corresponds to the innermost body — so the head of the
comprehension and the tail of the equivalent loop are the same code.

**★ Q: How do you read an unfamiliar multi-clause comprehension quickly?**
Ignore the head. Read from the first `for` to the end, writing each clause on its
own line and indenting one more level each time. Then put the head expression at
the bottom of that block as the body. If that loop looks wrong, the comprehension
is wrong; if it looks like a loop you would happily have written, the
comprehension is fine.

**Q: Where can you put an `if` in a comprehension, and where can you not?**
After any `for` clause, as many times as you like, including between two `for`
clauses. You cannot put one before the first `for` — the grammar requires the
element expression then at least one `comp_for` — and you cannot attach an
`else` to it. A branch in the *value* is a conditional expression in the head,
which is a different construct entirely.

**Q: Why does `[x for x in a if flag else b]` not parse?**
Because `comp_if` is defined as `"if" or_test` with no `else` branch. The
comprehension's `if` is a filter, and a filter has exactly two outcomes: keep or
skip. There is nothing for an `else` to mean.

**Q: Can the comprehension target be something other than a plain name?**
Yes — the grammar says `target_list`, the same production the `for` statement
uses. Tuple unpacking, nested tuple patterns and starred targets all work, and
so do attribute and subscript targets, which are legal and are almost always a
mistake.

**Q: Is `[x for x in xs]` a reasonable way to copy a list?**
It produces a correct shallow copy, but `list(xs)` is clearer and gives the
constructor the chance to preallocate from `len(xs)`. The comprehension form also
misleads a reader into looking for the transformation that is not there.

**Q: Why does the documentation's expansion use `continue` rather than an
indented `if` body?**
Because it makes every clause exactly one nesting level, `for` and `if` alike,
which is precisely the reference's "considering each of the `for` or `if`
clauses a block" rule made visible. It also matches what the compiler does —
a failed filter jumps back to the loop header.

---

← Prev: [The four forms](01-the-four-forms.md) · Index: [Comprehensions](README.md) · Next → [Multiple clauses](02b-multiple-clauses.md)
