---
title: "07 · Callables beyond functions: __call__, bound methods, and what self actually is"
sidebar_label: "Overview"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§3.2 Standard type hierarchy: Callable types, §3.3.2.2 Descriptors).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**In Python, callability is a behavioral protocol rather than a type hierarchy constraint. Any object whose class implements the `__call__` dunder method can be invoked with function-call syntax, providing an object-oriented foundation for stateful middleware, token buckets, and pipeline processors. Furthermore, instance methods are not distinct language entities; they are ordinary functions converted into transient `types.MethodType` bound methods at runtime via Python's descriptor protocol (`__get__`). Understanding that `self` is simply an explicit parameter bound to `method.__self__` clarifies method dispatch and prevents memory retention leaks in callback architectures.**

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[__call__ and stateful instances](./01-the-call-dunder-and-stateful-instances.md)** | The `__call__` special method; class-level dunder resolution; building stateful rate limiters; trade-offs between closures and callable class instances; multiprocessing serialization |
| 2 | **[Bound methods and self](./02-bound-methods-and-the-reality-of-self.md)** | The reality of `self` as an explicit parameter; functions on classes vs bound methods on instances; descriptor protocol (`__get__`) mechanics; `__self__` and `__func__` reflection; preventing callback memory leaks via `weakref.WeakMethod` |

## Phase gate

You are done with this topic when you can implement a stateful callable class with `__call__`, explain why dynamic assignment to `instance.__call__` fails, explain the exact equivalence between `instance.method(x)` and `Class.method(instance, x)`, and prevent memory retention when registering bound methods as callbacks.

## Where this connects

- **[Topic 01 — `def` and `return`](../01-def-and-return/README.md)** — functions are first-class callable objects.
- **[Topic 05 — Decorators](../05-decorators/README.md)** — explains class-based decorators and the descriptor binding trap on methods.
- **[Topic 06 — `functools`](../06-functools/README.md)** — details `partialmethod` and `singledispatchmethod` which rely directly on descriptor binding.
- **Phase 4 — Classes and the data model** *(planned)* — deepens the descriptor protocol and attribute resolution mechanics.

---

← Prev: [06 · functools](../06-functools/README.md) · Next → [__call__ and stateful instances](01-the-call-dunder-and-stateful-instances.md)
