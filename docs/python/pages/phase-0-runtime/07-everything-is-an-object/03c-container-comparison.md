---
title: "Container comparison: in, index and dict lookup try identity before equality"
sidebar_label: "3c · Container comparison"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14 Language Reference §6.10
> [Comparisons](https://docs.python.org/3.14/reference/expressions.html)
> (membership test operations), the
> [`weakref`](https://docs.python.org/3.14/library/weakref.html) module docs, and
> CPython 3.14's `PyObject_RichCompareBool` in
> [`Objects/object.c`](https://github.com/python/cpython/blob/3.14/Objects/object.c).
> Target: **CPython 3.14**.

**Containers do not use `==` to find their elements. They use "`is` first, then
`==`" — a shortcut written into CPython precisely so that a container can always
find the objects it is holding. Almost nobody learns this until a NaN or a
non-reflexive `__eq__` forces them to, and then `x in [x]` and `x == x` disagree,
a dict key can only be retrieved by the exact object that was inserted, and the
results look impossible until you know the rule.**

This chunk continues [3 · Identity and equality](03-identity-and-equality.md) and
[3b · NaN](03b-nan.md), which supplies the value that makes the shortcut visible.

## `in` is defined as identity-or-equality

The reference defines membership for the built-in container types:

> *"The expression `x in y` is equivalent to `any(x is e or x == e for e in y)`."*

`x is e` comes **first**. That single clause explains the entire family of
surprises:

```python
nan = float('nan')
xs = [nan]

nan in xs               # True   — found by identity
xs.index(nan)           # 0
xs.count(nan)           # 1
xs == [nan]             # True   — same object in both lists, element-wise identity hit
xs == [float('nan')]    # False  — different NaN objects, and == is False
float('nan') in xs      # False  — a different NaN is not in the list

{nan, nan}              # one element: the second add finds the first by identity
{nan, float('nan')}     # two elements: two distinct unequal objects
d = {nan: "a"}
d[nan]                  # "a"    — dict lookup compares the key by identity first
d[float('nan')]         # KeyError
```

Every one of those lines is consistent with the definition, and none of them is
guessable from "`==` is False".

## Why CPython does it this way

The shortcut lives in `PyObject_RichCompareBool`, the C function that backs every
container operation built on element comparison — `in`, `index`, `count`,
`remove`, list and tuple `==`, dict key lookup, set membership. Its opening lines
carry the rationale as a comment:

```c
/* Quick result when objects are the same.
   Guarantees that identity implies equality. */
if (v == w) {
    if (op == Py_EQ)
        return 1;
    else if (op == Py_NE)
        return 0;
}
```

Two independent reasons, and both are good ones:

1. **Speed.** Comparing a list to itself, or finding a key you already hold, skips
   an arbitrary-cost `__eq__` call per element. For a list of large nested
   structures this is the difference between O(1) and a full deep comparison.
2. **Sanity.** Without it, `nan in [nan]` would be `False`, `[nan] == [nan]`
   would be `False` for the *same* list object, and `lst.remove(x)` could fail to
   remove an element the list demonstrably contains. A container that cannot find
   its own elements is not a container.

Note the asymmetry with the bare `==` operator: `nan == nan` is `False` because
that path goes through `PyObject_RichCompare`, which has no identity shortcut.
The shortcut is a property of *container element comparison*, not of `==`.

## The same shortcut applies to your classes

This is the part that turns a NaN curiosity into a bug in ordinary code. If your
`__eq__` is not reflexive — if `x == x` can be `False` — the container will still
find `x` by identity and will not find an equal copy, and the two results will
look impossible to reconcile.

```python
class Reading:
    def __init__(self, value):
        self.value = value

    def __eq__(self, other):
        if not isinstance(other, Reading):
            return NotImplemented
        return self.value == other.value      # if value is NaN, self == self is False!

r = Reading(float('nan'))
r == r                # False — non-reflexive, inherited from the NaN field
[r].index(r)          # 0     — found by identity anyway
r in [Reading(float('nan'))]   # False
```

The class did nothing obviously wrong; it inherited non-reflexivity from a field.
The fix is to make equality reflexive explicitly, which usually means deciding
what NaN *means* for your domain:

```python
class Reading:
    def __eq__(self, other):
        if not isinstance(other, Reading):
            return NotImplemented
        if self is other:
            return True                       # reflexive by construction
        a, b = self.value, other.value
        if math.isnan(a) and math.isnan(b):
            return True                       # "both missing" counts as equal here
        return a == b
```

An `__eq__` with a mutable field has the same problem in a different disguise:
mutate the field between two comparisons and the object stops being equal to a
copy it was equal to a moment ago, which corrupts any dict it is a key in. That
is the deeper reason mutable objects should not be hashable.

## Identity of unhashable objects

Unhashable is not "identity-less". A list has a perfectly good identity — it just
cannot be a dict key, because its value can change and its hash would go stale.

```python
a = [1]
b = [1]
a is b            # False — two objects
a == b            # True  — same value
{a: 1}            # TypeError: unhashable type: 'list'
```

When you need identity-keyed storage of objects you cannot hash, the two honest
options are:

```python
import weakref

seen = weakref.WeakSet()      # identity membership; entries vanish when the object dies
seen.add(obj)                 # requires obj to be weak-referenceable
```

```python
registry = {}                        # id(obj) -> (obj, payload)
registry[id(obj)] = (obj, payload)   # the tuple keeps obj alive, so the id stays valid
```

The second form is the fix for the `id()`-recycling trap in chunk 3: an
`id()`-keyed dict is only sound while something else guarantees the object is
alive, and the cleanest way to guarantee that is to store the object in the value.
`weakref` containers need the object to *support* weak references — `list`,
`dict`, `tuple`, `int` and `str` do not, and neither do instances of a class with
`__slots__` that omits `__weakref__` — so check before reaching for them.

## Gotchas

**Symptom:** `value in my_list` is True, but an equal value constructed separately is not found
**Cause:** membership tries `is` before `==`; you are finding that exact object, not an equal one
**Fix:** for NaN, test with `math.isnan`. For your own types, make `__eq__` reflexive and total. If you are genuinely relying on identity membership, say so — `any(x is e for e in xs)` is at least honest about it

**Symptom:** a dict lookup with an equal-looking key raises `KeyError`, but the original key object works
**Cause:** the key's `__eq__` is not reflexive (a NaN field is the usual culprit), so the lookup only ever succeeded via the identity shortcut
**Fix:** make `__eq__` reflexive — short-circuit on `self is other` — and decide explicitly whether two NaN fields count as equal for your domain

**Symptom:** an object used as a dict key stopped being findable after one of its fields was changed
**Cause:** the object is hashable *and* mutable; its hash was computed at insert time and the mutation moved its correct bucket
**Fix:** do not make mutable objects hashable. `@dataclass(frozen=True)`, or hash only the immutable subset of fields and document that those fields *are* the identity of the object

**Symptom:** `lst.remove(x)` raised `ValueError: list.remove(x): x not in list` for an object that looks present
**Cause:** `remove` uses the same identity-then-equality comparison; a different-but-equal-looking object is only found if `__eq__` says so, and a non-reflexive or type-strict `__eq__` says no
**Fix:** remove by index (`del lst[i]` after `index`) when you hold the exact object, and check that `__eq__` returns `NotImplemented` rather than `False` for types it does not recognise

**Symptom:** `weakref.WeakSet` raises `TypeError: cannot create weak reference to 'list' object`
**Cause:** not every type supports weak references — the built-in containers and scalars do not, nor do `__slots__` classes that omit `__weakref__`
**Fix:** add `__weakref__` to `__slots__`, wrap the object in a small class that supports weak references, or fall back to the `{id(obj): (obj, payload)}` form that keeps a strong reference and therefore keeps the id valid

**Symptom:** `x in big_list` is unexpectedly slow
**Cause:** list membership is a linear scan calling `__eq__` per element; the identity shortcut only helps when the exact object is present
**Fix:** use a `set` or `dict` when membership is the operation you perform repeatedly. That requires hashable elements, which is the practical reason to make value objects frozen dataclasses

**Symptom:** two objects are in a set that "should" have deduplicated them
**Cause:** sets deduplicate by hash then by identity-or-equality; if `__hash__` differs the `__eq__` is never consulted at all
**Fix:** ensure `__hash__` and `__eq__` are computed from the same fields. A mismatch here does not raise — it silently produces duplicates, which is far worse

## Interview questions

**★ `float('nan') == float('nan')` is False, but `nan in [nan]` is True. Explain.**
IEEE 754 says NaN is unequal to everything including itself, and Python
implements that faithfully for the `==` operator. Container membership is not
defined as pure equality: the reference states that `x in y` is equivalent to
`any(x is e or x == e for e in y)`, so identity is tried first. The *same* NaN
object is found by identity; a *different* NaN object with the same value is not
found at all. CPython implements this in `PyObject_RichCompareBool`, whose
comment says it "Guarantees that identity implies equality". Without the shortcut
a list holding a NaN could not find its own element and would not equal itself.

**★ Which operations use the identity-then-equality shortcut, and which do not?**
Everything that routes through `PyObject_RichCompareBool`: `in` and `not in`,
`list.index`, `list.count`, `list.remove`, element-wise `==` on lists and tuples,
`dict` key lookup, and `set` membership. The bare `==` operator does not — it
goes through `PyObject_RichCompare` with no shortcut, which is exactly why
`nan == nan` is False while `[nan] == [nan]` built from the same object is True.

**★ Why is it a problem if your `__eq__` is not reflexive?**
Because every container silently assumes reflexivity. A non-reflexive object can
be found in a list by identity but not by value, can be a dict key that only its
own object can retrieve, and can make `x in {x}` and `x in {copy_of_x}` disagree
in ways that read as impossible. The usual cause is not malice but a field: a
float that can be NaN, or a mutable attribute. Short-circuit on
`if self is other: return True`, and decide explicitly what a NaN field means for
the type.

**Why does CPython take the identity shortcut at all — is it just an optimisation?**
It is both an optimisation and a correctness guarantee, and the source comment
says so: "Quick result when objects are the same. Guarantees that identity
implies equality." The speed argument is that comparing a list to itself, or
retrieving a key you already hold, skips an arbitrary-cost `__eq__` per element.
The correctness argument is stronger: without it, a container could fail to find
an element it demonstrably contains, and a list would not compare equal to
itself.

**How do you store per-object data for objects you cannot hash?**
Two options. `weakref.WeakKeyDictionary` or `WeakSet` if the type supports weak
references — entries disappear when the object dies, which is usually what you
want for a cache. Otherwise a dict keyed by `id(obj)` whose *value* also holds a
reference to `obj`, so the object cannot be collected while the key exists.
Without that strong reference the id can be recycled by an unrelated allocation
and the cache silently returns the wrong thing — the `id()`-lifetime trap from
chunk [3](03-identity-and-equality.md).

**Why should a mutable object not be hashable?**
Because a hash-based container computes the hash once, at insert, and uses it to
choose a bucket. Mutating a field that participates in the hash moves where the
object *should* live without moving where it *does* live, so lookups miss and
the object becomes unreachable in a dict it is still stored in. Python's default
protects you — defining `__eq__` sets `__hash__` to `None` — and the standard
library follows the same rule: `list`, `dict` and `set` are unhashable, `tuple`
and `frozenset` are.

---

← Prev: [NaN](03b-nan.md) · Index: [Everything is an object](README.md) · Next → [Caching and interning](04-caching-and-interning.md)
