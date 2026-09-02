---
title: "Comparisons: six overridable operators, one chaining rule, and `is` for exactly the things that are singletons"
sidebar_label: "06 · Comparisons"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 language reference
> [Comparisons](https://docs.python.org/3.14/reference/expressions.html#comparisons),
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons),
> [Membership tests](https://docs.python.org/3.14/reference/expressions.html#membership-test-operations)
> and [Identity comparisons](https://docs.python.org/3.14/reference/expressions.html#is);
> the data model on
> [rich comparison methods](https://docs.python.org/3.14/reference/datamodel.html#object.__lt__)
> and [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__);
> [Built-in Constants — `NotImplemented`](https://docs.python.org/3.14/library/constants.html#NotImplemented);
> [`sorted()`](https://docs.python.org/3.14/library/functions.html#sorted),
> [`min()`/`max()`](https://docs.python.org/3.14/library/functions.html#min),
> [`id()`](https://docs.python.org/3.14/library/functions.html#id);
> the [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html);
> [`functools.total_ordering`](https://docs.python.org/3.14/library/functools.html#functools.total_ordering)
> and [`cmp_to_key`](https://docs.python.org/3.14/library/functools.html#functools.cmp_to_key);
> [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html);
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset),
> [Hashing of numeric types](https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types)
> and [Dictionary view objects](https://docs.python.org/3.14/library/stdtypes.html#dictionary-view-objects);
> [`bisect`](https://docs.python.org/3.14/library/bisect.html),
> [`itertools.groupby`](https://docs.python.org/3.14/library/itertools.html#itertools.groupby),
> [`collections.Counter`](https://docs.python.org/3.14/library/collections.html#collections.Counter),
> [`datetime`](https://docs.python.org/3.14/library/datetime.html),
> [`enum`](https://docs.python.org/3.14/library/enum.html),
> [`sys.intern`](https://docs.python.org/3.14/library/sys.html#sys.intern),
> [`unittest.mock.ANY`](https://docs.python.org/3.14/library/unittest.mock.html#any),
> [`-b`/`-bb`](https://docs.python.org/3.14/using/cmdline.html#cmdoption-b),
> the [glossary entry for *immortal*](https://docs.python.org/3.14/glossary.html#term-immortal)
> and the [C API small-integer cache note](https://docs.python.org/3.14/c-api/long.html#c.PyLong_FromLong);
> [PEP 8](https://peps.python.org/pep-0008/#programming-recommendations) and
> [PEP 683](https://peps.python.org/pep-0683/);
> CPython
> [`Python/codegen.c`](https://github.com/python/cpython/blob/3.14/Python/codegen.c),
> [`Doc/whatsnew/3.0.rst`](https://github.com/python/cpython/blob/3.14/Doc/whatsnew/3.0.rst),
> [`Doc/whatsnew/3.8.rst`](https://github.com/python/cpython/blob/3.14/Doc/whatsnew/3.8.rst)
> and [`Doc/library/stdtypes.rst`](https://github.com/python/cpython/blob/3.14/Doc/library/stdtypes.rst);
> NumPy
> [`numpy/_core/src/multiarray/number.c`](https://github.com/numpy/numpy/blob/main/numpy/_core/src/multiarray/number.c);
> and the
> [SQLAlchemy 2.0 operator reference](https://docs.sqlalchemy.org/en/20/core/operators.html).
> Version spine: **CPython 3.14**.

**Comparison in Python is a runtime method dispatch, not a primitive. Every one of the
six operators calls a dunder that can return anything, decline with `NotImplemented`
so the other operand gets a turn, or build a SQL query. Layered on that are three
rules that decide most of the bugs: chaining rewrites `a < b < c` into pairwise `and`s
with each operand evaluated once, `is` compares object identity and is right only for
singletons you control, and Python 3 refuses to order values across types that have no
meaningful order — which turns Python 2's silent nonsense into a `TypeError` you meet
inside `sorted()` on the first day real data contains a `None`.**

## The chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The six operators](01-the-six-operators.md)** | The operator→dunder table; all six share one precedence, below arithmetic and bitwise; comparisons need not return `bool`; what `object` gives you (identity equality, no ordering) |
| 1b | **[Consistency and dispatch](01b-consistency-and-dispatch.md)** | The five consistency rules and the fact that nothing enforces them; comparison as a runtime dispatch; special methods looked up on the type; the `operator` module |
| 2 | **[NotImplemented and reflection](02-notimplemented-and-reflection.md)** | The three-valued protocol; the reflection table; subclass-first priority; `==`/`!=` falling back to identity while ordering raises |
| 2b | **[Writing `__eq__` correctly](02b-writing-eq-correctly.md)** | Why `return False` breaks the protocol; `NotImplemented` versus an explicit `TypeError`; the 3.14 `TypeError` for `NotImplemented` in a boolean context |
| 2c | **[`__ne__`, `__hash__` and the contract](02c-ne-hash-and-the-contract.md)** | `__ne__` derives itself; defining `__eq__` sets `__hash__` to `None`; the three ways out; hash consistency across the numeric tower |
| 3 | **[Chaining](03-chaining.md)** | The formal rewrite; single evaluation; short-circuiting; precedence and how parentheses break a chain; the walrus inside a chain |
| 3b | **[What else chains](03b-what-else-chains.md)** | `is` and `in` chain too; `False == False in [False]`; `a != b != c`; `lo <= x >= hi`; why a chained comparison detonates a NumPy array |
| 4 | **[`is` versus `==`](04-is-versus-equals.md)** | Identity versus value; `is None` as the only universal rule; sentinels; `is True`/`is False`; `type(x) is C` versus `isinstance` |
| 4b | **[Why `is` seems to work](04b-why-is-seems-to-work.md)** | The `-5..256` small-integer cache; constants shared inside one code object; string interning and `sys.intern`; why the REPL and a file disagree |
| 4c | **[The warning and lifetimes](04c-the-syntaxwarning-and-lifetimes.md)** | The `is`-with-a-literal `SyntaxWarning`, its exact text and its exemptions; what it cannot see; immortality (PEP 683); `id()` reuse |
| 5 | **[Cross-type comparison](05-cross-type-comparison.md)** | Exact comparison across the numeric tower; `1 == 1.0` but `1 is not 1.0`; Python 3's removal of arbitrary ordering; sorting heterogeneous data; `bool` is an `int` |
| 5b | **[Text, sequences, time and enums](05b-text-sequences-time-and-enums.md)** | `bytes` vs `str` and `-bb`; `[1,2] == (1,2)` is `False`; naive vs aware `datetime`; `Enum` members versus their values |
| 5c | **[`None` never orders](05c-none-never-orders.md)** | The `TypeError` from one null; the four fixes and what each decides; `reverse=True` flipping the null partition; SQL's three-valued logic as the contrast |
| 6 | **[NaN and the protocol](06-nan-and-the-protocol.md)** | NaN as the reference's own counterexample; the `x is e or x == e` containment rule; why `[n] == [n]`; the 3.13 dataclass `__eq__` change |
| 7 | **[Sequences and strings](07-sequences-and-strings.md)** | Lexicographic comparison and its short-circuit; tuple keys; code-point ordering; `casefold`; Unicode normalisation; locale collation |
| 7b | **[Mappings and sets](07b-mappings-and-sets.md)** | `dict` supports only `==`; set-like dict views; `<` meaning proper subset; the partial-order trap; `Counter`'s 3.10 comparison change |
| 8 | **[Sorting](08-sorting.md)** | `key=` not `cmp=` and why; only `<` is used; stability as a guarantee; multi-pass ordering; `reverse=True` versus negating a key; `cmp_to_key` |
| 8b | **[Sort keys in practice](08b-sort-keys-in-practice.md)** | `itemgetter`/`attrgetter`; decorate-sort-undecorate and its tie-break slot; external-lookup keys; natural sort; case-insensitive sort |
| 8c | **[min, max, heapq, bisect, groupby](08c-min-max-heapq-bisect-groupby.md)** | `default=` and first-wins ties; which `heapq` functions take a key; `bisect`'s key not being applied to `x`; why `groupby` needs sorted input |
| 9 | **[`total_ordering`](09-total-ordering-and-dataclasses.md)** | What it requires and generates; the two documented costs; why a superclass method blocks it; `NotImplemented` propagation |
| 9b | **[Dataclasses](09b-dataclasses-and-generated-methods.md)** | `order=True` as a field tuple and why declaration order is load-bearing; `field(compare=False)`; the `eq`/`frozen`/`__hash__` table; `unsafe_hash` |
| 10 | **[`==` is not a boolean](10-when-equality-is-not-a-boolean.md)** | The rule that permits it; NumPy and pandas element-wise `==`; `&` versus `and` and the parentheses; the exact `ValueError` texts |
| 10b | **[ORMs, mocks, defensive code](10b-orms-mocks-and-defensive-code.md)** | SQLAlchemy's `==` building SQL and `== None` meaning `IS NULL`; `mock.ANY`; what a shared utility can actually rely on |

## The one paragraph the whole topic expands

Use `==` for values and `is` only for singletons — `None`, `True`, `False`,
`Ellipsis`, `NotImplemented`, and sentinels you created with `object()`. Write
`if x is None:`, never `if x == None:`, because `==` runs code that any library can
redefine. Chain freely for range checks (`0 <= i < len(items)`) and never for `!=` or
`in`, because a chain is only pairwise. When you implement comparison on your own
type, return `NotImplemented` — not `False` — for types you do not handle, define
`__hash__` alongside `__eq__` or accept that the class is unhashable, and use
`@dataclass(order=True, frozen=True)` or `@functools.total_ordering` rather than
writing six methods by hand. When you need an ordering for one call site, do not put it
on the type at all: pass `key=`, use a tuple for multiple levels, and partition on
`is None` so a single missing value cannot take the sort down.

## Where this connects

- **[Numbers](../02-numbers/README.md)** owns the numeric side of NaN, signed zero,
  float tolerance and `Decimal`. This topic owns the *protocol* consequences —
  [`../02-numbers/06-nan-inf-and-signed-zero.md`](../02-numbers/06-nan-inf-and-signed-zero.md),
  [`../02-numbers/06b-detecting-nan-and-containers.md`](../02-numbers/06b-detecting-nan-and-containers.md)
  and [`../02-numbers/07-comparing-floats.md`](../02-numbers/07-comparing-floats.md)
  are the numeric half of chunks 5 and 6, and
  [`../02-numbers/04-bool-is-an-int.md`](../02-numbers/04-bool-is-an-int.md) is why
  `True == 1`.
- **[Strings](../03-strings/README.md)** is where `casefold`, normalisation and the
  method vocabulary live; chunk 7 uses them as comparison tools.
- **[`bytes` vs `str`](../04-bytes-and-encoding/README.md)** is the other half of the
  silent `b"x" == "x"`; chunk 5b adds `-b`/`-bb` as the audit for it.
- **Truthiness** is the neighbouring topic: `if x:` is a `bool()` call, which is the
  mechanism chunks 3b and 10 keep running into.
- **Assignment semantics and aliasing** is next, and it is the other half of `is`:
  identity is what aliasing is *about*.
- **Phase 2 — the object model** is where `__eq__`, `__hash__`, `__slots__` and the
  descriptor protocol get their full treatment; this topic uses them at working depth.
- **Phase 10 — Data, files and integrations** is where the SQL `NULL` contrast of
  chunk 5c and the ORM behaviour of chunk 10b stop being a footnote and become a query.

---

← Prev: [`bytes` vs `str`](../04-bytes-and-encoding/README.md) · Index: [Phase 1 — Language core](../README.md) · Next → **Assignment semantics and aliasing** *(not written yet)*
