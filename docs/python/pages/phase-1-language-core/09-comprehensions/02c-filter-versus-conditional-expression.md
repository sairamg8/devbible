---
title: "The if at the end filters, the if in front branches: two different constructs that look like the same word"
sidebar_label: "2c · Filter vs conditional"
sidebar_position: 93
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [Displays for lists, sets and dictionaries](https://docs.python.org/3.14/reference/expressions.html#displays-for-lists-sets-and-dictionaries),
> [Conditional expressions](https://docs.python.org/3.14/reference/expressions.html#conditional-expressions),
> the Library Reference
> [`filter`](https://docs.python.org/3.14/library/functions.html#filter),
> and [PEP 308](https://peps.python.org/pep-0308/).
> Target: **CPython 3.14**.

**`[f(x) for x in xs if p(x)]` produces fewer elements than `xs`.
`[f(x) if p(x) else g(x) for x in xs]` produces exactly as many. They share a
keyword and nothing else: the first is the comprehension's own filter clause,
the second is an ordinary conditional expression that happens to be sitting in
the element position. Position tells you which one you are looking at, and the
giveaway is `else` — the filter form cannot have one and the branching form
cannot omit one.**

## The two positions

```python
xs = [1, 2, 3, 4]

[x * 10 for x in xs if x % 2]            # filter  → [10, 30]      (2 elements)
[x * 10 if x % 2 else x for x in xs]     # branch  → [10, 2, 30, 4] (4 elements)
```

| | Filter | Conditional expression |
|---|---|---|
| Written | after the `for` clause | before the first `for` |
| Grammar production | `comp_if` in the comprehension | `conditional_expression` in the element |
| `else` | not allowed | **required** |
| Output length | `<= len(xs)` | `== len(xs)` |
| Decides | whether an element exists | what the element is |

The `else` requirement is the fastest way to tell them apart while reading, and
it is not a style rule — it is the grammar. The reference defines a conditional
expression as:

```text
conditional_expression : or_test ["if" or_test "else" expression]
```

The `else` branch is part of the optional group; you cannot have the `if`
without it. And `comp_if` is `"if" or_test [comp_iter]` — there is nowhere for
an `else` to attach.

## Both at once, and the order that surprises people

You can use both in one comprehension, and then the reading order is: filter
first (it is a clause), branch second (it is the element). But they are *written*
in the opposite order:

```python
[label(x) if x.urgent else x.name        # 2. what each survivor becomes
 for x in tickets                        # 1. iterate
 if x.status == "open"]                  # 1b. which ones survive
```

That is the whole difficulty. The construct that runs last is written first.
Splitting the comprehension across lines with the head on its own line, as
above, restores the reading order enough to be worth doing whenever both forms
appear together.

## `SyntaxError`s that come from mixing them up

```python
[x for x in xs if x > 0 else 0]      # SyntaxError — no else on a filter
[x if x > 0 for x in xs]             # SyntaxError — conditional needs an else
[x if x > 0 else 0 for x in xs]      # correct branch form
[x for x in xs if x > 0]             # correct filter form
```

The second one is the interesting failure. People write `[x if x > 0 for x in
xs]` intending a filter and having put it in the wrong place; Python sees an
incomplete conditional expression and complains about the missing `else`, which
sends them off to add `else None` — and now they have a list full of `None`
where they wanted a shorter list. **`else None` is the tell that a filter was
meant.**

```python
# what people write after fighting the SyntaxError
[x if x > 0 else None for x in xs]        # same length, padded with None
# what they wanted
[x for x in xs if x > 0]                  # shorter list, no None
```

That `None` padding is not a hypothetical: it survives into a database write, a
JSON payload or a `sum()` that then raises `TypeError: unsupported operand
type(s) for +: 'int' and 'NoneType'` several frames away from the comprehension.

## `if not` versus an `else` branch

A filter can be inverted; it still cannot branch.

```python
[x for x in xs if not x.deleted]                     # fine
[x for x in xs if x.deleted is False]                # avoid — see the `is` rules
```

For the identity-comparison point, see
[`is` versus `==`](../06-comparisons/04-is-versus-equals.md). For why
`if not x.deleted` and `if x.deleted is False` are genuinely different tests,
see [What falsy means](../05-truthiness/01-what-falsy-means.md).

## The filter is not `filter()`, but it is equivalent

The `filter` builtin's documentation gives the exact translation:

> *"Note that `filter(function, iterable)` is equivalent to the generator
> expression `(item for item in iterable if function(item))` if function is not
> `None` and `(item for item in iterable if item)` if function is `None`."*

That second half is worth keeping: `filter(None, xs)` drops falsy items, and it
is the one case where `filter` is meaningfully shorter than the comprehension —
`[x for x in xs if x]` versus `filter(None, xs)`. Everywhere else the
comprehension reads better because the predicate is inline rather than a
separately named function.

## A branch in the value is often a function

Once the conditional expression in the head grows past a short line, the
comprehension stops being readable and the branch wants a name:

```python
# hard to scan
[fmt_money(x.total) if x.currency == "USD" else fmt_eur(x.total) for x in rows]

# better
def display_total(row):
    return fmt_money(row.total) if row.currency == "USD" else fmt_eur(row.total)

[display_total(x) for x in rows]
```

Nested conditional expressions in a comprehension head — `a if p else b if q
else c` — are legal (they associate to the right) and are the point at which
almost every reader loses the thread. If you find yourself writing one, the
answer is a function or a `dict` lookup, not more parentheses.

## Gotchas

**★ Symptom — a list has the same length as its input when you expected it to be
shorter, and it is full of `None`.** Cause: a filter was written as a conditional
expression with `else None` after Python rejected the version without an `else`.
Fix: move the condition after the `for` clause and drop the `else` —
`[x for x in xs if p(x)]`.

**★ Symptom — `SyntaxError: expected 'else' after 'if' expression`.** Cause: a
conditional expression in the element position is missing its mandatory `else`;
the grammar's optional group is `["if" or_test "else" expression]`, all or
nothing. Fix: if you meant to filter, move the `if` after the `for` clause. If
you meant to branch, supply the `else`.

**★ Symptom — `SyntaxError` on `[x for x in xs if p(x) else q]`.** Cause: there
is no `else` on `comp_if`; a filter keeps or skips and nothing else. Fix: decide
which construct you want — a shorter list (filter) or a same-length list with
two possible values (conditional expression in the head).

**Symptom — `TypeError` involving `NoneType` in code far from the
comprehension.** Cause: `else None` padding from the previous gotcha, flowing
into a `sum`, a `join`, a `max` or a serialiser. Fix: filter at the source. If
`None` really is a valid element, the downstream code must handle it explicitly
rather than by accident.

**Symptom — the filter appears to run before the map and someone "optimises" by
swapping them.** Cause: it *does* run first — the filter is a clause and the head
expression is only evaluated for survivors. Fix: nothing to change; and note the
consequence, which is that an expensive or exception-prone head expression is
correctly protected by a filter, unlike a `map` over an unfiltered sequence.

**Symptom — a comprehension calls an expensive function twice, once in the
filter and once in the head.** Cause: `[f(x) for x in xs if f(x)]` evaluates `f`
for every element and again for every survivor. Fix: a walrus in the filter —
`[y for x in xs if (y := f(x))]` — which is exactly the case PEP 572 was
designed for; see
[the walrus rules](../05-truthiness/05b-walrus-rules-and-scope.md).

**Symptom — nested conditional expressions in a comprehension head produce the
wrong branch.** Cause: `a if p else b if q else c` associates to the right, so
the second conditional is the `else` of the first, not a sibling. Fix:
parenthesise to make the intent explicit, or move the decision into a function
or a mapping.

## Interview questions

**★ Q: What is the difference between `[f(x) for x in xs if p(x)]` and
`[f(x) if p(x) else g(x) for x in xs]`?**
The first is a filter: it is the comprehension's own `comp_if` clause, it sits
after the `for`, it has no `else`, and the result can be shorter than `xs`. The
second is an ordinary conditional expression in the element position: it runs
for every element, it must have an `else`, and the result is always exactly as
long as `xs`. One decides whether an element exists; the other decides what it
is.

**★ Q: Why can't you write `[x for x in xs if p(x) else default]`?**
Because the comprehension's `if` is a filter clause defined as `"if" or_test`
with no alternative branch. Keeping or skipping is a binary decision with no
third thing for `else` to name. If you want a default for the failing case you
are not filtering — you are mapping with a branch, and that belongs in the
element expression.

**★ Q: You need both a filter and a per-element branch. How do they combine and
in what order do they run?**
Both are allowed in one comprehension. The filter runs first because it is a
clause and the element expression is only evaluated when every clause has
passed; the branch then applies to the survivors. They are written in the
opposite order to their execution, which is the strongest argument for splitting
such a comprehension across lines.

**Q: When is `filter()` better than a comprehension filter?**
Almost only for `filter(None, xs)`, which drops falsy items and is documented as
equivalent to `(item for item in iterable if item)`. When the predicate is
already a named function `filter(is_valid, xs)` is also defensible. When the
predicate is an expression, the comprehension keeps it visible and wins.

**Q: How do you avoid calling an expensive function twice when you need to both
filter on its result and use it?**
An assignment expression in the filter clause: `[y for x in xs if (y := f(x))]`.
PEP 572 binds `y` in the containing scope, but inside the comprehension it is
just a local you can use in the head. Without it the only alternatives are a
generator expression feeding a second comprehension, or a plain loop.

**Q: Is `[x if p(x) else None for x in xs]` ever right?**
Only when the caller genuinely needs a same-length sequence with holes — for
example, when the result is zipped back against the input, or written to a
fixed-width record. If nothing downstream depends on the positions, it is a
filter written wrong and the `None`s will eventually reach code that does not
expect them.

---

← Prev: [Multiple clauses](02b-multiple-clauses.md) · Index: [Comprehensions](README.md) · Next → [Scope and the target that does not leak](03-scope-and-the-target.md)
