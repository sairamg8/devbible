---
title: "Closure memory retention and introspection: accidental reference leaks and cell lifecycles"
sidebar_label: "04 · Memory leaks and inspection"
sidebar_position: 33
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§4.2 Naming and binding),
> Python Library Reference (inspect module, gc module).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**Because closures retain references to objects via `cell` pointers, they introduce subtle memory retention hazards into production servers. As long as a returned closure remains reachable, every object stored in its `__closure__` tuple is prevented from being garbage collected. If a closure references an entire ORM model or dataset just to read a single configuration flag, or if an instance stores a closure referencing `self`, large object graphs remain pinned in heap memory. Inspecting closures with `inspect.getclosurevars()` and capturing minimal primitives rather than container graphs prevents memory degradation in persistent processes.**

## Cell object lifecycle and memory retention

In CPython, a function's local variables are allocated on the evaluation stack frame. When a function returns, that frame is normally deallocated and its local variables are freed.

However, when a nested function references an outer variable, CPython promotes that variable to a heap-allocated `cell` object. The returned closure retains a direct reference to that cell via `func.__closure__`:

```python
import sys

def create_worker(data_payload: list[dict]):
    # data_payload is allocated as a cell because worker() references it
    def worker() -> int:
        return len(data_payload)
    return worker

# create_worker terminates, but worker holds data_payload alive in memory!
my_worker = create_worker([{"id": i} for i in range(100_000)])
print(type(my_worker.__closure__[0]))  # <class 'cell'>
```

Even though `create_worker` has finished, the 100,000-item list cannot be deallocated by Python's reference-counting garbage collector because `my_worker.__closure__[0].cell_contents` maintains an active reference to it.

## The accidental whole-graph capture trap

A frequent production leak occurs when a closure captures a large object simply to access a small property:

```python
# LEAK HAZARD: Pins the entire UserAccount and its related database models in memory
def build_notifier(account: "UserAccount"):
    def send_alert(message: str) -> None:
        # Accessing account.email keeps the entire 'account' object alive!
        dispatcher.send(account.email, message)
    return send_alert

# SAFE DESIGN: Extract primitives before creating the closure
def build_notifier(account: "UserAccount"):
    target_email = account.email  # primitive string
    def send_alert(message: str) -> None:
        dispatcher.send(target_email, message)
    return send_alert
```

In the safe version, CPython creates a cell only for the string `target_email`. The large `account` object is safely garbage collected when `build_notifier` returns.

## Reference cycles with `self`

When an object assigns a closure to one of its own instance attributes, and that closure captures `self`, a reference cycle is formed:

```python
class EventHandler:
    def __init__(self, name: str):
        self.name = name
        # CYCLE: self holds a reference to callback;
        # callback's __closure__ holds a cell pointing back to self!
        self.callback = lambda: print(f"Handling {self.name}")
```

In CPython:
1. `self` has a reference count of at least 2 (the creator and the closure's cell).
2. Deleting the external reference (`del handler`) does not drop the reference count to 0.
3. The instance cannot be reclaimed by simple reference counting; it must wait for a cyclic garbage collection pass (`gc.collect()`). In high-frequency event architectures, millions of cyclic closures can trigger severe memory pressure and GC pauses.

### Breaking the cycle with `weakref`

To prevent cyclic retention, capture a weak reference to `self`:

```python
import weakref

class EventHandler:
    def __init__(self, name: str):
        self.name = name
        self_ref = weakref.ref(self)
        self.callback = lambda: (
            print(f"Handling {s.name}") if (s := self_ref()) is not None else None
        )
```

## Introspecting closures with `inspect.getclosurevars`

While `func.__closure__` provides raw access to cell tuples, the standard library `inspect` module provides `inspect.getclosurevars(func)`, which categorizes all variables accessed by the callable:

```python
import inspect

api_endpoint = "https://api.example.com"

def make_fetcher(token: str):
    prefix = "Bearer"

    def fetch(path: str) -> dict:
        auth_header = f"{prefix} {token}"
        url = f"{api_endpoint}/{path}"
        return {"url": url, "auth": auth_header}

    return fetch

client = make_fetcher("secret-jwt-xyz")
closure_vars = inspect.getclosurevars(client)

# Inspect categorized variables
print(closure_vars.nonlocals)  # {'prefix': 'Bearer', 'token': 'secret-jwt-xyz'}
print(closure_vars.globals)    # {'api_endpoint': 'https://api.example.com'}
print(closure_vars.builtins)   # {}
```

`getclosurevars` returns a named tuple `ClosureVars(nonlocals, globals, builtins, unbound)`:
- `nonlocals`: maps names to values captured from enclosing lexical scopes (from `__closure__`).
- `globals`: names accessed from the module global namespace.
- `builtins`: built-in symbols accessed by the function.
- `unbound`: names referenced in the function that could not be resolved.

## Gotchas

### Storing closures in module-level registries
**Symptom.** Application memory continuously increases over time (linear memory leak).
**Cause.** Callbacks or hooks containing closures are registered in a global list or dictionary and never unregistered.
**Fix.** Provide explicit unregistration methods, or store callbacks in a `weakref.WeakSet`:

```python
import weakref

# Memory leak prevention: WeakSet does not prevent callback reclamation
CALLBACK_REGISTRY = weakref.WeakSet()
```

### Shared cell mutation across sibling closures
**Symptom.** Calling function A unexpectedly modifies the state of function B generated in the same outer function.
**Cause.** Two nested functions inside the same enclosing scope close over the same local variable. They share the identical `cell` object.
**Fix.** If independent state is required, use separate factory invocations:

```python
def make_pair():
    shared_val = 0
    def getter(): return shared_val
    def setter(v):
        nonlocal shared_val
        shared_val = v
    return getter, setter

get_val, set_val = make_pair()
set_val(42)
print(get_val())  # 42 (intentionally shared cell!)
```

## Interview questions

**★ Q: How can a closure inadvertently cause a memory leak in a long-running service?**
A closure keeps every object referenced by its `__closure__` cell tuple alive in heap memory for the entire lifetime of the closure function object. If a closure references a large data structure (e.g. an ORM model, dataframe, or network socket) when it only needs a single primitive attribute, the entire data structure and all its referenced objects cannot be garbage collected as long as the closure is stored in an event registry, cache, or long-lived handler.

**★ Q: What standard library utility inspects all variables captured by a closure?**
`inspect.getclosurevars(func)`. It parses the function's bytecode and returns a named tuple with four fields: `nonlocals` (lexical enclosing variables from `__closure__`), `globals` (module-level references), `builtins` (built-in functions), and `unbound` (unresolved identifiers).

**★ Q: What happens when an object stores a closure that references `self` as an instance attribute?**
It creates a reference cycle: the instance owns the closure via its attribute dictionary, while the closure's `__closure__` cell holds a reference back to the instance. Because neither reference count can drop to zero when external references are discarded, the object cannot be freed by CPython's reference counting and must wait for the cyclic garbage collector to identify and collect the cycle.

**Q: Does a Python closure keep the entire outer stack frame alive, or only the referenced variables?**
Only the referenced variables. Unlike some runtimes that retain the entire lexical environment record, CPython inspects the AST at compile time to identify free variables (`co_freevars`). It allocates individual heap `cell` objects only for variables explicitly captured by inner functions. Other local variables in the outer function that are not captured are freed as soon as the outer function returns.

**Q: How can `weakref` be used with closures to avoid memory retention?**
By wrapping the outer object in a `weakref.ref(obj)` before constructing the closure, and capturing the weak reference instead of `obj`. When the closure runs, it calls `obj = weak_ref()`: if the target object is still alive, it proceeds; if the object has been destroyed, `weak_ref()` returns `None`, allowing the target object to be deallocated promptly.

---

← [Closures and late-binding](03-closures-and-the-late-binding-trap.md) · [Topic index](README.md) · Next → **lambda** *(not written yet)*
