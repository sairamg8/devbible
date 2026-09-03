---
title: "Type-driven dispatch with singledispatch and cumulative folding with reduce"
sidebar_label: "03 · singledispatch and reduce"
sidebar_position: 62
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against Python 3.14 Library Reference (functools module: singledispatch, singledispatchmethod, reduce).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**Because Python is dynamically typed and lacks compile-time function overloading, developers historically relied on sprawling `if isinstance(...)` conditional chains. The `functools.singledispatch` decorator provides an architectural solution: it converts a function into a generic dispatcher that routes calls to specialized implementations based on the runtime type of its first positional argument, allowing new type handlers to be registered modularly across packages. For object-oriented designs, `functools.singledispatchmethod` performs type-driven routing on class methods. Separately, `functools.reduce` folds iterables cumulatively; while powerful for nested dictionary traversal, Python intentionally moved it to `functools` because explicit loops and built-in aggregators provide superior readability.**

## Generic functions with `functools.singledispatch`

`@singledispatch` creates an extensible entry point:

```python
from functools import singledispatch
from datetime import date, datetime

@singledispatch
def serialize(val) -> str:
    """Base implementation: fallback for unregistered types."""
    return str(val)

@serialize.register(int)
def _(val: int) -> str:
    return f"{val:,d}"

@serialize.register(float)
def _(val: float) -> str:
    return f"{val:.2f}"

# Type annotation inference: registers date without explicit class argument
@serialize.register
def _(val: date) -> str:
    return val.isoformat()
```

When invoked, `singledispatch` inspects the type of the first positional argument (`type(val)`) and executes the corresponding registered handler:

```python
print(serialize(1000000))      # '1,000,000'
print(serialize(3.14159))      # '3.14'
print(serialize(date(2026, 9, 3))) # '2026-09-03'
print(serialize("raw text"))   # 'raw text' (hits base fallback)
```

### Inheritance and the Method Resolution Order (MRO)

`singledispatch` respects class inheritance. If a call passes an instance of a subclass that does not have an explicit registration, Python follows the subclass's MRO until it finds the closest registered base class:

```python
class AdminUser: pass
class SuperAdmin(AdminUser): pass

@singledispatch
def get_permissions(user):
    return "guest"

@get_permissions.register(AdminUser)
def _(user):
    return "admin"

# SuperAdmin has no explicit registration, so it dispatches to AdminUser!
print(get_permissions(SuperAdmin()))  # 'admin'
```

## Class methods with `functools.singledispatchmethod`

Using standard `@singledispatch` inside a class body fails because the first positional argument is always `self`. Python dispatches based on the type of `self` rather than the payload.

To dispatch on the method's first true parameter, use `@singledispatchmethod`:

```python
from functools import singledispatchmethod

class DocumentFormatter:
    @singledispatchmethod
    def format(self, payload):
        raise NotImplementedError(f"Unsupported payload type: {type(payload)}")

    @format.register
    def _(self, payload: str):
        return payload.strip()

    @format.register
    def _(self, payload: list):
        return "\n".join(str(x) for x in payload)

formatter = DocumentFormatter()
print(formatter.format("  hello  "))     # 'hello'
print(formatter.format([10, 20, 30]))    # '10\n20\n30'
```

## Cumulative folding with `functools.reduce`

`reduce(function, iterable[, initializer])` applies a two-argument function cumulatively across an iterable from left to right:

```python
from functools import reduce
import operator

# Computing product: ((1 * 2) * 3) * 4 = 24
numbers = [1, 2, 3, 4]
product = reduce(operator.mul, numbers)
```

### Idiomatic use: Deep dictionary traversal

The cleanest production application of `reduce` is walking nested dictionaries safely:

```python
def deep_get(dictionary: dict, keys: list[str], default=None):
    """Traverse a nested dictionary path using reduce."""
    try:
        return reduce(lambda d, key: d[key], keys, dictionary)
    except (KeyError, TypeError):
        return default

config = {
    "database": {
        "connections": {
            "primary": {"port": 5432}
        }
    }
}

port = deep_get(config, ["database", "connections", "primary", "port"])
print(port)  # 5432
```

### The empty sequence trap

Calling `reduce()` on an empty iterable without an initializer raises a fatal `TypeError`:

```python
# CRASHES: TypeError: reduce() of empty iterable with no initial value
# reduce(operator.add, [])

# SAFE: Supplying an initializer provides a safe return value for empty inputs
total = reduce(operator.add, [], 0)
print(total)  # 0
```

Always provide an explicit `initializer` when the input sequence length is dynamic.

## Gotchas

### Registering generic type aliases in singledispatch
**Symptom.** `TypeError: Invalid first argument to `register()`: list[str]. Use either `@register(some_class)` or plain `@register` on an annotated function.`
**Cause.** `singledispatch` dispatches on runtime concrete types via `type()`. Generic type aliases like `list[str]` or `Union[int, str]` are typing constructs, not runtime classes.
**Fix.** Register the concrete container class (`list`) or register multiple types individually:

```python
# BROKEN: subscripted generics cannot be used in register
# @serialize.register(list[str])
# def _(val): ...

# FIXED: register concrete type
@serialize.register(list)
def _(val): ...

# Registering multiple types for the same implementation:
@serialize.register(int)
@serialize.register(float)
def _(val):
    return f"{val:g}"
```

### Keyword arguments bypass singledispatch
**Symptom.** Function unexpectedly invokes the base fallback implementation.
**Cause.** The argument was passed as a keyword argument (`serialize(val=10)`). `singledispatch` inspects only positional argument 0.
**Fix.** Always pass the target dispatch argument positionally:

```python
# BROKEN: passes argument by keyword; dispatches to base fallback!
serialize(val=100)

# FIXED: pass positionally
serialize(100)
```

## Interview questions

**★ Q: How does `functools.singledispatch` achieve function overloading in Python?**
It converts a base function into a generic function. Specialized implementations are registered for specific types using `@func.register(TargetType)`. At runtime, `singledispatch` checks `type(arg)` for the first positional argument, inspects the inheritance hierarchy (MRO), and executes the most specific registered callable.

**★ Q: Why does `singledispatch` require `singledispatchmethod` when used inside a class?**
Because instance methods receive `self` as their first positional argument. If a standard `@singledispatch` decorator were used on a method, it would inspect the type of `self` (which is always the enclosing class) rather than the method's payload. `singledispatchmethod` skips `self` and dispatches based on the second argument.

**★ Q: What happens when `reduce()` is called on an empty iterable without an initializer?**
Python raises `TypeError: reduce() of empty iterable with no initial value`. If an `initializer` argument is provided, `reduce` returns the initializer value immediately without calling the reduction function.

**Q: Can `singledispatch` register handlers based on generic types like `list[int]`?**
No. `singledispatch` operates at runtime using Python's `type()` and `isinstance()`. Subscripted generics (like `list[int]`) are erased at runtime and cannot be evaluated with `isinstance()`. The decorator requires concrete classes like `list` or `dict`.

**Q: Why was `reduce` removed from Python 3 built-ins and placed in `functools`?**
Python creator Guido van Rossum moved `reduce` out of built-ins because complex `reduce` expressions are difficult to read and debug compared to explicit `for` loops. Furthermore, the most common use cases for `reduce` already have faster, specialized built-in functions: `sum()`, `any()`, `all()`, and `math.prod()`.

---

← [lru_cache and cache](02-lru-cache-and-unbounded-cache.md) · [Topic index](README.md) · Next → **Callables beyond functions** *(not written yet)*
