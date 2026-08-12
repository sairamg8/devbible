---
title: "Type parsing"
sidebar_label: "08 · Type parsing"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`,
> server `TimeZone: UTC`), **Node 24.19.0** (`TZ: Asia/Calcutta`, UTC+5:30), `pg` 8.23.0.
> Script: `sandbox/pg-api/ex21-types-prepared.mjs`.

**PostgreSQL sends text; `pg` converts it using the column's type OID. Most conversions
are obvious. Four are not — `bigint` and `numeric` become strings, `interval` becomes an
object, and both `date` and `timestamp` are interpreted in the *Node process's* time
zone.**

## The full mapping

```console
$ node ex21-types-prepared.mjs
=== 1. default type mapping ===
bool         oid 16    → boolean  Boolean           true
int2         oid 21    → number   Number            42
int4         oid 23    → number   Number            42
int8         oid 20    → string   String            "9007199254740993"
float4       oid 700   → number   Number            1.5
float8       oid 701   → number   Number            1.5
numeric      oid 1700  → string   String            "10.00"
text         oid 25    → string   String            "txt"
date         oid 1082  → object   Date              "2026-08-11T18:30:00.000Z"
timestamp    oid 1114  → object   Date              "2026-08-12T08:15:00.000Z"
timestamptz  oid 1184  → object   Date              "2026-08-12T13:45:00.000Z"
interval     oid 1186  → object   PostgresInterval  {"days":1,"hours":2}
json         oid 114   → object   Object            {"a":1}
jsonb        oid 3802  → object   Object            {"a":1}
text_array   oid 1009  → object   Array             ["x","y"]
int_array    oid 1007  → object   Array             [1,2]
bytea        oid 17    → object   Buffer            {"type":"Buffer","data":[222,173,190,239
uuid         oid 2950  → string   String            "11111111-1111-1111-1111-111111111111"
null_int     oid 23    → object   null              null
```

The pleasant ones: `json`/`jsonb` arrive **already parsed** (no `JSON.parse`), arrays
arrive as real JavaScript arrays with their elements converted, `bytea` is a `Buffer`,
and `NULL` is `null` for every type.

## Why `bigint` and `numeric` are strings

```console
=== 2. why bigint arrives as a string ===
as returned (string) : 9007199254740993
Number(...)          : 9007199254740992 ← wrong, 9007199254740993 is unrepresentable
BigInt(...)          : 9007199254740993 ← exact
MAX_SAFE_INTEGER     : 9007199254740991
```

A JavaScript `number` is a double, exact only up to 2⁵³−1. PostgreSQL's `bigint` goes to
2⁶³−1, and `numeric` is arbitrary precision. Converting automatically would silently
corrupt values — as `Number()` does above, turning …993 into …992.

So `pg` returns the text and lets you decide. **This is the correct default**, and it is
why `count(*)` gives `'12'` rather than `12`:

```sql
SELECT count(*)::int AS n FROM t;      -- cast when the value is genuinely small
```

`numeric` is the same argument for a different reason: `0.1 + 0.2` in floats is
`0.30000000000000004`, which is unacceptable for money. Keep it a string and use a decimal
library, or convert deliberately knowing the risk
([Overriding type parsers](09-pg-types.md)).

## `date` and `timestamp` are read in Node's time zone

Two of the three temporal types are interpreted **locally**, and this machine runs
`Asia/Calcutta` (UTC+5:30) against a UTC server:

| Sent by the server | Arrives as | Correct? |
|---|---|---|
| `date '2026-08-12'` | `2026-08-11T18:30:00.000Z` | **No** — a day earlier in UTC |
| `timestamp '2026-08-12 13:45'` | `2026-08-12T08:15:00.000Z` | **No** — shifted by 5:30 |
| `timestamptz '2026-08-12 13:45+00'` | `2026-08-12T13:45:00.000Z` | Yes |

`date` has no time and no zone — a calendar day. `pg` turns it into a `Date` at **local
midnight**, so `toISOString()` reports the previous day for anyone east of UTC. Serialize
that to JSON and the API is off by one, invisibly, for some users and not others.

`timestamp` (without time zone) has no offset either, so the parser assumes local time.
If the value came from a UTC server it is now wrong by your offset.

`timestamptz` is a genuine instant and converts correctly. **Prefer it for everything that
is a moment in time** ([Date/time functions](../phase-4-crud/17-datetime-functions.md)),
and treat `date` as a calendar label that should never become a `Date` at all:

```js
pg.types.setTypeParser(1082, v => v);   // date → '2026-08-12' as a string
```

or keep it in SQL:

```sql
SELECT to_char(d, 'YYYY-MM-DD') AS day FROM t;
```

Both are measured in [`generate_series`](../phase-4-crud/18-generate-series.md), which is
where this trap first appears in the corpus.

## `interval` is an object, not milliseconds

```console
interval     oid 1186  → object   PostgresInterval  {"days":1,"hours":2}
```

`age()` and `now() - created_at` give you a `PostgresInterval` with `years`, `months`,
`days`, `hours`, `minutes`, `seconds` — deliberately, because months and days are not
fixed durations. One month is 28–31 days; one day across a DST boundary is 23 or 25
hours. There is no correct millisecond value to convert to.

If you want a number, ask the database for one:

```sql
SELECT extract(epoch FROM (now() - created_at)) AS age_seconds;   -- float8 → number
```

## OIDs are the lookup key

`fields[i].dataTypeID` is the OID `pg` uses to select a parser
([The result object](06-result-object.md)). The ones worth recognising:

| OID | Type | | OID | Type |
|---|---|---|---|---|
| 16 | `bool` | | 1082 | `date` |
| 17 | `bytea` | | 1114 | `timestamp` |
| 20 | `int8` | | 1184 | `timestamptz` |
| 21 | `int2` | | 1186 | `interval` |
| 23 | `int4` | | 1700 | `numeric` |
| 25 | `text` | | 2950 | `uuid` |
| 114 / 3802 | `json` / `jsonb` | | 1007 / 1009 | `int4[]` / `text[]` |

Array OIDs are separate from their element types, which matters when overriding parsers —
changing `1700` does not change `1231` (`numeric[]`).

Custom types — enums, domains, composites — get OIDs assigned at creation time, so they
differ per database and cannot be hard-coded. `pg` returns them as strings by default.

## Sending values the other way

Parameters go out through a separate path. JavaScript `Date` is sent as an ISO timestamp,
arrays become PostgreSQL array literals, objects are **not** automatically JSON — pass
`JSON.stringify(obj)` for a `json`/`jsonb` column, or cast:

```js
await pool.query(`INSERT INTO t (payload) VALUES ($1::jsonb)`, [JSON.stringify(obj)]);
```

`undefined` and `null` both become SQL `NULL`
([`pool.query` and placeholders](04-query-placeholders.md)).

## Trade-off

Returning `bigint` and `numeric` as strings is a correctness-over-convenience choice: no
silent precision loss, at the cost of a type most code has to convert, and of `===`
comparisons against numbers failing in ways that look like a bug.

Parsing `date` and `timestamp` into `Date` objects is the opposite trade — convenience
over correctness — and it is the one that actually causes production incidents, because
it is wrong only for some time zones and therefore passes review in UTC CI.

## Gotchas

**Symptom:** `id === 5` is false when the row's id is 5
**Cause:** `bigint` arrives as `'5'`.
**Fix:** Compare as strings, cast `::int` in SQL when the range allows, or override the
parser deliberately.

**Symptom:** A date is one day earlier in the API than in the database
**Cause:** `date` becomes a `Date` at local midnight — measured, `2026-08-12` arrived as
`2026-08-11T18:30:00.000Z`.
**Fix:** `to_char` in SQL, or `setTypeParser(1082, v => v)`.

**Symptom:** Timestamps are off by exactly the server's UTC offset
**Cause:** A `timestamp` (no zone) column interpreted as local time — measured, shifted
by 5:30.
**Fix:** Use `timestamptz` for instants.

**Symptom:** `interval` arithmetic in JavaScript produces `NaN`
**Cause:** It is a `PostgresInterval` object, not a number.
**Fix:** `extract(epoch FROM …)` in SQL.

**Symptom:** Money totals drift by fractions of a cent
**Cause:** Converting `numeric` to a float.
**Fix:** Keep it a string; use a decimal library, or integer minor units.

**Symptom:** `JSON.parse` throws on a `jsonb` column
**Cause:** It was already parsed.
**Fix:** Use it directly.

**Symptom:** Inserting an object into a `jsonb` column stores `[object Object]`
**Cause:** Outbound parameters do not auto-serialise objects.
**Fix:** `JSON.stringify` and cast `$1::jsonb`.

**Symptom:** A custom enum comes back as a string
**Cause:** Custom type OIDs are per-database and have no built-in parser.
**Fix:** Expected — look the OID up at startup if you need conversion.

## Interview questions

**★ Why does `pg` return `bigint` and `numeric` as strings?**
Because neither fits a JavaScript double without loss. Measured, `9007199254740993`
(above `MAX_SAFE_INTEGER`) survives as a string and becomes `9007199254740992` through
`Number()`. `numeric` is arbitrary-precision and used for money, where float rounding is
unacceptable. Returning text pushes the decision to you: cast `::int` in SQL for small
values, use `BigInt` for large ones, or a decimal library for money.

**★ What is the difference between `date`, `timestamp` and `timestamptz` when read from
Node?**
`timestamptz` is a real instant and converts correctly. `timestamp` has no offset, so the
parser assumes the Node process's local zone — measured, `13:45` arrived as `08:15Z`
under UTC+5:30. `date` becomes a `Date` at local midnight, so it reports the previous day
in UTC — measured, `2026-08-12` arrived as `2026-08-11T18:30Z`. Use `timestamptz` for
moments and keep `date` as a string.

**★ Why is `interval` an object rather than a number of milliseconds?**
Because months and days are not fixed durations — a month is 28 to 31 days, and a day
across a DST change is 23 or 25 hours — so there is no correct conversion. `pg` returns a
`PostgresInterval` with the components. Use `extract(epoch FROM …)` when you want a
number.

**Do you need to `JSON.parse` a `jsonb` column?**
No — it arrives parsed. Going the other way you *do* need `JSON.stringify`, since
outbound parameters do not serialise objects automatically.

**How does `pg` decide how to convert a value?**
By the column's type OID, sent in the row description and exposed as
`fields[i].dataTypeID`. Parsers are registered per OID, which is also how you override
them.

---

← [`pool.connect` and release](07-connect-release.md) · Next → [Overriding type parsers](09-pg-types.md)
