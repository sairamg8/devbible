---
title: "Link map · Python · Part 2 (phases 2–3)"
sidebar_label: "02 · functions and collections"
sidebar_position: 2
---

# Link map · Python · Part 2 (phases 2–3)

Covers every topic row of phase 2 (T02-01 to T02-10, functions, closures and decorators, from `docs/python/syllabus/01-foundations.md`) and phase 3 (T03-01 to T03-12, collections in depth, from `docs/python/syllabus/02-data-model.md`). That is 22 rows. ✅ means a written topic directory of ours carries the row (the path is its first chunk file); 🔲 means no page of ours carries it as a topic (T03-10, T03-11, T03-12). Phase 3 row 10 is touched by the list-internals chunks on sort stability and key functions, but it has no page of its own.
*read* = I read the passage; *headings only* = fetched at 200 and the named section confirmed present, passage itself not read. Every URL below was re-fetched on 2026-10-13 and returns 200 at the address shown (no redirect). Third-party links carry a date where the page shows one. No `#anchors` are given.

🔴 **Version note.** Our syllabus targets **Python 3.14** (`docs/python/README.md`). Several third-party picks predate it: the Laurent Luce list article (2011, an older CPython resize formula), the PyMOTW pages (2017–2018), Ned Batchelder's iteration talk (2012–2013) and Guido's tail-recursion post (2009) are all kept for the idea, not for current numbers. The annotations pick (T02-09) is 3.14-specific. Real Python pages return 403 to every fetch tool available (re-tested 2026-10-13), so none is cited: the *beyond the docs* lines below are the best pages that could actually be opened. docs.python.org/3 currently serves the 3.15 docs; `library/stdtypes.html` and `library/functions.html` now redirect to `builtins/stdtypes.html` and `builtins/functions.html` (also under 3.14), so the new addresses are used. Python Morsels pages marked PREMIUM have a free article; only the screencast is gated.

---

## Phase 2 — Functions, closures and decorators

### T02-01 · `def`, `return`, functions as first-class values — Understand · ✅ written `docs/python/pages/phase-2-functions/01-def-and-return/01-def-statement-and-first-class-functions.md`
- **Read this:** [More Control Flow Tools](https://docs.python.org/3/tutorial/controlflow.html) · Python tutorial · defining functions, return values and default behavior in the tutorial voice (*read* 4.8 and 4.9) · covers our angle: **partial** — the sorted(key=...) first-class use is not the focus
- **Also good:** [Compound statements](https://docs.python.org/3/reference/compound_stmts.html) · Language reference · the formal definition of the function definition statement (*headings only*)
- **Beyond the docs:** [None in Python](https://www.pythonmorsels.com/none/) · Trey Hunner, Python Morsels, 2024-01-22 · states plainly that every function returns something, even without a return statement, which is the root of the forgotten-return bug · fetched 2026-10-13 (*read*)
- **Our delta:** the forgotten-return bug as a design contract (`None` is a return value), plus functions passed to `sorted(key=...)`.

### T02-02 · Parameters in full — Master · ✅ written `docs/python/pages/phase-2-functions/02-parameters-in-full/01-default-values-and-the-mutable-trap.md`
- **Read this:** [More Control Flow Tools](https://docs.python.org/3/tutorial/controlflow.html) · Python tutorial · default values, keyword arguments, special parameters (`/` and `*`), arbitrary argument lists (*read* the default-values section) · covers our angle: **partial** — no signature-growth discussion
- **Also good:** [Common Gotchas](https://docs.python-guide.org/writing/gotchas/) · The Hitchhiker's Guide to Python · "A new list is created once when the function is defined, and the same list is used in each successive call"; page shows no date (*read*) · [Keyword-only function arguments](https://www.pythonmorsels.com/keyword-only-function-arguments/) · Python Morsels, 2020-11-30 · everything after the bare star must be named (*read*)
- **Beyond the docs:** [Mutable default arguments](https://www.pythonmorsels.com/mutable-default-arguments/) · Trey Hunner, Python Morsels, 2025-04-07 · states that defaults are defined only once, when the function is defined, then shows the None-sentinel fix and the copy-the-argument fix · fetched 2026-10-13 (*read*)
- **Our delta:** designing a signature that survives growth (keyword-only for new options, positional-only to free names).

### T02-03 · Scope and closures — Master · ✅ written `docs/python/pages/phase-2-functions/03-scope-and-closures/01-legb-and-unboundlocalerror.md`
- **Read this:** [Execution model](https://docs.python.org/3/reference/executionmodel.html) · Language reference · the formal rules for names, scopes and binding (*read* the Resolution of names section) · covers our angle: **partial** — reference prose, no loop-closure bug
- **Also good:** [Common Gotchas](https://docs.python-guide.org/writing/gotchas/) · The Hitchhiker's Guide to Python · late-binding closures: "the values of variables used in closures are looked up at the time the inner function is called" (*read*) · [Programming FAQ](https://docs.python.org/3/faq/programming.html) · Python docs · FAQ entries on UnboundLocalError, local and global rules, and "Why do lambdas defined in a loop with different values all return the same result?" (*read* the question)
- **Beyond the docs:** [Enclosing scope in Python](https://www.pythonmorsels.com/enclosing-scope/) · Trey Hunner, Python Morsels, 2025-06-03 · walks LEGB and says `nonlocal` assigns to an enclosing scope while `global` always assigns to the global one; enclosing scope matters only with a closure · fetched 2026-10-13 (*read*)
- **Our delta:** the every-callback-sees-the-last-value loop bug as the headline case, with the shared-with-JavaScript framing.

### T02-04 · `lambda` — Understand · ✅ written `docs/python/pages/phase-2-functions/04-lambda/01-syntax-restrictions-and-key-functions.md`
- **Read this:** [Expressions](https://docs.python.org/3/reference/expressions.html) · Language reference · the lambda expression section: `lambda parameters: expression` yields a function object (*read*) · covers our angle: **partial** — no style guidance
- **Beyond the docs:** [Python's lambda functions](https://www.pythonmorsels.com/lambda-expressions/) · Trey Hunner, Python Morsels, 2023-10-25 · argues lambda should usually be avoided and asks whether a named function would be clearer, while keeping the key= use as the good case · fetched 2026-10-13 (*read*)
- **Our delta:** the named-lambda smell tied to PEP 8.

### T02-05 · Decorators — Master · ✅ written `docs/python/pages/phase-2-functions/05-decorators/01-the-decorator-protocol-from-scratch.md`
- **Read this:** [Making a well-behaved decorator](https://www.pythonmorsels.com/making-well-behaved-decorator/) · Trey Hunner, Python Morsels, 2021-06-17 · shows what `help()` reports for a decorated function without `functools.wraps`: a function called `wrapper` that "accepts any arguments and has no documentation" (*read*) · covers our angle: **partial** — wraps, not arguments or stacking
- **Also good:** [functools](https://docs.python.org/3/library/functools.html) · Python docs · `wraps` and `update_wrapper` reference (*read*) · [Making a decorator that accepts arguments](https://www.pythonmorsels.com/making-decorator-accepts-arguments/) · Trey Hunner, Python Morsels, 2021-06-21 · a decorator that takes arguments is a function that accepts arguments and returns a decorator, one extra layer (*read*)
- **Beyond the docs:** [How you implemented your Python decorator is wrong](https://grahamdumpleton.me/posts/2014/01/how-you-implemented-your-python/) · Graham Dumpleton (author of `wrapt`), 7 January 2014 · argues the basic closure pattern breaks introspection and the descriptor protocol (his example wraps a classmethod and fails), which is the case for the `wrapt` library; examples are Python 2-era and it is a deeper step than a first decorator · fetched 2026-10-13 (*read*)
- **Our delta:** `@timed` and `@retry` built by hand so `@app.get` stops being magic.

### T02-06 · `functools` — Understand · ✅ written `docs/python/pages/phase-2-functions/06-functools/01-partial-and-freezing-callables.md`
- **Read this:** [functools](https://docs.python.org/3/library/functools.html) · Python docs · `partial`, `lru_cache`, `cache`, `singledispatch`, `reduce`; says cache arguments "must be hashable" (*read*) · covers our angle: **full** on the list, but little on pitfalls
- **Also good:** [Function overloading](https://www.pythonmorsels.com/function-overloading/) · Trey Hunner, Python Morsels, 2023-03-13 · `singledispatch` as dispatch to helper functions by argument type (*read*)
- **Beyond the docs:** [Don't wrap instance methods with functools.lru_cache](https://rednafi.com/python/lru-cache-on-methods/) · Redowan Delowar, 2022-01-15 · on a method the cache keeps a reference to every instance, so "the instances of the class encapsulating that method never get garbage collected within the lifetime of the process" · fetched 2026-10-13 (*read*)
- **Our delta:** why caching a function with unhashable arguments throws.

### T02-07 · Callables beyond functions — Understand · ✅ written `docs/python/pages/phase-2-functions/07-callables-beyond-functions/01-the-call-dunder-and-stateful-instances.md`
- **Read this:** [Data model](https://docs.python.org/3/reference/datamodel.html) · Language reference · callable types and `__call__` (*headings only*) · covers our angle: **partial** — a reference, not a walk-through of bound methods
- **Also good:** [Descriptor HowTo Guide](https://docs.python.org/3/howto/descriptor.html) · Python docs · how functions stored in class dictionaries become bound methods through the descriptor protocol (*read* the Functions and methods section)
- **Beyond the docs:** [Callables: Python's "functions" are sometimes classes](https://www.pythonmorsels.com/class-function-and-callable/) · Trey Hunner, Python Morsels, 2022-05-25 · "Adding a `__call__` method to any class will make instances of that class callable" · fetched 2026-10-13 (*read*)
- **Our delta:** what `self` actually is: the bound method carries the instance.

### T02-08 · Docstrings — Understand · ✅ written `docs/python/pages/phase-2-functions/08-docstrings/01-pep-257-and-major-docstring-formats.md`
- **Read this:** [PEP 257 — Docstring Conventions](https://peps.python.org/pep-0257/) · python.org · the convention for what a docstring is and how to lay it out (*read* the definition) · covers our angle: **partial** — does not compare the Google, NumPy and reST formats
- **Also good:** [Docstrings in Python](https://www.pythonmorsels.com/docstrings/) · Trey Hunner, Python Morsels, 2021-02-18 · what a docstring is, that `help()` reads it, and that the triple-quote habit is a PEP 257 convention (*read*) · [The features of Python's help() function](https://www.pythonmorsels.com/help-features/) · Python Morsels, 2025-03-03 · `help()` in depth; docstrings only as its output (*read*)
- **Beyond the docs:** [sphinx.ext.napoleon: Support for NumPy and Google style docstrings](https://www.sphinx-doc.org/en/master/usage/extensions/napoleon.html) · Sphinx project documentation · puts the Google and NumPy styles side by side (Google separates sections by indentation, NumPy by underlines) and says the two styles should not be mixed: choose one for your project and be consistent, which is the format-choice half of the row; page shows no date · fetched 2026-10-13 (*read*)
- **Our delta:** choosing one docstring format for the team.

### T02-09 · Annotations at runtime (3.14, PEP 649/749) — Know · ✅ written `docs/python/pages/phase-2-functions/09-annotations-at-runtime/01-deferred-evaluation-and-the-annotate-protocol.md`
- **Read this:** [annotationlib](https://docs.python.org/3/library/annotationlib.html) · Python docs · the 3.14 module for inspecting annotations under deferred evaluation; contrasts stringified annotations (`from __future__ import annotations`) with deferred evaluation, default in 3.14 (*read*) · covers our angle: **full** for 3.14 only
- **Also good:** [Annotations Best Practices](https://docs.python.org/3/howto/annotations.html) · Python docs · says to use `annotationlib.get_annotations()` (3.14+) rather than reading `__annotations__` directly (*read*) · [PEP 649](https://peps.python.org/pep-0649/) · python.org · the design; the page marks itself a historical document and points to the Annotations docs as canonical (*read* the abstract)
- **Beyond the docs:** [What is PEP 649?](https://pydevtools.com/handbook/explanation/what-is-pep-649/) · pydevtools handbook, page shows "Last updated on August 29, 2026" · says the future import was the standard fix for forward references and on 3.14 PEP 649 handles this by default · fetched 2026-10-13 (*read*)
- **Our delta:** what changed for the `from __future__ import annotations` era. Pick is 3.14 only; older versions evaluate eagerly.

### T02-10 · Recursion and the recursion limit — Know · ✅ written `docs/python/pages/phase-2-functions/10-recursion-and-the-limit/01-recursion-error-and-the-c-stack.md`
- **Read this:** [sys](https://docs.python.org/3/library/sys.html) · Python docs · `getrecursionlimit` and `setrecursionlimit`: the limit protects the C stack from overflow (*read*) · covers our angle: **partial** — nothing on tail calls
- **Also good:** [A thing I learned about Python recursion](https://nedbatchelder.com/blog/201812/a_thing_i_learned_about_python_recursion) · Ned Batchelder, 2018-12-20 · the stack is 1000 frames by default, and a generator comprehension inside `sum()` costs a second frame per level (*read*)
- **Beyond the docs:** [Tail Recursion Elimination](http://neopythonic.blogspot.com/2009/04/tail-recursion-elimination.html) · Guido van Rossum, Neopythonic, 2009-04-22 · his reason for refusing tail-call elimination: "TRE is incompatible with nice stack traces"; written in 2009, so check against current CPython · fetched 2026-10-13 (*read*)
- **Our delta:** the 3.14 C-stack angle and iterating instead.

---

## Phase 3 — Collections in depth

### T03-01 · `list` internals and sorting — Master · ✅ written `docs/python/pages/phase-3-collections/01-list-internals/01-the-dynamic-array.md`
- **Read this:** [Data Structures](https://docs.python.org/3/tutorial/datastructures.html) · Python tutorial · list methods, `sort`, using lists as stacks and queues; says lists are not efficient as queues (*read*) · covers our angle: **partial** — no complexity or internals
- **Also good:** [TimeComplexity](https://wiki.python.org/moin/TimeComplexity) · Python wiki · cost table for list operations: insert O(n), append O(1) (*read*) · [listsort.txt](https://raw.githubusercontent.com/python/cpython/main/Objects/listsort.txt) · CPython source tree, author not named on the page · "an adaptive, stable, natural mergesort, modestly called timsort" (*read* the intro)
- **Beyond the docs:** [Python list implementation](https://www.laurentluce.com/posts/python-list-implementation/) · Laurent Luce, written 2011-03-10, modified 2020-12-29 · "It over-allocates memory to avoid calling list_resize too many times" and append is amortized O(1); the resize numbers describe an older CPython · fetched 2026-10-13 (*read*)
- **Our delta:** the `x = x.sort()` bug and the insert(0, …) shift.

### T03-02 · `tuple` — Understand · ✅ written `docs/python/pages/phase-3-collections/02-tuple/01-what-immutability-freezes.md`
- **Read this:** [Data Structures](https://docs.python.org/3/tutorial/datastructures.html) · Python tutorial · tuples and sequences, packing and unpacking (*headings only*) · covers our angle: **partial**
- **Also good:** [dataclasses](https://docs.python.org/3/library/dataclasses.html) · Python docs · the named-fields alternative: a decorator that generates `__init__()` and `__repr__()` (*read* the intro)
- **Beyond the docs:** [Lists vs. Tuples](https://nedbatchelder.com/blog/201608/lists_vs_tuples) · Ned Batchelder, 2016-08-18 · "If you know when you write the code what the third element means, then it is probably a tuple": a cultural rule, not just mutability · fetched 2026-10-13 (*read*)
- **Our delta:** when a dataclass beats a 4-tuple, and that a tuple is hashable only if its contents are.

### T03-03 · `dict` — Master · ✅ written `docs/python/pages/phase-3-collections/03-dict/01-the-hash-table-underneath.md`
- **Read this:** [Built-in Types](https://docs.python.org/3/builtins/stdtypes.html) · Python docs · the mapping types section: `dict` methods, views, merge operators (*headings only*) · covers our angle: **full** on the API
- **Also good:** [Modern Python Dictionaries: A confluence of a dozen great ideas](https://pycon-archive.python.org/2017/schedule/presentation/18/) · Raymond Hettinger, PyCon 2017 · the talk page and abstract only; I did not open the video (*headings only*)
- **Beyond the docs:** [Python behind the scenes #10: how Python dictionaries work](https://tenthousandmeters.com/blog/python-behind-the-scenes-10-how-python-dictionaries-work/) · tenthousandmeters, 2021-04-05 · "dictionaries became ordered because items are added to the entries array in the insertion order": the compact layout behind the order guarantee · fetched 2026-10-13 (*read*)
- **Our delta:** hashability as a contract on keys, and the key that mutates.

### T03-04 · `set` and `frozenset` — Master · ✅ written `docs/python/pages/phase-3-collections/04-set-and-frozenset/01-the-hash-table-underneath.md`
- **Read this:** [Built-in Types](https://docs.python.org/3/builtins/stdtypes.html) · Python docs · set types section: common uses are membership testing, removing duplicates and set operations (*read*) · covers our angle: **full**
- **Also good:** [Big-O: how code slows as data grows](https://nedbatchelder.com/text/slowsgrows) · Ned Batchelder, created 2017-10-18 · hash-table lookup is constant time ("Finding a key in a million-element dict is just as fast as finding one in ten-element dict") and why nested scans go quadratic; it is about dicts and hash tables and never names `set` (*read*)
- **Beyond the docs:** [Practical uses of sets](https://www.pythonmorsels.com/practical-uses-of-sets/) · Trey Hunner, Python Morsels, 2025-04-15 · sets for removing duplicates "as long as you don't care about maintaining the order", plus membership and set algebra in everyday code · fetched 2026-10-13 (*read*)
- **Our delta:** a - b instead of a nested loop, and what dedupe destroys.

### T03-05 · Slicing — Understand · ✅ written `docs/python/pages/phase-3-collections/05-slicing/01-the-three-numbers.md`
- **Read this:** [Built-in Types](https://docs.python.org/3/builtins/stdtypes.html) · Python docs · common sequence operations, including the meaning of s[i:j:k] (*headings only*) · covers our angle: **partial** — no assignment tour
- **Beyond the docs:** [Python list slicing](https://www.pythonmorsels.com/slicing/) · Trey Hunner, Python Morsels, 2024-03-08 · "Slicing a list gives us back a new list", and with a negative step the default meaning of start and stop changes · fetched 2026-10-13 (*read*)
- **Our delta:** slices as copies versus the aliasing bugs of phase 1, and slice assignment.

### T03-06 · `collections` — Master · ✅ written `docs/python/pages/phase-3-collections/06-collections-module/01-nine-types-three-families.md`
- **Read this:** [collections](https://docs.python.org/3/library/collections.html) · Python docs · `defaultdict`, `Counter`, `deque`, `namedtuple`, `ChainMap` (*read* the defaultdict section) · covers our angle: **full**
- **Also good:** [Counting occurrences with collections.Counter](https://www.pythonmorsels.com/using-counter/) · Python Morsels, 2023-06-27 · Counter and `most_common` (*read*) · [Stacks and queues in Python](https://www.pythonmorsels.com/stacks-and-queues/) · Python Morsels, 2026-06-10 · "If you need something that acts like a queue, use a `deque`" (*read*)
- **Beyond the docs:** [Setting default dictionary values in Python](https://www.pythonmorsels.com/default-dictionary-values/) · Trey Hunner, Python Morsels, 2026-02-13 · puts `get`, `setdefault` and `defaultdict` side by side, so the group-by one-liner is chosen against the alternatives · fetched 2026-10-13 (*read*)
- **Our delta:** one page covers all nine types; no third-party pick found for `ChainMap` or `namedtuple` (two searches by the first pass; the verifier's own search was blocked by the search budget, so this is unconfirmed).

### T03-07 · `heapq` and `bisect` — Understand · ✅ written `docs/python/pages/phase-3-collections/07-heapq-and-bisect/01-the-heap-invariant.md`
- **Read this:** [heapq](https://docs.python.org/3/library/heapq.html) · Python docs, includes Priority Queue Implementation Notes (*headings only*) · [bisect](https://docs.python.org/3/library/bisect.html) · Python docs (*read* `bisect_left`) · covers our angle: **full**
- **Also good:** [Binary search in Python with bisect](https://www.pythonmorsels.com/binary-search/) · Python Morsels, 2026-07-29 · "Python's `bisect` module implements binary search for you" (*read* that sentence)
- **Beyond the docs:** [heapq — Heap Sort Algorithm](https://pymotw.com/3/heapq/) · Doug Hellmann, PyMOTW 3, last updated 2017-07-30 · "A min-heap requires that the parent be less than or equal to its children", and nlargest and nsmallest are efficient only for relatively small n; examples generated with Python 3.7.9 · fetched 2026-10-13 (*read*)
- **Our delta:** top-K without sorting everything, and priority queues with removal.

### T03-08 · `copy` and `deepcopy` — Understand · ✅ written `docs/python/pages/phase-3-collections/08-copy-and-deepcopy/01-what-copy-copy-decides.md`
- **Read this:** [copy](https://docs.python.org/3/library/copy.html) · Python docs · shallow versus deep ("only relevant for compound objects"), and the `__copy__` and `__deepcopy__` hooks (*read*) · covers our angle: **full**
- **Beyond the docs:** [copy — Duplicate Objects](https://pymotw.com/3/copy/index.html) · Doug Hellmann, PyMOTW 3, last updated 2018-03-18 · "The memo dictionary is used to keep track of the values that have been copied already, so as to avoid infinite recursion", with a cyclic graph example · fetched 2026-10-13 (*read*)
- **Our delta:** the nested-dict config that two requests accidentally shared.

### T03-09 · Iteration idioms — Master · ✅ written `docs/python/pages/phase-3-collections/09-iteration-idioms/01-what-each-builtin-requires-and-consumes.md`
- **Read this:** [Built-in Functions](https://docs.python.org/3/builtins/functions.html) · Python docs · `enumerate`, `zip` (with `strict`), `reversed`, `any`, `all`, `min`, `max` (*read* `enumerate`) · covers our angle: **full** on the API
- **Also good:** [Avoid indexes in Python](https://www.pythonmorsels.com/avoid-indexes-in-python/) · Trey Hunner, Python Morsels, 2025-06-03 · zip as the replacement for the range(len(...)) loop (*read* that sentence)
- **Beyond the docs:** [Loop Like A Native](https://nedbatchelder.com/text/iter) · Ned Batchelder, created 2012-04-24, last updated 2013-03-19 · the built-in enumerate "takes one iterable, and produces a stream of pairs", and a section on looping over two lists; pre-3.10, so no `strict=` · fetched 2026-10-13 (*read*)
- **Our delta:** what each builtin requires and consumes: iterator exhaustion.

### T03-10 · Sorting compound data — Understand · 🔲 not written (related chunks: `docs/python/pages/phase-3-collections/01-list-internals/08-stability-and-multi-key-sorts.md`)
- **Read this:** [Sorting Techniques](https://docs.python.org/3/howto/sorting.html) · Python docs · key functions, operator module functions, multi-key sorts and stability (*read* the operator section; Sort Stability and Complex Sorts is a listed section) · covers our angle: **full**
- **Also good:** [operator](https://docs.python.org/3/library/operator.html) · Python docs · `itemgetter` and `attrgetter` (*headings only*)
- **Beyond the docs:** [Sorting iterables in Python](https://www.pythonmorsels.com/sorting-in-python/) · Trey Hunner, Python Morsels, 2025-05-07 · explains the key function with a `len` example; no itemgetter, multi-key or stability, so it covers the first step only · fetched 2026-10-13 (*read*)
- **Our delta:** stability as a feature that makes multi-pass sorts work.

### T03-11 · Choosing a structure — Understand · 🔲 not written
- **Read this:** [Python Big O: the time complexities of different data structures](https://www.pythonmorsels.com/time-complexities/) · Trey Hunner, Python Morsels, 2024-04-16 · cost tables for list, deque, dict and set, plus a section on choosing: "Choosing between data structures involves a trade-off between features, speed, and memory usage" (*read*) · covers our angle: **partial** — no "a database or numpy, not a bigger dict" note
- **Also good:** [TimeComplexity](https://wiki.python.org/moin/TimeComplexity) · Python wiki · the reference table (*read*)
- **Beyond the docs:** [Big-O: how code slows as data grows](https://nedbatchelder.com/text/slowsgrows) · Ned Batchelder, created 2017-10-18 · hash lookups against list scans, with a nested-loop quadratic case and the reminder that simple code is often fine for small inputs · fetched 2026-10-13 (*read*)
- **Our delta:** the decision table by lookup, ordering and mutation, and the honest scale note.

### T03-12 · `array` and `memoryview` — When Needed · 🔲 not written
- **Read this:** [array](https://docs.python.org/3/library/array.html) · Python docs · compactly represents an array of basic values; mutable and list-like, but the element type is constrained (*read*) · covers our angle: **partial** — `memoryview` is documented under built-in types
- **Also good:** [Built-in Types: Memory Views](https://docs.python.org/3/builtins/stdtypes.html) · Python docs · "memoryview objects allow Python code to access the internal data of an object that supports the buffer protocol without copying" (*read*)
- **Beyond the docs:** [Less copies in Python with the buffer protocol and memoryviews](https://eli.thegreenplace.net/2011/11/28/less-copies-in-python-with-the-buffer-protocol-and-memoryviews) · Eli Bendersky, 2011-11-28 · a memoryview "uses the buffer protocol beneath the covers to avoid copies", with a slice marked "NO COPY is made here!"; 2011, written for the early Python 3 line · fetched 2026-10-13 (*read*)
- **Our delta:** none yet; the row is for compact numeric storage below numpy.
