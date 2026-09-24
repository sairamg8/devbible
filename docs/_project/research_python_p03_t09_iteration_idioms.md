---
name: research-python-p03-t09-iteration-idioms
description: Banked primary sources for Python phase 3 topic 09 (iteration idioms — enumerate, zip and zip(strict=True), zip(*rows), reversed, any/all, min/max with key/default, sum, next(it, default), iter(callable, sentinel), for/else, unpacking in for headers, iterating dicts, mutation during iteration, ruff rules) — verbatim doc quotes with URLs, CPython v3.14.7 source facts with file:line, ruff 0.16.6 rule docstrings, the phase-1 overlap map, and a could-not-settle list. DO NOT RE-DERIVE.
metadata:
  type: reference
---

# research — python phase 3, topic 09 · Iteration idioms

🔴 **DO NOT RE-DERIVE.** Banked 2026-09-21 in one pass. Write every chunk from this file.

**How it was read.** Every CPython file below was fetched from the **`v3.14.7` tag**
(`https://raw.githubusercontent.com/python/cpython/v3.14.7/<path>`) on 2026-09-21, so line numbers are
v3.14.7 line numbers. Doc text is the `.rst` source at that tag with the RST roles flattened
(`:func:`zip`` → `zip()`); the rendered pages are <https://docs.python.org/3.14/library/functions.html>
etc. PEP 618 and PEP 479 from `python/peps` main. Ruff rule text from the **`0.16.6`** tag
(`crates/ruff_linter/src/rules/...`, the pin in `src/data/pins.js`). **No sandbox run anywhere.**

Files: `Doc/library/functions.rst` · `Doc/library/stdtypes.rst` · `Doc/library/itertools.rst` ·
`Doc/library/exceptions.rst` · `Doc/library/math.rst` · `Doc/library/decimal.rst` ·
`Doc/library/queue.rst` · `Doc/library/csv.rst` · `Doc/library/io.rst` · `Doc/library/collections.abc.rst` ·
`Doc/reference/compound_stmts.rst` · `Doc/reference/simple_stmts.rst` · `Doc/reference/expressions.rst` ·
`Doc/reference/datamodel.rst` · `Doc/tutorial/controlflow.rst` · `Doc/glossary.rst` · `Doc/howto/sorting.rst` ·
`Doc/c-api/sequence.rst` · `Doc/whatsnew/3.10.rst` `3.12.rst` `3.14.rst` · `Python/bltinmodule.c` ·
`Objects/enumobject.c` · `Objects/listobject.c` · `Objects/rangeobject.c` · `Objects/iterobject.c` ·
`Objects/abstract.c` · `Objects/object.c` · `Python/ceval.c` · `Modules/_io/textio.c` · `Modules/_io/iobase.c` ·
`Modules/_datetimemodule.c`.

---

## 0 · The overlap map — READ FIRST, this topic sits on top of phase 1

Phase 1 already teaches the *usage* of most of this at Understand depth. **Link it, never restate it.**
This topic adds: CPython mechanism, the exact error strings, what each builtin *consumes*, the compositions
that fail, and the fixes in code.

| Subject | Phase 1 file (linkable) | What it already covers — do NOT repeat |
|---|---|---|
| for statement, loop var outlives loop, `range`, two-arg `iter` (short), `range(len())` table | `../../phase-1-language-core/08-control-flow/01-the-for-statement.md` | 8 gotchas: NameError after loop, last item after break, reassign loop var, `x in range`, re-called iterable expr, step 0, set order, `for obj.attr` |
| `enumerate`, `zip`, `strict`, `zip_longest` | `../../phase-1-language-core/08-control-flow/02-enumerate-and-zip.md` | start=1, filtered-then-enumerate numbering, `(i, (a, b))` parens, strict raises *during* loop, sentinel fill, infinite zip_longest, `zip(gen, gen)`, one item lost from an earlier iterable (mentioned in one gotcha, no ordering rule, no fix), enumerate(dict) |
| zip idioms, pairwise, islice, batched | `.../08-control-flow/02b-zip-idioms-and-neighbours.md` | transpose drops columns, `zip(*rows)` memory, `dict(zip(headers,row))` last field, `zip(xs, xs[1:])` on iterators, pairwise, islice, batched, `while chunk := tuple(islice(...))` |
| for/else, while/else | `.../08-control-flow/03-for-else-and-while-else.md` | 9 gotchas (empty iterable runs else, continue on last, try/finally, retry loop), 8 Qs |
| nested loops, labelled break | `.../08-control-flow/03b-nested-loops.md` | function+return, flatten, else/continue/break |
| break/continue, mutation while iterating | `.../08-control-flow/04-break-continue-and-mutation.md` | list skips, dict RuntimeError, append infinite, remove-by-value, rebinding filter |
| any/all | `../../phase-1-language-core/05-truthiness/04-any-and-all.md`, `04b-any-all-in-practice.md` | vacuous truth, gen vs list, side effects, dict keys, count matches, first element with `next`, `next(x for x in xs, None)` SyntaxError, StopIteration→RuntimeError in generators, `not any` vs `all(not)`, exactly-one |
| min/max with key, ties, default | `../../phase-1-language-core/06-comparisons/08c-min-max-heapq-bisect-groupby.md` | key shared with heapq/bisect, empty ValueError → `default=`, first-of-ties, last-maximal |
| unpacking | `../../phase-1-language-core/13-unpacking/01-tuple-assignment.md`, `02-starred-unpacking.md`, `03-star-args-and-literals.md` | RHS finished first, any iterable, left-to-right targets, consumes an iterator, `a, b = some_dict` binds keys, starred targets in for loops |
| generator expressions | `../../phase-1-language-core/09-comprehensions/05-generator-expressions.md`, `05b-eager-leftmost-and-lazy-rest.md`, `05c-one-shot-exhaustion.md` | leftmost iterable eager, one-shot exhaustion |
| NaN | `../../phase-1-language-core/06-comparisons/06-nan-and-the-protocol.md`, `.../02-numbers/06-nan-inf-and-signed-zero.md` | NaN comparisons |
| `sum`/float accuracy | `../../phase-1-language-core/02-numbers/05d-accurate-float-arithmetic.md`, `14f-aggregation-and-the-rest.md` | check before claiming; `math.fsum` |
| late-binding closure over a loop variable | `../../phase-2-functions/03-scope-and-closures/03-closures-and-the-late-binding-trap.md` | link only |
| Phase 3 siblings (link): `../01-list-internals/11-mutating-while-iterating.md`, `11b-safe-ways-to-mutate.md`, `05b-searching-identity-and-reversing.md`; `../03-dict/05-the-three-views.md`, `05b-mutating-while-iterating.md`, `05c-the-mutations-you-did-not-write.md`, `02b-working-with-the-order.md` (has *When `next(iter(d))` is not O(1)*); `../04-set-and-frozenset/03h-removal-and-mutation-during-iteration.md`, `../04-set-and-frozenset/03-set-algebra-instead-of-nested-loops.md`; `../05-slicing/02b-strides-and-reversal.md`, `../05-slicing/07-islice-and-iterators.md`; `../07-heapq-and-bisect/` (nlargest/nsmallest); `../02-tuple/06-packing-and-unpacking.md`. | | |

Not yet written (bold text + *(not written yet)* only): the iterator protocol, generators and `itertools` in
depth (phase 5) · sorting compound data / `operator.itemgetter` (topic 10) · phase 7 ruff (`../../phase-7-...`
is NOT in the linkable set for this run).

---

## 1 · `Doc/library/functions.rst` v3.14.7 — verbatim (rendered text)

URL: <https://docs.python.org/3.14/library/functions.html>

**enumerate** (L556–575) `enumerate(iterable, start=0)`:
> *"Return an enumerate object. *iterable* must be a sequence, an iterator, or some other object which supports iteration. The `__next__()` method of the iterator returned by `enumerate()` returns a tuple containing a count (from *start* which defaults to 0) and the values obtained from iterating over *iterable*."*

Equivalent to:
```python
def enumerate(iterable, start=0):
    n = start
    for elem in iterable:
        yield n, elem
        n += 1
```

**zip** (L2147–2237) `zip(*iterables, strict=False)`:
> *"Iterate over several iterables in parallel, producing tuples with an item from each one."*
> *"More formally: `zip()` returns an iterator of tuples, where the *i*-th tuple contains the *i*-th element from each of the argument iterables."*
> *"Another way to think of `zip()` is that it turns rows into columns, and columns into rows. This is similar to transposing a matrix."*
> *"`zip()` is lazy: The elements won't be processed until the iterable is iterated on, e.g. by a `for` loop or by wrapping in a `list`."*
> *"One thing to consider is that the iterables passed to `zip()` could have different lengths; sometimes by design, and sometimes because of a bug in the code that prepared these iterables. Python offers three different approaches to dealing with this issue:"*
> *"By default, `zip()` stops when the shortest iterable is exhausted. It will ignore the remaining items in the longer iterables, cutting off the result to the length of the shortest iterable:"* (`list(zip(range(3), ['fee', 'fi', 'fo', 'fum']))` → `[(0, 'fee'), (1, 'fi'), (2, 'fo')]`)
> *"`zip()` is often used in cases where the iterables are assumed to be of equal length. In such cases, it's recommended to use the `strict=True` option. Its output is the same as regular `zip()`:"*
> *"Unlike the default behavior, it raises a `ValueError` if one iterable is exhausted before the others:"* — the doc's own trace ends `ValueError: zip() argument 2 is longer than argument 1`
> *"Without the `strict=True` argument, any bug that results in iterables of different lengths will be silenced, possibly manifesting as a hard-to-find bug in another part of the program."*
> *"Shorter iterables can be padded with a constant value to make all the iterables have the same length. This is done by `itertools.zip_longest()`."*
> *"Edge cases: With a single iterable argument, `zip()` returns an iterator of 1-tuples. With no arguments, it returns an empty iterator."*
> *"The left-to-right evaluation order of the iterables is guaranteed. This makes possible an idiom for clustering a data series into n-length groups using `zip(*[iter(s)]*n, strict=True)`. This repeats the *same* iterator `n` times so that each output tuple has the result of `n` calls to the iterator. This has the effect of dividing the input into n-length chunks."*
> *"`zip()` in conjunction with the `*` operator can be used to unzip a list:"* → `x2, y2 = zip(*zip(x, y))`; `x == list(x2) and y == list(y2)` → `True`.
> *"Changed in version 3.10: Added the `strict` argument."*

**map** (L1213) — `map(function, iterable, /, *iterables, strict=False)`:
> *"With multiple iterables, the iterator stops when the shortest iterable is exhausted. If *strict* is `True` and one of the iterables is exhausted before the others, a `ValueError` is raised."* / *"Changed in version 3.14: Added the *strict* parameter."*
whatsnew 3.14 L863: *"The `map()` function now has an optional keyword-only *strict* flag like `zip()` to check that all the iterables are of equal length."*

**reversed** (L1775) `reversed(object, /)`:
> *"Return a reverse iterator. The argument must be an object which has a `__reversed__()` method or supports the sequence protocol (the `__len__()` method and the `__getitem__()` method with integer arguments starting at `0`)."*

**all** (L74) / **any** (L102):
> *"Return `True` if all elements of the *iterable* are true (or if the iterable is empty)."* — equivalent `for element in iterable: if not element: return False` / `return True`.
> *"Return `True` if any element of the *iterable* is true. If the iterable is empty, return `False`."* — equivalent `if element: return True` / `return False`.

**min / max** (L1228 / L1266) — `max(iterable, /, *, key=None)` · `max(iterable, /, *, default, key=None)` · `max(arg1, arg2, /, *args, key=None)`:
> *"If one positional argument is provided, it should be an iterable. The largest item in the iterable is returned. If two or more positional arguments are provided, the largest of the positional arguments is returned."*
> *"There are two optional keyword-only arguments. The *key* argument specifies a one-argument ordering function like that used for `list.sort()`. The *default* argument specifies an object to return if the provided iterable is empty. If the iterable is empty and *default* is not provided, a `ValueError` is raised."*
> *"If multiple items are maximal, the function returns the first one encountered. This is consistent with other sort-stability preserving tools such as `sorted(iterable, key=keyfunc, reverse=True)[0]` and `heapq.nlargest(1, iterable, key=keyfunc)`."* (min: `sorted(iterable, key=keyfunc)[0]` and `heapq.nsmallest(1, iterable, key=keyfunc)`)
> *"Changed in version 3.4: Added the *default* keyword-only parameter."* / *"Changed in version 3.8: The *key* can be `None`."*

**next** (L1296): > *"Retrieve the next item from the iterator by calling its `__next__()` method. If *default* is given, it is returned if the iterator is exhausted, otherwise `StopIteration` is raised."*

**iter** (L1111) `iter(iterable, /)` / `iter(callable, sentinel, /)`:
> *"Return an iterator object. The first argument is interpreted very differently depending on the presence of the second argument. Without a second argument, the single argument must be a collection object which supports the iterable protocol (the `__iter__()` method), or it must support the sequence protocol (the `__getitem__()` method with integer arguments starting at `0`). If it does not support either of those protocols, `TypeError` is raised. If the second argument, *sentinel*, is given, then the first argument must be a callable object. The iterator created in this case will call *callable* with no arguments for each call to its `__next__()` method; if the value returned is equal to *sentinel*, `StopIteration` will be raised, otherwise the value will be returned."*
> *"One useful application of the second form of `iter()` is to build a block-reader. For example, reading fixed-width blocks from a binary database file until the end of file is reached:"* — `from functools import partial` / `with open('mydata.db', 'rb') as f:` / `for block in iter(partial(f.read, 64), b''): process_block(block)`

**sum** (L1963) `sum(iterable, /, start=0)`:
> *"Sums *start* and the items of an *iterable* from left to right and returns the total. The *iterable*'s items are normally numbers, and the start value is not allowed to be a string."*
> *"For some use cases, there are good alternatives to `sum()`. The preferred, fast way to concatenate a sequence of strings is by calling `''.join(sequence)`. To add floating-point values with extended precision, see `math.fsum()`. To concatenate a series of iterables, consider using `itertools.chain()`."*
> *"Changed in version 3.8: The *start* parameter can be specified as a keyword argument."* · *"Changed in version 3.12: Summation of floats switched to an algorithm that gives higher accuracy and better commutativity on most builds."* · *"Changed in version 3.14: Added specialization for summation of complexes, using same algorithm as for summation of floats."*
whatsnew 3.12 L596: *"`sum()` now uses Neumaier summation to improve accuracy and commutativity when summing floats or mixed ints and floats."*

**sorted** (L1870): > *"The built-in `sorted()` function is guaranteed to be stable. A sort is stable if it guarantees not to change the relative order of elements that compare equal — this is helpful for sorting in multiple passes"* · > *"The sort algorithm uses only `<` comparisons between items. While defining an `__lt__()` method will suffice for sorting, PEP 8 recommends that all six rich comparisons be implemented. This will help avoid bugs when using the same data with other ordering tools such as `max()` that rely on a different underlying method."*
`Doc/howto/sorting.rst` L350: > *"The *reverse* parameter still maintains sort stability (so that records with equal keys retain the original order). Interestingly, that effect can be simulated without the parameter by using the builtin `reversed()` function twice"* (doctest `list(reversed(sorted(reversed(data), key=itemgetter(0))))`). L64: > *"This technique is fast because the key function is called exactly once for each input record."* `stdtypes` list.sort: > *"The key corresponding to each item in the list is calculated once and then used for the entire sorting process."*

---

## 2 · Protocol, glossary, datamodel — verbatim

**Glossary** <https://docs.python.org/3.14/glossary.html>
- *iterable*: > *"An object capable of returning its members one at a time. Examples of iterables include all sequence types (such as `list`, `str`, and `tuple`) and some non-sequence types like `dict`, file objects, and objects of any classes you define with an `__iter__()` method or with a `__getitem__()` method that implements sequence semantics."* … *"When an iterable object is passed as an argument to the built-in function `iter()`, it returns an iterator for the object. This iterator is good for one pass over the set of values. When using iterables, it is usually not necessary to call `iter()` or deal with iterator objects yourself. The `for` statement does that automatically for you, creating a temporary unnamed variable to hold the iterator for the duration of the loop."*
- *iterator*: > *"An object representing a stream of data. Repeated calls to the iterator's `__next__()` method (or passing it to the built-in function `next()`) return successive items in the stream. When no more data are available a `StopIteration` exception is raised instead. At this point, the iterator object is exhausted and any further calls to its `__next__()` method just raise `StopIteration` again. Iterators are required to have an `__iter__()` method that returns the iterator object itself so every iterator is also iterable and may be used in most places where other iterables are accepted. One notable exception is code which attempts multiple iteration passes. A container object (such as a `list`) produces a fresh new iterator each time you pass it to the `iter()` function or use it in a `for` loop. Attempting this with an iterator will just return the same exhausted iterator object used in the previous iteration pass, making it appear like an empty container."* · impl-detail: *"CPython does not consistently apply the requirement that an iterator define `__iter__()`. And also please note that free-threaded CPython does not guarantee thread-safe behavior of iterator operations."*
- *sequence*: > *"An iterable which supports efficient element access using integer indices via the `__getitem__()` special method and defines a `__len__()` method that returns the length of the sequence."* … *"Note that `dict` also supports `__getitem__()` and `__len__()`, but is considered a mapping rather than a sequence because the lookups use arbitrary hashable keys rather than integers."* … the `Sequence` ABC adds *"`count()`, `index()`, `__contains__()`, and `__reversed__()`"*.

**stdtypes Iterator Types** <https://docs.python.org/3.14/library/stdtypes.html#typeiter> (L894–945)
> *"Once an iterator's `__next__()` method raises `StopIteration`, it must continue to do so on subsequent calls. Implementations that do not obey this property are deemed broken."* · `iterator.__iter__()`: *"Return the iterator object itself. This is required to allow both containers and iterators to be used with the `for` and `in` statements."*
**stdtypes common sequence ops** (L1053): > *"Forward and reversed iterators over mutable sequences access values using an index. That index will continue to march forward (or backward) even if the underlying sequence is mutated. The iterator terminates only when an `IndexError` or a `StopIteration` is encountered (or when the index drops below zero)."*
**list.reverse** (L1362): > *"Reverse the items of *sequence* in place. This method maintains economy of space when reversing a large sequence. To remind users that it operates by side-effect, it returns `None`."*
**`object.__reversed__`** `datamodel` L3329: > *"Called (if present) by the `reversed()` built-in to implement reverse iteration. It should return a new iterator object that iterates over all the objects in the container in reverse order."* / *"If the `__reversed__()` method is not provided, the `reversed()` built-in will fall back to using the sequence protocol (`__len__()` and `__getitem__()`). Objects that support the sequence protocol should only provide `__reversed__()` if they can provide an implementation that is more efficient than the one provided by `reversed()`."*
**None rule** `datamodel` L1945: > *"Setting a special method to `None` indicates that the corresponding operation is not available. For example, if a class sets `__iter__()` to `None`, the class is not iterable, so calling `iter()` on its instances will raise a `TypeError` (without falling back to `__getitem__()`)."* — footnote L3990: *"The `__hash__()`, `__iter__()`, `__reversed__()`, `__contains__()`, `__class_getitem__()` and `__fspath__()` methods have special handling for this."*
**collections.abc**: `Reversible` — *"ABC for iterable classes that also provide the `__reversed__()` method."* (versionadded 3.6) · `Iterator` — *"ABC for classes that provide the `__iter__()` and `__next__()` methods."* · table: `Sequence` inherits `Reversible`, `Collection`; mixin methods `__contains__`, `__iter__`, `__reversed__`, `index`, `count`.
**C-API** `PySequence_Check` <https://docs.python.org/3.14/c-api/sequence.html#c.PySequence_Check>: > *"Return `1` if the object provides the sequence protocol, and `0` otherwise. Note that it returns `1` for Python classes with a `__getitem__()` method, unless they are `dict` subclasses, since in general it is impossible to determine what type of keys the class supports."*
**range** stdtypes L1581: > *"The advantage of the `range` type over a regular `list` or `tuple` is that a `range` object will always take the same (small) amount of memory, no matter the size of the range it represents (as it only stores the `start`, `stop` and `step` values, calculating individual items and subranges as needed)."* · *"Range objects implement the `collections.abc.Sequence` ABC, and provide features such as containment tests, element index lookup, slicing and support for negative indices."*
**bool** stdtypes L888: > *"`bool` is a subclass of `int`. In many numeric contexts, `False` and `True` behave like the integers 0 and 1, respectively. However, relying on this is discouraged; explicitly convert using `int()` instead."*
**dict** (stdtypes; banked in `research_python_p03_t03_dict.md` §1–2): *"Keys and values are iterated over in insertion order. This allows the creation of `(value, key)` pairs using `zip()`: `pairs = zip(d.values(), d.keys())`."* · *"Iterating views while adding or deleting entries in the dictionary may raise a `RuntimeError` or fail to iterate over all entries."* · `reversed(d)` *"Added in version 3.8."* · `dict(iterable)` (L5326–5333): *"Each item in the iterable must itself be an iterable with exactly two elements. The first element of each item becomes a key in the new dictionary, and the second element the corresponding value. If a key occurs more than once, the last value for that key becomes the corresponding value in the new dictionary."*
**io** `IOBase` (io.rst L351): > *"`IOBase` (and its subclasses) supports the iterator protocol, meaning that an `IOBase` object can be iterated over yielding the lines in a stream. Lines are defined slightly differently depending on whether the stream is a binary stream (yielding bytes), or a text stream (yielding character strings)."*

---

## 3 · Statements — verbatim

**for** <https://docs.python.org/3.14/reference/compound_stmts.html#the-for-statement> (compound_stmts.rst L139–190). Grammar: `for_stmt: "for" target_list "in" starred_expression_list ":" suite ["else" ":" suite]`.
> *"The `starred_expression_list` expression is evaluated once; it should yield an iterable object. An iterator is created for that iterable. The first item provided by the iterator is then assigned to the target list using the standard rules for assignments, and the suite is executed. This repeats for each item provided by the iterator. When the iterator is exhausted, the suite in the `else` clause, if present, is executed, and the loop terminates."*
> *"A `break` statement executed in the first suite terminates the loop without executing the `else` clause's suite. A `continue` statement executed in the first suite skips the rest of the suite and continues with the next item, or with the `else` clause if there is no next item."*
> *"The for-loop makes assignments to the variables in the target list. This overwrites all previous assignments to those variables including those made in the suite of the for-loop"* (example: `i = 5` inside `for i in range(10)` does not affect the loop).
> *"Names in the target list are not deleted when the loop is finished, but if the sequence is empty, they will not have been assigned to at all by the loop."*
> *"Changed in version 3.11: Starred elements are now allowed in the expression list."*
**Tutorial** <https://docs.python.org/3.14/tutorial/controlflow.html#for-statements> (L43–): > *"Code that modifies a collection while iterating over that same collection can be tricky to get right. Instead, it is usually more straight-forward to loop over a copy of the collection or to create a new collection"* — examples `users.copy().items()` and building `active_users`.
**Tutorial else clauses** (L198–): > *"In a `for` or `while` loop the `break` statement may be paired with an `else` clause. If the loop finishes without executing the `break`, the `else` clause executes."* · *"In either kind of loop, the `else` clause is **not** executed if the loop was terminated by a `break`. Of course, other ways of ending the loop early, such as a `return` or a raised exception, will also skip execution of the `else` clause."* · *"(Yes, this is the correct code. Look closely: the `else` clause belongs to the `for` loop, **not** the `if` statement.)"* · *"a `try` statement's `else` clause runs when no exception occurs, and a loop's `else` clause runs when no `break` occurs."*
**Assignment** <https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements> (L129–140): > *"Else: The object must be an iterable with the same number of items as there are targets in the target list, and the items are assigned, from left to right, to the corresponding targets."* · starred: *"The object must be an iterable with at least as many items as there are targets in the target list, minus one … A list of the remaining items in the iterable is then assigned to the starred target (the list can be empty)."*
**Generator expressions** `expressions.rst` L545–: > *"The enclosing parentheses can be omitted in calls when the generator expression is the only positional argument and there are no keyword arguments."* · example `sum((x ** 2 for x in range(10)), start=1000)` with comment *"The generator needs its own parentheses if it's not the only argument"* · > *"The iterable expression in the leftmost `for` clause is evaluated immediately, so that an error raised by this expression will be emitted at the point where the generator expression is defined, rather than at the point where the first value is retrieved"* (NameError example). whatsnew 3.10 L196–: `SyntaxError: Generator expression must be parenthesized`.
**StopIteration** `exceptions.rst` L476–: > *"Raised by built-in function `next()` and an iterator's `__next__()` method to signal that there are no further items produced by the iterator."* · *"If a generator code directly or indirectly raises `StopIteration`, it is converted into a `RuntimeError` (retaining the `StopIteration` as the new exception's cause)."* · *"Changed in version 3.7: Enable PEP 479 for all code by default: a `StopIteration` error raised in a generator is transformed into a `RuntimeError`."*
**PEP 479** <https://peps.python.org/pep-0479/>: > *"This PEP proposes a change to generators: when `StopIteration` is raised inside a generator, it is replaced with `RuntimeError`. (More precisely, this happens when the exception is about to bubble out of the generator's stack frame.)"* · > *"The main goal of the proposal is to ease debugging in the situation where an unguarded `next()` call (perhaps several stack frames deep) raises `StopIteration` and causes the iteration controlled by the generator to terminate silently."* (the PEP also has paired-line examples with `next(f)`, L259–296.)

---

## 4 · PEP 618 (zip strict) — verbatim <https://peps.python.org/pep-0618/>

- Abstract: > *"This PEP proposes adding an optional `strict` boolean keyword parameter to the built-in `zip`. When enabled, a `ValueError` is raised if one of the arguments is exhausted before the others."*
- Motivation: > *"It is clear from the author's personal experience and a survey of the standard library that much (if not most) `zip` usage involves iterables that *must* be of equal length. … In any of these cases, the default behavior of `zip` means that faulty refactoring or logic errors could easily result in silently losing data. These bugs are not only difficult to diagnose, but difficult to even detect at all."*
- The refactor example: > *"the following code may work fine when `items` is a sequence, but silently start producing shortened, mismatched results if `items` is refactored by the caller to be a consumable iterator:"* `def apply_calculations(items): transformed = transform(items); for i, t in zip(items, transformed): yield calculate(i, t)`
- > *"Idiomatic tricks are especially susceptible, because they are often employed by users who lack a complete understanding of how the code works."* — transposing (`zip(*x)`) and chunking (`zip(*[iter(x)] * n)`) *"will silently omit the tail-end items of malformed input."* · the stdlib bug: `ast.literal_eval` *"silently dropped parts of malformed nodes"*.
- Specification: > *"When the built-in `zip` is called with the keyword-only argument `strict=True`, the resulting iterator will raise a `ValueError` if the arguments are exhausted at differing lengths. This error will occur at the point when iteration would normally stop today."*
- Reference implementation message grammar (also in `zip_next`): `zip() argument {i+1} is shorter than argument{plural}{i}` with `plural = " " if i == 1 else "s 1-"`; `zip() argument {i+1} is longer than argument{plural}{i}`.
- Rejected: > *"There is nothing "wrong" with the default behavior of `zip`, since there are many cases where it is indeed the correct way to handle unequally-sized inputs. It's extremely useful, for example, when dealing with infinite iterators."* · *"Users desiring a check that is disabled in optimized mode (like an `assert` statement) can use `strict=__debug__` instead."* · *"This PEP does not propose any changes to `map`, since the use of `map` with multiple iterable arguments is quite rare."* (3.14 nevertheless added `map(strict=)` — gh-119793.) · *"Silently truncated data is a particularly nasty class of bug, and hand-writing a robust solution that gets this right isn't trivial."*
- whatsnew 3.10 L822: *"PEP 618: The `zip()` function now has an optional `strict` flag, used to require that all the iterables have an equal length."*

---

## 5 · itertools + friends — verbatim

<https://docs.python.org/3.14/library/itertools.html> (owned by phase 5 — cite, do not teach)
- `zip_longest(*iterables, fillvalue=None)` (L756): > *"Make an iterator that aggregates elements from each of the *iterables*. If the iterables are of uneven length, missing values are filled-in with *fillvalue*. If not specified, *fillvalue* defaults to `None`. Iteration continues until the longest iterable is exhausted."* · > *"If one of the iterables is potentially infinite, then the `zip_longest()` function should be wrapped with something that limits the number of calls (for example `islice()` or `takewhile()`)."* Equivalent code uses `iterators[i] = repeat(fillvalue)`.
- `batched(iterable, n, *, strict=False)` (L153): *"If *strict* is true, will raise a `ValueError` if the final batch is shorter than *n*."* · versionadded 3.12 · *"Changed in version 3.13: Added the *strict* option."* · equivalent `raise ValueError('batched(): incomplete batch')`.
- recipes: `grouper(iterable, n, *, incomplete='fill', fillvalue=None)` — `'strict'` → `zip(*iterators, strict=True)`, `'ignore'` → `zip(*iterators)`, `'fill'` → `zip_longest(*iterators, fillvalue=fillvalue)` with `iterators = [iter(iterable)] * n` · `transpose(matrix): return zip(*matrix, strict=True)` (L1043) · `first_true(iterable, default=False, predicate=None): return next(filter(predicate, iterable), default)` (L895) · `pairwise` (L505–): *"It will be empty if the input iterable has fewer than two values."*
- `math.fsum` (math.rst L555): > *"Return an accurate floating-point sum of values in the iterable. Avoids loss of precision by tracking multiple intermediate partial sums."* · *"The algorithm's accuracy depends on IEEE-754 arithmetic guarantees and the typical case where the rounding mode is half-even. On some non-Windows builds, the underlying C library uses extended precision addition and may occasionally double-round an intermediate sum causing it to be off in its least significant bit."*
- `decimal.rst` L460: > *"Decimal objects cannot generally be combined with floats or instances of `fractions.Fraction` in arithmetic operations: an attempt to add a `Decimal` to a `float`, for example, will raise a `TypeError`."*
- `queue.rst` `Queue.get` (L154): > *"Remove and return an item from the queue. If optional args *block* is true and *timeout* is `None` (the default), block if necessary until an item is available."* · *"Raises `ShutDown` if the queue has been shut down and is empty, or if the queue has been shut down immediately."* · `Queue.shutdown(immediate=False)` (L241): *"Put a `Queue` instance into a shutdown mode. The queue can no longer grow. Future calls to `put()` raise `ShutDown`."* · *"Once the queue is empty, future calls to `get()` will raise `ShutDown`."* · *"Added in version 3.13."*
- `csv.rst` L524 `csvreader.__next__()`: *"Usually you should call this as `next(reader)`."* · `csv.reader` L56: *"A csvfile must be an iterable of strings, each in the reader's defined csv format. A csvfile is most commonly a file-like object or list. If *csvfile* is a file object, it should be opened with `newline=''`."*

---

## 6 · CPython v3.14.7 source — implementation facts (file:line)

🔴 Implementation detail unless a doc sentence above says otherwise; every error string is a real format
string in the source (quote as inline backticks with the file named, never as a "run").

### zip — `Python/bltinmodule.c`
- `zipobject` L3088 (`ittuple`, `result`, `strict`); `zip_new` L3094 parses only the keyword `strict` (`"|$p:zip"`); each argument goes through `PyObject_GetIter` at **construction** (so `zip(1, 2)` fails at the call, with `'int' object is not iterable`, `abstract.c` L2815).
- `zip_next` L3180: `for (i=0; i<tuplesize; i++) { item = tp_iternext(it_i); if (item == NULL) { … if (lz->strict) goto check; return NULL; } … }` — **iterators are advanced strictly left to right in each round; when iterator *i* is exhausted, the items already taken from iterators 0..i-1 in that round are dropped**. `tuplesize == 0` returns `NULL` at once (zip with no args is empty).
- `check:` (L3230–): if a non-`StopIteration` exception occurred it propagates. `if (i)` → `ValueError` `"zip() argument %zd is shorter than argument%s%zd"` with `plural = i == 1 ? " " : "s 1-"` (comments in source: `zip() argument 2 is shorter than argument 1` / `zip() argument 3 is shorter than arguments 1-2`). `i == 0` (the FIRST iterator ended) → the loop `for (i = 1; i < tuplesize; i++)` calls `tp_iternext` on each remaining iterator: an item → `"zip() argument %zd is longer than argument%s%zd"` (**the diagnosis consumes and discards one item from the longer iterator**); all exhausted → `return NULL` (clean end).
- The result tuple is reused when `_PyObject_IsUniquelyReferenced(result)` (L3194–); `_PyTuple_Recycle` — only observable through `id()`; not a semantic.
- `map` strict: `map_next` ~L1490–1560, same three messages with `map() argument …`; docstring L1620 *"Stops when the shortest iterable is exhausted."* / *"If strict is true and one of the arguments is exhausted before the others, raise a ValueError."*

### enumerate — `Objects/enumobject.c`
- `enum_new_impl` L48: `start = PyNumber_Index(start)` (so `start=1.0` → `TypeError: 'float' object cannot be interpreted as an integer`, `abstract.c` L1411); if `start` does not fit `Py_ssize_t` → `en_longindex` (arbitrary-precision counter, L60–70, `enum_next_long` L198); `en->en_sit = PyObject_GetIter(iterable)`.
- `enum_next` L239: pulls the item **first** (`next_item = tp_iternext(it)`), then builds `(index, item)`; index is a `Py_ssize_t` counter incremented per item; tuple recycled if uniquely referenced.
- Methods (L307): `__reduce__`, `__class_getitem__` only → **no `__len__`, no `__reversed__`, no `__length_hint__`**; `tp_as_sequence = 0` ⇒ `reversed(enumerate(x))` fails `PySequence_Check`.

### reversed — `Objects/enumobject.c`
- `reversed_new_impl` L380: `reversed_meth = _PyObject_LookupSpecial(seq, &_Py_ID(__reversed__))`; **if `Py_None` → `TypeError` `"'%.200s' object is not reversible"`**; if found, call it (no args) and return its result; else `if (!PySequence_Check(seq))` → the same `TypeError`; else `n = PySequence_Size(seq)` (→ `"object of type '%.200s' has no len()"`, `abstract.c` L1699/2286, for a `__getitem__`-only class) and build a `reversedobject` with `index = n-1` — **length captured at creation**.
- `reversed_next` L457: `item = PySequence_GetItem(seq, index)`; success → `index - 1`; `IndexError`/`StopIteration` cleared and iteration ends (`index = -1`, seq dropped on the GIL build). So a sequence that shrinks ends the loop early; one that grows is not seen past the captured start.
- `list.__reversed__` → `list___reversed___impl` `Objects/listobject.c` L4141: a `list_reverseiterator` (tp_name L4103) with `it_index = PyList_GET_SIZE(self) - 1` captured at creation; `listreviter_next` L4173 reads `list_get_item_ref(seq, index)` and stops (`it_index = -1`) at the first out-of-range read. `list_iterator` (forward) tp_name L3949; both stay exhausted (`bank t01` §11).
- `range.__reversed__` → `range_reverse` `Objects/rangeobject.c` L1215: builds a reversed range iterator arithmetically (no list) — comment L1221: *"reversed(range(start, stop, step)) can be expressed as range(start+(n-1)*step, start-step, -step)"*.
- `dict.__reversed__` (3.8) — dict bank §1. `set`, `frozenset`, generators, `map`, `filter`, `zip`, `enumerate` have neither `__reversed__` nor `sq_item` ⇒ `'<type>' object is not reversible`.

### any / all — `Python/bltinmodule.c` L319 / L368
- `PyObject_GetIter(iterable)` then a direct `tp_iternext` loop; each item goes through **`PyObject_IsTrue`** (so `__bool__`/`__len__` run, and an exception from them propagates); `all` returns `Py_RETURN_FALSE` on the first false item, `any` `Py_RETURN_TRUE` on the first true one; the return is always the exact `True`/`False` singleton (never an element). A `StopIteration` from the iterator is cleared; any other exception propagates. Clinic docstrings L312/L358: *"Return True if bool(x) is True for all values x in the iterable. If the iterable is empty, return True."* / *"…for any x in the iterable. If the iterable is empty, return False."*

### min / max — `Python/bltinmodule.c` `min_max` L1962 (`builtin_min` L2081 → `Py_LT`; `builtin_max` L2098 → `Py_GT`)
- `nargs == 0` → `TypeError` `"%s expected at least 1 argument, got 0"`. Keywords parsed `"|$OO:min"` = `key`, `default` only. `positional = nargs > 1`; `positional && defaultval != NULL` → `TypeError` `"Cannot specify a default for %s() with multiple positional arguments"`. `!positional` → `it = PyObject_GetIter(args[0])` (`min(5)` → `'int' object is not iterable`). `keyfunc == Py_None` → no key.
- Loop: `item = PyIter_Next(it)`; **`val = PyObject_CallOneArg(keyfunc, item)` exactly once per item, including the first**; first item becomes `maxitem/maxval`; thereafter `cmp = PyObject_RichCompareBool(val, maxval, op)` — **operand order is (new, best)** with `op` `<` for min and `>` for max — and the best is replaced **only when `cmp > 0`** ⇒ **strict comparison: the first of equal items wins**; `cmp < 0` (an exception) aborts.
- Empty: `maxval == NULL` → `defaultval` returned **as is (not passed through `key`)**, else `ValueError` `"%s() iterable argument is empty"`.
- `PyObject_RichCompareBool` with `Py_LT`/`Py_GT` has **no identity shortcut** (only `==`/`!=`), so `nan` compares False both ways (bank: phase-1 NaN pages).
- `Objects/object.c` L1044–1090 `do_richcompare`: tries the reflected operation of the right operand when the left returns `NotImplemented`; final message `"'%s' not supported between instances of '%.100s' and '%.100s'"` with the op string and `(v, w)` type names — for `max`, `v` is the **new** item, `w` the best so far.

### sum — `Python/bltinmodule.c` `builtin_sum_impl` L2792
- `start` default: the int `0` (`PyLong_FromLong(0)`). `start` a `str`/`bytes`/`bytearray` → `TypeError` `"sum() can't sum strings [use ''.join(seq) instead]"` / `"sum() can't sum bytes [use b''.join(seq) instead]"` / `"sum() can't sum bytearray [use b''.join(seq) instead]"` — **checked only on the `start` argument**; `sum(["a","b"])` starts at int `0` and fails on `0 + "a"` with the generic operand error.
- Fast paths (`#ifndef SLOW_SUM`): exact `int` result — sums in a C `Py_ssize_t`, falling back on overflow or a non-int item (accepts `bool` items); exact `float` result — **Neumaier compensated summation** (`CompensatedSum` L2734–2775, comment *"Improved Kahan–Babuška algorithm by Arnold Neumaier"*), int and float items only, anything else falls back; exact `complex` (3.14) — same for real and imaginary parts. Otherwise the generic loop with **`PyNumber_Add`, never in-place** — the source comment (L3003): *"It's tempting to use PyNumber_InPlaceAdd instead of PyNumber_Add here, to avoid quadratic running time when doing 'sum(list_of_lists, [])'. However, this would produce a change in behaviour: a snippet like `empty = []; sum([[x] for x in range(10)], empty)` would change the value of empty. In fact, using in-place addition rather that binary addition for any of the steps introduces subtle behavior changes: https://bugs.python.org/issue18305"*.
- Clinic docstring L2773: *"Return the sum of a 'start' value (default: 0) plus an iterable of numbers. When the iterable is empty, return the start value. This function is intended specifically for use with numeric values and may reject non-numeric types."*
- `Modules/_datetimemodule.c` L2445 `delta_add`: returns `NotImplemented` unless **both** operands are `timedelta` ⇒ `0 + timedelta` is a `TypeError`; the fix is `sum(deltas, start=timedelta())`.

### next / iter — `Python/bltinmodule.c`
- `builtin_next` L1677: `if (!PyIter_Check(it))` → `TypeError` `"'%.200s' object is not an iterator"` (**`next([1,2])` fails: a list is iterable, not an iterator**); `res = tp_iternext(it)`; with a default: a `StopIteration` is cleared and the default returned, **any other exception propagates**; without: `StopIteration` set/propagated.
- `builtin_iter` L1814: two-arg form: `!PyCallable_Check(v)` → `TypeError` `"iter(v, w): v must be callable"`; else `PyCallIter_New`. One-arg: `PyObject_GetIter` (`abstract.c` L2806): `tp_iter` else `PySequence_Check` → `PySeqIter_New` (the `__getitem__` protocol) else `"'%.200s' object is not iterable"`.
- `Objects/iterobject.c` `calliter_iternext` L224: `if (it->it_callable == NULL) return NULL;` (already finished stays finished); `result = _PyObject_CallNoArgs(callable)`; **`ok = PyObject_RichCompareBool(it->it_sentinel, result, Py_EQ)`** — `sentinel == result`, with the identity shortcut (`is` ⇒ equal); `ok == 0` → return result; `ok > 0` → `Py_CLEAR` callable and sentinel then end; **a `StopIteration` raised by the callable also ends the iteration and clears both**; other exceptions propagate.

### unpacking — `Python/ceval.c` `_PyEval_UnpackIterableStackRef` L2390
- Non-iterable: `"cannot unpack non-iterable %.200s object"`. Pulls exactly `argcnt` items; short → `ValueError` `"not enough values to unpack (expected %d, got %d)"` (with a star: `"not enough values to unpack (expected at least %d, got %d)"`). Then **pulls one more item** to prove exhaustion (an iterator with extra items is consumed by one); if there is one: for an exact `list`/`tuple`/`dict` and `len > argcnt` → `"too many values to unpack (expected %d, got %zd)"`, otherwise `"too many values to unpack (expected %d)"` (no "got").

### text files — `Modules/_io/textio.c`
- `textiowrapper_iternext_lock_held` L3192: `self->telling = 0;` on every `__next__`; restored (`self->telling = self->seekable`) only when a call returns an empty string (EOF, L3224). `tell()` L2763: `if (!self->telling) { PyErr_SetString(PyExc_OSError, "telling position disabled by next() call"); }` ⇒ **`f.tell()` inside `for line in f:` raises `OSError` on a text file until EOF**; `readline()` does not set `telling = 0`, so `for line in iter(f.readline, ""):` keeps `tell()` usable.
- `Modules/_io/iobase.c` L679 `iobase_iter`: returns `self` (a file is its own iterator ⇒ one pass).

### mutation checks (banks, not re-fetched): list iterators have no size check (`bank t01` §11); dict `"dictionary changed size during iteration"` / `"dictionary keys changed during iteration"` (`bank t03` §14); set `"Set changed size during iteration"` (`bank t04`, `setiter_iternext`); deque `"deque mutated during iteration"`, OrderedDict `"OrderedDict mutated during iteration"` / `"OrderedDict changed size during iteration"` (`bank t06`).

---

## 7 · Ruff rules @ 0.16.6 (`crates/ruff_linter/src/rules/`, docstrings verbatim; pin: `src/data/pins.js`)

- **B905 `zip-without-explicit-strict`** (stable since v0.0.167): *"Checks for `zip` calls without an explicit `strict` parameter when called with two or more iterables, or any starred argument."* · *"By default, if the iterables passed to `zip` are of different lengths, the resulting iterator will be silently truncated to the length of the shortest iterable. This can lead to subtle bugs. Pass `strict=True` to raise a `ValueError` if the iterables are of non-uniform length. Alternatively, if the iterables are deliberately of different lengths, pass `strict=False` to make the intention explicit."* · Fix safety: *"This rule's fix is marked as unsafe. While adding `strict=False` preserves the runtime behavior, it can obscure situations where the iterables are of unequal length."*
- **B909 `loop-iterator-mutation`** (**preview** since v0.3.7 — needs `--preview`): *"Checks for mutations to an iterable during a loop iteration."* · *"When iterating over an iterable, mutating the iterable can lead to unexpected behavior, like skipping elements or infinite loops."*
- **B007 `unused-loop-control-variable`** (v0.0.84): *"Checks for unused variables in loops"* · fix: prefix `_`.
- **B020 `loop-variable-overrides-iterator`** (v0.0.121): *"Checks for loop control variables that override the loop iterable."* (`for items in items:`)
- **B023 `function-uses-loop-variable`** (v0.0.139): *"The loop variable is not bound in the function definition, so it will always have the value it had in the last iteration when the function is called. Instead, consider using a default argument to bind the loop variable at function definition time. Or, use `functools.partial`."*
- **PLW2901 `redefined-loop-name`** (v0.0.252): *"Checks for variables defined in `for` loops and `with` statements that get overwritten within the body"* · *"In Python, unlike many other languages, `for` loops and `with` statements don't define their own scopes."*
- **SIM110 `reimplemented-builtin`** (v0.0.211; also SIM111): *"Checks for `for` loops that can be replaced with a builtin function, like `any` or `all`."* · fix *"always marked as unsafe because it might remove comments."*
- **SIM118 `in-dict-keys`** (v0.0.176): *"Checks for key-existence checks against `dict.keys()` calls."* · *"using `key in dict` is more readable and efficient than `key in dict.keys()`, while having the same semantics."*
- **C419 `unnecessary-comprehension-in-call`** (v0.0.262): *"Checks for unnecessary list or set comprehensions passed to builtin functions that take an iterable."* · *"(this rule currently covers `any` and `all` in stable, along with `min`, `max`, and `sum` in preview)"* · *"`any` and `all` can also short-circuit iteration, saving a lot of time. The unnecessary comprehension forces a full iteration of the input iterable, giving up the benefits of short-circuiting."* · fix unsafe *"as it can change the behavior of the code if the iteration has side effects (due to laziness and short-circuiting)."* (The docstring also carries a `%timeit` block — do NOT reproduce; cite the claim only.)
- **C413 `unnecessary-call-around-sorted`** (v0.0.73): *"It is also unnecessary to use `reversed()` around `sorted()`, as the latter has a `reverse` argument"* · fix unsafe for `reversed()` because *"`reversed()` will reverse the order of the collection, while `sorted()` with `reverse=True` will perform a stable reverse sort, which will preserve the order of elements that compare as equal."*
- **PERF102 `incorrect-dict-iterator`** (v0.0.273): *"Checks for uses of `dict.items()` that discard either the key or the value when iterating over the dictionary."* · *"as with all `perflint` rules, this is only intended as a micro-optimization, and will have a negligible impact on performance in most cases."*
- **PLC0206 `dict-index-missing-items`** (stable since 0.8.0): *"Checks for dictionary iterations that extract the dictionary value via explicit indexing, instead of using `.items()`."*
- **RUF007 `zip-instead-of-pairwise`** (v0.0.257): *"Checks for use of `zip()` to iterate over successive pairs of elements."* · fix unsafe: *"it assumes that slicing an object (e.g., `obj[1:]`) produces a value with the same type and iteration behavior as the original object"*.
- **RUF015 `unnecessary-iterable-allocation-for-first-element`** (v0.0.278): replaces `list(x)[0]`, `[i for i in x][0]`, `list(...).pop(0)` with `next(iter(...))` · fix unsafe: *"accessing members of a collection via square bracket notation `[0]` or the `pop()` function will raise `IndexError` if the collection is empty, while `next(iter(...))` will raise `StopIteration`."*
- Rule codes: `Flake8Comprehensions` codes are stored two-digit (`"19"` = C419, `"13"` = C413); `codes.rs` @0.16.6 lines 355/428/466/502/515/518/536/537/649/656/1152/1159/1295.

---

## 8 · Could NOT settle — say so on the page

- **Exact float result of `sum([0.1] * 10)` / any concrete float sum in 3.14.** No sandbox. The docs promise only *"higher accuracy and better commutativity on most builds"*; write mechanism (Neumaier) and point at `math.fsum`, never a value.
- **`reversed(set)` message for a `dict` subclass / exotic `PySequence_Check` cases** — only the documented `PySequence_Check` sentence is quoted.
- **Whether the docs promise "key called once per item" for `min`/`max`.** They do not (only for `sort`/`sorted`); it is CPython source at v3.14.7 (`min_max`). Label as implementation detail.
- **Free-threaded behaviour of `zip`/`enumerate` counters** — `enum_next` uses relaxed atomics on the free-threaded build (source), but the docs' threadsafety page (`threadsafety.rst`) was not read for `zip`/`enumerate`/`reversed`; the glossary says free-threaded CPython *"does not guarantee thread-safe behavior of iterator operations"*. Do not claim more.
- **PyPy / other implementations** — not checked.
- **Ruff `B909` behaviour details** beyond its docstring (which patterns it flags) — cite the docstring only.
- **Timings / memory numbers** — none may appear.

## 9 · Version spine

Python **3.14.7** (released 2026-08-05; docs.python.org/3.14 and CPython tag `v3.14.7`) · zip `strict` 3.10 · `map` `strict` 3.14 · `sum` Neumaier 3.12 · `sum` complex specialization 3.14 · `max`/`min` `default=` 3.4, `key=None` 3.8 · `dict` reversible 3.8 · starred `for` iterable 3.11 · PEP 479 default 3.7 · `itertools.batched` 3.12 (`strict` 3.13) · `Queue.shutdown` 3.13 · ruff **0.16.6** · `src/data/pins.js`: python 3.14, ruff 0.16.6.
