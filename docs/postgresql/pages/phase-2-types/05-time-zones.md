---
title: "Time zones and the session"
sidebar_label: "05 · Time zones"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex33-types-core.mjs`.

**The session's `TimeZone` is a display and interpretation setting, not storage. It decides
how a `timestamptz` is printed, how a bare timestamp literal is read, and — the one that
produces wrong reports — which calendar day a `GROUP BY` puts a row into.**

## The setting that changes your answers

```console
$ node ex33-types-core.mjs
GROUP BY day in UTC          : [{"day":"2026-06-15 00:00:00+00","n":2}]
  current_date 2026-08-12, first event at::date 2026-06-15
GROUP BY day in Asia/Kolkata : [{"day":"2026-06-16 00:00:00+05:30","n":2}]
  current_date 2026-08-12, first event at::date 2026-06-16
  same two rows, different day buckets and counts - the session zone decided
```

Two events at `21:00Z` and `23:30Z` on 15 June. **In UTC they belong to 15 June; in
`Asia/Kolkata` (+5:30) both belong to 16 June.** Same rows, same query, different report —
and `at::date` moved with them.

This is not a bug. "Which day did this happen on?" genuinely has no answer without a zone.
The bug is leaving the zone implicit and letting it be whatever the connection happened to
inherit — because then the same dashboard gives different numbers depending on which server
ran it.

**Always be explicit in aggregation:**

```sql
-- the report defines its own zone; the session cannot change the answer
SELECT date_trunc('day', at AT TIME ZONE 'Asia/Kolkata') AS day, count(*)
FROM events
GROUP BY 1 ORDER BY 1;

-- for a per-user report, the zone is data
SELECT date_trunc('day', e.at AT TIME ZONE u.timezone) AS day, count(*)
FROM events e JOIN users u ON u.id = e.user_id
WHERE u.id = $1
GROUP BY 1;
```

## Where the session zone comes from

```console
server TimeZone: UTC | client TZ: Asia/Calcutta
```

In order of precedence:

1. `SET TIME ZONE '…'` in the session, or `SET LOCAL` inside a transaction.
2. The `PGTZ` environment variable / connection `options`.
3. The `timezone` setting in `postgresql.conf` — the server default.
4. On many installations, the operating system's zone at initdb time.

```sql
SHOW TimeZone;                       -- what this session will use
SET TIME ZONE 'UTC';                 -- for this session
SET LOCAL TIME ZONE 'Asia/Kolkata';  -- for this transaction only
ALTER DATABASE app SET timezone = 'UTC';   -- a durable default for new connections
SELECT * FROM pg_timezone_names LIMIT 5;   -- the zones this server knows
```

**Set the server and database to UTC and leave them there.** Then every implicit conversion
is a no-op, and every zone-sensitive operation has to name its zone — which is what you
want, because it forces the decision into the query where it belongs.

Note the sandbox's own mismatch above: server UTC, client `Asia/Calcutta`. That gap is what
makes the [`date` trap](04-timestamptz.md) reproduce, and it is the normal state of affairs
— your laptop is rarely in UTC.

## From Node: the pool must be explicit

`pg` does not set a time zone; each connection inherits the server default. If the
application depends on it — and any query using `current_date`, `date_trunc` on a
`timestamptz`, or a bare timestamp literal does — pin it:

```js
const pool = new pg.Pool({
  connectionString,
  options: '-c timezone=UTC',       // every connection in this pool
});
```

Do **not** use `SET TIME ZONE` on a checked-out client without resetting it: pooled
connections keep session state after `release()`
([measured in phase 11](../phase-11-mvcc/07-row-locks.md)), so the next request inherits it.
Inside a transaction, `SET LOCAL TIME ZONE` is safe because it reverts on commit.

But `SET` is a utility statement, not a planned query, so it has no parameter slots —
`` c.query(`SET LOCAL TIME ZONE $1`, [tz]) `` fails at parse with
`42601 syntax error at or near "$1"`, and the obvious workaround (interpolating `tz` into
the string) is an injection hole on a value that came from the user. `set_config(name,
value, is_local)` is the function form, and it is the only way to set a runtime parameter
from a bind value:

```js
await withTransaction(pool, async (c) => {
  await c.query('SELECT set_config($1, $2, true)', ['timezone', user.timezone]);  // true = LOCAL
  return c.query(`SELECT date_trunc('day', at) AS day, count(*) FROM events GROUP BY 1`);
});
```

The alternative — and usually the better one — is to leave the session in UTC and put
`AT TIME ZONE` in the query, so the behaviour is visible in the SQL rather than in
connection state.

## Zone names, abbreviations and offsets

```sql
SET TIME ZONE 'Asia/Kolkata';   -- IANA name: follows DST and historical rule changes
SET TIME ZONE 'IST';            -- abbreviation: ambiguous (India? Israel? Ireland?)
SET TIME ZONE '+05:30';         -- fixed offset: never observes DST
SET TIME ZONE INTERVAL '-5 hours';
```

**Use IANA names.** An abbreviation may be ambiguous, and a fixed offset silently gets DST
wrong for half the year. IANA names also carry history, so a timestamp from 2010 is
interpreted with 2010's rules.

Storing a user's zone means storing the IANA name (`'Europe/London'`), not an offset — the
offset changes twice a year and the name does not.

## Trade-off

**Pinning everything to UTC makes the database boringly predictable and pushes every
zone decision into query text or application code.** That is more typing than letting the
session default do it, and it is the only arrangement that gives the same answer from every
client. The cost lands on report queries, which must name their zone explicitly, and on
per-user features, which must carry a zone column. The alternative — a session zone that
varies by client — produces dashboards that disagree with each other and cannot be
reproduced.

## Gotchas

**Symptom:** Daily totals differ between two clients or two environments
**Cause:** `date_trunc('day', ts)` used the session zone, which differed — measured, the same two rows fell on different days
**Fix:** `date_trunc('day', ts AT TIME ZONE 'UTC')` or the user's zone, explicitly

**Symptom:** `current_date` is a day ahead or behind expectations
**Cause:** It is evaluated in the session zone
**Fix:** Be explicit: `(now() AT TIME ZONE 'Asia/Kolkata')::date`

**Symptom:** A time zone set in one request affects a later, unrelated one
**Cause:** `SET TIME ZONE` persists on a pooled connection after release
**Fix:** `SET LOCAL` inside a transaction, or pin the pool with `options: '-c timezone=UTC'`

**Symptom:** Times are an hour off for half the year
**Cause:** A fixed offset (`'+05:30'`, `'-5 hours'`) instead of an IANA zone name
**Fix:** Use `'Asia/Kolkata'`, `'America/New_York'` — they follow DST

**Symptom:** A stored offset no longer matches the user's actual time
**Cause:** Offsets change with DST and with legislation; names do not
**Fix:** Store the IANA name and derive the offset when needed

**Symptom:** A bare timestamp literal was interpreted unexpectedly
**Cause:** `'2026-06-15 10:00'` with no offset is read in the session zone
**Fix:** Always include an offset, or cast explicitly with `AT TIME ZONE`

## Interview questions

**★ What does the session `TimeZone` setting affect?**
Display of `timestamptz`, interpretation of timestamp literals without an offset, and every
zone-sensitive function — `current_date`, `date_trunc`, `::date`. It does not affect storage.

**★ Show how the session zone changes a report.**
Measured: two events at 21:00Z and 23:30Z on 15 June grouped into 15 June under UTC and into
16 June under `Asia/Kolkata`. Same rows, same query.

**★ How do you make a report zone-independent?**
Name the zone in the query: `date_trunc('day', at AT TIME ZONE 'UTC')`, or join the user's
stored zone for a per-user report.

**★ How do you set a zone safely with a connection pool?**
Pin the whole pool with `options: '-c timezone=UTC'`, or use `SET LOCAL` inside a
transaction. A plain `SET` leaks to the next user of that connection.

**★ Why store an IANA name rather than an offset?**
Offsets change with DST and legislation; names carry the full history, so past and future
timestamps are interpreted with the correct rules.

**What should the server default be?**
UTC. Then implicit conversions are no-ops and anything zone-sensitive has to say so
explicitly.

**Why avoid abbreviations like `IST`?**
They are ambiguous across countries and do not carry DST history.

---

← [timestamptz vs timestamp](04-timestamptz.md) · Next → [NULL semantics](06-null.md)
