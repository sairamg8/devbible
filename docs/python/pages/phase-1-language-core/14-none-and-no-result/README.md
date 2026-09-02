---
title: "`None` and the \"no result\" contract: pick one per function and mean it"
sidebar_label: "14 · `None` and no-result"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [Built-in Constants](https://docs.python.org/3.14/library/constants.html),
> [`typing.Optional`](https://docs.python.org/3.14/library/typing.html#typing.Optional),
> [`list.sort`](https://docs.python.org/3.14/library/stdtypes.html#list.sort),
> [`dict.get`](https://docs.python.org/3.14/library/stdtypes.html#dict.get),
> the Language Reference
> [The `return` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-return-statement)
> and [`object.__init__`](https://docs.python.org/3.14/reference/datamodel.html#object.__init__),
> and [PEP 8](https://peps.python.org/pep-0008/), [PEP 484](https://peps.python.org/pep-0484/),
> [PEP 604](https://peps.python.org/pep-0604/), [PEP 505](https://peps.python.org/pep-0505/).
> Target: **CPython 3.14**.

**`None` is the sole instance of `NoneType`, which is why `is None` is the right
test and `== None` is not. It is also what Python hands back when a function
ends without returning, and what every mutating method returns on purpose — so
`xs.sort()` gives you `None` and `sorted(xs)` gives you the list. Beyond the
mechanics sits the design question this topic is named for: a function that
might have no answer can return `None`, return an empty container, or raise. All
three are right in different places, and the failure is not picking wrongly — it
is picking by accident, or picking differently in two functions that answer the
same kind of question.**

The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What `None` is](01-what-none-is.md)** | The singleton and why `is None` beats `== None` in three escalating ways, ending with numpy; the implicit return and its conditional variant; mutating methods returning `None` as **command–query separation**, the stdlib table, and the five deliberate exceptions; `__init__` having to return `None` |
| 2 | **[Picking a no-result contract](02-picking-a-contract.md)** | The three contracts and what each tells the caller; why a collection-returning function should never return `None`; the `get_x`/`find_x` naming convention; `None` propagation and resolving it at a boundary since PEP 505 is deferred; what an annotation does and does not carry; `None` breaking `sorted` and the tuple-key fix; the boundary table where SQL's `NULL = NULL` breaks the analogy |

## The one paragraph the whole topic expands

There is one `None`, so compare it with `is`. Functions return it when they fall
off the end, and mutators return it deliberately so that a command cannot be
mistaken for a query. When you write a function that might have no answer,
choose consciously between `None`, an empty container, and raising: `None` when
absence is routine, empty when the result is plural, a raise when the caller's
assumption was wrong — and then say which in the annotation and the name, because
`T | None` records *that* there may be no value and never *what the absence
means*.

## Where this connects

- **[Truthiness](../05-truthiness/README.md)** is the other half of this topic:
  `None` is falsy and so is every legitimately empty value, which is why
  truthiness cannot answer "did I get a value" and
  [empty-versus-missing](../05-truthiness/02-empty-versus-missing.md) is a
  separate bug class. The [sentinel pattern](../05-truthiness/02b-where-the-gap-opens.md)
  is what you reach for when `None` is itself a legal value.
- **[Comparisons](../06-comparisons/README.md)** explains why `None` has no
  ordering — Python 3 removed the arbitrary cross-type ordering — which is what
  makes one `None` break a whole `sorted()`.
- **[Unpacking](../13-unpacking/README.md)** — a function returning a bare tuple
  has its arity checked only at runtime, which is one more reason to return a
  `NamedTuple` once the "no result" case needs a shape of its own.
- **Exceptions, the working set** *(not written yet)* owns the third contract
  properly: what to raise, how to chain it, and why a custom exception type
  beats a `None` the caller forgot to check.
- **Phase 6 — Typing** is where `X | None` stops being documentation and starts
  being enforced, and where `TypeIs`/`TypeGuard` narrow a not-`None` check for
  the checker.

---

← Prev: [Unpacking](../13-unpacking/README.md) · Index: [Phase 1 — Language core](../README.md) · Next → **PEP 8 and idiom** *(not written yet)*
