---
title: "02 · tuple — a fixed row of references: immutable one level deep, hashable only if its contents are, built by the comma, and outgrown the day a caller has to count its positions"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — the language reference
> ([data model](https://docs.python.org/3.14/reference/datamodel.html),
> [expressions](https://docs.python.org/3.14/reference/expressions.html),
> [simple](https://docs.python.org/3.14/reference/simple_stmts.html) and
> [compound statements](https://docs.python.org/3.14/reference/compound_stmts.html)), the library
> reference ([built-in types](https://docs.python.org/3.14/library/stdtypes.html),
> [time complexity](https://docs.python.org/3.14/library/time-complexity.html),
> [`collections`](https://docs.python.org/3.14/library/collections.html),
> [`typing`](https://docs.python.org/3.14/library/typing.html),
> [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html)), the
> [glossary](https://docs.python.org/3.14/glossary.html), the design and programming FAQs, the
> [sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html); PEPs 448, 557 and 3132
> ([peps.python.org](https://peps.python.org/)); the [typing specification](https://typing.python.org/en/latest/spec/);
> and CPython 3.14 source ([github.com/python/cpython](https://github.com/python/cpython/tree/3.14))
> for error text and mechanisms the documentation does not spell out.
> Target: **Python 3.14.7**. Documentation-validated — **no sandbox run, no program output on any page in this topic**.

**A tuple is an array of references that can never be re-pointed, and almost everything worth
knowing about it follows from that one sentence. It freezes its slots, not their contents — so a
tuple holding a list is immutable and still changes. It is hashable only when every element is,
which is why it is the composite dict key and why one list inside it breaks that key. It is built
by the comma, not the parentheses — the source of a whole family of one-character bugs. Unpacking
it checks the count and nothing else, so it is excellent for two values in an obvious order and
dangerous for four values of the same type. And because it is a *record* rather than an *array*,
the typing system gives it one type per position, the standard library returns it wherever a
function has several results, and the named-record types — `namedtuple`, `typing.NamedTuple`, the
frozen dataclass — are what you reach for when positions stop being enough. The syllabus row
asks when a dataclass beats a 4-tuple; the answer is in chunk 8d, and the rest of this topic is
what you need to understand it.**

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What immutability freezes](01-what-immutability-freezes.md)** | 🔴 slots, not contents — the reference's own parenthesis; rebinding is not mutation; `tuple(t)` returns `t`; shallow copies |
| 1b | **[Thread safety and identity](01b-thread-safety-and-identity.md)** | the glossary's thread-safety claim and its one-level boundary; publishing a new tuple as a snapshot; 🔴 `(1, 2) is (1, 2)` is explicitly unspecified |
| 2 | **[The `+=` that raises and mutates](02-the-augmented-assignment-trap.md)** | 🔴 `t[0] += [x]` extends the list *and* raises `TypeError`, from the FAQ; why a generic handler makes it look transient |
| 2b | **[Writing what you meant](02b-writing-what-you-meant.md)** | the four correct rewrites; `+=` on a name is a rebinding; which augmented operators mutate before failing |
| 3 | **[Hashability](03-hashability.md)** | 🔴 hashable only if every element is; why the rule must exist; convert, do not wrap; the docs' `hash((a, b, c))` recipe |
| 3b | **[What a hash value is not](03b-what-a-hash-value-is-not.md)** | 🔴 `1`, `1.0` and `True` are one key; per-process salting and `PYTHONHASHSEED`; truncation and collisions |
| 4 | **[Tuples as keys](04-tuples-as-keys.md)** | `counts[tenant, day]` builds the tuple; `defaultdict` grouping; set algebra on tuple rows; sorting a tuple-keyed dict |
| 4b | **[The cost of a flat key](04b-the-cost-of-a-flat-key.md)** | 🔴 `lru_cache` key rules including keyword order; losing prefix lookup; when a `NamedTuple` key is the answer |
| 5 | **[The comma makes the tuple](05-the-comma-makes-the-tuple.md)** | 🔴 parentheses group, commas build; the four constructions; where parentheses are required and where they are noise |
| 5b | **[Trailing-comma bugs](05b-trailing-comma-bugs.md)** | `x = 1,`; 🔴 `assert (cond, "msg")` always passes; the stray comma in a class body or config |
| 5c | **[When a library requires the tuple](05c-when-a-library-requires-the-tuple.md)** | `%`-formatting's single-value special case; 🔴 DB-API parameters and `("abc")` as a three-element sequence; logging's deferred args |
| 6 | **[Packing and unpacking](06-packing-and-unpacking.md)** | the swap without a temporary; 🔴 `i, x[i] = 1, 2` assigns left to right; the three arity messages; nested targets |
| 6b | **[Unpacking library results](06b-unpacking-library-results.md)** | `enumerate`, `zip`, `divmod`, `partition`, `items`; 🔴 fixed versus data-dependent arity; `_` is only a name |
| 6c | **[Starred unpacking](06c-starred-unpacking.md)** | 🔴 `*rest` is always a list, by PEP 3132's decision; `*a, = x` versus `a = *x,`; `*_` still stores everything |
| 6d | **[Stars beyond assignment](06d-stars-beyond-assignment.md)** | PEP 448 displays; 🔴 `**` overwrites in a dict and raises in a call; `match` sequence patterns; `*args` is a tuple |
| 7 | **[Multiple return values](07-multiple-return-values.md)** | a tuple is a record, a list an array; 🔴 transposition and growth, and why a named tuple does not fix growth |
| 7b | **[Absence, errors and shared results](07b-absence-and-shared-results.md)** | 🔴 `cannot unpack non-iterable NoneType object`; `(value, error)` is not Python; empty is not absent; cached return values |
| 7c | **[Annotating tuples](07c-annotating-tuples.md)** | 🔴 `tuple[int]` is exactly one int; `tuple[int, ...]`, `tuple[()]`, bare `tuple`; covariance; length narrowing; `*args` annotations |
| 7d | **[Checking tuples at runtime](07d-checking-tuples-at-runtime.md)** | annotations are not enforced; `isinstance` rejects `tuple[str, int]`; 🔴 JSON never returns a tuple; `str` satisfies `Sequence[str]` |
| 8 | **[namedtuple](08-named-records.md)** | what the factory writes, line by line; `_make`, `_asdict`, `_replace`, `_fields`; defaults and `rename`; 🔴 `json.dumps` drops the names |
| 8b | **[`typing.NamedTuple`](08b-typing-namedtuple.md)** | the same class with annotations; generics; the 3.14 introspection wording; 🔴 class-body defaults are shared objects |
| 8c | **[What the class syntax forbids](08c-namedtuple-restrictions.md)** | no `__init__`/`__new__`, no mixins, 🔴 no `super()` from 3.14; the validating subclass that `_make` and `_replace` bypass |
| 8d | **[When a dataclass beats a 4-tuple](08d-when-a-dataclass-beats-a-tuple.md)** | 🔴 PEP 557's case against named tuples; equal records of different types colliding as keys; the decision table |
| 8e | **[Frozen dataclasses](08e-frozen-dataclasses.md)** | immutability *emulated*; `object.__setattr__` in `__post_init__`; when `__hash__` exists; 🔴 3.13's field-by-field `__eq__` and NaN |
| 9 | **[Comparison and ordering](09-comparison-and-ordering.md)** | lexicographic rules and CPython's two-step compare; 🔴 `None` in a key fails only on a tie; tuple never equals list; version tuples |
| 9b | **[Sort keys and priority queues](09b-sort-keys-and-priority-queues.md)** | `itemgetter`/`attrgetter` keys; mixed directions via stability; 🔴 the heap counter; a sorted list of keys as a prefix index |
| 10 | **[The real surface](10-cost-and-the-real-surface.md)** | the whole API — `count`, `index` and the common operations; 🔴 `in` is a linear scan by equality, so `True` counts as `1` |
| 10b | **[What operations cost](10b-what-operations-cost.md)** | the 3.14 cost table; 🔴 `+=` in a loop and `sum(t, ())` are quadratic; `*` repeats references; hash caching; what is *not* documented |

## Phase gate

You are done with this topic when you can look at any tuple in a codebase and say what it
promises and what it does not — and when you can defend the choice between a tuple, a named tuple
and a frozen dataclass for a given record in one sentence. Concretely, without looking anything
up:

- Why `t[0] += [x]` both raises and changes `t[0]`, and the rewrite that says what you meant.
- Why `(1, [2])` is immutable but cannot be a dict key, and why `{1: "a", True: "b"}` has one entry.
- What `x = 1,`, `assert (ok, "msg")` and `execute(sql, (user_id))` each do wrong.
- What type `rest` has after `first, *rest = some_tuple`, and why that choice was deliberate.
- What `tuple[int]` means, and why `isinstance(x, tuple[int, str])` raises.
- Why `PriceKey("A", "eu")` and `StockKey("A", "eu")` overwrite each other in a dict, and what stops it.
- Why a sort keyed on `(tenant, discount)` crashes only on the day two rows tie.
- Why building a tuple with `+=` in a loop is quadratic, and what the documentation tells you to do instead.

## Where this connects

- **[Phase 3 — Collections in depth](../README.md)** is the phase this topic belongs to.
- [01 · `list` internals](../01-list-internals/README.md) is the other half of the record/array split: the
  mutable, growable sequence whose over-allocation is why "extend a list, then convert" is linear.
- [03 · `dict`](../03-dict/README.md) is where tuple keys live — its hash-table cost model and
  its rules for what may be a key are the other side of chunks 3–4b.
- [04 · `set` and `frozenset`](../04-set-and-frozenset/README.md) is the answer when a tuple is being used for
  membership, and `frozenset` is the immutable field type for unordered data.
- [06 · `collections`](../06-collections-module/README.md) returns to `namedtuple` alongside `defaultdict`,
  `Counter` and `deque`.
- **08 · `copy` vs `deepcopy`** *(not written yet)* covers what `tuple(t)` and slicing do *not*
  copy.
- **10 · Sorting compound data** *(not written yet)* generalises the tuple sort keys of chunk 9b.
- [Phase 1 · 07 — Assignment and aliasing](../../phase-1-language-core/07-assignment-and-aliasing/README.md), [Phase 1 · 10 — `match`](../../phase-1-language-core/10-match-pattern-matching/README.md) and [Phase 1 · 13 —
  Unpacking](../../phase-1-language-core/13-unpacking/README.md) are the language-core foundations this topic builds on; **Phase 4 — Classes and the
  data model** *(not written yet)* is where `@dataclass` gets its full treatment.

---

← Prev: [Phase 3 — Collections in depth](../README.md) · Start → [01 · What immutability freezes](01-what-immutability-freezes.md)
