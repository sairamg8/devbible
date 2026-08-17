---
title: "Part 2 — The data model"
sidebar_label: "2 · Data model"
sidebar_position: 2
---

> Phases 3–6 · Collections in depth, classes and dunders, iterators, and typing

"Pythonic" is not taste — it is writing *with* the data model instead of around
it. This part is that model: the collections' real cost, the protocols classes
plug into, laziness with generators, and the type system that grew on top.

---

## Phase 3 — Collections in depth

You already used lists and dicts in Part 1. This phase is their cost model and
the standard-library structures that replace hand-rolled code.

| Topic | Tier |
|---|---|
| **`list` internals**: a dynamic array — append is cheap, `insert(0, …)` is O(n); `sort` (Timsort, stable) with `key=`, `sorted` vs `.sort()` (one returns, one mutates and returns `None` — the classic `x = x.sort()` bug) | <span className="db-tier t-master">Master</span> |
| `tuple`: immutable, hashable (if contents are), the natural "record without a name" — and when a dataclass beats a 4-tuple | <span className="db-tier t-understand">Understand</span> |
| **`dict`**: insertion-ordered by guarantee, the lookup workhorse — `get` with defaults, `setdefault`, views, merge (`\|`), comprehensions; what can be a key (**hashability**) and why a list can't | <span className="db-tier t-master">Master</span> |
| **`set`/`frozenset`**: membership at O(1), dedupe, and set algebra — "users in A but not B" as `a - b` instead of a nested loop | <span className="db-tier t-master">Master</span> |
| **Slicing deeply**: `[start:stop:step]`, negatives, `[::-1]`, slice assignment, and slices as *copies* (for lists) — vs the aliasing bugs of Phase 1 | <span className="db-tier t-understand">Understand</span> |
| **`collections`**: `defaultdict` (the group-by one-liner), `Counter` (top-N in two lines), `deque` (O(1) both ends — the queue `list.pop(0)` pretends to be), `namedtuple`, `ChainMap` | <span className="db-tier t-master">Master</span> |
| `heapq` (top-K without sorting everything) and `bisect` (binary search on sorted data) | <span className="db-tier t-understand">Understand</span> |
| **`copy` vs `deepcopy`** — one level vs the whole graph, and the nested-dict config that two requests accidentally shared | <span className="db-tier t-understand">Understand</span> |
| Iteration idioms: `enumerate` (with `start=`), `zip` (stops at shortest — `strict=True` since 3.10), `reversed`, `any`/`all`, `min`/`max` with `key=` | <span className="db-tier t-master">Master</span> |
| Sorting compound data: `key=` with lambdas, `operator.itemgetter`/`attrgetter`, multi-key sorts, stability as a feature | <span className="db-tier t-understand">Understand</span> |
| Choosing a structure — the decision table: by lookup pattern, ordering need, mutation — and the honest note that at scale the answer becomes "a database or numpy, not a bigger dict" | <span className="db-tier t-understand">Understand</span> |
| `array`, `memoryview` — compact numeric storage below numpy | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** "count page views per user per day, then the top 10
users" comes out as `defaultdict`/`Counter` + `most_common` in a few lines —
with no index arithmetic anywhere.

---

## Phase 4 — Classes and the data model

Python classes are open protocols: implement the right dunders and your object
works with `len`, `in`, `for`, `==`, f-strings and sorting. This phase is those
protocols, plus the machinery (`@property`, descriptors) frameworks are made of.

| Topic | Tier |
|---|---|
| Class anatomy: `__init__`, `self` (explicit on purpose), **class vs instance attributes** — and the shared-mutable-class-attribute trap (`items = []` on the class) | <span className="db-tier t-master">Master</span> |
| **The core dunders**: `__repr__` (for logs — unambiguous) vs `__str__`, `__eq__` **and** `__hash__` as a pair (the object that vanished from a set), `__len__`, `__bool__` | <span className="db-tier t-master">Master</span> |
| **`@property`**: computed attributes, validation on set — evolving a public attribute into logic *without breaking callers* (the refactor Java does with getters up front) | <span className="db-tier t-master">Master</span> |
| `@classmethod` (alternative constructors — `Order.from_json(...)`) vs `@staticmethod` (a namespaced function) | <span className="db-tier t-understand">Understand</span> |
| **`dataclasses`**: `@dataclass`, `field(default_factory=...)` (the mutable-default trap again, solved), `frozen=True`, `slots=True`, `__post_init__`, `kw_only` — the default data carrier | <span className="db-tier t-master">Master</span> |
| Inheritance and **`super()`**: the MRO (C3), cooperative `__init__`, mixins — and why composition usually beats a hierarchy here too | <span className="db-tier t-understand">Understand</span> |
| **ABCs vs `Protocol`**: nominal vs structural — duck typing formalized; registering vs just matching the shape | <span className="db-tier t-understand">Understand</span> |
| Operator overloading: arithmetic dunders, reflected variants (`__radd__`), `NotImplemented` (not `NotImplementedError`) — a `Money` type that adds and compares safely | <span className="db-tier t-understand">Understand</span> |
| Container protocol: `__getitem__`, `__setitem__`, `__contains__`, `__iter__` — making a wrapper collection feel native | <span className="db-tier t-understand">Understand</span> |
| **Pydantic models vs dataclasses**: validation and serialization at the boundary vs plain data in the core — the rule of where each belongs (full Pydantic treatment in Phase 9) | <span className="db-tier t-understand">Understand</span> |
| `__slots__`: memory per instance, attribute typos becoming errors, the dataclass `slots=True` shortcut | <span className="db-tier t-know">Know</span> |
| `__new__` vs `__init__`, and immutable-type subclassing | <span className="db-tier t-know">Know</span> |
| Attribute lookup order: instance dict → class → descriptors; `__getattr__` (fallback) vs `__getattribute__` (everything — and its infinite-recursion trap) | <span className="db-tier t-know">Know</span> |
| **Descriptors** — how `@property`, methods and ORM fields actually work; read one before writing one | <span className="db-tier t-know">Know</span> |
| Metaclasses and `__init_subclass__` — plugin registries; recognize in frameworks, almost never write | <span className="db-tier t-when">When Needed</span> |

**Gate — deliverable:** an immutable `Money` (frozen, slotted dataclass) that
is hashable, ordered, adds and multiplies correctly, refuses cross-currency
math, and `repr`s cleanly in a log line.

---

## Phase 5 — Iterators, generators and context managers

Python's laziness machinery: process a 10 GB file in constant memory, and make
resource cleanup impossible to forget. The two protocols behind `for` and
`with`.

| Topic | Tier |
|---|---|
| **The iteration protocol**: `iter`/`next`, `StopIteration`, iterable vs iterator — and the **exhaustion trap**: the generator you looped twice and got nothing the second time | <span className="db-tier t-master">Master</span> |
| **Generator functions**: `yield`, lazy evaluation, state between yields — reading a huge CSV line-by-line where a list would OOM | <span className="db-tier t-master">Master</span> |
| Generator expressions vs list comprehensions: `sum(x.total for x in orders)` — no intermediate list; when you *do* want the list | <span className="db-tier t-master">Master</span> |
| **Pipelines of generators**: parse → filter → transform composed lazily — the shape of every log-processing script | <span className="db-tier t-understand">Understand</span> |
| `yield from` — delegation, flattening nested structures | <span className="db-tier t-understand">Understand</span> |
| **`itertools`**: `chain`, `islice`, **`groupby` (requires sorted input — the silently-wrong-results trap)**, `product`, `pairwise`, **`batched` (3.12)** — chunking API calls without hand-rolled index math | <span className="db-tier t-understand">Understand</span> |
| **Context managers**: the `with` protocol, `__enter__`/`__exit__` (exception handling in `__exit__`), and **`@contextlib.contextmanager`** — a timer, a temp-directory, a "hold the lock" in six lines each | <span className="db-tier t-master">Master</span> |
| `contextlib` toolkit: `suppress`, `closing`, `ExitStack` (N files opened, all guaranteed closed) | <span className="db-tier t-understand">Understand</span> |
| Sentinel patterns: `iter(callable, sentinel)`, infinite generators with `count`/`cycle` | <span className="db-tier t-know">Know</span> |
| `send`/`throw`/`close` — the coroutine plumbing asyncio grew out of; historical context | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can stream-process a multi-GB log file — parse,
filter, aggregate — in constant memory, and explain why sticking `list()` in the
middle would defeat it.

---

## Phase 6 — Typing

Optional, gradual, and in 2026 simply expected in professional code: FastAPI
runs on it, editors live by it, and reviewers ask where it is. Hints don't run —
the checker is the point.

| Topic | Tier |
|---|---|
| The contract: **hints don't execute** — a checker (and your editor) reads them; runtime ignores them. Gradual typing: annotate the boundaries first | <span className="db-tier t-master">Master</span> |
| **The working vocabulary**: builtins as generics (`list[int]`, `dict[str, Order]`), `X \| None` (and the `Optional` spelling in older code), `X \| Y` unions, return types | <span className="db-tier t-master">Master</span> |
| **Running a checker**: mypy vs pyright — pick one, put it in CI, `strict` per-module rollout on an existing codebase | <span className="db-tier t-understand">Understand</span> |
| `TypedDict` (typing the JSON dict you didn't make a model for), `Literal` (`mode: Literal["r", "w"]`), `Final`, `NewType` (`UserId = NewType("UserId", int)` — ids that stop cross-assigning) | <span className="db-tier t-understand">Understand</span> |
| **`Protocol`** — structural typing: "anything with a `.save()`" as a type, without touching the classes; `runtime_checkable` and its limits | <span className="db-tier t-understand">Understand</span> |
| **Generics, modern syntax (PEP 695)**: `def first[T](items: list[T]) -> T`, `class Repo[T]`, `type Alias = ...` — and the `TypeVar` spelling you'll read in pre-3.12 code | <span className="db-tier t-understand">Understand</span> |
| `Callable` signatures, `ParamSpec` for decorators that preserve types — typing the Phase 2 `@retry` so callers keep autocomplete | <span className="db-tier t-understand">Understand</span> |
| **`Any` vs `object`**, `cast`, and `# type: ignore` discipline (always with an error code) — how type safety erodes and how to stop it | <span className="db-tier t-understand">Understand</span> |
| `Self`, `ClassVar`, `overload` — the class-typing kit | <span className="db-tier t-know">Know</span> |
| Static hints vs runtime validation: the checker for your code, **Pydantic for other people's data** — two tools, one worldview | <span className="db-tier t-understand">Understand</span> |
| Stubs: `.pyi`, typeshed, `py.typed` — why some third-party imports are `Any` and what to do about it | <span className="db-tier t-know">Know</span> |
| Variance — reading "expected `list[Animal]`, got `list[Dog]`" and knowing why the checker is right | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** the Phase 2 retry decorator is fully typed with
`ParamSpec`, mypy passes strict on it, and you can explain to a teammate why
`dict[str, Any]` at a boundary is a promise you couldn't keep.

---

← Prev: [Part 1 — Foundations](01-foundations.md) · Next → [Part 3 — Application layer](03-application.md)
