---
title: "Optimistic concurrency — a version column"
sidebar_label: "13 · Optimistic concurrency"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex40-api-concurrency.mjs`.

**Read-modify-write across two requests loses data, and it does it silently.** A
`version` column turns the silent loss into a `rowCount` of 0 that you can act on.

## The problem, measured

Two requests, each reading a balance and writing back a new one, with 50 ms of
handler work between the read and the write:

```js
const {rows} = await c.query(`SELECT balance FROM c_accounts WHERE id = 1`);
await new Promise((r) => setTimeout(r, 50));      // think time in the handler
await c.query(`UPDATE c_accounts SET balance = $1 WHERE id = 1`,
  [rows[0].balance + add]);
```

```console
$ node ex40-api-concurrency.mjs
=== 1. read-modify-write with no guard, two requests at once ===
both requests returned: [ 'ok', 'ok' ]
balance: 120 ← 100 + 10 + 20 = 130 expected
```

Both requests succeeded. One update is **gone** — both read 100, one wrote 110, the
other wrote 120 over the top. No error, no warning, and the client that added 10
was told it worked.

This is the classic lost update, and [Phase 11](../phase-11-mvcc/04-lost-update.md)
covers it at the database level. Here we are interested in the version that spans
two HTTP requests: `GET /accounts/1`, the user edits a form, `PUT /accounts/1`.
No transaction can help, because the two requests are minutes apart and there is no
session between them.

## The version column

```sql
ALTER TABLE c_accounts ADD COLUMN version int NOT NULL DEFAULT 1;
```

The read returns the version; the write requires it to still be there:

```sql
UPDATE c_accounts
   SET balance = $1, version = version + 1
 WHERE id = 1 AND version = $2
```

```console
=== 2. UPDATE ... WHERE id = $1 AND version = $2 ===
both requests returned: [ 'ok', 'conflict (rowCount=0)' ]
final row: { balance: 110, version: 2 }
↑ one write applied, the other was REFUSED rather than lost
```

The second request matched no rows, because `version` was no longer 1. Nothing was
overwritten. The loss became a **refusal**, which the API can turn into `409
Conflict` and the client can turn into "this record changed while you were editing
it — reload".

`version = version + 1` must be in the same statement. Incrementing it separately
reopens the same race one level up.

## `rowCount: 0` is ambiguous

This is the part that gets implemented wrong:

```console
=== 3. what rowCount = 0 does not tell you ===
row does not exist  → rowCount 0
version was stale   → rowCount 0
↑ identical results, but one is a 404 and the other a 409
a second SELECT distinguishes them: found version = 1
```

**A missing row and a stale version are indistinguishable from `rowCount` alone.**
One is `404 Not Found`, the other `409 Conflict`, and returning the wrong one sends
the client down the wrong path — a 404 tells them to stop, when they should reload
and retry.

Resolve it with a follow-up read:

```js
const r = await db.query(
  `UPDATE c_accounts SET balance = $1, version = version + 1
    WHERE id = $2 AND version = $3`, [balance, id, version]);
if (r.rowCount === 1) return 'ok';

const {rows} = await db.query(`SELECT version FROM c_accounts WHERE id = $1`, [id]);
if (!rows[0]) throw new NotFoundError('account', id);       // 404
throw new ConflictError('account', {expected: version, actual: rows[0].version});  // 409
```

That works, but the two statements run on different snapshots: between them the
row can change again, or be deleted, so the *reason* you report may not be the
one that actually applied. A data-modifying CTE closes that window by evaluating
both branches against one snapshot:

```sql
WITH updated AS (
  UPDATE c_accounts SET balance = $2, version = version + 1
   WHERE id = $1 AND version = $3
  RETURNING version
)
SELECT version, 'updated'  AS outcome FROM updated
UNION ALL
SELECT version, 'conflict' AS outcome FROM c_accounts
 WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM updated)
```

```console
correct version  → [ { version: 2, outcome: 'updated' } ]
stale version    → [ { version: 2, outcome: 'conflict' } ]
missing row      → []
```

Three outcomes, one round trip: a row saying `updated`, a row saying `conflict`
carrying the version that actually won, or **zero rows** — which is the 404.

The two-statement form above is still fine in practice: by the time you are
reporting an error, a slightly stale reading of *why* is acceptable. What is not
acceptable is reporting 404 for a conflict.

## Retrying

When the update is something the server can redo without asking the user, retry
rather than returning 409:

```js
const withRetry = async (add, tries = 5) => {
  for (let attempt = 1; attempt <= tries; attempt++) {
    const {rows} = await db.query(
      `SELECT balance, version FROM c_accounts WHERE id = 1`);
    const r = await db.query(
      `UPDATE c_accounts SET balance = $1, version = version + 1
        WHERE id = 1 AND version = $2`, [rows[0].balance + add, rows[0].version]);
    if (r.rowCount === 1) return `ok on attempt ${attempt}`;
    await new Promise((r) => setTimeout(r, 10 * attempt));   // backoff
  }
  return 'gave up';
};
```

```console
=== 4. retrying the conflicted request ===
[ 'ok on attempt 1', 'ok on attempt 2', 'ok on attempt 3' ]
balance: 160 ← 100 + 10 + 20 + 30 = 160 expected
```

Three concurrent requests, resolved on attempts 1, 2 and 3, and the arithmetic is
exactly right.

**Retry only when re-reading gives a correct answer.** Here the operation is "add
30 to whatever is current", so re-reading is right. If the operation is "set the
balance to 130 because that is what the user saw", retrying silently applies a
decision the user made against stale data — that is a 409 for a human to resolve,
not something to paper over.

**A retry loop needs a cap and a backoff.** Without a cap, contention becomes an
infinite loop holding a connection; without backoff, retries collide again
immediately.

## Where the version comes from

The client has to send back the version it read, which means exposing it:

```json
{ "id": "1", "balance": 110, "version": 2 }
```

Two common alternatives to an integer column:

- **`updated_at` as the version.** Convenient, and it works until two updates land
  within the same transaction timestamp — `now()` is constant across a transaction,
  measured in [created_at/updated_at](17-timestamps-trigger.md) — at which point
  two different states share a version.
- **An `ETag`/`If-Match` header** carrying the version. The same mechanism with the
  HTTP spelling: `412 Precondition Failed` instead of 409, and it composes with
  caching. Preferred if you already use conditional requests.

An integer column is the simplest thing that is always correct. Use it unless you
have a reason.

## Trade-off

Optimistic concurrency costs nothing when there is no contention — no locks, no
waiting, and readers never block. That is why it is the right default for
user-facing edits, where two people editing the same record within seconds is rare.

Its cost appears exactly where contention is common: every conflict is wasted work,
and under sustained contention on one row, requests can retry repeatedly and some
starve. A row that many requests update concurrently — a counter, a stock level, a
job's status — is the case for taking the lock instead, which is
[SELECT ... FOR UPDATE](14-for-update.md).

The rule of thumb: optimistic for edits separated by human time, pessimistic for
contended rows inside one request.

## Gotchas

**Symptom:** One user's edit silently disappears
**Cause:** Read-modify-write with no version check; the later write overwrites the
earlier. Measured: two concurrent requests, both reported success, one update lost
(120 instead of 130).
**Fix:** `AND version = $n` in the `WHERE`, and treat `rowCount: 0` as a conflict.

**Symptom:** A conflict is reported as `404 Not Found`
**Cause:** `rowCount: 0` treated as "row missing". Measured: a missing row and a
stale version both give `rowCount: 0`.
**Fix:** Re-read the row to distinguish, then 404 or 409.

**Symptom:** The version check passes but updates are still lost
**Cause:** The version is incremented in a separate statement from the update.
**Fix:** `SET ..., version = version + 1` in the same statement as the guard.

**Symptom:** Conflicts under load never resolve
**Cause:** A retry loop with no backoff — the same requests collide again
immediately.
**Fix:** Cap the attempts and back off between them.

**Symptom:** Retrying applies a change the user did not intend
**Cause:** Retrying an absolute assignment made against data the user has since
not seen.
**Fix:** Retry only relative or recomputable operations; return 409 for decisions
a human made.

**Symptom:** `updated_at` as a version misses a conflict
**Cause:** `now()` is the transaction timestamp, so two updates in one transaction
share it.
**Fix:** An integer version column, incremented per update.

## Interview questions

**★ What is a lost update and how does a version column prevent it?**
Two requests read the same row, both compute a new value from what they read, and
the second write overwrites the first — measured, two concurrent requests turned
100 into 120 instead of 130, both reporting success. Adding `AND version = $n` to
the `WHERE` makes the stale write match zero rows, so it is refused rather than
silently applied.

**★ What does `rowCount: 0` mean after a versioned update?**
Either the row does not exist or its version has moved on — measured, the two are
indistinguishable. One is a 404 and the other a 409, so you have to re-read the row
to tell them apart before answering.

**★ When should the server retry a conflict rather than return 409?**
When re-reading produces a correct result — relative operations like "add 30".
When the client's write encodes a decision made against data they saw, retrying
applies that decision to a state they never saw, so it belongs to the user as a
409.

**★ Why must `version = version + 1` be in the same statement as the check?**
Because doing it separately recreates the race: two requests can both pass the
check before either increments. One statement makes the check and the increment
atomic.

**How do optimistic and pessimistic concurrency compare?**
Optimistic takes no locks and costs nothing when conflicts are rare, but wastes
work and can starve under contention. Pessimistic (`SELECT ... FOR UPDATE`)
serialises access with no retries and no lost work, at the cost of holding a lock
and making other requests wait. Optimistic for human-timescale edits, pessimistic
for hot rows within a request.

**What are the alternatives to an integer version column?**
`updated_at`, which breaks when two updates share a transaction timestamp, and an
`ETag` with `If-Match`, which is the same mechanism expressed in HTTP and returns
`412`. The integer column is the simplest always-correct option.

---

← [Passing a client through services](12-client-propagation.md) · Next → [`SELECT ... FOR UPDATE`](14-for-update.md)
