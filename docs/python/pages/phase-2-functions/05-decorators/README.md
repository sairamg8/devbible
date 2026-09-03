---
title: "05 · Decorators: written from scratch, functools.wraps, arguments, and stacking"
sidebar_label: "Overview"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§8.6 Function definitions, §8.7 Class definitions),
> Python Standard Library (functools module, inspect module), PEP 318, PEP 612.
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**Decorators are higher-order callables that transform or wrap functions and classes at definition time: `@dec def f()` is strictly syntactic sugar for `f = dec(f)`. Because decorators execute once when modules are loaded while their inner wrappers execute on every call, understanding this two-phase lifecycle is fundamental to Python architecture. Production decorators must apply `@functools.wraps` to prevent metadata erasure and enable runtime unwrapping via `inspect.unwrap()`. When taking configuration arguments, decorators expand into three-tier nested factories. When stacked, decorators wrap bottom-up but execute top-down, and class-based decorators require the descriptor protocol (`__get__`) to avoid the method-binding trap.**

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Decorator protocol from scratch](./01-the-decorator-protocol-from-scratch.md)** | The desugared `@` syntax; definition-time versus call-time execution lifecycle; seven-step production decorator template; return value transformation; exception interception |
| 2 | **[Metadata preservation with functools.wraps](./02-metadata-preservation-with-functools-wraps.md)** | Metadata erasure disaster (`__name__`, `__doc__`, signatures); `WRAPPER_ASSIGNMENTS` and `WRAPPER_UPDATES`; traversing `__wrapped__` with `inspect.unwrap`; typesafe decorators using PEP 612 `ParamSpec` |
| 3 | **[Decorators taking arguments and factories](./03-decorators-taking-arguments-and-factories.md)** | The three-tier closure structure (factory, decorator, wrapper); eager definition-time parameter validation; implementing the dual-mode decorator pattern supporting both `@dec` and `@dec(...)` |
| 4 | **[Stacking order and class-based decorators](./04-stacking-decorators-and-class-decorators.md)** | Mathematical composition of stacked decorators; bottom-up wrapping vs top-down call execution; security order hazards (`@auth` vs `@cache`); class decorators implementing `__call__`; resolving the method descriptor binding trap via `__get__` |

## Phase gate

You are done with this topic when you can implement a decorator from scratch, preserve metadata and type hints with `functools.wraps` and `ParamSpec`, construct a three-tier decorator factory, predict the exact execution order of stacked decorators, and explain why class-based decorators require `__get__` when decorating instance methods.

## Where this connects

- **[Topic 01 — `def` and `return`](../01-def-and-return/README.md)** — establishes functions as first-class objects that can be passed to and returned from other functions.
- **[Topic 02 — Parameters in full](../02-parameters-in-full/README.md)** — explains `*args, **kwargs` forwarding and `ParamSpec` signature preservation.
- **[Topic 03 — Scope and closures](../03-scope-and-closures/README.md)** — decorators are closures that capture the wrapped function in heap cell objects.
- **Topic 06 — `functools`** *(not written yet)* — explores `lru_cache`, `cache`, and `singledispatch`, which are standard library decorators.

---

← Prev: [04 · lambda](../04-lambda/README.md) · Next → [Decorator protocol from scratch](01-the-decorator-protocol-from-scratch.md)
