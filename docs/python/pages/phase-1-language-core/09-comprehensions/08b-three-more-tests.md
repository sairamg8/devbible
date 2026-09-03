---
title: "Three more tests: intermediate names, more than two for clauses, and any accumulation across elements"
sidebar_label: "8b · Three more tests"
sidebar_position: 107
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [Displays for lists, sets and dictionaries](https://docs.python.org/3.14/reference/expressions.html#displays-for-lists-sets-and-dictionaries),
> the Library Reference
> [`itertools.accumulate`](https://docs.python.org/3.14/library/itertools.html#itertools.accumulate),
> [`functools.reduce`](https://docs.python.org/3.14/library/functools.html#functools.reduce),
> the [Functional Programming HOWTO](https://docs.python.org/3.14/howto/functional.html),
> and [PEP 572](https://peps.python.org/pep-0572/),
> [PEP 709](https://peps.python.org/pep-0709/).
> Target: **CPython 3.14**.

**Tests 1 to 3 were about things a comprehension cannot do at all — handle an
exception, stop early, be a statement. These three are about things it *can* do
and should not: naming intermediate values with a walrus, nesting three deep, and
folding state across elements. Each has a working comprehension form, which is
exactly what makes them dangerous — the code runs, review passes, and the cost
lands on whoever has to change it next.**

## Test 4 — the body wants a statement, or a name

```python
# the comprehension, once the logic has grown
[f(x) * g(x) / (f(x) + g(x)) for x in xs if f(x) > 0 and g(x) > 0]
```

`f` and `g` are each called three times per element. A walrus can fix part of it
— `[y * z / (y + z) for x in xs if (y := f(x)) > 0 and (z := g(x)) > 0]` — and
now the line requires careful reading to verify the walrus targets are bound
before use in the head. Two intermediate values are the limit for the walrus
trick; three is a loop:

```python
out = []
for x in xs:
    y, z = f(x), g(x)
    if y > 0 and z > 0:
        out.append(y * z / (y + z))
```

Six lines instead of one, every one of which can hold a breakpoint, a `print`, or
a comment. That last point is underrated: **you cannot put a comment inside a
comprehension on the line it applies to**, and you cannot step a debugger onto a
single clause. When code is going to be debugged, the loop is the more
maintainable form regardless of length.

## Test 5 — more than two `for` clauses, or any nesting you have to re-read

Two clauses is a shape a reader holds. Three is a puzzle, and the cost is not
only readability: three nested clauses means a product of three lengths with no
indentation to signal it.

```python
# don't
[t for org in orgs for team in org.teams for t in team.members if t.active]
```

There are two good rewrites and one bad one. The bad one is to keep the
comprehension and add line breaks. The good ones:

```python
# a generator function — names the concept, testable on its own
def active_members(orgs):
    for org in orgs:
        for team in org.teams:
            yield from (t for t in team.members if t.active)

# or compose two shallow comprehensions
teams   = [t for org in orgs for t in org.teams]
members = [m for t in teams for m in t.members if m.active]
```

The second is only right when the intermediate list is small enough to
materialise and means something on its own. When it does, naming it is an
improvement; when it does not, you have invented a variable to avoid a loop.

A separate signal in the same family: **if you have to read the comprehension
twice to know what it returns, it does not matter how many clauses it has.** The
two-pass reading rule from
[clause order](02-the-grammar-and-clause-order.md) is a comprehension-reading
technique; needing it every time is a comprehension-writing failure.

## Test 6 — it accumulates state across elements

A comprehension maps and filters. It does not fold.

```python
running = [total := total + x for x in xs]        # legal, and a fold in disguise
```

That works — PEP 572 offers exactly this example — and it is a bad line of code
for two reasons: the reader must notice that `total` is being mutated by the
expression, and `total` must have been initialised outside, which means the
comprehension is not self-contained. `itertools.accumulate` says it properly:

```python
from itertools import accumulate
running = list(accumulate(xs))
```

and when the fold is not one of the ones `itertools` and `functools` provide, a
loop is the honest form:

```python
balances, balance = [], opening
for txn in transactions:
    balance += txn.delta
    if balance < 0:
        raise InsufficientFunds(txn)
    balances.append(balance)
```

Note the `raise` in there. That is Test 2 and Test 6 together, which is the usual
way these arrive.

## Gotchas

**★ Symptom — a comprehension calls the same expensive function two or three
times per element.** Cause: the value is needed in both the filter and the head
and there is nowhere to name it. Fix: a walrus for one or two values; a loop with
real local variables beyond that.

**★ Symptom — a comprehension with a walrus accumulator produces the right
answer but the accumulator has an unexpected value afterwards.** Cause: PEP 572
binds the walrus target in the containing scope deliberately, so the fold's
running total survives the comprehension. Fix: `itertools.accumulate`, or a loop
— see [the walrus rules](../05-truthiness/05b-walrus-rules-and-scope.md).

**★ Symptom — a reviewer asks what a three-clause comprehension returns and the
author has to trace it.** Cause: if the author cannot read it at a glance, no one
can. Fix: a named generator function. The name is the documentation the
comprehension could not carry.

**Symptom — nobody can set a breakpoint inside the failing comprehension.**
Cause: it is one expression on one line, and since PEP 709 a list, dict or set
comprehension does not even produce a frame to break in. Fix: convert to a loop
while debugging; convert back afterwards only if it was genuinely clearer.

**Symptom — a comment cannot be attached to the clause it explains.** Cause:
comprehensions have no line structure to hang comments from; a comment above the
whole expression explains the whole expression. Fix: if a clause needs
explaining, it needs a line — which means a loop, or a named helper function
whose name is the explanation.

**Symptom — a comprehension was chosen because "loops are slow in Python".**
Cause: a rule of thumb applied where it does not reach. The difference is an
attribute lookup and a call per element; see [performance](07-performance.md).
Fix: choose on clarity, and optimise the thing the profiler names.

**Symptom — splitting a three-clause comprehension into two comprehensions made
the code slower and no clearer.** Cause: the intermediate list is materialised
and it does not correspond to a concept anyone names. Fix: a generator function
instead — it keeps the streaming and gains the name.

**Symptom — a walrus in a comprehension that a reviewer approved turns out to
shadow an outer variable.** Cause: the walrus binds in the containing scope, so
choosing a name that already means something silently rebinds it. Fix: pick a
distinct name, and treat a walrus in a comprehension as an export that needs a
deliberate name rather than a throwaway.

**Symptom — `functools.reduce` was used to avoid a loop and nobody can read the
result.** Cause: `reduce` with a non-trivial lambda is a fold whose accumulator
is invisible; the HOWTO itself notes that a plain loop is usually clearer.
Fix: use `sum`, `min`, `max`, `math.prod` or `accumulate` when one fits, and a
loop when none does.

## Interview questions

**★ Q: Where is the line on nesting?**
Two `for` clauses. A reader holds "outer, inner" without effort; at three there
is a product of three lengths and no indentation to make it visible. The rewrite
is a named generator function, which also gives the concept a name and something
to test. Splitting into two comprehensions is right only when the intermediate
list is small and means something on its own.

**★ Q: The walrus lets a comprehension accumulate. Should it?**
Only for the small cases, and reluctantly. PEP 572 shows
`[total := total + v for v in values]`, and it works, but the accumulator must be
initialised outside and leaks back out — so the comprehension is neither
self-contained nor obviously a fold. `itertools.accumulate` says it directly, and
a loop says it clearly when the fold has a condition or a `raise` in it.

**★ Q: What is the strongest argument for the loop that is not about
readability?**
Debuggability. You cannot set a breakpoint on a clause, you cannot print an
intermediate value, and since PEP 709 a list, dict or set comprehension does not
even produce its own frame to stop in. Code that will be debugged under pressure
should be code you can step through.

**Q: How many intermediate values justify a loop?**
More than two. One is a repeated call you can hoist with a walrus; two is at the
edge of readable; at three the head expression and the filters are all referring
to names bound in a different clause, and the reader has to build the dataflow in
their head. A loop puts each on its own line, in order.

**Q: Is `functools.reduce` a good alternative to a fold loop?**
Rarely. `sum`, `min`, `max`, `math.prod`, `"".join` and `itertools.accumulate`
cover most real folds and each says what it does. `reduce` with a lambda hides
the accumulator inside an anonymous function, which is precisely the thing a
reader needs to see. When none of the named tools fits, a loop is clearer than
`reduce`.

**Q: If you split a big comprehension into two, when is that an improvement?**
When the intermediate result has a name that means something to the domain and is
small enough to materialise. `teams = [...]` then `members = [...]` is better than
one three-clause comprehension if "teams" is a concept in the system. If you had
to invent the name to avoid the nesting, you wanted a generator function.

**Q: Does the "no comments inside" objection really matter?**
It is the one that survives contact with a codebase. A comprehension carries no
place to explain why a filter exists, and filters are exactly the clauses that
accumulate business rules over time. The loop form gives every rule a line, and a
line can hold a comment, a ticket number and a `git blame`.

---

← Prev: [When it should have been a loop](08-when-it-should-have-been-a-loop.md) · Index: [Comprehensions](README.md) · Next → **When the comprehension is right** *(not written yet)*
