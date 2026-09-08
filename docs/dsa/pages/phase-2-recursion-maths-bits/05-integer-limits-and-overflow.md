---
title: "A JavaScript number is a double with 52 stored mantissa bits, so integers stop being exact at 2^53 — and the failure is silent: no exception, no NaN, just an addition that returns a value equal to a different addition's result"
sidebar_label: "05 · Integer limits and overflow"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. Every claim about the safe-integer range is quoted verbatim from MDN,
> [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER),
> including the documented `MAX_SAFE_INTEGER + 1 === MAX_SAFE_INTEGER + 2` example. The spacing of
> representable integers above 2^53 is **arithmetic derived** from the quoted mantissa width, not
> cited. ⚠️ `Number.isSafeInteger`'s behaviour is described from the definition of "safe integer"
> quoted here; its own reference page was not fetched, so nothing beyond that definition is
> asserted. **No sandbox run** — this page shows no evaluated expression that MDN did not print
> itself. Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**Every language has an integer limit; JavaScript's is unusual in that crossing it produces neither
an error nor a wrapped value, but an answer that is quietly close to right.** A Java `int` that
overflows wraps to a negative number, which is wrong in a way that shows up. A JavaScript number
that leaves the safe range starts rounding to the nearest representable double, so a total that
should end in `…993` ends in `…992`, an id that should be unique collides with its neighbour, and a
counter that adds one stops moving. Nothing throws. The value is still a finite number and still
compares, prints and serialises. This is the failure mode you have to be able to recognise from a
symptom rather than a stack trace, and the whole of it comes from one sentence about the mantissa.

This page is the JavaScript number and the safe-integer range.
[05b](05b-bigint-and-when-to-reach-for-it.md) is `BigInt` in full.
[05c](05c-javas-int-and-the-checked-arithmetic.md) is Java's silent wrap and the `Exact` methods.
[05d](05d-the-three-silent-overflows.md) is the three overflows every interviewer probes, the
binary-search midpoint among them. [05e](05e-overflow-on-purpose.md) is overflow used deliberately,
and [05f](05f-the-cross-language-trap.md) is where the two languages disagree about when the same
algorithm breaks.

## What a JavaScript number actually is

There is one numeric type for ordinary arithmetic, and it is an IEEE-754 double. MDN states the
consequence directly:

> *"Double precision floating point format only has 52 bits to represent the mantissa, so it can only safely represent integers between -(2^53 – 1) and 2^53 – 1. 'Safe' in this context refers to the ability to represent integers exactly and to compare them correctly."*

Two words in that sentence carry the whole page. **Exactly** — every integer in the range has its
own representation, and no two of them share one. **Correctly** — because they are distinct, `===`
on them means what you think it means. Above the range, both properties fail together.

> *"The `Number.MAX_SAFE_INTEGER` static data property represents the maximum safe integer in JavaScript (2^53 – 1)."*

> Value: *"9007199254740991 (9,007,199,254,740,991, or ~9 quadrillion)."*

**What happens above it is spacing, not truncation.** With a fixed number of mantissa bits, the gap
between consecutive representable values doubles each time the exponent increases: below 2^53 every
integer is representable, between 2^53 and 2^54 only the even ones are, between 2^54 and 2^55 only
multiples of four, and so on. An arithmetic result that is not representable is rounded to the
nearest value that is. That is why MDN's own example holds:

> *"For example, `Number.MAX_SAFE_INTEGER + 1 === Number.MAX_SAFE_INTEGER + 2` will evaluate to true, which is mathematically incorrect."*

🔴 **Read that as the definition of the failure mode.** Two additions with different operands
produced values that compare equal. There was no exception, no `NaN`, no `Infinity` and no warning —
just an equality that is false in mathematics and true in the program. A test asserting
`a + 1 !== a + 2` is the kind of test nobody writes.

The immediate corollary is that **a counter stops counting**: once a value reaches 2^53, adding one
rounds back to where it started, so `while (i < limit) i++` becomes an infinite loop and an
id-allocation loop starts handing out duplicates. And `Number.MAX_VALUE` is no comfort — the format
represents *magnitudes* far beyond 2^53; what it stops doing is representing every *integer* among
them. "Large enough" and "exact" are different questions and only the second one matters here.

MDN's own advice at the end of the same page:

> *"For larger integers, consider using `BigInt`."*

That is [05b](05b-bigint-and-when-to-reach-for-it.md).

## The guard: `Number.isSafeInteger`

The predicate exists precisely for this range: it is true when a value is a number, is an integer,
and lies within the safe range quoted above — the three conditions the definition names. Use it at
the boundary of your system, not in the middle of an algorithm:

```ts
// a boundary check on a value arriving from outside — a request body, a queue message, a driver
export function requireSafeInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(`${field} is not a safe integer: ${String(value)}`);
  }
  return value;
}
```

🔴 **Guarding the inputs and the output is not the same as guarding the computation.** A product of
two safe integers can be unsafe even when the final result, after a division, is safe again —
`(a * b) / c` can lose digits in the multiply and still return something plausible. If an
intermediate can exceed the range, the check has to be on the intermediate, or the arithmetic has to
move to `BigInt`. This is the same structural bug as Java's silent `int` overflow in a running
product ([05d](05d-the-three-silent-overflows.md)); only the threshold differs.

## Where these values actually come from

Not from arithmetic you wrote. They arrive at the edges of the system, already too large, and the
rounding has usually happened before your code runs.

**Database `bigint` columns.** A Postgres `bigint` is 64-bit, so its range reaches far past 2^53. A
`bigserial` primary key is fine for a very long time — but the ceiling is a property of the column,
not of the current data, and an application that hands the value to JavaScript has already accepted
the risk. Drivers differ in what they do about it: some return `int8` as a **string** precisely
because of this, others as a number. ⚠️ Confirm what yours does rather than assuming; that is one
query and it is not a thing to guess at.

**JSON on the wire.** JSON has no integer type distinct from its number type, so a parser producing
JavaScript numbers has already rounded a large integer literal before your code sees it — the
original digits are gone by the time you could check them. That is why large identifiers are
transported as **strings** in every API that has been bitten by this: `"id": "9007199254740993"`
survives a round trip and `"id": 9007199254740993` does not.

**Externally-generated ids.** Snowflake-style 64-bit ids, hash values and distributed sequence
numbers are all designed to use the full 64 bits, so they are outside the safe range by
construction, not by accident.

**Nanosecond timestamps.** A nanosecond-resolution epoch timestamp is on the order of 1.7 × 10^18,
against a safe ceiling of about 9.0 × 10^15 — three orders of magnitude beyond it, by arithmetic. A
microsecond timestamp is about 1.7 × 10^15 and fits, for now. Any API that hands you nanoseconds
cannot be handing you a plain number without loss.

### The storefront, honestly

The PERN storefront's numbers divide into two piles, and the useful skill is knowing which pile a
value is in rather than fearing all arithmetic.

**Safe, and provably so.** Money held in integer cents. An order of £10,000 is 1,000,000 cents;
lifetime revenue across a decade at that rate is still many orders of magnitude below 9 × 10^15.
Quantities, inventory counts, review scores, cart line counts — all far below. Keeping money in
cents rather than in a float is the right decision, and it is right for a *different* reason than
this page: decimal fractions like 0.1 have no exact binary representation, so a running total of
float pounds drifts from the decimal answer regardless of magnitude. Integer cents removes that
question entirely and stays comfortably inside the safe range.

**Not safe, and it is always the identifiers.** `orders.id` as `bigserial`, an external payment
provider's transaction reference, a Kafka offset, an idempotency key derived from a 64-bit hash.
These are the values to keep as strings from the database driver all the way to the browser, and to
never `Number(...)`:

```ts
// the shape that survives: the id is a string end to end, and arithmetic never touches it
export interface OrderRow {
  id: string;                 // bigserial — a string from the driver, never Number(row.id)
  totalCents: number;         // safe: integer cents, orders of magnitude below 2^53
  itemCount: number;          // safe
}

// and the boundary check that makes the second field's safety an assertion rather than a hope
export const toOrderRow = (r: { id: string; total_cents: number; item_count: number }): OrderRow => ({
  id: r.id,
  totalCents: requireSafeInteger(r.total_cents, 'total_cents'),
  itemCount: requireSafeInteger(r.item_count, 'item_count'),
});
```

## Gotchas

**★ Symptom: two different sums compare equal.** Cause: both results landed above the safe range and
rounded to the same representable double — MDN documents exactly this with
*"`Number.MAX_SAFE_INTEGER + 1 === Number.MAX_SAFE_INTEGER + 2` will evaluate to true, which is
mathematically incorrect."* Fix: keep the values inside the safe range, or move the arithmetic to
`BigInt`. There is no flag that makes the addition complain.

**★ Symptom: a `bigint` id from the database matches the wrong row, or two rows appear to share an
id.** Cause: the value crossed 2^53 and was rounded to the nearest representable double when it was
converted to a number, so distinct ids collapsed onto one. Fix: read the column as a string —
confirm your driver's `int8` behaviour rather than assuming it — and keep it a string through the
API and the client. Never `Number(row.id)`.

**★ Symptom: an id is correct in the JSON payload and wrong in the parsed object.** Cause: the parse
did it. JSON's number type maps to a JavaScript number, so a large integer literal is rounded during
parsing and the original digits no longer exist in the program. Fix: serialise large identifiers as
JSON *strings*; the check has to be on the wire format, because by the time you hold the object it
is too late.

**★ Symptom: `while (i < limit) i++` never terminates.** Cause: `i` reached 2^53, where adding one
rounds back to the same value — the direct consequence of the documented `+ 1 === + 2` example. Fix:
bound the loop by a count rather than by a value, or use `BigInt` for the counter. The same
mechanism turns an id-allocation loop into a duplicate generator.

**★ Symptom: inputs are safe, the output is safe, and the answer is still wrong.** Cause: an
intermediate left the range — typically a multiplication before a division. Fix: check the
intermediate, restructure so the division happens first where that is exact, or compute in `BigInt`.
`Number.isSafeInteger` on the arguments proves nothing about the expression.

**Symptom: `parseInt` on a long numeric string silently returns a different number.** Cause: it
produces a number, so the same rounding applies at the moment of conversion. Fix: keep the string, or
parse with `BigInt(str)`, which is exact for any number of digits.

**Symptom: a value read back from the database does not equal the value written.** Cause: the write
path converted a string or `bigint` to a number somewhere — an ORM mapping, a JSON round trip, a
`Number()` in a validator. Fix: trace the type at every hop; the loss happens once, at the first
conversion, and every later hop faithfully carries the wrong value.

**Symptom: money totals drift by a penny.** Cause: this is *not* the safe-integer problem — it is
binary floating point applied to decimal fractions, which have no exact binary representation at any
magnitude. Fix: hold money in integer minor units (cents) and divide only for display. That also
puts the values comfortably inside the safe range, but the reason to do it is exactness, not range.

## Interview questions

**★ What is the largest integer JavaScript can handle?**
Two different questions hide in that one, and separating them is the answer. The largest *magnitude*
a number can hold is enormous — the double format goes to about 1.8 × 10^308. The largest integer it
can hold **exactly** is `Number.MAX_SAFE_INTEGER`, 2^53 − 1, which MDN puts at 9007199254740991,
because the format has only 52 mantissa bits and "safe" means *"the ability to represent integers
exactly and to compare them correctly."* Above that, the representable integers are spaced two
apart, then four, and results round to the nearest one — so arithmetic keeps producing plausible
finite numbers that are simply wrong.

**★ How does that failure announce itself?**
It does not. There is no exception, no `NaN`, no `Infinity`, no strict-mode error and no warning.
MDN's own example is the entire demonstration: `Number.MAX_SAFE_INTEGER + 1 === Number.MAX_SAFE_INTEGER + 2`
evaluates to true. Two different computations returned values that compare equal, and every
downstream consumer — a `Map` key, a database lookup, a JSON body — carries the wrong value onward
without complaint. That is why the discipline is to check at the boundary with
`Number.isSafeInteger`, and to keep values that are large *by design* — identifiers, hashes,
nanosecond timestamps — out of the number type entirely.

**★ Where do unsafe integers actually come from in a Node service?**
Almost never from arithmetic you wrote; from the edges. A `bigint` column read by a driver that
returns numbers rather than strings. A JSON payload whose large id literal was rounded during
parsing, before any of your code ran. An externally-generated 64-bit id — a Snowflake, a hash, a
Kafka offset — which uses the full width on purpose. A nanosecond timestamp, which is three orders
of magnitude past the safe ceiling by arithmetic. The common shape is that the value was already
too large when it arrived, so the fix is a type decision at the boundary — keep it a string, or a
`BigInt` — rather than a check in the middle.

**★ Is holding money in a JavaScript number safe?**
In integer cents, yes, and for a storefront it is not close: a million-pound order is 10^8 cents
against a safe ceiling of 9 × 10^15. But the reason to use integer cents is not range, it is
exactness — decimal fractions such as 0.1 have no finite binary representation, so a running total
of float pounds diverges from the decimal answer at any magnitude. Integer minor units make every
intermediate an exact integer and every comparison meaningful, and dividing by 100 happens once, at
the point of display. The values that genuinely threaten the safe range in the same system are the
identifiers, not the money.

**Why is `Number.isSafeInteger` on the inputs not enough?**
Because the range applies to every value the expression produces, not just to the ones you named. A
product of two safe integers can easily be unsafe, and if a division brings it back down, the final
answer looks perfectly reasonable while having lost digits in the middle. The check has to sit where
the largest intermediate is, or the computation has to move to `BigInt` — and a third option is to
restructure the expression so the largest intermediate never exists, which is the same manoeuvre as
`lo + (hi - lo) / 2` in [05d](05d-the-three-silent-overflows.md).

**Java's `int` overflows too. Why is that considered the easier problem?**
Because a wrapped `int` is loudly wrong. Adding two large positives gives a negative, an index goes
out of bounds, a length becomes negative, and the failure surfaces near where it happened. Rounding
in a double is quietly wrong: the result stays positive, stays plausible, stays in the right order of
magnitude, and differs from the truth in the last digits — the digits that identifiers and checksums
depend on. Java also gives you an opt-in that turns the wrap into an exception, `Math.addExact` and
its family ([05c](05c-javas-int-and-the-checked-arithmetic.md)); JavaScript has no equivalent for
the rounding, only the choice to use a different type.

---

← Prev: [04g · The 32-bit ceiling, and what to use instead](04g-the-32-bit-ceiling-and-what-to-use-instead.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [05b · BigInt, and when to reach for it](05b-bigint-and-when-to-reach-for-it.md)
