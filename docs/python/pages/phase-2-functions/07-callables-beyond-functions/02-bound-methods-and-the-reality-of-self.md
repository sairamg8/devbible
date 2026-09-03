---
title: "Bound methods, unbound functions, and the reality of self in Python"
sidebar_label: "02 · Bound methods and self"
sidebar_position: 71
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§3.2 Standard type hierarchy: Instance methods, §3.3.2.2 Descriptors).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**In Python, `self` is not a keyword, compiler symbol, or implicit runtime pointer. It is purely an explicit parameter name required by Python's calling convention. A function declared inside a class is an ordinary function object (`types.FunctionType`). When accessed as an attribute on an instance (`instance.method`), Python invokes the function's descriptor method (`__get__`), which constructs a transient `types.MethodType` object known as a **bound method**. The bound method packages the instance into `__self__` and the raw function into `__func__`, automatically inserting `__self__` as the first argument at invocation time. Invoking `instance.method(x)` is strictly equivalent to `Class.method(instance, x)`.**

## Demystifying `self`

Unlike languages with implicit pointers like `this` in Java, C++, or JavaScript, Python makes the receiving instance an explicit parameter in method signatures:

```python
class Account:
    # 'self' is an explicit parameter name, not a keyword
    def deposit(self, amount: float) -> None:
        self.balance += amount

    # Syntactically valid, but PEP 8 violation:
    def withdraw(this, amount: float) -> None:
        this.balance -= amount
```

Python does not require the parameter to be named `self`—the language runtime simply supplies the instance as the first positional argument. However, PEP 8 strictly mandates using `self` for instance methods and `cls` for class methods.

## Unbound functions versus bound methods

The difference between accessing a function from a class versus an instance illustrates how method binding works:

```python
class User:
    def __init__(self, name: str):
        self.name = name

    def greet(self, punctuation: str = "!") -> str:
        return f"Hello, {self.name}{punctuation}"

u = User("Alice")

# 1. Accessed via CLASS: returns raw function (unbound)
print(User.greet)
# <function User.greet at 0x...>
print(type(User.greet))
# <class 'function'>

# 2. Accessed via INSTANCE: returns bound method
print(u.greet)
# <bound method User.greet of <__main__.User object at 0x...>>
print(type(u.greet))
# <class 'method'>
```

### The fundamental equivalence rule

Calling a bound method on an instance executes the exact same underlying bytecode as calling the class function directly and passing the instance:

```python
# Calling bound method on instance:
res1 = u.greet("?")

# Calling raw function on class, passing instance explicitly:
res2 = User.greet(u, "?")

assert res1 == res2 == "Hello, Alice?"
```

## The descriptor protocol under the hood

How does accessing `u.greet` produce a `MethodType`? **In Python, all functions are descriptors.**

Every function implements `__get__(self, instance, owner)`. When Python evaluates `u.greet`:
1. It searches `u.__dict__` for `"greet"` (not found).
2. It searches `User.__dict__` and finds the function object `User.greet`.
3. It detects that `User.greet` implements `__get__`.
4. It calls `User.greet.__get__(u, User)`.
5. The function's `__get__` method returns a `types.MethodType` binding `u` to `User.greet`.

When accessed via the class (`User.greet`), `instance` is passed as `None`:
`User.greet.__get__(None, User)` returns the un-bound function object itself.

## Introspecting bound methods: `__self__` and `__func__`

A bound method object exposes its internal linkages:

```python
method = u.greet

print(method.__self__)  # <__main__.User object at 0x...> (the bound instance)
print(method.__func__)  # <function User.greet at 0x...> (the raw function)

# Calling the raw function via the method's attributes:
print(method.__func__(method.__self__, "!"))  # "Hello, Alice!"
```

## Memory retention in callback registries

Passing a bound method as a callback stores a strong reference to the instance via `__self__`:

```python
class EventWatcher:
    def on_event(self, data):
        print(data)

watcher = EventWatcher()

# SUBSCRIBING HOLDS A STRONG REFERENCE TO watcher VIA __self__
event_bus.register_listener(watcher.on_event)

# Deleting the local reference:
del watcher
# watcher CANNOT be garbage collected because event_bus holds watcher.on_event.__self__!
```

### Preventing callback leaks with `weakref.WeakMethod`

To register callbacks without keeping instances alive, wrap the bound method with `weakref.WeakMethod`:

```python
import weakref

class EventBus:
    def __init__(self):
        self._listeners = []

    def subscribe(self, callback):
        # Stores a weak reference to the bound method
        self._listeners.append(weakref.WeakMethod(callback))

    def trigger(self, data):
        for ref in list(self._listeners):
            method = ref()
            if method is not None:
                method(data)
            else:
                self._listeners.remove(ref)
```

## Gotchas

### Forgetting `self` in instance method definitions
**Symptom.** `TypeError: method() takes 0 positional arguments but 1 was given` when invoking `obj.method()`.
**Cause.** The method was defined without parameters (`def method(): pass`). When called via an instance, Python automatically passes the instance as the first argument, exceeding the parameter count.
**Fix.** Add `self` as the first parameter, or decorate with `@staticmethod` if the instance is not used.

```python
# BROKEN
class Service:
    def ping():  # Missing 'self'
        return "pong"

# FIXED
class Service:
    def ping(self):
        return "pong"
```

### Calling instance methods via the class without passing an instance
**Symptom.** `TypeError: Service.ping() missing 1 required positional argument: 'self'`.
**Cause.** Calling `Service.ping()` directly on the class without supplying an instance.
**Fix.** Instantiate the class first (`Service().ping()`) or pass an instance (`Service.ping(my_service)`).

## Interview questions

**★ Q: What actually happens under the hood when you call `instance.method(arg)`?**
Python looks up `method` on `type(instance)` and invokes the function's `__get__` descriptor method, which returns a `types.MethodType` object (a bound method). The bound method holds references to `instance` in its `__self__` attribute and the underlying function in `__func__`. When called, `MethodType` invokes `__func__`, automatically prepending `__self__` to the caller's arguments: `type(instance).method(instance, arg)`.

**★ Q: Is `self` a keyword in Python? What makes it work?**
No, `self` is not a keyword. It is an ordinary identifier chosen by convention (enforced by PEP 8). What makes instance methods work is Python's descriptor protocol: accessing a function via an instance passes that instance to the function's `__get__` method, which binds the instance as the first positional argument.

**★ Q: What are the `__self__` and `__func__` attributes on a bound method?**
`__self__` points to the class instance to which the method is bound. `__func__` points to the underlying raw function object defined in the class body.

**Q: How does the descriptor protocol convert a function into a bound method?**
Functions implement `__get__(self, instance, owner)`. When accessed as an attribute on an instance (`instance.fn`), Python executes `Class.fn.__get__(instance, Class)`. If `instance` is not `None`, `__get__` constructs and returns `types.MethodType(fn, instance)`. If `instance` is `None` (accessed via `Class.fn`), `__get__` returns the function object itself.

**Q: How can storing bound methods in callback registries cause memory leaks, and how do you prevent them?**
A bound method retains a strong reference to its instance via `__self__`. If a bound method is registered in a long-lived callback list or event loop, the instance cannot be deallocated even after all external references to it are deleted. To prevent leaks, store callbacks using `weakref.WeakMethod`, which allows the instance to be reclaimed by garbage collection.

---

← [__call__ and stateful instances](01-the-call-dunder-and-stateful-instances.md) · [Topic index](README.md) · Next → [Docstrings](../08-docstrings/README.md)
