---
title: "Phase 2 — Functions, closures and decorators"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Python 3.14** (3.14.7, August 2026). Documentation-validated — every
> page names its sources on a `> Verified:` line (docs.python.org/3.14, the PEPs,
> the language reference). No sandbox: pages carry Python code, never fabricated
> program output.

Functions are Python's unit of design. Phase 1 was the language you write
*inside* a function; this phase is the function itself — its signature, the
scope it closes over, and the fact that it is an ordinary object you can pass
around, store in a dict, and wrap.

That last part is what makes decorators stop being magic. `@app.get("/users")`
is not framework syntax; it is a function call returning a function, applied to
the function below it. Once you have written `@retry` by hand, every decorator
you meet for the rest of your career is readable.

Two rows here are tiered **Master** because they produce the bugs that survive
review: a signature that grows badly, and a closure that captures a loop
variable by reference and hands every callback the last value.

🚧 **Not started — 0 of 10.** Phase 1 is 13 of 16 with three topics in flight.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **`def` and `return`** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Functions as first-class values, and the forgotten return |
| 02 | **Parameters in full** *(not written yet)* | <span className="db-tier t-master">Master</span> | Defaults evaluated once, `*args`/`**kwargs`, keyword-only, positional-only |
| 03 | **Scope and closures** *(not written yet)* | <span className="db-tier t-master">Master</span> | LEGB, `global`/`nonlocal`, and the late-binding loop bug |
| 04 | **`lambda`** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Idiomatic as `key=`, a smell as a named function |
| 05 | **Decorators** *(not written yet)* | <span className="db-tier t-master">Master</span> | Written from scratch, `functools.wraps`, arguments, stacking |
| 06 | **`functools`** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `partial`, `cache`, `singledispatch`, `reduce` |
| 07 | **Callables beyond functions** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `__call__`, bound methods, and what `self` actually is |
| 08 | **Docstrings** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | The format your team uses, and `help()` |
| 09 | **Annotations at runtime** *(not written yet)* | <span className="db-tier t-know">Know</span> | Lazy by default since **3.14** — PEP 649/749 |
| 10 | **Recursion and the limit** *(not written yet)* | <span className="db-tier t-know">Know</span> | No tail-call optimisation; iterate |

## Phase gate

The deliverable: a `@retry(times=3, backoff=0.1)` decorator with correct
`functools.wraps` metadata, working on both plain functions and methods — and a
one-line explanation of the mutable-default trap for a code review.

## Where this connects

- **[Phase 1 — Language core](../phase-1-language-core/README.md)** already owns
  the halves of this phase that are really about values:
  [assignment and aliasing](../phase-1-language-core/07-assignment-and-aliasing/README.md)
  explains *why* a mutable default is shared, and
  [`None` and the no-result contract](../phase-1-language-core/14-none-and-no-result/README.md)
  explains the implicit return this phase's topic 01 opens with.
- **Phase 4 — Classes and the data model** is where `__call__` and bound methods
  stop being curiosities and become the descriptor protocol.
- **Phase 5 — Iterators, generators, context managers** is the other half of
  "functions that are not quite functions".
- **Phase 6 — Typing** is where annotations get read rather than merely
  attached — and where 3.14's lazy evaluation changes what runtime
  introspection can assume.

---

← Prev: [Phase 1 — Language core](../phase-1-language-core/README.md) · Index: [Python — Explanations](../README.md)
