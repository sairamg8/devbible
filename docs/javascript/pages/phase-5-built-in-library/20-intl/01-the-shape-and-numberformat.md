---
title: "1 · The shape, and `NumberFormat`"
sidebar_label: "1 · The shape and NumberFormat"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Intl`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl), [`Intl.NumberFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat), [`Intl.NumberFormat` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat), [`Intl.NumberFormat.prototype.format()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/format), [`Intl.NumberFormat.prototype.formatToParts()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/formatToParts), [`Intl.NumberFormat.prototype.resolvedOptions()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/resolvedOptions), [`Intl.NumberFormat.supportedLocalesOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/supportedLocalesOf), [`Number.prototype.toLocaleString()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toLocaleString), [`Intl.Locale`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale). Documentation-validated; **no timings**.

## The shape every constructor shares

```js
const nf = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

nf.format(1234.5);          // "1.234,50 €"
nf.formatToParts(1234.5);   // [{type:"integer",value:"1"}, {type:"group",value:"."}, …]
nf.resolvedOptions();       // { locale: "de-DE", currency: "EUR", … } — what it decided
Intl.NumberFormat.supportedLocalesOf(["de-DE", "xx-XX"]);   // ["de-DE"]
```

**Four methods, seven constructors, one pattern.** `resolvedOptions()` is the one people
skip and shouldn't — it tells you which locale you actually got and what every option
resolved to, which is how you debug "it formatted differently on the server".

### The locale argument

The first argument is a BCP 47 tag or an array of them, tried in order:

```js
new Intl.NumberFormat();                          // the host's locale
new Intl.NumberFormat(undefined, options);        // ✅ same, and lets you pass options
new Intl.NumberFormat("en-IN");                   // a specific one
new Intl.NumberFormat(["fr-CA", "fr", "en"]);     // first one with data wins
```

⚠️ **`undefined` is not the same as `"en-US"`** — it means "whatever this machine is set
to", which is right for a browser showing a user their own data and wrong for a server
rendering output that must not vary by host. **Decide which one you mean**; a server
should usually be explicit.

**A locale tag can carry extensions**, which is how you request a calendar or numbering
system without an option:

```js
new Intl.NumberFormat("hi-IN-u-nu-deva");   // Devanagari digits
new Intl.DateTimeFormat("en-u-ca-buddhist");
```

### 🔴 Build the formatter once

**Constructing an `Intl` formatter is the expensive part; formatting with it is cheap.**
MDN says so explicitly, and it is the single most common `Intl` performance mistake:

```js
rows.map((r) => r.total.toLocaleString("en-GB", opts));   // 🔴 a new formatter per row

const money = new Intl.NumberFormat("en-GB", opts);       // ✅ once
rows.map((r) => money.format(r.total));
```

⚠️ **Every `toLocaleString` / `toLocaleDateString` call is a hidden constructor call.**
They are convenient for one value and wrong inside a loop — and a table of a thousand
rows is a loop. Hoist the formatter to module scope, or memoise by locale.

## `NumberFormat` — the styles

```js
const n = 1234.567;

new Intl.NumberFormat("en-US").format(n);                        // "1,234.567"
new Intl.NumberFormat("de-DE").format(n);                        // "1.234,567"
new Intl.NumberFormat("en-IN").format(1234567);                  // "12,34,567" — lakh grouping
```

🔴 **The `en-IN` line is the argument for `Intl` in one example.** Indian grouping is not
every-three-digits, and no hand-written regex for thousands separators has ever handled
it. The same applies to locales that use a space or an apostrophe as the separator.

### Currency

```js
const opts = { style: "currency", currency: "USD" };
new Intl.NumberFormat("en-US", opts).format(1234.5);   // "$1,234.50"
new Intl.NumberFormat("de-DE", opts).format(1234.5);   // "1.234,50 $"
```

**`currency` is required when `style` is `"currency"`** — omitting it throws a
`TypeError`. The code is an ISO 4217 string, and the formatter knows each currency's
default number of decimal places (two for USD, none for JPY), so you do not hard-code it.

```js
{ currencyDisplay: "symbol" }   // "$1,234.50"  (default)
{ currencyDisplay: "narrowSymbol" }  // "$1,234.50" even where "symbol" gives "US$"
{ currencyDisplay: "code" }     // "USD 1,234.50"
{ currencyDisplay: "name" }     // "1,234.50 US dollars"
{ currencySign: "accounting" }  // "($1,234.50)" for negatives
```

⚠️ **Note where the symbol lands.** `en-US` puts it before, `de-DE` after, and some
locales insert a non-breaking space. Any code that does `"$" + amount.toFixed(2)` is
wrong the moment a second locale appears — and often wrong in the first one.

### Percent, and the multiplication that surprises people

```js
new Intl.NumberFormat("en-US", { style: "percent" }).format(0.256);   // "26%"
```

🔴 **`style: "percent"` multiplies by 100.** Pass the *ratio*, not the percentage. Passing
`25` gives `"2,500%"`, and it is a common bug because the variable is usually already
named `percent`.

```js
{ style: "percent", maximumFractionDigits: 1 }   // 0.256 → "25.6%"
```

### Units

```js
new Intl.NumberFormat("en-US", { style: "unit", unit: "kilometer-per-hour" }).format(50);
// "50 km/h"
new Intl.NumberFormat("en-US", { style: "unit", unit: "byte", unitDisplay: "long" }).format(5);
// "5 bytes"
```

**`unit` is required for `style: "unit"`**, and only a fixed list of sanctioned units is
allowed — `Intl.supportedValuesOf("unit")` enumerates them. Compound units are built with
`-per-`.

## Digits, and the two systems that must not be mixed

```js
{ minimumFractionDigits: 2, maximumFractionDigits: 2 }     // always 2 decimals
{ maximumFractionDigits: 0 }                               // whole numbers
{ minimumIntegerDigits: 2 }                                // "07"
{ maximumSignificantDigits: 3 }                            // 1234.567 → "1,230"
```

⚠️ **Significant-digit options override fraction-digit options** when both are present.
Pick one system per formatter; mixing them produces output that looks arbitrary.

**This replaces `toFixed`, and it is better in three ways** — it groups, it localises the
decimal separator, and it does not return a string with a `.` in a locale that uses `,`
([11 · `Number` and `Math`](../11-number-and-math/README.md)).

## Compact notation and sign display

```js
const c = new Intl.NumberFormat("en", { notation: "compact" });
c.format(1200);       // "1.2K"
c.format(1_200_000);  // "1.2M"

new Intl.NumberFormat("en", { notation: "compact", compactDisplay: "long" }).format(1200);
// "1.2 thousand"
```

**This is the "12.4K followers" formatter**, localised — and it is another thing usually
hand-written with a chain of `if`s and a hard-coded `K`/`M`/`B`, which is wrong in most
languages.

```js
{ signDisplay: "always" }      // "+5" — for deltas
{ signDisplay: "exceptZero" }  // "+5", "-5", but plain "0"
{ signDisplay: "never" }
{ notation: "scientific" }     // "1.235E3"
```

**`formatRange` gives a localised range** in one call, rather than two formats and a
hyphen:

```js
new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
  .formatRange(10, 25);   // "$10.00 – $25.00"
```

## `formatToParts` — when the options cannot express the layout

```js
const parts = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
  .formatToParts(1234.5);
// [{type:"currency",value:"$"}, {type:"integer",value:"1"}, {type:"group",value:","}, …]
```

**Every piece is tagged**, so you can style the currency symbol differently, drop the
decimals into a `<sup>`, or grey out the trailing zeros — without parsing the formatted
string, which is unparseable across locales.

```js
const html = parts
  .map((p) => (p.type === "currency" ? `<span class="sym">${p.value}</span>` : p.value))
  .join("");
```

🔴 **Never regex a formatted string to get its pieces back.** The separators, the symbol
position and even the digits change per locale; `formatToParts` exists precisely so you
never have to.

## What `Intl` does *not* solve — money

⚠️ **Formatting money correctly does not make the arithmetic correct.** `NumberFormat`
renders a double, and a double cannot hold `0.1 + 0.2`
([Phase 1 · 06 · Numbers are doubles](../../phase-1-values-and-coercion/06-numbers-are-doubles.md)).

**The rule: store and compute in minor units — integer cents — and format only at the
edge.**

```js
const totalCents = items.reduce((sum, i) => sum + i.priceCents * i.qty, 0);   // ✅ integers
money.format(totalCents / 100);                                              // ✅ display only
```

**Recent runtimes let `format` take a string or a `BigInt`**, which sidesteps the double
for very large or very precise values — check your targets before relying on it:

```js
new Intl.NumberFormat("en-US").format("123456789012345678901234.5");
```

## Gotchas

**Symptom:** Formatting a long table felt heavy
**Cause:** `toLocaleString` constructs a new formatter on every call.
**Fix:** Build one `Intl.NumberFormat` and reuse it.

**Symptom:** `TypeError: Currency code is required with currency style`
**Cause:** `style: "currency"` without `currency`.
**Fix:** Pass the ISO 4217 code; do not hard-code the symbol.

**Symptom:** Percentages came out 100× too large
**Cause:** `style: "percent"` multiplies by 100 — it wants the ratio.
**Fix:** Pass `0.25`, not `25`.

**Symptom:** Thousands separators were wrong for Indian users
**Cause:** A hand-written every-three-digits regex. `en-IN` groups as lakh and crore.
**Fix:** `Intl.NumberFormat`, always.

**Symptom:** `maximumFractionDigits` appeared to be ignored
**Cause:** A significant-digits option is also set, and it takes precedence.
**Fix:** Use one system per formatter.

**Symptom:** Parsing the formatted string to extract the number failed abroad
**Cause:** Separators, symbol position and digits are all locale-dependent.
**Fix:** Keep the raw number; use `formatToParts` if you need the pieces.

**Symptom:** Totals were a cent out
**Cause:** Floating-point arithmetic. Formatting only hid it.
**Fix:** Integer minor units for storage and arithmetic; format at the edge.

**Symptom:** Output differed between the server and the browser
**Cause:** The locale defaulted to the host in one of them.
**Fix:** Pass an explicit locale where the output must be stable, and check
`resolvedOptions()`.

## Interview questions

**★ Why build an `Intl` formatter once instead of calling `toLocaleString`?**
Constructing the formatter is the expensive step — it resolves the locale and loads the
data — while `format` is cheap. Every `toLocaleString` call is a hidden constructor call,
so in a list of a thousand rows it builds a thousand formatters. Hoist it.

**★ What does `style: "percent"` do to the input?**
Multiplies it by 100, so it takes a ratio. `0.25` renders as `25%` and `25` renders as
`2,500%` — a common bug because the variable is usually already called `percent`.

**★ How would you display a monetary amount?**
`Intl.NumberFormat(locale, { style: "currency", currency: "USD" })`, which knows the
symbol, its position, the separators and the currency's decimal count. But store and
compute in integer minor units — formatting a double correctly does not make the
arithmetic correct.

**★ What is `formatToParts` for?**
Getting the formatted output as tagged pieces — currency symbol, integer, group
separator, fraction — so you can style or restructure them without parsing the string.
Parsing a formatted number is unsafe because every part of it varies by locale.

**What does passing `undefined` as the locale mean, and when is it wrong?**
"Use the host's locale." Right for a browser showing a user their own data; wrong for a
server whose output must not vary by machine. `resolvedOptions().locale` tells you what
you actually got.

**How do you render "1.2K"?**
`{ notation: "compact" }`, with `compactDisplay: "long"` for "1.2 thousand". It localises,
which a hand-written `K`/`M`/`B` chain does not.

---

[Topic index](./README.md) · Next: [2 · Dates and relative time](./02-dates-and-relative-time.md) →
