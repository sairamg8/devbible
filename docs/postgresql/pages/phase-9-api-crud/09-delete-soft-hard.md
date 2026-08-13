---
title: "delete hard vs soft"
sidebar_label: "09 · delete"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex4-soft-delete.mjs`.

**A hard delete removes the row and cascades to whatever references it. A soft
delete is an `UPDATE` that sets `deleted_at` — and from that moment every query in
the codebase is wrong until you fix it.** It is a schema-wide commitment, not a
per-endpoint choice.

```sql
CREATE TABLE sd_users (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email      text NOT NULL,
  name       text NOT NULL,
  deleted_at timestamptz            -- NULL means live
);
CREATE TABLE sd_orders (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES sd_users(id) ON DELETE CASCADE,
  total   numeric(12,2) NOT NULL
);
```

## Hard delete: return what you removed

```js
const del = await pool.query(
  `DELETE FROM sd_users WHERE id = $1 RETURNING id, email, name`,
  [id],
);
if (del.rowCount === 0) return res.sendStatus(404);
```

```console
$ node ex4-soft-delete.mjs
=== 1. hard delete with RETURNING ===
rowCount: 1 | returned: { id: '1', email: 'hard@x.com', name: 'Hard' }
orders before: 2 → after: 0 (ON DELETE CASCADE)
deleting a row that is not there → rowCount: 0 | rows: []
```

- **`RETURNING` is free** — the row is already being located and written, so it
  costs no extra round trip and gives the handler something to log or emit.
- **`ON DELETE CASCADE` fired**: two orders went with the user. Correct, and often
  not what the product wanted.
- **Deleting a missing row is not an error**: `rowCount: 0`, empty `rows`, no
  exception. That is your 404 signal. Code expecting a thrown error will report
  success for a delete that removed nothing.

## Soft delete: an UPDATE wearing a delete's clothes

```js
const del = await pool.query(
  `UPDATE sd_users SET deleted_at = now()
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING id, email, deleted_at`,
  [id],
);
```

```console
=== 2. soft delete ===
rowCount: 1 | deleted_at set: true
deleting the same row twice → rowCount: 0 (idempotent)
orphaned orders still visible: 1 — no cascade fires on an UPDATE
```

`AND deleted_at IS NULL` is what makes it idempotent — the second call matches
nothing, so a retried request cannot overwrite the original timestamp. Keep it.

The last line is the part found in production. **Foreign keys do not know about
`deleted_at`.** `ON DELETE CASCADE` is triggered by a `DELETE`; a soft delete is an
`UPDATE`, so the order still exists, still references a user the API says is gone,
and still appears in every report joining the two. You cascade by hand, in every
query, for the life of the schema.

## The unique constraint nobody plans for

Someone deletes their account, then signs up again with the same email.

```console
=== 3. re-registering a soft-deleted email ===
plain unique index → 23505 sd_users_email_key | Key (email)=(dup@x.com) already exists.
```

The tombstone still occupies the unique index. Fix it with a **partial unique
index** — unique only among live rows:

```sql
CREATE UNIQUE INDEX sd_users_live_email_key
    ON sd_users (email)
 WHERE deleted_at IS NULL;
```

```console
partial unique index → re-registration ok: { id: '5', email: 'dup@x.com' }
rows now holding that email: 2 (1 live, 1 tombstoned)
```

Two rows now share an email, intentionally. The consequence: any lookup *by email*
that does not filter `deleted_at` can get either one.

## The filter everyone forgets

```console
=== 4. the query everyone forgets to change ===
SELECT count(*)            → 3
... WHERE deleted_at IS NULL → 1
```

Every existing `SELECT`, `count`, join and admin report. The failure is silent —
deleted rows reappearing in a list, a dashboard counting three users where there is
one. There is no error to grep for. Two defences hold:

1. **One place that builds the base query** ([A repository module per
   resource](./repository/)), so the predicate is applied once, not remembered
   40 times.
2. **A view** — rename the table to `sd_users_all` and
   `CREATE VIEW sd_users AS SELECT * FROM sd_users_all WHERE deleted_at IS NULL`.
   Existing queries stay correct by default; the ones needing tombstones opt in.

## Index it, or the filter costs a scan

200 000 rows, 10 % soft-deleted:

```console
=== 5. partial index on a realistic table ===
no index:
   Seq Scan on sd_big  (actual time=1.892..27.079 rows=1.00 loops=1)
   Buffers: shared hit=1299 | Execution Time: 27.103 ms
full index on (email):
   Index Scan using sd_big_email_idx  (actual time=0.065..0.067 rows=1.00 loops=1)
   Buffers: shared hit=1 read=3 | Execution Time: 0.091 ms
partial index WHERE deleted_at IS NULL:
   Index Scan using sd_big_live_email_idx  (actual time=0.043..0.045 rows=1.00 loops=1)
   Buffers: shared hit=1 read=3 | Execution Time: 0.069 ms
```

27.1 ms → 0.069 ms; 1299 buffer hits → 4. Full versus partial is a wash on lookup
time here; the partial index's advantage is size — 5568 kB against 6184 kB, a
saving that tracks your tombstone ratio, so it is small at 10 % deleted and large
on a table that is mostly history.

**The sharp edge:**

```console
query without the deleted_at predicate → Seq Scan on sd_big  (cost=0.00..3799.00 rows=1 width=29)
```

A partial index is usable only when the planner can prove the query's `WHERE`
implies the index predicate. Drop `deleted_at IS NULL` and the index is not merely
less useful — it is *unusable*. The partial index and the repository-level filter
are therefore the same decision: a query that forgets the predicate gets no index
at all.

## Trade-off

**Hard delete** is simple, keeps queries honest, lets foreign keys and unique
constraints do their job, and reclaims space. It loses the data.

**Soft delete** keeps history and makes undelete a one-line `UPDATE`. It costs a
predicate on every query forever, partial indexes to keep uniqueness meaningful,
cascades done by hand, and a table that only grows.

It is also **not an audit log**: it records that a row is currently considered
deleted, not who deleted it or what it looked like before, and a later `UPDATE`
overwrites the row in place. If the requirement is "undo for 30 days", soft delete
fits. If it is "prove what happened", use an append-only history table or
[Node Phase 8 · Audit logging](/docs/nodejs/pages/phase-8-security/audit-logging)
and hard-delete the live row. Choosing soft delete for an audit requirement gives
you the costs of both and the guarantees of neither.

## Gotchas

**Symptom:** Deleted users still appear in a list endpoint
**Cause:** A query written before soft delete existed, still missing `deleted_at IS NULL`.
**Fix:** Filter in one place — a repository base query or a view over the table.

**Symptom:** `23505 duplicate key` when a user re-registers with an old email
**Cause:** A full unique index still counts tombstoned rows.
**Fix:** `CREATE UNIQUE INDEX … WHERE deleted_at IS NULL`.

**Symptom:** Orders reference a user the API says does not exist
**Cause:** `ON DELETE CASCADE` never fires for a soft delete — it is an `UPDATE`.
**Fix:** Soft-delete the children in the same transaction, or filter through the join.

**Symptom:** A query got slower after the soft-delete migration
**Cause:** The added predicate is in no index, or the partial index predicate does
not match the query's.
**Fix:** Index it, and make every query repeat the exact predicate — otherwise the
partial index cannot be used at all.

**Symptom:** `DELETE` returns success for an id that was never there
**Cause:** `rowCount: 0` with no exception is the normal result.
**Fix:** Check `rowCount` explicitly and map 0 to 404.

**Symptom:** Deleting twice overwrites the original `deleted_at`
**Cause:** The `UPDATE` has no `AND deleted_at IS NULL` guard.
**Fix:** Add it; the second call then returns `rowCount: 0` and changes nothing.

## Interview questions

**★ What actually changes when you switch a table to soft delete?**
Every query. `DELETE` becomes `UPDATE … SET deleted_at = now()`, and every
`SELECT`, `count` and join needs `deleted_at IS NULL`. Foreign-key cascades stop
firing because no `DELETE` happens, and unique constraints start blocking
legitimate re-registration because tombstones still occupy the index.

**★ A user deletes their account and signs up again with the same email. What happens?**
With a plain unique index, `23505 duplicate key value violates unique constraint`
— the tombstone owns the email. Fix with a partial unique index
`… WHERE deleted_at IS NULL`, making the column unique only among live rows.
Measured: re-registration then succeeds and two rows legitimately share the email.

**★ Why did a partial index not speed up one particular query?**
A partial index is usable only when the query's `WHERE` implies the index
predicate. A query missing `deleted_at IS NULL` cannot use an index defined
`WHERE deleted_at IS NULL` — measured as a `Seq Scan` where the predicate-matching
query did an `Index Scan` in 0.069 ms.

**★ How do you return 404 from a delete endpoint?**
`rowCount === 0`. Deleting a non-existent row is not an error in PostgreSQL —
`rowCount: 0`, empty `rows`, no exception. Use `RETURNING` and check the count.

**★ Is soft delete an audit log?**
No. It records that a row is currently deleted, not who deleted it, when it was
last modified, or its previous values — and a later `UPDATE` overwrites it in
place. For provable history use an append-only history table and hard-delete the
live row.

**Why guard the soft-delete `UPDATE` with `AND deleted_at IS NULL`?**
It makes the operation idempotent. A retried request matches nothing and returns
`rowCount: 0` rather than resetting `deleted_at` to a later timestamp — which would
corrupt any retention window measured from it.

---

← [Partial updates](08-update-partial.md) · Next → [Keyset pagination](./keyset/)
