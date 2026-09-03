---
title: "Metadata preservation with functools.wraps: attributes, introspection, and unwrapping"
sidebar_label: "02 · functools.wraps and __wrapped__"
sidebar_position: 51
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against Python 3.14 Library Reference (functools module, inspect module),
> PEP 612 (ParamSpec).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**When a decorator replaces an original function with an inner wrapper, Python's reflection system binds the wrapper's metadata instead of the original function's. Consequently, `__name__`, `__doc__`, `__module__`, `__qualname__`, and `__annotations__` are erased, degrading tracebacks, breaking documentation generators, and resetting framework registries. Decorating the inner wrapper with `@functools.wraps(func)` copies these canonical attributes, merges custom attributes via `__dict__`, and assigns the `__wrapped__` attribute pointing to the underlying target. The `__wrapped__` attribute enables `inspect.unwrap()` for unit testing and empowers static type checkers to maintain parameter signatures via PEP 612 `ParamSpec`.**

## The metadata erasure catastrophe

Without metadata preservation, a decorator corrupts the identity of every callable it touches:

```python
import inspect

def naive_timer(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@naive_timer
def calculate_vat(subtotal: float, rate: float = 0.2) -> float:
    """Compute the total value-added tax for a sale."""
    return subtotal * rate

# INSPECTION REVEALS EXTENSIVE METADATA CORRUPTION:
print(calculate_vat.__name__)       # 'wrapper' (not 'calculate_vat'!)
print(calculate_vat.__doc__)        # None (documentation erased!)
print(calculate_vat.__annotations__)# {} (type hints lost!)
print(inspect.signature(calculate_vat)) # (*args, **kwargs) (signature erased!)
```

### Consequences in production systems

1. **API routing failures:** Web frameworks like Flask and FastAPI route requests based on function names or reflection. Multiple endpoints decorated with naive decorators will all be named `"wrapper"`, causing routing name collisions (`AssertionError: View function mapping is overwriting an existing endpoint function: wrapper`).
2. **Documentation generators fail:** Sphinx, MkDocs, and OpenAPI doc generators read `__doc__`. Naive decorators wipe out all docstrings.
3. **Broken tracebacks and testing:** Test runners like `pytest` report test failures under the name `test_wrapper` rather than `test_user_registration`.

## What `@functools.wraps` does under the hood

Decorating `wrapper` with `@functools.wraps(func)` delegates to `functools.update_wrapper()`:

```python
import functools

def robust_timer(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@robust_timer
def calculate_vat(subtotal: float, rate: float = 0.2) -> float:
    """Compute the total value-added tax for a sale."""
    return subtotal * rate

print(calculate_vat.__name__)       # 'calculate_vat'
print(calculate_vat.__doc__)        # 'Compute the total value-added tax for a sale.'
print(calculate_vat.__annotations__)# {'subtotal': <class 'float'>, 'rate': <class 'float'>, 'return': <class 'float'>}
```

The standard library specifies two tuples controlling attribute copying:
- `WRAPPER_ASSIGNMENTS`: `('__module__', '__name__', '__qualname__', '__doc__', '__annotations__')` — copied directly from `func` to `wrapper`.
- `WRAPPER_UPDATES`: `('__dict__',)` — merges the original function's attribute dictionary into the wrapper's dictionary.

## The `__wrapped__` attribute and `inspect.unwrap`

In addition to copying metadata, `functools.wraps` assigns:

```python
wrapper.__wrapped__ = func
```

This reference creates a linked list of wrapped functions when multiple decorators are stacked.

### Bypassing decorators in unit tests with `inspect.unwrap`

You can bypass caching, authentication, or rate-limiting decorators in unit tests to test business logic directly:

```python
import inspect

def test_raw_vat_calculation():
    # Retrieve the original un-decorated function
    raw_calc = inspect.unwrap(calculate_vat)
    assert raw_calc(100.0, 0.2) == 20.0
```

`inspect.unwrap(func)` traverses the `__wrapped__` chain until it reaches the root callable. If a decorator along the chain was not decorated with `functools.wraps`, unwrapping stops at that layer.

## Typesafe decorators with PEP 612 `ParamSpec`

Even with `@functools.wraps`, static type checkers historically saw generic wrappers as `Callable[..., Any]`, breaking IDE auto-completion. PEP 612 solved this with `ParamSpec`:

```python
from typing import Callable, TypeVar, ParamSpec
import functools

P = ParamSpec("P")
R = TypeVar("R")

def logged(func: Callable[P, R]) -> Callable[P, R]:
    @functools.wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        print(f"Calling {func.__name__}")
        return func(*args, **kwargs)
    return wrapper

@logged
def multiply(a: int, b: int) -> int:
    return a * b

# Static checkers (mypy/pyright) verify multiply expects (a: int, b: int) -> int!
# multiply("wrong", 2) -> Type check error: Argument 1 has incompatible type "str"
```

## Gotchas

### Forgetting `@functools.wraps` on stacked decorators
**Symptom.** An outer decorator sees generic `wrapper` metadata instead of the inner target function's metadata.
**Cause.** The innermost decorator applied `@functools.wraps`, but an intermediate decorator forgot to apply it, severing the metadata chain.
**Fix.** Every layer of wrapping must apply `@functools.wraps(func)` to its inner wrapper.

### Accessing `__wrapped__` manually instead of using `inspect.unwrap`
**Symptom.** In nested decorators, `func.__wrapped__` only peels back one layer, still leaving outer wrapper behaviors active.
**Cause.** `func.__wrapped__` points only to the immediate next callable in the chain.
**Fix.** Use `inspect.unwrap(func)` to traverse all layers to the true underlying function.

```python
# BROKEN: only unwraps a single level
# raw = f.__wrapped__

# FIXED: unwraps all chained decorators
raw = inspect.unwrap(f)
```

## Interview questions

**★ Q: What specific function metadata is lost if you omit `@functools.wraps` in a decorator?**
The inner wrapper replaces the target function in the namespace, obliterating `__name__` (becomes `"wrapper"`), `__doc__` (becomes `None`), `__qualname__`, `__module__`, and `__annotations__`. Furthermore, `inspect.signature()` reports `(*args, **kwargs)`, breaking introspection, routing registries, documentation tools, and type checkers.

**★ Q: What is the `__wrapped__` attribute and how is it used in testing and introspection?**
`__wrapped__` is an attribute attached to the wrapper function by `functools.update_wrapper()` that holds a direct reference to the original wrapped callable. In testing, `inspect.unwrap(func)` follows this attribute across stacked decorators to retrieve the raw function, enabling developers to test core business logic without triggering rate limiters, caches, or auth decorators.

**★ Q: How does PEP 612 `ParamSpec` improve decorator typing in modern Python?**
Before `ParamSpec`, typing a decorator required `Callable[..., R]`, which destroyed parameter type hints and argument checking for callers. `ParamSpec` captures the exact parameter specification (all positional, keyword, and keyword-only parameter types and defaults) of the wrapped function and forwards it via `Callable[P, R] -> Callable[P, R]`, enabling static type checkers and IDEs to maintain complete signature validation.

**Q: What is the difference between `functools.wraps` and `functools.update_wrapper`?**
`functools.update_wrapper(wrapper, wrapped)` is the core function that directly copies attributes from `wrapped` to `wrapper` and sets `__wrapped__`. `functools.wraps(wrapped)` is a convenience decorator factory that calls `partial(update_wrapper, wrapped=wrapped)` so it can be applied cleanly via `@functools.wraps(func)` above the inner wrapper.

**Q: How does `inspect.signature()` handle functions decorated with `@functools.wraps`?**
`inspect.signature()` checks if the callable has a `__wrapped__` attribute (with `follow_wrapped=True` by default). If present, it automatically unwraps the function chain and inspects the underlying function, returning the real parameter names, types, and defaults rather than the wrapper's generic `(*args, **kwargs)`.

---

← [Decorator protocol from scratch](01-the-decorator-protocol-from-scratch.md) · [Topic index](README.md) · Next → [Decorators taking arguments](03-decorators-taking-arguments-and-factories.md)
