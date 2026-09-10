---
title: "A tuple is hashable only if every element is — hashability is not a property of the tuple, it is a property the tuple inherits from its worst member"
sidebar_label: "3 · Hashability"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14
> [glossary entry for *hashable*](https://docs.python.org/3.14/glossary.html#term-hashable);
> [Immutable Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#immutable-sequence-types)
> and [Hashing of numeric types](https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types);
> [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__);
> [`hash()`](https://docs.python.org/3.14/library/functions.html#hash);
> the design FAQ —
> [Why must dictionary keys be immutable?](https://docs.python.org/3.14/faq/design.html#why-must-dictionary-keys-be-immutable);
> and CPython 3.14 [`Objects/object.c`](https://github.com/python/cpython/blob/3.14/Objects/object.c)
> for the exact error text. Documentation-verified — **no sandbox run**.
> Version spine: **CPython 3.14**.

**The single operation a tuple has that a list does not is `hash()`, and that one
operation is why tuples exist as a distinct type rather than as a style convention. But
the tuple does not compute a hash of itself — it computes a hash *from its elements*, so
one list anywhere inside it makes the whole thing unhashable, at the moment you try to use
it as a key, with an error message that names the inner type and not the tuple.**

## The one operation that distinguishes an immutable sequence

> *"The only operation that immutable sequence types generally implement that is not also
> implemented by mutable sequence types is support for the :func:`hash` built-in.
>
> This support allows immutable sequences, such as :class:`tuple` instances, to be used as
> :class:`dict` keys and stored in :class:`set` and :class:`frozenset` instances.
>
> **Attempting to hash an immutable sequence that contains unhashable values will result in
> `TypeError`.**"* —
> [Immutable Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#immutable-sequence-types)

Three sentences, and the third is the one people are surprised by. Immutability makes
hashing *legal*; it does not make it *possible*.

## The rule, from the glossary

> *"An object is *hashable* if it has a hash value which never changes during its lifetime
> (it needs a `__hash__` method), and can be compared to other objects (it needs an
> `__eq__` method). Hashable objects which compare equal must have the same hash value."*

> *"Most of Python's immutable built-in objects are hashable; mutable containers (such as
> lists or dictionaries) are not; **immutable containers (such as tuples and frozensets)
> are only hashable if their elements are hashable.**"* —
> [glossary — *hashable*](https://docs.python.org/3.14/glossary.html#term-hashable)

So hashability propagates upward, and unhashability poisons upward:

```python
hash(("acme", 2026, 9))              # fine: str, int, int are all hashable
hash(("acme", ["read", "write"]))    # TypeError: unhashable type: 'list'
hash(("acme", frozenset({"read"})))  # fine: frozenset is hashable
hash(("acme", ({"read"},)))          # TypeError: unhashable type: 'set'
                                     #   — nested two deep, same outcome
```

That error string comes from one `PyErr_Format(PyExc_TypeError, "unhashable type:
'%.200s'", …)` call in CPython's `Objects/object.c`. Note what it names: **the inner type,
not the tuple.** A `TypeError: unhashable type: 'list'` from a line that mentions no list
means a list is nested somewhere in the key you built.

## Why the rule has to exist

The design FAQ gives the mechanical reason, and it is worth reading in full because it is
the argument against every "just let me use a list as a key" workaround:

> *"The hash table implementation of dictionaries uses a hash value calculated from the
> key value to find the key.  If the key were a mutable object, its value could change,
> and thus its hash could also change.  But since whoever changes the key object can't tell
> that it was being used as a dictionary key, it can't move the entry around in the
> dictionary.  Then, when you try to look up the same object in the dictionary it won't be
> found because its hash value is different.  If you tried to look up the old value it
> wouldn't be found either, because the value of the object found in that hash bin would be
> different."* —
> [Why must dictionary keys be immutable?](https://docs.python.org/3.14/faq/design.html#why-must-dictionary-keys-be-immutable)

The entry is not *deleted* — it is *unreachable*. It still occupies a slot, it still shows
up when you iterate, and no lookup will ever find it. That is a strictly worse failure
than a `TypeError`, which is why the `TypeError` exists.

The FAQ also disposes of the obvious escape hatch:

> *"Mark lists as read-only once they are used as a dictionary key.  The problem is that
> it's not just the top-level object that could change its value; **you could use a tuple
> containing a list as a key.**  Entering anything as a key into a dictionary would require
> marking all objects reachable from there as read-only — and again, self-referential
> objects could cause an infinite loop."*

Which is exactly the case this page is about.

## The documented fix: convert, do not wrap

> *"If you want a dictionary indexed with a list, simply convert the list to a tuple first;
> the function ``tuple(L)`` creates a tuple with the same entries as the list ``L``.  Tuples
> are immutable and can therefore be used as dictionary keys."* — the same FAQ

```python
def cache_key(user_id, scopes):
    """scopes arrives as a list; the cache needs a hashable key."""
    return (user_id, tuple(scopes))
```

Two decisions are hiding in that one line, and you must make them deliberately:

- **`tuple(scopes)` keeps order.** `["read", "write"]` and `["write", "read"]` become two
  *different* keys.
- **`frozenset(scopes)` discards order and duplicates.** Both lists become one key.

Pick the one that matches what the key means. For a permission set, `frozenset` is almost
always right and `tuple` is a bug that halves your cache hit rate.

```python
def cache_key(user_id, scopes):
    return (user_id, frozenset(scopes))     # order-insensitive, dedup'd
```

⚠️ `tuple(scopes)` snapshots the list **at that moment**. If the caller mutates `scopes`
afterwards, the key you already stored is unaffected — which is the point — but a later
call with the mutated list produces a different key. That is correct behaviour and a
common source of "why is my cache missing".

## The docs recommend tuples for your own `__hash__`

When you write `__hash__` for a class, the reference tells you to build a tuple:

> *"The only required property is that objects which compare equal have the same hash
> value; it is advised to mix together the hash values of the components of the object that
> also play a part in comparison of objects by **packing them into a tuple and hashing the
> tuple**. Example::
>
>     def __hash__(self):
>         return hash((self.name, self.nick, self.color))"* —
> [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__)

This is the single most common legitimate use of a throwaway tuple in application code:

```python
class ApiKey:
    def __init__(self, tenant, prefix, created):
        self.tenant = tenant
        self.prefix = prefix
        self.created = created

    def __eq__(self, other):
        if not isinstance(other, ApiKey):
            return NotImplemented
        return (self.tenant, self.prefix) == (other.tenant, other.prefix)

    def __hash__(self):
        return hash((self.tenant, self.prefix))
```

🔴 **The fields in `__hash__` must be a subset of the fields in `__eq__`.** Here both use
`(tenant, prefix)` and `created` participates in neither — if `created` were in `__eq__`
but not `__hash__`, the object would still be correct (equal objects would still hash
equal); the reverse would break the contract the glossary states.

The reference is equally clear about the case where you must *not* do this:

> *"If a class defines mutable objects and implements an `__eq__` method, it should not
> implement `__hash__`, since the implementation of hashable collections requires that a
> key's hash value is immutable (if the object's hash value changes, it will be in the
> wrong hash bucket)."*

The two properties of a hash value that most often break a service — equal numbers of
different types collapsing into one key, and the fact that string hashes are salted per
process — are on the next page: [3b · What a hash value is not](03b-what-a-hash-value-is-not.md).

## Gotchas

**★ Symptom: `TypeError: unhashable type: 'list'` on a line that contains no list.**
Cause: a list is nested inside the tuple you used as a key — the error names the inner
type, not the container. Fix: convert the inner sequence at the point the key is built,
choosing `tuple` for order-sensitive and `frozenset` for order-insensitive.

```python
# before
cache[(user_id, scopes)] = result           # scopes is a list
# after
cache[(user_id, frozenset(scopes))] = result
```

**★ Symptom: a cache built on `(user_id, tuple(scopes))` has a hit rate near zero.**
Cause: `tuple()` preserves order, and the scopes arrive in whatever order the database
returned them. Fix: use a `frozenset` when order carries no meaning, or sort before
converting when it does.

```python
key = (user_id, frozenset(scopes))          # order-insensitive
key = (user_id, tuple(sorted(scopes)))      # order-insensitive, still a tuple
```

**★ Symptom: an entry is in the dict, `in` returns `False`, and iteration still shows
it.** Cause: something reachable from the key was mutated after insertion, so the key now
hashes to a different bucket — the FAQ's *"it can't move the entry around in the
dictionary"* case. This requires a custom `__hash__`, because the built-in types refuse to
let you get here. Fix: make the hashed fields immutable, or stop hashing on fields that
change.

```python
class ApiKey:
    __slots__ = ("_tenant", "_prefix")      # no setters; assign once in __init__
    def __hash__(self):
        return hash((self._tenant, self._prefix))
```

**Symptom: `__hash__` and `__eq__` disagree, and a `set` contains two objects that
compare equal.** Cause: `__hash__` used a field `__eq__` ignores, so equal objects landed
in different buckets. Fix: hash a tuple of a *subset* of the fields `__eq__` compares,
never a superset.

```python
def __eq__(self, other): return (self.a, self.b) == (other.a, other.b)
def __hash__(self):      return hash((self.a, self.b))   # same fields
```

**Symptom: an object with a custom `__eq__` became unhashable.** Cause: *"A class that
overrides `__eq__` and does not define `__hash__` will have its `__hash__` implicitly set
to `None`"* — this is documented behaviour, not a bug. Fix: define `__hash__` alongside
`__eq__`, hashing a tuple of the comparison fields.

## Interview questions

**★ Why can a tuple be a dict key but a list cannot?**
Because a dict finds an entry by its hash, and that hash must not change while the entry
is stored. A list can be mutated at any time by anyone holding it, and — as the FAQ
puts it — *"whoever changes the key object can't tell that it was being used as a
dictionary key"*, so nothing can move the entry to its new bucket. The entry would become
unreachable while still occupying a slot. Tuples cannot be re-pointed, so their hash is
stable, so they are safe. Note the framing: the rule is about *stability of hash*, and
immutability is how Python guarantees it.

**★ Is every tuple hashable?**
No, and this is the answer most candidates get wrong. The glossary says immutable
containers *"are only hashable if their elements are hashable"*. `(1, [2])` is a
perfectly legal, immutable tuple that raises `TypeError: unhashable type: 'list'` the
moment you use it as a key or a set member. Immutability of the container is necessary,
not sufficient.

**★ You need a cache keyed on a list of scopes. What do you do?**
Convert it at the boundary, and choose the conversion deliberately. `tuple(scopes)`
preserves order, so `["read","write"]` and `["write","read"]` become distinct keys;
`frozenset(scopes)` discards order and duplicates, so they become one. For a permission
set the frozenset is correct and the tuple is a bug that shows up as a poor hit rate, not
as an exception. The FAQ's own advice is the tuple conversion — *"simply convert the list
to a tuple first"* — because it is the general answer for a *sequence*; when the value is
conceptually a set, say so.

**Why does the reference tell you to hash a tuple inside your own `__hash__`?**
Because it gives you the contract for free. The requirement is that equal objects hash
equal; a tuple of the comparison fields hashes from exactly those fields, so if the
fields are equal the tuple is equal and the hash is equal, by construction. It also
combines the component hashes properly, which is the part people get wrong when they
hand-roll `hash(self.a) ^ hash(self.b)` — XOR loses information and makes `(a, b)` collide
with `(b, a)`.

**Can you store a `set` inside a tuple you plan to use as a key?**
Not a `set` — use a `frozenset`. `set` is mutable and therefore unhashable, so the tuple
inherits that. `frozenset` is the immutable counterpart, is hashable when its elements
are, and is the right component whenever the value is "an unordered collection of
things".

**A tuple containing a list is immutable but unhashable. Is that a contradiction?**
No, it is the distinction between the two properties. Immutability is about the
container's own storage: the tuple's slots cannot be re-pointed. Hashability additionally
requires a *value* that cannot change, and the tuple's value includes the values of its
elements — which the list can change at will. The reference's phrasing covers this
exactly: *"immutability is not strictly the same as having an unchangeable value, it is
more subtle."*

---

← [Writing what you meant](02b-writing-what-you-meant.md) · [Topic index](README.md) · Next → [What a hash value is not](03b-what-a-hash-value-is-not.md)
