---
title: "19 · `Date`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Date`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date), [`Date()` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date), [Date Time String Format](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format), [`Date.parse()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse), [`Date.prototype.toISOString()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString), [`Date.prototype.getTimezoneOffset()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset), [`Intl.DateTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat), [`Temporal`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal). Documentation-validated; **no timings**.

**A `Date` is one number — milliseconds since 1970-01-01T00:00:00Z — wearing a calendar
costume.** Everything confusing about it follows from that: the number is an *instant*,
the API you read it through is *local time*, and the two are converted on every single
call.

🔴 **This is the built-in with the worst reputation in the language, and it is deserved.**
Months are zero-indexed and days are not. Two strings that look equivalent parse into
instants a day apart. Objects are mutable, so a `Date` handed to a function can come back
changed. `+` on two dates concatenates strings while `-` subtracts milliseconds. None of
this is going to be fixed — `Temporal` is the fix, and it is a different API.

**What this topic is for:** using `Date` correctly for the small number of things it is
genuinely good at, recognising the traps on sight, and knowing exactly where the line is
that sends you to a library.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The model, and making one](./01-the-model-and-making-one.md)** | The epoch-milliseconds model and why the whole API is a projection of it; the four constructor forms; 🔴 **zero-indexed months**; the years-`0`–`99` trap; out-of-range values rolling over instead of failing; `Date.now()` and `Date.UTC()`; and `Invalid Date` — the failure that never throws |
| 2 | **[Parsing, and the one-day bug](./02-parsing-and-the-one-day-bug.md)** | Why only ISO 8601 is safe and everything else is implementation-defined; 🔴 the **date-only vs date-time asymmetry** that makes `"2026-08-15"` UTC and `"2026-08-15T00:00:00"` local — the single most common `Date` bug in production; how to parse safely; and the instant-vs-plain-date distinction underneath it all |
| 3 | **[Reading, writing and arithmetic](./03-reading-writing-and-arithmetic.md)** | The getter/setter pairs and their UTC twins; `getTimezoneOffset`'s inverted sign; mutation and why a `Date` should be copied at every boundary; rollover as a deliberate idiom (`setDate(0)`, last-day-of-month); differences in milliseconds; 🔴 why `d2 - d1` works and `d1 + d2` concatenates; comparison and equality; and DST, where 24 hours is not a day |
| 4 | **[Formatting, and why a library](./04-formatting-and-why-a-library.md)** | `toISOString` and `toJSON` as the only stable machine formats; `toLocaleDateString` and the `timeZone` option that lets `Date` *display* any zone while never *computing* in one; the four things `Date` genuinely cannot do; what `Temporal` changes; choosing between date-fns, Luxon and Day.js; and the storage rule that prevents most date bugs before they start |

## The five rules that prevent most `Date` bugs

1. **Store instants as epoch milliseconds or a UTC ISO string.** Never a locale string.
2. **Store a calendar date — a birthday, a due date — as `"YYYY-MM-DD"` text**, not a
   `Date`. It is not an instant and turning it into one is what creates the one-day bug.
3. **Parse only ISO 8601**, and only with an explicit offset or `Z` when you mean an
   instant.
4. **Format at the edge**, with `Intl.DateTimeFormat` / `toLocaleString`, never by
   assembling `getFullYear()` and friends into a string.
5. **Treat every `Date` as immutable** by convention — copy with `new Date(d)` before any
   `set*` call.

## Phase gate

You are done with this topic when you can say **why `new Date("2026-08-15")` and
`new Date("2026-08-15T00:00:00")` can be a day apart**, and **why adding `86_400_000`
milliseconds is not the same as adding a day**.

## Where this connects

- [11 · `Number` and `Math`](../11-number-and-math/README.md) — the number underneath, and `NaN`, which is what an invalid date really is
- [09 · `JSON`](../09-json/README.md) — `toJSON`, and why a date round-trips out of JSON as a string
- **20 · `Intl`** *(not written yet)* — `Intl.DateTimeFormat`, the real formatting API
- **24 · `Temporal`** *(not written yet)* — the replacement, and what it fixes
- [Phase 1 · 11 · `NaN`](../../phase-1-values-and-coercion/11-nan.md) — the value an `Invalid Date` holds
- [Phase 4 · 17 · 01 · The `ToPrimitive` protocol](../../phase-4-objects-and-classes/17-tostring-valueof-toprimitive/01-the-toprimitive-protocol.md) — why `+` and `-` disagree about what a `Date` is

---

Start → [1 · The model, and making one](./01-the-model-and-making-one.md)
