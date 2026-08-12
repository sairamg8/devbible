---
title: "Sequences as real objects"
sidebar_label: "14 · Sequences"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex11-ddl-alter.mjs`.

**A sequence is a separate database object with its own state, and that state is
deliberately outside your transaction. Every surprising thing about sequences
follows from that one design decision.**

## Gaps are the design, not a defect

```console
$ node ex11-ddl-alter.mjs
=== 4. where sequence gaps come from ===
┌─────────┬─────┬─────┐
│ (index) │ id  │ t   │
├─────────┼─────┼─────┤
│ 0       │ '1' │ 'a' │
│ 1       │ '4' │ 'b' │
└─────────┴─────┴─────┘
→ rollback and failed inserts both consume ids; sequences are non-transactional
```

Four insert attempts, two rows, ids 1 and 4. Id 2 went to a rolled-back
transaction; id 3 to an insert that failed a unique constraint. **Neither was
returned.**

That is required for concurrency. If `nextval` were transactional, every inserter
would have to block until the previous one committed, serialising all inserts on the
table. Instead `nextval` takes its value and releases immediately, so a thousand
concurrent inserters never wait on each other — and the price is holes wherever a
transaction did not commit.

Other gap sources, all normal:

- **Caching.** `CACHE n` makes each session grab `n` values at once; whatever it
  does not use is lost when the connection closes. Default is 1.
- **Crashes.** The sequence's `last_value` is WAL-logged periodically, not per call,
  so recovery can skip forward.

**Anything that must be gapless — invoice numbers, legal document numbers — cannot
use a sequence.** It needs a counter row updated inside the transaction
(`UPDATE counters SET n = n + 1 … RETURNING n`), which is correct and serialises
every insert on that counter. That trade is the point: gapless and concurrent are
mutually exclusive.

## Ownership

`serial` and identity columns create a sequence *owned* by the column, so it is
dropped with the table:

```console
sequence left after DROP TABLE id_b: 0
```

A sequence created by hand with `CREATE SEQUENCE` is independent — dropping the
table leaves it behind. Tie it to the column explicitly if that is what you meant:

```sql
ALTER SEQUENCE my_seq OWNED BY my_table.id;
```

Ownership affects lifecycle only. It does not stop anything else calling `nextval`
on the sequence.

## Reading and repairing state

```sql
SELECT last_value, log_cnt, is_called FROM my_table_id_seq;   -- current state
SELECT pg_get_serial_sequence('my_table', 'id');              -- find the name
```

The classic repair, after rows were inserted with explicit ids (which does **not**
advance the sequence, so it later collides):

```sql
SELECT setval(
  pg_get_serial_sequence('my_table', 'id'),
  COALESCE((SELECT max(id) FROM my_table), 0) + 1,
  false
);
```

The third argument is `is_called`. With `false`, the *next* `nextval` returns
exactly the value you passed; with `true` (the default) it returns the value after.
Getting this backwards either skips an id or hands out one that is taken.

This whole repair is why [Primary keys](02-primary-keys.md) recommends
`GENERATED ALWAYS AS IDENTITY` — it rejects manual ids with `428C9`, so the
divergence cannot happen.

## `currval` and `lastval` — prefer `RETURNING`

```sql
INSERT INTO t (name) VALUES ('x') RETURNING id;   -- ✓ one round trip, unambiguous
```

`currval('seq')` returns the last value *this session* obtained, and errors with
`55000` if the session has not called `nextval` yet. `lastval()` returns the last
value from any sequence in the session — which breaks silently the moment a trigger
or a second insert intervenes between your insert and your read.

`RETURNING` has neither problem, costs no extra round trip, and works with bulk
inserts where `currval` returns only the final value.

## Sequences and replicas

`nextval` is a write. It cannot run on a read replica, and it is not something to
call speculatively "to reserve an id" — every call consumes a value whether or not
you use it.

## Trade-off

Sequences give you contention-free unique numbers: fast, concurrent, and never
duplicated. They give up ordering guarantees and density. Two rows inserted in id
order were not necessarily *committed* in that order — a transaction that took id 5
can commit after one that took id 7 — so **an id sequence is not a reliable "created
order" for anything that matters.** Use a timestamp, or accept the approximation
knowingly.

For gapless, dense, or strictly ordered numbering, a sequence is the wrong tool and
the replacement is slower by design.

## Gotchas

**Symptom:** Ids have holes
**Cause:** Rollbacks, failed inserts and caching all consume values — measured, ids
1 and 4 after four attempts.
**Fix:** Nothing. Gaps are correct; a gapless requirement needs a serialised counter
row.

**Symptom:** `23505` on a primary key nobody touched
**Cause:** Rows were inserted with explicit ids, which does not advance the
sequence.
**Fix:** `setval(…, max(id) + 1, false)`; prevent it with
`GENERATED ALWAYS AS IDENTITY`.

**Symptom:** `setval` left the sequence one off
**Cause:** The `is_called` argument. `false` means the next `nextval` returns the
value given; `true` means the one after.
**Fix:** Use `max(id) + 1` with `false`, or `max(id)` with `true`.

**Symptom:** A sequence survives `DROP TABLE`
**Cause:** It was created by hand, not by `serial`/identity, so nothing owns it.
**Fix:** `ALTER SEQUENCE … OWNED BY table.column`.

**Symptom:** `55000 currval of sequence … is not yet defined in this session`
**Cause:** `currval` before any `nextval` on that connection — likely a pooled
connection that did not do the insert.
**Fix:** `INSERT … RETURNING id`.

**Symptom:** `lastval()` returned an unexpected id
**Cause:** A trigger or another insert consumed a sequence value in between.
**Fix:** `RETURNING`.

**Symptom:** Large gaps after a crash or restart
**Cause:** `last_value` is WAL-logged periodically, and cached values are lost with
the session.
**Fix:** Expected behaviour; lower `CACHE` if the size of the gaps matters.

## Interview questions

**★ Why do sequences leave gaps, and is that a bug?**
Not a bug — a requirement. `nextval` is deliberately non-transactional so concurrent
inserters never block on each other. A rollback or a failed insert therefore keeps
its value. Measured: four attempts produced ids 1 and 4. Making it gapless would
serialise every insert on the table.

**★ How would you implement a gapless invoice number?**
Not with a sequence. A counter row updated inside the same transaction —
`UPDATE counters SET n = n + 1 WHERE name = 'invoice' RETURNING n` — so a rollback
returns the number. The cost is that every invoice insert serialises on that row,
which is exactly the concurrency sequences exist to avoid.

**★ A `serial` primary key started raising `23505`. Why?**
Rows were inserted with explicit ids, which does not advance the sequence, so
`nextval` eventually returned a value already present. Repair with
`setval(…, max(id) + 1, false)`. `GENERATED ALWAYS AS IDENTITY` prevents it entirely
by rejecting manual values with `428C9`.

**★ Why prefer `RETURNING id` over `currval`?**
`currval` is session state: it errors with `55000` if the session never called
`nextval`, and `lastval()` returns whichever sequence was touched most recently, so
a trigger can silently change the answer. `RETURNING` is unambiguous, costs no extra
round trip, and works for multi-row inserts.

**★ Is a higher id guaranteed to mean a later row?**
No. A transaction that took id 5 can commit after one that took id 7, so id order is
not commit order. For real ordering use a timestamp — or accept the approximation
deliberately.

**What does `OWNED BY` change?**
Lifecycle only: an owned sequence is dropped with its table, as `serial` and
identity sequences are — measured, 0 sequences left after `DROP TABLE`. It does not
restrict who may call `nextval`.

---

← [`DROP`, `CASCADE`, `RESTRICT`](13-drop-cascade.md) · Next → [Generated columns](15-generated-columns.md)
