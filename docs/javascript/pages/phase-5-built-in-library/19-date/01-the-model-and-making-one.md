---
title: "1 · The model, and making one"
sidebar_label: "1 · The model and making one"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Date`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date), [`Date()` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date), [`Date.now()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now), [`Date.UTC()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/UTC), [`Date.prototype.getTime()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTime), [`Date.prototype.valueOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/valueOf), [`isNaN()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/isNaN), [`Number.isNaN()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isNaN). Documentation-validated; **no timings**.

## One number, and a calendar projected onto it

```js
const d = new Date();
d.getTime();     // e.g. 1786838400000 — milliseconds since 1970-01-01T00:00:00Z
+d;              // the same number
```

**That single number is the entire state of a `Date`.** There is no year field, no month
field, no time zone stored anywhere. `getFullYear()` does not read a year — it computes
one, by taking the number, applying the *host machine's current* time-zone rules, and
reporting what the calendar says.

🔴 **Two consequences that explain most of this topic:**

- **The same `Date` reports different things on different machines.** `getHours()` on a
  server in UTC and on a laptop in Kolkata give different answers for the identical
  instant. Nothing is wrong; the projection differs.
- **A `Date` cannot represent "the 15th of August" without a time.** It is always a
  precise instant. A birthday is not an instant, and forcing one into a `Date` is where
  the one-day bug in [chunk 2](./02-parsing-and-the-one-day-bug.md) comes from.

**The range is roughly ±273,790 years around the epoch** — the spec allows ±8,640,000,000,000,000
milliseconds. Beyond that you get an invalid date rather than an error.

## The four ways to make one

```js
new Date();                          // 1 · now
new Date(1786838400000);             // 2 · from epoch milliseconds — unambiguous
new Date("2026-08-15T09:00:00Z");    // 3 · from a string — see chunk 2
new Date(2026, 7, 15, 9, 0, 0);      // 4 · from components — LOCAL time
new Date(anotherDate);               // and the copy form (same as form 2)
```

**Form 2 is the only one with no ambiguity at all.** Form 3 has an entire chunk of
warnings attached. Form 4 has the two traps below.

### 🔴 Trap one — the month is zero-indexed and nothing else is

```js
new Date(2026, 7, 15);   // 15 August 2026 — 7 is AUGUST
new Date(2026, 8, 15);   // 15 September 2026
```

**Year is a year, day is a day, hours are hours — only the month counts from zero.** It
is inherited from C's `struct tm` and it is never going away. Every reader of the code has
to remember it, which is the argument for naming it:

```js
const AUG = 7;
new Date(2026, AUG, 15);                  // ✅ survives review
new Date("2026-08-15T00:00:00+05:30");    // ✅ better still — no index at all
```

⚠️ **The getter matches the constructor**, so `getMonth()` also returns 0–11 while
`getDate()` returns 1–31. Code that formats by hand and forgets the `+ 1` produces a
report a month early, all year, silently.

### 🔴 Trap two — years 0 to 99 mean 1900 to 1999

```js
new Date(99, 0, 1);      // 🔴 1 January 1999 — not year 99
new Date(26, 7, 15);     // 🔴 15 August 1926
new Date(2026, 7, 15);   // ✅ what you meant
```

**Any year argument in `0`–`99` has 1900 added to it.** This bites when the year comes
from parsing user input or a two-digit field, and the result is off by nineteen centuries
in a way that looks like a data problem rather than an API one. To build a genuinely
early year, use `setFullYear`:

```js
const early = new Date(0, 0, 1);
early.setFullYear(99);   // ✅ actually year 99
```

### Out-of-range components roll over — they never throw

```js
new Date(2026, 0, 32);    // 1 February 2026 — day 32 of January
new Date(2026, 12, 1);    // 1 January 2027 — month 12 of 2026
new Date(2026, 0, 0);     // 31 December 2025 — day 0 is "the day before the 1st"
new Date(2026, 1, 30);    // 2 March 2026 — February has no 30th
```

**This is deliberate, and it is the single most useful thing about `Date`.** It is how you
do calendar arithmetic without a table of month lengths or a leap-year rule — the idioms
are in [chunk 3](./03-reading-writing-and-arithmetic.md).

⚠️ **It is also why validation must happen before construction.** `new Date(2026, 1, 30)`
does not tell you that 30 February does not exist; it hands you 2 March. If a user typed
that, check the components round-trip:

```js
const valid = (y, m, d) => {
  const dt = new Date(y, m, d);
  return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
};
valid(2026, 1, 30);   // false ✅
```

## `Date.now()` and `Date.UTC()` — the two statics

```js
Date.now();                          // number, not a Date — "now" in epoch ms
Date.UTC(2026, 7, 15, 9, 0, 0);      // number, not a Date — components read as UTC
new Date(Date.UTC(2026, 7, 15));     // ✅ the UTC counterpart of form 4
```

**Both return numbers.** `Date.now()` is the allocation-free way to timestamp something,
and it is what you want for "when did this happen"; it is *not* what you want for
measuring elapsed time in a benchmark, where `performance.now()` is monotonic and
`Date.now()` can jump when the system clock is adjusted.

⚠️ **`Date.UTC` inherits both constructor traps** — zero-indexed months and the 0–99 year
rule. What it fixes is only the time zone.

## `Invalid Date` — a failure that never throws

```js
const d = new Date("not a date");

d;                    // Invalid Date
d instanceof Date;    // 🔴 true — it is a perfectly ordinary Date object
d.getTime();          // NaN
d.getFullYear();      // NaN
String(d);            // "Invalid Date"
```

🔴 **Every failure mode of `Date` produces this, and none of them throws.** A bad string,
an out-of-range number, a component that pushes past the representable range — all of them
give you an object that passes `instanceof`, survives being stored, and only reveals
itself when a `NaN` shows up somewhere far from the cause.

**The check, and the two wrong versions of it:**

```js
Number.isNaN(d.getTime());   // ✅ the reliable test
Number.isNaN(+d);            // ✅ same thing, shorter

isNaN(d);                    // ⚠️ works, via coercion — but the global isNaN coerces
                             //    anything, so it hides real type mistakes
d === "Invalid Date";        // 🔴 never true — that is only what String(d) gives
d.toString() === "Invalid Date";  // 🔴 the message text is not guaranteed
```

**Write it once, at the boundary:**

```js
const parseDate = (input) => {
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
};
```

⚠️ **`toISOString()` is the one method that does throw** on an invalid date — a
`RangeError`. So a value that has been quietly `NaN` since it was parsed finally surfaces
inside `JSON.stringify`, in a completely different part of the program
([chunk 4](./04-formatting-and-why-a-library.md)).

## Gotchas

**Symptom:** The month is one off everywhere
**Cause:** `getMonth()` and the constructor's month argument are 0–11.
**Fix:** `+ 1` when displaying, a named constant when constructing — or format with
`toLocaleDateString` and never touch the index.

**Symptom:** A date came out in the 1900s
**Cause:** A year argument between `0` and `99` has 1900 added to it.
**Fix:** Pass the full year; use `setFullYear` for genuinely early years.

**Symptom:** `new Date(2026, 1, 30)` silently became 2 March
**Cause:** Out-of-range components roll over rather than failing.
**Fix:** Validate by round-tripping the components before trusting the date.

**Symptom:** A `NaN` appeared in output far from any date code
**Cause:** An `Invalid Date` propagated — it passes `instanceof`, stores fine, and only
its arithmetic is `NaN`.
**Fix:** Validate at the parse boundary and return `null` instead.

**Symptom:** `JSON.stringify` threw `RangeError: Invalid time value`
**Cause:** `toISOString` throws on an invalid date, and `toJSON` calls it.
**Fix:** Find the parse that produced it; the stringify is only the messenger.

**Symptom:** Elapsed-time measurements were sometimes negative
**Cause:** `Date.now()` follows the system clock, which can be adjusted backwards.
**Fix:** `performance.now()` for durations; `Date.now()` for timestamps.

**Symptom:** The same timestamp displays a different day on two machines
**Cause:** The stored number is an instant; every getter projects it through the host's
local time zone.
**Fix:** Nothing is broken — decide deliberately whether the display should be local or a
fixed zone ([chunk 4](./04-formatting-and-why-a-library.md)).

## Interview questions

**★ What does a `Date` actually store?**
One number: milliseconds since the Unix epoch, UTC. No year, month or time-zone fields
exist. Every calendar method computes its answer by projecting that number through the
host machine's current local time-zone rules, which is why the same `Date` reports
different hours on different machines.

**★ Why is `new Date(2026, 7, 15)` the 15th of August?**
Months are zero-indexed — a `struct tm` inheritance. Days, years, hours and minutes are
not, so the month is the only argument that counts from zero, in both the constructor and
`getMonth()`.

**★ What happens with `new Date(2026, 0, 32)`?**
It rolls over to 1 February 2026. Out-of-range components never throw; they normalise.
That is the mechanism behind the standard idioms — `setDate(0)` for the last day of the
previous month, `new Date(y, m + 1, 0)` for the last day of month `m` — and it is also why
invalid user input has to be validated by round-tripping the components.

**★ How do you test whether a date is valid?**
`Number.isNaN(d.getTime())`. An invalid date is a real `Date` object that passes
`instanceof` and whose internal number is `NaN`; nothing throws at construction. Comparing
against the string `"Invalid Date"` is not reliable.

**Why does `Date.now()` exist when `new Date().getTime()` gives the same number?**
It skips constructing an object for a value you only wanted as a number. For measuring
durations neither is right — `performance.now()` is monotonic, while `Date.now()` follows
the wall clock and can move backwards when the system clock is corrected.

**What is the difference between `new Date(...)` and `Date.UTC(...)`?**
`Date.UTC` returns a **number**, and it reads its components as UTC rather than local
time. Wrap it — `new Date(Date.UTC(...))` — to get a `Date`. It still has zero-indexed
months and the 0–99 year rule.

---

[Topic index](./README.md) · Next: [2 · Parsing, and the one-day bug](./02-parsing-and-the-one-day-bug.md) →
