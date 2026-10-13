---
title: "Link map · Python · Part 3 (phases 4–5)"
sidebar_label: "03 · classes and iteration"
sidebar_position: 3
---

# Link map · Python · Part 3 (phases 4–5)

Covers every topic row of `docs/python/syllabus/02-data-model.md` in phase 4 (T04-01 to T04-15, classes and the data model) and phase 5 (T05-01 to T05-10, iterators, generators and context managers). That is 25 rows. None of them has a written page yet (`docs/python/pages/` holds phases 0, 1, 2, 3 and 7 only), so every block reads 🔲 not written.
*read* = I read the passage; *headings only* = fetched, section list or summary checked. Third-party links carry a date where the page shows one. No `#anchors` are given.

🔴 **Version note.** Our syllabus targets **Python 3.14** (`docs/python/README.md`); official links point at the 3.14 docs. Several third-party picks are older and are flagged in the block: PyMOTW is output-tested on Python 3.7 and has no `itertools.batched` (3.12) or `pairwise` (3.10); Hettinger's `super()` post is from 2011 (Python 3 syntax, fine today); Ned Batchelder's iteration notes are from a 2013 talk. Two things changed recently: `dataclass(slots=True)` needs 3.10 or later, and since 3.14 evaluating `NotImplemented` in a boolean context raises `TypeError` (data model page). David Beazley's generator tutorial (dabeaz.com) answered 503 on every fetch (checked again in the verification pass), so it is named in T05-04 but not linked; the verified stand-in is his Practical Python course notes on GitHub. Real Python, Lyft Engineering and Stack Overflow returned 403 to fetches, so none of them is used. Toptal and GitHub return 403 to scripted requests but load in the page-fetch tool, which is how those two picks were read.

---

## Phase 4 — Classes and the data model

### T04-01 · Class anatomy, class vs instance attributes — Master · 🔲 not written
- **Read this:** [Classes (tutorial)](https://docs.python.org/3.14/tutorial/classes.html) · docs.python.org · class variables are shared by all instances; the `tricks = []` example shows the shared-list trap and the `__init__` fix (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Python Class Attributes: An Overly Thorough Guide](https://www.toptal.com/python/python-class-attributes-an-overly-thorough-guide) · Charles Marsh, Toptal, page shows "Last updated Jan 16, 2026" · its Mutability section runs the same trap on a `Service` class with `data = []` and states that changing it through one instance changes it for all · fetched 2026-10-13 (*read*)
- **Our delta:** why `self` is explicit, plus the lookup rule that makes the trap possible (see T04-13).

### T04-02 · The core dunders — repr, str, eq, hash, len, bool — Master · 🔲 not written
- **Read this:** [Data model](https://docs.python.org/3.14/reference/datamodel.html) · docs.python.org · `__repr__` should ideally look like an expression that recreates the object; a class that overrides `__eq__` without `__hash__` gets `__hash__` set to `None` (*read*, first half of a very long page) · covers our angle: **partial** — a reference, not a worked example of the vanishing-from-a-set bug · fetched 2026-10-13
- **Also good:** [Python's `__repr__` vs `__str__`](https://dbader.org/blog/python-repr-vs-str) · Dan Bader · `__str__` for users, `__repr__` for developers, and "always add at least a `__repr__`"; page shows no date (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Python Hashes and Equality](https://hynek.me/articles/hashes-and-equality/) · Hynek Schlawack, 2017-11-20 · equal objects must hash equal, the hash must never change while the object lives, and hashing on mutable attributes makes objects unfindable in sets and dicts · fetched 2026-10-13 (*read*)
- **Our delta:** one runnable "the object that vanished from a set" demo, and `__bool__` and `__len__` truthiness order. Hynek's article has the Python 2 versus 3 aside, which no longer matters.

### T04-03 · `@property` — Master · 🔲 not written
- **Read this:** [Data model](https://docs.python.org/3.14/reference/datamodel.html) · docs.python.org · "The `@property` decorator is implemented as a data descriptor", so instances cannot override it; the working how-to is the Descriptor Guide (see T04-14) · covers our angle: **partial** — no "evolve a public attribute" story · fetched 2026-10-13 (*read* that passage)
- **Beyond the docs:** [Don't use Python's property](https://www.b-list.org/weblog/2023/dec/21/dont-use-python-property/) · James Bennett, 2023-12-21 · the one job of `property` is turning a plain attribute into computed behaviour later without breaking callers; start with plain attributes, do not write Java-style getters first; warns against hiding real work behind attribute syntax · fetched 2026-10-13 (*read*)
- **Our delta:** validation on set, read-only properties, and the backing-name recursion bug (`self._x`, not `self.x`).

### T04-04 · `@classmethod` vs `@staticmethod` — Understand · 🔲 not written
- **Read this:** [Built-in functions: classmethod and staticmethod](https://docs.python.org/3.14/builtins/functions.html) · docs.python.org · a class method receives the class as implicit first argument, a static method receives no implicit first argument; both can be called on the class or an instance (*read* both entries) · covers our angle: **partial** — short reference entries, no alternative-constructor walk-through · fetched 2026-10-13
- **Beyond the docs:** [Python's @classmethod and @staticmethod Explained](https://stackabuse.com/pythons-classmethod-and-staticmethod-explained/) · Stack Abuse, page shows "Last Updated: November 21st, 2021" · `from_string` style constructors built with `cls(...)`; a staticmethod is a helper that cannot create instances; it never shows a subclass calling the constructor, so the `cls` payoff is only implied · fetched 2026-10-13 (*read*)
- **Our delta:** `cls(...)` versus the hard-coded class name, shown with a subclass call.

### T04-05 · `dataclasses` — Master · 🔲 not written
- **Read this:** [dataclasses](https://docs.python.org/3.14/library/dataclasses.html) · docs.python.org · has its own sections for default factory functions, frozen instances and post-init processing, plus the `slots` and `kw_only` parameters; the plain `list` default raises `ValueError` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Python Dataclasses](https://www.pythontutorial.net/python-oop/python-dataclass/) · pythontutorial.net, copyright 2021 to present, no date · covers `frozen` and `__post_init__` but not `default_factory`, `slots` or `kw_only` (*read*) · fetched 2026-10-13
- **Our delta:** all five options in one example, aimed at the `Money` gate.

### T04-06 · Inheritance, `super()` and the MRO — Understand · 🔲 not written
- **Read this:** [The Python 2.3 Method Resolution Order](https://docs.python.org/3.14/howto/mro.html) · docs.python.org · describes itself as "quite pedagogical with many worked out examples" of the C3 algorithm; the paper dates from Python 2.3 and says you can skip it unless you use non-trivial multiple inheritance (*read* the opening) · covers our angle: **partial** — no cooperative `__init__` or mixin advice · fetched 2026-10-13
- **Beyond the docs:** [Python's super() considered super!](https://rhettinger.wordpress.com/2011/05/26/super-considered-super/) · Raymond Hettinger, 2011-05-26 · `super()` as a computed indirect reference; the three conditions for cooperative methods (method exists, matching signatures, every method calls `super()`) and the `**kwds` forwarding pattern; Python 3 syntax · fetched 2026-10-13 (*read*)
- **Our delta:** "composition usually beats a hierarchy", which neither page argues.

### T04-07 · ABCs vs `Protocol` — Understand · 🔲 not written
- **Read this:** [abc](https://docs.python.org/3.14/library/abc.html) · docs.python.org · the ABC side: explicit inheritance, and `register` making an unrelated class a "virtual subclass" that does not appear in the MRO and gets no method implementations (*read* that passage) · covers our angle: **partial** — nothing on Protocol; read it beside the mypy page · fetched 2026-10-13
- **Also good:** [Protocols and structural subtyping](https://mypy.readthedocs.io/en/latest/protocols.html) · mypy docs · nominal subtyping depends on inheritance, structural on having the right methods; subclassing a protocol explicitly documents conformance, and `runtime_checkable` allows `isinstance` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Interfaces and Protocols](https://blog.glyph.im/2021/03/interfaces-and-protocols.html) · Glyph Lefkowitz, 2021-03-15 · argues Protocols are the default for abstract behaviour, ABCs sit in an awkward halfway space because they can hold implementation, and `zope.interface` is still worth it for opt-in nominal typing; says `ABCMeta.register` did not work with mypy as of March 2021, so re-check that point · fetched 2026-10-13 (*read*)
- **Our delta:** registering versus just matching the shape, in one table.

### T04-08 · Operator overloading and `NotImplemented` — Understand · 🔲 not written
- **Read this:** [Data model](https://docs.python.org/3.14/reference/datamodel.html) · docs.python.org · numeric and comparison methods should return `NotImplemented` when they do not handle the operands, and the interpreter then tries the reflected operation; since 3.14 using it in a boolean context raises `TypeError` (*read*) · covers our angle: **partial** — no `Money` example · fetched 2026-10-13
- **Beyond the docs:** [Behind the Underscores, Ep. 04: arithmetic methods](https://dev.to/hevalhazalkurt/behind-the-underscores-ep04-arithmetic-methods-add-sub-mul-6ja) · Heval Hazal Kurt, DEV Community, 2025-06-04 · a `Money` class where `5 + m1` fails in `int.__add__`, then Python tries the reflected `m1.__radd__(5)`; its best-practice list says to return `NotImplemented` for types you cannot handle; it never mentions `NotImplementedError` or comparison methods, so pair it with the data model page (*read*) · fetched 2026-10-13
- **Our delta:** `NotImplemented` versus `NotImplementedError`, and refusing cross-currency math.

### T04-09 · Container protocol — Understand · 🔲 not written
- **Read this:** [collections.abc](https://docs.python.org/3.14/library/collections.abc.html) · docs.python.org · the table: Sequence needs `__getitem__` and `__len__` and supplies `__contains__`, `__iter__`, `index`, `count`; Collection needs `__contains__`, `__iter__`, `__len__` (*read*) · covers our angle: **full** for what to implement, none on slicing · fetched 2026-10-13
- **Beyond the docs:** [Python dunder methods](https://mathspp.com/blog/pydonts/dunder-methods) · mathspp (Rodrigo Girão Serrão's site; the page names no author), 2022-07-09 · a table of operator and container dunders (`__contains__` behind `in`, `__getitem__`, `__setitem__`, `__len__`, `__iter__`); no `NotImplemented` (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Our delta:** wrap a list, inherit `Sequence` for the free mixins, and handle slice objects.

### T04-10 · Pydantic models vs dataclasses — Understand · 🔲 not written
- **Read this:** [Pydantic dataclasses](https://pydantic.dev/docs/validation/latest/concepts/dataclasses/) · Pydantic docs · adds validation and coercion to standard-style dataclasses but lacks some model features such as the built-in validate and dump methods (*read*) · covers our angle: **partial** — says nothing about where each belongs · fetched 2026-10-13
- **Beyond the docs:** [Pydantic vs Python Dataclasses: An Architect's Guide to API Clients](https://dev.to/sam_th/pydantic-vs-python-dataclasses-an-architects-guide-to-api-clients-42f0) · Sam T, DEV Community, page shows January 16 without a year · Pydantic at the edge for untrusted input, dataclasses in the trusted core; the post's benchmark figures were not checked (*read*) · fetched 2026-10-13
- **Our delta:** the placement rule stated once; full Pydantic is Phase 9.

### T04-11 · `__slots__` — Know · 🔲 not written
- **Read this:** [Data model](https://docs.python.org/3.14/reference/datamodel.html) · docs.python.org · the `__slots__` section (3.3.2.4): declares data members, denies `__dict__` and `__weakref__` unless listed, and says the space saved "can be significant" and lookup can be faster (*read* that section) · covers our angle: **partial** — no numbers · fetched 2026-10-13
- **Also good:** [dataclasses](https://docs.python.org/3.14/library/dataclasses.html) · docs.python.org · the `slots` parameter generates `__slots__` and returns a new class (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Slotted classes with `__slots__` in Python](https://dev.to/hevalhazalkurt/slotted-classes-with-slots-in-python-57f9) · Heval Hazal Kurt, DEV Community, 2025-09-30 · no per-instance dictionary, `AttributeError` on unexpected attributes, `dataclass(slots=True)` on 3.10 or later; gives no measured numbers and advises profiling first (*read*) · fetched 2026-10-13
- **Our delta:** a measured per-instance comparison, which no source I read supplies.

### T04-12 · `__new__` vs `__init__` — Know · 🔲 not written
- **Read this:** [Data model](https://docs.python.org/3.14/reference/datamodel.html) · docs.python.org · `__new__` creates the instance and gets the class as first argument; `__init__` runs only if it returns an instance of that class (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [OOP in Python, part 7: The `__new__()` method](https://mostlypython.substack.com/p/oop-in-python-part-7-the-__new__) · Eric Matthes, Mostly Python, 2023-08-17 · a list subclass that drops zeros works in `__init__`, the tuple version fails with a `TypeError`, and the fix overrides `__new__` · fetched 2026-10-13 (*read*)
- **Our delta:** when you need this at all (rarely); `frozen` dataclasses cover most immutable-value cases.

### T04-13 · Attribute lookup, `__getattr__` vs `__getattribute__` — Know · 🔲 not written
- **Read this:** [Data model](https://docs.python.org/3.14/reference/datamodel.html) · docs.python.org · `__getattr__` is called when the default attribute access fails with `AttributeError`; `__getattribute__` is "called unconditionally", `__getattr__` then runs only if it raises `AttributeError`, and the fix for its recursion is to call the base class method (*read* both entries) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Difference between `__getattr__` and `__getattribute__`](https://mathspp.com/blog/til/difference-between-__getattr__-and-__getattribute__) · mathspp, 2024-07-09 · the first runs only on a failed lookup, the second on every lookup; warns of infinite recursion but shows no example (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Surprising `__getattr__` recursion](https://nedbatchelder.com/blog/201010/surprising_getattr_recursion) · Ned Batchelder, 2010-10-07 · a worked recursion: `copy.copy` skips `__init__`, so `__getattr__` reads a missing attribute and calls itself, and `hasattr` hides the error; old but the behaviour is unchanged · fetched 2026-10-13 (*read*)
- **Our delta:** the full order (data descriptor, instance dict, non-data descriptor or class, then `__getattr__`) in one picture.

### T04-14 · Descriptors — Know · 🔲 not written
- **Read this:** [Descriptor Guide](https://docs.python.org/3.14/howto/descriptor.html) · docs.python.org (Raymond Hettinger) · a primer, a validator example, pure-Python `property`, functions as non-data descriptors producing bound methods, and an ORM-style `Field` example (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Python Descriptors](https://www.pythontutorial.net/python-oop/python-descriptors/) · pythontutorial.net, no author or date · starts from a repeated property validator and replaces it with a reusable `RequiredString` descriptor using `__set_name__`; does not show that `property` itself is a descriptor (*read*) · fetched 2026-10-13
- **Our delta:** "read one before writing one", with the official guide first and the validator as the only one we write.

### T04-15 · Metaclasses and `__init_subclass__` — When Needed · 🔲 not written
- **Read this:** [PEP 487 — Simpler customisation of class creation](https://peps.python.org/pep-0487/) · python.org · `__init_subclass__` runs when a subclass is created, so a base class can register subclasses without a metaclass (*read*) · covers our angle: **full** for the plugin-registry case · fetched 2026-10-13
- **Beyond the docs:** [Understanding Python metaclasses](https://blog.ionelmc.ro/2015/02/09/understanding-python-metaclasses/) · Ionel Cristian Mărieș, 2015-02-09 (updated 2020-11-19) · the order of `__prepare__`, `__new__`, `__init__` and `__call__`, and metaclasses compared with class decorators; does not mention `__init_subclass__` (*read*) · fetched 2026-10-13
- **Our delta:** recognise a metaclass in a framework, reach for `__init_subclass__` first.

---

## Phase 5 — Iterators, generators and context managers

### T05-01 · The iteration protocol — Master · 🔲 not written
- **Read this:** [Classes (tutorial): Iterators](https://docs.python.org/3.14/tutorial/classes.html) · docs.python.org · `for` calls `iter()`, then `__next__()` until `StopIteration`; a class-based `Reverse` iterator (*read*) · covers our angle: **partial** — no exhaustion trap · fetched 2026-10-13
- **Beyond the docs:** [The Iterator Protocol](https://www.pythonmorsels.com/iterator-protocol/) · Trey Hunner, Python Morsels, 2020-05-31 · iterable versus iterator, `iter()` on an iterator returns itself, and "exhausted" iterators yield nothing more; the article text was readable in full (*read*) · fetched 2026-10-13
- **Our delta:** the twice-looped generator, shown failing.

### T05-02 · Generator functions — Master · 🔲 not written
- **Read this:** [Classes (tutorial): Generators](https://docs.python.org/3.14/tutorial/classes.html) · docs.python.org · `yield` resumes where it left off, local state is saved, `StopIteration` is automatic; the `reverse(data)` generator replaces the class iterator (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Loop Like A Native](https://nedbatchelder.com/text/iter.html) · Ned Batchelder, PyCon 2013 talk (page shows "Created 24 April 2012, last updated 19 March 2013") · iterables as a book and iterators as a bookmark, then turning a list-building function into a generator and splitting comment-skipping into its own generator · fetched 2026-10-13 (*read*)
- **Our delta:** the CSV that would run out of memory as a list, run in constant memory.

### T05-03 · Generator expressions vs list comprehensions — Master · 🔲 not written
- **Read this:** [PEP 289 — Generator Expressions](https://peps.python.org/pep-0289/) · python.org · many use cases do not need a full list in memory; contrasts `sum([x * x for x in range(10)])` (builds the list) with `sum(x * x for x in range(10))` (does not) (*read*) · covers our angle: **partial** — rationale and the `sum` example, nothing on when you do want the list · fetched 2026-10-13
- **Also good:** [Functional Programming HOWTO](https://docs.python.org/3.14/howto/functional.html) · docs.python.org · its "Generator expressions and list comprehensions" section: a genexp returns an iterator that computes values as needed, so a list comprehension is no use on an infinite stream (*read* that section) · fetched 2026-10-13
- **Beyond the docs:** [Comprehensible Comprehensions](https://treyhunner.com/comprehensible-comprehensions/) · Trey Hunner, talk notes, no date or event shown · "If you're making a list to loop over it exactly once, use a generator expression"; also shows the single-use trap, a second loop over a generator giving nothing (*read*) · fetched 2026-10-13
- **Our delta:** when you do want the list: reuse, `len`, indexing.

### T05-04 · Pipelines of generators — Understand · 🔲 not written
- **Read this:** [Loop Like A Native](https://nedbatchelder.com/text/iter.html) · Ned Batchelder, 2013 · filtering logic split into its own reusable generator, which is the first step of a pipeline (*read*) · covers our angle: **partial** — one stage, not a parse, filter, transform chain · fetched 2026-10-13
- **Also good:** [Generator Tricks for Systems Programmers (link post)](https://simonwillison.net/2019/Apr/9/generator-tricks-for-systems-programmers/) · Simon Willison, 2019-04-09 · only points to David Beazley's tutorial, calls it definitive and updated for Python 3.7 in October 2018; explains nothing itself (*read*) · fetched 2026-10-13
- **Beyond the docs:** [6.3 Producers, Consumers and Pipelines](https://github.com/dabeaz-course/practical-python/blob/main/Notes/06_Generators/03_Producers_consumers.md) · David Beazley, Practical Python course notes (GitHub) · generators as dataflow pipelines compared to Unix pipes, wired as producer then processing stage then consumer by chaining calls; the exercises chain file matching, `csv.reader`, column selection and filtering over stock-ticker data; undated, and it needs the course's background `stocksim.py` to run the exercises · fetched 2026-10-13 (*read*; loaded in the page-fetch tool, scripted requests get 403)
- **Our delta:** Beazley's original tutorial (chained generators over a web-server log) is still the classic source, but dabeaz.com returned 503 on every attempt, so it is not linked; the course notes above carry the same idea. Our page builds the log pipeline itself.

### T05-05 · `yield from` — Understand · 🔲 not written
- **Read this:** [PEP 380 — Syntax for Delegating to a Subgenerator](https://peps.python.org/pep-0380/) · python.org · forwards yielded values, sent values and exceptions to the sub-iterator; its `return` value becomes the value of the `yield from` expression (*read*) · covers our angle: **full** for semantics, none for flattening · fetched 2026-10-13
- **Beyond the docs:** [PEP 380: yield from](https://pynotes.bjdean.id.au/posts/pep-380-yield-from/) · Brad's PyNotes, 2025-06-15 · worked examples of basic delegation, `send()` passing through, recursive flattening, tree traversal, exception flow and a pipeline of generators (*read*) · fetched 2026-10-13
- **Our delta:** flattening nested structures as the everyday use; `send` passing is T05-10.

### T05-06 · `itertools` — Understand · 🔲 not written
- **Read this:** [itertools](https://docs.python.org/3.14/library/itertools.html) · docs.python.org · documents `batched` (added in 3.12; `strict` added in 3.13) and `pairwise` (3.10); `groupby` needs input already sorted on the same key function (*read* those entries) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [itertools — Iterator functions](https://pymotw.com/3/itertools/) · Doug Hellmann, PyMOTW-3, last updated 2016-12-28 · runs `groupby` on unsorted data to show repeated groups, then on sorted data; examples run on Python 3.7.9, so it has no `batched` or `pairwise` (*read*) · fetched 2026-10-13
- **Our delta:** the `groupby` silent-wrong-result demo and `batched` for chunked API calls; the PyMOTW page is for the older functions only.

### T05-07 · Context managers and `@contextmanager` — Master · 🔲 not written
- **Read this:** [PEP 343 — The "with" Statement](https://peps.python.org/pep-0343/) · python.org · `__enter__` on entry; `__exit__` gets the exception type, value and traceback (or three `None`s); a true return value suppresses the exception (*read*) · covers our angle: **partial** — no `@contextmanager` recipes · fetched 2026-10-13
- **Also good:** [Python Context Managers](https://www.pythontutorial.net/advanced-python/python-context-managers/) · pythontutorial.net, no date · the class protocol only; does not cover `@contextmanager` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Context Managers and the "with" Statement in Python](https://dbader.org/blog/python-context-managers-and-with-statement) · Dan Bader, no date shown · a class-based `ManagedFile` next to the `@contextmanager` generator version, with cleanup after `yield` in `try/finally`; notes the decorator needs generators and decorators first (*read*) · fetched 2026-10-13
- **Our delta:** timer, temp directory and lock in six lines each.

### T05-08 · The `contextlib` toolkit — Understand · 🔲 not written
- **Read this:** [contextlib](https://docs.python.org/3.14/library/contextlib.html) · docs.python.org · `suppress`, `closing`, and `ExitStack`, "designed to make it easy to programmatically combine other context managers and cleanup functions" (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [contextlib — Context manager utilities](https://pymotw.com/3/contextlib/) · Doug Hellmann, PyMOTW-3 · sections on `closing`, `suppress` and dynamic stacks with `pop_all()`; examples run on Python 3.7.9 (*read*) · fetched 2026-10-13
- **Our delta:** N files opened and all closed, with the failure halfway through.

### T05-09 · Sentinel patterns — Know · 🔲 not written
- **Read this:** [Built-in functions: iter](https://docs.python.org/3.14/builtins/functions.html) · docs.python.org · the two-argument form calls the callable with no arguments and stops when the value equals the sentinel; its example reads 64-byte blocks until `b''` (*read*) · covers our angle: **full** for `iter`; `count` and `cycle` are in the itertools page (T05-06) · fetched 2026-10-13
- **Beyond the docs:** [Read files in chunks](https://drops.mathspp.com/0043-read_files_in_chunks/tip.html) · Rodrigo Girão Serrão, Practical Python tips no. 43, copyright 2023 · `iter` with `functools.partial(f.read, 16)` and an empty-string sentinel; short · fetched 2026-10-13 (*read*)
- **Our delta:** `b''` versus `''` for the file mode, and `count`/`cycle` as infinite generators.

### T05-10 · `send`, `throw`, `close` — When Needed · 🔲 not written
- **Read this:** [PEP 342 — Coroutines via Enhanced Generators](https://peps.python.org/pep-0342/) · python.org · `send` makes its value the result of the paused `yield`, `throw` raises there, `close` raises `GeneratorExit` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Python coroutines](https://emptysqua.re/blog/python-coroutines) · A. Jesse Jiryu Davis, 2011-10-26 · a coroutine fed characters with `send()` and flushed on `close()` via `GeneratorExit`; has no `throw`, and its code uses Python 2's `.next()`, so use it for the idea only (*read*) · fetched 2026-10-13
- **Our delta:** why this is history: `asyncio` and `async`/`await` replaced the plumbing. The page links Beazley's "Curious Course on Coroutines and Concurrency", which I did not fetch.
