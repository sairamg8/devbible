---
title: "\\d and \\d+ in full"
sidebar_label: "03 · \\d and \\d+"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **psql 18.4**. Script: `sandbox/pg-api/ex31-psql-basics.sh`.

**`\d table` is the single most-used command in psql. It answers "what is this table
really" — columns, defaults, every index, every constraint, and both directions of every
foreign key — in one screen.**

## Reading `\d`

```console
$ ./ex31-psql-basics.sh
=== 03a. \d — the everyday view ===
                          Table "public.p1_orders"
   Column    |  Type   | Collation | Nullable |           Default
-------------+---------+-----------+----------+------------------------------
 id          | bigint  |           | not null | generated always as identity
 customer_id | bigint  |           | not null |
 status      | text    |           | not null | 'open'::text
 total_cents | integer |           | not null |
 note        | text    |           |          |
Indexes:
    "p1_orders_pkey" PRIMARY KEY, btree (id)
    "p1_orders_customer_idx" btree (customer_id)
    "p1_orders_open_idx" btree (customer_id) WHERE status = 'open'::text
Check constraints:
    "p1_orders_status_check" CHECK (status = ANY (ARRAY['open'::text, 'paid'::text, 'shipped'::text]))
    "p1_orders_total_cents_check" CHECK (total_cents >= 0)
Foreign-key constraints:
    "p1_orders_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES p1_customers(id) ON DELETE CASCADE
```

Section by section:

- **Columns** — name, type, nullability, default. `generated always as identity` appears
  as a default; so does `'open'::text`, showing you the value *as the server stores the
  expression*, which is why the cast is visible.
- **Indexes** — every index, with its definition. `p1_orders_open_idx` shows its `WHERE`
  clause, so [partial indexes](../phase-10-indexes/09-partial.md) are visible here rather
  than hidden. This is the fastest way to answer "is this column indexed?".
- **Check constraints** — normalised into the server's own form. Note `IN ('open','paid',
  'shipped')` came back as `= ANY (ARRAY[...])`: PostgreSQL rewrote it, and `\d` shows the
  rewritten version, not what you typed.
- **Foreign-key constraints** — including the `ON DELETE` action, which is the field
  people forget they never set.

On the **parent** table you get the opposite section, `Referenced by`, listing every child
that points at it. That is the one to check before dropping anything.

## What `\d+` adds

```console
=== 03b. \d+ — adds storage, description, and the index definitions ===
   Column    |  Type   | ... |           Default            | Storage  | Compression | Stats target | Description
-------------+---------+-----+------------------------------+----------+-------------+--------------+-------------
 id          | bigint  |     | generated always as identity | plain    |             |              |
 status      | text    |     | 'open'::text                 | extended |             |              |
...
Not-null constraints:
    "p1_orders_id_not_null" NOT NULL "id"
    "p1_orders_customer_id_not_null" NOT NULL "customer_id"
Access method: heap
```

Three additions worth knowing:

- **`Storage`** — `plain` for fixed-width types, `extended` for text-like ones, meaning
  they can be compressed and moved to TOAST storage when large.
- **`Stats target`** — non-empty only where someone overrode it; relevant when a plan is
  wrong because of [poor statistics](../phase-10-indexes/16-statistics.md).
- **`Not-null constraints` as named objects** — PostgreSQL 17+ makes `NOT NULL` a
  first-class named constraint, so it now appears in its own section.

`\d+` also prints the table's comment (`Description`) and, for partitioned tables, the
partition list.

## `\d` on things that are not tables

```console
=== 03c. \d on an index, a view and a sequence ===
     Index "public.p1_orders_open_idx"
   Column    |  Type  | Key? | Definition
-------------+--------+------+-------------
 customer_id | bigint | yes  | customer_id
btree, for table "public.p1_orders", predicate (status = 'open'::text)

              View "public.p1_open_orders"
   Column    |  Type   | Collation | Nullable | Default
-------------+---------+-----------+----------+---------
 id          | bigint  |           |          |

                    Sequence "public.p1_customers_id_seq"
  Type  | Start | Minimum |       Maximum       | Increment | Cycles? | Cache
--------+-------+---------+---------------------+-----------+---------+-------
 bigint |     1 |       1 | 9223372036854775807 |         1 | no      |     1
Sequence for identity column: public.p1_customers.id
```

The same command adapts to the object:

- **On an index** — the columns, whether each is a key column (`Key?` distinguishes
  `INCLUDE` columns), the method, and the partial predicate.
- **On a view** — the columns; `\d+` adds the view definition itself, which is usually
  what you actually want.
- **On a sequence** — bounds, increment, cache, and which identity column owns it.

`\d` with no argument lists every visible relation of every kind — useful in an unfamiliar
database, overwhelming in a large one.

## The workflow this enables

```bash
\dt                    # what tables are here
\d p1_orders           # what is this one
\d+ p1_orders          # sizes, storage, comments
\di p1_*               # the index picture across several tables
\sv p1_open_orders     # the view's SQL (\sf for a function)
```

`\sv` and `\sf` are the pair people miss: they print the *source* of a view or function,
ready to copy into a migration.

## Trade-off

**`\d` shows the database's normalised version of your schema, not your DDL.** `IN (…)`
comes back as `= ANY (ARRAY[…])`, defaults carry explicit casts, and constraint names are
the generated ones unless you named them. That is a feature when you are verifying what
the server actually did, and a trap if you treat `\d` output as source of truth for
migrations — it is not reversible DDL. `pg_dump --schema-only -t table` is what produces
DDL you can replay.

## Gotchas

**Symptom:** `Did not find any relation named "MyTable"`
**Cause:** Unquoted names fold to lowercase
**Fix:** `\d "MyTable"`

**Symptom:** A `CHECK` constraint reads differently from how it was written
**Cause:** The server normalises expressions; `IN` becomes `= ANY (ARRAY[…])`
**Fix:** Expected — compare semantics, not text

**Symptom:** You dropped a table and a dependent view broke
**Cause:** The `Referenced by` section on the parent was not checked first
**Fix:** `\d parent_table` before dropping anything

**Symptom:** `\d` output is enormous and unreadable
**Cause:** Wide table, many indexes
**Fix:** `\x` for expanded output, or target specific pieces with `\di`

**Symptom:** Copying `\d` output into a migration does not work
**Cause:** It is a report, not DDL
**Fix:** `pg_dump --schema-only -t tablename`

**Symptom:** An index appears in `\d` but is never used by queries
**Cause:** It may be partial — check the `WHERE` shown in its definition
**Fix:** See [why an index is not used](../phase-10-indexes/05-index-not-used.md)

## Interview questions

**★ What does `\d table` show?**
Columns with types, nullability and defaults; every index with its definition; check
constraints; foreign keys with their `ON DELETE` actions; and, on a parent, the
`Referenced by` list of children.

**★ What does `+` add?**
Storage strategy per column, statistics targets, the table comment, named `NOT NULL`
constraints (PostgreSQL 17+), the access method, and sizes.

**★ How do you tell whether a column is indexed?**
`\d tablename` and read the `Indexes` section — it includes partial indexes with their
`WHERE` clause, which a column-only view would hide.

**★ Why does the constraint look different from what you wrote?**
PostgreSQL stores the normalised expression. `IN ('a','b')` is displayed as
`= ANY (ARRAY['a','b'])`. Measured on the fixture table.

**★ Can you use `\d` output as DDL?**
No — it is a report. Use `pg_dump --schema-only -t table` for replayable DDL.

**How do you see a view's definition?**
`\sv viewname` (or `\d+`). `\sf` does the same for a function.

**What does `\d` do on an index?**
Shows its columns, which are key versus `INCLUDE`, the access method, and any partial
predicate — measured on a partial index, which printed
`predicate (status = 'open'::text)`.

---

← [Daily meta-commands](02-daily-meta-commands.md) · Next → [Output control](04-output-control.md)
