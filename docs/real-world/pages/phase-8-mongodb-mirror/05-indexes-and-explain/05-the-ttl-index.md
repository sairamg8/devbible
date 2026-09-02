---
title: "The TTL index deleted a scheduled job, and replaced it with a background thread that runs once a minute and only on the primary"
sidebar_label: "7 · The TTL index"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [TTL Indexes](https://www.mongodb.com/docs/manual/core/index-ttl/)
> (*"The TTL background task runs every 60 seconds"*; *"Documents may remain in a
> collection during the period between the expiration of the document and the
> running of the background task"*; *"The TTL index does not guarantee that
> expired data is deleted immediately upon expiration"*; the single-field
> restriction; *"you cannot use `createIndex()` to change `expireAfterSeconds`"*),
> [`collMod`](https://www.mongodb.com/docs/manual/reference/command/collMod/).
> Counterpart:
> [01·05 — what stays a collection](../01-modeling-the-store/04-what-stays-a-collection.md),
> which made the decision; and Phase 2's scheduled jobs, which lost one.
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**This is the one index in the list that does something other than make a query
faster: it deletes documents. Phase 2 ran a scheduled sweep —
`delete from sessions where expires_at < now()` on a cron — and
[chapter 01·05](../01-modeling-the-store/04-what-stays-a-collection.md) replaced
it with one index declaration. That is a genuine simplification and it is not
free: the sweep ran when you told it to, and the TTL thread runs when it runs,
which turns "expired" from a property of the data into a property of the data
plus up to sixty seconds plus whatever the deleter is behind by. The restrictions
that make a TTL index silently not a TTL index, and how the background thread
actually spends its time, are [the next chunk](05b-ttl-restrictions-and-the-deleter.md).**

## The index

```js
await db.collection('sessions').createIndex(
  {expiresAt: 1}, {expireAfterSeconds: 0});
```

`expireAfterSeconds: 0` with an absolute date in the field is the "expire at a
specific clock time" form: the document is eligible for deletion zero seconds
after the instant stored in `expiresAt`. The alternative form —
`{createdAt: 1}, {expireAfterSeconds: 1209600}` — expires documents a fixed
duration after a timestamp, and would have been the wrong choice here because
session lifetime is a per-session decision (a "remember me" session is longer),
not a collection-wide constant.

The Manual: *"The `expireAfterSeconds` value must be between `0` and
`2147483647` inclusive."*

## What replaced what

| | Phase 2 | Phase 8 |
|---|---|---|
| Mechanism | a scheduled job | a background thread in `mongod` |
| Schedule | whatever cron says | *"runs every 60 seconds"*, not configurable per index |
| Where it runs | the API host that owns the schedule | the **primary** only |
| Deletes | one `deleteMany`, batched by the job | ordinary deletes, replicated to secondaries |
| Failure visibility | the job's logs and metrics | the server's, if anyone is looking |
| Code to maintain | a file | none |

The last row is the win and it is a real one — Phase 2's sweep is a file, a
schedule, a lock so two API instances do not run it simultaneously, and a metric
so you know it ran. All of that disappears.

The rows above it are the cost.

## The three sentences that define the guarantee

> *"The TTL background task runs every 60 seconds."*

> *"Documents may remain in a collection during the period between the expiration
> of the document and the running of the background task."*

> *"The TTL index does not guarantee that expired data is deleted immediately upon
> expiration."*

Read together: **an expired session may still be in the collection.** Up to sixty
seconds by the schedule, and longer if the thread is behind — the deletes are
ordinary write operations competing with everything else on the primary, so a
large backlog takes more than one pass to clear.

The security consequence is the one that matters and it is easy to state wrong.
It is **not** that an expired session can be used to authenticate — the auth
middleware compares `expiresAt` against the clock on every request, exactly as it
did in Phase 2, and a document's continued existence proves nothing. The TTL index
is a **garbage collector, not an authorisation check**, and any code that treats
"the session document exists" as "the session is valid" was already wrong before
the port.

What the delay actually costs is storage and a slightly larger index — which is
to say, almost nothing.

## Replication: the primary deletes, the secondaries follow

> *"On replica set members, the TTL background thread only deletes documents when
> a member is in the primary state. Secondary members replicate deletion
> operations from the primary."*

Three consequences.

**A secondary read can see an expired document that the primary has already
deleted**, until the delete replicates. Same class of staleness as any secondary
read, and it lands on the same rule: the auth check reads the clock, not the
existence.

**Nothing expires while there is no primary.** During an election the thread is
not running anywhere. Sessions accumulate and then clear in a burst afterwards.

**The deletes cost oplog space and replication bandwidth.** A collection expiring
a large number of documents produces a large number of oplog entries — worth
knowing because the oplog window is also what bounds change-stream resumability
(**chapter 06** *(not written yet)*), so a heavy TTL collection shortens the
window for everything else.

## Gotchas

**★ "Expired" is not "deleted".** Up to sixty seconds by the documented schedule,
and longer under load. Any logic that infers validity from existence is wrong;
the auth check must compare `expiresAt` to the clock, which it did in Phase 2 and
must continue to do here.

**★ Nothing expires while there is no primary.** The TTL thread only runs on a
primary, so an election pauses expiry everywhere. Sessions accumulate during the
gap and clear in a burst afterwards, which shows up as a delete spike in the
oplog rather than as a steady trickle.

**★ TTL deletes replicate, and they cost oplog.** A collection expiring a large
volume of documents generates a large volume of oplog entries. That shortens the
oplog window, which is the same window that bounds change-stream resumability —
so a chatty TTL collection quietly reduces how long a stopped consumer can be
resumed from.

## Interview questions

**★ What did the TTL index replace, and what is the honest cost of the
replacement?**
It replaced Phase 2's scheduled session sweep — a job file, a schedule, a lock so
two API instances do not run it at once, and a metric. All of that becomes one
index option, which is a genuine simplification. The cost is that the schedule is
no longer yours: the background task runs every sixty seconds, only on the
primary, and the Manual explicitly declines to guarantee prompt deletion. So
"expired" and "gone" stop being the same instant, and any code that conflated them
breaks.

**★ Can an expired session still authenticate a request?**
Not if the application is written correctly, and the TTL index does not change
that. The auth middleware compares `expiresAt` against the clock on every request;
the existence of the document proves nothing about its validity, before or after
the port. The TTL index is a garbage collector, not an authorisation mechanism.
Code that treated "the row exists" as "the session is valid" was already wrong in
Phase 2 — the TTL delay just makes the window in which it is wrong visible.

**★ Why does the TTL thread run only on the primary?**
Because deletes are writes, and in a replica set only the primary accepts writes.
Letting secondaries delete independently would let their data diverge from the
primary's. So the primary's thread deletes and the deletes replicate like any
other write — which means expiry pauses entirely during an election, and a
secondary can briefly serve a document the primary has already removed.

**★ What did the app lose in observability by replacing the job with an index?**
The sweep's metrics. Phase 2's job reported how many sessions it deleted each run,
which was a cheap continuous signal that authentication was behaving normally —
a sudden drop to zero meant something was wrong upstream. The TTL thread reports
to the server's diagnostic log, not to the application's health kit, so the app
now depends on a subsystem it no longer measures. Restoring the signal means
periodically counting expired-but-present sessions, which is a query, which is
back to having a scheduled job — so in practice the trade is accepted and the
signal is dropped.

---

← Prev: [Collation](04-collation-and-case.md) ·
Next → [TTL restrictions](05b-ttl-restrictions-and-the-deleter.md)
