---
title: "Designing signatures that survive library growth, and introspecting parameters with inspect"
sidebar_label: "04 · Signature design and evolution"
sidebar_position: 23
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against Python 3.14 Library Reference (inspect module),
> PEP 612 (Parameter Specification Variables), PEP 570, PEP 3102.
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**A public function signature is an enduring backward-compatibility contract. In library design, evolving a signature without breaking existing consumers requires strict rules: any new parameter added to a mature function must be keyword-only and provide a non-breaking default value. At runtime, Python's `inspect` module provides the standard reflection interface—exposing `Signature`, `Parameter`, and the `Parameter.kind` enum to bind arguments programmatically, enabling modern frameworks like FastAPI and pytest to perform dependency injection. For decorators, PEP 612's `ParamSpec` preserves parameter types across wrappers without erasing signatures.**

## The backward-compatibility rules of signature evolution

When maintaining shared libraries or internal enterprise platforms, modifying a signature can silently break downstream callers. Follow these three rules:

### 1. Never add required positional parameters
Adding a required parameter (`def query(sql)` → `def query(sql, database)`) immediately breaks every existing call site with `TypeError: query() missing 1 required positional argument`.

### 2. Positional additions risk index shift
Adding an optional positional parameter to the end of a positional list (`def query(sql, database="default")`) appears safe, but breaks callers who used `*args` unpacking or who assumed the order of subsequent keyword arguments.

### 3. The golden rule: add new parameters as keyword-only with defaults
The only universally safe evolutionary step for an existing public function is adding new parameters as **keyword-only with a default value**:

```python
# INITIAL VERSION
def fetch_users(department: str) -> list[dict]:
    ...

# EVOLVED VERSION: completely backwards-compatible
def fetch_users(
    department: str,
    *,
    include_contractors: bool = False,
    page_size: int = 100,
) -> list[dict]:
    """Newly added parameters are keyword-only, preventing positional breakage."""
    ...
```

Old callers writing `fetch_users("Engineering")` continue working untouched. Callers wanting the new capability must pass it explicitly by name (`fetch_users("Engineering", include_contractors=True)`).

## Runtime signature reflection with `inspect`

Python's `inspect` module provides complete introspection into call signatures:

```python
import inspect

def process_order(
    item_id: int,
    /,
    quantity: int = 1,
    *,
    express: bool = False,
) -> None:
    ...

sig = inspect.signature(process_order)
for name, param in sig.parameters.items():
    print(f"{name}: kind={param.kind.name}, default={param.default}")
```

### The five parameter kinds (`Parameter.kind`)

The standard library categorizes all Python parameters into five distinct enum members:

| Kind Enum | Description | Example |
|---|---|---|
| `POSITIONAL_ONLY` | Precedes `/`; must be passed positionally | `item_id` in `(item_id, /)` |
| `POSITIONAL_OR_KEYWORD` | Standard parameter; passed either way | `quantity` in `(quantity=1)` |
| `VAR_POSITIONAL` | Preceded by `*`; gathers extra positional args | `*args` |
| `KEYWORD_ONLY` | Follows `*` or `*args`; must be passed by name | `express` in `(*, express)` |
| `VAR_KEYWORD` | Preceded by `**`; gathers extra keywords | `**kwargs` |

### Programmatic argument binding (`sig.bind`)

Frameworks like FastAPI, Click, and pytest use `Signature.bind()` to validate and map incoming HTTP parameters or CLI options to function parameters before invoking them:

```python
def handler(user_id: int, role: str = "guest") -> None:
    pass

sig = inspect.signature(handler)

# Validate incoming args without calling the function
bound = sig.bind(42, role="admin")
print(bound.arguments)  # {'user_id': 42, 'role': 'admin'}

# Apply defaults for omitted parameters
bound_partial = sig.bind(42)
bound_partial.apply_defaults()
print(bound_partial.arguments)  # {'user_id': 42, 'role': 'guest'}
```

If the provided arguments violate the signature (e.g. missing required parameter or passing invalid keyword), `sig.bind()` raises a descriptive `TypeError`.

## Preserving signatures in the type system with `ParamSpec`

Historically, writing a decorator that accepts `Callable[..., Any]` erased all parameter types from IDEs and static checkers. PEP 612 introduced `ParamSpec` to forward exact parameter signatures:

```python
from typing import Callable, TypeVar, ParamSpec
import functools

P = ParamSpec("P")
R = TypeVar("R")

def audit(func: Callable[P, R]) -> Callable[P, R]:
    @functools.wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        print(f"Auditing call to {func.__name__}")
        return func(*args, **kwargs)
    return wrapper

@audit
def create_customer(name: str, email: str, *, vip: bool = False) -> int:
    return 1001

# Type checkers and IDEs know create_customer requires (name: str, email: str, *, vip: bool = False)!
```

## Gotchas

### Inspecting wrapped functions without `functools.wraps`
**Symptom.** `inspect.signature(my_func)` reports `(*args, **kwargs)` instead of the underlying function's true parameters.
**Cause.** A decorator failed to apply `@functools.wraps(func)`, leaving the wrapper's generic signature exposed on `__wrapped__`.
**Fix.** Always decorate inner wrappers with `@functools.wraps(func)`. The `inspect` module automatically follows the `__wrapped__` chain when unwrapping.

```python
# BROKEN: signature is erased
def bad_decorator(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

# FIXED: wraps preserves signature and annotations
def good_decorator(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper
```

### Signature inspection overhead in hot loops
**Symptom.** Significant latency or CPU spikes in request routing or validation pipelines.
**Cause.** Calling `inspect.signature()` repeatedly inside hot execution loops. Building `Signature` and `Parameter` objects has measurable CPU overhead.
**Fix.** Cache the `Signature` object at initialization or startup time:

```python
from functools import lru_cache
import inspect

# Cache the parsed signature so reflection is done once per callable
@lru_cache(maxsize=1024)
def get_cached_signature(func):
    return inspect.signature(func)
```

### Forgetting `apply_defaults()` when mapping arguments
**Symptom.** Argument extraction logic fails to populate default values for omitted optional parameters when using `sig.bind()`.
**Cause.** `sig.bind()` only binds arguments explicitly passed by the caller. It does not automatically populate defaults unless `bound.apply_defaults()` is invoked.
**Fix.** Call `bound.apply_defaults()` whenever you need the complete argument dictionary:

```python
bound = sig.bind(*args, **kwargs)
bound.apply_defaults()  # populates missing optional parameters with defaults
final_args = bound.arguments
```

## Interview questions

**★ Q: What is the safest way to add a new parameter to a public library function without breaking callers?**
Add the parameter as a **keyword-only** parameter with a non-breaking default value: `def func(existing_arg, *, new_arg=default):`. Making it keyword-only ensures that existing callers passing arguments positionally are unaffected, while the default value ensures that callers who omit the argument continue to experience the exact same behavior as before.

**★ Q: How do frameworks like FastAPI or pytest automatically bind request data or fixtures to function arguments?**
They use `inspect.signature(func)` to introspect the function's parameter names, type annotations, defaults, and parameter kinds at registration time. When a request or test executes, the framework retrieves the corresponding data (from request bodies, query params, or fixture registries) keyed by parameter name and invokes `sig.bind(**extracted_data)` before calling the handler.

**★ Q: What are the five parameter kinds defined in Python's `inspect.Parameter.kind` enum?**
1. `POSITIONAL_ONLY`: Parameters preceding `/` that must be provided by position.
2. `POSITIONAL_OR_KEYWORD`: Standard parameters that can be supplied by position or by keyword.
3. `VAR_POSITIONAL`: The `*args` tuple collector.
4. `KEYWORD_ONLY`: Parameters following `*` or `*args` that must be provided by name.
5. `VAR_KEYWORD`: The `**kwargs` dictionary collector.

**Q: What is the purpose of `ParamSpec` in Python typing?**
`ParamSpec` (PEP 612) is a typing variable that captures the exact parameter specification (all positional, keyword, and keyword-only parameters and their types) of a callable. It allows decorators to be typed as `Callable[P, R] -> Callable[P, R]`, ensuring that static type checkers and IDEs maintain full signature visibility and argument validation across decorated functions.

**Q: What is the difference between `Signature.bind()` and `Signature.bind_partial()`?**
`Signature.bind(*args, **kwargs)` enforces that all required parameters are provided, raising `TypeError` if any mandatory argument is missing. `Signature.bind_partial(*args, **kwargs)` permits missing mandatory parameters, binding only the arguments supplied; it is used when partially applying arguments or validating subsets of parameters incrementally.

---

← [Positional-only and keyword-only](03-positional-only-and-keyword-only.md) · [Topic index](README.md) · Next → [Scope and closures](../03-scope-and-closures/README.md)
