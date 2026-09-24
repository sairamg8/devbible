---
name: research-python-p02-t05-decorators
description: Banked Research: Python Phase 2 · Topic 05 — Decorators
metadata:
  type: research
---

# Banked Research: Python Phase 2 · Topic 05 — Decorators

> Verified: 2026-09-03 against Python 3.14 Language Reference (§8.6 Function definitions, §8.7 Class definitions),
> Python Standard Library (functools module, inspect module), and PEP 612 (ParamSpec).
> Target: **CPython 3.14** (3.14.7).
> Do not re-derive.

---

## 1. Primary Sources & Verbatim Quotes

### Python 3.14 Language Reference §8.6 — Function definitions
URL: https://docs.python.org/3.14/reference/compound_stmts.html#function-definitions
- *"A function definition may be wrapped by one or more decorator expressions. Decorator expressions are evaluated when the function is defined, in the scope that contains the function definition."*
- *"The result must be a callable, which is invoked with the function object as the only parameter. The returning value is bound to the function name instead of the function object."*
- Stacking semantics:
  ```python
  @f1(arg)
  @f2
  def func(): pass
  # Equivalent to:
  # func = f1(arg)(f2(func))
  ```

### Python 3.14 Library Reference — functools.wraps
URL: https://docs.python.org/3.14/library/functools.html#functools.wraps
- `functools.update_wrapper(wrapper, wrapped, assigned=WRAPPER_ASSIGNMENTS, updated=WRAPPER_UPDATES)`:
  - `WRAPPER_ASSIGNMENTS = ('__module__', '__name__', '__qualname__', '__doc__', '__annotations__')`
  - `WRAPPER_UPDATES = ('__dict__',)`
  - Also sets `__wrapped__` attribute on wrapper to reference `wrapped`.
- `inspect.unwrap(func)`: follows the `__wrapped__` chain to return the original un-decorated function.

### PEP 612 — Parameter Specification Variables
URL: https://peps.python.org/pep-0612/
- Capture parameter signatures through decorators using `ParamSpec` and `Concatenate`:
  ```python
  P = ParamSpec("P")
  R = TypeVar("R")
  def my_decorator(func: Callable[P, R]) -> Callable[P, R]: ...
  ```

---

## 2. Key Architecture & Mechanisms

1. **Evaluation Timing**:
   The decorator expression is evaluated when the `def` statement is compiled/executed at runtime. Callables returned by the decorator replace the original function in the namespace. The inner wrapper runs whenever the function is invoked.
2. **Metadata Erasure**:
   Without `@functools.wraps(func)`, `wrapper` replaces `func` and completely erases `__name__`, `__doc__`, `__annotations__`, and `__qualname__`. `inspect.signature` reports `(*args, **kwargs)`.
3. **Decorator Factories (3 levels)**:
   When a decorator takes arguments (`@retry(retries=3)`), the outer function is a factory that returns the actual decorator, which in turn returns the wrapper.
4. **Dual-use Decorator Idiom**:
   Allowing `@decorator` or `@decorator(...)` by checking if the first argument is callable (`callable(first_arg)`).
5. **Class-based Decorators and the Method Trap**:
   If a class implements `__call__` and is used as a decorator on a class method:
   ```python
   class Tracker:
       def __init__(self, fn): self.fn = fn
       def __call__(self, *args, **kwargs): return self.fn(*args, **kwargs)
   ```
   When decorating `def method(self):`, `Tracker` is not a descriptor! Python won't bind `self`, so `self` is not passed to `__call__`. To support decorating methods, the class decorator must implement `__get__(self, instance, owner)`.
