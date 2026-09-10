---
title: "Set comparison is containment, and containment is only a partial order — `not (a < b)` is not `a >= b`, two sets can fail every comparison at once, and `sorted`, `min` and `max` of sets are undefined"
sidebar_label: "3c · Set comparison is a partial order"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset) (the
> comparison paragraphs) — and the language reference —
> [value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons).
> Split out of [3 · Set algebra instead of nested loops](03-set-algebra-instead-of-nested-loops.md)
> on a concept boundary. Documentation-verified — **no sandbox run, no timings**.

**`<`, `<=`, `>` and `>=` on two sets test containment, not size — and containment is only a
partial order: two sets can be neither equal, nor a subset, nor a superset of each other. Every
bug on this page comes from treating the negation of one comparison as another comparison.**

## Comparisons are a partial order

> *"Both `set` and `frozenset` support set to set comparisons. Two sets are equal if and only if
> every element of each set is contained in the other (each is a subset of the other). A set is less
> than another set if and only if the first set is a proper subset of the second set (is a subset,
> but is not equal). A set is greater than another set if and only if the first set is a proper
> superset of the second set (is a superset, but is not equal)."*

> *"The subset and equality comparisons do not generalize to a total ordering function. For example,
> any two nonempty disjoint sets are not equal and are not subsets of each other, so all of the
> following return `False`: `a<b`, `a==b`, or `a>b`."* —
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset)

The consequence for code: `not (a < b)` does **not** mean `a >= b`. Two sets can fail every
comparison at once. Write the predicate you mean — `a >= b`, `a.issuperset(b)`, `a.isdisjoint(b)`,
`a == b` — and never derive one from the negation of another. The same partial order is why
`sorted()`, `min()` and `max()` of a list of sets produce *"undefined results"*; the full
treatment, including the `key=` that restores a total order, is
[comparisons · 7b](../../phase-1-language-core/06-comparisons/07b-mappings-and-sets.md).

## Gotchas

**★ Symptom: an access check written as `if not (granted < required):` lets through users who hold
none of the required roles.** Cause: subset is a partial order; for disjoint sets every comparison
is `False`, so `not (granted < required)` is `True`. Fix: state the relation you need.

```python
def allowed(granted: frozenset, required: frozenset) -> bool:
    return required <= granted           # every required role is granted
```

**Symptom: `max(candidate_sets)` returns a set that is not the largest.** Cause: `max` uses `<`,
which for sets means proper subset; the docs say such functions *"produce undefined results"* given
sets. Fix: give an explicit key.

```python
largest = max(candidate_sets, key=len)
```

## Interview questions

**Is `a <= b` the same as `not a > b` for sets?**
No. `not a > b` is `True` whenever `a` is not a proper superset of `b`, which includes the case
where the sets are unrelated. `a <= b` is `True` only when every element of `a` is in `b`. For
disjoint non-empty sets `a <= b` and `a > b` are both `False`. The documentation states it directly:
the subset comparisons *"do not generalize to a total ordering function"*.

---

← Prev: [Set algebra instead of nested loops](03-set-algebra-instead-of-nested-loops.md) · [Topic index](README.md) · Next → **Operators versus methods** *(not written yet)*
