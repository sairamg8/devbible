---
title: "Defining __eq__ silently sets __hash__ to None, and that is the language protecting you from a dict entry you can never find again"
sidebar_label: "2c · `__ne__`, `__hash__` and the contract"
sidebar_position: 64
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 data model
> [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__)
> and [rich comparison methods](https://docs.python.org/3.14/reference/datamodel.html#object.__lt__),
> the library reference on
> [Hashing of numeric types](https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types),
> and [`sys.hash_info`](https://docs.python.org/3.14/library/sys.html#sys.hash_info).
> Version spine: **CPython 3.14**.

**`==` and `hash()` are one contract, not two features. The moment you write an
`__eq__`, Python sets your class's `__hash__` to `None` — your objects stop being
usable in a `set` or as a `dict` key, and they do so on purpose, because a hashable
object whose hash can change is an entry that gets lost in the wrong bucket forever.
You have exactly three ways out and each one is a statement about whether your
objects are immutable. `__ne__`, meanwhile, needs no attention at all in Python 3 —
it derives itself from `__eq__`, which is a Python 2 habit worth unlearning.**

## `__ne__` derives itself

In Python 2 you wrote `__ne__` by hand, and forgetting it meant `a != b` and
`not (a == b)` could disagree. Python 3 removed that footgun:

> *"For `__ne__()`, by default it delegates to `__eq__()` and inverts the result
> unless it is `NotImplemented`."* —
> [data model](https://docs.python.org/3.14/reference/datamodel.html#object.__lt__)

Two things follow. First, **do not write `__ne__`.** A hand-written one is dead
weight at best and a divergence at worst. Second, the delegation is
`NotImplemented`-aware: if your `__eq__` declines, `__ne__` declines too, and the
interpreter reflects and then falls back to `is not` — the inversion is not applied
to the sentinel.

The rare legitimate reason to define `__ne__` is a three-valued type where `!=` is
genuinely not the negation of `==`: SQL-style `NULL` semantics, a fuzzy matcher, a
NumPy-like array type where both operators return element-wise arrays. Those are
exactly the types that also break the reference's rule that *"`x == y` and `not x !=
y`"* should agree — and they break it knowingly.

## `__hash__` disappears when `__eq__` appears

The rule, verbatim:

> *"A class that overrides `__eq__()` and does not define `__hash__()` will have its
> `__hash__()` implicitly set to `None`. When the `__hash__()` method of a class is
> `None`, instances of the class will raise an appropriate `TypeError` when a program
> attempts to retrieve their hash value, and will also be correctly identified as
> unhashable when checking `isinstance(obj, collections.abc.Hashable)`."* —
> [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__)

```python
class Point:
    def __init__(self, x, y):
        self.x, self.y = x, y
    def __eq__(self, other):
        if not isinstance(other, Point):
            return NotImplemented
        return (self.x, self.y) == (other.x, other.y)

{Point(1, 2)}            # TypeError: unhashable type: 'Point'
{Point(1, 2): "origin"}  # TypeError: unhashable type: 'Point'
```

This is not an oversight to work around; it is the language noticing that you
redefined equality and refusing to let the old identity-based hash go on lying. The
underlying requirement:

> *"The only required property is that objects which compare equal have the same hash
> value; it is advised to mix together the hash values of the components of the object
> that also play a part in comparison of objects by packing them into a tuple and
> hashing the tuple."* —
> [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__)

And the reason mutable objects must stay unhashable:

> *"If a class defines mutable objects and implements an `__eq__()` method, it should
> not implement `__hash__()`, since the implementation of hashable collections requires
> that a key's hash value is immutable (if the object's hash value changes, it will be
> in the wrong hash bucket)."*

Concretely: put an object in a `set`, mutate a field that participates in `__hash__`,
and the object is now in the bucket for its *old* hash. `obj in s` computes the new
hash, looks in the new bucket, finds nothing, and returns `False` — while iterating
`s` still yields the object. The set is internally inconsistent and nothing raised.

## The three ways out

**1 · Define `__hash__` over the same fields as `__eq__`** — for immutable value
objects. Use the tuple trick the docs recommend:

```python
class Point:
    __slots__ = ("x", "y")
    def __init__(self, x, y):
        self.x, self.y = x, y
    def __eq__(self, other):
        if not isinstance(other, Point):
            return NotImplemented
        return (self.x, self.y) == (other.x, other.y)
    def __hash__(self):
        return hash((self.x, self.y))
```

The two methods must range over the *same* fields. If `__eq__` compares `(x, y)` and
`__hash__` hashes only `x`, everything still works — hash collisions are legal — but
if `__hash__` uses a field `__eq__` ignores, two equal objects can hash differently
and the set will hold both.

**2 · Inherit the parent's hash explicitly** — for classes that redefine equality but
whose identity-hash is still correct (rare, and it means `x == y` no longer implies
`hash(x) == hash(y)`; do it only when equal-but-distinct objects will never share a
container):

> *"If a class that overrides `__eq__()` needs to retain the implementation of
> `__hash__()` from a parent class, the interpreter must be told this explicitly by
> setting `__hash__ = <ParentClass>.__hash__`."*

```python
class Node:
    def __eq__(self, other): ...
    __hash__ = object.__hash__     # identity hash, deliberately
```

**3 · Leave it unhashable.** The default. If the object is mutable, this is correct
and there is nothing to fix. The complementary rule, for a class that does *not*
override `__eq__` but should not be a dict key:

> *"If a class that does not override `__eq__()` wishes to suppress hash support, it
> should include `__hash__ = None` in the class definition."*

## The truncation footnote

> *"`hash()` truncates the value returned from an object's custom `__hash__()` method
> to the size of a `Py_ssize_t`. This is typically 8 bytes on 64-bit builds and 4
> bytes on 32-bit builds. If an object's `__hash__()` must interoperate on builds of
> different bit sizes, be sure to check the width on all supported builds."* —
> [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__)

`sys.hash_info.width` reports it. This only matters if you persist hash values, which
you should not: `str` and `bytes` hashing is randomised per process by default, so a
hash written to disk or a cache key derived from `hash()` is meaningless on the next
run. Use `hashlib` for anything that must be stable.

## Equal across types means equal hashes too

The numeric tower honours the contract across type boundaries, which is why
`{1, 1.0, Decimal(1), True}` collapses to a single element:

> *"For numbers `x` and `y`, possibly of different types, it's a requirement that
> `hash(x) == hash(y)` whenever `x == y` ... Python's hash for numeric types is based
> on a single mathematical function that's defined for any rational number, and hence
> applies to all instances of `int` and `fractions.Fraction`, and all finite instances
> of `float` and `decimal.Decimal`."* —
> [Hashing of numeric types](https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types)

`True` is in that set because `bool` is a subclass of `int` and `True == 1`. Which
element survives is whichever was inserted first — a `set` keeps the existing key on
a duplicate insert. See [05](05-cross-type-comparison.md).

## `__eq__` on a class with `__slots__`, `__init_subclass__` and frozen instances

Three practical notes that follow from the contract rather than from any one rule:

- **`__slots__` does not affect hashing or equality**, but it does make it impossible
  to sneak an extra attribute past your `__eq__`. It pairs well with value objects.
- **A subclass of a hashable class that adds `__eq__` loses the hash again.** The
  implicit `__hash__ = None` is applied per class, so `class Sub(Point)` with its own
  `__eq__` is unhashable even though `Point` is not.
- **`@dataclass(frozen=True, eq=True)` generates both** — that combination is the
  ergonomic version of way 1, and it is covered in
  [09](09-total-ordering-and-dataclasses.md).

## Gotchas

**★ `TypeError: unhashable type: 'Point'` after adding an `__eq__` to a class that
used to work as a dict key.** Defining `__eq__` implicitly sets `__hash__ = None`.
Fix: add a `__hash__` over the same fields if the object is immutable
(`return hash((self.x, self.y))`), or accept unhashability if it is not.

**★ A `set` containing what look like duplicates.** Two objects compare equal but
hash differently, so they land in different buckets and both survive insertion. Fix:
make `__hash__` range over exactly the fields `__eq__` compares — the docs' rule is
that objects which compare equal must have the same hash value.

**★ An object that vanishes from a `set` you can still see it in.** You mutated a
field that participates in `__hash__` after insertion, so `x in s` hashes to a bucket
the object is not in. Iterating still yields it. Fix: never make a mutable object
hashable; if you must, freeze it before insertion or key the set on an immutable
snapshot (a tuple, a frozen dataclass).

**★ A hand-written `__ne__` that disagrees with `__eq__` after someone edits one of
them.** Python 3's default `__ne__` delegates to `__eq__` and inverts, so the
hand-written one is pure risk. Fix: delete it. Keep it only for a genuinely
three-valued type, and then document why.

**★ A hand-written `__ne__` that returns `not self.__eq__(other)` and breaks on
3.14.** If `__eq__` returns `NotImplemented`, `not NotImplemented` now raises
`TypeError` rather than quietly yielding `False`. Fix: delete the method; the default
delegation already handles the sentinel correctly.

**★ A cache key built from `hash(some_string)` that misses on every restart.** `str`
and `bytes` hashing is randomised per process unless `PYTHONHASHSEED` is fixed. Fix:
use `hashlib.sha256(s.encode()).hexdigest()` for anything that crosses a process
boundary; `hash()` is for in-memory containers only.

**★ A subclass that redefines `__eq__` becoming unhashable while its base stays
hashable.** The implicit `__hash__ = None` is applied to the class that defines
`__eq__`, not inherited from the base. Fix: add `__hash__` to the subclass too, or
`__hash__ = Base.__hash__` if the base's hash is still correct for the new equality.

**★ `{1, 1.0, True}` having one element and someone treating that as a bug.**
Cross-type numeric equality plus the hash requirement makes it inevitable, and `bool`
is an `int`. Fix: if the distinction matters, key on `(type(x).__name__, x)` or use a
`list`; do not try to defeat the numeric hash.

## Interview questions

**★ Q: What happens to `__hash__` when you define `__eq__`?**
It is implicitly set to `None`, making instances unhashable — `hash(obj)`, `set`
membership and dict keying all raise `TypeError`, and
`isinstance(obj, collections.abc.Hashable)` correctly reports `False`.

**★ Q: Why does Python do that instead of leaving the inherited hash alone?**
Because the inherited hash is identity-based and your new `__eq__` is not, so two
equal objects would hash differently and both could live in the same set. The only
required property of `__hash__` is that equal objects hash equally; redefining
equality breaks it, so the language removes the hash rather than let it lie.

**★ Q: You need your value object in a `set`. What do you write?**
`def __hash__(self): return hash((self.x, self.y))` — the same fields `__eq__`
compares, packed into a tuple, exactly as the data model recommends. And make the
object immutable, because a hash that changes after insertion puts the object in the
wrong bucket permanently.

**Q: Do you need to write `__ne__` in Python 3?**
No. `object.__ne__` delegates to `__eq__` and inverts the result unless it is
`NotImplemented`. Writing one by hand is a Python 2 habit that only creates
opportunities for the two to drift apart.

**Q: How do you keep the parent's hash while overriding `__eq__`?**
`__hash__ = ParentClass.__hash__` in the class body — the data model says the
interpreter must be told explicitly. Understand what you are asserting: equal objects
may now hash differently, so they must never share a hashed container.

**Q: How do you make a class that does not override `__eq__` unhashable?**
`__hash__ = None` in the class body. That is the documented way to suppress hash
support, and it also makes `isinstance(obj, Hashable)` report `False`.

**★ Q: What actually goes wrong if you make a mutable object hashable?**
It gets inserted under the hash of its state at insertion time. Mutate a hashed
field and lookups compute a different hash, land in a different bucket, and report
"not present" — while iteration still yields the object, and a second insert can add
a duplicate. Nothing raises; the container is quietly corrupt.

**Q: Why is `hash("abc")` different in two runs of the same program?**
`str` and `bytes` hashing is randomised per process, seeded from the environment
(`PYTHONHASHSEED`), as a mitigation against hash-collision denial of service. That
makes `hash()` unusable for persisted keys — use `hashlib`.

**Q: Why does `{1, 1.0, Decimal(1), True}` have one element?**
All four compare equal, and the library reference requires that numbers which compare
equal have equal hashes; the numeric hash is one mathematical function over the
rationals shared by `int`, `float`, `Decimal` and `Fraction`. `bool` is a subclass of
`int`, so `True == 1`. A set keeps the first insert, so the surviving element depends
on the literal order.

---

← Prev: [Writing `__eq__` correctly](02b-writing-eq-correctly.md) · Index: [Comparisons](README.md) · Next → [Chaining](03-chaining.md)
