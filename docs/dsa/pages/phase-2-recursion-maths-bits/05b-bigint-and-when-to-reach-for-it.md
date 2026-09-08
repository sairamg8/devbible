---
title: "BigInt removes the 2^53 limit and adds four hard edges in exchange — it cannot be mixed with Number in any operation, it has no Math, its division truncates towards zero, and a BigInt is never strictly equal to the Number that looks like it"
sidebar_label: "05b · BigInt, and when to reach for it"
sidebar_position: 5.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. Every rule below is quoted verbatim from MDN,
> [`BigInt`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)
> — the no-mixing rule, the absence of `Math`, the truncating division with its documented `4n / 2n`
> and `5n / 2n` results, the `0n === 0` / `0n == 0` pair, and MDN's own guidance on when to use it.
> The `TypeError` on mixing a BigInt and a number in a *bitwise* operator is
> [Bitwise AND](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_AND).
> ⚠️ **MDN makes no performance claim about BigInt, and neither does this page** — the cost is
> stated as mechanism (arbitrary precision is not a register operation) and never as a figure.
> ⚠️ Serialisation behaviour was **not** verified and is therefore written as a design instruction
> rather than an assertion about `JSON.stringify`. **No sandbox run.** Version spine: **JDK 25 · MDN
> as fetched 2026-09-07**.

**`BigInt` is the correct answer to "my integers are bigger than 2^53" and the wrong answer to "I
would like my integers to be safer", and the difference is that it is a separate type rather than a
wider number.** Nothing promotes into it and nothing promotes out of it. Every literal in an
expression must carry the `n` suffix, every `Math` call has to be replaced, every division has to be
re-examined because it truncates, and every equality has to be re-checked because a BigInt is not
strictly equal to the Number that prints the same. Those are not bugs; they are the price of exact
arbitrary precision, and MDN says so plainly. This page is that price in full, and the decision rule
for paying it. The range problem it solves is in [05](05-integer-limits-and-overflow.md); using
BigInt for wide *bitmasks* is in
[04g](04g-the-32-bit-ceiling-and-what-to-use-instead.md).

## The four rules, quoted

**It does not mix with Number.**

> *"A BigInt value cannot be used with methods in the built-in `Math` object and cannot be mixed with a Number value in operations; they must be coerced to the same type."*

and for the bitwise operators specifically:

> *"A `TypeError` is thrown if one operand becomes a BigInt but the other becomes a number."*

So `total + 1` is a `TypeError` when `total` is a BigInt; it has to be `total + 1n`. And there is no
`Math.max(a, b)`, no `Math.abs`, no `Math.floor` — those methods take numbers.

**Division truncates.**

> *"Division (`/`) truncates fractional components towards zero, since BigInt is unable to represent fractional quantities."*

MDN's own documented results: `4n / 2n` is `2n`, and `5n / 2n` is `2n`, **not** `2.5n`. There is no
fractional BigInt to be had, so the language does not round, it discards. 🔴 Note the direction:
*towards zero*, which is truncation and not flooring — for a negative dividend the two differ, and
any code that relied on `Math.floor` semantics changes behaviour on negatives when it moves to
BigInt. The remainder operator is the one consistent with that truncation, so it carries the sign of
the dividend; that is the derived consequence of the quoted rule, not a separate quote.

**A BigInt is not strictly equal to a Number.**

> *"A BigInt value is not strictly equal to a Number value, but it is loosely so:"*

MDN's documented pair: `0n === 0` is `false`, and `0n == 0` is `true`. Relational comparisons (`<`,
`>`) do work across the two types; strict equality does not.

**And MDN's own decision rule:**

> *"Only use a BigInt value when values greater than 2^53 are reasonably expected."*

That sentence is the one to quote in an interview, because it converts an aesthetic argument into a
documented threshold.

## What that means in code

```ts
const a = 9007199254740993n;      // exact — every digit survives, unlike the same literal as a Number
const b = BigInt('9007199254740993');  // from a string: exact for any number of digits
const c = BigInt(42);             // from a safe integer: fine

// 🔴 the four things that change
// a + 1        → TypeError, mixing BigInt and Number
const next = a + 1n;              // correct

// Math.max(a, b) → TypeError, Math takes numbers
const larger = a > b ? a : b;     // write the comparison yourself

// 5n / 2n is 2n — there is no fractional BigInt, and it truncates towards zero
const halfDown = (a + b) / 2n;    // an "average" that is not an average for odd sums

// a === 9007199254740993 is false; a == 9007199254740993 is true but the Number is already rounded
const sameValue = a === b;        // compare BigInt against BigInt only
```

**Sorting needs a written comparator.** The idiomatic `(a, b) => a - b` produces a BigInt, and a
comparator is supposed to yield a number — so write the three-way form, which is correct in every
engine and every type:

```ts
const byValue = (x: bigint, y: bigint): number => (x < y ? -1 : x > y ? 1 : 0);
```

**Converting back out is explicit and asymmetric.** `String(big)` is exact for any magnitude;
`Number(big)` is exact only inside the safe range and rounds silently outside it
([05](05-integer-limits-and-overflow.md)). So a BigInt that came from a 64-bit identifier should
become a *string* when it leaves the program, never a number.

⚠️ **Decide the wire format explicitly.** Serialising a BigInt is not something to leave to whatever
your serialiser does by default — this page did not verify that behaviour, and you should not have
to know it. Convert to a string at the boundary, on purpose, in the mapping layer that already
exists:

```ts
export const toWire = (o: { id: bigint; totalCents: number }) => ({
  id: o.id.toString(),     // explicit, exact, and survives any JSON round trip
  totalCents: o.totalCents,
});
```

## What it costs, stated as mechanism

⚠️ **No number is available here and none is invented.** What can be said without measuring: a
`Number` is a machine word that the CPU adds in one operation; a BigInt is an arbitrary-precision
value, so its arithmetic is library code over a variable number of digits, with allocation, and its
cost grows with the size of the operands rather than being fixed. That is enough to justify the
engineering rule — reach for it where the range demands it, not as a default numeric type — and it
is the honest form of the answer. Anyone quoting you a ratio measured it on a machine that is not
yours.

The other cost is not runtime at all: **BigInt is contagious through a codebase.** Because nothing
promotes, one BigInt field means every literal that touches it grows an `n`, every helper that took
`number` needs an overload, every `Math` call needs replacing and every memo key needs re-checking.
That is usually the reason to keep the BigInt confined to a narrow layer — parse it, use it, convert
it to a string — rather than letting it spread through the domain model.

## When to reach for it, and what to reach for instead

| Situation | Reach for |
|---|---|
| A 64-bit id you only ever store, compare and pass on | a **string** — no arithmetic, no type contagion |
| A 64-bit id you must do arithmetic on (cursor pagination, sharding) | `BigInt`, converted at the boundary |
| Money in minor units, quantities, counts | a plain `number` — nowhere near 2^53 ([05](05-integer-limits-and-overflow.md)) |
| A hash or checksum wider than 32 bits | `BigInt`, or split into 32-bit words |
| A bitmask over more than 32 elements | `BigInt`, or a `Uint32Array` ([04g](04g-the-32-bit-ceiling-and-what-to-use-instead.md)) |
| Exact decimal money with fractions | neither — integer minor units, or a decimal library |

The storefront case where it is genuinely right: a **cursor** for keyset pagination built from a
`bigserial` id, where the API needs `WHERE id > $cursor` and the client sends the cursor back. The
cursor is arithmetic-adjacent — you compare it, you may increment it — and it is 64-bit by column
definition. Parse it with `BigInt(req.query.cursor)`, compare it as a BigInt, and send it back out
with `.toString()`. Everything in between stays a string.

Java's counterpart for this whole discussion is `BigInteger` for arbitrary precision, with `long`
covering everything up to 2^63 first — [05c](05c-javas-int-and-the-checked-arithmetic.md). This page
asserts nothing about `BigInteger`'s API; its javadoc was not consulted.

## Gotchas

**★ Symptom: `TypeError: Cannot mix BigInt and other types`.** Cause: exactly what MDN says —
*"cannot be mixed with a Number value in operations"* — usually a bare `1` or `0` literal that
should have been `1n` or `0n`. Fix: suffix every literal in the expression, and convert incoming
numbers explicitly with `BigInt(i)`. There is no implicit promotion in either direction, so the
conversion has to be written somewhere; put it in a helper rather than at every call site.

**★ Symptom: `Math.abs` / `Math.max` / `Math.floor` throws on a value that used to work.** Cause:
*"A BigInt value cannot be used with methods in the built-in `Math` object."* Fix: write the
operation with operators — `x < 0n ? -x : x` for absolute value, `a > b ? a : b` for a maximum. The
division-based ones need more thought, because BigInt division already truncates.

**★ Symptom: an average computed in BigInt is one less than expected for odd totals.** Cause:
*"Division (`/`) truncates fractional components towards zero"* — `5n / 2n` is `2n`. Fix: decide
what you meant. For a true average, convert to `Number` when the magnitudes allow it; for a floor,
handle the negative case yourself, because truncation towards zero is not flooring; for exactness,
keep the numerator and denominator separately and divide only at display.

**★ Symptom: a lookup by id misses even though the id "is the same".** Cause: `0n === 0` is `false`
— a BigInt is never strictly equal to a Number — so a `Map` keyed by numbers cannot be found with a
BigInt key, and `Array.prototype.includes` and `indexOf` fail for the same reason. Fix: pick one key
type and convert at the boundary; `String(id)` is the safest key because it is exact for both.

**★ Symptom: `arr.sort((a, b) => a - b)` behaves oddly on BigInts.** Cause: the subtraction yields a
BigInt, not the number a comparator is expected to return. Fix: the three-way comparator,
`(x, y) => (x < y ? -1 : x > y ? 1 : 0)` — correct for BigInts, numbers, dates and strings alike.

**Symptom: a value that was exact as a BigInt is wrong once it reaches the client.** Cause: it was
converted to a Number somewhere — a `Number(...)`, an arithmetic operation with a number that
happened not to throw because both sides were converted first, or an implicit conversion in a
template. Fix: convert to a **string** at the boundary, deliberately, in the mapping layer; and keep
the field typed as `string` in the wire DTO so the compiler enforces it.

**Symptom: `BigInt(someFloat)` is rejected or gives a value you did not intend.** Cause: BigInt has
no fractional representation at all, so a value with a fractional part has no BigInt to convert to.
Fix: decide the rounding yourself before converting — `BigInt(Math.round(x))` — and note that if `x`
was already above 2^53 the rounding you care about happened long before this line.

**Symptom: introducing one BigInt field turns into a large diff across unrelated files.** Cause: the
type does not promote, so it propagates to every expression it touches. Fix: confine it — parse at
the edge, use it in the narrow place that needs the range, convert to a string on the way out. If
the BigInt is reaching your domain model, ask whether the field ever needs arithmetic at all; if
not, it should have been a string.

## Interview questions

**★ When would you use `BigInt`, and when would you not?**
MDN's own rule is the one to quote: *"Only use a BigInt value when values greater than 2^53 are
reasonably expected."* So: yes for 64-bit identifiers you must do arithmetic on, hashes and
checksums wider than 32 bits, bitmasks over more than 32 elements, and any exact integer arithmetic
whose intermediates leave the safe range. No for money in minor units, quantities and counts, which
are nowhere near the limit — and no for an id you only store, compare and pass on, which should be a
string, because a string has the exactness without the type contagion.

**★ What actually changes in the code when you switch a field from `number` to `bigint`?**
Four things, all mechanical and all from the documentation. Literals: nothing promotes, so every `1`
becomes `1n` or the expression throws a `TypeError`. `Math`: unavailable, so `abs`, `max`, `min` and
`floor` become operator expressions. Division: it *"truncates fractional components towards zero"*,
so `5n / 2n` is `2n` and every average, rate or percentage has to be re-derived — and note it
truncates rather than floors, which changes behaviour on negatives. Equality: a BigInt is not
strictly equal to a Number, so `Map` keys, `includes`, `indexOf` and any `===` against a numeric
literal all need revisiting. The fifth, non-mechanical change is that the type spreads through
whatever it touches, which is the real cost.

**★ Is `BigInt` slow?**
I would not give you a figure, because I have not measured one and MDN does not state one. What is
true by construction is that a `Number` is a machine word the CPU operates on in a single
instruction, while a BigInt is an arbitrary-precision value whose arithmetic is library work over a
variable number of digits, with allocation, and whose cost grows with the operands' size. That is
enough to justify treating it as a targeted tool rather than a default numeric type. If a specific
hot path mattered, the answer would be a benchmark on the actual workload, not a remembered ratio.

**★ Why does `5n / 2n` give `2n`, and where does that bite?**
Because *"BigInt is unable to represent fractional quantities"*, so division *"truncates fractional
components towards zero"* — there is no `2.5n` for it to return. It bites anywhere a formula assumed
real division: averages, midpoints, rates, percentages and unit conversions. The subtle part is
*towards zero* rather than *down*: for negative values truncation and flooring differ by one, so a
midpoint or a bucket index that was written with `Math.floor` semantics changes behaviour when it
moves to BigInt. Either keep numerator and denominator apart and divide once at the end, or convert
to `Number` at a point where you have proven the magnitudes are safe.

**Would you send a `bigint` id to the browser as a BigInt or a string?**
A string, always. JSON has no BigInt, so the value has to be represented somehow, and a string is
exact for any magnitude and needs no special handling on either side. Sending it as a JSON number is
the bug: the parser produces a Number and the rounding happens before any of the client's code runs
([05](05-integer-limits-and-overflow.md)). A string also keeps the client from doing arithmetic on
an id by accident, which is a feature — identifiers are opaque, and typing them as strings says so.

---

← Prev: [05 · Integer limits and overflow](05-integer-limits-and-overflow.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [05c · Java's int, and the checked arithmetic](05c-javas-int-and-the-checked-arithmetic.md)
