---
title: "BigDecimal, correctly"
sidebar_label: "2 · BigDecimal, correctly"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 `BigDecimal` API documentation
> (constructors, `equals`, `compareTo`, `divide`, `setScale`) and the
> `RoundingMode` API documentation.

**`BigDecimal` is exact decimal arithmetic: an arbitrary-precision integer
(`unscaledValue`) plus a decimal point position (`scale`). It does exactly
what you say — which is the feature and the problem, because three of the
things people say are not what they mean: constructing from a `double`,
comparing with `equals`, and dividing without a rounding policy.**

## Construction: the `String` rule

```java
new BigDecimal(0.1)       // 0.1000000000000000055511151231257827021181583404541015625
new BigDecimal("0.1")     // 0.1
BigDecimal.valueOf(0.1)   // 0.1  — via Double.toString
```

`new BigDecimal(double)` is *documented* to be exact: it converts the
double's actual binary value — including the representation error you came
here to escape. The rule:

- **From literals and text: the `String` constructor.** Config values, API
  payloads, database values arrive as text anyway — never let them pass
  through `double` on the way in.
- **From an existing `double`** (a measurement crossing into exact-land):
  `BigDecimal.valueOf(d)` — it round-trips through `Double.toString`, the
  shortest decimal that reads back as `d`, which is what a human meant.
- From `int`/`long`: `BigDecimal.valueOf(cents, 2)` — unscaled value plus
  scale, the natural bridge from minor-units storage.
- Constants: `BigDecimal.ZERO`, `ONE`, `TEN` — don't re-allocate them.

## Scale, and `equals` vs `compareTo`

`2.0` and `2.00` are different `BigDecimal` objects: same numeric value,
scales 1 and 2. The two comparison methods disagree about them **by
documented design**:

- **`equals`**: equal only if unscaled value *and scale* match —
  `2.0.equals(2.00)` is `false`. `hashCode` follows `equals`.
- **`compareTo`**: numeric comparison — `2.0.compareTo(2.00)` is `0`.

Consequences, all real:

- `HashSet<BigDecimal>` / `HashMap` keys: `2.0` and `2.00` are *different
  elements* — deduplication and lookups fracture on scale differences that
  came from different code paths (`"2.0"` from one API, `setScale(2)` from
  another).
- `TreeSet`/`TreeMap` use `compareTo` — the *same* values dedupe. Switching
  collection implementations changes the contents. (Phase 3's
  consistency-with-equals story; `BigDecimal` is the standard library's own
  documented example of an inconsistent natural order.)
- The working idioms: compare amounts with `compareTo(...) == 0` (or
  `signum()` against zero); for set/map membership, **normalize scale
  first** (`setScale(2, RoundingMode.UNNECESSARY)` at the boundary, or
  `stripTrailingZeros()` before hashing).

## Division and rounding: name your policy

Addition, subtraction and multiplication are always exact (scales add or
take the max). **Division is where exactness dies**: `1 / 3` has no finite
decimal, and `BigDecimal.divide(other)` with no rounding parameters throws
`ArithmeticException("Non-terminating decimal expansion")` — a bug that
hides until the divisor stops being a power of 2 or 5:

```java
total.divide(months)                                 // works for 2, 4, 5, 8… throws for 3
total.divide(months, 2, RoundingMode.HALF_EVEN)      // scale + policy: always works
```

Every division names a scale and a `RoundingMode`. The modes that matter:

| Mode | Behaviour | Use |
|---|---|---|
| `HALF_UP` | 0.5 away from zero — "schoolbook" | invoices, VAT — what most jurisdictions and humans expect |
| `HALF_EVEN` | 0.5 to the even neighbour — "banker's" | aggregation at volume: statistically unbiased over many roundings |
| `UP` / `DOWN`, `CEILING` / `FLOOR` | always away/toward zero; toward ±∞ | fee minimums, conservative bounds |
| `UNNECESSARY` | throw if rounding would occur | assertions: "this must already be exact" — great at boundaries |

The mode is a *business decision* (regulation often dictates it). Write it
once as a named constant next to the currency's scale, not inline at forty
call-sites. `setScale(2, mode)` applies the same policy outside division;
`stripTrailingZeros()` canonicalizes (careful: it turns `100` into `1E+2` —
`toPlainString()` for display).

Also real: `BigDecimal` is **immutable** — `amount.add(fee)` returns a new
object; the original is unchanged. `amount.add(fee);` as a statement is a
no-op bug the compiler cannot catch.

## Gotchas

**Symptom:** a "0.1" `BigDecimal` prints as 0.1000000000000000055511…
**Cause:** `new BigDecimal(double)` — exact conversion of the binary approximation
**Fix:** `String` constructor for literals/text; `BigDecimal.valueOf` for genuine doubles. Grep the codebase for `new BigDecimal(` followed by a non-quote — each is a latent finding

**Symptom:** `HashSet` contains "duplicate" amounts; `Map.get` misses a key that is visibly present
**Cause:** `equals` includes scale — `2.0` vs `2.00` are unequal with different hashes
**Fix:** normalize scale at construction (one `setScale` per currency boundary), or compare via `compareTo`; never mix scales in hashed collections

**Symptom:** `divide` throws `ArithmeticException: Non-terminating decimal expansion` — only for some inputs
**Cause:** no scale/rounding given; the exact quotient has no finite decimal (divisor gained a factor other than 2/5)
**Fix:** always `divide(x, scale, mode)`. The two-arg form is a trap that passes tests with friendly divisors

**Symptom:** money totals off by one cent versus finance's spreadsheet
**Cause:** rounding-mode mismatch — `HALF_EVEN` vs `HALF_UP` differ exactly on the .5 boundary, compounding over line items
**Fix:** get the required mode from the business/regulation, encode it once, test the .5 cases explicitly (`0.125` at scale 2 under both modes is the canonical probe)

**Symptom:** an `add`/`setScale` call "did nothing"
**Cause:** immutability — the result was returned, not applied in place
**Fix:** assign it: `total = total.add(fee);` — and lint for ignored return values on `BigDecimal` methods

**Symptom:** `stripTrailingZeros` output displays as `1E+2`
**Cause:** canonical form uses scientific notation when scale goes negative
**Fix:** `toPlainString()` for anything human-facing

**Symptom:** sorting or `TreeMap` on `BigDecimal` behaves differently from `HashSet` membership on the same values
**Cause:** ordered collections use `compareTo` (scale-blind), hashed ones use `equals` (scale-sensitive)
**Fix:** normalized scale everywhere; document that `BigDecimal`'s natural order is inconsistent with equals — it is the JDK's own worked example

## Interview questions

**★ Why is `new BigDecimal(0.1)` wrong, and what is right?**
The `double` 0.1 *is* 0.1000…055511… — the constructor faithfully converts
that binary value, importing the error `BigDecimal` exists to avoid.
`new BigDecimal("0.1")` parses the decimal text exactly;
`BigDecimal.valueOf(d)` goes through `Double.toString` for values that
genuinely started as doubles.

**★ `equals` vs `compareTo` on `BigDecimal`?**
`equals` requires equal value *and equal scale* (`2.0` ≠ `2.00`);
`compareTo` is purely numeric (`2.0` = `2.00`). So hashed collections and
`TreeMap`s can disagree about the same data — the canonical example of a
natural ordering inconsistent with equals. Compare money with `compareTo`;
normalize scale before hashing.

**★ Why does `divide` sometimes throw, and what is the correct call?**
Exact division of decimals can be non-terminating (1/3); with no rounding
policy `BigDecimal` refuses rather than guess, throwing
`ArithmeticException`. Production division always states scale and mode:
`divide(divisor, 2, RoundingMode.HALF_EVEN)` — and which mode is a business
requirement, not a style choice.

**★ `HALF_UP` vs `HALF_EVEN` — when does it matter?**
Only at exact .5 boundaries — which line-item pricing hits constantly
(`0.125` to two places: `0.13` vs `0.12`). `HALF_UP` matches human/most
regulatory expectations per operation; `HALF_EVEN` is unbiased in
aggregate, hence "banker's rounding". Volume turns the difference into
reconciliation deltas.

**Is `BigDecimal` mutable? What follows for arithmetic chains?**
Immutable — every operation returns a new instance, enabling safe sharing
(Phase 2's immutability story) and making an unassigned
`amount.add(fee);` a silent no-op. Chains read naturally:
`price.multiply(qty).setScale(2, HALF_EVEN)`.

**How would you store and restore an exact amount without `BigDecimal`?**
Unscaled long + known scale — exactly `BigDecimal`'s own model:
`valueOf(unscaled, scale)` reconstructs; `unscaledValue()`/`scale()`
deconstruct. That equivalence is chunk 3's `long`-cents pattern.

---

← Prev: [IEEE-754 doubles](01-ieee-754-doubles.md) · Next → [Money patterns](03-money-patterns.md)
