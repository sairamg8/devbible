---
title: "MISSING = object() works perfectly at runtime and destroys the signature, because object is the supertype of everything and the union that admits the sentinel therefore admits every value in the language — PEP 661 names that as the first of three drawbacks and deletes all three in 3.15"
sidebar_label: "07 · Typing the sentinel"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against
> [PEP 661 — Sentinel Values](https://peps.python.org/pep-0661/) (**Final**, Python-Version
> **3.15**, resolution 23-Apr-2026 — quoted below, and **not available on 3.14**) and the
> Python 3.14 documentation —
> [`typing.Literal`](https://docs.python.org/3.14/library/typing.html#typing.Literal),
> [`enum`](https://docs.python.org/3.14/library/enum.html),
> [`copy`](https://docs.python.org/3.14/library/copy.html).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[05o](06-the-sentinel-object.md) got the runtime right: when `None` is a legitimate value
you need a third object. This chunk is about the annotation, which is where the idiom falls
apart on Python 3.14. `_UNSET = object()` has type `object`, the supertype of everything, so
the only union that admits it also admits a `list`, a `Decimal` and a `socket` — the sentinel
works and the signature has stopped meaning anything. PEP 661 lists that as the first of
three drawbacks of the common idiom, adds a `sentinel()` built-in that fixes all three, and
is Final for **3.15**. On 3.14 the workaround that actually types is a single-member enum,
and it is worth understanding rather than copying.**

## Why the annotation collapses

```python
_UNSET = object()


def update_profile(user_id: int, bio: str | None | object = _UNSET) -> None:
    if bio is not _UNSET:
        _db.set_bio(user_id, bio)
```

`object` is the root of the type hierarchy, so `str | None | object` simplifies to `object`,
and `object` accepts everything. The checker will not object to `update_profile(1, [])`, will
not object to `update_profile(1, Decimal("2"))`, and will not narrow `bio` to `str | None`
inside the `if`. **The sentinel is invisible to the type system in exactly the way `-1` was
in [05n](05-choosing-a-sentinel.md), for exactly the same reason: it is a member of a type
that is already in the union.**

PEP 661's motivation names this as the first of three drawbacks of the `object()` idiom:

> *"Some do not have a distinct type, hence it is impossible to define clear type signatures
> for functions with such sentinels as default values."*

> *"They behave unexpectedly after being copied, due to a separate instance being created and
> thus comparisons using `is` failing. Some common sentinel idioms have similar problems
> after being pickled and unpickled."*

And the cosmetic one it opens with — `_sentinel = object()` has *"an uninformative and overly
verbose repr, causing the function's signature to be overly long and hard to read"*, which is
what shows up in `help()` output for such a function.

## The 3.14 workaround: a single-member enum

An enum *member* has a distinct type, and `typing.Literal` can name it:

```python
import enum
from typing import Literal


class _Sentinel(enum.Enum):
    UNSET = object()


UNSET = _Sentinel.UNSET


def update_profile(user_id: int, bio: str | None | Literal[_Sentinel.UNSET] = UNSET) -> None:
    if bio is not UNSET:                  # narrows: below here bio is `str | None`
        _db.set_bio(user_id, bio)
```

Three things this buys that `object()` does not: the union does not collapse, so a `list`
argument is rejected; `is not UNSET` narrows, so the body sees `str | None`; and the member
has a readable `repr`, so `help()` shows something a human can parse. The cost is five lines
of ceremony for one marker, which is exactly the boilerplate PEP 661 exists to delete.

⚠️ Do **not** reach for `Literal["MISSING"]` instead. PEP 661 considered and rejected the
string form:

> *"However, it was pointed out that this would cause potential confusion, due to e.g.
> `Literal["MISSING"]` referring to the string value `"MISSING"` rather than being a
> forward-reference to a sentinel value `MISSING`."*

A string literal type names a string, so a caller who legitimately passes `"MISSING"` is
indistinguishable from your marker — the in-band sentinel problem, one level up in the type
system.

## What 3.15 gives you

PEP 661 is **Final** with Python-Version **3.15**, resolved 23 April 2026. It adds a built-in
`sentinel` callable:

> *"`sentinel()` takes a single required positional-only argument, `name`, which must be a
> `str`, and an optional keyword-only argument, `repr`."*

with a type-system special case that removes the enum ceremony entirely:

> *"Sentinel objects may be used in type expressions, representing themselves. This is
> similar to how `None` is handled in the existing type system."*

> *"Type checkers should support narrowing union types involving sentinels using the `is` and
> `is not` operators."*

```python
# Python 3.15 and later. NOT available on 3.14.
UNSET = sentinel('UNSET')


def update_profile(user_id: int, bio: str | None | UNSET = UNSET) -> None:
    if bio is not UNSET:
        _db.set_bio(user_id, bio)
```

It also repairs the copy and pickle drawbacks — *"Creating a copy of a sentinel object, such
as by using `copy.copy()` or by `copy.deepcopy()`, will return the same object"*, and
sentinels importable by module and name preserve identity through pickling because *"Pickling
records the sentinel by module and name."* **On 3.14 none of that holds**, which is the reason
to keep a hand-rolled sentinel module-level, private, and never sent across a process
boundary.

Two rules from the specification are version-independent and worth adopting now:

- **Compare with `is`.** *"Checking if a value is such a sentinel should be done using the
  `is` operator, as is recommended for `None`."*
- **Several related markers are an enum, not several sentinels.** *"To define multiple,
  related sentinel values, possibly with a defined ordering among them, one should instead
  use `Enum` or something similar."*

## Gotchas

**★ Symptom: a function using `_UNSET = object()` as a default type-checks against absolutely
anything.** Cause: the annotation had to include `object` to admit the sentinel, and `object`
is the supertype of everything, so the union collapses — PEP 661 names this exactly: sentinels
made this way *"do not have a distinct type, hence it is impossible to define clear type
signatures"*. Fix: on 3.14, use a single-member enum so `Literal` can name the sentinel's
type.

```python
class _Sentinel(enum.Enum):
    UNSET = object()


UNSET = _Sentinel.UNSET


def f(bio: str | None | Literal[_Sentinel.UNSET] = UNSET) -> None: ...
```

**★ Symptom: the body of the function still treats the parameter as possibly-anything, so
every use needs an `isinstance`.** Cause: the union collapsed to `object`, so `is not UNSET`
had nothing to narrow — the guard runs, and the checker learns nothing from it. Fix: the enum
form again; `Literal[_Sentinel.UNSET]` is a one-member type, so `is not` removes it from the
union and the body sees `str | None`.

```python
def f(bio: str | None | Literal[_Sentinel.UNSET] = UNSET) -> None:
    if bio is UNSET:
        return
    _db.set_bio(bio)          # bio is `str | None` here — checked, not hoped
```

**★ Symptom: a sentinel spelled `Literal["MISSING"]` collides with a genuine string value.**
Cause: a string literal type names the *string* `"MISSING"`, not a forward reference to some
object — PEP 661 rejected this approach for exactly that reason, noting it *"would cause
potential confusion, due to e.g. `Literal["MISSING"]` referring to the string value
`"MISSING"` rather than being a forward-reference to a sentinel value `MISSING`"*. Fix: use
the enum member form, where `Literal[_Sentinel.UNSET]` names an object rather than text.

```python
class _Sentinel(enum.Enum):
    UNSET = object()


def f(x: str | Literal[_Sentinel.UNSET] = _Sentinel.UNSET) -> None: ...
```

**Symptom: `value is _MISSING` is `False` for an object that came out of `copy.deepcopy` or a
pickle round trip.** Cause: on 3.14 a plain `object()` sentinel is copied like any other
object, producing a distinct instance — PEP 661 lists this as one of the three drawbacks it
was written to fix, and the fix arrives in 3.15. Fix: keep sentinels module-level and never
let one cross a copy, a pickle or a process boundary; compare identity only within the process
that created it.

```python
# Safe on 3.14: the sentinel never leaves this module's own call paths.
_MISSING = object()          # not exported, not stored, not serialised
```

**Symptom: `if value:` is used to test for a sentinel and never fires.** Cause: sentinel
objects are truthy — PEP 661 specifies that *"Sentinel objects are 'truthy', i.e. boolean
evaluation will result in `True`. … This is unlike `None`, which is 'falsy'."* Fix: test
identity, which is the same rule as `None`.

```python
if value is _MISSING:        # not `if not value:`
    ...
```

**Symptom: the enum sentinel is defined with `UNSET = enum.auto()` and two unrelated
sentinels compare equal in a test.** Cause: `auto()` produces small integer values, so two
one-member enums both hold `1` — the *members* are still distinct objects, but any code
comparing `.value` instead of identity now sees a match. Fix: compare the member, never the
value, and give the member a body that carries no meaning.

```python
class _Sentinel(enum.Enum):
    UNSET = object()          # the value is irrelevant; identity is the contract


if bio is _Sentinel.UNSET:    # never `bio.value == 1`
    ...
```

**Symptom: mypy accepts the enum form and pyright rejects it, or the reverse.** Cause: the
`Literal[EnumMember]` sentinel is a community idiom rather than a documented language feature
on 3.14; support for it is a property of each checker, not of the language, and the
documentation does not settle how any specific checker treats it. Fix: verify against the
checker your CI actually runs before committing the pattern across a codebase — and note the
expiry date, because PEP 661 makes this a specified behaviour from 3.15.

## Interview questions

**★ Why can `MISSING = object()` not be typed properly on Python 3.14?**
Because `object()` has no distinct type — its type is `object`, the supertype of everything —
so the only annotation that admits it is a union containing `object`, and such a union accepts
every value in the language. PEP 661's motivation states the problem directly: sentinels made
this way *"do not have a distinct type, hence it is impossible to define clear type signatures
for functions with such sentinels as default values."* Two things follow that people miss: the
union does not merely become permissive, it also stops narrowing, so `if x is not UNSET:`
teaches the checker nothing and the body still sees `object`. The workaround on 3.14 is a
single-member `enum.Enum`, because an enum member has a type that `typing.Literal` can name,
so `Literal[_Sentinel.UNSET]` is a real one-member type that narrows under `is`.

**★ What does PEP 661 change, and when can you use it?**
It adds a built-in `sentinel()` callable — Final, with Python-Version **3.15**, so **not on
3.14** — that creates a named singleton with a readable repr, a distinct type usable directly
in annotations (*"Sentinel objects may be used in type expressions, representing themselves.
This is similar to how `None` is handled"*), narrowing under `is` and `is not`, and identity
preserved across `copy.copy`, `copy.deepcopy` and pickling. Those are precisely the three
drawbacks the motivation lists for the `object()` idiom: no type, broken identity after
copying, and an unreadable repr. Until you are on 3.15, the enum form is the version that
types; on 3.15 it becomes one line. Knowing which of your workarounds have an expiry date is
half of keeping a codebase current.

**★ Why is `Literal["MISSING"]` the wrong way to type a sentinel?**
Because it types a *string*, not your object. `Literal["MISSING"]` is satisfied by the string
`"MISSING"` arriving from anywhere — a config file, a form field, a caller who read your
annotation and did the obvious thing — so the marker is back inside the success type and the
checker can no longer tell your "nothing" from somebody's data. PEP 661 considered this
spelling and rejected it in those terms, noting it *"would cause potential confusion, due to
e.g. `Literal["MISSING"]` referring to the string value `"MISSING"` rather than being a
forward-reference to a sentinel value `MISSING`"*. It is the same in-band-sentinel mistake as
`str.find` returning `-1`, committed one level up in the type system rather than at runtime.

**The enum form works but is five lines of ceremony for one marker. When is it worth it?**
When the sentinel appears in a *public* signature that other people type-check against — a
library API, or a boundary function in a large codebase with a strict checker. There the
collapsed union is a real loss: it disables argument checking for that parameter and disables
narrowing in the body, so the sentinel has quietly bought you a hole. For a private helper
inside one module, `_MISSING = object()` with a comment is usually fine, because the surface
that could go wrong is small and visible. The honest framing is that the ceremony buys type
safety at a boundary and nothing at all in a function nobody else calls — and that on 3.15 the
question disappears, because `sentinel()` costs one line.

**What has to be true for identity comparison of a sentinel to be reliable?**
That there is exactly one instance and it never leaves the process. On 3.14 both conditions
are on you: define it once at module level, because an object created inside a function body
is new on every call; keep it out of anything that copies or serialises, because
`copy.deepcopy` produces a distinct instance and a pickle round trip produces another one —
PEP 661 lists that as a drawback it was written to fix, describing sentinels that *"behave
unexpectedly after being copied, due to a separate instance being created and thus comparisons
using `is` failing."* Also worth saying: reloading a module re-executes it and creates a new
sentinel, so anything holding the old one stops matching — which is why a sentinel is a poor
choice for a value that crosses a plugin or reload boundary.

---

← Prev: [The sentinel object](06-the-sentinel-object.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → [Overloads](08-overloads.md)
