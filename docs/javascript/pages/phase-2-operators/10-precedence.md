---
title: "10 · Operator precedence"
sidebar_label: "10 · Precedence"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p2/ex9-precedence.mjs`.

**Do not memorise the twenty-level precedence table. Learn the five cases that
actually cause bugs, and parenthesise everything else.** A reader should never
have to consult a table to review your code.

## Measured

```
--- the ones that bite ---
  2 ** 3 ** 2                  = 512
  (2 ** 3) ** 2                = 64
  1 + 2 + "3"                  = "33"
  "1" + 2 + 3                  = "123"
  true ? 1 : true ? 2 : 3      = 1
  typeof 1 + 1                 = "number1"
  typeof (1 + 1)               = "number"
  !true === false              = true
  1 < 2 < 3                    = true
  3 > 2 > 1                    = false

--- comma operator has the LOWEST precedence ---
  (1, 2, 3)                    = 3
  x = (1,2,3)                  = 3

--- && binds tighter than || ---
  true || false && false       = true
  (true || false) && false     = false
```

## The five that bite

### 1. `**` is right-associative

```
  2 ** 3 ** 2   = 512
  (2 ** 3) ** 2 = 64
```

The only right-associative arithmetic operator ([page 01](./01-arithmetic.md)).
Every other one groups left to right.

### 2. `+` groups left to right, and one string poisons everything after

```
  1 + 2 + "3"   = "33"
  "1" + 2 + 3   = "123"
```

Same three values, different results. `1 + 2` evaluates first to `3`, then
`3 + "3"` concatenates. But `"1" + 2` concatenates immediately, so everything
downstream is string work.

**The position of the string in the expression changes the answer.** This is the
practical form of the coercion rules in
[Phase 1 · 08](../phase-1-values-and-coercion/08-type-coercion.md).

### 3. `&&` binds tighter than `||`

```
  true || false && false     = true
  (true || false) && false   = false
```

`a || b && c` is `a || (b && c)`. It reads like a left-to-right sequence and is
not one. **Always parenthesise a mixed `&&`/`||` expression** — and note that
mixing `??` with either is a `SyntaxError` rather than a silent surprise
([page 03](./03-logical-operators.md)), which is the better design.

### 4. `typeof` binds tighter than `+`

```
  typeof 1 + 1     = "number1"
  typeof (1 + 1)   = "number"
```

`typeof 1 + 1` is `(typeof 1) + 1` → `"number" + 1` → `"number1"`. Unary
operators bind very tightly. The same applies to `!`:

```
  !true === false   = true
```

That is `(!true) === false` → `false === false` → `true`. It looks like it is
asserting something about `true === false`, and it is not.

### 5. Relational operators chain — and produce nonsense

```
  1 < 2 < 3   = true
  3 > 2 > 1   = false
```

**`3 > 2 > 1` is `false`**, which is the clearest possible demonstration that
JavaScript has no chained comparison. It evaluates left to right: `3 > 2` is
`true`, then `true > 1` becomes `1 > 1`, which is `false`.

`1 < 2 < 3` being `true` is a coincidence, not a working range check. Write the
range explicitly:

```js
if (1 < x && x < 3) …
```

## The order you actually need

From tightest to loosest, keeping only what matters day to day:

| | Operators |
|---|---|
| tightest | `()` grouping · member access `.` `[]` · `new` with args · calls · `?.` |
| | postfix `++` `--` |
| | unary `!` `~` `+` `-` `typeof` `void` `delete` · prefix `++` `--` · `await` |
| | `**` *(right-associative)* |
| | `*` `/` `%` |
| | `+` `-` |
| | `<<` `>>` `>>>` |
| | `<` `>` `<=` `>=` `in` `instanceof` |
| | `==` `!=` `===` `!==` |
| | `&` then `^` then `\|` |
| | `&&` |
| | `\|\|` and `??` *(cannot be mixed unparenthesised)* |
| | `? :` *(right-associative)* |
| | `=` and all compound assignments *(right-associative)* |
| loosest | `,` |

Two structural facts worth keeping:

- **Unary is tighter than binary**, which is why `typeof x + y` surprises.
- **Bitwise `&` is looser than `===`**, so `a & b === c` is `a & (b === c)` — a
  classic bug in flag checks. Parenthesise:
  `(flags & MASK) !== 0` ([page 14](./14-bitwise.md)).

## Right-associative operators

Only three groups: `**`, the ternary, and assignment.

```
  true ? 1 : true ? 2 : 3   = 1
  a = b = 5  -> a = 5 b = 5
```

The ternary chaining right-associatively is what makes the decision-table
formatting on [page 08](./08-conditionals.md) work — `a ? x : b ? y : z` parses
as `a ? x : (b ? y : z)`, exactly as the aligned layout suggests.

## The comma operator is loosest of all

```
  (1, 2, 3)      = 3
  x = (1,2,3)    = 3
```

It evaluates every operand and returns the last. Because it is looser than `=`,
`x = 1, 2, 3` assigns `1` — the parentheses are what make the measured result
`3`.

You will meet it in minified code and in `for` headers
(`for (let i = 0, j = n; i < j; i++, j--)`), which is its one readable use.
Covered in [page 15](./15-comma-void-in-delete.md).

## The practical rule

**Parenthesise anything a reader might have to look up.** Extra parentheses cost
nothing at runtime, and a reviewer should never have to recall whether `&` binds
tighter than `===`. ESLint's `no-mixed-operators` enforces this for the
combinations that most often go wrong.

## Gotchas

**Symptom:** `2 ** 3 ** 2` gave 512 instead of 64.
**Cause:** `**` is right-associative.
**Fix:** parenthesise.

**Symptom:** a sum came out as a concatenated string, but only sometimes.
**Cause:** `+` groups left to right, so where the string sits changes the result
— measured `"33"` vs `"123"`.
**Fix:** convert at the boundary.

**Symptom:** a mixed `&&`/`||` condition takes the wrong branch.
**Cause:** `&&` binds tighter — `a || b && c` is `a || (b && c)`.
**Fix:** parenthesise; enable `no-mixed-operators`.

**Symptom:** `typeof x + y` produced a strange string.
**Cause:** `typeof` binds tighter than `+`.
**Fix:** `typeof (x + y)`, or compare the `typeof` result explicitly.

**Symptom:** a range check `a < x < b` always passes.
**Cause:** comparisons do not chain — measured, `3 > 2 > 1` is `false`.
**Fix:** `a < x && x < b`.

**Symptom:** a bitmask test is always false.
**Cause:** `&` is looser than `===`, so `flags & MASK === 0` parses as
`flags & (MASK === 0)`.
**Fix:** `(flags & MASK) !== 0`.

## Interview questions

**★ What does `3 > 2 > 1` evaluate to?**
`false`. Comparisons do not chain: `3 > 2` is `true`, then `true > 1` coerces to
`1 > 1`, which is `false`. `1 < 2 < 3` happens to be `true` for the same
mechanical reason, which makes it a misleading coincidence rather than a working
range check.

**★ Why is `1 + 2 + "3"` different from `"1" + 2 + 3`?**
`+` groups left to right. In the first, `1 + 2` is `3`, then `3 + "3"`
concatenates to `"33"`. In the second, `"1" + 2` concatenates immediately, so the
rest is string work and the result is `"123"`. The string's position changes the
answer.

**★ Which operators are right-associative?**
Three: `**`, the ternary `? :`, and assignment. Everything else groups left to
right. `2 ** 3 ** 2` is `2 ** 9` = 512, and `a = b = 5` assigns right to left.

**Why should you parenthesise `&&` mixed with `||`?**
Because `&&` binds tighter, so `a || b && c` means `a || (b && c)` — measured to
differ from `(a || b) && c`. It reads as a sequence and is not one. Note the
language now refuses this for `??`, making it a `SyntaxError` instead of a silent
surprise.

**What is the most common precedence bug in bit manipulation?**
`flags & MASK === 0`. Equality binds tighter than `&`, so it parses as
`flags & (MASK === 0)`. Write `(flags & MASK) !== 0`.

---

← [09 · switch](./09-switch.md) · [Phase index](./) · Next: [11 · Expressions vs statements](./11-expressions-vs-statements.md) →
