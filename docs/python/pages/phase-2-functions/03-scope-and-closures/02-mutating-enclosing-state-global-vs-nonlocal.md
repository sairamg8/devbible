---
title: "Mutating enclosing state: explicit scope rebinding with global and nonlocal"
sidebar_label: "02 · global vs nonlocal"
sidebar_position: 31
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§7.12 The global statement, §7.13 The nonlocal statement),
> PEP 3104 (Access to Names in Outer Scopes).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**In Python, inner functions can read variables from enclosing and global namespaces by default, but any assignment statement rebinds the identifier in the local scope. To rebind an existing identifier in an outer scope, Python requires explicit declarations: `global` rebinds to the module-level namespace, whereas `nonlocal` (PEP 3104) rebinds to the nearest enclosing function scope. The distinction is mechanically enforced: `global` can introduce new module-level bindings dynamically, but `nonlocal` strictly demands a pre-existing binding in an enclosing function and raises a compile-time `SyntaxError` if none exists.**

## Reading versus rebinding: the critical distinction

Before using `global` or `nonlocal`, recognize the difference between **rebinding a name** and **mutating an object**:

```python
shared_list = []
config_status = "INITIAL"

def modify_state():
    # 1. MUTATING AN OBJECT: No declaration needed!
    # 'shared_list' is read from global scope; its append() method mutates it in place.
    shared_list.append("item")

    # 2. REBINDING A VARIABLE: Causes UnboundLocalError or creates a local variable!
    # config_status = "RUNNING"  <- This would create a LOCAL config_status!
```

You never need `global` or `nonlocal` to call mutating methods (`.append()`, `.update()`, `.pop()`) on mutable objects retrieved from outer scopes. You only need declarations when using the assignment operator (`=`, `+=`, `-=`) to rebind the identifier itself to a different object.

## The `global` statement

The `global` statement informs the compiler that listed identifiers belong to the module namespace:

```python
server_ready = False

def initialize_server():
    global server_ready
    # Rebinds module-level server_ready
    server_ready = True
```

### Production hazards of `global`

In backend applications, module-level `global` variables create severe problems:
1. **Concurrency bugs:** Threads and asynchronous tasks sharing global state overwrite each other without synchronization, leading to race conditions.
2. **Testing pollution:** Unit tests modifying global state leak side effects into subsequent test cases, requiring fragile teardown hooks.
3. **Hidden couplings:** Functions depending on globals are difficult to refactor, compose, or run in parallel.

## The `nonlocal` statement (PEP 3104)

Prior to Python 3.0, nested functions could read enclosing variables (creating read-only closures), but could never rebind them. PEP 3104 introduced `nonlocal` to bridge this gap:

```python
def make_counter(start: int = 0):
    count = start

    def increment() -> int:
        nonlocal count
        count += 1
        return count

    return increment

counter_a = make_counter(10)
print(counter_a())  # 11
print(counter_a())  # 12

counter_b = make_counter(100)
print(counter_b())  # 101 (independent enclosing state!)
```

`nonlocal count` tells the compiler to search outer enclosing function scopes (from innermost to outermost) and bind `count` to the first match found.

## Key differences: `global` vs `nonlocal`

| Feature | `global` | `nonlocal` (PEP 3104) |
|---|---|---|
| Target namespace | Module-level (`globals()`) | Nearest enclosing function |
| Searches module scope? | Yes | **No** (stops before module scope) |
| Must target exist? | No (can create new global) | **Yes** (raises `SyntaxError` if absent) |
| Can target parameters? | No | Yes (parameters of outer functions) |

### The `nonlocal` pre-existence guarantee

The Language Reference enforces:

> *"Names listed in a `nonlocal` statement, unlike those listed in a `global` statement, must refer to pre-existing bindings in an enclosing scope (the scope in which a new binding should be created cannot be determined unambiguously)."*

If an identifier is not defined in an enclosing function, Python rejects the code at compile time:

```python
module_var = 10

def test():
    # COMPILE ERROR: SyntaxError: no binding for nonlocal 'module_var' found
    nonlocal module_var
    module_var = 20
```

`nonlocal` never binds to module globals; use `global` for module-level variables.

## When to use stateful closures vs classes

A closure with `nonlocal` is ideal for lightweight single-function state (such as retry counters, memoization flags, or rate limiters):

```python
def rate_limiter(max_calls: int):
    calls = 0

    def allow_request() -> bool:
        nonlocal calls
        if calls >= max_calls:
            return False
        calls += 1
        return True

    return allow_request
```

When state complexity grows to require multiple mutating actions (e.g. `increment`, `reset`, `inspect`), replace the closure with a class:

```python
class RateLimiter:
    def __init__(self, max_calls: int):
        self.max_calls = max_calls
        self.calls = 0

    def allow_request(self) -> bool:
        if self.calls >= self.max_calls:
            return False
        self.calls += 1
        return True

    def reset(self) -> None:
        self.calls = 0
```

## Gotchas

### `SyntaxError: no binding for nonlocal found`
**Symptom.** Code fails during import with `SyntaxError: no binding for nonlocal 'x' found`.
**Cause.** The variable `x` was defined at module level rather than inside an enclosing `def` function.
**Fix.** Change `nonlocal x` to `global x` if targeting module scope, or nest the function inside an outer function where `x` is defined:

```python
# BROKEN: attempts to use nonlocal on module global
counter = 0
def increment():
    # SyntaxError: no binding for nonlocal 'counter' found
    nonlocal counter
    counter += 1

# FIXED: use global for module scope
counter = 0
def increment():
    global counter
    counter += 1
```

### Unnecessary global declaration for container mutation
**Symptom.** Overuse of `global` declarations in functions that merely call `.append()` or `.update()`.
**Cause.** Misunderstanding Python scoping rules by assuming object mutation requires variable rebinding declarations.
**Fix.** Remove `global` when mutating an existing container in place:

```python
CACHE = {}

# UNNECESSARY: global CACHE is not needed here
def set_cache(key: str, val: str):
    global CACHE
    CACHE[key] = val

# IDIOMATIC: reading CACHE and mutating it via __setitem__
def set_cache(key: str, val: str):
    CACHE[key] = val
```

### Race conditions in nonlocal closures under concurrency
**Symptom.** In multi-threaded programs or async worker loops, a `nonlocal` counter produces incorrect totals.
**Cause.** In Python bytecode, `count += 1` executes as multiple instructions (`LOAD_DEREF`, `BINARY_OP`, `STORE_DEREF`). A thread switch between load and store causes lost updates.
**Fix.** Protect concurrent mutations with `threading.Lock`:

```python
import threading

def make_thread_safe_counter():
    count = 0
    lock = threading.Lock()

    def increment() -> int:
        nonlocal count
        with lock:
            count += 1
            return count

    return increment
```

## Interview questions

**★ Q: What is the semantic difference between `global` and `nonlocal` in Python?**
`global x` tells the compiler that assignments to `x` bind to the module-level namespace (`globals()`). `nonlocal x` tells the compiler that assignments to `x` bind to the nearest enclosing function scope (excluding module globals). Furthermore, `nonlocal` requires that `x` already exists in an enclosing scope at compile time, whereas `global` can create new module-level bindings dynamically.

**★ Q: Can you mutate a global list (e.g. `items.append(1)`) inside a function without declaring `global items`?**
Yes. `items.append(1)` does not rebind the variable `items`; it looks up `items` in the global namespace via LEGB resolution and calls its `.append()` method in place. A `global` declaration is only required when using assignment operators (`items = [...]` or `items += [...]`) to bind the name to a new object.

**★ Q: What error occurs if you declare `nonlocal x` in a function where `x` is only defined at module level?**
CPython raises a compile-time `SyntaxError: no binding for nonlocal 'x' found`. `nonlocal` explicitly refuses to bind to module-level global variables.

**Q: Why is global mutable state strongly discouraged in concurrent web applications?**
Module-level globals are shared across all threads and requests within the process. Concurrent mutations without explicit synchronization create data races, unhandled exceptions, and inconsistent state. Globals also prevent isolated unit testing because test cases contaminate shared process state.

**Q: When should a stateful closure with `nonlocal` be refactored into a class?**
A closure with `nonlocal` is appropriate when encapsulating a single callable with minimal state (such as a memoized wrapper or decorator). When the state requires multiple inspection methods, reset capabilities, serialization, or complex lifecycle management, a class with explicit attributes and methods provides clearer architecture and easier testing.

---

← [LEGB and UnboundLocalError](01-legb-and-unboundlocalerror.md) · [Topic index](README.md) · Next → [Closures and late-binding](03-closures-and-the-late-binding-trap.md)
