---
title: "10 · Recursion and the limit: sys.setrecursionlimit, RecursionError, and iteration"
sidebar_label: "Overview"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against Python 3.14 Library Reference (sys module), Guido van Rossum's architecture essays.
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**Python is designed around explicit iteration rather than unbounded functional recursion. Because every Python function call consumes native operating system thread stack memory in the interpreter loop, CPython enforces a 1,000-frame ceiling via `sys.getrecursionlimit()` to intercept runaway calls with `RecursionError` before native segmentation faults occur. Furthermore, Python intentionally omits Tail-Call Optimization (TCO) to preserve actionable debug stack traces. In production systems, algorithms traversing deep trees or complex graph structures must avoid deep recursion by refactoring to explicit heap-allocated stacks.**

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[RecursionError and the C-stack](./01-recursion-error-and-the-c-stack.md)** | The interpreter recursion ceiling; native OS C-stack constraints; catching `RecursionError`; the segmentation fault disaster of `sys.setrecursionlimit` |
| 2 | **[TCO absence and iteration](./02-tail-call-optimization-and-iteration.md)** | Architectural reasons Python rejects tail-call optimization; traceback preservation; converting recursive algorithms to iterative heap stacks (`list.pop()`); trampolining |

## Phase gate

You are done with this topic when you can explain why CPython caps recursion depth, why raising `sys.setrecursionlimit` leads to segmentation faults, why Python rejects TCO, and how to convert any recursive tree traversal into an explicit heap stack.

## Where this connects

- **[Topic 01 — `def` and `return`](../01-def-and-return/README.md)** — establishes the function call model and return semantics.
- **Phase 3 — Collections in depth** *(planned)* — deepens tree and graph data structures that require iterative traversal.
- **Phase 5 — Iterators and generators** *(planned)* — explores generator pipelines as a memory-efficient alternative to recursion.

---

← Prev: [09 · Annotations at runtime](../09-annotations-at-runtime/README.md) · Next → [RecursionError and the C-stack](01-recursion-error-and-the-c-stack.md)
