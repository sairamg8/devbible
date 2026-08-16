---
title: "LISTEN/NOTIFY"
sidebar_label: "12 · LISTEN/NOTIFY"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against PostgreSQL 17 documentation — `NOTIFY`/`LISTEN`,
> `pg_notify`, payload limits, transactional delivery semantics — and the
> node-postgres notification API.

## The problem

Two places in the app currently *poll*: the worker asks the outbox for new
rows every second, and the API's cache (Phase 2) holds product data for its
TTL even when an admin just changed the price. Both are correct and both are
latent — `LISTEN`/`NOTIFY` is Postgres's built-in way to push instead, and
this chapter wires it as an *optimization on top of* the polling, never a
replacement.

## What NOTIFY actually guarantees — and doesn't

The semantics that decide the design:

- **Transactional send**: `NOTIFY` inside a transaction is delivered only on
  commit — a rolled-back checkout notifies nobody. This composes perfectly
  with the [outbox write](06-the-checkout-transaction/01-the-transaction.md).
- **At-most-once, connected-only delivery**: a listener that is down, or
  reconnecting, misses the notification *permanently*. There is no replay,
  no backlog, no acknowledgement.
- **Small payloads** (8000-byte default limit) on a named channel.

That second bullet is the whole architecture: **NOTIFY may carry a hint,
never the truth.** The truth stays in tables (`outbox` rows, product
versions); the notification only says "look now instead of on your next
poll". Miss it, and the poll catches up — latency degrades, correctness
doesn't.

## Wiring one: the outbox wake-up

The checkout transaction gains one line (after the outbox insert):

```sql
select pg_notify('outbox_wake', '');
```

The worker keeps its poll loop and adds a listener that *short-circuits the
sleep*:

```js
// worker/outbox-listen.js — composes with the Phase 2 relay's poll loop
import pg from 'pg';

export async function listenForWork(databaseUrl, wake) {
  const client = new pg.Client({connectionString: databaseUrl});
  await client.connect();
  await client.query('listen outbox_wake');
  client.on('notification', () => wake());     // payload ignored — it's a hint
  client.on('error', () => {                   // connection died: reconnect,
    setTimeout(() => listenForWork(databaseUrl, wake), 5000); // poll covers the gap
  });
  return () => client.end();
}
```

Two details carry the correctness: the listener uses a **dedicated
`pg.Client`** — `LISTEN` is session state, and a pooled connection would be
returned and reused out from under it (the same session-scoped reasoning as
[the migration lock](02-migrations.md)); and the `error` path just
reconnects, because the poll loop it accelerates is still running — the
design goal is that this file could be deleted and the system would only get
slower.

The result: outbox latency drops from worst-case one poll interval to
milliseconds, and the poll interval can stretch (1s → 15s), cutting idle
query load — that stretch is the actual payoff.

## The second consumer: cache invalidation

The same shape, different channel — product updates notify
`product_changed` with the id as payload, and each API instance's in-process
cache (Phase 2's TTL cache) evicts that key on notification. Every instance
listens; every instance evicts its own copy. The TTL stays, exactly as the
worker's poll stays: NOTIFY tightens staleness from "TTL seconds" to
"instantly, usually" — the TTL remains the guarantee.

## Where the pattern stops

Worth naming, because NOTIFY invites over-use: it is **not a job queue** (no
backlog, no retries — the outbox table is the queue; NOTIFY only wakes its
consumer), **not for browser push** (browsers speak SSE/WebSocket to the API
— [Node's SSE material](../../../nodejs/pages/phase-5-http-processes/10-streaming-and-sse.md)
owns that; a NOTIFY→SSE bridge is a reasonable later composition), and **not
cross-database** — it lives and dies with this one Postgres.

## Gotchas

- **Symptom:** notifications stop arriving after a database restart, and
  nobody notices for a day. **Cause:** the listener reconnected but forgot to
  re-issue `listen` — or didn't reconnect and nothing alerted, because the
  poll kept everything *working*. **Fix:** re-`listen` on every reconnect
  (the function above re-runs itself, re-issuing it), and the health kit
  (Phase 2) reports listener connection state so silent degradation is
  visible.
- **Symptom:** `payload string too long`. **Cause:** someone put the changed
  *row* in the payload instead of the id. **Fix:** the hint rule — ids and
  channel names only; the listener reads the truth from the table.
- **Symptom:** a notification for a change that isn't visible yet. **Cause:**
  impossible for `NOTIFY`-in-transaction (delivery follows commit) — the
  actual cause is the listener reading through a *different* connection that
  opened its snapshot before the commit, i.e. a repeatable-read session
  held open. **Fix:** listeners react by issuing a *new* read; they don't
  reuse long-lived transactions.

## Interview questions

1. **★ Why must NOTIFY carry hints rather than data?** Delivery is
   at-most-once to connected listeners only — any design where the payload
   *is* the message loses messages on every restart. Hint-plus-table keeps
   the durable truth in MVCC-land and demotes NOTIFY to a latency
   optimization, which its guarantees can actually support.
2. **★ Why does the listener need its own connection?** `LISTEN` registers
   on the *session*. A pooled connection goes back to the pool and gets
   handed to a query, which may be discarded, reset or multiplexed — the
   registration silently dies. Session-stateful features (LISTEN, advisory
   locks, temp tables) always pin a dedicated client.
3. **When would this app outgrow LISTEN/NOTIFY?** Multiple databases or a
   need for replayable events — both are the outbox relaying into a real
   broker (the [queue concept](../../../nodejs/pages/phase-7-background-work/02-job-queues.md)),
   with NOTIFY still waking the relay locally. The table-as-truth design
   makes that migration additive.

---

← Prev: [Soft delete and audit columns](11-soft-delete-and-audit.md) ·
Phase index: [Phase 1 — The database](README.md) ·
Next phase → **Phase 2 · Node services** *(not written yet)*
