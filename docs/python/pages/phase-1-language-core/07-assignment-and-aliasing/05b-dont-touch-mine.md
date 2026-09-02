---
title: "There are four ways to say \"do not modify this\" and only two of them are enforced, so pick deliberately rather than hoping the annotation means something"
sidebar_label: "5b · Saying \"don't touch mine\""
sidebar_position: 78
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14
> [`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html),
> [`typing`](https://docs.python.org/3.14/library/typing.html),
> [`types.MappingProxyType`](https://docs.python.org/3.14/library/types.html#types.MappingProxyType),
> [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html),
> and [PEP 705 — TypedDict: Read-only items](https://peps.python.org/pep-0705/).
> Target: **CPython 3.14**.

**Python will not stop a callee from mutating what you passed it. Your options
are to make mutation impossible (immutable types), to make it harmless (copy at
the boundary), to make it visible to a checker (`Sequence`/`Mapping`/`ReadOnly`
annotations, which the interpreter ignores entirely), or to make it detectable
(a test that deep-copies the input and asserts it is unchanged). The first two
are enforcement, the second two are discipline. Most codebases need one of each
and choose neither.**

## Option 1 — copy at the boundary (enforced, costs O(n))

```python
def process(rows: list[dict]) -> Report:
    rows = [dict(r) for r in rows]     # this function now owns its data
    ...
```

The rule that makes this affordable is **copy once, at one boundary, not in
every function**. Copying in every layer is how a request handler ends up
deep-copying a payload eleven times. The right boundary is usually where data
crosses from "not ours" to "ours": deserialisation, the outer edge of a
service, the constructor of a long-lived object, the point where you hand
something to a cache.

Choosing the copy depth is [Shallow copy](08-shallow-copy.md) and
[deepcopy](08b-deepcopy.md). The short version: shallow if the values are
scalars or immutable, deep if the values are containers you will write into.

## Option 2 — accept and return immutable types (enforced, costs a conversion)

```python
def process(rows: tuple[Row, ...]) -> Report: ...

class Order:
    def __init__(self, lines: Iterable[Line]):
        self._lines = tuple(lines)      # convert once; nobody can extend it
```

This is the strongest option, because the guarantee survives every future
refactor and every new caller. Its costs are a conversion at the boundary and
the inconvenience of building results — you cannot append to a tuple, so
internal working code still uses lists and freezes on the way out.

The building blocks: `tuple` for sequences, `frozenset` for sets, frozen
dataclasses and `NamedTuple` for records, and `MappingProxyType` — with the
caveat that a proxy is a *view*, not a frozen mapping. See
[Designing away aliasing](10-designing-away-aliasing.md).

## Option 3 — annotate with a read-only interface (NOT enforced)

`collections.abc` provides the vocabulary. The module's own description of its
purpose is telling:

> *"This module provides abstract base classes that can be used to test whether
> a class provides a particular interface; for example, whether it is hashable
> or whether it is a mapping."*

Test whether a class *provides* an interface. Not restrict it. The `Sequence`
ABC has abstract methods `__getitem__` and `__len__`, with mixins
`__contains__`, `__iter__`, `__reversed__`, `index` and `count`;
`MutableSequence` adds `__setitem__`, `__delitem__`, `insert`, `append`,
`clear`, `reverse`, `extend`, `pop`, `remove` and `__iadd__`. The same split
holds for `Mapping` versus `MutableMapping` (`__setitem__`, `__delitem__`,
`pop`, `popitem`, `clear`, `update`, `setdefault`).

```python
from collections.abc import Sequence

def process(rows: Sequence[Row]) -> Report:
    rows.append(x)     # a type checker flags this; the interpreter does not
```

At runtime, `rows` is whatever the caller passed — usually a `list`, which
*is* a `MutableSequence` and has every mutator. `isinstance(rows, Sequence)`
is `True` for a list, so you cannot even use an `isinstance` check to reject
mutable input. The annotation is a promise read by `mypy`, `pyright` and human
reviewers, and by nothing else.

That is still worth doing. It is precise about intent, it is checkable in CI,
and it widens the function's input domain (a tuple, a `range`, a custom
sequence all become legal callers). Just do not confuse it with a guarantee.

PEP 705's `typing.ReadOnly` (Final, 3.13) extends the same idea to `TypedDict`
items — *"used to indicate that an item declared in a TypedDict definition may
not be mutated (added, modified, or removed)"* — and is likewise a static
qualifier with no runtime effect.

## Option 4 — make it detectable (a test, not a type)

```python
def test_handler_does_not_mutate_payload():
    payload = load_fixture("order.json")
    before = copy.deepcopy(payload)
    handle(payload)
    assert payload == before
```

Three lines, and it converts an invisible class of bug into a red test. Put it
on the functions where accidental mutation would be expensive: request
handlers, validators, serialisers, anything called in a retry loop. For large
inputs, compare a hash of a canonical serialisation instead of a deep copy.

## Ownership as a documented convention

When copying is genuinely too expensive, the remaining tool is a contract, and
the contract has to be about *ownership*, not politeness:

```python
def consume(buffer: bytearray) -> Frame:
    """Parse a frame from *buffer*.

    Takes ownership of *buffer*: the parsed bytes are removed from it, so the
    caller must not use *buffer* afterwards except to pass it here again.
    """
```

Two things make that work: the docstring states it in the first line of the
body, and the function name (`consume`, `drain`, `take`, `into`) signals it.
The failure mode of ownership conventions is silence — a function that mutates
and says nothing.

## What Python does not give you

- **No `const`.** There is no way to mark a reference as non-mutating; the
  object decides what is possible, not the reference.
- **No copy-on-write.** Nothing defers a copy until the first write, so a
  defensive copy is paid immediately and in full.
- **No deep freeze.** There is no `freeze(obj)` in the stdlib that makes an
  arbitrary object graph immutable. `MappingProxyType` and frozen dataclasses
  each cover one level.
- **No enforcement from annotations.** `Final` prevents *rebinding* the name
  for a type checker; it says nothing about the object. `x: Final[list] = []`
  still permits `x.append(1)` — and that is correct, because `Final` is about
  the binding.

## Gotchas

### `Sequence[int]` believed to prevent mutation
**Symptom.** A parameter typed `Sequence` is mutated in production by a caller
or by a code path the checker did not analyse.
**Cause.** Annotations are erased at runtime; a list satisfies `Sequence` and
retains every mutator.
**Fix.** If it must hold, convert: `items = tuple(items)` at the top of the
function. Keep the annotation as well — it is how the checker helps you.

### `isinstance(x, Sequence)` used to reject mutable input
**Symptom.** A guard meant to accept only immutable sequences accepts lists.
**Cause.** `MutableSequence` is a subclass of `Sequence`, so every list passes.
**Fix.** Test the negative — `isinstance(x, MutableSequence)` — if you really
want to reject, or (better) just convert to `tuple` and stop asking.

### Defensive copies in every layer
**Symptom.** Profiles dominated by `deepcopy`; latency proportional to the
number of layers rather than the data.
**Cause.** Every function defends itself because nobody trusts the contract.
**Fix.** One copy at one named boundary, then immutable types or a documented
ownership rule inside. Delete the rest, and add the mutation test from Option 4
so the deletion is safe.

### `Final` read as immutability
**Symptom.** `DEFAULTS: Final[dict] = {...}` is edited at runtime by a module
that imports it.
**Cause.** `Final` forbids rebinding the *name*, statically. The dict is a
perfectly ordinary mutable dict.
**Fix.** `MappingProxyType` over it for a read-only view, or make it a frozen
dataclass / a function returning a fresh dict.

### A converted boundary that converts too late
**Symptom.** `self._items = tuple(items)` in `__init__`, but a `@classmethod`
constructor bypasses `__init__` and stores a list.
**Cause.** More than one construction path, only one of which freezes.
**Fix.** Funnel every path through one place — `__post_init__` for dataclasses,
a single private constructor otherwise.

### Copying at the boundary, then handing out the internals
**Symptom.** The copy is correct and the object still gets mutated from
outside.
**Cause.** The defensive copy protected the input and the getter published the
result. Both ends leak.
**Fix.** Treat input and output symmetrically: copy or freeze on the way in
*and* on the way out.

## Interview questions

**★ Q: How do you tell a caller that your function will not modify their
list?**
Annotate the parameter `Sequence[T]` rather than `list[T]` and say so in the
docstring — that is the readable, checkable signal. But since annotations do
not run, back it with either a conversion (`items = tuple(items)`) or a
defensive copy if the guarantee actually matters, and with a test that deep-
copies the input and asserts it is unchanged.

**★ Q: Does annotating a parameter `Sequence[int]` stop the function from
calling `.append`?**
Only in the type checker. At runtime the argument is a list with every mutating
method available, and `isinstance(arg, Sequence)` is true for a list because
`MutableSequence` derives from `Sequence`. The annotation communicates and
verifies statically; it enforces nothing.

**Q: Where should the defensive copy live?**
At one boundary, chosen deliberately — where untrusted or shared data becomes
yours. Deserialisation, the outer edge of a service, a constructor, or the
moment you store something into a cache. Copying in every layer is the failure
mode; copying in none is the bug.

**Q: `x: Final[list[int]] = []` — can you append to `x`?**
Yes. `Final` is a statement about the binding: a checker will object to
rebinding `x`, and will not object to `x.append(1)`. If you want the contents
fixed, use a tuple.

**Q: What is `typing.ReadOnly`?**
The `TypedDict` qualifier from PEP 705, Final in 3.13, marking an item that
"may not be mutated (added, modified, or removed)". It exists because a
`TypedDict` is a mutable dict, which made it impossible to annotate a function
that only reads certain keys without over-constraining callers. Like every
other qualifier, it is checked statically and absent at runtime.

**Q: Python has no `const`. What is the closest equivalent in practice?**
Choosing an immutable type. `tuple`, `frozenset`, `str`, `bytes`, a frozen
dataclass or a `NamedTuple` make mutation impossible rather than discouraged,
and cost nothing to verify. Everything else — annotations, naming conventions,
docstrings, `Final` — is a claim someone can violate.

**Q: How would you audit an existing codebase for functions that mutate their
arguments?**
Start with the tests: wrap fixtures in a deep-copy-and-compare assertion at
teardown, and see what fails. Statically, annotate parameters as `Sequence` /
`Mapping` in the modules you care about and let the type checker enumerate the
mutation sites for you — this is the most productive use of those annotations
even though they enforce nothing.

---

← Prev: [Function arguments](05-function-arguments.md) · Index: [Assignment and aliasing](README.md) · Next → [The mutable default argument](06-mutable-default-argument.md)
