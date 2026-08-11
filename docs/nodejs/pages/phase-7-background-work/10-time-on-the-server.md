---
title: "Time on the server — store UTC, convert at the edge"
sidebar_label: "10 · Time on the server"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0**, server `TZ=Asia/Kolkata`.

**Store UTC. Convert at the edge. Never let a scheduled job decide what "today" means
from the server's clock.** This is the bug class behind wrong trial expiries, reports
missing a day of data, and "the offer ended at midnight" ending at 6:30 p.m. for half
your users.

## The rule, and what breaks it

An instant in time is unambiguous — `2026-08-10T18:45:00.000Z`. A *calendar date* is
not: it depends on who is looking.

```console
stored (UTC):              2026-08-10T18:45:00.000Z
server-local toString():   Tue Aug 11 2026 00:15:00 GMT+0530 (India Standard Time)
toISOString().slice(0,10): 2026-08-10
what the IST user sees:    2026-08-11        <- a whole day apart
```

**The same instant is the 10th and the 11th, correctly, at the same time.** Every
"missing a day" bug in a report is this line:

```js
const day = order.paidAt.toISOString().slice(0, 10);     // the UTC day, always
```

`toISOString()` is UTC by definition, so slicing it gives you *UTC's* date, not the
user's. The fix is to name the zone:

```js
const day = new Intl.DateTimeFormat('en-CA', {timeZone: user.timeZone})
  .format(order.paidAt);                                  // 'en-CA' gives YYYY-MM-DD
```

Which means a user's timezone is **data you must store**, alongside their locale and
currency. There is no way to derive it later from an instant.

## Arithmetic is not the same as calendars

```console
trial start 2026-03-07T12:00:00Z, + 7 * 24 * 60 * 60 * 1000 ms
rendered in America/New_York -> 2026-03-14, 8:00 a.m.
```

It started at 7:00 a.m. local and the "+7 days" landed at 8:00. Nothing is broken —
DST began on 8 March, so seven *elapsed days* is not seven *calendar days*. For a trial
expiry the user reads as a date, that hour matters at the boundary.

**Adding milliseconds gives you elapsed time. Calendar arithmetic needs a calendar.**
For "same time next month" or "30 days from now, in the user's zone", either compute in
the database:

```sql
select (now() at time zone $1 + interval '7 days') at time zone $1
```

or use `Temporal`, the calendar-aware API that replaces this whole category of bug:

```js
// node --harmony-temporal   — on 24.19.0 `Temporal` is undefined without the flag
const start = Temporal.ZonedDateTime.from({timeZone: 'America/New_York', year: 2026, month: 3, day: 7, hour: 7});
const end = start.add({days: 7});     // 7:00 a.m., correctly, on the other side of DST
```

Until it is unflagged, use `date-fns-tz` or Luxon — or push the arithmetic into
PostgreSQL, which has had it right all along.

Never hand-roll month arithmetic. "One month after 31 January" has no correct answer
you will guess right.

## "Ends at midnight" has no server-side meaning

```console
midnight on 2026-08-11 for a user in Asia/Kolkata, in UTC:
  2026-08-10T18:30:00.000Z
```

**A UTC day earlier.** A job that expires offers "at midnight" by looking at the
server's clock ends them at the wrong moment for everyone not in the server's zone.

Store the deadline as the **instant it actually is**, computed once from the zone that
owns the rule — the user's, the merchant's, or the company's — and compare instants
after that:

```js
// wrong: recomputes "midnight" in whatever zone the job happens to run in
if (new Date().getHours() === 0) expireOffers();

// right: the deadline was computed once, in the zone that owns the rule
await pool.query('update offers set status = $1 where expires_at <= now()', ['expired']);
```

`expires_at` is `timestamptz`, `now()` is an instant, and the comparison means the same
thing regardless of where the job runs.

## PostgreSQL specifics

- **`timestamptz` always**, never `timestamp`. `timestamptz` stores an instant;
  `timestamp` stores a wall-clock reading with no zone, which is a bug you will find
  later.
- **`date` columns come back a day early**, as
  [Phase 6, page 04](../phase-6-data-access/04-postgresql-from-node.md) measured:
  `current_date` arrives as local midnight, which in IST is the previous UTC day.
- **`now()` is transaction time**, fixed for the whole transaction. `clock_timestamp()`
  advances. For "when did this happen", `now()` is what you want.

## Never trust a scheduled job's clock

The clock a job reads is the wrong one to make decisions from:

- The job may run late — 2:47 instead of 2:00 ([page 08](./08-scheduled-jobs.md)).
- It may run twice, or on a machine in a different zone.
- Container clocks drift, and a step of a second or two is normal.

So derive the work from data, not from `now()`:

```js
// fragile — depends on when the job ran
where created_at::date = current_date - 1

// robust — the same result late, early, or twice
where processed_at is null and created_at < $1     // $1 = the window end, passed in
```

Pass the window in as a parameter and the job becomes replayable, testable, and
correct when it runs at 2:47.

## Gotchas

**Symptom:** A daily report misses or double-counts a day
**Cause:** `toISOString().slice(0,10)` — the UTC date, not the user's.
**Fix:** `Intl.DateTimeFormat` with an explicit `timeZone`, or bucket in SQL with `at
time zone`.

**Symptom:** A trial expires an hour early or late
**Cause:** `+ 7 * 24 * 3600 * 1000` across a DST boundary — measured, 7:00 a.m. became
8:00 a.m.
**Fix:** Calendar arithmetic in the user's zone.

**Symptom:** An offer "ending at midnight" ends at 6:30 p.m. for some users
**Cause:** Midnight computed in the server's zone.
**Fix:** Compute the deadline once as an instant, from the zone that owns the rule.

**Symptom:** Timestamps shift when the deploy region changes
**Cause:** `timestamp` instead of `timestamptz`, or reliance on container `TZ`.
**Fix:** `timestamptz` everywhere; set `TZ=UTC` on servers so a mistake is at least
consistent.

**Symptom:** A date is one day off only for some users
**Cause:** Rendering an instant in the server's zone rather than the user's.
**Fix:** Store the user's timezone and format at the edge.

**Symptom:** A job that ran late processed the wrong rows
**Cause:** The window derived from `now()` at run time.
**Fix:** Pass the window in; select on state (`processed_at is null`).

## Interview questions

**★ Why is `toISOString().slice(0,10)` a bug?**
It gives the UTC calendar date, not the user's. Measured: the instant
`2026-08-10T18:45Z` is 2026-08-10 in UTC and 2026-08-11 for a user in IST — the same
moment, a day apart. Format with an explicit `timeZone` instead.

**★ What is wrong with adding `7 * 24 * 60 * 60 * 1000` for "7 days"?**
It adds elapsed time, not calendar days. Across a DST boundary the wall-clock time
moves — measured, a trial starting 7:00 a.m. New York expired at 8:00 a.m. seven days
later. Use calendar arithmetic in a named zone.

**★ How do you implement "the offer ends at midnight"?**
Compute that midnight once, in the zone that owns the rule, and store it as an instant.
Then the check is `expires_at <= now()`, which means the same thing wherever the job
runs. Recomputing "midnight" inside the job uses whatever zone that process happens to
be in.

**★ Why should a scheduled job not trust its own clock?**
Because it may run late, twice, or on a machine in another zone, and clocks drift.
Derive the work set from data — `processed_at is null` — and pass any window boundary in
as a parameter, so a late run produces the same result.

**`timestamp` or `timestamptz`?**
`timestamptz`, always. It stores an instant and compares correctly across zones.
`timestamp` stores a wall-clock reading with no zone attached, which silently means
different moments in different deployments.

**Where does timezone conversion belong?**
At the edge — when rendering for a user, or when bucketing a report by their calendar.
Everything in between stores and compares instants in UTC. Which means the user's
timezone is data you have to capture; it cannot be recovered later.

---

← Prev: [Outbound side-effects](./09-outbound-side-effects.md) · Next → [Graceful worker shutdown](./11-graceful-shutdown.md)
