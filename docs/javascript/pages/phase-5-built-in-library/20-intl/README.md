---
title: "20 · `Intl`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Intl`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl), [`Intl.NumberFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat), [`Intl.DateTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat), [`Intl.RelativeTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat), [`Intl.Collator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator), [`Intl.ListFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/ListFormat), [`Intl.PluralRules`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules), [`Intl.Segmenter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter), [`Intl.supportedValuesOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf). Documentation-validated; **no timings**.

**`Intl` is a large, already-installed internationalisation library that most codebases
reimplement badly by hand.** Currency symbols, thousands separators, "3 days ago", sorting
names with accents, "1 item" versus "2 items", counting the characters in an emoji — every
one of them is a solved problem sitting in the runtime, and every one of them is commonly
solved again with a ternary and a hard-coded string.

🔴 **It is not only for multi-language apps.** A single-locale product still needs correct
currency rendering, correct plurals, and a sort that puts `item10` after `item9`. `Intl`
is where those live, and reaching for it is usually *less* code than not.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The shape, and `NumberFormat`](./01-the-shape-and-numberformat.md)** | The one shape all seven constructors share — `(locales, options)`, `format`, `formatToParts`, `resolvedOptions`, `supportedLocalesOf`; how a locale is negotiated and why `undefined` is usually the right first argument; 🔴 **why you build the formatter once**; then `NumberFormat` in full — currency, percent, units, fraction and significant digits, compact notation, sign display — and the money rule it does not solve |
| 2 | **[Dates and relative time](./02-dates-and-relative-time.md)** | `DateTimeFormat` — `dateStyle`/`timeStyle` versus component options and 🔴 **why mixing them throws**; the `timeZone` option; `hour12` and `hourCycle`; `formatToParts` for a layout the options cannot express; `formatRange`; then `RelativeTimeFormat`, `numeric: "auto"` for *yesterday* instead of *1 day ago*, and the unit-picking helper everyone ends up writing |
| 3 | **[Text — `Collator`, `ListFormat`, `PluralRules`, `Segmenter`](./03-text-collator-list-plural-segmenter.md)** | `Collator` and why `localeCompare` in a sort is the slow way to do it; `sensitivity` and `numeric: true` for natural ordering; `ListFormat` for "a, b, and c"; `PluralRules` and why `n === 1 ? "item" : "items"` is wrong in most of the world; and `Segmenter` — the only correct way to count characters, words or sentences in Unicode text |

## The one shape

```js
const f = new Intl.Xxx(locales, options);   // build once — this is the expensive part
f.format(value);                            // call many times
f.formatToParts(value);                     // same output, as tagged pieces
f.resolvedOptions();                        // what it actually decided to do
Intl.Xxx.supportedLocalesOf([...]);         // which of these the runtime has data for
```

**Learn it once and all seven follow.** The differences are entirely in the `options`
object and in what `format` takes.

## The seven, and when each one is the answer

| Constructor | Answers |
|---|---|
| `NumberFormat` | money, percentages, units, compact counts, decimal places |
| `DateTimeFormat` | any date or time shown to a person, in any zone |
| `RelativeTimeFormat` | "3 days ago", "in 2 hours", "yesterday" |
| `Collator` | sorting and comparing human text |
| `ListFormat` | "apples, pears and plums" |
| `PluralRules` | choosing between singular, plural and the forms English does not have |
| `Segmenter` | splitting text into characters, words or sentences — correctly |

**Also in the namespace, outside this topic's scope:** `Intl.DisplayNames` (the name of a
language, region or currency in the reader's language), `Intl.Locale` (parsing and
manipulating a locale tag), `Intl.DurationFormat`, and `Intl.supportedValuesOf` — which
enumerates every time zone, currency, calendar or unit the runtime knows:

```js
Intl.supportedValuesOf("timeZone");   // every IANA zone this engine has
Intl.supportedValuesOf("currency");   // every ISO 4217 code it can format
```

## Phase gate

You are done with this topic when you can say **why a formatter should be built outside
the loop that uses it**, and **why `count === 1 ? "item" : "items"` is a bug in most
languages**.

## Where this connects

- [19 · `Date`](../19-date/README.md) — the value `DateTimeFormat` renders, and why formatting is the only place a `Date` should meet a human
- [11 · `Number` and `Math`](../11-number-and-math/README.md) — `toFixed` and the rounding this replaces
- [06 · `sort`](../06-sort/README.md) — the comparator `Collator` supplies
- [12 · String searching](../12-string-searching/README.md) — `localeCompare`, the one-off form of `Collator`
- [Phase 1 · 10 · Strings are UTF-16](../../phase-1-values-and-coercion/10-strings-are-utf16.md) — why `.length` is not a character count, which is what `Segmenter` fixes
- [Phase 1 · 06 · Numbers are doubles](../../phase-1-values-and-coercion/06-numbers-are-doubles.md) — why formatting money is not the same as storing it

---

Start → [1 · The shape, and `NumberFormat`](./01-the-shape-and-numberformat.md)
