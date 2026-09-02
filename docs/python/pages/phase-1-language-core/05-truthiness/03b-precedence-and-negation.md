---
title: "Precedence and negation: `and` before `or`, `not` after everything, and the three traps that follow"
sidebar_label: "3b · Precedence and negation"
sidebar_position: 57
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [Operator precedence](https://docs.python.org/3.14/reference/expressions.html#operator-precedence)
> and [Comparisons](https://docs.python.org/3.14/reference/expressions.html#comparisons),
> the Library Reference
> [Boolean Operations](https://docs.python.org/3.14/library/stdtypes.html#boolean-operations-and-or-not),
> [PEP 8](https://peps.python.org/pep-0008/#programming-recommendations),
> and the [ruff](https://docs.astral.sh/ruff/rules/) `E712`/`E713`/`E714` rules.
> Target: **CPython 3.14**.

**Three operators, three precedence surprises, and all three produce code that
runs without complaint and means something other than what it says. `and` binds
tighter than `or`, so an authorisation check can let the wrong person through.
`not` binds looser than every comparison, so `a == not b` is a syntax error and
`not a == b` is not the negation you thought. And `x == 1 or 2` — the most
written Python bug there is — is always true. None of these raise.**

## The order, from the reference

Ascending priority, lowest binding first:

| Priority | Operators |
|---|---|
| lowest | `or` |
| | `and` |
| | `not x` |
| | comparisons: `in`, `not in`, `is`, `is not`, `<`, `<=`, `>`, `>=`, `!=`, `==` |
| | bitwise `\|`, `^`, `&`, shifts |
| highest | arithmetic, unary, `**`, calls, subscripts |

The docs add one note about `not` that is worth memorising verbatim:

> *"`not` has a lower priority than non-Boolean operators, so `not a == b` is
> interpreted as `not (a == b)`, and `a == not b` is a syntax error."*

Note where the **bitwise** operators sit: tighter than the comparisons. That is
the source of the numpy/pandas parenthesisation rule — `df.age > 18 & df.x` parses
as `df.age > (18 & df.x)`, which is why every DataFrame filter you have ever
seen is written `(df.age > 18) & (df.country == "IN")`.

## Trap 1 — `and` binds tighter than `or`

```python
if is_admin or is_owner and is_active:      # means: is_admin or (is_owner and is_active)
if (is_admin or is_owner) and is_active:    # probably what was meant
```

An admin who is **inactive** passes the first version. This is an authorisation
bug that reads correctly in English, where "or" and "and" have no precedence and
the sentence is simply ambiguous.

The rule to adopt: **parenthesise whenever both operators appear in one
expression**, even when the default grouping is the one you want. The
parentheses cost nothing and they tell the next reader that you knew. Without
them, a reviewer cannot distinguish "relied on precedence" from "forgot about
precedence", and neither can you in six months.

The same applies to a mixed expression spread over several lines, where the
visual layout can imply a grouping the parser does not use:

```python
if (is_admin
        or is_owner
        and is_active):        # the indentation suggests three peers. It is not.
```

## Trap 2 — `x == 1 or 2` is always truthy

```python
if status == 1 or 2:        # (status == 1) or 2  →  2 is truthy  →  always true
if status == 1 or status == 2:      # correct
if status in (1, 2):                # better
```

This is probably the single most common Python bug written by beginners, and it
never raises. The `or` sees a possibly-false comparison on the left and the bare
integer `2` on the right; `2` is truthy, so the whole expression is truthy no
matter what `status` is.

It generalises to every shape where the second operand forgot its comparison:

```python
if name == "alice" or "bob":            # always true
if x > 0 and < 10:                      # SyntaxError — at least this one is loud
if role in ("admin") :                  # "admin" is a str, not a tuple:
                                        # this is a substring test!
```

That last one is a close cousin worth its own attention: `("admin")` is not a
tuple, it is a parenthesised string, so `role in ("admin")` asks whether `role`
is a *substring* of `"admin"` — and `"admi"`, `"min"` and `""` all pass. The
trailing comma is what makes a one-element tuple: `("admin",)`. A `set` literal
(`{"admin"}`) avoids the ambiguity entirely and is the better habit for
membership tests.

For a range, use the chained comparison rather than an `and`:

```python
if 0 <= x < 10:            # chained; x evaluated once
if x >= 0 and x < 10:      # equivalent, longer
```

[Comparisons](../06-comparisons/README.md) covers chaining properly, including the fact
that the middle operand is evaluated exactly once.

## Trap 3 — `not` with `in` and `is`

```python
if not x in items:      # parses as: not (x in items) — works, but
if x not in items:      # this is the idiom, and ruff E713 will tell you so
if not x is None:       # parses as: not (x is None) — works, but
if x is not None:       # the idiom; E714
```

Both `not in` and `is not` are **single operators in the grammar**, not a `not`
applied to `in`/`is`. The negated-prefix forms happen to parse to the same
meaning, which is why they survive review, but they read backwards and both
linters flag them.

Where the prefix form genuinely changes meaning is with a comparison chain or a
call:

```python
if not a == b == c:     # not (a == b == c) — negates the whole chain
if not check(a) and check(b):   # (not check(a)) and check(b) — `not` binds tighter than `and`
```

That second one is the subtle one: `not` binds **tighter** than `and`/`or`, so
it negates only its immediate operand, never the rest of the expression.

## `not` versus `!=` versus `is not`

Three different questions that all read as "isn't":

```python
if not flag:            # flag is falsy — covers None, 0, "", [], False
if flag != True:        # flag is not equal to True — 1 == True, so 1 fails this
if flag is not True:    # flag is not the True singleton — 1 passes this
```

For a real `bool`, all three agree. For anything else they diverge, which is why
PEP 8 asks for the first:

> *"Don't compare boolean values to True or False using `==`: `if greeting:` is
> correct; `if greeting == True:` is wrong. Worse: `if greeting is True:`"*

The middle form is the one that surprises: because `bool` is a subclass of
`int`, `1 == True` is `True`, so `if flag != True:` does **not** fire for
`flag = 1`. A function that returns `1` instead of `True` — easy to do, since
`sum()`, `len()` and a bare `re.match` count all produce ints — slips through a
`!= True` guard and is caught by `not flag`. ruff flags the comparison as
`E712`.

The one legitimate use of `is True` / `is False` is excluding truthy non-booleans
on purpose — validating that a JSON field really was a boolean and not the
string `"true"` or the number `1`. That is a parsing concern, and topic 02's
[`is True` and the type system](../02-numbers/04c-is-true-and-the-type-system.md)
covers when it is right.

## Gotchas

**Symptom — an inactive admin passes an authorisation check.** Cause:
`if is_admin or is_owner and is_active:` — `and` binds tighter, so the check
reads "admin (regardless of active), or an active owner". Fix: parenthesise.
Whenever `and` and `or` appear in one expression, add the parentheses even when
the default grouping is what you want.

**Symptom — a multi-line condition behaves differently from how it is laid
out.** Cause: line breaks and indentation inside parentheses carry no precedence
meaning, so three visually-parallel operands can be grouped two-and-one. Fix:
add explicit inner parentheses that match the intended grouping; the layout then
tells the truth.

**Symptom — `if x == 1 or 2:` matches everything.** Cause: it parses as
`(x == 1) or 2`, and `2` is truthy, so the whole condition is always true. Fix:
`if x in (1, 2):`, or spell out both comparisons.

**Symptom — a membership test against a single value matches substrings.**
Cause: `("admin")` is a parenthesised string, not a one-element tuple, so
`role in ("admin")` is a substring test and `"min"` passes. Fix: `("admin",)`
with the trailing comma, or better `{"admin"}` — a set literal cannot be
mistaken for a string and gives O(1) membership.

**Symptom — `not x in items` is flagged by the linter although it works.**
Cause: it parses as `not (x in items)`, which is correct but not idiomatic;
`not in` is a single operator. Fix: `x not in items` (ruff `E713`); likewise
`x is not None` rather than `not x is None` (`E714`).

**Symptom — `not check(a) and check(b)` does not negate what you expected.**
Cause: `not` binds tighter than `and`, so only `check(a)` is negated. Fix:
`not (check(a) and check(b))` if the whole conjunction was meant. This one reads
correctly in English and wrongly in Python.

**Symptom — `if flag != True:` does not fire for `flag = 1`.** Cause: `bool` is
a subclass of `int` and `1 == True`, so the inequality is `False`. Fix:
`if not flag:` — and see PEP 8, which asks you not to compare against `True` at
all. ruff flags it as `E712`.

**Symptom — a DataFrame filter returns nonsense or raises, and adding
parentheses fixes it.** Cause: the bitwise operators bind **tighter** than the
comparisons, so `df.age > 18 & df.active` parses as `df.age > (18 & df.active)`.
Fix: parenthesise every comparison in a bitwise-combined filter. This is not a
pandas quirk; it is Python's precedence table.

**Symptom — `a == not b` raises `SyntaxError` and the fix looks arbitrary.**
Cause: `not` has lower priority than the comparison operators, so there is no
valid parse. Fix: `a == (not b)`. The asymmetry with `not a == b` — which parses
fine as `not (a == b)` — is documented directly in the Boolean Operations
section.

**Symptom — a linter rewrite of `if not len(x):` to `if not x:` changes
behaviour.** Cause: they are not equivalent for objects that define `__bool__`
independently of `__len__` — a `ResultPage` whose `__bool__` returns `True` is
truthy at zero length. Fix: know which question the code is asking; see
[the truthiness protocol](01b-the-truthiness-protocol.md). For plain containers
the rewrite is safe and PEP 8 asks for it.

## Interview questions

**★ Q: `and` or `or` — which binds tighter?**
`and`. So `a or b and c` means `a or (b and c)`. The full ascending order is
`or`, then `and`, then `not`, then the comparisons, then bitwise, then
arithmetic. Parenthesise whenever
both appear; the reader cannot otherwise tell whether you relied on the
precedence or forgot it. The classic failure is
`if is_admin or is_owner and is_active:`, which lets an inactive admin through.

**★ Q: Why does `if x == 1 or 2:` always take the true branch?**
Because it parses as `(x == 1) or 2`. The `or` sees a possibly-false comparison
on the left and the integer `2` on the right; `2` is truthy, so the expression
is truthy regardless of `x`. Write `if x in (1, 2):`.

**Q: Why does `a == not b` raise a `SyntaxError`?**
Because `not` has lower priority than the comparison operators, so there is no
valid parse — the docs state this directly alongside the fact that `not a == b`
means `not (a == b)`. Write `a == (not b)`.

**★ Q: Why must you parenthesise the comparisons in a pandas filter?**
Because `&` and `|` bind more tightly than `>`, `<` and `==`. So
`df.age > 18 & df.active` means `df.age > (18 & df.active)`. The parentheses in
`(df.age > 18) & (df.active)` are Python's precedence rules, not a pandas
convention — and `and`/`or` cannot be used at all, because they truth-test their
operands and a multi-element Series refuses.

**Q: `not x in items` versus `x not in items` — is there a difference?**
Not in meaning; `not in` is a single operator and the prefix form parses to the
same result. The difference is idiom and readability, and ruff flags the prefix
form as `E713` (and `not x is None` as `E714`). Prefer `x not in items` and
`x is not None`.

**Q: When is `if flag is True:` actually correct?**
When you deliberately need to exclude truthy non-booleans — validating that a
JSON field arrived as a real boolean rather than the string `"true"` or the
integer `1`. That is a parsing concern. For ordinary control flow PEP 8 calls it
worse than `== True`, and `if flag:` is the right form.

**Q: Why does `if flag != True:` miss `flag = 1`?**
Because `bool` subclasses `int` and `True == 1`, so the inequality is false for
`1`. Any code path that produces an int where a bool was expected — a `sum()`, a
`len()`, a count — slips through. `if not flag:` catches it, which is one more
reason PEP 8 asks you not to compare against `True`.

**Q: `not` binds tighter or looser than `and`?**
Tighter than `and` and `or`, looser than the comparisons. So
`not a and b` is `(not a) and b`, and `not a == b` is `not (a == b)`. Both read
ambiguously in English, which is why the parentheses are worth writing even
where they change nothing.

---

← Prev: [`and` and `or` return operands](03-and-or-return-operands.md) · Index: [Truthiness](README.md) · Next → [`any` and `all`](04-any-and-all.md)
