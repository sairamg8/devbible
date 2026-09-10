---
title: "An annotation is a promise to a type checker and nothing more — `isinstance` refuses a parameterised tuple, JSON never hands you a tuple at all, and a bare string satisfies `Sequence[str]`"
sidebar_label: "7d · Checking tuples at runtime"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 library reference —
> [Generic Alias Type](https://docs.python.org/3.14/library/stdtypes.html#types-genericalias),
> the [`json` conversion tables](https://docs.python.org/3.14/library/json.html#py-to-json-table)
> and the [glossary entry for *sequence*](https://docs.python.org/3.14/glossary.html#term-sequence);
> and the language reference on
> [Sequence Patterns](https://docs.python.org/3.14/reference/compound_stmts.html#sequence-patterns).
> Documentation-verified — **no sandbox run**, no type checker run. Version spine: **CPython 3.14**.

**`def f() -> tuple[str, int]` is a sentence addressed to a type checker; the interpreter
stores it and moves on. That is fine inside a codebase the checker sees end to end, and it
is exactly wrong at the edges — a request body, a message from a queue, a plugin's return
value — where the data was built by something the checker never read. At those edges three
facts matter: the runtime enforces no annotation, `isinstance` rejects a parameterised
tuple type outright, and a JSON decoder turns every array into a `list`, so a shape check
written as "is it a tuple" fails on every well-formed input. The other face of the same gap
is on the way *in*: the most common parameter annotation for "some strings", `Sequence[str]`,
accepts a single string.**

## The runtime checks none of it

> *"The Python runtime does not enforce type annotations. This extends to generic types and
> their type parameters. When creating a container object from a `GenericAlias`, the
> elements in the container are not checked against their type."* —
> [Generic Alias Type](https://docs.python.org/3.14/library/stdtypes.html#types-genericalias)

`def f() -> tuple[str, int]` can return `("a", "b", "c")` and the interpreter will not
object. And the obvious runtime check is rejected outright:

> *"The builtin functions `isinstance` and `issubclass` do not accept `GenericAlias`
> types for their second argument"*

— the documentation's own example raises `TypeError: isinstance() argument 2 cannot be a
parameterized generic`. A runtime shape check is written by hand:

```python
def require_pair(value: object) -> tuple[str, int]:
    if (
        isinstance(value, tuple)
        and len(value) == 2
        and isinstance(value[0], str)
        and isinstance(value[1], int)
    ):
        return value
    raise TypeError(f"expected (str, int), got {value!r}")
```

Or with a `match`, which does the length and the element types in one pattern:

```python
match value:
    case (str() as host, int() as port):
        connect(host, port)
    case _:
        raise TypeError(f"expected (str, int), got {value!r}")
```

⚠️ That pattern also matches a two-element *list* — a sequence pattern accepts any
sequence ([6d](06d-stars-beyond-assignment.md)). Put `tuple(...)` around it when the type
itself matters.

## `tuple[str, ...]` versus `Sequence[str]` for a parameter

A parameter typed `Sequence[str]` accepts lists and tuples alike, which is usually what a
function that only reads its argument should accept. It has one hole, and it is the
`("abc")` bug from [5c](05c-when-a-library-requires-the-tuple.md) in type form: `str` is
itself a sequence — the glossary lists *"list, str, tuple, and bytes"* among the built-in
sequence types — and iterating it yields strings, so a bare string satisfies
`Sequence[str]`:

```python
from collections.abc import Sequence

def grant(user_id: int, scopes: Sequence[str]) -> None:
    for scope in scopes:
        store.add(user_id, scope)

grant(42, "admin")            # type-checks; grants "a", "d", "m", "i", "n"
```

`tuple[str, ...]` closes that hole — a `str` is not a `tuple` — at the price of making list
callers convert. It is also the right annotation when the argument will be *stored* or
*hashed*: a cache key, a set member, a frozen record's field.

```python
def grant(user_id: int, scopes: tuple[str, ...]) -> None:
    for scope in scopes:
        store.add(user_id, scope)

grant(42, ("admin",))         # the 1-tuple needs its comma
grant(42, "admin")            # rejected by the type checker
```

## JSON never gives you a tuple

The encoder accepts tuples and the decoder never produces them. The `json` module's two
conversion tables, side by side:

| Python → JSON | | JSON → Python | |
|---|---|---|---|
| `list, tuple` | array | array | `list` |

— from [`json`](https://docs.python.org/3.14/library/json.html#py-to-json-table). A tuple
written to JSON comes back as a list, so everything tuple-specific is lost in the round trip:
hashability, immutability, and equality with the original, because a list never compares
equal to a tuple ([9](09-comparison-and-ordering.md)). A runtime check at a JSON boundary
therefore validates a *list* and converts it:

```python
import json

def parse_endpoint(body: bytes) -> tuple[str, int]:
    value = json.loads(body)["endpoint"]
    if (
        isinstance(value, list)
        and len(value) == 2
        and isinstance(value[0], str)
        and isinstance(value[1], int)
    ):
        return value[0], value[1]              # rebuild as the tuple you promised
    raise ValueError(f"endpoint must be [host, port], got {value!r}")
```

The same applies to anything else that serialises through JSON — an HTTP cache, a task
queue's payload, a Redis value — and to a composite dict key, which JSON cannot represent at
all ([4](04-tuples-as-keys.md)).

## Gotchas

**★ Symptom: `TypeError: isinstance() argument 2 cannot be a parameterized generic`.**
Cause: `isinstance(x, tuple[str, int])` — the builtins do not accept a `GenericAlias`, as
the documentation states. Fix: check the origin type and the shape by hand, or use a `match`
class pattern.

```python
if isinstance(x, tuple) and len(x) == 2 and isinstance(x[0], str):
    host, port = x
```

**★ Symptom: a function annotated `-> tuple[str, int]` returned three items and nothing
complained until a caller's unpack failed.** Cause: the runtime does not enforce annotations,
and the function body was never type-checked (untyped call, `Any` flowing in, or no checker in
CI). Fix: run the checker in CI over the module, and keep the annotation specific so it has
something to check.

```python
def endpoint(raw: str) -> tuple[str, int]:
    host, _, port = raw.rpartition(":")
    return host, int(port)
```

**Symptom: `grant(42, "admin")` granted five one-letter scopes.** Cause: `str` is a sequence
of strings, so it satisfies `Sequence[str]` — the type checker had no objection. Fix:
annotate the parameter `tuple[str, ...]` (or reject a bare `str` at runtime).

```python
def grant(user_id: int, scopes: tuple[str, ...]) -> None:
    if isinstance(scopes, str):
        raise TypeError("scopes must be a tuple of strings, not a single string")
    for scope in scopes:
        store.add(user_id, scope)
```

**★ Symptom: a shape check that works in unit tests rejects every real request.** Cause: the
tests passed tuples; production data arrives through `json.loads`, which the documentation's
table shows decoding every array to `list`. Fix: validate the decoded list, then rebuild the
tuple.

```python
value = payload["endpoint"]
if isinstance(value, list) and len(value) == 2:
    endpoint = (str(value[0]), int(value[1]))
```

**Symptom: a set of tuples reloaded from a JSON file raises `TypeError: unhashable type:
'list'` when rebuilt.** Cause: the tuples were written as arrays and came back as lists. Fix:
convert each element on the way in.

```python
with open(path) as fh:
    seen = {tuple(pair) for pair in json.load(fh)}
```

## Interview questions

**★ Does annotating a function `-> tuple[str, int]` make Python check the return value?**
No. The documentation is explicit that *"the Python runtime does not enforce type
annotations"*, including the parameters of generic types. The annotation is consumed by a type
checker, an IDE and documentation tools; at runtime it is stored and otherwise ignored. If a
boundary genuinely needs a runtime check — untrusted input, a plugin's return value — you write
it with `isinstance` on the unparameterised type plus `len`, or a `match` pattern.

**Why might you choose `tuple[str, ...]` over `Sequence[str]` for a parameter?**
Two reasons. First, a `str` is a `Sequence[str]`, so `Sequence[str]` silently accepts a single
string where a collection of strings was meant; `tuple[str, ...]` rejects it. Second, if the
function stores the argument, uses it as a dict key or caches on it, a tuple guarantees it is
immutable and hashable where a `Sequence` might be a list. The cost is that list-holding callers
must convert, so for a read-only parameter that is not at risk of the string mistake,
`Sequence[str]` remains the more accommodating choice.

**★ Why does `loaded == original` fail after a JSON round trip of a tuple?**
Because the decoder returns a `list` — the `json` documentation maps `list, tuple` to a JSON
array on the way out and array to `list` on the way in — and a list never compares equal to a
tuple, whatever their contents. The reference is explicit that equality between built-in
sequences requires the same type (`[1,2] == (1,2)` is false). The fix is to convert at the
boundary, where you also validate: `tuple(loaded)` once the length and element types have been
checked.

**Where should runtime shape checks for tuples live?**
At trust boundaries only — request parsing, deserialisation, plugin and callback results —
where the value was produced by code the type checker did not see. Inside the typed core,
repeating `isinstance` and `len` checks duplicates what the checker already proved and adds
noise. The pattern is to parse once rather than re-validate everywhere: convert untrusted input into a precisely
typed value (a tuple, or better a named record) at the edge, and let the annotations carry
it from there.


---

← [Annotating tuples](07c-annotating-tuples.md) · [Topic index](README.md) · Next → [namedtuple](08-named-records.md)
