---
title: "14 · Bitwise operators"
sidebar_label: "14 · Bitwise"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p2/ex4-spread-bitwise.mjs`.

**Every bitwise operator converts its operands to 32-bit signed integers first.**
Numbers are 64-bit doubles ([Phase 1 · 06](../phase-1-values-and-coercion/06-numbers-are-doubles.md)),
so anything above 2³¹ silently wraps. That single fact is why the popular `~~`
truncation trick is a bug waiting for a large input.

## Measured

```
--- bitwise coerces to 32-bit signed ---
  2**31 | 0        = -2147483648
  4294967296 | 0   = 0
  ~~3.9            = 3 | ~~-3.9 = -3 | Math.trunc(-3.9) = -3
  ~~1e10           = 1410065408 <- WRONG, exceeds 32 bits; Math.trunc = 10000000000
  5 >> 1 = 2 | -5 >> 1 = -3 | -5 >>> 1 = 2147483645
  flags: READ|WRITE = 3 | has WRITE? true
```

## The operators

| | Meaning | Example |
|---|---|---|
| `&` | AND — 1 where **both** bits are 1 | `0b1100 & 0b1010` → `0b1000` |
| `\|` | OR — 1 where **either** is 1 | `0b1100 \| 0b1010` → `0b1110` |
| `^` | XOR — 1 where they **differ** | `0b1100 ^ 0b1010` → `0b0110` |
| `~` | NOT — flips every bit | `~5` → `-6` |
| `<<` | left shift | `1 << 3` → `8` |
| `>>` | **signed** right shift — keeps the sign | `-5 >> 1` → `-3` |
| `>>>` | **unsigned** right shift — fills with 0 | `-5 >>> 1` → `2147483645` |

`~n` being `-(n+1)` follows from two's complement. It is why the old
`if (~str.indexOf(x))` idiom worked — `indexOf` returns `-1` on failure and
`~(-1)` is `0`, which is falsy. Use `includes` instead; it says what it means.

## The 32-bit ceiling

```
  2**31 | 0        = -2147483648
  4294967296 | 0   = 0
  ~~1e10           = 1410065408
```

`2**31 | 0` is **negative** because bit 31 is the sign bit in a 32-bit signed
integer. `2**32 | 0` is `0` — the value wrapped completely.

So the widely-repeated "`~~x` is a faster `Math.trunc`" advice is only true below
2³¹:

```js
~~3.9;          // 3            ✅
~~-3.9;         // -3           ✅
~~1e10;         // 1410065408   ❌ measured — should be 10000000000
Math.trunc(1e10); // 10000000000 ✅
```

**Use `Math.trunc`.** It is correct for every input, and on a modern engine the
performance difference is not something you can observe outside a synthetic
benchmark ([Phase 0 · 11](../phase-0-how-javascript-runs/the-jit)). The same
applies to `x | 0`, `x >> 0` and `x << 0`.

`>>>` is the only operator that produces an unsigned 32-bit result, which is why
`-1 >>> 0` is `4294967295` — occasionally useful for treating a value as
unsigned.

## Where bitwise genuinely earns its place: flag sets

```
  flags: READ|WRITE = 3 | has WRITE? true
```

```js
const PERM = Object.freeze({
  READ:   1 << 0,   // 1
  WRITE:  1 << 1,   // 2
  DELETE: 1 << 2,   // 4
  ADMIN:  1 << 3,   // 8
});

let perms = PERM.READ | PERM.WRITE;         // 3 — combine

const canWrite = (perms & PERM.WRITE) !== 0;  // test
perms |= PERM.DELETE;                          // add
perms &= ~PERM.WRITE;                          // remove
perms ^= PERM.ADMIN;                           // toggle
```

Note the parentheses in the test. **`&` is looser than `===`**, so
`perms & PERM.WRITE !== 0` parses as `perms & (PERM.WRITE !== 0)` and is a
classic bug ([page 10](./10-precedence.md)).

This is compact and fast, and it is worth knowing because you will meet it in
APIs — Node's `fs` constants, DOM `compareDocumentPosition`, WebGL, canvas
compositing. For your own code a `Set` of strings is usually clearer, and the
performance difference is irrelevant at application scale.

Note the limit: only **31 usable flags** in a signed 32-bit space, and
`1 << 31` is negative. Beyond that use `BigInt` bitwise operators, which are
arbitrary-precision.

## Other legitimate uses

- **Hashing** — most string-hash functions use `<<`, `^` and `| 0` to stay in
  32-bit range deliberately.
- **Colour packing** — `(r << 16) | (g << 8) | b`, then `>>` and `& 0xff` to
  unpack.
- **`Math.floor` for positive numbers** — `x >> 0`, subject to the same 32-bit
  limit.
- **Parity** — `n & 1` for odd/even, though `n % 2` is clearer.

## Gotchas

**Symptom:** `~~x` gave a wrong value for a large number.
**Cause:** 32-bit wrap — measured, `~~1e10` is `1410065408`.
**Fix:** `Math.trunc`.

**Symptom:** a flag test is always false.
**Cause:** `flags & MASK !== 0` parses as `flags & (MASK !== 0)` because `&` is
looser than `!==`.
**Fix:** `(flags & MASK) !== 0`.

**Symptom:** a large value became negative or zero after a bitwise operation.
**Cause:** conversion to 32-bit signed — measured, `2**31 | 0` is
`-2147483648` and `2**32 | 0` is `0`.
**Fix:** avoid bitwise on values above 2³¹, or use `BigInt`.

**Symptom:** `-5 >> 1` and `-5 >>> 1` disagree wildly.
**Cause:** `>>` preserves the sign bit; `>>>` fills with zeros and yields an
unsigned result — measured `-3` and `2147483645`.
**Fix:** use `>>` for signed arithmetic; `>>>` only when you want unsigned.

**Symptom:** a bitwise operation on a fractional number silently truncated it.
**Cause:** `ToInt32` truncates toward zero before operating.
**Fix:** that is often intended — but be explicit with `Math.trunc` if it is.

**Symptom:** flag 32 does not work.
**Cause:** `1 << 31` is negative in a signed 32-bit space, and `1 << 32` wraps
to `1`.
**Fix:** cap at 31 flags, or use `BigInt`.

## Interview questions

**★ Why is `~~1e10` wrong?**
Bitwise operators convert operands to **32-bit signed integers**, and 10¹⁰
exceeds that range, so it wraps — measured as `1410065408` instead of
`10000000000`. `~~` is only a valid truncation below 2³¹. Use `Math.trunc`.

**★ What is the difference between `>>` and `>>>`?**
`>>` is a signed right shift that preserves the sign bit; `>>>` is unsigned and
fills with zeros. Measured, `-5 >> 1` is `-3` while `-5 >>> 1` is `2147483645`.
`>>>` is the only bitwise operator producing an unsigned 32-bit result.

**★ How do you implement a permission flag set?**
Powers of two via `1 << n`, combined with `|`, tested with `(flags & MASK) !== 0`,
added with `|=`, removed with `&= ~MASK`, toggled with `^=`. The parentheses in
the test are essential because `&` binds looser than `!==`. Only 31 flags fit in
a signed 32-bit space.

**Is `x | 0` a good way to truncate?**
Only below 2³¹, and only if you accept a silent wrap otherwise. `Math.trunc` is
correct for every input, and on a modern engine the performance difference is not
observable outside a synthetic benchmark.

**When would you actually reach for bitwise operators?**
Interoperating with APIs that use flag bitmasks (Node `fs` constants, DOM
`compareDocumentPosition`, WebGL), hashing, and colour packing. For your own
domain flags, a `Set` of strings is usually clearer at application scale.

---

← [13 · break, continue, labels](./13-break-continue-labels.md) · [Phase index](./) · Next: [15 · Comma, void, in, delete](./15-comma-void-in-delete.md) →
