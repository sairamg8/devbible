---
name: research-python-p03-t05-slicing
description: Banked primary sources for Python phase 3 topic 05 (slicing deeply) — verbatim quotes and URLs, CPython 3.14 source mechanisms labelled as implementation detail, and a could-not-confirm list. Do not re-derive.
metadata:
  type: project
---

# research — python phase 3, topic 05 · Slicing deeply

**Banked 2026-09-10. DO NOT RE-DERIVE.** Every doc quote below was read from the CPython
**3.14 branch** reST sources on GitHub (`https://raw.githubusercontent.com/python/cpython/3.14/Doc/…`),
which are the exact text rendered at `docs.python.org/3.14/…`. Cite the docs.python.org URL on
the page; the raw source is how it was read. CPython C/Python source was read from the same
branch (`https://raw.githubusercontent.com/python/cpython/3.14/<path>`) and is cited as
`github.com/python/cpython/blob/3.14/<path>`.

Version spine: **CPython 3.14** (target **3.14.7**). No sandbox — no program output was produced.
Doc doctest output quoted below is **the documentation's own example**, quotable as such. Error
strings are the literal C string literals in 3.14 source, file + function named beside each.

Off-site, one fetch each: PostgreSQL **18** docs (`queries-limit.html`), NumPy **v2.5** manual
(`basics.copies.html`), the typing spec (`typing.python.org/en/latest/spec/overload.html`,
read from `github.com/python/typing/main/docs/spec/overload.rst`).

---

## 1 · The three numbers — the sequence table and its notes

**`library/stdtypes.rst` §Common Sequence Operations** —
<https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations>

Table rows: `s[i]` → *"ith item of s, origin 0"* notes (3)(8) · `s[i:j]` → *"slice of s from i to j"*
notes (3)(4) · `s[i:j:k]` → *"slice of s from i to j with step k"* notes (3)(5).

> *"(3) If *i* or *j* is negative, the index is relative to the end of sequence *s*:
> `len(s) + i` or `len(s) + j` is substituted.  But note that `-0` is still `0`."*

> *"(4) The slice of *s* from *i* to *j* is defined as the sequence of items with index *k* such
> that `i <= k < j`.
> * If *i* is omitted or `None`, use `0`.
> * If *j* is omitted or `None`, use `len(s)`.
> * If *i* or *j* is less than `-len(s)`, use `0`.
> * If *i* or *j* is greater than `len(s)`, use `len(s)`.
> * If *i* is greater than or equal to *j*, the slice is empty."*

> *"(5) The slice of *s* from *i* to *j* with step *k* is defined as the sequence of items with
> index  `x = i + n*k` such that `0 <= n < (j-i)/k`.  In other words, the indices are `i`,
> `i+k`, `i+2*k`, `i+3*k` and so on, stopping when *j* is reached (but never including *j*).
> When *k* is positive, *i* and *j* are reduced to `len(s)` if they are greater.
> When *k* is negative, *i* and *j* are reduced to `len(s) - 1` if they are greater.  If *i* or
> *j* are omitted or `None`, they become "end" values (which end depends on the sign of *k*).
> Note, *k* cannot be zero. If *k* is `None`, it is treated like `1`."*

> *"(8) An `IndexError` is raised if *i* is outside the sequence range."*

Table preamble: *"The operations in the following table are supported by most sequence types,
both mutable and immutable. The `collections.abc.Sequence` ABC is provided to make it easier to
correctly implement these operations on custom sequence types."* · *"See Time complexity of
operations on built-in types for the costs of the various sequence operations."*

**`reference/datamodel.rst` §Sequences** —
<https://docs.python.org/3.14/reference/datamodel.html#datamodel-sequences>

> *"Some sequences, including built-in sequences, interpret negative subscripts by adding the
> sequence length. For example, `a[-2]` equals `a[n-2]`, the second to last item of sequence a
> with length `n`."*

> *"The resulting value must be a nonnegative integer less than the number of items in the
> sequence. If it is not, an `IndexError` is raised."*

> *"Sequences also support slicing: `a[start:stop]` selects all items with index *k* such that
> *start* `<=` *k* `<` *stop*.  When used as an expression, a slice is a sequence of the same
> type. The comment above about negative subscripts also applies to negative slice positions.
> Note that no error is raised if a slice position is less than zero or larger than the length
> of the sequence."*

> *"If *start* is missing or `None`, slicing behaves as if *start* was zero. If *stop* is missing
> or `None`, slicing behaves as if *stop* was equal to the length of the sequence."*

> *"Some sequences also support "extended slicing" with a third "step" parameter: `a[i:j:k]`
> selects all items of *a* with index *x* where `x = i + n*k`, *n* `>=` `0` and *i* `<=` *x*
> `<` *j*."*

**`tutorial/introduction.rst`** — <https://docs.python.org/3.14/tutorial/introduction.html#text>

> *"Note that since -0 is the same as 0, negative indices start from -1."*

> *"Note how the start is always included, and the end always excluded.  This makes sure that
> `s[:i] + s[i:]` is always equal to `s`"*

> *"One way to remember how slices work is to think of the indices as pointing *between*
> characters, with the left edge of the first character numbered 0. Then the right edge of the
> last character of a string of *n* characters has index *n*"* — followed by the
> `+---+---+` diagram with `0 1 2 3 4 5 6` and `-6 -5 -4 -3 -2 -1` under `Python`.

> *"For non-negative indices, the length of a slice is the difference of the indices, if both are
> within bounds.  For example, the length of `word[1:3]` is 2."*

> *"Attempting to use an index that is too large will result in an error"* — doc example
> `word[42]` → `IndexError: string index out of range`.
> *"However, out of range slice indexes are handled gracefully when used for slicing"* — doc
> examples `word[4:42]` → `'on'`, `word[42:]` → `''`.

Lists, same tutorial (<https://docs.python.org/3.14/tutorial/introduction.html#lists>):

> *"All slice operations return a new list containing the requested elements.  This means that
> the following slice returns a shallow copy of the list"* (doc: `correct_rgba = rgba[:]`)

> *"Assignment to slices is also possible, and this can even change the size of the list or
> clear it entirely"* — doc examples `letters[2:5] = ['C', 'D', 'E']`, `letters[2:5] = []`,
> `letters[:] = []`.

> *"Simple assignment in Python never copies data."*

`tutorial/datastructures.rst` §The del statement — <https://docs.python.org/3.14/tutorial/datastructures.html#the-del-statement>:
> *"The `del` statement can also be used to remove slices from a list or clear the entire list
> (which we did earlier by assignment of an empty list to the slice)."* — doc `del a[2:4]`, `del a[:]`.

**`reference/expressions.rst` §Slicings** (rewritten in 3.14 docs) —
<https://docs.python.org/3.14/reference/expressions.html#slicings>

> *"A more advanced form of subscription, *slicing*, is commonly used to extract a portion of a
> sequence. In this form, the subscript is a slice: up to three expressions separated by colons.
> Any of the expressions may be omitted, but a slice must contain at least one colon"*

> *"When a slice is evaluated, the interpreter constructs a `slice` object whose `start`, `stop`
> and `step` attributes, respectively, are the results of the expressions between the colons.
> Any missing expression evaluates to `None`. This `slice` object is then passed to the
> `__getitem__` or `__class_getitem__` special method, as above."* — doc examples
> `demo[2:3]` → `subscripted with: slice(2, 3, None)`; `demo[::'spam']` →
> `subscripted with: slice(None, None, 'spam')`.

§Comma-separated subscripts: *"This form is commonly used with numerical libraries for slicing
multi-dimensional data. In this case, the interpreter constructs a `tuple` of the results of
the expressions or slices, and passes this tuple to the `__getitem__` or `__class_getitem__`
special method"* — doc `demo[1:2, 3]` → `subscripted with: (slice(1, 2, None), 3)`.

§Subscriptions: *"Subscriptions may also be used as targets in assignment or deletion
statements. In these cases, the interpreter will call the subscripted object's `__setitem__` or
`__delitem__` special method, respectively, instead of `__getitem__`."* · *"All advanced forms
of *subscript* documented in the following sections are also usable for assignment and deletion."*

Grammar: `proper_slice: [expression] ":" [expression] [ ":" [expression] ]`.

---

## 2 · The algorithm — CPython 3.14 `Objects/sliceobject.c` (implementation, not spec)

<https://github.com/python/cpython/blob/3.14/Objects/sliceobject.c>

`PySlice_Unpack` (comment: *"this is harder to get right than you might think"*):
- `step is None` → 1; else `_PyEval_SliceIndex`; zero → `ValueError` **`slice step cannot be zero`**.
- `start is None` → `step < 0 ? PY_SSIZE_T_MAX : 0`.
- `stop is None` → `step < 0 ? PY_SSIZE_T_MIN : PY_SSIZE_T_MAX`.

`PySlice_AdjustIndices(length, &start, &stop, step)`:
```c
    if (*start < 0) {
        *start += length;
        if (*start < 0) {
            *start = (step < 0) ? -1 : 0;
        }
    }
    else if (*start >= length) {
        *start = (step < 0) ? length - 1 : length;
    }
    /* same for stop */
    if (step < 0) {
        if (*stop < *start) {
            return (*start - *stop - 1) / (-step) + 1;
        }
    }
    else {
        if (*start < *stop) {
            return (*stop - *start - 1) / step + 1;
        }
    }
    return 0;
```
🔴 Consequence: an omitted stop with a negative step becomes the internal value **-1 meaning
"before index 0"** — a position no literal can express, because a literal `-1` is re-based to
`len-1`. Hence `s[3::-1]` reaches index 0 but `s[3:-1:-1]` is empty.

`Python/ceval.c`, `_PyEval_SliceIndex` — <https://github.com/python/cpython/blob/3.14/Python/ceval.c>:
> *"Extract a slice index from a PyLong or an object with the nb_index slot defined, and store in
> *pi. Silently reduce values larger than PY_SSIZE_T_MAX to PY_SSIZE_T_MAX, and silently boost
> values less than PY_SSIZE_T_MIN to PY_SSIZE_T_MIN."*
Error: `TypeError` **`slice indices must be integers or None or have an __index__ method`**.

`Objects/abstract.c` `PyNumber_AsSsize_t` (index path, not slice path): **`cannot fit '%.200s'
into an index-sized integer`** — raised as `IndexError` by `list_subscript` for a huge *index*.

`Python/bytecodes.c` (3.14) `_BINARY_SLICE`: builds `slice` via `_PyBuildSlice_ConsumeRefs(start,
stop)` then `PyObject_GetItem(container, slice)` — the 3.12 opcode still goes through
`__getitem__` with a slice object. `library/dis.rst`: *"BINARY_SLICE … `STACK.append(container[start:end])`
… Added in version 3.12."* What's New 3.12: *"Add the BINARY_SLICE and STORE_SLICE instructions."*

---

## 3 · `slice` objects

**`library/functions.rst` §slice** — <https://docs.python.org/3.14/library/functions.html#slice>

> *"class slice(stop, /) · class slice(start, stop, step=None, /) — Return a slice object
> representing the set of indices specified by `range(start, stop, step)`.  The *start* and
> *step* arguments default to `None`."*
> *"Slice objects are also generated when slicing syntax is used.  For example:
> `a[start:stop:step]` or `a[start:stop, i]`."*
> *"See `itertools.islice()` for an alternate version that returns an iterator."*
> *"slice.start / slice.stop / slice.step — These read-only attributes are set to the argument
> values (or their default).  They have no other explicit functionality; however, they are used
> by NumPy and other third-party packages."*
> *"Changed in version 3.12: Slice objects are now hashable (provided `start`, `stop`, and
> `step` are hashable)."*

**`reference/datamodel.rst` §Slice objects** — <https://docs.python.org/3.14/reference/datamodel.html#slice-objects>

> *"Slice objects are used to represent slices for `__getitem__` methods.  They are also created
> by the built-in `slice` function."*
> *"Special read-only attributes: `start` is the lower bound; `stop` is the upper bound; `step`
> is the step value; each is `None` if omitted.  These attributes can have any type."*
> *"slice.indices(self, length) — This method takes a single integer argument *length* and
> computes information about the slice that the slice object would describe if applied to a
> sequence of *length* items.  It returns a tuple of three integers; respectively these are the
> *start* and *stop* indices and the *step* or stride length of the slice. Missing or
> out-of-bounds indices are handled in a manner consistent with regular slices."*

Source `_PySlice_GetLongIndices` (used by `slice.indices` **and range slicing**): for a negative
step `lower = -1`, `upper = length - 1`; omitted start → `upper`, omitted stop → `lower`. So
`slice(None, None, -1).indices(n)` yields stop **-1** — correct as `range()` arguments, **wrong
if fed back into a slice** (re-based to `n-1`). `slice.indices` rejects a negative length:
`ValueError` **`length should not be negative`**; zero step: **`slice step cannot be zero`**.
Docstring: *"Assuming a sequence of length len, calculate the start and stop indices, and the
stride length of the extended slice described by S. Out of bounds indices are clipped in a
manner consistent with the handling of normal slices."*

`slice_hash` hashes `(start, stop, step)` with the xxHash-style lanes tuple uses — raises if any
component is unhashable.

What's New 3.12 — <https://docs.python.org/3.14/whatsnew/3.12.html>:
> *"slice objects are now hashable, allowing them to be used as dict keys and set items."*
(gh-101264). ⇒ Since 3.12 `some_dict[1:3]` hashes the slice and fails with `KeyError`
(mechanism; the `TypeError: unhashable type` of ≤3.11 no longer applies). Not a doc sentence —
derived from dict lookup semantics + hashability.

**Glossary** — <https://docs.python.org/3.14/glossary.html#term-slice>:
> *"slice — An object of type `slice`, used to describe a portion of a sequence. A slice object
> is created when using the slicing form of subscript notation, with colons inside square
> brackets, such as in `variable_name[1:3:5]`."*
> *"index — … In some contexts, Python allows negative indexes for counting from the end of a
> sequence, and indexing using slices."*
> *"sequence — An iterable which supports efficient element access using integer indices via the
> `__getitem__` special method and defines a `__len__` method that returns the length of the
> sequence."*

**`library/operator.rst`** — <https://docs.python.org/3.14/library/operator.html#operator.itemgetter>:
> *"The items can be any type accepted by the operand's `__getitem__` method.  Dictionaries
> accept any hashable value.  Lists, tuples, and strings accept an index or a slice"* — doc
> example `itemgetter(slice(2, None))('ABCDEFG')` → `'CDEFG'`; `itemgetter(1, 3, 5)('ABCDEFG')`
> → `('B', 'D', 'F')`.
Mapping table: *"Slice Assignment · `seq[i:j] = values` · `setitem(seq, slice(i, j), values)`"*,
*"Slice Deletion · `del seq[i:j]` · `delitem(seq, slice(i, j))`"*, *"Slicing · `seq[i:j]` ·
`getitem(seq, slice(i, j))`"*. `operator.index(a)`: *"Return *a* converted to an integer.
Equivalent to `a.__index__()`."* (3.10: result always exact `int`).

---

## 4 · Implementing slicing — `__getitem__`, `__index__`, the ABCs

**`reference/datamodel.rst` §Emulating container types** — <https://docs.python.org/3.14/reference/datamodel.html#emulating-container-types>

> *"for a sequence, the allowable keys should be the integers *k* for which `0 <= k < N` where
> *N* is the length of the sequence, or `slice` objects, which define a range of items."*

`object.__getitem__(self, subscript)`:
> *"sequences, where *subscript* (also called index) should be an integer or a `slice` object.
> See the sequence documentation for the expected behavior, including handling `slice` objects
> and negative indices."*
> *"If *subscript* is of an inappropriate type, `__getitem__` should raise `TypeError`. If
> *subscript* has an inappropriate value, `__getitem__` should raise an `LookupError` or one of
> its subclasses (`IndexError` for sequences; `KeyError` for mappings)."*
> Note: *"Slicing is handled by `__getitem__`, `__setitem__`, and `__delitem__`. A call like
> `a[1:2] = b` is translated to `a[slice(1, 2, None)] = b` and so forth. Missing slice items are
> always filled in with `None`."*
> Note: *"The sequence iteration protocol (used, for example, in `for` loops), expects that an
> `IndexError` will be raised for illegal indexes to allow proper detection of the end of a
> sequence."*
`__setitem__`/`__delitem__`: *"Same note as for `__getitem__`."* · *"The same exceptions should
be raised for improper *key* values as for the `__getitem__` method."*

`object.__index__(self)`:
> *"Called to implement `operator.index`, and whenever Python needs to losslessly convert the
> numeric object to an integer object (such as in slicing, or in the built-in `bin`, `hex` and
> `oct` functions). Presence of this method indicates that the numeric object is an integer
> type.  Must return an integer."*

What's New 3.0 — <https://docs.python.org/3.14/whatsnew/3.0.html>:
> *"`__getslice__`, `__setslice__` and `__delslice__` were killed.  The syntax `a[i:j]` now
> translates to `a.__getitem__(slice(i, j))` (or `__setitem__` or `__delitem__`, when used as an
> assignment or deletion target, respectively)."*

**`collections.abc.Sequence`** — <https://docs.python.org/3.14/library/collections.abc.html#collections.abc.Sequence>:
abstract `__getitem__`, `__len__`; mixins `__contains__`, `__iter__`, `__reversed__`, `index`,
`count` — **no slicing mixin**. Doc: *"Implementation note: Some of the mixin methods, such as
`__iter__`, `__reversed__`, and `index` make repeated calls to the underlying `__getitem__`
method. Consequently, if `__getitem__` is implemented with constant access speed, the mixin
methods will have linear performance; however, if the underlying method is linear (as it would
be with a linked list), the mixins will have quadratic performance and will likely need to be
overridden."* `index`: *"Supporting the *start* and *stop* arguments is optional, but recommended."*
Source `Lib/_collections_abc.py` `Sequence.__iter__`: loops `v = self[i]` until `IndexError`.

**`collections.UserList`** — <https://docs.python.org/3.14/library/collections.html#collections.UserList>:
> *"Subclassing requirements: Subclasses of `UserList` are expected to offer a constructor which
> can be called with either no arguments or one argument.  List operations which return a new
> sequence attempt to create an instance of the actual implementation class.  To do so, it
> assumes that the constructor can be called with a single parameter, which is a sequence object
> used as a data source."*
Source `Lib/collections/__init__.py` `UserList.__getitem__`:
```python
    def __getitem__(self, i):
        if isinstance(i, slice):
            return self.__class__(self.data[i])
        else:
            return self.data[i]
```

**Typing spec, Overloads** — <https://typing.python.org/en/latest/spec/overload.html>:
> *"The `@overload` decorator allows describing functions and methods that support multiple
> different combinations of argument types. This pattern is used frequently in builtin modules
> and types. For example, the `__getitem__()` method of the `bytes` type can be described as
> follows"* — `@overload def __getitem__(self, i: int) -> int: ...` / `@overload def
> __getitem__(self, s: slice) -> bytes: ...` — *"This description is more precise than would be
> possible using unions, which cannot express the relationship between the argument and return
> types"*.

**Ellipsis** — `library/stdtypes.rst` §The Ellipsis Object: *"In typical use, `...` as the
`Ellipsis` object appears in a few different places, for instance: … In third-party libraries,
such as Numpy's slicing and striding."* What's New 3.0: *"The ellipsis (`...`) can be used as an
atomic expression anywhere.  (Previously it was only allowed in slices.)"*

---

## 5 · Slices copy — which types, and the identity shortcuts

- datamodel: *"When used as an expression, a slice is a sequence of the same type."*
- tutorial: *"All slice operations return a new list containing the requested elements."*
- **`library/copy.rst`** — <https://docs.python.org/3.14/library/copy.html>:
  > *"Shallow copies of many collections can be made using the corresponding `copy()` method (such
  > as `list.copy()`, `dict.copy()` or `set.copy()`), and of sequences (such as lists or
  > bytearrays) by making a slice of the entire sequence (`sequence[:]`). However, these methods
  > and slicing can create an instance of the base type when copying an instance of a subclass,
  > whereas `copy.copy()` normally returns an instance of the same type."*
  > *"A *shallow copy* constructs a new compound object and then (to the extent possible) inserts
  > *references* into it to the objects found in the original."*
- `list(iterable)`: *"If *iterable* is already a list, a copy is made and returned, similar to
  `iterable[:]`."* · `sequence.copy()`: *"Create a shallow copy of *sequence*. This is equivalent
  to writing `sequence[:]`."*
- `tuple(iterable)`: *"If *iterable* is already a tuple, it is returned unchanged."*
- time-complexity page: *"`str` and `bytes` objects are immutable sequences of characters and
  bytes, respectively. As with tuples, copying one returns the original object."* (does **not**
  name `[:]` as the copy operation.)

CPython 3.14 source — **implementation detail, not documented for slicing:**
- `Objects/tupleobject.c` `tuple_subscript`: `slicelength <= 0` → `tuple_get_empty()` (the shared
  empty tuple); `start == 0 && step == 1 && slicelength == size && PyTuple_CheckExact(self)` →
  `Py_NewRef(self)` — **`t[:]` is `t` for an exact tuple**; a subclass (named tuple) gets a new
  plain `tuple`.
- `Objects/unicodeobject.c` `unicode_subscript`: full slice → `unicode_result_unchanged(self)`
  (exact `str` → same object; *"Subtype -- return genuine unicode string with the same value."*);
  empty → `_Py_RETURN_UNICODE_EMPTY()`; step 1 → `PyUnicode_Substring` which **copies** the code
  points into a new object (`_PyUnicode_FromASCII` / `PyUnicode_FromKindAndData`) — no substring
  sharing, so a small slice never keeps a huge parent alive.
- `Objects/bytesobject.c` `bytes_subscript`: full slice of exact `bytes` → `Py_NewRef(self)`;
  otherwise `PyBytes_FromStringAndSize` (copy).
- `Objects/listobject.c` `list_slice_lock_held`: always `list_new_prealloc(len)` + `Py_NewRef` per
  element — **a list slice is always a new list**, even `[:]`.
- `bytearray` slice → new bytearray (mutable, must copy).

---

## 6 · Slices that do NOT copy — `memoryview`, `range`; NumPy as contrast

**`library/stdtypes.rst` §Memory Views** — <https://docs.python.org/3.14/library/stdtypes.html#memoryview>

> *"`memoryview` objects allow Python code to access the internal data of an object that
> supports the buffer protocol without copying."*
> *"A `memoryview` supports slicing and indexing to expose its data. One-dimensional slicing will
> result in a subview"* — doc: `v = memoryview(b'abcefg')`, `v[1:4]` → `<memory at 0x…>`,
> `bytes(v[1:4])` → `b'bce'`.
> *"If the underlying object is writable, the memoryview supports one-dimensional slice
> assignment. Resizing is not allowed"* — doc: `v[2:3] = b'spam'` → **`ValueError: memoryview
> assignment: lvalue and rvalue have different structures`**; `v[2:6] = b'spam'` works.
> `release()`: *"Many objects take special actions when a view is held on them (for example, a
> `bytearray` would temporarily forbid resizing); therefore, calling release() is handy to remove
> these restrictions (and free any dangling resources) as soon as possible."* · after release:
> *"`ValueError: operation forbidden on released memoryview object`"* (doc). Context manager form
> documented.
What's New 3.14: *"The `memoryview` type now supports subscription, making it a generic type."*

time-complexity page, memoryview: *"In particular, slicing a memory view returns a new view onto
the same buffer."* — Get slice `v[i:j]` **O(1)**; Convert to bytes `v.tobytes()`, `bytes(v)` O(n).
Source `Objects/memoryobject.c` `memory_subscript`: `mbuf_add_view(self->mbuf, view)` then
`init_slice`; tuple-of-slices → `NotImplementedError` **`multi-dimensional slicing is not
implemented`**; bad key → `TypeError` **`memoryview: invalid slice key`**.
Source `Objects/bytearrayobject.c` `_canresize`: `BufferError` **`Existing exports of data:
object cannot be re-sized`**.

**`range`** — <https://docs.python.org/3.14/library/stdtypes.html#ranges>:
> *"a `range` object will always take the same (small) amount of memory, no matter the size of
> the range it represents (as it only stores the `start`, `stop` and `step` values, calculating
> individual items and subranges as needed)."*
> *"Range objects implement the `collections.abc.Sequence` ABC, and provide features such as
> containment tests, element index lookup, slicing and support for negative indices"* — doc:
> `r = range(0, 20, 2)`; `r[:5]` → `range(0, 10, 2)`; `r[-1]` → `18`.
> *"Changed in version 3.2: … Support slicing and negative indices."*
time-complexity range: Get slice `r[i:j]` **O(1)**. Source `Objects/rangeobject.c` `compute_slice`
uses `_PySlice_GetLongIndices` and builds a new range.

**NumPy v2.5** — <https://numpy.org/doc/stable/user/basics.copies.html> (named contrast only;
no NumPy page in this corpus):
> *"Views are created when elements can be addressed with offsets and strides in the original
> array. Hence, basic indexing always creates views."*
> *"Advanced indexing, on the other hand, always creates copies."*

---

## 7 · Costs — `library/time-complexity.rst` (exists in 3.14), verbatim

<https://docs.python.org/3.14/library/time-complexity.html>

Preamble: *"This page documents the time complexity of various operations on built-in types in
CPython. Other Python implementations may have different performance characteristics.
Additionally, the listed costs assume exact built-in types, as instances of subclasses may have
different costs."* · *"Unless stated otherwise, *n* denotes the number of elements currently in
the container, and *k* is the value of a numeric parameter, such as an index or a repeat count."*

list rows: Copy `l.copy()` O(n) · **Get slice `l[i:j]` O(j - i)** · **Set slice `l[i:j] = t` [1]
O(j - i) if len(t) == j - i, otherwise O(n - i + len(t))** · **Delete slice `del l[i:j]` O(n - i)**
· Pop `l.pop(k)` O(n - k) · Insert O(n - k) · Delete item O(n - k) · Extend O(len(t)) · `x in l` O(n).
tuple: Copy `tuple(t)` O(1) · Get slice `t[i:j]` O(j - i).
str/bytes/bytearray: Get slice `s[i:j]` O(j - i) · Substring search O(n) [11] · Reverse substring
search O(n × len(x)).
🔴 bytearray: *"A `bytearray` is mutable, and additionally supports the mutating operations of
`list` (except `sort`), at the same costs. However, deleting at the front with `del` (`del b[0]`,
`del b[:k]`) only advances the start of the buffer instead of moving the remaining bytes, and is
amortized O(1)."* — Source `bytearray_setslice_linear`: `if (lo == 0) { /* Shrink the buffer by
advancing its logical start */ self->ob_start -= growth; ...` (checks `_canresize` first).
memoryview: Get slice O(1). range: Get slice O(1).

Notes: *"[1] Amortized. An individual operation may occasionally be O(n) when the underlying
storage is resized, but this cost is spread over many operations, depending on the history of the
container."* · *"[11] With *start* and *end* arguments, *n* is the length of the region searched
rather than of *s*, and unlike slicing nothing is copied."* · *"[10] Each concatenation builds a
new object, so building a string by concatenating many pieces in a loop is quadratic in the total
length."*

🔴 **Dispatch discrepancy:** the dispatch expected rows worded *"get slice O(k), set slice O(k+n),
del slice O(n)"* — that is the old wiki.python.org TimeComplexity wording. The 3.14 docs page
uses the O(j − i) / O(n − i + len(t)) / O(n − i) wording above. Pages quote the 3.14 page.

Search without copying:
> `sequence.index`: *"The *start* or *stop* arguments allow for efficient searching of
> subsections of the sequence, beginning at *start* and ending at *stop*. This is roughly
> equivalent to `start + sequence[start:stop].index(value)`, only without copying any data."*
> *"Caution: Not all sequence types support passing the *start* and *stop* arguments."*
> `str.find`: *"Return the lowest index in the string where substring *sub* is found within the
> slice `s[start:end]`.  Optional arguments *start* and *end* are interpreted as in slice
> notation.  Return `-1` if *sub* is not found."* (`count`, `rfind`, bytes variants: same phrase.)
> `str.endswith`: *"Using *start* and *end* is equivalent to `str[start:end].endswith(suffix)`."*
> `str.startswith`: *"With optional *start*, test string beginning at that position.  With
> optional *end*, stop comparing string at that position."*

Quadratic concatenation (note 6, common ops): *"Concatenating immutable sequences always results
in a new object.  This means that building up a sequence by repeated concatenation will have a
quadratic runtime cost in the total sequence length."* (`bytes`: *"…or you can do in-place
concatenation with a `bytearray` object. `bytearray` objects are mutable and have an efficient
overallocation mechanism"*.)

---

## 8 · Slice assignment and `del` — the mutable-sequence table

**`library/stdtypes.rst` §Mutable Sequence Types** — <https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types>

> *"In the table *s* is an instance of a mutable sequence type, *t* is any iterable object and
> *x* is an arbitrary object that meets any type and value restrictions imposed by *s* (for
> example, `bytearray` only accepts integers that meet the value restriction `0 <= x <= 255`)."*

Rows: `s[i:j] = t` → *"slice of *s* from *i* to *j* is replaced by the contents of the iterable
*t*"* · `del s[i:j]` → *"removes the elements of `s[i:j]` from the list (same as `s[i:j] = []`)"* ·
`s[i:j:k] = t` → *"the elements of `s[i:j:k]` are replaced by those of *t*"* (1) · `del s[i:j:k]` →
*"removes the elements of `s[i:j:k]` from the list"* · `s += t` → *"(for the most part the same as
`s[len(s):len(s)] = t`)"*.

> *"(1) If *k* is not equal to `1`, *t* must have the same length as the slice it is replacing."*

Method equivalences: `append` = *"`seq[len(seq):len(seq)] = [value]`"* · `clear` = *"`del
sequence[:]`"* · `copy` = *"`sequence[:]`"* · `extend` = *"For the most part, this is the same as
writing `seq[len(seq):len(seq)] = iterable`"* · `insert` = *"`sequence[index:index] = [value]`"*.

CPython 3.14 `Objects/listobject.c` — **mechanisms**:
- `list_ass_slice_lock_held`: `v_as_SF = PySequence_Fast(v, "can only assign an iterable")` runs
  **before** any element moves ⇒ the right-hand iterable is fully materialised first, so
  `a[:] = (x for x in a if keep(x))` reads the unmodified list. Non-iterable RHS → `TypeError`
  **`can only assign an iterable`**. Uses `memmove` for grow and shrink; `recycle` array defers
  DECREFs.
- `list_ass_slice`: `if (a == (PyListObject *)v)` → copies first (*"a[i:j] = a"* special case).
- `adjust_slice_indexes` comment: *"Make sure s[5:2] = [..] inserts at the right place: before 5,
  not before 2."*
- `list_ass_subscript_lock_held`: `step == 1` checked **at runtime on the unpacked value** →
  ordinary (resizable) slice assignment, so `a[0:3:1] = [x]` may shrink the list.
  Extended size mismatch → `ValueError` **`attempt to assign sequence of size %zd to extended
  slice of size %zd`**. Non-iterable → `TypeError` **`must assign iterable to extended slice`**.
  *"protect against a[::-1] = a"* → copies first. Extended delete compacts in one pass with
  `memmove` per gap, then `list_resize`.
- Errors: **`list index out of range`** (IndexError), **`list assignment index out of range`**,
  **`list indices must be integers or slices, not %.200s`** (TypeError).
- `list_slice_wrap` / `list_ass_subscript` wrap in `Py_BEGIN_CRITICAL_SECTION` (per-object lock in
  free-threaded builds).

`Objects/bytearrayobject.c`: RHS `str` or number → `TypeError` **`can assign only bytes, buffers,
or iterables of ints in range(0, 256)`**; extended mismatch → `ValueError` **`attempt to assign
bytes of size %zd to extended slice of size %zd`**; **`bytearray indices must be integers or
slices, not %.200s`**.

**`library/array.rst`** — <https://docs.python.org/3.14/library/array.html>: *"When using slice
assignment, the assigned value must be an array object with the same type code; in all other
cases, `TypeError` is raised."*

str immutability, tutorial: doc example `word[0] = 'J'` → `TypeError: 'str' object does not
support item assignment` (and `word[2:] = 'py'` raises too). `abstract.c`: **`'%.200s' object does
not support item assignment`**, **`... item deletion`**.

---

## 9 · Things you cannot slice — and their errors

- `Objects/abstract.c` `PyObject_GetItem`: no `mp_subscript`, no `sq_item` → `TypeError`
  **`'%.200s' object is not subscriptable`** (generators, `map`, `filter`, `zip`, `enumerate`,
  `reversed`, `dict_keys`, sets). Has `sq_item` only (e.g. `deque`) + non-index key →
  `TypeError` **`sequence index must be integer, not '%.200s'`**.
- `Modules/_collectionsmodule.c` deque type slots: `{Py_sq_item, deque_item}`, `{Py_sq_ass_item,
  deque_ass_item}` — **no `mp_subscript`**. Error **`deque index out of range`**.
- `str` non-int key: **`string indices must be integers, not '%.200s'`**; **`string index out of
  range`**. `tuple`: **`tuple index out of range`**, **`tuple indices must be integers or slices,
  not %.200s`**. `bytes`: **`index out of range`**, **`byte indices must be integers or slices,
  not %.200s`**. `range`: **`range object index out of range`**, **`range indices must be integers
  or slices, not %.200s`**.
- sets, `stdtypes` §Set Types: *"Being an unordered collection, sets do not record element
  position or order of insertion.  Accordingly, sets do not support indexing, slicing, or other
  sequence-like behavior."*
- `collections.deque` — <https://docs.python.org/3.14/library/collections.html#collections.deque>:
  > *"In addition to the above, deques support iteration, pickling, `len(d)`, `reversed(d)`,
  > `copy.copy(d)`, `copy.deepcopy(d)`, membership testing with the `in` operator, and subscript
  > references such as `d[0]` to access the first element.  Indexed access is O(1) at both ends
  > but slows to O(n) in the middle.  For fast random access, use lists instead."*
  > *"The `rotate()` method provides a way to implement `deque` slicing and deletion."*
  > *"To implement `deque` slicing, use a similar approach applying `rotate()` to bring a target
  > element to the left side of the deque. Remove old entries with `popleft()`, add new entries
  > with `extend()`, and then reverse the rotation."*
  > *"Bounded length deques provide functionality similar to the `tail` filter in Unix"* —
  > `def tail(filename, n=10): … return deque(f, n)`.
  The docs never say "deques do not support slicing" in so many words; the recipe + source slots
  establish it.

---

## 10 · Iterators — `islice`, `batched`, `pairwise`, recipes

**`library/itertools.rst`** — <https://docs.python.org/3.14/library/itertools.html>

`islice(iterable, stop)` / `islice(iterable, start, stop[, step])`:
> *"Make an iterator that returns selected elements from the iterable. Works like sequence
> slicing but does not support negative values for *start*, *stop*, or *step*."*
> *"If *start* is zero or `None`, iteration starts at zero.  Otherwise, elements from the
> iterable are skipped until *start* is reached."*
> *"If *stop* is `None`, iteration continues until the input is exhausted, if at all.
> Otherwise, it stops at the specified position."*
> *"If *step* is `None`, the step defaults to one.  Elements are returned consecutively unless
> *step* is set higher than one which results in items being skipped."*
> *"If the input is an iterator, then fully consuming the *islice* advances the input iterator by
> `max(start, stop)` steps regardless of the *step* value."*
Rough equivalent builds `s = slice(*args)`, raises `ValueError` on negatives, then
`for i, element in zip(indices, iterable)` — i.e. it walks from the beginning.
Source `Modules/itertoolsmodule.c` errors (ValueError): **`Stop argument for islice() must be None
or an integer: 0 <= x <= sys.maxsize.`** · **`Indices for islice() must be None or an integer:
0 <= x <= sys.maxsize.`** · **`Step for islice() must be a positive integer or None.`**

`batched(iterable, n, *, strict=False)`:
> *"Batch data from the *iterable* into tuples of length *n*. The last batch may be shorter than
> *n*."* · *"If *strict* is true, will raise a `ValueError` if the final batch is shorter than
> *n*."* · *"Loops over the input iterable and accumulates data into tuples up to size *n*.  The
> input is consumed lazily, just enough to fill a batch."* · *"Added in version 3.12."* ·
> *"Changed in version 3.13: Added the *strict* option."* · rough equivalent raises
> `ValueError('n must be at least one')`, `ValueError('batched(): incomplete batch')`.

`pairwise(iterable)`: *"Return successive overlapping pairs taken from the input *iterable*."* ·
*"The number of 2-tuples in the output iterator will be one fewer than the number of inputs.  It
will be empty if the input iterable has fewer than two values."* · *"Added in version 3.10."*

`tee(iterable, n=2)`: *"Return *n* independent iterators from a single iterable."* · *"`tee`
iterators are not threadsafe."* · *"This itertool may require significant auxiliary storage
(depending on how much temporary data needs to be stored). In general, if one iterator uses most
or all of the data before another iterator starts, it is faster to use `list` instead of `tee`."*

Recipes (3.14): `take(n, iterable)` *"Return first n items of the iterable as a list."* →
`list(islice(iterable, n))` · `tail(n, iterable)` *"Return an iterator over the last n items."* →
`iter(deque(iterable, maxlen=n))` · `consume(iterator, n=None)` → `next(islice(iterator, n, n),
None)` · `nth(iterable, n, default=None)` → `next(islice(iterable, n, None), default)` ·
`sliding_window(iterable, n)` *"Collect data into overlapping fixed-length chunks or blocks."* —
`deque(islice(iterator, n - 1), maxlen=n)` then append + `yield tuple(window)`.

What's New 3.14 — <https://docs.python.org/3.14/whatsnew/3.14.html>: *"Remove support for copy,
deepcopy, and pickle operations from `itertools` iterators. These have emitted a
`DeprecationWarning` since Python 3.12."* (gh-101588).

`reversed(object)` — functions.rst: *"Return a reverse iterator.  The argument must be an object
which has a `__reversed__` method or supports the sequence protocol (the `__len__` method and the
`__getitem__` method with integer arguments starting at `0`)."*
`sequence.reverse()`: *"Reverse the items of *sequence* in place. This method maintains economy of
space when reversing a large sequence."*

---

## 11 · Text: code points, bytes-as-ints, prefixes, truncation

- stdtypes: *"Strings are immutable sequences of Unicode code points."*
- *"Since there is no separate "character" type, indexing a string produces strings of length 1.
  That is, for a non-empty string *s*, `s[0] == s[0:1]`."*
- bytes: *"Since bytes objects are sequences of integers (akin to a tuple), for a bytes object
  *b*, `b[0]` will be an integer, while `b[0:1]` will be a bytes object of length 1.  (This
  contrasts with text strings, where both indexing and slicing will produce a string of length
  1)"* (bytearray: identical sentence).
- `str.removeprefix(prefix, /)`: *"If the string starts with the *prefix* string, return
  `string[len(prefix):]`. Otherwise, return a copy of the original string"* — *"Added in version
  3.9"*.
- 🔴 `str.removesuffix(suffix, /)`: *"If the string ends with the *suffix* string and that
  *suffix* is not empty, return `string[:-len(suffix)]`. Otherwise, return a copy of the original
  string"* — the "not empty" clause exists because `s[:-0]` is `s[:0]`, i.e. `''`.
- `str.lstrip`: *"The *chars* argument is not a prefix; rather, all combinations of its values are
  stripped"* — doc `'Arthur: three!'.lstrip('Arthur: ')` → `'ee!'` vs `.removeprefix('Arthur: ')`
  → `'three!'`. `rstrip`: `'Monty Python'.rstrip(' Python')` → `'M'`.
- `str.find` returns `-1` when absent (a valid negative index!); `str.index`: *"Like `find`, but
  raise `ValueError` when the substring is not found."*
- `str.partition(sep, /)`: *"Split the string at the first occurrence of *sep*, and return a
  3-tuple containing the part before the separator, the separator itself, and the part after the
  separator.  If the separator is not found, return a 3-tuple containing the string itself,
  followed by two empty strings."*
- `textwrap.shorten` — <https://docs.python.org/3.14/library/textwrap.html#textwrap.shorten>:
  *"Collapse and truncate the given *text* to fit in the given *width*."* · *"First the whitespace
  in *text* is collapsed (all whitespace is replaced by single spaces).  If the result fits in the
  *width*, it is returned. Otherwise, enough words are dropped from the end so that the remaining
  words plus the *placeholder* fit within *width*"* · default `placeholder=' [...]'`.
- Unicode HOWTO — <https://docs.python.org/3.14/howto/unicode.html>: *"a letter like 'ê' can be
  represented as a single code point U+00EA, or as U+0065 U+0302, which is the code point for 'e'
  followed by a code point for 'COMBINING CIRCUMFLEX ACCENT'.  These will produce the same output
  when printed, but one is a string of length 1 and the other is of length 2."* · UTF-8: *"If the
  code point is >= 128, it's turned into a sequence of two, three, or four bytes, where each byte
  of the sequence is between 128 and 255."*
- codecs `IncrementalDecoder.decode(object, final=False)`: *"If *final* is true the decoder must
  decode the input completely and must flush all buffers. If this isn't possible (e.g. because of
  incomplete byte sequences at the end of the input) it must initiate error handling just like in
  the stateless case (which might raise an exception)."* — <https://docs.python.org/3.14/library/codecs.html#codecs.IncrementalDecoder.decode>
- Source `unicode_decode_utf8_impl`: truncated sequence at end → reason **`unexpected end of data`**.
- Verified negative: neither `library/unicodedata.rst` nor `howto/unicode.rst` (3.14) mentions
  grapheme clusters — no stdlib grapheme segmentation is documented.
- `struct.unpack_from(format, /, buffer, offset=0)`: *"Unpack from *buffer* starting at position
  *offset*, according to the format string *format*."* · *"A negative *offset* counts from the end
  of *buffer*."*

---

## 12 · Threads — `library/threadsafety.rst` (new in 3.14)

<https://docs.python.org/3.14/library/threadsafety.html>
List section lists `lst[i]` (atomic), `lst1 + lst2`, `x * lst`, `lst.copy()` as *"return new
objects and appear atomic to other threads"*; **`lst[i:j]` (get) is not listed at all.** Slice
assignment: *"Similarly, assigning to a list slice with `lst[i:j] = iterable` is safe to call from
multiple threads, but `iterable` is only locked when it is also a `list` (but not its
subclasses)."* bytearray: *"Reading a single element or slice is safe to call from multiple
threads"* (`ba[i:j]`), `ba[i:j] = values` safe, *"Slice assignment locks both objects when
*values* is a `bytearray`"*. Source: `list_slice_wrap` holds the per-object critical section —
implementation detail, undocumented for list slicing.

---

## 13 · Pagination — PostgreSQL 18 `7.6. LIMIT and OFFSET`

<https://www.postgresql.org/docs/18/queries-limit.html> (page header: PostgreSQL 18.6 current, 2026-08-13)
> *"OFFSET says to skip that many rows before beginning to return rows."*
> *"When using LIMIT, it is important to use an ORDER BY clause that constrains the result rows
> into a unique order. Otherwise you will get an unpredictable subset of the query's rows."*
> *"The rows skipped by an OFFSET clause still have to be computed inside the server; therefore a
> large OFFSET might be inefficient."*

---

## 14 · Version facts

3.0 `__getslice__` family removed · 3.2 `range` slicing + negative indices · 3.9
`removeprefix`/`removesuffix` · 3.10 `pairwise`; `operator.index` exact int · 3.12 hashable
`slice`, `batched`, `BINARY_SLICE`/`STORE_SLICE` · 3.13 `batched(strict=)` · 3.14 itertools
iterators lose copy/deepcopy/pickle; `memoryview` generic; free-threaded build officially
supported (PEP 779); `threadsafety.html` page; `time-complexity.html` page.
`grep -i slice whatsnew/3.14.rst` → **no slicing change in 3.14**.

---

## 14b · Gap fetches during chunk planning (same session)

**`library/re.rst` `Pattern.search(string[, pos[, endpos]])`** — <https://docs.python.org/3.14/library/re.html#re.Pattern.search>
> *"The optional second parameter *pos* gives an index in the string where the search is to
> start; it defaults to `0`.  This is not completely equivalent to slicing the string; the `'^'`
> pattern character matches at the real beginning of the string and at positions just after a
> newline, but not necessarily at the index where the search is to start."*
> *"The optional parameter *endpos* limits how far the string will be searched; it will be as if
> the string is *endpos* characters long … `rx.search(string, 0, 50)` is equivalent to
> `rx.search(string[:50], 0)`."* (`Pattern.match` takes the same *pos*/*endpos*.)

**memoryview slices and the export count** — `Objects/memoryobject.c`: every view created by
slicing is registered with the managed buffer (`mbuf->exports++` in `mbuf_add_view`);
`_memory_release` does `if (--self->mbuf->exports == 0) mbuf_release(self->mbuf);` ⇒ the
underlying object's buffer (and a bytearray's resize lock) is released only when **every** view
derived from it — including slices — has been released or garbage-collected. Implementation
detail; the docs say only that a bytearray *"would temporarily forbid resizing"* while a view is
held. `memoryview.release()` on a view that itself exports buffers raises `BufferError`
**`memoryview has %zd exported buffer%s`**.

---

## 15 · Could NOT confirm — write as uncertain, or leave out

1. **Whether `t[:] is t` / `s[:] is s` is guaranteed.** Not documented for slicing. CPython 3.14
   source returns the same object for exact `tuple`/`str`/`bytes` full slices — state it as an
   implementation detail; the documented guarantee is `tuple(t)` returning `t`.
2. **Whether `lst[i:j]` appears atomic to other threads** (free-threaded 3.14). The thread-safety
   page lists `lst.copy()`, not slicing. Recommend `.copy()` for snapshots; say the slice case is
   undocumented.
3. **Exact exception from `copy.copy(islice_obj)` in 3.14.** Only What's New's "Remove support"
   sentence is confirmed. Do not print a message.
4. **Any timing / memory figure** (e.g. "slicing is N× faster than a loop"). None documented; T3
   banned. Explain the O() shape only.
5. **Grapheme-cluster segmentation in the stdlib.** Not documented for 3.14 — say "the 3.14
   `unicodedata` docs describe none", recommend a third-party segmenter only by category, name none.
6. **`dict[1:3]` error text.** Mechanism (hashable slice → failed lookup → `KeyError`) derived,
   not quoted; the repr of the key in the message is not asserted.
7. **The full traceback text of any error.** Only the C string literals above are quotable.
