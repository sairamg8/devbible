---
title: "`tuple[int]` is a tuple of exactly one int, `tuple[int, ...]` is any number of them, and the runtime checks neither — the typing system special-cases tuples because they are records, and every annotation mistake comes from forgetting that"
sidebar_label: "7c · Annotating tuples"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 `typing` documentation —
> [Annotating tuples](https://docs.python.org/3.14/library/typing.html#annotating-tuples);
> and the typing specification chapters on
> [Tuples](https://typing.python.org/en/latest/spec/tuples.html) and
> [Named tuples](https://typing.python.org/en/latest/spec/namedtuples.html).
> Documentation-verified — **no sandbox run**, no type checker run. Version spine: **CPython 3.14**.

**Every other built-in container takes one type argument per *role* — `list[int]`,
`dict[str, int]` — because every element plays the same role. A tuple takes one type
argument per *position*, because the typing system accepts the record convention from
[7](07-multiple-return-values.md) as the normal case. That single decision produces the one
annotation mistake everybody makes once: `tuple[int]` does not mean "a tuple of ints", it
means "a tuple containing exactly one int". The homogeneous, any-length form needs an
ellipsis. And none of it is checked when the program runs — an annotation is a statement to
a type checker, and `isinstance` refuses to even look at a parameterised tuple type.**

## Why tuples are special-cased

> *"For most containers in Python, the typing system assumes that all elements in the
> container will be of the same type."*

> *"Unlike most other Python containers, however, it is common in idiomatic Python code for
> tuples to have elements which are not all of the same type. For this reason, tuples are
> special-cased in Python's typing system. `tuple` accepts *any number* of type
> arguments"* —
> [Annotating tuples](https://docs.python.org/3.14/library/typing.html#annotating-tuples)

The typing specification states the same fact from the runtime side, and names why it is
safe:

> *"The most obvious difference is that `tuple` is variadic -- it supports an arbitrary
> number of type arguments. At runtime, the sequence of objects contained within the tuple is
> fixed at the time of construction."* —
> [Typing spec — Tuples](https://typing.python.org/en/latest/spec/tuples.html)

A list's length can change after a checker has looked at it, so a per-position type for a
list would be a lie by the next `append`. A tuple's cannot, so a per-position type stays true.

## The five forms

| Annotation | Means | Example value |
|---|---|---|
| `tuple[int]` | exactly one `int` | `(5,)` |
| `tuple[int, str]` | an `int` then a `str`, length 2 | `(5, "foo")` |
| `tuple[int, ...]` | any number of `int`s, including none | `()`, `(1, 2, 3)` |
| `tuple[()]` | the empty tuple and nothing else | `()` |
| `tuple` (bare) | `tuple[Any, ...]` — no information | anything |

The documentation's own examples, verbatim:

```python
# OK: ``x`` is assigned to a tuple of length 1 where the sole element is an int
x: tuple[int] = (5,)

# OK: ``y`` is assigned to a tuple of length 2;
# element 1 is an int, element 2 is a str
y: tuple[int, str] = (5, "foo")

# Error: the type annotation indicates a tuple of length 1,
# but ``z`` has been assigned to a tuple of length 3
z: tuple[int] = (1, 2, 3)
```

> *"To denote a tuple which could be of *any* length, and in which all elements are of the
> same type `T`, use the literal ellipsis `...`: `tuple[T, ...]`. To denote an empty
> tuple, use `tuple[()]`. Using plain `tuple` as an annotation is equivalent to using
> `tuple[Any, ...]`."*

The ellipsis form is rigid. The specification allows exactly one type before it:

> *"Arbitrary-length tuples have exactly two type arguments -- the type and an ellipsis. Any
> other tuple form that uses an ellipsis is invalid"* — `tuple[int, int, ...]` is listed as
> invalid.

"At least one int" is therefore not `tuple[int, int, ...]`. Since 3.11 it is written with an
unpacked unbounded tuple: `tuple[int, *tuple[int, ...]]`. The specification's example of the
general form is *"`tuple[int, *tuple[str, ...], str]` -- a tuple type where the first element
is guaranteed to be of type `int`, the last element is guaranteed to be of type `str`, and
the elements in the middle are zero or more elements of type `str`"* — a header, a body and
a footer, which is `header, *body, footer = row` from [6c](06c-starred-unpacking.md) as a type.

## What the checker gets from this

Because the length is fixed at construction, checkers may narrow on it:

> *"The length of a tuple at runtime is immutable, so it is safe for type checkers to use
> length checks to narrow the type of a tuple"*

```python
def describe(version: tuple[int, int] | tuple[int, int, int]) -> str:
    if len(version) == 3:
        major, minor, patch = version          # narrowed to tuple[int, int, int]
        return f"{major}.{minor}.{patch}"
    major, minor = version                      # narrowed to tuple[int, int]
    return f"{major}.{minor}"
```

And because the contents cannot be replaced, element types are covariant — *"`tuple[bool,
int]` is a subtype of `tuple[int, object]`"* — which is why a function taking `tuple[float,
...]` accepts a tuple of ints, where a `list[float]` parameter would reject a `list[int]`.

Named tuples slot into the same rules:

> *"A named tuple is assignable to a `tuple` with a known length and parameterized by types
> corresponding to the named tuple's individual field types"* —
> [Typing spec — Named tuples](https://typing.python.org/en/latest/spec/namedtuples.html)

So changing a return type from `tuple[float, float]` to a `LatLon` named tuple is invisible
to callers that annotate the result as the plain tuple — the upgrade path
[8b](08b-typing-namedtuple.md) relies on.

Everything on this page happens in a type checker. What the interpreter does with these
annotations when the program runs — nothing — and how to check a tuple's shape at a real
trust boundary is [7d · Checking tuples at runtime](07d-checking-tuples-at-runtime.md).

## Gotchas

**★ Symptom: the type checker rejects `(1, 2, 3)` for a parameter annotated `tuple[int]`.**
Cause: `tuple[int]` is a length-1 tuple — the documentation's own example marks
`z: tuple[int] = (1, 2, 3)` as an error. Fix: the homogeneous form needs the ellipsis.

```python
def total(values: tuple[int, ...]) -> int:
    return sum(values)
```

**Symptom: the checker reports `tuple[int, int, ...]` as invalid.** Cause: the ellipsis form
takes exactly one type — the specification lists this spelling among the invalid ones. Fix:
express "at least one" with an unpacked unbounded tuple (3.11+).

```python
def at_least_one(values: tuple[int, *tuple[int, ...]]) -> int:
    first, *rest = values
    return first + sum(rest)
```

**Symptom: a bare `-> tuple` annotation let every caller unpack the result any way it
liked.** Cause: plain `tuple` is `tuple[Any, ...]`, which the specification calls consistent
with every tuple type — it carries no length and no element types. Fix: write the shape.

```python
def split_version(v: str) -> tuple[int, int, int]:
    major, minor, patch = v.split(".")
    return int(major), int(minor), int(patch)
```

**★ Symptom: the checker says every call `record_ids(1, 2, 3)` passes `int` where
`tuple[int, ...]` is expected.** Cause: the signature was written `def record_ids(*ids:
tuple[int, ...])`. An annotation on `*args` describes **each** positional argument, not the tuple
that collects them — the collected `ids` is already a tuple. Fix: annotate the element type; use
the unpacked form only when the positions differ.

```python
def record_ids(*ids: int) -> None:          # ids is tuple[int, ...]
    for record_id in ids:
        index.add(record_id)

def emit(*fields: *tuple[str, int]) -> None:  # exactly a str then an int (3.11+)
    name, count = fields
    log(name, count)
```

## Interview questions

**★ What is the difference between `tuple[int]`, `tuple[int, ...]` and `list[int]`?**
`tuple[int]` is a tuple of exactly one `int`. `tuple[int, ...]` is a tuple of any length —
including zero — whose elements are all `int`. `list[int]` is a list of any length of `int`s,
and `list` accepts only one type argument because a list's length is not part of its type. The
tuple forms differ because the typing system special-cases tuples as records: one argument per
position, and the ellipsis is the explicit opt-in to the homogeneous, list-like reading.

**Why can a tuple's element types be covariant when a list's cannot?**
Because nothing can write into a tuple. If `list[bool]` were a subtype of `list[int]`, a
function holding it as `list[int]` could append `7` and break every holder of the `list[bool]`.
A tuple has no write operations, so treating `tuple[bool, int]` as a `tuple[int, object]` can
never let a wrong value in — which is the reasoning the specification gives: *"Because tuple
contents are immutable, the element types of a tuple are covariant."*

**How do you annotate a tuple with a fixed first element and a variable-length tail?**
With an unpacked unbounded tuple inside the type arguments, available since 3.11:
`tuple[str, *tuple[int, ...]]` is a `str` followed by zero or more `int`s. The obvious-looking
`tuple[str, int, ...]` is invalid — the ellipsis form takes exactly one type. Only one
unbounded part is allowed per tuple type, which mirrors the one-star rule for unpacking targets.

**How do you annotate `*args`?**
With the type of one argument: `def f(*ids: int)` makes `ids` a `tuple[int, ...]` inside the
function. Writing `*ids: tuple[int, ...]` declares that every positional argument is itself a
tuple of ints, which is almost never meant. When the positional arguments have fixed, different
types, the typing specification allows an unpacked tuple — `def f(*args: *tuple[int, str])` —
available with the `*` syntax from 3.11.

**Can a type checker use `len()` to narrow a union of tuple types?**
Yes, and the specification permits it precisely because the length is fixed at construction:
*"The length of a tuple at runtime is immutable, so it is safe for type checkers to use length
checks to narrow the type of a tuple."* A `tuple[int, int] | tuple[int, int, int]` narrows to
the three-element form under `if len(v) == 3:`. The same reasoning applies to sequence patterns
in `match`. Nothing equivalent is safe for a list, whose length can change between the check
and the use.

---

← [Absence, errors and shared results](07b-absence-and-shared-results.md) · [Topic index](README.md) · Next → [Checking tuples at runtime](07d-checking-tuples-at-runtime.md)
