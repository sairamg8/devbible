---
title: "Control flow: loops that iterate the thing, and the clause that means \"no break\""
sidebar_label: "08 · Control flow"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `for` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-for-statement),
> [The `while` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-while-statement),
> [`break`/`continue`](https://docs.python.org/3.14/reference/simple_stmts.html#the-break-statement),
> the Library Reference
> [`enumerate`](https://docs.python.org/3.14/library/functions.html#enumerate),
> [`zip`](https://docs.python.org/3.14/library/functions.html#zip),
> [Ranges](https://docs.python.org/3.14/library/stdtypes.html#ranges),
> [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations),
> [Dictionary view objects](https://docs.python.org/3.14/library/stdtypes.html#dictionary-view-objects),
> [`itertools`](https://docs.python.org/3.14/library/itertools.html),
> and [PEP 618](https://peps.python.org/pep-0618/), [PEP 3136](https://peps.python.org/pep-3136/).
> Target: **CPython 3.14**.

**Python's `for` does not count — it consumes an iterator. The iterable
expression is evaluated once, an iterator is made from it, and each item is
assigned to the target by ordinary assignment rules. Every other fact in this
topic falls out of that: why `for i in range(len(xs)):` is the wrong shape, why
the loop variable is still bound afterwards, why `enumerate` and `zip` exist,
and why mutating a list mid-loop silently skips elements rather than raising.
Two things here produce real production bugs rather than merely unidiomatic
code — `zip`'s silent truncation, and the list iterator's marching index.**

This topic runs deep. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The `for` statement](01-the-for-statement.md)** | The documented mechanism; the target list being any assignment target; the loop variable outliving the loop (`NameError` on empty, last-item-bound otherwise) and why comprehensions differ; reassigning the target doing nothing; `range` as an immutable **sequence** with O(1) integer containment; the `range(len(...))` replacement table; the two-argument `iter()` sentinel loop |
| 2 | **[`enumerate` and `zip`](02-enumerate-and-zip.md)** | `enumerate`'s equivalent code and `start=1`; numbering survivors versus positions; **`zip`'s silent shortest-input truncation** and PEP 618's `strict=True`; why `strict` raises mid-loop; `zip_longest` and the `fillvalue=None` collision |
| 2b | **[`zip` idioms and neighbours](02b-zip-idioms-and-neighbours.md)** | `dict(zip(...))`, `zip(*rows)` transposition and its ragged-table data loss; `itertools.pairwise` superseding `zip(xs, xs[1:])`; `islice` and why it has no negative index; `deque(maxlen=)` for the tail; `batched` and its 3.13 `strict` |
| 3 | **[`for`/`else` and `while`/`else`](03-for-else-and-while-else.md)** | Both reference sections quoted; the three details people skim (false-on-first-test still runs `else`; empty iterable runs `else`; `continue` on the last item falls *into* `else`); the search-and-report pattern; the `try`/`else` parallel; four reasons not to use it |
| 3b | **[Nested loops](03b-nested-loops.md)** | No labelled break — PEP 3136 rejected — and the three ways out ranked; `itertools.product`/`chain`/generator flattening; `break` binding only to lexically enclosing loops; and the highest-value refactor here: a nested loop whose inner loop *searches* is a missing `dict` |
| 4 | **[`break`, `continue`, mutation](04-break-continue-and-mutation.md)** | `continue` as a guard clause and when it becomes a smell; the loop-and-a-half; **the two different mutation failures** — `dict`/`set` raise (but not reliably), a list silently skips because its iterator's index marches on; the four safe patterns and the two traps inside them |

## The one paragraph the whole topic expands

Iterate the thing, not its indices: `for x in xs:`, `enumerate` when you need
the position, `zip(..., strict=True)` when you are walking two sequences that
are supposed to match, `reversed` to go backwards, `itertools` for the rest. A
loop's `else` means *no `break`* — read it as `nobreak` — and it is worth having
for search-and-report and not much else. `break` leaves exactly one loop, and if
you want it to leave two, you want a function. And never change a collection
while a loop is walking it: a `dict` will usually tell you, a list never will.

## Where this connects

- **[The `for` statement](01-the-for-statement.md)** leans on
  **[Truthiness](../05-truthiness/README.md)** twice — the two-argument `iter`
  sentinel loop tests *equality*, unlike `while chunk := read():`, and
  `for`/`else`'s "not found" branch is the control-flow form of the
  [empty-versus-missing](../05-truthiness/02-empty-versus-missing.md) distinction.
- [Comprehensions](../09-comprehensions/README.md) is the next topic and the expression
  form of most loops here — including the honest line where a nested
  comprehension should have stayed a loop.
- **[Assignment semantics and aliasing](../07-assignment-and-aliasing/README.md)** owns the
  `items = [...]` versus `items[:] = [...]` distinction that decides whether the
  safe-filtering pattern rebinds or mutates.
- **Exceptions, the working set** *(not written yet)* is where `try`/`else`
  earns the parallel this topic draws with `for`/`else`, and where the
  never-`break`-from-`finally` rule belongs properly.
- **Phase 5 — Iterators, generators, context managers** is where the iterator
  protocol this topic consumes gets built rather than used.

---

← Prev: [Assignment semantics and aliasing](../07-assignment-and-aliasing/README.md) · Index: [Phase 1 — Language core](../README.md) · Next → [Comprehensions](../09-comprehensions/README.md)
