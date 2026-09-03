---
title: "Variadic parameters: *args collects positional arguments, **kwargs collects keyword mappings"
sidebar_label: "02 · Variadic args and kwargs"
sidebar_position: 21
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§8.6 Function definitions, §6.3.4 Calls),
> PEP 448 (Additional Unpacking Generalizations), PEP 692 (Using TypedDict for more precise **kwargs typing).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**The `*args` and `**kwargs` parameters allow a function to accept an arbitrary number of positional and keyword arguments. Inside the function body, `args` is bound to an immutable `tuple` and `kwargs` is bound to a standard `dict`. While indispensable for universal forwarding in decorators and proxy objects, overuse of `**kwargs` in application services degrades developer ergonomics: it disables IDE autocomplete, blinds static type checkers, conceals spelling mistakes in call arguments, and incurs runtime tuple and dictionary allocation overhead on every invocation.**

## The collection mechanism

The Language Reference defines how excess arguments are gathered:

> *"If the form “`*identifier`” is present, it is initialized to a tuple receiving any excess positional parameters, defaulting to the empty tuple. If the form “`**identifier`” is present, it is initialized to a new ordered mapping receiving any excess keyword arguments, defaulting to a new empty mapping of the same type."*

Inside the function body:
- `args` is an instance of `tuple`.
- `kwargs` is an instance of `dict` (preserving insertion order).

```python
def inspect_call(*args: int, **kwargs: str) -> None:
    print(f"args type: {type(args)}, value: {args}")
    print(f"kwargs type: {type(kwargs)}, value: {kwargs}")

inspect_call(1, 2, 3, env="prod", region="us-east")
# args type: <class 'tuple'>, value: (1, 2, 3)
# kwargs type: <class 'dict'>, value: {'env': 'prod', 'region': 'us-east'}
```

Notice that type annotations on `*args` and `**kwargs` apply to the individual elements: `*args: int` specifies that every positional argument must be an `int`, not that `args` is a tuple.

## Argument forwarding and proxying

The primary valid use case for `*args, **kwargs` is universal forwarding, where an intermediary wrapper intercepts or measures an invocation without coupling to the callee's specific signature:

```python
from typing import Callable, Any
import time

def log_execution(func: Callable[..., Any]) -> Callable[..., Any]:
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        start = time.perf_counter()
        try:
            return func(*args, **kwargs)
        finally:
            elapsed = time.perf_counter() - start
            print(f"{func.__name__} executed in {elapsed:.4f}s")
    return wrapper
```

When invoking `func(*args, **kwargs)`, the `*` unpacks the tuple into positional arguments and `**` unpacks the dictionary into keyword arguments.

## Call-site unpacking and PEP 448 asymmetry

PEP 448 allows multiple starred expressions in a single function call:

```python
prefix = [1, 2]
suffix = [5, 6]
middle = (3, 4)

# Multiple iterable unpackings in a single call
process_numbers(*prefix, *middle, *suffix)
```

However, there is a critical asymmetry between dictionary literal merging and function call unpacking:

```python
d1 = {"a": 1, "timeout": 30}
d2 = {"timeout": 60, "b": 2}

# Dictionary literal merge: later key wins without error
merged = {**d1, **d2}
print(merged["timeout"])  # 60

# Function call: DUPLICATE KEY RAISES TYPEERROR!
def connect(a: int, b: int, timeout: int) -> None:
    pass

# connect(**d1, **d2)
# Raises: TypeError: connect() got multiple values for keyword argument 'timeout'
```

In a dictionary display `{**d1, **d2}`, duplicate keys are permitted and the rightmost value overwrites the earlier one. In a function call `f(**d1, **d2)`, Python enforces keyword uniqueness; passing duplicate keys across unpacked mappings raises an immediate `TypeError`.

## The architectural dangers of `**kwargs` abuse

Accepting `**kwargs` as a substitute for explicit parameters in application services creates serious maintenance problems:

1. **Silent typo bugs:**
   ```python
   def fetch_records(query: str, **kwargs):
       timeout = kwargs.get("timeout", 10)
       ...

   # The caller makes a typo: "timeuot=30"
   fetch_records("SELECT 1", timeuot=30)
   # Python silently absorbs "timeuot" into kwargs; timeout defaults to 10!
   ```
2. **Loss of IDE discovery:** Callers cannot see available arguments, defaults, or docstrings without reading internal implementation source code.
3. **Allocation cost:** Every invocation allocates a fresh `dict` for `kwargs` and a `tuple` for `args`. In high-throughput numeric or network loops, this allocation adds noticeable GC pressure.

### Modern solution: PEP 692 `TypedDict` unpacking

In Python 3.12+, PEP 692 allows typing `**kwargs` with a `TypedDict` via `typing.Unpack`:

```python
from typing import TypedDict, Unpack

class ConnectionOptions(TypedDict, total=False):
    timeout: int
    retries: int
    ssl_verify: bool

def establish_connection(
    host: str,
    **options: Unpack[ConnectionOptions],
) -> None:
    # Static type checkers enforce that only 'timeout', 'retries', and 'ssl_verify'
    # can be passed, catching typos at type-check time!
    ...
```

## Gotchas

### Forgetting the star when forwarding
**Symptom.** A wrapped function receives a tuple as its first argument and fails with `TypeError: func() missing required positional arguments` or `TypeError: expected int, got tuple`.
**Cause.** Passing `args` instead of `*args` passes the entire tuple as a single positional argument rather than unpacking its items.
**Fix.** Always include the star prefix when forwarding variadic arguments:

```python
# BROKEN: passes tuple as first argument, kwargs as second
def wrapper(*args, **kwargs):
    return target(args, kwargs)

# FIXED: unpacks into individual arguments
def wrapper(*args, **kwargs):
    return target(*args, **kwargs)
```

### Unpacking non-string keys in `**kwargs`
**Symptom.** Calling `func(**data)` fails with `TypeError: func() keywords must be strings`.
**Cause.** The dictionary unpacked via `**` contains integer or object keys. Python requires all keyword argument names to be strings.
**Fix.** Ensure mapping keys are strings before unpacking:

```python
# BROKEN: integer keys cannot be keyword arguments
data = {1: "one", 2: "two"}
# func(**data)  # TypeError: keywords must be strings

# FIXED: convert keys to strings or pass mapping directly
str_data = {f"k{k}": v for k, v in data.items()}
func(**str_data)
```

### Inadvertently mutating `kwargs`
**Symptom.** Mutating `kwargs` inside a decorator alters values before they reach inner interceptors or handlers.
**Cause.** `kwargs` is a mutable dictionary. Modifying it via `kwargs.pop("auth")` mutates the dictionary in place.
**Fix.** If you need to strip arguments, do so deliberately and document the contract, or forward a copy:

```python
def auth_required(func):
    def wrapper(*args, **kwargs):
        # Extract auth token intended only for the decorator
        token = kwargs.pop("auth_token", None)
        if not token:
            raise PermissionError("Missing auth token")
        return func(*args, **kwargs)  # inner func never sees auth_token
    return wrapper
```

### Overwriting positional arguments via `**kwargs`
**Symptom.** A function raises `TypeError: func() got multiple values for argument 'x'`.
**Cause.** A positional parameter was supplied both by position and inside `**kwargs`.
**Fix.** Ensure callers do not duplicate positional arguments in unpacked dictionaries:

```python
def save_user(user_id: int, name: str, **metadata):
    pass

payload = {"user_id": 101, "name": "Alice", "role": "admin"}

# BROKEN: user_id is passed positionally AND inside payload
# save_user(101, **payload)  # TypeError: got multiple values for argument 'user_id'

# FIXED: pass all via unpacking, or strip the duplicate
save_user(**payload)
```

## Interview questions

**★ Q: What data types are `args` and `kwargs` inside a function body?**
Inside the function, `args` is always an immutable `tuple` containing excess positional arguments, and `kwargs` is always a mutable `dict` containing excess keyword arguments with string keys (preserving call-site insertion order). If no arguments were supplied, they are bound to empty `()` and `{}` respectively.

**★ Q: What happens if a function call unpacks two dictionaries containing identical keys via `f(**d1, **d2)`?**
Python raises `TypeError: f() got multiple values for keyword argument '<key>'`. While dictionary displays like `{**d1, **d2}` allow duplicate keys (with the rightmost value overriding earlier ones), function calls strictly forbid duplicate keyword arguments across unpackings to prevent silent parameter ambiguity.

**★ Q: Why is relying on `**kwargs` considered an architectural smell in public application services?**
Accepting generic `**kwargs` eliminates API discoverability: IDE autocomplete cannot suggest parameters, static type checkers cannot validate types or mandatory keys, and typos (such as `timeuot=10`) are silently ignored by default fallbacks (`kwargs.get('timeout', 30)`). Furthermore, allocating tuples and dictionaries on every call introduces runtime GC overhead. Parameters should be explicit, with `**kwargs` reserved for proxying and decorators.

**Q: How does PEP 692 improve type safety for functions that accept `**kwargs`?**
PEP 692 introduces `typing.Unpack` used in conjunction with a `TypedDict`. By typing `**kwargs: Unpack[MyOptions]`, static type checkers can validate that callers only pass keys defined in `MyOptions` with their correct respective types, combining the dynamic flexibility of keyword unpacking with full static type safety.

**Q: Can positional arguments appear after `*args` in a function signature?**
Yes, but they automatically become **keyword-only** parameters. Any parameter defined after `*args` (or after a bare `*`) cannot be satisfied by positional arguments and must be provided explicitly as a keyword argument by the caller.

---

← [Default values and the mutable trap](01-default-values-and-the-mutable-trap.md) · [Topic index](README.md) · Next → [Positional-only and keyword-only](03-positional-only-and-keyword-only.md)
