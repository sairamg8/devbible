---
title: "Phase 2 — Operators, expressions and control flow"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6.233.17).
> Scripts in `sandbox/js-p2/`.

**Small rows, very high frequency.** Fifteen topics covering the operators you
type hundreds of times a day and the control flow that strings them together.

Two of these produce bugs that are effectively invisible on review: **operator
precedence** (particularly `??` mixed with `||`, and right-associative `**`) and
**automatic semicolon insertion**. Both are covered with the exact rules rather
than folklore.

## Pages

| # | Page | Tier | What it settles |
|---|---|---|---|
| 01 | **[Arithmetic operators](./01-arithmetic.md)** | <span className="db-tier t-master">Master</span> | `%` with negatives, integer division, `**` |
| 02 | **[Assignment and compound assignment](./02-assignment.md)** | <span className="db-tier t-understand">Understand</span> | `&&=`, `\|\|=`, `??=` short-circuit the *write* |
| 03 | **[Logical operators return operands](./03-logical-operators.md)** | <span className="db-tier t-master">Master</span> | Not booleans — and the default-value idiom |
| 04 | **[Optional chaining `?.`](./04-optional-chaining.md)** | <span className="db-tier t-master">Master</span> | What it does **not** protect |
| 05 | **[Loops](./05-loops.md)** | <span className="db-tier t-master">Master</span> | A decision table, and where `break`/`await` work |
| 06 | **[Spread and rest](./06-spread-and-rest.md)** | <span className="db-tier t-master">Master</span> | Shallow copies, and where each is legal |
| 07 | **[Comparison operators](./07-comparison.md)** | <span className="db-tier t-understand">Understand</span> | Strings, Dates, and why objects never compare |
| 08 | **[Conditionals](./08-conditionals.md)** | <span className="db-tier t-understand">Understand</span> | When a ternary costs more than it saves |
| 09 | **[`switch`](./09-switch.md)** | <span className="db-tier t-understand">Understand</span> | `===`, fallthrough, the `case` scope trap |
| 10 | **[Operator precedence](./10-precedence.md)** | <span className="db-tier t-understand">Understand</span> | The five that actually bite |
| 11 | **[Expressions vs statements](./11-expressions-vs-statements.md)** | <span className="db-tier t-understand">Understand</span> | Why an IIFE needs parentheses |
| 12 | **[Automatic semicolon insertion](./12-asi.md)** | <span className="db-tier t-understand">Understand</span> | The exact rules and the five dangerous line starts |
| 13 | **[`break`, `continue`, labels](./13-break-continue-labels.md)** | <span className="db-tier t-know">Know</span> | The one case labels earn their place |
| 14 | **[Bitwise operators](./14-bitwise.md)** | <span className="db-tier t-know">Know</span> | 32-bit coercion, flags, and why `~~` is not `trunc` |
| 15 | **[Comma, `void`, `in`, `delete`](./15-comma-void-in-delete.md)** | <span className="db-tier t-know">Know</span> | The operators nobody names as operators |

## Phase gate

**Move on when** you can explain why `a ?? b || c` is a `SyntaxError`, what
`2 ** 3 ** 2` evaluates to and why, and which five line starts break a file that
omits semicolons.

## What the measurements changed

1. **`-7 % 3` is `-1`, not `2`.** `%` is *remainder*, not modulo — it takes the
   sign of the dividend. Real modulo needs `((a % b) + b) % b`.
2. **`2 ** 3 ** 2` is `512`, not `64`** — `**` is the only right-associative
   arithmetic operator. And `-2 ** 2` is a **`SyntaxError`**, deliberately.
3. **`?.` does not protect a non-function.** `nf.notAFunction?.()` still throws
   `TypeError: nf.notAFunction is not a function` — `?.()` only guards
   `null`/`undefined`.
4. **`~~1e10` is `1410065408`.** The `~~` "fast truncate" trick silently wraps at
   32 bits; `Math.trunc` gives `10000000000`.
5. **`for…in` walks the prototype chain** and yields **string** indices on
   arrays.

## Where this connects

- **← Phase 1** — every operator here is coercion and truthiness applied.
- **→ Phase 3 (functions)** — rest parameters and default values continue there.
- **→ Phase 6 (iteration)** — `for…of` and spread are the iteration protocol.

---

Start → [01 · Arithmetic operators](./01-arithmetic.md)
