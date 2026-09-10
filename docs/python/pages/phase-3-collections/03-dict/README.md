---
title: "03 · dict — a resizable hash table whose insertion order became a language guarantee, whose keys must keep one hash for life, and whose every convenience method has one documented edge"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict), [Dictionary view objects](https://docs.python.org/3.14/library/stdtypes.html#dictionary-view-objects), [Time complexity](https://docs.python.org/3.14/library/time-complexity.html), [Design FAQ](https://docs.python.org/3.14/faq/design.html#how-are-dictionaries-implemented-in-cpython), [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__), [Dictionary displays](https://docs.python.org/3.14/reference/expressions.html#dictionary-displays), [Thread Safety Guarantees](https://docs.python.org/3.14/library/threadsafety.html#thread-safety-for-dict-objects), [`collections`](https://docs.python.org/3.14/library/collections.html), [`json`](https://docs.python.org/3.14/library/json.html) — plus [PEP 468](https://peps.python.org/pep-0468/), [PEP 520](https://peps.python.org/pep-0520/), [PEP 572](https://peps.python.org/pep-0572/), [PEP 584](https://peps.python.org/pep-0584/), and CPython source at the [**v3.14.7**](https://github.com/python/cpython/tree/v3.14.7) tag for implementation details and error strings.
> Target: **CPython 3.14.7**. Documentation-validated — **no sandbox run, no timings, no byte counts on any page in this topic**.

**`dict` is the data structure Python is built on — every module namespace, every instance `__dict__`, every `**kwargs` is one — and it is fast for exactly one reason: it is a hash table. That one design decision explains the rest of this topic. Lookup is *O*(1) only while hashes are well distributed and cheap. Keys must be hashable, and a key whose hash changes after insertion is stranded rather than rejected. `1`, `1.0` and `True` are one key. Iteration order was an implementation accident in 3.6 and a language guarantee from 3.7 — for iteration, never for `==`. The views are live windows, so a loop that adds or deletes a key raises or silently skips. Merging has one conflict rule and five spellings that disagree on what they return. Subclassing `dict` gives you an API that ignores your overrides. And a dict that goes through JSON comes back with every key turned into a string. Twenty-six chunks, each on one of those edges, each sourced.**

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The hash table underneath](01-the-hash-table-underneath.md)** | the FAQ's "resizable hash table", the three steps of a lookup, the documented cost table, the compact layout as mechanism not guarantee, and 🔴 why deletion leaves a tombstone |
| 2 | **[What O(1) does not promise](01b-what-o1-does-not-promise.md)** | the precondition paragraph in full, the constant-`__hash__` catastrophe, 🔴 hash randomisation and `PYTHONHASHSEED=0`, amortised resizes, and when *O*(1) is the wrong question |
| 3 | **[Order is a guarantee](02-insertion-order-is-a-guarantee.md)** | 3.5 → 3.6 → 3.7 and Guido's ruling, update-keeps-position vs delete-then-add, 🔴 `==` still ignores order, PEP 468/520, and where the guarantee stops (`set`, layout) |
| 4 | **[Working with the order](02b-working-with-the-order.md)** | `popitem()`'s LIFO promise, first/last without a list, `reversed`, rebuilding in sorted order with stable `sorted`, and the `dict(sorted(d))` trap |
| 5 | **[Hashability — the contract](03-hashability-the-contract.md)** | the three-clause glossary definition, what is hashable by category, the design FAQ's full argument against list keys, and the `ListWrapper` escape hatch with its warning |
| 6 | **[`__hash__` and `__eq__` in your classes](03b-hash-and-eq-in-your-own-classes.md)** | 🔴 defining `__eq__` sets `__hash__` to `None`, restoring a parent's hash, `__hash__ = None` on purpose, and the `@dataclass` table |
| 7 | **[The key that mutates](03c-the-key-that-mutates.md)** | the entry you can see and cannot look up, the tell in a log, recovery by rehashing, and the three real fixes |
| 8 | **[Equal keys that collide](03d-equal-keys-that-collide.md)** | `1 == 1.0 == True` as one key and which key object survives, `IntEnum`, `-0.0`, 🔴 NaN keys, and preventing the collision |
| 9 | **[Reading a key](04-reading-a-key.md)** | `d[k]` vs `get` vs `in`, 🔴 the `None` ambiguity and the sentinel, `get`'s eager default, and `__missing__` firing only on `d[k]` |
| 10 | **[Nested access](04b-nested-access.md)** | why chained `.get()` raises on a null level, the four shapes, writing nested paths, the `defaultdict` tree that grows on read, and flattening to tuple keys |
| 11 | **[`setdefault`](04c-setdefault.md)** | insert-if-missing that returns the stored object, the one-line group-by, 🔴 it writes, the default built on every call, and memoisation where it is exactly right |
| 12 | **[`fromkeys`](04d-fromkeys.md)** | 🔴 one shared value object, order-preserving dedup with `list(dict.fromkeys(seq))`, iterating a `str` by accident, and `fromkeys` on subclasses |
| 13 | **[The three views](05-the-three-views.md)** | live windows not copies, what a view supports, the co-ordering guarantee, 🔴 `values() == values()` is always `False`, and `.mapping` |
| 14 | **[Mutating while iterating](05b-mutating-while-iterating.md)** | the documented *"may raise … or fail to iterate"*, the two `RuntimeError`s and the sticky iterator, what is *not* a mutation, the four correct shapes, and rebuild vs in-place identity |
| 15 | **[The mutations you did not write](05c-the-mutations-you-did-not-write.md)** | self-unsubscribing handlers, `defaultdict` reads, lazy generators, 🔴 `sys.modules` and its documented copy rule, `cached_property` writing into `vars(obj)`, recursion over a shared index |
| 16 | **[Set operations on views](05d-set-operations-on-views.md)** | `&`, `\|`, `-`, `^` on `keys()`/`items()`, the config diff, 🔴 results are unordered `set`s, unhashable values break `items()`, and operators-not-methods |
| 17 | **[Building a dict](06-building-a-dict.md)** | the five spellings, duplicate literal keys, `dict()`'s `keys`-attribute dispatch, 🔴 two-character strings as pairs, `zip(strict=True)`, identifier-only kwargs, and shallow copies |
| 18 | **[Dict comprehensions](06b-dict-comprehensions.md)** | key-before-value since 3.8, 🔴 inversion that loses entries, the comprehension as the `fromkeys` cure (and when it is not), and the class-body `NameError` |
| 19 | **[Merging](07-merging.md)** | PEP 584's last-seen-wins across all five spellings, `\|` vs `\|=` vs `update`, 🔴 the shared-defaults bug, merging many dicts, one level deep, and `ChainMap`'s reversed priority |
| 20 | **[What a merge returns](07b-what-a-merge-returns.md)** | 🔴 a `dict` subclass collapses to `dict`, `defaultdict`/`OrderedDict` survive from either side, `Counter \| dict` silently is not a union, `MappingProxyType`, and `os.environ \|` vs `\|=` |
| 21 | **[Removing entries](08-removing-entries.md)** | `del` vs `pop(k, None)`, 🔴 `clear()` vs rebinding to `{}`, the TOCTOU-free delete, `clear()` releasing the table, and removing many keys |
| 22 | **[Subclassing dict](09-subclassing-dict.md)** | `__missing__` as the only documented hook, 🔴 the source-level table of methods that bypass your overrides, "read-only" subclasses that are not, and `copy()` returning `dict` |
| 23 | **[`UserDict` and the mapping ABCs](09b-userdict-and-the-mapping-abcs.md)** | `MutableMapping`'s five methods, a consistent case-insensitive mapping, `UserDict.data`, 🔴 not a `dict` for `isinstance`/`json`, FIFO `popitem()`, and accept-`Mapping`-return-`dict` |
| 24 | **[Dict equality](09c-dict-equality.md)** | the algorithm, 🔴 NaN values and reflexivity, the cross-type table (`OrderedDict`, `Counter`, proxies), `<` raising in `sorted`/`heapq`, and freezing a dict as a key |
| 25 | **[`dict` across threads](10-dict-across-threads.md)** | GIL vs free-threaded guarantees operation by operation, 🔴 the three documented races and their fixes, locked counters, once-only cache fills, and the same race across `await` |
| 26 | **[Dicts and JSON](11-dicts-and-json.md)** | 🔴 `loads(dumps(x)) != x` for non-string keys, what each key type becomes, `default=` never seeing keys, `skipkeys`, repeated names, and `sort_keys` sorting before conversion |

## Phase gate

You are done with this topic when you can explain, without opening documentation, why each of these is true — and write the fix for the ones that are bugs:

- `d[k]` is *O*(1) and yet a dict keyed on your own class can be quadratic to build.
- `{1: "a", True: "b"}` has one entry, and `{"a": 1, "b": 2} == {"b": 2, "a": 1}` is `True` in a language where dicts are ordered.
- A key whose `__hash__` depends on a mutable field is still in `len(d)` and `list(d)` but not reachable with `d[k]`.
- `for k in d: del d[k]` raises — and a loop whose body contains no `del` can raise the same error.
- `dict.fromkeys(keys, [])` and `{k: shared for k in keys}` share one list, while `{k: [] for k in keys}` does not.
- `defaults.update(overrides)` in a request handler is a bug and `defaults | overrides` is not; `Counter(a=3) | {"a": 1}` is `{'a': 1}`.
- A `dict` subclass that raises in `__setitem__` is still mutable, and `json.dumps` on a `UserDict` raises.
- `counts[k] += 1` from two threads loses increments, on either build.
- `json.loads(json.dumps({1: "x"}))[1]` is a `KeyError`.

## Where this connects

- **[Phase 3 — Collections in depth](../README.md)** is the phase this topic belongs to.
- **Phase 1 · 06 · Comparisons** owns `__eq__` and `__hash__` as a pair, which chunks 5–8 build on.
- **Phase 1 · 09 · Comprehensions** covers comprehension syntax generally; chunk 18 is the dict-specific semantics.
- **Phase 1 · 10 · `match` and pattern matching** is the best tool for nested mappings in chunk 10.
- **Phase 1 · 12 · EAFP vs LBYL** owns the `d[k]`-and-catch versus check-first argument that chunk 9 relies on.
- [01 · `list` internals](../01-list-internals/README.md) is the dynamic array whose iteration-while-mutating failure is silent where the dict's is loud.
- [02 · `tuple`](../02-tuple/README.md) is the hashable-if-its-contents-are key type.
- **04 · `set` and `frozenset`** *(not written yet)* is the same hash table without values — every hashability rule here applies unchanged, and its iteration order is *not* guaranteed.
- **06 · `collections`** *(not written yet)* owns `defaultdict`, `Counter`, `OrderedDict` and `ChainMap`, which this topic uses only at their boundary with `dict`.
- **08 · `copy` vs `deepcopy`** *(not written yet)* is the answer to every "shallow" warning in chunks 17, 19 and 21.
- **09 · Iteration idioms** *(not written yet)* and **10 · Sorting compound data** *(not written yet)* cover `zip(strict=True)` and multi-key `sorted()` beyond the dict-shaped uses here.

---

← Prev: [Phase 3 — Collections in depth](../README.md) · Start → [01 · The hash table underneath](01-the-hash-table-underneath.md)
