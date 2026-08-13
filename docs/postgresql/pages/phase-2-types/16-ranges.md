---
title: "Range types and exclusion constraints"
sidebar_label: "16 · Range types"
sidebar_position: 16
---

<span className="db-tier t-when">Learn When Needed</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex34-types-more.mjs`.

**A range is a first-class value with its own containment and overlap operators — and paired
with an exclusion constraint it makes "no two bookings for the same room may overlap" a
schema rule the database enforces, rather than application code you hope is correct under
concurrency.**

## Range basics

```console
$ node ex34-types-more.mjs
=== 16. ranges and exclusion constraints ===
range basics: {"half_open":"[1,10)","inclusive":"[1,11)","upper_bound":10,
               "contains5":true,"contains10":false,"overlaps":true,
               "empty_range":true,"bytes":17}
```

**Ranges are half-open by default: `[1,10)` includes 1 and excludes 10.** `int4range(1,10,'[]')`
was normalised to `[1,11)` — for discrete types PostgreSQL canonicalises to the half-open
form, so `[1,10]` and `[1,11)` are literally the same value.

That default is the right one, and it is why the booking test below works: intervals that
touch do not overlap.

```sql
int4range, int8range, numrange, tsrange, tstzrange, daterange   -- built in
r @> 5            -- contains a value
r @> other        -- contains a range
r && other        -- overlaps
r << other        -- strictly left of
r -|- other       -- adjacent
lower(r), upper(r), isempty(r), lower_inc(r), upper_inc(r)
```

`int4range(5,5)` is **empty** — a legitimate value that contains nothing and overlaps
nothing. Guard with `isempty()` where a zero-length range would be a data error.

## The exclusion constraint

This is the feature that justifies the type:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE bookings (
  id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room   int NOT NULL,
  during tstzrange NOT NULL,
  EXCLUDE USING gist (room WITH =, during WITH &&)
);
```

Read the constraint as: **no two rows may have the same `room` *and* overlapping `during`.**

```console
an overlapping booking for the same room         ->  23P01 conflicting key value violates exclusion constraint "ty_book_room_during_excl"
the same times in a different room               ok  {}
a booking that starts exactly when the other ends ok  {}
  half-open ranges make back-to-back bookings legal automatically
```

Three results, all correct and none of which you had to write:

- **Overlap in the same room → `23P01`.** A new SQLSTATE worth adding to your error handler
  alongside `23505`.
- **The same time in a different room → allowed**, because `room WITH =` scopes the rule.
- **A booking starting exactly when another ends → allowed**, because half-open ranges do not
  overlap at the boundary. With inclusive ranges this would have been rejected, and you would
  be subtracting a second somewhere to work around it.

`btree_gist` is needed because the constraint mixes an equality test on a scalar (`room`) with
an overlap test on a range, and GiST needs an operator class for the scalar part.

**The concurrency argument is the whole point.** Checking for overlaps with a `SELECT` before
inserting is a read-then-write, and under READ COMMITTED two concurrent requests both see no
conflict and both insert — the [lost update](../phase-11-mvcc/04-lost-update.md) pattern in a
different costume. The exclusion constraint is enforced by an index, so one of them fails with
`23P01` no matter how the requests interleave.

## Multiranges

```console
union of two ranges with a gap between them      ->  22000 result of range union would not be contiguous
union of two ranges that touch                   ok  {"v":"[1,15)"}
multirange handles the gap: {"v":"{[1,5),[10,15)}","contains":true}
```

**A plain range must be contiguous**, so `[1,5) + [10,15)` fails with `22000`. That surprises
people who expect union to behave like a set operation.

**Multiranges (PostgreSQL 14+) are the answer**: `{[1,5),[10,15)}` is one value holding
several disjoint ranges, with the same containment and overlap operators.

```sql
int4multirange, tstzmultirange, datemultirange, …
SELECT datemultirange(daterange('2026-01-01','2026-02-01')) @> '2026-01-15'::date;  -- true
```

That is the natural type for "the periods this resource is available" or "all the discount
windows", where the set genuinely has gaps.

## From Node

```console
to JS: string "[1,10)"
```

**`pg` returns a range as its text form**, `'[1,10)'` — not an object. Parsing it means
handling the bracket notation, infinite bounds (`(,)`), and empty (`empty`). Usually easier to
unpack server-side:

```sql
SELECT lower(during) AS starts_at, upper(during) AS ends_at FROM bookings WHERE id = $1;
```

Sending works well, because the text form is also the input form:

```js
await pool.query(
  `INSERT INTO bookings (room, during) VALUES ($1, tstzrange($2, $3))`,
  [room, startsAt, endsAt]);              // build the range in SQL — clearest

await pool.query(
  `INSERT INTO bookings (room, during) VALUES ($1, $2)`,
  [room, `[${startsAt.toISOString()},${endsAt.toISOString()})`]);   // or pass the literal
```

Prefer the first form: constructing the range in SQL avoids quoting mistakes and keeps the
half-open bracket explicit.

## When to reach for ranges

**Worth it** when overlap is a rule you must enforce — room and resource booking, employee
shifts, price validity periods, non-overlapping subscription terms, temporal versioning
(`valid_from`/`valid_to` as one column).

**Not worth it** for a simple `starts_at`/`ends_at` pair that nothing needs to compare for
overlap. Two `timestamptz` columns are easier to read, index conventionally and query with
ordinary comparisons.

The migration path from two columns is straightforward — a generated range column or a view —
so starting with two columns and adding a range when the overlap rule appears is a reasonable
sequence.

## Trade-off

**A range plus an exclusion constraint moves a correctness rule into the schema, and costs a
GiST index, an extension, and a value your driver hands back as a string.** The GiST index is
larger and slower to maintain than the B-tree you would have on `starts_at`; range queries
that are not overlap tests may be better served by ordinary columns. What you get back is the
elimination of a whole class of concurrency bug: no application check, however careful, can
prevent two simultaneous transactions from both booking the same slot, and this constraint
does it with no retry loop.

## Gotchas

**Symptom:** `23P01 conflicting key value violates exclusion constraint`
**Cause:** The new row overlaps an existing one — the constraint working
**Fix:** Handle it like `23505`: report the conflict to the user

**Symptom:** Back-to-back bookings are rejected
**Cause:** Inclusive ranges (`[]`) — the boundary is shared
**Fix:** Use the default half-open `[)` form, which is what the constructors produce

**Symptom:** `22000 result of range union would not be contiguous`
**Cause:** `+` on two ranges with a gap
**Fix:** Use a multirange (PostgreSQL 14+)

**Symptom:** `EXCLUDE` fails to create with "data type integer has no default operator class"
**Cause:** GiST needs `btree_gist` for the scalar part of the constraint
**Fix:** `CREATE EXTENSION btree_gist`

**Symptom:** A range in Node is a string, not an object
**Cause:** `pg` does not parse ranges — measured `"[1,10)"`
**Fix:** `SELECT lower(r), upper(r)` and work with the endpoints

**Symptom:** An empty range slipped into the data
**Cause:** `range(x, x)` is empty and legal
**Fix:** `CHECK (NOT isempty(during))`

**Symptom:** Overlap checks in application code still let doubles through
**Cause:** Read-then-write under READ COMMITTED — both transactions saw no conflict
**Fix:** The exclusion constraint, which is enforced by the index regardless of interleaving

## Interview questions

**★ What does an exclusion constraint do?**
Enforces that no two rows satisfy a set of operator comparisons together — `EXCLUDE USING
gist (room WITH =, during WITH &&)` means no two rows share a room with overlapping times.
Violations raise `23P01`.

**★ Why is that better than checking in the application?**
An application check is a read-then-write: two concurrent requests both see no conflict and
both insert. The constraint is enforced by an index, so one always fails regardless of
interleaving — no retry loop, no lock.

**★ Why are ranges half-open by default?**
So intervals that touch do not overlap. Measured: a booking starting exactly when another
ended was accepted, with no boundary arithmetic needed.

**★ What is a multirange for?**
Sets of ranges with gaps. Plain range union requires contiguity — measured `22000` for
`[1,5) + [10,15)` — while `int4multirange` holds `{[1,5),[10,15)}` as one value.

**★ Why does `EXCLUDE` need `btree_gist`?**
GiST has no built-in operator class for equality on scalar types like `int`, and the
constraint mixes a scalar `=` with a range `&&`.

**How does a range come back in Node?**
As its text form, `'[1,10)'`. Unpack with `lower()`/`upper()` in SQL rather than parsing the
literal.

**When would you not use a range?**
When nothing needs overlap semantics. Two `timestamptz` columns are simpler to read and index
conventionally.

---

← [Domains and composites](15-domains-composites.md) · [Phase index](README.md)
