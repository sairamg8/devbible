---
title: "1 · The types"
sidebar_label: "1 · The types"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Temporal`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal), [`Temporal.PlainDate`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/PlainDate), [`Temporal.PlainTime`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/PlainTime), [`Temporal.PlainDateTime`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/PlainDateTime), [`Temporal.ZonedDateTime`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/ZonedDateTime), [`Temporal.Instant`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/Instant), [`Temporal.PlainYearMonth`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/PlainYearMonth), [`Temporal.PlainMonthDay`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/PlainMonthDay), [`Temporal.Now`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/Now). Documentation-validated; **no timings**.

## Choosing a type is the whole skill

**Ask two questions about the value, in this order:**

1. **Is it a point on the world's timeline** — the same moment for everyone? → an
   **`Instant`**, or a **`ZonedDateTime`** if the local calendar reading matters too.
2. **Is it a calendar or clock reading with no zone attached?** → one of the **`Plain`**
   types, picked by which fields it actually has.

```js
Temporal.Now.instant();                       // the moment, zone-free
Temporal.Now.zonedDateTimeISO();              // the moment, in this machine's zone
Temporal.Now.plainDateISO();                  // today's calendar date here
Temporal.Now.plainTimeISO();
Temporal.Now.timeZoneId();                    // e.g. "Asia/Kolkata"
```

🔴 **`Temporal.Now` has no single "now".** Every method names the type it returns, so you
cannot accidentally get a zoned value where you wanted a plain one — the mistake that
produces the one-day bug in
[19 · 02](../19-date/02-parsing-and-the-one-day-bug.md).

### Worked choices

```js
// a birthday — the same date everywhere, no time, no zone
const birthday = Temporal.PlainDate.from("1994-08-15");

// a recurring anniversary with no year
const anniversary = Temporal.PlainMonthDay.from("08-15");

// a card expiry
const expiry = Temporal.PlainYearMonth.from("2028-04");

// opening time — a wall clock with no date
const opens = Temporal.PlainTime.from("09:00");

// a log entry — a fixed point on the timeline
const loggedAt = Temporal.Instant.from("2026-08-15T09:30:00Z");

// a meeting — a wall-clock time in a real place
const meeting = Temporal.ZonedDateTime.from("2026-08-15T09:00[Europe/London]");
```

⚠️ **`ZonedDateTime`'s string form carries the zone in brackets**, which is the point: the
value is self-describing, and round-trips through `toString()` without losing the zone.
That is exactly what an ISO string plus a separate `timeZone` column cannot promise.

## `PlainDateTime` — the type people forget they need

**A date and a time with no zone.** It sounds useless until you have the case:

```js
const slot = Temporal.PlainDateTime.from("2026-08-15T09:00");
```

**"Every branch opens at 09:00 on the 15th" is a `PlainDateTime`.** It is not one instant —
it is a different instant in every branch's zone. Resolving it is a deliberate step:

```js
slot.toZonedDateTime("Europe/London");   // ✅ now it is a real moment
slot.toZonedDateTime("Asia/Tokyo");      // ✅ a different one
```

🔴 **That resolution is the step `Date` performs silently and wrongly.** `new
Date("2026-08-15T09:00")` picks the host machine's zone without asking, which is why the
same code produces different instants on a developer laptop and a UTC server
([19 · 02](../19-date/02-parsing-and-the-one-day-bug.md)).

## Months are 1-based

```js
Temporal.PlainDate.from({ year: 2026, month: 8, day: 15 });   // ✅ 8 is August
new Date(2026, 8, 15);                                        // 🔴 September
```

**One of the most-cited `Date` traps simply does not exist here**
([19 · 01](../19-date/01-the-model-and-making-one.md)). Nor does the years-`0`-to-`99`
rule, nor silent rollover: out-of-range fields are rejected or clamped according to an
explicit `overflow` option rather than quietly becoming a different date.

```js
Temporal.PlainDate.from({ year: 2026, month: 2, day: 30 });                        // clamps to the 28th
Temporal.PlainDate.from({ year: 2026, month: 2, day: 30 }, { overflow: "reject" }); // 🔴 throws
```

⚠️ **`"reject"` is the option to reach for on user input**, where silently accepting an
impossible date is how bad data enters a system.

## Everything is immutable

```js
const d = Temporal.PlainDate.from("2026-08-15");
const later = d.add({ days: 20 });

d.toString();       // "2026-08-15" — unchanged
later.toString();   // "2026-09-04"
```

🔴 **There are no setters.** `Date`'s `setDate`/`setMonth` mutate in place and return a
number, which is why a date passed into a function can come back changed
([19 · 03](../19-date/03-reading-writing-and-arithmetic.md)). `Temporal` objects cannot be
mutated at all, so "copy before you modify" stops being a rule you have to remember.

**The replacement for a setter is `with`**, which returns a new value with some fields
changed:

```js
d.with({ day: 1 });          // first of the same month
d.with({ year: 2027 });      // same month and day, next year
```

## Conversions are explicit, and lossy ones are refused

**Widening — adding information — requires you to supply it:**

```js
plainDate.toZonedDateTime({ timeZone: "Asia/Tokyo", plainTime: "09:00" });
plainDateTime.toZonedDateTime("Asia/Tokyo");
instant.toZonedDateTimeISO("Asia/Tokyo");
```

**Narrowing — dropping information — is always available and always named:**

```js
zonedDateTime.toPlainDate();
zonedDateTime.toPlainTime();
zonedDateTime.toInstant();
```

🔴 **What you cannot do is convert a `PlainDate` to an `Instant` by guessing.** There is no
implicit "midnight in the local zone" — you have to say which zone and which time, because
those are real decisions that change the answer. **That refusal is the feature**: it is the
one-day bug caught at the type level rather than in production.

⚠️ **The corollary for storage:** store each value as the type it is. A `PlainDate` as
`"2026-08-15"`, a `ZonedDateTime` with its bracketed zone, an `Instant` as a `Z` string.
Converting on the way in and out is what loses the meaning.

## Calendars

**Every plain type carries a calendar**, defaulting to ISO 8601. The `…ISO()` methods on
`Temporal.Now` and the `…ISO` conversion methods are the explicit "use the ISO calendar"
forms, which is why they are spelled that way.

```js
Temporal.Now.plainDateISO();                       // ISO calendar
Temporal.PlainDate.from("2026-08-15[u-ca=hebrew]"); // another calendar
```

**Most applications never touch this** — but it is why month arithmetic is defined rather
than assumed, and why a non-Gregorian calendar is a supported case instead of a library.

## Gotchas

**Symptom:** Reaching for `Temporal` and not knowing which type
**Cause:** The value's meaning has not been decided — instant, or calendar reading?
**Fix:** Ask whether it is the same moment for everyone. If yes, `Instant` or
`ZonedDateTime`; if no, a `Plain` type.

**Symptom:** `PlainDate` has no `toInstant`
**Cause:** A calendar date is not a moment; converting requires a zone and a time.
**Fix:** `toZonedDateTime({ timeZone, plainTime })`, deliberately.

**Symptom:** An invalid day was silently accepted
**Cause:** `from` defaults to `overflow: "constrain"`, which clamps.
**Fix:** `{ overflow: "reject" }` on anything user-supplied.

**Symptom:** Code tried `d.setDate(...)`
**Cause:** `Temporal` objects are immutable; there are no setters.
**Fix:** `d.with({ day })` or `d.add({ days })`, using the returned value.

**Symptom:** A month was off by one after porting from `Date`
**Cause:** `Date` is 0-based and `Temporal` is 1-based — the port kept the `- 1`.
**Fix:** Remove the adjustment. `month: 8` is August.

**Symptom:** A `ZonedDateTime` lost its zone through storage
**Cause:** It was stored as a plain ISO instant string.
**Fix:** Store `toString()`, which includes the bracketed zone.

## Interview questions

**★ What does `Temporal` fix that `Date` cannot?**
Four things: arithmetic in a named time zone, calendar-aware durations, distinct types for
the different things called "a date", and immutability. The type split is the core of it —
a birthday, a log timestamp and "09:00 in London" are three different kinds of value, and
`Date` models all of them as one epoch number.

**★ Which type is a birthday?**
`Temporal.PlainDate` — or `PlainMonthDay` if the year is not part of it. A birthday is the
same date in every time zone, so it is not an instant, and forcing it into one is what
produces the classic off-by-one-day bug.

**★ What is `PlainDateTime` for, given `ZonedDateTime` exists?**
A date and time with no zone yet — "every branch opens at 09:00 on the 15th". It is a
different instant in each branch's zone, and `toZonedDateTime(zone)` is the explicit step
that resolves it. `Date` performs that resolution silently using the host's zone, which is
why the same code gives different answers on a laptop and a server.

**★ How does `Temporal` handle mutation?**
It does not allow it. There are no setters; `add`, `subtract` and `with` all return new
values. That removes the whole class of bug where a `Date` passed to a function comes back
changed.

**Why can't a `PlainDate` be converted straight to an `Instant`?**
Because the conversion needs information the value does not have — a time and a zone —
and guessing them is exactly the mistake `Temporal` exists to prevent. You supply both
explicitly with `toZonedDateTime`.

**What happened to 0-based months?**
Gone. `Temporal` months are 1-based, years have no 0–99 special case, and out-of-range
fields either clamp or throw depending on an explicit `overflow` option instead of silently
rolling over.

---

[Topic index](./README.md) · Next: [2 · Arithmetic, zones and adoption](./02-arithmetic-zones-and-adoption.md) →
