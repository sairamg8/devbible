---
title: "06 · functools: partial, lru_cache, singledispatch, and reduce"
sidebar_label: "Overview"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against Python 3.14 Library Reference (functools module).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**The `functools` module delivers standard library higher-order functions that extend callable capabilities without boilerplate. `partial` freezes function arguments eagerly at creation time, eliminating late-binding loop bugs while remaining picklable for multiprocessing. `@lru_cache` and `@cache` provide function memoization, trading memory for CPU performance, though decorating instance methods creates memory leaks unless managed via `cached_property`. Finally, `@singledispatch` brings modular, type-driven function overloading to Python, while `reduce` provides cumulative sequence folding.**

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[partial and partialmethod](./01-partial-and-freezing-callables.md)** | Eager argument freezing; avoiding loop late-binding bugs; picklable callbacks; runtime introspection via `.args` and `.keywords`; descriptor binding on classes via `partialmethod` |
| 2 | **[lru_cache and cache](./02-lru-cache-and-unbounded-cache.md)** | Bounded LRU caching vs unbounded `cache`; hashable argument requirements; distinct type caching via `typed=True`; the instance method memory leak trap; `@cached_property` alternative |
| 3 | **[singledispatch and reduce](./03-singledispatch-and-reduce.md)** | Ad-hoc polymorphism via `@singledispatch`; type-driven overloading; MRO inheritance resolution; method dispatch via `singledispatchmethod`; cumulative folding with `reduce`; empty sequence initializer contract |

## Phase gate

You are done with this topic when you can use `partial` to generate safe callbacks in loops, explain why decorating an instance method with `@lru_cache` causes memory leaks, implement a single-dispatch generic function, and safely handle empty iterables with `reduce`.

## Where this connects

- **[Topic 03 — Scope and closures](../03-scope-and-closures/README.md)** — explains why `partial`'s eager evaluation avoids the closure late-binding loop trap.
- **[Topic 04 — `lambda`](../04-lambda/README.md)** — contrasts `partial`'s picklability and introspection against anonymous lambdas.
- **[Topic 05 — Decorators](../05-decorators/README.md)** — details the decorator protocol used by `lru_cache`, `cache`, and `singledispatch`.
- **Topic 07 — Callables beyond functions** *(not written yet)* — explores `__call__` and the descriptor protocol underlying `partialmethod`.

---

← Prev: [05 · Decorators](../05-decorators/README.md) · Next → [partial and partialmethod](01-partial-and-freezing-callables.md)
