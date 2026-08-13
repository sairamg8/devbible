---
title: "timestamptz vs timestamp"
sidebar_label: "04 · timestamptz"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex33-types-core.mjs`.

**Use `timestamptz` for every point in time. Both types are 8 bytes; neither stores a time
zone. The difference is that `timestamptz` knows what instant it means and `timestamp` does
not — so only one of them can be compared, ordered or subtracted correctly across zones.**

## Neither type stores a time zone

```console
$ node ex33-types-core.mjs
=== 4. timestamptz vs timestamp — what is actually stored ===
server TimeZone: UTC | client TZ: Asia/Calcutta
sizes: {"tz_b":8,"notz_b":8,"d_b":4}
```

**Both are 8 bytes.** `timestamptz` is not "timestamp plus a zone" — it is a UTC instant.
On input the value is converted from the given (or session) zone to UTC; on output it is
converted back to the session's zone for display. `timestamp` stores the digits you gave it
and attaches no meaning to them.

```console
displayed in UTC              : timestamptz 2026-06-15 04:30:00+00       timestamp 2026-06-15 10:00:00
displayed in Asia/Kolkata     : timestamptz 2026-06-15 10:00:00+05:30    timestamp 2026-06-15 10:00:00
displayed in America/New_York : timestamptz 2026-06-15 00:30:00-04       timestamp 2026-06-15 10:00:00
  the timestamptz value moved with the session zone; the timestamp did not
```

Both columns were given `'2026-06-15 10:00:00+05:30'`. The `timestamptz` correctly renders
the **same instant** three ways. The `timestamp` **threw the offset away** and kept
`10:00:00` — the same digits everywhere, meaning three different instants depending on who
reads it.

That is the whole argument: with `timestamp`, "was event A before event B?" has no
answer unless every writer happened to use the same zone.

## `AT TIME ZONE` converts in both directions

```console
AT TIME ZONE: {"tz_to_local":"2026-06-15 15:30:00","local_to_tz":"2026-06-15 04:30:00+00"}
```

The operator does opposite things depending on its input type:

```sql
-- timestamptz AT TIME ZONE zone  ->  timestamp   (what the clock read there)
SELECT timestamptz '2026-06-15 10:00:00+00' AT TIME ZONE 'Asia/Kolkata';  -- 2026-06-15 15:30:00

-- timestamp AT TIME ZONE zone    ->  timestamptz (interpret these digits as being in that zone)
SELECT timestamp '2026-06-15 10:00:00' AT TIME ZONE 'Asia/Kolkata';       -- 2026-06-15 04:30:00+00
```

Read it as "render this instant in that zone" for the first, and "this local time is in that
zone" for the second. Getting the direction wrong is the most common date bug in
report code.

## `now()` is the transaction's clock

```console
now() 200ms apart in one tx  : IDENTICAL
clock_timestamp() 200ms apart: CHANGED
```

| Function | Returns | Changes within a transaction |
|---|---|---|
| `now()` / `CURRENT_TIMESTAMP` | transaction start | **no** |
| `statement_timestamp()` | current statement's start | per statement |
| `clock_timestamp()` | actual wall clock | **yes**, on every call |

**`now()` is frozen for the whole transaction** — which is what you want for `created_at`
and `updated_at`, since every row written by one transaction shares a timestamp. Use
`clock_timestamp()` only when you are timing something inside a transaction.

## DST: intervals are not all equal

```console
DST arithmetic: {"plus_1h":"2026-03-08 07:30:00+00","plus_1d":"2026-03-09 06:30:00+00","plus_24h":"2026-03-09 06:30:00+00"}
```

Adding `1 day` and adding `24 hours` to `2026-03-08 01:30 America/New_York` — the US spring
DST change — gave the **same** UTC instant here because the arithmetic was done on a
`timestamptz` normalised to UTC. The distinction appears when the calculation happens in a
local zone:

```sql
SET TIME ZONE 'America/New_York';
SELECT timestamptz '2026-03-08 01:30:00' + interval '1 day';    -- 2026-03-09 01:30, 23 real hours later
SELECT timestamptz '2026-03-08 01:30:00' + interval '24 hours'; -- 2026-03-09 02:30, 24 real hours later
```

**"Same wall-clock time tomorrow" and "24 hours from now" are different questions**, and
PostgreSQL answers each correctly if you ask it in the right zone. For scheduling in a
user's local time, store the zone name alongside and do the arithmetic
`AT TIME ZONE` that zone.

## When `timestamp` (without zone) is right

Only when the value is genuinely a wall-clock reading with no instant attached:

- **A recurring local time** — "the shop opens at 09:00" in each branch's own zone. Store
  `time` plus a zone name, not an instant.
- **A future appointment in local terms** that must survive a change to the zone's DST
  rules. Store the local `timestamp` plus the zone name; compute the instant at read time.
- **A date with no time**, which is what `date` is for — 4 bytes, and no zone confusion
  unless you cast it.

Everything else — `created_at`, `updated_at`, `deleted_at`, event logs, expiry, audit — is
an instant, and instants are `timestamptz`.

## From Node

```console
to JS: {"tz":"Date 2026-06-15T04:30:00.000Z","notz":"Date 2026-06-15T04:30:00.000Z","d":"Date 2026-06-14T18:30:00.000Z"}
```

Three things happening here, and two of them are traps:

- **`timestamptz` → a correct JavaScript `Date`.** The instant survives; `Date` is itself a
  UTC instant. This is the case that works.
- **`timestamp` → a `Date` too — parsed as *local* time.** `pg` has no zone information, so
  it assumes the client's. The value `10:00:00` became `04:30:00Z` because the machine is
  `Asia/Calcutta` (+5:30). **The same row read on a server in another zone gives a different
  instant.**
- **`date` → `2026-06-14T18:30:00.000Z`** — the previous day. `date '2026-06-15'` became
  local midnight, which in +5:30 is 18:30 UTC on the 14th. Formatting that with
  `toISOString().slice(0,10)` prints `2026-06-14`.

The date trap and both fixes:

```js
// fix A — never let it become a Date
const {rows} = await pool.query(`SELECT to_char(d, 'YYYY-MM-DD') AS d FROM t`);

// fix B — tell pg to leave date (OID 1082) as a string, globally
import pg from 'pg';
pg.types.setTypeParser(1082, (v) => v);   // '2026-06-15'
```

Send instants as `Date` objects or ISO strings with an offset; `pg` sends them correctly and
the server converts. Never build a timestamp by string concatenation in the application.

## Trade-off

**`timestamptz` costs nothing in storage and gives up the ability to store a wall-clock
reading that has no instant.** That sounds like a limitation and is almost always a
benefit: the cases where you truly want a floating local time are rare, specific, and
better modelled as a local time plus an explicit zone name. The real cost is at the driver
boundary — `timestamp` and `date` both become JavaScript `Date` objects interpreted in the
client's zone, so the type discipline you keep in the schema has to be repeated in the
application.

## Gotchas

**Symptom:** Timestamps shift when the server moves or the container zone changes
**Cause:** `timestamp without time zone` — the offset was discarded on input
**Fix:** `timestamptz`; migrate with `ALTER … TYPE timestamptz USING col AT TIME ZONE 'UTC'`

**Symptom:** A date is one day earlier in the application than in the database
**Cause:** `date` became a `Date` at local midnight, west of UTC in the client's zone
**Fix:** `to_char(d,'YYYY-MM-DD')`, or `setTypeParser(1082, v => v)`

**Symptom:** `created_at` values from one transaction differ by microseconds
**Cause:** `clock_timestamp()` instead of `now()`
**Fix:** `now()` — it is frozen for the transaction

**Symptom:** "Tomorrow at the same time" is an hour out twice a year
**Cause:** `+ interval '24 hours'` instead of `+ interval '1 day'`, or arithmetic done in UTC
**Fix:** Do the arithmetic `AT TIME ZONE` the user's zone; the two intervals mean different things

**Symptom:** `AT TIME ZONE` produced the opposite of what you wanted
**Cause:** It converts `timestamptz`→`timestamp` and `timestamp`→`timestamptz` — direction depends on input type
**Fix:** Check the input type; the result type tells you which conversion happened

**Symptom:** Timestamps written by two services disagree
**Cause:** `timestamp` columns with each service using its own local zone
**Fix:** `timestamptz` everywhere, and let the database do the conversion

## Interview questions

**★ Does `timestamptz` store a time zone?**
No. It stores a UTC instant in 8 bytes — the same size as `timestamp`. The zone is used to
interpret input and to format output for the session.

**★ What actually differs between the two?**
`timestamptz` knows which instant it refers to, so it renders correctly in any session zone
— measured, the same value displayed as 04:30+00, 10:00+05:30 and 00:30−04. `timestamp`
keeps the digits and means a different instant to every reader.

**★ Which do you use, and when is the other right?**
`timestamptz` for every event, audit and expiry. `timestamp` only for a floating wall-clock
value with no instant — a recurring local opening time — and then store the zone name too.

**★ `now()` versus `clock_timestamp()`?**
`now()` is the transaction's start time and does not change within it — measured identical
200 ms apart. `clock_timestamp()` is the real clock and changes on every call.

**★ Why is a `date` column a day off in Node?**
`pg` turns it into a `Date` at local midnight. In `Asia/Calcutta` that is 18:30 UTC the
previous day, so `toISOString()` prints the day before. Fix with `to_char` or
`setTypeParser(1082, v => v)`.

**Does `+ interval '1 day'` equal `+ interval '24 hours'`?**
Not across a DST boundary in a local zone — one keeps the wall-clock time, the other adds
24 real hours. On a UTC-normalised `timestamptz` they agree.

**How do you migrate a `timestamp` column to `timestamptz`?**
`ALTER TABLE t ALTER COLUMN c TYPE timestamptz USING c AT TIME ZONE 'UTC'` — naming the zone
the existing values were written in. It rewrites the table.

---

← [text vs varchar vs char](03-text.md) · Next → [Time zones](05-time-zones.md)
