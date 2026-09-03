---
title: "Default parameter values are evaluated once at definition time, not per call"
sidebar_label: "01 · Default values and the mutable trap"
sidebar_position: 20
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§8.6 Function definitions, §3.2 Internal types).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**In Python, default parameter expressions are evaluated from left to right exactly once when the `def` statement executes, not when the function is invoked. The resulting objects are permanently bound into the function object's `__defaults__` tuple (or `__kwdefaults__` dictionary). If a default value is a mutable object like a `list`, `dict`, or `set`, any mutation performed inside the function body persists across every subsequent call in the process, causing cross-request data leaks in web applications. The standard fix is defaulting to `None` and allocating fresh instances inside the body, or employing a private sentinel object when `None` is a meaningful input.**

## The mechanism: definition-time evaluation

The Python Language Reference specifies the exact timing of default parameter evaluation:

> *"Default parameter values are evaluated from left to right when the function definition is executed. This means that the expression is evaluated once, when the function is defined, and that the same “pre-computed” value is used for each call. This is especially important to understand when a default parameter value is a mutable object, such as a list or a dictionary: if the function modifies the object (e.g. by appending an item to a list), the default parameter value is in effect modified."*

When Python encounters a `def` statement, it compiles the function body and evaluates the default expressions in the enclosing scope:

```python
def append_item(item: int, container: list[int] = []) -> list[int]:
    container.append(item)
    return container

# The default list object is stored directly in __defaults__
print(append_item.__defaults__)  # ([],)

append_item(1)
print(append_item.__defaults__)  # ([1],)

append_item(2)
print(append_item.__defaults__)  # ([1, 2],)
```

The second call does not allocate a new list; it reuses the single list instance living in `append_item.__defaults__[0]`.

## The canonical idiom: None default with body instantiation

To ensure that each invocation receives a fresh, independent container, default the parameter to `None` and instantiate the mutable object inside the function body:

```python
def append_item_safe(
    item: int,
    container: list[int] | None = None,
) -> list[int]:
    if container is None:
        container = []
    container.append(item)
    return container
```

Notice the type annotation: `container: list[int] | None = None`. Python type checkers enforce that the default value matches the declared type; declaring `container: list[int] = None` without the union is a type error under strict checking.

## The sentinel pattern: when None is a valid input

When `None` is a legitimate, meaningful argument distinct from "no argument was passed", using `None` as the default makes it impossible to detect whether the caller provided `None` explicitly:

```python
# PROBLEM: Cannot distinguish get_setting("timeout", None) from get_setting("timeout")
def get_setting(key: str, default: object = None) -> object:
    ...
```

The solution is to create a private sentinel object using `object()`:

```python
# Define a private singleton sentinel
_SENTINEL = object()

def get_setting(key: str, default: object = _SENTINEL) -> object:
    """Retrieve a setting from store, falling back to default if absent."""
    config_store = {"retries": 3, "timeout": None}

    if key in config_store:
        return config_store[key]

    if default is not _SENTINEL:
        return default

    raise KeyError(f"Configuration key not found: {key}")

# Valid calls
val1 = get_setting("timeout", default="10s")  # returns None (the stored value)
val2 = get_setting("missing", default=None)    # returns None (the explicit fallback)
# get_setting("missing")                       # raises KeyError
```

Because `object()` creates a unique instance with a distinct memory identity, `default is _SENTINEL` safely detects whether the caller omitted the parameter.

## The frozen dynamic default trap

The same definition-time evaluation rule applies to dynamic expressions like `datetime.now()` or `time.time()`:

```python
import datetime
import time

# BUG: datetime.now() is evaluated ONCE when the module imports!
def create_audit_log(event: str, timestamp: datetime.datetime = datetime.now()) -> dict:
    return {"event": event, "timestamp": timestamp}

# Every log entry generated over days will have the module's import timestamp!
```

The fix is identical: default to `None` and compute the dynamic value at call time:

```python
def create_audit_log(
    event: str,
    timestamp: datetime.datetime | None = None,
) -> dict:
    if timestamp is None:
        timestamp = datetime.datetime.now(datetime.timezone.utc)
    return {"event": event, "timestamp": timestamp}
```

## Introspection: `__defaults__` and `__kwdefaults__`

Python stores default arguments on two separate function attributes:

```python
def example(a: int, b: int = 10, *, c: str = "default") -> None:
    pass

print(example.__defaults__)    # (10,) -> tuple of positional defaults
print(example.__kwdefaults__)  # {'c': 'default'} -> dict of keyword-only defaults
```

`__defaults__` is a tuple corresponding to the last *N* positional parameters that have defaults. `__kwdefaults__` is a dictionary mapping parameter names to default values for keyword-only parameters.

## Gotchas

### Accumulator default mutating across web requests
**Symptom.** User A sees data submitted by User B, or shopping carts accumulate items from unrelated sessions.
**Cause.** A handler function used `cart: list = []` or `metadata: dict = {}` in its parameter signature. Because the web server process retains the module in memory, all requests share the same default object.
**Fix.** Default to `None` and allocate a fresh dictionary or list inside the handler:

```python
# BROKEN: shared across all callers
def add_to_session(user_id: str, tags: list[str] = []) -> dict:
    tags.append(user_id)
    return {"tags": tags}

# FIXED: independent container per invocation
def add_to_session(user_id: str, tags: list[str] | None = None) -> dict:
    actual_tags = [] if tags is None else tags
    actual_tags.append(user_id)
    return {"tags": actual_tags}
```

### Freezing dynamic defaults at import time
**Symptom.** Timestamps, UUIDs, or random tokens remain identical across all executions throughout the process lifetime.
**Cause.** Calling `time.time()`, `uuid.uuid4()`, or `random.randint()` directly inside the parameter list evaluates the function once at definition time.
**Fix.** Pass `None` as the default and invoke the generator function within the function body:

```python
# BROKEN: uuid4() evaluated once at import time
import uuid

def create_task(name: str, task_id: uuid.UUID = uuid.uuid4()) -> dict:
    return {"id": task_id, "name": name}

# FIXED: evaluate uuid4() on every call
def create_task(name: str, task_id: uuid.UUID | None = None) -> dict:
    if task_id is None:
        task_id = uuid.uuid4()
    return {"id": task_id, "name": name}
```

### Checking sentinels with `==` instead of `is`
**Symptom.** A function raises `TypeError` or mishandles sentinel comparisons when the caller passes a custom class or pandas DataFrame.
**Cause.** Using `default == _SENTINEL` invokes the caller object's `__eq__` method, which may raise an exception or fail if the caller type defines custom equality.
**Fix.** Always compare sentinels using reference identity: `default is _SENTINEL`.

```python
# BROKEN: may trigger unexpected __eq__ behaviour
_MISSING = object()
def fetch_item(key: str, default=_MISSING):
    if default == _MISSING:
        ...

# FIXED: identity comparison guarantees safe O(1) pointer check
def fetch_item(key: str, default=_MISSING):
    if default is _MISSING:
        ...
```

### Mutating a parameter that aliased the default
**Symptom.** Even when the function assigns `if container is None: container = default_list`, mutating `container` still alters `default_list`.
**Cause.** Aliasing a module-level default mutable container without making a shallow or deep copy.
**Fix.** Explicitly copy the container or pass a factory:

```python
DEFAULT_CONFIG = {"retries": 3, "timeout": 30}

# BROKEN: mutates DEFAULT_CONFIG globally!
def connect(options: dict | None = None) -> None:
    if options is None:
        options = DEFAULT_CONFIG
    options["retries"] = 5

# FIXED: copy the template
def connect(options: dict | None = None) -> None:
    actual_options = DEFAULT_CONFIG.copy() if options is None else options.copy()
    actual_options["retries"] = 5
```

## Interview questions

**★ Q: When are default parameter values evaluated in Python?**
Default parameter expressions are evaluated once at definition time—when the `def` statement is executed by the interpreter. The evaluated objects are stored in the function's `__defaults__` tuple (for positional/keyword parameters) and `__kwdefaults__` dictionary (for keyword-only parameters). They are not re-evaluated during subsequent function calls.

**★ Q: What is the "mutable default argument" trap, and how do you fix it?**
If a default argument is a mutable object (such as a `list`, `dict`, or `set`), all calls that do not provide an explicit argument share the exact same object reference stored in `__defaults__`. If the function mutates this object, the changes persist across subsequent calls. The fix is to set the default parameter to `None` and instantiate a fresh container inside the function body (`if param is None: param = []`).

**★ Q: How do you implement a default argument when `None` is a valid, distinct input value?**
Use the Sentinel Object pattern. Define a module-level private singleton `_SENTINEL = object()` and set it as the default argument value. Inside the function body, test whether the argument was supplied using identity: `if arg is _SENTINEL`. Because `object()` produces a unique memory address, no caller can accidentally pass the sentinel unless they intentionally imported it.

**Q: Where are default argument values physically stored on a function object?**
Positional and positional-or-keyword defaults are stored as a tuple on `func.__defaults__`. Keyword-only defaults are stored as a mapping on `func.__kwdefaults__`. If no defaults exist, these attributes are `None`.

**Q: Why does `def record_event(name: str, timestamp=datetime.now())` log the same time on every call?**
Because `datetime.now()` is called only once when the module containing `record_event` is loaded and the `def` statement executes. The resulting `datetime` instance is frozen in `record_event.__defaults__`. Subsequent calls simply bind the parameter to that same pre-computed instance.

---

← [Topic index](README.md) · Next → [Variadic args and kwargs](02-variadic-args-and-kwargs.md)
