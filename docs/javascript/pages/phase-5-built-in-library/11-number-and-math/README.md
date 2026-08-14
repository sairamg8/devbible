---
title: "11 · `Number` and `Math`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Number`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number), [`Math`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math), [`Number.prototype.toFixed()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toFixed), [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER), [`Math.random()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random). Documentation-validated; **no timings**.

**Every JavaScript number is a 64-bit float**, including the ones you call integers. Almost
everything surprising here follows from that: why `Math.round(-2.5)` is `-2`, why
`(1.005).toFixed(2)` is `"1.00"`, why a 64-bit database ID silently loses digits, and why money must
not be stored as a number of pounds.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Rounding, precision and money](./01-rounding-and-precision.md)** | The four rounding functions and how they differ on negatives, `toFixed` returning a string and rounding the *stored* value, money as integer minor units, `MAX_SAFE_INTEGER` and 64-bit IDs, comparing floats with a relative tolerance, and `toPrecision` |
| 2 | **[Parsing, checking and the helpers](./02-parsing-checking-helpers.md)** | `Number` vs `parseInt` vs `parseFloat` in a table, why the `Number.*` predicates exist and the globals lie, the inclusive random-integer formula, when `Math.random` is not acceptable, clamping, and the `Math.max(...[])` empty-array trap |

## Phase gate

You are done with this topic when you can say **why `(1.005).toFixed(2)` is `"1.00"`**, and **why
`isNaN("abc")` is `true` while `Number.isNaN("abc")` is `false`**.

## Where this connects

- [Phase 1 · Values, types and coercion](../../phase-1-values-and-coercion/README.md) — the float representation itself
- [Phase 4 · 15 · Normalising untrusted shapes](../../phase-4-objects-and-classes/15-normalising-untrusted-shapes/02-normalising-at-the-boundary.md) — `Number("")` being `0` at a boundary, and IDs that must stay strings
- [06 · `sort`](../06-sort/README.md) — the default string comparator, and why a random comparator is not a shuffle
- **20 · `Intl`** *(not written yet)* — the right tool for anything a user reads

---

Start → [Rounding, precision and money](./01-rounding-and-precision.md)
