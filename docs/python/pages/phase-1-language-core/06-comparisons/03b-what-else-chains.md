---
title: "is and in chain too, which is how False == False in [False] becomes True and how a chained comparison detonates a NumPy array"
sidebar_label: "3b · What else chains"
sidebar_position: 66
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 language reference
> [Comparisons](https://docs.python.org/3.14/reference/expressions.html#comparisons)
> and [Membership test operations](https://docs.python.org/3.14/reference/expressions.html#membership-test-operations),
> [Built-in Constants](https://docs.python.org/3.14/library/constants.html#NotImplemented),
> and NumPy's
> [`numpy/_core/src/multiarray/number.c`](https://github.com/numpy/numpy/blob/main/numpy/_core/src/multiarray/number.c)
> for the exact `ValueError` text.
> Version spine: **CPython 3.14**.

**Chaining is defined over the whole `comp_operator` production, not over the six
arithmetic-looking operators — so `is`, `is not`, `in` and `not in` chain exactly the
same way. That is where every chaining puzzle comes from, and where the real bugs
live: a mixed-direction range check that silently loses its upper bound, an `a != b
!= c` that does not mean "all distinct", an `x in items == True` that is always
`False`, and a chained comparison over a NumPy array that raises because the implicit
`and` demands a single truth value.**

## Every comparison operator chains — including `is` and `in`

The `comp_operator` production covers `<`, `>`, `==`, `>=`, `<=`, `!=`, `is`,
`is not`, `in`, `not in`. All of them participate in the same rewrite. This is where
chaining stops being a convenience and starts being a trap.

**`x is y is z`** means `x is y and y is z`. Fine, and occasionally useful:

```python
if a is b is None:        # both a and b are None
```

**`a in b in c`** means `a in b and b in c` — almost never what a reader expects.

**The famous one:**

```python
False == False in [False]
```

This chains to `(False == False) and (False in [False])` — `True and True` — so it is
`True`. Read as `(False == False) in [False]` it would be `True in [False]`, i.e.
`False`. Read as `False == (False in [False])` it would be `False == True`, i.e.
`False`. The chaining reading is the only one that gives `True`, and it is the one
Python uses.

**The one that bites in real code:**

```python
if 1 in [1] == True:       # chains to: (1 in [1]) and ([1] == True)
    ...                    # -> True and False -> False
```

Someone wrote `x in coll == True` meaning "assert this is true", and got the opposite.
The `== True` was already pointless (see [04](04-is-versus-equals.md)); chaining made
it actively wrong.

## `!=` chains, and the result is not "all distinct"

```python
a, b, c = 1, 2, 1
a != b != c        # (a != b) and (b != c) -> True and True -> True
```

`a` and `c` are equal, and the chain says nothing about them, because — in the
reference's words — *"`a op1 b op2 c` doesn't imply any kind of comparison between a
and c."* The correct "all three distinct" test is:

```python
len({a, b, c}) == 3
```

The same trap applies to `a is not b is not c` and to any chain of a non-transitive
relation. `==` chains *are* safe for transitive types (`a == b == c` really does imply
`a == c` for `int`, `str`, `tuple`), but that is a property of those types, not of
chaining.

## `a < b > c` is legal and is a smell

The reference says so directly: *"`x < y > z` is perfectly legal (though perhaps not
pretty)."* It means "`y` is greater than both", which is a real thing to want, but a
reader scanning the line sees a range check and mis-parses it. Write
`y > x and y > z`, or `y > max(x, z)`.

The mixed-direction chain that actually causes bugs is the accidental one:

```python
if lo <= x >= hi:      # typo for lo <= x <= hi; means x >= lo and x >= hi
```

Both comparisons succeed for any `x` above `hi`, so the range check has no upper
bound and the bug is invisible until data goes out of range. No warning is emitted;
the expression is valid.

## Chaining forces `bool()` — which is where array types explode

The rewrite inserts `and`, and `and` evaluates its left operand in a boolean context.
For any type whose `__lt__` returns a non-boolean, the chain therefore calls `bool()`
on that non-boolean:

```python
import numpy as np
arr = np.array([1, 2, 3])

0 <= arr           # fine: array([True, True, True])
0 <= arr < 10      # ValueError: The truth value of an array with more than one
                   # element is ambiguous. Use a.any() or a.all()
```

The first comparison succeeds and returns an array; the implicit `and` then tries to
take its truth value and NumPy refuses. The fix is element-wise logic with explicit
parentheses — `(0 <= arr) & (arr < 10)` — because `&` binds tighter than comparison
and does *not* call `bool()`. See [10](10-when-equality-is-not-a-boolean.md).

Since 3.14, the same mechanism can raise on a chain whose first comparison returned
`NotImplemented` to Python code, because `bool(NotImplemented)` is now a `TypeError`.

## Gotchas

**★ `lo <= x >= hi` accepted as a range check.** A one-character typo for `<=` turns
the chain into "x is at least `lo` and at least `hi`" — no upper bound at all. The
expression is legal, so nothing warns. Fix: read chains left to right checking that
every operator points the same way, and treat any mixed-direction chain in review as
a defect until proven deliberate.

**★ `a != b != c` used as "all three are different".** The chain is only pairwise, and
the reference says non-adjacent operands are never compared: `1 != 2 != 1` is `True`.
Fix: `len({a, b, c}) == 3`.

**★ `if x in items == True:` always `False`.** It chains to `(x in items) and (items ==
True)`, and a list is never equal to `True`. Fix: drop the `== True` entirely —
`if x in items:`.

**★ `0 <= arr < 10` raising `ValueError: The truth value of an array with more than
one element is ambiguous. Use a.any() or a.all()`.** Chaining inserts `and`, `and`
calls `bool()`, and NumPy refuses to reduce an array to one boolean. Fix:
`(0 <= arr) & (arr < 10)`, with the parentheses, because `&` binds tighter than `<`.

**★ The same expression on an *empty* array raising a different message.** NumPy
raises `ValueError` with the text "The truth value of an empty array is ambiguous.
Use `array.size > 0` to check that an array is not empty." Fix: same — element-wise
`&`, and check emptiness with `.size`.

**★ `False == False in [False]` in a quiz and nobody agreeing on the answer.** It is
`True`, by the chaining rewrite `(False == False) and (False in [False])`. Fix:
recognise that `in` is a comparison operator that chains, and parenthesise anything
mixing `in` with `==`.

**★ A chain over a custom class with a non-transitive `__eq__` giving a different
answer from `a == b and a == c`.** `a == b == c` checks `a == b` and `b == c`, never
`a == c`. For a well-behaved transitive type they agree; for a case-folding,
tolerance-based or unit-aware equality they may not. Fix: if your `==` is not
transitive, do not chain it — spell out the comparisons you actually want.

**★ `x is y is z` reviewed as a typo.** It is a legal chain meaning "all three are the
same object", most commonly seen as `a is b is None`. Fix: nothing is broken, but
write `a is None and b is None` if the reviewer count is higher than the cleverness
budget.

**★ `a in b in c` written by accident when `a in b and a in c` was meant.** The chain
tests `b in c`, not `a in c` — usually a `TypeError` if `c` is a list of scalars, and
silently wrong if `c` is a list of lists. Fix: spell out the `and`.

**★ A chain raising `TypeError: NotImplemented should not be used in a boolean
context` on 3.14.** A comparison in the chain returned `NotImplemented` to Python
code (typically because a dunder was called directly somewhere in the stack), and the
implicit `and` then tried to take its truth value. Before 3.14 this quietly evaluated
`True`. Fix: never call comparison dunders directly; see
[02b](02b-writing-eq-correctly.md).

## Interview questions

**★ Q: Is `a != b != c` a valid test that all three values differ?**
No. It expands to `(a != b) and (b != c)`, which says nothing about `a` versus `c`;
`1 != 2 != 1` is `True`. The reference states that a chain implies no comparison
between non-adjacent operands. Use `len({a, b, c}) == 3`.

**★ Q: What is `False == False in [False]`, and why?**
`True`. `in` is a comparison operator and chains like the others, so the expression is
`(False == False) and (False in [False])`, i.e. `True and True`. Neither of the two
"obvious" non-chaining readings gives `True`, which is why it is a popular puzzle.

**★ Q: Why does `0 <= arr < 10` raise on a NumPy array when `0 <= arr` does not?**
The chain inserts an `and`, and `and` needs the truth value of the left operand.
`0 <= arr` produced a boolean array, and NumPy raises `ValueError: The truth value of
an array with more than one element is ambiguous. Use a.any() or a.all()`. Write
`(0 <= arr) & (arr < 10)` — element-wise `&` never calls `bool()`.

**Q: Do `is` and `in` chain?**
Yes — both are in the `comp_operator` production, so `a is b is c` and `a in b in c`
are chains, and so is any mixture like `x == y in z`. This is the source of most
chaining puzzles and of the `x in items == True` bug.

**Q: What does `x < y > z` mean and should you write it?**
`x < y and y > z` — "y is greater than both". It is legal and the reference calls it
"perhaps not pretty". Prefer `y > max(x, z)`, because a reader scanning for a range
check will misread it. The dangerous version is the accidental `lo <= x >= hi`, which
looks like a bounded range and has no upper bound.

**Q: Does `a == b == c` guarantee `a == c`?**
Only if the type's equality is transitive. The chain itself checks `a == b` and
`b == c` and nothing else. For `int`, `str` and `tuple` transitivity holds, so the
implication is safe; for a custom `__eq__` with tolerance or case folding it is not,
and the reference explicitly says Python does not enforce the transitivity rule.

**Q: How would you write a bounded range check over a pandas Series?**
`(s >= lo) & (s <= hi)` — or `s.between(lo, hi)`. The chained form fails for the same
reason as NumPy: pandas overloads the comparison operators to return a Series and
raises on `bool()` of a multi-element one.

---

← Prev: [Chaining](03-chaining.md) · Index: [Comparisons](README.md) · Next → [`is` versus `==`](04-is-versus-equals.md)
