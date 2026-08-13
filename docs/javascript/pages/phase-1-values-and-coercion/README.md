---
title: "Phase 1 — Values, types and coercion"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6.233.17, ICU 78.3, Unicode 17.0).
> Scripts in `sandbox/js-p1/`.

**The phase that explains most "JavaScript is broken" moments.** Seventeen topics
covering what a value *is*, when two values are the same, and what happens when
you mix types.

Three rows here account for a disproportionate share of the bugs a fullstack
developer actually ships: **references vs copies**, **coercion**, and **floating
point**. The third one is the difference between a correct cart total and a
customer seeing `₹59.97000000000001`.

## Pages

| # | Page | Tier | What it settles |
|---|---|---|---|
| 01 | **[The eight types](./01-the-eight-types.md)** | <span className="db-tier t-master">Master</span> | `typeof` for every value, and the `null` bug |
| 02 | **[Primitives are copied, objects are shared](./02-references-vs-values.md)** | <span className="db-tier t-master">Master</span> | "Why did this value change?" |
| 03 | **[`==` vs `===`](./03-equality.md)** | <span className="db-tier t-master">Master</span> | The measured table, and the one defensible `==` |
| 04 | **[Truthiness](./04-truthiness.md)** | <span className="db-tier t-master">Master</span> | Exactly eight falsy values |
| 05 | **[`null` vs `undefined`](./05-null-vs-undefined.md)** | <span className="db-tier t-master">Master</span> | `??` vs `\|\|`, and where defaults fire |
| 06 | **[Numbers are doubles](./06-numbers-are-doubles.md)** | <span className="db-tier t-master">Master</span> | Money, precision, and safe integers |
| 07 | **[`const` does not mean immutable](./07-const-is-not-immutable.md)** | <span className="db-tier t-understand">Understand</span> | Binding vs value; freeze is shallow |
| 08 | **[Type coercion](./08-type-coercion.md)** | <span className="db-tier t-understand">Understand</span> | `[] + {}` explained once |
| 09 | **[Explicit conversion](./09-explicit-conversion.md)** | <span className="db-tier t-understand">Understand</span> | `Number` vs `parseInt`, and the radix trap |
| 10 | **[Strings are UTF-16](./10-strings-are-utf16.md)** | <span className="db-tier t-understand">Understand</span> | Emoji, `.length`, and slicing safely |
| 11 | **[`NaN`](./11-nan.md)** | <span className="db-tier t-understand">Understand</span> | Why it is never equal to itself |
| 12 | **[`Symbol`](./12-symbol.md)** | <span className="db-tier t-understand">Understand</span> | Keys that never collide |
| 13 | **[`BigInt`](./13-bigint.md)** | <span className="db-tier t-understand">Understand</span> | When doubles run out |
| 14 | **[Value equality in practice](./14-value-equality.md)** | <span className="db-tier t-understand">Understand</span> | Deep equal, and where JSON comparison breaks |
| 15 | **[Object wrappers and autoboxing](./15-object-wrappers.md)** | <span className="db-tier t-know">Know</span> | How a primitive has methods |
| 16 | **[`Object.is`, `-0` and `Infinity`](./16-object-is-and-zero.md)** | <span className="db-tier t-know">Know</span> | The fourth equality algorithm |
| 17 | **[Numeric literals](./17-numeric-literals.md)** | <span className="db-tier t-know">Know</span> | Separators, bases, exponents |

## Phase gate

**Move on when** you can predict the result of `[] == false`, `'' == 0` and
`null == undefined` and explain **each from the algorithm**, not from memory —
and when you can say why a cart total should never be stored as `19.99`.

## What the measurements changed

Four results from `sandbox/js-p1/` that contradict what is commonly taught:

1. **`null >= 0` is `true` but `null > 0` is `false`** — relational and equality
   operators coerce `null` differently. Covered in [03](./03-equality.md).
2. **`(1.005).toFixed(2)` is `"1.00"`, not `"1.01"`.** `toFixed` is not
   half-up rounding, and it is not a money formatter. See
   [06](./06-numbers-are-doubles.md).
3. **`[NaN].includes(NaN)` is `true` while `[NaN].indexOf(NaN)` is `-1`** — they
   use different equality algorithms. Page 11, planned.
4. **A three-person family emoji has `.length` 8, spreads to 5, and is 1
   grapheme.** Three defensible answers to "how long is this string". See
   [10](./10-strings-are-utf16.md).

## Where this connects

- **→ Phase 2 (operators)** — `??`, `?.` and the logical operators build directly
  on truthiness and `null`/`undefined`.
- **→ Phase 5 (built-in library)** — `sort`'s default string comparison and
  `JSON.stringify`'s omissions are coercion rules in disguise.
- **→ Phase 18 (storefront)** — the money row here is the whole basis of the
  cart-total page; integer minor units start on page 06.
- **→ React** — "primitives are copied, objects are shared" is why state updates
  are written immutably. Page 02 is the prerequisite for understanding that.

---

Start → [01 · The eight types](./01-the-eight-types.md)
