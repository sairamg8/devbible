---
title: "02 · Parameters in full: defaults evaluated once, variadics, positional-only, and keyword-only"
sidebar_label: "Overview"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§8.6 Function definitions, §6.3.4 Calls),
> PEP 570, PEP 3102, PEP 448, PEP 612.
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**A function's signature defines its interface with the rest of the application. In Python, parameter semantics contain critical nuances that separate junior scripts from production libraries. Default argument expressions are evaluated once when `def` executes, making mutable defaults like `[]` a major source of cross-request state corruption. The variadic parameters `*args` and `**kwargs` gather positional arguments into tuples and keyword mappings into dictionaries. Boundary markers `/` and `*` give library designers complete authority over call-site syntax—preventing boolean blindness and keyword collisions with `**kwargs`—while runtime reflection with `inspect.signature()` enables dependency injection and validation pipelines.**

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Default values and the mutable trap](./01-default-values-and-the-mutable-trap.md)** | Definition-time evaluation; `__defaults__` and `__kwdefaults__` storage; the accumulator bug across web requests; the canonical `None` idiom; private sentinel objects with `object()`; frozen dynamic defaults |
| 2 | **[Variadic parameters: *args and \*\*kwargs](./02-variadic-args-and-kwargs.md)** | Tuple and dictionary packing; universal forwarding in decorators; call-site unpacking; the duplicate keyword asymmetry with `{**d1, **d2}`; architectural hazards of `**kwargs` abuse; PEP 692 `TypedDict` typing |
| 3 | **[Positional-only and keyword-only parameters](./03-positional-only-and-keyword-only.md)** | The `/` (PEP 570) and `*` (PEP 3102) boundary markers; eradicating boolean blindness; preventing name collisions with `**kwargs`; the complete unified parameter grammar order |
| 4 | **[Signature design and evolution](./04-signature-design-and-evolution.md)** | Backward-compatibility rules for evolving public APIs; adding parameters safely as keyword-only; runtime introspection via `inspect.signature`; the five `Parameter.kind` enum variants; preserving signatures with `ParamSpec` |

## Phase gate

You are done with this topic when you can explain why `def f(a, items=[])` shares state across callers, why `{**a, **b}` allows duplicate keys but `f(**a, **b)` raises `TypeError`, how positional-only parameters (`/`) solve collisions in functions accepting `**kwargs`, and how to add new options to a mature public function without breaking existing callers.

## Where this connects

- **[Phase 1 — Assignment semantics and aliasing](../../phase-1-language-core/07-assignment-and-aliasing/README.md)** — explains why mutable objects passed as arguments or stored as defaults mutate across references.
- **[Topic 01 — `def` and `return`](../01-def-and-return/README.md)** — establishes `def` as an executable runtime statement where parameter evaluation occurs.
- **Topic 03 — Scope and closures** *(not written yet)* — explores how parameters form local variable scopes and bind free variables in closures.
- **Topic 05 — Decorators** *(not written yet)* — relies directly on `*args, **kwargs`, `functools.wraps`, and `ParamSpec` to preserve caller contracts.

---

← Prev: [01 · def and return](../01-def-and-return/README.md) · Next → [Default values and the mutable trap](01-default-values-and-the-mutable-trap.md)
