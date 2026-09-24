---
name: research-python-p03-t04-set-and-frozenset
description: Banked primary sources for Python phase 3 topic 04 (set and frozenset) — verbatim quotes and URLs from the 3.14 docs and CPython v3.14.7 source. DO NOT RE-DERIVE.
metadata:
  type: project
---

# research — python phase 3, topic 04 · `set` and `frozenset`

🔴 **DO NOT RE-DERIVE.** Banked 2026-09-10 in one pass for the whole topic. Every quote
below was read from the CPython **3.14 branch** reST sources
(`https://raw.githubusercontent.com/python/cpython/3.14/Doc/…`), which are the text rendered
at `docs.python.org/3.14/…` — cite the docs.python.org URL on a page. Source-code facts were
read from the **`v3.14.7` tag** (`https://raw.githubusercontent.com/python/cpython/v3.14.7/…`).
reST markup (``x``, :class:`x`) has been converted to Markdown backticks; wording is verbatim.

Version spine: **CPython 3.14.7**. No sandbox — nothing was run; no program output was
produced. Error strings are quoted from the docs (What's New transcript) or from C source,
file named beside each.

---

## 1 · `stdtypes` — Set Types (the whole section)

URL: <https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset>

> *"A `set` object is an unordered collection of distinct hashable objects. Common uses
> include membership testing, removing duplicates from a sequence, and computing
> mathematical operations such as intersection, union, difference, and symmetric
> difference. (For other containers see the built-in `dict`, `list`, and `tuple` classes,
> and the `collections` module.) See Time complexity of operations on built-in types for
> the costs of the various set operations."*

> *"Like other collections, sets support `x in set`, `len(set)`, and `for x in set`. Being
> an unordered collection, sets do not record element position or order of insertion.
> Accordingly, sets do not support indexing, slicing, or other sequence-like behavior."*

> *"There are currently two built-in set types, `set` and `frozenset`. The `set` type is
> mutable --- the contents can be changed using methods like `add()` and `remove()`. Since
> it is mutable, it has no hash value and cannot be used as either a dictionary key or as
> an element of another set. The `frozenset` type is immutable and hashable --- its contents
> cannot be altered after it is created; it can therefore be used as a dictionary key or as
> an element of another set."*

> *"Non-empty sets (not frozensets) can be created by placing a comma-separated list of
> elements within braces, for example: `{'jack', 'sjoerd'}`, in addition to the `set`
> constructor."*

Constructor — `class set(iterable=(), /)` / `class frozenset(iterable=(), /)`:

> *"Return a new set or frozenset object whose elements are taken from iterable. The
> elements of a set must be hashable. To represent sets of sets, the inner sets must be
> `frozenset` objects. If iterable is not specified, a new empty set is returned."*

> *"Sets can be created by several means:* — *Use a comma-separated list of elements within
> braces: `{'jack', 'sjoerd'}`* — *Use a set comprehension: `{c for c in 'abracadabra' if c
> not in 'abc'}`* — *Use the type constructor: `set()`, `set('foobar')`, `set(['a', 'b',
> 'foo'])`"*

Operations on both types (signatures as documented in 3.14):

| Form | Verbatim |
|---|---|
| `len(s)` | *"Return the number of elements in set s (cardinality of s)."* |
| `x in s` / `x not in s` | *"Test x for membership in s."* / *"Test x for non-membership in s."* |
| `isdisjoint(other, /)` | *"Return `True` if the set has no elements in common with other. Sets are disjoint if and only if their intersection is the empty set."* |
| `issubset(other, /)`, `set <= other` | *"Test whether every element in the set is in other."* |
| `set < other` | *"Test whether the set is a proper subset of other, that is, `set <= other and set != other`."* |
| `issuperset(other, /)`, `set >= other` | *"Test whether every element in other is in the set."* |
| `set > other` | *"Test whether the set is a proper superset of other, that is, `set >= other and set != other`."* |
| `union(*others)`, `set \| other \| ...` | *"Return a new set with elements from the set and all others."* |
| `intersection(*others)`, `set & other & ...` | *"Return a new set with elements common to the set and all others."* |
| `difference(*others)`, `set - other - ...` | *"Return a new set with elements in the set that are not in the others."* |
| `symmetric_difference(other, /)`, `set ^ other` | *"Return a new set with elements in either the set or other but not both."* |
| `copy()` | *"Return a shallow copy of the set."* |

🔴 **Operators vs methods:**

> *"Note, the non-operator versions of `union()`, `intersection()`, `difference()`,
> `symmetric_difference()`, `issubset()`, and `issuperset()` methods will accept any
> iterable as an argument. In contrast, their operator based counterparts require their
> arguments to be sets. This precludes error-prone constructions like `set('abc') & 'cbs'`
> in favor of the more readable `set('abc').intersection('cbs')`."*

🔴 **Comparison semantics:**

> *"Both `set` and `frozenset` support set to set comparisons. Two sets are equal if and
> only if every element of each set is contained in the other (each is a subset of the
> other). A set is less than another set if and only if the first set is a proper subset
> of the second set (is a subset, but is not equal). A set is greater than another set if
> and only if the first set is a proper superset of the second set (is a superset, but is
> not equal)."*

> *"Instances of `set` are compared to instances of `frozenset` based on their members. For
> example, `set('abc') == frozenset('abc')` returns `True` and so does `set('abc') in
> set([frozenset('abc')])`."*

> *"The subset and equality comparisons do not generalize to a total ordering function. For
> example, any two nonempty disjoint sets are not equal and are not subsets of each other,
> so all of the following return `False`: `a<b`, `a==b`, or `a>b`."*

> *"Since sets only define partial ordering (subset relationships), the output of the
> `list.sort()` method is undefined for lists of sets."*

> *"Set elements, like dictionary keys, must be hashable."*

> *"Binary operations that mix `set` instances with `frozenset` return the type of the first
> operand. For example: `frozenset('ab') | set('bc')` returns an instance of `frozenset`."*

Mutating operations (`set` only) — *"The following table lists operations available for
`set` that do not apply to immutable instances of `frozenset`:"*

| Form | Verbatim |
|---|---|
| `update(*others)`, `set \|= other \| ...` | *"Update the set, adding elements from all others."* |
| `intersection_update(*others)`, `set &= other & ...` | *"Update the set, keeping only elements found in it and all others."* |
| `difference_update(*others)`, `set -= other \| ...` | *"Update the set, removing elements found in others."* |
| `symmetric_difference_update(other, /)`, `set ^= other` | *"Update the set, keeping only elements found in either set, but not in both."* |
| `add(elem, /)` | *"Add element elem to the set."* |
| `remove(elem, /)` | *"Remove element elem from the set. Raises `KeyError` if elem is not contained in the set."* |
| `discard(elem, /)` | *"Remove element elem from the set if it is present."* |
| `pop()` | *"Remove and return an arbitrary element from the set. Raises `KeyError` if the set is empty."* |
| `clear()` | *"Remove all elements from the set."* |

> *"Note, the non-operator versions of the `update()`, `intersection_update()`,
> `difference_update()`, and `symmetric_difference_update()` methods will accept any
> iterable as an argument."*

> *"Note, the elem argument to the `__contains__()`, `remove()`, and `discard()` methods may
> be a set. To support searching for an equivalent frozenset, a temporary one is created
> from elem."*

seealso: *"For detailed information on thread-safety guarantees for `set` objects, see
Thread safety for set objects."* · *"Sets and frozensets are generic over the type of their
elements."*

Other `stdtypes` sentences banked:

- Truth value — <https://docs.python.org/3.14/library/stdtypes.html#truth-value-testing>:
  falsy includes *"empty sequences and collections: `''`, `()`, `[]`, `{}`, `set()`, `range(0)`"*.
- `list.sort` — <https://docs.python.org/3.14/library/stdtypes.html#list.sort>: *"This
  method sorts the list in place, using only `<` comparisons between items. Exceptions are
  not suppressed - if any comparison operations fail, the entire sort operation will fail
  (and the list will likely be left in a partially modified state)."*
- `dict` order — <https://docs.python.org/3.14/library/stdtypes.html#dict>: *"Dictionaries
  preserve insertion order. Note that updating a key does not affect the order. Keys added
  after deletion are inserted at the end."*
- `dict.fromkeys(iterable, value=None, /)` — <https://docs.python.org/3.14/library/stdtypes.html#dict.fromkeys>:
  *"Create a new dictionary with keys from iterable and values set to value."* ·
  *"`fromkeys()` is a class method that returns a new dictionary. value defaults to `None`.
  All of the values refer to just a single instance, so it generally doesn't make sense for
  value to be a mutable object such as an empty list. To get distinct values, use a dict
  comprehension instead."*
- Dict views — <https://docs.python.org/3.14/library/stdtypes.html#dictionary-view-objects>:
  *"Keys views are set-like since their entries are unique and hashable. Items views also
  have set-like operations since the (key, value) pairs are unique and the keys are
  hashable. If all values in an items view are hashable as well, then the items view can
  interoperate with other sets. (Values views are not treated as set-like since the entries
  are generally not unique.) For set-like views, all of the operations defined for the
  abstract base class `collections.abc.Set` are available (for example, `==`, `<`, or `^`).
  While using set operators, set-like views accept any iterable as the other operand,
  unlike sets which only accept sets as the input."*

---

## 2 · Time complexity (new page in 3.14) — the set section

URL: <https://docs.python.org/3.14/library/time-complexity.html> — ✅ **exists in 3.14**
(sibling report confirmed). Linked from the Set Types intro above.

> *"This page documents the time complexity of various operations on built-in types in
> CPython. Other Python implementations may have different performance characteristics.
> Additionally, the listed costs assume exact built-in types, as instances of subclasses
> may have different costs."*

> *"We use Big O notation to describe how the running time of an operation grows with the
> size of its inputs. Unless stated otherwise, n denotes the number of elements currently in
> the container, and k is the value of a numeric parameter, such as an index or a repeat
> count."*

dict preamble (the set section defers to it):

> *"The times listed for dict objects are average-case times, as they assume the hash
> function for the objects is sufficiently robust to make collisions uncommon. They also
> assume the keys are well-distributed among the set of possible keys. In the worst case,
> when every key hashes to the same value, each of the O(1) operations below instead takes
> O(n) time. They also assume that hashing and comparing a key is O(1). For more detail on
> the implementation, see How are dictionaries implemented in CPython?."*

🔴 set section, verbatim:

> *"See `dict` as the `set` and `frozenset` implementations are similar, and the same
> caveats apply. In the worst case, O(1) operations instead take O(n) time, and operations
> that look up every element degrade accordingly."*

> *"A `frozenset` is immutable, so it does not support adding, discarding, or the in-place
> update operations. The others below apply to it at the same costs."*

| Operation | Complexity | Notes |
|---|---|---|
| `x in s` | O(1) | |
| Copy (`s.copy()`) | O(n) | [6] [7] |
| Add (`s.add(x)`) | O(1) | [1] |
| Discard (`s.discard(x)`, `s.remove(x)`) | O(1) | |
| Union (`s1 \| s2`, `s1.union(s2)`) | O(len(s1) + len(s2)) | [7] |
| Update (`s1 \|= s2`, `s1.update(s2)`) | O(len(s2)) | [1] [7] |
| Intersection (`s1 & s2`, `s1.intersection(s2)`) | O(min(len(s1), len(s2))) | [7] [8] |
| Intersection update (`s1 &= s2`, `s1.intersection_update(s2)`) | O(min(len(s1), len(s2))) | [1] [7] [8] |
| Difference (`s1 - s2`, `s1.difference(s2)`) | O(len(s1)) | [7] [9] |
| Difference update (`s1 -= s2`, `s1.difference_update(s2)`) | O(min(len(s1), len(s2))) | [1] [7] [8] |
| Symmetric difference (`s1 ^ s2`, `s1.symmetric_difference(s2)`) | O(len(s1) + len(s2)) | [7] |
| Symmetric difference update (`s1 ^= s2`, …) | O(len(s2)) | [1] [7] |
| Get length (`len(s)`) | O(1) | [5] |

**Not in the set table:** iteration, `pop`, `clear`, `issubset`/`<=`, `issuperset`,
`isdisjoint`, `==`. (dict table does have "Iteration [7] O(n)".)

Footnotes verbatim:

- [1] *"Amortized. An individual operation may occasionally be O(n) when the underlying
  storage is resized, but this cost is spread over many operations, depending on the
  history of the container."*
- [3] *"Plus the cost of iterating over t, which may be expensive for an arbitrary iterable."*
- [5] *"The number of elements is stored in the object, so `len()` does not need to count them."*
- [6] *"Copying a `frozenset` is O(1) as it returns the original object."*
- 🔴 [7] *"These operations scan the container's internal hash table, which is not shrunk
  when elements are removed. After removing most elements, they still take time
  proportional to the container's former size, until a later insertion triggers a resize."*
- [8] *"O(len(t)) if t is not a set."*
- [9] *"O(len(s) + len(t)) if t is not a set."*

list table rows used for contrast: `x in l` **O(n)**; Copy O(n); Append O(1) [1].
tuple table: `x in t` **O(n)**.

---

## 3 · Thread safety — the set section (verbatim, whole)

URL: <https://docs.python.org/3.14/library/threadsafety.html#thread-safety-for-set-objects>
(label `thread-safety-set`)

Page intro: *"This page documents thread-safety guarantees for built-in types in Python's
free-threaded build. The guarantees described here apply when using Python with the GIL
disabled (free-threaded mode). When the GIL is enabled, most operations are implicitly
serialized."*

> *"The `len()` function is lock-free and atomic."*

> *"The following read operation is lock-free. It does not block concurrent modifications
> and may observe intermediate states from operations that hold the per-object lock:"*
> `elem in s    # set.__contains__`

> *"This operation may compare elements using `__eq__()`, which can execute arbitrary Python
> code. During such comparisons, the set may be modified by another thread. For built-in
> types like `str`, `int`, and `float`, `__eq__()` does not release the underlying lock
> during comparisons and this is not a concern."*

> *"All other operations from here on hold the per-object lock."*

> *"Adding or removing a single element is safe to call from multiple threads and will not
> corrupt the set:"* — `s.add(elem)`, `s.remove(elem)`, `s.discard(elem)`, `s.pop()` —
> *"These operations also compare elements, so the same `__eq__()` considerations as above
> apply."*

> *"The `copy()` method returns a new object and holds the per-object lock for the duration
> so that it is always atomic."*

> *"The `clear()` method holds the lock for its duration. Other threads cannot observe
> elements being removed."*

> *"The following operations only accept `set` or `frozenset` as operands and always lock
> both objects:"* — `s |= other`, `s &= other`, `s -= other`, `s ^= other`, `s & other`,
> `s | other`, `s - other`, `s ^ other` (each commented *"other must be set/frozenset"*).

> *"`set.update()`, `set.union()`, `set.intersection()` and `set.difference()` can take
> multiple iterables as arguments. They all iterate through all the passed iterables and do
> the following:"* — *"`set.update()` and `set.union()` lock both objects only when the
> other operand is a `set`, `frozenset`, or `dict`."* — *"`set.intersection()` and
> `set.difference()` always try to lock all objects."*

> *"`set.symmetric_difference()` tries to lock both objects."*

> *"The update variants of the above methods also have some differences between them:"* —
> *"`set.difference_update()` and `set.intersection_update()` try to lock all objects
> one-by-one."* — *"`set.symmetric_difference_update()` only locks the arguments if it is of
> type `set`, `frozenset`, or `dict`."*

> *"The following methods always try to lock both objects:"* — `s.isdisjoint(other)`,
> `s.issubset(other)`, `s.issuperset(other)` (*"both locked"*).

🔴 > *"Operations that involve multiple accesses, as well as iteration, are never atomic:"*

```python
# NOT atomic: check-then-act
if elem in s:
      s.remove(elem)

# NOT thread-safe: iteration while modifying
for elem in s:
      process(elem)  # another thread may modify s
```

> *"Consider external synchronization when sharing `set` instances across threads. See
> Python support for free threading for more information."*

⚠️ Unlike the dict and bytearray sections, the set section shows **no "good" fix block**
for check-then-act or iteration. Fixes on a page must be derived from the documented
guarantees (`discard` is a single safe operation; `copy()` is atomic) and labelled so.

Free-threading HOWTO — <https://docs.python.org/3.14/howto/free-threading-python.html>:

> *"The free-threaded build of CPython aims to provide similar thread-safety behavior at the
> Python level to the default GIL-enabled build. Built-in types like `dict`, `list`, and
> `set` use internal locks to protect against concurrent modifications in ways that behave
> similarly to the GIL. However, Python has not historically guaranteed specific behavior
> for concurrent modifications to these built-in types, so this should be treated as a
> description of the current implementation, not a guarantee of current or future
> behavior."*

> *"It's recommended to use the `threading.Lock` or other synchronization primitives instead
> of relying on the internal locks of built-in types, when possible."*

Glossary — <https://docs.python.org/3.14/glossary.html>:

- **atomic operation** — *"An operation that appears to execute as a single, indivisible
  step: no other thread can observe it half-done, and its effects become visible all at
  once. Python does not guarantee that high-level statements are atomic (for example,
  `x += 1` performs multiple bytecode operations and is not atomic). Atomicity is only
  guaranteed where explicitly documented."*
- **lock-free** — *"An operation that does not acquire any lock and uses atomic CPU
  instructions to ensure correctness. Lock-free operations can execute concurrently without
  blocking each other and cannot be blocked by operations that hold locks. In free-threaded
  Python, built-in types like `dict` and `list` provide lock-free read operations, which
  means other threads may observe intermediate states during multi-step modifications even
  when those modifications hold the per-object lock."*
- **per-object lock** — *"A lock associated with an individual object instance rather than a
  global lock shared across all objects. In free-threaded Python, built-in types like `dict`
  and `list` use per-object locks to allow concurrent operations on different objects while
  serializing operations on the same object. Operations that hold the per-object lock
  prevent other locking operations on the same object from proceeding, but do not block
  lock-free operations."*
- **immutable** — *"An object with a fixed value. Immutable objects include numbers, strings
  and tuples. Such an object cannot be altered. A new object has to be created if a
  different value has to be stored. They play an important role in places where a constant
  hash value is needed, for example as a key in a dictionary. Immutable objects are
  inherently thread-safe because their state cannot be modified after creation, eliminating
  concerns about improperly synchronized concurrent modification."*

Across processes — `multiprocessing` — <https://docs.python.org/3.14/library/multiprocessing.html#multiprocessing.managers.SyncManager.set>:
`set()` / `set(sequence)` / `set(mapping)` — *"Create a shared `set` object and return a
proxy for it."* — *"Added in version 3.14: `set` support was added."* (What's New 3.14:
*"Add support for shared `set` objects via `SyncManager.set()`. The `set()` in `Manager()`
method is now available."*)

---

## 4 · Language reference — displays, comprehensions, membership, comparisons

Set displays — <https://docs.python.org/3.14/reference/expressions.html#set-displays>:

> *"A set display is denoted by curly braces and distinguishable from dictionary displays by
> the lack of colons separating keys and values:"* — grammar
> `set_display: "{" (flexible_expression_list | comprehension) "}"`

> *"A set display yields a new mutable set object, the contents being specified by either a
> sequence of expressions or a comprehension. When a comma-separated list of expressions is
> supplied, its elements are evaluated from left to right and added to the set object. When
> a comprehension is supplied, the set is constructed from the elements resulting from the
> comprehension."*

🔴 > *"An empty set cannot be constructed with `{}`; this literal constructs an empty dictionary."*

Expression lists / starred — <https://docs.python.org/3.14/reference/expressions.html#expression-lists>:
*"An asterisk `*` denotes iterable unpacking. Its operand must be an iterable. The iterable
is expanded into a sequence of items, which are included in the new tuple, list, or set, at
the site of the unpacking."* — *"Added in version 3.5: Iterable unpacking in expression
lists, originally proposed by PEP 448."*

Comprehensions — <https://docs.python.org/3.14/reference/expressions.html#displays-for-lists-sets-and-dictionaries>:
*"However, aside from the iterable expression in the leftmost `for` clause, the
comprehension is executed in a separate implicitly nested scope. This ensures that names
assigned to in the target list don't "leak" into the enclosing scope."* · *"The iterable
expression in the leftmost `for` clause is evaluated directly in the enclosing scope and
then passed as an argument to the implicitly nested scope."*

Tutorial — <https://docs.python.org/3.14/tutorial/datastructures.html#sets>:
*"A set is an unordered collection with no duplicate elements. Basic uses include
membership testing and eliminating duplicate entries."* · *"Curly braces or the `set()`
function can be used to create sets. Note: to create an empty set you have to use `set()`,
not `{}`; the latter creates an empty dictionary, a data structure that we discuss in the
next section."* · 🔴 *"Because sets are unordered, iterating over them or printing them can
produce the elements in a different order than you expect."*

🔴 Membership — <https://docs.python.org/3.14/reference/expressions.html#membership-test-operations>:

> *"The operators `in` and `not in` test for membership. `x in s` evaluates to `True` if x is
> a member of s, and `False` otherwise. `x not in s` returns the negation of `x in s`. All
> built-in sequences and set types support this as well as dictionary, for which `in` tests
> whether the dictionary has a given key. For container types such as list, tuple, set,
> frozenset, dict, or collections.deque, the expression `x in y` is equivalent to
> `any(x is e or x == e for e in y)`."*

> *"For user-defined classes which define the `__contains__()` method, `x in y` returns
> `True` if `y.__contains__(x)` returns a true value, and `False` otherwise."*

Value comparisons — <https://docs.python.org/3.14/reference/expressions.html#value-comparisons>:

> *"The default behavior for equality comparison (`==` and `!=`) is based on the identity of
> the objects. Hence, equality comparison of instances with the same identity results in
> equality, and equality comparison of instances with different identities results in
> inequality. A motivation for this default behavior is the desire that all objects should
> be reflexive (i.e. `x is y` implies `x == y`)."*

> *"The not-a-number values `float('NaN')` and `decimal.Decimal('NaN')` are special. Any
> ordered comparison of a number to a not-a-number value is false. A counter-intuitive
> implication is that not-a-number values are not equal to themselves. For example, if
> `x = float('NaN')`, `3 < x`, `x < 3` and `x == x` are all false, while `x != x` is true.
> This behavior is compliant with IEEE 754."*

> *"The built-in containers typically assume identical objects are equal to themselves.
> That lets them bypass equality tests for identical objects to improve performance and to
> maintain their internal invariants."* (in the Sequences bullet)

🔴 > *"Sets (instances of `set` or `frozenset`) can be compared within and across their
> types. They define order comparison operators to mean subset and superset tests. Those
> relations do not define total orderings (for example, the two sets `{1,2}` and `{2,3}`
> are not equal, nor subsets of one another, nor supersets of one another). Accordingly,
> sets are not appropriate arguments for functions which depend on total ordering (for
> example, `min()`, `max()`, and `sorted()` produce undefined results given a list of sets
> as inputs). Comparison of sets enforces reflexivity of its elements."*

Consistency rules: *"The `hash()` result should be consistent with equality. Objects that
are equal should either have the same hash value, or be marked as unhashable."* · *"Python
does not enforce these consistency rules. In fact, the not-a-number values are an example
for not following these rules."* · Inverse-comparison rule for `<`/`>=` *"apply to totally
ordered collections (e.g. to sequences, but not to sets or mappings)."*

---

## 5 · Data model

Set types — <https://docs.python.org/3.14/reference/datamodel.html#set-types>:

> *"These represent unordered, finite sets of unique, immutable objects. As such, they
> cannot be indexed by any subscript. However, they can be iterated over, and the built-in
> function `len()` returns the number of items in a set. Common uses for sets are fast
> membership testing, removing duplicates from a sequence, and computing mathematical
> operations such as intersection, union, difference, and symmetric difference."*

🔴 > *"For set elements, the same immutability rules apply as for dictionary keys. Note that
> numeric types obey the normal rules for numeric comparison: if two numbers compare equal
> (e.g., `1` and `1.0`), only one of them can be contained in a set."*

> Sets: *"These represent a mutable set. They are created by the built-in `set()`
> constructor and can be modified afterwards by several methods, such as `add()`."*
> Frozen sets: *"These represent an immutable set. They are created by the built-in
> `frozenset()` constructor. As a frozenset is immutable and hashable, it can be used again
> as an element of another set, or as a dictionary key."*

`object.__hash__` — <https://docs.python.org/3.14/reference/datamodel.html#object.__hash__>:

> *"Called by built-in function `hash()` and for operations on members of hashed
> collections including `set`, `frozenset`, and `dict`. The `__hash__()` method should
> return an integer. The only required property is that objects which compare equal have
> the same hash value; it is advised to mix together the hash values of the components of
> the object that also play a part in comparison of objects by packing them into a tuple
> and hashing the tuple."*

> *"If a class does not define an `__eq__()` method it should not define a `__hash__()`
> operation either; if it defines `__eq__()` but not `__hash__()`, its instances will not
> be usable as items in hashable collections. If a class defines mutable objects and
> implements an `__eq__()` method, it should not implement `__hash__()`, since the
> implementation of hashable collections requires that a key's hash value is immutable (if
> the object's hash value changes, it will be in the wrong hash bucket)."*

> *"User-defined classes have `__eq__()` and `__hash__()` methods by default (inherited
> from the `object` class); with them, all objects compare unequal (except with themselves)
> and `x.__hash__()` returns an appropriate value such that `x == y` implies both that
> `x is y` and `hash(x) == hash(y)`."*

> *"A class that overrides `__eq__()` and does not define `__hash__()` will have its
> `__hash__()` implicitly set to `None`. When the `__hash__()` method of a class is `None`,
> instances of the class will raise an appropriate `TypeError` when a program attempts to
> retrieve their hash value, and will also be correctly identified as unhashable when
> checking `isinstance(obj, collections.abc.Hashable)`."*

Note in the same entry: *"By default, the `__hash__()` values of str and bytes objects are
"salted" with an unpredictable random value. Although they remain constant within an
individual Python process, they are not predictable between repeated invocations of
Python."* · *"This is intended to provide protection against a denial-of-service caused by
carefully chosen inputs that exploit the worst case performance of a dict insertion,
O(n²) complexity."* · 🔴 *"Changing hash values affects the iteration order of sets.
Python has never made guarantees about this ordering (and it typically varies between
32-bit and 64-bit builds)."* · *"Changed in version 3.3: Hash randomization is enabled by
default."*

`object.__contains__` — <https://docs.python.org/3.14/reference/datamodel.html#object.__contains__>:
*"Called to implement membership test operators. Should return true if item is in self,
false otherwise."*

---

## 6 · Glossary — hashable

<https://docs.python.org/3.14/glossary.html#term-hashable>

> *"An object is hashable if it has a hash value which never changes during its lifetime
> (it needs a `__hash__()` method), and can be compared to other objects (it needs an
> `__eq__()` method). Hashable objects which compare equal must have the same hash value."*

> *"Hashability makes an object usable as a dictionary key and a set member, because these
> data structures use the hash value internally."*

> *"Most of Python's immutable built-in objects are hashable; mutable containers (such as
> lists or dictionaries) are not; immutable containers (such as tuples and frozensets) are
> only hashable if their elements are hashable. Objects which are instances of user-defined
> classes are hashable by default. They all compare unequal (except with themselves), and
> their hash value is derived from their `id()`."*

---

## 7 · Hash randomisation

`PYTHONHASHSEED` — <https://docs.python.org/3.14/using/cmdline.html#envvar-PYTHONHASHSEED>:
*"If this variable is not set or set to `random`, a random value is used to seed the hashes
of str and bytes objects."* · *"If `PYTHONHASHSEED` is set to an integer value, it is used
as a fixed seed for generating the hash() of the types covered by the hash randomization."*
· *"Its purpose is to allow repeatable hashing, such as for selftests for the interpreter
itself, or to allow a cluster of python processes to share hash values."* · *"The integer
must be a decimal number in the range [0,4294967295]. Specifying the value 0 will disable
hash randomization."*

`-R` — <https://docs.python.org/3.14/using/cmdline.html#cmdoption-R>: *"Turn on hash
randomization. This option only has an effect if the `PYTHONHASHSEED` environment variable
is set to anything other than `random`, since hash randomization is enabled by default."* ·
*"Hash randomization is intended to provide protection against a denial-of-service caused
by carefully chosen inputs that exploit the worst case performance of a dict construction,
O(n²) complexity."*

Design FAQ — <https://docs.python.org/3.14/faq/design.html#how-are-dictionaries-implemented-in-cpython>:
*"CPython's dictionaries are implemented as resizable hash tables. Compared to B-trees, this
gives better performance for lookup (the most common operation by far) under most
circumstances, and the implementation is simpler."* · *"The hash code varies widely
depending on the key and a per-process seed"* · *"Assuming that you're storing keys that
all have different hash values, this means that dictionaries take constant time -- O(1), in
Big-O notation -- to retrieve a key."*

---

## 8 · Numeric hashing, NaN

<https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types>:
*"For numbers `x` and `y`, possibly of different types, it's a requirement that
`hash(x) == hash(y)` whenever `x == y`"* · rule: *"If `x = m / n` is a nonnegative rational
number and `n` is not divisible by `P`, define `hash(x)` as `m * invmod(n, P) % P`"* (so for
a non-negative int below `P`, `hash(n) == n`) · *"If `x = m / n` is a negative rational
number define `hash(x)` as `-hash(-x)`. If the resulting hash is `-1`, replace it with
`-2`."* (so `hash(-1) == hash(-2)`) · the reference `hash_float`: `if math.isnan(x): return
object.__hash__(x)`.

What's New 3.10 — <https://docs.python.org/3.14/whatsnew/3.10.html>: *"Hashes of NaN values
of both `float` type and `decimal.Decimal` type now depend on object identity. Formerly,
they always hashed to `0` even though NaN values are not equal to one another. This caused
potentially quadratic runtime behavior due to excessive hash collisions when creating
dictionaries and sets containing multiple NaNs."*

---

## 9 · `collections.abc.Set` / `MutableSet`

<https://docs.python.org/3.14/library/collections.abc.html#collections.abc.Set>

Table: `Set` — inherits `Collection`; abstract `__contains__`, `__iter__`, `__len__`;
mixins `__le__`, `__lt__`, `__eq__`, `__ne__`, `__gt__`, `__ge__`, `__and__`, `__or__`,
`__sub__`, `__rsub__`, `__xor__`, `__rxor__` and `isdisjoint`. `MutableSet` — adds abstract
`add`, `discard`; mixins: inherited Set methods and `clear`, `pop`, `remove`, `__ior__`,
`__iand__`, `__ixor__`, and `__isub__`. (**No `union()`/`intersection()` named methods.**)

> *"Several of the ABCs are also useful as mixins that make it easier to develop classes
> supporting container APIs. For example, to write a class supporting the full `Set` API,
> it is only necessary to supply the three underlying abstract methods: `__contains__()`,
> `__iter__()`, and `__len__()`. The ABC supplies the remaining methods such as `__and__()`
> and `isdisjoint()`"* — followed by the `ListBasedSet` example (*"Alternate set
> implementation favoring space over speed and not requiring the set elements to be
> hashable."*).

Notes (1)–(3), verbatim:

> (1) *"Since some set operations create new sets, the default mixin methods need a way to
> create new instances from an iterable. The class constructor is assumed to have a
> signature in the form `ClassName(iterable)`. That assumption is factored-out to an
> internal classmethod called `_from_iterable()` which calls `cls(iterable)` to produce a
> new set. If the `Set` mixin is being used in a class with a different constructor
> signature, you will need to override `_from_iterable()` with a classmethod or regular
> method that can construct new instances from an iterable argument."*

> (2) *"To override the comparisons (presumably for speed, as the semantics are fixed),
> redefine `__le__()` and `__ge__()`, then the other operations will automatically follow
> suit."*

> (3) *"The `Set` mixin provides a `_hash()` method to compute a hash value for the set;
> however, `__hash__()` is not defined because not all sets are hashable or immutable. To
> add set hashability using mixins, inherit from both `Set` and `Hashable`, then define
> `__hash__ = Set._hash`."*

`Lib/_collections_abc.py` @ v3.14.7 — <https://github.com/python/cpython/blob/v3.14.7/Lib/_collections_abc.py>:
- `Set.__le__/__lt__/__gt__/__ge__/__eq__`: `if not isinstance(other, Set): return NotImplemented`.
- 🔴 `Set.__and__` / `__or__`: `if not isinstance(other, Iterable): return NotImplemented` →
  the **ABC mixin operators accept any iterable** (unlike built-in `set` operators);
  `__sub__`/`__rsub__`/`__xor__` convert a non-Set iterable via `_from_iterable`.
- `isdisjoint`: `for value in other: if value in self: return False` (short-circuits).
- `_hash` docstring: *"Note that we don't define __hash__: not all sets are hashable. But if
  you define a hashable set type, its __hash__ should call this function."* … *"We match the
  algorithm used by the built-in frozenset type."*
- `Set.register(frozenset)`; `MutableSet.register(set)` → `isinstance(fs, Set)` and
  `isinstance(s, MutableSet)` are true; `frozenset` is **not** a `set` subclass.
- `MutableSet.remove`: `if value not in self: raise KeyError(value)`; `pop`: `next(iter(self))`
  then `discard` — *"Raise KeyError if empty."*; `clear` docstring *"This is slow (creates N
  new iterators!) but effective."*; `__ior__` loops `self.add(value)`; `__isub__` loops
  `self.discard(value)`.

`typing` — <https://docs.python.org/3.14/library/typing.html#typing.Set>: `typing.Set` —
*"Deprecated alias to `builtins.set`."* · 🔴 *"Note that to annotate arguments, it is
preferred to use an abstract collection type such as `collections.abc.Set` rather than to
use `set` or `typing.Set`."* · `typing.FrozenSet` *"Deprecated alias to
`builtins.frozenset`."* · `typing.AbstractSet` *"Deprecated alias to
`collections.abc.Set`."* (all *"Deprecated since version 3.9"*, PEP 585).

---

## 10 · Dedupe — FAQ and itertools recipes

Programming FAQ — <https://docs.python.org/3.14/faq/programming.html#how-do-you-remove-duplicates-from-a-list>:
*"If you don't mind reordering the list, sort it and then scan from the end of the list,
deleting duplicates as you go"* · 🔴 *"If all elements of the list may be used as set keys
(that is, they are all hashable) this is often faster:"* `mylist = list(set(mylist))` ·
*"This converts the list into a set, thereby removing duplicates, and then back into a
list."*

itertools recipes — <https://docs.python.org/3.14/library/itertools.html#itertools-recipes>:

```python
def unique_everseen(iterable, key=None):
    "Yield unique elements, preserving order. Remember all elements ever seen."
    # unique_everseen('AAAABBBCCDAABBB') → A B C D
    # unique_everseen('ABBcCAD', str.casefold) → A B c D
    seen = set()
    if key is None:
        for element in filterfalse(seen.__contains__, iterable):
            seen.add(element)
            yield element
    else:
        for element in iterable:
            k = key(element)
            if k not in seen:
                seen.add(k)
                yield element

def unique(iterable, key=None, reverse=False):
    "Yield unique elements in sorted order. Supports unhashable inputs."
    # unique([[1, 2], [3, 4], [1, 2]]) → [1, 2] [3, 4]
    sequenced = sorted(iterable, key=key, reverse=reverse)
    return unique_justseen(sequenced, key=key)
```

`unique_justseen`: *"Yield unique elements, preserving order. Remember only the element just
seen."* — `map(itemgetter(0), groupby(iterable))` / `map(next, map(itemgetter(1),
groupby(iterable, key)))`. Recipes preamble: *"The primary purpose of the itertools recipes
is educational."* · *"Substantially all of these recipes and many, many others can be
installed from the more-itertools project found on the Python Package Index"*.

---

## 11 · JSON

<https://docs.python.org/3.14/library/json.html>

Encoder table (`py-to-json-table`): dict→object · list, tuple→array · str→string · int,
float, int- & float-derived Enums→number · True→true · False→false · None→null. **No set.**

`default` param: *"A function that is called for objects that can't otherwise be
serialized. It should return a JSON encodable version of the object or raise a
`TypeError`. If `None` (the default), `TypeError` is raised."*

`JSONEncoder.default(o)`: *"Implement this method in a subclass such that it returns a
serializable object for o, or calls the base implementation (to raise a `TypeError`)."* ·
*"For example, to support arbitrary iterators, you could implement `default()` like this:"*

```python
def default(self, o):
   try:
       iterable = iter(o)
   except TypeError:
       pass
   else:
       return list(iterable)
   # Let the base class default method raise the TypeError
   return super().default(o)
```

🔴 Order note: *"This module's encoders and decoders preserve input and output order by
default. Order is only lost if the underlying containers are unordered."*
`sort_keys`: *"If `True`, dictionaries will be outputted sorted by key."* (dict keys only.)

Error text — `Lib/json/encoder.py` @ v3.14.7 line 182:
`raise TypeError(f'Object of type {o.__class__.__name__} is not JSON serializable')` → for
a set: `Object of type set is not JSON serializable`. 3.14 adds exception **notes** naming
where: Python encoder lines 330/417/457 `when serializing {type} item {i}` /
`when serializing {type} item {key!r}` / `when serializing {type} object`; C encoder
`Modules/_json.c` lines 1567/1648/1829 `_PyErr_FormatNote("when serializing %T object")`,
`"when serializing %T item %R"`, `"when serializing %T item %zd"`.

---

## 12 · 3.14 What's New — the new unhashable message

<https://docs.python.org/3.14/whatsnew/3.14.html> (Improved error messages):
*"Improved error message when trying to add an instance of an unhashable type to a `dict`
or `set`. (Contributed by CF Bolz-Tereick and Victor Stinner in gh-132828.)"* — its
transcript shows, for `s = set(); s.add({'pages': 12, 'grade': 'A'})`:
`TypeError: cannot use 'dict' as a set element (unhashable type: 'dict')`, and for
`d[l] = 12` with a list: `TypeError: cannot use 'list' as a dict key (unhashable type: 'list')`.

Source — `Objects/setobject.c` @ v3.14.7 lines 228–240 `set_unhashable_type()`:
`PyErr_Format(PyExc_TypeError, "cannot use '%T' as a set element (%S)", key, exc);` — only
re-formats when the original exception is exactly `TypeError`. Called from
`_PySet_AddTakeRef` (line 248, comprehension `SET_ADD` path), `set_add_key` (417),
`set_contains_key` (428), `set_discard_key` (439) → `add`, `in`, `remove`, `discard`,
construction from an iterable, set displays. `%T` = *"Get the fully qualified name of an
object type; call `PyType_GetFullyQualifiedName()`"* (<https://docs.python.org/3.14/c-api/unicode.html#c.PyUnicode_FromFormat>),
which is *"Equivalent to `f"{type.__module__}.{type.__qualname__}"`, or `type.__qualname__`
if `type.__module__` is not a string or is equal to `"builtins"`."*
(<https://docs.python.org/3.14/c-api/type.html#c.PyType_GetFullyQualifiedName>). The inner
part is `Objects/object.c` line 1147: `"unhashable type: '%.200s'"` with `tp_name`.
→ a tuple holding a list gives `cannot use 'tuple' as a set element (unhashable type:
'list')` — **the outer type AND the inner one**. Bare `hash(x)` still gives only
`unhashable type: '…'`. `Objects/dictobject.c` line 2363: same wrapper,
`"cannot use '%T' as a dict key (%S)"`, 12 call sites.
⚠️ `set_intersection` with a non-set iterable calls `PyObject_Hash` directly (no wrapper).

---

## 13 · dataclasses, asyncio, weakref, sys, random

dataclasses — <https://docs.python.org/3.14/library/dataclasses.html>:
*"If eq and frozen are both true, by default `@dataclass` will generate a `__hash__()`
method for you. If eq is true and frozen is false, `__hash__()` will be set to `None`,
marking it unhashable (which it is, since it is mutable). If eq is false, `__hash__()` will
be left untouched meaning the `__hash__()` method of the superclass will be used (if the
superclass is `object`, this means it will fall back to id-based hashing)."* · Mutable
defaults: *"the `@dataclass` decorator will raise a `ValueError` if it detects an unhashable
default parameter. The assumption is that if a value is unhashable, it is mutable. This is
a partial solution, but it does protect against many common errors."* · *"Changed in version
3.11: Instead of looking for and disallowing objects of type `list`, `dict`, or `set`,
unhashable objects are now not allowed as default values. Unhashability is used to
approximate mutability."* · fix shown: `x: list = field(default_factory=list)`.

asyncio `create_task` — <https://docs.python.org/3.14/library/asyncio-task.html#asyncio.create_task>:
*"Save a reference to the result of this function, to avoid a task disappearing
mid-execution. The event loop only keeps weak references to tasks. A task that isn't
referenced elsewhere may get garbage collected at any time, even before it's done. For
reliable "fire-and-forget" background tasks, gather them in a collection:"*

```python
background_tasks = set()

for i in range(10):
    task = asyncio.create_task(some_coro(param=i))

    # Add task to the set. This creates a strong reference.
    background_tasks.add(task)

    # To prevent keeping references to finished tasks forever,
    # make each task remove its own reference from the set after
    # completion:
    task.add_done_callback(background_tasks.discard)
```

*"Note that this approach never awaits the tasks, so if a task fails, its exception is never
retrieved and asyncio logs a "Task exception was never retrieved" message when the task is
garbage collected. To avoid this, use `asyncio.TaskGroup` which keeps a strong reference to
each task, awaits them and propagates their exceptions"*

`weakref.WeakSet` — <https://docs.python.org/3.14/library/weakref.html#weakref.WeakSet>:
*"Set class that keeps weak references to its elements. An element will be discarded when
no strong reference to it exists any more."*

`sys.getsizeof` — <https://docs.python.org/3.14/library/sys.html#sys.getsizeof>: *"Return the
size of an object in bytes."* · *"Only the memory consumption directly attributed to the
object is accounted for, not the memory consumption of objects it refers to."* ·
*"`getsizeof()` calls the object's `__sizeof__` method and adds an additional garbage
collector overhead if the object is managed by the garbage collector."*

`random.sample` — <https://docs.python.org/3.14/library/random.html#random.sample>:
*"Changed in version 3.11: The population must be a sequence. Automatic conversion of sets
to lists is no longer supported."*

---

## 14 · CPython v3.14.7 source — mechanisms the docs do not state (implementation detail)

`Include/cpython/setobject.h` — <https://github.com/python/cpython/blob/v3.14.7/Include/cpython/setobject.h>:
- `#define PySet_MINSIZE 8`; `typedef struct { PyObject *key; Py_hash_t hash; /* Cached hash
  code of the key */ } setentry;` → every slot stores the element's hash; it is **never
  recomputed** (resize uses `entry->hash`).
- Three slot kinds: *"Unused: key == NULL and hash == 0"*, *"Dummy: key == dummy and
  hash == -1"*, *"Active"*. `PySetObject` fields: `fill` (*"Number active and dummy
  entries"*), `used` (*"Number active entries"*), `mask`, `table`, `hash` (*"Only used by
  frozenset objects"*), `finger` (*"Search finger for pop()"*), `smalltable[PySet_MINSIZE]`.
- *"Invariants for frozensets: data is immutable. hash is the hash of the frozenset or -1 if
  not computed yet."*

`Objects/setobject.c` — <https://github.com/python/cpython/blob/v3.14.7/Objects/setobject.c>:
- Header comment: *"This is based on Algorithm D from Knuth Vol. 3, Sec. 6.4."* · *"To improve
  cache locality, each probe inspects a series of consecutive nearby entries before moving
  on to probes elsewhere in memory. This leaves us with a hybrid of linear probing and
  randomized probing."* · *"Use cases for sets differ considerably from dictionaries where
  looked-up keys are more likely to be present. In contrast, sets are primarily about
  membership testing where the presence of an element is not known in advance.
  Accordingly, the set implementation needs to optimize for both the found and not-found
  case."* · `LINEAR_PROBES 9`, `PERTURB_SHIFT 5`, next probe `i = (i * 5 + 1 + perturb) & mask`.
- `set_lookkey` / `set_add_entry_takeref`: start slot `i = (size_t)hash & mask`; an entry
  matches if `entry->hash == hash` and (`startkey == key` [identity] or exact-str `unicode_eq`
  or `PyObject_RichCompareBool(startkey, key, Py_EQ)`); if the table or entry changed during
  the compare it restarts (mutable set only).
- 🔴 `found_active: Py_DECREF(key); return 0;` → **adding an equal element keeps the existing
  object and discards the new one.** Clinic docstring for `set.add`: *"Add an element to a
  set. This has no effect if the element is already present."*
- Resize trigger after filling an unused slot: `if ((size_t)so->fill*5 < mask*3) return 0;
  return set_table_resize(so, so->used>50000 ? so->used*2 : so->used*4);` → keeps the table
  under 60% full (fill counts dummies); grows ×4 up to 50,000 active, ×2 beyond.
- `set_discard_entry`: marks slot `dummy`, `hash = -1`, decrements `used` — never shrinks.
  `set_difference_update_internal`: *"If more than 1/4th are dummies, then resize them
  away."* `set_clear_internal` → `set_empty_to_minsize` (back to the inline 8-slot table).
- `set_merge_lock_held` copies `other_entry->hash` (no rehash) and pre-sizes once
  (*"Do one big resize at the start"*); `set_update_dict_lock_held` uses the dict's stored
  hashes; any other iterable → `set_add_key` hashes each element.
- `set_update_internal` / `set_ior` / `set_init` / `make_new_set` call C-level
  `set_add_key`/`set_merge` → **a `set` subclass's Python `add()` override is not called by
  the constructor, `update()`, or `|=`.**
- `make_new_set_basetype`: operations on a subclass instance build a plain `set`/`frozenset`
  (copy, union, intersection, difference, symmetric difference). Result type follows the
  **first operand** (`set_or` → `set_copy(self)`).
- `make_new_frozenset`: *"frozenset(f) is idempotent"* → `Py_NewRef(iterable)` for an exact
  frozenset. `frozenset_copy_impl`: exact frozenset → returns itself.
- `frozenset_hash`: cached in `so->hash` after first computation; algorithm xors
  `_shuffle_bits(entry->hash)` over the table (*"xor is commutative and a frozenset hash
  should be independent of order"*). *"This hash algorithm can be used on either a frozenset
  or a set. When it is used on a set, it computes the hash value of the equivalent frozenset
  without creating a new frozenset object."*
- `set_contains_lock_held` / `set_remove_impl` / `set_discard_impl`: on `TypeError` for a
  `set` key → `frozenset_hash_impl(key)` and retry (the documented temporary-frozenset rule).
- `set_remove_impl`: `_PyErr_SetKeyError(key)` → `KeyError(key)`. `set_pop_impl`:
  `PyErr_SetString(PyExc_KeyError, "pop from an empty set")`; scans from `so->finger`,
  then `so->finger = entry - so->table + 1` (*"next place to start"*).
- 🔴 `setiter_iternext`: `if (si_used != so_used) { PyErr_SetString(PyExc_RuntimeError,
  "Set changed size during iteration"); si->si_used = -1; /* Make this state sticky */` →
  **only a change in size is detected**; a same-size mutation is not.
- `set_or`/`set_and`/`set_sub`/`set_xor`: `if (!PyAnySet_Check(self) ||
  !PyAnySet_Check(other)) Py_RETURN_NOTIMPLEMENTED;` · `set_ior`/`iand`/`isub`/`ixor`:
  `if (!PyAnySet_Check(other)) Py_RETURN_NOTIMPLEMENTED;`.
- `frozenset_as_number` has only `nb_subtract`, `nb_and`, `nb_xor`, `nb_or` — **no in-place
  slots** → `fs |= x` falls back to `fs = fs | x` (rebinds to a new frozenset).
- `set_intersection`: if both are sets, *iterates the smaller one* (swaps when
  `len(other) > len(so)`) and adds **that** operand's key object to the result; result type
  from the original left operand. Non-set iterable: iterates it, hashing each item with
  `PyObject_Hash`, stops early once `len(result) >= len(so)`.
- `set_isdisjoint`: exact set/frozenset → iterate smaller; otherwise iterate `other`,
  return `False` at the first common element (short-circuit).
- `set_difference_untracked`: if `len(so) >> 2 > len(other)` copy-then-discard; exact dict
  `other` uses known hashes; non-set, non-dict → copy-then-`difference_update`.
- `set_issubset_impl`: non-set `other` → builds `set_intersection(so, other)` and compares
  sizes; set `other` → `if len(so) > len(other): False`, then per-element lookup.
- `set_richcompare`: `if(!PyAnySet_Check(w)) Py_RETURN_NOTIMPLEMENTED;` → `{1} == [1]` is
  `False`, `{1} <= [1]` raises `TypeError`. `Py_EQ`: size check, then if both cached
  frozenset hashes exist and differ → `False`, then `set_issubset`.
- `set_repr_lock_held`: empty → `"%s()"` with `tp_name` (`set()`, `frozenset()`); non-exact
  → `"%s({%U})"`.
- `set___sizeof___impl`: `_PyObject_SIZE(Py_TYPE(so))` plus `(mask + 1) * sizeof(setentry)`
  when the table is not the inline small table.
- `set___reduce___impl`: pickles as `(type, (list_of_keys,), state)`.

`Python/flowgraph.c` — <https://github.com/python/cpython/blob/v3.14.7/Python/flowgraph.c>
lines 1584–1666, `optimize_lists_and_sets`: *"Optimize lists and sets for: 1. "for" loop,
comprehension or "in"/"not in" tests: Change literal list or set of constants into constant
tuple or frozenset respectively. Change list of non-constants into tuple."* Skipped when
`seq_size > _PY_STACK_USE_GUIDELINE` (30, `Include/internal/pycore_compile.h`: *"The value
30 is plucked out of thin air."*). → `if m in {"GET", "HEAD"}` uses a constant frozenset;
a display of **names** is rebuilt on every evaluation.

`Objects/unicodeobject.c` `unicode_hash` (line 12003): returns cached `PyUnicode_HASH(self)`
if not `-1`, else computes and `PyUnicode_SET_HASH` → **str hash computed once per object**.

`Objects/dictobject.c` `dictviews_sub` (6197) → `dictviews_to_set(self)` then
`difference_update(other)`; `dictviews_to_set` → `PySet_New(left)` → `REQUIRED -
d.keys()` (frozenset left, reflected) and `d.keys() - ALLOWED` both return a plain `set`.

---

## 15 · Could NOT confirm (write as uncertain, or leave out)

1. **Any byte figure** for a set vs a list — the docs give none; `sys.getsizeof` is the
   documented measuring tool. Pages state structure (inline 8-slot table, key+hash per slot,
   <60% load) from the source, **no byte counts**.
2. **Which object survives in `a & b`** is not documented anywhere; the source iterates the
   smaller operand and keeps its objects. State as a 3.14.7 implementation detail only.
3. **What a same-size mutation during iteration yields** (skip/repeat) — no doc sentence for
   sets (the dict docs have *"may raise a RuntimeError or fail to iterate over all
   entries"*). Pages say: undetected, unspecified.
4. **Whether the C frozenset hash still equals `Set._hash` bit-for-bit** — the ABC docstring
   claims it matches; not verified; pages do not claim equality of the numbers.
5. **Exact wording of the 3.14 wrapper for a user-defined class** beyond the documented
   `%T` rule — the outer name is module-qualified (`app.models.Order`); the inner name uses
   `tp_name`. Pages quote only the documented `dict`/`list` transcripts verbatim and
   describe the user-class shape without a verbatim string.
6. **Which types besides str/bytes are salted** — `PYTHONHASHSEED` says *"the types covered
   by the hash randomization"* without listing; `-R` names str and bytes. Pages say "str and
   bytes, and anything whose hash is derived from them (a tuple or frozenset of strings)".
7. **Timings of any kind** — none; complexity only, from the 3.14 table.

---

## 16 · Appended 2026-09-10 (same session, before chunk 01) — error strings a page quotes

All from the **v3.14.7** tag:

- `Objects/abstract.c` `binop_type_error` (line 991): `"unsupported operand type(s) for
  %.100s: '%.100s' and '%.100s'"` → `{1} | [2]` gives `unsupported operand type(s) for |:
  'set' and 'list'`; in-place ops use the same format with op name `|=` etc.
- `Objects/abstract.c` line 203: `"'%.200s' object is not subscriptable"` → `s[0]`;
  line 2815: `"'%.200s' object is not iterable"` → `set(5)`.
- `Objects/object.c` line 1084: `"'%s' not supported between instances of '%.100s' and
  '%.100s'"` → `{1} <= [1]` gives `'<=' not supported between instances of 'set' and 'list'`.
- `Python/getargs.c` line 2722: `"%.200s expected %s%zd argument%s, got %zd"` with
  `"at most "` → `set("a", "b")` gives `set expected at most 1 argument, got 2`.
- `Lib/dataclasses.py` line 917: `ValueError(f'mutable default {type(f.default)} for field
  {f.name} is not allowed: use default_factory')`, raised when
  `f.default.__class__.__hash__ is None` → `tags: set[str] = set()` gives `mutable default
  <class 'set'> for field tags is not allowed: use default_factory`; a `frozenset()` default
  passes (hashable).
- `Lib/uuid.py` line 291: `UUID.__eq__` returns `NotImplemented` unless `other` is a `UUID`
  → `uuid.UUID(s) == s` is `False`; a set of UUIDs and a set of their strings share nothing.
- `Lib/random.py` line 419: `random.sample` raises `TypeError("Population must be a
  sequence.  For dicts or sets, use sorted(d).")` when the population is not a
  `collections.abc.Sequence`; `choice` (line 347) indexes `seq[...]` after a `len()` check,
  so a set reaches the `'set' object is not subscriptable` error.
- `Objects/dictobject.c` line 6706: `dictvalues_as_sequence` has `0 /* sq_contains */` → `x in
  d.values()` falls back to iteration (a scan, O(n)); `dictkeys_as_sequence` (line 6168) has
  `dictkeys_contains` → `x in d.keys()` is a hash lookup. Docs: *"Values views are not treated as
  set-like since the entries are generally not unique."*
