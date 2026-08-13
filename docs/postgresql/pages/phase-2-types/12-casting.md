---
title: "Casting"
sidebar_label: "12 · Casting"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex34-types-more.mjs`.

**A cast on the wrong side of a comparison turns a 0.2 ms index lookup into a 48 ms
sequential scan. The rule is one line: cast the literal, never the column.**

## The measurement

```console
$ node ex34-types-more.mjs
=== 12. casting — the three kinds, and the one that kills an index ===
acct = '12345'          : ->  Index Only Scan using ty_cast_acct_idx on ty_cast … 0.199 ms
acct::bigint = 12345    : ->  Parallel Seq Scan on ty_cast … 47.949 ms  <- cast on the COLUMN
created > now() - 1h    : ->  Index Only Scan using ty_cast_created_idx on ty_cast … 1.179 ms
created::date = current_date   : ->  Parallel Seq Scan on ty_cast … 65.397 ms  <- cast on the COLUMN
```

400 000 rows, indexes on both columns. **0.199 ms against 47.9 ms — 241× — from one
`::bigint`.** And 1.2 ms against 65.4 ms from one `::date`.

The reason is mechanical: an index stores `acct`, not `acct::bigint`. Those are different
values with no derivable ordering between them, so the index cannot be searched. Worse,
**casting the column means evaluating the cast for every row in the table.**

The fix is always to move the cast to the other side:

```sql
-- kills the index
WHERE acct::bigint = 12345
WHERE created::date = current_date
WHERE lower(email) = 'a@b.com'

-- uses it
WHERE acct = '12345'
WHERE created >= current_date AND created < current_date + 1
WHERE email = 'a@b.com'          -- or index lower(email) deliberately
```

The date one is worth memorising as a rewrite: **a range on the bare column** replaces
`::date` equality and gets the same rows. The general treatment of this is in
[why an index is not used](../phase-10-indexes/05-index-not-used.md), and
[expression indexes](../phase-10-indexes/10-expression.md) cover the case where you genuinely
want to index the transformed value.

## Why a cast appears at all

```console
acct = 12345 with no cast at all                 ->  42883 operator does not exist: text = integer
```

**PostgreSQL is strict**: there is no `text = integer` operator, so it raises `42883` rather
than guessing. That error is what prompts people to add `::bigint` — and adding it on the
left is the natural place, which is exactly the wrong one.

**Treat `42883` as a type-mismatch bug to fix, not an inconvenience to cast away.** If a
`text` column holds numbers, the real fix is usually the column type.

## The three kinds of cast

```console
implicit vs explicit: {"int_plus_numeric":"2.5","result_type":"numeric","text_concat_int":"55","cast_type":"text"}
cast styles are equivalent: {"pg_style":42,"sql_style":42,"function_style":42}
```

- **Implicit** — applied automatically. `1 + 1.5` promotes the integer and yields `numeric`.
  These exist only where they are unambiguous and lossless.
- **Assignment** — applied when storing into a column, e.g. inserting a text literal into a
  `date` column.
- **Explicit** — you wrote it. `x::int`, `CAST(x AS int)` and `int4(x)` are three spellings of
  the same thing; `::` is the PostgreSQL idiom and `CAST` is standard SQL.

Note `'5' || 5` produced `'55'`: the `||` operator resolved the integer to text. Implicit
promotion toward text is a common source of "why is this a string".

## What fails, and what silently succeeds

```console
'abc'::int                                       ->  22P02 invalid input syntax for type integer: "abc"
'  42  '::int (whitespace)                       ok  {"v":42}
'42.7'::int                                      ->  22P02 invalid input syntax for type integer: "42.7"
42.7::int (rounds)                               ok  {"v":43}
'2026-13-01'::date                               ->  22008 date/time field value out of range: "2026-13-01"
```

The inconsistency here is worth knowing:

- **Whitespace is trimmed** — `'  42  '::int` is 42.
- **`'42.7'::int` fails** (`22P02`) but **`42.7::int` succeeds and rounds to 43.** A string
  must be an exact integer; a numeric value is rounded. So the same "42.7" behaves
  differently depending on whether it arrived quoted.
- **`22P02`** is invalid syntax for the type; **`22008`** is a datetime field out of range.
  Both are common in application error handlers.

Rounding, not truncation: `42.7::int` is 43, and `42.5::int` is 42 (half-to-even) — which
differs from `numeric` rounding as covered in [numeric vs float](02-numeric-vs-float.md).

## From Node, the danger is different

`pg` sends parameters as untyped text and lets the server infer the type, so the classic
mismatch mostly disappears:

```js
// works, and uses the index — the server infers text from the column
await pool.query('SELECT * FROM t WHERE acct = $1', [12345]);
```

[Measured in phase 10](../phase-10-indexes/05-index-not-used.md): a JavaScript number against
a `text` column used the index and returned the right row. **The driver is not the problem —
the `::` you add by hand to silence `42883` is.**

Where you do need to be explicit is when the server cannot infer, typically in a `COALESCE`,
a `CASE`, or a parameter used only inside a function call:

```js
await pool.query('SELECT * FROM t WHERE created > $1::timestamptz', [iso]);
```

Cast the **parameter**, which is a literal — that is always safe. Never the column.

## Trade-off

**PostgreSQL's strictness costs you `42883` errors and buys you never silently comparing
the wrong things.** MySQL will happily compare a string to a number and return surprising
results; PostgreSQL refuses. The cost is real friction when a schema has the wrong types —
and the temptation, every time, is to paper over it with a cast on the column, which is the
one action that turns a 0.2 ms query into a 48 ms one. Fix the type or cast the literal;
never cast the indexed side.

## Gotchas

**Symptom:** A query got dramatically slower after adding a cast to fix a type error
**Cause:** The cast landed on the indexed column — measured 0.199 ms → 47.9 ms
**Fix:** Cast the literal instead, or correct the column type

**Symptom:** `WHERE created::date = current_date` is slow
**Cause:** Casting the column defeats the index — measured 1.2 ms → 65.4 ms
**Fix:** `created >= current_date AND created < current_date + 1`

**Symptom:** `42883 operator does not exist: text = integer`
**Cause:** PostgreSQL will not implicitly compare across those types
**Fix:** Match the literal's type to the column, or fix the column type — do not cast the column

**Symptom:** `'42.7'::int` fails while `42.7::int` succeeds
**Cause:** String-to-integer requires an exact integer; numeric-to-integer rounds
**Fix:** `'42.7'::numeric::int` if rounding is intended

**Symptom:** `22008 date/time field value out of range`
**Cause:** A syntactically plausible but invalid date such as `2026-13-01`
**Fix:** Validate before the query; distinguish `22008` from `22P02` in handlers

**Symptom:** A concatenation returned a string where a number was expected
**Cause:** `||` promoted the integer to text
**Fix:** Be explicit about the result type

## Interview questions

**★ What is the cost of casting the indexed column?**
The index cannot be used and the cast is evaluated per row. Measured: `acct = '12345'` at
0.199 ms via an index-only scan versus `acct::bigint = 12345` at 47.9 ms via a parallel
sequential scan — 241× slower.

**★ Why does `WHERE created::date = current_date` skip the index?**
The index stores `created`, not `created::date`. Rewrite as a half-open range on the bare
column — measured 65.4 ms → 1.2 ms.

**★ Why does PostgreSQL raise `42883` instead of comparing?**
It has no implicit `text = integer` operator and refuses to guess. That strictness prevents
silently wrong comparisons; the correct response is to fix the types, not to cast the column.

**★ What are the three cast categories?**
Implicit (automatic and lossless, like `int` → `numeric`), assignment (applied when storing
into a column), and explicit (`::`, `CAST(… AS …)`, or the type-named function — all
equivalent).

**★ Does `pg` cause type-mismatch problems?**
No. It sends parameters as untyped text and the server infers, so a JS number against a
`text` column works and still uses the index. The problems come from hand-written casts.

**Does `42.7::int` truncate?**
No, it rounds — to 43. But `'42.7'::int` fails with `22P02`, because a string must be an
exact integer.

**When is casting a parameter appropriate?**
When the server cannot infer the type — inside `COALESCE`, `CASE`, or a bare function
argument. Casting a parameter is always safe; casting a column is not.

---

← [enum vs CHECK vs lookup](11-enum-check-lookup.md) · Next → [bytea](13-bytea.md)
