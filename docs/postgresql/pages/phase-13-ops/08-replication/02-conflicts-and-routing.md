---
title: "08.2 · Query conflicts, and routing reads safely"
sidebar_label: "02 · Conflicts & routing"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [Hot standby](https://www.postgresql.org/docs/18/hot-standby.html),
> [replication settings](https://www.postgresql.org/docs/18/runtime-config-replication.html),
> [recovery control functions](https://www.postgresql.org/docs/18/functions-admin.html).
> The conflict error text and its SQLSTATE were cross-checked against the
> PostgreSQL mailing-list archives. **Not sandbox-measured** — no console output
> on this page.

**A read-only query on a replica can be killed by a `VACUUM` that ran on the
primary.** That sentence sounds wrong the first time, and it is the second thing
replicas will do to you after stale reads.

## Why a read-only query gets cancelled

The standby replays everything the primary did — including cleanup. So consider:

1. A long `SELECT` starts on the standby and takes a snapshot.
2. On the **primary**, rows that snapshot needs become dead and `VACUUM` removes
   them. The primary is entitled to do this: it knows about no transaction that
   still needs them, because the standby's snapshot is not visible to it.
3. That cleanup arrives on the standby as WAL and must be replayed.
4. Replaying it would destroy row versions the running query still needs.

Something has to give — replay or the query — and by default the query loses:

```
ERROR:  canceling statement due to conflict with recovery
DETAIL:  User query might have needed to see row versions that must be removed.
```

The SQLSTATE is **`40001`** (`serialization_failure`) — the same class as a
serialisation failure on the primary, which is a genuinely useful signal: it
means **this error is retryable**. The query was not wrong; it was unlucky.

The docs list other conflict causes too — dropped tablespaces, a `DROP DATABASE`,
lock conflicts — and note that in some of those cases (`DROP DATABASE`, or locks
held by an idle transaction) the **whole session is terminated** rather than the
statement cancelled.

## The two knobs, and their real defaults

| Setting | Default | What it does |
|---|---|---|
| `max_standby_streaming_delay` | **30 s** | how long replay may be delayed for conflicting queries, when WAL arrives by streaming |
| `max_standby_archive_delay` | **30 s** | the same, when WAL is read from an archive |
| `hot_standby_feedback` | **off** | tells the primary which rows the standby still needs |

The delay settings are measured as elapsed time **since the WAL data was received
by the standby**, and `-1` means wait forever. They are a direct trade:

- **Raise them** → long queries survive, but the standby is allowed to fall
  further behind, which makes stale reads worse and slows failover.
- **Lower them** → the standby stays current, and long queries get cancelled.

Notice these are opposite ends of the same problem from
[chunk 01](01-lag-and-read-your-writes.md). You cannot have a replica that is
both always current *and* good at long analytical queries. That is the tension to
name in a design discussion, not a setting to tune your way out of.

**`hot_standby_feedback = on` attacks the cause instead.** The standby reports
its oldest snapshot back to the primary, so the primary's `VACUUM` refrains from
removing rows the standby still needs. Conflicts of the "early cleanup" kind
largely disappear.

The documented cost is precise and it lands **on the primary**: it "delays
cleanup of dead rows on the primary, potentially causing undesirable table
bloat." You have exported the standby's long-running query into the primary's
vacuum horizon. A reporting query that runs for an hour on the standby now holds
back cleanup on the primary for an hour — the same horizon problem Phase 11
covers for long transactions, arriving from a different direction.

That trade is usually right for a replica serving application reads (queries are
short, bloat impact is small) and often wrong for a replica serving hour-long
analytics (which is exactly where a higher `max_standby_streaming_delay`, and
accepting lag on that replica, fits better). **Different replicas can and should
have different settings** — that is the useful conclusion.

Note for anyone reading older material: `vacuum_defer_cleanup_age` was the other
lever here and it was **removed in PostgreSQL 16**. On PG18 the answer is
`hot_standby_feedback`.

## Routing reads: the decision, not the mechanism

Sending reads to a replica is easy. Deciding *which* reads is the design work,
and doing it by URL or by a global "read from replica" flag is what causes the
bug in chunk 01.

A workable default hierarchy:

| Read | Send to | Why |
|---|---|---|
| Anything in the same request as a write | **primary** | read-your-writes |
| Anything a user reads right after their own write | **primary** (briefly) | read-your-writes |
| Another user's data, lists, search, feeds | replica | staleness is acceptable and usually invisible |
| Reporting, analytics, exports | replica — ideally a dedicated one | long queries, conflict-prone |
| Anything used to make a write decision | **primary** | a stale read of a balance before a debit is a correctness bug |

That last row deserves emphasis, because it is the one that turns a cosmetic
problem into a real one. Reading a balance, a stock count or a permission from a
replica and then writing based on it means deciding from data you know may be
old. Even with locking on the primary, the decision was already made. **Reads
that feed writes belong on the primary**, full stop.

## Three ways to get read-your-writes

**1. Sticky-to-primary after a write.** The simplest thing that works: when a
user performs a write, mark their session and route their reads to the primary
for a short window — comfortably longer than typical `replay_lag`.

```js
const STICKY_MS = 5_000;   // > observed replay_lag, with margin

function poolFor(session, {isWrite}) {
  if (isWrite) { session.lastWriteAt = Date.now(); return primaryPool; }
  const recent = session.lastWriteAt && (Date.now() - session.lastWriteAt) < STICKY_MS;
  return recent ? primaryPool : replicaPool;
}
```

Cheap, needs no LSN plumbing, and degrades safely — if the window is too long you
merely send more traffic to the primary. Its weakness is that the window is a
guess, and lag spikes do not consult it.

**2. Wait for the LSN.** The precise version: capture the primary's LSN after the
write, and have the replica wait until it has replayed at least that far.

```js
// on the primary, after committing
const {rows: [{lsn}]} = await primary.query('SELECT pg_current_wal_lsn() AS lsn');

// on the replica, before the read
const {rows: [{caught_up}]} = await replica.query(
  'SELECT pg_last_wal_replay_lsn() >= $1::pg_lsn AS caught_up', [lsn]);
if (!caught_up) { /* fall back to the primary, or wait briefly and retry */ }
```

This is exact rather than heuristic — you are asking the replica a factual
question about its own progress. The costs are that the LSN must be carried
through your application (session, cookie or token), and that you need a fallback
policy for "not caught up yet", which realistically means going to the primary
anyway. Worth it when correctness matters more than simplicity.

**3. Do not read from a replica.** Genuinely the right answer more often than it
gets credit for. Replicas are for capacity and failover; if your read volume fits
comfortably on the primary, routing reads away buys you a class of bug in
exchange for headroom you do not need. Add replica reads when you have measured
that you need them.

## Node wiring

Two pools, chosen explicitly per query — never a global default:

```js
const primary = new pg.Pool({connectionString: process.env.DATABASE_URL});
const replica = new pg.Pool({connectionString: process.env.DATABASE_REPLICA_URL
                                              ?? process.env.DATABASE_URL});
```

Falling back to the primary URL when no replica is configured keeps development
and test environments working unchanged, which matters because it means the
routing code is exercised everywhere rather than only in production.

Guard rails worth adding:

- **Assert the roles at startup** — `SELECT pg_is_in_recovery()` should be
  `false` on `primary` and `true` on `replica`. After a failover these can
  silently swap, and the failure is otherwise discovered by a user's write.
- **Never open a transaction on the replica pool for a write path.** A `BEGIN`
  on a standby is legal; the `INSERT` inside it is not, and you will have done
  work before finding out.
- **Retry `40001` from the replica** by falling back to the primary. It is a
  documented, retryable cancellation, not a bug in your query.
- **Set a shorter `statement_timeout` on the replica pool** if it also serves
  interactive traffic, so a long query does not sit there accumulating conflict
  risk.

## Failover: what actually changes for you

A managed provider handles promotion. What you inherit is:

- **Connection strings may not change**, because the provider moves an endpoint.
  Your application may hold connections to a server that is now a replica, or one
  that has been fenced — so a connection error storm during failover is normal
  and your pool must reconnect rather than die.
- **The new primary may be missing the last few commits** if replication was
  asynchronous. That is the durability trade of chunk 01, arriving in the worst
  possible moment.
- **Replicas are read-only until promoted**, so every write fails with `25006`
  during the gap.

The practical requirement is that your service tolerates a brief window of
connection errors and read-only errors without needing a restart — which is a
property of your pool and retry configuration, not of the database.

## Trade-off

Query conflicts are the price of a replica being a *byte-identical, always
catching-up* copy: it must replay cleanup, and it cannot know what your query
needs. You choose where the pain lands.

`hot_standby_feedback = on` moves it to the primary as bloat. A high
`max_standby_streaming_delay` moves it to lag and slower failover. The default
(both off/30 s) leaves it on the query, as a retryable `40001`. There is no
setting that removes it — the honest framing is *which of these three can my
system best absorb*, and the answer legitimately differs between a replica
serving application reads and one serving analytics.

## Gotchas

**Symptom:** `ERROR: canceling statement due to conflict with recovery` (`40001`)
**Cause:** Replay needed to remove row versions the query still required — the
"early cleanup" conflict. Default `max_standby_streaming_delay` is 30 s.
**Fix:** Retry — `40001` is retryable by class. To reduce frequency, either
`hot_standby_feedback = on` (cost: bloat on the primary) or a higher
`max_standby_streaming_delay` (cost: more lag).

**Symptom:** The whole session is terminated, not just the query
**Cause:** Documented behaviour for some conflicts — `DROP DATABASE`, or lock
conflicts caused by an idle transaction on the standby.
**Fix:** Reconnect and retry; do not hold idle transactions open on a standby.

**Symptom:** Turning on `hot_standby_feedback` caused bloat on the primary
**Cause:** Working as documented — the primary now defers cleanup for rows the
standby's oldest snapshot still needs.
**Fix:** Expected. Keep standby queries short, or move long analytics to a
dedicated replica with feedback off and a large delay instead.

**Symptom:** After a failover, writes fail with `25006`
**Cause:** The application is connected to a server that is now a standby, or
promotion has not completed.
**Fix:** Check `pg_is_in_recovery()` on connect, reconnect on error, and make the
pool tolerate a window of failures rather than requiring a restart.

**Symptom:** A stale read caused a wrong write
**Cause:** A read that fed a write decision was routed to a replica.
**Fix:** Route reads-that-feed-writes to the primary unconditionally. This is a
correctness rule, not a performance preference.

**Symptom:** Everything is correct in staging, stale in production
**Cause:** Lag is near zero without traffic. The bug is load-dependent by nature.
**Fix:** Test with induced lag, and prefer the LSN-wait approach where
correctness matters — it does not depend on guessing a window.

## Interview questions

**★ Why would a read-only query on a replica be cancelled?**
Because the standby must replay the primary's cleanup, and replaying a `VACUUM`
that removes row versions a running query still needs forces a choice between
replay and the query. By default the query is cancelled after
`max_standby_streaming_delay` (30 s) with `40001`, which is retryable.

**★ What does `hot_standby_feedback` do, and what does it cost?**
The standby tells the primary which rows its oldest snapshot still needs, so
`VACUUM` on the primary defers removing them — largely eliminating early-cleanup
conflicts. The documented cost lands on the primary as delayed cleanup and
potential table bloat: you have exported the standby's long queries into the
primary's vacuum horizon.

**★ Which reads must not go to a replica?**
Anything in the same request as a write, anything a user reads immediately after
their own write, and — most importantly — **any read that feeds a write
decision**. Reading a balance or a stock count from a replica and then writing
based on it is a correctness bug even if the write itself is locked correctly.

**★ How do you implement read-your-writes with async replicas?**
Either stick that user's reads to the primary for a window longer than typical
`replay_lag` (simple, heuristic), or capture `pg_current_wal_lsn()` after the
write and require `pg_last_wal_replay_lsn() >= $1` on the replica before reading
(exact, needs the LSN carried through the session, needs a fallback). The third
option — do not read from replicas — is often correct.

**Is a `40001` from a replica the same as a serialisation failure?**
It is the same SQLSTATE class and the same practical handling: retry. The cause
differs — recovery conflict rather than concurrent update — but in both cases the
query was valid and the correct response is to run it again.

**What happens to your application during a failover?**
A window of connection errors while the endpoint moves, and `25006` on writes
until promotion completes. With asynchronous replication the new primary may be
missing the most recent commits. The requirement is that the pool reconnects and
the service tolerates the window without a restart.

---

← [Lag and read-your-writes](01-lag-and-read-your-writes.md) · Next → [Monitoring views](../09-monitoring/README.md)
