---
title: "Money patterns"
sidebar_label: "3 · Money patterns"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 `BigDecimal`, `Currency` and
> `NumberFormat` API documentation; JSR 354 (java.money) noted as the
> never-adopted standard it is.

**Money is an amount, a currency, a scale and a rounding policy — four
facts. Code that passes raw `BigDecimal`s (let alone `double`s) around
carries one of the four and hopes about the rest. The pattern that works in
services is small: one value type that owns all four, exact types at every
boundary (database, JSON), and rounding performed at defined points instead
of everywhere.**

## The `Money` value type

A record (Phase 2 topic 08 covers records; this is their canonical use)
wrapping amount + currency, normalizing scale at the door:

```java
public record Money(BigDecimal amount, Currency currency) {

    public Money {
        Objects.requireNonNull(amount);
        Objects.requireNonNull(currency);
        amount = amount.setScale(currency.getDefaultFractionDigits(),
                                 RoundingMode.UNNECESSARY);   // reject, don't hide
    }

    public Money add(Money other) {
        requireSameCurrency(other);
        return new Money(amount.add(other.amount), currency);
    }

    public Money percent(BigDecimal rate, RoundingMode mode) {
        return new Money(amount.multiply(rate)
                               .setScale(amount.scale(), mode), currency);
    }

    private void requireSameCurrency(Money other) {
        if (!currency.equals(other.currency))
            throw new IllegalArgumentException(
                "currency mismatch: " + currency + " vs " + other.currency);
    }
}
```

What the type buys, item by item:

- **Currency mixing becomes an exception**, not a summed EUR+USD number.
  (`Currency` also supplies the right scale: 2 for USD/EUR, 0 for JPY —
  hardcoded `setScale(2)` is a JPY bug waiting.)
- **`RoundingMode.UNNECESSARY` in the compact constructor** makes
  unexpected precision a loud failure at the boundary where it entered,
  instead of a silent rounding somewhere downstream.
- **Rounding happens at named points** — `percent` demands a mode from the
  caller because *where* interim results round is business policy
  (per-line-item vs on-the-total changes invoice sums; both are defensible,
  only one is what finance signed off).
- Record `equals` delegates to `BigDecimal.equals` — scale-sensitive, which
  is *correct here* because the constructor normalized scale; the chunk-2
  hashing trap is closed at the door.

JSR 354 ("java.money") standardized exactly this shape and never reached
the JDK; libraries exist (Moneta, Joda-Money), but the 40-line record is
the common production answer — small enough to own.

## The `long`-cents alternative

Store minor units in a `long`: `4999` for $49.99. It is `BigDecimal`'s own
model (unscaled value + fixed scale) with the scale moved into convention:

- **Wins**: primitive speed and memory, trivially exact addition and
  comparison, natural fit for high-volume ledgers and event streams, no
  accidental-scale bugs — there is no scale.
- **Costs**: the convention is invisible in types (a bare `long` might be
  cents or yen or milliunits — wrap it in a record to restore the type
  safety); multiplication/percentage still needs explicit rounding
  discipline (`Math.round` on a `double` intermediate re-imports the very
  problem — compute in `long`/`BigDecimal`: `amount * rate / 10_000` with
  the rate as basis points); overflow is topic 04's story
  (`Math.multiplyExact`, and 9.2 × 10¹⁸ cents is comfortably past any
  GDP).
- Rule of thumb: **cents for storage and transport at volume, `Money` over
  `BigDecimal` for calculation-heavy domain logic**; converting between the
  two is `valueOf(cents, scale)` / `movePointRight(scale).longValueExact()`.

## Boundaries

- **Database**: `NUMERIC(19, 4)`/`DECIMAL` columns ↔ `BigDecimal` (JDBC and
  JPA map it natively — Phase 10), or `BIGINT` cents. Never `FLOAT`/
  `DOUBLE PRECISION` columns for amounts — the corruption happens in the
  column type before Java sees it.
- **JSON**: serialize amounts as **strings** (`"49.99"`), not JSON numbers —
  most consumers parse numbers as IEEE doubles (JavaScript has nothing
  else), reintroducing binary error in transit. Jackson: `@JsonFormat(shape
  = STRING)` or a module-level setting (Phase 7's Jackson topic).
- **Display**: `NumberFormat.getCurrencyInstance(locale)` — formatting is
  locale (Phase 7), never string concatenation with a hardcoded symbol.

## Gotchas

**Symptom:** totals drift from the ledger by sub-cent amounts at volume
**Cause:** amounts touched `double` somewhere — a JSON number, a `DOUBLE` column, a `Math.round` on a rate calculation
**Fix:** exact types end-to-end: string JSON, `NUMERIC` columns, `BigDecimal`/cents arithmetic. Audit every boundary, not just the code between them

**Symptom:** EUR and USD amounts summed into one number
**Cause:** raw `BigDecimal` carries no currency; nothing objected
**Fix:** the `Money` type — mixing becomes `IllegalArgumentException` at the add-site

**Symptom:** JPY (or KWD) amounts wrong by 100× / 1000×
**Cause:** hardcoded scale 2 — yen has 0 fraction digits, dinar has 3
**Fix:** scale from `Currency.getDefaultFractionDigits()`, never a literal

**Symptom:** invoice line items sum to a different total than the invoice's own computed total
**Cause:** rounding per line item vs rounding the total — both "correct", chosen inconsistently across code paths
**Fix:** one documented policy, enforced by doing rounding only inside named `Money` operations; test the sum-of-parts case explicitly

**Symptom:** a `long` amount silently means different things in two services
**Cause:** bare `long` cents convention vs milliunits vs whole units — the type says nothing
**Fix:** wrap it (`record Cents(long value)`) or standardize and document the unit in the schema/contract; unit tests at the integration boundary

**Symptom:** percentage/interest computation on cents is off by a cent in edge cases
**Cause:** the rate math detoured through `double`, or truncated instead of applying the mandated rounding mode
**Fix:** integer math with basis points plus explicit remainder handling, or convert to `BigDecimal` for the multiply-and-round step

**Symptom:** frontend shows `49.989999999999995`
**Cause:** amount serialized as a JSON number; the consumer parsed it into an IEEE double
**Fix:** amounts as JSON strings; agree the contract with consumers — this is an API-design decision, not a formatting bug

## Interview questions

**★ Why never `double` for money — the complete answer?**
Binary floating point cannot represent most decimal amounts (0.1 has no
finite binary form), so every store and every operation approximates;
errors accumulate and comparisons flip at boundaries. Money is a *decimal,
audited* quantity — it needs exact decimal arithmetic (`BigDecimal` or
integer minor units) with an explicit, business-chosen rounding policy.
The bug is silent, which is what makes it a finding rather than a crash.

**★ Design a Money type — what must it own?**
Amount (exact), currency, scale (from the currency, not hardcoded), and
rounding policy at named operations. Construction normalizes and rejects
excess precision (`RoundingMode.UNNECESSARY`); arithmetic enforces
same-currency; percentages demand a rounding mode from the caller.
A record over `BigDecimal` + `Currency` covers it in ~40 lines.

**★ `BigDecimal` vs long-cents — the trade?**
Cents: primitive speed, exactness by construction, ideal for storage,
transport and ledgers at volume; but the unit lives in convention and
multiplication needs discipline. `BigDecimal`: self-describing scale and
rich rounding control, ideal for rate-heavy domain math; heavier and
trap-rich (chunk 2). Common architecture: cents at rest and in motion,
`Money`/`BigDecimal` in calculation.

**★ How do amounts cross JSON safely, and why?**
As strings. JSON numbers are parsed as IEEE doubles by most consumers
(JavaScript unconditionally), silently corrupting decimals in transit even
when both ends store exactly. `"49.99"` round-trips; document it in the
API contract.

**Where should rounding happen in an order-total computation?**
At policy-defined points only — typically each line item to currency scale,
then exact summation; or exact throughout with one final rounding. Mixed
strategies produce the sum-of-parts ≠ total incident. Encode the choice in
the `Money` operations so call-sites can't improvise.

**What changes for zero-decimal currencies?**
Scale comes from `Currency.getDefaultFractionDigits()` — 0 for JPY, 3 for
KWD/BHD. Every hardcoded `setScale(2)` and every "multiply by 100 for
cents" assumption breaks; minor-units conventions must be per-currency.

---

← Prev: [`BigDecimal`, correctly](02-bigdecimal-correctly.md) · Index: [Floating point and BigDecimal](README.md)
