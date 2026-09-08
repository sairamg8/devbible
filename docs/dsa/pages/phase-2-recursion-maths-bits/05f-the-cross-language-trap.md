---
title: "The same algorithm does not break at the same magnitude in Java and JavaScript — an int sum that wraps at 2^31 is exact in a JavaScript number, a long algorithm has no JavaScript primitive at all, and a bit trick ported either way reintroduces a 32-bit limit that was not there before"
sidebar_label: "05f · The cross-language trap"
sidebar_position: 5.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. The four thresholds in the table are quoted or derived from primary sources
> already named in this topic: JDK 25
> [`Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)
> for *"2^31-1"* and *"-2^31"*; MDN
> [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)
> for the safe-integer range; MDN
> [Bitwise AND](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_AND)
> for the 32-bit coercion of bitwise operands; MDN
> [`BigInt`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)
> for *"Only use a BigInt value when values greater than 2^53 are reasonably expected."* ⚠️ The
> `long` range (−2^63 to 2^63 − 1) is stated as the **definition** of a 64-bit two's-complement
> type; no `Long` javadoc was fetched for this page. **No sandbox run.** Version spine: **JDK 25 ·
> MDN as fetched 2026-09-07**.

**A senior engineer working in both languages needs one table memorised, because porting an
algorithm moves the point at which it breaks — sometimes further away, sometimes closer, and
occasionally to a place that did not exist in the original.** Java overflows at 2^31 for an `int`
and 2^63 for a `long`, wrapping silently. JavaScript is exact to 2^53 and rounds silently past it —
except inside a bitwise operator, where it drops to 32 bits with no warning at all. The
consequences are not symmetric: a Java `int` bug can be silently *fixed* by a port, a Java `long`
algorithm has no JavaScript primitive to land in, and a Java bit trick acquires a new overflow it
never had. This page is that table and the three consequences, and it closes the topic by asking
what happens when two services in the two languages must agree on the same number.

## The table

| Type | Exact integers up to | Failure mode past it |
|---|---|---|
| Java `int` | 2^31 − 1 | wraps to a negative value, silently |
| JavaScript `number` | 2^53 − 1 | rounds to the nearest representable double, silently |
| Java `long` | 2^63 − 1 | wraps, silently |
| JavaScript `number`, **after any bitwise operator** | 2^31 − 1 | truncated to 32 signed bits, silently |
| `BigInt` / `BigInteger` | unbounded | none — memory only |

Every row says *silently*. That is the point of the table: none of these failures is announced, so
the only defence is knowing where the line is for the type you are currently holding.

## Consequence 1 — a port can silently fix a bug, which is worse than it sounds

An `int` accumulator that wraps in Java is exact in JavaScript up to 2^53, so the same code
translated line for line stops overflowing. That feels like good news and is not: **the two systems
now disagree**, and neither of them says so. If the Java number was ever persisted — a cached total,
a stored checksum, a reconciled figure — the JavaScript service now produces values that do not
match history, and the difference appears only on the large inputs nobody tests with.

The right move on discovering this is not to reproduce the Java behaviour in JavaScript. It is to
recognise the Java side as broken, fix it with `long` or `Math.addExact`
([05c](05c-javas-int-and-the-checked-arithmetic.md)), and make both sides agree deliberately. The
exception is when the wrap was *specified* rather than accidental — a hash — in which case the
JavaScript side must reproduce it, and [05e](05e-overflow-on-purpose.md) is how.

## Consequence 2 — a Java `long` algorithm has no JavaScript primitive

This is the one with no easy answer. A `long` is exact to 2^63 − 1; a JavaScript number is exact to
2^53 − 1. **There are ten bits of Java `long` range with nowhere to go.** Any algorithm whose
intermediates were sized for a `long` — the modular multiply of
[05d](05d-the-three-silent-overflows.md), a 64-bit hash, a nanosecond duration arithmetic, a
snowflake id decomposition — cannot be ported by translating the arithmetic. It has to become
`BigInt`, or be restructured so no intermediate exceeds 2^53.

```java
// Java: correct, because the intermediate is about 10^18 and a long holds 9.2 x 10^18
static long mulmod(long a, long b, long mod) { return ((a % mod) * (b % mod)) % mod; }
```

```ts
// TypeScript: the literal translation is WRONG — the product is ~10^18, past 2^53
// export const mulmodBroken = (a: number, b: number, mod: number) => ((a % mod) * (b % mod)) % mod;

// the port has to change type, not just syntax
export const mulmod = (a: bigint, b: bigint, mod: bigint): bigint =>
  ((a % mod) * (b % mod)) % mod;
```

MDN's own rule is the justification to give: *"Only use a BigInt value when values greater than 2^53
are reasonably expected."* A `long`-sized intermediate is exactly such a case.

## Consequence 3 — a bit trick acquires a 32-bit limit it never had

Porting in the other direction is the trap people fall into most often, because the code looks
identical and the language is the one with *more* range. `(lo + hi) >>> 1` and `(lo + hi) >> 1` are
Java idioms whose operands are already 32-bit. Written in JavaScript, the arithmetic that produced
`lo + hi` was safe to 2^53 and the operator throws that away: *"Numbers with more than 32 bits get
their most significant bits discarded."* A midpoint over a value space in cents or milliseconds
crosses 2^31 easily, and the search silently starts computing negative midpoints
([05d](05d-the-three-silent-overflows.md)).

The same applies to every mask wider than 31 elements
([04g](04g-the-32-bit-ceiling-and-what-to-use-instead.md)), to `x & -x` on a large value
([04c](04c-clearing-and-isolating-the-lowest-bit.md)), and to an XOR swap of two values above 2^31
([04e](04e-xor-and-the-problems-it-solves.md)). **The rule to carry across: in JavaScript a bitwise
operator is a narrowing conversion, and there is no syntax that marks it as one.**

## The storefront case: two services, one number

The Node BFF computes a fingerprint of a cart so the browser can detect changes; the Java pricing
service computes a fingerprint of the same cart to key its own cache. If the two are meant to be the
same value — a shared cache key, a shard selector, an ETag — then **they are the same specification
and must be implemented as such**: the same field ordering, the same string encoding, the same base,
and the same explicit 32-bit truncation on the JavaScript side. Written naively, the Java side wraps
and the Node side rounds, the two never agree, and the symptom is a cache that misses on every
request while both services believe they are correct — no error, no log line, only a hit rate that
was never checked.

The safer architecture, and the one to propose: **do not compute the same number in two languages.**
Compute it once, on one side, and pass it. Where it genuinely must be computed independently, use a
digest with a cross-language written specification rather than a language's `hashCode`, and pin the
canonical serialisation of the input — because the second half of this bug is never the arithmetic,
it is that the two sides serialised the cart's fields in a different order.

## Gotchas

**★ Symptom: a hash computed in Java and recomputed in Node never matches.** Cause: Java's is
specified *"using `int` arithmetic"* and wraps at 32 bits; JavaScript's accumulator grows as a
double and eventually rounds. Fix: force the truncation every iteration —
`h = (h * 31 + code) | 0` — and accept that the result may be negative, because Java's is too
([05e](05e-overflow-on-purpose.md)).

**★ Symptom: a port from Java to JavaScript quietly produced *different* — and more correct —
results.** Cause: the Java version was overflowing an `int` and the JavaScript version, having 2^53
of headroom, was not. Fix: this is a bug on the Java side that had been masquerading as a
specification. Decide which answer is right, fix Java with `long` or `Math.addExact`, and make both
sides agree on purpose — do not reproduce the wrap in JavaScript unless the wrap was specified.

**★ Symptom: a Java `long` routine translated to TypeScript gives wrong answers only for large
inputs.** Cause: the intermediates were sized for 2^63 and a JavaScript number is exact only to
2^53, so the translation silently lost the top ten bits of headroom. Fix: the port is a **type**
change, not a syntax change — `BigInt`, or a restructuring that keeps every intermediate under 2^53.

**★ Symptom: a shared cache key or shard assignment misses on every request.** Cause: two
implementations of "the same" hash in two languages, differing either in the wrap or in the field
serialisation order. Fix: compute it once and pass it; if it must be computed twice, write the
specification down — encoding, field order, base, truncation — and test the two implementations
against the same fixture vectors.

**Symptom: `Number(row.bigIntColumn)` looked fine in development and broke in production.** Cause:
the development data had small ids. The column's range is 64-bit by definition, so the conversion is
lossy above 2^53 whether or not today's values reach it ([05](05-integer-limits-and-overflow.md)).
Fix: keep the value a string end to end, or a `BigInt` if it needs arithmetic.

**Symptom: a test suite passes in one language's implementation and fails in the other, on the same
inputs.** Cause: the fixtures were generated on one side, so they encode that language's overflow
behaviour as the expected answer. Fix: derive expected values from the specification rather than
from a run of either implementation, and include at least one fixture past 2^31 and one past 2^53 —
those are the only inputs that can distinguish the two.

**Symptom: an algorithm's complexity analysis was carried across but its arithmetic was not.** Cause:
the port focused on the loop structure. Fix: read the port for *magnitudes* separately from
structure — every multiply, every sum over an unbounded input, every shift — because the loop is
what translates cleanly and the arithmetic is what does not.

## Interview questions

**★ Where does the same algorithm break in each language?**
At four different places, and knowing which one applies is the actual skill. A Java `int` is exact
to 2^31 − 1 and wraps past it. A JavaScript number is exact to 2^53 − 1 and rounds past it. A Java
`long` is exact to 2^63 − 1 and wraps. And a JavaScript number *after any bitwise operator* drops
back to 32 bits, because the operands are converted before the operation. So the same code can be
correct in one language and wrong in the other in both directions: an `int` sum that overflows in
Java is fine in JavaScript, and a `>> 1` midpoint that is fine in Java overflows in JavaScript. The
escape hatch is `long` first and then `BigInteger` in Java, and `BigInt` in TypeScript, with MDN's
own rule for when to reach for it — *"Only use a BigInt value when values greater than 2^53 are
reasonably expected."*

**★ Why did the same hash produce different values in our Node BFF and our Java service?**
Because the wrap is part of the Java definition and JavaScript does not have it. Java's accumulator
is an `int` and reduces modulo 2^32 at every multiply; JavaScript's is a double that stays exact
until 2^53 and then rounds to the nearest representable value, so the two sequences diverge at the
first character that pushes the accumulator past the `int` range. The fix is `| 0` on every
iteration in the JavaScript version. The better fix is architectural: do not compute the same hash
in two languages — compute it once and pass it, or use a digest with a cross-language specification
instead of a language's `hashCode`. And check the serialisation before checking the arithmetic; the
field order is the other half of this bug.

**★ You are porting a Java routine that uses `long` arithmetic. What is your first question?**
Whether any intermediate exceeds 2^53, because that is the boundary the target language cannot
cross. A `long` gives 2^63 − 1 and a JavaScript number gives exactness only to 2^53 − 1, so a
translation that keeps the arithmetic in `number` silently loses the top of the range. If the
intermediates do exceed it — a modular multiply against a modulus near 10^9 produces about 10^18, so
it does — then the port is a type change to `BigInt`, not a transliteration. The alternative is a
restructuring that never builds the large intermediate, which is the same manoeuvre as the midpoint
rewrite in [05d](05d-the-three-silent-overflows.md) and is preferable when it exists.

**★ How do you make two services in different languages agree on a computed number?**
Treat it as a specification rather than as code. Write down the input serialisation — field order,
encoding, separator, null handling — because that is where these disagreements usually start, before
any arithmetic. Then write down the arithmetic explicitly, including the width: "32-bit wrapping
multiply by 31" rather than "the language's string hash". Test both implementations against the same
fixture vectors, derived from the specification and not from a run of either side, and include
inputs past 2^31 and past 2^53 so the fixtures can actually distinguish the implementations. And ask
first whether the number needs computing twice at all — passing it is cheaper than agreeing on it.

**Why is "the port is more correct now" not automatically good news?**
Because correctness of a single computation is not the property that matters when two systems share
data. If the Java service has been writing wrapped totals to a table for a year and the new Node
service computes unwrapped ones, every comparison across that boundary is now wrong, and the
divergence is invisible on small inputs. The engineering answer is to treat it as a discovered
defect with a migration attached: fix the Java arithmetic, decide what happens to the existing
values, and make the two agree explicitly — rather than letting one side quietly become right.

{/* FOOTER */}
