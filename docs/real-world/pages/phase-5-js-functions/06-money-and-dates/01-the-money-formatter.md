---
title: "The money formatter"
sidebar_label: "01 · The money formatter"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against MDN —
> [`Intl.NumberFormat()` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat),
> [`formatToParts()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/formatToParts),
> [`resolvedOptions()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/resolvedOptions).
> Concept homes: **money representation and rounding** live in
> [JavaScript 18·05](../../../../javascript/pages/phase-18-storefront/05-money-and-rounding/README.md);
> **the storage decision** is [chapter 1·07](../../phase-1-database/07-money-and-time.md).
> This chapter re-teaches neither — it owns the **display edge**.

## The problem

Every price in this app is an integer of minor units in a `bigint` column, and
every price the user reads is a locale-formatted string. This chapter is the
one module allowed to cross that line.

It sounds like a one-liner — divide by 100, stick a `$` on it — and that
one-liner is wrong twice over. It is wrong about the **100**, and it is wrong
about the **`$`**.

## `/100` is a bug, not a shortcut

**Not every currency has two decimal places.** The Japanese yen has none: ¥500
is five hundred yen, not five yen. The Kuwaiti dinar has three. A `/100`
scattered through the UI silently divides yen by a hundred, and nobody notices
until a Japanese customer is charged a hundred times too little.

You do not need a table of currencies for this, and you should not write one.
**`Intl.NumberFormat` already knows**, because the constructor derives the
default fraction digits from the currency itself. MDN's wording:

> the default for currency formatting is the number of minor unit digits
> provided by the ISO 4217 currency code list (2 if the list doesn't provide
> that information)

So the formatter can tell you the divisor it is going to use, and you ask it
rather than assuming:

```js
// src/lib/money.js — the ONLY place minor units become a decimal number
const cache = new Map();

function formatter(locale, currency, extra = {}) {
  const key = `${locale}|${currency}|${JSON.stringify(extra)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {style: 'currency', currency, ...extra});
    cache.set(key, f);
  }
  return f;
}

/** How many minor units make one major unit for this currency. */
export function minorUnitsPer(currency, locale = 'en-US') {
  return 10 ** formatter(locale, currency).resolvedOptions().maximumFractionDigits;
}

/** {amount: 1999, currency: 'USD'} -> "$19.99"   ({500,'JPY'} -> "￥500") */
export function formatMoney({amount, currency}, locale, extra) {
  return formatter(locale, currency, extra)
    .format(amount / minorUnitsPer(currency, locale));
}
```

`amount / minorUnitsPer(...)` is the **only** division by a power of ten in the
codebase. Grep for `/ 100` in a review and treat every hit as a defect.

⚠️ **The division is safe here and nowhere else.** `1999 / 100` is `19.99`
inexactly, but the value's only remaining job is to be turned into a string by
a formatter that will round it to two places. Do arithmetic on the integer,
then convert — never convert, then add. That argument in full is
[JavaScript 18·05 chunk 1](../../../../javascript/pages/phase-18-storefront/05-money-and-rounding/01-integer-minor-units.md).

## Why the formatter is cached

A `Intl.NumberFormat` is constructed per call in the naive version, and a
storefront renders a price on every product card, every cart line, every order
row. The cache keys on everything that changes the output, so a wrong key is a
wrong price — which is why `extra` is in the key and not ignored.

⚠️ **MDN makes no performance claim about constructing formatters, and neither
does this page.** Caching is here because the same three formatters serve an
entire render, not because a benchmark was run. There is no measurement in this
corpus for it, and inventing one is banned.

## `$` is not a prefix

The second wrong assumption is that a currency symbol goes at the front. In
German, it does not — and `formatToParts` shows exactly that. MDN's example for
`de-DE` with `EUR`:

```js
[
  {type: 'integer',  value: '3'},
  {type: 'group',    value: '.'},
  {type: 'integer',  value: '500'},
  {type: 'decimal',  value: ','},
  {type: 'fraction', value: '00'},
  {type: 'literal',  value: ' '},
  {type: 'currency', value: '€'},
]
```

The group separator is `.`, the decimal separator is `,`, and the symbol is
**last**. Any code that slices the first character to style the symbol, or
splits on `.` to find the decimals, produces nonsense outside `en-US`.

When the design needs the symbol styled differently from the amount — which the
[spec's price treatment](../../phase-0-the-app/01-the-storefront-spec.md) asks
for — build it from the parts instead of parsing the string:

```jsx
// src/components/Price.jsx
export function Price({amount, currency, locale}) {
  const parts = formatter(locale, currency)
    .formatToParts(amount / minorUnitsPer(currency, locale));
  return (
    <span className="price">
      {parts.map((p, i) =>
        p.type === 'currency'
          ? <span key={i} className="price__symbol">{p.value}</span>
          : <span key={i}>{p.value}</span>,
      )}
    </span>
  );
}
```

## The two options worth knowing

**`currencyDisplay`** takes `"symbol"` (the default), `"narrowSymbol"`,
`"code"` and `"name"`. `narrowSymbol` is the one storefronts want when space is
tight: it renders `$100` where the default gives `US$100` in locales that
disambiguate. The invoice, by contrast, wants `"code"` — `USD 100.00` is
unambiguous in a document someone may read in another country.

**`currencySign: "accounting"`** wraps negatives in parentheses instead of
prefixing a minus, per locale convention. MDN's example: `-3500` in `bn` with
`USD` renders `($3,500.00)`. That is the correct treatment for a refund line on
a statement, and the wrong treatment for a discount row where a minus sign is
what the user expects. It is a per-surface decision, which is why `extra` is a
parameter rather than a constant.

## Gotchas

**Symptom:** Yen prices are a hundred times too small
**Cause:** A hardcoded `/100` somewhere the formatter did not reach
**Fix:** `minorUnitsPer(currency)`; ban `/ 100` in review

**Symptom:** `TypeError` on constructing a formatter
**Cause:** `style: 'currency'` with `currency` undefined — MDN specifies a
`TypeError` when style is `"currency"` and no `currency` is set
**Fix:** Currency is not optional in this app; it travels with every amount as
`{amount, currency}`, never as a bare number

**Symptom:** A currency code from user or admin input is rejected
**Cause:** Codes are normalized to uppercase, but an invalid code still throws
**Fix:** Validate against the allowed set at the
[validation boundary](../../phase-3-express-api/02-the-validation-boundary.md);
do not let a formatter be the thing that validates a code

**Symptom:** German prices show the thousands separator as the decimal point
**Cause:** String parsing of formatted output — `.` is the group separator in
`de-DE`
**Fix:** Never parse formatted money back into a number; keep the integer and
re-format. If a value must round-trip, send the integer

**Symptom:** Two prices on the same page disagree in style
**Cause:** One call passed `extra`, another did not, and the cache returned the
right object for each — the bug is the caller, not the cache
**Fix:** Surface-level presets (`priceFormat`, `invoiceFormat`) rather than
ad-hoc option objects at call sites

**Symptom:** The cart total is right but a line total is a penny out
**Cause:** Formatting each line from a float, then summing the displayed values
**Fix:** Sum integers, format once. Display is a leaf operation and never an
input to arithmetic

**Symptom:** A price renders as `NaN` or `€NaN`
**Cause:** `amount` arrived as a string — `bigint` columns come back from `pg`
as strings, and JSON round-trips can preserve that
**Fix:** Coerce at the API boundary where the type is known, not in the
formatter; see [chapter 2·02's data layer](../../phase-2-node-services/02-the-data-layer.md)

## Interview questions

1. **★ Why is dividing by 100 to display money a bug?** Because the number of
   minor units per major unit is a property of the *currency*, not a constant.
   JPY has zero decimal digits and KWD has three, so `/100` is wrong for both.
   `Intl.NumberFormat` derives the correct digit count from the ISO 4217 list,
   so the divisor should be read from `resolvedOptions().maximumFractionDigits`
   rather than assumed.
2. **★ Where is the single legitimate place to convert minor units to a
   decimal?** Immediately before formatting, and nowhere else. Every arithmetic
   operation — sums, discounts, tax — happens on integers; the conversion is a
   leaf. The moment a converted value feeds another calculation, float error
   re-enters.
3. **What does `formatToParts` give you that `format` cannot, and when do you
   need it?** A typed breakdown of the output, so you can style or reposition
   pieces without parsing. You need it whenever the design treats the symbol,
   the fraction or the separator differently — because their positions and
   characters vary by locale, `€` trailing in German being the standard example.
4. **Your teammate parses `format()` output with `split('.')` to get the cents.
   What breaks?** Every locale that uses `.` as the group separator, `de-DE`
   included, where `3.500,00 €` splits into the wrong pieces entirely. It also
   breaks on currencies with zero or three decimals, and on `accounting` sign
   display. Formatted output is for humans and is not a data format.
5. **When would you choose `currencyDisplay: "code"` over `"symbol"`?** When
   the reader may not share the page's locale assumptions — invoices, receipts,
   exports, anything that leaves the session. `$` is ambiguous across at least a
   dozen currencies; `USD` is not.
6. **Why is the formatter cache keyed on the options object and not just the
   locale and currency?** Because options change the output. A cache keyed only
   on locale and currency would return an accounting-sign formatter to a caller
   that asked for the standard one, so a refund would silently render in
   parentheses on a page that wanted a minus sign.
7. **The amount arrives as a string from the database. Where do you fix it?**
   At the boundary that knows the column type — the data layer — not in the
   formatter. A formatter that coerces its input hides the class of bug where a
   string reaches arithmetic somewhere else and concatenates instead of adding.

---

← [Overview](README.md) ·
Next → [Dates and delivery windows](02-dates-and-delivery-windows.md)
