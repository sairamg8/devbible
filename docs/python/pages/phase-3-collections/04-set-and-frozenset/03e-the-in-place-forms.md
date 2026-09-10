---
title: "`s |= t` changes the object every alias holds and `s = s | t` builds a new one — the in-place forms mutate a shared default for every caller, refuse non-sets where `update()` does not, and on a frozenset quietly rebind instead of mutating, while the methods return `None` and unpack a string into characters"
sidebar_label: "3e · The in-place forms"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset) (the
> mutating-operations table and notes), [time complexity](https://docs.python.org/3.14/library/time-complexity.html)
> — the language reference — [augmented assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#augmented-assignment-statements)
> — and the [tutorial](https://docs.python.org/3.14/tutorial/datastructures.html#more-on-lists).
> What CPython v3.14.7 `Objects/setobject.c` and `Objects/abstract.c` do beyond the docs is marked
> *implementation detail*. Documentation-verified — **no sandbox run, no program output**.

**`|=`, `&=`, `-=` and `^=` look like shorthand for `s = s | t` and friends. They are not: on a `set`
they mutate the existing object and hand the same object back, so every other name bound to that set
sees the change. That one difference produces a family of bugs the plain operators cannot — a shared
default that accumulates, a frozenset refactor that silently stops propagating updates, an
exception raised *after* the mutation already happened. The named methods (`update()` and the
`_update` variants) mutate too, return `None`, and accept any iterable — which is its own trap when
the iterable is a string.**

## The mutating operations, verbatim

> *"The following table lists operations available for `set` that do not apply to immutable
> instances of `frozenset`:"* — [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset)

| In-place operator (sets only) | Method (any iterable) | Documented as |
|---|---|---|
| `s \|= other \| ...` | `s.update(*others)` | *"Update the set, adding elements from all others."* |
| `s &= other & ...` | `s.intersection_update(*others)` | *"Update the set, keeping only elements found in it and all others."* |
| `s -= other \| ...` | `s.difference_update(*others)` | *"Update the set, removing elements found in others."* |
| `s ^= other` | `s.symmetric_difference_update(other, /)` | *"Update the set, keeping only elements found in either set, but not in both."* |
| — | `s.add(elem, /)` | *"Add element elem to the set."* |

> *"Note, the non-operator versions of the `update()`, `intersection_update()`,
> `difference_update()`, and `symmetric_difference_update()` methods will accept any iterable as an
> argument."*

The right-hand side of an augmented assignment is evaluated in full before the operation, so
`s -= a | b` removes the union of `a` and `b` — the documented signature `set -= other | ...` means
exactly that, and there is no precedence surprise here of the kind [3b](03b-operators-versus-methods.md)
shows for the plain operators.

## What `s |= t` actually does

> *"An augmented assignment evaluates the target (which, unlike normal assignment statements, cannot
> be an unpacking) and the expression list, performs the binary operation specific to the type of
> assignment on the two operands, and assigns the result to the original target. The target is only
> evaluated once."*

> *"An augmented assignment statement like `x += 1` can be rewritten as `x = x + 1` to achieve a
> similar, but not exactly equal effect. In the augmented version, `x` is only evaluated once. Also,
> when possible, the actual operation is performed in-place, meaning that rather than creating a new
> object and assigning that to the target, the old object is modified instead."* —
> [augmented assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#augmented-assignment-statements)

For a `set`, *"when possible"* is always: `set.__ior__` adds the elements to the existing table and
returns that same object, and the statement then assigns it back to the name. Written out, the two
spellings differ by exactly the object identity:

```python
def plain(s: set[str], t: set[str]) -> set[str]:
    s = s | t          # s.__or__(t) builds a NEW set; the caller's object is untouched
    return s

def in_place(s: set[str], t: set[str]) -> set[str]:
    s |= t             # s = s.__ior__(t): the caller's object is modified, then rebound to itself
    return s
```

Whether that is a bug depends entirely on who else holds a reference. Here is the one that ships:

```python
DEFAULT_SCOPES = {"read"}

def scopes_for(is_admin: bool, base: set[str] = DEFAULT_SCOPES) -> set[str]:
    scopes = base                      # an alias, not a copy
    if is_admin:
        scopes |= {"write", "admin"}   # mutates DEFAULT_SCOPES itself
    return scopes
```

After the first admin request, `DEFAULT_SCOPES` contains `"admin"` and every later user is issued it.
Nothing raises; the module constant changed. The fixes, in order of how much they prevent:

```python
DEFAULT_SCOPES = frozenset({"read"})      # 1. an immutable default cannot be mutated by anyone

def scopes_for(is_admin: bool, base: frozenset[str] = DEFAULT_SCOPES) -> frozenset[str]:
    if is_admin:
        return base | {"write", "admin"}  # 2. the plain operator always builds a new object
    return base
```

## A frozenset has no in-place operators — so `|=` rebinds

A frozenset is immutable: *"A `frozenset` is immutable, so it does not support adding, discarding,
or the in-place update operations"* ([time complexity](https://docs.python.org/3.14/library/time-complexity.html)).
It still accepts `fs |= t` as a statement. In 3.14.7 `frozenset` defines only `-`, `&`, `^` and `|`
in its number protocol — no in-place slots (implementation detail, `frozenset_as_number`) — so the
augmented assignment falls back to the plain operator, builds a new frozenset, and rebinds the
target. That is the *"when possible"* clause failing, exactly as documented.

Two consequences point in opposite directions. Making a shared default a frozenset makes the
`DEFAULT_SCOPES` bug impossible: `|=` on an alias rebinds the alias and leaves the default alone.
And changing an existing `set` to a `frozenset` **silently changes the meaning of every `|=` that
already touches it** — from "update the shared object" to "rebind this one name":

```python
# plugins.py
REGISTRY: frozenset[str] = frozenset()   # was: set()

def register(name: str) -> None:
    global REGISTRY
    REGISTRY |= {name}   # with a set: mutated the object importers hold; now: rebinds plugins.REGISTRY
```

```python
# app.py
from plugins import REGISTRY, register   # binds app.REGISTRY to the object that exists right now

register("billing")
enabled = "billing" in REGISTRY          # False: app.REGISTRY is still the empty frozenset
```

No exception anywhere. Read the registry through the module (`plugins.REGISTRY`) or through a
function that returns it, so the name is looked up after it was rebound:

```python
# plugins.py
_registry: frozenset[str] = frozenset()

def register(name: str) -> None:
    global _registry
    _registry = _registry | {name}

def registered() -> frozenset[str]:
    return _registry
```

## The in-place operators are exactly as strict as the plain ones

`s |= ["a", "b"]` raises `unsupported operand type(s) for |=: 'set' and 'list'` — the format
string in `Objects/abstract.c`, with the in-place operator's own name. `set.__ior__` returns
`NotImplemented` for a non-set in 3.14.7, the fallback to `set.__or__` declines too, and the list has
no reflected operator. The methods take any iterable and any number of them:

```python
def absorb(seen: set[str], *batches: list[str]) -> None:
    seen.update(*batches)             # one call, any iterables, no temporary sets
```

## `update()` takes an iterable; `add()` takes an element

A string, a tuple and a `bytes` value are all iterables, so `update()` unpacks them:

```python
roles = {"viewer"}
roles.update("admin")        # adds 'a', 'd', 'm', 'i', 'n' — five one-character elements
roles.add("admin")           # adds the one string "admin"

regions = set()
regions.update(("eu-west", "1"))     # two elements: "eu-west" and "1"
regions.add(("eu-west", "1"))        # one element: the tuple
```

The constructor has the same shape — `set("admin")` is five characters, `{"admin"}` is one string.
This is the single case where the in-place operator is the safer spelling: `roles |= "admin"`
raises, and the method does not.

## Mutating methods return `None`

> *"You might have noticed that methods like `insert`, `remove` or `sort` that only modify the list
> have no return value printed – they return the default `None`. This is a design principle for all
> mutable data structures in Python."* — [tutorial](https://docs.python.org/3.14/tutorial/datastructures.html#more-on-lists)

`add`, `update`, the four `_update` methods, `discard`, `remove` and `clear` all follow it. So
`roles = roles.update(extra)` replaces the set with `None`, and the failure surfaces later, at the
first `in` test or iteration, as a `TypeError` about `NoneType` that names neither the set nor the
line that broke it. Method chaining (`s.update(a).discard(b)`) fails the same way, immediately.
When you want a value back, the operator is the expression form: `roles = roles | set(extra)`, or
`roles = roles.union(extra)`.

## Augmented assignment is an assignment

`s |= t` is an assignment statement that happens to call a method first, and the assignment half
has its own bugs — a name that becomes local, a write-back into a tuple or a read-only property that
fails after the mutation succeeded, a missing dict key read before any work. They are
[3f · Augmented assignment is an assignment](03f-augmented-assignment-is-an-assignment.md).

## Gotchas

**★ Symptom: after one admin request, every user is issued the `admin` scope.** Cause: a default set
was aliased and then `|=` mutated it in place — augmented assignment modifies the object *"when
possible"*, and for a `set` it always is. Fix: make shared defaults `frozenset` and build results
with the plain operator — `scopes_for` above.

**★ Symptom: `TypeError` about `NoneType` at an `in` test several calls away from the real bug.**
Cause: `roles = roles.update(extra)`; every mutating set method returns `None`. Fix: mutate without
assigning, or use the expression form.

```python
roles.update(extra)              # mutate in place, no assignment
merged = roles.union(extra)      # or: a new set, as a value
```

**★ Symptom: a set of roles contains `'a'`, `'d'`, `'m'`, `'i'`, `'n'`.** Cause: `update()` iterates
its argument, and a string iterates as characters. Fix: `add()` for one element; `update()` only
with a collection of elements.

```python
roles.add(new_role)
roles.update(new_roles)          # new_roles is a list/set of role names
```

**★ Symptom: after changing a registry from `set()` to `frozenset()` "for safety", registered
plugins are never seen by the modules that imported the registry.** Cause: a frozenset has no
in-place operators, so `REGISTRY |= {name}` stopped mutating the shared object and started
rebinding one module attribute; `from plugins import REGISTRY` copied the old binding. Fix: expose
the registry through a function, as `registered()` above.

**Symptom: `TypeError: unsupported operand type(s) for |=: 'set' and 'list'`.** Cause: the in-place
operators are as strict as the plain ones. Fix: `seen.update(batch)` — `absorb` above.

## Interview questions

**★ What is the difference between `s |= t` and `s = s | t`?**
`s = s | t` builds a new set and rebinds `s` to it; any other reference to the old set still sees
the old contents. `s |= t` calls `s.__ior__(t)`, which for a `set` adds `t`'s elements to the
existing object and returns it, and then assigns that same object back to `s`. Every alias sees the
change. The language reference describes it as the operation being *"performed in-place, meaning
that rather than creating a new object and assigning that to the target, the old object is modified
instead"* — *"when possible"*, which for a `set` is always and for a `frozenset` never.

**★ What does `s.update("abc")` do, compared with `s.add("abc")` and `s |= "abc"`?**
`update` iterates its argument, so it adds the three characters `'a'`, `'b'` and `'c'`. `add` adds
the single string `"abc"`. `s |= "abc"` raises `TypeError`, because the in-place operator, like the
plain one, requires a set on the right. It is the one case where the strict operator protects you
and the permissive method does not.

**What happens to `fs |= t` when `fs` is a `frozenset`?**
It works, but it does not mutate: `frozenset` has no in-place operator, so Python falls back to
`fs | t`, builds a new frozenset and rebinds `fs`. Other references keep the old object. That is why
a frozenset default is immune to the aliasing bug, and also why switching a shared `set` to a
`frozenset` silently turns every existing `|=` from "update the shared object" into "rebind one
name".

**Why do `add()`, `update()` and `discard()` return `None` instead of the set?**
It is a deliberate convention: the tutorial calls returning `None` from methods that only modify
the object *"a design principle for all mutable data structures in Python"*. Returning `None`
makes it impossible to confuse a mutating call with an expression that produces a new value — the
price is that `x = x.update(y)` is a bug that fails late.

---

← Prev: [Views and ABC sets as operands](03d-views-and-abc-sets-as-operands.md) · [Topic index](README.md) · Next → [Augmented assignment is an assignment](03f-augmented-assignment-is-an-assignment.md)
