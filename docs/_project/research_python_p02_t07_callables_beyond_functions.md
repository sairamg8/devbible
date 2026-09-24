---
name: research-python-p02-t07-callables-beyond-functions
description: Banked Research: Python Phase 2 · Topic 07 — Callables beyond functions
metadata:
  type: research
---

# Banked Research: Python Phase 2 · Topic 07 — Callables beyond functions

> Verified: 2026-09-03 against Python 3.14 Language Reference (§3.2 The standard type hierarchy, §3.3.2 Customizing attribute access: Descriptors).
> Target: **CPython 3.14** (3.14.7).
> Do not re-derive.

---

## 1. Primary Sources & Verbatim Quotes

### Python 3.14 Language Reference §3.2 — Callable types
URL: https://docs.python.org/3.14/reference/datamodel.html#callable-types
- *"These are the types to which the function call operation can be applied: User-defined functions, Instance methods, Generator functions, Coroutine functions, Built-in functions, Built-in methods, Classes, Class Instances."*
- Class Instances:
  - *"Instances of arbitrary classes can be made callable by defining a `__call__()` method in their class."*
- Instance methods:
  - *"An instance method object combines a class, a class instance and any callable object (normally a user-defined function)."*
  - *"Special read-only attributes: `__self__` is the class instance object, `__func__` is the function object; `__doc__` is the method's documentation; `__name__` is the method name."*
  - *"When an instance method object is called, the underlying function (`__func__`) is called, inserting the class instance (`__self__`) in front of the argument list."*

### Python 3.14 Language Reference §3.3.2.2 — Descriptor protocol
URL: https://docs.python.org/3.14/reference/datamodel.html#descriptors
- *"User-defined functions have a `__get__()` method so that they act as descriptors when accessed as attributes of an instance."*
- *"When a function is accessed as an attribute of an instance, its `__get__()` method is called with the instance as the first argument, returning a method object."*
- `inst.method(arg)` is equivalent to `type(inst).method(inst, arg)`.

---

## 2. Key Architecture & Pitfalls

1. **`callable()` Built-in**:
   Returns `True` if the object's class implements `__call__` or if it is a built-in callable.
2. **`self` is not a keyword**:
   `self` is purely a naming convention. A method can name its first parameter `this`, `me`, or `payload`, although PEP 8 strictly mandates `self`.
3. **Bound Method Attributes**:
   - `method.__self__`: the instance bound to the method.
   - `method.__func__`: the original raw function on the class.
4. **Method vs Function Equivalence**:
   `user.greet("hi")` is byte-for-byte equivalent to `User.greet(user, "hi")`.
5. **Bound Method Lifecycle in Callbacks**:
   Registering `obj.handler` in an event loop or GUI callback holds a strong reference to `obj` via `__self__`. If unregistration is omitted, `obj` cannot be garbage collected.
