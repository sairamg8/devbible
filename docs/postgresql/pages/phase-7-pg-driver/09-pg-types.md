---
title: "Overriding type parsers"
sidebar_label: "09 · Overriding parsers"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex21-types-prepared.mjs`.

**`pg.types.setTypeParser` changes how a PostgreSQL type becomes a JavaScript value. It
is a single global registry for the whole process — including code you did not write —
so the decision is architectural, not a local convenience.**

## Changing a parser

```console
$ node ex21-types-prepared.mjs
=== 3. pg.types.setTypeParser ===
defaults → { n: '123', m: '10.50', d: 2026-08-11T18:30:00.000Z } | date is a JS Date: true
overridden → { n: '123n', m: 10.5, d: '2026-08-12' } | typeof m: number | typeof d: string
  ↑ setTypeParser is PROCESS-WIDE and affects every pool and query
```

```js
import pg from 'pg';

pg.types.setTypeParser(20,   v => BigInt(v));   // int8    → BigInt
pg.types.setTypeParser(1700, v => Number(v));   // numeric → number
pg.types.setTypeParser(1082, v => v);           // date    → keep the string
```

Register before opening the pool, in one module, once. The parser receives the raw text
and returns whatever you want; it is never called for `NULL`, so no null check is needed.

## The three real decisions

### `date` (1082) → string — do this

```js
pg.types.setTypeParser(1082, v => v);
```

The only one of these that is close to unambiguous. A `date` is a calendar label, and
turning it into a `Date` at local midnight produces off-by-one days for anyone east or
west of the server ([Type parsing](08-type-parsing.md)). Keeping the string is what the
value actually is.

### `int8` (20) → number or BigInt — it depends

```js
pg.types.setTypeParser(20, v => Number(v));   // convenient, lossy above 2^53
pg.types.setTypeParser(20, v => BigInt(v));   // exact, but BigInt is contagious
```

`Number` is what most applications want and is safe while ids stay below
9 007 199 254 740 991 — which, for a row counter, is essentially forever. The risk is
that it fails *silently* if a value ever exceeds it: a Snowflake id, a hash, a
`bigint` used as a bitmask.

`BigInt` is exact and awkward: `JSON.stringify` throws on it, it will not mix with
numbers in arithmetic, and `1n === 1` is false. If you choose it, you need a JSON
serializer that handles it.

The third option is to change nothing and cast per query — `count(*)::int`, `id::int` —
which keeps the global default honest and makes each conversion visible. That is the
approach the rest of this corpus uses.

### `numeric` (1700) → number — usually do not

```js
pg.types.setTypeParser(1700, v => Number(v));   // measured: '10.50' → 10.5
```

Tempting and wrong for money. `numeric` exists precisely because floats cannot represent
decimal fractions exactly. Converting throws that away everywhere, including in code that
sums thousands of rows. Keep the string and use a decimal library, or store integer minor
units (cents) as `bigint` and skip the problem.

## The global registry is genuinely global

```console
  ↑ setTypeParser is PROCESS-WIDE and affects every pool and query
```

There is one registry per process. It applies to every pool, every query, and **every
library that uses `pg`** — a session store, a job queue, a migration tool. If you make
`numeric` a number, a library that relied on getting a string now gets a number, and
nothing warns either of you.

Consequences worth planning for:

- A library in your dependency tree may call `setTypeParser` itself. Yours wins or loses
  depending on import order, which is not something you want load-bearing.
- Registering after a pool is created still works (parsers are looked up per result), so
  a late registration can change behaviour mid-run.
- Tests that register parsers leak into other tests in the same process.

Put every call in one `db/types.js`, import it first, and treat changes to it as a
breaking change.

## Per-query parsing, when you want it local

```js
import { types } from 'pg';

const bigintAsNumber = new types.TypeOverrides();
bigintAsNumber.setTypeParser(20, v => Number(v));

const {rows} = await pool.query({
  text: 'SELECT id FROM t WHERE id = $1',
  values: [id],
  types: bigintAsNumber,      // this query only
});
```

`TypeOverrides` scopes the change to one query, or to one pool if passed in the pool
config. It is more typing and it is the safe form — no action at a distance. Reach for it
when a single report needs numbers and the rest of the application does not.

## Casting in SQL is often the better answer

```console
per-query casts → { n: 123, d: '2026-08-12' } | typeof n: number
```

```sql
SELECT (id)::int AS id, to_char(created_on, 'YYYY-MM-DD') AS day, count(*)::int AS n
```

No global state, visible at the call site, and the intent is recorded in the query that
needs it. The cost is repetition, and that a cast which overflows raises an error rather
than silently truncating — which is arguably a feature.

## Array types have their own OIDs

Changing `1700` (`numeric`) does not change `1231` (`numeric[]`); changing `20` (`int8`)
does not change `1016` (`int8[]`). Override both, or be surprised when a column of
aggregated values behaves differently from the scalar version.

```js
pg.types.setTypeParser(20,   v => Number(v));
pg.types.setTypeParser(1016, pg.types.getTypeParser(1016));   // still the array parser
```

`getTypeParser(oid)` returns the current parser, which is how you wrap rather than replace
one, and how you restore a default after a test.

## Custom types

Enums, domains and composites get OIDs at creation time, so they differ per database and
cannot be hard-coded. Look them up at startup if you need custom handling:

```js
const {rows: [{oid}]} = await pool.query(
  `SELECT oid FROM pg_type WHERE typname = $1`, ['order_status']);
pg.types.setTypeParser(oid, v => v.toUpperCase());
```

## Trade-off

A global parser is written once and every query benefits, with no repetition — at the cost
of invisible, process-wide behaviour that a reader of any individual query cannot see, and
that reaches into third-party code.

Per-query `TypeOverrides` and SQL casts are explicit and local, at the cost of repetition
and of being easy to forget in the one place it mattered.

A defensible default: `date` → string globally, everything else left alone and cast in
SQL where needed.

## Gotchas

**Symptom:** A library that uses `pg` starts misbehaving after a change to types
**Cause:** `setTypeParser` is process-wide.
**Fix:** Prefer `TypeOverrides` or SQL casts; keep global calls in one reviewed module.

**Symptom:** Ids are numbers in one part of the app and strings in another
**Cause:** A parser registered after some code path already ran, or import-order
dependence.
**Fix:** Register in one module imported before anything opens a pool.

**Symptom:** `Do not know how to serialize a BigInt`
**Cause:** `JSON.stringify` on a `BigInt` from an `int8` override.
**Fix:** A custom serializer, or parse to `Number` if the range is safe.

**Symptom:** Money is wrong in the last decimal place
**Cause:** `numeric` parsed to a float.
**Fix:** Revert it; use strings with a decimal library, or integer minor units.

**Symptom:** An array column ignores the override
**Cause:** Array types have distinct OIDs.
**Fix:** Override the array OID too.

**Symptom:** A custom enum's OID differs between environments
**Cause:** Custom type OIDs are assigned per database.
**Fix:** Query `pg_type` at startup; never hard-code.

**Symptom:** Tests interfere with each other after adding a parser
**Cause:** The registry is shared across the test process.
**Fix:** Restore with `getTypeParser` in teardown, or use `TypeOverrides`.

## Interview questions

**★ How do you make `bigint` come back as a number, and should you?**
`pg.types.setTypeParser(20, v => Number(v))`. It is safe while values stay under
2⁵³−1 and silently lossy above it, so it is fine for row-counter ids and wrong for
Snowflake ids or bitmasks. `BigInt` is exact but does not serialise to JSON and will not
mix with numbers. Casting `::int` in the queries that need it avoids the global decision
entirely.

**★ What is the scope of `setTypeParser`?**
The whole process — measured, it affects every pool and every query, including
third-party libraries using `pg`. That makes it an architectural decision. `TypeOverrides`
scopes the same change to one query or one pool.

**★ Which parser override is almost always right?**
`date` (OID 1082) to a plain string. A `date` is a calendar label with no time and no
zone; converting it to a `Date` at local midnight produces off-by-one days once the
process is not in UTC.

**★ Why not parse `numeric` to a JavaScript number?**
Because `numeric` is used where decimal exactness matters — money above all — and a double
cannot represent decimal fractions exactly. The override is measured to work (`'10.50'` →
`10.5`) and quietly reintroduces rounding error across every sum in the application.

**How do you handle a custom enum type?**
Look its OID up in `pg_type` at startup, since OIDs for custom types are assigned per
database, then register a parser for that value. Never hard-code the number.

---

← [Type parsing](08-type-parsing.md) · Next → [Prepared statements](10-prepared.md)
