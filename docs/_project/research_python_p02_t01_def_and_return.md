---
name: research-python-p02-t01-def-and-return
description: Banked Research: Python Phase 2 · Topic 01 — def and return
metadata:
  type: research
---

# Banked Research: Python Phase 2 · Topic 01 — def and return

> Verified: 2026-09-03 against Python 3.14 Language Reference and Library Reference.
> Target: **CPython 3.14** (3.14.7).
> Do not re-derive.

---

## 1. Primary Sources & Verbatim Quotes

### Python 3.14 Language Reference §8.6 — The `def` statement (Function definitions)
URL: https://docs.python.org/3.14/reference/compound_stmts.html#function-definitions
- *"A function definition is an executable statement. Its execution binds the function name in the current local namespace to a function object (a wrapper around the executable code for the function)."*
- *"This function object contains references to the current global namespace as the global namespace to be used when the function is called."*
- *"The function definition does not execute the function body; this gets executed only when the function is called."*
- *"The function definition may include one or more decorator expressions. Decorator expressions are evaluated when the function is defined, in the scope that contains the function definition."*

### Python 3.14 Language Reference §7.6 — The `return` statement
URL: https://docs.python.org/3.14/reference/simple_stmts.html#the-return-statement
- *"`return` may only occur syntactically nested in a function definition, not within a nested class definition."*
- *"If an expression list is present, it is evaluated, else `None` is substituted."*
- *"`return` leaves the current function call with the expression list (or `None`) as return value."*
- *"When `return` passes control out of a `try` statement with a `finally` clause, that `finally` clause is executed before really leaving the function."*
- *"In a generator function, the `return` statement indicates that the generator is done and will cause `StopIteration` to be raised. The return value (if any) is used as an argument to construct `StopIteration` and becomes the `value` attribute of it."*
- *"In an asynchronous generator function, an empty `return` statement indicates that the asynchronous generator is done and will cause `StopAsyncIteration` to be raised. A non-empty `return` statement is a syntax error in an asynchronous generator function."*

### Python 3.14 Data Model §3.2 — Internal types / Callable types
URL: https://docs.python.org/3.14/reference/datamodel.html#the-standard-type-hierarchy
- User-defined functions have attributes:
  - `__name__`: The function's name.
  - `__qualname__`: The function's qualified name (PEP 3155).
  - `__doc__`: The function's documentation string, or `None` if unavailable. Not inherited by subclasses.
  - `__module__`: The name of the module the function was defined in, or `None`.
  - `__defaults__`: A tuple containing default argument values for those arguments that have defaults, or `None` if no arguments have a default.
  - `__code__`: The code object representing the compiled function body.
  - `__globals__`: A reference to the dictionary that holds the function's global variables — the global namespace of the module in which the function was defined.
  - `__dict__`: The namespace supporting arbitrary function attributes.
  - `__closure__`: `None` or a tuple of cells that contain bindings for the function's free variables.
  - `__annotations__`: A dict containing annotations of parameters. (Evaluated lazily in 3.14 per PEP 649/749).
  - `__kwdefaults__`: A dict containing defaults for keyword-only parameters.

### Execution semantics & Control Flow
- When execution falls off the end of a function suite without encountering a `return` statement, the function returns `None`.
- Tuple packaging: `return a, b` is parsed as returning the expression list `a, b`, which forms a tuple object `(a, b)`.
- The `finally` precedence: If a `try` block executes a `return`, but the associated `finally` block also executes a `return` or `break`/`continue` or raises an exception, the `finally` action overrides the pending `return`.

---

## 2. Key Insights & Distinctions

1. **`def` is not a declaration**: In C++/Java, function declarations exist at compile-time. In Python, `def f():` is executed at runtime. Functions can be defined conditionally inside `if` blocks, inside loops, or inside other functions.
2. **First-class objects**: A function is an instance of `types.FunctionType` (inheriting from `object`). It can be bound to names, stored in lists/dicts, passed to higher-order functions (`map`, `filter`, `sorted`, `min`, `max`), and have user-defined attributes attached via `__dict__`.
3. **Callable reference vs Call**: `func` passes the object reference; `func()` invokes the function. Passing `func()` when `func` is expected causes immediate execution, passing the return value (`None` or whatever `func()` returned) into the receiver.
4. **Implicit vs Explicit `None`**:
   - Falling off the end returns `None`.
   - Bare `return` returns `None`.
   - `return None` explicitly returns `None`.
   - In type checkers (PEP 484 / mypy / pyright), a function returning `None` by falling off has return type `None`. If some paths return a value and others fall off, it returns `T | None`.
5. **Forgotten Return bug**:
   - Conditional branches where one path omits `return`.
   - In-place mutating operations (e.g. `list.sort()`, `random.shuffle()`) that return `None`. Writing `return my_list.sort()` returns `None`.
6. **`finally` override**:
   - A `return` inside `finally` silently suppresses and discards any active exception or previous `return` from `try`.
