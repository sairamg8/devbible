---
title: "The __call__ protocol: turning class instances into stateful, introspectable callables"
sidebar_label: "01 · __call__ and stateful instances"
sidebar_position: 70
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§3.2 Standard type hierarchy: Callable types, §3.3.9 Emulating callable objects).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**In Python, callability is not restricted to functions; any object can act as a callable if its class defines the `__call__` special method. Executing `obj(*args, **kwargs)` desugars strictly to `type(obj).__call__(obj, *args, **kwargs)`, causing the built-in `callable(obj)` to return `True`. While closures preserve state inside lexical `cell` pointers, callable instances provide full object-oriented architecture: direct attribute inspection, multi-method state manipulation, class inheritance, and native serialization via `pickle`. Callable classes form the foundation for stateful middleware, token buckets, and processing pipelines.**

## The `__call__` protocol desugared

When parentheses are applied to an arbitrary object, Python's bytecode interpreter invokes `type(obj).__call__`:

```python
class Multiplier:
    def __init__(self, factor: int):
        self.factor = factor

    def __call__(self, value: int) -> int:
        return value * self.factor

triple = Multiplier(3)

# Calling the instance directly:
result = triple(10)
print(result)  # 30

# The exact syntactic equivalence:
equiv = type(triple).__call__(triple, 10)
print(equiv)   # 30

# Verifying callability:
print(callable(triple))  # True
```

### The class-lookup rule for special methods

In CPython, dunder methods (`__call__`, `__len__`, `__getitem__`) are looked up on the **class** (`type(obj)`), never on the instance's `__dict__`:

```python
class Plain:
    pass

p = Plain()
# DYNAMIC ATTACHMENT FAILS:
p.__call__ = lambda: "called"

# callable(p) is False!
# p() raises TypeError: 'Plain' object is not callable
```

Special methods are stored in the class's C-level type structure (`tp_call` slot in CPython) for execution speed. Attaching `__call__` directly to an instance does not update this slot and fails.

## Real-world pattern: Stateful rate limiter

A callable class encapsulates mutable state and helper methods far more cleanly than complex nested closures:

```python
import time

class TokenBucketLimiter:
    def __init__(self, capacity: int, refill_rate_per_sec: float):
        self.capacity = capacity
        self.refill_rate = refill_rate_per_sec
        self.tokens = float(capacity)
        self.last_refill = time.monotonic()

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now

    def __call__(self, cost: int = 1) -> bool:
        """Invoked when checking or consuming tokens."""
        self._refill()
        if self.tokens >= cost:
            self.tokens -= cost
            return True
        return False

    def reset(self) -> None:
        """External administrative method."""
        self.tokens = float(self.capacity)
        self.last_refill = time.monotonic()

limiter = TokenBucketLimiter(capacity=100, refill_rate_per_sec=10.0)

# Used directly as a callable gate:
if limiter():
    print("Request permitted")
```

## Architectural comparison: Closures vs Callable Classes

| Dimension | Stateful Closure (`nonlocal`) | Callable Class (`__call__`) |
|---|---|---|
| **State Inspection** | Opaque (requires `inspect.getclosurevars` or returned getters) | Direct (public attributes: `limiter.tokens`) |
| **Additional Actions** | Clunky (must return tuple or dict of functions) | Idiomatic (methods: `limiter.reset()`) |
| **Inheritance & Polymorphism** | Impossible | Standard class inheritance |
| **Multiprocessing (`pickle`)** | Often fails (`PicklingError` on nested scopes) | Picklable (top-level classes serialize cleanly) |
| **Memory Footprint** | Slightly lighter (small heap cell) | Standard object dictionary (`__dict__`) |

When state requires lifecycle management, multiple interacting operations, or persistent monitoring, refactor the closure into a callable class.

## Gotchas

### Concurrency race conditions on shared callable instances
**Symptom.** Token counts or metrics drift incorrectly under multi-threaded request processing.
**Cause.** A single instance of a callable class is shared across threads without a lock on its mutating `__call__` logic.
**Fix.** Guard state mutations with a `threading.Lock`:

```python
import threading

class SafeCounter:
    def __init__(self):
        self.count = 0
        self._lock = threading.Lock()

    def __call__(self) -> int:
        with self._lock:
            self.count += 1
            return self.count
```

### Confusing class instantiation with instance invocation
**Symptom.** `TypeError: __init__() takes X arguments but Y were given` or methods called on classes instead of instances.
**Cause.** Calling the class directly (`Limiter(10)`) instantiates the class, whereas calling the instantiated object (`limiter(10)`) invokes `__call__`.
**Fix.** Ensure the object is instantiated before invoking it as a callable pipeline stage.

## Interview questions

**★ Q: How does Python evaluate `instance(*args, **kwargs)` when an object is called?**
Python looks up `__call__` on the object's class (`type(instance)`), bypassing the instance dictionary `__dict__`. It then invokes `type(instance).__call__(instance, *args, **kwargs)`. If `type(instance)` does not define `__call__`, Python raises `TypeError: 'ClassName' object is not callable`.

**★ Q: What happens if you assign a function to an instance's `__call__` attribute at runtime (e.g. `obj.__call__ = fn`)?**
The instance remains uncallable, and invoking `obj()` raises `TypeError: 'ClassName' object is not callable`. In CPython, all dunder methods are looked up on the class type slots for performance and language consistency; instance-level dunder attributes are ignored during syntax desugaring.

**★ Q: When should you choose a callable class instance over a closure?**
Choose a callable class when the state needs to be inspected externally (via public attributes), when multiple related actions are needed (such as `.reset()` or `.metrics()` alongside `__call__`), when class inheritance or polymorphism is required, or when the callable must be serialized across multiprocessing boundaries via `pickle`.

**Q: How does the built-in `callable()` function determine whether an object can be called?**
`callable(obj)` returns `True` if `obj` is an instance of a class with a `__call__` method, or if `obj` is a built-in callable type (such as `types.FunctionType`, `types.MethodType`, `types.BuiltinFunctionType`, or a class itself).

**Q: Can a callable class instance be serialized with `pickle`?**
Yes, provided the class is defined at the top level of an importable module and its internal instance attributes are picklable. Unlike closures, which frequently fail serialization due to unpicklable code objects and cell references, standard callable class instances serialize without issue.

---

← [Topic index](README.md) · Next → [Bound methods and self](02-bound-methods-and-the-reality-of-self.md)
