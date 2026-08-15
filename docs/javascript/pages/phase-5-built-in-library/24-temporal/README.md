---
title: "24 · `Temporal`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Temporal`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal), [`Temporal.PlainDate`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/PlainDate), [`Temporal.ZonedDateTime`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/ZonedDateTime), [`Temporal.Instant`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/Instant), [`Temporal.Duration`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/Duration), [`Temporal.Now`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/Now), [`Date`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date). Documentation-validated; **no timings**.

[19 · `Date`](../19-date/README.md) ended with four things `Date` cannot do: arithmetic in
a named time zone, calendar-aware durations, distinct types for the different things
people call "a date", and immutability. **`Temporal` is the answer to all four, and it is
a different API rather than a patch to the old one.**

🔴 **The central idea is the one `Date` gets wrong: there is more than one kind of date.**
A birthday, a meeting in Tokyo next March, a log timestamp and "09:00" are four different
kinds of value with four different sets of valid operations. `Date` models them all as one
number and lets you convert between them by accident. `Temporal` gives each a type and
makes every conversion explicit.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The types](./01-the-types.md)** | The eight types and `Temporal.Now`; how to choose between them from what the value *means*; 🔴 **months are 1-based**; immutability and what that changes; and why conversions that would invent information are refused rather than guessed |
| 2 | **[Arithmetic, zones and adoption](./02-arithmetic-zones-and-adoption.md)** | `add`, `subtract`, `with`, `until`/`since` and `round`; `Duration` and the `largestUnit`/`smallestUnit` controls; 🔴 **DST ambiguity made explicit** with `disambiguation`; comparison and equality without the `===` trap; ISO strings and round-tripping; interoperating with `Date`; and where it ships today |

## The type map, in one table

| Type | Is | Example |
|---|---|---|
| `Temporal.Instant` | a fixed point on the world timeline | a log entry, a request timestamp |
| `Temporal.ZonedDateTime` | an instant **plus** a time zone and calendar | a meeting at 09:00 in `Europe/London` |
| `Temporal.PlainDate` | a calendar date, no time, no zone | a birthday, an invoice date |
| `Temporal.PlainTime` | a wall-clock time, no date | opening hours, an alarm |
| `Temporal.PlainDateTime` | a date and time with **no** zone | "the 15th at 09:00", zone decided later |
| `Temporal.PlainYearMonth` | a month in a year | a card expiry |
| `Temporal.PlainMonthDay` | a day in a year, no year | a recurring anniversary |
| `Temporal.Duration` | a length of time | "3 days and 4 hours" |

**`Temporal.Now` is the entry point for the present**, one method per type — so "now" is
never ambiguous about which kind of value you asked for.

## Phase gate

You are done with this topic when you can say **which `Temporal` type a birthday should
be**, and **why `Temporal` makes you say what to do about the hour that does not exist on
a spring-forward day**.

## Where this connects

- [19 · `Date`](../19-date/README.md) — what this replaces, and why; the four gaps are in [19 · 04](../19-date/04-formatting-and-why-a-library.md)
- [19 · 02 · Parsing, and the one-day bug](../19-date/02-parsing-and-the-one-day-bug.md) — the instant-versus-plain-date distinction `Temporal` turns into types
- [20 · 02 · Dates and relative time](../20-intl/02-dates-and-relative-time.md) — `Intl.DateTimeFormat`, which formats `Temporal` values too
- [17 · `Set`](../17-set.md) — the equality lesson that applies here: distinct objects are never `===`

---

Start → [1 · The types](./01-the-types.md)
