---
title: "Chaining makes 0 <= x < 10 mean what mathematics means, and the same rule makes a != b != c not mean what anyone expects"
sidebar_label: "3 · Chaining"
sidebar_position: 65
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 language reference
> [Comparisons](https://docs.python.org/3.14/reference/expressions.html#comparisons)
> and [Membership test operations](https://docs.python.org/3.14/reference/expressions.html#membership-test-operations),
> and [Built-in Constants](https://docs.python.org/3.14/library/constants.html#NotImplemented).
> Version spine: **CPython 3.14**.

**`a < b < c` is not `(a < b) < c` and it is not a special-cased range check — it is
a general rewrite that inserts `and` between every adjacent pair while evaluating each
operand at most once. That single rule gives you the readable `0 <= x < 10`, and it
also gives you `a != b != c` (which does not mean "all three differ"),
`1 in [1] == True` (which is `False`), and a `SyntaxWarning`-free way to write a
comparison whose middle term is a function call you did not expect to be called once
rather than twice. Every operator in the `comp_operator` production chains, including
`is` and `in`.**

## The rule, formally

> *"Comparisons can be chained arbitrarily, e.g., `x < y <= z` is equivalent to
> `x < y and y <= z`, except that `y` is evaluated only once (but in both cases `z` is
> not evaluated at all when `x < y` is found to be false)."*
>
> *"Formally, if a, b, c, …, y, z are expressions and op1, op2, …, opN are comparison
> operators, then `a op1 b op2 c ... y opN z` is equivalent to
> `a op1 b and b op2 c and ... y opN z`, except that each expression is evaluated at
> most once."*
>
> *"Note that `a op1 b op2 c` doesn't imply any kind of comparison between a and c, so
> that, e.g., `x < y > z` is perfectly legal (though perhaps not pretty)."*
> — [Comparisons](https://docs.python.org/3.14/reference/expressions.html#comparisons)

Three separate guarantees are packed in there, and each has a consequence:

1. **The rewrite is pairwise `and`.** No relation between non-adjacent operands is
   implied or checked.
2. **Each expression is evaluated at most once.** `a < f() < b` calls `f()` once, not
   twice, even though `f()` appears in two of the pairwise comparisons.
3. **`and` short-circuits, so later operands may not be evaluated at all.** If `a < b`
   is false, `c` is never evaluated — not even for its side effects.

## The idiom it exists for

```python
if 0 <= index < len(items):
    ...
if 400 <= response.status_code < 500:
    ...
if start <= timestamp <= end:
    ...
if 'a' <= ch <= 'z':
    ...
```

In C, Java, JavaScript and Go, `0 <= x < 10` either fails to compile or compiles to
`(0 <= x) < 10` — a boolean compared against an integer, which in C and JS is `0 < 10`
or `1 < 10`, i.e. always true. Python's version is the mathematical one. This is a
genuine readability win and the reason the syntax exists.

## Single evaluation is a guarantee, not an optimisation

```python
if 0 <= expensive_lookup(key) < LIMIT:     # expensive_lookup called once
    ...
if 0 <= next(counter) < LIMIT:             # counter advanced once
    ...
```

The naive expansion — `0 <= next(counter) and next(counter) < LIMIT` — would advance
the iterator twice and compare two *different* values. The reference's "each
expression is evaluated at most once" rules that out. It is not a CPython
implementation detail; it is in the language reference.

This matters most when the middle operand is impure: a generator's `next`, a
`pop()`, a method that increments a metric, a property that lazy-loads from a
database. Chaining is the only form that gets it right; if you expand the chain by
hand into `and`, you must hoist the value into a local first.

## Short-circuiting cuts off the right-hand side

```python
if 0 < n and 10 < log_and_return(limit):   # log always runs when n > 0
if 0 < n < log_and_return(limit):          # log runs only when 0 < n
```

Both forms skip the right-hand operand when the first comparison is false. That is
usually what you want and occasionally hides a side effect you were relying on. The
reference states it explicitly: *"`z` is not evaluated at all when `x < y` is found to
be false."*

## Precedence: what can and cannot appear in a chain

Comparison binds tighter than `not`, `and`, `or`, and looser than every arithmetic
and bitwise operator. So:

```python
a + 1 < b * 2 < c - 3       # (a+1) < (b*2) and (b*2) < (c-3)
not a < b                   # not (a < b)
a < b and b < c             # two separate comparisons — NOT a chain
```

Parentheses **break** a chain, and that is the whole difference:

```python
0 <= x < 10                 # chain:      (0 <= x) and (x < 10)
(0 <= x) < 10               # not a chain: bool compared to int -> True < 10 -> True
```

`(0 <= x) < 10` is always `True` because `True` is `1` and `False` is `0`, both less
than 10. If you see parentheses around one comparison inside another, it is almost
certainly a bug or a translation from C.

A conditional expression also breaks the chain, because it is a different production:

```python
a < (b if cond else c) < d   # still a chain of two comparisons; the middle
                             # operand is the whole conditional, evaluated once
```

That one is fine — the parentheses are around an *operand*, not around a comparison.

## Chaining and the walrus

`:=` has lower precedence than comparison, so it must be parenthesised, and once it
is, it works inside a chain and the assignment happens exactly once:

```python
if 0 <= (n := compute()) < LIMIT:
    use(n)
```

`compute()` runs once, `n` is bound once, and the chain reads as a range check. This
is one of the cleaner uses of the walrus.

## Gotchas

**★ `(0 <= x) < 10` written by someone translating C.** The parentheses break the
chain; the result is `bool < int`, which is `True < 10`, always `True` regardless of
`x`. Fix: remove the parentheses so it chains.

**★ An iterator advancing twice because you expanded a chain into `and` by hand.**
`0 <= next(it) < 10` evaluates `next(it)` once; `0 <= next(it) and next(it) < 10`
evaluates it twice on different values, so the two comparisons are about two
different numbers. Fix: hoist to a local — or use the walrus,
`0 <= (v := next(it)) < 10`.

**★ A side effect on the right-hand operand that sometimes does not happen.** `a < b <
log_it(c)` skips `log_it` whenever `a < b` is false, because `and` short-circuits.
Fix: do not put side effects in comparison operands; call the function on its own
line.

**★ A range check that reads correctly but excludes the endpoint you needed.**
`0 <= i < len(items)` is the correct bounds check; `0 <= i <= len(items)` is an
off-by-one that indexes past the end. Chaining makes the boundary operators sit right
next to each other, which helps — read both of them, every time.

**★ `if 400 <= status < 500 or status == 429:` grouping wrongly.** `or` binds looser
than the whole chain, so this is `(400 <= status < 500) or (status == 429)` — usually
what was meant, but `and`/`or` mixed into a chain of three or more operands gets hard
to read fast. Fix: parenthesise the clauses of a boolean expression once it contains
a chain plus an `and`/`or`.

## Interview questions

**★ Q: What does `a < b < c` actually do?**
It is rewritten as `a < b and b < c`, with `b` evaluated exactly once and `c` not
evaluated at all if `a < b` is false. It is not `(a < b) < c`, and it is not a special
range-check syntax — the same rewrite applies to any chain of any comparison
operators.

**Q: How many times is `f()` evaluated in `0 <= f() < 10`?**
Once. The reference guarantees that each expression in a chain is evaluated at most
once — which is exactly why the chain is not equivalent to the hand-expanded `and`
form when the middle operand has side effects.

**★ Q: What is wrong with `(0 <= x) < 10`?**
The parentheses break the chain, so it compares a `bool` against an `int`. `True` is
`1` and `False` is `0`, both less than `10`, so the expression is always `True`
regardless of `x`. It is the C translation of a Python idiom and it is a silent bug.

**Q: Can you use the walrus operator inside a chain?**
Yes, parenthesised: `if 0 <= (n := compute()) < LIMIT:`. `:=` binds looser than
comparison so the parentheses are required, and single-evaluation means `compute()`
runs once and `n` is bound once.

**Q: Where do comparisons sit relative to `not`, `and`, `or` and arithmetic?**
Tighter than `not`/`and`/`or`, looser than every arithmetic, shifting and bitwise
operator. So `a + 1 < b * 2 < c - 3` chains the two arithmetic results, and
`not a < b` is `not (a < b)` rather than `(not a) < b`.

**Q: Why is chaining better than `a < b and b < c` even when `b` is a simple name?**
Because it removes the possibility of typing the wrong name in the repeated position
— `a < b and c < c` is a real bug that chaining cannot express — and because it keeps
the single-evaluation guarantee if `b` later becomes an expression.

---

← Prev: [`__ne__`, `__hash__` and the equality contract](02c-ne-hash-and-the-contract.md) · Index: [Comparisons](README.md) · Next → [What else chains](03b-what-else-chains.md)
