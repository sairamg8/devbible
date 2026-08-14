---
title: "08.1 · Lag, and why read-your-writes breaks"
sidebar_label: "01 · Lag & read-your-writes"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [`pg_stat_replication`](https://www.postgresql.org/docs/18/monitoring-stats.html),
> [recovery control functions](https://www.postgresql.org/docs/18/functions-admin.html),
> [replication settings](https://www.postgresql.org/docs/18/runtime-config-replication.html).
> **Not sandbox-measured** — this topic carries **no console output**. Building a
> replication pair to produce operational numbers a reader will never reproduce
> was explicitly out of scope; every value below is a documented default or a
> documented column meaning, cited inline.

**You are almost certainly never going to configure streaming replication — your
managed provider does it. You are very likely to be broken by it.** This topic is
the consumer half: what lag is, how to measure it, and why the bug it causes
looks like your application losing data.

## The bug, before the mechanism

A user updates their profile and is redirected to the profile page. The update
went to the primary. The read went to a replica. The replica is 40 ms behind.

The user sees their old name.

Nothing failed. No error was raised, no transaction rolled back, no constraint
was violated. The write is durable and correct on the primary, and the read is a
correct read *of a slightly older database*. This is **read-your-writes** — the
guarantee that a client sees its own writes — and asynchronous replication does
not provide it.

It is worth being precise about why this is so disorienting in practice: it is
load-dependent and it is invisible in development. With one database there is no
replica and no lag, so it cannot reproduce. In staging with no traffic, lag is
sub-millisecond and it reproduces perhaps one time in a thousand. In production
under load it becomes constant, and it arrives as bug reports saying "the save
button doesn't work" — for a save that worked.

## What a replica actually is

A physical streaming replica replays the primary's WAL — the same write-ahead log
that provides crash recovery. It is a **byte-identical copy** of the primary,
continuously catching up, and it is permanently in recovery. That last point has
consequences a reader should hold:

- It is **read-only.** Any write returns
  `cannot execute INSERT in a read-only transaction` (`25006`).
- It is **whole-cluster.** You cannot replicate one table or one database with
  physical replication; it is all or nothing. That is what
  [16 · Logical replication](../16-logical-replication.md) is for.
- It replays **everything**, including `VACUUM` and DDL — which is what causes
  the query conflicts in [chunk 02](02-conflicts-and-routing.md).

Ask any connection which side it is on:

```sql
SELECT pg_is_in_recovery();   -- true on a standby, false on a primary
```

That function returns `true` if recovery is still in progress. It is the cheapest
possible guard, and it belongs in your application's startup check — a service
that believes it is talking to the primary and is not will fail on its first
write, at whatever hour that happens to be.

## The four stages WAL passes through

Lag is not one number, because WAL arriving is not the same as WAL being visible.
`pg_stat_replication` on the **primary** has one row per connected standby, with
four LSN columns tracking exactly this progression:

| Column | Meaning |
|---|---|
| `sent_lsn` | last WAL location **sent** on this connection |
| `write_lsn` | last WAL location **written** to disk by the standby |
| `flush_lsn` | last WAL location **flushed** (durable) on the standby |
| `replay_lsn` | last WAL location **replayed into the database** on the standby |

The gap between `flush_lsn` and `replay_lsn` is the one that causes the bug
above. WAL can be safely on the standby's disk — so the data is not at risk —
and still not be visible to queries, because it has not been replayed yet.
**Durability and visibility are different things, and replication separates
them.**

Alongside those, three interval columns give lag as *time* rather than bytes:

| Column | Measures | Gauges the cost of |
|---|---|---|
| `write_lag` | primary flush → standby write | `synchronous_commit = remote_write` |
| `flush_lag` | primary flush → standby flush | `synchronous_commit = on` |
| `replay_lag` | primary flush → standby **replay** | `synchronous_commit = remote_apply` |

The docs are careful about what these mean, and the caveat matters: they are the
commit delay each synchronous level "was (or would have been)" introducing, and
for an asynchronous standby **`replay_lag` approximates the delay before recent
transactions became visible to queries.** That is your read-your-writes window,
named directly.

One documented subtlety worth knowing before you build a dashboard: when the
standby has fully caught up, the lag columns show the time taken to process the
most recent WAL location and then **revert to NULL** after a short period of
inactivity. NULL means "caught up and idle", not "broken" — an alert that treats
NULL as zero, or as an error, will be wrong in both directions.

## Measuring lag from each side

**On the primary** — bytes behind, per standby:

```sql
SELECT client_addr,
       state,
       pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS replay_bytes,
       write_lag, flush_lag, replay_lag
  FROM pg_stat_replication;
```

`pg_wal_lsn_diff(lsn1, lsn2)` returns the difference in bytes and is documented
as being for exactly this purpose.

**On the standby** — time behind, which is the number humans reason about:

```sql
SELECT now() - pg_last_xact_replay_timestamp() AS replication_delay,
       pg_last_wal_receive_lsn(),
       pg_last_wal_replay_lsn();
```

`pg_last_xact_replay_timestamp()` returns the timestamp of the last transaction
replayed — specifically, the time the commit record was generated *on the
primary*. So `now()` minus that value is how stale this replica's view is.

Two documented traps in that query:

- It returns **NULL** if no transactions have been replayed yet, or if the server
  was started normally without recovery. NULL is not zero.
- On a **completely idle** primary the value grows without bound, because no new
  transactions are being replayed. A quiet system looks maximally lagged. This is
  why `pg_last_wal_receive_lsn()` vs `pg_last_wal_replay_lsn()` — is there
  received WAL still unapplied? — is the better health signal, and the timestamp
  is the better *staleness* signal. They answer different questions and a good
  dashboard shows both.

## Choosing your guarantee: `synchronous_commit`

This is the knob that decides how much of the problem you have, and it is
settable **per transaction**, which is the part most people miss.

| Value | `COMMIT` returns once the transaction is… | Costs |
|---|---|---|
| `off` | written to the primary's WAL buffer — not yet durable | nothing; risks losing recent commits on a crash |
| `local` | flushed on the **primary** only | no replica wait |
| `remote_write` | written (not flushed) on the standby | one network round trip |
| `on` **(default)** | flushed on the primary; **and** flushed on a synchronous standby, if one is configured | round trip + standby fsync |
| `remote_apply` | **replayed and visible** on the synchronous standby | the most; gives read-your-writes on that standby |

Two things to be precise about, because they are routinely misstated:

**`synchronous_commit = on` does not by itself mean synchronous replication.**
Replication is synchronous only if `synchronous_standby_names` is configured on
the primary. Without it, `on` means "flushed locally", and all your replicas are
asynchronous no matter what this setting says.

**Only `remote_apply` gives read-your-writes on a replica**, because only it
waits for *replay* rather than for durability. `on` and `remote_write` guarantee
the data will survive; they do not guarantee you can read it.

The reason `remote_apply` is not simply the default everywhere: every commit now
waits for a network round trip *and* replay on the standby, so write latency rises
and — more dangerously — **a slow or unreachable synchronous standby stalls
commits on the primary.** Synchronous replication couples your write availability
to the replica's health. That is a real trade and it is why most systems run
asynchronous replicas and solve read-your-writes in the application instead,
which is [chunk 02](02-conflicts-and-routing.md).

Because it is per-transaction, you can spend the cost only where it is worth it:

```sql
BEGIN;
SET LOCAL synchronous_commit = 'remote_apply';   -- this transaction only
UPDATE accounts SET balance = balance - 100 WHERE id = $1;
COMMIT;
```

`SET LOCAL`, not `SET` — on a pooled connection plain `SET` leaks the setting to
the next transaction on that backend, which here would silently make unrelated
writes pay for a guarantee they did not ask for. That is the pooling rule from
[07 · PgBouncer](../07-pgbouncer/02-pool-modes.md), and it applies to every
session setting in this phase.

## Trade-off

Replicas trade **consistency for read capacity and availability**. You get
somewhere to send read traffic, a standby to fail over to, and a place to run
reporting queries that would otherwise disturb production — and you give up the
single-copy guarantee that a read always reflects every committed write.

The trade is usually worth taking, but the cost is not paid where you spend it.
You add a replica for performance, and the bill arrives as *correctness* bugs in
application code that was written when there was one database. Nothing warns you:
no error, no log line, just occasional stale reads under load.

`synchronous_commit = remote_apply` buys the guarantee back, and charges write
latency plus a hard coupling to standby health — a stalled synchronous standby
stalls commits. Most systems should not take that trade globally; they should
take it per-transaction where it matters, and route reads deliberately everywhere
else.

## Gotchas

**Symptom:** A user saves a change, is redirected, and sees the old value
**Cause:** The write went to the primary, the read to an asynchronous replica
that has not replayed it yet. `replay_lag` is documented as approximating exactly
this delay.
**Fix:** Route the read to the primary for that user for a short window, or wait
for the LSN — both in [chunk 02](02-conflicts-and-routing.md).

**Symptom:** `cannot execute INSERT in a read-only transaction` (`25006`)
**Cause:** A write reached a standby — usually a misrouted connection string or a
failover that did not update configuration.
**Fix:** Check `pg_is_in_recovery()` at startup and route writes explicitly.

**Symptom:** Replication lag alerts fire on an idle system
**Cause:** `now() - pg_last_xact_replay_timestamp()` grows without bound when no
transactions are being replayed — nothing is wrong.
**Fix:** Alert on received-vs-replayed LSN
(`pg_last_wal_receive_lsn()` vs `pg_last_wal_replay_lsn()`) for health, and use
the timestamp only for staleness.

**Symptom:** Lag columns show NULL and monitoring reports an error
**Cause:** Documented behaviour — the lag columns revert to NULL after a short
period once the standby is caught up and idle.
**Fix:** Treat NULL as "caught up", not as zero and not as a failure.

**Symptom:** `synchronous_commit = on` was set but reads are still stale
**Cause:** `on` waits for *flush*, not replay — and only waits for a standby at
all if `synchronous_standby_names` is configured. Durability is not visibility.
**Fix:** `remote_apply` if you need the guarantee at the database level, per
transaction with `SET LOCAL`.

**Symptom:** Commits on the primary hang after a replica problem
**Cause:** Synchronous replication — the primary waits for a standby that is slow
or gone.
**Fix:** This is the trade you accepted. Keep more than one candidate in
`synchronous_standby_names`, and understand that synchronous replication couples
write availability to replica health.

## Interview questions

**★ What is read-your-writes, and why do replicas break it?**
It is the guarantee that a client sees its own committed writes. Asynchronous
replicas replay WAL after the primary has committed, so a read routed to a
replica can land before the write is replayed and return the older value. Nothing
errors — it is a correct read of a slightly older database — which is why it
surfaces as "the save didn't work" rather than as a failure.

**★ How do you measure replication lag, and from which side?**
From the primary, `pg_stat_replication` gives per-standby LSNs and the
`write_lag`/`flush_lag`/`replay_lag` intervals. From the standby,
`now() - pg_last_xact_replay_timestamp()` gives staleness in time. Use both:
the timestamp misleads on an idle system, and the LSN comparison
(`pg_last_wal_receive_lsn()` vs `pg_last_wal_replay_lsn()`) is the better health
signal.

**★ Does `synchronous_commit = on` give you read-your-writes on a replica?**
No. It waits for WAL to be *flushed*, and only waits for a standby at all if
`synchronous_standby_names` is set. Data being durable on the standby is not the
same as it having been replayed and made visible. Only `remote_apply` waits for
replay.

**★ What is the difference between `flush_lsn` and `replay_lsn`?**
`flush_lsn` is how far WAL is durably on the standby's disk; `replay_lsn` is how
far it has been applied into the database and is therefore visible to queries.
The gap between them is precisely the window in which a read on the standby
returns stale data despite the write being safe.

**Why not just set `remote_apply` everywhere?**
Every commit would wait for a network round trip plus replay on the standby,
raising write latency, and a slow or unreachable synchronous standby would stall
commits on the primary — replication would become a write-availability
dependency. It is better applied per transaction with `SET LOCAL` where the
guarantee is actually needed.

**How does an application know whether it is connected to a primary or a replica?**
`SELECT pg_is_in_recovery()` — `true` on a standby. Worth checking at startup,
because otherwise a misrouted connection is discovered by the first write failing
with `25006`.

---

← [Phase index](../README.md) · Next → [Conflicts and routing](02-conflicts-and-routing.md)
