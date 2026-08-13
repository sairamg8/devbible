---
title: "The executor contract"
sidebar_label: "01 · The executor contract"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex38-repository.mjs`.

**Every repository function takes the thing that will run the query as its first
argument.** Not the pool it imported, not a connection it fetches itself — the one
passed in. Everything else in this phase depends on that single rule holding.

## The shape

```js
// repositories/users.js — no imports of the pool, no classes, no base class
export const findByEmail = (db, email) =>
  db.query(`SELECT id, email, full_name FROM r_users WHERE email = $1`, [email]);

export const create = (db, {email, fullName}) =>
  db.query(
    `INSERT INTO r_users (email, full_name) VALUES ($1,$2)
     RETURNING id, email, full_name, created_at`,
    [email, fullName]);
```

`db` is called an *executor*: anything with a `.query(text, params)` method. In
`pg` there are exactly two things that qualify, and the whole pattern rests on
them being interchangeable.

## They really are interchangeable

Both objects expose `.query()` with the same signature and the same result shape.
The same function body was called with each:

```js
const findByEmail = (db, email) =>
  db.query(`SELECT id, email, full_name FROM r_users WHERE email = $1`, [email]);

const viaPool = await findByEmail(pool, 'ada@x.com');
const client = await pool.connect();
try {
  viaClient = await findByEmail(client, 'ada@x.com');
} finally {
  client.release();
}
```

```console
$ node ex38-repository.mjs
=== 1. the same repo function against a Pool and against a Client ===
via pool  : { id: '1', email: 'ada@x.com', full_name: 'Ada Lovelace' }
via client: { id: '1', email: 'ada@x.com', full_name: 'Ada Lovelace' }
same shape: true
constructor names: BoundPool / Client
```

Two different classes — `BoundPool` and `Client` — and identical output. That is
the whole contract. The repository never asks which one it received, and cannot
tell.

## What each one means at the wire level

The distinction they hide is *how many connections the call uses*.

| Passed in | What happens | Use it for |
|---|---|---|
| `pool` | checks out a connection, runs one query, returns it immediately | a single self-contained statement |
| `client` | runs on the connection already checked out, and keeps it | anything that must share a transaction |

`pool.query()` is shorthand for connect → query → release. That is why it is safe
for one-off reads and *unsafe* for anything spanning statements: two `pool.query()`
calls may land on two different connections, which are two different sessions with
two different snapshots and two different transactions.

## Why the repository must not fetch its own connection

The tempting alternative is a module that owns its access to the database:

```js
// repositories/users.js — DO NOT
import {pool} from '../db.js';

export async function findByEmail(email) {
  const client = await pool.connect();          // ← decides for every caller
  try {
    return await client.query(`SELECT ... WHERE email = $1`, [email]);
  } finally {
    client.release();
  }
}
```

This reads cleaner and removes an argument from every call site. It also makes the
function permanently unusable inside a transaction: it always runs on a connection
of its own choosing, so a caller that opened a transaction on a *different*
connection cannot include this write in it. The failure is silent — covered in
full in [Passing a client through services](../12-client-propagation.md), where a
rollback leaves half the request committed.

The rule that avoids it is mechanical: **a repository function never calls
`pool.connect()`, and never calls `pool.query()` on a pool it imported.** It uses
what it was given.

## The leak, and what it looks like

A repository that does check out its own connection also has to release it, and
the failure mode when it does not is worth seeing once. With `max: 2`:

```js
const leaky = async () => {
  const c = await small.connect();
  await c.query('SELECT 1');
  // no release() — the client never goes back to the pool
};
```

```console
=== 6. forgetting client.release() with max: 2 ===
call 1: ok  (1 of 2 connections now held forever)
call 2: ok  (2 of 2 held)
call 3: timeout exceeded when trying to connect  after 1501 ms
pool counts → total=2 idle=0 waiting=0
await pool.end() → STILL PENDING after 2000 ms
after releasing the stranded clients, pool.end() → resolved
```

Two things to take from that. The first is the shape of the outage: calls 1 and 2
succeed, and **call 3 fails after a delay, not immediately** — the pool waits
`connectionTimeoutMillis` hoping a connection comes back. In production this is a
service that gets slower and then starts timing out, with no error at the point
where the bug is.

The second is the line most people have never seen: `await pool.end()` **never
resolves** while a client is stranded. A graceful shutdown that waits on
`pool.end()` hangs forever, and the process has to be killed. If your deploys end
in `SIGKILL` after a timeout, a leaked client is one of the reasons.

The same three calls with `release()` in a `finally`:

```console
=== 7. the same three calls, released in finally ===
call 1: ok
call 2: ok
call 3: ok
pool counts → total=1 idle=1 waiting=0
```

`total=1`: the three sequential calls reused a single connection, because each one
gave it back before the next asked.

## Trade-off

Passing `db` to every function is genuinely more verbose, and it pushes a
database concept into signatures that would otherwise be pure domain code. Teams
that dislike it reach for one of two escapes: a module-level pool (which breaks
transactions, as above) or async-local storage to make the current client
ambient.

`AsyncLocalStorage` does work and does remove the argument. What it costs is the
property that makes this pattern easy to reason about: with an explicit `db`, you
can tell whether a function participates in a transaction *by reading its call
site*. With an ambient client you cannot — the same call means different things
depending on what is above it on the stack. That is a reasonable trade for a
large codebase with a strong convention, and a bad one for a small one.

## Gotchas

**Symptom:** A repository function works in tests and silently escapes the
transaction in production
**Cause:** It calls `pool.query()` on an imported pool instead of using the passed
`db`.
**Fix:** Take `db` as the first parameter, always. Grep the repository directory
for `pool.` — there should be no hits.

**Symptom:** `timeout exceeded when trying to connect` after a delay, under load
**Cause:** A checked-out client is never released, so the pool shrinks by one per
occurrence until nothing is free.
**Fix:** `release()` in a `finally`. Measured: with `max: 2`, the third call failed
after 1501 ms.

**Symptom:** The process hangs on shutdown and has to be killed
**Cause:** `pool.end()` waits for every client to be returned; a leaked one never
is. Measured: still pending after 2000 ms, resolved the moment the stranded
clients were released.
**Fix:** Fix the leak. A shutdown timeout hides it rather than solving it.

**Symptom:** Two queries that should have seen the same data disagree
**Cause:** Both were `pool.query()` calls, so they ran on different connections
and therefore different snapshots.
**Fix:** Check out one client and pass it to both.

## Interview questions

**★ Why does every repository function take a `db` argument instead of importing
the pool?**
Because that argument is what decides whether the query joins the caller's
transaction. A function that imports the pool always runs on a connection of its
own, so it can never participate in a transaction opened elsewhere — and it fails
silently rather than erroring, leaving part of a request committed after a
rollback.

**★ What is the difference between passing the pool and passing a client?**
`pool.query()` checks out a connection, runs the statement and returns it, so
consecutive calls can land on different connections — different sessions,
different snapshots, different transactions. A client is one connection held for
as long as you keep it, which is what lets several statements share a transaction.
The repository cannot tell the two apart: measured, `BoundPool` and `Client`
returned identical results from the same function body.

**★ What happens if a checked-out client is never released?**
The pool loses that connection permanently. Measured with `max: 2`: the first two
calls succeeded, the third failed with `timeout exceeded when trying to connect`
after 1501 ms — a slow degradation rather than an immediate error. `pool.end()`
also never resolves, so graceful shutdown hangs.

**Why is `release()` in a `finally` block rather than after the query?**
Because a query that throws would skip it. `finally` runs on both paths, which is
the only version that survives an error — and errors are exactly when you most
need the connection back.

**Is a repository allowed to open a transaction?**
It can, but then it owns the connection and callers cannot compose it with
anything else. The convention that scales is that repositories only ever run
statements, and the layer above decides transaction boundaries — see
[Transactions in a request](../transactions-request/).

---

← [Topic index](README.md) · Next → [Rows to domain objects](02-rows-to-domain.md)
