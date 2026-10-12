---
title: "Link map · Python · Part 2"
sidebar_label: "02 · Data model"
sidebar_position: 2
---

# Link map · Python · Part 2 (phases 3–6)

Covers every topic row of `docs/python/syllabus/02-data-model.md`: T03-01 to T03-12 (phase 3, collections), T04-01 to T04-15 (phase 4, classes and the data model), T05-01 to T05-10 (phase 5, iterators, generators, context managers), T06-01 to T06-12 (phase 6, typing). That is 49 rows, numbered in table order within each phase.
*headings only* = fetched with a browser User-Agent; title, date, size and keyword counts checked, not read through. No page below was read end to end, so "covers our angle" is judged from those counts and headings. Third-party links carry the page's own date where it shows one; docs.python.org, mypy and typing.python.org pages are undated and currently render as Python 3.15 / mypy 2.4. No `#anchors` are given.

🔴 **Version note.** docs.python.org/3 served the 3.15.0 documentation on 2026-10-12; our brief pins 3.14. The corpus's own pages only ever reach `phase-3-collections` (nine topic folders) so far; phases 4–6 are not written.
Real Python's `python-type-checking` (2019), `python-data-classes` (2018), `python-itertools` (2018) and `python-super` (2019) predate PEP 695, `slots=True`, `kw_only` and `itertools.batched`; they are flagged where used. The pyright docs site is a single-page app (the fetched HTML is about 56 words), so its mypy-comparison text was checked on the source file instead.

---

## Phase 3 — Collections in depth

### T03-01 · `list` internals — Master · ✅ written `docs/python/pages/phase-3-collections/01-list-internals/`
- **Read this:** [Python's list Data Type: A Deep Dive](https://realpython.com/python-list/) · Real Python, Jul 19, 2023 · the fullest single walk through list behaviour, with sorting and slicing sections (*headings only*) · covers our angle: **partial** — Timsort is not mentioned; the `insert(0, …)` cost and the `x = x.sort()` bug were not confirmed · fetched 2026-10-12
- **Also good:** [TimeComplexity](https://wiki.python.org/moin/TimeComplexity) · Python wiki (undated) · the per-operation Big-O table for list, deque, set and dict (*headings only*) · fetched 2026-10-12
- **Also good:** [Sorting Techniques](https://docs.python.org/3/howto/sorting.html) · docs.python.org · `sorted` versus `.sort()`, key functions and stability, from the CPython authors (*headings only*) · fetched 2026-10-12
- **Our delta:** the dynamic-array cost story and the `None`-return bug; the wiki table is CPython-specific and undated.

### T03-02 · `tuple` — Understand · ✅ written `docs/python/pages/phase-3-collections/02-tuple/`
- **Read this:** [Python's tuple Data Type: A Deep Dive](https://realpython.com/python-tuple/) · Real Python, Oct 4, 2023 · immutability, packing, unpacking, named tuples in one place (*headings only*) · covers our angle: **partial** — "dataclass beats a 4-tuple" is not its argument · fetched 2026-10-12
- **Also good:** [Data Structures: Tuples and Sequences](https://docs.python.org/3/tutorial/datastructures.html) · docs.python.org · the official tutorial's short tuple section (*headings only*) · fetched 2026-10-12
- **Our delta:** hashability only if contents are, and when a dataclass wins.

### T03-03 · `dict` and hashability — Master · ✅ written `docs/python/pages/phase-3-collections/03-dict/`
- **Read this:** [Dictionaries in Python](https://realpython.com/python-dicts/) · Real Python, Apr 8, 2026 · recent, covers `setdefault`, merging, ordering and hashable keys (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Glossary: hashable](https://docs.python.org/3/glossary.html) · docs.python.org · the exact definition of hashable, which is why a list cannot be a key (*headings only*) · fetched 2026-10-12

### T03-04 · `set` and `frozenset` — Master · ✅ written `docs/python/pages/phase-3-collections/04-set-and-frozenset/`
- **Read this:** [Sets in Python](https://realpython.com/python-sets/) · Real Python, May 5, 2025 · operators and methods for union, difference and friends, plus `frozenset` (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Built-in Types: Set Types](https://docs.python.org/3/library/stdtypes.html) · docs.python.org · the authoritative operator and method list (*headings only*) · fetched 2026-10-12

### T03-05 · Slicing deeply — Understand · ✅ written `docs/python/pages/phase-3-collections/05-slicing/`
- **Read this:** [Python's list Data Type: A Deep Dive](https://realpython.com/python-list/) · Real Python, Jul 19, 2023 · slicing is its most-mentioned topic (about 86 hits), including slice assignment (*headings only*) · covers our angle: **partial** — no dedicated slicing article was fetchable; the slice-as-copy versus aliasing point is not confirmed · fetched 2026-10-12
- **Also good:** [Built-in Types: common sequence operations](https://docs.python.org/3/library/stdtypes.html) · docs.python.org · the exact `s[i:j:k]` semantics and negative-index rules (*headings only*) · fetched 2026-10-12
- *Checked, not chosen:* `realpython.com/python-slice-notation/` redirects to a short glossary stub (about 2,600 words), not an article.
- **Our delta:** copies versus views, and the tie back to Phase 1 aliasing.

### T03-06 · `collections` module — Master · ✅ written `docs/python/pages/phase-3-collections/06-collections-module/`
- **Read this:** [Python's collections: A Buffet of Specialized Data Types](https://realpython.com/python-collections-module/) · Real Python, Jul 26, 2021 · all five of ours: `defaultdict`, `Counter`, `deque`, `namedtuple`, `ChainMap` (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [collections reference](https://docs.python.org/3/library/collections.html) · docs.python.org · includes the `most_common` and `deque` complexity notes (*headings only*) · fetched 2026-10-12

### T03-07 · `heapq` and `bisect` — Understand · ✅ written `docs/python/pages/phase-3-collections/07-heapq-and-bisect/`
- **Read this:** [The Python heapq Module](https://realpython.com/python-heapq-module/) · Real Python, Jun 24, 2020 · heaps and priority queues, with `heappush` examples (*headings only*) · covers our angle: **partial** — `nlargest` is barely mentioned, and `bisect` is not covered · fetched 2026-10-12
- **Also good:** [bisect reference](https://docs.python.org/3/library/bisect.html) · docs.python.org · a short page with the searching and sorted-insert examples (*headings only*) · fetched 2026-10-12
- **Our delta:** the top-K framing and `bisect` as binary search on sorted data.

### T03-08 · `copy` versus `deepcopy` — Understand · ✅ written `docs/python/pages/phase-3-collections/08-copy-and-deepcopy/`
- **Read this:** [How to Copy Objects in Python: Shallow vs Deep Copy Explained](https://realpython.com/copying-python-objects/) · Real Python, Sep 27, 2026 · recent, with nested-structure examples (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [copy reference](https://docs.python.org/3/library/copy.html) · docs.python.org · the shallow/deep definitions and the recursive-object caveat (*headings only*) · fetched 2026-10-12

### T03-09 · Iteration idioms — Master · ✅ written `docs/python/pages/phase-3-collections/09-iteration-idioms/`
- **Read this (1/2):** [Using the Python zip() Function for Parallel Iteration](https://realpython.com/python-zip-function/) · Real Python, Nov 17, 2024 · covers `strict=True` (about 9 hits) (*headings only*) · covers our angle: **partial** — `zip` only · fetched 2026-10-12
- **Read this (2/2):** [Python enumerate()](https://realpython.com/python-enumerate/) · Real Python, Jun 23, 2025 · counters and `start=` (*headings only*) · fetched 2026-10-12
- **Also good:** [Python's min() and max()](https://realpython.com/python-min-and-max/) · Real Python, Jan 18, 2025 · the `key=` argument (*headings only*) · fetched 2026-10-12
- **Also good:** [How to Use any() in Python](https://realpython.com/python-any/) · Real Python, Mar 30, 2020 · `any` only; `all` is by implication (*headings only*) · fetched 2026-10-12
- **Our delta:** `reversed`, `all`, and the stop-at-shortest trap.

### T03-10 · Sorting compound data — Understand · 🔲 not written (overlaps `docs/python/pages/phase-3-collections/01-list-internals/` sorting chunks 06–09)
- **Read this:** [Sorting Techniques](https://docs.python.org/3/howto/sorting.html) · docs.python.org · `itemgetter`/`attrgetter`, multi-key sorts and stability (about 8 `itemgetter` hits) (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [operator reference](https://docs.python.org/3/library/operator.html) · docs.python.org · the exact `itemgetter`/`attrgetter` signatures (*headings only*) · fetched 2026-10-12

### T03-11 · Choosing a structure — Understand · 🔲 not written
- **Read this:** [Common Python Data Structures (Guide)](https://realpython.com/python-data-structures/) · Real Python, Aug 26, 2020 · a tour of list, tuple, dict, set, deque and more with trade-offs (*headings only*) · covers our angle: **partial** — no decision table by lookup/order/mutation, and no "use a database or numpy at scale" note · fetched 2026-10-12
- **Our delta:** the decision table itself and the scale caveat; the page predates 3.9 syntax.

### T03-12 · `array` and `memoryview` — When Needed · 🔲 not written
- **Read this:** [array reference](https://docs.python.org/3/library/array.html) · docs.python.org · type codes and compact numeric storage, short and exact (*headings only*) · covers our angle: **partial** — `array` only · fetched 2026-10-12
- **Also good:** [Built-in Types: memoryview](https://docs.python.org/3/library/stdtypes.html) · docs.python.org · about 64 hits for `memoryview`, the buffer-sharing semantics (*headings only*) · fetched 2026-10-12
- **Our delta:** why you would choose these over a list, and where numpy takes over.

**Gate (phase 3):** no gate-specific page needed; T03-06 serves the `defaultdict`/`Counter` gate.

---

## Phase 4 — Classes and the data model

### T04-01 · Class anatomy, class versus instance attributes — Master · 🔲 not written
- **Read this:** [9. Classes (tutorial)](https://docs.python.org/3/tutorial/classes.html) · docs.python.org · its "Class and Instance Variables" section uses the shared-list `tricks` example, exactly our trap (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Python Classes: The Power of Object-Oriented Programming](https://realpython.com/python-classes/) · Real Python, Apr 1, 2026 · recent, about 36 mentions of class attributes (*headings only*) · fetched 2026-10-12

### T04-02 · Core dunders: repr/str, eq/hash, len, bool — Master · 🔲 not written
- **Read this:** [Python's Magic Methods](https://realpython.com/python-magic-methods/) · Real Python, Jan 3, 2024 · a tour of the common dunders (*headings only*) · covers our angle: **partial** — `__hash__` is never mentioned, so the eq/hash pair is missing · fetched 2026-10-12
- **Also good:** [When Should You Use .__repr__() vs .__str__()](https://realpython.com/python-repr-vs-str/) · Real Python, Oct 20, 2025 · repr for developers, str for users (*headings only*) · fetched 2026-10-12
- **Also good:** [3. Data model](https://docs.python.org/3/reference/datamodel.html) · docs.python.org · the normative `__hash__` rules when you define `__eq__` (about 27 hits) (*headings only*) · fetched 2026-10-12
- **Our delta:** the object that vanished from a set.

### T04-03 · `@property` — Master · 🔲 not written
- **Read this:** [Python's property(): Add Managed Attributes](https://realpython.com/python-property/) · Real Python, Dec 15, 2024 · setters, deleters, validation (*headings only*) · covers our angle: full · fetched 2026-10-12

### T04-04 · `@classmethod` versus `@staticmethod` — Understand · 🔲 not written
- **Read this:** [Instance, Class, and Static Methods Demystified](https://realpython.com/instance-class-and-static-methods-demystified/) · Real Python, Mar 17, 2025 · the three method kinds side by side (*headings only*) · covers our angle: full · fetched 2026-10-12

### T04-05 · `dataclasses` — Master · 🔲 not written
- **Read this:** [dataclasses reference](https://docs.python.org/3/library/dataclasses.html) · docs.python.org · current: `kw_only`, `slots`, `frozen`, `__post_init__` and `default_factory` all documented (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Data Classes in Python (Guide)](https://realpython.com/python-data-classes/) · Real Python, May 18, 2018 · gentler tutorial, but old: flag it for `kw_only` and `slots=True`, which it barely touches (*headings only*) · fetched 2026-10-12

### T04-06 · Inheritance and `super()` — Understand · 🔲 not written
- **Read this:** [Supercharge Your Classes With Python super()](https://realpython.com/python-super/) · Real Python, Feb 12, 2019 · MRO and cooperative calls (old; the semantics have not changed) (*headings only*) · covers our angle: **partial** — no "composition over hierarchy" argument · fetched 2026-10-12
- **Also good:** [The Python 2.3 Method Resolution Order](https://docs.python.org/3/howto/mro.html) · docs.python.org · the C3 algorithm itself, dense (*headings only*) · fetched 2026-10-12
- **Our delta:** mixins and composition.

### T04-07 · ABCs versus `Protocol` — Understand · 🔲 not written
- **Read this:** [Implementing Interfaces in Python: ABCs and Protocols](https://realpython.com/python-interface/) · Real Python, Jun 15, 2026 · both approaches in one recent article (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Python Protocols: Leveraging Structural Subtyping](https://realpython.com/python-protocol/) · Real Python, Jul 17, 2024 · nominal versus structural and `runtime_checkable` (*headings only*) · fetched 2026-10-12

### T04-08 · Operator overloading and `NotImplemented` — Understand · 🔲 not written
- **Read this:** [Operator and Function Overloading in Custom Python Classes](https://realpython.com/operator-function-overloading/) · Real Python, May 8, 2018 · arithmetic dunders (*headings only*) · covers our angle: **partial** — no `NotImplemented` and no reflected-operator coverage by keyword count; old · fetched 2026-10-12
- **Also good:** [3. Data model](https://docs.python.org/3/reference/datamodel.html) · docs.python.org · the reflected operands and `NotImplemented` rules (about 20 hits) (*headings only*) · fetched 2026-10-12
- **Our delta:** `NotImplemented` versus `NotImplementedError`, and the `Money` example.

### T04-09 · Container protocol — Understand · 🔲 not written
- **Read this:** [Python's Magic Methods](https://realpython.com/python-magic-methods/) · Real Python, Jan 3, 2024 · `__contains__` (about 11 hits), `__getitem__`, `__len__` (*headings only*) · covers our angle: **partial** — `__setitem__` and `__iter__` as a set were not checked · fetched 2026-10-12
- **Also good:** [3. Data model](https://docs.python.org/3/reference/datamodel.html) · docs.python.org · "emulating container types" is the authoritative list (*headings only*) · fetched 2026-10-12

### T04-10 · Pydantic models versus dataclasses — Understand · 🔲 not written
- **Read this:** [Why use Pydantic Validation?](https://docs.pydantic.dev/latest/why/) · Pydantic docs (undated) · the library's own case for validation at the boundary; vendor view (*headings only*) · covers our angle: **partial** — no rule for where plain dataclasses belong · fetched 2026-10-12
- **Also good:** [Pydantic: Simplifying Data Validation in Python](https://realpython.com/python-pydantic/) · Real Python, Apr 10, 2024 · an independent tutorial (*headings only*) · fetched 2026-10-12
- **Our delta:** the boundary-versus-core rule.

### T04-11 · `__slots__` — Know · 🔲 not written
- **Read this:** [3. Data model](https://docs.python.org/3/reference/datamodel.html) · docs.python.org · the normative `__slots__` section (about 27 hits) (*headings only*) · covers our angle: **partial** — dry; no memory numbers · fetched 2026-10-12
- **Also good:** [Python Classes: The Power of Object-Oriented Programming](https://realpython.com/python-classes/) · Real Python, Apr 1, 2026 · about 16 mentions of slots (*headings only*) · fetched 2026-10-12
- *Checked, not chosen:* `realpython.com/python-slots/` returned 404.
- **Our delta:** per-instance memory and the `slots=True` shortcut.

### T04-12 · `__new__` versus `__init__` — Know · 🔲 not written
- **Read this:** [3. Data model](https://docs.python.org/3/reference/datamodel.html) · docs.python.org · `object.__new__` and its relation to `__init__` (about 19 hits) (*headings only*) · covers our angle: **partial** — nothing on subclassing immutable types · fetched 2026-10-12
- **Also good:** [Python's Magic Methods](https://realpython.com/python-magic-methods/) · Real Python, Jan 3, 2024 · about 18 mentions of `__new__` (*headings only*) · fetched 2026-10-12
- *Checked, not chosen:* `realpython.com/python-new-method/` returned 404.

### T04-13 · Attribute lookup, `__getattr__` versus `__getattribute__` — Know · 🔲 not written
- **Read this:** [Descriptor Guide](https://docs.python.org/3/howto/descriptor.html) · docs.python.org · how lookup order and `__getattribute__` actually work (about 18 hits) (*headings only*) · covers our angle: **partial** — the infinite-recursion trap is not confirmed · fetched 2026-10-12
- **Also good:** [3. Data model](https://docs.python.org/3/reference/datamodel.html) · docs.python.org · "customizing attribute access" is the definition of fallback versus total (*headings only*) · fetched 2026-10-12
- *Checked, not chosen:* `realpython.com/python-getattr-getattribute/` returned 404.

### T04-14 · Descriptors — Know · 🔲 not written
- **Read this:** [Descriptor Guide](https://docs.python.org/3/howto/descriptor.html) · docs.python.org · Raymond Hettinger's guide, builds `property` and methods from scratch (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Python Descriptors: An Introduction](https://realpython.com/python-descriptors/) · Real Python, Nov 27, 2019 · a gentler start before the HOWTO (*headings only*) · fetched 2026-10-12

### T04-15 · Metaclasses and `__init_subclass__` — When Needed · 🔲 not written
- **Read this:** [3. Data model](https://docs.python.org/3/reference/datamodel.html) · docs.python.org · "customizing class creation" covers `__init_subclass__` (about 10 hits) (*headings only*) · covers our angle: **partial** — reference style, no plugin-registry example · fetched 2026-10-12
- **Also good:** [Python Metaclasses](https://realpython.com/python-metaclasses/) · Real Python, May 1, 2018 · old; does not mention `__init_subclass__` (*headings only*) · fetched 2026-10-12
- **Our delta:** the plugin-registry use and why `__init_subclass__` usually suffices.

**Gate (phase 4):** no gate-specific page found for an immutable `Money`; T04-05 and T04-08 are the closest.

---

## Phase 5 — Iterators, generators and context managers

### T05-01 · The iteration protocol and the exhaustion trap — Master · 🔲 not written
- **Read this:** [Iterators and Iterables in Python](https://realpython.com/python-iterators-iterables/) · Real Python, Jan 6, 2025 · `__iter__`, `StopIteration` (about 21 hits), exhaustion (*headings only*) · covers our angle: full · fetched 2026-10-12

### T05-02 · Generator functions — Master · 🔲 not written
- **Read this:** [How to Use Generators and yield in Python](https://realpython.com/python-generators/) · Real Python, Sep 25, 2019 · lazy evaluation, state between yields, large-file reading (*headings only*) · covers our angle: full · fetched 2026-10-12
- *Checked, not chosen:* `realpython.com/introduction-to-python-generators/` serves the identical page.

### T05-03 · Generator expressions versus list comprehensions — Master · 🔲 not written
- **Read this:** [How to Use Generators and yield in Python](https://realpython.com/python-generators/) · Real Python, Sep 25, 2019 · about 21 mentions of generator expressions (*headings only*) · covers our angle: **partial** — the `sum(x.total for x in orders)` and "when you do want the list" angle is not confirmed · fetched 2026-10-12
- **Also good:** [Python List Comprehension](https://realpython.com/list-comprehension-python/) · Real Python (page date not shown) · memory discussion (about 9 hits), one mention of generator expressions (*headings only*) · fetched 2026-10-12
- **Our delta:** the decision rule list-versus-generator.

### T05-04 · Pipelines of generators — Understand · 🔲 not written
- **Read this:** [How to Use Generators and yield in Python](https://realpython.com/python-generators/) · Real Python, Sep 25, 2019 · about 12 mentions of "pipeline", a worked CSV example (*headings only*) · covers our angle: **partial** — not a log-processing parse-filter-transform chain · fetched 2026-10-12
- **Also good:** [Functional Programming HOWTO](https://docs.python.org/3/howto/functional.html) · docs.python.org · generators and iterators composed lazily (*headings only*) · fetched 2026-10-12
- **Our delta:** the constant-memory log pipeline and why `list()` in the middle breaks it.

### T05-05 · `yield from` — Understand · 🔲 not written
- **Read this:** none found — tried: `realpython.com/python-yield-from/`, `realpython.com/lessons/python-yield-from/` (both 404), the Real Python `yield` keyword and generators pages (no `yield from` text), the expressions reference (no hit). For the spec only: [PEP 380](https://peps.python.org/pep-0380/) (a specification, not an explanation) · fetched 2026-10-12
- **Also good:** [What's New in Python 3.3](https://docs.python.org/3/whatsnew/3.3.html) · docs.python.org · the original announcement, with a short example (*headings only*) · fetched 2026-10-12

### T05-06 · `itertools` — Understand · 🔲 not written
- **Read this:** [itertools reference](https://docs.python.org/3/library/itertools.html) · docs.python.org · current: documents `batched` and `pairwise`, and the `groupby` sorted-input rule (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Python itertools By Example](https://realpython.com/python-itertools/) · Real Python, May 30, 2018 · friendlier, about 15 `groupby` hits, but old: it predates `batched` (3.12) and `pairwise` (*headings only*) · fetched 2026-10-12

### T05-07 · Context managers and `@contextmanager` — Master · 🔲 not written
- **Read this:** [Python's with Statement: Manage External Resources Safely](https://realpython.com/python-with-statement/) · Real Python, Aug 13, 2025 · `__enter__`/`__exit__` (about 35 hits) and `contextmanager` (*headings only*) · covers our angle: full · fetched 2026-10-12

### T05-08 · `contextlib` toolkit — Understand · 🔲 not written
- **Read this:** [contextlib reference](https://docs.python.org/3/library/contextlib.html) · docs.python.org · `suppress`, `closing` and `ExitStack` (about 36 hits) (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Python's with Statement](https://realpython.com/python-with-statement/) · Real Python, Aug 13, 2025 · no `ExitStack`, one `suppress` mention (*headings only*) · fetched 2026-10-12

### T05-09 · Sentinel patterns, `count` and `cycle` — Know · 🔲 not written
- **Read this:** [Built-in functions: iter](https://docs.python.org/3/library/functions.html) · docs.python.org · the two-argument `iter(callable, sentinel)` form with a file-reading example (*headings only*) · covers our angle: **partial** — `count`/`cycle` are on the itertools page · fetched 2026-10-12
- **Also good:** [itertools reference](https://docs.python.org/3/library/itertools.html) · docs.python.org · `count` and `cycle` (*headings only*) · fetched 2026-10-12

### T05-10 · `send`, `throw`, `close` — When Needed · 🔲 not written
- **Read this:** [PEP 342: Coroutines via Enhanced Generators](https://peps.python.org/pep-0342/) · peps.python.org · the origin of the three methods and why asyncio grew from them; a spec, so the history is the explanation (*headings only*) · covers our angle: **partial** — no tutorial voice · fetched 2026-10-12
- **Also good:** [How to Use Generators and yield in Python](https://realpython.com/python-generators/) · Real Python, Sep 25, 2019 · about 16 mentions of `send` (*headings only*) · fetched 2026-10-12

**Gate (phase 5):** no gate-specific page needed; T05-04 and T05-02 serve the constant-memory log gate.

---

## Phase 6 — Typing

### T06-01 · The contract: hints do not execute — Master · 🔲 not written
- **Read this:** [typing module reference](https://docs.python.org/3/library/typing.html) · docs.python.org · states the runtime does not enforce annotations (one explicit hit) (*headings only*) · covers our angle: **partial** — a huge reference, not a gradual-typing guide · fetched 2026-10-12
- **Also good:** [Type hints cheat sheet](https://mypy.readthedocs.io/en/stable/cheat_sheet_py3.html) · mypy docs · fast start for annotating boundaries (*headings only*) · fetched 2026-10-12
- *Checked, not chosen:* [Python Type Checking (Guide)](https://realpython.com/python-type-checking/) · Real Python, Jan 7, 2019 · long and well loved but pre-3.9 syntax (`typing.List`), so it teaches the old spelling · fetched 2026-10-12
- **Our delta:** "annotate the boundaries first".

### T06-02 · The working vocabulary — Master · 🔲 not written
- **Read this:** [Type hints cheat sheet](https://mypy.readthedocs.io/en/stable/cheat_sheet_py3.html) · mypy docs · builtin generics, `X | None`, unions, return types (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Modernizing Superseded Typing Features](https://typing.python.org/en/latest/guides/modernizing.html) · typing.python.org · the old `Optional`/`List` spellings and their modern equivalents (*headings only*) · fetched 2026-10-12

### T06-03 · Running a checker: mypy versus pyright — Understand · 🔲 not written
- **Read this:** [Using mypy with an existing codebase](https://mypy.readthedocs.io/en/stable/existing_code.html) · mypy docs · the incremental, per-module path to `strict` (*headings only*) · covers our angle: **partial** — mypy only · fetched 2026-10-12
- **Also good:** [Differences Between Pyright and Mypy](https://microsoft.github.io/pyright/#/mypy-comparison) · Pyright docs · the maintainers' own comparison; the page is a single-page app, so I checked the same text in its source file, about 3,700 words (*headings only*) · fetched 2026-10-12
- **Also good:** [The mypy configuration file](https://mypy.readthedocs.io/en/stable/config_file.html) · mypy docs · per-module sections and the `strict` flags (about 13 hits) (*headings only*) · fetched 2026-10-12
- **Our delta:** pick one and put it in CI.

### T06-04 · `TypedDict`, `Literal`, `Final`, `NewType` — Understand · 🔲 not written
- **Read this (1/2):** [TypedDict](https://mypy.readthedocs.io/en/stable/typed_dict.html) · mypy docs · typing a plain JSON dict (*headings only*) · covers our angle: **partial** — `TypedDict` only · fetched 2026-10-12
- **Read this (2/2):** [More types](https://mypy.readthedocs.io/en/stable/more_types.html) · mypy docs · the `NewType` section (about 20 hits) (*headings only*) · fetched 2026-10-12
- **Also good:** [typing module reference](https://docs.python.org/3/library/typing.html) · docs.python.org · the authoritative `Literal` and `Final` entries (*headings only*) · fetched 2026-10-12
- **Our delta:** `Literal` and `Final` are only lightly covered on mypy's pages.

### T06-05 · `Protocol` — Understand · 🔲 not written
- **Read this:** [Protocols and structural subtyping](https://typing.python.org/en/latest/reference/protocols.html) · typing.python.org · the community reference, including `runtime_checkable` (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Python Protocols: Leveraging Structural Subtyping](https://realpython.com/python-protocol/) · Real Python, Jul 17, 2024 · a tutorial voice with runtime limits (*headings only*) · fetched 2026-10-12

### T06-06 · Generics and PEP 695 syntax — Understand · 🔲 not written
- **Read this:** [Generics](https://typing.python.org/en/latest/reference/generics.html) · typing.python.org · covers `TypeVar` and the new syntax (*headings only*) · covers our angle: **partial** — the `def first[T]` example was not found by text search; confirm the PEP 695 section before relying on it · fetched 2026-10-12
- **Also good:** [PEP 695: Type Parameter Syntax](https://peps.python.org/pep-0695/) · peps.python.org · the specification, with `type` aliases and the old-versus-new comparison (*headings only*) · fetched 2026-10-12
- **Our delta:** reading the pre-3.12 `TypeVar` spelling.

### T06-07 · `Callable` and `ParamSpec` — Understand · 🔲 not written
- **Read this:** [Generics (mypy)](https://mypy.readthedocs.io/en/stable/generics.html) · mypy docs · "declaring decorators" with `ParamSpec` (about 34 mentions of decorator) (*headings only*) · covers our angle: **partial** — not the `@retry` example · fetched 2026-10-12
- **Also good:** [PEP 612: Parameter Specification Variables](https://peps.python.org/pep-0612/) · peps.python.org · the motivation is a typed decorator, our case (*headings only*) · fetched 2026-10-12
- **Our delta:** typing the Phase 2 `@retry`.

### T06-08 · `Any` versus `object`, `cast`, `# type: ignore` — Understand · 🔲 not written
- **Read this:** [Dynamically typed code](https://mypy.readthedocs.io/en/stable/dynamic_typing.html) · mypy docs · how `Any` switches checking off (*headings only*) · covers our angle: **partial** — no `cast` here · fetched 2026-10-12
- **Also good:** [Common issues and solutions](https://mypy.readthedocs.io/en/stable/common_issues.html) · mypy docs · `cast` and `# type: ignore` (about 6 and 4 hits) (*headings only*) · fetched 2026-10-12
- **Also good:** [Error codes](https://mypy.readthedocs.io/en/stable/error_codes.html) · mypy docs · the codes to put in `# type: ignore[code]` (*headings only*) · fetched 2026-10-12

### T06-09 · `Self`, `ClassVar`, `overload` — Know · 🔲 not written
- **Read this:** [More types](https://mypy.readthedocs.io/en/stable/more_types.html) · mypy docs · `overload` in depth (about 89 hits) (*headings only*) · covers our angle: **partial** — `ClassVar` is absent and `Self` is thin · fetched 2026-10-12
- **Also good:** [typing module reference](https://docs.python.org/3/library/typing.html) · docs.python.org · `Self`, `ClassVar` and `overload` entries (*headings only*) · fetched 2026-10-12

### T06-10 · Static hints versus runtime validation — Understand · 🔲 not written
- **Read this:** [Why use Pydantic Validation?](https://docs.pydantic.dev/latest/why/) · Pydantic docs (undated) · the runtime-validation side of the argument; vendor view (*headings only*) · covers our angle: **partial** — does not contrast with the checker · fetched 2026-10-12
- **Also good:** [Runtime annotation issues](https://mypy.readthedocs.io/en/stable/runtime_troubles.html) · mypy docs · what annotations do and do not do at runtime (*headings only*) · fetched 2026-10-12
- **Our delta:** "checker for your code, Pydantic for other people's data".

### T06-11 · Stubs: `.pyi`, typeshed, `py.typed` — Know · 🔲 not written
- **Read this:** [Typing Python Libraries](https://typing.python.org/en/latest/guides/libraries.html) · typing.python.org · `py.typed` (about 6 hits) and what library authors ship (*headings only*) · covers our angle: **partial** — written for authors, less for consumers of `Any` imports · fetched 2026-10-12
- **Also good:** [Running mypy and managing imports](https://mypy.readthedocs.io/en/stable/running_mypy.html) · mypy docs · missing stubs, typeshed and `py.typed` from the consumer side (*headings only*) · fetched 2026-10-12
- **Also good:** [Writing and Maintaining Stub Files](https://typing.python.org/en/latest/guides/writing_stubs.html) · typing.python.org · `.pyi` conventions (*headings only*) · fetched 2026-10-12

### T06-12 · Variance — When Needed · 🔲 not written
- **Read this:** [Generics (mypy)](https://mypy.readthedocs.io/en/stable/generics.html) · mypy docs · "variance of generic types", invariant and contravariant (about 25 hits) (*headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [PEP 695: Type Parameter Syntax](https://peps.python.org/pep-0695/) · peps.python.org · inferred variance in the new syntax (about 69 hits) (*headings only*) · fetched 2026-10-12

**Gate (phase 6):** no gate-specific page needed; T06-07 and T06-03 are the closest.
