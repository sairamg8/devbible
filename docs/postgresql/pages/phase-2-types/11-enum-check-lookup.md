---
title: "enum vs CHECK vs lookup table"
sidebar_label: "11 · enum vs CHECK vs lookup"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex34-types-more.mjs`.

**Three ways to constrain a status column. The deciding question is not storage or speed —
it is what happens when the set of values changes, and every one of those answers is
measured below.**

## The three, side by side

```sql
-- enum
CREATE TYPE order_status AS ENUM ('open','paid','shipped');
CREATE TABLE orders (status order_status NOT NULL);

-- CHECK constraint
CREATE TABLE orders (status text NOT NULL CHECK (status IN ('open','paid','shipped')));

-- lookup table
CREATE TABLE order_statuses (code text PRIMARY KEY, label text NOT NULL, sort_order int);
CREATE TABLE orders (status text NOT NULL REFERENCES order_statuses(code));
```

All three reject an invalid value; the error differs:

```console
$ node ex34-types-more.mjs
insert a value not in the enum                   ->  22P02 invalid input value for enum ty_status: "cancelled"
insert a value not in the CHECK                  ->  23514 new row for relation "ty_check" violates check constraint
insert a value not in the lookup                 ->  23503 insert or update on table "ty_lookup_use" violates foreign key constraint
```

`22P02` (invalid input), `23514` (check violation), `23503` (foreign key violation) — worth
knowing because your error handler branches on these
([see SQLSTATEs](../phase-1-psql/14-errverbose.md)).

## Storage

```console
sizes: ty_enum 7080 kB | ty_check 8656 kB | ty_lookup_use 8656 kB
storage per value: {"enum_b":4,"text_b":8}
```

200 000 rows: **the enum table is 7080 kB against 8656 kB — about 18% smaller**, because an
enum value is a 4-byte OID while `'open'` as text is 8 bytes (4-byte header plus the
characters). On a table this size that is 1.5 MB; on a billion rows it is real.

That is the enum's only genuine advantage, and it is usually not the one that decides.

## The part that decides: changing the set

```console
ALTER TYPE ... ADD VALUE            : 15.5 ms
DROP + ADD CHECK (validates the table): 62.9 ms
INSERT into the lookup table         : 3.4 ms
```

Adding a value:

- **Lookup table — 3.4 ms, an ordinary `INSERT`.** No DDL, no lock, no migration. It can even
  be done by an admin UI.
- **Enum — 15.5 ms**, a catalog change. Fast, but it is DDL.
- **CHECK — 62.9 ms**, because dropping and re-adding the constraint **re-validates every
  row**. That cost scales with table size; on a large table it is a `ACCESS EXCLUSIVE` scan.
  (Mitigate with `ADD CONSTRAINT … NOT VALID` then `VALIDATE CONSTRAINT`, which takes a
  weaker lock — see [table locks and DDL](../phase-11-mvcc/10-table-locks-ddl.md).)

Removing or renaming a value:

```console
remove a value from an enum                      ->  0A000 dropping an enum value is not implemented
rename an enum value                             ok  {}
```

**You cannot remove a value from an enum. At all.** `0A000 not implemented`. The only route
is creating a new type, converting every column that uses it, and dropping the old one — a
table rewrite per column. Renaming works, but renames every existing row's meaning with it.

A CHECK constraint is dropped and re-added. A lookup row is `DELETE`d — and the foreign key
even tells you if rows still reference it, which is the behaviour you want.

## The enum's transaction trap

```console
ADD VALUE inside a transaction, then use it      ->  55P04 unsafe use of new value "held" of enum type ty_status
```

**`ALTER TYPE … ADD VALUE` cannot be used in the same transaction that added it** (`55P04`).
That breaks the ordinary migration pattern of "one transaction per migration file": adding a
status and backfilling rows to it has to be split across two transactions, so the migration is
no longer atomic. Neither of the other approaches has this problem.

## Ordering

```console
enum sorts in declaration order, not alphabetically: {"enum_order":"{open,settled,shipped}"}
the same values as text sort alphabetically      : {"text_order":["open","paid","shipped"]}
```

**An enum sorts in declaration order** — `open`, `settled`, `shipped` here reflects the
declared sequence, not the alphabet. For a workflow status that is genuinely useful:
`ORDER BY status` gives pipeline order for free.

With text you sort alphabetically unless you add a `sort_order` column — which the lookup
table has room for, and the CHECK approach does not. That is a point for the lookup table:
**it can carry data about the values** — a display label, a colour, a sort order, an
`is_terminal` flag — where the other two carry only the value itself.

## Comparison and the driver

```console
compare an enum against text directly            ok  {"count":"66666"}
```

An enum compares against a text literal without an explicit cast, because the literal is
resolved to the enum type. It arrives in Node as a plain string, and is sent as one. So from
the application's perspective all three approaches look identical — which is why the choice
is purely a schema-evolution question.

## Choosing

| Use | When |
|---|---|
| **Lookup table** | the set changes, or values need metadata (label, sort order, colour). **The default.** |
| **CHECK** | a small, genuinely fixed set, and you want it visible in `\d` with no extra table |
| **enum** | a fixed set where declaration-order sorting is valuable and the 4-byte saving matters |

**Default to the lookup table.** "This status list will never change" has a poor track
record, and it is the only option where adding a value is data rather than DDL. The cost is a
join for the label and a foreign key on writes — both cheap, and the FK index is one you
usually want anyway.

## Trade-off

**The enum's 18% storage saving and free ordering are paid for with schema rigidity**: no
value removal (`0A000`), no use in the transaction that added it (`55P04`), and every change
is a migration. The CHECK is the middle option — visible in `\d`, no extra table — but every
change re-validates the whole table (measured 62.9 ms on 200 000 rows, scaling linearly). The
lookup table costs a join and 18% more storage and makes the value set *data*, which is the
one property that keeps paying as requirements move.

## Gotchas

**Symptom:** `0A000 dropping an enum value is not implemented`
**Cause:** Enum values cannot be removed
**Fix:** Create a new type, convert the columns, drop the old — or do not use an enum

**Symptom:** `55P04 unsafe use of new value` in a migration
**Cause:** `ALTER TYPE … ADD VALUE` and its first use are in the same transaction
**Fix:** Split into two transactions — which makes the migration non-atomic

**Symptom:** Adding a value to a CHECK locked a large table
**Cause:** Re-adding the constraint validates every row — measured 62.9 ms per 200 000 rows
**Fix:** `ADD CONSTRAINT … NOT VALID` then `VALIDATE CONSTRAINT`

**Symptom:** `ORDER BY status` gives alphabetical order, not workflow order
**Cause:** Text sorts alphabetically; only enums sort by declaration
**Fix:** A `sort_order` column in a lookup table

**Symptom:** No place to store a human-readable label for a status
**Cause:** enum and CHECK store only the value
**Fix:** A lookup table, which can carry label, colour, sort order and flags

**Symptom:** An ORM cannot introspect or migrate an enum cleanly
**Cause:** Enum changes are catalog-level DDL with the restrictions above
**Fix:** A lookup table or CHECK, which ORMs handle as ordinary schema

## Interview questions

**★ enum, CHECK or lookup table?**
Lookup table by default — adding a value is an `INSERT` (measured 3.4 ms) rather than DDL,
and it can carry labels and sort order. CHECK for a genuinely fixed small set. enum when
declaration-order sorting and the storage saving matter more than flexibility.

**★ What can you not do with an enum?**
Remove a value — `0A000 not implemented`. And you cannot use a newly added value in the same
transaction that added it (`55P04`), which breaks atomic migrations.

**★ How much storage does an enum save?**
Measured about 18% on a 200 000-row table (7080 kB vs 8656 kB) — 4 bytes per value against 8
for short text.

**★ What does changing a CHECK constraint cost?**
Re-validation of every row: measured 62.9 ms on 200 000 rows, scaling with table size, under
`ACCESS EXCLUSIVE` unless you use `NOT VALID` plus `VALIDATE`.

**★ Which SQLSTATE does each produce for an invalid value?**
enum `22P02`, CHECK `23514`, foreign key `23503`.

**Why does an enum sort differently from text?**
Enums order by declaration sequence, not alphabetically — measured. That is useful for
workflow statuses and impossible to reproduce with text without a sort column.

**Does the choice affect application code?**
No. All three arrive in Node as strings and are sent as strings. The decision is purely
about schema evolution.

---

← [Arrays](10-arrays.md) · Next → [Casting](12-casting.md)
