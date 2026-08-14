---
title: "05.2 · Rounding, tax and discounts"
sidebar_label: "02 · Rounding and order"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Math.round()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round), [`Math.floor()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/floor), [`Math.trunc()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc), [`Intl.NumberFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat). Documentation-validated; **no timings**.

**Integers removed the representation problem; they did not remove rounding.** A 20% tax on 1299
pence is 259.8, and something has to decide what that becomes — and *when*.

## `Math.round` is not the rounding you were taught

```js
Math.round(2.5);      //  3
Math.round(-2.5);     // -2   🔴 not -3
Math.round(0.5);      //  1
Math.round(-0.5);     // -0
```

🔴 **`Math.round` rounds half **up** — toward positive infinity — not "half away from zero".** So
positive and negative amounts round asymmetrically, and a refund of 2.5 rounds differently from a
charge of 2.5. On a system that issues refunds this shows up as a systematic one-unit drift in one
direction.

**The three that behave predictably:**

| Function | −2.5 | 2.5 | Use |
|---|---|---|---|
| `Math.round` | −2 | 3 | half **up** — asymmetric |
| `Math.floor` | −3 | 2 | toward −∞ |
| `Math.trunc` | −2 | 2 | toward zero — **symmetric** |

**Half away from zero**, which is what most people mean by "round", is:

```js
const roundHalfAwayFromZero = (x) => Math.sign(x) * Math.round(Math.abs(x));
```

⚠️ **Banker's rounding (half to even) is what many financial systems specify**, because it removes
the upward bias of always rounding .5 up across a large number of transactions. **The rule to
follow is the one the business or the tax authority specifies** — the point here is that "just
round it" is not a specification, and different choices are visibly different in aggregate.

## Order changes the answer

🔴 **Discount before tax, or tax before discount, produce different totals** — and which is correct
is a legal question, not a preference.

```js
const subtotal = 10000;                 // £100.00
const discount = 1000;                  // £10.00 off
const taxRate = 0.2;

// discount first (typical for a pre-tax discount)
const a = Math.round((subtotal - discount) * taxRate) + (subtotal - discount);   // 10800

// tax first
const b = Math.round(subtotal * taxRate) + subtotal - discount;                   // 11000
```

**£2.00 apart on a £100 order.** ⚠️ Neither is "the right answer" in general — jurisdictions differ,
and so do discount types. **What matters is that the order is a stated rule in one place**, not an
accident of where someone put a `-`.

🔴 **The same applies to shipping and to whether tax applies to it**, which also varies. The
storefront lesson: **write the order down, put it in one function, and test it with a known
example.**

## Round once, at the end

```js
// ❌ rounds every line, so errors accumulate
const total = items.reduce((sum, it) => sum + Math.round(it.unitPrice * it.qty * (1 + taxRate)), 0);

// ✅ accumulate exactly, round once
const subtotal = items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
const tax = Math.round(subtotal * taxRate);
const total = subtotal + tax;
```

🔴 **Rounding per line and rounding once give different totals**, and the difference grows with the
number of lines. Round at the point where a real amount is charged or displayed — not at every
intermediate step.

⚠️ **But per-line tax is sometimes *required***, because different items carry different rates.
Then you round per rate group, not per line, and the group is the unit — again, a stated rule.

## Splitting an amount without losing a penny

Splitting £10.00 three ways gives 333.33 pence each, and 999 ≠ 1000.

```js
function split(amount, parts) {
  const base = Math.floor(amount / parts);
  const remainder = amount - base * parts;                 // 🔴 the lost units
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

split(1000, 3);        // [334, 334, 332]  — sums to exactly 1000
```

🔴 **The remainder must be distributed, not dropped.** This is the "penny shaving" problem, and it
appears in split payments, proportional discounts across lines, and allocating shipping across
items. **Distributing the remainder to the first N parts is the simplest rule**, and any rule is
acceptable as long as the parts sum to the original.

⚠️ **A proportional discount across cart lines is the same problem** — allocate by proportion, then
give the leftover units to the largest lines, and **assert that the parts sum to the total**.

## The client does not decide the price

🔴 **Every number on this page is a *display* calculation.** The server recomputes the total from
item ids and quantities, and the server's total is what is charged
([Phase 12 · 02 · 01](../../phase-12-browser-platform/02-client-side-security/01-the-trust-boundary.md)).

That has two consequences worth stating:

- **Send inputs, not conclusions.** A checkout that posts `{ items, couponCode }` can be verified;
  one that posts `{ total: 4999 }` is a price the user chose.
- ⚠️ **The client and server must round identically**, or the displayed total differs from the
  charged one — which erodes trust even when the server is right. **Same order of operations, same
  rounding rule, same grouping**, ideally derived from the same specification and tested against
  the same fixtures.

**When they disagree, show the server's number and explain the change before payment.** A silent
correction at the payment step is how a checkout loses people.

## Gotchas

**Symptom:** Refunds round differently from charges
**Cause:** `Math.round` rounds half **up**, so −2.5 → −2 and 2.5 → 3.
**Fix:** `Math.sign(x) * Math.round(Math.abs(x))` for half-away-from-zero, or the specified rule.

**Symptom:** Totals drift by a few units on large carts
**Cause:** Rounding per line and accumulating.
**Fix:** Accumulate exactly and round once — or per rate group when rates differ.

**Symptom:** The total is £2 out on a discounted order
**Cause:** Tax applied before the discount instead of after, or vice versa.
**Fix:** State the order in one function; it is a legal question, not a preference.

**Symptom:** A three-way split loses a penny
**Cause:** The remainder was dropped.
**Fix:** Distribute it; assert that the parts sum to the original.

**Symptom:** A proportional discount does not sum to the discount
**Cause:** The same rounding-remainder problem across lines.
**Fix:** Allocate, then distribute the leftover units, then assert.

**Symptom:** The displayed total differs from the charged total
**Cause:** Client and server round differently, or in a different order.
**Fix:** One specification, the same fixtures on both sides — and show the server's number.

**Symptom:** A user pays a price they chose
**Cause:** The client sent a total.
**Fix:** Send item ids and quantities; the server recomputes.

**Symptom:** "Just round it" produces an audit finding
**Cause:** No stated rounding rule, so different code paths differ.
**Fix:** One rule, one place, tested against a known example.

## Interview questions

**★ What is wrong with `Math.round` for money?**
It rounds half **toward positive infinity**, not away from zero — `Math.round(-2.5)` is `-2` while
`Math.round(2.5)` is `3`. On a system that issues refunds, that asymmetry is a systematic drift.
Half-away-from-zero is `Math.sign(x) * Math.round(Math.abs(x))`, and many financial systems specify
banker's rounding instead.

**★ Does the order of tax and discount matter?**
Yes — on a £100 order with £10 off and 20% tax, the two orders are £2 apart. Which is correct is a
**legal** question that varies by jurisdiction and discount type; what matters technically is that
the order is one stated rule in one function, not an accident.

**★ Round per line or once at the end?**
Once, unless different lines carry different tax rates — then round per rate **group**. Rounding
per line accumulates error that grows with the number of lines.

**★ Split £10.00 three ways.**
`[334, 334, 332]` — take the floor, compute the remainder, and distribute the leftover units.
Dropping the remainder is penny-shaving, and the same problem appears in proportional discounts and
shipping allocation. Assert that the parts sum to the original.

**★ Who decides the price the customer pays?**
The server. Everything computed on the client is a display value; the checkout sends **item ids and
quantities**, and the server recomputes. A posted `total` is a price the user chose.

**★ The displayed total differs from the charged total. What went wrong?**
Client and server rounded differently, or in a different order. They must share one specification —
same order of operations, same rounding rule, same grouping — tested against the same fixtures. And
when they do disagree, show the server's number **before** payment rather than correcting silently.

**Why is "just round to two decimals" not a specification?**
Because it does not say which direction ties go, whether rounding happens per line or per total, or
where tax and discount sit relative to each other — and each choice is visibly different in
aggregate.

---

← [01 · Integer minor units](./01-integer-minor-units.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
