---
title: "01 · Functions as first-class values, and the forgotten return"
sidebar_label: "Overview"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§8.6 Function definitions, §7.6 The return statement).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**Functions are Python's primary unit of procedural abstraction and design. Unlike languages where function signatures are static declarations handled at compile time, Python evaluates `def` as an ordinary executable statement at runtime, binding a first-class function object into the local namespace. Because functions are first-class objects, they can be stored in dictionaries to replace branching chains, passed into sorting algorithms and event listeners, and inspected dynamically. Every function returns a value: omitting an expression or running off the end yields `None` implicitly, in-place mutating methods return `None` by design, and executing a `return` inside `finally` silently suppresses exceptions.**

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The `def` statement and first-class functions](./01-def-statement-and-first-class-functions.md)** | `def` as an executable runtime statement; conditional function definitions; functions as first-class citizens in higher-order APIs (`sorted(key=...)`); replacing branching logic with O(1) dictionary dispatch tables; the `f` vs `f()` callback bug; function attributes (`__name__`, `__qualname__`, `__dict__`) |
| 2 | **[Return values and the `None` contract](./02-return-values-and-the-none-contract.md)** | Return semantics and implicit `None`; tuple packaging for multiple return values; command-query separation and why mutating methods (`list.sort()`) return `None`; the critical `finally` override hazard; generator `return` vs normal function returns |

## Phase gate

You are done with this topic when you can explain why `button.on_click(handler())` fails, how dictionary dispatch replaces fragile `if/elif` chains, why `data = data.sort()` blanks your dataset, and what dangerous bug occurs when a `return` is placed inside a `finally` block.

## Where this connects

- **[Phase 1 — Assignment semantics and aliasing](../../phase-1-language-core/07-assignment-and-aliasing/README.md)** — explains why function names are references to callable objects in heap memory rather than compile-time symbols.
- **[Phase 1 — `None` and the no-result contract](../../phase-1-language-core/14-none-and-no-result/README.md)** — details the convention of distinguishing "no result found" from empty results and errors.
- **[Topic 02 — Parameters in full](../02-parameters-in-full/README.md)** — explores what happens to parameter definitions, default argument evaluation, and signature enforcement when `def` executes.
- **Topic 05 — Decorators** *(not written yet)* — builds directly upon first-class functions and runtime `def` execution to wrap and transform callables dynamically.

---

← Prev: [Phase 2 — Functions, closures and decorators](../README.md) · Next → [The def statement and first-class functions](01-def-statement-and-first-class-functions.md)
