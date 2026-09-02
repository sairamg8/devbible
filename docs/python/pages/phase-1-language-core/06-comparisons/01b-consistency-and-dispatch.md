---
title: "The five consistency rules the reference asks you to honour, why nothing enforces them, and what it means that comparison is a runtime dispatch"
sidebar_label: "1b · Consistency and dispatch"
sidebar_position: 61
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 language reference
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons),
> the [data model — rich comparison methods](https://docs.python.org/3.14/reference/datamodel.html#object.__lt__),
> the [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html),
> and the [`operator` module](https://docs.python.org/3.14/library/operator.html).
> Version spine: **CPython 3.14**.

**Python asks user-defined comparisons to be reflexive, symmetric, transitive,
correctly negating and hash-consistent — and then states, in the same section, that
it enforces none of it and ships a counterexample in the standard float type. A
comparison in Python is a runtime method dispatch on the left operand, nothing more.
Understanding it that way is what lets you predict when a type annotation will not
save you, why monkey-patching `__lt__` works, and why a comparison can hit the
network.**

## The consistency rules you are expected to honour

The language reference lists five rules for user-defined comparison, and then says
plainly that nothing enforces them. Abbreviated, with the docs' own formulation:

1. **Reflexive equality** — *"`x is y` implies `x == y`"*.
2. **Symmetric** — *"`x == y` and `y == x`"* have the same result; likewise `x < y`
   and `y > x`.
3. **Transitive** — *"`x > y and y > z` implies `x > z`"*.
4. **Inverse comparison negates** — *"`x == y` and `not x != y`"*; and for totally
   ordered types, `x < y` and `not x >= y`.
5. **Hash consistent with equality** — *"Objects that are equal should either have
   the same hash value, or be marked as unhashable."*

And the escape hatch, verbatim:

> *"Python does not enforce these consistency rules. In fact, the not-a-number values
> are an example for not following these rules."* —
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)

NaN breaks rule 1 (`x is x` but `x != x`) and rule 4 (`x < y` and `x >= y` are both
false). Sets break rule 4 too, because subset is a *partial* order. Both are
deliberate, both are covered later — [06](06-nan-and-the-protocol.md) and
[07b](07b-mappings-and-sets.md).

## Comparison is a runtime dispatch, not a compile-time type check

There is no static overload resolution here. `a < b` compiles to a `COMPARE_OP`
instruction; the interpreter looks up `type(a).__lt__` at runtime, possibly calls
`type(b).__gt__`, and possibly raises. Three consequences you can rely on:

- **A type annotation does not make a comparison valid.** `x: int` compared with a
  runtime `str` still raises `TypeError`; the annotation was never checked.
- **Monkey-patching works.** The sorting HOWTO does exactly this:
  `Student.__lt__ = lambda self, other: self.age < other.age`.
- **Comparison can have side effects, raise, log, hit the network** — it is a method
  call. That matters for chaining, where an operand may or may not be evaluated
  ([03](03-chaining.md)).

## The `operator` module: the same six as functions

`operator.lt`, `le`, `eq`, `ne`, `gt`, `ge` are plain functions performing exactly
the operator's dispatch, which is what you need when the operator has to be a value:

```python
import operator

OPS = {"<": operator.lt, "<=": operator.le, "==": operator.eq,
       "!=": operator.ne, ">": operator.gt, ">=": operator.ge}

def matches(row, field, op, value):
    return OPS[op](row[field], value)
```

`operator.is_` and `operator.is_not` exist too, and `operator.contains(a, b)` is
`b in a` — note the reversed argument order, which is a genuine trap.

## Gotchas

**★ An `__eq__` that is not symmetric, discovered only when the operands swap.**
`Money.__eq__` accepts a plain `int` and compares the amount, but `int.__eq__` does
not know about `Money` — so `Money(5) == 5` is `True` and `5 == Money(5)` may be
`False` or may be `True` depending on whether `Money` returned `NotImplemented`.
Fix: return `NotImplemented` for types you do not handle so the reflected method is
tried (see [02](02-notimplemented-and-reflection.md)), and never define equality
against a type that cannot reciprocate.

**★ A comparison that is transitive pairwise but produces a nonsensical sort.**
"Case-insensitive equality" plus "case-sensitive ordering" is the classic: `"a" ==
"A"` under the equality rule while `"A" < "a"` under the ordering rule violates rule
4 (inverse comparison should negate). Timsort will not raise; it will just produce
an order that depends on the input permutation. Fix: derive *all six* from one key
function — `key = (s.casefold(),)` — so equality and ordering cannot disagree.

**★ `operator.contains(needle, haystack)` always returning `False`.** The signature
is `contains(a, b)` meaning `b in a`, i.e. haystack first. Fix: read it as
"a contains b", or use a lambda so the order is visible at the call site.

**★ A type annotation making an impossible comparison look safe.** `def f(a: int, b:
int) -> bool: return a < b` raises at runtime when a JSON parser handed you a `str`.
Fix: annotations are not runtime checks; validate at the boundary (Pydantic, an
explicit `int()`), do not rely on the hint.

**★ A comparison that hits the network or mutates state.** `__eq__` is an ordinary
method, so a lazily-loading ORM object can issue a query from inside `==`, and a
`sorted()` over such objects can issue O(n log n) of them. Fix: make comparison pure
and cheap; if the comparison key is expensive, precompute it with `key=` so it is
evaluated once per element rather than once per comparison.

**★ Monkey-patching `__lt__` on an *instance* silently doing nothing.** Special
methods are looked up on the type, not the instance, so `obj.__lt__ = f` is ignored
by the `<` operator. Fix: set it on the class — `Student.__lt__ = lambda self,
other: self.age < other.age`, which is exactly what the Sorting HOWTO does.

## Interview questions

**★ Q: Name the consistency rules the reference asks user-defined comparisons to
follow.**
Reflexive equality (`x is y` implies `x == y`), symmetry (`x == y` and `y == x`
agree; `x < y` and `y > x` agree), transitivity, inverse comparison producing the
boolean negation (`x == y` and `not x != y` agree), and `hash()` consistent with
equality — equal objects must hash equally or be unhashable. The reference then adds
that Python does not enforce any of them, and that NaN is a built-in counterexample.

**Q: Which built-in types deliberately break those rules, and how?**
`float('nan')` breaks reflexivity (`x is x` but `x != x`) and the negation rule
(`x < y` and `x >= y` are both false). Sets break the negation rule too, because
`<=` means subset, a *partial* order — `{1,2} <= {2,3}` and `{1,2} > {2,3}` are both
false. Both are documented and intentional.

**Q: Are special methods looked up on the instance or the type?**
On the type. Implicit invocations of special methods bypass the instance
dictionary, so assigning `obj.__lt__` has no effect on `obj < other`; you must set
the attribute on the class. This is why the Sorting HOWTO patches
`Student.__lt__`, not a particular student.

**Q: Does a type annotation prevent a `TypeError` from a comparison?**
No. Annotations are not checked at runtime by the interpreter. `a < b` compiles to
a `COMPARE_OP` that looks up `type(a).__lt__` and, failing that, `type(b).__gt__`,
and raises if neither produces a result. A static checker may catch it earlier; the
interpreter will not.

**Q: When would you use `operator.lt` instead of `<`?**
When the operator itself has to be data: a rule engine, a filter DSL, a `key=` or
`reduce` argument. `operator.eq` and friends perform the identical dispatch, so
behaviour is unchanged — you just gain a first-class value you can put in a dict.

**Q: Why is it a problem for `__eq__` to be expensive?**
Because comparison is called far more often than it looks. A `sorted()` of n items
performs O(n log n) comparisons, `x in big_list` performs up to n, and a dict lookup
performs one per hash collision. An `__eq__` that lazy-loads from a database turns a
sort into a query storm. Precompute with `key=` instead.

---

← Prev: [The six operators](01-the-six-operators.md) · Index: [Comparisons](README.md) · Next → [NotImplemented and reflection](02-notimplemented-and-reflection.md)
