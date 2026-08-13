---
title: "text vs varchar vs char"
sidebar_label: "03 · text vs varchar"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex33-types-core.mjs`.

**Use `text`. In PostgreSQL the three string types are the same implementation; `varchar(n)`
adds a length check and `char(n)` adds space padding that breaks comparisons. The habit of
declaring `varchar(255)` comes from other databases where it mattered.**

## They are the same speed and the same size

```console
$ node ex33-types-core.mjs
=== 3. text, varchar(n) and char(n) ===
text        :   13 MB, equality scan 25.8 ms
varchar(50) :   13 MB, equality scan 26.4 ms
char(50)    :   24 MB, equality scan 33.5 ms
```

300 000 rows of the same values. **`text` and `varchar(50)` are identical in size and
speed.** `char(50)` is nearly twice the size and slower, because it pads every value to the
declared width.

```console
stored: {"t":"abc","v":"abc","c":"abc                                               ",
         "t_len":3,"v_len":3,"c_len":3,
         "t_bytes":4,"v_bytes":4,"c_bytes":51, ...}
```

**4 bytes for `text` and `varchar`, 51 for `char(50)`** storing the same three characters.
Note `length(c)` still reports 3 — the padding is stripped in `length()` but stored on disk
and visible in concatenation:

```console
"char_equals_abc":true, "char_concat":"abcabc|"
```

`char(50) = 'abc'` is **true** — `char` comparison ignores trailing spaces — yet
concatenating gives `abcabc|` with no padding, because the value was implicitly cast to
`text` first. Two different rules for the same value depending on context, which is the
whole reason to avoid the type.

```console
char(50) compared ignoring trailing spaces       ok  {"eq":true,"text_eq":false}
```

The contrast is the point: `'abc '::char = 'abc'::char` is true, `'abc '::text = 'abc'::text`
is false. Padding-insensitive comparison sounds convenient until a value round-trips through
your application and the trailing spaces come back as real characters.

## What `varchar(n)` actually gives you

```console
CAST to varchar(50) of 60 chars  -> length 50 (silently truncated)
INSERT 60 chars into a varchar(50) col         ->  22001 value too long for type character varying(50)
INSERT 60 chars into the text col              ok  {"len":60}
```

Two different behaviours worth separating:

- **Inserting into a `varchar(50)` column raises `22001`** — a real constraint, enforced.
- **An explicit cast `::varchar(50)` truncates silently.** No error, no warning, data gone.

So `varchar(n)` is a length constraint that some code paths enforce and others quietly
bypass. If you want a length limit, say so where it cannot be cast away:

```sql
name text NOT NULL CHECK (length(name) <= 50)
```

That is explicit, appears in `\d`, cannot be silently truncated by a cast, and — unlike
`varchar(n)` — can be changed without rewriting the table.

## Changing the limit

```console
widen varchar(20)->varchar(40): 2.4 ms
narrow varchar(40)->varchar(10): 305.2 ms (rewrites)
```

**Widening a `varchar` is metadata-only (2.4 ms); narrowing rewrites the whole table
(305 ms for 200 000 rows), holding `ACCESS EXCLUSIVE` throughout.** With `text` plus a
`CHECK`, changing the limit in either direction is a constraint swap you can do with
`NOT VALID` and validate concurrently
([see table locks and DDL](../phase-11-mvcc/10-table-locks-ddl.md)).

This is the practical argument, more than the aesthetic one: **`varchar(n)` bakes a number
you guessed into the table's physical structure.**

## The rule

```sql
CREATE TABLE users (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email    text NOT NULL UNIQUE,                              -- just text
  name     text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  country  char(2),          -- the one legitimate char(n): a genuinely fixed-width code
  bio      text
);
```

- **`text` for everything**, with a `CHECK` where a limit is genuinely a business rule.
- **`varchar(n)`** when a standard or an external system mandates the width, or when an ORM
  generates it and it is not worth fighting.
- **`char(n)`** only for genuinely fixed-width codes — ISO country codes, currency codes —
  and even then `text` with `CHECK (length(x) = 2)` avoids the padding semantics entirely.

Validate real limits in the application too, so users get a useful message rather than
`22001`. The database constraint is the backstop, not the UX.

## Encoding, collation and length

`length()` counts **characters**, `octet_length()` counts **bytes** — they differ for any
non-ASCII text in a UTF-8 database. Sorting and comparison follow the column's collation,
and the collation comes from the database or the column, not the type. That has a
measurable consequence across environments: an Alpine (musl) container and a Debian (glibc)
one sort the same strings differently, which is why `version()` naming the platform
[matters when debugging](../phase-1-psql/01-connecting.md).

For case-insensitive matching, `citext` or a `lower()` expression index rather than a
different string type — see [network, geometric, citext](14-network-geo-citext.md) and
[expression indexes](../phase-10-indexes/10-expression.md).

## Trade-off

**`text` gives up the schema-level length declaration, and gives up nothing else.** The
argument for `varchar(n)` is that the limit is self-documenting and enforced at the
boundary; the argument against is that the enforcement is inconsistent (casts truncate
silently), the number is almost always arbitrary, and shrinking it later rewrites the
table. A `CHECK` constraint keeps the documentation and the enforcement while staying
cheap to change. `char(n)` has no argument at all outside fixed-width codes: it is bigger,
slower, and comparison semantics differ from every other string type.

## Gotchas

**Symptom:** `22001 value too long for type character varying(n)`
**Cause:** The value exceeds the declared width
**Fix:** Validate in the application; consider `text` with a `CHECK`

**Symptom:** A value was silently truncated with no error
**Cause:** An explicit `::varchar(n)` cast truncates rather than raising — measured
**Fix:** Do not cast to a length-limited type; constrain the column instead

**Symptom:** Comparisons match despite trailing spaces
**Cause:** `char(n)` comparison ignores trailing padding
**Fix:** Use `text`

**Symptom:** Values come back padded with spaces
**Cause:** `char(n)` stores the padding; some contexts strip it and others do not
**Fix:** `text`, or `rtrim()` on read as a stopgap

**Symptom:** Shrinking a `varchar` limit locked the table for minutes
**Cause:** Narrowing rewrites the table under `ACCESS EXCLUSIVE` — measured 305 ms per 200 000 rows
**Fix:** `text` plus a `CHECK`, which can be swapped with `NOT VALID` + `VALIDATE`

**Symptom:** `length()` disagrees with the byte count you expected
**Cause:** `length()` counts characters; `octet_length()` counts bytes
**Fix:** Use the one you mean; they differ for all non-ASCII text

## Interview questions

**★ Is `varchar(n)` faster or smaller than `text` in PostgreSQL?**
No. Measured identical: 13 MB and ~26 ms for both on 300 000 rows. They share an
implementation; `varchar(n)` only adds a length check.

**★ What is wrong with `char(n)`?**
It pads to the declared width — measured 51 bytes versus 4 for the same three characters,
and 24 MB versus 13 MB per table — and its comparison ignores trailing spaces, which
differs from every other string type.

**★ Does `varchar(n)` reliably enforce its limit?**
No. Inserting into the column raises `22001`, but an explicit `::varchar(n)` cast truncates
silently. Measured both.

**★ How do you impose a length limit properly?**
`text` with `CHECK (length(col) <= n)`. It is explicit, cannot be cast away, and can be
changed without rewriting the table.

**★ Why does shrinking a `varchar` limit hurt?**
It rewrites the table under `ACCESS EXCLUSIVE` — measured 305 ms for 200 000 rows.
Widening is metadata-only at 2.4 ms.

**When is `char(n)` acceptable?**
Genuinely fixed-width codes like ISO country codes — and even then `text` with a `CHECK`
avoids the padding semantics.

**Why can the same query sort differently in two environments?**
Collation comes from the database/column, and the C library provides it. A musl-based
Alpine image and a glibc-based Debian one order the same strings differently.

---

← [numeric vs float](02-numeric-vs-float.md) · Next → [timestamptz vs timestamp](04-timestamptz.md)
