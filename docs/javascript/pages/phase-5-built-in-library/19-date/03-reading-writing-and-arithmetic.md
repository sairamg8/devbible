---
title: "3 · Reading, writing and arithmetic"
sidebar_label: "3 · Reading, writing and arithmetic"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Date`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date), [`Date.prototype.getDay()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getDay), [`Date.prototype.getTimezoneOffset()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset), [`Date.prototype.setDate()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/setDate), [`Date.prototype.setMonth()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/setMonth), [`Date.prototype[Symbol.toPrimitive]()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Symbol.toPrimitive), [`Date.prototype.valueOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/valueOf), [Addition (`+`)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Addition), [Equality (`==`)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Equality). Documentation-validated; **no timings**.

## The getters come in pairs

**Every calendar getter has a UTC twin**, and the pair is the projection choice from
[chunk 1](./01-the-model-and-making-one.md) made explicit:

| Local | UTC | Returns |
|---|---|---|
| `getFullYear()` | `getUTCFullYear()` | the four-digit year |
| `getMonth()` | `getUTCMonth()` | 🔴 **0–11** |
| `getDate()` | `getUTCDate()` | 1–31 — the day of the *month* |
| `getDay()` | `getUTCDay()` | 🔴 **0–6, Sunday = 0** — the day of the *week* |
| `getHours()` | `getUTCHours()` | 0–23 |
| `getMinutes()` / `getSeconds()` / `getMilliseconds()` | UTC twins | as named |
| `getTime()` | — | epoch milliseconds; there is no local version, because the number *is* UTC |

⚠️ **`getDate` and `getDay` are the pair everyone mixes up.** `getDate` is the day of the
month, `getDay` is the weekday. Reading them as English makes the wrong guess.

🔴 **`getTimezoneOffset()` has an inverted sign.** It returns minutes, computed as UTC
minus local, so a zone *ahead* of UTC gives a *negative* number:

```js
// in Kolkata, UTC+05:30
new Date().getTimezoneOffset();   // -330
// in New York during EST, UTC-05:00
new Date().getTimezoneOffset();   // 300
```

⚠️ **And it is a property of the instant, not of the machine** — call it on a summer date
and a winter date in a DST-observing zone and you get different answers. Code that caches
"the offset" is wrong twice a year.

`getYear()` is deprecated and returns year minus 1900. It exists only to be avoided.

## Setters mutate — and that is the real hazard

```js
const d = new Date("2026-08-15T00:00:00Z");
d.setDate(20);   // 🔴 d itself changed; the return value is the new epoch number
```

🔴 **Every `set*` method mutates in place and returns a number, not the date.** Two
consequences, and the second is the one that costs time:

```js
const later = d.setDate(20);        // 🔴 `later` is a number, not a Date
```

```js
function addWeek(date) {
  date.setDate(date.getDate() + 7); // 🔴 mutates the caller's object
  return date;
}
const due = new Date();
const reminder = addWeek(due);      // `due` moved too — same object
```

✅ **Copy at every boundary.** It costs nothing and removes the whole class of bug:

```js
const addDays = (date, n) => {
  const copy = new Date(date);      // ✅ new Date(dateObject) clones
  copy.setDate(copy.getDate() + n);
  return copy;
};
```

**This is why every serious date library is immutable** — date-fns returns new objects
from every function, and `Temporal` objects cannot be mutated at all
([chunk 4](./04-formatting-and-why-a-library.md)).

## Rollover, used deliberately

The normalisation from [chunk 1](./01-the-model-and-making-one.md) is what makes calendar
arithmetic possible without a month-length table:

```js
const d = new Date(2026, 7, 15);

d.setDate(d.getDate() + 20);     // 4 September — crosses the month end correctly
d.setMonth(d.getMonth() + 6);    // six months on, leap years handled
```

**The two idioms worth memorising:**

```js
// last day of a given month — day 0 of the NEXT month
const lastDay = new Date(2026, 7 + 1, 0);     // 31 August 2026

// last day of the previous month, from any date
const d2 = new Date(someDate);
d2.setDate(0);
```

⚠️ **`setMonth` clamps by rolling forward, which is rarely what "a month later" means:**

```js
const jan31 = new Date(2026, 0, 31);
jan31.setMonth(1);                 // 🔴 3 March 2026 — February has no 31st, so it rolls
```

**There is no single right answer** to "one month after 31 January" — libraries pick
end-of-month clamping (28 February) and say so. If you are doing month arithmetic on
month-end dates, you need that decision made explicitly, and `Date` will not make it
for you.

## Differences, and the `+`/`-` asymmetry

```js
const ms = end - start;                  // ✅ milliseconds between two dates
const days = ms / 86_400_000;            // ⚠️ see the DST section below
```

🔴 **`-` subtracts and `+` concatenates**, and the reason is the `ToPrimitive` protocol:

```js
end - start;    // ✅ a number — `-` requests a NUMBER hint, so valueOf() runs
end + start;    // 🔴 "Sat Aug 15 2026…Sat Aug 22 2026…" — string concatenation
+end;           // ✅ the number, explicitly
```

**`Date` is the one built-in whose `Symbol.toPrimitive` prefers a string for the default
hint**, which `+` uses. Every other object prefers a number. The full mechanism is in
[Phase 4 · 17 · 01 · The `ToPrimitive` protocol](../../phase-4-objects-and-classes/17-tostring-valueof-toprimitive/01-the-toprimitive-protocol.md);
the practical rule is **never write `+` between two dates, and use `+d` or `d.getTime()`
whenever you want the number**.

## Comparison and equality

```js
a < b;                        // ✅ works — relational operators use the number hint
a > b;                        // ✅
a - b;                        // ✅ sort comparator: dates.sort((x, y) => x - y)

a === b;                      // 🔴 false unless they are literally the same object
a == b;                       // 🔴 also false — two objects are never == each other
+a === +b;                    // ✅ same instant
a.getTime() === b.getTime();  // ✅ same instant, spelled out
```

🔴 **Equality is reference equality**, like every object
([Phase 1 · 03 · Equality](../../phase-1-values-and-coercion/03-equality.md)). Two `Date`
objects for the identical millisecond are two objects. Relational comparison works because
`<` and `>` coerce to numbers; `==` between two objects never coerces at all.

⚠️ **"Same day" is a different question from "same instant"**, and it needs the projection
you actually mean:

```js
const sameLocalDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
```

**Comparing `toDateString()` outputs also works and reads worse; comparing
`toISOString().slice(0, 10)` compares the UTC day**, which is a third answer again. Pick
deliberately.

## DST — where 24 hours stops being a day

```js
const tomorrow = new Date(today.getTime() + 86_400_000);   // ⚠️ "24 hours later"
const tomorrow2 = new Date(today);
tomorrow2.setDate(tomorrow2.getDate() + 1);                // ✅ "the next day"
```

🔴 **On the two DST transition days these disagree.** A spring-forward day is 23 hours
long and an autumn day is 25, so adding 86,400,000 milliseconds lands on the same calendar
day or skips one, depending on direction. The `setDate` form keeps the **local wall-clock
time** and moves the calendar day, which is what "tomorrow at 9am" means to a user.

**The rule: fixed-duration arithmetic in milliseconds, calendar arithmetic with the
setters.** "Two hours from now" is milliseconds. "Tomorrow", "next month", "same time next
week" are calendar operations.

⚠️ **Dividing a millisecond difference by 86,400,000 to count days has the same flaw** —
across a DST boundary it produces a non-integer, and `Math.round` hides it until a case
lands exactly on the half. Count days by normalising both dates to local midnight first.

## Gotchas

**Symptom:** A function that "adds days" changed the caller's date
**Cause:** `set*` methods mutate in place.
**Fix:** `const copy = new Date(date)` first. Treat every `Date` as immutable.

**Symptom:** `const d2 = d.setDate(5)` produced a number
**Cause:** Setters return the new epoch milliseconds, not the date.
**Fix:** Mutate the copy, then return the copy.

**Symptom:** `date1 + date2` produced a long concatenated string
**Cause:** `+` uses the default hint, and `Date` prefers a string for it.
**Fix:** `+date1 - +date2`, or `getTime()` on both.

**Symptom:** Two dates for the same instant compared as unequal
**Cause:** `===` and `==` on objects compare references.
**Fix:** `+a === +b`.

**Symptom:** `getDate()` returned a weekday, or `getDay()` returned the wrong number
**Cause:** They are the other way round — `getDate` is the day of the month, `getDay` is
the weekday with Sunday as 0.
**Fix:** Read the pair as "date of the month" and "day of the week".

**Symptom:** A cached time-zone offset was wrong for half the year
**Cause:** `getTimezoneOffset()` depends on the instant, because of DST.
**Fix:** Call it on the date in question, never once at start-up.

**Symptom:** "One month after 31 January" became 3 March
**Cause:** `setMonth` rolls over rather than clamping to the month end.
**Fix:** Decide the rule explicitly, or use a library that documents its choice.

**Symptom:** A day counter was occasionally off by one
**Cause:** Dividing a millisecond difference by 86,400,000 across a DST boundary.
**Fix:** Normalise both dates to local midnight, then subtract.

## Interview questions

**★ Why does `date2 - date1` work but `date1 + date2` not?**
`-` requests a **number** hint, so `valueOf()` runs and returns epoch milliseconds. `+`
uses the **default** hint, and `Date` is the one built-in whose `Symbol.toPrimitive`
prefers a string for it — so both dates stringify and concatenate. Use `+d` or
`d.getTime()` whenever you want the number.

**★ How do you check whether two dates are equal?**
`+a === +b`, or `a.getTime() === b.getTime()`. `===` and `==` compare object references,
so two distinct `Date` objects for the same instant are never equal. Relational `<` and
`>` do work, because they coerce to numbers.

**★ Why is adding 86,400,000 milliseconds not the same as adding a day?**
DST. A spring-forward local day is 23 hours and an autumn day is 25, so a fixed 24-hour
addition lands on the wrong calendar day at the transitions.
`copy.setDate(copy.getDate() + 1)` keeps the local wall-clock time and moves the calendar
day, which is what "tomorrow" means. Fixed durations in milliseconds; calendar operations
with the setters.

**★ What does `getTimezoneOffset()` return, and what is surprising about it?**
Minutes, computed as UTC minus local — so it is **negative** for zones ahead of UTC
(−330 for UTC+05:30). And it depends on the instant, not just the machine, because of DST,
so it must not be cached.

**★ What is the difference between `getDate()` and `getDay()`?**
`getDate()` is the day of the month, 1–31. `getDay()` is the day of the week, 0–6 with
Sunday as 0. The names invite the opposite guess.

**How do you get the last day of a month?**
`new Date(year, month + 1, 0)` — day 0 of the next month. Out-of-range components
normalise, so this handles month lengths and leap years without a table. `d.setDate(0)`
does the same relative to an existing date.

**Why do date libraries return new objects instead of mutating?**
Because `Date`'s setters mutate, and a date passed into a function can come back changed
— a bug that surfaces far from its cause. Immutability makes every operation a value
computation. `Temporal` takes it further: its objects cannot be mutated at all.

---

← [2 · Parsing, and the one-day bug](./02-parsing-and-the-one-day-bug.md) · [Topic index](./README.md) · Next: [4 · Formatting, and why a library](./04-formatting-and-why-a-library.md) →
