---
title: "The return statement: implicit None, tuple packing, and the finally override"
sidebar_label: "02 · Return values and None"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§7.6 The return statement, §8.6 Function definitions).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**Every Python function returns a value to its caller. If a `return` statement has an expression list, that expression is evaluated and returned; if `return` is bare, or if execution reaches the end of the function body without hitting a return, the function implicitly returns `None`. Because Python adheres to command-query separation, in-place mutating methods return `None`, making `items = items.sort()` one of the most common early regressions. Furthermore, returning comma-separated values packages them into an ordinary tuple, and executing a `return` inside a `finally` block unconditionally overrides any prior return value or active exception in `try`.**

## Return semantics and the implicit None

The Python Language Reference specifies the exact mechanics of exiting a function:

> *"If an expression list is present, it is evaluated, else `None` is substituted. `return` leaves the current function call with the expression list (or `None`) as return value."*

If control reaches the end of the function's suite without executing a `return`, `None` is returned automatically:

```python
def log_event(message: str) -> None:
    print(f"[LOG] {message}")
    # implicit return None

def check_status(code: int) -> str | None:
    if code == 200:
        return "OK"
    # missing else: implicitly returns None if code != 200
```

### Bare return vs explicit return None

A bare `return` exits immediately, equivalent in value to `return None`:

```python
def validate_token(token: str) -> None:
    if not token.startswith("Bearer "):
        return  # exits early, returns None
    process_auth(token)
```

In functions typed to return `None`, bare `return` signals early termination. In functions returning `T | None`, returning `None` explicitly (`return None`) communicates deliberate intent to readers and type checkers.

## Returning multiple values: tuple packing

Python does not have multi-value return registers. When a function returns multiple comma-separated items, Python packages them into a single `tuple`:

```python
def parse_coordinate(coord_str: str) -> tuple[float, float]:
    lat_str, lon_str = coord_str.split(",")
    return float(lat_str), float(lon_str)  # packages into a 2-tuple

# The caller unpacks the tuple
latitude, longitude = parse_coordinate("37.7749,-122.4194")
```

The syntax `return a, b` is shorthand for `return (a, b)`. If the caller captures the result in a single variable, that variable holds the tuple object `(a, b)`.

## Command-query separation: why mutating methods return None

In Python's standard library design, operations that mutate an object in place return `None` rather than the mutated instance (command-query separation):

```python
numbers = [3, 1, 4, 1, 5]

# WRONG: list.sort() mutates numbers and returns None
sorted_numbers = numbers.sort()
# sorted_numbers is now None, and numbers is modified

# CORRECT: sorted() returns a new list, leaving numbers untouched
clean_sorted = sorted(numbers)

# CORRECT: call sort() for in-place mutation, do not assign
numbers.sort()
```

The five deliberate exceptions in the standard library that mutate and return a value are `list.pop()`, `dict.pop()`, `dict.popitem()`, `set.pop()`, and `dict.setdefault()`.

## The `finally` override hazard

When control leaves a `try` block via `return`, any associated `finally` clause executes before the function exits:

> *"When `return` passes control out of a `try` statement with a `finally` clause, that `finally` clause is executed before really leaving the function."*

If the `finally` block itself executes a `return`, it overrides and completely discards any return value from `try`, or suppresses any unhandled exception raised inside `try`:

```python
def dangerous_finally() -> str:
    try:
        raise RuntimeError("Database connection lost")
    finally:
        return "all good"  # DISCARDS RuntimeError and returns "all good"!

def value_override() -> int:
    try:
        return 1
    finally:
        return 2  # The caller receives 2, not 1
```

A `finally` block should be used exclusively for cleanup (closing files, releasing locks, terminating connections), never for control flow or returns.

## Return in generator functions

In a generator function (any function containing `yield`), the `return` statement has different semantics:

> *"In a generator function, the `return` statement indicates that the generator is done and will cause `StopIteration` to be raised. The return value (if any) is used as an argument to construct `StopIteration` and becomes the `value` attribute of it."*

In Python 3.3+ (PEP 380), `return value` in a generator attaches `value` to the `StopIteration` exception, which is captured as the result of a `yield from` expression:

```python
def compute_subtotal():
    yield 10
    yield 20
    return 30  # StopIteration.value = 30

def compute_invoice():
    subtotal = yield from compute_subtotal()
    yield subtotal * 1.1

# Iterating compute_invoice yields 10, 20, 33.0
```

In an *asynchronous* generator, a non-empty `return value` is a `SyntaxError`; only bare `return` is permitted (raising `StopAsyncIteration`).

## Gotchas

### Assigning in-place mutation results
**Symptom.** A variable expected to hold a modified list or dictionary is `None`, causing `AttributeError: 'NoneType' object has no attribute ...` on subsequent operations.
**Cause.** Methods like `list.sort()`, `list.reverse()`, `list.append()`, and `dict.update()` mutate the instance in place and return `None`.
**Fix.** Do not assign the return value of in-place mutating methods:

```python
# BROKEN: data becomes None
data = ["banana", "apple", "cherry"]
data = data.sort()

# FIXED: either use sorted() or sort in place without reassigning
data = ["banana", "apple", "cherry"]
data.sort()  # data is sorted in place
```

### The unhandled branch returning None
**Symptom.** Intermittent `None` values propagate downstream through business logic, causing unexpected failures during edge-case execution.
**Cause.** A conditional `if/elif` structure omitted the fallback `else` branch, or an internal branch failed to execute a `return`.
**Fix.** Ensure every code branch terminates with an explicit return, or raise an exception on unsupported conditions:

```python
# BROKEN: returns None if user.role is neither admin nor member
def get_dashboard_url(role: str) -> str:
    if role == "admin":
        return "/admin/dashboard"
    elif role == "member":
        return "/home"

# FIXED: exhaustive branching or explicit error
def get_dashboard_url(role: str) -> str:
    if role == "admin":
        return "/admin/dashboard"
    elif role == "member":
        return "/home"
    raise ValueError(f"Unsupported user role: {role}")
```

### Swallowing exceptions with return inside finally
**Symptom.** Critical errors (database failures, validation errors) disappear completely without logging or alerting, producing corrupted data.
**Cause.** A `return` statement inside a `finally` block caught and discarded in-flight exceptions.
**Fix.** Remove `return` from `finally`. Perform only resource cleanup:

```python
# BROKEN: suppresses all errors raised in try
def query_record(cursor, record_id: int):
    try:
        return cursor.execute("SELECT * FROM records WHERE id = ?", (record_id,)).fetchone()
    finally:
        cursor.close()
        return None  # BUG: replaces fetchone() with None and swallows DB errors!

# FIXED: cleanup only in finally
def query_record(cursor, record_id: int):
    try:
        return cursor.execute("SELECT * FROM records WHERE id = ?", (record_id,)).fetchone()
    finally:
        cursor.close()
```

### Unparenthesized ternary in return tuple
**Symptom.** A function intended to return a pair `(status, value)` returns a single value under certain conditions.
**Cause.** Operator precedence parses `return a, b if cond else c` as `return (a, b) if cond else (c)`.
**Fix.** Always parenthesize ternary expressions in return statements:

```python
# BROKEN: parsed as `(success, value) if is_valid else fallback`
def parse_entry(raw: str, is_valid: bool, fallback: str):
    return "SUCCESS", raw if is_valid else fallback

# FIXED: explicit parentheses around the ternary expression
def parse_entry(raw: str, is_valid: bool, fallback: str):
    return "SUCCESS", (raw if is_valid else fallback)
```

## Interview questions

**★ Q: What does a Python function return if it does not execute a return statement?**
It returns `None`. When control reaches the end of the function body without encountering a `return`, Python executes an implicit `return None`. In type checkers, a function that never returns a value has return type `None`, whereas a function that returns a value on some paths but falls off on others has an inferred return type of `T | None`.

**★ Q: How does Python support returning multiple values from a function?**
Python returns multiple values by packing them into a single `tuple`. Writing `return a, b, c` creates a 3-tuple `(a, b, c)`. The caller can either capture the entire tuple in a single variable or use iterable unpacking `x, y, z = func()` to bind each element to a distinct variable.

**★ Q: What happens if a function executes a return statement inside a `finally` block?**
The `return` inside `finally` takes precedence over any other termination in the `try` or `except` blocks. If `try` executed `return 1` and `finally` executes `return 2`, the caller receives `2`. More dangerously, if an unhandled exception was raised inside `try`, a `return` in `finally` discards the exception entirely, silently continuing execution as if no error occurred.

**Q: Why do in-place mutating methods like `list.sort()` and `dict.update()` return `None`?**
This adheres to Bertrand Meyer's Command-Query Separation principle. Methods that modify internal state (commands) return `None` so that callers are not misled into thinking a new copy was created. Pure functions that compute and return a new object (queries), such as `sorted()` and `reversed()`, return the new instance and leave the original unchanged.

**Q: What is the semantic difference between `return` in a normal function vs a generator?**
In a normal function, `return x` delivers `x` directly to the caller. In a generator function, `return x` terminates the generator by raising a `StopIteration` exception with `x` stored in the `value` attribute of the exception object. In sub-generators invoked with `yield from`, the return value becomes the value of the `yield from` expression (`result = yield from sub_gen()`).

---

← [The def statement and first-class functions](01-def-statement-and-first-class-functions.md) · [Topic index](README.md) · Next → [Parameters in full](../02-parameters-in-full/README.md)
