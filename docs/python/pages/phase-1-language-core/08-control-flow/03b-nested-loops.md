---
title: "Nested loops, and the labelled `break` Python does not have"
sidebar_label: "3b · Nested loops"
sidebar_position: 84
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against [PEP 3136 — Labeled break and continue](https://peps.python.org/pep-3136/),
> the Python 3.14 Language Reference
> [`break`](https://docs.python.org/3.14/reference/simple_stmts.html#the-break-statement)
> and [The `for` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-for-statement),
> and the Library Reference
> [`itertools.product`](https://docs.python.org/3.14/library/itertools.html#itertools.product)
> and [`itertools.chain`](https://docs.python.org/3.14/library/itertools.html#itertools.chain).
> Target: **CPython 3.14**.

**`break` exits exactly one loop: the innermost one containing it. Python has no
`break 2`, no loop labels, and no `goto`. PEP 3136 proposed labelled break and
continue and was **rejected** — the stated reasoning being that code needing it
is usually code that wants to be a function. That rejection is worth taking
seriously rather than working around, because the three legitimate ways out of a
nested loop are all improvements on the labelled break they replace, and the
`else`/`continue`/`break` dance that simulates it is the one to reach for last.**

## The three ways out, best first

### 1. Extract a function and `return`

```python
def find_cell(grid, target):
    for y, row in enumerate(grid):
        for x, cell in enumerate(row):
            if cell == target:
                return x, y
    return None
```

`return` exits every enclosing loop at once, which is the thing labelled break
was for. It also gives the search a **name**, gives the result a **value**, and
gives the not-found case an explicit representation instead of a control-flow
state. This is what PEP 3136's rejection was pointing at.

The caller then reads as a sentence:

```python
if (pos := find_cell(grid, target)) is None:
    raise NotFound(target)
x, y = pos
```

Note the [walrus](../05-truthiness/05-the-walrus-operator.md) and the
`is None` rather than a truthiness test — `(0, 0)` is a perfectly good position
and it is a falsy-looking tuple only if you get careless. `(0, 0)` is actually
truthy, being a non-empty tuple, but the habit is what protects you when the
return type later becomes an index that can be `0`.

### 2. Flatten the loops

If the nesting is only there to enumerate a cross-product, say so:

```python
from itertools import product

for x, y in product(range(w), range(h)):
    if grid[y][x] == target:
        break                 # ONE loop, so one break is enough
```

`product` is the direct replacement for nested `for`s over independent
sequences, and it composes with `for`/`else` because there is now a single loop
for the `else` to attach to. `itertools.chain` (and `chain.from_iterable`)
flattens a nesting of *dependent* sequences — a list of lists — the same way:

```python
for cell in chain.from_iterable(grid):
    ...
```

The cost of flattening is that you lose the inner loop's own structure — you
cannot do per-row setup or teardown — so it fits searches better than it fits
processing.

A generator function is the general form when `product` does not fit:

```python
def cells(grid):
    for y, row in enumerate(grid):
        for x, cell in enumerate(row):
            yield x, y, cell

for x, y, cell in cells(grid):
    if cell == target:
        break
```

This keeps the nesting where it belongs (inside the generator, where it is
readable) and hands the consumer a single loop. It is the most reusable of the
three flattening options.

### 3. The `else` / `continue` / `break` dance

```python
for row in grid:
    for cell in row:
        if cell == target:
            break
    else:
        continue        # inner loop was NOT broken → keep going
    break               # inner loop WAS broken → break the outer too
```

It is correct, and it is a puzzle. The `else` belongs to the **inner** loop; it
fires when the inner loop finished without finding anything, and the `continue`
then advances the outer loop past the trailing `break`. The trailing `break` is
therefore reachable only when the inner loop *did* break.

If you write this, comment it — and prefer it only when extracting a function
would mean threading half a dozen locals through a signature.

## What `break` and `continue` bind to

Both bind to the **innermost enclosing loop**, and the reference is worth being
precise about: a `break` inside a nested function does not break the outer
function's loop, because it is not enclosed by it — it is a `SyntaxError`
(`'break' outside loop`). The same applies inside a comprehension:

```python
for x in xs:
    ys = [y for y in x if y > 0 and break]   # SyntaxError — not an expression
```

`break` is a **statement**, so it cannot appear in a comprehension at all. The
comprehension equivalent of "stop early" is `itertools.takewhile`, and the
equivalent of "find the first" is `next((...), None)`.

## Loop nesting and cost

Nested loops multiply. This is obvious stated plainly and invisible in code:

```python
for a in list_a:                 # 1,000
    for b in list_b:             # 1,000
        if a.key == b.key:       # 1,000,000 comparisons
            pair(a, b)
```

The fix is almost never "optimise the loop" and almost always "index one side":

```python
by_key = {b.key: b for b in list_b}       # one pass
for a in list_a:
    if (b := by_key.get(a.key)) is not None:
        pair(a, b)                        # 1,000 lookups, each O(1)
```

That is the single highest-value refactor in this whole topic. Any nested loop
whose inner loop is *searching* rather than *iterating* wants a `dict` or a
`set`. A nested loop whose inner loop genuinely visits every pair — a distance
matrix, a collision check — is doing real O(n²) work and needs an algorithmic
change, not an idiom.

## Gotchas

**Symptom — `break` in a nested loop exits only the inner one.** Cause: `break`
binds to the innermost enclosing loop; Python has no labelled break, and
PEP 3136 was rejected. Fix: extract the search into a function and `return`, or
flatten the iteration, or use the `else`/`continue`/`break` idiom with a comment.

**Symptom — `SyntaxError: 'break' outside loop` inside a function defined in a
loop.** Cause: the nested function body is not enclosed by the outer loop; only
lexically enclosing loops count. Fix: `return` from the inner function and
`break` on its result in the outer loop.

**Symptom — you cannot `break` out of a comprehension.** Cause: `break` is a
statement and a comprehension is an expression. Fix: `itertools.takewhile` to
stop at a condition, `next((x for x in xs if p(x)), None)` to take the first
match, or write an ordinary loop — which is the honest answer whenever a
comprehension is straining.

**Symptom — the `else`/`continue`/`break` idiom silently stops working after
someone adds a `break` to the outer loop for another reason.** Cause: the
trailing `break` is positional — it is "the statement after the inner `else`" —
and any restructuring can detach it from its meaning. Fix: extract a function.
This idiom does not survive editing by someone who has not read it carefully.

**Symptom — a join between two lists is quadratic and slow.** Cause: the inner
loop is a linear search repeated for every outer item. Fix: build a `dict` or
`set` from one side first and look up instead of scanning — one pass to index,
then O(1) per lookup.

**Symptom — flattening with `chain.from_iterable` loses per-row handling.**
Cause: flattening deliberately discards the inner structure, so there is no
longer a point at which one row starts and ends. Fix: keep the nested loops if
you need per-row setup, or yield `(row_index, item)` pairs from a generator so
the boundary is still visible.

**Symptom — `product(range(w), range(h))` iterates in the wrong order.** Cause:
`product` varies the **rightmost** argument fastest, like nested loops with the
last one innermost. Fix: order the arguments to match the nesting you meant —
`product(range(h), range(w))` for row-major traversal.

**Symptom — a generator used to flatten a nested loop can only be consumed
once.** Cause: it is an iterator. A second `for` over the same generator object
gets nothing. Fix: call the generator function again, or materialise if the data
is small.

## Interview questions

**★ Q: How do you break out of two nested loops?**
Python has no labelled break — PEP 3136 proposed one and was rejected, on the
grounds that code needing it usually wants to be a function. Extract the nested
loops into a function and `return`, which is almost always clearest; or flatten
them into a single loop with `itertools.product`, `chain.from_iterable` or a
generator; or use the `else`/`continue`/`break` idiom on the outer loop, which
works and needs a comment.

**★ Q: A nested loop joining two lists of 10,000 items is slow. What do you do?**
Index one side. Build `{b.key: b for b in list_b}` in one pass, then look up per
outer item — O(n) instead of O(n²). Any nested loop whose inner loop is
*searching* rather than *visiting* is really a missing dict or set. If the inner
loop genuinely needs every pair, the problem is algorithmic, not idiomatic.

**Q: Can you use `break` inside a comprehension?**
No — `break` is a statement and a comprehension is an expression. Use
`itertools.takewhile` to stop at a condition, or
`next((x for x in xs if p(x)), None)` for the first match. If neither fits, the
comprehension should be a loop.

**Q: Explain the `else: continue` / `break` idiom.**
The `else` belongs to the *inner* loop and fires when it completed without
breaking; the `continue` then advances the outer loop, skipping the `break` that
follows. So the trailing `break` is reachable only when the inner loop did break
— which is a two-level break. It is correct and it is a puzzle; a function with
a `return` says the same thing plainly.

**Q: What does `itertools.product` do, and which argument varies fastest?**
It yields the cartesian product of its arguments, replacing nested `for` loops
over independent sequences. The **rightmost** argument varies fastest, matching
the ordering of equivalent nested loops with the last one innermost.

**Q: Why was PEP 3136 rejected?**
Because the cases that want a labelled break are usually cases that want a
function — extracting the loops gives you a name, a return value and an explicit
not-found case, all of which a label leaves implicit. The rejection is an
argument about design, not about implementation difficulty.

**Q: Does `break` work inside a `try` inside a loop?**
Yes, and the `finally` still runs on the way out. What does not work is a
`break` inside a nested *function* — that is a `SyntaxError`, because only
lexically enclosing loops count, and a function body is not enclosed by the
caller's loop.

---

← Prev: [`for`/`else` and `while`/`else`](03-for-else-and-while-else.md) · Index: [Control flow](README.md) · Next → [`break`, `continue`, and mutation during iteration](04-break-continue-and-mutation.md)
