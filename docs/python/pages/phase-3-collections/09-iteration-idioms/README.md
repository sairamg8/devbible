---
title: "09 · Iteration idioms — every one of these builtins is a thin loop over one iterator, so the production bugs are the places where two of them share that iterator and where the silent default — truncate, first wins, zero, stop — is not the one you meant"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python **3.14.7** documentation — [`functions`](https://docs.python.org/3.14/library/functions.html) (`enumerate`, `zip`, `reversed`, `any`, `all`, `min`, `max`, `sum`, `next`, `iter`, `map`), [`stdtypes`](https://docs.python.org/3.14/library/stdtypes.html), the [`for` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-for-statement), the [assignment statement](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements), the [glossary](https://docs.python.org/3.14/glossary.html), [PEP 618](https://peps.python.org/pep-0618/) and [PEP 479](https://peps.python.org/pep-0479/) — CPython source at the [v3.14.7](https://github.com/python/cpython/tree/v3.14.7) tag (`Python/bltinmodule.c`, `Objects/enumobject.c`, `Objects/iterobject.c`, `Python/ceval.c`), and the ruff **0.16.6** rule sources. Documentation- and source-validated — **no sandbox run**, no program output on any page in this topic.
> Target: **Python 3.14.7** (released 2026-08-05) · ruff 0.16.6. `zip(strict=)` is 3.10, `map(strict=)` is 3.14, `sum` uses compensated float summation since 3.12.

**`enumerate`, `zip`, `reversed`, `any`, `all`, `min`, `max`, `sum`, `next` and two-argument `iter` are each a small loop over a single iterator, and everything that goes wrong with them follows from three questions the documentation answers in one sentence each and programmers skip: what does the function require of its argument (an iterable, an iterator, a sequence with a length), what does it consume (all of it, all but one item, one item more than it returned), and what does it do when the data is short, empty or mixed (truncate, return the first, return `0`, raise, or carry on silently). This topic answers those questions from the source of each builtin, then follows the compositions that fail in production — two consumers on one iterator, `reversed` on something that cannot be reversed, `zip` losing one item from the iterator you meant to keep, `sum` starting at an `int`, `min` over a generator someone already drained — and shows the fix in code every time. Phase 1 teaches the everyday use of most of these; this topic is what is underneath and what breaks around it.**

## Chunks

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[01 · Requires and consumes](01-what-each-builtin-requires-and-consumes.md)** | the ledger — what each idiom needs (iterable, iterator, sequence), when it calls `iter()`, what it consumes and what it leaves; 🔴 a drained iterator *"appear[s] like an empty container"*, so `min` then `max` on one generator raises, `next(list)` is refused, `a, b = it` takes one item too many, and a file, `zip` or `csv.reader` can be looped over once |

## Phase gate

You are done with this topic when you can say, for any loop that "silently produced the wrong number of rows", which builtin consumed what — and fix it without a flag variable; write `zip` calls whose argument order and `strict` setting you can justify; make `reversed`, `min`, `max`, `sum` and `next` behave on empty, mixed and drained inputs; and read a ruff report for B905, C419, SIM110 and PLW2901 and know which of them is a bug and which is style.

## Where this connects

- [Phase 1 · The `for` statement](../../phase-1-language-core/08-control-flow/01-the-for-statement.md), [`enumerate` and `zip`](../../phase-1-language-core/08-control-flow/02-enumerate-and-zip.md) and [`zip` idioms](../../phase-1-language-core/08-control-flow/02b-zip-idioms-and-neighbours.md) — the everyday usage this topic builds on.
- [Phase 1 · `any` and `all`](../../phase-1-language-core/05-truthiness/04-any-and-all.md) and [in practice](../../phase-1-language-core/05-truthiness/04b-any-all-in-practice.md) — vacuous truth and the generator/list choice; this topic's `any`/`all` chunk adds only what those pages leave out.
- [Phase 1 · `min`, `max`, `heapq`, `bisect`, `groupby`](../../phase-1-language-core/06-comparisons/08c-min-max-heapq-bisect-groupby.md) — the shared `key=` contract.
- [Phase 1 · Unpacking](../../phase-1-language-core/13-unpacking/01-tuple-assignment.md) — the assignment rules a `for` header reuses.
- [01 · `list` internals](../01-list-internals/README.md), [03 · `dict`](../03-dict/README.md) and [04 · `set` and `frozenset`](../04-set-and-frozenset/README.md) — the mutation-during-iteration mechanics, chunk by chunk, for each container.
- **The iterator protocol, generators and `itertools`** *(phase 5, not written yet)* own the protocol in depth; **10 · Sorting compound data** *(not written yet)* owns `key=`, `itemgetter` and multi-key sorts.

---

← [Phase index](../README.md) · Start → [01 · Requires and consumes](01-what-each-builtin-requires-and-consumes.md)
