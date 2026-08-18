---
title: "Building and formatting strings"
sidebar_label: "2 · Building and formatting"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 `String`, `StringBuilder` and
> `Formatter` Javadoc, JEP 280 (indify string concatenation, 9), and the JLS
> §15.18.1 (string concatenation operator).

**Because strings are immutable, every `+` produces a new string. One `+` per
expression is fine — the compiler emits an optimized concatenation for the
whole expression. The same `+` *accumulating inside a loop* is quadratic:
each iteration copies everything built so far. Knowing which of the two you
are writing is the entire skill.**

## What `+` actually compiles to

Since Java 9 (JEP 280), `javac` compiles a concatenation *expression* into a
single `invokedynamic` call — the JVM assembles the whole expression in one
optimized step, sized correctly, no intermediate `StringBuilder` chain
visible in your code or your profiles.

```java
String line = user.id() + ":" + user.email() + ":" + roles.size();
// ONE indy call, one result allocation — this is fine, and idiomatic
```

The consequence worth internalizing: **readable single-expression `+` needs
no optimization.** Rewriting it to an explicit `StringBuilder` gains nothing
and reads worse — the JVM already does better than the hand-rolled version.

## The loop trap

The optimization is per *expression*. Accumulation across iterations is a
different shape:

```java
String csv = "";
for (Row row : rows) {
    csv += row.render() + "\n";     // copies the ENTIRE csv-so-far, each pass
}
```

Each `+=` builds a brand-new string containing everything accumulated plus
the addition — iteration *n* copies O(n) characters, so the loop is O(n²)
overall. At ten rows, invisible; at fifty thousand, seconds of pure copying
and allocation churn.

The fixes, in order of preference:

```java
// 1 — most loops are really a join:
String csv = rows.stream().map(Row::render)
                 .collect(Collectors.joining("\n"));
String ids  = String.join(",", idList);            // when already CharSequences

// 2 — genuine incremental building:
StringBuilder sb = new StringBuilder(rows.size() * 40);  // capacity guess
for (Row row : rows) sb.append(row.render()).append('\n');
String csv = sb.toString();
```

`StringBuilder` mutates an internal buffer and copies only on growth — linear
overall. The capacity hint avoids repeated buffer doublings when the final
size is estimable. (`StringBuffer` is the same API with synchronized methods
— legacy; a shared string-under-construction is a design smell, not a
synchronization problem.)

`Collectors.joining` and the streams machinery behind fix 1 are
[Phase 4's](../../phase-4-lambdas-streams/README.md) subject.

## `format` and `formatted`

For structured text, positional interpolation beats `+` chains:

```java
String msg = String.format("order %s: %d items, total %.2f", id, count, total);
String msg2 = "order %s: %d items, total %.2f".formatted(id, count, total);  // 15+
```

The working subset of conversions: `%s` (anything, via `toString`), `%d`
(integral), `%f`/`%.2f` (float with precision), `%x` (hex), `%n` (platform
newline), `%%` (literal percent). Three facts that bite:

- **Mismatch is a runtime exception**, not a compile error — `%d` fed a
  `String` throws `IllegalFormatConversionException` on the *format* call.
  Format strings are code that the compiler does not check.
- **`%f` on `double` is display, not money math** — rounding for output is
  fine; computing with binary floating point is topic 05's warning.
- **Locale sensitivity**: `String.format` uses the default locale — `%.2f`
  renders `3,14` in a German-locale JVM. For machine-readable output
  (logs, files, protocols) always pin it:
  `String.format(Locale.ROOT, "%.2f", v)`.

For *logging*, none of this: SLF4J's `log.info("order {}", id)` defers the
work until the level is enabled — concatenating or formatting eagerly inside
log calls is the Phase 12 logging topic's first correction.

## The rest of the building toolbox

| Tool | Use |
|---|---|
| `String.join(sep, parts)` | Joining existing `CharSequence`s — no stream needed |
| `Collectors.joining(sep, prefix, suffix)` | Joining a mapped stream; brackets for free |
| `sb.insert / deleteCharAt / reverse` | The rarely-needed mutators `StringBuilder` has and `String` lacks |
| `String.valueOf(x)` | Null-safe stringification — `"" + x` compiles to the same thing but reads like an accident |
| `str.repeat(n)` (11+) | Padding and separators without a loop |
| `StringWriter` | When an API demands a `Writer` but you want a string |

## Gotchas

**Symptom:** an endpoint that renders a large report takes seconds of CPU with no I/O wait
**Cause:** `+=` accumulation in a loop — quadratic copying; invisible at test sizes, dominant at production sizes
**Fix:** `Collectors.joining` / `String.join`, or a `StringBuilder` with a capacity hint. This is the single most common string performance bug in review

**Symptom:** hand-rolled `StringBuilder` chains replacing every readable single-expression `+` "for performance"
**Cause:** advice from the pre-9 era, cargo-culted past JEP 280
**Fix:** single-expression `+` compiles to one optimized indy call — keep the readable form; reserve `StringBuilder` for cross-statement accumulation

**Symptom:** `IllegalFormatConversionException` in production from a log-adjacent code path
**Cause:** format string and arguments drifted apart in a refactor — the compiler never checks them
**Fix:** keep format calls close to their arguments, cover them with a test that actually executes the formatting, and prefer SLF4J `{}` placeholders in logging (checked by structure, lazy, and locale-free)

**Symptom:** numbers in a generated CSV render with commas as decimal separators on one server
**Cause:** `String.format` used the JVM's default locale, which differed between environments
**Fix:** `Locale.ROOT` for every machine-readable format call; default-locale formatting is only for text shown to a human in that locale

**Symptom:** `sb.append(a + b + c)` inside the hot loop that already uses a StringBuilder
**Cause:** the inner `+` builds a temporary string per iteration, then appends it — the temporary defeats the point
**Fix:** chain the appends: `sb.append(a).append(b).append(c)`

**Symptom:** thousands of tiny `StringBuilder` grow-and-copy cycles in an allocation profile
**Cause:** default 16-char capacity, output much larger — every overflow doubles and copies
**Fix:** pass an estimated capacity to the constructor when the final size is roughly known; exactness is not required, order of magnitude is

## Interview questions

**★ Is string concatenation with `+` slow?**
As a single expression, no — since JEP 280 (Java 9) the whole expression
compiles to one `invokedynamic` call that assembles the result optimally.
As accumulation across loop iterations, yes — each pass copies everything
built so far, O(n²) total. The question is not "is `+` slow" but "is this
`+` inside a loop".

**★ When do you reach for `StringBuilder`, and what do `String.join`/`Collectors.joining` change?**
`StringBuilder` for genuine incremental building across statements or
iterations. But most "build a string in a loop" cases are joins in disguise,
and `String.join` / `Collectors.joining` say so directly — shorter, linear,
and separator-correct at the edges (no trailing-delimiter trimming).

**★ Why does `String.format` throw at run time for a wrong argument type, and what follows for logging?**
Format strings are data, not checked syntax — the compiler cannot verify
`%d` against its argument. In logging, eager `format`/`+` also pays the cost
even when the level is off; SLF4J's `{}` placeholders defer formatting until
a logger actually emits. Format for *output*, placeholders for *logs*.

**★ What is `StringBuffer` and when do you choose it?**
`StringBuilder`'s older synchronized twin. Effectively never: per-method
synchronization doesn't make multi-step building atomic anyway, and sharing
a half-built string between threads is a design error. It survives in old
APIs; new code uses `StringBuilder`.

**Why does `String.format` behave differently across servers, and what's the fix?**
It consults the default locale — decimal separators, digit grouping and even
digits differ by locale, and the default is a host setting (Phase 0's WORA
leak). Pin `Locale.ROOT` for machine-readable text; use explicit locales for
human-facing text.

**What does `"" + x` do, and what should you write instead?**
Null-safe stringification via the concatenation machinery — it works, but it
reads as an accident. `String.valueOf(x)` states the intent and compiles to
the same semantics (including rendering null as `"null"` — decide whether
that is what you actually want at a boundary).

---

← Prev: [Immutability, the pool and equality](01-immutability-pool-equality.md) · Next → [The API worth knowing](03-the-api-worth-knowing.md)
