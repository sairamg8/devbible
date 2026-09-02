---
title: "Money and dates with Intl"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the MDN `Intl` reference — `NumberFormat` and its
> constructor, `formatToParts`, `resolvedOptions`, `DateTimeFormat.formatRange`
> and `RelativeTimeFormat`. Documentation-validated; **no timings, no console
> blocks**.

**The display edge of the whole app.** Prices live as integer minor units in a
`bigint` column and times live as `timestamptz` instants; both become strings
exactly once, here.

Two concept homes this chapter deliberately does **not** re-teach:

- **Money representation and rounding** — why floats fail, `Math.round`'s
  half-up bias, and why rounding *order* changes the total:
  [JavaScript 18·05](../../../../javascript/pages/phase-18-storefront/05-money-and-rounding/README.md)
- **Storage** — why `bigint` cents beat `numeric`, and why the instant is what
  gets stored: [chapter 1·07](../../phase-1-database/07-money-and-time.md)

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The money formatter](01-the-money-formatter.md)** | 🔴 **`/100` is a bug** — minor-unit digits come from ISO 4217 via the formatter, so JPY has none and KWD has three; deriving the divisor from `resolvedOptions()`; the formatter cache and why the options belong in its key; 🔴 **the currency symbol is not a prefix** — `formatToParts` and the German `3.500,00 €`; `currencyDisplay` and `currencySign: "accounting"` for refunds |
| 2 | **[Dates and delivery windows](02-dates-and-delivery-windows.md)** | 🔴 **`timeZone` is a required argument, never a default** — the container is UTC and the browser is not; `formatRange` as the delivery window, and ⚠️ **its documented collapse to a single date** when both ends match at the output's precision; `RelativeTimeFormat` with `numeric: 'auto'`; 🔴 **why `/86400000` is wrong for "days ago"** across DST and across midnight |
| 3 | **[Where it breaks](03-where-it-breaks.md)** | 🔴 **The hydration mismatch is a state bug, not a formatting bug** — resolve locale and timezone once per request; ⚠️ **asking for a locale is not getting it**, and `resolvedOptions().locale` is the check; why `small-icu` Node makes this a production-only failure; and 🔴 **the client never decides the price** |

## The three sentences to keep

1. **One division, in one module.** `amount / minorUnitsPer(currency)` immediately
   before formatting — every other operation stays on integers.
2. **Locale and timezone are request state, not ambient state.** Resolve them on
   the server, pass them down, and never re-derive them on the client.
3. **Formatting makes a value readable, not true.** The server computes every
   monetary value; this module only renders it.

## Using it in the app

The `Price` component and the `formatWindow` helper are consumed by the product
card and cart line ([chapter 4·06](../../phase-4-react-ui/06-cart-state.md)),
the checkout summary ([4·04](../../phase-4-react-ui/04-useform-and-checkout.md)),
and the order history table. The i18n context they read is populated from the
request in the server render.

## Phase gate

You are done with this topic when you can say why `/100` breaks yen, style a
currency symbol without parsing the formatted string, explain what a same-day
delivery window renders and why, compute "2 days ago" correctly across a DST
boundary, and name the one change that fixes a price hydration mismatch.

## Where this connects

The [fetch wrapper](../01-the-fetch-wrapper.md) delivers the amounts and
instants this module renders; the [validation engine](../05-the-validation-engine.md)
rejects a bad currency code before one ever reaches a formatter. Formatting is
the last step in the chain and the only one that is allowed to be locale-aware.

---

Next → [Slug and search normalization](../07-slug-and-search-normalization.md)
