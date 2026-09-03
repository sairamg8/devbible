---
title: "Comprehensions: one grammar, four wrappers, and a scope that is not quite a function"
sidebar_label: "09 · Comprehensions"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [Displays for lists, sets and dictionaries](https://docs.python.org/3.14/reference/expressions.html#displays-for-lists-sets-and-dictionaries),
> [Generator expressions](https://docs.python.org/3.14/reference/expressions.html#generator-expressions),
> [Conditional expressions](https://docs.python.org/3.14/reference/expressions.html#conditional-expressions),
> [Execution model — naming and binding](https://docs.python.org/3.14/reference/executionmodel.html#naming-and-binding),
> [Annotation scopes](https://docs.python.org/3.14/reference/executionmodel.html#annotation-scopes),
> the [Glossary](https://docs.python.org/3.14/glossary.html#term-list-comprehension)
> (list comprehension, generator expression, iterator, hashable, optimized scope),
> the [Functional Programming HOWTO](https://docs.python.org/3.14/howto/functional.html#generator-expressions-and-list-comprehensions),
> the Library Reference
> ([`itertools`](https://docs.python.org/3.14/library/itertools.html),
> [`map`](https://docs.python.org/3.14/library/functions.html#map),
> [`filter`](https://docs.python.org/3.14/library/functions.html#filter),
> [`any`](https://docs.python.org/3.14/library/functions.html#any)/[`all`](https://docs.python.org/3.14/library/functions.html#all),
> [`locals`](https://docs.python.org/3.14/library/functions.html#locals),
> [`collections`](https://docs.python.org/3.14/library/collections.html),
> [`dis`](https://docs.python.org/3.14/library/dis.html),
> [`symtable`](https://docs.python.org/3.14/library/symtable.html),
> [`timeit`](https://docs.python.org/3.14/library/timeit.html)),
> [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict),
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset),
> [What's New in 3.12 — PEP 709](https://docs.python.org/3.14/whatsnew/3.12.html#pep-709-comprehension-inlining),
> [What's New in 3.13 — PEP 667](https://docs.python.org/3.14/whatsnew/3.13.html),
> the [Time Complexity wiki page](https://wiki.python.org/moin/TimeComplexity),
> and [PEP 289](https://peps.python.org/pep-0289/), [PEP 308](https://peps.python.org/pep-0308/),
> [PEP 448](https://peps.python.org/pep-0448/), [PEP 572](https://peps.python.org/pep-0572/),
> [PEP 584](https://peps.python.org/pep-0584/), [PEP 695](https://peps.python.org/pep-0695/),
> [PEP 709](https://peps.python.org/pep-0709/).
> Target: **CPython 3.14**.

**There is one comprehension grammar, and the brackets around it decide what you
get: `[...]` a list, `{...}` a set, `{k: v ...}` a dict, `(...)` a generator —
and that last one is not a "tuple comprehension", it is a lazy iterator that
happens to be spelled with parentheses. Everything hard about the topic comes
from two facts the syntax hides. First, a comprehension has its **own scope**,
which is why the loop variable never leaks and why the same expression that
works at module level raises `NameError` in a class body. Second, that scope was
**inlined into its enclosing function by PEP 709 in 3.12** — the isolation
survived, but tracebacks, `symtable`, `locals()` and tracing all changed
observably, and generator expressions were deliberately left out.**

The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The four forms](01-the-four-forms.md)** | One grammar, four wrappers; `{}` is an empty dict and there is no empty-set literal; why a genexp is **not** a tuple comprehension; the parenthesis rule (sole argument, no keywords) and the tuple-element trap it creates; `yield` banned inside a comprehension |
| 2 | **[Grammar and clause order](02-the-grammar-and-clause-order.md)** | The grammar exactly, and the documentation's own loop expansion; flattening in the order everyone gets backwards (`for row in grid for y in row`); why `[x for x in xs]` is not how you copy a list |
| 2b | **[Multiple clauses](02b-multiple-clauses.md)** | Multiple `for` clauses are a **Cartesian product, not a zip**, and every clause after the first is re-evaluated per outer value; a later clause using an earlier target; multiple `if`s are `and`, with the caveat; where the `if` sits decides what it filters; three clauses is the line |
| 2c | **[Filter vs conditional](02c-filter-versus-conditional-expression.md)** | The two positions of `if` — the trailing filter versus the leading conditional expression; both at once, in the order that surprises people; the exact `SyntaxError`s each mix-up produces; `if not` versus an `else` branch; equivalence with `filter()`; when the branch should be a function |
| 3 | **[Scope and the target](03-scope-and-the-target.md)** | The isolation rule verbatim; why the **leftmost iterable** is evaluated in the enclosing scope; the walrus leaking on purpose (PEP 572); the closure trap where `[lambda: i for i in range(3)]` gives three functions returning the same value; `nonlocal`/`global` inside a comprehension |
| 3b | **[The class body trap](03b-the-class-body-trap.md)** | Why a comprehension in a class body cannot see the class's other names, and why its **leftmost iterable** is the one exception; why class scope works this way at all; why module scope does not have the problem; and that PEP 709 did **not** fix it |
| 3c | **[Fixing the class body trap](03c-fixing-the-class-body-trap.md)** | Four ways out — method/`classmethod`, module-level constants, the default-argument smuggle, the loop-then-`del` — and the two you should actually ship; the `Enum` and `dataclass` variants where the fix adds a field or a member; why a walrus here is a `SyntaxError` rather than a `NameError`; annotation scopes as the documented exception |
| 4 | **[PEP 709 inlining](04-pep-709-inlining.md)** | What the PEP changed in 3.12 and what it did not; how isolation survives without a separate function frame; the speedup as the PEP itself attributes it |
| 4b | **[What inlining changed](04b-what-inlining-changed.md)** | The four observable changes — tracebacks, `symtable`, `locals()`, tracing/`coverage` — where `locals()` stands in 3.14 after PEP 667, and the generator expressions that were **left out** of inlining |
| 5 | **[Generator expressions](05-generator-expressions.md)** | What a genexp actually is; the memory argument PEP 289 exists for; short-circuiting as the other half of the win; piping without materialising; `list(genexp)` versus a list comprehension; `tuple`/`set`/`dict` built from one |
| 5b | **[Eager leftmost, lazy rest](05b-eager-leftmost-and-lazy-rest.md)** | The documented split: the leftmost iterable is evaluated **immediately**, everything else at consumption time; late binding of free variables, and the tracebacks that point at the wrong line because of it |
| 5c | **[One-shot exhaustion](05c-one-shot-exhaustion.md)** | An exhausted generator does not raise — it looks exactly like an empty container, so a function that iterates twice returns a plausible wrong answer; why it does not reproduce in tests; defending against it, and the `itertools.tee` "fix" that trades the bug for memory |
| 6 | **[Dict and set comprehensions](06-dict-and-set-comprehensions.md)** | The duplicate-key rule verbatim — **last value wins, silently** — and how a query result loses rows without an error; detecting collisions instead of asserting; when a duplicate key means you wanted a grouping; building an inverted index |
| 6b | **[Merging, fromkeys, hashability](06b-merging-fromkeys-and-hashability.md)** | `dict.fromkeys` sharing **one** value object; `{**a, **b}` versus `\|` versus a dict comprehension; key/value evaluation order; hashability for set and dict comprehensions, including the numeric-equality collapse that loses elements |
| 7 | **[Performance](07-performance.md)** | The structural difference — `LIST_APPEND` versus a resolved `append` method call; what PEP 709 added on top; the `map`-with-a-C-function case that can beat both, and the `map`-with-a-`lambda` case that never does; `list(genexp)` versus `[...]` |
| 7b | **[What actually costs](07b-what-actually-costs.md)** | What actually dominates a slow comprehension (it is never the comprehension) — the O(n) membership test that should be a set, the per-element query, the repeated call — and the measurement discipline that settles it with `timeit` |
| 8 | **[When it should be a loop](08-when-it-should-have-been-a-loop.md)** | Tests 1–3: the value is discarded (the comprehension used as a statement), you need `try`/`except`, you need to stop early — each with the loop it should have been |
| 8b | **[Three more tests](08b-three-more-tests.md)** | Tests 4–6: the body wants a statement or an intermediate name, more than two `for` clauses, and any accumulation across elements — including whether the walrus makes accumulation acceptable (it does not) |
| 9 | **[When it is right](09-when-the-comprehension-is-right.md)** | The other direction — six situations where the comprehension is the better engineering: map/filter over one collection, the places a statement cannot go, an aggregate that should never be materialised, a lookup table or dedup, inline `key=` shaping, and the all-or-nothing binding that leaves **no partial result** when it raises |

## The one paragraph the whole topic expands

A comprehension is an expression that builds a container by looping, and the
brackets pick the container — with `(...)` picking *no* container at all and
handing you a lazy iterator instead. Its `for` clauses read left to right
exactly like nested loops, so flattening is `for row in grid for y in row`; a
trailing `if` filters while a leading `if`/`else` branches, and confusing them
gives two distinct `SyntaxError`s. It runs in its own scope, so the loop
variable does not leak — but the leftmost iterable is evaluated outside that
scope, which is simultaneously why a genexp starts eagerly, why a class-body
comprehension can see its first iterable and nothing else, and why a walrus
inside one binds in the enclosing function. Since 3.12 that scope is inlined
rather than a hidden function, which changed what tracebacks, `symtable`,
`locals()` and coverage tools see without changing the isolation. Dict
comprehensions keep the **last** value for a duplicate key and tell you nothing
about it. And the honest line is that a comprehension stops being the right tool
the moment it needs a statement, an exception, an early exit, or state carried
between elements.

## Where this connects

- **[Control flow](../08-control-flow/README.md)** owns the loop a comprehension
  is competing with — `break`/`else`, and why `try`/`except` and early exit are
  statements a comprehension cannot host.
- **[`match` — structural pattern matching](../10-match-pattern-matching/README.md)**
  is the other construct that looks like it destructures the same way; it
  matches rather than assigns.
- **[Assignment semantics and aliasing](../07-assignment-and-aliasing/README.md)**
  explains why `dict.fromkeys(keys, [])` shares one list, and why a
  comprehension over mutable elements copies the container and not the contents.
- **[Truthiness](../05-truthiness/README.md)** owns the filter's predicate — the
  trailing `if` calls `bool()` on whatever the expression returns, with all the
  `0`/`""`/empty-container consequences.
- **[Unpacking](../13-unpacking/README.md)** shares the `*rest` spelling and the
  `for k, v in d.items()` target form the dict chunks lean on.
- **Phase 2 — Functions** owns the `lambda` in the closure trap, and the
  late-binding rule the trap is an instance of.
- **Phase 5 — Iterators, generators, context managers** picks up where 5b and 5c
  stop: `yield`, generator functions, `itertools` as a pipeline toolkit, and
  re-iterability as a design decision.

---

← Prev: [Control flow](../08-control-flow/README.md) · Index: [Phase 1 — Language core](../README.md) · Next → [`match` — structural pattern matching](../10-match-pattern-matching/README.md)
