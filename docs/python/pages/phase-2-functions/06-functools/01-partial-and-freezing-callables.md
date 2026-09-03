---
title: "functools.partial: eager argument freezing, inspection, and method binding with partialmethod"
sidebar_label: "01 · partial and partialmethod"
sidebar_position: 60
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against Python 3.14 Library Reference (functools module: partial, partialmethod).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**Partial function application pre-binds a subset of arguments to a callable, returning a new `functools.partial` object that accepts only the remaining parameters at invocation time. Unlike anonymous lambdas, `partial` evaluates its arguments eagerly when instantiated, entirely preventing the late-binding loop bug. Furthermore, `partial` objects are picklable across multiprocessing worker processes and expose clean introspection attributes (`.func`, `.args`, `.keywords`). For class definitions where methods require instance binding, `functools.partialmethod` implements the descriptor protocol to ensure `self` is supplied automatically.**

## Mechanics of `functools.partial`

`functools.partial(func, *args, **keywords)` constructs a callable object that combines pre-bound positional and keyword arguments with those passed at call time:

```python
from functools import partial

def send_request(base_url: str, endpoint: str, timeout: int = 30) -> dict:
    return {"url": f"{base_url}/{endpoint}", "timeout": timeout}

# Partially apply the base_url and default timeout
api_client = partial(send_request, "https://api.internal.net/v1", timeout=10)

# Caller supplies only the remaining endpoint:
response = api_client("users")
print(response)  # {'url': 'https://api.internal.net/v1/users', 'timeout': 10}

# Call-site keyword arguments override pre-bound defaults:
slow_response = api_client("reports", timeout=120)
print(slow_response)  # {'url': 'https://api.internal.net/v1/reports', 'timeout': 120}
```

When invoked:
- Newly supplied positional arguments are appended to the pre-bound `args` tuple.
- Newly supplied keyword arguments extend or overwrite the pre-bound `keywords` dictionary.

## Why `partial` beats `lambda`

Developers frequently default to writing `lambda` expressions when `partial` provides a superior architectural solution:

| Feature | `functools.partial` | `lambda` Expression |
|---|---|---|
| Evaluation timing | **Eager** (evaluates arguments at creation) | **Late-bound** (evaluates variables at call time) |
| Multiprocessing serialization | **Picklable** (if func & args are picklable) | **Fails** (`PicklingError`) |
| Introspection | Exposes `.func`, `.args`, `.keywords` | Generic `<lambda>` with no argument metadata |
| Performance in CPython | Implemented in C | Python bytecode evaluation |

### Eager binding immunity to the loop trap

In callback generation inside loops, `partial` binds arguments immediately without requiring default argument hacks:

```python
from functools import partial

def handle_event(item_id: int):
    print(f"Handled {item_id}")

# IMMUNE TO LATE-BINDING: 'i' is evaluated and stored at loop execution time
callbacks = [partial(handle_event, i) for i in range(3)]
for cb in callbacks:
    cb()
# Output:
# Handled 0
# Handled 1
# Handled 2
```

## Introspection of `partial` objects

Unlike lambdas, `partial` objects allow callers and frameworks to inspect their target callable and pre-bound values:

```python
from functools import partial

def query(db: str, table: str, limit: int = 100):
    pass

user_query = partial(query, "production_db", limit=50)

print(user_query.func)      # <function query at ...>
print(user_query.args)      # ('production_db',)
print(user_query.keywords)  # {'limit': 50}
```

This enables dependency injection frameworks and task runners to verify signatures and modify pre-bound configurations dynamically.

## Class method binding with `functools.partialmethod`

A common pitfall occurs when placing a `partial` object directly inside a `class` definition:

```python
from functools import partial, partialmethod

class MicroserviceClient:
    def request(self, method: str, path: str):
        return f"{method} {path}"

    # BROKEN: partial is NOT a descriptor; self will not be passed!
    # get = partial(request, "GET")

    # FIXED: partialmethod implements descriptor protocol (__get__)
    get = partialmethod(request, "GET")
    post = partialmethod(request, "POST")

client = MicroserviceClient()
print(client.get("/users"))   # 'GET /users'
print(client.post("/orders")) # 'POST /orders'
```

Because `partialmethod` implements the descriptor protocol (`__get__`), Python binds `client` as `self` before passing `"GET"` and `"/users"` into `request`.

## Gotchas

### Positional argument index collision
**Symptom.** `TypeError: func() got multiple values for argument 'x'` or arguments misaligned.
**Cause.** Freezing positional arguments shifts the index of subsequent positional inputs.
**Fix.** Freeze optional arguments using keyword syntax (`partial(func, flag=True)`) rather than positional syntax:

```python
def setup_user(username: str, role: str = "viewer", active: bool = True):
    return (username, role, active)

# RISKY: freezing positional argument shifts positions
admin_setup = partial(setup_user, "admin")
# admin_setup("bob") passes "bob" as 'role', not 'username'!

# SAFE: freeze explicitly by keyword
admin_setup = partial(setup_user, role="admin")
print(admin_setup("bob"))  # ('bob', 'admin', True)
```

### Missing docstrings on partial objects
**Symptom.** API documentation or `help()` on a `partial` object displays generic C-level docstrings instead of the underlying function's docstring.
**Cause.** A `partial` object is a wrapper instance; it does not automatically copy `__doc__`.
**Fix.** Access the docstring via `partial_obj.func.__doc__` or use `@functools.wraps`:

```python
# Docstring resides on the underlying target
doc = api_client.func.__doc__
```

## Interview questions

**★ Q: What is `functools.partial` and how does it differ from a `lambda`?**
`functools.partial` is a callable constructor that freezes a subset of positional and keyword arguments on an existing function. Unlike a `lambda`, `partial` evaluates and binds its arguments eagerly when instantiated, avoiding closure late-binding bugs. It is implemented in C in CPython, can be serialized with `pickle` for multiprocessing, and exposes its target and arguments via `.func`, `.args`, and `.keywords`.

**★ Q: Why does `partial` avoid the late-binding loop bug without workarounds?**
Because `partial(func, i)` evaluates the expression `i` immediately during the loop iteration and stores the evaluated object in its internal `args` tuple. A `lambda` references the lexical variable `i` via a closure cell, deferring resolution until the function is called.

**★ Q: What is the purpose of `functools.partialmethod` in class definitions?**
A standard `partial` object does not implement Python's descriptor protocol (`__get__`). Placing a `partial` inside a class body fails to bind the instance (`self`) when called via an instance. `functools.partialmethod` implements `__get__`, ensuring the instance is automatically bound as `self` when invoked.

**Q: How can you inspect the bound arguments of a `partial` object?**
Access its three core attributes: `obj.func` (the wrapped callable), `obj.args` (the tuple of pre-bound positional arguments), and `obj.keywords` (the dictionary of pre-bound keyword arguments).

**Q: What happens if a caller passes a keyword argument that was already bound in `partial.keywords`?**
The caller's newly supplied keyword argument takes precedence and overrides the value previously bound in `partial.keywords`. Positional arguments, by contrast, cannot override previously bound positional arguments; they are appended to `partial.args`.

---

← [Topic index](README.md) · Next → [lru_cache and cache](02-lru-cache-and-unbounded-cache.md)
