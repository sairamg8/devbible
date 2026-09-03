---
title: "The def statement is executable code, and functions are ordinary objects"
sidebar_label: "01 · The def statement"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§8.6 Function definitions, §3.2 Internal types).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**In Python, `def` is not a compile-time declaration; it is an executable statement that creates a function object at runtime and binds it to a name in the current local namespace. Because functions are ordinary first-class objects, they can be assigned to variables, passed as arguments to higher-order functions like `sorted(key=...)`, stored in data structures to build dispatch tables, and inspected via built-in attributes like `__name__` and `__code__`. Understanding that `def` executes when interpreter control reaches it explains why functions can be defined conditionally, why passing `func()` instead of `func` breaks event handlers, and why function objects can carry metadata.**

## The def statement executes at runtime

In languages such as C++ or Java, method declarations are resolved during compilation. In Python, the language reference states:

> *"A function definition is an executable statement. Its execution binds the function name in the current local namespace to a function object (a wrapper around the executable code for the function)."*

The body of the function is compiled into bytecode when the module is compiled, but the function object itself does not exist until the `def` statement executes. This means function definitions can be conditional:

```python
import os
import sys

if sys.platform == "win32":
    def get_terminal_encoding() -> str:
        return "utf-8"
else:
    def get_terminal_encoding() -> str:
        return os.environ.get("LANG", "utf-8").split(".")[-1] or "utf-8"
```

Only one function object is created and bound to `get_terminal_encoding` based on the platform check evaluated at module load time.

## Functions as first-class objects

Because functions are first-class citizens, a function name is merely a variable that references an instance of `types.FunctionType`:

```python
def normalize_email(email: str) -> str:
    return email.strip().lower()

# Assign to an alias
cleaner = normalize_email

# Pass to higher-order functions
raw_emails = [" Alice@Example.COM ", "bob@work.org  "]
cleaned = list(map(normalize_email, raw_emails))

# Use as key functions in sorting
users = [{"name": "Carol", "score": 92}, {"name": "Dave", "score": 85}]
users_by_score = sorted(users, key=lambda u: u["score"], reverse=True)
```

### Eliminating branching with dispatch tables

Instead of long `if/elif/else` chains that inspect action strings, functions can be mapped directly in a dictionary:

```python
from typing import Callable

def handle_create(payload: dict) -> dict:
    return {"status": "created", "id": payload["id"]}

def handle_update(payload: dict) -> dict:
    return {"status": "updated", "id": payload["id"]}

def handle_delete(payload: dict) -> dict:
    return {"status": "deleted", "id": payload["id"]}

DISPATCH_TABLE: dict[str, Callable[[dict], dict]] = {
    "CREATE": handle_create,
    "UPDATE": handle_update,
    "DELETE": handle_delete,
}

def process_command(action: str, payload: dict) -> dict:
    handler = DISPATCH_TABLE.get(action)
    if handler is None:
        raise ValueError(f"Unknown action: {action}")
    return handler(payload)
```

The dispatch table is resolved in O(1) time and allows registering new handlers without modifying the core routing logic.

## Function attributes and introspection

Function objects expose internal attributes that describe their provenance and configuration:

```python
def calculate_tax(amount: float, rate: float = 0.05) -> float:
    """Calculate the tax owed on a given amount."""
    return amount * rate

# Standard introspection attributes
print(calculate_tax.__name__)         # "calculate_tax"
print(calculate_tax.__qualname__)     # "calculate_tax" (includes class path if nested)
print(calculate_tax.__doc__)          # docstring content
print(calculate_tax.__module__)       # module where defined
print(calculate_tax.__defaults__)     # (0.05,)

# User-defined attributes stored in calculate_tax.__dict__
calculate_tax.version = "1.2.0"
calculate_tax.audit_required = True
```

User-defined attributes provide lightweight metadata attachment (commonly used by testing frameworks, route registries, and permissions decorators).

## Gotchas

### Passing `f()` instead of `f`
**Symptom.** A callback or event handler runs immediately when the application starts or configures, and subsequent events fail with `TypeError: 'NoneType' object is not callable` or execute with stale data.
**Cause.** Appending parentheses `()` calls the function immediately and passes its *return value* to the receiver rather than passing the callable reference.
**Fix.** Pass the function name without parentheses:

```python
# BROKEN: calls on_click immediately during setup, passing None
# button.register_click_listener(handle_click())

# FIXED: passes the callable object itself
button.register_click_listener(handle_click)
```

### Shadowing built-in function names
**Symptom.** Later calls to standard library utilities like `sum()`, `max()`, `list()`, or `filter()` fail with `TypeError: 'list' object is not callable` or `TypeError: 'int' object is not callable`.
**Cause.** A local variable or a function definition used the same name as a built-in symbol, shadowing the built-in in the enclosing scope.
**Fix.** Avoid naming variables or functions after built-in identifiers. Use descriptive domain names:

```python
# BROKEN: shadows built-in sum
sum = 0
for val in [1, 2, 3]:
    sum += val
total = sum([4, 5, 6])  # TypeError: 'int' object is not callable

# FIXED: use domain-specific names
running_total = 0
for val in [1, 2, 3]:
    running_total += val
batch_total = sum([4, 5, 6])
```

### Storing mutable state on function attributes
**Symptom.** Data leaks across concurrent requests or across unit tests when using function attribute caching (`func.cache = {}` or `func.call_count += 1`).
**Cause.** A function object is a singleton within the process for a given module import. Attributes in `func.__dict__` are global to all callers of that function.
**Fix.** Use `functools.lru_cache` or pass explicit context/state objects rather than mutating function attributes for runtime state:

```python
# BROKEN: shared mutable state across threads and callers
def fetch_profile(user_id: int) -> dict:
    if user_id not in fetch_profile.cache:
        fetch_profile.cache[user_id] = {"id": user_id}
    return fetch_profile.cache[user_id]

fetch_profile.cache = {}

# FIXED: use standard library caching mechanisms
from functools import lru_cache

@lru_cache(maxsize=1024)
def fetch_profile(user_id: int) -> dict:
    return {"id": user_id}
```

### Redefining functions inside loops
**Symptom.** Defining helper functions inside a loop creates fresh function objects on every iteration, introducing unnecessary allocation overhead without creating new closure bindings.
**Cause.** Because `def` is an executable statement, executing it inside a loop body creates and binds a new `types.FunctionType` instance on every iteration.
**Fix.** Define the helper function outside the loop if it does not depend on per-iteration closure bindings:

```python
# INACCURATE: creates 10,000 function objects
items = range(10000)
results = []
for item in items:
    def format_item(val: int) -> str:
        return f"ID-{val:05d}"
    results.append(format_item(item))

# FIXED: define once outside the loop
def format_item(val: int) -> str:
    return f"ID-{val:05d}"

results = [format_item(item) for item in items]
```

## Interview questions

**★ Q: Is `def` in Python a compile-time declaration or a runtime statement?**
It is an executable runtime statement. The bytecode for the function body is generated during compilation, but the function object itself is constructed and bound to its name in the local namespace only when the `def` statement executes. This enables conditional definitions, nesting, and dynamic decorator application.

**★ Q: What is the practical difference between `func` and `func()`?**
`func` is a reference to the function object itself (an instance of `types.FunctionType`). `func()` is the call operator applied to that object, which executes the code block and evaluates to its return value. Passing `func()` where a callable is expected evaluates the function prematurely and passes the result (often `None`).

**★ Q: How do dispatch tables replace `if/elif/else` chains in Python?**
Functions are first-class values and can be stored as dictionary values indexed by action strings or command codes. Instead of an O(N) chain of conditional equality checks, the application performs an O(1) dictionary lookup `handler = DISPATCH_TABLE[action]` and invokes `handler(*args)`. This decouples routing from execution and makes the system extensible without modifying central control logic.

**Q: What is the difference between `__name__` and `__qualname__` on a function?**
`__name__` is the simple name given to the function in its `def` statement. `__qualname__` (introduced in PEP 3155) is the "qualified name", which includes the path of enclosing classes and functions from the module top level (e.g. `OrderService.validate.<locals>.check_limit`). It disambiguates nested functions and methods during logging, debugging, and serialization.

**Q: Can you attach arbitrary attributes to a Python function, and where are they stored?**
Yes. User-defined functions have a writable `__dict__` attribute. Assigning `func.verified = True` writes the key-value pair into `func.__dict__`. This is widely used by decorators and routing frameworks (e.g. attaching permissions or route paths to view functions), but should not be used for mutable runtime request state due to concurrency hazards.

---

← [Topic index](README.md) · Next → [Return values and None](02-return-values-and-the-none-contract.md)
