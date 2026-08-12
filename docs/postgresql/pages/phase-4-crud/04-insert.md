---
title: "INSERT"
sidebar_label: "04 · INSERT"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex14-crud.mjs`,
> `ex8-bulk-and-seed.mjs`.

**One `INSERT` can carry one row, many rows, or the result of a `SELECT`. Which of
those you choose is the difference between 19.5 seconds and 81 milliseconds for the
same 10 000 rows.**

## The three forms

```sql
-- one row, values supplied
INSERT INTO c_items (sku, name, qty, price) VALUES ('b1', 'New', 1, '5.00');

-- many rows, one statement
INSERT INTO c_items (sku, name, qty, price) VALUES
  ('a1','Widget',5,'10.00'), ('a2','Gadget',NULL,'20.00'), ('a3','doohickey',3,NULL);

-- rows computed by a query
INSERT INTO c_archive (id, sku, name)
SELECT id, sku, name FROM c_items WHERE created_at < now() - interval '1 year';
```

**Always name the target columns.** `INSERT INTO c_items VALUES (...)` binds
positionally to the table's current column order, so adding or reordering a column
silently rewires every such statement. Naming them also lets you omit columns that have
defaults.

## Omitted columns take their default

```sql
INSERT INTO c_items (sku, name) VALUES ('b2', 'Minimal');
```

`id` is `GENERATED ALWAYS AS IDENTITY` and `created_at` defaults to `now()`, so both are
filled in. Three ways to be explicit:

```sql
INSERT INTO c_items (sku, name, qty) VALUES ('b3', 'X', DEFAULT);  -- this column's default
INSERT INTO c_items DEFAULT VALUES;                                -- every column's default
INSERT INTO c_items (sku, name, qty) VALUES ('b4', 'Y', NULL);     -- explicit NULL ≠ default
```

That last distinction catches people: `NULL` means "store null", `DEFAULT` means "use the
column default". They coincide only when the default *is* null. Defaults are evaluated
at insert time, per row — see
[Generated columns and defaults](../phase-3-ddl/15-generated-columns.md).

## Get the generated values back

An `INSERT` returns no rows unless you ask. `RETURNING` saves the follow-up `SELECT`:

```console
$ node ex14-crud.mjs
=== 3. RETURNING ===
INSERT   → { id: '5', sku: 'b1', created_at: 2026-08-12T06:48:17.024Z }
```

This is the only correct way to learn a generated id — a second query racing to read it
back can see another transaction's row. Full detail on [`RETURNING`](05-returning.md).

## The speed ladder

10 000 rows, five approaches, same table:

```console
$ node ex8-bulk-and-seed.mjs
=== 1. loading 10000 rows, four ways ===
per-row INSERT (autocommit)          19551 ms   rows=10000
per-row INSERT (one transaction)      2262 ms   rows=10000
multi-row VALUES (batch 1000)          148 ms   rows=10000
INSERT ... SELECT unnest (1 stmt)       81 ms   rows=10000
COPY FROM STDIN                        243 ms   rows=10000
```

**241× between the top and the bottom of that list.** Two separate effects are at work:

*Transactions.* Per-row inserts in autocommit are 19 551 ms; the identical inserts inside
one transaction are 2 262 ms — **8.6× faster** for a one-line change. Each autocommit
statement is its own transaction and must flush WAL to disk before returning. Batching
them amortises that into one flush.

*Round trips.* Even inside a transaction, 10 000 statements means 10 000 network
round trips. One statement carrying all 10 000 rows means one. That is the 2 262 ms →
148 ms step, and it dominates everything else.

`unnest` came out fastest here — it sends the columns as arrays and expands them
server-side, so it pays neither the round-trip cost nor the parser cost of a
10 000-tuple `VALUES` list ([`VALUES` and `unnest`](19-values-unnest.md)). `COPY` wins
at larger scale; the crossover and the full analysis are in
[Bulk insert from Node](../phase-8-schema-from-node/04-bulk-insert.md).

## There is a hard ceiling of 65 535 parameters

The wire protocol encodes the parameter count as a 16-bit integer, so one statement can
carry at most 65 535 of them. With three columns per row:

```console
=== 2. how many parameters can one statement take? ===
21845 rows → ok (65535 params)
21846 rows → 08P01 bind message has 2 parameter formats but 0 parameters
```

21 845 × 3 = 65 535 exactly. One row more and it fails — with `08P01` and a message
about *parameter formats* that says nothing about the real cause. This is the classic
"works in staging, fails on the big import" bug.

Two ways out: chunk the rows into batches whose parameter count stays under the ceiling,
or use `unnest`, which passes each column as **one** array parameter and so needs only as
many parameters as you have columns, regardless of row count.

```js
const CHUNK = Math.floor(65535 / COLUMNS_PER_ROW);
for (let i = 0; i < rows.length; i += CHUNK) { /* insert rows.slice(i, i + CHUNK) */ }
```

## Inserting rows that may already exist

A duplicate key is an error, not a no-op:

```console
=== 3. ON CONFLICT DO NOTHING vs a bare INSERT ===
bare re-INSERT → 23505 seed_roles_slug_key
run 1 rowCount: 2 | run 2: 0 | run 3: 0
```

`23505` is `unique_violation`, and the constraint name tells you which one. Making the
insert idempotent is [`ON CONFLICT`](06-on-conflict.md) — but note what the same run
measured:

```console
sequence last_value after 3 runs: 6 ← identity is consumed even when ON CONFLICT skips the row
```

Two rows inserted, but the sequence advanced to 6. **The identity value is generated
before the conflict is detected, and discarded rather than reused.** Sequences are not
transactional, by design — see [Sequences](../phase-3-ddl/14-sequences.md). Gaps in an
id column are normal and are not a bug to fix.

## From Node

```js
const {rows: [item]} = await pool.query(
  `INSERT INTO c_items (sku, name, qty, price)
   VALUES ($1, $2, $3, $4)
   RETURNING id, sku, created_at`,
  [sku, name, qty, price],
);
```

Values are always parameters ([Parameterized queries](08-parameters.md)). For a
multi-row insert the placeholders are generated, never the values:

```js
const cols = 4;
const values = items.flatMap(i => [i.sku, i.name, i.qty, i.price]);
const tuples = items
  .map((_, r) => `($${r * cols + 1}, $${r * cols + 2}, $${r * cols + 3}, $${r * cols + 4})`)
  .join(', ');
const {rows} = await pool.query(
  `INSERT INTO c_items (sku, name, qty, price) VALUES ${tuples} RETURNING id`, values);
```

The string being built contains only `$n` placeholders — the data never touches it. That
is the distinction that keeps this safe.

## Trade-off

Per-row `INSERT` is the simplest thing that works, gives per-row error handling, and is
what an ORM emits by default. It costs a round trip and, in autocommit, a WAL flush per
row — measured at 19.5 s for 10 000 rows.

Batching trades that for speed and gives it up: one bad row fails the whole statement, so
you need `ON CONFLICT` or a pre-validation pass, and the 65 535-parameter ceiling becomes
something you must respect. For anything above a few hundred rows the trade is clearly
worth making.

## Gotchas

**Symptom:** `08P01 bind message has 2 parameter formats but 0 parameters`
**Cause:** More than 65 535 parameters in one statement — measured, 21 846 rows × 3
columns. The message does not mention the limit.
**Fix:** Chunk to `floor(65535 / columns)` rows, or use `unnest` with one array per
column.

**Symptom:** A bulk import takes minutes
**Cause:** Per-row inserts in autocommit — measured 19 551 ms per 10 000 rows.
**Fix:** One transaction (8.6×), then one multi-row statement (another 15×), then
`unnest` or `COPY`.

**Symptom:** `23505 duplicate key value violates unique constraint`
**Cause:** The row already exists.
**Fix:** `ON CONFLICT DO NOTHING` or `DO UPDATE` if the insert is meant to be
repeatable.

**Symptom:** Ids have gaps after failed or skipped inserts
**Cause:** Sequences are non-transactional and identity values are consumed before a
conflict is detected — measured, `last_value` reached 6 after inserting 2 rows.
**Fix:** Nothing. Gaps are expected; do not use ids as a count or a contiguous sequence.

**Symptom:** An `INSERT` starts writing values into the wrong columns
**Cause:** `INSERT INTO t VALUES (...)` with no column list, after a schema change.
**Fix:** Always name the target columns.

**Symptom:** A column that should have defaulted is null
**Cause:** An explicit `NULL` was passed, which overrides the default.
**Fix:** Omit the column, or pass `DEFAULT`.

**Symptom:** The new row's id is wrong under load
**Cause:** Reading it back with a separate `SELECT`, which can see another
transaction's row.
**Fix:** `RETURNING id` on the insert itself.

## Interview questions

**★ How do you insert 10 000 rows efficiently, and why is the naive way slow?**
Not row by row: measured 19 551 ms in autocommit, because each statement is its own
transaction with its own WAL flush. Wrapping them in one transaction gives 2 262 ms; a
single multi-row statement gives 148 ms by removing 10 000 round trips; `INSERT … SELECT
unnest` gives 81 ms. `COPY` (243 ms here) wins at larger volumes.

**★ What is the 65 535 limit and how do you work around it?**
The maximum number of bind parameters in one statement, because the protocol stores the
count in 16 bits. Measured: 21 845 rows × 3 columns succeeded, 21 846 failed with
`08P01`. Either chunk by `floor(65535 / columns)` or pass each column as a single array
and expand with `unnest`, which needs one parameter per column regardless of row count.

**★ How do you get the id of a row you just inserted?**
`INSERT … RETURNING id`, in the same statement. A separate `SELECT` afterwards is a race
— under concurrency it can return a different transaction's row.

**★ Why does the id sequence skip numbers?**
Sequences are deliberately non-transactional, so a rolled-back or `ON CONFLICT`-skipped
insert does not give its value back. Measured: three runs of a two-row idempotent seed
left `last_value` at 6. Contiguity is not something an identity column promises.

**What is the difference between omitting a column, passing `DEFAULT`, and passing
`NULL`?**
Omitting it and passing `DEFAULT` both apply the column default. Passing `NULL` stores
null, overriding the default. They differ unless the default is itself null.

---

← [`LIMIT` / `OFFSET`](03-limit-offset.md) · Next → [`RETURNING`](05-returning.md)
