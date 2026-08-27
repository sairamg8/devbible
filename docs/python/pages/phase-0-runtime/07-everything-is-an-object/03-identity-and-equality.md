---
title: "Identity and equality: is asks 'the same object?', == asks 'the same value?'"
sidebar_label: "3 · Identity and equality"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14 Language Reference §6.10
> [Comparisons](https://docs.python.org/3.14/reference/expressions.html) (identity
> comparisons and value comparisons), the
> [`id()`](https://docs.python.org/3.14/library/functions.html#id) built-in, the
> [data model](https://docs.python.org/3.14/reference/datamodel.html) entries for
> `object.__eq__` and `object.__hash__`, and CPython 3.14 source for the exact
> `SyntaxWarning` text and its exemption list
> ([`Python/codegen.c`](https://github.com/python/cpython/blob/3.14/Python/codegen.c)).
> Target: **CPython 3.14**.

**`is` and `==` answer different questions, and the reason people confuse them is
that for the objects a beginner tests with, both answers happen to be the same.
`is` compares identity — are these two names pointing at one object — and it can
never be overridden, never calls user code and never raises. `==` compares value,
by calling `__eq__`, which is arbitrary Python. The gap between them is where a
whole family of bugs lives, and CPython's object caching (chunk 4) is what keeps
those bugs hidden until production.**

NaN — the value for which `x == x` is False — is chunk
[3b · NaN](03b-nan.md), and the `is`-then-`==` shortcut that makes containers
disagree with `==` is chunk
[3c · Container comparison](03c-container-comparison.md).

## Identity is the property you cannot change

Every object has three properties; identity is the immutable one.

> *"The operators `is` and `is not` test for an object's identity: `x is y` is
> true if and only if x and y are the same object. An Object's identity is
> determined using the `id()` function."*

`id()` is documented narrowly, and every word of the narrowness matters:

> *"Return the 'identity' of an object. This is an integer which is guaranteed to
> be unique and constant for this object during its lifetime. Two objects with
> non-overlapping lifetimes may have the same `id()` value."*
>
> *"CPython implementation detail: This is the address of the object in memory."*

Two clauses do the work. **"During its lifetime"** — the guarantee expires when
the object does. **"Non-overlapping lifetimes may have the same `id()` value"** —
CPython reuses freed memory, so once an object is collected its address is
available to the next allocation of the same size. That is why `id()` is not an
object fingerprint:

```python
class Row: ...

seen = set()
seen.add(id(Row()))        # the Row is unreferenced the instant this line ends
                           # → refcount hits 0 → freed → address available again
print(id(Row()) in seen)   # can be True, for a DIFFERENT object
```

The set holds an integer, not a reference, so nothing keeps the first `Row`
alive. If you must key on identity, keep the object alive and let the container
do it: `weakref.WeakSet`, or a dict keyed by the object itself when it is
hashable. Storing raw `id()` values in a long-lived registry is a genuine
correctness bug, not a style issue.

## `is` never calls your code; `==` almost always does

| | `is` | `==` |
|---|---|---|
| Question asked | same object? | same value? |
| Implemented by | a pointer comparison (`IS_OP`) | `__eq__` on either operand (`COMPARE_OP`) |
| Can a class override it? | **No** | Yes, that is what `__eq__` is |
| Can it raise? | **No** | Yes — any exception `__eq__` raises |
| Can it be slow? | No, it is one machine comparison | Yes — deep structures compare recursively |
| Default when `__eq__` is undefined | n/a | falls back to identity |

That last row is the one people miss. A plain class with no `__eq__` gets
identity semantics for `==` for free:

> *"The default behavior for equality comparison (`==` and `!=`) is based on the
> identity of the objects. Hence, equality comparison of instances with the same
> identity results in equality, and equality comparison of instances with
> different identities results in inequality."*

```python
class Point:
    def __init__(self, x, y):
        self.x, self.y = x, y

Point(1, 2) == Point(1, 2)     # False — no __eq__, so == means is
```

Two objects with identical contents are unequal, because you never told Python
what "equal" means for a `Point`. This is the single most common "why is my test
failing" for hand-written classes, and it is why `@dataclass` — which generates
`__eq__` comparing the fields as a tuple — exists.

## The `__eq__` contract

If you define `__eq__`, the reference names the properties it should have:

> *"Equality comparison should be reflexive. In other words, identical objects
> should compare equal: `x is y` implies `x == y`"*

Also symmetric (`x == y` iff `y == x`) and transitive. Three practical rules
follow:

**Return `NotImplemented`, not `False`, for types you do not know.** Returning
`NotImplemented` tells Python to try the *other* operand's reflected `__eq__`
before concluding inequality. Returning `False` short-circuits that and makes
your class silently unequal to types that would happily have compared equal to
it.

```python
class Money:
    def __init__(self, amount, currency):
        self.amount, self.currency = amount, currency

    def __eq__(self, other):
        if not isinstance(other, Money):
            return NotImplemented          # NOT False
        return (self.amount, self.currency) == (other.amount, other.currency)

    def __hash__(self):                    # required — see below
        return hash((self.amount, self.currency))
```

**You do not write `__ne__`.** Since Python 3, the default `__ne__` inverts
`__eq__`'s result (and propagates `NotImplemented` correctly). Writing your own
is a chance to get it wrong.

**Defining `__eq__` sets `__hash__` to `None`.** The moment a class defines
`__eq__` without `__hash__`, its instances become unhashable — no dict keys, no
set members, `TypeError: unhashable type`. That is deliberate: two objects that
compare equal must hash equal, and Python cannot guess your new definition of
equal. `@dataclass(frozen=True)` generates both; a plain `@dataclass` generates
`__eq__` and sets `__hash__ = None`, which is why frozen dataclasses are the ones
you can put in a set. Phase 3's data model chunk turns this into the full
`__eq__`/`__hash__` rulebook.

## The rule: `is` is for `None` and for unique sentinels. Nothing else.

The complete list of things `is` is correct for:

```python
if value is None: ...            # None is a singleton, guaranteed
if flag is True: ...             # legal, but `if flag:` is almost always better
if x is _MISSING: ...            # a module-private object() sentinel
if type(a) is type(b): ...       # exact type check, deliberately not isinstance
if a is b: ...                   # "are these literally the same object?" — aliasing checks
```

Everything else is `==`. `x is 0`, `name is "admin"`, `t is (1, 2)` are all
wrong even when they happen to work, and the reason they sometimes work is
chunk [4 · Caching and interning](04-caching-and-interning.md).

Python tries to stop you. Since 3.8 the compiler warns when either operand of
`is` is a constant that is not a named singleton — the exact message, from
`Python/codegen.c`:

```
"is" with 'str' literal. Did you mean "=="?
"is not" with 'int' literal. Did you mean "!="?
```

The exemption list in the compiler is precisely four values: `None`, `True`,
`False` and `Ellipsis` (plus tuples that are not entirely constant). Every other
literal — `0`, `1000`, `"admin"`, `b"x"`, `3.14`, `(1, 2)` — triggers the
warning.

🔴 **A `SyntaxWarning` is a warning, so the code still runs**, and warnings are
routinely invisible in a service's log configuration. Treat it as an error in
CI: `python -W error::SyntaxWarning -m compileall src/`, or let `ruff` catch it
(rule `F632`, "use of `is` with a literal").

## Gotchas

**Symptom:** two objects with identical field values compare unequal in a test
**Cause:** the class defines no `__eq__`, so `==` falls back to identity
**Fix:** define `__eq__` (returning `NotImplemented` for foreign types) or make the class a `@dataclass`. For value objects that go in sets or dict keys, use `@dataclass(frozen=True)` so `__hash__` is generated too

**Symptom:** a class became unhashable — `TypeError: unhashable type` — right after someone added `__eq__`
**Cause:** defining `__eq__` sets `__hash__` to `None` unless you define `__hash__` as well
**Fix:** add `__hash__` returning `hash(...)` of the same fields `__eq__` compares, or use `@dataclass(frozen=True)`. If the object is genuinely mutable, leaving it unhashable is the correct outcome — do not paper over it with `__hash__ = object.__hash__`, which breaks the equal-implies-same-hash invariant

**Symptom:** `if status is "active":` works locally and fails in production
**Cause:** string identity is an interning artefact; the production string arrived from JSON or a socket and is a different object with the same value
**Fix:** `==`. Turn the `SyntaxWarning` into a CI failure so this cannot be committed: `python -W error::SyntaxWarning -m compileall src/`

**Symptom:** an `is` comparison against a literal produced a `SyntaxWarning` that nobody noticed
**Cause:** `SyntaxWarning` is emitted at compile time, and most services never surface Python warnings
**Fix:** run the compile step with `-W error::SyntaxWarning`, or enable `ruff`'s `F632`. A warning you cannot see is not a safety net

**Symptom:** an `id()`-keyed cache returns the wrong object
**Cause:** the original object was collected and a new object was allocated at the same address, so its `id()` collides — the docs allow this explicitly for objects with non-overlapping lifetimes
**Fix:** keep the object alive alongside the key (`{id(obj): (obj, value)}`) or use `weakref.WeakKeyDictionary`. Never persist an `id()` past the point where the object could die

**Symptom:** `x == y` raised an exception in the middle of a `sort` or a `dict` lookup
**Cause:** `==` calls `__eq__`, which is ordinary Python and can raise; `is` cannot
**Fix:** make `__eq__` total — an `isinstance` guard and `return NotImplemented` for anything else. An `__eq__` that raises turns every container operation into a landmine

**Symptom:** `type(x) is MyClass` returns False for a subclass instance
**Cause:** `type(x) is C` is an exact-type check and deliberately excludes subclasses
**Fix:** that is often exactly what you want when dispatching on exact type, but if subclasses should count, use `isinstance(x, MyClass)`. Say which you meant in a comment — a reviewer cannot distinguish an intentional exact-type check from a mistake

**Symptom:** `assert a is b` passes on CPython and fails on PyPy or in a different Python version
**Cause:** identity of objects that are not documented singletons is an implementation choice, and other implementations make different ones
**Fix:** assert on value with `==`, and reserve identity assertions for `None`, for sentinels you created, and for objects you constructed yourself in the test and can point at

**Symptom:** `__hash__ = object.__hash__` was added to "fix" unhashability and now dict lookups miss
**Cause:** identity-based hashing with value-based equality violates the invariant that equal objects hash equal, so two equal objects land in different buckets
**Fix:** either hash the same fields `__eq__` compares, or leave the class unhashable. There is no third option that is correct

## Interview questions

**★ What is the difference between `is` and `==`?**
`is` compares identity — whether two expressions evaluate to the same object,
implemented as a pointer comparison that no class can override, that never calls
user code and never raises. `==` compares value by invoking `__eq__`, which is
arbitrary Python and can be overridden, can be slow, and can raise. If a class
does not define `__eq__`, `==` falls back to identity, which is why the two look
interchangeable on plain classes and are not.

**★ When should you use `is`?**
Against `None`, against `True`/`False` when you specifically mean the singletons
rather than truthiness, against a private sentinel object you created for
"argument not supplied", for exact type checks (`type(a) is type(b)`), and for
deliberate aliasing questions ("is this the same list the caller gave me?"). Not
for numbers, not for strings, not for tuples — those work by accident on CPython
via caching and interning and stop working when the value comes from outside the
program.

**★ Why does `Point(1, 2) == Point(1, 2)` return False?**
Because `Point` does not define `__eq__`, so the default `object.__eq__` runs and
it compares identity. Two separately constructed objects are never identical.
Define `__eq__` — or make the class a `@dataclass`, which generates one comparing
the fields as a tuple. Remember that defining `__eq__` sets `__hash__` to `None`,
so add `__hash__` or use `frozen=True` if the objects need to go in sets or be
dict keys.

**★ Someone writes `if response.status is 200:` and it passes their tests. What do you tell them?**
That it is a latent bug CPython's small-integer cache is hiding: `200` is inside
the `-5..256` range CPython pre-allocates, so every `200` in the process is the
same object. Change the API to return `1000` and the check silently starts
returning `False`. It is also emitting a `SyntaxWarning` their setup is
swallowing. The fix is `==`, and the process fix is `-W error::SyntaxWarning` in
CI. Chunk [4 · Caching and interning](04-caching-and-interning.md) is that
argument in full.

**Why does `id()` not work as a permanent object identifier?**
Because the documented guarantee is only "unique and constant for this object
during its lifetime", and the docs say explicitly that two objects with
non-overlapping lifetimes may share an `id()`. CPython returns the memory
address, and addresses are recycled. Storing `id(obj)` without also storing a
reference to `obj` means the key can outlive the object and then collide with an
unrelated one. Use `weakref` containers, or store the object alongside the id.

**What does `__eq__` returning `NotImplemented` do, and why is it better than returning `False`?**
`NotImplemented` tells the interpreter "I do not know how to compare against
this", so it tries the reflected operation on the other operand before falling
back to identity comparison. `False` is a definitive answer, so it prevents the
other type from ever being consulted. That breaks interoperability: a
`Money.__eq__` that returns `False` for unknown types will report unequal against
a mock, against a subclass, and against a numeric wrapper that would have known
perfectly well how to compare.

**Why does defining `__eq__` make a class unhashable?**
Because the invariant "objects that compare equal must have equal hashes" cannot
be maintained automatically once you redefine equality — the inherited
`object.__hash__` is derived from identity, which no longer matches your notion
of equal. Python's response is to set `__hash__ = None`, making the failure loud
(`TypeError` at the point of use) rather than silent (objects lost in a dict).
Supply `__hash__` over the same fields, or accept unhashability if the object is
mutable.

**Do you ever write `__ne__`?**
No. Since Python 3, the default `__ne__` inverts whatever `__eq__` returns and
propagates `NotImplemented` correctly, so hand-writing it only creates a chance
for `!=` to disagree with `==`. The one case where it is defensible is a type
where "not equal" is genuinely not the negation of "equal" — a three-valued SQL
NULL wrapper, for example — and if you are writing that, you already know why.

---

← Prev: [Default arguments](02b-default-arguments.md) · Index: [Everything is an object](README.md) · Next → [NaN](03b-nan.md)
