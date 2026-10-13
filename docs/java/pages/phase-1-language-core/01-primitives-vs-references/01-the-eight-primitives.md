---
title: "The eight primitives"
sidebar_label: "1 · The eight primitives"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §4.2 (primitive types and values),
> §3.10.1–3.10.2 (integer and floating-point literals), and the JDK 25
> `Character` and `Integer` API documentation.

**Eight built-in kinds, fixed sizes, defined ranges — the value lives in the
variable itself, there is nothing to point to, nothing can be `null`, and
`==` compares the actual values. Everything in this chunk is JLS-specified
and identical on every JVM: sizes do not vary by platform the way C's do.**

## The full table

| Type | Size | Range / values | Field default | Literal |
|---|---|---|---|---|
| `byte` | 8-bit | −128 … 127 | `0` | none — needs a cast or constant assignment |
| `short` | 16-bit | −32,768 … 32,767 | `0` | none — same |
| `int` | 32-bit | ±2.1 billion (−2³¹ … 2³¹−1) | `0` | `42`, `0xFF`, `0b1010`, `042` (octal!) |
| `long` | 64-bit | ±9.2 × 10¹⁸ | `0L` | `42L` |
| `float` | 32-bit | IEEE-754 single | `0.0f` | `4.2f` — mandatory suffix |
| `double` | 64-bit | IEEE-754 double | `0.0d` | `4.2` |
| `char` | 16-bit | unsigned UTF-16 code unit, `'\u0000'` … `'\uFFFF'` | `'\u0000'` | `'a'`, `'\n'`, `'é'` |
| `boolean` | JVM-internal | `true` / `false` | `false` | `true`, `false` |

What to actually internalize:

- **`int` is the default integer, `double` the default decimal** — literals
  say so (`42` is `int`, `4.2` is `double`), arithmetic promotes to them, and
  the standard library's APIs assume them.
- **`long` for ids, timestamps and money-in-cents** — the 2.1 billion `int`
  ceiling is a real production incident (auto-increment ids cross it).
  Literal needs the suffix: `10_000_000_000L`.
- **`char` is not a character** — it is one UTF-16 code unit; emoji and many
  scripts need two (Phase 7's charset topic). It is also *unsigned*, the only
  unsigned primitive.
- **`boolean` has no defined size** — the spec deliberately doesn't say; it
  is not a 1-bit optimization you can count on. In practice HotSpot stores a
  field-sized `boolean` in a byte and a `boolean[]` one byte per element —
  an implementation detail, not a contract.
- **There are no unsigned integer types.** `char` aside, Java models
  unsigned math with the signed types plus the `Integer.toUnsignedString` /
  `divideUnsigned` / `compareUnsigned` static families — the *bits* are the
  same, only the interpretation changes.

## Literals — the fine print that bites

- **Integer literals are `int` unless suffixed** — `10_000_000_000` is a
  compile error ("integer number too large") even when assigned to a `long`.
  Write `10_000_000_000L`. Prefer capital `L`: lowercase `l` reads as `1`.
- **Underscores** are legal separators anywhere between digits
  (`1_000_000`, `0xFF_FF`) and cost nothing. Use them for anything past four
  digits.
- **A leading zero is octal.** `int flags = 0755;` is 493, not 755 — a
  Unix-permissions habit that produces silently wrong numbers. Hex is `0x`,
  binary is `0b`; there is no `0o` prefix in Java.
- **Floating literals are `double` unless suffixed** — `float f = 4.2;` does
  not compile (possible lossy conversion); `4.2f` does. And `float`
  itself is almost never the right choice in application code — chunk-level
  guidance in [topic 05](../05-floating-point-bigdecimal/README.md).
- **`char` literals take arithmetic** — `'a' + 1` is the `int` 98, not
  `'b'`. The numeric character story continues in
  [topic 04](../04-operators-overflow/README.md).

## `byte` and `short`: storage types, not arithmetic types

There is no `byte` or `short` arithmetic in Java — the JLS promotes both to
`int` before any operation, so `byte + byte` is an `int` and assigning it
back needs a cast. The practical consequence: `byte` and `short` earn their
keep only as *storage* — array elements, wire formats, file headers — where
the 4×/2× density matters. As locals and fields holding "small numbers",
they buy nothing and cost casts. Use `int`.

`byte` is also **signed** (−128…127), which surprises everyone touching
binary data: a `0xFF` byte read from a stream is `-1`, and widening it
smears the sign bit. The unsigned view is `b & 0xFF` — the single most
common idiom in binary-parsing code, covered properly with the shift
operators in [topic 04](../04-operators-overflow/README.md).

## Choosing the integer type — the working rules

| Data | Type | Why |
|---|---|---|
| Database ids, sequence numbers | `long` | auto-increment crosses 2³¹ in real systems |
| Epoch timestamps (millis) | `long` | already past 2³¹ since 1970 + 25 days |
| Money in minor units | `long` (or `BigDecimal` — [topic 05](../05-floating-point-bigdecimal/03-money-patterns.md)) | 2.1 billion cents is $21M — real invoices exceed it |
| Byte counts, file sizes | `long` | files over 2 GB exist |
| Collection sizes, loop indexes | `int` | the platform's own limit — arrays index by `int` |
| Wire/file formats | `byte`/`short` arrays | density, not arithmetic |

The `int` ceiling on array indexing is structural: `new long[3_000_000_000L]`
does not compile — arrays are indexed by `int`, so a single array tops out
at ~2.1 billion elements. Off-heap and segmented structures (Phase 12) exist
partly for this reason.

## Gotchas

**Symptom:** `10000000000` doesn't compile: "integer number too large"
**Cause:** an integer literal is an `int` unless suffixed — even when assigned to a `long`
**Fix:** `10_000_000_000L` (the underscores are legal separators and free readability)

**Symptom:** id counter or a duration-in-millis computation goes negative in production
**Cause:** `int` arithmetic silently overflowed (its ceiling is ~2.1 billion); ids and epoch-millis exceed it routinely
**Fix:** `long` for ids, timestamps, byte counts, money-in-cents. Overflow behaviour itself is [topic 04](../04-operators-overflow/README.md)

**Symptom:** a permissions- or flags-looking constant is silently the wrong number
**Cause:** the leading zero made it octal: `0755` is 493
**Fix:** drop the leading zero, or write hex/binary (`0x1ED`, `0b111_101_101`) — and let the underscores group the bits

**Symptom:** `float f = 4.2;` won't compile; `double d = 4.2f;` compiles but the value is off
**Cause:** floating literals default to `double`; the `f` suffix makes a *less* precise value that then widens
**Fix:** suffix to match the declared type — and default to `double` unless an API forces `float`

**Symptom:** `char` used to hold "a character" mangles emoji or non-BMP scripts
**Cause:** `char` is one UTF-16 code unit; code points above U+FFFF need two
**Fix:** treat strings via code points (`codePointAt`, `codePoints()`) when it matters; never assume 1 `char` = 1 user-visible character

**Symptom:** parsing binary data gives negative values for bytes ≥ 0x80
**Cause:** `byte` is signed; `0xFF` as a `byte` is −1, and widening propagates the sign
**Fix:** mask on widening — `int v = b & 0xFF` — every time a byte is really "8 unsigned bits"

**Symptom:** `byte c = a + b;` doesn't compile though `a` and `b` are bytes
**Cause:** arithmetic promotes `byte`/`short`/`char` to `int`; the result is an `int`
**Fix:** cast the result — `(byte) (a + b)` — accepting the truncation, or just use `int` for arithmetic and keep `byte` for storage

**Symptom:** a "small number" field was declared `short` for efficiency and now every use site casts
**Cause:** `short` saves memory only in arrays; as a field or local it usually occupies an `int`-sized slot anyway and all arithmetic promotes
**Fix:** `int` for values, `short[]`/`byte[]` for bulk storage

## Interview questions

**★ What are the eight primitive types and their sizes?**
`byte` 8, `short` 16, `int` 32, `long` 64 (integers); `float` 32, `double`
64 (IEEE-754); `char` 16 unsigned; `boolean` unspecified. Sizes are fixed by
the JLS on every platform — unlike C, there is no "depends on the machine".

**★ When do you choose `long` over `int`?**
Ids, epoch timestamps, byte counts, money in minor units — anything that can
cross 2.1 billion or already starts past it. `int` remains right for sizes,
counts and indexes that are structurally small — and arrays force it: they
index by `int`.

**★ Is `boolean` one bit? Is `char` signed?**
`boolean`'s size is deliberately unspecified by the JLS. `char` is the only
unsigned primitive — a 16-bit UTF-16 code unit, which is also why it is not
safely "a character".

**★ Why is there no unsigned `int` in Java, and what do you do instead?**
A deliberate language-simplicity decision: one signed interpretation per
size. The bits are interpretation-neutral, so the API layer fills the gap:
`Integer.parseUnsignedInt`, `toUnsignedLong`, `divideUnsigned`,
`compareUnsigned` — same 32 bits, unsigned math on request.

**Why does `byte b = 5;` compile without a cast when `5` is an `int`?**
Assignment of a *constant expression* narrows implicitly if the value fits
the target type (JLS §5.2). It is the one place Java narrows silently — and
it works only for compile-time constants; `byte b = anInt;` still needs the
cast.

**What is `'a' + 1`, and how do you get `'b'`?**
The `int` 98 — `char` promotes to `int` in arithmetic. `(char) ('a' + 1)`
casts back to `'b'`. In string context the surprise inverts: `"" + 'a' + 1`
is `"a1"`.

**Why prefer `int` over `short` for a field holding small numbers?**
Promotion makes all `short` arithmetic produce `int` (casts everywhere), and
the memory win is real only in arrays. `short`/`byte` are storage formats;
`int` is the arithmetic type.

---

Index: [Primitives vs reference types](README.md) · Next → [References and memory](02-references-and-memory.md)

{/* LINKMAP:START */}

## Further reading

*Best explanations found elsewhere on the web — added alongside this page, nothing here replaces it.*

- **Read this:** [Creating Primitive Type Variables in Your Programs](https://dev.java/learn/language/constructs/basics/primitive-types/) — dev.java: the eight primitives, ranges, and a table of default values for fields ("zero or null") (*read*)
- **Also good:** [Types, Values, and Variables (JLS chapter 4)](https://docs.oracle.com/javase/specs/jls/se25/html/jls-4.html) — Oracle: the normative definition (*headings only*)

{/* LINKMAP:END */}
