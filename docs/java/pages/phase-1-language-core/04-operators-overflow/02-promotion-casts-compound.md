---
title: "Promotion, casts and compound assignment"
sidebar_label: "2 · Promotion and casts"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JLS SE 25 §5.6 (numeric contexts and
> promotion), §5.2 (assignment contexts — narrowing with constants),
> §15.25 (conditional operator), §15.26.2 (compound assignment operators),
> and §3.10.1 (integer literals).

**Java does no arithmetic on anything smaller than `int`. Every `byte`,
`short` and `char` operand is promoted before the operator runs, every
mixed-width expression is computed in the wider type *per operation, left
to right*, and compound assignment silently casts the result back down.
Each rule is mechanical; the intersections are where the surprises live —
`b = b + 1` refusing to compile while `b += 1` doesn't just compile but
truncates, and a ternary quietly unboxing to `double`.**

## Numeric promotion: the actual rules

Binary numeric promotion (JLS §5.6) before `+ - * / %`, comparisons, and
bitwise `& | ^`:

1. If either operand is `double`, both become `double`.
2. Else if either is `float`, both become `float`.
3. Else if either is `long`, both become `long`.
4. **Else both become `int`** — even when both are `byte`, `short` or
   `char`.

The consequences:

- `byte + byte` is an `int`. Assigning it back needs a cast:
  `byte c = (byte) (a + b);`.
- `char` arithmetic is numeric UTF-16 code-unit math — `'a' + 1` is the
  `int` 98; getting `'b'` back requires `(char) ('a' + 1)`. Useful for
  range checks (`c >= 'a' && c <= 'z'`) and offsets; surprising in string
  building, where `"" + c + 1` concatenates instead
  ([chunk 3](03-shifts-bitwise-strings.md)).
- Promotion happens **per operation**, and arithmetic associates left to
  right: in `1000 * 60 * 60 * 24 * days`, every `*` runs in `int` — the
  wrap has already happened before a `long` target variable ever sees the
  result. `1000L * 60 * ...` promotes from the first multiplication.
  Assigning to `long` does *not* make the arithmetic `long`.

## The compound-assignment hidden cast

`b += 1` and `b = b + 1` are not the same statement. Compound assignment
(JLS §15.26.2) is defined as `E1 = (T) (E1 op E2)` — it includes an
**implicit cast back to the left-hand type**:

```java
byte b = 10;
b = b + 1;    // does not compile — b + 1 is an int
b += 1;       // compiles: means b = (byte) (b + 1) — including the cast

long big = 10_000_000_000L;
int i = 5;
i += big;     // compiles! i = (int) (i + big) — silently truncates
i = i + big;  // does not compile — the honest form shows the problem
```

The second half is the trap: `+=` with a wider right-hand side compiles and
truncates where the explicit form would have been a compile error. The same
applies to `short s = 1; s += 0.5;` — which compiles, computes in `double`,
and truncates back to `short` (`s` becomes `1`). Treat any compound
assignment whose right side is wider than its left as a review flag.

`++` and `--` carry the same built-in cast — `byte b = 127; b++;` wraps to
−128 without complaint.

## Constant expressions: the compiler's special cases

Two narrow rules that look like contradictions until you know them:

- **Narrowing assignment of constants** (JLS §5.2): `byte b = 127;`
  compiles even though `127` is an `int` literal — a *constant expression*
  of type `int` that fits the target may narrow implicitly on assignment to
  `byte`/`short`/`char`. `byte b = 128;` fails. This only works in
  assignment (and only for compile-time constants): `byte b = someInt;`
  never compiles without a cast.
- **Constant folding still wraps**: `int x = Integer.MAX_VALUE + 1;`
  compiles — the compiler folds it to `MIN_VALUE` at compile time, wrapping
  exactly as the runtime would. But the literal `int x = 2147483648;` is a
  compile error ("integer number too large") — literals are checked,
  computed constants are not. `int min = -2147483648;` is legal only
  because the `-` is part of the rule for the minimum literal.
- Underscores in literals (`1_000_000`, `0xFF_FF`) are purely visual —
  use them for anything past four digits; they'd have prevented more than
  one "one zero too many" constant.

## The conditional operator promotes too

`condition ? a : b` applies numeric promotion to its result type (JLS
§15.25), with two famous side effects:

```java
long timeout = flag ? 100 : defaultLong;   // result type long — fine
Object o = flag ? 1 : 2.0;                 // Double 1.0 — int promoted to double!
Integer boxed = null;
int n = flag ? boxed : 0;                  // NPE when flag is true? No —
                                           // NPE ALWAYS: mixed Integer/int
                                           // unboxes boxed unconditionally
```

The last one is the production bug: a ternary mixing a boxed wrapper and a
primitive **unboxes the wrapper** to promote — if the wrapper arm is
`null`, it throws `NullPointerException` *even when the condition selects
the other arm* is the common misreading; precisely, the unboxing happens
when that arm is evaluated, but the promotion rule means the `null` arm is
an unbox site at all — see
[autoboxing](../02-autoboxing-integer-cache/README.md) for the full
unboxing-NPE taxonomy. The safe form: make both arms the same type
explicitly.

## Boxed comparison is not numeric comparison

`==` between two boxed `Integer`s compares references, and the cache makes
it *look* numeric for small values — `Integer.valueOf(127) ==
Integer.valueOf(127)` is `true`, `1000 == 1000` on boxed values is `false`.
The full story (cache bounds, `equals`, unboxing rules) is
[topic 02's](../02-autoboxing-integer-cache/README.md); the operator-level
rule here: **`==` with two boxed operands does not promote or unbox** —
only a mixed boxed/primitive comparison unboxes.

## Gotchas

**Symptom:** `i += longValue` compiles and corrupts data; `i = i + longValue` on the same types doesn't compile
**Cause:** compound assignment carries a hidden narrowing cast back to the left-hand type
**Fix:** treat a compound assignment mixing widths as a review flag; widen the variable or make the cast explicit and justified

**Symptom:** `byte`/`short` arithmetic "randomly" needs casts that `int` code doesn't
**Cause:** there is no sub-`int` arithmetic — every operand promotes to `int`, so the *result* no longer fits the operand type
**Fix:** use `int` for local arithmetic and keep `byte`/`short` for storage (arrays, wire formats); cast once at the boundary

**Symptom:** a `long` total is wrong even though the variable is declared `long`
**Cause:** the right-hand side computed entirely in `int` (all factors `int`), wrapped, and *then* widened
**Fix:** make the first operand `long` (`1000L * ...`) — promotion is per-operation, left to right; the declaration type of the target is irrelevant to the arithmetic

**Symptom:** `byte b = 127;` compiles but `byte b = intVar;` doesn't, "inconsistently"
**Cause:** implicit narrowing on assignment exists only for compile-time constants that fit
**Fix:** it's not inconsistent — constants are checked at compile time, variables can't be; cast explicitly and consider whether the narrow type is worth it

**Symptom:** ternary with a boxed arm throws `NullPointerException` on a line with no visible dereference
**Cause:** mixed boxed/primitive arms force unboxing for numeric promotion
**Fix:** make both arms the same type — box the primitive arm or null-check the boxed one; see [autoboxing](../02-autoboxing-integer-cache/README.md)

**Symptom:** `Object o = flag ? 1 : 2.0;` stores `1.0`, not `1`
**Cause:** conditional-operator numeric promotion unified the arms to `double` before boxing
**Fix:** when arms should keep distinct types, cast to `Object` per arm or use an if/else

**Symptom:** `char` math prints numbers instead of characters
**Cause:** `'a' + 1` is an `int`; println picked the `int` overload
**Fix:** cast back — `(char) ('a' + 1)` — or build strings via `StringBuilder.append(char)`

**Symptom:** `b++` on `byte b = 127` produces −128 with no warning anywhere
**Cause:** increment carries the same implicit narrowing cast as compound assignment
**Fix:** don't do loop arithmetic in `byte`/`short`; if a wire format needs the wrap, comment that it's intentional

## Interview questions

**★ Why does `b += 1` compile where `b = b + 1` doesn't, for a `byte`?**
Arithmetic promotes `byte` to `int`, so the explicit form needs a cast.
Compound assignment is *defined* (JLS §15.26.2) as including that cast back
to the target type — convenient for `byte`, dangerous when the right-hand
side is wider (`int += long` truncates silently).

**★ What are the binary numeric promotion rules?**
double > float > long, else both operands become `int` — there is no
arithmetic below `int`. Applied per operation, left to right, which is why
one `L` suffix at the front of a product changes the result and one at the
end may not.

**★ What does `'a' + 1` evaluate to, and why?**
The `int` 98 — `char` promotes to `int` in arithmetic. Getting `'b'`
requires the cast `(char) ('a' + 1)`.

**★ Why can a ternary throw an NPE with no visible dereference?**
Mixing a boxed wrapper arm with a primitive arm forces unboxing for
numeric promotion; a `null` wrapper unboxes via `intValue()` and throws.
Keep both arms the same type.

**Why does `byte b = 127;` compile if 127 is an `int`?**
Assignment-context narrowing: a constant expression that provably fits the
target type may narrow implicitly. Only constants, only on assignment —
which is also why `b = b + 1` (non-constant) needs the cast.

**Does `int x = Integer.MAX_VALUE + 1;` compile?**
Yes — constant folding wraps at compile time exactly as runtime arithmetic
would, giving `MIN_VALUE`. Only out-of-range *literals* are compile errors.
A folded wrap is as silent as a runtime one.

**When do `byte` and `short` still earn their keep?**
Storage, not arithmetic: large arrays, file and network formats, memory
layout. In locals and expressions they cost casts and buy nothing — `int`
is the working scalar type.

---

← Prev: [Division, remainder and overflow](01-division-remainder-overflow.md) · Next → [Shifts, bitwise operators and `String +`](03-shifts-bitwise-strings.md)
