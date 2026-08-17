---
title: "Part 1 — Foundations"
sidebar_label: "1 · Foundations"
sidebar_position: 1
---

> Phases 0–2 · The runtime, the language core, and functions done properly

Python reads easy and that is precisely its trap: the syntax is learnable in a
weekend, while the semantics underneath — names vs objects, mutability, scope —
are what every non-trivial bug is made of. This part front-loads the semantics.

---

## Phase 0 — The runtime

What actually runs your code. Knowing this is the difference between "Python is
slow and weird about threads" and knowing *which* work Python is the wrong or
right tool for.

| Topic | Tier |
|---|---|
| What Python is: **CPython** — source → bytecode (`.pyc`, `__pycache__`) → the interpreter loop. The language vs its reference implementation | <span className="db-tier t-master">Master</span> |
| **The GIL**: one thread runs Python bytecode at a time — but **I/O releases it**, which is why threaded scrapers work and threaded number-crunching doesn't. **Free-threaded CPython** (experimental 3.13 → officially supported 3.14) and what it changes | <span className="db-tier t-master">Master</span> |
| Release model: one major each October — **3.14 current** (3.14.7), 3.13 in bugfix, **3.15 lands Oct 2026**; the 5-year support window, and reading "added in 3.12" in docs against your deploy target | <span className="db-tier t-understand">Understand</span> |
| **Installing and managing versions**: `uv` / `pyenv`, and the iron rule — **never install into the system Python** (the `sudo pip` that broke a server's package manager) | <span className="db-tier t-master">Master</span> |
| **Virtual environments**: what a venv actually is (a `pyvenv.cfg` and a path), why every project gets one, activation vs `uv run` | <span className="db-tier t-master">Master</span> |
| Running code: `python -m` (and why `-m` fixes "module not found" that plain `python file.py` causes), the REPL (rewritten in 3.13 — multiline, colors), `-c`, shebangs | <span className="db-tier t-understand">Understand</span> |
| **Everything is an object**: names bind to objects, `id`, **`is` vs `==`**, small-int caching — why `a = b` never copies anything | <span className="db-tier t-master">Master</span> |
| **Imports**: modules, packages, `sys.path`, absolute vs relative imports, `__init__.py` — and the classic self-shadowing bug: naming your file `random.py` | <span className="db-tier t-master">Master</span> |
| `if __name__ == "__main__"` — script vs import, and why multiprocessing on Windows/macOS breaks without it | <span className="db-tier t-master">Master</span> |
| Python vs Node for a backend — honest comparison: ecosystem shapes, concurrency models, typing stories. And PyPy/GraalPy as recognition-level alternatives | <span className="db-tier t-know">Know</span> |
| Startup and import cost — why CLIs feel slow, and **lazy imports (the `lazy` keyword, 3.15)** as the coming answer | <span className="db-tier t-know">Know</span> |
| Bytecode inspection with `dis` — seeing what a line actually does | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can explain why threads speed up 100 HTTP calls but
not 100 checksum computations — and what free-threaded CPython changes about
that answer.

---

## Phase 1 — Language core

The rows tiered Master here are the ones that produce production bugs when
half-known: mutability and aliasing, float money math, encoding.

| Topic | Tier |
|---|---|
| Syntax: indentation as structure, statements vs expressions, line continuation — and why a mixed-tabs file won't even parse | <span className="db-tier t-understand">Understand</span> |
| **Numbers**: `int` is arbitrary precision (no overflow, ever), `float` is IEEE-754 (`0.1 + 0.2` here too), **`Decimal` for money**, `//` and `%` **floor** semantics — `-7 // 2 == -4`, not `-3` like Java/JS | <span className="db-tier t-master">Master</span> |
| **Strings**: immutability, the method vocabulary (`split`, `join`, `strip`, `startswith`), **f-strings** — including `=` for debugging and format specs (`f"{price:,.2f}"`) | <span className="db-tier t-master">Master</span> |
| **`bytes` vs `str`** and encoding: decode at the boundary, work in `str`, encode on the way out — the `UnicodeDecodeError` that only appears with real-world data | <span className="db-tier t-understand">Understand</span> |
| **Truthiness**: empty things are falsy — and the bug where `if items:` treats "no results yet" and "empty results" the same; `and`/`or` returning operands, the walrus `:=` | <span className="db-tier t-master">Master</span> |
| Comparisons: chaining (`0 <= x < 10`), `is` for `None` only, rich comparisons across types | <span className="db-tier t-master">Master</span> |
| **Assignment semantics**: references and aliasing — passing a list to a function that mutates it mutates *yours*; when you need `copy` vs `deepcopy` | <span className="db-tier t-master">Master</span> |
| Control flow: `for`/`else` and `while`/`else` (the widely-misread clause), `break`/`continue`, `range`, looping idioms — `enumerate` and `zip` instead of index arithmetic | <span className="db-tier t-master">Master</span> |
| **Comprehensions**: list/dict/set, conditions, generator expressions — and the honest line where a nested comprehension should have been a loop | <span className="db-tier t-master">Master</span> |
| **`match` — structural pattern matching**: destructuring dicts and sequences, class patterns, guards — parsing webhook payloads by shape | <span className="db-tier t-understand">Understand</span> |
| **Exceptions, the working set**: `try`/`except`/`else`/`finally`, catching *specific* types (the bare `except:` that ate a `KeyboardInterrupt`), `raise ... from`, exception groups (3.11) at recognition level | <span className="db-tier t-master">Master</span> |
| EAFP vs LBYL — `try`/`except KeyError` vs `if key in` as a design stance, and when each is right | <span className="db-tier t-understand">Understand</span> |
| **Unpacking**: tuple assignment, starred unpacking (`first, *rest`), swap without temp, `*` and `**` in calls | <span className="db-tier t-master">Master</span> |
| `None`, and the "no result" contract: `None` vs empty vs raising — pick one per function and mean it | <span className="db-tier t-understand">Understand</span> |
| PEP 8 and idiom: what `ruff` will enforce anyway, naming, and the parts of "pythonic" that are real signal in code review | <span className="db-tier t-understand">Understand</span> |
| `del`, `pass`, `Ellipsis`, chained assignment corner cases | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can predict what
`def f(items=[]): items.append(1); return items` returns on the *third* call,
why `-7 // 2` is `-4`, and what `"café".encode("latin-1")` does to your JSON.

---

## Phase 2 — Functions, closures and decorators

Functions are Python's unit of design. Decorators — which every framework in
Part 3 hands you — are just functions about functions, and this phase makes
that literal.

| Topic | Tier |
|---|---|
| `def`, `return` (`None` by default — the forgotten-return bug), functions as first-class values passed to `sorted(key=...)` and friends | <span className="db-tier t-master">Master</span> |
| **Parameters in full**: defaults (**evaluated once — the mutable default trap**), `*args`/`**kwargs`, keyword-only (`*,`), positional-only (`/`), and designing a signature that survives growth | <span className="db-tier t-master">Master</span> |
| **Scope and closures**: LEGB, `global`/`nonlocal`, and the **late-binding closure in a loop** — the "every callback sees the last value" bug shared with JavaScript | <span className="db-tier t-master">Master</span> |
| `lambda` — single expressions only; idiomatic as `key=`, a smell as a named function | <span className="db-tier t-master">Master</span> |
| **Decorators**: writing one from scratch, `functools.wraps` (or lose the name and docstring), decorators with arguments, stacking — a `@timed` and a `@retry` built by hand, so `@app.get` stops being magic | <span className="db-tier t-master">Master</span> |
| **`functools`**: `partial`, `lru_cache`/`cache` (and why caching an unhashable-argument function throws), `singledispatch`, `reduce` | <span className="db-tier t-understand">Understand</span> |
| Callables beyond functions: `__call__`, bound methods, and what `self` actually is | <span className="db-tier t-understand">Understand</span> |
| Docstrings — the format your team uses, and `help()` | <span className="db-tier t-understand">Understand</span> |
| Annotations at runtime: lazy evaluation by default since **3.14 (PEP 649/749)** — what changed for the `from __future__ import annotations` era | <span className="db-tier t-know">Know</span> |
| Recursion and the recursion limit — Python has no tail-call optimization; iterate | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** a `@retry(times=3, backoff=0.1)` decorator with correct
`functools.wraps` metadata, working on both plain functions and methods — and a
one-line explanation of the mutable-default trap for a code review.

---

← Index: [Python](../README.md) · Next → [Part 2 — The data model](02-data-model.md)
