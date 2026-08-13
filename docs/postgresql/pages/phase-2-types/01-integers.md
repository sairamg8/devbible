---
title: "Integer types"
sidebar_label: "01 · Integers"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex33-types-core.mjs`.

**Three widths, one decision: `bigint` for anything that counts up, `int` for anything
bounded, `smallint` almost never. The cost of `bigint` is measured below and it is small.
The cost of being wrong is an outage on a table you cannot alter quickly.**

## The widths and their limits

```console
$ node ex33-types-core.mjs
=== 1. integer widths, their limits, and what happens past them ===
{"smallint_bytes":2,"int_bytes":4,"bigint_bytes":8,"smallint_min":-32768,"smallint_max":32767,
 "int_min":-2147483648,"int_max":2147483647,"bigint_max":"9223372036854775807"}
```

| Type | Aliases | Bytes | Range |
|---|---|---|---|
| `smallint` | `int2` | 2 | −32 768 … 32 767 |
| `integer` | `int`, `int4` | 4 | −2 147 483 648 … 2 147 483 647 |
| `bigint` | `int8` | 8 | ±9.22 × 10¹⁸ |

There is no unsigned variant in PostgreSQL. A column that cannot be negative gets a
`CHECK (n >= 0)`, which also documents the intent.

## Overflow is an error, not a wrap

```console
int at its maximum + 1                         ->  22003 integer out of range
smallint from a too-large literal              ->  22003 smallint out of range
bigint at its maximum + 1                      ->  22003 bigint out of range
```

**`22003 out of range`** — PostgreSQL raises rather than silently wrapping, which is the
right behaviour and the reason you find out at all. The failure that actually hurts is the
sequence behind an `int` primary key:

```console
identity int past 2147483647                   ->  2200H nextval: reached maximum value of sequence "ty_seq_id_seq" (2147483647)
```

**`2200H`.** Every insert on that table now fails. The fix — widening the column — rewrites
the whole table under `ACCESS EXCLUSIVE`
([measured in phase 11](../phase-11-mvcc/10-table-locks-ddl.md): 326 ms for 200 000 rows,
so hours for a table large enough to have exhausted an `int`). That is why the default for
a surrogate key is `bigint`, decided once at `CREATE TABLE` time when it is free.

## What bigint actually costs

```console
500k rows of int    : table 17 MB, pk index 11 MB
500k rows of bigint : table 21 MB, pk index 11 MB
```

Two columns each, 500 000 rows: **17 MB versus 21 MB, and the primary key index was the
same size in both.** The extra 4 bytes per column are partly absorbed by row alignment —
PostgreSQL aligns 8-byte types on 8-byte boundaries, so an `int` next to a `bigint` often
wastes the padding anyway.

**Roughly 20% on a two-integer table, and far less on a realistic one** where text,
timestamps and a 23-byte row header dominate. Against the cost of running out, this is not
a trade worth making.

## Choosing

```sql
CREATE TABLE orders (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,  -- always bigint
  customer_id bigint NOT NULL REFERENCES customers(id),         -- match the referenced key
  quantity    integer NOT NULL CHECK (quantity > 0),            -- bounded by reality
  retry_count smallint NOT NULL DEFAULT 0                       -- genuinely tiny, rare
);
```

- **Surrogate primary keys: `bigint`.** Always. Even for a table you are sure stays small,
  because you will be wrong about at least one of them, and the fix is expensive.
- **Foreign keys: match the referenced column exactly.** A mismatched width means a cast on
  every join, and [a cast on the indexed side kills the index](12-casting.md).
- **Real quantities: `integer`.** Bounded by physical reality — line items, ages, page
  counts.
- **`smallint`: only when there are enough rows for 2 bytes to matter**, which given
  alignment padding is rarer than it sounds.

## `GENERATED AS IDENTITY`, not `serial`

```sql
id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY   -- standard SQL, preferred
id bigserial PRIMARY KEY                             -- legacy PostgreSQL-only
```

`serial`/`bigserial` are not real types — they expand to an integer column plus a sequence
plus a default. `GENERATED AS IDENTITY` is standard SQL, and `ALWAYS` prevents an explicit
insert into the column from silently desynchronising the sequence. Full comparison in
[sequences and identity](../phase-3-ddl/14-sequences.md).

## From Node: `bigint` arrives as a string

```console
JS types: { n: 'string "1.1"', f: 'number 1.1', big: 'string "9007199254740993"', i: 'number 42' }
```

**`int4` becomes a JavaScript `number`; `int8` becomes a `string`.** This is deliberate:
`9007199254740993` exceeds `Number.MAX_SAFE_INTEGER` and would silently lose precision as a
double. `pg` refuses to make that choice for you.

```js
const {rows} = await pool.query('SELECT id, quantity FROM orders WHERE id = $1', [id]);
rows[0].id        // '12345'  ← string
rows[0].quantity  // 12345    ← number

// comparing an id needs care
if (rows[0].id === orderId) …          // string vs string — fine if orderId is a string
if (Number(rows[0].id) === orderId) …  // safe only below 2^53
if (BigInt(rows[0].id) === BigInt(orderId)) … // always correct
```

Ids usually travel as strings through JSON anyway, so the default is right. If a column is
genuinely bounded and you want numbers, override the parser explicitly:

```js
import pg from 'pg';
pg.types.setTypeParser(20, (v) => parseInt(v, 10));  // 20 = int8  — only if you are sure
```

That is a global decision for every `bigint` in the application, which is why it belongs in
one place with a comment, or nowhere.

## Trade-off

**`bigint` costs about 20% of a narrow table's size and removes an entire class of
outage.** The measured 17 MB → 21 MB is the honest number, and on any table with text or
timestamps the relative cost is far smaller. The counter-argument — narrower keys mean more
index entries per page — is real for very large tables, but it is a tuning decision you
make with measurements in hand, not a default. Start at `bigint`; narrow only where you
have measured a reason.

## Gotchas

**Symptom:** `2200H nextval: reached maximum value of sequence`
**Cause:** An `int` identity/serial primary key exhausted 2 147 483 647
**Fix:** Widen to `bigint` — a full table rewrite under `ACCESS EXCLUSIVE`; prevent it by starting there

**Symptom:** `22003 integer out of range` on a sum or product
**Cause:** The arithmetic overflowed `int` even though the stored values fit
**Fix:** Cast one operand: `sum(n::bigint)`

**Symptom:** An id compared with `===` never matches
**Cause:** `bigint` arrives from `pg` as a string, not a number
**Fix:** Compare as strings, or convert deliberately with `BigInt`

**Symptom:** A join between two id columns does not use the index
**Cause:** Mismatched integer widths force a cast on the indexed side
**Fix:** Make foreign keys the same type as the key they reference

**Symptom:** Ids in JSON lose their last digits in the browser
**Cause:** JavaScript numbers are doubles; ids above 2⁵³ do not survive
**Fix:** Keep them as strings end to end — which is `pg`'s default

**Symptom:** `smallint` saved no space
**Cause:** Row alignment padding absorbed it
**Fix:** Only narrow when measurement shows a real gain

## Interview questions

**★ Which integer type for a primary key, and why?**
`bigint`. The measured cost is small (17 MB → 21 MB on a 500 000-row two-column table, same
index size), and exhausting an `int` sequence stops all inserts with `2200H` and requires a
full table rewrite to fix.

**★ What happens on integer overflow?**
`22003 out of range` — an error, never a silent wrap. A sequence hitting its ceiling gives
`2200H` instead.

**★ Why does `bigint` come back from `pg` as a string?**
`int8` exceeds `Number.MAX_SAFE_INTEGER` (2⁵³), so converting to a JavaScript number could
lose precision silently. Measured: `9007199254740993` arrived as `'9007199254740993'`.

**★ `serial` or `GENERATED AS IDENTITY`?**
`GENERATED ALWAYS AS IDENTITY` — standard SQL, and `ALWAYS` prevents manual inserts from
desynchronising the sequence. `serial` is a legacy shorthand for column + sequence +
default.

**★ Does PostgreSQL have unsigned integers?**
No. Use a `CHECK (n >= 0)` constraint, which also documents the intent.

**Why must a foreign key match the referenced column's type?**
A width mismatch forces a cast, and a cast on the indexed side stops the index being used
— measured elsewhere as 0.2 ms versus 48 ms.

**When is `smallint` worth it?**
Rarely. Alignment padding often absorbs the saving; it only pays on very large tables with
several such columns packed together.

---

← [Phase index](README.md) · Next → [numeric vs float](02-numeric-vs-float.md)
