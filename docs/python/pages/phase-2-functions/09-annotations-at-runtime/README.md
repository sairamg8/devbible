---
title: "09 · Annotations at runtime: PEP 649 deferred evaluation and annotationlib"
sidebar_label: "Overview"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against [PEP 649](https://peps.python.org/pep-0649/), [PEP 749](https://peps.python.org/pep-0749/), [annotationlib](https://docs.python.org/3.14/library/annotationlib.html).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**Python 3.14 permanently resolves the decade-long tension between type hints, forward references, and runtime type introspection by introducing deferred evaluation of annotations by default (PEP 649 and PEP 749). Instead of evaluating annotations at import time or converting them into dumb strings, the compiler encapsulates expressions inside a synthetic `__annotate__` function. The new standard library `annotationlib` module provides the canonical reflection interface via `get_annotations()`, offering structured format selection across real types, resilient forward-reference proxies, and raw source strings while accelerating web framework startup times.**

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Deferred evaluation and __annotate__](./01-deferred-evaluation-and-the-annotate-protocol.md)** | Eager evaluation vs stringification vs deferred evaluation; compiler-generated `__annotate__` code objects; Format 1 (VALUE), 2 (VALUE_WITH_FAKE_GLOBALS), 3 (FORWARDREF), 4 (STRING); legacy `__annotations__` backward compatibility; PEP 563 future import coexistence |
| 2 | **[annotationlib and runtime reflection](./02-annotationlib-and-runtime-reflection.md)** | The `annotationlib` module; canonical extraction via `get_annotations()`; handling missing types via `ForwardRef` proxies; class inheritance and MRO schema extraction; cold-start performance improvements |

## Phase gate

You are done with this topic when you can explain how Python 3.14 evaluates annotations lazily, inspect annotations using `annotationlib.get_annotations()`, select between `Format.VALUE`, `Format.FORWARDREF`, and `Format.STRING`, and explain how `from __future__ import annotations` continues to function.

## Where this connects

- **[Topic 01 — `def` and `return`](../01-def-and-return/README.md)** — functions declare parameter and return annotations.
- **[Topic 08 — Docstrings](../08-docstrings/README.md)** — docstrings and type annotations together form the complete runtime self-documentation of Python callables.
- **Phase 6 — Typing** *(planned)* — deepens static type systems, generics, and protocol definitions.

---

← Prev: [08 · Docstrings](../08-docstrings/README.md) · Next → [Deferred evaluation and __annotate__](01-deferred-evaluation-and-the-annotate-protocol.md)
