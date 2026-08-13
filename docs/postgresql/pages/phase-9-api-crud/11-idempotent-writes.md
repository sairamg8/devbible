---
title: "Idempotent writes"
sidebar_label: "11 · Idempotent writes"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex40-api-concurrency.mjs`.

**Any write endpoint reachable over a network will be called twice.** A timeout
that the client retries, a double-clicked button, a queue redelivering after a
lost ack — the second call is not a bug to prevent, it is a condition to handle.

## What happens without a key

```console
$ node ex40-api-concurrency.mjs
=== 8. the same POST twice, no idempotency key ===
created ids: 1 2
rows now   : 2 ← the customer was charged twice
```

Two rows, two ids, no error. Nothing in the database was in a position to know the
second request was a repeat of the first — the two are indistinguishable.

## The key is a unique constraint

Idempotency is not clever application logic. It is a unique index, and everything
else is about what you return:

```sql
CREATE TABLE c_payments (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  idempotency_key text UNIQUE,
  account_id      bigint NOT NULL,
  amount          int NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now());
```

The client generates the key — a UUID — and sends it in a header:
`Idempotency-Key: 3f2a...`. It must come from the client, because the whole point
is that the retry carries the *same* key as the original, and only the client
knows the two are the same request.

The constraint alone is enough for correctness. Ten identical requests racing,
with no `ON CONFLICT` at all:

```console
=== 12. the same race using plain INSERT (no ON CONFLICT) ===
succeeded=1 duplicate-key=9
↑ the unique index is what makes it safe; ON CONFLICT only decides the response
```

**One insert, nine `23505`s.** No duplicate row was ever created, even with ten
requests in flight simultaneously. The index is the correctness mechanism;
everything below is about turning those nine errors into a sensible response.

## The `DO NOTHING` trap

The obvious first attempt swallows the conflict:

```sql
INSERT INTO c_payments (idempotency_key, account_id, amount)
VALUES ($1, 1, 500)
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING id, created_at
```

```console
=== 9. ON CONFLICT DO NOTHING ... RETURNING ===
first  → rowCount 1 row { id: '1', created_at: 2026-08-13T08:01:41.601Z }
second → rowCount 0 row undefined
↑ the retry gets NO row back, so the handler cannot answer 200 with the payment
```

The retry gets **nothing**. `DO NOTHING` means no row was written, so `RETURNING`
has nothing to return — and the handler that was going to reply with the payment
now has `undefined`.

You can recover with a second `SELECT` on the key, and that is a legitimate
implementation. But it is two round trips and a race of its own, and there is a
one-statement version.

## `DO UPDATE` returns the stored row

Make the conflict path an update that changes nothing meaningful, so there *is* a
row to return:

```sql
INSERT INTO c_payments (idempotency_key, account_id, amount)
VALUES ($1, 1, 500)
ON CONFLICT (idempotency_key)
  DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
RETURNING id, created_at, (xmax = 0) AS was_inserted
```

```console
=== 10. ON CONFLICT DO UPDATE returns the stored row ===
first  → { id: '1', created_at: 2026-08-13T08:01:41.614Z, was_inserted: true }
second → { id: '1', created_at: 2026-08-13T08:01:41.614Z, was_inserted: false }
same id? true · was_inserted distinguishes the create from the replay
```

Same `id`, same `created_at` — the retry gets the **original** row, not a new one.

`SET idempotency_key = EXCLUDED.idempotency_key` assigns the column its own value;
it exists purely to make the statement an `UPDATE` so `RETURNING` fires.

`(xmax = 0) AS was_inserted` is how you tell the two paths apart. `xmax` is the
system column holding the deleting/locking transaction id; it is `0` for a freshly
inserted row and non-zero for one touched by the `DO UPDATE`. That is what lets the
handler answer `201 Created` the first time and `200 OK` on the replay.

Under the full race:

```console
=== 11. 10 identical POSTs fired at once ===
inserted=1 replays=9 errors=0
distinct ids: 1
rows in table: 1
```

Ten simultaneous requests, **one insert, nine replays, zero errors, one row**, and
every caller got the same id back. That is the behaviour a payment endpoint needs.

## Returning the original response

For a payment, "the same row" is enough. For an endpoint whose response is not
simply the row — a computed receipt, a list of side effects — the retry has to get
the *same response*, not a regenerated one. That means storing it:

```sql
CREATE TABLE idempotency_keys (
  key          text PRIMARY KEY,
  request_hash text NOT NULL,
  status       int,
  response     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz);
```

The flow: insert the key with `ON CONFLICT DO NOTHING`. If you inserted, you own
the request — do the work, then fill in `status` and `response`. If you did not,
someone else owns it: if `completed_at` is set, replay the stored response; if it
is not, the original is still in flight, and `409 Conflict` is the honest answer.

**`request_hash` is the part people leave out.** A client that reuses a key with a
*different* body is a bug on their side, and returning the first response hides it.
Compare the hash and return `422` on mismatch.

**Scope the key** to the authenticated principal — `PRIMARY KEY (user_id, key)` —
or one tenant's key collides with another's, and a client can probe or hijack a
response by guessing a key.

## What already is idempotent

Not every endpoint needs this machinery. Check whether the operation is naturally
idempotent first:

| Operation | Idempotent? |
|---|---|
| `PUT /users/5` with a full body | yes — same result every time |
| `DELETE /users/5` | yes — second call finds nothing to do |
| `UPDATE ... SET status = 'shipped' WHERE id = $1` | yes — absolute assignment |
| `UPDATE ... SET balance = balance + 10` | **no** — relative, and repeats compound |
| `POST /payments` | **no** — creates a new resource each time |
| `INSERT ... ON CONFLICT DO NOTHING` on a natural key | yes |

**Absolute assignments are idempotent; relative ones are not.** If a natural
unique key already exists — an order number from the client, an external
transaction id — use it and skip the separate idempotency table entirely.

## Trade-off

The full idempotency-key table is real machinery: a second table, a hash of every
request body, a rule for in-flight requests, and rows that need expiring — a
`created_at` index and a periodic delete, or the table grows forever. Twenty-four
hours is a common retention window and it needs to be at least as long as your
clients' retry schedules.

The cheap version — a unique constraint on a natural key plus
`ON CONFLICT DO UPDATE ... RETURNING` — gets you correctness and a usable response
in one statement with no extra table. It cannot replay a *response*, only a row.

Start with the unique constraint. Add the key table when an endpoint's response
genuinely cannot be recomputed from its row, which is rarer than it sounds.

## Gotchas

**Symptom:** A retried request creates a second resource
**Cause:** No unique key identifying the logical request.
**Fix:** A client-supplied `Idempotency-Key` with a unique index. Measured: without
one, two POSTs made two rows.

**Symptom:** The retry gets `undefined` instead of the resource
**Cause:** `ON CONFLICT DO NOTHING ... RETURNING` returns no row on the conflict
path — measured, `rowCount: 0`.
**Fix:** `DO UPDATE SET key = EXCLUDED.key ... RETURNING`, or a follow-up `SELECT`.

**Symptom:** The API cannot tell a create from a replay
**Cause:** `DO UPDATE` returns a row either way.
**Fix:** `RETURNING (xmax = 0) AS was_inserted` — `true` for an insert.

**Symptom:** `23505` reaches the client as a 500 under load
**Cause:** Concurrent duplicates on a plain `INSERT`. Measured: 10 racing requests
gave 1 success and 9 duplicate-key errors.
**Fix:** Either `ON CONFLICT`, or catch `23505` and treat it as a successful
replay.

**Symptom:** A client's key returns another client's response
**Cause:** The key is globally unique rather than scoped to the principal.
**Fix:** `PRIMARY KEY (user_id, key)`.

**Symptom:** A key reused with a different body returns the first body's response
**Cause:** No `request_hash` check.
**Fix:** Store a hash of the request and return `422` on mismatch.

**Symptom:** The idempotency table grows without limit
**Cause:** No expiry.
**Fix:** Index `created_at` and delete beyond the retention window — longer than
your clients' retry schedules.

## Interview questions

**★ How do you make a `POST` idempotent?**
The client sends a stable `Idempotency-Key`, and that key has a unique index. The
index is what makes it correct — measured, 10 racing inserts produced 1 row and 9
`23505`s. `ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key RETURNING ...` then
returns the original row to every caller, with 1 insert and 9 replays and no
errors.

**★ Why not `ON CONFLICT DO NOTHING`?**
Because `RETURNING` gives you nothing on the conflict path — measured,
`rowCount: 0` and `rows[0]` undefined — so the retry cannot be answered with the
resource. `DO UPDATE` assigning a column its own value makes a row available to
return.

**★ How do you tell whether you created the row or replayed an existing one?**
`RETURNING (xmax = 0) AS was_inserted`. `xmax` is zero on a freshly inserted row
and non-zero on one touched by the `DO UPDATE` path — measured, `true` on the
first call and `false` on the retry. That is what distinguishes `201` from `200`.

**★ Which operations are already idempotent and need none of this?**
Anything that assigns absolutely: `PUT` with a full body, `DELETE`,
`SET status = 'shipped'`. Relative changes are not — `SET balance = balance + 10`
compounds on every retry. Neither is a `POST` that creates a resource.

**When do you need a separate idempotency-key table rather than a unique
constraint?**
When the response cannot be recomputed from the stored row — a receipt or a set of
side effects. Then you store the status and response body against the key and
replay it. Also store a hash of the request so a key reused with a different body
is rejected rather than silently answered.

**What should happen if a retry arrives while the original is still running?**
Return `409`. The key row exists but has no `completed_at`, so there is no
response to replay and doing the work again would defeat the purpose.

---

← [Keyset pagination](./keyset/) · Next → [Passing a client through services](12-client-propagation.md)
