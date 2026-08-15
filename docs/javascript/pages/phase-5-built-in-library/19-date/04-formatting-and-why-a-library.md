---
title: "4 · Formatting, and why a library"
sidebar_label: "4 · Formatting and why a library"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Date.prototype.toISOString()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString), [`Date.prototype.toJSON()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toJSON), [`Date.prototype.toLocaleDateString()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleDateString), [`Date.prototype.toUTCString()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toUTCString), [`Intl.DateTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat), [`Intl.RelativeTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat), [`JSON.parse()` reviver](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#using_the_reviver_parameter), [`Temporal`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal). Documentation-validated; **no timings**.

**There are two kinds of date output and they must never be confused.** A *machine*
format is for storage, transport and comparison — it must be stable, sortable and
locale-independent. A *human* format is for display — it must follow the reader's
language, region and calendar, none of which you know at the time you write the code.

## Machine formats — there are two, and one of them is a mistake

```js
d.toISOString();   // ✅ "2026-08-15T09:30:00.000Z" — always UTC, always this shape
d.getTime();       // ✅ 1786865400000 — epoch milliseconds
```

**`toISOString` is the only string form the spec pins down**, and it round-trips through
`new Date()` losslessly. Everything else — `toString`, `toDateString`, `toLocaleString` —
varies by engine, locale or both, and must never be stored or compared.

⚠️ **`toISOString()` throws `RangeError` on an invalid date.** It is the method that
finally surfaces a `NaN` that has been travelling quietly since it was parsed
([chunk 1](./01-the-model-and-making-one.md)).

**`toJSON()` is what `JSON.stringify` calls**, and it delegates to `toISOString`:

```js
JSON.stringify({ at: new Date("2026-08-15T09:30:00Z") });
// '{"at":"2026-08-15T09:30:00.000Z"}'
```

🔴 **But JSON has no date type, so it does not come back as a `Date`:**

```js
const back = JSON.parse('{"at":"2026-08-15T09:30:00.000Z"}');
back.at;                  // 🔴 a string
back.at.getFullYear();    // 🔴 TypeError
```

**Revive explicitly at the boundary** — a reviver, or a schema parser, or an ordinary
mapping function. Whichever you choose, do it in one place:

```js
const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;
JSON.parse(text, (key, value) =>
  typeof value === "string" && ISO.test(value) ? new Date(value) : value,
);
```

⚠️ **A blanket reviver is a blunt instrument** — it converts any string that looks like a
date, including an id or a version tag that happens to match. Reviving named fields is
safer than pattern-matching every string in the payload
([09 · `JSON`](../09-json/README.md)).

**`toJSON` returns `null` for an invalid date** rather than throwing, so an invalid date
inside an object serialises to `null` while the same date stringified alone throws. Two
different behaviours from the same broken value.

## Human formats — `toLocaleDateString` and friends

```js
d.toLocaleDateString();                     // the user's locale, their format
d.toLocaleDateString("en-GB");              // 15/08/2026
d.toLocaleDateString("en-US");              // 8/15/2026
d.toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" });
```

🔴 **Never assemble a display string by hand.** This is the pattern to delete on sight:

```js
`${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`   // 🔴
```

It hard-codes one region's order, ignores the reader's calendar and numbering system,
loses the `+ 1` sooner or later, and cannot be localised without rewriting. The built-in
does all of it:

```js
d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
```

**These methods are `Intl.DateTimeFormat` in disguise** — same options, same behaviour.
When you format many dates the same way, build the formatter once and reuse it, because
constructing one is the expensive part:

```js
const fmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });
rows.map((r) => fmt.format(r.createdAt));   // ✅ one formatter, many dates
```

The full option surface — `RelativeTimeFormat` for "3 days ago", `formatRange` for
"15–17 August" — is **20 · `Intl`** *(not written yet)*.

### 🔴 The `timeZone` option — display in any zone, compute in none

```js
d.toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
d.toLocaleString("en-US", { timeZone: "UTC" });
```

**This is the one place `Date` understands named time zones**, and it is display-only. You
can *show* an instant in Tokyo; you cannot *ask* `Date` what "tomorrow at 9am in Tokyo"
is, because every setter and getter works in the host's local zone and nothing else.

⚠️ **That asymmetry is the honest summary of `Date`'s time-zone support**: it can render
any zone and reason about exactly two — local and UTC.

**The other fixed formats**, for completeness:

| Method | Gives | Use it for |
|---|---|---|
| `toUTCString()` | an RFC-style UTC string | HTTP headers, cookie `Expires` |
| `toDateString()` / `toTimeString()` | engine-defined local text | debugging only |
| `toString()` | engine-defined local text | debugging only |

## What `Date` genuinely cannot do

**Four things, and each one is a reason a library exists:**

1. **Arithmetic in a named time zone.** "Add one day, in `America/New_York`, correctly
   across the DST change" is not expressible.
2. **Calendar-aware durations.** "How many months between these two dates" has no answer
   `Date` can give — you get milliseconds and have to define the rest yourself, including
   what "a month" means at a month end ([chunk 3](./03-reading-writing-and-arithmetic.md)).
3. **The types the domain actually has.** A plain date, a plain time, a wall-clock
   date-time with no zone, an instant, and a zoned date-time are five different things.
   `Date` is only the fourth, which is what forces birthdays into instants
   ([chunk 2](./02-parsing-and-the-one-day-bug.md)).
4. **Immutability.** Setters mutate, so a date crossing a function boundary is a shared
   mutable value.

**And one more that is not `Date`'s fault:** parsing arbitrary human formats. That was
never in scope for the built-in and never will be.

## `Temporal` — the actual fix

`Temporal` is a new top-level namespace that replaces `Date` with a set of distinct,
**immutable** types — `PlainDate`, `PlainTime`, `PlainDateTime`, `ZonedDateTime`,
`Instant`, `Duration` — with real time-zone and calendar arithmetic and explicit handling
of the ambiguous hours around a DST change.

It answers all four gaps above. What it does not do is arrive retroactively: `Date` stays
in the language forever, every existing API returns one, and the two will coexist for
years. Check availability against your targets before reaching for it — **24 ·
`Temporal`** *(not written yet)*.

## Choosing a library

🔴 **The honest position: for anything past "stamp it and format it", use a library.**
Not because `Date` is unusable, but because time-zone arithmetic and calendar durations
are genuinely hard, and a wrong answer is silent.

| | What it is | Reach for it when |
|---|---|---|
| **nothing** | `Date` + `Intl.DateTimeFormat` | you timestamp, compare, and format for display — the common case |
| **date-fns** | immutable pure functions over plain `Date` objects, imported one at a time | you want arithmetic and formatting helpers without adopting a new date type |
| **Luxon** | an immutable date-time type built on `Intl`, zone-aware from the start | time zones are part of the domain — scheduling, travel, multi-region reporting |
| **Day.js** | a small library with a Moment-shaped API and optional plugins | you want familiar ergonomics and a light footprint |
| **`Temporal`** | the language's own replacement | your targets support it, and you are starting fresh |

⚠️ **Moment.js is in maintenance mode** — its own documentation recommends against it for
new projects, on the grounds that it is mutable and its architecture cannot be
tree-shaken. Recognise it in existing code; do not add it.

**Do not add a library to format a date.** `toLocaleDateString` and `Intl.DateTimeFormat`
already do that job better than most libraries' format strings, and in every locale.

## The storage rule, once more

**Most date bugs are prevented before any of this**, by storing the right thing:

| The value is | Store it as |
|---|---|
| when something happened | epoch milliseconds, or ISO 8601 with `Z` |
| a calendar date — birthday, due date, holiday | the text `"YYYY-MM-DD"` |
| a time of day with no date — opening hours | the text `"09:30"` |
| a future appointment in a specific place | the wall-clock date-time **plus the IANA zone name**, not an instant |

🔴 **The last row is the one that surprises people.** A meeting at 09:00 in
`Europe/London` on a future date is not a fixed instant — if the time-zone database
changes, or the meeting crosses a DST boundary that shifts, the instant moves and the
wall-clock time is what people actually meant. Storing the computed instant bakes in
today's rules.

## Gotchas

**Symptom:** A date came back from `JSON.parse` as a string
**Cause:** JSON has no date type; `toJSON` serialises, nothing revives.
**Fix:** Revive named fields at the boundary, or keep the field a string until it is used.

**Symptom:** A reviver turned an unrelated field into a `Date`
**Cause:** It pattern-matched every string in the payload.
**Fix:** Revive by field name, or use a schema parser.

**Symptom:** `JSON.stringify` threw `RangeError: Invalid time value`
**Cause:** `toISOString` throws on an invalid date.
**Fix:** Validate at parse time. Note `toJSON` gives `null` instead, so the same bad value
behaves differently in an object and alone.

**Symptom:** The date format changed when the app was opened in another country
**Cause:** `toLocaleDateString()` with no locale follows the host — which is correct for
display and wrong for anything stored.
**Fix:** `toISOString` for storage; locale formatting only at the edge.

**Symptom:** A hand-built `dd/mm/yyyy` string was a month out
**Cause:** The missing `+ 1` on the zero-indexed `getMonth()`.
**Fix:** Do not hand-build format strings.

**Symptom:** Formatting a long list felt heavy
**Cause:** A new `Intl.DateTimeFormat` is constructed per call by
`toLocaleDateString`.
**Fix:** Build one formatter and reuse it.

**Symptom:** A scheduled meeting drifted by an hour after a DST change
**Cause:** It was stored as a computed instant rather than a wall-clock time plus a zone.
**Fix:** Store the local date-time and the IANA zone name; resolve to an instant when
needed.

## Interview questions

**★ How should a date be stored and transmitted?**
As epoch milliseconds or an ISO 8601 string with `Z` — `toISOString()` is the only stable
string form, and it round-trips losslessly. Locale strings are display output and must
never be stored. A calendar date such as a birthday is not an instant and belongs in
storage as `"YYYY-MM-DD"` text.

**★ What happens to a `Date` through `JSON.stringify` and `JSON.parse`?**
`stringify` calls `toJSON`, which calls `toISOString`, giving a UTC string. `parse` gives
that string straight back — JSON has no date type — so it must be revived deliberately.
Reviving every date-shaped string in a payload is a blunt fix; revive named fields.

**★ How do you display a date in the user's locale?**
`toLocaleDateString` / `toLocaleString`, or `Intl.DateTimeFormat` directly with
`dateStyle` / `timeStyle` or explicit component options. Never assemble the string from
`getDate()` and `getMonth()` — that hard-codes one region's order and loses the `+ 1`.
Build the formatter once and reuse it across a list.

**★ Can `Date` work with time zones other than local and UTC?**
It can **display** any IANA zone through the `timeZone` option of the locale formatters.
It cannot **compute** in one — every getter and setter uses the host's local zone. That
gap is a main reason `Temporal` and zone-aware libraries exist.

**★ When would you add a date library, and which?**
When the work goes past stamping, comparing and formatting: time-zone arithmetic,
calendar durations, or parsing arbitrary formats. date-fns for immutable helpers over
plain `Date`s, Luxon when zones are part of the domain, Day.js for a small Moment-shaped
API. Not Moment — its own documentation puts it in maintenance mode. And not any of them
merely to format, which `Intl` already does better.

**What does `Temporal` fix?**
The four things `Date` cannot do: arithmetic in a named zone, calendar-aware durations,
distinct types for plain dates, plain times, instants and zoned date-times, and
immutability. It coexists with `Date` rather than replacing it in existing APIs.

**Why store a future meeting as a wall-clock time plus a zone rather than an instant?**
Because the instant is derived from time-zone rules that can change, and because what
people agreed to was "09:00 in London". Freezing today's computed instant means a rule
change or a shifted DST boundary silently moves the meeting.

---

← [3 · Reading, writing and arithmetic](./03-reading-writing-and-arithmetic.md) · [Topic index](./README.md) · [Phase index](../README.md) →
