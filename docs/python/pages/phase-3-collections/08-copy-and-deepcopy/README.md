---
title: "08 · copy vs deepcopy — a copy is a decision about depth that the copy module makes by exact type and by hooks, deepcopy remembers what it has already copied in a memo keyed by id(), and the production failures — the config two requests shared, the lock that cannot be copied, the callback that copied its whole owner — are all places where the depth you assumed was not the depth you got"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 on **Python 3.14.7** — documentation- and source-validated, **no sandbox run, no program output on any page in this topic**. Against the Python 3.14 documentation ([`copy`](https://docs.python.org/3.14/library/copy.html), [`copyreg`](https://docs.python.org/3.14/library/copyreg.html), [`pickle` — pickling class instances](https://docs.python.org/3.14/library/pickle.html#pickling-class-instances), [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html), [What's New in 3.13](https://docs.python.org/3.14/whatsnew/3.13.html) and [3.14](https://docs.python.org/3.14/whatsnew/3.14.html), [Thread Safety Guarantees](https://docs.python.org/3.14/library/threadsafety.html), [`sys.setrecursionlimit`](https://docs.python.org/3.14/library/sys.html#sys.setrecursionlimit)) and the CPython source at tag **v3.14.7** — [`Lib/copy.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/copy.py), [`Lib/copyreg.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/copyreg.py), [`Objects/typeobject.c`](https://github.com/python/cpython/blob/v3.14.7/Objects/typeobject.c) — see each chunk's own `> Verified:` line.
> Target: **Python 3.14.7**. Where the documentation and the source disagree, the page says so and names both.

**`copy.copy` and `copy.deepcopy` are one pure-Python module, and everything they do is decided by a handful of tables keyed by the object's exact type, then by hooks the class may define, then by the pickle protocol's reduce value. That is why a subclass of `list` copies differently from a `list`, why a tuple of immutables comes back as itself, why an enum member and a `Decimal` are their own copies, why a lock raises and a lock-holding object's shallow copy quietly shares the lock, and why `deepcopy` of a callback dictionary can copy an entire service object. This topic reads the module the way it runs — the dispatch, the memo, `_reconstruct`, the C code that builds a default reduce value — and then applies it to the bug that pays for the topic: a per-request configuration built from shared defaults with a shallow spelling, so that request 7 changes what request 8 sees. The basics of shallow and deep copies belong to [phase 1's aliasing topic](../../phase-1-language-core/07-assignment-and-aliasing/README.md); this topic owns the machinery, the type-by-type behaviour, `copy.replace`, the alternatives, the cost, and the failure modes.**

## Chunks

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[01 · What copy.copy decides](01-what-copy-copy-decides.md)** | one decision per call, in a fixed order — atomic set, builtin `.copy`, class, `__copy__`, `copyreg`, `__reduce_ex__(4)` — and every table is keyed by the *exact* type, so 🔴 a `list` subclass never takes the list branch and `__copy__` is read from the class, never the instance; a tuple "copy" is the tuple |
| 2 | **[01b · Atomic types and identity](01b-atomic-types-and-identity.md)** | the two atomic sets differ by `tuple`, `frozenset`, `slice`, `super`; identity is decided per type, not by immutability — enum members, `Decimal`, `Fraction`, compiled patterns and loggers return themselves; a deep-copied tuple is shared only if nothing inside needed copying; 🔴 an `object()` sentinel is rebuilt so `is MISSING` fails, and a `weakref.ref` back-pointer keeps pointing at the original |
| 3 | **[02 · deepcopy, the algorithm](02-deepcopy-the-algorithm.md)** | the function verbatim and its nine ordered checks; the dispatch table has four entries (`list`, `tuple`, `dict`, bound methods) and comes *before* `__deepcopy__`; a step-by-step trace of a shared child copied once; `_keep_alive` and 🔴 why the memo holds every original alive for the whole call; two separate calls do not share a memo |
| 4 | **[02b · The memo as an API](02b-the-memo-as-an-api.md)** | documented (`memo` is opaque, pass it on) versus convention (`id(x)` keys); four tools — keep a resource shared, substitute a replacement, drop a reference with `None` (why `_nil` exists), share one memo across calls; 🔴 a memo reused for a second snapshot returns the first copy, `{session: session}` is keyed wrong, and `memo[id(memo)]` holds the originals |

## Phase gate

You are done with this topic when you can say, for any object you are about to copy, which of the five routes `copy.copy` or `copy.deepcopy` will take (atomic, builtin container, dispatch table, hook, reduce value) and what it will share, copy, refuse or call on the way; when you can write `__copy__`, `__deepcopy__`, `__getstate__` and `__replace__` that survive cycles, `__slots__` and subclasses; when you can find the shared nested dict behind "request 7 changed request 8's settings" and choose between a targeted rebuild, a `deepcopy`, and freezing the data once; and when you can say why `deepcopy` is neither atomic under threads nor bounded by anything but the recursion limit.

## Where this connects

- [Phase 1 · 07 · Assignment and aliasing](../../phase-1-language-core/07-assignment-and-aliasing/README.md) — the prerequisite. [Shallow copy](../../phase-1-language-core/07-assignment-and-aliasing/08-shallow-copy.md), [deepcopy](../../phase-1-language-core/07-assignment-and-aliasing/08b-deepcopy.md) and [copy hooks](../../phase-1-language-core/07-assignment-and-aliasing/08c-copy-hooks-and-uncopyable.md) introduce the ideas; this topic reads the code behind them and corrects two of their open questions (enum members, weak references).
- [Phase 1 · 11 · Where it bites](../../phase-1-language-core/07-assignment-and-aliasing/11-where-it-bites.md) and [11b · Diagnostics](../../phase-1-language-core/07-assignment-and-aliasing/11b-publishing-state-and-diagnostics.md) — the module-level `CONFIG` mutated in place, and the `MappingProxyType` trick that finds the writer. The per-request derivation bug in this topic is the other half of the same failure.
- [01 · `list` internals — copies and aliasing](../01-list-internals/10-copies-and-aliasing.md), [03 · `dict` — building a dict](../03-dict/06-building-a-dict.md) and [merging](../03-dict/07-merging.md), [05 · Slicing — slices are copies](../05-slicing/05-slices-are-copies.md) — the shallow spellings and their cost, owned there and only compared here.
- [06 · `collections`](../06-collections-module/README.md) — the types whose `copy()` and reduce behaviour the per-type table here cites from C source; [crossing a boundary](../06-collections-module/09-crossing-a-boundary.md) covers what happens when they leave the process.
- **Pickle in depth** *(not written yet)* owns serialisation; this topic touches it only where `copy` shares the reduce protocol and where a pickle round trip is offered as a copy.

---

← [Phase index](../README.md) · Start → [01 · What copy.copy decides](01-what-copy-copy-decides.md)
