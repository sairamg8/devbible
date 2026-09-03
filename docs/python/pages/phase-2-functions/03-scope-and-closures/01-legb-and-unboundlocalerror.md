---
title: "The LEGB lookup rule and the compile-time origin of UnboundLocalError"
sidebar_label: "01 · LEGB and UnboundLocalError"
sidebar_position: 30
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§4.2 Naming and binding, §4.1 Execution model).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**Name resolution in Python follows the LEGB hierarchy: Local, Enclosing, Global, Built-in. However, scope membership is determined at compile time rather than dynamically during execution. The presence of any assignment target within a function (`x = ...`, `import x`, `for x in ...`, or `x += 1`) causes the compiler to classify that identifier as strictly local throughout the entire function body. If code reads that variable before the assignment line executes, Python does not fall back to outer scopes—it raises `UnboundLocalError`. Furthermore, Python has function-level scoping rather than block-level scoping, meaning loop and branch variables leak into the surrounding function.**

## The LEGB resolution hierarchy

When a variable name is referenced in Python code, the interpreter searches four namespaces in a strict order:

```
[ L ] Local       — Names bound inside the current function (parameters, local assignments).
[ E ] Enclosing   — Names in the local scope of any enclosing functions (closures).
[ G ] Global      — Names defined at the top level of the current module, or declared global.
[ B ] Built-in    — Names built into Python (len, range, Exception, None).
```

If the name is not found in any of these four namespaces, Python raises `NameError: name 'x' is not defined`.

```python
# Demonstrating the four scopes
builtin_name = len  # Built-in

global_var = "module level"  # Global

def outer():
    enclosing_var = "outer level"  # Enclosing

    def inner():
        local_var = "inner level"  # Local
        print(local_var)       # Found in Local
        print(enclosing_var)   # Found in Enclosing
        print(global_var)      # Found in Global
        print(len([1, 2, 3]))  # Found in Built-in

    return inner
```

## The compile-time origin of `UnboundLocalError`

A common beginner assumption is that Python checks local variables at runtime and falls back to global variables if the local variable is not yet initialized. **This is false.** The Language Reference explicitly specifies:

> *"If a name is bound in a block, it is a local variable of that block, and its scope is that block. If the name is used in a code block before it is bound, it is a local variable that has not yet been bound, and a `UnboundLocalError` is raised."*

Scope is decided during compilation (bytecode generation). Any statement that binds a name marks that name as a local variable across the entire function suite:

```python
counter = 100

def increment():
    # Attempting to read counter here causes an immediate crash:
    # UnboundLocalError: cannot access local variable 'counter' where it is not associated with a value
    counter += 1
```

### Why `counter += 1` triggers the error

The augmented assignment `counter += 1` is syntactic sugar for `counter = counter + 1`.
1. At **compile time**, the compiler inspects the AST of `increment()`. It finds an assignment target `counter = ...`. The compiler immediately registers `counter` in `__code__.co_varnames` (the local variables table).
2. At **runtime**, when `increment()` executes, the interpreter evaluates the right-hand side first (`counter + 1`). Because `counter` is registered as a local variable, the interpreter uses the fast bytecode instruction `LOAD_FAST` to read the local variable slot.
3. Because no value has been assigned to local `counter` yet, `LOAD_FAST` fails and raises `UnboundLocalError`.

The presence of an assignment anywhere in the function turns the variable local everywhere in the function, even on lines preceding the assignment:

```python
mode = "PRODUCTION"

def check_mode():
    print(mode)  # UnboundLocalError!
    mode = "DEVELOPMENT"
```

## Introspecting variable tables on code objects

You can inspect the compiler's scope classifications directly via the function's code object:

```python
def example(param):
    local_val = 10
    print(global_config)

code = example.__code__
print(code.co_varnames)  # ('param', 'local_val') -> strictly local names
print(code.co_names)     # ('print', 'global_config') -> global/builtin names looked up by name
```

Names in `co_varnames` are loaded by index (`LOAD_FAST`), whereas names in `co_names` trigger runtime dictionary lookups (`LOAD_GLOBAL`).

## Python has function scope, not block scope

Unlike C++, Java, or JavaScript (`let`/`const`), Python `if`, `while`, `for`, and `with` blocks do not create new scopes. Variables assigned inside a block remain accessible throughout the entire enclosing function:

```python
def process_items(items: list[str]) -> str:
    for item in items:
        cleaned = item.strip()

    # LEGAL: item and cleaned leak into the function scope!
    print(f"Last item was: {item}, cleaned: {cleaned}")
    return cleaned
```

If `items` was empty, the loop body never executes, and accessing `item` or `cleaned` raises `UnboundLocalError` because the names were registered as local at compile time but never bound at runtime.

## Gotchas

### Conditional initialization causing UnboundLocalError
**Symptom.** Intermittent `UnboundLocalError` in production when certain branching conditions are met.
**Cause.** A variable is assigned inside an `if` branch, but a subsequent line reads it when that branch did not execute.
**Fix.** Initialize local variables to default values (such as `None`) before conditional logic:

```python
# BROKEN: connection is unbound if use_cache is True
def fetch_data(use_cache: bool) -> dict:
    if not use_cache:
        connection = open_database()
    # If use_cache is True, connection is unbound here!
    return connection.query()  # UnboundLocalError

# FIXED: initialize beforehand
def fetch_data(use_cache: bool) -> dict:
    connection = None
    if not use_cache:
        connection = open_database()
    if connection is not None:
        return connection.query()
    return fetch_from_cache()
```

### Except clause variable deletion
**Symptom.** Accessing `e` after a `try/except Exception as e:` block raises `UnboundLocalError: cannot access local variable 'e'`.
**Cause.** Python intentionally deletes the exception target at the end of the `except` block to break reference cycles with tracebacks (`del e`).
**Fix.** Assign `e` to a distinct variable if the exception instance is needed outside the block:

```python
# BROKEN: e is deleted by Python when leaving the except block
try:
    risky_operation()
except ValueError as e:
    saved_error = e  # Assign to a different name
# print(e)           # UnboundLocalError!

# FIXED: use the captured alias
print(saved_error)
```

### Accidental loop target overwriting local state
**Symptom.** Variables defined earlier in a function are overwritten by loop iterations.
**Cause.** `for x in ...` rebinds `x` in the current function scope.
**Fix.** Use distinct, descriptive variable names for loop indices and targets:

```python
# BROKEN: loop target rebinds the parameter
def sync_users(user: str, user_list: list[str]) -> None:
    for user in user_list:
        notify(user)
    print(f"Finished sync for: {user}")  # 'user' is now the last item from user_list!

# FIXED: use distinct identifier
def sync_users(target_user: str, user_list: list[str]) -> None:
    for current_user in user_list:
        notify(current_user)
    print(f"Finished sync for: {target_user}")
```

## Interview questions

**★ Q: What does LEGB stand for, and in what order are scopes searched?**
LEGB stands for **Local**, **Enclosing**, **Global**, and **Built-in**. When an identifier is referenced, Python searches:
1. Local scope (current function).
2. Enclosing scopes (outer nested functions, from innermost to outermost).
3. Global scope (module-level namespace `__dict__`).
4. Built-in scope (`builtins` module).
If not found in any of these four, a `NameError` is raised.

**★ Q: Why does `x += 1` raise `UnboundLocalError` if `x` is defined as a global variable?**
Because Python determines scope statically at compile time. The statement `x += 1` contains an assignment (`x = x + 1`). The compiler detects an assignment to `x` within the function and marks `x` as a strictly local variable. At runtime, evaluating `x + 1` attempts to load the local variable `x` before any value has been bound to it, raising `UnboundLocalError`.

**★ Q: Does Python have block-level scoping inside `if` statements or `for` loops?**
No. Python has function-level and module-level scoping. Compound statements like `if`, `while`, `for`, `try`, and `with` do not create a new local scope. Any variable assigned inside these blocks is bound to the enclosing function's local namespace and remains accessible after the block terminates.

**Q: What happens to the target variable `e` in `except Exception as e:` after the block finishes?**
Python automatically deletes `e` at the end of the `except` block (equivalent to generating an implicit `del e` in a `finally` clause). This was introduced in Python 3 to prevent reference cycles between the exception instance, its `__traceback__`, and the local frame, which would delay garbage collection.

**Q: How does CPython decide whether a variable in a function is local or global?**
During compilation, CPython's symbol table pass inspects the AST of the function. Any identifier that appears on the left of an assignment (`=`, `+=`), as an `import` target, as a `for` loop target, or as a function/class definition is classified as local (`co_varnames`), unless explicitly declared with `global` or `nonlocal`.

---

← [Topic index](README.md) · Next → [global vs nonlocal](02-mutating-enclosing-state-global-vs-nonlocal.md)
