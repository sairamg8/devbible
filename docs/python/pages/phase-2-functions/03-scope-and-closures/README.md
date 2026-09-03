---
title: "03 · Scope and closures: LEGB, global, nonlocal, and the late-binding loop trap"
sidebar_label: "Overview"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§4.2 Naming and binding, §7.12 The global statement, §7.13 The nonlocal statement),
> PEP 3104.
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**Scope defines the visibility and lifecycle of variables in Python. While identifier resolution follows the runtime LEGB hierarchy (Local, Enclosing, Global, Built-in), variable locality is established statically at compile time: any assignment target marks a variable local throughout the entire function, making `counter += 1` raise `UnboundLocalError`. Rebinding variables in outer scopes requires explicit `global` or `nonlocal` statements. Furthermore, Python implements closures via heap-allocated `cell` objects rather than value snapshots, directly producing the late-binding loop bug where callbacks generated in loops evaluate to the loop's final state.**

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[LEGB and UnboundLocalError](./01-legb-and-unboundlocalerror.md)** | The LEGB search order; compile-time scope classification via `co_varnames`; why `x += 1` crashes with `UnboundLocalError`; lack of block scoping |
| 2 | **[Mutating enclosing state: global vs nonlocal](./02-mutating-enclosing-state-global-vs-nonlocal.md)** | Rebinding vs mutating in place; the `global` statement and concurrency hazards; the `nonlocal` statement (PEP 3104) and pre-existence checks; stateful closures vs classes |
| 3 | **[Closures and the late-binding loop trap](./03-closures-and-the-late-binding-trap.md)** | Implementation of closures via `cell` objects (`types.CellType`); the shared reference mechanism; the late-binding loop trap; three solutions (default argument capture, factory scopes, `functools.partial`) |
| 4 | **[Closure memory retention and inspection](./04-closure-memory-retention-and-inspection.md)** | Accidental retention of large activation records; cyclic references between instances and closures; breaking cycles with `weakref`; introspection with `inspect.getclosurevars` |

## Phase gate

You are done with this topic when you can explain why `total += 1` raises `UnboundLocalError`, how `nonlocal` differs from `global`, why `[lambda: i for i in range(5)]` returns 4 for every element, and how to identify memory leaks caused by closures retaining large scopes.

## Where this connects

- **[Phase 1 — Control flow](../../phase-1-language-core/08-control-flow/README.md)** — explains why loop variables leak into function scopes.
- **[Topic 01 — `def` and `return`](../01-def-and-return/README.md)** — provides the runtime function execution foundation that creates closures.
- **[Topic 02 — Parameters in full](../02-parameters-in-full/README.md)** — explains how default argument evaluation (`i=i`) forces eager binding in lambdas.
- **Topic 05 — Decorators** *(not written yet)* — decorators are fundamentally closures that wrap functions and access enclosing variables.

---

← Prev: [02 · Parameters in full](../02-parameters-in-full/README.md) · Next → [LEGB and UnboundLocalError](01-legb-and-unboundlocalerror.md)
