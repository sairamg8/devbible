---
title: "Closures and the late-binding loop trap: cell objects, shared variables, and three solutions"
sidebar_label: "03 · Closures and late-binding"
sidebar_position: 32
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§4.2 Naming and binding),
> Python Data Model (§3.2 Internal types).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**A closure is a function that retains access to variables from its lexical enclosing scope even after the outer function has finished executing. In CPython, closures do not snapshot variable values at creation time; they hold references to heap-allocated `cell` objects (`types.CellType`) that point to shared locations. This reference semantics directly causes the ubiquitous "late-binding loop bug"—where callbacks created inside a loop all evaluate against the loop variable's final value. Curing this bug requires forcing eager binding through default parameter capture, helper factory scopes, or `functools.partial`.**

## Anatomy of a closure: how CPython uses cell objects

When a nested function references a variable defined in an outer function, that variable is called a **free variable**. CPython does not copy the value into the child function; it packages the variable into a `cell` object:

```python
def make_greeter(greeting: str):
    def greet(name: str) -> str:
        return f"{greeting}, {name}!"
    return greet

hello_fn = make_greeter("Hello")

# Introspecting the closure
print(hello_fn.__code__.co_freevars)  # ('greeting',)
print(hello_fn.__closure__)            # (<cell at 0x...: str object at 0x...>,)
print(hello_fn.__closure__[0].cell_contents)  # "Hello"
```

A `cell` object is a small internal proxy with a single pointer: `cell.cell_contents`. Both the outer function and the inner function hold references to the same cell object. When either scope rebinds the variable, `cell_contents` updates in place.

## The late-binding loop trap

Because closures bind to the *cell* rather than the *value*, generating closures in a loop produces unexpected behavior:

```python
def build_multipliers():
    multipliers = []
    for i in range(5):
        # BUG: Each lambda references the loop variable 'i'
        multipliers.append(lambda x: x * i)
    return multipliers

fns = build_multipliers()
# All functions return x * 4!
print([fn(10) for fn in fns])  # [40, 40, 40, 40, 40]
```

### Why this happens

1. The loop runs from `0` to `4`.
2. Every lambda created inside the loop captures the **same single cell object** created for variable `i`.
3. At the end of the loop, `i` has the value `4`.
4. When `fn(10)` is invoked later, the lambda evaluates `x * i`. It dereferences its cell, reads `cell_contents` (which is now `4`), and returns `40`.

This affects event listeners, UI callbacks, Celery tasks, and asynchronous tasks generated in loops.

## The three proven solutions

### Solution 1: Default argument capture (the standard idiom)

Default argument expressions are evaluated once at definition time. You can exploit this to bind the current value eagerly:

```python
def build_multipliers_default():
    multipliers = []
    for i in range(5):
        # i=i evaluates the current value of i into the lambda's __defaults__
        multipliers.append(lambda x, i=i: x * i)
    return multipliers

fns = build_multipliers_default()
print([fn(10) for fn in fns])  # [0, 10, 20, 30, 40]
```

**Trade-off:** The parameter `i` is now exposed on the function's signature. A caller passing two arguments `fn(10, 99)` will override the captured default.

### Solution 2: Factory function (dedicated activation frame)

Calling a helper function creates a fresh local scope with its own distinct cell object for each iteration:

```python
def make_multiplier(val: int):
    # 'val' is local to this activation frame
    return lambda x: x * val

def build_multipliers_factory():
    return [make_multiplier(i) for i in range(5)]

fns = build_multipliers_factory()
print([fn(10) for fn in fns])  # [0, 10, 20, 30, 40]
```

**Advantage:** Clean signature; `val` is not exposed in the returned function's parameter list.

### Solution 3: `functools.partial`

`functools.partial` binds arguments eagerly at creation time without using a closure:

```python
from functools import partial

def multiply(val: int, x: int) -> int:
    return x * val

def build_multipliers_partial():
    # partial freezes 'i' as the first positional argument
    return [partial(multiply, i) for i in range(5)]

fns = build_multipliers_partial()
print([fn(10) for fn in fns])  # [0, 10, 20, 30, 40]
```

**Advantage:** Explicit, robust, and works cleanly with tools that inspect partial application.

## Gotchas

### Accidental argument override with default capture
**Symptom.** An event callback generated via `lambda event, id=id: handle(event, id)` receives incorrect data when the event dispatcher passes extra positional arguments.
**Cause.** The event dispatcher passed arguments positionally (`callback(event, source)`), which unintentionally overwrote the `id` default parameter.
**Fix.** Use keyword-only default capture or a helper factory function:

```python
# BROKEN: dispatcher passing 2 arguments overrides item_id
callbacks = [lambda event, item_id=item_id: on_click(event, item_id) for item_id in ids]

# FIXED: keyword-only default cannot be overwritten positionally
callbacks = [lambda event, *, item_id=item_id: on_click(event, item_id) for item_id in ids]
```

### Late-binding in list comprehensions
**Symptom.** Developers assume list comprehensions avoid the late-binding bug because comprehensions have their own scope in Python 3.
**Cause.** While comprehensions have their own scope, the loop variable is still shared across all iterations of that comprehension.
**Fix.** Apply the default capture idiom inside the comprehension:

```python
# BROKEN: all lambdas capture the comprehension's loop variable
actions = [lambda: i for i in range(3)]
# [fn() for fn in actions] -> [2, 2, 2]

# FIXED: force eager capture
actions = [lambda i=i: i for i in range(3)]
# [fn() for fn in actions] -> [0, 1, 2]
```

## Interview questions

**★ Q: What is late-binding in Python closures, and why does it occur?**
Late-binding means that closures look up the values of free variables when the inner function is *executed*, not when it is *defined*. CPython implements closures using `cell` objects that store a pointer to the variable in heap memory. When a function references an outer variable, it dereferences that cell at runtime, reading whatever value currently resides in the cell.

**★ Q: How do you fix the late-binding loop bug in Python? Name at least two approaches.**
1. **Default argument capture:** Define `lambda arg, val=val: ...`. Because default expressions are evaluated at definition time, the current loop value is stored in `__defaults__`.
2. **Factory function:** Pass the loop variable to an outer helper function `def make_handler(val): return lambda: ...`. Each call creates an independent stack frame with a unique cell object.
3. **`functools.partial`:** Use `partial(func, val)` to freeze the argument eagerly.

**★ Q: How are closures physically implemented in CPython? What is a cell object?**
In CPython, a closure is supported by `cell` objects (`types.CellType`). When an outer function defines a variable that is referenced by an inner function, the compiler marks it in `__code__.co_cellvars`. CPython allocates a `cell` object on the heap to hold the variable reference. The inner function stores a tuple of these cells in its `__closure__` attribute (listed in `co_freevars`), allowing both functions to read and rebind the same memory location.

**Q: Why does `lambda i=i: i` work to fix the loop bug, and what is its drawback?**
It works because Python evaluates default argument expressions once at definition time and stores the result in the function's `__defaults__` tuple. Inside the lambda, `i` is treated as a local parameter with a pre-evaluated default rather than a free variable. Its drawback is that `i` becomes part of the public callable signature, allowing callers to accidentally override the frozen value if they pass excess positional arguments.

**Q: How can you inspect the variables captured by a closure at runtime?**
Inspect the function's `__code__.co_freevars` tuple to get the names of captured variables, and inspect `__closure__` to access the tuple of `cell` objects. The value stored in each cell is retrieved via `cell.cell_contents`.

---

← [global vs nonlocal](02-mutating-enclosing-state-global-vs-nonlocal.md) · [Topic index](README.md) · Next → [Memory leaks and inspection](04-closure-memory-retention-and-inspection.md)
