---
title: "Everything is an object: names bind, they never copy"
sidebar_label: "07 · Everything is an object"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14 Language Reference
> §3.1 [Objects, values and types](https://docs.python.org/3.14/reference/datamodel.html),
> §6.10 [Comparisons](https://docs.python.org/3.14/reference/expressions.html),
> the [`id()`](https://docs.python.org/3.14/library/functions.html#id) and
> [`sys.intern()`](https://docs.python.org/3.14/library/sys.html#sys.intern) library
> docs, the [C-API `PyLong_FromLong`](https://docs.python.org/3.14/c-api/long.html)
> small-integer note, and
> [What's New in 3.8](https://docs.python.org/3.14/whatsnew/3.8.html) (the
> `is`-with-a-literal `SyntaxWarning`). Target: **CPython 3.14**.

**Python has no variables in the C or Java sense. It has *names*, and a name is
a label tied to an object that lives somewhere else. `a = b` copies a label, not
a thing. Every "why did my other list change?", every "why is `is` sometimes
True for `1000` and sometimes not", and every mutable-default bug in the
language falls out of that one sentence. This topic makes the model literal, so
that the bugs stop being surprises.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Names and objects](01-names-and-objects.md)** | The label model; rebinding vs mutating; aliasing; immutability hiding the distinction; the `+=` asymmetry; multiple assignment |
| 2 | **[Binding in functions](02-binding-in-functions.md)** | Call-by-binding; why a swap function is impossible; mutate-or-return as an API decision; what `del` actually deletes |
| 2b | **[Default arguments](02b-default-arguments.md)** | Defaults are objects created once at `def` time — the mutable-default bug and its four disguises; sentinels when `None` is a legal value |
| 3 | **[Identity and equality](03-identity-and-equality.md)** | `id()` and its lifetime rule; `is` vs `==`; the `__eq__` contract; the `is None` rule; the `SyntaxWarning` for `is` against a literal |
| 3b | **[NaN](03b-nan.md)** | The float that is not equal to itself — silent unsorted sorts, broken threshold checks, and JSON that is not JSON |
| 3c | **[Container comparison](03c-container-comparison.md)** | Why `in`, `index`, `remove` and dict lookup try `is` before `==` — and what a non-reflexive `__eq__` does to them |
| 4 | **[Caching and interning](04-caching-and-interning.md)** | The `-5..256` small-int cache, compile-time constant merging and folding, string interning |
| 4b | **[Immortal objects](04b-immortal-objects.md)** | PEP 683, what free-threading changes, and the closing argument: every one of these caches hides a bug rather than causing one |

## The one paragraph the whole topic expands

The Language Reference states the model outright:

> *"Every object has an identity, a type and a value. An object's identity never
> changes once it has been created; you may think of it as the object's address
> in memory. The `is` operator compares the identity of two objects; the `id()`
> function returns an integer representing its identity."*

Three properties. Assignment touches none of them — it only decides which name
points at which object. Mutation changes the *value* of an object, in place,
where every name pointing at it can see the change. Confusing those two
operations is the single most productive source of Python bugs at the
intermediate level.

## Why this is a Master row

- **It is the prerequisite for the data model.** Hashability, `__eq__`/`__hash__`,
  dict keys, set membership and `copy` vs `deepcopy` are all statements about
  identity and value. None of them make sense before this topic lands.
- **It is the prerequisite for functions.** The mutable-default trap
  (`def f(items=[])`) is not a quirk — it is exactly this model applied to
  default arguments, which are evaluated once and then bound forever.
- **It is where `is` goes wrong.** `is` reads like English and means something
  very precise. Small-integer caching makes the wrong usage *work* in testing
  and fail in production, which is the worst failure mode a language offers.

## Where this connects

- **Assignment semantics, `copy` vs `deepcopy`** — Phase 1 turns the aliasing
  described here into the practical "when do I need `copy.deepcopy`" decision.
- **The mutable-default trap and closures** — Phase 2 (`Parameters in full`)
  builds directly on chunks 1 and 2b.
- **`__eq__` / `__hash__` and hashability** — Phase 3 (the data model) turns
  chunks 3–3c's equality contract into rules for dict keys and set members.

---

← Prev: [Running code](../06-running-code/README.md) · Index: [Phase 0 — The runtime](../README.md) · Next → [Names and objects](01-names-and-objects.md)
