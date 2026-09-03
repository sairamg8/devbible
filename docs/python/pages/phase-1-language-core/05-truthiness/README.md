---
title: "Truthiness: empty things are falsy, and the bug that hides in it"
sidebar_label: "05 · Truthiness"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [Truth Value Testing](https://docs.python.org/3.14/library/stdtypes.html#truth-value-testing),
> [Boolean Operations](https://docs.python.org/3.14/library/stdtypes.html#boolean-operations-and-or-not),
> [`bool()`](https://docs.python.org/3.14/library/functions.html#bool),
> [`any()`/`all()`](https://docs.python.org/3.14/library/functions.html#any),
> [Built-in Constants](https://docs.python.org/3.14/library/constants.html),
> the Language Reference
> [`object.__len__`](https://docs.python.org/3.14/reference/datamodel.html#object.__len__)
> and [Operator precedence](https://docs.python.org/3.14/reference/expressions.html#operator-precedence),
> and [PEP 8](https://peps.python.org/pep-0008/),
> [PEP 572](https://peps.python.org/pep-0572/),
> [PEP 479](https://peps.python.org/pep-0479/),
> [PEP 505](https://peps.python.org/pep-0505/),
> [RFC 7386](https://www.rfc-editor.org/rfc/rfc7386).
> Target: **CPython 3.14**.

**Every object has a truth value and the default is `True`; an object is false
only if its class defines `__bool__` returning `False` or `__len__` returning
zero. That one rule generates the whole topic — the falsy list, the protocol
your own classes join, the cost of `if x:` when the method behind it does I/O,
and the operators that consume truth values. And it generates the one bug this
topic exists for: truthiness answers "is this container empty", application code
uses it to ask "did anyone give me a value", and the two questions disagree for
every falsy-but-legitimate value there is — `0`, `""`, `[]`, `{}`, `False`.**

This topic runs deep. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What falsy means](01-what-falsy-means.md)** | The rule in the docs' own words; the built-in falsy list and what is *not* on it; the falsy values people forget (`range(0)`, `b""`, `Decimal("0.00")`, `timedelta(0)`) and the truthy ones they expect to be falsy (`"False"`, `"0"`, `nan`, `-1`, midnight); `bool()` as a conversion rather than a test; what PEP 8 asks you to write |
| 1b | **[The truthiness protocol](01b-the-truthiness-protocol.md)** | Writing `__bool__`; the `__len__` fallback and its `>= 0` / `sys.maxsize` constraints; defining both on purpose (the `ResultPage` pattern); the `__bool__` you should not write; a checklist per class shape |
| 1c | **[What `if x:` costs](01c-what-if-x-costs.md)** | A condition is a method call: it can be slow (the Django `QuerySet` round trip), it can raise, and it can refuse — numpy's ambiguity error and why one-element arrays hide it; `NotImplemented` in a boolean context now raising `TypeError` in **3.14** |
| 2 | **[Empty versus missing](02-empty-versus-missing.md)** | The two questions and the values in the gap; the cache-miss-versus-cached-empty bug in the shape it actually takes; the ordering that fixes it; what a type checker can and cannot hold you to |
| 2b | **[Where the gap opens](02b-where-the-gap-opens.md)** | A function with two return shapes; `dict.get` collapsing absent into null; the `None` default argument; the sentinel pattern and the four the stdlib ships (`dataclasses.MISSING`, `Parameter.empty`, `argparse.SUPPRESS`, `functools.Placeholder`); making a sentinel a checker can narrow |
| 2c | **[Tri-states and the API boundary](02c-tri-states-and-the-api-boundary.md)** | `bool \| None` and SQL's three-valued logic; when three states become four and an `Enum` is the honest model; absent vs `null` vs empty over HTTP; JSON Merge Patch (RFC 7386) and its own limitation; query strings, env vars, forms, CSV |
| 3 | **[`and` and `or` return operands](03-and-or-return-operands.md)** | The documented exception: they return an operand, not a bool; short-circuiting as a guarantee; the `x or default` idiom and the exact line where it becomes a bug; chained config defaults; the `and` guard chain and PEP 505 being deferred |
| 3b | **[Precedence and negation](03b-precedence-and-negation.md)** | `and` before `or` and the authorisation check it breaks; `x == 1 or 2` always true; `("admin")` is not a tuple; `not`/`in`/`is` and ruff `E713`/`E714`; `not` vs `!=` vs `is not`, and why `!= True` misses `1` |
| 4 | **[`any` and `all`](04-any-and-all.md)** | The docs' equivalent code and the four facts in it; **`all([])` is `True`** and the four production shapes of that; generator argument versus list argument and `C419`; side effects under short-circuit |
| 4b | **[`any` and `all` in practice](04b-any-all-in-practice.md)** | Iterating a dict gives keys; `next((...), None)` and why a bare `next` is worse than a normal exception under PEP 479; the neighbouring-questions table; `not any` vs `all(not ...)` and the De Morgan refactoring bug |
| 5 | **[The walrus operator](05-the-walrus-operator.md)** | PEP 572's four motivating shapes; the truthiness trap it inherits (`while item := queue.get():`); the parenthesisation bug that binds a boolean; where it earns its place and where it does not |
| 5b | **[Walrus rules and scope](05b-walrus-rules-and-scope.md)** | The seven banned unparenthesised positions and the two where parentheses do not help; the precedence rule verbatim; the compile-time name-collision `SyntaxError`; the deliberate scope asymmetry where a comprehension's walrus leaks and its `for` target does not |

## The one paragraph the whole topic expands

An object is false only because its class said so, via `__bool__` or `__len__`;
everything else is true, including your own class that looks empty. Use
truthiness for the question it answers — *is this container empty* — and only
after you know you have a container. To ask *did I get a value*, write
`is None`, or a private sentinel when `None` is itself a legal value. `and` and
`or` hand back an operand rather than a bool, which makes `x or default`
convenient and makes it wrong for every falsy-but-legitimate value; `not` always
returns a real bool. `all([])` is `True`, so every "all the checks passed" guard
needs a non-emptiness check beside it. And `:=` lets you bind inside the
condition you were already testing — inheriting, along with the convenience,
every trap above.

## Where this connects

- **[Numbers](../02-numbers/README.md)** owns the `bool`-is-an-`int` story that
  this topic leans on — the singleton guarantee behind `is True`, why
  `True + True` is `2`, and [reading a bool in](../02-numbers/04f-reading-a-bool-in.md)
  for parsing rather than truth-testing environment variables and CLI flags.
- **[Comparisons](../06-comparisons/README.md)** is the next topic and the natural
  sequel: `is` versus `==`, chaining, and the rich-comparison protocol whose
  `NotImplemented` sentinel this topic meets in chunk 1c.
- **[Assignment semantics and aliasing](../07-assignment-and-aliasing/README.md)** owns the
  mutable-default trap that chunk 2b's `None`-sentinel form fixes.
- [Exceptions, the working set](../11-exceptions/README.md) is where "raise instead of
  returning `None`" becomes a design choice rather than an aside.
- **`None` and the "no result" contract** *(not written yet)* is the full
  treatment of the return-shape decision chunk 2b sketches.
- **Phase 6 — Typing** formalises it: `T | None` is the "there may be no value"
  half of the contract that a type checker can enforce, and `TypeIs`/`TypeGuard`
  are how a truthiness-shaped predicate narrows.

---

← Prev: [`bytes` vs `str`](../04-bytes-and-encoding/README.md) · Index: [Phase 1 — Language core](../README.md) · Next → [Comparisons](../06-comparisons/README.md)
