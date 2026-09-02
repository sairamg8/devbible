---
title: "Publishing a mutable object is the mirror image of accepting one, and both are found with the same three diagnostics"
sidebar_label: "11b · Publishing state, and diagnostics"
sidebar_position: 93
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14
> [`copy`](https://docs.python.org/3.14/library/copy.html),
> [`types.MappingProxyType`](https://docs.python.org/3.14/library/types.html#types.MappingProxyType),
> [`id()`](https://docs.python.org/3.14/library/functions.html#id),
> [`tracemalloc`](https://docs.python.org/3.14/library/tracemalloc.html),
> and the [Programming FAQ](https://docs.python.org/3.14/faq/programming.html#why-did-changing-list-y-also-change-list-x).
> Target: **CPython 3.14**.

**A function that returns its internal list has done exactly as much damage as
one that mutates its argument, and it is harder to spot because returning
something looks generous rather than dangerous. The same is true of a helper
whose name promises a computation and whose body performs a mutation. This
chunk collects those output-side failures and then the three diagnostics that
find every pattern in this topic — none of which require understanding the code
you are debugging.**

## 6 — The getter that publishes internal state

```python
class Basket:
    def __init__(self): self._items = []
    def get_items(self): return self._items

basket.get_items().clear()      # bypasses every invariant the class has
```

The class's `add`/`remove` methods might update a running total, fire events,
or enforce limits. None of that runs. The total is now wrong and the traceback,
when it eventually appears, is inside `checkout`.

**Fix.** `return tuple(self._items)`. One allocation; the entire class of bug
gone. For big collections, a `Sequence` wrapper — see
[Read-only views](10b-read-only-views-and-boundaries.md).

## 7 — Two "different" objects from the same constructor path

```python
def default_permissions():
    return DEFAULT_PERMS          # returns the module-level list, not a copy

user_a.perms = default_permissions()
user_b.perms = default_permissions()
user_a.perms.append("admin")      # user_b is now an admin
```

A privilege escalation written as a helper function. The word "default" in the
name is what makes it invisible: everyone reads it as "a fresh default".

**Fix.** Return a new object (`list(DEFAULT_PERMS)`), or make `DEFAULT_PERMS` a
`frozenset` so appending is impossible and the type system says what it is.

## 8 — Serialising a structure another thread is editing

```python
json.dumps(shared_state)          # RuntimeError: dictionary changed size during iteration
```

Or worse, no error and a serialised snapshot that is internally inconsistent —
half pre-change, half post-change. Under 3.14's free-threaded build the window
is wider.

**Fix.** Snapshot under a lock, or keep the shared state immutable and swap the
whole object atomically (`self._state = new_state`), which makes readers
lock-free by construction.

## 9 — `sort()` on a list you were handed

```python
def top_n(items, n):
    items.sort(key=score, reverse=True)     # reorders the CALLER's list
    return items[:n]
```

The function returns the right answer and permanently reorders the caller's
data. Bugs surface far away: a UI that shows items in the wrong order, a
"stable" pagination that jumps, a diff that reports spurious changes.

**Fix.** `sorted(items, key=score, reverse=True)[:n]` — the non-mutating twin.
The `None` return convention exists precisely so `items = items.sort()` fails
loudly instead.

## The diagnostic toolkit

```python
id(obj)                                   # the identity, printed at three points
a is b                                    # the direct question
len({id(x) for x in seq}) == len(seq)     # "are these all distinct objects?"
types.MappingProxyType(d)                 # make writers raise, find them by traceback
before = copy.deepcopy(x); f(x); assert x == before   # who mutates my input?
tracemalloc                               # what is growing in a long-lived process
```

The `MappingProxyType` trick and the deep-copy assertion are the two that find
real bugs fastest. Neither requires understanding the code you are debugging;
both convert an invisible write into a traceback at the write site.

## The diagnostic toolkit

```python
id(obj)                                   # the identity, printed at three points
a is b                                    # the direct question
len({id(x) for x in seq}) == len(seq)     # "are these all distinct objects?"
types.MappingProxyType(d)                 # make writers raise, find them by traceback
before = copy.deepcopy(x); f(x); assert x == before   # who mutates my input?
tracemalloc                               # what is growing in a long-lived process
```

The `MappingProxyType` trick and the deep-copy assertion are the two that find
real bugs fastest. Neither requires understanding the code you are debugging;
both convert an invisible write into a traceback at the write site.

## Gotchas

### A mutation hidden behind a helper's friendly name
**Symptom.** `normalise(payload)`, `enrich(record)`, `validate(order)` change
their arguments.
**Cause.** The name promised a computation and the body performed a mutation.
**Fix.** Rename to the truth (`normalise_in_place`) or, better, return a new
object and return `None` never. Add the deep-copy assertion to the test for
that function.

### A `.copy()` added at the wrong layer
**Symptom.** A defensive copy is inserted, the bug persists, and now the code
is slower.
**Cause.** The copy was shallow and the mutation is one level deeper, or the
copy is downstream of where the sharing happened.
**Fix.** Find the actual write with the proxy trick before copying anything.
Copying blind is how a codebase acquires eleven deep copies and still leaks.

### Fixing it by copying at every layer
**Symptom.** Latency proportional to the number of layers; `deepcopy` at the
top of a profile.
**Cause.** Nobody trusts the contract, so everybody defends.
**Fix.** One freeze at one boundary. Immutable data needs no defence and no
copy.

### A cached property that hands out a mutable object
**Symptom.** `obj.parsed` is edited by one caller and every later caller sees
the edit.
**Cause.** `functools.cached_property` stores the computed object in the
instance `__dict__` and returns that same object on every access — by design.
**Fix.** Cache an immutable value (`tuple`, frozen dataclass), or return a copy
from a plain method instead of caching. `del obj.parsed` forces recomputation
but does not stop the sharing.

### An "immutable" return value that is a live view
**Symptom.** A method returns `d.keys()` or a `MappingProxyType` and callers
see later changes.
**Cause.** Views are dynamic by definition — see
[Read-only views](10b-read-only-views-and-boundaries.md).
**Fix.** `tuple(...)`/`dict(...)` if you meant a snapshot; the view if you
meant a view. Say which in the docstring.

## Interview questions

**★ Q: How would you find who is mutating a shared dict?**
Replace it with `types.MappingProxyType(d)` and run the tests or a smoke path:
every write raises `TypeError` with a traceback at the write site. If the
mutation is one level down, wrap the nested values too. For inputs to a
specific function, deep-copy before and assert equality after.


**Q: A helper is documented as pure and a colleague suspects it mutates its
input. How do you settle it?**
Write the assertion: `before = copy.deepcopy(arg); helper(arg); assert arg ==
before`. Keep it as a permanent test rather than a one-off, since purity is a
contract that can be broken by any future edit.


**Q: Why does `items.sort()` in a helper cause bugs a long way away?**
Because it reorders the caller's list permanently, and the caller may have been
relying on insertion order, may be sharing that list with other code, or may
iterate it again later. Nothing raises. `sorted()` returns a new list and is
almost always what the helper meant.

**★ Q: What is wrong with returning `self._items` from a method?**
It publishes a mutable alias of private state, so any caller can append, clear
or sort it without going through the class — bypassing invariants, totals,
events and validation. The class's own methods then compute wrong answers, and
the traceback appears somewhere else entirely. Return `tuple(self._items)`, a
copy, or an iterator.

**Q: Name the three diagnostics you would reach for first.**
Print `id()` of the suspect object at several points to see whether it is one
object or several. Wrap a shared mapping in `types.MappingProxyType` so every
writer raises with a traceback at the write site. Deep-copy a function's input
before the call and assert equality after, to prove or disprove mutation. All
three work without reading the code that is misbehaving.

**Q: How do you check that a list of results contains distinct objects?**
`len({id(x) for x in seq}) == len(seq)`. Equality-based assertions cannot
distinguish "n distinct equal objects" from "one object n times", which is
exactly why the template-in-a-loop and `[[]] * n` bugs survive code review.

**Q: A long-running worker's memory grows steadily. What aliasing-related
causes would you check?**
A mutable default argument accumulating across calls; a class attribute or
module-level list used as per-instance or per-request state; an unbounded cache
holding references to arguments and return values; a `ContextVar` with a
mutable default. `tracemalloc` snapshots taken at two points, diffed, name the
allocation site.

---

← Prev: [Where it bites in real code](11-where-it-bites.md) · Index: [Assignment and aliasing](README.md) · Next → [Caches, workers and ORM instances](11c-caches-workers-and-orm.md)
