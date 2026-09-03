---
title: "08 · Docstrings: PEP 257 standards, formatting styles, and doctest verification"
sidebar_label: "Overview"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§3.2 Callable types), PEP 257, doctest module, inspect module.
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**Docstrings are compiled string literals that the Python compiler binds to callable `__doc__` attributes, bridging source documentation with runtime introspection. PEP 257 governs canonical structural rules—including imperative mood summaries and triple double-quote syntax—while the industry standardizes on Google and NumPy styles for readability. For programmatic inspection, `inspect.getdoc()` strips formatting noise and resolves docstrings up the class inheritance hierarchy. Finally, the standard `doctest` module ensures that code examples embedded in docstrings remain executable and verified against implementation changes.**

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[PEP 257 and docstring formats](./01-pep-257-and-major-docstring-formats.md)** | Compiler attachment to `__doc__`; bytecode stripping under the `-OO` optimization flag; PEP 257 conventions; comparing Google, NumPy, and Sphinx formats |
| 2 | **[help, getdoc, and doctest](./02-help-inspect-getdoc-and-doctest.md)** | Interactive `help()` pagination; programmatic introspection via `inspect.getdoc()` vs `__doc__`; whitespace normalization with `cleandoc`; executable verification with `doctest` |

## Phase gate

You are done with this topic when you can format a multi-line docstring according to PEP 257 and Google style, explain why `python -OO` breaks frameworks that rely on `__doc__`, explain why `inspect.getdoc()` is superior to raw `__doc__`, and write executable tests using `doctest`.

## Where this connects

- **[Topic 01 — `def` and `return`](../01-def-and-return/README.md)** — functions store docstrings in their code objects.
- **[Topic 05 — Decorators](../05-decorators/README.md)** — explains why decorators must use `@functools.wraps` to prevent docstring erasure.
- **[Topic 09 — Annotations at runtime](../09-annotations-at-runtime/README.md)** — explores type annotations alongside docstrings for complete function self-documentation.

---

← Prev: [07 · Callables beyond functions](../07-callables-beyond-functions/README.md) · Next → [PEP 257 and docstring formats](01-pep-257-and-major-docstring-formats.md)
