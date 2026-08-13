---
title: "create — INSERT ... RETURNING"
sidebar_label: "06 · create"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex38-repository.mjs`.

**A create endpoint has to answer with the row the database actually stored, not
the one the client sent.** `RETURNING` is how you get it without a second query
and without a race.

## The repository function

```js
export const create = async (db, {email, fullName, age}) => {
  const {rows} = await db.query(
    `INSERT INTO r_users (email, full_name, age) VALUES ($1,$2,$3)
     RETURNING id, email, full_name, age, created_at`,
    [email, fullName, age]);
  return toDomain(rows[0]);
};
```

```console
$ node ex38-repository.mjs
=== 3. create via INSERT ... RETURNING ===
raw row  : {
  id: '2',
  email: 'grace@x.com',
  full_name: 'Grace Hopper',
  age: 45,
  created_at: 2026-08-13T07:56:00.580Z
}
domain   : {
  id: '2',
  email: 'grace@x.com',
  fullName: 'Grace Hopper',
  age: 45,
  createdAt: '2026-08-13T07:56:00.580Z'
}
```

The client sent three fields. The response has five, and two of them —`id` and
`created_at` — did not exist until the statement ran. That is the reason
`RETURNING` is not optional here.

## Why not a second `SELECT`

The alternative is to insert and then read the row back:

```js
await db.query(`INSERT INTO r_users (email, full_name) VALUES ($1,$2)`, [...]);
const {rows} = await db.query(
  `SELECT * FROM r_users WHERE email = $1`, [email]);      // don't
```

Three separate problems:

1. **You need a key to read it back by**, and the key you just generated is the
   one thing you do not have. Using the email works only while the email is
   unique and immutable — and if you had a natural key you would not need the
   surrogate one.
2. **`currval()` and `lastval()` are per-session**, so they are correct only if
   the second statement runs on the same connection. Through `pool.query()` it
   may not — the same class of bug as
   [`pool.query('BEGIN')`](./05-transactions-request/01-the-wrapper.md).
3. **It is two round trips instead of one**, and outside a transaction there is a
   window in which another request can change the row before you read it.

`RETURNING` has none of these. It runs as part of the insert, sees exactly what
was written, and costs nothing extra.

## What to put in the `RETURNING` list

Name the columns. `RETURNING *` has the same problem as `SELECT *`: a column added
later silently joins your API response, and a `password_hash` added in a migration
is public the moment it exists.

The list should be the columns the mapper reads, which makes it the columns the
API exposes — see
[Rows to domain objects](./01-repository/02-rows-to-domain.md).

`RETURNING` can also compute:

```sql
INSERT INTO r_users (email, full_name) VALUES ($1,$2)
RETURNING id, email, created_at,
          extract(epoch FROM created_at)::bigint AS created_epoch
```

Anything legal in a `SELECT` list is legal here, evaluated against the row as
stored — including columns filled by a `DEFAULT`, by a
[trigger](./17-timestamps-trigger.md), or by a `GENERATED` expression.

## Defaults and generated columns

This is where "the row the client sent" and "the row that exists" diverge most:

| Column kind | Client sends | `RETURNING` gives you |
|---|---|---|
| `GENERATED ALWAYS AS IDENTITY` | nothing (and may not) | the assigned id |
| `DEFAULT now()` | nothing | the server's timestamp |
| `GENERATED ALWAYS AS (...) STORED` | nothing | the computed value |
| A `BEFORE INSERT` trigger's column | nothing | whatever the trigger set |
| A `text` column with a `CHECK` | a value | the same value, or an error |

The server's timestamp matters more than it looks. `created_at` from
`DEFAULT now()` is the database's clock; a timestamp generated in Node is the API
server's clock, and in a multi-instance deployment those disagree by however far
apart the two machines' clocks have drifted. Ordering by a client-generated
timestamp produces orderings that are wrong across instances.

## Creating several rows in one statement

A loop of inserts is a round trip per row. For a create endpoint that accepts a
collection, one statement:

```js
export const createMany = async (db, users) => {
  const {rows} = await db.query(
    `INSERT INTO r_users (email, full_name)
     SELECT * FROM unnest($1::text[], $2::text[])
     RETURNING id, email, full_name`,
    [users.map((u) => u.email), users.map((u) => u.fullName)]);
  return rows.map(toDomain);
};
```

`unnest` with one array per column keeps the parameter count at 2 regardless of
how many rows there are, which matters because the wire protocol caps a statement
at 65535 parameters. The measured comparison against `VALUES` and `COPY` — 5000
rows through 3 parameters, and where each form wins — is in
[Phase 4 · VALUES and unnest](../phase-4-crud/19-values-unnest.md).

**`RETURNING` on a multi-row insert does not promise an order.** If you need to
match returned ids back to input rows, return a column that identifies them rather
than relying on position.

## Trade-off

`RETURNING` makes the create endpoint one round trip and always consistent, and it
ties the response shape to the table. Every column in the list is a column the API
now exposes, and dropping one is a breaking change even though it looks like a
schema cleanup.

The alternative — return only the id, and make the client `GET` the resource — is
more decoupled and more REST-shaped, and it costs the client an extra round trip
on every create. It also reintroduces the read-back race, though now it is the
client's problem rather than yours.

For most APIs, returning the full created resource with `201 Created` and a
`Location` header is the better default: it is one round trip, and clients almost
always need the row immediately.

## Gotchas

**Symptom:** The response has no `id`
**Cause:** `INSERT` without `RETURNING`; `rows` is empty and `rowCount` is 1.
**Fix:** Add `RETURNING`. There is no other way to learn a generated id in the
same round trip.

**Symptom:** A column nobody meant to expose appears in create responses
**Cause:** `RETURNING *`.
**Fix:** Name the columns, matching what the mapper reads.

**Symptom:** `created_at` values from different API instances interleave wrongly
**Cause:** The timestamp was generated in Node, so it is the app server's clock.
**Fix:** `DEFAULT now()` and let `RETURNING` tell you what was stored.

**Symptom:** `cannot insert a non-DEFAULT value into column "id"`
**Cause:** The column is `GENERATED ALWAYS AS IDENTITY` and the insert supplied a
value.
**Fix:** Omit the column, or use `GENERATED BY DEFAULT AS IDENTITY` if clients
must be able to supply ids.

**Symptom:** Returned rows do not line up with the input array
**Cause:** Relying on `RETURNING` order for a multi-row insert, which is not
guaranteed.
**Fix:** Return a correlating column and match on it.

**Symptom:** `bind message has 70000 parameter formats but 0 parameters`
**Cause:** A generated `VALUES` list exceeded the 65535-parameter protocol limit.
**Fix:** `unnest` with one array per column, which uses one parameter per column.

## Interview questions

**★ Why use `INSERT ... RETURNING` instead of inserting and then selecting?**
Because the generated id is the thing you would need in order to select, and you
do not have it. `currval()` only works on the same session, so through a pool it
is unreliable. `RETURNING` is one round trip, sees exactly what was written, and
has no window for another request to change the row first.

**★ What ends up in the response that the client never sent?**
Everything the database filled in: identity ids, `DEFAULT now()` timestamps,
`GENERATED ... STORED` columns and anything a `BEFORE INSERT` trigger set.
Measured, a three-field insert returned five fields.

**★ Why not `RETURNING *`?**
Same reason as `SELECT *` — the response becomes whatever the table currently has,
so a column added by a migration is published the day it lands. Naming the columns
makes the API surface explicit.

**★ Why let the database generate `created_at` rather than Node?**
Because across several API instances the app servers' clocks disagree, so
ordering by a client-generated timestamp gives orderings that are wrong. `now()`
is one clock for all writers.

**How do you insert many rows in one statement without hitting the parameter
limit?**
`INSERT ... SELECT * FROM unnest($1::text[], $2::text[])` — one array parameter
per column, so the parameter count is fixed no matter how many rows. A generated
`VALUES` list uses one parameter per value and hits the 65535 cap.

**What status code and headers should a create endpoint return?**
`201 Created` with a `Location` header pointing at the new resource, and the
created resource as the body — which is exactly what `RETURNING` gives you.

---

← [Transactions in a request](./transactions-request/) · Next → [findById](07-find-by-id.md)
