---
title: "Hashability is a three-clause contract, not a type check — and a list fails it for a reason the design FAQ spells out in full"
sidebar_label: "05 · Hashability — the contract"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Glossary — *hashable*](https://docs.python.org/3.14/glossary.html#term-hashable), [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__), [Design FAQ — *Why must dictionary keys be immutable?*](https://docs.python.org/3.14/faq/design.html#why-must-dictionary-keys-be-immutable), [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict). The `unhashable type` message text read from `Objects/object.c` at the [CPython **v3.14.7**](https://github.com/python/cpython/blob/v3.14.7/Objects/object.c) tag. Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**"Keys must be immutable" is the folk version and it is wrong in both directions: a tuple containing a list is immutable and unusable as a key, and a plain mutable object with the default `__hash__` is usable as one. The real rule is the glossary's, and it has three clauses — a hash value that never changes for the object's lifetime, an `__eq__`, and the invariant that equal objects hash equal. Everything about what can be a key, and every way keys go wrong, follows from those three sentences.**

## The definition, verbatim

> *"An object is *hashable* if it has a hash value which never changes during its lifetime (it needs a `__hash__()` method), and can be compared to other objects (it needs an `__eq__()` method). Hashable objects which compare equal must have the same hash value."*

> *"Hashability makes an object usable as a dictionary key and a set member, because these data structures use the hash value internally."*

Three clauses, and they do different work:

| Clause | What breaks without it | Where it bites |
|---|---|---|
| a hash that **never changes** | the entry becomes unreachable — it stays in the table, in the wrong bucket | [07 · The key that mutates](03c-the-key-that-mutates.md) |
| an `__eq__` | slot collisions cannot be resolved, and lookup by value stops working | [06 · `__hash__` and `__eq__` in your own classes](03b-hash-and-eq-in-your-own-classes.md) |
| **equal ⇒ same hash** | two equal keys land in different buckets and both exist at once | [08 · Equal keys that collide](03d-equal-keys-that-collide.md) |

The dict-level statement is the same rule, phrased as a restriction on keys:

> *"A dictionary's keys are *almost* arbitrary values. Values that are not hashable, that is, values containing lists, dictionaries or other mutable types (that are compared by value rather than by object identity) may not be used as keys."*

Note the parenthesis — *"(that are compared by value rather than by object identity)"*. That is the real discriminator, and it is why an arbitrary user-defined class **is** hashable by default while a `list` is not: the class compares by identity unless you say otherwise.

## What is hashable, by category

> *"Most of Python's immutable built-in objects are hashable; mutable containers (such as lists or dictionaries) are not; immutable containers (such as tuples and frozensets) are only hashable if their elements are hashable. Objects which are instances of user-defined classes are hashable by default. They all compare unequal (except with themselves), and their hash value is derived from their `id()`."*

```python
hash("abc")                 # str — hashable
hash(42)                    # int — hashable
hash(3.14)                  # float — hashable
hash(None)                  # NoneType — hashable
hash((1, 2, 3))             # tuple of hashables — hashable
hash(frozenset({1, 2}))     # frozenset of hashables — hashable
hash(b"bytes")              # bytes — hashable

hash([1, 2, 3])             # TypeError: unhashable type: 'list'
hash({"a": 1})              # TypeError: unhashable type: 'dict'
hash({1, 2})                # TypeError: unhashable type: 'set'
hash(bytearray(b"x"))       # TypeError: unhashable type: 'bytearray'
```

That `TypeError` text is not invented here: `Objects/object.c` at `v3.14.7` raises it as `PyErr_Format(PyExc_TypeError, "unhashable type: '%.200s'", …)` from `PyObject_HashNotImplemented`, with the type's name substituted.

🔴 **"Immutable" is not the test — *contents* are.** A tuple is immutable and still unhashable if anything inside it is not:

```python
hash((1, 2))                # fine
hash((1, [2]))              # TypeError: unhashable type: 'list'
hash((1, {"a": 2}))         # TypeError: unhashable type: 'dict'
hash((1, frozenset({2})))   # fine — frozenset is hashable
```

The tuple's own `__hash__` hashes its elements, so it inherits every element's unhashability. This is exactly why `frozenset` exists: it is the hashable `set`, so a set of tags can be a dict key when a `set` cannot.

## Why a list cannot be a key — the argument in full

The design FAQ's answer is the most complete statement of the rule anywhere in the documentation, and it is worth reading rather than summarising:

> *"The hash table implementation of dictionaries uses a hash value calculated from the key value to find the key. If the key were a mutable object, its value could change, and thus its hash could also change. But since whoever changes the key object can't tell that it was being used as a dictionary key, it can't move the entry around in the dictionary. Then, when you try to look up the same object in the dictionary it won't be found because its hash value is different. If you tried to look up the old value it wouldn't be found either, because the value of the object found in that hash bin would be different."*

And the fix, in the same breath:

> *"If you want a dictionary indexed with a list, simply convert the list to a tuple first; the function `tuple(L)` creates a tuple with the same entries as the list `L`. Tuples are immutable and can therefore be used as dictionary keys."*

```python
# TypeError: unhashable type: 'list'
route_costs = {}
route_costs[["LHR", "JFK", "SFO"]] = 812.40

# the documented fix
route_costs[("LHR", "JFK", "SFO")] = 812.40
route_costs[tuple(legs)] = price          # when `legs` is a list variable
```

## The rejected designs, and what each would have cost

The FAQ enumerates the alternatives that were considered and dropped. They are worth knowing because each one is something a developer proposes roughly once a year.

**Hash lists by identity.** Rejected because it breaks lookup by value:

> *"This doesn't work because if you construct a new list with the same value it won't be found"* — and the FAQ's conclusion, which is the sentence to remember: *"dictionary keys should be compared using `==`, not using `is`."*

**Copy the list when it is used as a key.** Rejected because *"the list, being a mutable object, could contain a reference to itself, and then the copying code would run into an infinite loop."*

**Allow lists as keys and ask people not to mutate them.** Rejected because it *"would allow a class of hard-to-track bugs"* and, more fundamentally:

🔴 > *"It also invalidates an important invariant of dictionaries: every value in `d.keys()` is usable as a key of the dictionary."*

That invariant is worth stating on its own. It is what makes `{k: f(k) for k in d}` and `other[k]` and `d.keys() & other.keys()` safe. Anything that can appear in a keys view can be used to index the dict, by construction.

**Mark lists read-only once used as a key.** Rejected because *"it's not just the top-level object that could change its value; you could use a tuple containing a list as a key. Entering anything as a key into a dictionary would require marking all objects reachable from there as read-only -- and again, self-referential objects could cause an infinite loop."*

## The escape hatch, and the warning attached to it

The FAQ does give a way to key on mutable data — and then tells you not to:

> *"There is a trick to get around this if you need to, but use it at your own risk: You can wrap a mutable structure inside a class instance which has both an `__eq__` and a `__hash__` method. You must then make sure that the hash value for all such wrapper objects that reside in a dictionary (or other hash based structure), remain fixed while the object is in the dictionary."*

> *"Don't do this unless you are prepared to think hard about the requirements and the consequences of not meeting them correctly. Consider yourself warned."*

In practice the safe version of that idea is not a wrapper with a hand-written hash, it is a **snapshot**: freeze the mutable structure into an immutable one at the moment you use it as a key.

```python
def freeze(value: object) -> object:
    """Convert nested lists/dicts/sets into a hashable equivalent, once."""
    if isinstance(value, dict):
        return frozenset((k, freeze(v)) for k, v in value.items())
    if isinstance(value, (list, tuple)):
        return tuple(freeze(v) for v in value)
    if isinstance(value, set):
        return frozenset(freeze(v) for v in value)
    return value

cache: dict[object, Result] = {}
cache[freeze(request_filters)] = result
```

Note the `frozenset` for dicts rather than a sorted tuple: it makes the key insensitive to the source dict's insertion order, which is usually what you want from a cache key and is *not* what `tuple(d.items())` gives you.

## `None`, functions, classes, and the things people are surprised by

Everything below is hashable, and each surprises someone:

```python
hash(None)                  # NoneType is hashable — {None: "unset"} is a fine dict
hash(print)                 # functions are objects, hashable by identity
hash(int)                   # classes are objects, hashable by identity
hash(Ellipsis)              # ... is hashable
hash(range(3))              # range is immutable and hashable
```

That is what makes the dispatch-table pattern work at all — a dict whose *values* are functions is ordinary, and a dict whose *keys* are classes is how single-dispatch registries are built:

```python
RENDERERS: dict[type, Renderer] = {
    dict: render_mapping,
    list: render_sequence,
    str: render_scalar,
}

renderer = RENDERERS.get(type(obj), render_default)
```

## Gotchas

**★ Symptom: `TypeError: unhashable type: 'list'` on a line that does not obviously contain a list.** Cause: the list is nested inside a tuple, or is the result of a function you did not look inside. A tuple is only hashable *"if their elements are hashable"*, and the error names the offending *element's* type, not the tuple. Fix: freeze the nesting, do not just wrap the top level.

```python
# still fails: the inner list is what is unhashable
key = tuple([user_id, roles])          # roles is a list -> TypeError

# works
key = (user_id, tuple(roles))
```

**★ Symptom: `TypeError: unhashable type: 'dict'` when passing a dict into a `set` or using it as a cache key.** Cause: `dict` is a mutable container, so it is not hashable — the same rule as `list`. Fix: freeze it to a `frozenset` of items, which also drops the order sensitivity you almost certainly do not want in a key.

```python
cache_key = frozenset(filters.items())        # order-insensitive, hashable
```

⚠️ That only works if every *value* in `filters` is itself hashable — `frozenset` hashes its elements, and each element here is a `(key, value)` tuple.

**★ Symptom: a set of tags cannot be used as a dict key.** Cause: `set` is mutable and therefore unhashable; only `frozenset` is *"the immutable container"* that qualifies. Fix: convert at the key boundary.

```python
permissions_by_role: dict[frozenset[str], Permission] = {}
permissions_by_role[frozenset(tags)] = permission
```

**Symptom: `bytearray` fails as a key while `bytes` works.** Cause: `bytearray` is the mutable byte sequence; `bytes` is the immutable one. Fix: `bytes(buf)` at the boundary.

```python
seen: set[bytes] = set()
seen.add(bytes(buffer))       # not the bytearray itself
```

**Symptom: a `tuple(d.items())` cache key misses on dicts that are equal but built in a different order.** Cause: a tuple is order-sensitive; two equal dicts iterate in their own insertion orders, so the tuples differ. Fix: `frozenset(d.items())`, which is order-insensitive by construction.

```python
key = frozenset(params.items())      # {"a":1,"b":2} and {"b":2,"a":1} agree
```

**Symptom: a `defaultdict` or `Counter` used as a key raises `TypeError: unhashable type`.** Cause: both are `dict` subclasses and inherit `dict`'s unhashability. Fix: freeze the same way, or key on the thing that identifies the counter rather than the counter itself.

**Symptom: a `frozenset` key still raises `unhashable type`.** Cause: the frozenset contains something unhashable — *"immutable containers … are only hashable if their elements are hashable"* applies to `frozenset` exactly as it does to `tuple`. Fix: freeze recursively, as the `freeze()` helper above does.

**Symptom: someone "fixes" an unhashable key by calling `str()` or `repr()` on it.** Cause: it makes the `TypeError` go away. It also makes two structurally different objects collide whenever their reprs match, silently, and it makes the key depend on `repr` formatting that is not a stable contract. Fix: freeze into real hashable structure, not into text.

```python
# a landmine: repr is not a stable identity
key = repr(filters)

# a real key
key = frozenset(filters.items())
```

## Interview questions

**★ What makes an object hashable? Do not say "immutable".**
Three properties, and the glossary states all three: it has a hash value *"which never changes during its lifetime"*, it can be compared to other objects (it needs `__eq__`), and *"Hashable objects which compare equal must have the same hash value."* Immutability is the usual *way* to achieve the first property, not the property itself. The proof that they are different: an ordinary user-defined class with mutable attributes is hashable by default — its hash comes from `id()`, which never changes — while a tuple, which is immutable, is unhashable the moment it contains a list.

**★ Why can't a list be a dictionary key?**
Because its hash would change when it changed, and nothing would fix up the table. The FAQ puts it precisely: *"since whoever changes the key object can't tell that it was being used as a dictionary key, it can't move the entry around in the dictionary. Then, when you try to look up the same object in the dictionary it won't be found because its hash value is different."* Note that the entry is not lost — it is stranded in a bucket that no lookup will probe. The documented fix is `tuple(L)`.

**★ Why not just hash lists by their identity, like ordinary objects?**
Because then `d[[1, 2]]` would not find the entry stored under a *different* list that happens to equal `[1, 2]`, which is the whole point of a value-keyed mapping. The FAQ raises and rejects exactly this: *"if you construct a new list with the same value it won't be found"*, and concludes that *"dictionary keys should be compared using `==`, not using `is`."* Identity hashing is what user-defined classes get precisely because they also compare by identity by default — the two decisions have to move together.

**★ Is a tuple always hashable?**
No. *"immutable containers (such as tuples and frozensets) are only hashable if their elements are hashable."* `hash((1, [2]))` raises `TypeError: unhashable type: 'list'` — note the error names `list`, not `tuple`, which is why the traceback confuses people. A tuple's hash is computed from its elements' hashes, so unhashability propagates upward through any depth of nesting.

**Someone needs to cache on a dict of filter parameters. What key do you tell them to use?**
`frozenset(params.items())`, provided the values are hashable, because it is hashable, order-insensitive, and reflects exactly the equality semantics a dict has. `tuple(params.items())` also works and is *wrong in a subtle way*: it is order-sensitive, so two dicts that are `==` produce different cache keys and you get avoidable misses. `str(params)` or `repr(params)` is the answer to avoid entirely — it depends on formatting that is not a stability contract, and two structurally different objects with the same repr silently collide.

**What is the "every value in `d.keys()` is usable as a key" invariant, and why does it matter?**
It is the property the FAQ names when rejecting mutable keys: anything you can get *out* of a keys view can be used to index the dict again. It is what makes `{k: transform(k) for k in d}` safe, what makes `d.keys() & other.keys()` meaningful, and what lets you round-trip a dict through its keys without validation. Allowing mutable keys would break it — a key mutated after insertion would still appear in `d.keys()` while no longer working in `d[k]`.

**What does the FAQ's `ListWrapper` escape hatch actually buy you, and would you use it?**
It buys you a key over mutable data at the cost of a promise you have to keep by hand: *"You must then make sure that the hash value for all such wrapper objects that reside in a dictionary … remain fixed while the object is in the dictionary."* The documentation closes with *"Don't do this unless you are prepared to think hard about the requirements and the consequences of not meeting them correctly. Consider yourself warned."* In application code the safe version of the same idea is a snapshot, not a wrapper — freeze the structure into tuples and frozensets at the moment you key on it, so there is no live mutable object to keep a promise about.

---

← [04 · Working with the order](02b-working-with-the-order.md) · [Topic index](README.md) · Next → [06 · `__hash__` and `__eq__` in your own classes](03b-hash-and-eq-in-your-own-classes.md)
