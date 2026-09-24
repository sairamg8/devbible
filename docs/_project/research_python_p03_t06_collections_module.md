---
name: research-python-p03-t06-collections-module
description: Banked primary sources for Python phase 3 topic 06 (the collections module — defaultdict, Counter, deque, namedtuple, ChainMap, OrderedDict, UserDict/UserList/UserString) — verbatim doc quotes with URLs, CPython v3.14.7 source facts with file:line, and a could-not-settle list. DO NOT RE-DERIVE.
metadata:
  type: reference
---

# research — python phase 3, topic 06 · `collections`

🔴 **DO NOT RE-DERIVE.** Banked 2026-09-10 in one pass. Write every chunk from this file.

**How it was read.** The raw dumps in
`docs/python/pages/phase-3-collections/05-slicing/_scratch/` were diffed byte-for-byte
against the **`v3.14.7` tag** (`raw.githubusercontent.com/python/cpython/v3.14.7/…`) on
2026-09-10 — `Doc/library/collections.rst`, `Doc/library/collections.abc.rst`,
`Lib/collections/__init__.py`, `Modules/_collectionsmodule.c`, `Lib/_collections_abc.py`
are **identical** to the tag. So line numbers below are v3.14.7 line numbers. Other files
(queue, pickle, copy, typing, sqlite3, json, functools, heapq, os, asyncio-queue, types,
`Objects/odictobject.c`, `Lib/json/encoder.py`, `Modules/_json.c`, `Lib/queue.py`,
`Lib/asyncio/queues.py`) were read straight from the tag.

Cite docs as `https://docs.python.org/3.14/library/<page>.html#anchor`; cite source as
`https://github.com/python/cpython/blob/v3.14.7/<path>`.

Version spine: **Python 3.14.7**. No sandbox. **No program output was produced**; doctest
lines quoted below are *the documentation's own examples* and may be quoted as such.
Source facts are **implementation detail** unless a doc quote backs them — label them so.

---

## 0 · Scope links already on disk (link, do not re-teach)

| Already covered | Where |
|---|---|
| `__missing__` contract; `defaultdict.get` does not call factory | `../03-dict/04-reading-a-key.md` |
| `setdefault` vs `defaultdict`; `setdefault` ignores factory; defaultdict hides KeyError from downstream | `../03-dict/04c-setdefault.md` |
| autovivifying `defaultdict(tree)`; reads create | `../03-dict/04b-nested-access.md` |
| `fromkeys` on defaultdict has no factory; `dict.fromkeys(ks, Counter())` shared | `../03-dict/04d-fromkeys.md` |
| defaultdict read inside loop → "changed size during iteration" | `../03-dict/05c-the-mutations-you-did-not-write.md` |
| merge operators: ChainMap as lookup order not merge; first-seen-wins | `../03-dict/07-merging.md` |
| what `\|` returns for defaultdict/OrderedDict/Counter/ChainMap/UserDict | `../03-dict/07b-what-a-merge-returns.md` |
| subclassing dict bypass table | `../03-dict/09-subclassing-dict.md` |
| UserDict + MutableMapping ABCs (5 methods, `.data`, `__contains__`/`get` read `.data`, popitem FIFO, json refusal) | `../03-dict/09b-userdict-and-the-mapping-abcs.md` |
| dict/OrderedDict/Counter/defaultdict equality matrix | `../03-dict/09c-dict-equality.md` |
| Counter race `d[k] += 1` across threads | `../03-dict/10-dict-across-threads.md` |
| OrderedDict move_to_end emulation, what OD is still for (brief) | `../03-dict/02-insertion-order-is-a-guarantee.md`, `../03-dict/02b-working-with-the-order.md` |
| list as queue, `pop(0)`, maxlen drop in work queue | `../01-list-internals/03b-quadratic-patterns-and-deque.md` |
| Counter keys must be hashable; most_common(k) vs sorted; count() per value | `../01-list-internals/03d-partial-sorts-and-counting.md` |
| BFS worklist is a deque | `../01-list-internals/11b-safe-ways-to-mutate.md` |
| Queue vs list between threads; "Is deque a replacement for queue.Queue?" | `../01-list-internals/11d-sharing-a-list-between-threads.md` |
| namedtuple factory, `_make/_asdict/_replace`, defaults, rename, pickling name, subclass `__slots__` | `../02-tuple/08-named-records.md` |
| typing.NamedTuple | `../02-tuple/08b-typing-namedtuple.md` |
| NamedTuple forbids `__init__`/`super()`; `_make`/`_replace` skip `__new__` | `../02-tuple/08c-namedtuple-restrictions.md` |
| dataclass vs named tuple equality leak | `../02-tuple/08d-when-a-dataclass-beats-a-tuple.md` |
| deque cannot be sliced; islice | `../05-slicing/06-slices-that-do-not-copy.md`, `../05-slicing/07b-islice-bounds.md` |
| deque refuses slice deletion | `../05-slicing/09c-deletion-cost-and-types.md` |
| UserList slice rebuild needs one-arg constructor | `../05-slicing/10b-integer-keys-and-return-types.md` |
| list subclass `__setitem__` bypassed; MutableSequence mixins | `../05-slicing/10c-setitem-delitem-and-the-abcs.md` |
| dedupe with Counter / dict.fromkeys | `../04-set-and-frozenset/04-dedupe-and-what-it-destroys.md` |

NOT written (bold + *(not written yet)*): **07 · `heapq` and `bisect`**, **08 · `copy` vs
`deepcopy`**, **09 · Iteration idioms**, **10 · Sorting compound data**, **11 · Choosing a
structure**, **12 · `array` and `memoryview`**.

---

## 1 · Module overview — `library/collections.rst`

URL: <https://docs.python.org/3.14/library/collections.html>

> *"This module implements specialized container datatypes providing alternatives to
> Python's general purpose built-in containers, `dict`, `list`, `set`, and `tuple`."*

Table (verbatim rows):

| | |
|---|---|
| `namedtuple()` | factory function for creating tuple subclasses with named fields |
| `deque` | list-like container with fast appends and pops on either end |
| `ChainMap` | dict-like class for creating a single view of multiple mappings |
| `Counter` | dict subclass for counting hashable objects |
| `OrderedDict` | dict subclass that remembers the order entries were added |
| `defaultdict` | dict subclass that calls a factory function to supply missing values |
| `UserDict` | wrapper around dictionary objects for easier dict subclassing |
| `UserList` | wrapper around list objects for easier list subclassing |
| `UserString` | wrapper around string objects for easier string subclassing |

**Source families (v3.14.7, `Lib/collections/__init__.py`):**
- `deque` imported from C `_collections` (l.44–49) and then
  `_collections_abc.MutableSequence.register(deque)` (l.49) — deque is a *virtual* MutableSequence.
- `defaultdict` from C (l.57–60).
- `OrderedDict`: pure-Python class l.89–342, then `from _collections import OrderedDict` (l.345–349)
  replaces it with the C one (`Objects/odictobject.c`). Pure version stays as the readable spec.
- `namedtuple` l.361–533 (Python; field getters `_tuplegetter` from C, l.356–359).
- `Counter(dict)` l.551 (Python); its counting loop `_count_elements` from C (l.540–549).
- `ChainMap(MutableMapping)` l.998 (Python). `UserDict(MutableMapping)` l.1133,
  `UserList(MutableSequence)` l.1230, `UserString(Sequence)` l.1363 — all pure Python.
- l.32: `_sys.modules['collections.abc'] = _collections_abc`.

**typing aliases** — `library/typing.rst` (<https://docs.python.org/3.14/library/typing.html>):
`typing.DefaultDict`, `typing.OrderedDict`, `typing.ChainMap`, `typing.Counter`, `typing.Deque`
each: *"Deprecated alias to `collections.defaultdict`."* (etc.) and
> *"Deprecated since version 3.9: `collections.defaultdict` now supports subscripting (`[]`).
> See PEP 585 and Generic Alias Type."*
Doc: *"Deques are generic over the type of their contents."* · *"defaultdicts are generic over
two types, signifying (respectively) the types of the dictionary's keys and values."*

**Glossary — mapping** (<https://docs.python.org/3.14/glossary.html#term-mapping>): examples
*"include `dict`, `collections.defaultdict`, `collections.OrderedDict` and `collections.Counter`."*

---

## 2 · `defaultdict`

URL: <https://docs.python.org/3.14/library/collections.html#defaultdict-objects>

> *"Return a new dictionary-like object. `defaultdict` is a subclass of the built-in `dict`
> class. It overrides one method and adds one writable instance variable. The remaining
> functionality is the same as for the `dict` class and is not documented here."*

> *"The first argument provides the initial value for the `default_factory` attribute; it
> defaults to `None`. All remaining arguments are treated the same as if they were passed to
> the `dict` constructor, including keyword arguments."*

Signature: `defaultdict(default_factory=None, /, **kwargs)` · `(default_factory, mapping, /, **kwargs)`
· `(default_factory, iterable, /, **kwargs)`.

`__missing__(key, /)`:
> *"If the `default_factory` attribute is `None`, this raises a `KeyError` exception with the
> *key* as argument."*
> *"If `default_factory` is not `None`, it is called without arguments to provide a default
> value for the given *key*, this value is inserted in the dictionary for the *key*, and
> returned."*
> *"If calling `default_factory` raises an exception this exception is propagated unchanged."*
> *"This method is called by the `__getitem__()` method of the `dict` class when the requested
> key is not found; whatever it returns or raises is then returned or raised by
> `__getitem__()`."*
> *"Note that `__missing__()` is *not* called for any operations besides `__getitem__()`. This
> means that `get()` will, like normal dictionaries, return `None` as a default rather than
> using `default_factory`."*

`default_factory`:
> *"This attribute is used by the `__missing__()` method; it is initialized from the first
> argument to the constructor, if present, or to `None`, if absent."*
> *"Changed in version 3.9: Added merge (`|`) and update (`|=`) operators, specified in PEP 584."*

Examples section (verbatim, doc's own):
> *"When each key is encountered for the first time, it is not already in the mapping; so an
> entry is automatically created using the `default_factory` function which returns an empty
> `list`. The `list.append()` operation then attaches the value to the new list. When keys are
> encountered again, the look-up proceeds normally (returning the list for that key) and the
> `list.append()` operation adds another value to the list. This technique is simpler and
> faster than an equivalent technique using `dict.setdefault()`"*
> *"Setting the `default_factory` to `int` makes the `defaultdict` useful for counting (like a
> bag or multiset in other languages)"*
> *"The function `int()` which always returns zero is just a special case of constant
> functions. A faster and more flexible way to create constant functions is to use a lambda
> function which can supply any constant value (not just zero)"*
Doc example: `def constant_factory(value): return lambda: value` ·
`d = defaultdict(constant_factory('<missing>'))` · `d.update(name='John', action='ran')` ·
`'%(name)s %(action)s to %(object)s' % d` → doc shows `'John ran to <missing>'`.
> *"Setting the `default_factory` to `set` makes the `defaultdict` useful for building a
> dictionary of sets"*

**Source — `Modules/_collectionsmodule.c` @ v3.14.7:**
- `defdict_missing` l.2230: if factory NULL/None → `KeyError` with `(key,)` packed as args
  (l.2236–2242, so a tuple key is not unpacked). Else `value = _PyObject_CallNoArgs(factory)`,
  then **`PyDict_SetDefaultRef(op, key, value, &result)`** (l.2248) — insert-if-absent;
  returns whatever is stored (`'result' is NULL, or a strong reference to 'value' or 'op[key]'`).
  ⇒ implementation detail: if two threads (or a re-entrant factory) miss the same key, the
  factory can run twice; one value is stored and **both callers get the stored one**.
- docstring pseudo-code l.2222: `if self.default_factory is None: raise KeyError((key,))` /
  `self[key] = value = self.default_factory()` / `return value`.
- `defdict_init` l.2460: first positional must be callable or None → `TypeError("first
  argument must be callable or None")` (l.2475). ⇒ `defaultdict([])`, `defaultdict(0)` raise.
- `default_factory` is a writable `_Py_T_OBJECT` member (l.2350–2354): *"Factory for default
  value called by `__missing__()`."* ⇒ can be set to `None` later to freeze.
- `defdict_copy` l.2265 → `new_defdict(op, op)` = `type(dd)(factory, dd)`. Comment:
  *"This calls the object's class. That only works for subclasses whose class constructor has
  the same signature. Subclasses that define a different constructor signature must override
  copy()."* Also bound to `__copy__`.
- `defdict_reduce` l.2275, comment (verbatim): *"For this to be useful with pickle.py, the
  default_factory must be picklable; e.g., None, a built-in, or a global function in a module
  or package."* … *"Both shallow and deep copying are supported, but for deep copying, the
  default_factory must be deep-copyable; e.g. None, or a built-in (functions are not copyable at
  this time)."* ⚠️ the deepcopy half is **stale** — `library/copy.rst` says functions are
  "copied" by returning them unchanged (see §9). Do not repeat the "not copyable" claim.
  Reduce value: `(type, (factory,) or (), None, None, iter(items()))`.
- `defdict_repr` l.2370 → `"%s(%U, %U)"` = `defaultdict(<factory repr>, {…})`.
- class docstring l.2490: *"The default factory is called without arguments to produce a new
  value when a key is not present, in `__getitem__` only. A defaultdict compares equal to a dict
  with the same items."*
- `defdict_or` l.2409 (covered in 03-dict/07b).

**`library/stdtypes.rst`** (<https://docs.python.org/3.14/library/stdtypes.html#dict>):
> *"No other operations or methods invoke `__missing__`. If `__missing__` is not defined,
> `KeyError` is raised. `__missing__` must be a method; it cannot be an instance variable"*
> *"The example above shows part of the implementation of `collections.Counter`. A different
> `__missing__` method is used by `collections.defaultdict`."*
`str.format_map` (<https://docs.python.org/3.14/library/stdtypes.html#str.format_map>):
> *"Similar to `str.format(**mapping)`, except that `mapping` is used directly and not copied to
> a `dict`. This is useful if for example `mapping` is a dict subclass"* — doc example
> `class Default(dict): def __missing__(self, key): return key`.

---

## 3 · `Counter`

URL: <https://docs.python.org/3.14/library/collections.html#counter-objects>

> *"A counter tool is provided to support convenient and rapid tallies."*
> *"A `Counter` is a `dict` subclass for counting hashable objects. It is a collection where
> elements are stored as dictionary keys and their counts are stored as dictionary values.
> Counts are allowed to be any integer value including zero or negative counts. The `Counter`
> class is similar to bags or multisets in other languages."*
> *"Elements are counted from an *iterable* or initialized from another *mapping* (or counter)"*
Doc constructors: `Counter()`, `Counter('gallahad')` *"a new counter from an iterable"*,
`Counter({'red': 4, 'blue': 2})` *"from a mapping"*, `Counter(cats=4, dogs=8)` *"from keyword args"*.
> *"Counter objects have a dictionary interface except that they return a zero count for
> missing items instead of raising a `KeyError`"*
> *"Setting a count to zero does not remove an element from a counter. Use `del` to remove it
> entirely"*
> *"Changed in version 3.7: As a `dict` subclass, `Counter` inherited the capability to remember
> insertion order. Math operations on *Counter* objects also preserve order. Results are ordered
> according to when an element is first encountered in the left operand and then by the order
> encountered in the right operand."*

`elements()`: *"Return an iterator over elements repeating each as many times as its count.
Elements are returned in the order first encountered. If an element's count is less than one,
`elements()` will ignore it."*

`most_common(n=None)`: *"Return a list of the *n* most common elements and their counts from the
most common to the least. If *n* is omitted or `None`, `most_common()` returns *all* elements in
the counter. Elements with equal counts are ordered in the order first encountered"* — doc
example `Counter('abracadabra').most_common(3)` → `[('a', 5), ('b', 2), ('r', 2)]`.

`subtract(...)`: *"Elements are subtracted from an *iterable* or from another *mapping* (or
counter). Like `dict.update()` but subtracts counts instead of replacing them. Both inputs and
outputs may be zero or negative."* (3.2)

`total()`: *"Compute the sum of the counts."* (3.10)

> *"The usual dictionary methods are available for `Counter` objects except for two which work
> differently for counters."*
`fromkeys(iterable)`: *"This class method is not implemented for `Counter` objects."*
`update(...)`: *"Elements are counted from an *iterable* or added-in from another *mapping* (or
counter). Like `dict.update()` but adds counts instead of replacing them. Also, the *iterable*
is expected to be a sequence of elements, not a sequence of `(key, value)` pairs."*

Comparisons:
> *"Counters support rich comparison operators for equality, subset, and superset relationships:
> `==`, `!=`, `<`, `<=`, `>`, `>=`. All of those tests treat missing elements as having zero
> counts so that `Counter(a=1) == Counter(a=1, b=0)` returns true."*
> *"Changed in version 3.10: Rich comparison operations were added."*
> *"Changed in version 3.10: In equality tests, missing elements are treated as having zero
> counts. Formerly, `Counter(a=3)` and `Counter(a=3, b=0)` were considered distinct."*

Common patterns (doc, verbatim code block):
```
c.total()                       # total of all counts
c.clear()                       # reset all counts
list(c)                         # list unique elements
set(c)                          # convert to a set
dict(c)                         # convert to a regular dictionary
c.items()                       # access the (elem, cnt) pairs
Counter(dict(list_of_pairs))    # convert from a list of (elem, cnt) pairs
c.most_common()[:-n-1:-1]       # n least common elements
+c                              # remove zero and negative counts
```

Multiset math:
> *"Several mathematical operations are provided for combining `Counter` objects to produce
> multisets (counters that have counts greater than zero). Addition and subtraction combine
> counters by adding or subtracting the counts of corresponding elements. Intersection and union
> return the minimum and maximum of corresponding counts. Equality and inclusion compare
> corresponding counts. Each operation can accept inputs with signed counts, but the output will
> exclude results with counts of zero or less."*
Doc doctest: `c = Counter(a=3, b=1)`, `d = Counter(a=1, b=2)`: `c + d` → `Counter({'a': 4, 'b': 3})`;
`c - d` → `Counter({'a': 2})`; `c & d` → `Counter({'a': 1, 'b': 1})`; `c | d` →
`Counter({'a': 3, 'b': 2})`; `c == d` → `False`; `c <= d` → `False`.
> *"Unary addition and subtraction are shortcuts for adding an empty counter or subtracting from
> an empty counter."* — doc: `c = Counter(a=2, b=-4)`; `+c` → `Counter({'a': 2})`; `-c` →
> `Counter({'b': 4})`. *"Added in version 3.3: Added support for unary plus, unary minus, and
> in-place multiset operations."*

The type note (verbatim, whole):
> *"Counters were primarily designed to work with positive integers to represent running
> counts; however, care was taken to not unnecessarily preclude use cases needing other types or
> negative values. To help with those use cases, this section documents the minimum range and
> type restrictions."*
> *"The `Counter` class itself is a dictionary subclass with no restrictions on its keys and
> values. The values are intended to be numbers representing counts, but you *could* store
> anything in the value field."*
> *"The `most_common()` method requires only that the values be orderable."*
> *"For in-place operations such as `c[key] += 1`, the value type need only support addition and
> subtraction. So fractions, floats, and decimals would work and negative values are supported.
> The same is also true for `update()` and `subtract()` which allow negative and zero values for
> both inputs and outputs."*
> *"The multiset methods are designed only for use cases with positive values. The inputs may be
> negative or zero, but only outputs with positive values are created. There are no type
> restrictions, but the value type needs to support addition, subtraction, and comparison."*
> *"The `elements()` method requires integer counts. It ignores zero and negative counts."*

**Source — `Lib/collections/__init__.py` @ v3.14.7 (`class Counter(dict)` l.551):**
- class docstring l.589–595: *"Note: If a count is set to zero or reduced to zero, it will
  remain in the counter until the entry is deleted or the counter is cleared"*.
- `__init__` l.605: `super().__init__()` then `self.update(iterable, **kwds)`.
- `__missing__` l.619: `return 0` — comment *"Needed so that self[missing_item] does not raise
  KeyError"*; **does not insert**.
- `total` l.624: `return sum(self.values())`.
- `most_common` l.628: `n is None` → `sorted(self.items(), key=_itemgetter(1), reverse=True)`;
  else lazy-import `heapq`, `heapq.nlargest(n, self.items(), key=_itemgetter(1))` (l.645).
- `elements` l.647: `_chain.from_iterable(_starmap(_repeat, self.items()))` — `repeat(elem, n)`
  with n ≤ 0 yields nothing; a non-int count makes `repeat` raise `TypeError` (doc: requires
  integer counts).
- `fromkeys` l.671 raises `NotImplementedError('Counter.fromkeys() is undefined.  Use
  Counter(iterable) instead.')` with comment: *"the semantics would be ambiguous in cases such as
  Counter.fromkeys('aaabbc', v=2)"* … *"Initializing to one is easily accomplished with
  Counter(set(iterable))"*.
- `update` l.682: Mapping → add counts (fast path `super().update` when self empty, l.709–710);
  else `_count_elements(self, iterable)` — **a `str` is an iterable of characters**.
  Comment l.695–700: *"The regular dict.update() operation makes no sense here because the
  replace behavior results in some of the original untouched counts being mixed-in with all of
  the other counts for a mismash that doesn't have a straight-forward interpretation in most
  counting contexts."*
- `subtract` l.716: counts can go negative.
- `copy` l.743: `self.__class__(self)`. `__reduce__` l.747: `(self.__class__, (dict(self),))`.
- `__delitem__` l.750: *"Like dict.__delitem__() but does not raise KeyError for missing values."*
- `__repr__` l.755: builds `dict(self.most_common())` — **repr is sorted by count, not
  insertion**; falls back to `dict(self)` on `TypeError` (unorderable values).
- comment l.770–781: *"Outputs guaranteed to only include positive counts."* · *"To strip
  negative and zero counts, add-in an empty counter: c += Counter()"* · *"When the multiplicities
  are all zero or one, multiset operations are guaranteed to be equivalent to the corresponding
  operations for regular sets."*
- `__eq__` l.800 / `__le__` l.812 / `__lt__` l.818 etc: `if not isinstance(other, Counter):
  return NotImplemented`; `__eq__` = `all(self[e] == other[e] for c in (self, other) for e in c)`;
  `__lt__` = `self <= other and self != other` ⇒ **partial order** (neither `<` nor `>` for
  incomparable counters).
- `__add__` l.836, `__sub__` l.855, `__or__` l.874, `__and__` l.894, `__pos__` l.911,
  `__neg__` l.919: all build **`result = Counter()`** (the base class, not `self.__class__`)
  ⇒ a Counter subclass loses its type on `+ - | &` and unary ops (implementation detail).
  All return `NotImplemented` for a non-Counter other.
- in-place `__iadd__` l.937 / `__isub__` l.950 / `__ior__` l.963 / `__iand__` l.978: mutate then
  `return self._keep_positive()` (l.930) — **deletes every non-positive entry in `self`, not just
  those touched by `other`**. They take `other.items()` without an isinstance check.
- `_count_elements` Python fallback l.540: `mapping[elem] = mapping_get(elem, 0) + 1`.
  C version `_collections__count_elements_impl` (`_collectionsmodule.c` ~l.2540): comment
  *"Only take the fast path when get() and __setitem__() have not been overridden."* (l.2559);
  fast path reuses one hash for get+set. A subclass overriding `get` or `__setitem__` takes the
  generic slow path (still correct).

---

## 4 · `deque`

URL: <https://docs.python.org/3.14/library/collections.html#deque-objects>

> *"Returns a new deque object initialized left-to-right (using `append()`) with data from
> *iterable*. If *iterable* is not specified, the new deque is empty."*
> *"Deques are a generalization of stacks and queues (the name is pronounced "deck" and is short
> for "double-ended queue"). Deques support thread-safe, memory efficient appends and pops from
> either side of the deque with approximately the same *O*(1) performance in either direction."*
> *"Though `list` objects support similar operations, they are optimized for fast fixed-length
> operations and incur *O*(*n*) memory movement costs for `pop(0)` and `insert(0, v)` operations
> which change both the size and position of the underlying data representation."*
> *"If *maxlen* is not specified or is `None`, deques may grow to an arbitrary length. Otherwise,
> the deque is bounded to the specified maximum length. Once a bounded length deque is full,
> when new items are added, a corresponding number of items are discarded from the opposite end.
> Bounded length deques provide functionality similar to the `tail` filter in Unix. They are also
> useful for tracking transactions and other pools of data where only the most recent activity is
> of interest."*

Methods (verbatim fragments): `append(item, /)` *"Add *item* to the right side of the deque."* ·
`appendleft` *"Add *item* to the left side of the deque."* · `clear()` · `copy()` *"Create a shallow
copy of the deque."* (3.5) · `count(value, /)` (3.2) · `extend(iterable, /)` · `extendleft(iterable,
/)` *"Extend the left side of the deque by appending elements from *iterable*. Note, the series of
left appends results in reversing the order of elements in the iterable argument."* ·
`index(value[, start[, stop]])` *"Returns the first match or raises `ValueError` if not found."*
(3.5) · `insert(index, value, /)` *"If the insertion would cause a bounded deque to grow beyond
*maxlen*, an `IndexError` is raised."* (3.5) · `pop()` / `popleft()` *"If no elements are present,
raises an `IndexError`."* · `remove(value, /)` *"Remove the first occurrence of *value*. If not
found, raises a `ValueError`."* · `reverse()` *"Reverse the elements of the deque in-place and then
return `None`."* (3.2) · `rotate(n=1, /)` *"Rotate the deque *n* steps to the right. If *n* is
negative, rotate to the left."* *"When the deque is not empty, rotating one step to the right is
equivalent to `d.appendleft(d.pop())`, and rotating one step to the left is equivalent to
`d.append(d.popleft())`."* · `maxlen` *"Maximum size of a deque or `None` if unbounded."* (3.1,
read-only).

> *"In addition to the above, deques support iteration, pickling, `len(d)`, `reversed(d)`,
> `copy.copy(d)`, `copy.deepcopy(d)`, membership testing with the `in` operator, and subscript
> references such as `d[0]` to access the first element. Indexed access is *O*(1) at both ends
> but slows to *O*(*n*) in the middle. For fast random access, use lists instead."*
> *"Starting in version 3.5, deques support `__add__()`, `__mul__()`, and `__imul__()`."*
Doc doctest ends with `d.pop()` on empty → `IndexError: pop from an empty deque` and
`d.extendleft('abc')` → `deque(['c', 'b', 'a'])`.

Recipes (doc, verbatim code):
```
def tail(filename, n=10):
    'Return the last n lines of a file'
    with open(filename) as f:
        return deque(f, n)
```
```
def moving_average(iterable, n=3):
    # moving_average([40, 30, 50, 46, 39, 44]) --> 40.0 42.0 45.0 43.0
    # https://en.wikipedia.org/wiki/Moving_average
    it = iter(iterable)
    d = deque(itertools.islice(it, n-1))
    d.appendleft(0)
    s = sum(d)
    for elem in it:
        s += elem - d.popleft()
        d.append(elem)
        yield s / n
```
```
def roundrobin(*iterables):
    "roundrobin('ABC', 'D', 'EF') --> A D E B F C"
    iterators = deque(map(iter, iterables))
    while iterators:
        try:
            while True:
                yield next(iterators[0])
                iterators.rotate(-1)
        except StopIteration:
            # Remove an exhausted iterator.
            iterators.popleft()
```
```
def delete_nth(d, n):
    d.rotate(-n)
    d.popleft()
    d.rotate(n)
```
> *"The `rotate()` method provides a way to implement `deque` slicing and deletion."* …
> *"To implement `deque` slicing, use a similar approach applying `rotate()` to bring a target
> element to the left side of the deque. Remove old entries with `popleft()`, add new entries
> with `extend()`, and then reverse the rotation."*

**itertools recipes** (<https://docs.python.org/3.14/library/itertools.html#itertools-recipes>):
`tail(n, iterable)` → `return iter(deque(iterable, maxlen=n))`; `consume(iterator, n=None)` —
*"Use functions that consume iterators at C speed."* `if n is None: deque(iterator, maxlen=0)`;
`sliding_window(iterable, n)` → `window = deque(islice(iterator, n - 1), maxlen=n)` then
`window.append(x); yield tuple(window)`.

**Tutorial** (<https://docs.python.org/3.14/tutorial/datastructures.html#using-lists-as-queues>):
> *"It is also possible to use a list as a queue, where the first element added is the first
> element retrieved ("first-in, first-out"); however, lists are not efficient for this purpose."*
> *"To implement a queue, use `collections.deque` which was designed to have fast appends and
> pops from both ends."*

**Time-complexity page** (<https://docs.python.org/3.14/library/time-complexity.html>): has
tables for list, tuple, dict, set/frozenset, str/bytes/bytearray, memoryview, range — **no deque
table**. List section: *"If you need to add or remove at both ends, consider using a
`collections.deque` instead."* Header: *"the listed costs assume exact built-in types, as
instances of subclasses may have different costs."*

**queue docs** (<https://docs.python.org/3.14/library/queue.html>), seealso under SimpleQueue:
> *"`collections.deque` is an alternative implementation of unbounded queues with fast atomic
> `append()` and `popleft()` operations that do not require locking and also support indexing."*
`Lib/queue.py` v3.14.7 l.264 `self.queue = deque()` (Queue._init) and l.326
(`SimpleQueue` pure-Python fallback `self._queue = deque()`).
`Lib/asyncio/queues.py` l.61 `self._queue = collections.deque()` (also `_getters`/`_putters`).
**asyncio queues** (<https://docs.python.org/3.14/library/asyncio-queue.html>): *"asyncio queues
are designed to be similar to classes of the `queue` module. Although asyncio queues are not
thread-safe, they are designed to be used specifically in async/await code."*

**Source — `Modules/_collectionsmodule.c` @ v3.14.7:**
- l.78 `#define BLOCKLEN 64`, l.79 `CENTER`, l.80 `#define MAXFREEBLOCKS 16`.
- comment l.70–75: *"Larger numbers reduce the number of calls to the memory allocator, give
  faster indexing and rotation, and reduce the link to data overhead ratio."*
- comment l.82–100 (verbatim): *"Data for deque objects is stored in a doubly-linked list of
  fixed length blocks. This assures that appends or pops never move any other data elements
  besides the one being appended or popped."* · *"Another advantage is that it completely avoids
  use of realloc(), resulting in more predictable performance."* · *"Textbook implementations of
  doubly-linked lists store one datum per link, but that gives them a 200% memory overhead (a
  prev and next link for each datum) and it costs one malloc() call per data element. By using
  fixed-length blocks, the link to data ratio is significantly improved and there are
  proportionally fewer calls to malloc() and free(). The data blocks of consecutive pointers
  also improve cache locality."*
- `struct BLOCK` l.~126: `leftlink`, `PyObject *data[BLOCKLEN]`, `rightlink`.
- `dequeobject` l.134–146: `size_t state; /* incremented whenever the indices move */` (l.141),
  `Py_ssize_t maxlen; /* maxlen is -1 for unbounded deques */`, `freeblocks[MAXFREEBLOCKS]`.
- freelist comment l.~170: *"A simple freelisting scheme is used to minimize calls to the memory
  allocator."* `freeblock` keeps up to 16 empty blocks per deque, frees the rest.
- `deque_pop_impl` l.245 / `deque_popleft_impl` l.290: `IndexError("pop from an empty deque")`
  (l.252 / l.297); `state++`; frees a block when it empties; re-centres when deque empties.
- trimming comment l.327–337: *"After an item is added to a deque, we check to see if the size
  has grown past the limit. If it has, we get the size back down to the limit by popping an item
  off of the opposite end. The methods that can trigger this are append(), appendleft(),
  extend(), and extendleft()."* `NEEDS_TRIM` l.338.
- `deque_append_lock_held` l.341: new block only when right block full; `state++`.
- All public methods are `@critical_section` (argument clinic) in 3.14 — per-object lock in the
  free-threaded build (implementation detail; the thread-safety doc page has **no** deque section).
- `deque_extend_impl` l.475: `if deque is iterable` → copies to a list first (l.482, *"Handle
  case where id(deque) == id(iterable)"*) ⇒ `d.extend(d)` doubles safely. `maxlen == 0` →
  `consume_iterator(it)` (l.~493).
- `deque_inplace_concat` (`+=`) → `deque_extend` ⇒ `+=` accepts **any iterable**.
- `deque_concat_lock_held` l.675: `other` must be a deque, else `TypeError("can only concatenate
  deque (not \"%.200s\") to deque")` (l.685) ⇒ `d + [1]` raises.
- `deque_copy_impl` l.599: exact deque → block walk; subclass → `type(d)(d)` or
  `type(d)(d, maxlen)`; if that returns non-deque → `TypeError("%.200s() must return a deque,
  not %.200s")` (l.652). ⇒ subclass with different `__init__` breaks `copy()`, `+`, `*`.
- `deque_inplace_repeat_lock_held` l.820: `n <= 0` clears; maxlen caps repetitions.
- rotate comment l.~930: *"The rotate() method is part of the public API and is used internally
  as a primitive for other methods."* · *"Rotation by 1 or -1 is a common case"* ·
  `_deque_rotate` l.952: normalises `n` modulo len to the range `[-len/2, len/2]` ⇒ cost is
  O(min(k, n−k)) pointer moves; `state++` (if len > 1).
- `deque_reverse_impl` l.1105: swaps in place — **no `state++`** (implementation detail).
- `deque_count_impl` l.1155, `deque_contains_lock_held` l.1192, `deque_index_impl` l.1258:
  linear scan with `==`; if `state` changes during a comparison → `RuntimeError("deque mutated
  during iteration")` (l.1177/1211/1309). `index` clamps start/stop like a slice (l.1271–1284);
  not found → `ValueError("deque.index(x): x not in deque")` (l.1318).
- comment l.1321–1327 (verbatim): *"insert(), remove(), and delitem() are implemented in terms of
  rotate() for simplicity and reasonable performance near the end points. If for some reason
  these methods become popular, it is not hard to re-implement this using direct data movement
  (similar to the code used in list slice assignments) and achieve a performance boost (by moving
  each pointer only once instead of twice)."*
- `deque_insert_impl` l.1343: `maxlen == len` → `IndexError("deque already at its maximum
  size")` (l.1350); else rotate(-i), append/appendleft, rotate(i).
- `deque_item_lock_held` l.1380: `IndexError("deque index out of range")` (l.1387); i==0 / i==len−1
  direct; else walks blocks from the **nearer end** (`if (index < (Py_SIZE(deque) >> 1))`
  l.1401) ⇒ O(min(i, n−i)/64) block hops.
- `deque_del_item` l.1430: rotate(−i), popleft, rotate(i).
- `deque_remove_impl` l.1457: scan; on concurrent mutation raises **`IndexError`**("deque
  mutated during iteration") (l.1474–1475) — note IndexError, not RuntimeError; not found →
  `ValueError("deque.remove(x): x not in deque")` (l.1488).
- `deque_ass_item_lock_held` l.1499 (`d[i] = v`): walks to the block, `Py_SETREF` — **no
  `state++`** ⇒ item assignment during iteration does not trip the iterator check.
- `deque___reduce___impl` l.1600: pickles `(type, (), state, iter)` or `(type, ((), maxlen),
  …)` ⇒ maxlen survives pickling.
- `deque_repr` l.1629: `deque([...], maxlen=N)` when bounded.
- `deque_richcompare` l.1660: both operands must be deques else `NotImplemented` (l.1669) ⇒
  `deque([1]) == [1]` is `False`; ordering is lexicographic between deques; maxlen ignored.
- `deque_init_impl` l.1751: `ValueError("maxlen must be non-negative")` (l.1760); re-`__init__`
  clears then extends.
- `deque___sizeof___impl` l.1786: object + `blocks * sizeof(block)`.
- `maxlen` getset (l.~1815) has **no setter** ⇒ assigning raises `AttributeError`.
- iterator: `dequeiterobject.state` l.1909 *"state when the iterator is created"*;
  `dequeiter_next_lock_held` l.1965: `if (it->deque->state != it->state)` → `counter = 0`,
  `RuntimeError("deque mutated during iteration")` (l.1972). Same for reverse iterator (l.2125).
  ⇒ **any** append/pop/extend/rotate/clear during a `for` over the deque raises — even if the
  length ends up the same. (Contrast: a list iterator never raises.)

`Lib/collections/__init__.py` l.49: `_collections_abc.MutableSequence.register(deque)`.
`library/collections.abc.rst`: registering *"Those classes should define the full API including
all of the abstract methods and all of the mixin methods."* (deque has no slice support —
see 05-slicing/06).

**JSON**: `Lib/json/encoder.py` l.441 `elif isinstance(o, (list, tuple))`, l.443 `elif
isinstance(o, dict)`; `Modules/_json.c` l.1518 `PyList_Check(obj) || PyTuple_Check(obj)`,
l.1525 `PyDict_Check(obj)`; fallback `default()` raises (encoder.py l.182–183)
`TypeError(f'Object of type {o.__class__.__name__} is not JSON serializable')`. ⇒ deque,
ChainMap, UserDict, UserList, UserString → TypeError; Counter/defaultdict/OrderedDict (dict
subclasses) and namedtuple (tuple subclass → **array**) encode.

---

## 5 · `namedtuple` (collections-side only; tuple-ness is 02-tuple's)

URL: <https://docs.python.org/3.14/library/collections.html#collections.namedtuple>

> *"Named tuples assign meaning to each position in a tuple and allow for more readable,
> self-documenting code. They can be used wherever regular tuples are used, and they add the
> ability to access fields by name instead of position index."*
> *"Returns a new tuple subclass named *typename*. The new subclass is used to create tuple-like
> objects that have fields accessible by attribute lookup as well as being indexable and
> iterable. Instances of the subclass also have a helpful docstring (with *typename* and
> *field_names*) and a helpful `__repr__()` method which lists the tuple contents in a
> `name=value` format."*
> *"Any valid Python identifier may be used for a fieldname except for names starting with an
> underscore. Valid identifiers consist of letters, digits, and underscores but do not start with
> a digit or underscore and cannot be a `keyword` such as *class*, *for*, *return*, *global*,
> *pass*, or *raise*."*
> *"If *rename* is true, invalid fieldnames are automatically replaced with positional names. For
> example, `['abc', 'def', 'ghi', 'abc']` is converted to `['abc', '_1', 'ghi', '_3']`,
> eliminating the keyword `def` and the duplicate fieldname `abc`."*
> *"If *module* is defined, the `__module__` attribute of the named tuple is set to that value."*
> *"Named tuple instances do not have per-instance dictionaries, so they are lightweight and
> require no more memory than regular tuples."*
> *"To support pickling, the named tuple class should be assigned to a variable that matches
> *typename*."*
Version notes: 3.1 rename; 3.6 *verbose*/*rename* keyword-only, *module* added; 3.7 *"Removed the
*verbose* parameter and the `_source` attribute."*, *defaults* + `_field_defaults` added.
`_asdict`: *"Changed in version 3.1: Returns an `OrderedDict` instead of a regular `dict`."* ·
*"Changed in version 3.8: Returns a regular `dict` instead of an `OrderedDict`. As of Python 3.7,
regular dicts are guaranteed to be ordered. If the extra features of `OrderedDict` are required,
the suggested remediation is to cast the result to the desired type: `OrderedDict(nt._asdict())`."*
`_replace`: *"Named tuples are also supported by generic function `copy.replace()`."* ·
*"Changed in version 3.13: Raise `TypeError` instead of `ValueError` for invalid keyword
arguments."*
`_fields`: *"Tuple of strings listing the field names. Useful for introspection and for creating
new named tuple types from existing named tuples."*
> *"Docstrings can be customized by making direct assignments to the `__doc__` fields"* — doc:
> `Book.__doc__ += ': Hardcover book in active collection'`, `Book.id.__doc__ = '13-digit ISBN'`.
> *"Changed in version 3.5: Property docstrings became writeable."*
Seealso: *"See `types.SimpleNamespace()` for a mutable namespace based on an underlying dictionary
instead of a tuple."* · *"The `dataclasses` module provides a decorator and functions for
automatically adding generated special methods to user-defined classes."*

**Source — `Lib/collections/__init__.py` @ v3.14.7 (`def namedtuple` l.361):**
- l.387–390: string field names split on commas/whitespace; `typename` interned.
- l.402–410 errors: `TypeError('Type names and field names must be strings')`,
  `ValueError('Type names and field names must be valid identifiers: {name!r}')`,
  `ValueError('Type names and field names cannot be a keyword: {name!r}')`.
- l.412–419: `ValueError('Field names cannot start with an underscore: {name!r}')`,
  `ValueError(f'Encountered duplicate field name: {name!r}')`.
- l.424–425: `TypeError('Got more default values than field names')`.
- l.446–447: **`code = f'lambda _cls, {arg_list}: _tuple_new(_cls, ({arg_list}))'`;
  `__new__ = eval(code, namespace)`** — every call compiles a new `__new__` and builds a new
  class with `type(typename, (tuple,), class_namespace)` (l.515). ⇒ class creation is a real
  cost (no measured figure; don't invent one) and **each call returns a distinct class**.
- l.454–458 `_make`: `TypeError(f'Expected {num_fields} arguments, got {len(result)}')`.
- l.463–466 `_replace`: `TypeError(f'Got unexpected field names: {list(kwds)!r}')`.
- l.476–478 `_asdict`: `_dict(_zip(self._fields, self))` — plain dict.
- l.497–513 class namespace incl. `'__slots__': ()`, `'__match_args__'`, `'__replace__'`;
  each field `_tuplegetter(index, doc)` with doc `'Alias for field number {index}'`.
- l.522–531: `module is None` → `_sys._getframemodulename(1) or '__main__'` — so the class's
  `__module__` is the *caller's* module (a factory helper in `db.py` stamps `db`).
- C `_tuplegetter` (`_collectionsmodule.c`): `tuplegetter_descr_get` l.2689 reads
  `PyTuple_GET_ITEM(obj, index)`; `tuplegetter_descr_set` → `AttributeError("can't set
  attribute")` / `("can't delete attribute")` (l.2721–2725). Fallback when C missing:
  `property(_itemgetter(index), doc=doc)` (l.359).

**sqlite3 doc's own recipe** (<https://docs.python.org/3.14/library/sqlite3.html#how-to-create-and-use-row-factories>):
```
from collections import namedtuple

def namedtuple_factory(cursor, row):
    fields = [column[0] for column in cursor.description]
    cls = namedtuple("Row", fields)
    return cls._make(row)
```
> *"With some adjustments, the above recipe can be adapted to use a `dataclass`, or any other
> custom class, instead of a `namedtuple`."*
⇒ as written it builds **a new class per row** (mechanism from §5 source). Caching by field
tuple is the fix. `sqlite3.Row`: *"A `Row` instance serves as a highly optimized `row_factory`
for `Connection` objects. It supports iteration, equality testing, `len()`, and mapping access by
column name and index."* · *"Two `Row` objects compare equal if they have identical column names
and values."*

**types.SimpleNamespace** (<https://docs.python.org/3.14/library/types.html#types.SimpleNamespace>):
*"A simple `object` subclass that provides attribute access to its namespace, as well as a
meaningful repr."* · *"Unlike `object`, with `SimpleNamespace` you can add and remove attributes."*

**copy.replace** (<https://docs.python.org/3.14/library/copy.html#copy.replace>): *"Function
`copy.replace()` is more limited than `copy()` and `deepcopy()`, and only supports named tuples
created by `namedtuple()`, `dataclasses`, and other classes which define method `__replace__()`."*

---

## 6 · `ChainMap`

URL: <https://docs.python.org/3.14/library/collections.html#chainmap-objects>

> *"A `ChainMap` class is provided for quickly linking a number of mappings so they can be treated
> as a single unit. It is often much faster than creating a new dictionary and running multiple
> `update()` calls."* (3.3) · *"The class can be used to simulate nested scopes and is useful in
> templating."*
> *"A `ChainMap` groups multiple dicts or other mappings together to create a single, updateable
> view. If no *maps* are specified, a single empty dictionary is provided so that a new chain
> always has at least one mapping."*
> *"The underlying mappings are stored in a list. That list is public and can be accessed or
> updated using the *maps* attribute. There is no other state."*
> *"Lookups search the underlying mappings successively until a key is found. In contrast,
> writes, updates, and deletions only operate on the first mapping."*
> *"A `ChainMap` incorporates the underlying mappings by reference. So, if one of the underlying
> mappings gets updated, those changes will be reflected in `ChainMap`."*
> *"All of the usual dictionary methods are supported. In addition, there is a *maps* attribute, a
> method for creating new subcontexts, and a property for accessing all but the first mapping"*
`maps`: *"A user updateable list of mappings. The list is ordered from first-searched to
last-searched. It is the only stored state and can be modified to change which mappings are
searched. The list should always contain at least one mapping."*
`new_child(m=None, **kwargs)`: *"Returns a new `ChainMap` containing a new map followed by all of
the maps in the current instance. If `m` is specified, it becomes the new map at the front of the
list of mappings; if not specified, an empty dict is used, so that a call to `d.new_child()` is
equivalent to: `ChainMap({}, *d.maps)`. If any keyword arguments are specified, they update passed
map or new empty dict. This method is used for creating subcontexts that can be updated without
altering values in any of the parent mappings."* (3.4 `m`; 3.10 kwargs)
`parents`: *"Property returning a new `ChainMap` containing all of the maps in the current instance
except the first one. This is useful for skipping the first map in the search. Use cases are
similar to those for the `nonlocal` keyword used in nested scopes. The use cases also parallel
those for the built-in `super()` function. A reference to `d.parents` is equivalent to:
`ChainMap(*d.maps[1:])`."*
> *"Note, the iteration order of a `ChainMap` is determined by scanning the mappings last to
> first"* — doc: `baseline = {'music': 'bach', 'art': 'rembrandt'}`, `adjustments = {'art': 'van
> gogh', 'opera': 'carmen'}`, `list(ChainMap(adjustments, baseline))` → `['music', 'art',
> 'opera']`. *"This gives the same ordering as a series of `dict.update()` calls starting with the
> last mapping"*. 3.9: `|` and `|=`.
Seealso: *"Django's Context class for templating is a read-only chain of mappings."*
Recipes (doc): `pylookup = ChainMap(locals(), globals(), vars(builtins))`; CLI > env > defaults:
```
defaults = {'color': 'red', 'user': 'guest'}
parser = argparse.ArgumentParser()
parser.add_argument('-u', '--user')
parser.add_argument('-c', '--color')
namespace = parser.parse_args()
command_line_args = {k: v for k, v in vars(namespace).items() if v is not None}
combined = ChainMap(command_line_args, os.environ, defaults)
```
nested contexts: `c = ChainMap()`, `d = c.new_child()`, `e = c.new_child()`, `e.maps[0]` *"Current
context dictionary -- like Python's locals()"*, `e.maps[-1]` *"Root context -- like Python's
globals()"*, `e.parents` *"Enclosing context chain -- like Python's nonlocals"*, `dict(d)` *"Flatten
into a regular dictionary"*.
> *"The `ChainMap` class only makes updates (writes and deletions) to the first mapping in the
> chain while lookups will search the full chain. However, if deep writes and deletions are
> desired, it is easy to make a subclass that updates keys found deeper in the chain"* — the
> `DeepChainMap` recipe (`__setitem__` loops `self.maps`, writes to first map containing key else
> `maps[0]`; `__delitem__` deletes from first containing map else `KeyError`).

**Source — `Lib/collections/__init__.py` @ v3.14.7 (`class ChainMap(MutableMapping)` l.998):**
- `__init__` l.1012: `self.maps = list(maps) or [{}]`.
- `__missing__` l.1019 raises `KeyError`; `__getitem__` l.1022: `for mapping in self.maps: try:
  return mapping[key]` — comment **`# can't use 'key in mapping' with defaultdict`** (l.1025) —
  then `self.__missing__(key)` *"support subclasses that define __missing__"*. ⇒ a layer whose
  `__getitem__` answers misses (defaultdict inserts and returns; Counter returns 0) **ends the
  search at that layer**.
- `get` l.1030: `self[key] if key in self else default` — comment *"needs to make use of
  __contains__"*.
- `__len__` l.1033: `len(set().union(*self.maps))` — builds a set of all keys every call.
- `__iter__` l.1036: `d = {}; for mapping in map(dict.fromkeys, reversed(self.maps)): d |= mapping`
  — builds a dict of all keys every iteration.
- `__contains__` l.1042: `key in mapping` for each map (does **not** trigger `__missing__`).
- `__bool__` l.1048: `any(self.maps)`.
- `copy` l.1060: *"New ChainMap or subclass with a new copy of maps[0] and refs to maps[1:]"*;
  `__copy__ = copy`.
- `new_child` l.1066 (comment *"like Django's Context.push()"*): `if m is None: m = kwargs elif
  kwargs: m.update(kwargs)` ⇒ **kwargs mutate the passed-in `m`**.
- `parents` l.1078: `self.__class__(*self.maps[1:])` ⇒ for a one-map chain returns a chain over a
  **fresh** `{}` (since `list(()) or [{}]`).
- `__setitem__` l.1082: `self.maps[0][key] = value`.
- `__delitem__` l.1085: `KeyError(f'Key not found in the first mapping: {key!r}')`;
  `popitem` l.1091: `KeyError('No keys found in the first mapping.')`; `pop` l.1098 same message
  as delitem; `clear` l.1105: *"Clear maps[0], leaving maps[1:] intact."*
- `__ior__` l.1109 updates maps[0]; `__or__` l.1113 copies then updates maps[0]; `__ror__`
  l.1120 flattens to one dict.
- Equality inherited from `Mapping.__eq__` (`Lib/_collections_abc.py` l.819–822):
  `if not isinstance(other, Mapping): return NotImplemented; return dict(self.items()) ==
  dict(other.items())`.

---

## 7 · `OrderedDict`

URL: <https://docs.python.org/3.14/library/collections.html#ordereddict-objects>

> *"Ordered dictionaries are just like regular dictionaries but have some extra capabilities
> relating to ordering operations. They have become less important now that the built-in `dict`
> class gained the ability to remember insertion order (this new behavior became guaranteed in
> Python 3.7)."*
> *"Some differences from `dict` still remain:"*
> *"The regular `dict` was designed to be very good at mapping operations. Tracking insertion
> order was secondary."*
> *"The `OrderedDict` was designed to be good at reordering operations. Space efficiency,
> iteration speed, and the performance of update operations were secondary."*
> *"The `OrderedDict` algorithm can handle frequent reordering operations better than `dict`. As
> shown in the recipes below, this makes it suitable for implementing various kinds of LRU
> caches."*
> *"The equality operation for `OrderedDict` checks for matching order."*
> *"A regular `dict` can emulate the order sensitive equality test with `p == q and all(k1 == k2
> for k1, k2 in zip(p, q))`."*
> *"The `popitem()` method of `OrderedDict` has a different signature. It accepts an optional
> argument to specify which item is popped."*
> *"A regular `dict` can emulate OrderedDict's `od.popitem(last=True)` with `d.popitem()` which is
> guaranteed to pop the rightmost (last) item."*
> *"A regular `dict` can emulate OrderedDict's `od.popitem(last=False)` with `(k := next(iter(d)),
> d.pop(k))` which will return and remove the leftmost (first) item if it exists."*
> *"`OrderedDict` has a `move_to_end()` method to efficiently reposition an element to an
> endpoint."*
> *"A regular `dict` can emulate OrderedDict's `od.move_to_end(k, last=True)` with `d[k] =
> d.pop(k)` which will move the key and its associated value to the rightmost (last) position."*
> *"A regular `dict` does not have an efficient equivalent for OrderedDict's `od.move_to_end(k,
> last=False)` which moves the key and its associated value to the leftmost (first) position."*
> *"Until Python 3.8, `dict` lacked a `__reversed__()` method."*
Class: *"Return an instance of a `dict` subclass that has methods specialized for rearranging
dictionary order."* (3.1)
`popitem(last=True)`: *"The `popitem()` method for ordered dictionaries returns and removes a (key,
value) pair. The pairs are returned in LIFO (last-in, first-out) order if *last* is true or FIFO
(first-in, first-out) order if false."*
`move_to_end(key, last=True)`: *"Move an existing *key* to either end of an ordered dictionary.
The item is moved to the right end if *last* is true (the default) or to the beginning if *last*
is false. Raises `KeyError` if the *key* does not exist"* — doc: `d = OrderedDict.fromkeys('abcde')`,
`d.move_to_end('b')` → `''.join(d)` `'acdeb'`; `d.move_to_end('b', last=False)` → `'bacde'`. (3.2)
> *"In addition to the usual mapping methods, ordered dictionaries also support reverse iteration
> using `reversed()`."*
> *"Equality tests between `OrderedDict` objects are order-sensitive and are roughly equivalent to
> `list(od1.items())==list(od2.items())`."*
> *"Equality tests between `OrderedDict` objects and other `Mapping` objects are order-insensitive
> like regular dictionaries. This allows `OrderedDict` objects to be substituted anywhere a
> regular dictionary is used."*
3.5: views support `reversed()`. 3.6: *"With the acceptance of PEP 468, order is retained for
keyword arguments passed to the `OrderedDict` constructor and its `update()` method."* 3.9: `|`.
Recipes: *"It is straightforward to create an ordered dictionary variant that remembers the order
the keys were *last* inserted. If a new entry overwrites an existing entry, the original
insertion position is changed and moved to the end"* —
```
class LastUpdatedOrderedDict(OrderedDict):
    'Store items in the order the keys were last added'

    def __setitem__(self, key, value):
        super().__setitem__(key, value)
        self.move_to_end(key)
```
> *"An `OrderedDict` would also be useful for implementing variants of `functools.lru_cache()`"* —
> `TimeBoundedLRU` (doc testcode): `self.cache = OrderedDict()  # { args : (timestamp, result)}`;
> `__call__`: `if args in self.cache: self.cache.move_to_end(args); timestamp, result =
> self.cache[args]; if monotonic() - timestamp <= self.maxage: return result` / `result =
> self.func(*args)` / `self.cache[args] = monotonic(), result` / `if len(self.cache) >
> self.maxsize: self.cache.popitem(last=False)` / `return result`. Also `MultiHitLRUCache`
> (*"LRU cache that defers caching a result until it has been requested multiple times."*).

**Source (pure spec) `Lib/collections/__init__.py` l.89–342:** comments l.91–102 (verbatim):
*"An inherited dict maps keys to values."* · *"The inherited dict provides __getitem__, __len__,
__contains__, and get."* · *"The remaining methods are order-aware."* · *"Big-O running times for
all methods are the same as regular dictionaries."* · *"The internal self.__map dict maps keys to
links in a doubly linked list."* · *"The circular doubly linked list starts and ends with a
sentinel element."* · `__setitem__` l.119: new key only → new link at end; existing key keeps its
position. `update = __update = MutableMapping.update` (l.228) ⇒ update goes through
`self[key] = value`. `setdefault` l.268 goes through `self[key] = default`. `__eq__` l.317:
`dict.__eq__(self, other) and all(map(_eq, self, other))` when other is OD. `copy` l.304 →
`self.__class__(self)`. `fromkeys` l.309 → `cls()` then `self[key] = value`.
`__sizeof__` l.219–226: counts instance dict, internal map ×2, link objects and proxy objects.

**Source (C) `Objects/odictobject.c` @ v3.14.7:**
- header comment (verbatim): *"This implementation is necessarily explicitly equivalent to the
  pure Python OrderedDict class in Lib/collections/__init__.py. The strategy there involves using
  a doubly-linked-list to capture the order."* · *"One invariant of Python's OrderedDict is that
  it preserves time complexity of dict's methods, particularly the O(1) operations."* · chosen
  approach #2: *"mirroring the key order of dict's dk_entries with an array of node pointers."*
  (`od_fast_nodes`, l.496 *"hash table that mirrors the dict table"*).
- `od_state` l.500 *"incremented whenever the LL changes"* — `_odict_add_head` / `_odict_add_tail`
  (used by new keys **and move_to_end**) / node removal / clear all do `od->od_state++`
  (l.664, 678, 743, 813).
- iterator `odictiter_nextkey_lock_held` l.~1741: *"In order to protect against modifications
  during iteration, we track the current key instead of the current node."* · if `od_state`
  changed → `RuntimeError("OrderedDict mutated during iteration")` (l.1755–1756); if size changed
  → `RuntimeError("OrderedDict changed size during iteration")` (l.1760–1761).
  ⇒ `move_to_end` (or delete+reinsert) inside `for k in od` raises; `od[k] = v` on an existing key
  does not.
- `mutablemapping_update` (l.2352) → `mutablemapping_add_pairs` / `_update_arg` use
  **`PyObject_SetItem`** (l.2270, 2320) ⇒ `OrderedDict.update()` and the constructor **do call a
  subclass's `__setitem__`** (unlike `dict`, see 03-dict/09). `odict_setdefault` for a subclass
  uses `PyObject_SetItem` (l.1069). Implementation detail.
- `popitem` on empty → `KeyError("dictionary is empty")` (l.1165).

**functools.lru_cache** (<https://docs.python.org/3.14/library/functools.html#functools.lru_cache>):
> *"Decorator to wrap a function with a memoizing callable that saves up to the *maxsize* most
> recent calls."* · *"The cache is threadsafe so that the wrapped function can be used in multiple
> threads. This means that the underlying data structure will remain coherent during concurrent
> updates."* · *"It is possible for the wrapped function to be called more than once if another
> thread makes an additional call before the initial call has been completed and cached."* ·
> *"Since a dictionary is used to cache results, the positional and keyword arguments to the
> function must be hashable."* · *"If *maxsize* is set to `None`, the LRU feature is disabled and
> the cache can grow without bound."* · *"An LRU (least recently used) cache works best when the
> most recent calls are the best predictors of upcoming calls"*.

**json** `object_pairs_hook` (<https://docs.python.org/3.14/library/json.html#json.load>): *"If set,
a function that is called with the result of any JSON object literal decoded with an ordered list
of pairs. The return value of this function will be used instead of the `dict`."* (3.1)

---

## 8 · `UserDict`, `UserList`, `UserString`

URLs: <https://docs.python.org/3.14/library/collections.html#userdict-objects>,
`#userlist-objects`, `#userstring-objects`.

UserDict — see 03-dict/09b (all quotes banked there). Extra here:
> *"Class that simulates a dictionary. The instance's contents are kept in a regular dictionary,
> which is accessible via the `data` attribute of `UserDict` instances. If arguments are
> provided, they are used to initialize `data`, like a regular dictionary."*

UserList:
> *"This class acts as a wrapper around list objects. It is a useful base class for your own
> list-like classes which can inherit from them and override existing methods or add new ones. In
> this way, one can add new behaviors to lists."*
> *"The need for this class has been partially supplanted by the ability to subclass directly from
> `list`; however, this class can be easier to work with because the underlying list is
> accessible as an attribute."*
> *"Class that simulates a list. The instance's contents are kept in a regular list, which is
> accessible via the `data` attribute of `UserList` instances. The instance's contents are
> initially set to a copy of *list*, defaulting to the empty list `[]`. *list* can be any
> iterable, for example a real Python list or a `UserList` object."*
> *"**Subclassing requirements:** Subclasses of `UserList` are expected to offer a constructor
> which can be called with either no arguments or one argument. List operations which return a
> new sequence attempt to create an instance of the actual implementation class. To do so, it
> assumes that the constructor can be called with a single parameter, which is a sequence object
> used as a data source."*
> *"If a derived class does not wish to comply with this requirement, all of the special methods
> supported by this class will need to be overridden; please consult the sources for information
> about the methods which need to be provided in that case."*

UserString:
> *"The class, `UserString` acts as a wrapper around string objects. The need for this class has
> been partially supplanted by the ability to subclass directly from `str`; however, this class
> can be easier to work with because the underlying string is accessible as an attribute."*
> *"Class that simulates a string object. The instance's content is kept in a regular string
> object, which is accessible via the `data` attribute of `UserString` instances. The instance's
> contents are initially set to a copy of *seq*. The *seq* argument can be any object which can be
> converted into a string using the built-in `str()` function."*
> *"Changed in version 3.5: New methods `__getnewargs__`, `__rmod__`, `casefold`, `format_map`,
> `isprintable`, and `maketrans`."*

**Source — `Lib/collections/__init__.py` @ v3.14.7:**
UserDict (l.1133): `__init__(self, dict=None, /, **kwargs)` → `self.data = {}` then
`self.update(...)` (MutableMapping.update → `__setitem__`). `__getitem__` l.1146 honours class
`__missing__`. `__contains__` l.1164 / `get` l.1167 read `self.data` (03-dict/09b).
`__repr__` l.1174 **`return repr(self.data)`** ⇒ prints exactly like a dict.
`__or__` l.1177 → `self.__class__(self.data | other)` (constructor → update → `__setitem__`).
**`__ior__` l.1191: `self.data |= other`** ⇒ `|=` **bypasses an overridden `__setitem__`**.
`__copy__` l.1198 copies `__dict__` and `data` directly. `copy` l.1205: exact UserDict →
`UserDict(self.data.copy())`; subclass → temporarily empties `self.data`, `copy.copy(self)`,
restores, then **`c.update(self)`** (through `__setitem__`). `fromkeys` l.1219 → `cls()` then
`d[key] = value`.

UserList (l.1230): `__init__(self, initlist=None)`: exact list → `self.data[:] = initlist`
(copy); UserList → `initlist.data[:]`; else `list(initlist)`. Comment *"XXX should this accept
an arbitrary sequence?"*. `__repr__` l.1244 `repr(self.data)`. Comparisons l.1247–1263 compare
`self.data` with `other.data` or `other` (so `UserList([1]) == [1]` is data equality).
`__getitem__` l.1271: slice → `self.__class__(self.data[i])`. `__setitem__` l.1277 /
`__delitem__` l.1280 → `self.data`. `__add__` l.1283: UserList / list / **else
`self.__class__(self.data + list(other))`** ⇒ `UserList([1]) + (2,)` works (a list would
raise). `__radd__` l.1290, `__iadd__` l.1297 (`self.data += list(other)` for non-list),
`__mul__` l.1306, `__imul__`. **`append` l.1322 `self.data.append(item)`, `insert` l.1325,
`pop` l.1328, `remove` l.1331, `clear` l.1334, `copy` l.1337 (`self.__class__(self)`), `count`,
`index`, `reverse`, `sort` l.1349, `extend` l.1352 — every one writes `self.data` directly; none
routes through `__setitem__`.** ⇒ UserList is NOT a single-funnel class (contrast UserDict,
whose inherited `update`/`setdefault` go through `__setitem__`, and `MutableSequence`, whose
mixins route through `insert`/`__setitem__`/`__delitem__`).

UserString (l.1363): `__init__(self, seq)` str → data; UserString → `seq.data[:]`; else
`str(seq)`. `__str__` l.1373 `str(self.data)`; `__repr__` l.1376 `repr(self.data)` (prints like a
str literal); `__int__`, `__float__`, `__complex__`; **`__hash__` l.1388 `hash(self.data)`**;
`__eq__` / ordering compare data (with UserString unwrap). `__getitem__` l.1427
`self.__class__(self.data[index])`. `__add__` l.1430: UserString / str / else
`self.__class__(self.data + str(other))` ⇒ **anything added is `str()`-converted and wrapped
in the subclass**; `__radd__` l.1437 likewise; `__mul__`; **`__mod__` l.1447
`self.__class__(self.data % args)`**; `__rmod__` l.1450.
Methods returning `self.__class__`: capitalize, casefold, center, removeprefix, removesuffix,
expandtabs, ljust, lower, lstrip, replace, rjust, rstrip, strip, swapcase, title, translate,
upper, zfill. Methods returning **plain** values: `count`, `encode` (bytes), `endswith`, `find`,
`format` (l.1494 `self.data.format(...)` → str), `format_map` (str), `index`, `is*`, **`join`
l.1541 → str**, `partition`/`rpartition` (tuple of str), **`split`/`rsplit`/`splitlines` → list of
str**, `startswith`. `maketrans = str.maketrans`. No `__format__` defined (⇒ `object.__format__`).

**object.__format__** (<https://docs.python.org/3.14/reference/datamodel.html#object.__format__>):
> *"The default implementation by the `object` class should be given an empty *format_spec*
> string. It delegates to `__str__()`."* · *"Changed in version 3.4: The __format__ method of
> `object` itself raises a `TypeError` if passed any non-empty string."*
⇒ `f"{user_string:>10}"` raises TypeError; `f"{user_string}"` works.
**str.join** (<https://docs.python.org/3.14/library/stdtypes.html#str.join>): *"A `TypeError`
will be raised if there are any non-string values in *iterable*, including `bytes` objects."*
**os.fspath** (<https://docs.python.org/3.14/library/os.html#os.fspath>): *"If `str` or `bytes`
is passed in, it is returned unchanged. Otherwise `__fspath__()` is called and its value is
returned as long as it is a `str` or `bytes` object. In all other cases, `TypeError` is raised."*
(UserString defines no `__fspath__`.)

**MutableSequence mixins** (`Lib/_collections_abc.py` l.1104–1168): abstract `__setitem__`,
`__delitem__`, `insert` (+ Sequence's `__getitem__`, `__len__`); docstring *"Concrete subclasses
must provide __new__ or __init__, __getitem__, __setitem__, __delitem__, __len__, and insert()."*
`append` → `self.insert(len(self), value)`; `clear` → pop until IndexError; `reverse` → swaps
through `self[i]`; `extend` → `self.append(v)` each (copies `values` first if `values is self`);
`pop` → `v = self[index]; del self[index]`; `remove` → `del self[self.index(value)]`;
`__iadd__` → `extend`. l.1171–1172 `MutableSequence.register(list)`, `(bytearray)`.

---

## 9 · Cross-cutting: pickle, copy, JSON, isinstance

**pickle** (<https://docs.python.org/3.14/library/pickle.html#what-can-be-pickled-and-unpickled>):
> *"functions (built-in and user-defined) accessible from the top level of a module (using `def`,
> not `lambda`);"* · *"classes accessible from the top level of a module;"* · *"Attempts to pickle
> unpicklable objects will raise the `PicklingError` exception; when this happens, an unspecified
> number of bytes may have already been written to the underlying file."* · *"Note that functions
> (built-in and user-defined) are pickled by fully qualified name, not by value. This means that
> only the function name is pickled, along with the name of the containing module and classes."*
⇒ `defaultdict(lambda: 0)` / `defaultdict(lambda: defaultdict(int))` cannot be pickled
(multiprocessing arguments, pickle-based caches). `functools.partial` has `__reduce__`
(`Lib/functools.py` l.400; C `partial_reduce` `_functoolsmodule.c` l.697) ⇒
`partial(defaultdict, int)` pickles when its parts do (source-derived).

**copy** (<https://docs.python.org/3.14/library/copy.html>):
> *"This module does not copy types like module, method, stack trace, stack frame, file, socket,
> window, or any similar types. It does "copy" functions and classes (shallow and deeply), by
> returning the original object unchanged; this is compatible with the way these are treated by
> the `pickle` module."*
> *"Shallow copies of many collections can be made using the corresponding `copy()` method (such
> as `list.copy()`, `dict.copy()` or `set.copy()`), and of sequences (such as lists or bytearrays)
> by making a slice of the entire sequence (`sequence[:]`). However, these methods and slicing can
> create an instance of the base type when copying an instance of a subclass, whereas
> `copy.copy()` normally returns an instance of the same type."*

**isinstance matrix (from class definitions above):**
| type | base | `isinstance(x, dict)` | `isinstance(x, list)` | ABC |
|---|---|---|---|---|
| defaultdict, Counter, OrderedDict | dict (C / Py / C) | ✅ | — | MutableMapping (via dict) |
| ChainMap, UserDict | MutableMapping | ❌ | — | MutableMapping |
| deque | object (C), **registered** MutableSequence | — | ❌ | MutableSequence (virtual) |
| UserList | MutableSequence | — | ❌ | MutableSequence |
| UserString | Sequence | — | — (`isinstance(x, str)` ❌) | Sequence |
| namedtuple class | tuple | — | — | Sequence (via tuple) |

**heapq.nlargest** (<https://docs.python.org/3.14/library/heapq.html#heapq.nlargest>): *"Return a
list with the *n* largest elements from the dataset defined by *iterable*."* … *"Equivalent to:
`sorted(iterable, key=key, reverse=True)[:n]`."*

---

## 10 · Could NOT settle — write as uncertain or leave out

1. **Any timing or byte figure** — deque vs list speed, OrderedDict memory multiple vs dict,
   namedtuple class-creation cost, Counter vs defaultdict(int) speed. Docs give only the
   qualitative *"Space efficiency, iteration speed, and the performance of update operations were
   secondary"* for OrderedDict. **No numbers on any page.**
2. **Free-threaded guarantees for deque/defaultdict/Counter/OrderedDict.** The 3.14 thread-safety
   page documents list and dict only. Source shows `@critical_section` on deque methods and
   `PyDict_SetDefaultRef` in `defdict_missing` — label as implementation detail, not promise.
3. Whether `Counter.update(iterable)` is atomic with respect to other threads — undocumented;
   do not claim.
4. The `defdict_reduce` comment's claim that functions are not deep-copyable — contradicted by
   `copy` docs; do not repeat it; state the copy-docs behaviour.
5. Exact `AttributeError` text for assigning `deque.maxlen` — generic getset message not read;
   say "AttributeError" only.
6. Exact TypeError text when `re` or other C APIs receive a `UserString` — not read; use only
   `json`, `str.join`, `os.fspath`, `object.__format__`, which are documented.
7. Whether the C `OrderedDict` uses more or less memory than the pure one — not stated; skip.
8. `Counter` + free-threading correctness of `most_common` during concurrent mutation — skip.

---

## 11 · Addenda (same session, same tag)

**What's New 3.10** (<https://docs.python.org/3.14/whatsnew/3.10.html#removed>), verbatim:
> *"Remove deprecated aliases to Collections Abstract Base Classes from the `collections`
> module."* (bpo-37324)
⇒ `from collections import Mapping` raises `ImportError` on 3.10+; use `collections.abc`.
`collections.abc` doc: *"Added in version 3.3: Formerly, this module was part of the
`collections` module."*

**dataclasses — Mutable default values** (<https://docs.python.org/3.14/library/dataclasses.html#mutable-default-values>):
> *"Python stores default member variable values in class attributes."* … *"There is no general
> way for Data Classes to detect this condition. Instead, the `@dataclass` decorator will raise a
> `ValueError` if it detects an unhashable default parameter. The assumption is that if a value is
> unhashable, it is mutable. This is a partial solution, but it does protect against many common
> errors."* … *"Using default factory functions is a way to create new instances of mutable types
> as default values for fields"* — doc: `x: list = field(default_factory=list)`.
⇒ `field: defaultdict = defaultdict(list)` in a dataclass raises ValueError (dict subclass is
unhashable); a plain class attribute `handlers = defaultdict(list)` is silently shared.

**os.environ** (<https://docs.python.org/3.14/library/os.html#os.environ>), verbatim:
> *"Assignments to items in `os.environ` are automatically translated into corresponding calls to
> `putenv()`; however, calls to `putenv()` don't update `os.environ`, so it is actually preferable to
> assign to items of `os.environ`."*
⇒ a `ChainMap` with `os.environ` at `maps[0]` sets real env vars on write.

**Error-message formats** (source, v3.14.7): `Objects/object.c` l.1084
`"'%s' not supported between instances of '%.100s' and '%.100s'"`; `Objects/abstract.c`
`"unsupported operand type(s) for %.100s: '%.100s' and '%.100s'"`; deque slice →
`"sequence index must be integer, not '%.200s'"` (banked in the slicing research, §9).

**Why a dict is worse than OrderedDict at front-removal churn** — `Objects/dictobject.c` @ v3.14.7,
`dictiter_iternextkey_lock_held` (l.5228, the default/GIL build; the free-threaded build uses
`dictiter_iternext_threadsafe`): a new iterator starts at `di_pos = 0` and runs
`while (i < n && entry_ptr->me_value == NULL) { entry_ptr++; i++; }` — it **skips deleted
entries one by one**. So `next(iter(d))` after many pops from the front of a dict scans every dead
entry before the first live one, until a resize rebuilds the entries array (deletion never
shrinks — 03-dict/08). OrderedDict's first/last are linked-list ends (O(1)). This is the concrete
mechanism behind the doc's *"The `OrderedDict` algorithm can handle frequent reordering operations
better than `dict`."* Implementation detail; no timing.
⚠️ `../03-dict/02b-working-with-the-order.md` l.230 says `next(iter(d))` reads the first key
"at O(1)" — true for a dict without front deletions; not after churn (reported, not fixed).

**functools.lru_cache has no per-key invalidation** — its documented extras are `cache_info()`,
`cache_clear()`, `cache_parameters()` (functools.rst). (Checked by reading the section list; if a
page needs the exact wording, fetch once.)
Verbatim (functools.rst v3.14.7 l.197–222): *"The wrapped function is instrumented with a
`cache_parameters` function that returns a new `dict` showing the values for *maxsize* and
*typed*."* · *"the wrapped function is instrumented with a `cache_info` function that returns a
named tuple showing *hits*, *misses*, *maxsize* and *currsize*."* · *"The decorator also provides a
`cache_clear` function for clearing or invalidating the cache."* · *"The original underlying
function is accessible through the `__wrapped__` attribute."* · *"The cache keeps references to the
arguments and return values until they age out of the cache or until the cache is cleared."*

**time.monotonic** (<https://docs.python.org/3.14/library/time.html#time.monotonic>): *"Return the
value (in fractional seconds) of a monotonic clock, i.e. a clock that cannot go backwards. The clock
is not affected by system clock updates. The reference point of the returned value is undefined, so
that only the difference between the results of two calls is valid."*
**lru_cache keyword order**: *"Distinct argument patterns may be considered to be distinct calls with
separate cache entries. For example, `f(a=1, b=2)` and `f(b=2, a=1)` differ in their keyword argument
order and may have two separate cache entries."*

**sqlite3 parameter binding** — `Modules/_sqlite/cursor.c` @ v3.14.7 `bind_parameters` (l.640): sequence
path taken if `PyTuple_CheckExact || PyList_CheckExact || (!PyDict_Check(p) && PySequence_Check(p))`;
named path only `else if (PyDict_Check(parameters))`, which fetches each name with
`PyMapping_GetOptionalItemString`. Errors (verbatim formats): `"Incorrect number of bindings
supplied. The current statement uses %d, and there are %zd supplied."`, `"Binding %d ('%s') is a
named parameter, but you supplied a sequence which requires nameless (qmark) placeholders."`,
`"You did not supply a value for binding parameter :%s."` (all `ProgrammingError`).
`Objects/abstract.c` l.207 `PyMapping_GetOptionalItem`: exact dict → `PyDict_GetItemRef`; otherwise
`PyObject_GetItem` and a `KeyError` means "not found" ⇒ a **defaultdict/Counter** of parameters
answers a missing name via `__missing__` (default / 0 bound silently). l.1672 `PySequence_Check`:
false for dict subclasses, else `tp_as_sequence->sq_item != NULL`; `Objects/typeobject.c` l.11150
`SQSLOT(__getitem__, sq_item, …)` ⇒ any Python class defining `__getitem__` (UserDict, ChainMap)
passes `PySequence_Check` ⇒ sqlite3 treats a ChainMap/UserDict of named params as a **sequence**
and raises one of the two errors above.

**Pickling facts added for chunk 09** — `Objects/odictobject.c` @ v3.14.7 `OrderedDict___reduce___impl`
(l.989): `state = _PyObject_GetState(od)` then `(type, (), state, None, iter(items))` ⇒ instance
attributes survive. `Lib/os.py` @ v3.14.7 `_create_environ_mapping` (l.~765–797) defines
`encode`/`decode`/`encodekey`/`check_str` *inside the function* and passes them to `_Environ(...)`,
which stores them as attributes ⇒ `pickle.dumps(os.environ)` (and any ChainMap with that layer)
fails: local functions have no importable qualified name.
