---
title: "2 · Parsing, and the one-day bug"
sidebar_label: "2 · Parsing and the one-day bug"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Date Time String Format](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format), [`Date.parse()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse), [`Date()` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date), [`Date.prototype.toISOString()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString), [`<input type="date">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/date), [`Temporal.PlainDate`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/PlainDate). Documentation-validated; **no timings**.

`new Date(string)` and `Date.parse(string)` run the same algorithm — one returns an
object, the other a number. **And that algorithm is only specified for one format.**

## Only ISO 8601 is guaranteed

The spec defines a single **Date Time String Format**, a simplification of ISO 8601.
Everything outside it is *implementation-defined*: engines may accept it, reject it, or
interpret it differently from each other, and MDN says so explicitly.

**Inside the format:**

```js
new Date("2026-08-15");                     // date-only
new Date("2026-08-15T09:30:00Z");           // UTC
new Date("2026-08-15T09:30:00+05:30");      // explicit offset
new Date("2026-08-15T09:30:00.123Z");       // milliseconds
new Date("2026-08");                        // month precision
new Date("2026");                           // year precision
```

**Outside it — do not rely on any of these:**

```js
new Date("08/15/2026");        // ⚠️ widely accepted as US order, not required to be
new Date("15/08/2026");        // ⚠️ ambiguous; engines disagree, some give Invalid Date
new Date("2026-8-15");         // ⚠️ NOT ISO — no leading zeros, so it falls to the
                               //    implementation-defined path
new Date("2026-08-15 09:30");  // ⚠️ a space instead of "T" — also not ISO
new Date("Aug 15, 2026");      // ⚠️ implementation-defined
```

🔴 **The ones that "work everywhere you tested" are the dangerous ones.** They work
because the engines you tried happen to share a fallback parser, and the failure appears
later on a runtime you did not try.

## 🔴 The one-day bug

**Two strings that look like the same moment are not:**

```js
new Date("2026-08-15");             // midnight UTC
new Date("2026-08-15T00:00:00");    // midnight LOCAL
```

**The rule, from the spec:**

| Form | Interpreted as |
|---|---|
| **date-only** — `"2026-08-15"`, `"2026-08"`, `"2026"` | **UTC** |
| **date-time with `Z` or an offset** — `"…T09:00:00Z"`, `"…+05:30"` | exactly that instant |
| **date-time with no offset** — `"2026-08-15T09:00:00"` | **local time** |

⚠️ **A date-only string is UTC; add a time and it becomes local.** That single asymmetry
is the most common `Date` bug in production, and it shows up as *dates displaying one day
early*:

```js
// browser running at UTC-5
const d = new Date("2026-08-15");   // midnight UTC = 19:00 on the 14th, locally
d.getDate();                        // 🔴 14
d.toLocaleDateString();             // 🔴 the 14th of August
```

**Nothing here is broken.** The string named a *calendar date*, `Date` stored it as an
*instant*, and the display projected that instant back through a different time zone. The
day shifted because the instant was never the thing you meant.

⚠️ **It reverses sign with the offset.** West of UTC the date shows a day early; east of
UTC a midnight-local date submitted to the server can arrive as the previous day. Teams
usually find one direction and fix it with a `+ 1`, which then breaks the other.

## The distinction underneath it

**There are two different things people call "a date", and `Date` only models one:**

| | An **instant** | A **plain date** |
|---|---|---|
| Example | when an order was placed | a birthday, a public holiday, a due date |
| Is it a point on the world's timeline? | yes | no — it is the same date everywhere |
| Correct storage | epoch ms, or ISO with `Z` | the text `"YYYY-MM-DD"` |
| `Date` models it? | ✅ | 🔴 no |

🔴 **A birthday is not an instant.** Someone born on 15 August was born on 15 August in
every time zone, and there is no moment in time that is true of. Storing it as a `Date`
forces a time onto it, and every conversion afterwards can move the day.

✅ **So: keep plain dates as strings.** `"2026-08-15"` compares, sorts and serialises
correctly as text, and it cannot drift.

```js
const birthday = "1994-08-15";                      // ✅ store and compare as text
birthday < "1994-12-01";                            // ✅ lexicographic = chronological
```

**This is the case `Temporal.PlainDate` exists for**, and it is why `Temporal` is more
than a tidier `Date` — **24 · `Temporal`** *(not written yet)*.

## Parsing safely

**If you mean an instant, insist on an offset:**

```js
const parseInstant = (s) => {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  if (!/[Zz]|[+-]\d{2}:\d{2}$/.test(s)) return null;   // ✅ refuse ambiguous input
  return d;
};
```

**If you mean a calendar date and need it as a local `Date`** — for a date picker, a
calendar grid — build it from components rather than parsing:

```js
const [y, m, d] = "2026-08-15".split("-").map(Number);
const localMidnight = new Date(y, m - 1, d);   // ✅ local, unambiguous, no UTC hop
```

⚠️ **The `m - 1` is the zero-indexed month from
[chunk 1](./01-the-model-and-making-one.md)**, and it is the reason this is written out
rather than hidden in a helper someone will "simplify".

**Round-tripping your own output is always safe:**

```js
const d2 = new Date(d.toISOString());   // ✅ lossless — toISOString emits ISO with Z
```

**And `<input type="date">` gives you `"YYYY-MM-DD"`**, which means the browser hands you
a plain date and the temptation to `new Date()` it is exactly the bug above.

## Timestamps from other systems

```js
new Date(1786838400);        // 🔴 1970 — that was seconds, not milliseconds
new Date(1786838400 * 1000); // ✅
```

⚠️ **Unix timestamps are conventionally in seconds; JavaScript's are in milliseconds.**
JWT `exp` and `iat`, most Unix tooling and many REST APIs use seconds. The symptom is
unmistakable once seen — every date lands in January 1970 — but only if you look at the
year rather than at "the date is wrong".

**A ten-digit number is seconds; a thirteen-digit number is milliseconds**, for any date
in the current era. That is the fastest way to tell them apart in a payload.

## Gotchas

**Symptom:** Dates display one day earlier than stored
**Cause:** A date-only ISO string is parsed as **UTC**, then displayed in a local zone
behind UTC.
**Fix:** Keep calendar dates as `"YYYY-MM-DD"` text, or build a local `Date` from split
components. Do not patch it with `+ 1`.

**Symptom:** The same string parses differently in two browsers or in Node
**Cause:** It is not ISO 8601, so parsing is implementation-defined.
**Fix:** Use ISO, or a real parsing library with an explicit format string.

**Symptom:** `"2026-8-15"` behaved differently from `"2026-08-15"`
**Cause:** No leading zeros means it is not the spec format, so it takes the
implementation-defined path — including, in some engines, being read as **local** rather
than UTC.
**Fix:** Zero-pad, or construct from components.

**Symptom:** Every parsed date is in 1970
**Cause:** The source timestamp is in seconds; `Date` expects milliseconds.
**Fix:** `× 1000`. Ten digits = seconds, thirteen = milliseconds.

**Symptom:** A birthday changes when the user travels or the server moves region
**Cause:** It was stored as an instant, which is not what a birthday is.
**Fix:** Store `"YYYY-MM-DD"` text.

**Symptom:** `Date.parse` returned `NaN` for input that looks fine
**Cause:** Outside the ISO format, engines are free to reject.
**Fix:** Normalise to ISO at the boundary you receive it.

**Symptom:** A `+ 1` day fix worked in one region and broke in another
**Cause:** The offset's sign flips either side of UTC, so a shift that corrects one
direction doubles the other.
**Fix:** Remove the instant conversion instead of compensating for it.

## Interview questions

**★ Why can `new Date("2026-08-15")` and `new Date("2026-08-15T00:00:00")` be a day
apart?**
The spec treats a **date-only** string as UTC and a **date-time string with no offset** as
local. So the first is midnight UTC and the second is midnight wherever the code runs. In
a zone behind UTC the first one's local date is the previous day, which is the classic
"dates show one day early" bug.

**★ Which date strings is `Date` actually required to parse?**
Only the ISO 8601 Date Time String Format the spec defines. `"08/15/2026"`,
`"Aug 15, 2026"`, `"2026-8-15"` and `"2026-08-15 09:00"` are all implementation-defined —
engines may accept, reject or reinterpret them, and relying on one engine's behaviour is
how the bug reaches production.

**★ How would you store a birthday?**
As the text `"YYYY-MM-DD"`. A birthday is a plain date, not an instant — it is the same
date in every time zone, so there is no moment on the world timeline that represents it.
Storing it as a `Date` forces a time onto it and every conversion afterwards can move the
day. `Temporal.PlainDate` is the type-level version of this argument.

**★ An API returns `1786838400` and every date shows 1970. Why?**
It is a Unix timestamp in **seconds**; `Date` takes **milliseconds**. Multiply by 1000.
Ten digits is seconds, thirteen is milliseconds.

**How do you parse a user-entered date safely?**
Not with `Date`. Take a known format — `<input type="date">` gives you `"YYYY-MM-DD"` —
and build from components, or use a library with an explicit format string. If the input
is meant to be an instant, require an offset or `Z` and reject anything ambiguous rather
than guessing.

**Is `new Date(d.toISOString())` safe?**
Yes — `toISOString` emits the spec format with a `Z`, so it round-trips losslessly. It is
your own output; the danger is only in strings from elsewhere.

---

← [1 · The model, and making one](./01-the-model-and-making-one.md) · [Topic index](./README.md) · Next: [3 · Reading, writing and arithmetic](./03-reading-writing-and-arithmetic.md) →
