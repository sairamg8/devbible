---
title: "CREATE TABLE"
sidebar_label: "01 · CREATE TABLE"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex13-constraints-rel.mjs`,
> `ex11-ddl-alter.mjs`, `ex1-ddl-from-node.mjs`.

**`CREATE TABLE` writes the contract every client must obey — Node, reports, the
admin console, and the intern with `psql`. Decisions made here are the expensive
ones to reverse, because changing a column's type on a large table rewrites it under
a lock that blocks everything.**

## A table worth copying

```sql
CREATE TABLE orders (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','paid','shipped','cancelled')),
  total_cents bigint NOT NULL CHECK (total_cents >= 0),
  currency    char(3) NOT NULL DEFAULT 'EUR',
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_id_idx ON orders (user_id);
```

Every line is a decision:

- **`bigint GENERATED ALWAYS AS IDENTITY`** rather than `serial` — it rejects a
  manual id with `428C9`, which prevents the sequence drifting out of step
  ([Primary keys](02-primary-keys.md)).
- **`NOT NULL` on `user_id`** makes the relationship mandatory; **`RESTRICT`**
  refuses to delete a user who has orders.
- **`CHECK (status IN …)`** puts the state machine in the schema. Note this needs the
  `NOT NULL` beside it — a `CHECK` alone accepts NULL
  ([Constraints](04-constraints.md)).
- **`total_cents bigint`, not `numeric` or `float`** — integer minor units cannot be
  rounded wrong. If you use `numeric`, never `float`.
- **`timestamptz`, never `timestamp`.**
- **The index on the foreign key**, because PostgreSQL does not create one.

## Type choices that are expensive to reverse

| Choose | Not | Because |
|---|---|---|
| `text` | `varchar(n)` | Identical performance. Widening `varchar` is free but **narrowing rewrites the table** — measured 433 ms per 200k rows. Length limits belong in a `CHECK` you can change |
| `timestamptz` | `timestamp` | `timestamp` stores no zone, so the same value means different instants depending on who reads it. `timestamptz` stores an instant |
| `bigint` | `int` | Sequences advance on *attempts*; migrating later rewrites the table (431 ms per 200k rows) |
| `numeric` or integer cents | `float`/`double` | Binary floating point cannot represent 0.1 exactly |
| `text` + `CHECK` | `enum` | Adding an enum value is fine; **removing or reordering one is not** — an enum type cannot have values dropped |
| `jsonb` | `json` | `json` stores the literal text and cannot be indexed usefully |

**`char(n)` is a trap** — it pads with spaces to the full width, so `char(3)` holding
`'US'` compares and returns as `'US '`. Use it only for genuinely fixed-width codes,
and prefer `text` even then.

## `NOT NULL` by default

Make nullability the exception you justify. Every nullable column is a
three-valued-logic branch in every query that touches it: `WHERE status != 'cancelled'`
silently excludes rows where `status` is NULL, which is almost never what the author
meant.

The column order in the table has no semantic meaning, but grouping helps readers:
identity first, then foreign keys, then required attributes, then optional ones, then
timestamps.

## `now()` is transaction time

```console
$ node ex13-constraints-rel.mjs
=== 3. when is a DEFAULT evaluated? ===
two inserts 150ms apart in ONE transaction:
  id 1 2026-08-12T03:36:00.220Z
  id 2 2026-08-12T03:36:00.220Z
same timestamp? true ← now() is transaction start time, not statement time
```

Every row written by one transaction shares a `created_at`. Usually desirable — it
makes a batch identifiable — but it means `created_at` cannot order rows *within* a
transaction. Use `clock_timestamp()` if you need real per-row wall-clock time.

`updated_at` cannot be a generated column, because generated expressions must be
immutable and `now()` is not (`42P17`). It needs a trigger — see
[`created_at`/`updated_at`](../phase-9-api-crud/17-timestamps-trigger.md).

## What `CREATE TABLE` returns through `pg`

```console
$ node ex1-ddl-from-node.mjs
=== 1. CREATE TABLE via client.query ===
command: CREATE | rowCount: null | fields: 0
```

`rowCount` is `null` — DDL returns no tuples, so success is the absence of a thrown
error. This and the rest of the driver mechanics are in
[Creating tables from Node](../phase-8-schema-from-node/ddl-from-node/).

## Where the table goes

An unqualified `CREATE TABLE` lands wherever `search_path` points — by default
`"$user", public`, which means `public` for most setups but *not* if the connecting
role has a schema of its own. **Schema-qualify DDL in migrations**
([Schemas and tenancy](10-schemas-tenancy.md)) so the table cannot land somewhere
unexpected.

## Trade-off

Pushing invariants into the table makes bad data impossible rather than unlikely, and
every client gets the guarantee for free. The cost is rigidity: each rule is a
migration to change, and some changes rewrite the table under a lock that blocks all
traffic.

That cost is exactly why the decisions above matter more than most. Getting
`NOT NULL` wrong is a cheap fix; getting `int` vs `bigint`, `timestamp` vs
`timestamptz`, or `float` vs `numeric` wrong is a rewrite plus a data-correction
exercise. **Be liberal with constraints, conservative with types** — constraints are
comparatively easy to relax later, types are not.

## Gotchas

**Symptom:** A `CHECK`-constrained column contains rows violating the intent
**Cause:** `CHECK` passes on NULL — `NULL >= 18` is unknown, not false. Measured.
**Fix:** Pair every `CHECK` with `NOT NULL`, or write `CHECK (col IS NULL OR …)`.

**Symptom:** Timestamps shift when the server or client timezone changes
**Cause:** `timestamp` stores no zone.
**Fix:** `timestamptz` everywhere. Converting later rewrites the table.

**Symptom:** Money totals are off by fractions of a cent
**Cause:** `float`/`double`.
**Fix:** Integer minor units or `numeric`; both a rewrite to fix later.

**Symptom:** Comparing a `char(3)` column fails unexpectedly
**Cause:** `char(n)` blank-pads to the full width.
**Fix:** `text`.

**Symptom:** An enum value cannot be removed
**Cause:** Enum types support adding values, not dropping or reordering them.
**Fix:** `text` with a `CHECK`, which is one `ALTER` to change.

**Symptom:** `ALTER COLUMN … TYPE varchar(20)` locked a large table
**Cause:** Narrowing rewrites — measured 433 ms per 200k rows, linear.
**Fix:** `text` plus a `CHECK` on length, which is a catalog change.

**Symptom:** A migration created the table in an unexpected schema
**Cause:** Unqualified DDL resolved through `search_path`'s `"$user"` entry.
**Fix:** Schema-qualify DDL in migrations.

**Symptom:** Every row in a batch shares `created_at`
**Cause:** `now()` is transaction start time — measured.
**Fix:** `clock_timestamp()` if per-row wall-clock time is needed.

## Interview questions

**★ Walk through the decisions in a well-formed `CREATE TABLE`.**
`bigint GENERATED ALWAYS AS IDENTITY` for the key (rejects manual ids, and `bigint`
because sequences advance on attempts); `NOT NULL` on foreign keys with a chosen
`ON DELETE` action; `CHECK` *plus* `NOT NULL` for state machines, since `CHECK`
passes on NULL; `timestamptz` not `timestamp`; integer minor units or `numeric` for
money; and an index on every foreign key, because PostgreSQL does not create one.

**★ `text` or `varchar(n)`?**
`text` with a `CHECK` on length if you need one. Performance is identical, and
narrowing a `varchar` rewrites the table — measured 433 ms per 200k rows — while
changing a `CHECK` is a catalog operation. Widening a `varchar` is free, so the
asymmetry only hurts in the direction you are most likely to need.

**★ Why `timestamptz` over `timestamp`?**
`timestamp` stores a wall-clock reading with no zone, so the same stored value means
different instants to readers in different timezones — and there is no way to
recover which was meant. `timestamptz` stores an instant and renders it in the
session's zone. Converting later rewrites the table.

**★ Why prefer `text` + `CHECK` over an enum type?**
Enums can gain values but cannot drop or reorder them, so a wrong enum is a data
migration. A `CHECK` constraint is one `ALTER` to change, and the values are visible
in the schema without querying `pg_enum`.

**★ Why does `CHECK` alone not enforce your rule?**
Because a NULL makes the expression *unknown*, and `CHECK` rejects only *false* —
measured, `CHECK (age >= 18)` accepted a NULL age. You need `NOT NULL` as well.

**Which decisions here are the expensive ones?**
Types. Constraints can be relaxed or tightened with an `ALTER` and, using
`NOT VALID`, without a long lock. Type changes that alter the on-disk
representation rewrite the whole table under `ACCESS EXCLUSIVE` — so be liberal with
constraints and conservative with types.

---

← [Phase index](README.md) · Next → [Primary keys](02-primary-keys.md)
