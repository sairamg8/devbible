---
title: "Link map · Python · Part 2"
sidebar_label: "02 · Data model"
sidebar_position: 2
---

# Link map · Python · Part 2 (phases 3–6)

Covers every topic row of `docs/python/syllabus/02-data-model.md`: T03-01 to T03-12 (phase 3, collections), T04-01 to T04-15 (phase 4, classes and the data model), T05-01 to T05-10 (phase 5, iterators, generators, context managers), T06-01 to T06-12 (phase 6, typing). That is 49 rows, numbered in table order within each phase.
*read* = the passage behind the claim was read; *headings only* = fetched, headings and keyword counts checked, not read through. docs.python.org, mypy and typing.python.org pages are undated. No `#anchors` are given.

🔴 **Version note.** docs.python.org/3 served the **3.15.0** documentation on 2026-10-12; our brief pins 3.14. Built-in types and functions moved to a `builtins/` section (`library/stdtypes.html` and `library/functions.html` now redirect there; the 3.14 docs use the same layout). Two 3.15-only additions surface on these pages and must not be taught as 3.14: the built-in `sentinel()` (Added in version 3.15) and `frozendict`. mypy's docs render as mypy 2.4.0. Our own pages exist for phase 3 (nine topic folders) and phase 7; phases 4–6 have none yet.
🔴 **Real Python.** Every `realpython.com` URL below returned **403** (a Cloudflare challenge page) to both curl and WebFetch on 2026-10-12, so none was re-verified: titles and dates on those lines are the first researcher's, marked *(not re-verified)*. Wherever a fetched primary source covers the angle it is now the pick; Real Python is kept only as a secondary. Its `python-type-checking` (2019), `python-data-classes` (2018), `python-itertools` (2018) and `python-super` (2019) predate PEP 695, `slots=True`, `kw_only` and `itertools.batched`.

---

## Phase 3 — Collections in depth

### T03-01 · `list` internals — Master · ✅ written `docs/python/pages/phase-3-collections/01-list-internals/`
- **Read this:** [Design and History FAQ](https://docs.python.org/3/faq/design.html) · docs.python.org · "How are lists implemented in CPython?" (a contiguous array of references, over-allocated on growth) and "Why doesn't list.sort() return the sorted list?" (*read*) · covers our angle: **partial** — no Timsort, no Big-O table · fetched 2026-10-12
- **Also good:** [Time complexity of operations on built-in types](https://docs.python.org/3/builtins/time-complexity.html) · docs.python.org · the official per-operation table; its note says inserting at index k moves n - k elements, worst at index 0 (*read*) · fetched 2026-10-12
- **Also good:** [Sorting Techniques](https://docs.python.org/3/howto/sorting.html) · docs.python.org · `list.sort()` returns `None`, sorts are stable, and Timsort exploits existing order (*read*) · fetched 2026-10-12
- **Also good:** [Python's list Data Type: A Deep Dive](https://realpython.com/python-list/) · Real Python, Jul 19, 2023 *(not re-verified)*
- *Checked, not chosen:* `wiki.python.org/moin/TimeComplexity` (200) now carries a banner that the wiki is being archived and edits are discouraged; the docs page above replaces it.
- **Our delta:** the dynamic-array cost story told end to end, and the `x = x.sort()` bug.

### T03-02 · `tuple` — Understand · ✅ written `docs/python/pages/phase-3-collections/02-tuple/`
- **Read this:** [Design and History FAQ](https://docs.python.org/3/faq/design.html) · docs.python.org · "Why are there separate tuple and list data types?": tuples as records or C structs, and a tuple is hashable only if all its elements are (*read*) · covers our angle: **partial** — "dataclass beats a 4-tuple" is not its argument · fetched 2026-10-12
- **Also good:** [Data Structures: Tuples and Sequences](https://docs.python.org/3/tutorial/datastructures.html) · docs.python.org · immutable and heterogeneous versus mutable and homogeneous, plus the one-item `(x,)` quirk (*read*) · fetched 2026-10-12
- **Also good:** [Python's tuple Data Type: A Deep Dive](https://realpython.com/python-tuple/) · Real Python, Oct 4, 2023 *(not re-verified)*
- **Our delta:** when a dataclass wins.

### T03-03 · `dict` and hashability — Master · ✅ written `docs/python/pages/phase-3-collections/03-dict/`
- **Read this:** [Design and History FAQ](https://docs.python.org/3/faq/design.html) · docs.python.org · "Why must dictionary keys be immutable?": a mutated key's hash changes and the entry can no longer be found (*read*) · covers our angle: **partial** — no `setdefault` or merge operators · fetched 2026-10-12
- **Also good:** [Glossary](https://docs.python.org/3/glossary.html) · docs.python.org · the "hashable" entry: needs `__hash__` and `__eq__`; lists and dicts are not hashable, tuples only if their elements are (*read*) · fetched 2026-10-12
- **Also good:** [Dictionaries in Python](https://realpython.com/python-dicts/) · Real Python, Apr 8, 2026 *(not re-verified)*

### T03-04 · `set` and `frozenset` — Master · ✅ written `docs/python/pages/phase-3-collections/04-set-and-frozenset/`
- **Read this:** [Built-in Types: Set Types](https://docs.python.org/3/builtins/stdtypes.html) · docs.python.org · unordered collection of distinct hashable objects; `union`, `difference`, `issubset` and the operator forms (*read* the section opening and method list) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Sets in Python](https://realpython.com/python-sets/) · Real Python, May 5, 2025 *(not re-verified)*

### T03-05 · Slicing deeply — Understand · ✅ written `docs/python/pages/phase-3-collections/05-slicing/`
- **Read this:** [An Informal Introduction to Python](https://docs.python.org/3/tutorial/introduction.html) · docs.python.org · "All slice operations return a new list"; `rgba[:]` is a shallow copy, set against plain assignment aliasing (*read*) · covers our angle: **partial** — short; no step or negative-index rules · fetched 2026-10-12
- **Also good:** [Built-in Types: common sequence operations](https://docs.python.org/3/builtins/stdtypes.html) · docs.python.org · the exact `s[i:j:k]` definition and the negative-index rule (*read* the notes) · fetched 2026-10-12
- *Checked, not chosen:* `realpython.com/python-slice-notation/` (first researcher: a glossary stub).
- **Our delta:** copies versus views, and the tie back to Phase 1 aliasing.

### T03-06 · `collections` module — Master · ✅ written `docs/python/pages/phase-3-collections/06-collections-module/`
- **Read this:** [collections reference](https://docs.python.org/3/library/collections.html) · docs.python.org · `Counter.most_common`, and `deque` appends and pops from either side in approximately O(1) (*read* those entries) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Python's collections: A Buffet of Specialized Data Types](https://realpython.com/python-collections-module/) · Real Python, Jul 26, 2021 *(not re-verified)*

### T03-07 · `heapq` and `bisect` — Understand · ✅ written `docs/python/pages/phase-3-collections/07-heapq-and-bisect/`
- **Read this:** [heapq reference](https://docs.python.org/3/library/heapq.html) · docs.python.org · `nlargest`/`nsmallest` are best for small n, use `sorted()` for large n and `min()`/`max()` for n == 1; plus priority-queue notes (*read*) · covers our angle: **partial** — `heapq` only · fetched 2026-10-12
- **Also good:** [bisect reference](https://docs.python.org/3/library/bisect.html) · docs.python.org · "Searching Sorted Lists" turns the bisect functions into exact-match and nearest lookups (*read*) · fetched 2026-10-12
- **Also good:** [The Python heapq Module](https://realpython.com/python-heapq-module/) · Real Python, Jun 24, 2020 *(not re-verified)*
- **Our delta:** the top-K framing for interview answers.

### T03-08 · `copy` versus `deepcopy` — Understand · ✅ written `docs/python/pages/phase-3-collections/08-copy-and-deepcopy/`
- **Read this:** [copy reference](https://docs.python.org/3/library/copy.html) · docs.python.org · shallow versus deep definitions and the recursive-object caveat that `deepcopy` handles with a memo (*read*) · covers our angle: **partial** — reference style, few nested examples · fetched 2026-10-12
- **Also good:** [Programming FAQ](https://docs.python.org/3/faq/programming.html) · docs.python.org · "Why did changing list 'y' also change list 'x'?" and "How do I copy an object in Python?" (*headings only*) · fetched 2026-10-12
- **Also good:** [How to Copy Objects in Python](https://realpython.com/copying-python-objects/) · Real Python, Sep 27, 2026 *(not re-verified)*

### T03-09 · Iteration idioms — Master · ✅ written `docs/python/pages/phase-3-collections/09-iteration-idioms/`
- **Read this:** [Built-in Functions](https://docs.python.org/3/builtins/functions.html) · docs.python.org · `zip` stops at the shortest iterable and recommends `strict=True` to catch length bugs; `enumerate(start=)`, `reversed`, `all`/`any`, `max(key=)` in one place (*read* the zip entry; others *headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Data Structures: Looping Techniques](https://docs.python.org/3/tutorial/datastructures.html) · docs.python.org · `items()`, `enumerate`, `zip`, `reversed`, `sorted` in loops (*headings only*) · fetched 2026-10-12
- **Also good:** Real Python's [zip()](https://realpython.com/python-zip-function/), [enumerate()](https://realpython.com/python-enumerate/), [min() and max()](https://realpython.com/python-min-and-max/) and [any()](https://realpython.com/python-any/) tutorials *(not re-verified)*

### T03-10 · Sorting compound data — Understand · 🔲 not written (overlaps `docs/python/pages/phase-3-collections/01-list-internals/` sorting chunks 06–09)
- **Read this:** [Sorting Techniques](https://docs.python.org/3/howto/sorting.html) · docs.python.org · `itemgetter(1, 2)` and `attrgetter('grade', 'age')` for multi-key sorts, stability, and multi-pass sorts with mixed `reverse` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [operator reference](https://docs.python.org/3/library/operator.html) · docs.python.org · the exact `itemgetter`/`attrgetter` signatures (*headings only*) · fetched 2026-10-12

### T03-11 · Choosing a structure — Understand · 🔲 not written
- **Read this:** [Time complexity of operations on built-in types](https://docs.python.org/3/builtins/time-complexity.html) · docs.python.org · costs for list, tuple, dict, set, str, memoryview and range side by side, the raw material of a decision table (*headings only*, list section *read*) · covers our angle: **partial** — no decision table, no `deque`, no "use a database or numpy at scale" note · fetched 2026-10-12
- **Also good:** [Data Structures: Using Lists as Queues](https://docs.python.org/3/tutorial/datastructures.html) · docs.python.org · pops from the front are slow; use `collections.deque` (*read*) · fetched 2026-10-12
- **Also good:** [Common Python Data Structures (Guide)](https://realpython.com/python-data-structures/) · Real Python, Aug 26, 2020 *(not re-verified; predates 3.9 syntax)*
- **Our delta:** the decision table itself and the scale caveat.

### T03-12 · `array` and `memoryview` — When Needed · 🔲 not written
- **Read this:** [array reference](https://docs.python.org/3/library/array.html) · docs.python.org · type codes and compact numeric storage, short and exact (*headings only*) · covers our angle: **partial** — `array` only · fetched 2026-10-12
- **Also good:** [Built-in Types: Memory Views](https://docs.python.org/3/builtins/stdtypes.html) · docs.python.org · `memoryview` accesses a buffer-protocol object's data without copying (*read* the opening) · fetched 2026-10-12
- **Our delta:** why you would choose these over a list, and where numpy takes over.

**Gate (phase 3):** no gate-specific page needed; T03-06 serves the `defaultdict`/`Counter` gate.

---

## Phase 4 — Classes and the data model

### T04-01 · Class anatomy, class versus instance attributes — Master · 🔲 not written
- **Read this:** [9. Classes (tutorial)](https://docs.python.org/3/tutorial/classes.html) · docs.python.org · "Class and Instance Variables": the shared `tricks = []` list, "unexpectedly shared by all dogs", and the fix in `__init__` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Programming FAQ](https://docs.python.org/3/faq/programming.html) · docs.python.org · "How do I create static class data": `self.count = 42` creates a new instance attribute that shadows the class one (*read*) · fetched 2026-10-12
- **Also good:** [Python Classes](https://realpython.com/python-classes/) · Real Python, Apr 1, 2026 *(not re-verified)*

### T04-02 · Core dunders: repr/str, eq/hash, len, bool — Master · 🔲 not written
- **Read this:** [3. Data model](https://docs.python.org/3/reference/datamodel.html) · docs.python.org · "Basic customization": a class that overrides `__eq__` without `__hash__` gets `__hash__` set to `None` and becomes unhashable (*read*) · covers our angle: **partial** — reference style · fetched 2026-10-12
- **Also good:** [Python's Magic Methods](https://realpython.com/python-magic-methods/) and [`.__repr__()` vs `.__str__()`](https://realpython.com/python-repr-vs-str/) · Real Python *(not re-verified; first researcher found no `__hash__` in the former)*
- **Our delta:** the object that vanished from a set.

### T04-03 · `@property` — Master · 🔲 not written
- **Read this:** [Built-in Functions: property](https://docs.python.org/3/builtins/functions.html) · docs.python.org · `property(fget, fset, fdel, doc)`, the `@property` decorator and the `.setter`/`.deleter` chain (*read* the entry) · covers our angle: **partial** — no validation walkthrough · fetched 2026-10-12
- **Also good:** [Descriptor Guide](https://docs.python.org/3/howto/descriptor.html) · docs.python.org · the "Properties" section builds `property` in pure Python (*headings only*) · fetched 2026-10-12
- **Also good:** [Python's property()](https://realpython.com/python-property/) · Real Python, Dec 15, 2024 *(not re-verified)*

### T04-04 · `@classmethod` versus `@staticmethod` — Understand · 🔲 not written
- **Read this:** [Built-in Functions: classmethod, staticmethod](https://docs.python.org/3/builtins/functions.html) · docs.python.org · a class method receives the class; the staticmethod entry points to `classmethod` "for creating alternate class constructors" (*read*) · covers our angle: **partial** — terse · fetched 2026-10-12
- **Also good:** [Instance, Class, and Static Methods Demystified](https://realpython.com/instance-class-and-static-methods-demystified/) · Real Python, Mar 17, 2025 *(not re-verified)*

### T04-05 · `dataclasses` — Master · 🔲 not written
- **Read this:** [dataclasses reference](https://docs.python.org/3/library/dataclasses.html) · docs.python.org · `frozen`, `kw_only` and `slots` parameters (both Added in 3.10), `__post_init__`, `default_factory`, and the "Mutable default values" section (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Data Classes in Python (Guide)](https://realpython.com/python-data-classes/) · Real Python, May 18, 2018 *(not re-verified; predates `kw_only` and `slots=True`)*

### T04-06 · Inheritance and `super()` — Understand · 🔲 not written
- **Read this:** [The Python 2.3 Method Resolution Order](https://docs.python.org/3/howto/mro.html) · docs.python.org · Michele Simionato's essay on the C3 algorithm, dense (*headings only*) · covers our angle: **partial** — no cooperative `super()` walkthrough, no "composition over hierarchy" · fetched 2026-10-12
- **Also good:** [Supercharge Your Classes With Python super()](https://realpython.com/python-super/) · Real Python, Feb 12, 2019 *(not re-verified)*
- **Our delta:** cooperative calls, mixins and composition.

### T04-07 · ABCs versus `Protocol` — Understand · 🔲 not written
- **Read this:** [Protocols and structural subtyping](https://typing.python.org/en/latest/reference/protocols.html) · typing.python.org · structural versus nominal, predefined protocols, `runtime_checkable` (*headings only*) · covers our angle: **partial** — Protocol side only · fetched 2026-10-12
- **Also good:** [abc reference](https://docs.python.org/3/library/abc.html) · docs.python.org · `ABC`, `abstractmethod` (*headings only*) · fetched 2026-10-12
- **Also good:** Real Python's [ABCs and Protocols](https://realpython.com/python-interface/) and [Python Protocols](https://realpython.com/python-protocol/) *(not re-verified)*
- **Our delta:** the side-by-side choice.

### T04-08 · Operator overloading and `NotImplemented` — Understand · 🔲 not written
- **Read this:** [3. Data model](https://docs.python.org/3/reference/datamodel.html) · docs.python.org · `NotImplemented` makes the interpreter try the reflected operation; since 3.14 using it in a boolean context raises `TypeError` (*read*) · covers our angle: **partial** — no worked class · fetched 2026-10-12
- **Also good:** [Operator and Function Overloading](https://realpython.com/operator-function-overloading/) · Real Python, May 8, 2018 *(not re-verified; old)*
- **Our delta:** `NotImplemented` versus `NotImplementedError`, and the `Money` example.

### T04-09 · Container protocol — Understand · 🔲 not written
- **Read this:** [3. Data model](https://docs.python.org/3/reference/datamodel.html) · docs.python.org · "Emulating container types": none of the methods come from `object`; sequence versus mapping keys (*read* the opening) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Python's Magic Methods](https://realpython.com/python-magic-methods/) · Real Python *(not re-verified)*

### T04-10 · Pydantic models versus dataclasses — Understand · 🔲 not written
- **Read this:** [Why use Pydantic Validation?](https://pydantic.dev/docs/validation/latest/get-started/why/) · Pydantic docs (undated) · schemas defined by type hints; BaseModel, Pydantic dataclasses, `TypeAdapter` and `validate_call` as the four entry points; vendor view (*read*) · covers our angle: **partial** — no rule for where plain dataclasses belong · fetched 2026-10-12
- **Also good:** [Pydantic: Simplifying Data Validation](https://realpython.com/python-pydantic/) · Real Python, Apr 10, 2024 *(not re-verified)*
- **Our delta:** the boundary-versus-core rule.

### T04-11 · `__slots__` — Know · 🔲 not written
- **Read this:** [3. Data model](https://docs.python.org/3/reference/datamodel.html) · docs.python.org · `__slots__` denies `__dict__`/`__weakref__`; "the space saved … can be significant"; unlisted assignment raises `AttributeError` (*read*) · covers our angle: **partial** — no memory numbers · fetched 2026-10-12
- **Also good:** [Descriptor Guide](https://docs.python.org/3/howto/descriptor.html) · docs.python.org · "Member objects and `__slots__`" (*headings only*) · fetched 2026-10-12
- **Our delta:** per-instance memory and the `slots=True` shortcut.

### T04-12 · `__new__` versus `__init__` — Know · 🔲 not written
- **Read this:** [Programming FAQ](https://docs.python.org/3/faq/programming.html) · docs.python.org · "How can a subclass control what data is stored in an immutable instance?": override `__new__`, with `date`, `int` and `str` subclasses (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [3. Data model](https://docs.python.org/3/reference/datamodel.html) · docs.python.org · `__new__` "is intended mainly to allow subclasses of immutable types … to customize instance creation" (*read*) · fetched 2026-10-12

### T04-13 · Attribute lookup, `__getattr__` versus `__getattribute__` — Know · 🔲 not written
- **Read this:** [3. Data model](https://docs.python.org/3/reference/datamodel.html) · docs.python.org · "Customizing attribute access": `__getattribute__` is called unconditionally, and must call `object.__getattribute__` "to avoid infinite recursion" (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Descriptor Guide](https://docs.python.org/3/howto/descriptor.html) · docs.python.org · "Invocation from an instance": data descriptors, then instance variables, then non-data descriptors, then class variables, then `__getattr__` (*read*) · fetched 2026-10-12

### T04-14 · Descriptors — Know · 🔲 not written
- **Read this:** [Descriptor Guide](https://docs.python.org/3/howto/descriptor.html) · docs.python.org · primer, validator example, then pure-Python equivalents of `property` and methods (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Python Descriptors: An Introduction](https://realpython.com/python-descriptors/) · Real Python, Nov 27, 2019 *(not re-verified)*

### T04-15 · Metaclasses and `__init_subclass__` — When Needed · 🔲 not written
- **Read this:** [3. Data model](https://docs.python.org/3/reference/datamodel.html) · docs.python.org · "Customizing class creation": `__init_subclass__` runs on the parent whenever it is subclassed, unlike a class decorator (*read*) · covers our angle: **partial** — no plugin-registry example · fetched 2026-10-12
- **Also good:** [Python Metaclasses](https://realpython.com/python-metaclasses/) · Real Python, May 1, 2018 *(not re-verified; old)*
- **Our delta:** the plugin-registry use and why `__init_subclass__` usually suffices.

**Gate (phase 4):** no gate-specific page found for an immutable `Money`; T04-05 and T04-08 are the closest.

---

## Phase 5 — Iterators, generators and context managers

### T05-01 · The iteration protocol and the exhaustion trap — Master · 🔲 not written
- **Read this:** [Functional Programming HOWTO](https://docs.python.org/3/howto/functional.html) · docs.python.org · "Iterators": you can only go forward, there is no reset, and a consumed stream needs a new iterator (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Iterators and Iterables in Python](https://realpython.com/python-iterators-iterables/) · Real Python, Jan 6, 2025 *(not re-verified)*

### T05-02 · Generator functions — Master · 🔲 not written
- **Read this:** [Functional Programming HOWTO](https://docs.python.org/3/howto/functional.html) · docs.python.org · the "Generators" section (*headings only*) · covers our angle: **partial** — no large-file example · fetched 2026-10-12
- **Also good:** [How to Use Generators and yield](https://realpython.com/python-generators/) · Real Python, Sep 25, 2019 *(not re-verified)*

### T05-03 · Generator expressions versus list comprehensions — Master · 🔲 not written
- **Read this:** [Functional Programming HOWTO](https://docs.python.org/3/howto/functional.html) · docs.python.org · a genexp computes values as needed, so listcomps are not useful for infinite or very large streams (*read*) · covers our angle: **partial** — no "when you do want the list" side · fetched 2026-10-12
- **Also good:** [Python List Comprehension](https://realpython.com/list-comprehension-python/) · Real Python *(not re-verified)*
- **Our delta:** the decision rule list-versus-generator.

### T05-04 · Pipelines of generators — Understand · 🔲 not written
- **Read this:** [Functional Programming HOWTO](https://docs.python.org/3/howto/functional.html) · docs.python.org · iterators, generators and itertools in one tutorial (*headings only*) · covers our angle: **partial** — no parse-filter-transform log chain · fetched 2026-10-12
- **Also good:** [How to Use Generators and yield](https://realpython.com/python-generators/) · Real Python *(not re-verified; first researcher saw a CSV pipeline)*
- **Our delta:** the constant-memory log pipeline and why `list()` in the middle breaks it.

### T05-05 · `yield from` — Understand · 🔲 not written
- **Read this:** [What's New in Python 3.3](https://docs.python.org/3/whatsnew/3.3.html) · docs.python.org · the PEP 380 section: for simple iterators `yield from iterable` is shorthand for `for item in iterable: yield item`, but it also forwards `send`/`throw` and returns the subgenerator's value; two examples (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [6. Expressions](https://docs.python.org/3/reference/expressions.html) · docs.python.org · "Yield expressions": `yield from` passes values straight to the caller, and `StopIteration.value` becomes its result (*read*) · fetched 2026-10-12
- **Also good:** [PEP 380](https://peps.python.org/pep-0380/) · peps.python.org · the specification (*headings only*) · fetched 2026-10-12
- *Checked, not chosen:* the first researcher's 404s at `realpython.com/python-yield-from/` and `/lessons/python-yield-from/`; a web search found only short tutorials.

### T05-06 · `itertools` — Understand · 🔲 not written
- **Read this:** [itertools reference](https://docs.python.org/3/library/itertools.html) · docs.python.org · `batched` (3.12, `strict=` 3.13), `pairwise` (3.10), and `groupby` needing input sorted on the same key (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Python itertools By Example](https://realpython.com/python-itertools/) · Real Python, May 30, 2018 *(not re-verified; predates `batched` and `pairwise`)*

### T05-07 · Context managers and `@contextmanager` — Master · 🔲 not written
- **Read this:** [contextlib reference](https://docs.python.org/3/library/contextlib.html) · docs.python.org · `@contextmanager` turns a generator into a context manager (*headings only*) · covers our angle: **partial** — not the class-based side · fetched 2026-10-12
- **Also good:** [3. Data model](https://docs.python.org/3/reference/datamodel.html) · docs.python.org · "With Statement Context Managers": `__enter__`/`__exit__` (*read* the opening) · fetched 2026-10-12
- **Also good:** [Python's with Statement](https://realpython.com/python-with-statement/) · Real Python, Aug 13, 2025 *(not re-verified)*

### T05-08 · `contextlib` toolkit — Understand · 🔲 not written
- **Read this:** [contextlib reference](https://docs.python.org/3/library/contextlib.html) · docs.python.org · `closing`, `suppress` and `ExitStack` entries (*headings only*) · covers our angle: full · fetched 2026-10-12

### T05-09 · Sentinel patterns, `count` and `cycle` — Know · 🔲 not written
- **Read this:** [Built-in Functions: iter](https://docs.python.org/3/builtins/functions.html) · docs.python.org · `iter(callable, sentinel)` stops when the call returns the sentinel; the `partial(f.read, 64)` block-reader example (*read*) · covers our angle: **partial** — `count`/`cycle` are on the itertools page · fetched 2026-10-12
- **Also good:** [itertools reference](https://docs.python.org/3/library/itertools.html) · docs.python.org · `count(start, step)` and `cycle` (*headings only*) · fetched 2026-10-12
- **Our delta:** the same page documents a new built-in `sentinel()`, Added in version 3.15; it is not in our 3.14 pin.

### T05-10 · `send`, `throw`, `close` — When Needed · 🔲 not written
- **Read this:** [Functional Programming HOWTO](https://docs.python.org/3/howto/functional.html) · docs.python.org · "Passing values into a generator": `send`, `throw` raises at the paused `yield`, `close` sends `GeneratorExit`, and generators become coroutines (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [PEP 342: Coroutines via Enhanced Generators](https://peps.python.org/pep-0342/) · peps.python.org · the origin of the three methods (*headings only*; it does not mention asyncio) · fetched 2026-10-12

**Gate (phase 5):** no gate-specific page needed; T05-04 and T05-02 serve the constant-memory log gate.

---

## Phase 6 — Typing

### T06-01 · The contract: hints do not execute — Master · 🔲 not written
- **Read this:** [typing module reference](https://docs.python.org/3/library/typing.html) · docs.python.org · opens with "The Python runtime does not enforce function and variable type annotations" (*read* that note) · covers our angle: **partial** — a huge reference, not a gradual-typing guide · fetched 2026-10-12
- **Also good:** [Type hints cheat sheet](https://mypy.readthedocs.io/en/stable/cheat_sheet_py3.html) · mypy docs · fast start for annotating boundaries (*headings only*) · fetched 2026-10-12
- *Checked, not chosen:* [Python Type Checking (Guide)](https://realpython.com/python-type-checking/) · Real Python, Jan 7, 2019 *(not re-verified)* · teaches the pre-3.9 `typing.List` spelling
- **Our delta:** "annotate the boundaries first".

### T06-02 · The working vocabulary — Master · 🔲 not written
- **Read this:** [Type hints cheat sheet](https://mypy.readthedocs.io/en/stable/cheat_sheet_py3.html) · mypy docs · builtin generics such as `list[int]`, `X | None`, unions, return types (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Modernizing Superseded Typing Features](https://typing.python.org/en/latest/guides/modernizing.html) · typing.python.org · old `Optional`/`List` spellings and their modern equivalents (*headings only*) · fetched 2026-10-12

### T06-03 · Running a checker: mypy versus pyright — Understand · 🔲 not written
- **Read this:** [Using mypy with an existing codebase](https://mypy.readthedocs.io/en/stable/existing_code.html) · mypy docs · start small, run in CI, ignore modules, then "Introduce stricter options" (*headings only*) · covers our angle: **partial** — mypy only · fetched 2026-10-12
- **Also good:** [Differences Between Pyright and Mypy](https://microsoft.github.io/pyright/#/mypy-comparison) · Pyright docs · a single-page app (the HTML is near empty); the same text was checked at `raw.githubusercontent.com/microsoft/pyright/main/docs/mypy-comparison.md`, about 3,700 words (*headings only*) · fetched 2026-10-12
- **Also good:** [The mypy configuration file](https://mypy.readthedocs.io/en/stable/config_file.html) · mypy docs · per-module `[mypy-…]` sections and the `strict` flags (*headings only*) · fetched 2026-10-12
- **Our delta:** pick one and put it in CI.

### T06-04 · `TypedDict`, `Literal`, `Final`, `NewType` — Understand · 🔲 not written
- **Read this (1/2):** [TypedDict](https://mypy.readthedocs.io/en/stable/typed_dict.html) · mypy docs · typing a plain JSON dict (*headings only*) · covers our angle: **partial** — `TypedDict` only · fetched 2026-10-12
- **Read this (2/2):** [More types](https://mypy.readthedocs.io/en/stable/more_types.html) · mypy docs · the `NewType` section (*headings only*) · fetched 2026-10-12
- **Also good:** [typing module reference](https://docs.python.org/3/library/typing.html) · docs.python.org · the authoritative `Literal` and `Final` entries (*headings only*) · fetched 2026-10-12
- **Our delta:** `Literal` and `Final` are only lightly covered on mypy's pages.

### T06-05 · `Protocol` — Understand · 🔲 not written
- **Read this:** [Protocols and structural subtyping](https://typing.python.org/en/latest/reference/protocols.html) · typing.python.org · the community reference, including `runtime_checkable` (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Python Protocols](https://realpython.com/python-protocol/) · Real Python, Jul 17, 2024 *(not re-verified)*

### T06-06 · Generics and PEP 695 syntax — Understand · 🔲 not written
- **Read this:** [Generics (mypy)](https://mypy.readthedocs.io/en/stable/generics.html) · mypy docs · `class Stack[T]` and `def first[T](seq: Sequence[T]) -> T` next to the legacy `TypeVar` form, plus "Differences between the new and old syntax" (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [PEP 695: Type Parameter Syntax](https://peps.python.org/pep-0695/) · peps.python.org · the specification; now marked a historical document (*headings only*) · fetched 2026-10-12
- *Checked, not chosen:* [Generics](https://typing.python.org/en/latest/reference/generics.html) · typing.python.org · uses only the `TypeVar`/`Generic[T]` spelling; it has no PEP 695 syntax at all · fetched 2026-10-12
- **Our delta:** reading the pre-3.12 `TypeVar` spelling.

### T06-07 · `Callable` and `ParamSpec` — Understand · 🔲 not written
- **Read this:** [Generics (mypy)](https://mypy.readthedocs.io/en/stable/generics.html) · mypy docs · "Declaring decorators": `def printing_decorator[**P, T](func: Callable[P, T]) -> Callable[P, T]` with `P.args`/`P.kwargs`, and the legacy `ParamSpec('P')` form (*read*) · covers our angle: **partial** — not the `@retry` example · fetched 2026-10-12
- **Also good:** [PEP 612: Parameter Specification Variables](https://peps.python.org/pep-0612/) · peps.python.org · motivated by annotating decorators (*read* the motivation) · fetched 2026-10-12
- **Our delta:** typing the Phase 2 `@retry`.

### T06-08 · `Any` versus `object`, `cast`, `# type: ignore` — Understand · 🔲 not written
- **Read this:** [Dynamically typed code](https://mypy.readthedocs.io/en/stable/dynamic_typing.html) · mypy docs · operations on `Any`, and an "Any vs. object" section (*headings only*) · covers our angle: **partial** — no `cast` here · fetched 2026-10-12
- **Also good:** [Common issues and solutions](https://mypy.readthedocs.io/en/stable/common_issues.html) · mypy docs · `cast` and `# type: ignore` (*headings only*) · fetched 2026-10-12
- **Also good:** [Error codes](https://mypy.readthedocs.io/en/stable/error_codes.html) · mypy docs · the codes to put in `# type: ignore[code]` (*headings only*) · fetched 2026-10-12

### T06-09 · `Self`, `ClassVar`, `overload` — Know · 🔲 not written
- **Read this:** [More types](https://mypy.readthedocs.io/en/stable/more_types.html) · mypy docs · `overload` in depth (*headings only*) · covers our angle: **partial** — no `ClassVar`; `Self` is in mypy's Generics page ("Automatic self types using typing.Self") · fetched 2026-10-12
- **Also good:** [typing module reference](https://docs.python.org/3/library/typing.html) · docs.python.org · `Self`, `ClassVar` and `overload` entries (*headings only*) · fetched 2026-10-12

### T06-10 · Static hints versus runtime validation — Understand · 🔲 not written
- **Read this:** [Why use Pydantic Validation?](https://pydantic.dev/docs/validation/latest/get-started/why/) · Pydantic docs (undated) · type hints define the schema Pydantic validates at runtime, and it works alongside mypy and Pyright; vendor view (*read*) · covers our angle: **partial** — does not argue where the checker suffices · fetched 2026-10-12
- **Also good:** [typing module reference](https://docs.python.org/3/library/typing.html) · docs.python.org · the runtime does not enforce annotations (*read* that note) · fetched 2026-10-12
- **Also good:** [Annotation issues at runtime](https://mypy.readthedocs.io/en/stable/runtime_troubles.html) · mypy docs · forward references, `TYPE_CHECKING`, import cycles: annotations that break at runtime, not validation (*headings only*) · fetched 2026-10-12
- **Our delta:** "checker for your code, Pydantic for other people's data".

### T06-11 · Stubs: `.pyi`, typeshed, `py.typed` — Know · 🔲 not written
- **Read this:** [Typing Python Libraries](https://typing.python.org/en/latest/guides/libraries.html) · typing.python.org · `py.typed` and what library authors ship (*headings only*) · covers our angle: **partial** — written for authors, less for consumers · fetched 2026-10-12
- **Also good:** [Running mypy and managing imports](https://mypy.readthedocs.io/en/stable/running_mypy.html) · mypy docs · missing stubs, typeshed and `py.typed` from the consumer side (*headings only*) · fetched 2026-10-12
- **Also good:** [Writing and Maintaining Stub Files](https://typing.python.org/en/latest/guides/writing_stubs.html) · typing.python.org · `.pyi` conventions (*headings only*) · fetched 2026-10-12

### T06-12 · Variance — When Needed · 🔲 not written
- **Read this:** [Generics (mypy)](https://mypy.readthedocs.io/en/stable/generics.html) · mypy docs · "Variance of generic types": covariant, contravariant and invariant defined, with `Shape`/`Triangle` examples (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [PEP 695: Type Parameter Syntax](https://peps.python.org/pep-0695/) · peps.python.org · "Variance Inference" for the new syntax (*headings only*) · fetched 2026-10-12

**Gate (phase 6):** no gate-specific page needed; T06-07 and T06-03 are the closest.
