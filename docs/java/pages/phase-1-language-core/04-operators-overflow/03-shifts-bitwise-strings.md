---
title: "Shifts, bitwise operators and String +"
sidebar_label: "3 · Shifts, bits, String +"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JLS SE 25 §15.19 (shift operators),
> §15.22 (bitwise and logical operators), §15.18.1 (string concatenation),
> §15.7 (evaluation order), and §5.1.2 (widening — sign extension).

**Three operator families finish the story: shifts (where the distance is
silently masked and `>>` is not `>>>`), bitwise operators (which double as
non-short-circuit logical operators on `boolean` — almost always a typo),
and `String +` (which turns everything to its right into concatenation,
left to right). Plus the sign-extension repair `& 0xFF` that every byte-
processing loop needs and few explain.**

## Shifts

- `<<` (left), `>>` (arithmetic right — sign-propagating), `>>>` (logical
  right — zero-filling). `-8 >> 1` is `-4`; `-8 >>> 1` is a huge positive
  number. For anything but sign-aware math, `>>>` is the one you meant.
- **Shift distance is masked**: for `int`, only the low 5 bits count, so
  `x << 32` is `x << 0` — `x`, unchanged, silently (for `long`, low 6 bits,
  `<< 64` ≡ `<< 0`). "Shift everything out" must be written as `0`.
  The mask applies to negative distances too: `x << -1` is `x << 31`.
- `x << n` multiplies by 2ⁿ and `x >> n` divides by 2ⁿ *only for
  non-negative x* — for negative values `>>` rounds toward negative
  infinity where `/` truncates toward zero: `-7 >> 1` is `-4`, `-7 / 2` is
  `-3`. Don't hand-optimize division to shifts; the JIT does it correctly,
  including the sign fix-up, and your version won't.
- There is no `<<<` — left shift has no arithmetic/logical split because
  bits leaving the top don't need a sign decision.

## Bitwise operators, flags and masks

`&`, `|`, `^`, `~` operate on the two's-complement bit patterns
([promotion applies](02-promotion-casts-compound.md): `byte`/`short`/`char`
operands become `int` first). The working idioms:

```java
static final int READ = 1, WRITE = 1 << 1, DELETE = 1 << 2;

int perms = READ | WRITE;               // set
boolean canWrite = (perms & WRITE) != 0; // test — parens REQUIRED
perms &= ~DELETE;                        // clear
perms ^= WRITE;                          // toggle
```

- The parentheses in `(perms & WRITE) != 0` are load-bearing: `==`/`!=`
  bind **tighter** than `&`/`|`/`^`, so `perms & WRITE != 0` parses as
  `perms & (WRITE != 0)` — a type error here, a logic bug in C-shaped
  languages. [Precedence](../16-precedence-evaluation.md) owns the full
  table.
- `x & (n - 1)` is `x % n` for power-of-two `n` and non-negative `x` —
  this is exactly how `HashMap` picks a bucket from a hash, and why its
  capacities are powers of two.
- In application code, **`EnumSet` replaces hand-rolled flag ints**: same
  bit-vector performance, type-safe, printable
  ([enums](../../phase-2-classes-objects/10-enums/README.md)). Reach for
  raw bit flags at wire-format and interop boundaries, not in domain logic.
- `Integer` ships the counting utilities so you never hand-roll them:
  `bitCount`, `numberOfTrailingZeros`, `highestOneBit`, `reverse`,
  `rotateLeft`.

### The `& 0xFF` sign-extension repair

`byte` is signed; widening a `byte` to `int` **sign-extends** (JLS §5.1.2):
`(byte) 0xF0` widens to `0xFFFFFFF0`, i.e. −16, not 240. Every loop that
treats bytes as unsigned values — hex dumps, checksums, binary protocol
fields — must mask the extension away:

```java
int unsigned = b & 0xFF;                 // 0..255, always
int fromPair = ((hi & 0xFF) << 8) | (lo & 0xFF);   // without the masks,
                                         // a negative lo ORs 1-bits over hi
```

`Byte.toUnsignedInt(b)` says the same thing by name. The corresponding
`Integer.toUnsignedLong`, `Integer.divideUnsigned` and
`Long.compareUnsigned` cover the rarer "treat the whole `int`/`long` as
unsigned" cases.

## `&`/`|` on booleans: non-short-circuit

On `boolean` operands, `&`, `|` and `^` are logical operators that
**always evaluate both sides** — unlike `&&`/`||`, which skip the right
side when the left decides. `check1() & check2()` runs both methods every
time. Almost every `&` between boolean expressions in application code is a
typo for `&&` — except when someone *wanted* both side effects (validate
everything, collect all errors), which deserves a comment. Note `^` on
booleans is `!=`; there is no `^^` because XOR cannot short-circuit — both
sides always matter.

## `String +` and evaluation order

`+` with any `String` operand is concatenation, and expressions evaluate
**left to right**: `"total: " + 1 + 2` is `"total: 12"`, while
`1 + 2 + " total"` is `"3 total"`. Precedence didn't change — `+` stayed
left-associative; the *operation* changed mid-expression the moment a
`String` joined. Parenthesize the arithmetic:
`"total: " + (subtotal + tax)`. Adjacent traps: `"" + c + 1` on a `char`
concatenates ('a' → `"a1"`), and `null` concatenates as the four-letter
string `"null"` — the `"user: null"` you've seen in logs is this rule, not
a crash. (Loop-concatenation cost and `StringBuilder` are
[topic 06's](../06-strings/README.md) story.)

## Gotchas

**Symptom:** `x << 32` "does nothing"
**Cause:** shift distance is masked to 5 bits for `int` (6 for `long`) — 32 masks to 0
**Fix:** never compute a shift distance that can reach the type's width; special-case it to 0

**Symptom:** both sides of a `&` between boolean method calls execute, one with side effects that "shouldn't have happened"
**Cause:** `&`/`|` on booleans are non-short-circuit; only `&&`/`||` skip the right side
**Fix:** `&&`/`||` unless both evaluations are genuinely required — then comment it

**Symptom:** `"id: " + a + b` logs concatenated digits instead of a sum
**Cause:** left-to-right evaluation turned everything after the `String` into concatenation
**Fix:** parenthesize: `"id: " + (a + b)`

**Symptom:** hex dump shows `ffffff f0` garbage for high bytes
**Cause:** widening a negative `byte` sign-extended it to a negative `int` before formatting
**Fix:** mask every byte-to-int step: `b & 0xFF` (or `Byte.toUnsignedInt`); in multi-byte assembly, mask *each* byte before shifting

**Symptom:** `perms & WRITE != 0` doesn't compile (or, in a boolean-flag refactor, silently inverts)
**Cause:** `!=` binds tighter than `&` — the expression parsed as `perms & (WRITE != 0)`
**Fix:** always parenthesize mask tests: `(perms & WRITE) != 0`

**Symptom:** replacing `/ 2` with `>> 1` "for speed" changes results for negative inputs
**Cause:** `>>` floors, `/` truncates — they disagree on negatives by one
**Fix:** don't hand-optimize; the JIT already emits the shift with the sign fix-up for `/ 2`

**Symptom:** log lines end in `null` but nothing threw
**Cause:** `String +` converts a `null` reference to the literal text `"null"` instead of throwing
**Fix:** that's specified behaviour — validate/`Objects.requireNonNull` at the source if `null` shouldn't reach the log; `Objects.toString(x, "-")` for a chosen default

**Symptom:** negative shift distance produces a bizarre huge shift instead of an error
**Cause:** the distance is masked, so `-1` becomes 31 (or 63 for `long`)
**Fix:** validate computed shift distances at the boundary — the language will not

## Interview questions

**★ `>>` vs `>>>`?**
Arithmetic vs logical right shift: `>>` propagates the sign bit (keeps
negatives negative), `>>>` fills with zeros (treats the bits as unsigned).
They differ only for negative values — which is exactly when picking the
wrong one matters. `(low + high) >>> 1` in
[chunk 1](01-division-remainder-overflow.md) works *because* of the
zero-fill.

**★ Why does byte-to-int conversion need `& 0xFF`?**
Widening a signed `byte` sign-extends: `0xF0` becomes `0xFFFFFFF0` (−16).
The mask keeps the low 8 bits and zeroes the extension, recovering the
unsigned 0–255 value. Forgetting it corrupts every multi-byte assembly
because the extension bits OR over the neighbouring byte.

**★ What does `x & (n - 1)` compute, and where does the JDK use it?**
`x % n` when `n` is a power of two and `x` is non-negative — a single AND
instead of a division. `HashMap` sizes its table in powers of two exactly
so bucket selection is `hash & (capacity - 1)`.

**★ What happens on a shift by more than the type's width?**
The distance is masked to its low 5 bits (`int`) or 6 bits (`long`):
`x << 32` is `x`, `x << 33` is `x << 1`, and a negative distance wraps the
same way. There is no error path — the mask is the specification.

**When is `&` on booleans correct rather than a typo?**
When both sides must evaluate: run *all* validations and combine the
results, or force both side-effecting checks. It deserves a comment,
because every reader's first assumption is a missing `&`.

**Why is there no `<<<` or `^^` operator?**
Left shift needs no arithmetic/logical variant (no sign decision at the low
end), and XOR cannot short-circuit — its result always depends on both
operands, so a lazy form is meaningless.

**What does `"" + obj` do when `obj` is null?**
Concatenates the string `"null"` — string conversion special-cases null
rather than calling `toString()`. Handy in logs, dangerous when the result
feeds parsing; `String.valueOf` has the same behaviour, `obj.toString()`
throws.

---

← Prev: [Promotion, casts and compound assignment](02-promotion-casts-compound.md) · Next → [Floating point and `BigDecimal`](../05-floating-point-bigdecimal/README.md)
