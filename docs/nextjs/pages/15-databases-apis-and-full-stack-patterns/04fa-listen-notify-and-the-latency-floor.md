---
title: "LISTEN/NOTIFY removes the polling latency floor because a notification fires at COMMIT of the very transaction that enqueued the job — but it is a hint with no replay, so it can only ever be an optimisation on top of polling, never a replacement for it"
sidebar_label: "04fa · LISTEN/NOTIFY"
sidebar_position: 51
description: "The transactional delivery rule that makes NOTIFY perfect for an outbox, the dedicated session it requires, the 8000-byte payload limit, the notification queue that can fail every commit in the database, and why polling stays."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the PostgreSQL 18
> [`NOTIFY`](https://www.postgresql.org/docs/18/sql-notify.html) reference — every rule
> below is quoted verbatim from it — and the
> [node-postgres pooling guide](https://node-postgres.com/features/pooling).
> Documentation-verified, **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · `pg` 8.23.0 · Node 24.20.0.

**A polling worker's best-case latency is its poll interval, and [04f](04f-waking-the-worker.md)'s idle backoff makes that worse precisely when the queue has been quiet — which is exactly when the next job arrives to a five-second wait. `LISTEN`/`NOTIFY` removes that: the enqueueing transaction signals a channel, every listening session is woken, and the worker claims within milliseconds. It fits the transactional-outbox design perfectly, because PostgreSQL only delivers a notification if the transaction that sent it commits. But it has no durability, no replay, and no memory of a listener that was not connected — so a worker built on `NOTIFY` alone silently loses work every time it restarts. The correct architecture is polling for correctness, `NOTIFY` for latency, and this page is the seven rules that decide whether your listener is safe.**

## Rule 1 — delivery is tied to `COMMIT`, which is why it fits an outbox

> *"if a NOTIFY is executed inside a transaction, the notify events are not delivered until and unless the transaction is committed."*
> — [PostgreSQL 18 · `NOTIFY`](https://www.postgresql.org/docs/18/sql-notify.html)

This is the property that makes it correct rather than merely fast. In the transactional enqueue from [04c](04c-the-anatomy-of-a-job.md), the `UPDATE orders`, the `INSERT INTO jobs` and the `NOTIFY` are one transaction. If it rolls back, no notification is sent — so a worker is never woken for a job that does not exist, and never *not* woken for one that does. Compare that to publishing to Redis after `COMMIT`, which is the dual write this whole topic exists to avoid.

```sql
CREATE OR REPLACE FUNCTION jobs_notify_ready() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Payload is the KIND, not the row. See rule 4.
  PERFORM pg_notify('jobs_ready', NEW.kind);
  RETURN NULL;
END;
$$;

CREATE TRIGGER jobs_notify_ready
AFTER INSERT ON jobs
FOR EACH ROW
WHEN (NEW.status = 'pending' AND NEW.run_at <= now())
EXECUTE FUNCTION jobs_notify_ready();
```

The `WHEN` clause is deliberate: a job enqueued with a delay is not claimable yet, so waking a worker for it produces a claim query that returns nothing. Delayed jobs are the polling loop's responsibility, which is one of several reasons the polling loop does not go away.

> *"To send a notification you can also use the function `pg_notify(text, text)`."*

Use `pg_notify` rather than the `NOTIFY` statement whenever the channel name is computed, since `NOTIFY` takes an identifier and cannot be parameterised.

## Rule 2 — a listener needs a dedicated, long-lived session

`LISTEN` registers interest on **a session**. Issue it through a pool and you have registered a connection that the pool will hand to someone else, and released connections do not deliver notifications to you.

```ts
// lib/jobs/listener.ts
import { Client } from 'pg'

export function startListener(onReady: (kind: string) => void) {
  // A dedicated Client, NOT pool.query — and a DIRECT connection string,
  // because a transaction-mode pooler cannot hold a LISTEN registration.
  const client = new Client({ connectionString: process.env.DATABASE_URL_DIRECT })
  let closed = false

  async function connect(): Promise<void> {
    await client.connect()
    await client.query('LISTEN jobs_ready')
    // 🔴 Notifications sent while we were disconnected are GONE.
    // Always poll immediately after (re)subscribing.
    onReady('*')
  }

  client.on('notification', (msg) => onReady(msg.payload ?? '*'))
  client.on('error', (error) => {
    console.error('listener error, reconnecting', error)
    if (!closed) setTimeout(() => void connect().catch(() => {}), 1_000)
  })

  void connect()
  return () => { closed = true; return client.end() }
}
```

🔴 The pooler constraint is not negotiable. PgBouncer in transaction mode returns the server connection at `COMMIT`, so a `LISTEN` issued through it is registered on a connection you will not have next time. If your `DATABASE_URL` points at a pooled endpoint, the listener needs the direct one — see [01c · Transaction pooling and session state](01c-transaction-pooling-and-session-state.md) and [01b · The three kinds of pool](01b-the-three-kinds-of-pool.md).

## Rule 3 — notifications are delivered *between* transactions

> *"if a listening session receives a notification signal while it is within a transaction, the notification event will not be delivered to its connected client until just after the transaction is completed (either committed or aborted)… So notification events are only delivered between transactions. The upshot of this is that applications using NOTIFY for real-time signaling should try to keep their transactions short."*

So the listener session must not be doing work. Keep it doing exactly one thing — listening — and let the *worker pool* claim and process. A listener that also runs the claim query will be deaf for the duration of every claim.

## Rule 4 — the payload is small, and should be a key

> *"In the default configuration it must be shorter than 8000 bytes. (If binary data or large amounts of information need to be communicated, it's best to put it in a database table and send the key of the record.)"*

The manual tells you the design directly. Send `'order.paid'` or a job id; never send the payload. The row is already in the table — that is the whole point of a durable queue.

## Rule 5 — identical payloads collapse within a transaction

> *"If the same channel name is signaled multiple times with identical payload strings within the same transaction, only one instance of the notification event is delivered to listeners."*

This is why the trigger above sends the *kind* rather than the id: a bulk insert of five thousand `search.reindex` jobs in one transaction produces **one** notification, not five thousand. Send the id and you get five thousand wake-ups for work that one claim query would have taken in a batch. Coalescing for free, if you choose the payload correctly.

## Rule 6 — ordering is guaranteed, in a narrow and useful sense

> *"NOTIFY guarantees that notifications from the same transaction get delivered in the order they were sent. It is also guaranteed that messages from different transactions are delivered in the order in which the transactions committed."*

Note what this does *not* buy you: it orders the **wake-ups**, not the **work**. Your workers still claim with `SKIP LOCKED` and still process out of order ([04d](04d-postgres-as-a-queue-skip-locked.md)). Treat the ordering guarantee as useful for change-feed consumers, not as a way to sneak FIFO into the queue.

## Rule 7 — 🔴 the notification queue is shared, and a bad listener can break every writer

This is the failure mode that makes `NOTIFY` an operational concern rather than a convenience.

> *"There is a queue that holds notifications that have been sent but not yet processed by all listening sessions. If this queue becomes full, transactions calling NOTIFY will fail at commit. The queue is quite large (8GB in a standard installation)"*
> *"no cleanup can take place if a session executes LISTEN and then enters a transaction for a very long time."*

Read those two together. A listener that issues `LISTEN` and then leaves a transaction open — an `idle in transaction` session, a debugger paused on a breakpoint, an ORM that opened a transaction and never closed it — **blocks cleanup of the shared notification queue**. Every other transaction in the database that calls `NOTIFY` keeps filling it, and when it fills, *their commits fail*. A single stuck listener session takes down writes across the entire database, and the error surfaces on innocent transactions in unrelated code.

Mitigations, all of which you should have anyway:

```sql
-- On the listener's role: never let it sit in an open transaction.
ALTER ROLE queue_listener SET idle_in_transaction_session_timeout = '30s';

-- What to watch: listeners, and how long they have been in a transaction.
SELECT pid, state, now() - xact_start AS xact_age, query
  FROM pg_stat_activity
 WHERE state = 'idle in transaction'
 ORDER BY xact_age DESC NULLS LAST;
```

One more incompatibility from the same page, which matters if you use distributed transactions:

> *"A transaction that has executed NOTIFY cannot be prepared for two-phase commit."*

## Why polling stays

`NOTIFY` has **no durability and no replay**. It is a signal to sessions that are listening *at that instant*. Every one of these loses a wake-up permanently:

- The worker is restarting for a deploy.
- The listener connection dropped and has not reconnected yet.
- The job was enqueued with `run_at` in the future, so the trigger's `WHEN` clause correctly suppressed it — and nothing fires when it becomes due.
- A job returned to `pending` by the reaper or by a retry: no `INSERT` happened, so no trigger fired.

Those last two are the ones that catch people, because they are not failures — they are normal operation. **`NOTIFY` reduces latency; polling provides correctness.** Keep the loop from [04f](04f-waking-the-worker.md) exactly as it is, and let a notification simply cut the current sleep short:

```ts
// The listener does not claim. It interrupts the idle wait.
let wake: (() => void) | null = null
const waitForWorkOrTimeout = (ms: number) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(() => { wake = null; resolve() }, ms)
    wake = () => { clearTimeout(t); wake = null; resolve() }
  })

startListener(() => wake?.())
```

The loop's idle backoff can now be generous — thirty seconds rather than five — because `NOTIFY` covers the common case and the long sleep is only the safety net for the cases above.

## Gotchas

**★ Symptom: `LISTEN` succeeds and no notification is ever received.** Cause: the `LISTEN` was issued through a pool, so it registered on a connection that was returned to the pool immediately afterwards. Fix: a dedicated `Client` that is never released, on a direct (non-pooled) connection string:

```ts
const client = new Client({ connectionString: process.env.DATABASE_URL_DIRECT })
await client.connect()
await client.query('LISTEN jobs_ready')
```

**★ Symptom: notifications work in development and never arrive in production.** Cause: production's `DATABASE_URL` is a transaction-mode pooler endpoint, which cannot hold a session-level registration. Fix: give the listener the direct endpoint. This is the same class of problem as prepared statements and `SET` under a pooler — [01c](01c-transaction-pooling-and-session-state.md).

**★ Symptom: after a worker restart, jobs enqueued during the restart sit until the next poll.** Cause: `NOTIFY` has no replay — a notification sent while nobody was listening is gone. Fix: poll immediately after every `LISTEN`, including reconnects, and never let the idle backoff grow unbounded. The `onReady('*')` call inside `connect()` is that fix.

**★ Symptom: every commit in the database starts failing, and the error mentions the notification queue.** Cause: a listening session sitting `idle in transaction` prevents cleanup of the shared queue, which then fills — *"If this queue becomes full, transactions calling NOTIFY will fail at commit."* Fix: bound it at the role level and monitor for it:

```sql
ALTER ROLE queue_listener SET idle_in_transaction_session_timeout = '30s';
```

**★ Symptom: a bulk enqueue of 50,000 rows produces 50,000 wake-ups and the worker thrashes.** Cause: the trigger payload is the job id, so every row is a distinct payload and none of them collapse. Fix: make the payload the *kind*, so PostgreSQL's own rule applies — *"If the same channel name is signaled multiple times with identical payload strings within the same transaction, only one instance of the notification event is delivered."* One notification, one batch claim.

**Symptom: delayed jobs are always late by the full poll interval.** Cause: the trigger fires on `INSERT`, but a job with a future `run_at` is not claimable then, and nothing fires when it becomes due. This is correct behaviour, not a bug. Fix: accept it and size the idle backoff accordingly, or add a scheduler that notifies at the due time — but note that keeping a timer per delayed job is state you now have to make durable, which is usually a worse trade than a short poll.

**Symptom: retried jobs are late even though new jobs are instant.** Cause: a retry is an `UPDATE` back to `pending`, not an `INSERT`, so an insert-only trigger never fires. Fix: either extend the trigger to `AFTER UPDATE … WHEN (NEW.status = 'pending' AND OLD.status IS DISTINCT FROM 'pending')`, or leave it and rely on polling — which is the honest default, since a retry is by definition already delayed.

**Symptom: the listener stops receiving notifications after a network blip and never recovers.** Cause: the `error` handler logs and does nothing, so the client stays dead. Fix: reconnect with backoff and re-issue `LISTEN` on every reconnect — a `LISTEN` registration does not survive the connection that made it.

**Symptom: the worker processes its own writes in a loop.** Cause: the same process both enqueues and listens, and every enqueue wakes it to claim, including for jobs it just created and is about to handle anyway. Fix: it is usually harmless because the claim is cheap and idempotent, but if it matters, the notification carries the sender's identity — the manual notes the message includes *"the notifying session's server process PID"*, which `node-postgres` surfaces on the notification object, so a listener can ignore its own.

## Interview questions

**★ Why is `NOTIFY` a good fit for a transactional outbox specifically?**
Because delivery is bound to the commit: *"if a NOTIFY is executed inside a transaction, the notify events are not delivered until and unless the transaction is committed."* That means the signal cannot exist without the job row, and the job row cannot exist without the signal — the two facts share a commit, which is precisely the guarantee the dual write cannot give you. Publishing to Redis after `COMMIT` has a window where the commit succeeded and the publish did not; `NOTIFY` has no such window, because the database performs the send as part of committing. It is the same argument that makes the Postgres queue attractive in the first place, applied to the wake-up rather than the work.

**★ If `NOTIFY` is that good, why keep polling at all?**
Because it is a signal, not a message. There is no durability, no replay, and no record of a notification that nobody was listening for — so every worker restart, every dropped connection and every deploy is a window in which wake-ups are simply lost. Two entirely normal cases produce no notification at all: a job with a future `run_at`, which is not claimable when it is inserted, and a job returned to `pending` by a retry or the reaper, which is an `UPDATE` rather than an `INSERT`. Polling is what makes those correct. The right way to describe the architecture is that polling establishes an upper bound on latency and `NOTIFY` removes it in the common case; if you ever find yourself removing the poll loop, you have converted a latency optimisation into a correctness dependency.

**★ Why does the listener need a dedicated connection, and what breaks if it does not have one?**
Because `LISTEN` is session state. It registers the *connection* as interested in a channel, and a pooled connection is handed to whoever asks next — so the registration ends up on a session your worker no longer holds, and notifications are delivered to a client that is not listening for them. Under a transaction-mode pooler it is worse and more confusing, because the server connection is released at every `COMMIT`, so the registration can vanish between two statements that look adjacent in your code. The symptom is the worst kind: `LISTEN` returns successfully, nothing errors, and no notification ever arrives. The fix is a dedicated `Client` on a direct connection string that is never released for the process's lifetime.

**★ How can one badly-behaved listener break writes across an entire database?**
Through the shared notification queue. PostgreSQL holds sent-but-unprocessed notifications in a queue that is cleaned up only once every listening session has consumed past them, and the manual states that *"no cleanup can take place if a session executes LISTEN and then enters a transaction for a very long time."* So a listener stuck `idle in transaction` — a paused debugger, a leaked transaction, an ORM that forgot to close one — pins the cleanup horizon while every other transaction in the database keeps appending. When the queue fills, *"transactions calling NOTIFY will fail at commit"* — and those failures land on unrelated code that has nothing to do with the queue. Defend against it with `idle_in_transaction_session_timeout` on the listener's role and a monitor on `pg_stat_activity`.

**Why send the job kind as the notification payload rather than the job id?**
Two reasons, and the second is the interesting one. First, the payload is capped — *"it must be shorter than 8000 bytes"* — and the manual explicitly recommends sending a key rather than data, which you should follow on principle since the row is already in the table. Second, PostgreSQL collapses duplicate notifications within a transaction: *"If the same channel name is signaled multiple times with identical payload strings within the same transaction, only one instance of the notification event is delivered."* Sending the kind therefore turns a bulk insert of fifty thousand jobs into exactly one wake-up, while sending ids would produce fifty thousand — each triggering a claim query for work that a single batched claim would have picked up anyway. Choosing the payload is choosing your coalescing behaviour.

**Does `NOTIFY`'s ordering guarantee give you a FIFO queue?**
No, and conflating the two is a common mistake. The guarantee is about notifications: they arrive in send order within a transaction, and in commit order across transactions. That orders the *signals*, not the *work*. Your workers still claim with `SKIP LOCKED`, still run concurrently, and still retry — so jobs are processed out of order regardless of how tidily their wake-ups arrived. The ordering guarantee is genuinely useful when the notification itself is the payload of interest, as in a change feed driving an SSE stream ([03e](03e-pull-sources-and-back-pressure.md)), and irrelevant to queue semantics.

---

← [04f · Waking the worker](04f-waking-the-worker.md) · Next → [04g · Broker, database, or hosted queue](04g-broker-database-or-hosted-queue.md)
