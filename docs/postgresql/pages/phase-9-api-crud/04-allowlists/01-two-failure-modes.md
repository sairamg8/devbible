---
title: "Why identifiers cannot be parameters"
sidebar_label: "01 · The two failure modes"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex5-filter-sort.mjs`.

**Chapter 1 of [Sort and filter allowlists](README.md).** Two ways to handle
`?sort=price`, both wrong, failing in opposite directions: one silently does
nothing, the other drops your table.

## First: `ORDER BY $1` does not error. It silently does nothing.

The instinct is to parameterize the sort column like anything else. It runs. It
returns rows. It is wrong, and nothing tells you.

```js
const a = await pool.query(`SELECT name FROM fs_items ORDER BY $1`, ['name']);
const b = await pool.query(`SELECT name FROM fs_items ORDER BY $1`, ['price']);
```

```console
$ node ex5-filter-sort.mjs
=== 1. ORDER BY $1 ===
ORDER BY $1 with "name" → apple, Banana, cherry, date, Elderberry, fig
ORDER BY $1 with "price" → apple, Banana, cherry, date, Elderberry, fig
identical: true — the parameter is a constant, not a column reference
...and it raises no error, so nothing tells you it did not work
```

Two different sort columns, byte-identical output. The parameter is bound as a
*constant string*, so the query says "sort every row by the literal `'name'`" —
the same value for every row, so the sort is a no-op and rows come back in whatever
order the plan produced.

This is worse than an error. `ORDER BY $1` in a code review looks like the safe,
parameterized thing to do; in production it silently ignores the user's sort choice
forever. The bug usually surfaces as "sorting doesn't work on the items page" long
after everyone has stopped looking at that code.

(In `GROUP BY`/`ORDER BY`, a bare *integer literal* does mean "the Nth select
column" — `ORDER BY 1`. But `$1` is a bound parameter, not a literal, so it does
not get that treatment. This is a common source of confusion when someone tests
with `ORDER BY 1` by hand and concludes the parameter form must work too.)

## Second: concatenating the identifier drops the table

So the parameter does not work, and the obvious next move is a template literal.

```js
const listBad = (sortBy) =>
  pool.query(`SELECT id, name FROM fs_items ORDER BY ${sortBy} LIMIT 3`);
```

```console
=== 2. concatenated ORDER BY — the injection ===
?sort=name → Banana, Elderberry, apple
?sort=name; DROP TABLE fs_items CASCADE; --
  → 2 statements executed
fs_items after that request: GONE
```

**The table is gone.** One query-string parameter, one `GET` request, no
authentication bypass required.

The mechanism is the protocol switch from
[Safe dynamic `WHERE`](../safe-dynamic-where/): a `query()` call with no
parameter array uses the **simple query protocol**, which permits multiple
statements separated by `;`. The injected `DROP TABLE` is simply the second
statement, and `pg` reports `2 statements executed` because that is exactly what
happened.

Compare the identical payload sent as a *value*:

```console
=== 3. the same payload as a parameter ===
rows: 0 | table still there: fs_items
```

Zero rows, table intact. **The payload is not the problem — the position is.**
A value can always be a parameter and is always safe; an identifier can never be a
parameter and is never safe by concatenation.

## Gotchas

**Symptom:** The sort parameter is ignored; every sort returns the same order
**Cause:** `ORDER BY $1` — the parameter binds as a constant, so the sort is a
no-op. No error is raised.
**Fix:** An allowlist producing literal SQL text ([chunk 02](02-building-the-allowlist.md)).
Never parameterize an identifier.

**Symptom:** A table was dropped and no deploy touched it
**Cause:** A concatenated identifier plus the simple query protocol, which allows
stacked statements.
**Fix:** Allowlist the identifier; grant the app role only the privileges it needs
so `DROP` is not available to it.

**Symptom:** `42601 syntax error at or near "$1"`
**Cause:** A placeholder in an identifier or keyword position — `ORDER BY`, a table
name, `ASC`/`DESC`. This is the *lucky* case: it fails loudly.
**Fix:** Allowlist the identifier, ternary the direction.

**Symptom:** `ORDER BY 1` works by hand, so the parameter form is assumed to work
**Cause:** A bare integer *literal* means "the Nth select column"; a bound
parameter does not get that treatment.
**Fix:** Test the parameterized form with two different columns and compare the
output — identical output means it is doing nothing.

## Interview questions

**★ Why can't you parameterize an `ORDER BY` column?**
Parameters are bound as values after the statement is parsed; an identifier must be
known at parse time. The dangerous part is that `ORDER BY $1` does not fail — the
parameter becomes a constant, so every row sorts by the same value and the sort is
silently a no-op. Measured: sorting by `'name'` and by `'price'` returned
byte-identical output.

**★ Show how `?sort=` becomes SQL injection.**
Concatenating the value into the query, with no parameter array, puts `pg` on the
simple query protocol, which permits multiple statements. `?sort=name; DROP TABLE
fs_items CASCADE; --` therefore executes as two statements — measured, `pg`
reported `2 statements executed` and the table was gone. The same payload passed
as `$1` returned 0 rows and left the table intact.

**★ If the payload is identical in both cases, what actually differs?**
The position, not the payload. A *value* can always be a parameter and is then
inert. An *identifier* can never be a parameter, so concatenation is the only way
to vary it — which is exactly why it needs an allowlist rather than escaping.

**Why is the silent failure worse than the syntax error?**
`42601` fails immediately and gets fixed. `ORDER BY $1` passes review as "the safe
parameterized version", returns rows, and ignores the user's sort choice forever —
usually discovered long afterwards as "sorting doesn't work on that page".

---

← [Topic index](README.md) · Next → [Building the allowlist](02-building-the-allowlist.md)
