---
title: "The decorator protocol from scratch: syntactic sugar, definition-time execution, and call interception"
sidebar_label: "01 · Decorator protocol from scratch"
sidebar_position: 50
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§8.6 Function definitions, §8.7 Class definitions).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**In Python, the `@decorator` syntax is syntactic sugar for reassigning a function name to the return value of an enclosing callable: `@dec def f(): pass` desugars exactly to `def f(): pass; f = dec(f)`. Crucially, decorators operate in two distinct execution phases: the decorator function executes at definition time (when the module is imported or the `def` statement runs), whereas the returned wrapper function executes at call time (each time the function is invoked). Writing reliable decorators from scratch requires mastering this lifecycle, capturing and forwarding arguments with `*args, **kwargs`, and returning call results without accidental omission.**

## The `@` syntax desugared

The `@` decorator syntax was introduced in PEP 318 to eliminate the readability problem of functions being declared on one line and wrapped dozens of lines later.

Under the hood, Python executes the `def` statement normally, creates the function object, and immediately passes it to the decorator:

```python
def my_decorator(func):
    return func

@my_decorator
def greet(name: str) -> str:
    return f"Hello, {name}"

# The exact syntactic equivalence:
def greet(name: str) -> str:
    return f"Hello, {name}"
greet = my_decorator(greet)
```

Because `@` is pure syntax sugar for function reassignment, any callable object (a function, a class with `__call__`, or an instance method) can serve as a decorator.

## Definition time versus call time

A common architectural error is confusing the code that runs when a function is *defined* with the code that runs when the function is *called*:

```python
def logging_decorator(func):
    # DEFINITION TIME: Runs once when Python executes the 'def' statement / imports the module
    print(f"[DEFINITION TIME] Registering decorator for {func.__name__}")

    def wrapper(*args, **kwargs):
        # CALL TIME: Runs every time the decorated function is invoked
        print(f"[CALL TIME] Executing {func.__name__}")
        return func(*args, **kwargs)

    return wrapper

@logging_decorator
def calculate_tax(amount: float) -> float:
    return amount * 0.15

# Output at import time:
# [DEFINITION TIME] Registering decorator for calculate_tax

print("--- Module import complete ---")

calculate_tax(100.0)
calculate_tax(200.0)
# Output at call time:
# [CALL TIME] Executing calculate_tax
# [CALL TIME] Executing calculate_tax
```

Any code placed in the outer decorator body (outside `wrapper`) executes immediately at module load time. Expensive operations—such as connecting to a database, reading configuration files, or opening network sockets—must never be placed in the outer body; they must be deferred inside `wrapper`.

## Building a production decorator from scratch

A production-grade decorator follows a rigorous seven-step template:

```python
import time
from typing import Callable, Any

def audit_log(func: Callable) -> Callable:
    # 1. Accept the wrapped function
    # 2. Define the inner wrapper taking generic variadics
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        # 3. Pre-invocation logic (e.g. logging, validation, timer start)
        start_ns = time.perf_counter_ns()
        print(f"AUDIT: Invoking {func.__name__} with args={args}, kwargs={kwargs}")

        try:
            # 4. Invoke wrapped function and capture result
            result = func(*args, **kwargs)
        except Exception as exc:
            # 5. Handle, log, or re-raise exceptions
            print(f"AUDIT: {func.__name__} raised {type(exc).__name__}: {exc}")
            raise

        # 6. Post-invocation logic (e.g. metrics, sanitization)
        duration_ms = (time.perf_counter_ns() - start_ns) / 1_000_000
        print(f"AUDIT: {func.__name__} completed in {duration_ms:.2f}ms")

        # 7. CRITICAL: Return the underlying function's result
        return result

    # Return the callable wrapper to replace the original function
    return wrapper
```

## Transforming return values and intercepting exceptions

Decorators can sanitize output or handle specific failure domains:

```python
def sanitize_output(func: Callable) -> Callable:
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        result = func(*args, **kwargs)
        if isinstance(result, str):
            # Transform return value
            return result.strip()
        if isinstance(result, dict):
            # Redact sensitive keys
            return {k: ("***" if k.lower() in {"password", "secret", "token"} else v)
                    for k, v in result.items()}
        return result
    return wrapper

@sanitize_output
def get_user_profile() -> dict:
    return {"username": "admin", "token": "jwt-token-value-123"}

# get_user_profile() returns: {'username': 'admin', 'token': '***'}
```

## Gotchas

### Forgetting to return the result in wrapper
**Symptom.** Decorated functions silently return `None` instead of their expected output.
**Cause.** The wrapper called `func(*args, **kwargs)` without returning its value.
**Fix.** Ensure `return func(*args, **kwargs)` or `return result` is explicitly present:

```python
# BROKEN: silently drops return value!
def bad_timer(func):
    def wrapper(*args, **kwargs):
        func(*args, **kwargs)  # Result discarded!
    return wrapper

# FIXED: captures and returns result
def good_timer(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper
```

### Forgetting to return the wrapper from the decorator
**Symptom.** `TypeError: 'NoneType' object is not callable` when calling the decorated function.
**Cause.** The outer decorator defined `def wrapper(...)` but omitted `return wrapper` at the bottom.
**Fix.** Return `wrapper` from the outer decorator function.

```python
# BROKEN: returns None by default
def broken_decorator(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    # Missing 'return wrapper'!

# Calling the decorated function:
# @broken_decorator
# def hello(): pass
# hello() -> TypeError: 'NoneType' object is not callable
```

### Putting expensive initialization at definition time
**Symptom.** Slow test runs, circular import deadlocks, or crashes during CI build phases when importing modules.
**Cause.** Establishing database connections or making external HTTP requests inside the outer decorator function.
**Fix.** Move resource acquisition into the `wrapper` or an explicit application startup lifecycle hook.

## Interview questions

**★ Q: What does the `@decorator` syntax desugar to in Python?**
The expression `@dec def f(): pass` desugars strictly to `def f(): pass; f = dec(f)`. Python creates the function object normally, passes it as the single argument to the callable `dec`, and rebinds the identifier `f` in the current scope to whatever object `dec` returns.

**★ Q: What is the difference between definition-time execution and call-time execution in a decorator?**
The outer decorator function executes at **definition time** (when the module is imported or when the `def` statement executes in the control flow). It runs once to construct and return the wrapper. The inner `wrapper` executes at **call time** (every time the decorated function is subsequently called by application code).

**★ Q: What happens if a decorator wrapper forgets to return the result of the wrapped function?**
The decorated function will silently return `None` on every call, regardless of what the original wrapped function returned. This is one of the most common decorator bugs in production because functions without side-effects appear to succeed without raising exceptions.

**Q: Can a decorator return something other than a function (e.g. a class or custom object)?**
Yes. Syntactically, Python permits the decorator to return any object. However, if the returned object is not callable, subsequent invocations of the function name will raise `TypeError: 'X' object is not callable`. Returning instances of custom classes that implement `__call__` is common for stateful decorators.

**Q: How do you write a decorator that intercepts exceptions without suppressing them?**
Wrap the `func(*args, **kwargs)` call in a `try/except Exception as exc:` block. Inside `except`, perform the necessary logging, error tracking, or metric incrementation, and end the block with a bare `raise` statement to propagate the original exception and its complete traceback to the caller.

---

← [Topic index](README.md) · Next → [functools.wraps and __wrapped__](02-metadata-preservation-with-functools-wraps.md)
