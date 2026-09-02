---
title: "What actually costs in a slow comprehension is never the comprehension, and the fix is almost always a set"
sidebar_label: "7b · What actually costs"
sidebar_position: 105
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [`timeit`](https://docs.python.org/3.14/library/timeit.html),
> [`dis`](https://docs.python.org/3.14/library/dis.html),
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset),
> [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations),
> the [Time Complexity wiki page](https://wiki.python.org/moin/TimeComplexity),
> and [PEP 709](https://peps.python.org/pep-0709/).
> Target: **CPython 3.14**.

**Choosing between a comprehension, a loop and `map` buys a constant factor.
Everything on this page buys an order of magnitude, and the first item buys the
most: a membership test against a list inside a comprehension is quadratic, and
converting that list to a set once before the comprehension is usually the entire
performance fix. This chunk is the list of things to check before touching the
construct, and the discipline for establishing any of it — which is `timeit` on
real data, not a rule from a blog post.**

## What actually dominates

Everything above is a constant factor on the loop machinery. In real code the
loop machinery is almost never the cost. What is:

**A per-element Python function call.** `[expensive(x) for x in xs]` costs
`len(xs)` frames no matter which construct you choose. Reducing the number of
calls beats choosing between constructs.

**Attribute lookups in the element expression.** `[x.a.b.c for x in xs]` performs
three lookups per element. Hoisting is not possible here, but restructuring the
data often is.

**Repeated work in a later clause.** A second `for` clause's iterable is rebuilt
per outer element — see [multiple clauses](02b-multiple-clauses.md). This is
the one on this list that turns linear code quadratic.

**A membership test against a list.** `[x for x in xs if x in banned]` is `O(n*m)`
if `banned` is a list and `O(n)` if it is a set. That single change is worth more
than every other item on this page combined, and it is the first thing to look
for in a slow comprehension.

```python
banned = set(banned)                     # once, before the comprehension
[x for x in xs if x not in banned]
```

**Growing a list you could have sized.** A comprehension cannot preallocate
because it does not know the length; neither can a loop with `append`. If you
genuinely know the size and the elements are uniform, `[None] * n` followed by
index assignment avoids the reallocation — but this is a micro-optimisation that
loses more in readability than it gains, except in numeric code, where the answer
is a numeric array library rather than a list at all.

## The measurement discipline

No number in this chunk is one I measured, and none should be taken as a
prediction. The two figures quoted are PEP 709's own, for its own benchmarks. If
you need to know which of two spellings is faster in your code:

```python
import timeit
timeit.timeit("[f(x) for x in xs]", globals=globals(), number=10000)
timeit.timeit("list(map(f, xs))",   globals=globals(), number=10000)
```

Use realistic data — the answer changes with size and with how expensive `f` is —
and run it on the interpreter you deploy. A microbenchmark on a list of ten
integers predicts nothing about a list of a million records.

## Gotchas

**★ Symptom — a comprehension is slow and the profile blames the comprehension's
line.** Cause: almost always the element expression, not the comprehension — a
per-element function call, an attribute chain, or a membership test against a
list. Fix: check for `in` against a list first; converting it to a set is
typically the entire fix.

**★ Symptom — a comprehension that filters against another collection is fine on
test data and quadratic in production.** Cause: `x in some_list` scans the list
per element, so cost is `len(xs) * len(some_list)`. Fix: `banned = set(banned)`
once, before the comprehension. Sets are covered by the same containment syntax,
so the change is one line and nothing else moves.

**★ Symptom — a comprehension over ORM objects issues one query per element.**
Cause: an attribute in the element expression triggers a lazy relationship load;
the comprehension makes it look like one operation. Fix: eager-load the
relationship in the query. This is the N+1 problem, and a comprehension is an
unusually good place to hide it because there is no loop body to read.

**Symptom — a comprehension over a `numpy` array or `pandas` column is orders of
magnitude slower than the vectorised operation.** Cause: per-element Python
object creation and dispatch, which vectorised operations avoid entirely. Fix:
this is outside what any comprehension spelling can address; use the library's
own operations.

**Symptom — a nested comprehension is slow and the inner iterable does not depend
on the outer target.** Cause: later clauses are re-evaluated per outer element by
design. Fix: hoist the invariant part into a local — see
[multiple clauses](02b-multiple-clauses.md).

**Symptom — a timing comparison flips depending on the size of the input.**
Cause: fixed costs (frame setup, iterator creation) dominate on small inputs and
per-element costs dominate on large ones. Fix: benchmark at the size you actually
run at, and state the size alongside any number you record.

**Symptom — an optimisation that helped on 3.11 does nothing on 3.14.** Cause:
the specialising interpreter and PEP 709 changed the constants this kind of
tuning depends on. Fix: re-measure on the deployed interpreter; treat any
performance note without a version attached as unverified.

**Symptom — a comprehension building a large list makes the process slow rather
than just memory-hungry.** Cause: the allocation pressure itself — repeated
resizing and, at scale, garbage collection over a large container of objects.
Fix: if the list is only consumed once, do not build it; use a generator
expression.

## Interview questions

**★ Q: What is the single most valuable performance fix in a slow comprehension?**
Changing a membership test from a list to a set. `if x in banned` costs
`O(len(banned))` per element against a list and roughly `O(1)` against a set,
which turns a quadratic comprehension linear. No choice between comprehension,
loop and `map` comes close, and the change is one line placed before the
comprehension.

**★ Q: How would you settle a performance question about two comprehension
spellings?**
`timeit` with realistic data on the interpreter you deploy, and `dis` to confirm
the two versions differ where you think they do. Microbenchmarks on ten-element
lists predict nothing about production, and version-to-version changes in the
specialising interpreter mean an answer measured on 3.9 is not an answer for
3.14.

**Q: Why does a comprehension make an N+1 query problem harder to spot?**
Because there is no loop body. A `for` loop with a database access in it looks
like a loop with a database access in it; `[o.customer.name for o in orders]`
looks like a projection. The lazy load hides inside an attribute access in the
element expression.

**Q: What dominates the cost of `[expensive(x) for x in xs]`?**
The `len(xs)` Python function calls, each of which builds a frame. Changing the
construct around them changes nothing measurable. The available optimisations are
calling `expensive` fewer times — filtering first, caching, batching — or making
`expensive` itself cheaper.

**Q: Is memory ever the performance problem rather than time?**
Yes, and it is the one that ends the process rather than slowing it. A list
comprehension over a large source holds every element at once; a generator
expression holds one. When the aggregate is consumed once, the brackets are the
whole bug.

**Q: Where should a filter go if you care about cost?**
As early as possible — in the leftmost clause's `if`, or between clauses, so that
later iterables and the element expression run for fewer elements. Clause order
is execution order, so moving a cheap filter left is free and moving an expensive
one right can be too.

---

← Prev: [Performance](07-performance.md) · Index: [Comprehensions](README.md) · Next → [When it should have been a loop](08-when-it-should-have-been-a-loop.md)
