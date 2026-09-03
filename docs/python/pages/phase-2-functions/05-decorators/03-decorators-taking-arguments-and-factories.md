---
title: "Decorators taking arguments: three-tier closures, factories, and the dual-mode pattern"
sidebar_label: "03 · Decorators taking arguments"
sidebar_position: 52
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§8.6 Function definitions).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**When a decorator accepts configuration arguments (such as `@retry(retries=3, backoff=2.0)`), the decorator expression is evaluated first, producing the actual decorator that wraps the function. This mechanics necessitates a three-tier nested closure: Tier 1 is a decorator factory capturing configuration values; Tier 2 is the actual decorator receiving the target function; and Tier 3 is the runtime wrapper executing upon each call. To build elegant APIs that support both `@logged` and `@logged(level="DEBUG")` without forcing empty parentheses, developers implement the dual-mode decorator pattern.**

## Desugaring decorators with arguments

Consider a parameterized decorator:

```python
@retry(retries=3, delay=1.0)
def fetch_data():
    ...
```

Python desugars this syntax into two consecutive function calls:

```python
# 1. Evaluate the decorator expression (calls the factory)
actual_decorator = retry(retries=3, delay=1.0)

# 2. Apply the returned decorator to the target function
fetch_data = actual_decorator(fetch_data)
```

Because `retry(...)` is invoked before decorating, it is not the decorator itself—it is a **decorator factory** that constructs and returns a decorator.

## The three-tier closure architecture

Building a parameterized decorator requires three distinct nested functional scopes:

```python
import functools
import time
from typing import Callable, Any

# TIER 1: The Decorator Factory (Accepts configuration parameters)
def retry(max_attempts: int = 3, delay: float = 1.0) -> Callable:
    # Validation occurs immediately at definition time
    if max_attempts < 1:
        raise ValueError("max_attempts must be at least 1")

    # TIER 2: The Actual Decorator (Accepts the target function)
    def decorator(func: Callable) -> Callable:

        # TIER 3: The Runtime Wrapper (Executes at call time)
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            attempts = 0
            while attempts < max_attempts:
                try:
                    return func(*args, **kwargs)
                except Exception as exc:
                    attempts += 1
                    if attempts >= max_attempts:
                        raise
                    time.sleep(delay)

        return wrapper

    return decorator
```

### Breakdown of responsibilities

| Tier | Function | Executed | Purpose |
|---|---|---|---|
| **1. Factory** | `retry(max_attempts, delay)` | When decorator expression is evaluated | Validates and closes over configuration parameters |
| **2. Decorator** | `decorator(func)` | When `def` executes | Receives the target function, applies `@functools.wraps`, returns wrapper |
| **3. Wrapper** | `wrapper(*args, **kwargs)` | Every time target function is called | Executes pre/post logic, retries, and calls `func` |

## The dual-mode decorator pattern

A common usability flaw in custom decorators is requiring callers to write empty parentheses when using default settings (`@cache()` instead of `@cache`). The dual-mode pattern allows both syntaxes:

```python
import functools
from typing import Callable, Any, Optional

def logged(
    func: Optional[Callable] = None,
    *,
    level: str = "INFO",
) -> Callable:
    """Decorator supporting both @logged and @logged(level='DEBUG')."""

    def decorator(target: Callable) -> Callable:
        @functools.wraps(target)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            print(f"[{level}] Invoking {target.__name__}")
            return target(*args, **kwargs)
        return wrapper

    if func is not None:
        # Invoked as bare decorator: @logged
        # 'func' contains the decorated function
        return decorator(func)

    # Invoked with parentheses: @logged(level='DEBUG')
    # 'func' is None; return the decorator awaiting the function
    return decorator
```

### How dual-mode works

- When used as `@logged`, Python passes the function as the first positional argument `func`. The condition `if func is not None:` triggers, returning the wrapped function immediately.
- When used as `@logged(level="DEBUG")`, `func` is `None` because `level` is keyword-only. The function returns `decorator`, which Python then invokes with the target function.

## Definition-time validation in factories

A key advantage of the decorator factory is failing fast at startup:

```python
def validate_schema(schema_cls: type):
    # Eager validation during import/definition
    if not hasattr(schema_cls, "validate"):
        raise TypeError(f"Invalid schema: {schema_cls.__name__} must implement .validate()")

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(data: dict, *args, **kwargs):
            schema_cls.validate(data)
            return func(data, *args, **kwargs)
        return wrapper
    return decorator
```

If a developer passes an invalid schema class, Python raises `TypeError` immediately when the module is imported, rather than waiting for a user request to hit the endpoint in production.

## Gotchas

### Forgetting parentheses on a non-dual-mode decorator
**Symptom.** `TypeError: decorator() takes 0 positional arguments but 1 was given` or function is bound to a configuration parameter.
**Cause.** Writing `@retry` instead of `@retry()` on a decorator expecting factory arguments.
**Fix.** Always write `@retry()` or convert the decorator to the dual-mode pattern:

```python
# BROKEN: passes function to max_attempts parameter!
# @retry
# def compute(): pass

# FIXED
@retry()
def compute():
    pass
```

### Accidental state sharing across wrapped functions
**Symptom.** Two functions decorated with the same factory instance unexpectedly share mutable state.
**Cause.** Allocating mutable containers in the Tier 1 factory rather than inside Tier 2 or Tier 3.
**Fix.** Keep factory parameters immutable or allocate distinct containers per decorated function in Tier 2:

```python
# BROKEN: shared_history is shared across ALL decorated functions!
def audit_factory(shared_history=[]):
    def decorator(func): ...

# FIXED: allocate per-function state inside the decorator tier
def audit_factory():
    def decorator(func):
        func_history = []  # Private to this decorated function
        ...
```

## Interview questions

**★ Q: What are the three nested layers of a decorator that takes arguments, and what is the responsibility of each layer?**
1. **Factory (outer layer):** Receives and validates the configuration arguments (e.g. `retries`, `timeout`) and returns the decorator.
2. **Decorator (middle layer):** Receives the target function to be decorated, applies `@functools.wraps`, and returns the wrapper.
3. **Wrapper (inner layer):** Receives the runtime call arguments (`*args, **kwargs`), performs the wrapping logic, and executes the target function.

**★ Q: How does Python evaluate `@retry(retries=3)` syntactically under the hood?**
First, Python evaluates the expression `retry(retries=3)`. This call returns the middle-tier decorator function. Next, Python passes the decorated function into this returned decorator: `f = (retry(retries=3))(f)`.

**★ Q: How do you implement a decorator that can be used both with and without arguments (`@cache` vs `@cache(maxsize=100)`)?**
Make the target callable the first positional parameter with a default of `None` (`func=None`), and make all configuration parameters keyword-only (`*, maxsize=128`). If `func is not None`, the decorator was used without arguments (`@cache`), so apply the decorator to `func` and return the wrapper immediately. If `func is None`, the decorator was called with arguments (`@cache(maxsize=100)`), so return the decorator waiting to receive the function.

**Q: Where should argument validation occur in a decorator factory, and why?**
In Tier 1 (the outer factory). Because Tier 1 executes when the decorator is evaluated at definition/import time, validating arguments there catches configuration errors immediately upon server startup rather than deferring failures to runtime requests.

**Q: What happens if a developer writes `@retry` instead of `@retry()` on a factory that does not support dual-mode?**
Python passes the target function as the first positional argument to `retry`. If `retry` expected an integer (e.g. `def retry(attempts: int)`), `attempts` is bound to the function object. Later, the code crashes either with a `TypeError` during comparison (`attempts < 1`) or when attempting to call the resulting object.

---

← [functools.wraps and __wrapped__](02-metadata-preservation-with-functools-wraps.md) · [Topic index](README.md) · Next → [Stacking and class decorators](04-stacking-decorators-and-class-decorators.md)
