---
title: "17 · Numeric literals"
sidebar_label: "17 · Numeric literals"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0**. Scripts: `sandbox/js-p1/ex8-null-nan-equality.mjs`,
> `ex6-coercion.mjs`, `ex10-literals.mjs`.

**Every literal form produces the same `number` type.** Base and separators are
notation for the reader, not different types. Short page, but the octal row has
caused real outages.

## Measured

```
  1_000_000 = 1000000 | 0b1010 = 10 | 0o755 = 493 | 0xff = 255 | 1e3 = 1000
```

```
Number("0xff") = 255 | Number("0o755") = 493 | Number("0b1010") = 10
parseInt("0o755") = 0 | parseInt("0b1010") = 0
(255).toString(16) = ff | (493).toString(8) = 755
  _1000   -> ReferenceError
  1000_   -> SyntaxError
  1._5    -> SyntaxError
  1__0    -> SyntaxError
0xFFFFFFFFFFFFFFF safe?  false
```

## The forms

| Form | Example | Value | Use for |
|---|---|---|---|
| Decimal | `42`, `3.14`, `.5` | 42, 3.14, 0.5 | everything |
| **Separators** | `1_000_000`, `0xff_ff` | 1000000, 65535 | readability of long numbers |
| Exponent | `1e3`, `1.5e-4` | 1000, 0.00015 | very large/small |
| Binary | `0b1010` | 10 | bit flags, masks |
| Octal | `0o755` | **493** | Unix file modes |
| Hex | `0xff` | 255 | colours, bytes, masks |
| BigInt | `10n`, `0xffn` | 10n | [page 13](./13-bigint.md) |

Numeric separators (`_`) are ignored entirely by the parser. They are the single
most under-used readability feature in the language:

```js
const MAX_ORDER_MINOR = 10_000_00;      // ₹10,000.00 in paise — instantly readable
const TIMEOUT_MS      = 30_000;
const MASK            = 0b1010_0001;
```

Rules: not leading, not trailing, not adjacent to the decimal point, not doubled.
`1_000` is fine; `1000_`, `1._5` and `1__0` are all `SyntaxError`. `_1000` is a
**`ReferenceError`**, not a syntax error — a leading underscore makes it a perfectly
legal *identifier*, so the engine looks for a variable by that name.

## The octal trap

```
0o755 = 493
```

`0o755` is **493**, not 755. That is correct — it is base 8 — and it is exactly
what you want when passing a Unix file mode:

```js
import { chmod } from 'node:fs/promises';
await chmod('deploy.sh', 0o755);    // ✅ rwxr-xr-x
await chmod('deploy.sh', 755);      // ❌ decimal 755 → mode 1363 octal — wrong permissions
```

The second line does not throw. It sets nonsense permissions, and you find out
when something is unexpectedly world-writable. **Always write file modes in
`0o` form.**

The legacy form `0755` (no `o`) was octal in sloppy mode and is a `SyntaxError` in
strict mode — measured in
[Phase 0 · 04](../phase-0-how-javascript-runs/strict-mode). Since modules are
always strict, you cannot write it by accident in modern code. But `parseInt('0755')`
is a different question — see below.

## `parseInt` and leading zeros

```
  parseInt("08")   = 8  parseInt("0x1F") = 31  parseInt("1F",16) = 31
```

`parseInt('08')` is `8` in modern engines — the old "leading zero means octal"
behaviour is gone. But `'0x'` prefixes **are** still read as hexadecimal, so
`parseInt('0x1F')` is `31`.

Always pass the radix ([page 09](./09-explicit-conversion.md)):

```js
parseInt(value, 10);
```

## Reading a number back out in another base

```js
(255).toString(16);      // 'ff'
(255).toString(2);       // '11111111'
(493).toString(8);       // '755'
parseInt('ff', 16);      // 255
Number('0xff');          // 255   — Number understands the 0x prefix
Number('0o755');         // 493   — and 0o and 0b too
```

`Number()` understands all three prefixed forms. `parseInt` does not — measured,
`parseInt('0o755')` and `parseInt('0b1010')` are both **`0`**, because parsing stops at
the letter. Another reason `Number` is the better default converter.

## Precision, briefly

All of these are doubles, so [page 06](./06-numbers-are-doubles.md) applies to
every form:

```js
0xFFFFFFFFFFFFFFF;       // beyond MAX_SAFE_INTEGER — silently imprecise
0b1111...;               // same
```

A literal in **any** base above 2⁵³ − 1 is rounded at parse time — measured,
`Number.isSafeInteger(0xFFFFFFFFFFFFFFF)` is `false`. Use `BigInt` literals (`0xffn`)
if you need exactness.

## Gotchas

**Symptom:** `chmod` set the wrong permissions.
**Cause:** the mode was written in decimal (`755`) instead of octal (`0o755`).
**Fix:** always `0o` for file modes. Nothing throws — the value is simply wrong.

**Symptom:** `SyntaxError` on a number with an underscore.
**Cause:** a separator in an illegal position — leading, trailing, doubled, or
next to the decimal point.
**Fix:** separators only between digits.

**Symptom:** `parseInt('0x10')` returned 16 where 0 was expected.
**Cause:** the `0x` prefix is honoured without a radix.
**Fix:** `parseInt(value, 10)`.

**Symptom:** `SyntaxError: Octal literals are not allowed in strict mode`.
**Cause:** a legacy `0755` literal in a module.
**Fix:** `0o755`.

**Symptom:** a large hex constant is off by a small amount.
**Cause:** it exceeds `MAX_SAFE_INTEGER` and was rounded at parse time.
**Fix:** a `BigInt` literal — `0xffffffffffffffffn`.

## Interview questions

**★ What is `0o755` and why does it matter?**
An octal literal — decimal **493**, measured. It matters for Unix file modes:
`chmod(path, 0o755)` is correct, while `chmod(path, 755)` passes decimal 755 and
silently sets the wrong permissions without throwing.

**What are numeric separators?**
Underscores ignored by the parser, purely for readability — `1_000_000` is
`1000000`. They are illegal leading, trailing, doubled, or adjacent to the
decimal point. Useful for large constants, timeouts and bit masks.

**Do different literal bases produce different types?**
No. `0b1010`, `0o12`, `0xa` and `10` are all the same `number` value. Base is
notation only. Only the `n` suffix changes the type, to `bigint`.

**Why is `0755` a `SyntaxError` in modern code?**
Legacy octal literals are forbidden in strict mode, and ES modules and class
bodies are always strict. Use `0o755`.

**How do you convert a number to hex and back?**
`(255).toString(16)` gives `'ff'`; `parseInt('ff', 16)` gives `255`. `Number()`
also understands prefixed strings — `Number('0xff')` is `255` — and unlike
`parseInt` it handles `0b` and `0o` prefixes too.

---

← [16 · Object.is, -0, Infinity](./16-object-is-and-zero.md) · [Phase index](./) · **Phase 1 complete** → [Phase 2 — Operators, expressions and control flow](../../syllabus/01-language-core.md)
