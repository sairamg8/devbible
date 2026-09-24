---
name: research-python-p02-t03-scope-and-closures
description: Banked Research: Python Phase 2 · Topic 03 — Scope and closures
metadata:
  type: research
---

# Banked Research: Python Phase 2 · Topic 03 — Scope and closures

> Verified: 2026-09-03 against Python 3.14 Language Reference (§4.2 Naming and binding, §7.12 The global statement, §7.13 The nonlocal statement),
> and Data Model (§3.2 Internal types: code objects, cell objects).
> Target: **CPython 3.14** (3.14.7).
> Do not re-derive.

---

## 1. Primary Sources & Verbatim Quotes

### Python 3.14 Language Reference §4.2 — Naming and binding
URL: https://docs.python.org/3.14/reference/executionmodel.html#naming-and-binding
- *"A scope defines the visibility of a name in a block. If a local variable is defined in a block, its scope includes that block."*
- *"If a name is bound in a block, it is a local variable of that block, unless declared `nonlocal` or `global`."*
- *"If a name is bound in a block, it is a local variable of that block, and its scope is that block. If the name is used in a code block before it is bound, it is a local variable that has not yet been bound, and a `UnboundLocalError` is raised."*
- *"Python resolves names using the LEGB rule: Local, Enclosing (non-local), Global, Builtin."*

### Python 3.14 Language Reference §7.12 — The `global` statement
URL: https://docs.python.org/3.14/reference/simple_stmts.html#the-global-statement
- *"The `global` statement is a declaration which holds for the entire current code block. It means that the listed identifiers are to be interpreted as globals."*
- *"Names listed in a `global` statement must not be used in the same code block textually preceding that `global` statement."*
- *"Names listed in a `global` statement must not be defined as formal parameters, nor in a `for` loop control target, `class` definition, function definition, `import` statement, or variable annotation."*

### Python 3.14 Language Reference §7.13 — The `nonlocal` statement
URL: https://docs.python.org/3.14/reference/simple_stmts.html#the-nonlocal-statement
- *"The `nonlocal` statement causes the listed identifiers to refer to previously bound variables in the nearest enclosing scope excluding globals."*
- *"Names listed in a `nonlocal` statement, unlike those listed in a `global` statement, must refer to pre-existing bindings in an enclosing scope (the scope in which a new binding should be created cannot be determined unambiguously)."*
- *"Names listed in a `nonlocal` statement must not collide with pre-existing bindings in the local scope."*

### Python 3.14 Data Model §3.2 — Cell objects & Closures
URL: https://docs.python.org/3.14/reference/datamodel.html#the-standard-type-hierarchy
- *"Cell objects are used to implement the free variables of a closure. For each free variable in a function, a cell object is created."*
- Function attributes:
  - `__closure__`: `None` or a tuple of cells that contain bindings for the function's free variables.
  - `cell.cell_contents`: the referenced object stored in the cell.
  - `__code__.co_freevars`: tuple of names of free variables (variables used in a function that are not local to it).
  - `__code__.co_cellvars`: tuple of names of local variables that are referenced by nested functions.

---

## 2. Key Mechanisms & Gotchas

1. **Compile-time Scope Binding vs Runtime Lookup**:
   Python decides whether a variable is local at *compile time*, not at runtime. Any assignment `name = ...` anywhere in a function body marks `name` as local throughout the function. Accessing `name` prior to that assignment line raises `UnboundLocalError`, even if a global or enclosing variable with the same name exists!
2. **Late-binding in closures**:
   Closures store a reference to a `cell` object, NOT a snapshot of the value. When a loop creates functions that reference loop variable `i`, all closures share the exact same cell object. When called later, they all read `cell.cell_contents`, which is the final value of the loop.
   Fixes:
   - `def f(i=i): ...` (captures current value in `__defaults__`).
   - Helper factory function: `def make_fn(val): return lambda: val`.
   - `functools.partial(fn, i)`.
3. **`nonlocal` vs `global`**:
   - `global x`: rebinds module-level global `x`. If `x` didn't exist, assignment creates it in `globals()`.
   - `nonlocal x`: rebinds variable in outer nested scope. If `x` does not exist in an outer function scope, Python raises a compile-time `SyntaxError: no binding for nonlocal 'x' found`. Cannot refer to global/module scope.
4. **Memory retention via closures**:
   If an inner function closes over even one attribute or variable in an outer frame, cell references keep the referenced objects alive in memory, which can prevent garbage collection of large datasets or cause cyclical reference leaks.
