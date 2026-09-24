---
name: devbible-postgresql-phase2-types
description: The measured dataset behind the 16 Phase 2 type pages — uuid v4 vs v7 index cost, jsonb bigger than json, the cast that costs 241x, enum/CHECK/lookup change costs, and the JS type mapping
metadata:
  type: reference
---

# PostgreSQL Phase 2 (data types) — measured findings

Landed session 5 (2026-08-12), third phase that session. **16 pages covering 17 syllabus
rows** — page `09-boolean-dates.md` deliberately covers both the `boolean` row and the
`date/time/interval` row (granularity rule). `progress.js` therefore reads
`topics: 17, pages: 16` with **no `pagesPlanned`** — same pattern as phase 0.

Scripts: `ex33-types-core.mjs` (pages 01–08), `ex34-types-more.mjs` (09–16).

Parent: [[devbible-postgresql-rewrite-handoff]]

## The results that contradicted the obvious expectation

- **jsonb was BIGGER than json** on a small object: **112 bytes vs 56**. The binary header
  and per-key offsets outweigh the whitespace saved. The "jsonb is more compact" folklore is
  wrong at small sizes — the pages say choose on queryability, not size.
- **`= ANY(tags)` does NOT use a GIN index**; `@> ARRAY['x']` does. Measured 41.8 ms
  (parallel seq scan) vs **4.8 ms**. Same logic, different plan. Easy to get wrong because
  `= ANY` reads more naturally.
- **`varchar(n)` behaves two different ways**: an explicit `::varchar(50)` cast **silently
  truncates** 60 chars to 50, while inserting into a `varchar(50)` **column** raises
  `22001`. So the "constraint" is bypassable.
- **`interval '1 month' = interval '30 days'` is TRUE**, and so is `1 day = 24 hours` —
  comparison normalises, but *addition* uses the real calendar (31 Jan + 1 month =
  **28 Feb**). Two different rule sets in one type.
- **A `UNIQUE` column accepted three NULLs.** `UNIQUE NULLS NOT DISTINCT` (PG15+) → `23505`
  on the second.
- **An `int` identity PK exhausting its sequence gives `2200H`**, not `22003`.
- **`text` and `varchar(50)` are identical**: both 13 MB / ~26 ms on 300k rows.
  `char(50)` is **24 MB** and slower, and stores 51 bytes for `'abc'` (4 for the others).

## The headline numbers

**uuid keys, 200k inserts each** (the strongest argument on the phase):

| Key | Insert | PK index |
|---|---|---|
| `bigint` identity | 947 ms | 4408 kB |
| `uuid` v4 | **1727 ms** | **8552 kB** |
| `uuid` v7 (PG18 `uuidv7()`) | 1356 ms | 6184 kB |

uuid as `text` = **40 bytes** vs 16 as `uuid`. PG18 also has `uuidv4()`,
`uuid_extract_version()`, `uuid_extract_timestamp()` — the last one means **v7 leaks
creation time**.

**Casting on the column (400k rows, both indexed):**
- `acct = '12345'` → Index Only Scan **0.199 ms**; `acct::bigint = 12345` → Parallel Seq
  Scan **47.9 ms** (**241×**)
- `created > now() - 1h` → **1.18 ms**; `created::date = current_date` → **65.4 ms**
- `acct = 12345` (no cast) → `42883 operator does not exist: text = integer`

**numeric vs float:** 1000 × 0.01 summed = float8 **9.999999999999831**, numeric
**10.00**. Sum over 300k: numeric(12,2) **76.8 ms**, float8 27.3, bigint cents 27.7
(numeric is 2.8× slower, 10 bytes vs 8). numeric rounds half-away-from-zero (`2.5→3`);
float→int is half-to-even (`2.5→2`).

**enum vs CHECK vs lookup**, 200k rows: sizes 7080 kB / 8656 / 8656 (enum ~18% smaller,
4 bytes vs 8). Adding a value: **lookup INSERT 3.4 ms · enum ALTER TYPE 15.5 ms · CHECK
drop+add 62.9 ms (re-validates every row)**. Errors: `22P02` / `23514` / `23503`.
`ALTER TYPE DROP VALUE` → **`0A000` not implemented**. ADD VALUE + use in one transaction →
**`55P04`**. Enum sorts in **declaration order**; text sorts alphabetically.

**jsonb queries, 200k rows:** json `->>` 98.7 ms · jsonb `->>` 33.6 · jsonb `@>` 40.3 ·
jsonb `@>` **with GIN 9.4 ms** (index 12 MB). GIN on a `json` column → **`42704`**.
`json = json` → **`42883` no equality operator at all**.

**arrays:** `@>` 73.2 ms → **4.8 ms with GIN** (920 kB). FK from an array element →
**`42804` cannot be implemented**. Out-of-range subscript returns **NULL**, and arrays are
1-based.

**timestamptz:** both tz and notz are **8 bytes**, date is 4. Same stored value displayed in
UTC / Asia/Kolkata / America/New_York moved for timestamptz and **did not** for timestamp.
**GROUP BY day changed the answer with the session zone** — two events at 21:00Z and 23:30Z
bucketed to 15 June in UTC and **16 June** in Asia/Kolkata.
`now()` identical 200 ms apart in one tx; `clock_timestamp()` changed.

**bytea:** 102 400 bytes round-tripped byte-identical as a Buffer;
`pg_column_size` **1185** (TOAST compressed, `attstorage='x'`). Text form is 2× (hex).

**ranges:** half-open by default — `int4range(1,10,'[]')` normalises to `[1,11)`. Exclusion
constraint gave **`23P01`** on overlap, allowed the same times in another room, and allowed
back-to-back bookings for free. Range union with a gap → **`22000` not contiguous**;
multirange handles it (`{[1,5),[10,15)}`). Needs `btree_gist`.

**domains/composites:** domain violation → `23514` naming the domain constraint; a domain
over `citext` **keeps** case-insensitivity. **A composite column comes back to `pg` as the
raw string `("1 High St",London,"E1 6AN")`** — unparsed. That is the argument against
composites for storage.

**citext:** case-variant insert into a `citext UNIQUE` → **`23505`**. `cidr` with host bits
→ `22P02`. `inet` is 10 bytes vs 16 as text; IPv6 is 22.

## JS type mapping confirmed again (matches phase 7's table)

`int4`→number · **`int8`→string** · **`numeric`→string** · `float8`/`float4`→number ·
`json`/`jsonb`→**parsed object** · `interval`→**PostgresInterval object** (`{days,hours}`) ·
`date`→**Date at local midnight** (the day-shift trap) · `bytea`→Buffer · `uuid`→string ·
`point`→`{x,y}` · **range→string `"[1,10)"`** · **composite→raw string**.

## Traps hit while measuring

- An unguarded `q()` for the range-union case crashed the script — the error was the point,
  so it needed `tryq`. Every "this should fail" probe must be wrapped.
- First draft measured `varchar` truncation only via a cast, which hid the `22001` column
  behaviour — the case people actually hit. Both are now on the page.

Related: [[devbible-postgresql-rewrite-handoff]] · [[devbible-postgresql-phase11-mvcc]] ·
[[devbible-postgresql-phase1-psql]] · [[devbible-verify-your-own-measurements]]
