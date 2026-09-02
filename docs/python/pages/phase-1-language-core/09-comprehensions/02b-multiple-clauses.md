---
title: "Multiple for clauses are a Cartesian product, not a zip — and every clause after the first is re-evaluated for each outer value"
sidebar_label: "2b · Multiple clauses"
sidebar_position: 92
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [Displays for lists, sets and dictionaries](https://docs.python.org/3.14/reference/expressions.html#displays-for-lists-sets-and-dictionaries),
> the [Functional Programming HOWTO](https://docs.python.org/3.14/howto/functional.html#generator-expressions-and-list-comprehensions),
> and the Library Reference
> [`itertools.product`](https://docs.python.org/3.14/library/itertools.html#itertools.product),
> [`itertools.chain`](https://docs.python.org/3.14/library/itertools.html#itertools.chain),
> [`zip`](https://docs.python.org/3.14/library/functions.html#zip).
> Target: **CPython 3.14**.

**Two `for` clauses multiply; they do not pair. That is the single most expensive
misreading of comprehension syntax, because the wrong version runs, returns a
list of the right element type, and is quadratic. This chunk covers what happens
once a comprehension has more than one clause: the product semantics, the fact
that every iterable after the leftmost is rebuilt per outer value, where an `if`
goes so that it filters the thing you meant, and the point at which `itertools`
says it better.**

## Multiple `for` clauses are a Cartesian product

The HOWTO is explicit that the clauses are not parallel:

> *"The sequences do not have to be the same length, because they are iterated
> over from left to right, **not** in parallel. For each element in `sequence1`,
> `sequence2` is looped over from the beginning."*

and:

> *"when there are multiple `for...in` clauses but no `if` clauses, the length of
> the resulting output will be equal to the product of the lengths of all the
> sequences."*

The documented example:

```python
>>> seq1 = 'abc'
>>> seq2 = (1, 2, 3)
>>> [(x, y) for x in seq1 for y in seq2]
[('a', 1), ('a', 2), ('a', 3),
 ('b', 1), ('b', 2), ('b', 3),
 ('c', 1), ('c', 2), ('c', 3)]
```

Nine elements from three and three. If you wanted three — the pairs at matching
positions — you wanted `zip`, and a comprehension cannot express parallel
iteration at all:

```python
[(x, y) for x, y in zip(seq1, seq2)]        # 3 elements
[(x, y) for x in seq1 for y in seq2]        # 9 elements
```

That is a quadratic-versus-linear difference on real data. On two lists of ten
thousand rows each it is one hundred million tuples, and the first symptom is
the process being killed rather than an exception you can read. See
[`enumerate` and `zip`](../08-control-flow/02-enumerate-and-zip.md) for `zip`'s
own trap — it truncates to the shortest input unless you pass `strict=True`.

When the product is genuinely what you want, say so:

```python
from itertools import product
[(x, y) for x, y in product(seq1, seq2)]    # same 9 elements, and it reads as a product
```

`itertools.product` yields tuples in the same order the nested clauses would —
rightmost varying fastest — so the two are interchangeable in output. Use
`product` when the product is the point and nested clauses when a later iterable
depends on an earlier target, because `product` cannot express that dependency.

## A later clause can use an earlier target

This is the reason multi-`for` comprehensions exist at all, and it is the reason
the leftmost iterable is special (chunk 3 covers why). The reference's own
example:

> *"Subsequent `for` clauses and any filter condition in the leftmost `for`
> clause cannot be evaluated in the enclosing scope as they may depend on the
> values obtained from the leftmost iterable. For example:
> `[x*y for x in range(10) for y in range(x, x+10)]`."*

Note `range(x, x+10)` — the second iterable is recomputed for every `x`. That is
nested-loop semantics, not a broadcast, and it is the difference between a
comprehension and a vectorised operation in a numeric library.

```python
[(dept, emp) for dept in departments for emp in dept.employees]
[c for word in words for c in word if c.isalpha()]
```

The re-evaluation is invisible and it is where the cost hides. If the later
iterable does *not* depend on the earlier target, it is still rebuilt every time:

```python
# allowed_ids is rebuilt len(orders) times
[(o, i) for o in orders for i in set(load_allowed())]

# hoisted: built once
allowed = set(load_allowed())
[(o, i) for o in orders for i in allowed]
```

Nothing in the language stops the first version. There is no loop-invariant
hoisting in CPython for an arbitrary call, because the call could have side
effects or return something different each time.

## Multiple `if` clauses are `and`, with a caveat

`comp_if` may be followed by another `comp_if`, so filters chain:

```python
[x for x in xs if x is not None if x.active]
[x for x in xs if x is not None and x.active]     # same result
```

They are equivalent in outcome and both short-circuit — the second `if` clause is
only reached when the first passed, exactly as `and` is only evaluated on the
right when the left is truthy (see
[`and`/`or` return operands](../05-truthiness/03-and-or-return-operands.md)).
Prefer whichever reads better: two clauses often read better when the conditions
are unrelated (a validity guard and a business filter), and `and` reads better
when they form one predicate. What you must not do is put the null check *after*
the attribute access in either form — the short-circuit only protects you in the
order you wrote.

## Where the `if` goes decides what it filters

An `if` may sit between two `for` clauses, filtering the outer loop before the
inner one runs:

```python
[cell for row in grid if row for cell in row]     # skip empty rows entirely
[cell for row in grid for cell in row if cell]    # keep every row, filter cells
```

Those are different programs. The first never enters the inner loop for a falsy
row, which matters when the inner iterable is expensive to build or when
entering it would raise. The second builds the inner iterator for every row and
discards elements one at a time.

```python
# guards the attribute access — the `if` runs before `row.cells` is touched
[c for row in rows if row is not None for c in row.cells]

# does NOT guard it — `row.cells` is evaluated first and raises
[c for row in rows for c in row.cells if row is not None]
```

The second is a real bug and it is easy to write, because "put the filters at
the end" is a habit people bring from single-clause comprehensions where it is
harmless.

## Three clauses is the line

Two `for` clauses is a shape most readers hold: outer, inner. Three is where the
comprehension stops being a description and becomes a puzzle, and the reason is
not aesthetic — it is that the product of three lengths is where accidental
quadratic-or-worse cost lives, and a reader scanning for performance problems
does not see a nested loop when there is no indentation to see.

```python
# don't
[t for org in orgs for team in org.teams for t in team.members if t.active]

# do
def active_members(orgs):
    for org in orgs:
        for team in org.teams:
            yield from (t for t in team.members if t.active)
```

The generator function is one line longer, is testable on its own, and has a
name that says what the three levels mean. [When it should have been a
loop](08-when-it-should-have-been-a-loop.md) makes the full argument.

## Gotchas

**★ Symptom — a comprehension over two lists returns `len(a) * len(b)` items
instead of `len(a)`.** Cause: two `for` clauses are a Cartesian product, not
parallel iteration — the HOWTO says the sequences are iterated *"from left to
right, not in parallel"*. Fix: one `for` clause over `zip(a, b)`, and pass
`strict=True` if the lengths are supposed to match.

**★ Symptom — a two-clause comprehension that worked in tests exhausts memory in
production.** Cause: the product of two collection sizes, which is invisible in
a test fixture of five rows and lethal at ten thousand. Fix: work out what the
result length is *supposed* to be before writing it; if it is `len(a)`, there
must be exactly one `for` clause.

**★ Symptom — an `AttributeError` on `None` from a comprehension that visibly
contains `if row is not None`.** Cause: the filter is in the last position, so it
runs *after* the `for` clause that dereferences `row`. Clause order is execution
order. Fix: move the `if` between the two `for` clauses, where it guards the
inner iterable's expression.

**Symptom — an inner iterable is rebuilt on every outer iteration and the
comprehension is unexpectedly slow.** Cause: a later `for` clause's iterable
expression is re-evaluated for each value of the earlier target, by design,
whether or not it depends on that target. Fix: hoist the invariant part into a
local before the comprehension and iterate the local.

**Symptom — a filter on the outer loop is written last and the inner loop still
runs for rows that should have been skipped.** Cause: an `if` after the inner
`for` filters *elements*, not outer rows. Fix: move the `if` between the two
`for` clauses.

**Symptom — `TypeError: 'NoneType' object is not iterable` from a multi-clause
comprehension, with the traceback pointing at the whole comprehension.** Cause: a
later iterable expression evaluated to `None` for one of the outer values. Fix:
filter first — `for row in grid if row is not None for cell in row` — rather
than guarding inside the element expression, which is evaluated too late to
help.

**Symptom — swapping two `for` clauses changes the output order but not the
output set, and someone "fixed" a test by swapping them.** Cause: the clauses
nest, so the rightmost varies fastest; swapping them permutes the results.
Fix: decide the order from the domain (rows then cells), not from what makes the
current assertion pass, and sort explicitly if the order matters.

**Symptom — `itertools.product(a, b)` and the nested-clause form disagree when
`b` is a generator.** Cause: `product` materialises its arguments into tuples
internally before producing values, so a one-shot generator is consumed once and
reused; nested clauses re-iterate `b` per outer value and a spent generator
yields nothing after the first pass. Fix: pass `product` a list, or use nested
clauses over a re-iterable object.

## Interview questions

**★ Q: What is the length of `[(x, y) for x in a for y in b]`?**
`len(a) * len(b)` — the clauses nest, they do not zip. The HOWTO states the
output length equals *"the product of the lengths of all the sequences"* when
there are no `if` clauses. If you wanted `len(a)` pairs you wanted
`zip(a, b)` in a single clause.

**★ Q: You want to filter rows before touching their contents. Where does the
`if` go?**
Between the two `for` clauses. Clause order is execution order, so
`[c for row in rows if row for c in row.cells]` tests `row` before evaluating
`row.cells`, while putting the same `if` at the end evaluates `row.cells` first
and raises.

**Q: Can a later `for` clause depend on an earlier clause's variable?**
Yes, and that is the point of allowing more than one. The reference's example is
`[x*y for x in range(10) for y in range(x, x+10)]`. It also explains the
consequence: everything except the leftmost iterable must be evaluated inside the
comprehension's own scope, because it may depend on values from that iterable.

**Q: Are `if a if b` and `if a and b` different?**
Not in result. Both short-circuit, both filter. Two clauses tend to read better
when the conditions are conceptually separate — a guard and a business rule —
and `and` reads better when they are one predicate. There is no semantic
difference to defend in review.

**Q: When would you use `itertools.product` instead of two `for` clauses?**
When the product is the intent rather than an accident of nesting, and
especially when the number of dimensions is data-driven — `product(*lists)`
handles an unknown number of axes, which no fixed set of `for` clauses can.
Nested clauses win when a later iterable depends on an earlier target, which
`product` cannot express.

**Q: Why is the invariant part of a later iterable not hoisted automatically?**
Because CPython cannot prove the expression is invariant. An arbitrary call may
have side effects or return a different object each time, and the language
guarantees it is evaluated once per outer iteration. Hoisting is the
programmer's job.

**Q: How many `for` clauses is too many?**
Three, in practice. Two maps onto "outer, inner" which most readers hold without
effort. At three the cost is a product of three lengths with no indentation to
signal it, and the fix is a named generator function that makes the levels
visible and testable.

---

← Prev: [Grammar and clause order](02-the-grammar-and-clause-order.md) · Index: [Comprehensions](README.md) · Next → [Filter versus conditional expression](02c-filter-versus-conditional-expression.md)
