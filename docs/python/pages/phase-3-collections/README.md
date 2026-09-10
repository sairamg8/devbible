---
title: "Phase 3 — Collections in depth"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Python 3.14** (3.14.7, August 2026). Documentation-validated — every
> page names its sources on a `> Verified:` line (docs.python.org/3.14, the PEPs,
> the language reference). No sandbox: pages carry Python code, never fabricated
> program output.

You already used lists and dicts in Phase 1. This phase is their **cost model** —
the part that decides whether a request finishes in 8ms or 8 seconds — and the
standard-library structures that replace the code most people hand-roll instead.

The distinction that runs through the whole phase is *shape of access*. A `list`
is a dynamic array, so `append` is amortised O(1) and `insert(0, x)` is O(n); a
`dict` and a `set` are hash tables, so membership is O(1) but the key must be
hashable, which is why a list cannot be one. Almost every "why is this slow"
report in a Python service resolves to a structure chosen for the wrong access
pattern — a `list` used as a queue, an `in` test against a 50,000-element list
inside a loop, a nested loop doing what `set` difference does in one character.

The other half is `collections`. `defaultdict` is the group-by, `Counter` is the
top-N, `deque` is the queue that `list.pop(0)` only pretends to be. Reaching for
them is the single largest readability win available in day-to-day Python, and
the tier assignments below reflect that.

🚧 **In flight — 7 of 12.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[`list` internals](./01-list-internals/README.md)** · 31 chunks | <span className="db-tier t-master">Master</span> | Dynamic array, over-allocation, Timsort, and the `x = x.sort()` bug |
| 02 | **[`tuple`](./02-tuple/README.md)** · 28 chunks | <span className="db-tier t-understand">Understand</span> | Immutable, hashable-if-contents-are, and when a dataclass beats a 4-tuple |
| 03 | **[`dict`](./03-dict/README.md)** · 26 chunks | <span className="db-tier t-master">Master</span> | Insertion order as a guarantee, views, merge, and what may be a key |
| 04 | **[`set` and `frozenset`](./04-set-and-frozenset/README.md)** · 26 chunks | <span className="db-tier t-master">Master</span> | O(1) membership, dedupe, and set algebra instead of a nested loop |
| 05 | **[Slicing deeply](./05-slicing/README.md)** · 26 chunks | <span className="db-tier t-understand">Understand</span> | `[start:stop:step]`, negatives, slice assignment, and slices as copies |
| 06 | **[`collections`](./06-collections-module/README.md)** · 17 chunks | <span className="db-tier t-master">Master</span> | `defaultdict`, `Counter`, `deque`, `namedtuple`, `ChainMap` |
| 07 | **[`heapq` and `bisect`](./07-heapq-and-bisect/README.md)** · 18 chunks | <span className="db-tier t-understand">Understand</span> | Top-K without a full sort; binary search on sorted data |
| 08 | **`copy` vs `deepcopy`** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | One level vs the whole graph, and the config two requests shared |
| 09 | **Iteration idioms** *(not written yet)* | <span className="db-tier t-master">Master</span> | `enumerate`, `zip(strict=True)`, `reversed`, `any`/`all`, `min`/`max` |
| 10 | **Sorting compound data** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `key=`, `itemgetter`/`attrgetter`, multi-key sorts, stability as a feature |
| 11 | **Choosing a structure** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | The decision table — and when the answer is a database, not a bigger dict |
| 12 | **`array` and `memoryview`** *(not written yet)* | <span className="db-tier t-when">When Needed</span> | Compact numeric storage below numpy, and buffers without copies |

## Phase gate

The deliverable: *"count page views per user per day, then the top 10 users"*
comes out as `defaultdict` / `Counter` plus `most_common` in a few lines — with
no index arithmetic anywhere, and a one-sentence answer for why `deque` and not
`list` when the same code has to drain a queue from the front.

## Where this connects

- **[Phase 1 — Assignment and aliasing](../phase-1-language-core/07-assignment-and-aliasing/README.md)**
  is the prerequisite for topic 08: `copy` and `deepcopy` are answers to a
  question that phase asked — two names for one object.
- **[Phase 1 — Comparisons](../phase-1-language-core/06-comparisons/README.md)**
  owns `__eq__`/`__hash__` as a pair, which is what makes a key legal here.
- **[Phase 1 — Comprehensions](../phase-1-language-core/09-comprehensions/README.md)**
  builds the collections this phase measures.
- **[Phase 2 — Functions](../phase-2-functions/README.md)** supplies the `key=`
  callables that topics 09 and 10 lean on, and the mutable-default trap that a
  shared `list` on a class re-creates in Phase 4.
- **Phase 4 — Classes and the data model** is where `namedtuple` gives way to
  `@dataclass`, and where you implement the protocols this phase only consumes.

---

← Prev: [Phase 2 — Functions, closures and decorators](../phase-2-functions/README.md) · Index: [Python — Explanations](../README.md)
