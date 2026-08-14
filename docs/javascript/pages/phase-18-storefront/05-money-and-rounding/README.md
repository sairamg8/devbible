---
title: "05 · Money, quantities and rounding"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER), [`Number.EPSILON`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/EPSILON), [`Math.round()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round), [`Math.trunc()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc), [`BigInt`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt), [`Intl.NumberFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat). Documentation-validated; **no timings**.

**Money is never a float, and integers do not remove rounding.** Both halves matter: the
representation rule, and then the decisions — direction, order and where — that a specification has
to make rather than a `Math.round` call.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Integer minor units, end to end](./01-integer-minor-units.md)** | Why floats fail here specifically — 🔴 **`Math.round(1.005 * 100)` gives `100`**, the bug in every hand-rolled currency helper; ⚠️ **why `Number.EPSILON` is not the fix** (it is a *relative* bound); integer minor units paired with a currency, and 🔴 **that not every currency has two decimals**; the three boundaries where the float sneaks back — `parseFloat`, locale separators, and JSON numbers; `Intl.NumberFormat` as the only correct formatter and the **one place the division by 100 happens**; and when `BigInt` genuinely earns its place |
| 2 | **[Rounding, tax and discounts](./02-rounding-and-order.md)** | 🔴 **`Math.round` rounds half toward +∞, not away from zero** — so refunds and charges round asymmetrically; the comparison table and half-away-from-zero; 🔴 **order changes the answer** — £2 apart on a £100 order — and that it is a legal question; **round once, at the end**, except per rate group; 🔴 **splitting without losing a penny**, which is the same problem as proportional discounts; and 🔴 **the client never decides the price**, with the requirement that both sides round **identically** or the shown total differs from the charged one |

## The three sentences to keep

1. **Integer minor units, converted only at the display edge** — `Intl.NumberFormat` is the only
   place a division by 100 belongs.
2. **`Math.round` is half-up, not half-away-from-zero.** Refunds and charges round differently, and
   the rule must be specified rather than assumed.
3. **Send inputs, not conclusions** — and make the client round exactly as the server does, or the
   displayed total and the charged total will disagree.

## Phase gate

You are done with this topic when you can say why `Math.round(1.005 * 100)` is wrong, parse a user
amount without reintroducing a float, state the rounding direction and the tax/discount order as
rules rather than reflexes, and split an amount three ways without losing a unit.

## Where this connects

- [04 · The cart as a state machine](../04-cart-state-machine/README.md) — what `unitPrice` holds, and where `derive` applies these rules
- [Phase 1 · Values, types and coercion](../../phase-1-values-and-coercion/README.md) — IEEE 754 and why `0.1 + 0.2 !== 0.3`
- [Phase 12 · 02 · 01 · The trust boundary](../../phase-12-browser-platform/02-client-side-security/01-the-trust-boundary.md) — why the server recomputes the total
- [07 · Idempotency from the client](../07-idempotency/README.md) — the other half of not charging twice

---

Start → [01 · Integer minor units, end to end](./01-integer-minor-units.md)
