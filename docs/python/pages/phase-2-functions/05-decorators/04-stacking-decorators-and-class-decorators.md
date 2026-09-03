---
title: "Stacking order, class-based decorators, and the descriptor binding trap"
sidebar_label: "04 · Stacking and class decorators"
sidebar_position: 53
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§8.6 Function definitions, §3.3.2 Customizing attribute access),
> Python Standard Library (types module).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**When decorators are stacked, they compose as nested function calls: `@dec_a @dec_b def f(): pass` desugars strictly to `f = dec_a(dec_b(f))`. Consequently, decorators wrap bottom-up at definition time and execute top-down at call time. Where state must be preserved across invocations, decorators can be structured as classes implementing `__call__`. However, applying a class decorator to an instance method triggers the infamous descriptor binding trap: because instances of custom classes do not automatically bind methods, `self` is omitted at call time. Resolving this trap requires implementing the descriptor protocol via `__get__` with `types.MethodType`.**

## Decorator stacking order

When multiple decorators decorate a function:

```python
@auth_required
@rate_limited
@cache(ttl=60)
def get_account_balance(account_id: str) -> float:
    ...
```

Python evaluates them according to mathematical function composition:

```python
get_account_balance = auth_required(rate_limited(cache(ttl=60)(get_account_balance)))
```

### The two distinct execution orders

1. **Definition time (Bottom-Up):**
   When the `def` statement executes, the innermost decorator runs first:
   `cache(ttl=60)` wraps `get_account_balance` → `rate_limited` wraps the cache wrapper → `auth_required` wraps the rate-limiter wrapper.
2. **Call time (Top-Down):**
   When a caller invokes `get_account_balance(...)`, the outermost wrapper executes first:
   `auth_required` wrapper checks credentials → `rate_limited` wrapper checks quotas → `cache` wrapper checks cache hit → base function executes.

### Why decorator order is critical

Inverting decorator order can create severe security flaws or logic bugs. If `@cache` were placed above `@auth_required`, the cache wrapper would execute before authentication. An unauthenticated attacker could request an account balance and receive cached confidential data returned by a prior authenticated user's query.

## Class-based decorators

When a decorator needs to maintain complex state (such as call frequencies, circuit breaker trip counts, or telemetry buckets), implementing the decorator as a class with `__call__` is cleaner than deeply nested closures:

```python
import functools
from typing import Callable, Any

class CallCounter:
    def __init__(self, func: Callable):
        self.func = func
        self.count = 0
        # Preserve metadata on self
        functools.update_wrapper(self, func)

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        self.count += 1
        return self.func(*args, **kwargs)

@CallCounter
def process_task(task_id: int) -> str:
    return f"Completed {task_id}"

process_task(1)
process_task(2)
print(process_task.count)  # 2
```

## The descriptor binding trap on methods

A critical bug arises when a naive class-based decorator is used on an **instance method**:

```python
class PaymentProcessor:
    @CallCounter
    def charge(self, amount: float) -> bool:
        print(f"Charging {amount}")
        return True

processor = PaymentProcessor()
# CRASHES AT RUNTIME:
# processor.charge(50.0)
# TypeError: charge() missing 1 required positional argument: 'amount'
```

### Why this fails: the missing `self`

In Python, standard functions are descriptors: when accessed as an attribute on an instance (`processor.charge`), their `__get__` method is invoked, which returns a `types.MethodType` that binds `processor` as the first argument (`self`).

Our `CallCounter` class does not implement `__get__`. Therefore:
1. Accessing `processor.charge` simply returns the `CallCounter` instance itself.
2. Calling `processor.charge(50.0)` invokes `CallCounter.__call__(50.0)`.
3. Inside `__call__`, `self.func(50.0)` is called.
4. The underlying method `charge(self, amount)` receives `50.0` as its first parameter (`self`), while `amount` is missing!

### The fix: implementing `__get__` with `types.MethodType`

To make a class-based decorator work transparently on both standalone functions and instance methods, implement the descriptor protocol:

```python
import types
import functools
from typing import Callable, Any, Optional

class RobustCounter:
    def __init__(self, func: Callable):
        self.func = func
        self.count = 0
        functools.update_wrapper(self, func)

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        self.count += 1
        return self.func(*args, **kwargs)

    def __get__(self, instance: Optional[object], owner: type) -> Any:
        if instance is None:
            # Accessed via class (e.g. PaymentProcessor.charge)
            return self
        # Accessed via instance (e.g. processor.charge)
        # types.MethodType binds 'self' to 'instance'
        return types.MethodType(self, instance)
```

Now `processor.charge(50.0)` invokes the bound method, which correctly prepends `processor` to the argument tuple before reaching `__call__`.

## Decorating classes

Decorators can also decorate `class` statements (`@dataclass`, `@singleton`). When applied to a class, the decorator receives the class object itself rather than a function:

```python
def add_repr(cls: type) -> type:
    def __repr__(self) -> str:
        attrs = ", ".join(f"{k}={v!r}" for k, v in self.__dict__.items())
        return f"{cls.__name__}({attrs})"
    cls.__repr__ = __repr__
    return cls

@add_repr
class Point:
    def __init__(self, x: int, y: int):
        self.x = x
        self.y = y

p = Point(3, 4)
print(p)  # Point(x=3, y=4)
```

## Gotchas

### Incorrect stacking exposing security bypasses
**Symptom.** Security checks fail to trigger or run on cached responses.
**Cause.** Applying authorization or authentication decorators below caching decorators.
**Fix.** Ensure security gates are placed at the outermost layer of the decorator stack so they execute first.

### Method missing argument when using class decorator
**Symptom.** `TypeError: method() missing 1 required positional argument` when calling decorated methods.
**Cause.** The class decorator lacks a `__get__` method and therefore cannot bind the instance to `self`.
**Fix.** Add `__get__` returning `types.MethodType(self, instance)`.

## Interview questions

**★ Q: In what order do stacked decorators execute at definition time versus call time?**
At **definition time**, stacked decorators wrap the function from the **bottom up** (the decorator closest to `def` runs first). At **call time**, the wrappers execute from the **top down** (the outermost decorator's wrapper executes first, wrapping around all subsequent wrappers and the base function).

**★ Q: What is the descriptor binding trap when using a class-based decorator on a method?**
Standard Python functions implement the descriptor protocol via `__get__`, which binds the class instance as the first argument (`self`) when called via an instance. A custom class implementing only `__init__` and `__call__` is not a descriptor. When decorating a method, accessing `instance.method` returns the decorator instance without binding `instance`. When invoked, `self` is missing from the arguments, causing a `TypeError`.

**★ Q: How do you fix a class-based decorator so it can decorate instance methods correctly?**
Implement the descriptor method `def __get__(self, instance, owner):`. If `instance is None` (accessed via class), return `self`. Otherwise (accessed via instance), return `types.MethodType(self, instance)`. This binds the instance to the decorator's `__call__` method, ensuring `self` is automatically supplied.

**Q: Why is placing `@cache` above `@auth_required` an architectural defect?**
Because call-time execution flows top-down. Placing `@cache` above `@auth_required` means the cache wrapper evaluates before the authentication check. If User A logs in and retrieves private data, that response is cached. If unauthenticated User B subsequently requests that resource, the cache returns User A's data without ever executing the `@auth_required` check.

**Q: What does a class decorator (decorating `class MyClass`) receive as its argument?**
It receives the constructed class object itself (`MyClass`), after all class body statements have executed. It can mutate the class (adding methods, attributes, or altering class dictionaries) and returns either the modified class or a replacement class.

---

← [Decorators taking arguments](03-decorators-taking-arguments-and-factories.md) · [Topic index](README.md) · Next → [functools](../06-functools/README.md)
