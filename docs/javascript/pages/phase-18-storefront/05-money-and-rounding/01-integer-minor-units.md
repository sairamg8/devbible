---
title: "05.1 · Integer minor units, end to end"
sidebar_label: "01 · Integer minor units"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Number`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number), [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER), [`Number.EPSILON`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/EPSILON), [`Math.round()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round), [`BigInt`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt), [`Intl.NumberFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat). Documentation-validated; **no timings**.

**Money is never a float.** JavaScript numbers are IEEE 754 doubles, so `0.1 + 0.2` is not `0.3`,
and a currency amount stored as `12.99` is already an approximation before you have done anything
with it.

## Why floats fail here specifically

```js
0.1 + 0.2;                 // 0.30000000000000004
0.1 + 0.2 === 0.3;         // false
1.005 * 100;               // 100.49999999999999  → Math.round gives 100, not 101
19.99 * 3;                 // 59.96999999999999
```

🔴 **The third line is the one that costs money.** The standard "round to two decimals" trick —
`Math.round(x * 100) / 100` — rounds `1.005` **down**, because the stored double is very slightly
below 1.005. Every ad-hoc currency helper has this bug, and it produces a discrepancy of one penny
that reconciliation eventually finds.

⚠️ **`Number.EPSILON` is not a fix.** It is a *relative* bound (about 2.22 × 10⁻¹⁶, the smallest
difference from 1.0), so using it as an absolute tolerance is wrong at any meaningful magnitude,
and "close enough" is not a property an accounting system can have.

## The rule

🔴 **Store and compute in integer minor units — pence, cents, øre — and convert only at the
display edge.**

```js
const price = 1299;                          // £12.99, as an integer
const qty = 3;
const line = price * qty;                    // 3897 — exact, always
```

**Integers are exact in a double up to `Number.MAX_SAFE_INTEGER` (2⁵³ − 1 ≈ 9 × 10¹⁵)**, which in
pence is about £90 trillion. A storefront cannot reach it; a system aggregating national-scale
totals can, and that is when `BigInt` becomes necessary rather than pedantic.

**The type must be unambiguous:**

```js
{ amount: 1299, currency: "GBP" }            // ✅ an amount is meaningless without a currency
```

⚠️ **A bare number is a bug waiting to happen** — someone will add a GBP amount to a EUR amount and
nothing will complain. Pair them, and reject arithmetic across currencies explicitly.

🔴 **And not every currency has two decimal places.** JPY has zero minor units, and several have
three. Hard-coding `/ 100` breaks for them; the exponent belongs with the currency, and
`Intl.NumberFormat` knows it.

## The boundaries where it goes wrong

**Parsing user input** is the first:

```js
function parseAmount(input) {
  const cleaned = input.trim().replace(/[^\d.-]/g, "");   // strip symbols and separators
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;  // 🔴 validate the SHAPE
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0")) * (whole.startsWith("-") ? -1 : 1);
}
```

⚠️ **`parseFloat("12.99") * 100` is `1298.9999999999998`** — the float error is reintroduced at the
parse. Splitting on the decimal point and building the integer keeps it exact.

⚠️ **Locale decimal separators.** `"12,99"` is a valid amount in most of Europe, and `parseFloat`
reads it as `12`. Either normalise the separator before parsing or use a locale-aware parser — and
know which one you did.

**JSON is the second.** Any amount that crosses the wire as a JSON *number* with decimals is a
float again on arrival. 🔴 **Send integers**, or strings, and never `12.99`.

## Formatting, only at the edge

```js
const fmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
fmt.format(1299 / 100);                      // "£12.99"
```

🔴 **`Intl.NumberFormat` is the only correct formatter**, because currency display is not "symbol +
number":

- the **symbol position** differs by locale (`£12.99` vs `12,99 €`);
- the **separators** differ (`1,234.56` vs `1.234,56` vs `1 234,56`);
- the **number of decimals** differs by currency (JPY has none);
- **negative formatting** differs (`-£5.00` vs `(£5.00)` in accounting styles).

⚠️ **Create the formatter once.** Constructing an `Intl` formatter is comparatively expensive, and
building one per row of a cart is a measurable cost for no reason.

🔴 **The division by 100 happens *here* and nowhere else.** The moment a float exists earlier in the
pipeline, the guarantee is gone — which is the whole point of "convert only at the display edge".

## When `BigInt` earns its place

```js
const total = 1299n * 3n;                    // 3897n — exact at any magnitude
```

⚠️ **`BigInt` cannot mix with `Number`** — `1n + 1` throws a `TypeError` — and it does not
serialise with `JSON.stringify` (it throws). Both are deliberate, and both mean adopting it is a
whole-pipeline decision, not a local one.

**Use it when:** totals can exceed 2⁵³ minor units, or the domain is genuinely
arbitrary-precision. **Otherwise integers are simpler and sufficient**, and saying that rather than
reaching for `BigInt` by reflex is the better answer.

## Gotchas

**Symptom:** A total is off by a penny
**Cause:** Float arithmetic, or `Math.round(x * 100) / 100`, which rounds `1.005` down.
**Fix:** Integer minor units throughout.

**Symptom:** `parseFloat(input) * 100` gives `1298.9999999999998`
**Cause:** The float error reintroduced at the parse.
**Fix:** Split on the decimal point and build the integer.

**Symptom:** European input parses as a whole number
**Cause:** `"12,99"` read by `parseFloat` as `12`.
**Fix:** Normalise the separator, or parse locale-aware.

**Symptom:** Amounts arrive as floats from the API
**Cause:** JSON numbers with decimals.
**Fix:** Send integers or strings.

**Symptom:** GBP and EUR amounts are added
**Cause:** A bare number carries no currency.
**Fix:** `{ amount, currency }`, and reject cross-currency arithmetic.

**Symptom:** JPY shows two decimal places
**Cause:** A hard-coded `/ 100`.
**Fix:** The exponent belongs with the currency; `Intl` knows it.

**Symptom:** The currency symbol is on the wrong side
**Cause:** Manual concatenation.
**Fix:** `Intl.NumberFormat` with `style: "currency"`.

**Symptom:** Rendering a long cart is slow
**Cause:** A new `Intl.NumberFormat` per row.
**Fix:** Create it once.

**Symptom:** `TypeError: Cannot mix BigInt and other types`
**Cause:** `BigInt` adopted partially.
**Fix:** All-or-nothing through the pipeline; and it does not `JSON.stringify`.

## Interview questions

**★ Why is money never a float?**
Because doubles cannot represent most decimal fractions exactly — `0.1 + 0.2 !== 0.3`. The
consequence that costs money is that `Math.round(1.005 * 100)` gives `100`, not `101`, because the
stored double is slightly below 1.005. Every hand-rolled currency helper has that bug.

**★ Isn't `Number.EPSILON` the fix?**
No. It is a **relative** bound — the smallest difference from 1.0 — so using it as an absolute
tolerance is wrong at any real magnitude. And "close enough" is not a property an accounting system
can have.

**★ What do you store instead?**
Integer **minor units** — pence or cents — paired with a currency code, converted to a display
string only at the edge. Integers are exact in a double up to 2⁵³ − 1, which in pence is about £90
trillion.

**★ Where does the float sneak back in?**
Three boundaries: `parseFloat(input) * 100` at the parse; JSON numbers with decimals on the wire;
and any intermediate "convert to pounds for this one calculation". The division by 100 must happen
only at the formatter.

**★ Why `Intl.NumberFormat` rather than a symbol and `toFixed(2)`?**
Because symbol position, separators, decimal count and negative formatting all vary by locale and
currency — JPY has **no** minor units, so `/ 100` is wrong for it. Create the formatter once,
though; constructing one per cart row is a real cost.

**★ When would you use `BigInt`?**
When totals can exceed 2⁵³ minor units or the domain needs arbitrary precision. It is a
whole-pipeline decision — it cannot mix with `Number` and throws on `JSON.stringify` — so for a
storefront, integers are simpler and sufficient.

**Why pair the amount with a currency?**
Because a bare number lets someone add GBP to EUR and nothing complains. The pair makes
cross-currency arithmetic something you must reject explicitly.

---

[Topic index](./README.md) · Next → [02 · Rounding, tax and discounts](./02-rounding-and-order.md)
