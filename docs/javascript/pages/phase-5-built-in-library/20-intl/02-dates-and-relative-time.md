---
title: "2 · Dates and relative time"
sidebar_label: "2 · Dates and relative time"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Intl.DateTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat), [`Intl.DateTimeFormat` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat), [`Intl.DateTimeFormat.prototype.formatToParts()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts), [`Intl.DateTimeFormat.prototype.formatRange()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatRange), [`Intl.DateTimeFormat.prototype.resolvedOptions()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/resolvedOptions), [`Intl.RelativeTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat), [`Intl.RelativeTimeFormat.prototype.format()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat/format), [`Intl.supportedValuesOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf). Documentation-validated; **no timings**.

[19 · `Date`](../19-date/README.md) established that a date's only correct meeting with a
human is through a formatter. **This is that formatter.**

## Two ways to ask, and you may not mix them

```js
// A — the styles: pick a size, let the locale decide everything else
new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

// B — the components: name exactly which fields you want
new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "long", day: "numeric" });
```

🔴 **Mixing them throws a `TypeError`.** `dateStyle` and `timeStyle` cannot appear
alongside `year`, `month`, `day`, `hour`, `weekday` or any other component option. MDN
documents this and it is the first error most people hit:

```js
new Intl.DateTimeFormat("en", { dateStyle: "long", hour: "numeric" });   // 🔴 TypeError
```

**Choose by intent.** Styles when you want "whatever this locale considers a medium-length
date" — which is almost always the right answer for UI. Components when the layout is a
requirement, like a chart axis that must read `Aug 15`.

### The styles

Both `dateStyle` and `timeStyle` take `"full"`, `"long"`, `"medium"` or `"short"`, and
what each produces is the locale's business, not yours:

```js
const d = new Date("2026-08-15T09:30:00Z");
new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(d);     // Saturday 15 August 2026
new Intl.DateTimeFormat("en-US", { dateStyle: "short" }).format(d);    // 8/15/26
```

⚠️ **Do not read those outputs as a contract.** The exact text is CLDR data and can change
between engine versions; that is the point of asking for a *style* rather than a layout.
Never assert on a formatted string in a test — assert on `formatToParts`, or on the value.

### The components

| Option | Values |
|---|---|
| `weekday` | `"long"` `"short"` `"narrow"` |
| `year` | `"numeric"` `"2-digit"` |
| `month` | `"numeric"` `"2-digit"` `"long"` `"short"` `"narrow"` |
| `day`, `hour`, `minute`, `second` | `"numeric"` `"2-digit"` |
| `timeZoneName` | `"short"` `"long"` `"shortOffset"` `"longOffset"` |
| `era`, `fractionalSecondDigits` | as documented |

**Only the components you name appear.** `{ month: "long", year: "numeric" }` gives
`"August 2026"` — a month-and-year header without string surgery.

## The `timeZone` option

```js
const tokyo = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
  timeZoneName: "short",
});
tokyo.format(new Date());
```

🔴 **This is the only place plain JavaScript understands named time zones**, and it is
display-only — the point made in
[19 · 04](../19-date/04-formatting-and-why-a-library.md). You can render an instant in
`Asia/Tokyo`; you cannot ask `Date` to compute in it.

**Two practical uses beyond showing another zone:**

```js
// 1 · what zone is this machine in?
Intl.DateTimeFormat().resolvedOptions().timeZone;   // e.g. "Asia/Kolkata"

// 2 · pin the output so it does not vary by host
new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", dateStyle: "short" });
```

**The first line is the standard way to detect the user's IANA zone** — worth knowing,
because it is the value you send to a server that does need to compute in that zone.
`Intl.supportedValuesOf("timeZone")` lists every zone the runtime knows, which is where a
zone picker's options come from.

## Hours — `hour12` and `hourCycle`

```js
{ hour12: true }         // force 12-hour
{ hour12: false }        // force 24-hour
{ hourCycle: "h23" }     // 00–23   — the finer control
{ hourCycle: "h11" }     // 0–11 with am/pm
```

⚠️ **Leave both unset unless you have a reason.** The locale already knows whether its
readers expect 12- or 24-hour time, and forcing one is a common way to make a UI feel
foreign. `hourCycle` exists for the midnight edge cases — whether midnight is `24:00` or
`00:00`, `12 AM` or `0 AM` — which differ by locale.

## `formatToParts` and `formatRange`

```js
const parts = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).formatToParts(d);
// [{type:"day",value:"15"}, {type:"literal",value:" "}, {type:"month",value:"August"}, …]
```

**Use it when the design needs the pieces separately** — a calendar cell with the day
large and the month small, a `<time>` element with a machine `datetime` attribute and
human text, or a test that must not depend on exact punctuation:

```js
const get = (t) => parts.find((p) => p.type === t)?.value;
`<time datetime="${d.toISOString()}">${get("day")} ${get("month")}</time>`;
```

**`formatRange` collapses a range intelligently**, which is genuinely hard to do by hand:

```js
const f = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });
f.formatRange(new Date("2026-08-15"), new Date("2026-08-17"));
// the locale's form for a same-month range — the month is not repeated
```

There is a `formatRangeToParts` too, and its parts carry a `source` field saying whether
each piece came from the start date, the end date, or is shared.

## `RelativeTimeFormat` — "3 days ago"

```js
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

rtf.format(-1, "day");    // "yesterday"
rtf.format(1, "day");     // "tomorrow"
rtf.format(-3, "day");    // "3 days ago"
rtf.format(2, "hour");    // "in 2 hours"
```

🔴 **`numeric: "auto"` is the option that makes it feel human.** The default is
`"always"`, which gives `"1 day ago"` where a person would say `"yesterday"`. Almost every
UI wants `"auto"`.

**Sign carries direction: negative is the past, positive is the future.** Units are
`"year"`, `"quarter"`, `"month"`, `"week"`, `"day"`, `"hour"`, `"minute"`, `"second"`
(plural forms are accepted too).

⚠️ **It does not choose the unit for you.** You pass the number *and* the unit, so the
"how long ago" logic is yours. This is the helper everyone ends up writing:

```js
const DIVISIONS = [
  [60, "second"], [60, "minute"], [24, "hour"],
  [7, "day"], [4.34524, "week"], [12, "month"], [Infinity, "year"],
];

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function timeAgo(date, from = new Date()) {
  let delta = (date - from) / 1000;              // seconds; negative = past
  for (const [span, unit] of DIVISIONS) {
    if (Math.abs(delta) < span) return rtf.format(Math.round(delta), unit);
    delta /= span;
  }
}
```

⚠️ **Two honest limits in that helper.** Weeks and months are approximated by division, so
"1 month ago" can be a few days off at the boundaries — for calendar-exact answers you
need real date arithmetic ([19 · 03](../19-date/03-reading-writing-and-arithmetic.md)) or
a library. And a relative timestamp rendered once goes stale; a live "2 minutes ago" needs
re-rendering on a timer.

🔴 **Accessibility: relative time is a summary, not the fact.** Put the absolute time in
the `datetime` attribute or a `title` so it is available to a screen reader and to anyone
who needs the real value:

```js
`<time datetime="${d.toISOString()}" title="${absolute.format(d)}">${timeAgo(d)}</time>`;
```

## Gotchas

**Symptom:** `TypeError` from a `DateTimeFormat` constructor
**Cause:** `dateStyle`/`timeStyle` mixed with component options such as `hour` or `month`.
**Fix:** Pick one system. Styles for UI, components when the layout is a requirement.

**Symptom:** A test asserting a formatted date string broke after a runtime upgrade
**Cause:** The exact text comes from CLDR data and is not a stable contract.
**Fix:** Assert on `formatToParts` or on the underlying value.

**Symptom:** Only some requested fields appeared
**Cause:** With component options, only the components you name are rendered.
**Fix:** Name every field you need — or use `dateStyle`.

**Symptom:** Times were right in the browser and wrong in server-rendered HTML
**Cause:** No `timeZone`, so each host used its own.
**Fix:** Pass an explicit `timeZone` where output must be stable, and check
`resolvedOptions().timeZone`.

**Symptom:** "1 day ago" where the design said "yesterday"
**Cause:** `numeric` defaults to `"always"`.
**Fix:** `{ numeric: "auto" }`.

**Symptom:** "in -3 days"
**Cause:** The sign already carries direction; the code negated it as well.
**Fix:** Pass the signed delta once — negative for the past.

**Symptom:** A relative timestamp froze at "2 minutes ago"
**Cause:** It was formatted once at render.
**Fix:** Re-render on an interval, and keep the absolute time in `datetime`.

**Symptom:** A 12-hour clock appeared for users who expect 24-hour
**Cause:** `hour12` was forced.
**Fix:** Leave it unset and let the locale decide.

## Interview questions

**★ What is the difference between `dateStyle` and the component options, and what happens
if you use both?**
`dateStyle`/`timeStyle` ask for a locale-decided format at a chosen size; the component
options name exactly which fields to render. Using both throws a `TypeError`. Styles are
the right default for UI, because the locale knows its own conventions; components are for
when the layout itself is a requirement.

**★ How do you display a date in a specific time zone?**
The `timeZone` option on `Intl.DateTimeFormat`, with an IANA name. It is display-only —
`Date` still computes in local time and UTC alone. `Intl.DateTimeFormat().resolvedOptions().timeZone`
is also how you detect the user's own zone.

**★ How would you build "3 days ago"?**
`Intl.RelativeTimeFormat` with `numeric: "auto"`, so `-1, "day"` renders as "yesterday".
It does not pick the unit — you compute the delta and walk a table of divisions to choose
seconds, minutes, hours, days and so on. Weeks and months come out approximate, and the
absolute time should stay in the `datetime` attribute for accessibility.

**★ Why should a test never assert on a formatted date string?**
The output comes from CLDR locale data, which changes between engine and ICU versions —
spacing, separators and even wording. Assert on `formatToParts` or on the value being
formatted.

**When is `formatToParts` the right tool for dates?**
When the design needs the pieces separately — a large day over a small month, a `<time>`
element with both machine and human forms — or when you need a stable assertion. Parsing
the formatted string instead is unsafe across locales.

**Why not force `hour12: false` for consistency?**
Because consistency across users is not the goal — correctness for each user is. The
locale already encodes whether its readers expect a 12- or 24-hour clock, and overriding it
makes the interface feel foreign. `hourCycle` exists for the genuine midnight edge cases.

---

← [1 · The shape, and `NumberFormat`](./01-the-shape-and-numberformat.md) · [Topic index](./README.md) · Next: [3 · Text — `Collator`, `ListFormat`, `PluralRules`, `Segmenter`](./03-text-collator-list-plural-segmenter.md) →
