---
title: "LISTEN/NOTIFY — push from the database"
sidebar_label: "13 · LISTEN/NOTIFY"
sidebar_position: 13
---

<span className="db-tier t-know">Should Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex49-notify-server-side.mjs`.

**`NOTIFY` lets the database tell a connected client that something happened,
without the client polling.** This page is the database side — emitting from
triggers, channel naming, and the queue. The driver side is
[Phase 7 · LISTEN/NOTIFY](../phase-7-pg-driver/14-listen-notify.md), which owns the
rules that a listener must be a `Client` not a pool, that delivery happens on
`COMMIT`, and that the payload caps at 8000 bytes.

## Emitting from a trigger

The useful pattern: the write itself announces the change, so no application code
has to remember to.

```sql
CREATE OR REPLACE FUNCTION n_announce() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('orders', json_build_object(
    'op', TG_OP, 'id', NEW.id, 'status', NEW.status)::text);
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER n_announce_t AFTER INSERT OR UPDATE ON n_orders
FOR EACH ROW EXECUTE FUNCTION n_announce();
```

```console
$ node ex49-notify-server-side.mjs
=== 1. a trigger that notifies on write ===
notifications received: 2
  channel=orders payload={"op" : "INSERT", "id" : 1, "status" : "open"}
  channel=orders payload={"op" : "UPDATE", "id" : 1, "status" : "shipped"}
```

`AFTER`, not `BEFORE` — you want to announce a row that exists, and `TG_OP` tells
the listener which operation it was. `PERFORM` rather than `SELECT` because
PL/pgSQL requires it when discarding a result.

## Row-level triggers notify per row

```console
=== 2. what a bulk write produces ===
rows inserted: 500 → notifications delivered: 500

same 500 rows via a STATEMENT trigger → notifications: 1
```

**One `INSERT` of 500 rows produced 500 notifications.** That is a firehose for a
bulk import, and each one wakes every listener.

A `FOR EACH STATEMENT` trigger produces **one**. The listener learns that something
changed and re-reads whatever it needs — which is usually the right design anyway,
because a notification is a hint, not data.

(Identical payloads within one transaction *are* folded — measured in
[Phase 7](../phase-7-pg-driver/14-listen-notify.md). Here the payloads differ by
`id`, so all 500 survived.)

## Channel names are identifiers

```console
=== 3. channel names are identifiers ===
channels received: ["myorders","myorders","myorders"]
↑ NOTIFY folds an unquoted channel name like any identifier;
  pg_notify() takes a string and does NOT fold it
after a computed channel name: [...,"tenant_7"]
```

Four sends, three received. `NOTIFY MyOrders` folded to `myorders` and arrived;
`pg_notify('MyOrders', ...)` did **not** fold and went to a channel nobody was
listening on.

| Form | Channel name | Can it be computed? |
|---|---|---|
| `NOTIFY chan, 'payload'` | an **identifier** — unquoted names fold to lower case | no |
| `pg_notify('chan', 'payload')` | a **string**, used exactly as given | **yes** |

**`pg_notify()` is the one to use from application or trigger code**, for two
reasons: the channel can be built at runtime — `pg_notify('tenant_' || $1, ...)`,
measured above — and it takes the payload as a parameter rather than requiring it
inline in the statement text.

`NOTIFY` is fine typed by hand in `psql`. Anywhere else, `pg_notify`.

## The queue

```console
=== 4. the notification queue ===
queue usage now: 0.000000 % of the 8 GB queue
2000 x 200-byte notifications, still uncommitted: 0.000000 %
after ROLLBACK                              : 0.000000 %
↑ ~400 kB against an 8 GB queue is far too small to move the needle.
  The queue is not a practical limit for normal use — it becomes one
  only when a listener stops consuming and writers keep notifying,
  at which point NOTIFY errors. Not demonstrated here: filling 8 GB.
```

Notifications wait in a shared 8 GB queue until every listening session has read
them. `pg_notification_queue_usage()` reports the fraction in use.

**Being explicit about what this measurement does and does not show:** 2000
notifications did not move the number, so the queue is not a constraint under
normal use. Filling 8 GB was not demonstrated. The failure mode is real but
requires a listener that has stopped consuming while writers keep going — at which
point the queue cannot be truncated past that listener's position, it fills, and
`NOTIFY` starts erroring for *everyone*.

The operational consequence: **a stuck listener is a database-wide problem, not
just its own.** Monitor `pg_notification_queue_usage()` if you rely on
`NOTIFY` in production.

## Nothing is durable

```console
=== 5. nothing is durable ===
payloads received: ["before","after"]
↑ the middle one is gone forever — there is no replay, no backlog
```

A notification sent while nobody was listening is **discarded**. Not queued, not
retried — gone. Reconnect after a network blip and you have a hole you cannot
detect, because there is no sequence number and no acknowledgement.

This is the property that decides where `LISTEN`/`NOTIFY` belongs:

**Reasonable:** cache invalidation (a missed message means a stale cache until the
next write — annoying, not wrong); waking a worker that would otherwise poll;
pushing a UI refresh hint. Everything where the message is a *hint* and the
receiver re-reads state.

**Not reasonable:** anything that must happen exactly once. A missed
`payment.completed` is money lost.

For that, the [transactional outbox](../phase-9-api-crud/11-idempotent-writes.md)
is the pattern: write the event to a table in the same transaction as the data,
have a worker read and mark it done. Durable, replayable, survives restarts.

**The two combine well.** Write to the outbox for durability and `NOTIFY` on the
same transaction so the worker wakes immediately instead of polling. If the
notification is lost, the worker's periodic poll still finds the row — the
notification is a latency optimisation, not the delivery mechanism.

## Trade-off

`LISTEN`/`NOTIFY` removes polling with no extra infrastructure: no Redis, no broker,
no queue to operate. Against Redis pub/sub it has one clear advantage — it is
**transactional**, so a notification is delivered only if the transaction that
produced it commits, and a rollback discards it. Redis cannot give you that, and
building it yourself means the dual-write problem.

The costs are real: at-most-once delivery, an 8000-byte payload, a listener that
must hold a dedicated connection, and a shared queue where one stuck consumer
affects everyone. It does not fan out across servers, does not persist, and has no
consumer groups or acknowledgements.

Use it as a **wake-up signal alongside durable state**, never as the record of what
happened.

## Gotchas

**Symptom:** A bulk write floods listeners
**Cause:** A `FOR EACH ROW` trigger notifies per row. Measured: 500 rows → 500
notifications.
**Fix:** A `FOR EACH STATEMENT` trigger — measured, 1 — and let the listener
re-read.

**Symptom:** `pg_notify` with a mixed-case channel is never received
**Cause:** `NOTIFY` folds unquoted identifiers, `pg_notify()` does not. `LISTEN
myorders` does not match `pg_notify('MyOrders', ...)`.
**Fix:** Use lower-case channel names consistently, and prefer `pg_notify`.

**Symptom:** Messages are missed after a reconnect
**Cause:** Notifications sent while nobody was listening are discarded. Measured:
the middle payload never arrived.
**Fix:** Re-read state on reconnect; use an outbox table if the event must not be
lost.

**Symptom:** `NOTIFY` starts failing across the whole database
**Cause:** The shared queue filled because a listener stopped consuming.
**Fix:** Monitor `pg_notification_queue_usage()`; make listeners fail fast rather
than hang.

**Symptom:** Notifications arrive late, in a batch
**Cause:** Delivery is on `COMMIT`; a long transaction holds them all — see
[Phase 7](../phase-7-pg-driver/14-listen-notify.md).
**Fix:** Shorter transactions.

**Symptom:** The payload is truncated or rejected
**Cause:** The 8000-byte limit.
**Fix:** Send an id, not the row. The listener reads what it needs.

## Interview questions

**★ How do you emit a notification when a row changes?**
An `AFTER INSERT OR UPDATE` trigger calling `pg_notify(channel, payload)`, so the
write itself announces the change and no application path can forget. Use `TG_OP`
to say which operation it was.

**★ What is the difference between `NOTIFY` and `pg_notify()`?**
`NOTIFY` takes the channel as an **identifier**, so an unquoted name folds to lower
case and it cannot be computed. `pg_notify()` takes a string used exactly as given
and allows a runtime channel — `pg_notify('tenant_' || $1, ...)`. Measured, a
mixed-case `pg_notify` went to a channel nobody was listening on.

**★ Why should a bulk write use a statement-level trigger?**
Because a row-level trigger notifies per row — measured, 500 rows produced 500
notifications, against 1 from a statement trigger. A notification should be a hint
that something changed, with the listener re-reading state.

**★ Is `LISTEN`/`NOTIFY` reliable?**
No — it is at-most-once. Measured: a notification sent while nobody was listening
was discarded entirely, with no replay and no way to detect the gap. Fine for cache
invalidation or waking a worker; unacceptable for anything that must happen exactly
once.

**★ How does it compare to Redis pub/sub?**
Its one real advantage is that it is **transactional**: the notification is
delivered only if the transaction commits, and a rollback discards it — which
avoids the dual-write problem. Otherwise Redis is better at fan-out, persistence
and consumer groups. Neither is durable enough for exactly-once.

**How do you combine it with an outbox?**
Write the event row and `NOTIFY` in the same transaction. The outbox gives
durability and replay; the notification just wakes the worker so it does not wait
for its next poll. Losing the notification costs latency, not the event.

---

← [PL/pgSQL functions](12-plpgsql.md) · Next → [Partitioning](14-partitioning.md)
