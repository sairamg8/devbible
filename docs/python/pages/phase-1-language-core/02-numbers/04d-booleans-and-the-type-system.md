---
title: "bool is assignable to int, so no annotation can say an integer but not a boolean — TypeIs is as close as it gets"
sidebar_label: "4d · Booleans and the type system"
sidebar_position: 43
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Python 3.14 library reference
> ([`typing`](https://docs.python.org/3.14/library/typing.html),
> [`bool()`](https://docs.python.org/3.14/library/functions.html#bool)),
> [PEP 647 — User-Defined Type Guards](https://peps.python.org/pep-0647/) and
> [PEP 742 — Narrowing types with `TypeIs`](https://peps.python.org/pep-0742/).
> Version spine: **Python 3.14.7**.

**The type system inherits the runtime's seam and adds one of its own. `bool` is
assignable to `int`, so `set_retries(True)` type-checks cleanly against `n: int` and
there is no way to annotate the exclusion — the type system has no negation. Going
the other way is worse than permissive, it is wrong: a function annotated `-> bool`
whose body returns `len(xs)`, or an `and`/`or` chain, returns an `int` or `None`, and
nothing enforces the annotation at runtime. What the type system *can* do is carry a
boolean's meaning rather than merely its shape — `Literal[True]` with `@overload`
types a function whose return type depends on a flag, and `TypeIs` (3.13) propagates
a runtime `isinstance` check to both branches where `TypeGuard` (3.10) narrows only
the true one.**

## Type checkers see the subclass too

`bool` is assignable to `int` in the type system, mirroring the runtime: a parameter
annotated `int` accepts a `bool` and no checker complains.

```python
def set_retries(n: int) -> None: ...
set_retries(True)          # no type error, and no runtime error either
```

The annotation cannot express "an integer but not a boolean" — there is no negation
in the type system. If the distinction matters, it has to be a runtime guard (the
`isinstance(n, bool) or not isinstance(n, int)` form from
[the identity traps](04b-bool-identity-traps.md)) plus a docstring saying why the
guard exists, or nobody will believe it later.

Going the other way is worse, because it type-checks *wrong* rather than merely
permissively:

```python
def has_items(xs) -> bool:
    return len(xs)              # returns int; the annotation lies
    # return len(xs) > 0        # or: return bool(xs)
```

Nothing enforces the annotation at runtime, so the lie survives until a caller writes
`result is True`, or the value is serialised to JSON where `3` and `true` are not
interchangeable. Any codebase that added annotations after the fact is worth grepping
for this shape — a `-> bool` whose body ends in a `len(...)`, a `.find(...)`, an
`and`/`or` chain returning an operand, or a `re.search(...)` returning a match object.

That last family is the sneakiest, because `and` and `or` return **an operand, not a
boolean**:

```python
def is_admin(user) -> bool:
    return user and user.role == "admin"    # returns None when user is None
```

The fix is `bool(user and user.role == "admin")`, or better, restructure so the
`None` case is explicit.

## `Literal[True]` and overloads

`Literal` narrows a parameter to one constant — the docs describe it as indicating
*"that the annotated object has a value equivalent to one of the provided
literals."* Paired with `@overload`, it is how you type a function whose *return
type* depends on a flag:

```python
from typing import Literal, overload

@overload
def read(path: str, *, raw: Literal[False] = ...) -> str: ...
@overload
def read(path: str, *, raw: Literal[True]) -> bytes: ...
def read(path: str, *, raw: bool = False) -> str | bytes:
    ...
```

The implementation signature takes plain `bool` and is not itself an overload;
callers see only the two typed forms. Without this, the return type is `str | bytes`
at every call site and every caller needs a cast.

This is also the honest answer to "should this function take a boolean at all?".
Two overloads keyed on a literal is a sign the function is doing two jobs; often the
better refactor is two functions with names. The rule of thumb: a boolean parameter
that changes the *return type* is a smell, one that changes *behaviour* is usually
fine, and one that is passed positionally at a call site — `read(path, True)` — is
always worth making keyword-only.

## `TypeGuard` and `TypeIs`: functions that return a narrowing `bool`

A predicate that returns a plain `bool` tells the checker nothing about its argument.
Two annotations fix that, and they differ in one important way.

`TypeGuard` (3.10, PEP 647):

> *"Using `-> TypeGuard` tells the static type checker that for a given function:
> 1. The return value is a boolean. 2. If the return value is `True`, the type of its
> argument is the type inside `TypeGuard`."*

`TypeIs` (3.13, PEP 742) adds the negative case, which is what you almost always
want:

> *"When a `TypeGuard` function returns `False`, type checkers cannot narrow the type
> of the variable at all. When a `TypeIs` function returns `False`, type checkers can
> narrow the type of the variable to exclude the `TypeIs` type."*

and it narrows more precisely on the positive side too — *"type checkers can infer a
more precise type combining the previously known type of the variable with the
`TypeIs` type"*, where `TypeGuard` narrows *"to exactly the `TypeGuard` type."*
The trade-off the docs name: *"`TypeIs` requires the narrowed type to be a subtype
of the input type, while `TypeGuard` does not"* — so `TypeGuard` is the one to reach
for when the narrowed type is not a subtype, such as narrowing `object` to a
`TypedDict`.

```python
from typing import TypeIs

def is_int_not_bool(x: object) -> TypeIs[int]:
    return isinstance(x, int) and not isinstance(x, bool)
```

That is as close as the type system gets to "an `int` that is not a `bool`": the
runtime check is still doing the work, but the checker now propagates the result on
both branches. On 3.10–3.12, `TypeGuard` is the fallback and the `else` branch stays
un-narrowed. Both are re-exported by `typing_extensions` for older runtimes.

## Gotchas

### A function annotated `-> bool` returns an `int`

**Symptom.** `has_items(xs) is True` is `False` even for a non-empty list.
**Cause.** `return len(xs)` returns a count; annotations are not enforced at runtime.
**Fix.** `return len(xs) > 0`, or `return bool(xs)`. A type checker catches it;
nothing at runtime does.

### A `-> bool` function returns `None`

**Symptom.** A JSON payload contains `null` where a boolean was promised.
**Cause.** `and` and `or` return an *operand*, not a boolean — `user and
user.role == "admin"` is `None` when `user` is `None`.
**Fix.** Wrap in `bool(...)`, or restructure so the `None` case is handled
explicitly.

### `set_retries(True)` type-checks cleanly

**Symptom.** A checker passes code that a runtime guard then rejects.
**Cause.** `bool` is assignable to `int`; the type system has no way to say "not a
`bool`".
**Fix.** Keep the runtime guard, document it, and expose the intent to the checker
with a `TypeIs[int]` predicate if the check is used in more than one place.

### A predicate narrows on the `True` branch but not the `False` branch

**Symptom.** The `else` branch still sees the wide type and the checker complains.
**Cause.** `TypeGuard` narrows only on `True`, by design.
**Fix.** Use `TypeIs` (3.13+) when the narrowed type is a subtype of the input type.
Keep `TypeGuard` when it is not — narrowing `object` to a `TypedDict`, for example.

### `read(path, True)` at a call site

**Symptom.** Nobody can tell what the `True` means without opening the function.
**Cause.** A positional boolean parameter.
**Fix.** Make it keyword-only with `*`. If it also changes the return type, consider
two named functions instead of one function with two overloads.

## Interview questions

**Can a type checker express "an `int` that is not a `bool`"?**
Not as an annotation — `bool` is assignable to `int` and the type system has no
negation. The distinction must be a runtime check. Since 3.13 you can *propagate* it
to the checker by writing that check as a `TypeIs[int]` predicate, but the runtime
guard is still what does the work.

**What is wrong with `def has_items(xs) -> bool: return len(xs)`?**
It returns an `int`. The annotation is unenforced at runtime, so the lie survives
until a caller does `result is True` or serialises the value, where `3` and `true`
are not interchangeable. `return len(xs) > 0` or `return bool(xs)`.

**Why can a `-> bool` function return `None`?**
Because `and` and `or` evaluate to one of their operands rather than to a boolean.
`user and user.role == "admin"` is `None` when `user` is `None`. Wrap in `bool()`,
or handle the `None` case explicitly.

**How do you type a function whose return type depends on a boolean argument?**
`@overload` with `Literal[True]` and `Literal[False]` parameter types, one overload
per return type, and a single implementation signature annotated plain `bool`. It is
also a prompt to ask whether the function should be two functions.

**What is the difference between `TypeGuard` and `TypeIs`?**
Both tell the checker that a function returns a narrowing boolean. `TypeGuard`
(3.10, PEP 647) narrows only when the function returns `True`; on `False` the
checker *"cannot narrow the type of the variable at all."* `TypeIs` (3.13, PEP 742)
narrows on both branches and, on the positive branch, intersects with the previously
known type rather than replacing it. `TypeIs` requires the narrowed type to be a
subtype of the input type; `TypeGuard` does not, which is why `TypeGuard` remains
the tool for narrowing `object` to a `TypedDict`.

---

← Prev: [is True and == True](04c-is-true-and-the-type-system.md) · Index: [Numbers](README.md) · Next → [Booleans at a boundary](04e-booleans-at-a-boundary.md)
