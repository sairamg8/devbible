---
title: "LISTEN/NOTIFY from Node"
sidebar_label: "14 · LISTEN/NOTIFY"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex22-notify-cursor-pgjs.mjs`.

**PostgreSQL can push a message to a connected client. It needs a dedicated `Client`,
delivery happens on `COMMIT`, and nothing is stored — a listener that is disconnected
misses the message permanently. Treat it as a hint to go and look, never as a queue.**

## A listener is a `Client`, not a pool

```js
import pg from 'pg';

const listener = new pg.Client({connectionString: process.env.DATABASE_URL});
await listener.connect();
listener.on('notification', (msg) => {
  console.log(msg.channel, msg.payload, msg.processId);
});
await listener.query('LISTEN jobs');
```

```console
$ node ex22-notify-cursor-pgjs.mjs
=== 1. LISTEN / NOTIFY needs a dedicated Client ===
received: [
  { channel: 'jobs', payload: 'from-pool', from: 1940 },
  { channel: 'jobs', payload: 'via-pg_notify', from: 1940 }
]
```

`LISTEN` is a property of the **session**, and the handler is bound to that connection.
Through a pool, the connection goes back after the query and no handler follows it:

```console
LISTEN issued via pool.query → the connection went back to the pool; no handler is attached, notifications are lost
```

This is the one case in the phase where a bare `pg.Client` is unambiguously correct
([`Pool` vs `Client`](02-pool-vs-client.md)). *Sending* is fine from a pool — it is a
normal statement.

## Sending

```sql
NOTIFY jobs, 'payload';                 -- channel is an identifier, payload a literal
SELECT pg_notify('jobs', $1);           -- function form — takes parameters
```

The function form is the one to use from application code, because `NOTIFY`'s channel and
payload are *syntax*, so a dynamic payload would have to be concatenated. `pg_notify`
takes both as ordinary parameters
([Parameterized queries](../phase-4-crud/08-parameters.md)).

## Delivery is on `COMMIT`

```console
after NOTIFY, before COMMIT → 0 notifications
after COMMIT                → 1 notifications: [ 'inside-tx' ]
after ROLLBACK              → 0 notifications
```

Notifications are transactional. Nothing is delivered while the transaction is open, and a
rollback discards them entirely.

That is exactly the property you want: notify inside the same transaction as the write, and
listeners are told only about work that actually committed. It removes the classic race
where a listener is woken, queries the table, and finds nothing because the writer had not
committed yet.

## Duplicates within a transaction are folded

```console
3 identical + 1 different   → 2 delivered: [ 'same', 'different' ]
```

Three identical `NOTIFY`s in one transaction produced **one** delivery. PostgreSQL
deduplicates identical channel/payload pairs within a transaction.

Useful — a trigger firing per row on a 1000-row update sends one notification, not a
thousand. But it means **you cannot count notifications**: they are not one-per-event.
Reinforces the same conclusion — a notification is a hint, not a record.

## The payload is small

```console
8000-byte payload → 22023 payload string too long
```

The limit is 8000 bytes. Do not put the data in the payload; put an id, or nothing at all:

```sql
SELECT pg_notify('order_created', $1::text);   -- just the id
```

The listener then reads the row properly, with the right isolation and the right columns.

## Nothing is durable

This is the constraint that decides whether you can use it. There is **no storage**. If
the listener is disconnected — a deploy, a network blip, a crash — messages sent in that
window are gone. There is no replay, no acknowledgement, and no way to detect the loss.

So the correct shape is a **notification plus a source of truth**:

```js
async function pollAndProcess() {
  for (;;) {
    const {rows} = await pool.query(
      `UPDATE jobs SET status = 'running'
       WHERE id IN (SELECT id FROM jobs WHERE status = 'pending'
                    ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 10)
       RETURNING *`);
    if (!rows.length) return;
    for (const job of rows) await handle(job);
  }
}

listener.on('notification', () => { void pollAndProcess(); });   // wake up early
setInterval(() => { void pollAndProcess(); }, 5_000);            // and never rely on it
```

The queue table is the truth; `NOTIFY` only removes latency. Lose every notification and
the system still drains, five seconds later. `FOR UPDATE SKIP LOCKED` is what makes
several workers safe — [`SELECT … FOR UPDATE`](../phase-9-api-crud/14-for-update.md) and
[Background work](/docs/nodejs/pages/phase-7-background-work/).

## Reconnecting

A listener is a long-lived connection, so it *will* be dropped eventually. It must
reconnect and **re-issue `LISTEN`** — the subscription dies with the session:

```js
async function startListener() {
  const client = new pg.Client({connectionString: process.env.DATABASE_URL});
  client.on('error', (err) => { log.error({err}); setTimeout(startListener, 1000); });
  client.on('end', () => setTimeout(startListener, 1000));
  await client.connect();
  await client.query('LISTEN jobs');
  client.on('notification', onNotification);
  void pollAndProcess();     // catch up on whatever was missed while disconnected
}
```

The `error` handler is mandatory for the usual reason
([Errors](05-errors.md)), and the catch-up poll on reconnect is what covers the gap.

## Reasonable uses

| Use | Fit |
|---|---|
| Waking a job worker instead of polling every 100 ms | Good |
| Invalidating an in-process cache across instances | Good |
| Telling a WebSocket server that a row changed | Good |
| Delivering the actual event data | No — 8000 bytes, no durability |
| A replacement for a queue | No — no persistence, no acknowledgement, no retry |

At high volume, note the whole thing is serialised through a shared queue on the server;
thousands of notifications per second is not what this is for. That is when a real broker
earns its keep.

## Trade-off

`LISTEN`/`NOTIFY` gives push-based, transaction-aware wake-ups with no extra
infrastructure — no Redis, no broker — and the delivery-on-commit semantics remove a real
race. It costs a dedicated connection per listener per process, an 8000-byte payload
ceiling, deduplication that makes counting meaningless, and no durability whatsoever.

That last point is the whole decision: acceptable when it is an optimisation over polling,
unacceptable when losing a message loses work.

## Gotchas

**Symptom:** `LISTEN` is issued but nothing ever arrives
**Cause:** It was issued through a pool — measured, notifications are lost.
**Fix:** A dedicated `pg.Client` with a `'notification'` handler.

**Symptom:** Notifications stop after a network blip
**Cause:** `LISTEN` is per session and the session ended.
**Fix:** Reconnect and re-issue `LISTEN`, then poll once to catch up.

**Symptom:** A listener sees an event but the row is not there
**Cause:** Notifying outside the transaction that writes the row.
**Fix:** `pg_notify` inside the same transaction — delivery is on commit, measured.

**Symptom:** Fewer notifications than events
**Cause:** Identical payloads in one transaction are folded — measured, 3 became 1.
**Fix:** Do not count them; re-read the source of truth.

**Symptom:** `22023 payload string too long`
**Cause:** Over 8000 bytes.
**Fix:** Send an id.

**Symptom:** Work is silently dropped during deploys
**Cause:** Treating notifications as a queue.
**Fix:** A queue table plus a periodic poll; notifications only reduce latency.

**Symptom:** The process crashes when the database restarts
**Cause:** No `'error'` handler on the listener client.
**Fix:** Attach one and reconnect from it.

## Interview questions

**★ Why can't you use a pool for `LISTEN`?**
Because the subscription belongs to the session and the handler is bound to that
connection. `pool.query('LISTEN …')` returns the connection to the pool immediately, so
nothing is listening — measured, notifications were lost. A listener needs a dedicated
`pg.Client` held open.

**★ When is a notification delivered relative to the transaction that sent it?**
On commit. Measured: zero delivered while the transaction was open, one after `COMMIT`,
and none at all after `ROLLBACK`. That is what lets a listener assume the row it is being
told about is actually visible.

**★ Can you use `LISTEN`/`NOTIFY` as a job queue?**
No. There is no persistence, no acknowledgement and no retry — a listener that is
disconnected misses those messages permanently, with no way to detect it. Use a queue
table as the source of truth and `NOTIFY` purely to wake workers sooner than the poll
interval would.

**★ Why might a listener receive fewer notifications than events sent?**
Identical channel/payload pairs within one transaction are deduplicated — measured, three
identical `NOTIFY`s produced one delivery. Notifications are hints, so re-read the
underlying table rather than counting them.

**What are the payload limits?**
8000 bytes, enforced with `22023 payload string too long`. Send an identifier and let the
listener fetch the row.

---

← [`pool.end`](13-pool-end.md) · Next → [pg-cursor streaming](15-cursors.md)
