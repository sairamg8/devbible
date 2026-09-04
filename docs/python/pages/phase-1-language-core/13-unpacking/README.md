---
title: "Unpacking: the same star, spreading one way and collecting the other"
sidebar_label: "13 · Unpacking"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [Assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements),
> [Calls](https://docs.python.org/3.14/reference/expressions.html#calls),
> [Displays](https://docs.python.org/3.14/reference/expressions.html#list-displays),
> [The `for` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-for-statement),
> and [PEP 3132](https://peps.python.org/pep-3132/), [PEP 448](https://peps.python.org/pep-0448/),
> [PEP 584](https://peps.python.org/pep-0584/).
> Target: **CPython 3.14**.

**Unpacking is one idea with two directions. On the left of an `=`, or in a
signature, a star **collects** — `first, *rest` takes the leftovers into a list.
On the right, in a call or a literal, a star **spreads** — `f(*args)` and
`[*a, *b]` pour an iterable into the surrounding structure. Everything else here
follows from two documented rules: the whole right-hand side is evaluated before
any target is assigned (which is why `a, b = b, a` swaps), and targets are then
assigned **left to right** (which is why `i, x[i] = 1, 2` does not do what you
expect).**

The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Tuple assignment](01-tuple-assignment.md)** | The evaluate-then-assign rule and the swap it enables; unpacking any iterable, including the `dict`-gives-keys trap; the two `ValueError` messages and why "too many" does not report a count; **targets assigned left to right**, with the reference's own `i, x[i] = 1, 2` example; nested targets and the missing parentheses that break `enumerate` loops; unpacking consuming an iterator even when it raises |
| 2 | **[Starred unpacking](02-starred-unpacking.md)** | The three positions and the documented fill order; the star **always** producing a list, even from a tuple or a string; `first, *rest = [1]` succeeding with an empty remainder; one star per target list; `*_` as a convention and its `gettext` hazard; starred targets in `for`; where it replaces slicing and the two real differences |
| 3 | **[`*` and `**` in calls and literals](03-star-args-and-literals.md)** | PEP 448's unbounded unpackings; the asymmetry where `{**a, **b}` prefers the later value but `f(**a, **b)` raises `TypeError`; displays versus `+` and `\|`; the later-wins merge rule and the **shallow-merge** config bug; the six positions a star can appear in and the four things it means |

## The one paragraph the whole topic expands

The right-hand side is finished before the left-hand side starts, so `a, b = b,
a` swaps — but the targets themselves are assigned in order, so an assignment
mixing a name and a subscript that uses it is order-sensitive. A starred target
absorbs the remainder as a **list**, always, and happily as an empty one. On the
call and literal side the star spreads instead: `[*a, *b]` concatenates any two
iterables, `{**a, **b}` merges with later-wins — shallowly, which is where the
config bugs come from — and `f(**a, **b)` refuses a duplicate key outright
rather than picking one.

## Where this connects

- **[Control flow](../08-control-flow/README.md)** — `for name, *scores in
  rows:` is the readable form of the row/`row[1:]` index arithmetic that topic
  argues against, and `enumerate`'s 2-tuple is where the missing-parentheses
  `ValueError` actually shows up.
- **[`match`](../10-match-pattern-matching/README.md)** — sequence patterns use
  the same `*rest` spelling and the same "at most one star" rule, but match
  rather than assign, and deliberately refuse to decompose a string where an
  assignment will.
- **[Assignment semantics and aliasing](../07-assignment-and-aliasing/README.md)**
  owns what the binding *does* once unpacking has decided which name gets which
  object — including that `*rest` hands you a new list while the elements inside
  it are the originals.
- **Phase 2 — Functions** owns the other half of the star: `*args`/`**kwargs` in
  a signature, where it collects rather than spreads, and keyword-only
  parameters.
- **Phase 3 — Collections** is where `{**a, **b}` versus `dict1 | dict2` versus
  `update` becomes a question about which one mutates.

---

← Prev: [EAFP vs LBYL](../12-eafp-vs-lbyl/README.md) · Index: [Phase 1 — Language core](../README.md) · Next → [`None` and the "no result" contract](../14-none-and-no-result/README.md)
