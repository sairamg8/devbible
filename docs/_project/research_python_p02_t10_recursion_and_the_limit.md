---
name: research-python-p02-t10-recursion-and-the-limit
description: Banked Research: Python Phase 2 · Topic 10 — Recursion and the limit
metadata:
  type: research
---

# Banked Research: Python Phase 2 · Topic 10 — Recursion and the limit

> Verified: 2026-09-03 against Python 3.14 Language Reference, sys module (getrecursionlimit, setrecursionlimit), Guido van Rossum's blog ("Tail Call Optimization").
> Target: **CPython 3.14** (3.14.7).
> Do not re-derive.

---

## 1. Primary Sources & Verbatim Quotes

### Python 3.14 Library Reference — sys.getrecursionlimit / sys.setrecursionlimit
URL: https://docs.python.org/3.14/library/sys.html#sys.getrecursionlimit
- `sys.getrecursionlimit()`:
  - *"Return the current value of the recursion limit, the maximum depth of the Python interpreter stack. This limit prevents infinite recursion from causing an overflow of the C stack and crashing Python."*
- `sys.setrecursionlimit(limit)`:
  - *"Set the maximum depth of the Python interpreter stack to `limit`. This limit prevents infinite recursion from causing an overflow of the C stack and crashing Python. The highest possible limit is platform-dependent."*
  - *"A user may need to set the limit higher when they have a program that requires deep recursion and a platform that supports a higher limit. This should be done with care, because a too-high limit can lead to a crash."*

### Guido van Rossum on Tail Call Optimization (2009)
- *"Python does not do tail call elimination. This is intentional. First, tail call elimination breaks stack traces: when an exception is thrown, the stack trace will not show the intermediate calls. Second, Python is not a functional language; iteration using `while` and `for` is the idiomatic way to express repetitive execution."*

---

## 2. Key Architecture & Pitfalls

1. **CPython Frame Size & Native C Stack**:
   Each Python frame allocates a full heap `PyFrameObject` AND consumes space on the operating system C call stack for the interpreter loop (`_PyEval_EvalFrameDefault`). Exceeding the OS stack triggers an abrupt OS crash (`SIGSEGV`), not a Python exception.
2. **`RecursionError` Protection**:
   `RecursionError` is a subclass of `Exception` (specifically `BuiltinException`). It is raised before the OS stack boundary is violated.
3. **Explicit Stack vs Call Stack**:
   Transforming recursion to iteration by managing an explicit `list` as a stack stores data on the heap (virtually unbounded, gigabytes of RAM) rather than the fixed native execution thread stack (typically 8MB).
