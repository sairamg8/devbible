---
title: "2 · Arithmetic, zones and adoption"
sidebar_label: "2 · Arithmetic, zones and adoption"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Temporal.Duration`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/Duration), [`Temporal.PlainDate.prototype.add()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/PlainDate/add), [`Temporal.PlainDate.prototype.until()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/PlainDate/until), [`Temporal.PlainDate.compare()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/PlainDate/compare), [`Temporal.ZonedDateTime`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/ZonedDateTime), [`Temporal.ZonedDateTime.from()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/ZonedDateTime/from), [`Temporal.Instant`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/Instant), [`Intl.DateTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat), [`Date`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date). Documentation-validated; **no timings**.

## Arithmetic returns new values

```js
const d = Temporal.PlainDate.from("2026-08-15");

d.add({ months: 1, days: 3 });     // a new PlainDate
d.subtract({ weeks: 2 });
d.with({ day: 1 });                // change fields
```

**Every unit is named**, so there is no "add 86,400,000 milliseconds and hope" — the
ambiguity that makes `Date` arithmetic wrong across a DST boundary
([19 · 03](../19-date/03-reading-writing-and-arithmetic.md)) is gone, because you say
`{ days: 1 }` and the implementation knows what a day means for that type.

⚠️ **Month arithmetic still needs a policy, and here it is explicit:**

```js
Temporal.PlainDate.from("2026-01-31").add({ months: 1 });   // clamps to 28 February
Temporal.PlainDate.from("2026-01-31").add({ months: 1 }, { overflow: "reject" });   // throws
```

**`Date` had no answer to "one month after 31 January" and rolled over to 3 March.**
`Temporal` clamps by default and lets you demand a rejection instead — a decision made
visibly rather than inherited from a normalisation rule.

## `until`, `since` and `Duration`

```js
const start = Temporal.PlainDate.from("2026-01-15");
const end = Temporal.PlainDate.from("2026-08-15");

start.until(end);                              // a Duration
start.until(end, { largestUnit: "month" });    // expressed in months and days
end.since(start);                              // the same span, the other direction
```

🔴 **`largestUnit` is the option that makes the answer meaningful.** Without it you get
the span in the type's default unit; with it you get "7 months" rather than a day count
you then have to divide and misinterpret. This is the calendar-aware difference `Date`
cannot express at all — subtracting two `Date`s gives milliseconds and nothing more.

```js
const dur = Temporal.Duration.from({ hours: 26, minutes: 90 });
dur.round({ largestUnit: "day" });        // normalised into days, hours, minutes
dur.total({ unit: "hour" });              // a single number, when you do want one
```

**`round` also takes `smallestUnit` and `roundingMode`**, the same vocabulary as
`Intl.NumberFormat` — so "round this to the nearest quarter hour" is one call rather than
arithmetic you have to get right.

⚠️ **A `Duration` is not a fixed number of milliseconds.** "1 month" and "1 day" depend on
where they are applied — which is precisely why they are a separate type rather than a
number, and why `total()` requires you to name a unit.

## Comparison and equality — no `===` trap

```js
Temporal.PlainDate.compare(a, b);   // -1, 0, 1 — a sort comparator
dates.sort(Temporal.PlainDate.compare);

a.equals(b);                        // ✅ value equality
a === b;                            // 🔴 false for distinct objects, always
```

🔴 **Each type has a static `compare` and an instance `equals`.** That is the direct fix
for `Date`'s worst ergonomics — where `<` and `>` worked through coercion but `===` did
not, and `+` concatenated
([19 · 03](../19-date/03-reading-writing-and-arithmetic.md)). `Temporal` types deliberately
do **not** coerce: relational operators on them are an error rather than a silent surprise.

## Time zones, and the two ambiguous hours

**A `ZonedDateTime` knows its zone**, so arithmetic is zone-correct:

```js
const meeting = Temporal.ZonedDateTime.from("2026-03-28T09:00[Europe/London]");
meeting.add({ days: 1 });   // ✅ still 09:00 local, even across the DST change
```

🔴 **The hard cases are the two hours a year when local time is ambiguous**, and this is
where `Temporal` differs most from every predecessor: **it makes you choose.**

- **Spring forward:** 01:30 local does not exist that day.
- **Autumn back:** 01:30 local happens twice.

```js
Temporal.ZonedDateTime.from(
  { year: 2026, month: 10, day: 25, hour: 1, minute: 30, timeZone: "Europe/London" },
  { disambiguation: "earlier" },
);
```

| `disambiguation` | For a repeated time | For a skipped time |
|---|---|---|
| `"compatible"` (default) | the earlier one | shifts forward |
| `"earlier"` | the earlier one | shifts backward |
| `"later"` | the later one | shifts forward |
| `"reject"` | 🔴 throws | 🔴 throws |

⚠️ **`"reject"` is the right choice for scheduling input.** A booking system that silently
picks one of two 01:30s has a bug that surfaces once a year; one that throws makes the user
disambiguate at the point where they know the answer.

**There is a matching `offset` option** for strings that carry both an offset and a zone —
it decides what to do when the two disagree, which happens when a stored value predates a
time-zone-rule change. `"reject"` catches it; the others tell the parser which to trust.

🔴 **That last case is the argument for storing the wall-clock time plus the zone name**,
made in [19 · 04](../19-date/04-formatting-and-why-a-library.md). A stored instant bakes in
today's rules; a `ZonedDateTime` string keeps what the user actually meant.

## Strings, formatting and interop

```js
zdt.toString();      // "2026-08-15T09:00:00+01:00[Europe/London]" — round-trips
instant.toString();  // "2026-08-15T08:00:00Z"
plainDate.toString();// "2026-08-15"
```

**Every type serialises to an ISO 8601 form that parses back into the same type**, which
is what makes storage unambiguous.

**Formatting is still `Intl`** — the types work with `Intl.DateTimeFormat`, and each has a
`toLocaleString` ([20 · 02](../20-intl/02-dates-and-relative-time.md)):

```js
plainDate.toLocaleString("en-GB", { dateStyle: "long" });
```

⚠️ **`toString()` is for machines, `toLocaleString` is for people** — the same split as
`Date`, and the same rule: never store a locale string.

### Talking to `Date`

**Existing APIs return `Date`s and will for years**, so the bridge matters:

```js
Temporal.Instant.fromEpochMilliseconds(date.getTime());   // Date → Temporal
date.toTemporalInstant();                                  // the proposal's own bridge

new Date(instant.epochMilliseconds);                       // Temporal → Date
```

🔴 **Convert at the boundary and work in `Temporal` inside.** The failure mode is a
codebase that converts back and forth in the middle of logic, which reintroduces every
`Date` ambiguity at each hop.

⚠️ **A `Date` can only become an `Instant`.** It has no zone or calendar of its own, so
going to a `ZonedDateTime` means supplying a zone — the same explicitness as everywhere
else.

## Where it stands, and how to adopt it

**`Temporal` is a large, late-stage addition to the language that has begun shipping.**
Availability varies by engine and version, so **check your targets** rather than assuming —
and the practical answer while support is uneven is a polyfill, which is a real dependency
with a real size cost.

**`Date` is not going anywhere.** It cannot be removed, every existing platform and library
API returns one, and the two will coexist indefinitely. So the realistic positions today:

| Situation | Position |
|---|---|
| new code, targets support it | ✅ use `Temporal` |
| new code, mixed targets | `Temporal` behind a polyfill, or a zone-aware library |
| existing code that works | leave it; convert at boundaries if you add `Temporal` |
| the work is timestamp + format | `Date` + `Intl` is still fine and always was |

⚠️ **Do not rewrite working date code for its own sake.** The gain is in the cases
`Temporal` was designed for — zones, calendar durations, plain-versus-instant modelling. A
codebase that only stamps and formats gets very little from the migration and pays for it
in churn.

## Gotchas

**Symptom:** `a < b` on two `Temporal` values did not work as expected
**Cause:** The types do not coerce, deliberately.
**Fix:** `Type.compare(a, b)`, which is also a ready-made sort comparator.

**Symptom:** `a === b` was false for equal values
**Cause:** Object identity, as with every object.
**Fix:** `a.equals(b)`.

**Symptom:** "One month after 31 January" clamped when the domain wanted a failure
**Cause:** `overflow` defaults to `"constrain"`.
**Fix:** `{ overflow: "reject" }`.

**Symptom:** A duration between two dates came back in an unhelpful unit
**Cause:** No `largestUnit` was given.
**Fix:** `until(end, { largestUnit: "month" })`, or `total({ unit })` for one number.

**Symptom:** A booking silently landed on the wrong side of a DST change
**Cause:** The default `disambiguation: "compatible"` picked one for you.
**Fix:** `{ disambiguation: "reject" }` on user input, and ask.

**Symptom:** A stored `ZonedDateTime` lost its zone
**Cause:** It was serialised as an instant string.
**Fix:** Store `toString()`, which includes the bracketed zone name.

**Symptom:** `Temporal is not defined`
**Cause:** The target engine does not have it yet.
**Fix:** Feature-test and load a polyfill, or stay on `Date` + `Intl` for now.

**Symptom:** Converting between `Date` and `Temporal` all through the code
**Cause:** The boundary was never drawn.
**Fix:** Convert once on the way in and once on the way out.

## Interview questions

**★ How does `Temporal` handle the DST-ambiguous hours?**
By making you choose. A `disambiguation` option — `"compatible"`, `"earlier"`, `"later"`
or `"reject"` — decides what a repeated or skipped local time means, and a matching
`offset` option decides what to do when a stored offset disagrees with the zone's current
rules. `"reject"` is the right default for user-supplied scheduling input, because it
surfaces the question where the user can answer it.

**★ How do you compare two `Temporal` values?**
`Type.compare(a, b)` for ordering, which doubles as a sort comparator, and `a.equals(b)`
for equality. The types do not coerce, so `<`, `>` and `===` are not the answer — which is
a deliberate fix for `Date`, where relational operators worked by coercion but `===` never
did and `+` concatenated.

**★ What is a `Temporal.Duration`, and why is it not a number?**
A calendar-aware length of time. "1 month" and "1 day" have no fixed millisecond value —
they depend on when and where they are applied — so a duration is a structured value with
`largestUnit`/`smallestUnit` rounding, and `total({ unit })` when you genuinely want one
number. Subtracting two `Date`s can only ever give milliseconds.

**★ Should you migrate an existing codebase to `Temporal`?**
Only where the gain is real: named-zone arithmetic, calendar durations, or
plain-versus-instant modelling. `Date` cannot be removed from the language, every existing
API returns one, and code that only timestamps and formats is already well served by `Date`
plus `Intl`. Where you do adopt it, convert at the boundaries and work in `Temporal`
inside.

**How do `Date` and `Temporal` interoperate?**
A `Date` maps to a `Temporal.Instant` — via `fromEpochMilliseconds` or the proposal's
`toTemporalInstant()` — and back through `epochMilliseconds`. It can only be an `Instant`,
because a `Date` carries no zone or calendar; anything richer requires you to supply one.

**Is `Temporal` safe to use today?**
Check your targets. It is a late-stage addition that has begun shipping but is not
universally available, and the interim answer is a polyfill with a real size cost — or
staying on `Date` plus `Intl`, which remains correct for timestamp-and-format work.

---

← [1 · The types](./01-the-types.md) · [Topic index](./README.md) · [Phase index](../README.md) →
