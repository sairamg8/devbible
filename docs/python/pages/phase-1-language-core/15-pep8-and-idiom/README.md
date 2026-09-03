---
title: "PEP 8 and idiom: what tooling settles, and what still needs a human"
sidebar_label: "15 · PEP 8 and idiom"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against [PEP 8](https://peps.python.org/pep-0008/),
> [PEP 20](https://peps.python.org/pep-0020/),
> [PEP 257](https://peps.python.org/pep-0257/),
> the Python 3.14 Library Reference [`this`](https://docs.python.org/3.14/library/this.html),
> and the [ruff rules index](https://docs.astral.sh/ruff/rules/).
> Target: **CPython 3.14**.

**Half of PEP 8 is settled before a human sees the diff — a formatter decides
indentation, line breaks and blank lines, and a linter sorts the imports. That
half is not worth a review comment. The other half is: naming, the underscore
conventions, import hygiene, and the "Programming Recommendations" that each
prevent a specific bug. And beyond PEP 8 sits the word *pythonic*, which means
two different things — using the language's own mechanisms, which is real
signal, and preferring whatever is shortest, which is how you get the nested
comprehension nobody can read.**

The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What PEP 8 says](01-what-pep8-actually-says.md)** | The framing sentence — project consistency outranks the guide — and the named reasons to ignore a rule; the formatting table a formatter owns, including the 99-character escape hatch PEP 8 already grants; the naming conventions; the underscore table, and why `__name` is collision avoidance rather than privacy; imports, and the three rules with teeth; PEP 257 in a paragraph |
| 2 | **[What "pythonic" means](02-what-pythonic-means.md)** | PEP 20 as a review tool and the line everyone misquotes; the Programming Recommendations gathered with pointers to the topics that own them; a cargo-cult-versus-real-signal table and the single test that separates them; the idioms that are correctness rather than style; and the `ruff` rule families that turn most of this into a CI failure instead of an argument |

## The one paragraph the whole topic expands

Configure a formatter and a linter, pin them in `pyproject.toml`, run them in
CI, and stop discussing whitespace. What remains is worth attention: names that
say what the thing is, a single underscore for internal and a double only in
base classes designed for inheritance, explicit imports, and the handful of PEP 8
recommendations that exist because each prevents a bug — `is None`, no
comparison to `True`, no mutable defaults, no bare `except:`. "Pythonic" is
worth invoking only in its real sense: using the mechanism the language already
provides, never as a synonym for shorter.

## Where this connects

- **[Truthiness](../05-truthiness/README.md)** owns most of the Programming
  Recommendations in practice — `if not seq:`, the `== True` trap, and the
  `if x` versus `if x is not None` warning PEP 8 itself flags.
- **[`None` and the no-result contract](../14-none-and-no-result/README.md)**
  owns `is None` and why `==` is not merely slower but wrong on some types.
- **[Assignment semantics and aliasing](../07-assignment-and-aliasing/README.md)**
  owns the mutable-default rule that `ruff`'s `B006` enforces.
- [Comprehensions](../09-comprehensions/README.md) owns the honest line where a
  comprehension should have stayed a loop — the concrete form of "pythonic does
  not mean shortest".
- [Exceptions, the working set](../11-exceptions/README.md) owns the bare-`except:`
  recommendation and why `KeyboardInterrupt` derives from `BaseException`.
- **Phase 7 — Packaging, projects and tooling** is where `pyproject.toml`,
  `ruff` and the type checker get configured properly rather than described.

---

← Prev: [`None` and the "no result" contract](../14-none-and-no-result/README.md) · Index: [Phase 1 — Language core](../README.md) · Next → [`del`, `pass`, `Ellipsis`](../16-del-pass-ellipsis/README.md)
