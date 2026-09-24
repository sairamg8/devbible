---
name: research-python-p03-t03-dict
description: Banked primary sources for Python phase 3 topic 03 (dict) — verbatim quotes and URLs. Do not re-derive.
metadata:
  type: project
---

# Banked sources — Python Phase 3 · topic 03 · `dict`

**Fetched 2026-09-10. Target: CPython 3.14 (3.14.7).** Every quote below is verbatim
from the reST source of the 3.14 docs (`docs.python.org/3.14/_sources/…`), from the
PEPs, or from the CPython **v3.14.7** tag on GitHub. 🔴 **Do not re-derive** — write
every chunk from this file.

Local interpreter present in this checkout: **Python 3.14.4** (`python3 --version`).
The corpus pins **3.14.7**, so no behaviour was probed on the local build; everything
here is T0/T2.

---

## 1 · stdtypes — Mapping Types — `dict`

URL: <https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict>
Source: <https://docs.python.org/3.14/_sources/library/stdtypes.rst.txt> (lines 5299–5599)

> *"A mapping object maps hashable values to arbitrary objects. Mappings are mutable
> objects. There is currently only one standard mapping type, the dictionary."*

> *"A dictionary's keys are *almost* arbitrary values. Values that are not hashable,
> that is, values containing lists, dictionaries or other mutable types (that are
> compared by value rather than by object identity) may not be used as keys."*

> *"Values that compare equal (such as `1`, `1.0`, and `True`) can be used
> interchangeably to index the same dictionary entry."*

Constructor:

> *"If a positional argument is given and it defines a `keys()` method, a dictionary is
> created by calling `__getitem__` on the argument with each returned key from the
> method. Otherwise, the positional argument must be an iterable object. Each item in
> the iterable must itself be an iterable with exactly two elements. The first element
> of each item becomes a key in the new dictionary, and the second element the
> corresponding value. If a key occurs more than once, the last value for that key
> becomes the corresponding value in the new dictionary."*

> *"If keyword arguments are given, the keyword arguments and their values are added to
> the dictionary created from the positional argument. If a key being added is already
> present, the value from the keyword argument replaces the value from the positional
> argument."*

Equality:

> *"Dictionaries compare equal if and only if they have the same `(key, value)` pairs
> (regardless of ordering). Order comparisons ('<', '<=', '>=', '>') raise
> `TypeError`."*

> *"Providing keyword arguments as in the first example only works for keys that are
> valid Python identifiers. Otherwise, any valid keys can be used."*

🔴 **The order guarantee:**

> *"Dictionaries preserve insertion order. Note that updating a key does not affect the
> order. Keys added after deletion are inserted at the end."*

> *"Changed in version 3.7: Dictionary order is guaranteed to be insertion order. This
> behavior was an implementation detail of CPython from 3.6."*

Methods, verbatim:

| Member | Documented text |
|---|---|
| `list(d)` | *"Return a list of all the keys used in the dictionary d."* |
| `d[key]` | *"Return the item of d with key key. Raises a `KeyError` if key is not in the map."* |
| `__missing__` | *"If a subclass of dict defines a method `__missing__` and key is not present, the `d[key]` operation calls that method with the key key as argument. The `d[key]` operation then returns or raises whatever is returned or raised by the `__missing__(key)` call. No other operations or methods invoke `__missing__`. If `__missing__` is not defined, `KeyError` is raised. `__missing__` must be a method; it cannot be an instance variable"* — *"The example above shows part of the implementation of `collections.Counter`. A different `__missing__` method is used by `collections.defaultdict`."* |
| `iter(d)` | *"Return an iterator over the keys of the dictionary. This is a shortcut for `iter(d.keys())`."* |
| `clear()` | *"Remove all items from the dictionary."* |
| `copy()` | *"Return a shallow copy of the dictionary."* |
| `fromkeys(iterable, value=None, /)` | *"Create a new dictionary with keys from iterable and values set to value."* — 🔴 *"`fromkeys` is a class method that returns a new dictionary. value defaults to `None`. **All of the values refer to just a single instance, so it generally doesn't make sense for value to be a mutable object such as an empty list. To get distinct values, use a dict comprehension instead.**"* |
| `get(key, default=None, /)` | *"Return the value for key if key is in the dictionary, else default. If default is not given, it defaults to `None`, so that this method never raises a `KeyError`."* |
| `items()` | *"Return a new view of the dictionary's items (`(key, value)` pairs)."* |
| `keys()` | *"Return a new view of the dictionary's keys."* |
| `pop(key, /)` / `pop(key, default, /)` | *"If key is in the dictionary, remove it and return its value, else return default. If default is not given and key is not in the dictionary, a `KeyError` is raised."* |
| `popitem()` | *"Remove and return a `(key, value)` pair from the dictionary. Pairs are returned in LIFO (last-in, first-out) order."* — *"`popitem` is useful to destructively iterate over a dictionary, as often used in set algorithms. If the dictionary is empty, calling `popitem` raises a `KeyError`."* — *"Changed in version 3.7: LIFO order is now guaranteed. In prior versions, `popitem` would return an arbitrary key/value pair."* |
| `reversed(d)` | *"Return a reverse iterator over the keys of the dictionary. This is a shortcut for `reversed(d.keys())`."* — *"Added in version 3.8."* |
| `setdefault(key, default=None, /)` | *"If key is in the dictionary, return its value. If not, insert key with a value of default and return default. default defaults to `None`."* |
| `update(...)` | *"Update the dictionary with the key/value pairs from mapping or iterable and kwargs, overwriting existing keys. **Return `None`.**"* — *"`update` accepts either another object with a `keys()` method (in which case `__getitem__` is called with every key returned from the method) or an iterable of key/value pairs (as tuples or other iterables of length two). If keyword arguments are specified, the dictionary is then updated with those key/value pairs: `d.update(red=1, blue=2)`."* |
| `values()` | *"Return a new view of the dictionary's values."* — 🔴 *"An equality comparison between one `dict.values()` view and another will always return `False`. This also applies when comparing `dict.values()` to itself"* (doc example: `d.values() == d.values()` → `False`). |
| `d \| other` | *"Create a new dictionary with the merged keys and values of d and other, **which must both be dictionaries**. The values of other take priority when d and other share keys."* — *"Added in version 3.9."* |
| `d \|= other` | *"Update the dictionary d with keys and values from other, **which may be either a mapping or an iterable of key/value pairs**. The values of other take priority when d and other share keys."* — *"Added in version 3.9."* |

> *"Dictionaries and dictionary views are reversible."* — *"Changed in version 3.8:
> Dictionaries are now reversible."*

> *"`types.MappingProxyType` can be used to create a read-only view of a `dict`."*

---

## 2 · stdtypes — Dictionary view objects

URL: <https://docs.python.org/3.14/library/stdtypes.html#dictionary-view-objects>

> *"The objects returned by `dict.keys()`, `dict.values()` and `dict.items()` are *view
> objects*. They provide a dynamic view on the dictionary's entries, which means that
> when the dictionary changes, the view reflects these changes."*

> *"Keys and values are iterated over in insertion order. This allows the creation of
> `(value, key)` pairs using `zip()`: `pairs = zip(d.values(), d.keys())`. Another way
> to create the same list is `pairs = [(v, k) for (k, v) in d.items()]`."*

🔴 > *"Iterating views while adding or deleting entries in the dictionary may raise a
> `RuntimeError` or fail to iterate over all entries."*

> *"`x in dictview` — Return `True` if x is in the underlying dictionary's keys, values
> or items (in the latter case, x should be a `(key, value)` tuple)."*

> *"`reversed(dictview)` — Return a reverse iterator over the keys, values or items of
> the dictionary. The view will be iterated in reverse order of the insertion."*
> (Changed in 3.8.)

> *"`dictview.mapping` — Return a `types.MappingProxyType` that wraps the original
> dictionary to which the view refers."* — *"Added in version 3.10."*

🔴 **Set-likeness:**

> *"Keys views are set-like since their entries are unique and hashable. Items views
> also have set-like operations since the (key, value) pairs are unique and the keys
> are hashable. If all values in an items view are hashable as well, then the items
> view can interoperate with other sets. **(Values views are not treated as set-like
> since the entries are generally not unique.)** For set-like views, all of the
> operations defined for the abstract base class `collections.abc.Set` are available
> (for example, `==`, `<`, or `^`). While using set operators, set-like views accept
> any iterable as the other operand, unlike sets which only accept sets as the input."*

Doc's own worked example (do not present as our own run):
`keys & {'eggs', 'bacon', 'salad'}` → `{'bacon'}`;
`keys | ['juice', 'juice', 'juice'] == {'bacon', 'spam', 'juice'}` → `True`;
`values.mapping` → `mappingproxy({'bacon': 1, 'spam': 500})`.

---

## 3 · Glossary

URL: <https://docs.python.org/3.14/glossary.html#term-hashable>

> *"An object is *hashable* if it has a hash value which never changes during its
> lifetime (it needs a `__hash__()` method), and can be compared to other objects (it
> needs an `__eq__()` method). Hashable objects which compare equal must have the same
> hash value."*

> *"Hashability makes an object usable as a dictionary key and a set member, because
> these data structures use the hash value internally."*

> *"Most of Python's immutable built-in objects are hashable; mutable containers (such
> as lists or dictionaries) are not; immutable containers (such as tuples and
> frozensets) are only hashable if their elements are hashable. Objects which are
> instances of user-defined classes are hashable by default. They all compare unequal
> (except with themselves), and their hash value is derived from their `id()`."*

URL: <https://docs.python.org/3.14/glossary.html#term-dictionary-view>

> *"The objects returned from `dict.keys()`, `dict.values()`, and `dict.items()` are
> called dictionary views. They provide a dynamic view on the dictionary's entries,
> which means that when the dictionary changes, the view reflects these changes.
> **To force the dictionary view to become a full list use `list(dictview)`.**"*

URL: <https://docs.python.org/3.14/glossary.html#term-mapping>

> *"A container object that supports arbitrary key lookups and implements the methods
> specified in the `collections.abc.Mapping` or `collections.abc.MutableMapping`
> abstract base classes. Examples include `dict`, `collections.defaultdict`,
> `collections.OrderedDict` and `collections.Counter`."*

---

## 4 · Data model — `object.__hash__`

URL: <https://docs.python.org/3.14/reference/datamodel.html#object.__hash__>

> *"Called by built-in function `hash()` and for operations on members of hashed
> collections including `set`, `frozenset`, and `dict`. The `__hash__()` method should
> return an integer. The only required property is that objects which compare equal
> have the same hash value; it is advised to mix together the hash values of the
> components of the object that also play a part in comparison of objects by packing
> them into a tuple and hashing the tuple."*

Doc's own example:

```python
def __hash__(self):
    return hash((self.name, self.nick, self.color))
```

🔴 > *"If a class does not define an `__eq__()` method it should not define a
> `__hash__()` operation either; if it defines `__eq__()` but not `__hash__()`, its
> instances will not be usable as items in hashable collections. If a class defines
> mutable objects and implements an `__eq__()` method, it should not implement
> `__hash__()`, since the implementation of hashable collections requires that a key's
> hash value is immutable (if the object's hash value changes, it will be in the wrong
> hash bucket)."*

> *"User-defined classes have `__eq__()` and `__hash__()` methods by default (inherited
> from the `object` class); with them, all objects compare unequal (except with
> themselves) and `x.__hash__()` returns an appropriate value such that `x == y`
> implies both that `x is y` and `hash(x) == hash(y)`."*

🔴 > *"A class that overrides `__eq__()` and does not define `__hash__()` will have its
> `__hash__()` implicitly set to `None`. When the `__hash__()` method of a class is
> `None`, instances of the class will raise an appropriate `TypeError` when a program
> attempts to retrieve their hash value, and will also be correctly identified as
> unhashable when checking `isinstance(obj, collections.abc.Hashable)`."*

> *"If a class that overrides `__eq__()` needs to retain the implementation of
> `__hash__()` from a parent class, the interpreter must be told this explicitly by
> setting `__hash__ = <ParentClass>.__hash__`."*

> *"If a class that does not override `__eq__()` wishes to suppress hash support, it
> should include `__hash__ = None` in the class definition. A class which defines its
> own `__hash__()` that explicitly raises a `TypeError` would be incorrectly identified
> as hashable by an `isinstance(obj, collections.abc.Hashable)` call."*

> *"`hash()` truncates the value returned from an object's custom `__hash__()` method
> to the size of a `Py_ssize_t`. This is typically 8 bytes on 64-bit builds and 4 bytes
> on 32-bit builds."*

🔴 **Hash randomisation:**

> *"By default, the `__hash__()` values of str and bytes objects are "salted" with an
> unpredictable random value. Although they remain constant within an individual Python
> process, they are not predictable between repeated invocations of Python."*

> *"This is intended to provide protection against a denial-of-service caused by
> carefully chosen inputs that exploit the worst case performance of a dict insertion,
> *O*(*n*²) complexity."*

---

## 5 · Time complexity (new dedicated doc page in 3.13+/3.14)

URL: <https://docs.python.org/3.14/library/time-complexity.html>

> *"This page documents the time complexity of various operations on built-in types in
> CPython. Other Python implementations may have different performance characteristics.
> Additionally, the listed costs assume exact built-in types, as instances of
> subclasses may have different costs."*

🔴 > *"The times listed for dict objects are average-case times, as they assume the
> hash function for the objects is sufficiently robust to make collisions uncommon.
> They also assume the keys are well-distributed among the set of possible keys. **In
> the worst case, when every key hashes to the same value, each of the *O*(1)
> operations below instead takes *O*(*n*) time.** They also assume that hashing and
> comparing a key is *O*(1)."*

| Operation | Complexity (as documented) |
|---|---|
| `key in d` | *O*(1) |
| `d.copy()` | *O*(*n*) |
| `d[key]`, `d.get(key)` | *O*(1) |
| `d[key] = value` | *O*(1) |
| `del d[key]`, `d.pop(key)` | *O*(1) |
| `d.update(t)`, `d \|= t` | *O*(len(*t*)) |
| Iteration | *O*(*n*) |
| `len(d)` | *O*(1) |

---

## 6 · Design FAQ

URL: <https://docs.python.org/3.14/faq/design.html#how-are-dictionaries-implemented-in-cpython>

> *"CPython's dictionaries are implemented as resizable hash tables. Compared to
> B-trees, this gives better performance for lookup (the most common operation by far)
> under most circumstances, and the implementation is simpler."*

> *"Dictionaries work by computing a hash code for each key stored in the dictionary
> using the `hash()` built-in function. The hash code varies widely depending on the
> key and a per-process seed … The hash code is then used to calculate a location in an
> internal array where the value will be stored. Assuming that you're storing keys that
> all have different hash values, this means that dictionaries take constant time --
> *O*(1), in Big-O notation -- to retrieve a key."*

URL: <https://docs.python.org/3.14/faq/design.html#why-must-dictionary-keys-be-immutable>

🔴 > *"The hash table implementation of dictionaries uses a hash value calculated from
> the key value to find the key. If the key were a mutable object, its value could
> change, and thus its hash could also change. But since whoever changes the key object
> can't tell that it was being used as a dictionary key, it can't move the entry around
> in the dictionary. Then, when you try to look up the same object in the dictionary it
> won't be found because its hash value is different. If you tried to look up the old
> value it wouldn't be found either, because the value of the object found in that hash
> bin would be different."*

> *"If you want a dictionary indexed with a list, simply convert the list to a tuple
> first; the function `tuple(L)` creates a tuple with the same entries as the list `L`.
> Tuples are immutable and can therefore be used as dictionary keys."*

Rejected alternative, with the invariant it would break:

> *"Allow lists as keys but tell the user not to modify them. This would allow a class
> of hard-to-track bugs in programs when you forgot or modified a list by accident. It
> also invalidates an important invariant of dictionaries: **every value in `d.keys()`
> is usable as a key of the dictionary.**"*

> *"dictionary keys should be compared using `==`, not using `is`."*

> *"Furthermore it must always be the case that if `o1 == o2` (ie `o1.__eq__(o2) is
> True`) then `hash(o1) == hash(o2)` … If you fail to meet these restrictions
> dictionaries and other hash based structures will misbehave."*

The FAQ's `ListWrapper` escape hatch closes with:

> *"Don't do this unless you are prepared to think hard about the requirements and the
> consequences of not meeting them correctly. Consider yourself warned."*

---

## 7 · The order guarantee — history

**Python 3.6 whatsnew** (<https://docs.python.org/3.14/whatsnew/3.6.html#new-dict-implementation>):

> *"The `dict` type now uses a "compact" representation based on a proposal by Raymond
> Hettinger which was first implemented by PyPy. The memory usage of the new `dict()`
> is between 20% and 25% smaller compared to Python 3.5."*

🔴 > *"The order-preserving aspect of this new implementation is considered an
> implementation detail and should not be relied upon (this may change in the future,
> but it is desired to have this new dict implementation in the language for a few
> releases before changing the language spec to mandate order-preserving semantics for
> all current and future Python implementations; this also helps preserve
> backwards-compatibility with older versions of the language where random iteration
> order is still in effect, e.g. Python 3.5)."*

**Python 3.7 whatsnew** (<https://docs.python.org/3.14/whatsnew/3.7.html>):

🔴 > *"the insertion-order preservation nature of `dict` objects has been declared to be
> an official part of the Python language spec."*

The link on *"has been declared"* points at:
<https://mail.python.org/pipermail/python-dev/2017-December/151283.html> — Guido van
Rossum, python-dev, *"Guarantee ordered dict literals in v3.7?"*, Fri 15 Dec 2017:

🔴 > *"Make it so. "Dict keeps insertion order" is the ruling. Thanks!"*

**PEP 468** — *Preserving the order of `**kwargs` in a function.* Status Final,
Python-Version 3.6. <https://peps.python.org/pep-0468/>

> *"The `**kwargs` syntax in a function definition indicates that the interpreter should
> collect all keyword arguments that do not correspond to other named parameters.
> However, Python does not preserved the order in which those collected keyword
> arguments were passed to the function. In some contexts the order matters. This PEP
> dictates that the collected keyword arguments be exposed in the function body as an
> ordered mapping."*

> *"Starting in version 3.6 Python will preserve the order of keyword arguments as
> passed to a function. To accomplish this the collected kwargs will now be an ordered
> mapping. Note that this does not necessarily mean OrderedDict. dict in CPython 3.6 is
> now ordered, similar to PyPy."*

**PEP 520** — *Preserving Class Attribute Definition Order.* Status Final,
Python-Version 3.6. <https://peps.python.org/pep-0520/>

> *"Note: Since compact dict has landed in 3.6, `__definition_order__` has been
> removed. `cls.__dict__` now mostly accomplishes the same thing instead."*

**Language reference, function definitions**
(<https://docs.python.org/3.14/reference/compound_stmts.html#function-definitions>):

> *"If the form "`**identifier`" is present, it is initialized to a new ordered mapping
> receiving any excess keyword arguments, defaulting to a new empty mapping of the same
> type."*

---

## 8 · PEP 584 — `|` and `|=`

URL: <https://peps.python.org/pep-0584/>

> *"This PEP proposes adding merge (`|`) and update (`|=`) operators to the built-in
> dict class."*

> *"Note: After this PEP was accepted, the decision was made to also implement the new
> operators for several other standard library mappings."*

Motivation, against each existing spelling:

> *"`d1.update(d2)` modifies d1 in-place. `e = d1.copy(); e.update(d2)` is not an
> expression and needs a temporary variable."*

> *"Dict unpacking looks ugly and is not easily discoverable. Few people would be able
> to guess what it means the first time they see it, or think of it as the "obvious
> way" to merge two dicts."*

Guido, quoted inside the PEP:

> *"I'm sorry for PEP 448, but even if you know about `**d` in simpler contexts, if you
> were to ask a typical Python user how to combine two dicts into a new one, I doubt
> many people would think of `{**d1, **d2}`. I know I myself had forgotten about it when
> this thread started!"*

🔴 > *"`{**d1, **d2}` ignores the types of the mappings and always returns a dict.
> `type(d1)({**d1, **d2})` fails for dict subclasses such as defaultdict that have an
> incompatible `__init__` method."*

> *"`dict(d1, **d2)` — This "neat trick" is not well-known, and only works when d2 is
> entirely string-keyed"* (the PEP's own example raises `TypeError: keywords must be
> strings`).

On `ChainMap`:

> *"ChainMap is unfortunately poorly-known and doesn't qualify as "obvious". It also
> resolves duplicate keys in the opposite order to that expected ("first seen wins"
> instead of "last seen wins")."* … *"Further, ChainMaps wrap their underlying dicts, so
> writes to the ChainMap will modify the original dict."*

Rationale:

🔴 > *"Key conflicts will be resolved by keeping the rightmost value. This matches the
> existing behavior of similar dict operations, where the last seen value always wins"*
> — the PEP lists `{'a': 1, 'a': 2}`, `{**d, **e}`, `d.update(e)`, `d[k] = v`,
> `{k: v for x in (d, e) for (k, v) in x.items()}` and says *"All of the above follow
> the same rule."*

> *"This means that dict union is not commutative; in general `d | e != e | d`."*

> *"Similarly, the iteration order of the key-value pairs in the dictionary will follow
> the same semantics as the examples above, with each newly added key (and its value)
> being appended to the current sequence."*

Specification:

> *"Dict union will return a new dict consisting of the left operand merged with the
> right operand, each of which must be a dict (or an instance of a dict subclass). If a
> key appears in both operands, the last-seen value (i.e. that from the right-hand
> operand) wins"*

🔴 > *"Augmented assignment behaves identically to the update method called with a
> single positional argument, so it also accepts anything implementing the Mapping
> protocol (more specifically, anything with the `keys` and `__getitem__` methods) or
> iterables of key-value pairs. This is analogous to `list +=` and `list.extend`, which
> accept any iterable, not just lists."*

The PEP's own examples of the asymmetry: `d | [('spam', 999)]` raises
`TypeError: can only merge dict (not "list") to dict`, while `d |= [('spam', 999)]`
succeeds.

> *"When new keys are added, their order matches their order within the right-hand
> mapping, if any exists for its type."*

Reference implementation given in the PEP:

```python
def __or__(self, other):
    if not isinstance(other, dict):
        return NotImplemented
    new = dict(self)
    new.update(other)
    return new
```

On chained merges:

> *"Repeated dict union is inefficient: `d | e | f | g | h` creates and destroys three
> temporary mappings."* … *"If one expects to be merging a large number of dicts where
> performance is an issue, it may be better to use an explicit loop and in-place
> merging"* — the PEP's own recommended shape:

```python
new = {}
for d in many_dicts:
    new |= d
```

On the rest of the set API:

> *"This PEP does not take a position on whether dicts should support the full
> collection of set operators, and would prefer to leave that for a later PEP."*
> On `&`: *"Set intersection (`&`) is a bit more problematic. While it is easy to
> determine the intersection of keys in two dicts, it is not clear what to do with the
> values."*

On `Mapping`/`MutableMapping` not getting the operators:

> *"Currently, neither defines a `copy` method, which would be necessary for `|` to
> create a new instance."*

Rejected conflict semantics — *raise*, *add the values*, *first-seen wins*, *concatenate
into a list* — all *"left to subclasses of dict"*.

---

## 9 · Dictionary displays and comprehensions (language reference)

URL: <https://docs.python.org/3.14/reference/expressions.html#dictionary-displays>

> *"If a comma-separated sequence of dict items is given, they are evaluated from left
> to right to define the entries of the dictionary: each key object is used as a key
> into the dictionary to store the corresponding value. This means that you can specify
> the same key multiple times in the dict item list, and the final dictionary's value
> for that key will be the last one given."*

> *"A double asterisk `**` denotes dictionary unpacking. Its operand must be a mapping.
> Each mapping item is added to the new dictionary. Later values replace values already
> set by earlier dict items and earlier dictionary unpackings."* — *"Added in version
> 3.5: Unpacking into dictionary displays, originally proposed by PEP 448."*

> *"When the comprehension is run, the resulting key and value elements are inserted in
> the new dictionary in the order they are produced."*

> *"Clashes between duplicate keys are not detected; the last value (textually
> rightmost in the display) stored for a given key value prevails."*

> *"Changed in version 3.8: Prior to Python 3.8, in dict comprehensions, the evaluation
> order of key and value was not well-defined. In CPython, the value was evaluated
> before the key. Starting with 3.8, the key is evaluated before the value, as proposed
> by PEP 572."*

---

## 10 · Numbers, `bool`, and the `1 == 1.0 == True` collision

URL: <https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex>

> *"There are three distinct numeric types: integers, floating-point numbers, and
> complex numbers. In addition, **Booleans are a subtype of integers.**"*

URL: <https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types>

> *"For numbers `x` and `y`, possibly of different types, it's a requirement that
> `hash(x) == hash(y)` whenever `x == y` … Python's hash for numeric types is based on
> a single mathematical function that's defined for any rational number … Essentially,
> this function is given by reduction modulo `P` for a fixed prime `P`. The value of
> `P` is made available to Python as the `modulus` attribute of `sys.hash_info`."*

URL: <https://docs.python.org/3.14/library/functions.html#hash>

> *"Return the hash value of the object (if it has one). Hash values are integers. They
> are used to quickly compare dictionary keys during a dictionary lookup. **Numeric
> values that compare equal have the same hash value (even if they are of different
> types, as is the case for 1 and 1.0).**"*

---

## 11 · Hash randomisation — the knobs

URL: <https://docs.python.org/3.14/using/cmdline.html#envvar-PYTHONHASHSEED>

> *"If this variable is not set or set to `random`, a random value is used to seed the
> hashes of str and bytes objects."*

> *"If `PYTHONHASHSEED` is set to an integer value, it is used as a fixed seed for
> generating the hash() of the types covered by the hash randomization."*

> *"Its purpose is to allow repeatable hashing, such as for selftests for the
> interpreter itself, or to allow a cluster of python processes to share hash values."*

> *"The integer must be a decimal number in the range [0,4294967295]. Specifying the
> value 0 will disable hash randomization."*

URL: <https://docs.python.org/3.14/using/cmdline.html#cmdoption-R>

> *"Turn on hash randomization. This option only has an effect if the `PYTHONHASHSEED`
> environment variable is set to anything other than `random`, since hash randomization
> is enabled by default."*

> *"Hash randomization is intended to provide protection against a denial-of-service
> caused by carefully chosen inputs that exploit the worst case performance of a dict
> construction, *O*(*n*²) complexity."*

---

## 12 · `dict` thread safety — new page, free-threaded builds

URL: <https://docs.python.org/3.14/library/threadsafety.html#thread-safety-for-dict-objects>

> *"This page documents thread-safety guarantees for built-in types in Python's
> free-threaded build. The guarantees described here apply when using Python with the
> GIL disabled (free-threaded mode). When the GIL is enabled, most operations are
> implicitly serialized."*

> *"Creating a dictionary with the `dict` constructor is atomic when the argument to it
> is a `dict` or a `tuple`. When using the `dict.fromkeys` method, dictionary creation
> is atomic when the argument is a `dict`, `tuple`, `set` or `frozenset`."*

> *"The following operations and functions are lock-free and atomic"* — `d[key]`,
> `d.get(key)`, `key in d`, `len(d)`. *"All other operations from here on hold the
> per-object lock."*

> *"Writing or removing a single item is safe to call from multiple threads and will
> not corrupt the dictionary"* — `d[key] = value`, `del d[key]`, `d.pop(key)`,
> `d.popitem()`, `d.setdefault(key, v)`.

> *"These operations may compare keys using `__eq__()`, which can execute arbitrary
> Python code. During such comparisons, the dictionary may be modified by another
> thread. For built-in types like `str`, `int`, and `float`, that implement `__eq__()`
> in C, the underlying lock is not released during comparisons and this is not a
> concern."*

🔴 > *"Operations that involve multiple accesses, as well as iteration, are never
> atomic"* — the doc's own three `bad` examples:

```python
# NOT atomic: read-modify-write
d[key] = d[key] + 1

# NOT atomic: check-then-act (TOCTOU)
if key in d:
    del d[key]

# NOT thread-safe: iteration while modifying
for key, value in d.items():
    process(key)  # another thread may modify d
```

The doc's own fixes:

```python
# Use pop() with default instead of check-then-delete
d.pop(key, None)

# Make a copy to iterate safely
for key, value in d.copy().items():
    process(key)
```

> *"Consider external synchronization when sharing `dict` instances across threads."*

---

## 13 · `collections` — where `dict` stops

URL: <https://docs.python.org/3.14/library/collections.html#ordereddict-objects>

> *"Ordered dictionaries are just like regular dictionaries but have some extra
> capabilities relating to ordering operations. They have become less important now
> that the built-in `dict` class gained the ability to remember insertion order (this
> new behavior became guaranteed in Python 3.7)."*

> *"The equality operation for `OrderedDict` checks for matching order. A regular `dict`
> can emulate the order sensitive equality test with `p == q and all(k1 == k2 for k1, k2
> in zip(p, q))`."*

> *"A regular `dict` can emulate OrderedDict's `od.popitem(last=True)` with
> `d.popitem()` which is guaranteed to pop the rightmost (last) item."*

> *"A regular `dict` can emulate OrderedDict's `od.popitem(last=False)` with
> `(k := next(iter(d)), d.pop(k))` which will return and remove the leftmost (first)
> item if it exists."*

> *"A regular `dict` can emulate OrderedDict's `od.move_to_end(k, last=True)` with
> `d[k] = d.pop(k)` which will move the key and its associated value to the rightmost
> (last) position."*

> *"A regular `dict` does not have an efficient equivalent for OrderedDict's
> `od.move_to_end(k, last=False)` which moves the key and its associated value to the
> leftmost (first) position."*

URL: <https://docs.python.org/3.14/library/collections.html#defaultdict-objects>

> *"`defaultdict` is a subclass of the built-in `dict` class. It overrides one method
> and adds one writable instance variable."*

> *"This technique is simpler and faster than an equivalent technique using
> `dict.setdefault()`"* — the docs' own `setdefault` comparison is
> `d.setdefault(k, []).append(v)`.

URL: <https://docs.python.org/3.14/library/collections.html#counter-objects>

🔴 `Counter` overrides `|`: *"Intersection and union return the minimum and maximum of
corresponding counts."* Doc example: `c | d  # union:  max(c[x], d[x])`.

---

## 14 · CPython v3.14.7 source — error strings and implementation detail

🔴 Everything in this section is **CPython implementation detail**, not language
guarantee, except the two error strings, which are what a reader sees.

`Objects/dictobject.c` @ v3.14.7
(<https://github.com/python/cpython/blob/v3.14.7/Objects/dictobject.c>):

- `"dictionary changed size during iteration"` — `PyErr_SetString(PyExc_RuntimeError, …)`
  guarded by `if (di->di_used != d->ma_used)`, i.e. the iterator captured the length at
  creation and compares it on every step (lines 5238–5244 and four sibling iterators).
  The comment `di->di_used = -1; /* Make this state sticky */` follows.
- `"dictionary keys changed during iteration"` — a second `RuntimeError`, raised when an
  element is found but the iterator's remaining count has already reached zero
  (`if (di->len == 0)`, line ~5279): same-size replacement, not a size change.
- `"popitem(): dictionary is empty"` — `PyErr_SetString(PyExc_KeyError, …)`, line 4620.
- `#define PyDict_MINSIZE 8` with the comment *"PyDict_MINSIZE is the starting size for
  any new dict. 8 allows dicts with no more than 5 active entries; experiments suggested
  this suffices for the majority of dicts (consisting mostly of usually-small dicts
  created to pass keyword arguments)."*
- `#define USABLE_FRACTION(n) (((n) << 1)/3)` with *"USABLE_FRACTION is the maximum
  dictionary load. Increasing this ratio makes dictionaries more dense resulting in more
  collisions. … Fractions around 1/2 to 2/3 seem to work well in practice."*
- `#define GROWTH_RATE(d) ((d)->ma_used*3)` with *"GROWTH_RATE. Growth rate upon hitting
  maximum load. Currently set to used*3. This means that dicts double in size when
  growing without deletions, but have more head room when the number of deletions is on
  a par with the number of insertions."*
- Header comment: *"As of Python 3.6, this is compact and ordered."* Slot kinds are
  **Unused / Active / Dummy / Pending**; *"Dummy slots cannot be made Unused again else
  the probe sequence in case of collision would have no way to know they were once
  active."*
- *"Preserving insertion order — It's simple for combined table. Since dk_entries is
  mostly append only, we can get insertion order by just iterating dk_entries. One
  exception is .popitem(). It removes last item in dk_entries and decrement dk_nentries
  to achieve amortized O(1)."*
- `dict_or` is literally `PyObject *new = PyDict_Copy(self); … dict_update_arg(new, other)`
  after `if (!PyDict_Check(self) || !PyDict_Check(other)) Py_RETURN_NOTIMPLEMENTED;`
  (line 4776). `PyDict_Copy` produces an exact `dict`, so **a plain `dict` subclass that
  does not override `__or__` gets a plain `dict` back from `|`.**
- `dict_ior` is `dict_update_arg(self, other); return Py_NewRef(self);` — so `|=`
  returns the same object and accepts anything `update` accepts.

`Objects/object.c` @ v3.14.7: `PyObject_HashNotImplemented` raises
`PyErr_Format(PyExc_TypeError, "unhashable type: '%.200s'", …)` — the source of the
`TypeError: unhashable type: 'list'` message.

`Modules/_collectionsmodule.c` @ v3.14.7: `defdict_or` builds the result with
`new_defdict(self, left)` and carries the comment *"Like copy(), this calls the object's
class. Override `__or__`/`__ror__` for subclasses with different constructors."* — so
`defaultdict | dict` **does** keep `defaultdict` and its `default_factory`, unlike a
bare `dict` subclass.

---

## 15 · Sorting and serialisation

URL: <https://docs.python.org/3.14/library/functions.html#sorted>

> *"Return a new sorted list from the items in iterable."* … *"The built-in `sorted()`
> function is guaranteed to be stable. A sort is stable if it guarantees not to change
> the relative order of elements that compare equal --- this is helpful for sorting in
> multiple passes (for example, sort by department, then by salary grade)."*

URL: <https://docs.python.org/3.14/library/json.html> — `json.dumps(…, sort_keys=False)`
is the signature default; the docs' own example is
`json.dumps({"c": 0, "b": 0, "a": 0}, sort_keys=True)` → `{"a": 0, "b": 0, "c": 0}`.

---

## 16 · Claims I could NOT settle from primary sources

- **Whether a non-CPython implementation is *required* to make `dict` compact.** The
  guarantee in the 3.7 whatsnew is about **insertion order** only; the compact layout is
  described in the 3.6 whatsnew as an implementation change. No doc sentence says other
  implementations must adopt the layout. Write the boundary, not a claim about layout.
- **Exact memory figures for `dict` vs `list` at small N on 3.14.** The only documented
  number is the 3.6-vs-3.5 *"between 20% and 25% smaller"*. Nothing in the 3.14 docs
  gives per-object byte counts. **No sandbox — do not state byte counts.**
- **Whether `dict.get` short-circuits evaluation of its default.** No doc sentence
  addresses it directly; the general call-evaluation rule in the language reference
  covers it (arguments are evaluated before the call). State it as a consequence of call
  semantics, not as a `dict`-specific documented rule.
- **`sys.hash_info.width` on this machine** — the datamodel doc gives the command
  (`python -c "import sys; print(sys.hash_info.width)"`) but not the value. Do not
  publish a number.

---

# Appendix — fetched 2026-09-10 by the resume session (chunks 05b … 11)

Same rules: verbatim, 3.14 reST sources or the CPython **v3.14.7** tag. Do not re-derive.

## 17 · `json` — keys

URL: <https://docs.python.org/3.14/library/json.html>

> *"Keys in key/value pairs of JSON are always of the type `str`. When a dictionary is
> converted into JSON, all the keys of the dictionary are coerced to strings. As a result
> of this, if a dictionary is converted into JSON and then back into a dictionary, the
> dictionary may not equal the original one. That is, `loads(dumps(x)) != x` if x has
> non-string keys."*

> *skipkeys: "If `True`, keys that are not of a basic type (`str`, `int`, `float`,
> `bool`, `None`) will be skipped instead of raising a `TypeError`. Default `False`."*

> *"If skipkeys is false (the default), a `TypeError` will be raised when trying to encode
> keys that are not `str`, `int`, `float`, `bool` or `None`. If skipkeys is true, such
> items are simply skipped."*

> *default: "A function that is called for objects that can't otherwise be serialized. It
> should return a JSON encodable version of the object or raise a `TypeError`."*

> *sort_keys: "If `True`, dictionaries will be outputted sorted by key. Default `False`."*
> — JSONEncoder: *"this is useful for regression tests to ensure that JSON serializations
> can be compared on a day-to-day basis."*

> *object_pairs_hook: "If set, a function that is called with the result of any JSON
> object literal decoded with an ordered list of pairs. The return value of this function
> will be used instead of the `dict`."* … *"If object_hook is also set, object_pairs_hook
> takes priority."*

> Repeated names: *"The RFC specifies that the names within a JSON object should be
> unique, but does not mandate how repeated names in JSON objects should be handled. By
> default, this module does not raise an exception; instead, it ignores all but the last
> name-value pair for a given name"* — doc example `'{"x": 1, "x": 2, "x": 3}'` → `{'x': 3}`.

Conversion table: `dict` → object; `list, tuple` → array; `int, float, int- & float-derived
Enums` → number; `True`/`False`/`None` → `true`/`false`/`null`.

Source, `Lib/json/encoder.py` @ v3.14.7 (`_iterencode_dict`): `if _sort_keys: items =
sorted(dct.items())` **before** key conversion; then `str` kept, `float` → `_floatstr`,
`True`/`False`/`None` → `'true'`/`'false'`/`'null'`, `int` → `_intstr`, else skip or
`raise TypeError(f'keys must be str, int, float, bool or None, not {key.__class__.__name__}')`.
**`default` is never consulted for a key.** `default()` base raises
`TypeError(f'Object of type {o.__class__.__name__} is not JSON serializable')`.
`Modules/_json.c` @ v3.14.7 same order (bool/None checked before `PyLong_Check`, comment
*"This must come before the PyLong_Check because True and False are also 1 and 0."*); int key
via `PyLong_Type.tp_repr`; `if (s->sort_keys || !PyDict_CheckExact(dct)) items =
PyMapping_Items(dct); … PyList_Sort(items)`.

## 18 · Thread safety — full dict section + free-threading HOWTO + FAQ

URL: <https://docs.python.org/3.14/library/threadsafety.html#thread-safety-for-dict-objects>
(the bank §12 quotes stand; additions:)

> *"The following operations return new objects and hold the per-object lock for the
> duration of the operation"* — `d.copy()`, `d | other`, `d.keys()`, `d.values()`, `d.items()`.

> *"The `clear()` method holds the lock for its duration. Other threads cannot observe
> elements being removed."*

> *"The following operations lock both dictionaries. For `update()` and `|=`, this applies
> only when the other operand is a `dict` that uses the standard dict iterator (but not
> subclasses that override iteration). For equality comparison, this applies to `dict` and
> its subclasses"* — `d.update(other_dict)`, `d |= other_dict`, `d == other_dict`.

> *"All comparison operations also compare values using `__eq__()`, so for non-built-in
> types the lock may be released during comparison."*

> *"`fromkeys()` locks both the new dictionary and the iterable when the iterable is exactly
> a `dict`, `set`, or `frozenset` (not subclasses)"*

> *"When updating from a non-dict iterable, only the target dictionary is locked. The
> iterable may be concurrently modified by another thread"* — `d.update(iterable)`,
> `d |= iterable`, `dict.fromkeys(iterable)`.

> *"To avoid time-of-check to time-of-use (TOCTOU) issues, use atomic operations or handle
> exceptions"* — `d.pop(key, None)` or `try: del d[key] except KeyError: pass`.

URL: <https://docs.python.org/3.14/howto/free-threading-python.html>

🔴 > *"Built-in types like `dict`, `list`, and `set` use internal locks to protect against
> concurrent modifications in ways that behave similarly to the GIL. However, Python has not
> historically guaranteed specific behavior for concurrent modifications to these built-in
> types, so this should be treated as a description of the current implementation, not a
> guarantee of current or future behavior."*

> *"It's recommended to use the `threading.Lock` or other synchronization primitives instead
> of relying on the internal locks of built-in types, when possible."*

> *"It is generally not thread-safe to access the same iterator object from multiple threads
> concurrently, and threads may see duplicate or missing elements."*

> *"The new `sys._is_gil_enabled()` function can be used to check whether the GIL is actually
> disabled in the running process."* … *"The `sysconfig.get_config_var("Py_GIL_DISABLED")`
> configuration variable can be used to determine whether the build supports free threading."*

URL: <https://docs.python.org/3.14/faq/library.html#what-kinds-of-global-value-mutation-are-thread-safe>

> *"In general, Python offers to switch among threads only between bytecode instructions"* …
> atomic list includes `D[x] = y`, `D1.update(D2)`, `D.keys()`; *"These aren't"* includes
> `D[x] = D[x] + 1`. *"Operations that replace other objects may invoke those other objects'
> `__del__()` method when their reference count reaches zero, and that can affect things.
> This is especially true for the mass updates to dictionaries and lists. When in doubt, use
> a mutex!"*

## 19 · Comparisons, comprehension scope, class scope

URL: <https://docs.python.org/3.14/reference/expressions.html#value-comparisons>

> *"Mappings (instances of `dict`) compare equal if and only if they have equal
> `(key, value)` pairs. Equality comparison of the keys and values enforces reflexivity."*
> *"Order comparisons (`<`, `>`, `<=`, and `>=`) raise `TypeError`."*
> *"The built-in containers typically assume identical objects are equal to themselves.
> That lets them bypass equality tests for identical objects to improve performance and to
> maintain their internal invariants."*

URL: <https://docs.python.org/3.14/reference/expressions.html#displays-for-lists-sets-and-dictionaries>

> *"However, aside from the iterable expression in the leftmost `for` clause, the
> comprehension is executed in a separate implicitly nested scope. This ensures that names
> assigned to in the target list don't "leak" into the enclosing scope."*
> *"The iterable expression in the leftmost `for` clause is evaluated directly in the
> enclosing scope and then passed as an argument to the implicitly nested scope."*

URL: <https://docs.python.org/3.14/reference/executionmodel.html#resolution-of-names>

> *"The scope of names defined in a class block is limited to the class block; it does not
> extend to the code blocks of methods. This includes comprehensions and generator
> expressions"* — doc example `class A: a = 42; b = list(a + i for i in range(10))` fails.

PEP 572 (<https://peps.python.org/pep-0572/>): *"an assignment expression occurring in a
list, set or dict comprehension or in a generator expression … binds the target in the
containing scope, honoring a `nonlocal` or `global` declaration for the target in that
scope, if one exists."* and *"In a dict comprehension `{X: Y for ...}`, `Y` is currently
evaluated before `X`. We propose to change this so that `X` is evaluated before `Y`."*

`zip()` (<https://docs.python.org/3.14/library/functions.html#zip>): *"Without the
`strict=True` argument, any bug that results in iterables of different lengths will be
silenced, possibly manifesting as a hard-to-find bug in another part of the program."* —
*"Changed in version 3.10: Added the `strict` argument."*

## 20 · `collections` / `collections.abc` / `types` / `os.environ`

URL: <https://docs.python.org/3.14/library/collections.html>

- OrderedDict: *"Equality tests between `OrderedDict` objects are order-sensitive and are
  roughly equivalent to `list(od1.items())==list(od2.items())`."* / *"Equality tests between
  `OrderedDict` objects and other `Mapping` objects are order-insensitive like regular
  dictionaries. This allows `OrderedDict` objects to be substituted anywhere a regular
  dictionary is used."* / *"Changed in version 3.9: Added merge (`|`) and update (`|=`)
  operators, specified in PEP 584."*
- Counter: *"All of those tests treat missing elements as having zero counts so that
  `Counter(a=1) == Counter(a=1, b=0)` returns true."* — *"Changed in version 3.10: In
  equality tests, missing elements are treated as having zero counts. Formerly,
  `Counter(a=3)` and `Counter(a=3, b=0)` were considered distinct."*
- ChainMap: *"Lookups search the underlying mappings successively until a key is found. In
  contrast, writes, updates, and deletions only operate on the first mapping."* / *"A
  `ChainMap` incorporates the underlying mappings by reference."* / *"Note, the iteration
  order of a `ChainMap` is determined by scanning the mappings last to first"* / 3.9 `|`, `|=`.
- defaultdict: *"Changed in version 3.9: Added merge (`|`) and update (`|=`) operators,
  specified in PEP 584."*
- UserDict: *"The class, `UserDict` acts as a wrapper around dictionary objects. The need
  for this class has been partially supplanted by the ability to subclass directly from
  `dict`; however, this class can be easier to work with because the underlying dictionary
  is accessible as an attribute."* / *"Class that simulates a dictionary. The instance's
  contents are kept in a regular dictionary, which is accessible via the `data` attribute"*.

URL: <https://docs.python.org/3.14/library/collections.abc.html> — table rows:
`Mapping`: abstract `__getitem__`, `__iter__`, `__len__`; mixins `__contains__`, `keys`,
`items`, `values`, `get`, `__eq__`, `__ne__`. `MutableMapping`: adds abstract
`__setitem__`, `__delitem__`; mixins `pop`, `popitem`, `clear`, `update`, `setdefault`.
`Set` mixins: `__le__`, `__lt__`, `__eq__`, `__ne__`, `__gt__`, `__ge__`, `__and__`,
`__or__`, `__sub__`, `__rsub__`, `__xor__`, `__rxor__` and `isdisjoint` (**no `union()`
etc. methods**).

URL: <https://docs.python.org/3.14/library/types.html#types.MappingProxyType> — *"Changed in
version 3.9: Updated to support the new union (`|`) operator from PEP 584, which simply
delegates to the underlying mapping."*

URL: <https://docs.python.org/3.14/library/os.html#os.environ> — *"Changed in version 3.9:
Updated to support PEP 584's merge (`|`) and update (`|=`) operators."*

`stdtypes` dict intro: *"These are the operations that dictionaries support (and therefore,
custom mapping types should support too)"*; `del d[key]`: *"Remove `d[key]` from d. Raises a
`KeyError` if key is not in the map."*

## 21 · CPython v3.14.7 source — subclass, merge-type and iterator facts

- `Objects/dictobject.c`: the **only** `PyObject_SetItem` call (the path that reaches a
  Python `__setitem__`) is in `_PyDict_FromKeys` for a non-exact dict; `dict_merge` and
  `merge_from_seq2_lock_held` insert with `setitem_lock_held` → **`update()`, `|=`, the
  constructor never call a subclass's `__setitem__`**. `dict_get_impl` →
  `_Py_dict_lookup_threadsafe`; `dict_setdefault_impl` → `dict_setdefault_ref_lock_held`;
  `dict_pop_impl` → `dict_pop_default`.
- `dict_merge` fast path: `if (PyDict_Check(b) && (Py_TYPE(b)->tp_iter == dict_iter))` —
  a source dict subclass that does **not** override `__iter__` is read straight from its
  table (its `keys()`/`__getitem__` overrides are ignored); otherwise `PyMapping_Keys` +
  `PyObject_GetItem`.
- `dict_update_arg`: exact dict → merge; `has_keys` attribute → merge; else
  `PyDict_MergeFromSeq2`, which uses `PySequence_Fast(item, …)` and raises
  `"dictionary update sequence element #%zd has length %zd; 2 is required"` (ValueError).
- `copy_lock_held` always builds an exact `dict` (`PyDict_New`/`new_dict`) → `sub.copy()`
  is a plain dict.
- `clear_lock_held`: `set_keys(mp, Py_EMPTY_KEYS)` + `dictkeys_decref(oldkeys)` → clear
  releases the table (contrast deletion's Dummy slots).
- Iterator: `di->di_used = used; di->len = used;` at creation; size check each step
  (sticky `-1`); `"dictionary keys changed during iteration"` when an entry is found with
  `di->len == 0`.
- `dictview_richcompare`: `if (!PyAnySet_Check(other) && !PyDictViewSet_Check(other))
  Py_RETURN_NOTIMPLEMENTED;` → `d.keys() == ['a']` is False. View set ops build a `set`
  (`PySet_New`).
- `dict_equal_lock_held`: length check first, then per-key `_Py_dict_lookup` in the other
  dict with the stored hash, then `PyObject_RichCompareBool(aval, bval, Py_EQ)` (identity
  shortcut → reflexive).
- `Objects/odictobject.c` `odict_or`: result type is the `OrderedDict` operand's type,
  whichever side it is on, built via `PyObject_CallOneArg(type, left)`.
- `Modules/_collectionsmodule.c` `defdict_or`: defaultdict on either side → result via
  `new_defdict(self, left)` keeps `default_factory`.
- `Objects/descrobject.c`: `mappingproxy_or` unwraps proxies and calls `PyNumber_Or` on the
  underlying mappings; `mappingproxy_ior` raises `"'|=' is not supported by %s; use '|'
  instead"`; `mappingproxy_richcompare` → `PyObject_RichCompare(v->mapping, w, op)`.
- `Lib/os.py` `_Environ.__or__` → `new = dict(self); new.update(other); return new`
  (plain dict); `__ior__` → `self.update(other)` (sets the real environment).
- `Lib/collections/__init__.py`: `Counter.__or__`/`__eq__` return `NotImplemented` unless
  the other operand is a `Counter`; `UserDict.__or__` → `self.__class__(self.data | other)`;
  `UserDict.get`/`__contains__` read `self.data`; `UserDict.__getitem__` honours
  `__missing__`; `ChainMap.__or__` → `m = self.copy(); m.maps[0].update(other)`.
- `Lib/_collections_abc.py`: `MutableMapping.popitem` → `key = next(iter(self))` — **FIFO**
  for a `UserDict` (no override), the opposite end from `dict.popitem()`;
  `MutableMapping.update`/`setdefault`/`pop` go through `self[key]` / `del self[key]`;
  `Mapping.__eq__` → `dict(self.items()) == dict(other.items())` for a `Mapping` other.

## 22 · Still unsettled after this pass

- Whether the C `json` encoder is used when `indent` is set on 3.14 — not needed; not written.
- Exact skip/duplication behaviour when a same-size mutation compacts the table during
  iteration — the docs say *"or fail to iterate over all entries"*; pages state that, not a
  specific outcome.
