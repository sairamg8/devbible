---
title: "The outbox relay and email worker"
sidebar_label: "04 · Outbox relay & email"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against PostgreSQL 17 documentation (`FOR UPDATE SKIP
> LOCKED`) and the Node v24 docs. Concept home:
> [Node — the transactional outbox](../../../nodejs/pages/phase-7-background-work/06-transactional-outbox.md),
> [job idempotency](../../../nodejs/pages/phase-7-background-work/05-job-idempotency.md),
> [graceful worker shutdown](../../../nodejs/pages/phase-7-background-work/11-graceful-shutdown.md).
> ⚠️ One ordering detail in this chapter (send **before** mark) deliberately
> corrects a defect currently flagged in the outbox concept page's sample code.

## The problem

Checkout [committed two outbox rows](../phase-1-database/06-the-checkout-transaction/01-the-transaction.md):
an email owed and a fulfilment webhook owed. This chapter is the worker that
pays those debts — with the delivery guarantee the spec demands
(*at-least-once, never lost*), retries that don't melt anything, and a
dead-letter state a human will actually read.

## The delivery contract, stated exactly

**A row is marked `processed_at` only after its side-effect succeeded.** The
two possible orderings fail differently, and only one is acceptable:

| Order | Crash between the two steps | Guarantee |
|---|---|---|
| mark → send | Row marked, email never sent — **lost forever** | at-most-once ❌ |
| **send → mark** | Email sent, row unmarked — **sent again** on restart | **at-least-once** ✅ |

Losing an order confirmation is an incident; sending it twice is a shrug.
Every consumer downstream is built for duplicates anyway (the
[idempotency concept](../../../nodejs/pages/phase-7-background-work/05-job-idempotency.md)):
the email carries the order id, and the fulfilment webhook (chapter 06) is
keyed so the partner deduplicates.

## Delivery state

The schema's `processed_at` alone can't express "failed, retry later". One
migration adds the delivery bookkeeping — on the outbox, not on a queue,
because the [architecture chose](../phase-0-the-app/02-architecture-and-data-model.md)
the table *as* the queue:

```sql
-- 019_outbox_delivery.sql
alter table outbox
  add column attempts        integer not null default 0,
  add column next_attempt_at timestamptz not null default now(),
  add column last_error      text;

drop index outbox_due_idx;
create index outbox_due_idx on outbox (next_attempt_at)
  where processed_at is null;
```

## The implementation

```js
// worker/relay.js — the drain loop; worker/main.js boots it (chapter 01)
import {setTimeout as sleep} from 'node:timers/promises';

const MAX_ATTEMPTS = 8;
const BATCH = 20;

export function createRelay({pool, handlers, signal}) {
  async function drainOnce() {
    // claim a batch: due, unprocessed, not dead — and invisible to other workers
    const {rows} = await pool.query(
      `select id, topic, payload, attempts
         from outbox
        where processed_at is null
          and attempts < $1
          and next_attempt_at <= now()
        order by created_at
        limit $2
          for update skip locked`,
      [MAX_ATTEMPTS, BATCH],
    );

    for (const row of rows) {
      const handler = handlers[row.topic];
      try {
        if (!handler) throw new Error(`no handler for topic ${row.topic}`);
        await handler(row.payload);                       // 1 — the side-effect
        await pool.query(                                 // 2 — then the mark
          `update outbox set processed_at = now() where id = $1`, [row.id],
        );
      } catch (err) {
        const backoffMs = Math.min(60_000 * 2 ** row.attempts, 3_600_000)
          * (0.5 + Math.random());                        // full-ish jitter
        await pool.query(
          `update outbox
              set attempts = attempts + 1,
                  last_error = $2,
                  next_attempt_at = now() + make_interval(secs => $3)
            where id = $1`,
          [row.id, String(err), Math.round(backoffMs / 1000)],
        );
      }
    }
    return rows.length;
  }

  return {
    async run() {
      while (!signal.aborted) {
        let n = 0;
        try {
          n = await drainOnce();
        } catch (err) {
          console.error(JSON.stringify({msg: 'drain failed', err: String(err)}));
        }
        if (n < BATCH) {
          // idle: sleep until the poll interval or a NOTIFY wake (ch. 1·12)
          await sleep(15_000, undefined, {signal}).catch(() => {});
        }
      }
    },
  };
}
```

```js
// worker/handlers/order-confirmed.js — the email side-effect
export function orderConfirmedHandler({mailer, orders}) {
  return async ({orderId, userId}) => {
    const order = await orders.byIdWithItems(orderId);
    await mailer.send({
      to: order.userEmail,
      template: 'order-confirmation',
      params: {orderId, items: order.items, totalCents: order.total_cents},
    });
  };
}
```

`mailer` is an interface (`send(message)`) with a dev implementation that
writes to a local maildir and a production SMTP one — the same
swap-behind-an-interface move as the
[upload service's object store](03-the-upload-service.md).

## What to notice

- **The claim query and its index are a pair.** `processed_at is null and
  attempts < 8 and next_attempt_at <= now()` runs against the partial index
  rebuilt in the migration — the [index chapter's rule](../phase-1-database/10-indexes.md)
  that poll query and index are documented together, honoured.
- **`for update skip locked`** makes a second worker instance safe today,
  not "when we scale": each claims disjoint rows, and rows claimed by a
  worker that dies unlock with its connection.
- **Failure is bookkeeping, not throwing.** A failed handler *updates the
  row* — attempts, error, next slot — and the loop moves on. The relay
  itself only logs; one poisoned row can't stall the queue.
- **`attempts >= 8` is the dead-letter state** — not a separate table, just
  rows the claim query stops selecting. The health kit (chapter 09) exposes
  `count(*) where attempts >= 8 and processed_at is null`; nonzero pages a
  human, and the ops CLI's `requeue` (chapter 10) zeroes attempts after the
  cause is fixed.
- **Shutdown is the boot chapter's `AbortSignal`.** The in-flight batch
  finishes (finish-the-job rule from the
  [worker shutdown concept](../../../nodejs/pages/phase-7-background-work/11-graceful-shutdown.md));
  the sleep aborts instantly; the loop exits before the pool closes.

## Gotchas

- **Symptom:** duplicate confirmation emails after a deploy. **Cause:** the
  worker was killed between send and mark — the at-least-once contract
  working exactly as designed. **Fix:** none needed for correctness; if
  duplicates are frequent, the graceful-shutdown drain isn't finishing its
  batch (watchdog too tight, batch too big) — tune those, don't reorder the
  send and the mark.
- **Symptom:** one topic's rows pile up while attempts climb on all of them
  together. **Cause:** the *dependency* is down (SMTP), and every retry slot
  re-fails the whole batch. **Fix:** the backoff already spreads retries;
  the missing piece is alerting on the oldest unprocessed row's age (chapter
  09 exports it) so a human learns before customers do.
- **Symptom:** `no handler for topic order.fulfilment` in `last_error` after
  a rename. **Cause:** topics are strings written at checkout time — rows
  written before the rename still carry the old string. **Fix:** handlers
  keep old topic names as aliases until the backlog drains; topic strings
  are append-only by convention.
- **Symptom:** two workers, and the same email went out twice *without* a
  crash. **Cause:** the handler committed the send, then the mark update
  failed (connection blip), then another worker claimed the now-unlocked
  row. Still at-least-once, just via a rarer path. **Fix:** as designed;
  if a side-effect ever becomes non-repeatable, *that handler* gets an
  idempotency ledger keyed on `(outbox.id)` — the concept page's pattern,
  applied per-handler, not globally.

## Interview questions

1. **★ Why send-then-mark and not mark-then-send?** Marking first turns a
   crash window into permanent loss — the next pass filters the row out and
   nobody ever knows. Sending first turns the same window into a duplicate,
   which downstream idempotency absorbs. Between "lost" and "twice",
   correct systems choose twice, every time.
2. **★ What does `skip locked` change about running two workers?** Without
   it, worker B either double-claims (plain select) or queues behind A's
   locks (`for update`), serializing the drain. With it, B's claim query
   simply doesn't see A's locked rows and takes the next batch — parallel
   consumption with no coordinator, and crash-release for free because
   locks die with connections.
3. **Why exponential backoff with jitter on a *table*, when there's no
   thundering herd of clients?** The herd is internal: one SMTP outage
   stamps hundreds of rows with the same `next_attempt_at`; without jitter
   they all become due in the same second, and the recovered dependency
   gets hammered into failing again. Jitter smears the retry wave; the
   [backoff concept](../../../nodejs/pages/phase-7-background-work/15-backoff-and-jitter.md)
   owns the math.
4. **Where would BullMQ/Redis earn its place over this table?** When
   delivery volume makes polling contention real, when jobs need priorities,
   rate limits or delayed fan-out the table would badly reinvent, or when
   consumers live outside this database's reach. The migration is additive:
   the relay's send-side becomes "enqueue to BullMQ", the outbox stays as
   the transactional front door, and the contract survives intact.

---

← Prev: [The upload service](03-the-upload-service.md) ·
Next → [Scheduled jobs](05-scheduled-jobs.md)
