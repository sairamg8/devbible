---
name: research-python-p03-t02-tuple
description: Banked primary sources for Python phase 3 topic 02 (tuple) — verbatim quotes and URLs. Do not re-derive.
metadata:
  type: project
---

# research — python phase 3, topic 02 · `tuple`

**Banked 2026-09-10. Do not re-derive.** Every quote below was taken from the CPython
**3.14 branch** reST sources on GitHub (`https://raw.githubusercontent.com/python/cpython/3.14/Doc/…`),
which are the exact text rendered at `docs.python.org/3.14/…`. Cite the docs.python.org
URL on the page; the raw source is how it was read.

Version spine: **CPython 3.14** (3.14.7). No sandbox — no program output was produced or
reproduced. Error strings below are quoted from the docs or from CPython C source, and the
file+line is named beside each.

---

## 1 · What immutability actually means (the load-bearing quotes)

**`reference/datamodel.rst` §Objects, values and types** —
<https://docs.python.org/3.14/reference/datamodel.html#objects-values-and-types>

> *"The *value* of some objects can change.  Objects whose value can change are said to be
> *mutable*; objects whose value is unchangeable once they are created are called
> *immutable*. (The value of an immutable container object that contains a reference to a
> mutable object can change when the latter's value is changed; however the container is
> still considered immutable, because the collection of objects it contains cannot be
> changed.  So, immutability is not strictly the same as having an unchangeable value, it
> is more subtle.) An object's mutability is determined by its type; for instance, numbers,
> strings and tuples are immutable, while dictionaries and lists are mutable."*

> *"Some objects contain references to other objects; these are called *containers*.
> Examples of containers are tuples, lists and dictionaries.  The references are part of a
> container's value.  In most cases, when we talk about the value of a container, we imply
> the values, not the identities of the contained objects; however, when we talk about the
> mutability of a container, only the identities of the immediately contained objects are
> implied.  So, if an immutable container (like a tuple) contains a reference to a mutable
> object, its value changes if that mutable object is changed."*

**`reference/datamodel.rst` §Immutable sequences** (standard type hierarchy) —
<https://docs.python.org/3.14/reference/datamodel.html#immutable-sequences>

> *"An object of an immutable sequence type cannot change once it is created.  (If the
> object contains references to other objects, these other objects may be mutable and may
> be changed; however, the collection of objects directly referenced by an immutable object
> cannot change.)"*

**Identity of equal immutables is UNSPECIFIED** — same page:

> *"Types affect almost all aspects of object behavior.  Even the importance of object
> identity is affected in some sense: for immutable types, operations that compute new
> values may actually return a reference to any existing object with the same type and
> value, while for mutable objects this is not allowed. For example, after ``a = 1; b = 1``,
> *a* and *b* may or may not refer to the same object with the value one, depending on the
> implementation. … This behaviour depends on the implementation used, so should not be
> relied upon"*

**Empty tuple identity, `reference/expressions.rst` §Parenthesized forms** —
<https://docs.python.org/3.14/reference/expressions.html#parenthesized-forms>

> *"An empty pair of parentheses yields an empty tuple object.  Since tuples are immutable,
> the same rules as for literals apply (i.e., two occurrences of the empty tuple may or may
> not yield the same object)."*

🔴 **This settles the interning question in the only defensible way: tuple caching,
free-lists and constant folding are CPython implementation details, and the language
explicitly declines to guarantee them.** Write it as uncertain; never assert `() is ()`.

**Thread-safety, `glossary.rst` §immutable** —
<https://docs.python.org/3.14/glossary.html#term-immutable>

> *"An object with a fixed value.  Immutable objects include numbers, strings and tuples.
> Such an object cannot be altered.  A new object has to be created if a different value has
> to be stored.  They play an important role in places where a constant hash value is needed,
> for example as a key in a dictionary.  Immutable objects are inherently
> :term:`thread-safe` because their state cannot be modified after creation, eliminating
> concerns about improperly synchronized :term:`concurrent modification`."*

⚠️ Note the boundary: the *tuple* is thread-safe; a list **inside** it is not, and the
glossary sentence says nothing about contained objects.

---

## 2 · The `tuple` type itself

**`library/stdtypes.rst` §Tuples** —
<https://docs.python.org/3.14/library/stdtypes.html#tuple>

> *"Tuples are immutable sequences, typically used to store collections of heterogeneous
> data (such as the 2-tuples produced by the :func:`enumerate` built-in). Tuples are also
> used for cases where an immutable sequence of homogeneous data is needed (such as allowing
> storage in a :class:`set` or :class:`dict` instance)."*

> *"Tuples may be constructed in a number of ways:
>  * Using a pair of parentheses to denote the empty tuple: ``()``
>  * Using a trailing comma for a singleton tuple: ``a,`` or ``(a,)``
>  * Separating items with commas: ``a, b, c`` or ``(a, b, c)``
>  * Using the :func:`tuple` built-in: ``tuple()`` or ``tuple(iterable)``"*

> *"The constructor builds a tuple whose items are the same and in the same order as
> *iterable*'s items. … **If *iterable* is already a tuple, it is returned unchanged.** For
> example, ``tuple('abc')`` returns ``('a', 'b', 'c')`` and ``tuple( [1, 2, 3] )`` returns
> ``(1, 2, 3)``. If no argument is given, the constructor creates a new empty tuple, ``()``."*

> *"Note that it is actually the comma which makes a tuple, not the parentheses. The
> parentheses are optional, except in the empty tuple case, or when they are needed to avoid
> syntactic ambiguity. For example, ``f(a, b, c)`` is a function call with three arguments,
> while ``f((a, b, c))`` is a function call with a 3-tuple as the sole argument."*

> *"Tuples implement all of the :ref:`common <typesseq-common>` sequence operations."*

> *"For heterogeneous collections of data where access by name is clearer than access by
> index, :func:`collections.namedtuple` may be a more appropriate choice than a simple tuple
> object."*

**`library/stdtypes.rst` §Immutable Sequence Types** —
<https://docs.python.org/3.14/library/stdtypes.html#immutable-sequence-types>

> *"The only operation that immutable sequence types generally implement that is not also
> implemented by mutable sequence types is support for the :func:`hash` built-in.
>
> This support allows immutable sequences, such as :class:`tuple` instances, to be used as
> :class:`dict` keys and stored in :class:`set` and :class:`frozenset` instances.
>
> Attempting to hash an immutable sequence that contains unhashable values will result in
> :exc:`TypeError`."*

**The whole extra surface (`count` and `index` only) —
`library/stdtypes.rst` §Sequence Methods** —
<https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations>

> *"Return the total number of occurrences of *value* in *sequence*."* (`tuple.count`)

> *"Return the index of the first occurrence of *value* in *sequence*. Raises
> :exc:`ValueError` if *value* is not found in *sequence*. The *start* or *stop* arguments
> allow for efficient searching of subsections of the sequence, beginning at *start* and
> ending at *stop*. This is roughly equivalent to ``start + sequence[start:stop].index(value)``,
> only without copying any data."*

**Repetition shares references — note (2) of the common-sequence table:**

> *"Values of *n* less than ``0`` are treated as ``0`` (which yields an empty sequence of
> the same type as *s*).  Note that items in the sequence *s* are not copied; they are
> referenced multiple times.  This often haunts new Python programmers"*

**`reference/datamodel.rst` §Tuples (type hierarchy)** —

> *"The items of a :class:`tuple` are arbitrary Python objects. Tuples of two or more items
> are formed by comma-separated lists of expressions.  A tuple of one item (a 'singleton')
> can be formed by affixing a comma to an expression (an expression by itself does not
> create a tuple, since parentheses must be usable for grouping of expressions).  An empty
> tuple can be formed by an empty pair of parentheses."*

---

## 3 · O(n²) concatenation — quoted, not measured

**`library/stdtypes.rst` note (6) of the common-sequence table** —
<https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations>

> *"Concatenating immutable sequences always results in a new object.  This means that
> building up a sequence by repeated concatenation will have a quadratic runtime cost in the
> total sequence length.  To get a linear runtime cost, you must switch to one of the
> alternatives below:
>  * if concatenating :class:`str` objects, you can build a list and use :meth:`str.join` at
>    the end …
>  * if concatenating :class:`bytes` objects, you can similarly use :meth:`bytes.join` or
>    :class:`io.BytesIO` …
>  * **if concatenating :class:`tuple` objects, extend a :class:`list` instead**
>  * for other types, investigate the relevant class documentation"*

🔴 That bullet is the whole gotcha, stated by the docs. No benchmark needed or permitted.

---

## 4 · Augmented assignment — the raises-AND-mutates case

**`faq/programming.rst` — "Why does a_tuple[i] += ['item'] raise an exception when the
addition works?"** —
<https://docs.python.org/3.14/faq/programming.html#why-does-a-tuple-i-item-raise-an-exception-when-the-addition-works>

> *"This is because of a combination of the fact that augmented assignment operators are
> *assignment* operators, and the difference between mutable and immutable objects in
> Python."*

> *"The reason for the exception should be immediately clear: ``1`` is added to the object
> ``a_tuple[0]`` points to (``1``), producing the result object, ``2``, but when we attempt
> to assign the result of the computation, ``2``, to element ``0`` of the tuple, we get an
> error because we can't change what an element of a tuple points to."*

> *"It is the assignment part of the operation that produces the error, since a tuple is
> immutable."*

> *"The exception is a bit more surprising, and even more surprising is the fact that even
> though there was an error, the append worked"*

> *"To see why this happens, you need to know that (a) if an object implements an
> :meth:`~object.__iadd__` magic method, it gets called when the ``+=`` augmented assignment
> is executed, and its return value is what gets used in the assignment statement; and (b)
> for lists, :meth:`!__iadd__` is equivalent to calling :meth:`~sequence.extend` on the list
> and returning the list."*

> *"The :meth:`!__iadd__` succeeds, and thus the list is extended, but even though ``result``
> points to the same object that ``a_tuple[0]`` already points to, that final assignment
> still results in an error, because tuples are immutable."*

The FAQ's own rewrite (quote it as the *mechanism*, it is doc text, not output):

```python
result = a_tuple[0].__iadd__(['item'])
a_tuple[0] = result          # <- this is the line that raises
```

**`reference/simple_stmts.rst` §Augmented assignment statements** —
<https://docs.python.org/3.14/reference/simple_stmts.html#augmented-assignment-statements>

> *"An augmented assignment evaluates the target (which, unlike normal assignment
> statements, cannot be an unpacking) and the expression list, performs the binary operation
> specific to the type of assignment on the two operands, and assigns the result to the
> original target.  The target is only evaluated once."*

> *"An augmented assignment statement like ``x += 1`` can be rewritten as ``x = x + 1`` to
> achieve a similar, but not exactly equal effect. In the augmented version, ``x`` is only
> evaluated once. Also, when possible, the actual operation is performed *in-place*, meaning
> that rather than creating a new object and assigning that to the target, the old object is
> modified instead."*

> *"Unlike normal assignments, augmented assignments evaluate the left-hand side *before*
> evaluating the right-hand side.  For example, ``a[i] += f(x)`` first looks-up ``a[i]``,
> then it evaluates ``f(x)`` and performs the addition, and lastly, it writes the result back
> to ``a[i]``."*

**Error string, verified in CPython 3.14 source** — `Objects/abstract.c` line 1912:
`type_error("'%.200s' object does not support item assignment", s);`
→ renders as **`TypeError: 'tuple' object does not support item assignment`**, which is also
the exact string printed in the tutorial's tuple example
(<https://docs.python.org/3.14/tutorial/datastructures.html#tuples-and-sequences>).
<https://github.com/python/cpython/blob/3.14/Objects/abstract.c>

---

## 5 · Hashability

**`glossary.rst` §hashable** — <https://docs.python.org/3.14/glossary.html#term-hashable>

> *"An object is *hashable* if it has a hash value which never changes during its lifetime
> (it needs a :meth:`~object.__hash__` method), and can be compared to other objects (it
> needs an :meth:`~object.__eq__` method). Hashable objects which compare equal must have the
> same hash value."*

> *"Hashability makes an object usable as a dictionary key and a set member, because these
> data structures use the hash value internally."*

> *"Most of Python's immutable built-in objects are hashable; mutable containers (such as
> lists or dictionaries) are not; **immutable containers (such as tuples and frozensets) are
> only hashable if their elements are hashable.**  Objects which are instances of
> user-defined classes are hashable by default.  They all compare unequal (except with
> themselves), and their hash value is derived from their :func:`id`."*

**`reference/datamodel.rst` §`object.__hash__`** —
<https://docs.python.org/3.14/reference/datamodel.html#object.__hash__>

> *"The only required property is that objects which compare equal have the same hash value;
> it is advised to mix together the hash values of the components of the object that also
> play a part in comparison of objects by **packing them into a tuple and hashing the
> tuple**. Example::
>
>     def __hash__(self):
>         return hash((self.name, self.nick, self.color))"*

> *"If a class defines mutable objects and implements an :meth:`__eq__` method, it should not
> implement :meth:`__hash__`, since the implementation of :term:`hashable` collections
> requires that a key's hash value is immutable (if the object's hash value changes, it will
> be in the wrong hash bucket)."*

> *"By default, the :meth:`__hash__` values of str and bytes objects are "salted" with an
> unpredictable random value.  Although they remain constant within an individual Python
> process, they are not predictable between repeated invocations of Python."*

**`library/functions.rst` §`hash()`** —
<https://docs.python.org/3.14/library/functions.html#hash>

> *"Return the hash value of the object (if it has one).  Hash values are integers.  They are
> used to quickly compare dictionary keys during a dictionary lookup.  **Numeric values that
> compare equal have the same hash value (even if they are of different types, as is the case
> for 1 and 1.0).**"*

→ therefore `(1, 'a')` and `(1.0, 'a')` and `(True, 'a')` are **one** dict key. Documented,
not guessed.

**`library/stdtypes.rst` §Hashing of numeric types** —
<https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types>

> *"For numbers ``x`` and ``y``, possibly of different types, it's a requirement that
> ``hash(x) == hash(y)`` whenever ``x == y``"*

**Error string, CPython 3.14 `Objects/object.c` line 1147:**
`PyErr_Format(PyExc_TypeError, "unhashable type: '%.200s'", …)`
→ **`TypeError: unhashable type: 'list'`**.
<https://github.com/python/cpython/blob/3.14/Objects/object.c>

**`faq/design.rst` — "Why must dictionary keys be immutable?"** —
<https://docs.python.org/3.14/faq/design.html#why-must-dictionary-keys-be-immutable>

> *"The hash table implementation of dictionaries uses a hash value calculated from the key
> value to find the key.  If the key were a mutable object, its value could change, and thus
> its hash could also change.  But since whoever changes the key object can't tell that it
> was being used as a dictionary key, it can't move the entry around in the dictionary.
> Then, when you try to look up the same object in the dictionary it won't be found because
> its hash value is different."*

> *"If you want a dictionary indexed with a list, simply convert the list to a tuple first;
> the function ``tuple(L)`` creates a tuple with the same entries as the list ``L``.  Tuples
> are immutable and can therefore be used as dictionary keys."*

> *"dictionary keys should be compared using ``==``, not using :keyword:`is`."*

> *"Mark lists as read-only once they are used as a dictionary key.  The problem is that it's
> not just the top-level object that could change its value; you could use a tuple containing
> a list as a key.  Entering anything as a key into a dictionary would require marking all
> objects reachable from there as read-only"*

> *"There is a trick to get around this if you need to, but use it at your own risk: You can
> wrap a mutable structure inside a class instance which has both a :meth:`~object.__eq__`
> and a :meth:`~object.__hash__` method.  You must then make sure that the hash value for all
> such wrapper objects that reside in a dictionary (or other hash based structure), remain
> fixed while the object is in the dictionary"*

**`library/functools.rst` §`lru_cache`** —
<https://docs.python.org/3.14/library/functools.html#functools.lru_cache>

> *"Since a dictionary is used to cache results, the positional and keyword arguments to the
> function must be :term:`hashable`."*

> *"Distinct argument patterns may be considered to be distinct calls with separate cache
> entries.  For example, ``f(a=1, b=2)`` and ``f(b=2, a=1)`` differ in their keyword argument
> order and may have two separate cache entries."*

---

## 6 · `list` vs `tuple` — the record/array framing

**`faq/design.rst` — "Why are there separate tuple and list data types?"** —
<https://docs.python.org/3.14/faq/design.html#why-are-there-separate-tuple-and-list-data-types>

> *"Lists and tuples, while similar in many respects, are generally used in fundamentally
> different ways.  Tuples can be thought of as being similar to Pascal ``records`` or C
> ``structs``; they're small collections of related data which may be of different types
> which are operated on as a group.  For example, a Cartesian coordinate is appropriately
> represented as a tuple of two or three numbers."*

> *"Lists, on the other hand, are more like arrays in other languages.  They tend to hold a
> varying number of objects all of which have the same type and which are operated on
> one-by-one.  For example, :func:`os.listdir('.') <os.listdir>` returns a list of strings
> representing the files in the current directory.  Functions which operate on this output
> would generally not break if you added another file or two to the directory."*

> *"Tuples are immutable, meaning that once a tuple has been created, you can't replace any
> of its elements with a new value.  Lists are mutable, meaning that you can always change a
> list's elements.  Only immutable elements can be used as dictionary keys, and hence only
> tuples and not lists can be used as keys."*

**`tutorial/datastructures.rst` §Tuples and Sequences** —
<https://docs.python.org/3.14/tutorial/datastructures.html#tuples-and-sequences>

> *"Though tuples may seem similar to lists, they are often used in different situations and
> for different purposes. Tuples are :term:`immutable`, and usually contain a heterogeneous
> sequence of elements that are accessed via unpacking (see later in this section) or
> indexing (or even by attribute in the case of :func:`namedtuples
> <collections.namedtuple>`). Lists are :term:`mutable`, and their elements are usually
> homogeneous and are accessed by iterating over the list."*

> *"A special problem is the construction of tuples containing 0 or 1 items: the syntax has
> some extra quirks to accommodate these.  Empty tuples are constructed by an empty pair of
> parentheses; a tuple with one item is constructed by following a value with a comma (it is
> not sufficient to enclose a single value in parentheses). Ugly, but effective."*

> *"It is not possible to assign to the individual items of a tuple, however it is possible
> to create tuples which contain mutable objects, such as lists."*

---

## 7 · Where the heterogeneous/homogeneous convention breaks — the typing system

**`library/typing.rst` §Annotating tuples** —
<https://docs.python.org/3.14/library/typing.html#annotating-tuples>

> *"For most containers in Python, the typing system assumes that all elements in the
> container will be of the same type."*

> *"Unlike most other Python containers, however, it is common in idiomatic Python code for
> tuples to have elements which are not all of the same type. For this reason, tuples are
> special-cased in Python's typing system. :class:`tuple` accepts *any number* of type
> arguments"*

> *"To denote a tuple which could be of *any* length, and in which all elements are of the
> same type ``T``, use the literal ellipsis ``...``: ``tuple[T, ...]``. To denote an empty
> tuple, use ``tuple[()]``. Using plain ``tuple`` as an annotation is equivalent to using
> ``tuple[Any, ...]``."*

Also from `library/stdtypes.rst` §Tuples:

> *"Tuples are :ref:`generic <generics>` over the types of their contents."*

PEP 646 (variadic generics) added the ability for any item in an expression list to be
starred — `reference/expressions.rst` `.. versionadded:: 3.11 Any item in an expression list
may be starred. See :pep:`646`.`

---

## 8 · Packing, unpacking and `*rest`

**`tutorial/datastructures.rst`:**

> *"The statement ``t = 12345, 54321, 'hello!'`` is an example of *tuple packing*: the values
> ``12345``, ``54321`` and ``'hello!'`` are packed together in a tuple.  The reverse
> operation is also possible … This is called, appropriately enough, *sequence unpacking* and
> works for any sequence on the right-hand side.  Sequence unpacking requires that there are
> as many variables on the left side of the equals sign as there are elements in the
> sequence.  Note that multiple assignment is really just a combination of tuple packing and
> sequence unpacking."*

**`reference/simple_stmts.rst` §Assignment statements** —
<https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements>

> *"If the target list contains one target prefixed with an asterisk, called a "starred"
> target: The object must be an iterable with at least as many items as there are targets in
> the target list, minus one.  The first items of the iterable are assigned, from left to
> right, to the targets before the starred target.  The final items of the iterable are
> assigned to the targets after the starred target.  **A list of the remaining items in the
> iterable is then assigned to the starred target (the list can be empty).**"*

> *"Although the definition of assignment implies that overlaps between the left-hand side
> and the right-hand side are 'simultaneous' (for example ``a, b = b, a`` swaps two
> variables), overlaps *within* the collection of assigned-to variables occur left-to-right,
> sometimes resulting in confusion.  For instance, the following program prints ``[0, 2]``::
>
>    x = [0, 1]
>    i = 0
>    i, x[i] = 1, 2         # i is updated, then x[i] is updated
>    print(x)"*

**`tutorial/introduction.rst`** (Fibonacci example) —
<https://docs.python.org/3.14/tutorial/introduction.html#first-steps-towards-programming>

> *"The first line contains a *multiple assignment*: the variables ``a`` and ``b``
> simultaneously get the new values 0 and 1.  On the last line this is used again,
> demonstrating that the expressions on the right-hand side are all evaluated first before
> any of the assignments take place.  The right-hand side expressions are evaluated from the
> left to the right."*

**PEP 3132 — Extended Iterable Unpacking** — <https://peps.python.org/pep-3132/>

> *"Many algorithms require splitting a sequence in a "first, rest" pair.  With the new
> syntax, `first, rest = seq[0], seq[1:]` is replaced by the cleaner and probably more
> efficient: `first, *rest = seq`"*

> *"It is also an error to use the starred expression as a lone assignment target, as in
> `*a = range(5)`. This, however, is valid syntax: `*a, = range(5)`"*

> *"Note that this proposal also applies to tuples in implicit assignment context, such as in
> a for statement: `for a, *b in [(1, 2, 3), (4, 5, 6, 7)]:`"*

Rejected alternative (this is **why `*rest` is a list, not a tuple**):

> *"Make the starred target a tuple instead of a list.  This would be consistent with a
> function's `*args`, but make further processing of the result harder."*

**PEP 448 — Additional Unpacking Generalizations** — <https://peps.python.org/pep-0448/>

> *"Unpacking is proposed to be allowed inside tuple, list, set, and dictionary displays:
> `>>> *range(4), 4` → `(0, 1, 2, 3, 4)`"*

> *"Whilst `*elements, = iterable` causes elements to be a list, `elements = *iterable,`
> causes elements to be a tuple.  The reason for this may confuse people unfamiliar with the
> construct."*

**`reference/compound_stmts.rst` §Function definitions** — `*args` is a tuple —
<https://docs.python.org/3.14/reference/compound_stmts.html#function-definitions>

> *"If the form "``*identifier``" is present, it is initialized to a tuple receiving any
> excess positional parameters, defaulting to the empty tuple."*

**Unpacking error strings, CPython 3.14 `Python/ceval.c`** (lines 2419–2471):
`"not enough values to unpack (expected %d, got %zd)"`,
`"too many values to unpack (expected %d)"`,
`"not enough values to unpack (expected at least %d, got %zd)"`.
<https://github.com/python/cpython/blob/3.14/Python/ceval.c>

**`reference/expressions.rst` §Expression lists** —
<https://docs.python.org/3.14/reference/expressions.html#expression-lists>

> *"Except when part of a list or set display, an expression list containing at least one
> comma yields a tuple.  The length of the tuple is the number of expressions in the list.
> The expressions are evaluated from left to right."*

> *"A trailing comma is required only to create a one-item tuple, such as ``1,``; it is
> optional in all other cases. A single expression without a trailing comma doesn't create a
> tuple, but rather yields the value of that expression. (To create an empty tuple, use an
> empty pair of parentheses: ``()``.)"*

> *"Note that tuples are not formed by the parentheses, but rather by use of the comma.  The
> exception is the empty tuple, for which parentheses *are* required --- allowing
> unparenthesized "nothing" in expressions would cause ambiguities and allow common typos to
> pass uncaught."*

---

## 9 · The trailing-comma bugs

**`assert (cond, "msg")` warns.** CPython 3.14 `Python/codegen.c`, `codegen_assert()`
(line ~2938):

```c
/* Always emit a warning if the test is a non-zero length tuple */
… _PyCompile_Warn(c, LOC(s), "assertion is always true, "
                             "perhaps remove parentheses?");
```

→ **`SyntaxWarning: assertion is always true, perhaps remove parentheses?`**
<https://github.com/python/cpython/blob/3.14/Python/codegen.c>

**printf-style formatting needs a tuple.** `library/stdtypes.rst`
§printf-style String Formatting —
<https://docs.python.org/3.14/library/stdtypes.html#printf-style-string-formatting>

> *"If *format* requires a single argument, *values* may be a single non-tuple object.
> Otherwise, *values* must be a tuple with exactly the number of items specified by the
> format string, or a single mapping object (for example, a dictionary)."*

**DB-API parameters are a sequence.** `library/sqlite3.rst` §placeholders —
<https://docs.python.org/3.14/library/sqlite3.html#how-to-use-placeholders-to-bind-values-in-sql-queries>

> *"Instead, use the DB-API's parameter substitution. To insert a variable into a query
> string, use a placeholder in the string, and substitute the actual values into the query by
> providing them as a :class:`tuple` of values to the second argument of the cursor's
> :meth:`~Cursor.execute` method."*

> *"For the qmark style, *parameters* must be a :term:`sequence` whose length must match the
> number of placeholders, or a :exc:`ProgrammingError` is raised."*

⚠️ A `str` **is** a sequence, so `execute("… = ?", ("abc"))` passes a 3-element sequence and
raises `ProgrammingError`. Documented consequence of the two sentences above.

---

## 10 · Comparison and ordering

**`reference/expressions.rst` §Value comparisons** —
<https://docs.python.org/3.14/reference/expressions.html#value-comparisons>

> *"Sequences (instances of :class:`tuple`, :class:`list`, or :class:`range`) can be compared
> only within each of their types, with the restriction that ranges do not support order
> comparison.  Equality comparison across these types results in inequality, and ordering
> comparison across these types raises :exc:`TypeError`."*

> *"Sequences compare lexicographically using comparison of corresponding elements.  The
> built-in containers typically assume identical objects are equal to themselves.  That lets
> them bypass equality tests for identical objects to improve performance and to maintain
> their internal invariants."*

> *"For two collections to compare equal, they must be of the same type, have the same
> length, and each pair of corresponding elements must compare equal (for example, ``[1,2] ==
> (1,2)`` is false because the type is not the same)."*

> *"Collections that support order comparison are ordered the same as their first unequal
> elements (for example, ``[1,2,x] <= [1,2,y]`` has the same value as ``x <= y``).  If a
> corresponding element does not exist, the shorter collection is ordered first (for example,
> ``[1,2] < [1,2,3]`` is true)."*

**`howto/sorting.rst` §Sort Stability and Complex Sorts / DSU** —
<https://docs.python.org/3.14/howto/sorting.html>

> *"Sorts are guaranteed to be stable. That means that when multiple records have the same
> key, their original order is preserved."*

> *"The operator module functions allow multiple levels of sorting. For example, to sort by
> *grade* then by *age*: `sorted(student_tuples, key=itemgetter(1,2))`"*

> *"This wonderful property lets you build complex sorts in a series of sorting steps. For
> example, to sort the student data by descending *grade* and then ascending *age*, do the
> *age* sort first and then sort again using *grade*"*

> *"**This idiom works because tuples are compared lexicographically; the first items are
> compared; if they are the same then the second items are compared, and so on.**"*

> *"It is not strictly necessary in all cases to include the index *i* in the decorated list,
> but including it gives two benefits:
>  * The sort is stable -- if two items have the same key, their order will be preserved in
>    the sorted list.
>  * The original items do not have to be comparable because the ordering of the decorated
>    tuples will be determined by at most the first two items. So for example the original
>    list could contain complex numbers which cannot be sorted directly."*

---

## 11 · `namedtuple` / `typing.NamedTuple` / `@dataclass(frozen=True)`

**`glossary.rst` §named tuple** — <https://docs.python.org/3.14/glossary.html#term-named-tuple>

> *"The term "named tuple" applies to any type or class that inherits from tuple and whose
> indexable elements are also accessible using named attributes.  The type or class may have
> other features as well."*

> *"Several built-in types are named tuples, including the values returned by
> :func:`time.localtime` and :func:`os.stat`.  Another example is :data:`sys.float_info`"*

> *"Such a class can be written by hand, or it can be created by inheriting
> :class:`typing.NamedTuple`, or with the factory function :func:`collections.namedtuple`.
> The latter techniques also add some extra methods that may not be found in hand-written or
> built-in named tuples."*

**`library/collections.rst` §namedtuple** —
<https://docs.python.org/3.14/library/collections.html#collections.namedtuple>

> *"Named tuples assign meaning to each position in a tuple and allow for more readable,
> self-documenting code.  They can be used wherever regular tuples are used, and they add the
> ability to access fields by name instead of position index."*

> *"Returns a new tuple subclass named *typename*.  The new subclass is used to create
> tuple-like objects that have fields accessible by attribute lookup as well as being
> indexable and iterable."*

> *"**Named tuple instances do not have per-instance dictionaries, so they are lightweight
> and require no more memory than regular tuples.**"*

> *"*defaults* can be ``None`` or an :term:`iterable` of default values. Since fields with a
> default value must come after any fields without a default, the *defaults* are applied to
> the rightmost parameters."*

> *"To support pickling, the named tuple class should be assigned to a variable that matches
> *typename*."*

> *"`_make(iterable)` — Class method that makes a new instance from an existing sequence or
> iterable."*

> *"`_asdict()` — Return a new :class:`dict` which maps field names to their corresponding
> values"*

> *"`_replace(**kwargs)` — Return a new instance of the named tuple replacing specified
> fields with new values"* · *"Named tuples are also supported by generic function
> :func:`copy.replace`."* (3.13+) · *".. versionchanged:: 3.13 Raise :exc:`TypeError` instead
> of :exc:`ValueError` for invalid keyword arguments."*

> *"`_fields` — Tuple of strings listing the field names.  Useful for introspection and for
> creating new named tuple types from existing named tuples."*

> *"Subclassing is not useful for adding new, stored fields.  Instead, simply create a new
> named tuple type from the :attr:`~somenamedtuple._fields` attribute:
> `Point3D = namedtuple('Point3D', Point._fields + ('z',))`"*

> *"Any valid Python identifier may be used for a fieldname except for names starting with an
> underscore. … If *rename* is true, invalid fieldnames are automatically replaced with
> positional names."*

**CPython 3.14 `Lib/collections/__init__.py`** (namedtuple's generated class namespace, lines
~497–515) — verified, this is *what the factory builds*, not output:

```python
class_namespace = {
    '__doc__': f'{typename}({arg_list})',
    '__slots__': (),
    '_fields': field_names,
    '_field_defaults': field_defaults,
    '__new__': __new__,
    '_make': _make,
    '__replace__': _replace,
    '_replace': _replace,
    '__repr__': __repr__,
    '_asdict': _asdict,
    '__getnewargs__': __getnewargs__,
    '__match_args__': field_names,
}
result = type(typename, (tuple,), class_namespace)
```

→ `__match_args__` **is** the field names, so a namedtuple works in a `match` class pattern;
`__slots__ = ()` is why there is no per-instance `__dict__`; `type(typename, (tuple,), …)` is
why `isinstance(p, tuple)` is `True`.
<https://github.com/python/cpython/blob/3.14/Lib/collections/__init__.py>

**`library/typing.rst` §`NamedTuple`** —
<https://docs.python.org/3.14/library/typing.html#typing.NamedTuple>

> *"Typed version of :func:`collections.namedtuple`."*

> *"To give a field a default value, you can assign to it in the class body … Fields with a
> default value must come after any fields without a default."*

> *"The types for each field name can be retrieved by calling
> :func:`annotationlib.get_annotations` on the resulting class."* — 🔴 this is the **3.14**
> wording; PEP 649/749 (deferred annotations) landed in 3.14.

> *".. versionchanged:: 3.14 Using :func:`super` (and the ``__class__`` :term:`closure
> variable`) in methods of ``NamedTuple`` subclasses is unsupported and causes a
> :class:`TypeError`."*

> *".. deprecated-removed:: 3.13 3.15 The undocumented keyword argument syntax for creating
> NamedTuple classes (``NT = NamedTuple("NT", x=int)``) is deprecated, and will be disallowed
> in 3.15."*

**`library/dataclasses.rst`** — <https://docs.python.org/3.14/library/dataclasses.html>

> *"**It is not possible to create truly immutable Python objects.**  However, by passing
> ``frozen=True`` to the :deco:`dataclass` decorator you can emulate immutability.  In that
> case, dataclasses will add :meth:`~object.__setattr__` and :meth:`~object.__delattr__`
> methods to the class.  These methods will raise a :exc:`FrozenInstanceError` when invoked."*

> *"There is a tiny performance penalty when using ``frozen=True``: :meth:`~object.__init__`
> cannot use simple assignment to initialize fields, and must use
> :meth:`!object.__setattr__`."*

> *"If *eq* and *frozen* are both true, by default ``@dataclass`` will generate a
> :meth:`!__hash__` method for you.  If *eq* is true and *frozen* is false,
> :meth:`!__hash__` will be set to ``None``, marking it unhashable (which it is, since it is
> mutable).  If *eq* is false, :meth:`!__hash__` will be left untouched"*

> *"Having a :meth:`!__hash__` implies that instances of the class are immutable."*

> *"*frozen*: If true (the default is ``False``), assigning to fields will generate an
> exception.  This emulates read-only frozen instances."*

> *"`FrozenInstanceError` — Raised when an implicitly defined :meth:`~object.__setattr__` or
> :meth:`~object.__delattr__` is called on a dataclass which was defined with ``frozen=True``.
> It is a subclass of :exc:`AttributeError`."*

> *"*match_args*: … a :attr:`~object.__match_args__` tuple will be created from the list of
> parameters to the generated :meth:`~object.__init__` method"* ·
> *"Keyword-only fields are not included in :attr:`!__match_args__`."*

> *"*slots*: If true (the default is ``False``), :attr:`~object.__slots__` attribute will be
> generated"*

---

## 12 · Sequence patterns (`match`) — the tuple-shaped trap

**`reference/compound_stmts.rst` §Sequence Patterns** —
<https://docs.python.org/3.14/reference/compound_stmts.html#sequence-patterns>

> *"There is no difference if parentheses or square brackets are used for sequence patterns
> (i.e. ``(...)`` vs ``[...]`` )."*

> *"A single pattern enclosed in parentheses without a trailing comma (e.g. ``(3 | 4)``) is a
> :ref:`group pattern <group-patterns>`. While a single pattern enclosed in square brackets
> (e.g. ``[3 | 4]``) is still a sequence pattern."*

> *"If the subject value is not a sequence, the sequence pattern fails."* ·
> *"If the subject value is an instance of ``str``, ``bytes`` or ``bytearray`` the sequence
> pattern fails."*

> *"the star subpattern matches a list formed of the remaining subject items"*

---

## 13 · Odds and ends that earned a line on a page

- `enumerate` — *"returns a tuple containing a count (from *start* which defaults to 0) and
  the values obtained from iterating over *iterable*"* —
  <https://docs.python.org/3.14/library/functions.html#enumerate>
- `zip` — *"`zip()` returns an iterator of tuples, where the *i*-th tuple contains the *i*-th
  element from each of the argument iterables."* —
  <https://docs.python.org/3.14/library/functions.html#zip>
- `divmod` — *"return a pair of numbers consisting of their quotient and remainder"* —
  <https://docs.python.org/3.14/library/functions.html#divmod>
- `str.partition` — *"return a 3-tuple containing the part before the separator, the
  separator itself, and the part after the separator"* —
  <https://docs.python.org/3.14/library/stdtypes.html#str.partition>
- `dict.items()` — *"Return a new view of the dictionary's items (``(key, value)`` pairs)."* —
  <https://docs.python.org/3.14/library/stdtypes.html#dict.items>
- `glossary` §sequence — *"An :term:`iterable` which supports efficient element access using
  integer indices via the :meth:`~object.__getitem__` special method"* —
  <https://docs.python.org/3.14/glossary.html#term-sequence>

---

## 14 · What the sources would NOT settle

Write these as uncertain, or leave them out. **Never assert them.**

1. **Tuple interning / free-lists / constant folding.** The reference explicitly says two
   occurrences of the empty tuple *"may or may not yield the same object"* and that for
   immutable types *"operations that compute new values may actually return a reference to
   any existing object with the same type and value"*. There is **no documented guarantee**
   that `(1, 2) is (1, 2)`, that a tuple literal is folded to a constant, or that CPython
   keeps a tuple free-list. State it as an unspecified implementation detail.
2. **Whether `tuple` is faster than `list`.** No doc claim, and measuring is banned. The only
   citable memory statement is `namedtuple`'s *"require no more memory than regular tuples"*
   — that is a comparison of namedtuple to tuple, **not** of tuple to list. Do not extend it.
3. **Whether `t[:]` returns `t` itself.** Not documented for tuples; only `tuple(iterable)`
   has the documented *"If *iterable* is already a tuple, it is returned unchanged"*
   guarantee. Cite `tuple(t)`, not the slice.
4. **CPython 3.14 changed nothing about `tuple` itself.** A grep of
   `Doc/whatsnew/3.14.rst` for "tuple" returns only C-API and `PyArg_ParseTuple` items — no
   language-level tuple change. The one 3.14 change touching this topic is
   `typing.NamedTuple` + `super()` → `TypeError`, and PEP 649/749 changing how a
   `NamedTuple`'s annotations are read (`annotationlib.get_annotations`).

---

## 15 · Comma-separated subscripts — `d[tenant, day]` builds a tuple

**`reference/expressions.rst` §Comma-separated subscripts** —
<https://docs.python.org/3.14/reference/expressions.html#comma-separated-subscripts>

> *"The subscript can also be given as two or more comma-separated expressions or slices …
> This form is commonly used with numerical libraries for slicing multi-dimensional data.
> **In this case, the interpreter constructs a `tuple` of the results of the expressions or
> slices, and passes this tuple to the `__getitem__` or `__class_getitem__` special
> method**, as above."*

> *"The subscript may also be given as a single expression or slice followed by a comma, to
> specify a one-element tuple"* — i.e. `demo['spam',]` passes `('spam',)`.

Formal grammar (3.14):

```
subscription:     primary '[' subscript ']'
subscript:        single_subscript | tuple_subscript
single_subscript: proper_slice | assignment_expression
proper_slice:     [expression] ":" [expression] [ ":" [expression] ]
tuple_subscript:  ','.(single_subscript | starred_expression)+ [',']
```

Starred subscripts (`demo[*range(10)]`) added in 3.11 by PEP 646.

**`PYTHONHASHSEED`** — `using/cmdline.rst` —
<https://docs.python.org/3.14/using/cmdline.html#envvar-PYTHONHASHSEED>

> *"If `PYTHONHASHSEED` is set to an integer value, it is used as a fixed seed for
> generating the hash() of the types covered by the hash randomization."*
> *"Its purpose is to allow repeatable hashing, such as for selftests for the interpreter
> itself, or to allow a cluster of python processes to share hash values."*
> *"The integer must be a decimal number in the range [0,4294967295].  Specifying the value
> 0 will disable hash randomization."*

⚠️ Correction to a common assumption: sharing hashes across a cluster via a fixed seed **is
a documented purpose**. It is `PYTHONHASHSEED=0` that disables randomisation. Nothing
documents the hash *algorithm* as stable across Python versions.

**`bool` is a subtype of `int`** — `reference/datamodel.rst` §Booleans:

> *"These represent the truth values False and True.  The two objects representing the
> values `False` and `True` are the only Boolean objects. The Boolean type is a subtype of
> the integer type, and Boolean values behave like the values 0 and 1, respectively, in
> almost all contexts"*

Also `library/functions.rst` §`bool`: *"The `bool` class is a subclass of `int` … It cannot
be subclassed further."*

---

## 16 · Appended 2026-09-10 (resume session) — gap fetches for chunks 07–10

All read from the CPython **3.14** branch sources (`raw.githubusercontent.com/python/cpython/3.14/…`)
or peps.python.org. Cite the docs.python.org URL on the page.

**`library/dataclasses.rst` — *eq* / *order*** —
<https://docs.python.org/3.14/library/dataclasses.html#dataclasses.dataclass>

> *"This method compares the class by comparing each field in order. Both instances in the
> comparison must be of the identical type."* (eq)

> *".. versionchanged:: 3.13 The generated ``__eq__`` method now compares each field
> individually (for example, ``self.a == other.a and self.b == other.b``), rather than
> comparing tuples of fields as in previous versions. This change makes the comparison faster
> but it may alter results in cases where attributes compare equal by identity but not by
> value (such as ``float('nan')``)."*

> *"*order*: If true (the default is ``False``), `__lt__`, `__le__`, `__gt__`, and `__ge__`
> methods will be generated.  These compare the class as if it were a tuple of its fields, in
> order.  Both instances in the comparison must be of the identical type.  If *order* is true
> and *eq* is false, a `ValueError` is raised."*

> *"*match_args*: If true (the default is ``True``), the `__match_args__` tuple will be
> created from the list of non keyword-only parameters to the generated `__init__` method"*

> *"*kw_only*: If true (the default value is ``False``), then all fields will be marked as
> keyword-only."*

**`dataclasses.astuple`** — <https://docs.python.org/3.14/library/dataclasses.html#dataclasses.astuple>

> *"Converts the dataclass *obj* to a tuple (by using the factory function *tuple_factory*).
> Each dataclass is converted to a tuple of its field values.  dataclasses, dicts, lists, and
> tuples are recursed into. Other objects are copied with `copy.deepcopy`."*
> *"To create a shallow copy, the following workaround may be used::
> `tuple(getattr(obj, field.name) for field in dataclasses.fields(obj))`"*

**`dataclasses.replace`** — *"Creates a new object of the same type as *obj*, replacing fields
with values from *changes*."* · *"The newly returned object is created by calling the
`__init__` method of the dataclass.  This ensures that `__post_init__`, if present, is also
called."*

**`__post_init__`** — *"Among other uses, this allows for initializing field values that
depend on one or more other fields."*

**`copy.replace`** (3.13) — <https://docs.python.org/3.14/library/copy.html#copy.replace> —
*"Creates a new object of the same type as *obj*, replacing fields with values from *changes*."*

**PEP 557 — "Why not just use namedtuple?"** — <https://peps.python.org/pep-0557/#why-not-just-use-namedtuple>

> *"Any namedtuple can be accidentally compared to any other with the same number of fields.
> For example: `Point3D(2017, 6, 2) == Date(2017, 6, 2)`.  With Data Classes, this would return
> False."*
> *"A namedtuple can be accidentally compared to a tuple.  For example, `Point2D(1, 10) == (1,
> 10)`.  With Data Classes, this would return False."*
> *"Instances are always iterable, which can make it difficult to add fields.  If a library
> defines: `Time = namedtuple('Time', ['hour', 'minute'])` … Then if a user uses this code as:
> `hour, minute = get_time()` then it would not be possible to add a second field to Time
> without breaking the user's code."* (sic — "second" in the PEP; it means a further field)
> *"No option for mutable instances. / Cannot specify default values. / Cannot control which
> fields are used for `__init__`, `__repr__`, etc. / Cannot support combining fields by
> inheritance."* — ⚠️ "cannot specify default values" is **stale**: `namedtuple(defaults=)`
> arrived in 3.7 and `typing.NamedTuple` defaults in 3.6.1.

> **"Why not just use typing.NamedTuple?"** — *"This produces a namedtuple, so it shares
> namedtuples benefits and some of its downsides.  Data Classes, unlike typing.NamedTuple,
> support combining fields via inheritance."*
> Abstract: *"Data Classes can be thought of as "mutable namedtuples with defaults"."*

**CPython 3.14 `Objects/tupleobject.c` `tuple_richcompare`** —
`if (!PyTuple_Check(v) || !PyTuple_Check(w)) Py_RETURN_NOTIMPLEMENTED;` — `PyTuple_Check`
accepts subclasses, so a namedtuple compares item-by-item with a plain tuple and with any
other namedtuple. Followed by *"Search for the first index where items are different"* then
`PyObject_RichCompare(vt->ob_item[i], wt->ob_item[i], op)` on the first differing item.
<https://github.com/python/cpython/blob/3.14/Objects/tupleobject.c>

**Same file, `tuple_hash`** — 3.14 source reads and stores `v->ob_hash`
(`FT_ATOMIC_LOAD_SSIZE_RELAXED(v->ob_hash)` … `FT_ATOMIC_STORE_SSIZE_RELAXED(v->ob_hash, acc)`)
i.e. **CPython 3.14 caches a tuple's hash on the object**. Comment: *"This is a slightly
simplified version of the xxHash non-cryptographic hash"*. NOT documented in the language
docs or whatsnew grep → implementation detail; state it as such.

**Same file, `tuple.__new__` docstring** — *"If the argument is a tuple, the return value is
the same object."* (C docstring; matches stdtypes.)

**`library/typing.rst` §Annotating tuples** (full examples) —
<https://docs.python.org/3.14/library/typing.html#annotating-tuples>
`x: tuple[int] = (5,)` · `y: tuple[int, str] = (5, "foo")` · *"Error: the type annotation
indicates a tuple of length 1, but ``z`` has been assigned to a tuple of length 3"* ·
`x: tuple[int, ...] = (1, 2)` *"These reassignments are OK: ``tuple[int, ...]`` indicates x
can be of any length"* · *"``y`` can only ever be assigned to an empty tuple"* ·
*"plain ``tuple`` is equivalent to ``tuple[Any, ...]``"*.
`list` side: *"Type checker error: ``list`` only accepts a single type argument"*.

**`library/typing.rst` §NamedTuple** — <https://docs.python.org/3.14/library/typing.html#typing.NamedTuple>
*"This is equivalent to:: `Employee = collections.namedtuple('Employee', ['name', 'id'])`"* ·
*"``NamedTuple`` subclasses can also have docstrings and methods"* · *"``NamedTuple``
subclasses can be generic:: `class Group[T](NamedTuple):`"* · *"A functional syntax is also
supported `Employee = NamedTuple('Employee', [('name', str), ('id', int)])`"* ·
*"versionchanged 3.9 ``NamedTuple`` is now a function rather than a class. It can still be
used as a class base"* · *"versionchanged 3.11 Added support for generic namedtuples."* ·
deprecated-removed 3.13→3.15: `NT = NamedTuple("NT")` / `NamedTuple("NT", None)`; *"To create
a NamedTuple class with 0 fields, use ``class NT(NamedTuple): pass`` or
``NT = NamedTuple("NT", [])``."*

**CPython 3.14 `Lib/typing.py` `NamedTupleMeta`** (source, error strings):
- `_prohibited = frozenset({'__new__', '__init__', '__slots__', '__getnewargs__', '_fields',
  '_field_defaults', '_make', '_replace', '_asdict', '_source'})` →
  `AttributeError("Cannot overwrite NamedTuple attribute " + key)`
- `TypeError("uses of super() and __class__ are unsupported in methods of NamedTuple subclasses")`
- `TypeError('can only inherit from a NamedTuple type and Generic')`
- `TypeError(f"Non-default namedtuple field {field_name} cannot follow default field…")`
<https://github.com/python/cpython/blob/3.14/Lib/typing.py>

**CPython 3.14 `Lib/collections/__init__.py` namedtuple** validation strings:
`'Field names cannot start with an underscore: '` · `'Encountered duplicate field name: '` ·
`'Type names and field names cannot be a keyword: '` · `'Got more default values than field
names'` · `_make`: `TypeError(f'Expected {num_fields} arguments, got {len(result)}')` ·
`_replace`: `TypeError(f'Got unexpected field names: {list(kwds)!r}')`.

**`library/collections.rst` namedtuple extras** —
*"The *field_names* are a sequence of strings such as ``['x', 'y']``.  Alternatively,
*field_names* can be a single string with each fieldname separated by whitespace and/or
commas"* · *"If *rename* is true, invalid fieldnames are automatically replaced with
positional names.  For example, ``['abc', 'def', 'ghi', 'abc']`` is converted to
``['abc', '_1', 'ghi', '_3']``"* · *"Named tuples are especially useful for assigning field
names to result tuples returned by the :mod:`csv` or :mod:`sqlite3` modules"* · *"In addition
to the methods inherited from tuples, named tuples support three additional methods and two
attributes.  To prevent conflicts with field names, the method and attribute names start with
an underscore."* · *"To retrieve a field whose name is stored in a string, use the getattr
function"* · *"To convert a dictionary to a named tuple, use the double-star-operator"* ·
*"The subclass shown above sets ``__slots__`` to an empty tuple.  This helps keep memory
requirements low by preventing the creation of instance dictionaries."* ·
`_asdict` versionchanged 3.8: *"Returns a regular dict instead of an OrderedDict."*
See-also: *"See :meth:`types.SimpleNamespace` for a mutable namespace based on an underlying
dictionary instead of a tuple."*

**`reference/expressions.rst` §Membership test operations** —
<https://docs.python.org/3.14/reference/expressions.html#membership-test-operations>
> *"For container types such as list, tuple, set, frozenset, dict, or collections.deque, the
> expression ``x in y`` is equivalent to ``any(x is e or x == e for e in y)``."*

**`library/functions.rst` §sum** — <https://docs.python.org/3.14/library/functions.html#sum>
> *"Sums *start* and the items of an *iterable* from left to right and returns the total.
> The *iterable*'s items are normally numbers, and the start value is not allowed to be a
> string."* · *"To concatenate a series of iterables, consider using `itertools.chain`."*

**`library/heapq.rst` §Priority Queue Implementation Notes** —
<https://docs.python.org/3.14/library/heapq.html#priority-queue-implementation-notes>
> *"Tuple comparison breaks for (priority, task) pairs if the priorities are equal and the
> tasks do not have a default comparison order."*
> *"A solution to the first two challenges is to store entries as 3-element list including
> the priority, an entry count, and the task.  The entry count serves as a tie-breaker so that
> two tasks with the same priority are returned in the order they were added. And since no two
> entry counts are the same, the tuple comparison will never attempt to directly compare two
> tasks."*
> *"Another solution to the problem of non-comparable tasks is to create a wrapper class that
> ignores the task item and only compares the priority field"* → `@dataclass(order=True)` with
> `item: Any=field(compare=False)`.
> Note the entries are **lists** (`entry = [priority, count, task]`) because the recipe later
> mutates `entry[-1] = REMOVED`.

**`library/json.rst` conversion tables** — <https://docs.python.org/3.14/library/json.html#py-to-json-table>
Python→JSON: `list, tuple` → `array`. JSON→Python: `array` → `list`. (So a tuple does not
survive a round trip.)

**`library/stdtypes.rst` §Generic Alias Type** — <https://docs.python.org/3.14/library/stdtypes.html#types-genericalias>
> *"The builtin functions `isinstance` and `issubclass` do not accept ``GenericAlias`` types
> for their second argument"* → doc-printed `TypeError: isinstance() argument 2 cannot be a
> parameterized generic`.
> *"The Python runtime does not enforce type annotations. This extends to generic types and
> their type parameters. When creating a container object from a ``GenericAlias``, the elements
> in the container are not checked against their type."*

**`library/operator.rst` §itemgetter** — *"If multiple items are specified, returns a tuple of
lookup values."* · *"After ``g = itemgetter(2, 5, 3)``, the call ``g(r)`` returns
``(r[2], r[5], r[3])``."*

**`howto/sorting.rst` §Strategies For Unorderable Types and Values** —
> *"This is needed because most cross-type comparisons raise a `TypeError`."* ·
> *"This is needed because ``None`` is not comparable to other types."* ·
> *"The *reverse* parameter still maintains sort stability (so that records with equal keys
> retain the original order)."*

**Error strings, CPython 3.14 source:**
- `Python/ceval.c` line ~2406: `"cannot unpack non-iterable %.200s object"` →
  `TypeError: cannot unpack non-iterable NoneType object`.
- `Objects/object.c` line ~1084: `"'%s' not supported between instances of '%.100s' and
  '%.100s'"` → `TypeError: '<' not supported between instances of 'NoneType' and 'int'`.

**PEP 448 — more verbatim** — <https://peps.python.org/pep-0448/>
> *"In dictionaries, later values will always override earlier ones"* ·
> *"The keys in a dictionary remain in a right-to-left priority order, so
> `{**{'a': 1}, 'a': 2, **{'a': 3}}` evaluates to `{'a': 3}`."*
> *"Currently, if an argument is given multiple times — such as a positional argument given
> both positionally and by keyword — a TypeError is raised.  This remains true for duplicate
> arguments provided through multiple ** unpackings, e.g. `f(**{'x': 2}, **{'x': 3})`, except
> that the error will be detected at runtime."*
> *"Concerns have been raised about the unexpected difference between duplicate keys in
> dictionaries being allowed but duplicate keys in function call syntax raising an error."*
> Rationale: *"there is a symmetry of assignment, where `fst, *other, lst = elems` and
> `elems = fst, *other, lst` are approximate inverses, ignoring the specifics of types."*

**`reference/expressions.rst` §Expression lists** — *"An asterisk ``*`` denotes iterable
unpacking.  Its operand must be an iterable.  The iterable is expanded into a sequence of
items, which are included in the new tuple, list, or set, at the site of the unpacking."*

**`library/collections.rst` §deque** — *"Bounded length deques provide functionality similar to
the ``tail`` filter in Unix."* <https://docs.python.org/3.14/library/collections.html#collections.deque>

**Typing specification — Tuples** — <https://typing.python.org/en/latest/spec/tuples.html>
(read from `python/typing` main, `docs/spec/tuples.rst`)
> *"The most obvious difference is that ``tuple`` is variadic -- it supports an arbitrary
> number of type arguments. At runtime, the sequence of objects contained within the tuple is
> fixed at the time of construction."*
> *"Arbitrary-length homogeneous tuples can be expressed using one type and an ellipsis, for
> example ``tuple[int, ...]``. This type is equivalent to a union of tuples containing zero or
> more ``int`` elements (``tuple[()] | tuple[int] | tuple[int, int] | …``)."*
> *"The type ``tuple`` (with no type arguments provided) is equivalent to ``tuple[Any, ...]``."*
> *"Arbitrary-length tuples have exactly two type arguments -- the type and an ellipsis. Any
> other tuple form that uses an ellipsis is invalid"* — `tuple[int, int, ...]  # Invalid`.
> *"``tuple[int, *tuple[str, ...], str]`` -- a tuple type where the first element is guaranteed
> to be of type ``int``, the last element is guaranteed to be of type ``str``, and the elements
> in the middle are zero or more elements of type ``str``."* · *"The ``*`` syntax requires
> Python 3.11 or newer."* · *"Only one unbounded tuple can be used within another tuple"*
> *"Because tuple contents are immutable, the element types of a tuple are covariant. For
> example, ``tuple[bool, int]`` is a subtype of ``tuple[int, object]``."*
> *"``tuple[int, ...]`` is not a subtype of ``tuple[int]``."*
> *"The length of a tuple at runtime is immutable, so it is safe for type checkers to use length
> checks to narrow the type of a tuple"*
> *"The ``tuple`` class derives from ``Sequence[T_co]`` … ``tuple[int, *tuple[str, ...]]`` is a
> subtype of ``Sequence[int | str]``"*

**Typing specification — Named tuples §Assignability** — <https://typing.python.org/en/latest/spec/namedtuples.html>
> *"A named tuple is assignable to a ``tuple`` with a known length and parameterized by types
> corresponding to the named tuple's individual field types"* — `v1: tuple[int, int, str] = p  # OK`,
> `v3: tuple[int, int] = p  # Type error (too few elements)`.

**`glossary.rst` §sequence** — *"Some built-in sequence types are list, str, tuple, and
bytes."* <https://docs.python.org/3.14/glossary.html#term-sequence>

**`library/stdtypes.rst` §Truth Value Testing** — *"Here are most of the built-in objects
considered false: … empty sequences and collections: `''`, `()`, `[]`, `{}`, `set()`,
`range(0)`"* <https://docs.python.org/3.14/library/stdtypes.html#truth-value-testing>

**CPython 3.14 `Lib/dataclasses.py` generated `__eq__`** (line ~1172) — body is
`if self is other: return True` / `if other.__class__ is self.__class__: return self.a==other.a and …`
/ `return NotImplemented`. Ordering methods still compare `_tuple_str('self', flds)` tuples.
So a NaN-holding instance equals *itself* but not a copy (3.13+).

**`dataclasses.rst` versionchanged 3.11** — *"Instead of looking for and disallowing objects of
type list, dict, or set, unhashable objects are now not allowed as default values.
Unhashability is used to approximate mutability."*

**CPython 3.14 `Lib/collections/__init__.py`** — `_make` = `tuple_new(cls, iterable)` with
`tuple_new = tuple.__new__`; `_replace` = `self._make(_map(kwds.pop, field_names, self))`
→ neither calls a subclass's `__new__`. Fields are `class_namespace[name] = _tuplegetter(index,
doc)`. `rename=True` replaces names that are not identifiers, are keywords, start with `_`, or
are duplicates with `f'_{index}'`. `__getnewargs__` returns `_tuple(self)` ("Used by copy and
pickle").

**`howto/sorting.rst` DSU tail** — *"Now that Python sorting provides key-functions, this
technique is not often needed."* · **`stdtypes.rst` `list.sort`** — *"The key corresponding to
each item in the list is calculated once and then used for the entire sorting process."*
**`operator.rst` attrgetter** — *"If more than one attribute is requested, returns a tuple of
attributes."* <https://docs.python.org/3.14/library/operator.html#operator.attrgetter>

**NEW 3.14 doc page — `library/time-complexity.rst` "Time complexity of operations on built-in
types"** — <https://docs.python.org/3.14/library/time-complexity.html> (linked from stdtypes
§Common Sequence Operations: *"See Time complexity of operations on built-in types for the costs
of the various sequence operations."*)
> *"This page documents the time complexity of various operations on built-in types in CPython.
> Other Python implementations may have different performance characteristics. Additionally,
> the listed costs assume exact built-in types, as instances of subclasses may have different
> costs."*
> §tuple: *"A tuple is an immutable sequence. Because a tuple can never change, there are no
> insertion or deletion costs, and making a copy simply returns the same object, so is constant
> time (O(1))."*
> Table: Copy `tuple(t)` O(1) · Get item `t[k]` O(1) · Get slice `t[i:j]` O(j - i) ·
> Concatenate `t1 + t2` O(len(t1) + len(t2)) · Multiply `t * k` O(nk) · Iteration O(n) ·
> `x in t` O(n) · `min(t)`, `max(t)` O(n) · Get length `len(t)` O(1) [5].
> [5] *"The number of elements is stored in the object, so len() does not need to count them."*
> (count/index are NOT in the tuple table.) [11] (for str search methods) *"With start and end
> arguments, n is the length of the region searched rather than of s, and unlike slicing nothing
> is copied."* dict section: *"They also assume that hashing and comparing a key is O(1)."*
> 🔴 This corrects bank §14 item 2 partially: complexity IS now documented for CPython; tuple-vs-
> list constant factors / memory still are not.
**CPython 3.14 `Objects/tupleobject.c` line ~619** — `"tuple.index(x): x not in tuple"` (ValueError).
