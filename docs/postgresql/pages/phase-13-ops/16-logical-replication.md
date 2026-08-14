---
title: "Logical replication"
sidebar_label: "16 · Logical replication"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [logical replication](https://www.postgresql.org/docs/18/logical-replication.html),
> [restrictions](https://www.postgresql.org/docs/18/logical-replication-restrictions.html),
> [`CREATE PUBLICATION`](https://www.postgresql.org/docs/18/sql-createpublication.html).
> **Not sandbox-measured** — no console output on this page.

**Physical replication copies bytes; logical replication copies *changes*.** That
one difference produces every capability and every restriction below — including
the ability to replicate between different major versions, which is what makes it
the modern answer to a near-zero-downtime upgrade.

## How it differs from streaming replication

| | Physical ([08](./08-replication/README.md)) | **Logical** |
|---|---|---|
| Replicates | WAL bytes — the whole cluster | decoded row changes, per table |
| Granularity | all or nothing | chosen tables, chosen databases |
| Target version | **must match** | **can differ** — including across majors |
| Target writable | no, read-only | **yes** — it is a normal database |
| Target schema | identical by construction | you maintain it yourself |
| `wal_level` | `replica` | **`logical`** |
| Typical use | HA, failover, read replicas | upgrades, CDC, consolidation, subsets |

The target being **writable** is the property that unlocks most use cases and
also the one that causes trouble — nothing stops someone writing to a subscriber
and creating a conflict.

## The model

```sql
-- on the publisher
ALTER SYSTEM SET wal_level = 'logical';   -- requires a RESTART
CREATE PUBLICATION orders_pub FOR TABLE orders, order_items;

-- on the subscriber (schema must already exist)
CREATE SUBSCRIPTION orders_sub
  CONNECTION 'host=publisher dbname=app user=repl password=…'
  PUBLICATION orders_pub;
```

On creation, PostgreSQL takes a snapshot of the published tables, copies the data
to the subscriber, and then streams subsequent changes continuously, applying
them **in the same order** — so transactional consistency is preserved.

`FOR ALL TABLES` publishes everything; naming tables explicitly is the more
common and more controllable choice. PostgreSQL 15+ also supports row filters
(`WHERE`) and column lists on publications, which is how you replicate a subset
rather than a whole table.

## What is not replicated — read this before designing around it

The documented restrictions, and each one is a real constraint:

**1. DDL and schema are not replicated.** The initial schema must be copied
manually (`pg_dump --schema-only`), and **every subsequent schema change must be
applied to both sides yourself**. Logical replication errors when incoming data
does not fit the subscriber's schema, so the ordering of a migration across
publisher and subscriber becomes something you have to think about — the same
expand/contract discipline as
[12 · Zero-downtime DDL](./12-zero-downtime-ddl/README.md), now across two
databases.

**2. Sequence *data* is not replicated.** This one bites hard at cutover. Values
in `serial` or identity columns replicate as ordinary table data, but the
**sequence object itself** sits at its start value on the subscriber. Promote it
to primary without fixing that and the first insert collides with existing rows —
a flood of `23505` unique violations on a database that looked perfectly healthy.
The documented workaround is to copy the sequence values across, or set them
sufficiently high from the tables themselves, **as a cutover step**.

**3. Large objects are not replicated**, with no workaround other than storing
the data in normal tables.

**4. Only tables** — including partitioned tables. Views, materialized views and
foreign tables are not supported.

**5. Partitioned tables replicate from leaf partitions** by default, so the leaf
partitions must exist on the subscriber. `publish_via_partition_root` instead
replicates using the root table's identity, which is usually what you want when
the two sides are partitioned differently.

**6. `TRUNCATE` *is* replicated** — but it fails if the truncated tables have
foreign-key links to tables outside the subscription. Worth correcting, since
"TRUNCATE isn't replicated" is common folklore.

## Replica identity

To replicate an `UPDATE` or `DELETE`, the subscriber must identify *which* row
changed. That is the **replica identity**: a primary key by default, or a unique
index explicitly marked as such.

A table with no primary key and no replica identity will replicate `INSERT`s and
then **fail on the first `UPDATE` or `DELETE`**. The fallback,
`REPLICA IDENTITY FULL`, uses the whole row — and carries a documented
limitation: `UPDATE` and `DELETE` fail on the subscriber if the table contains
data types without a default B-tree or hash operator class, such as `point` or
`box`.

The practical rule, which is good schema advice anyway: **give every table a
primary key.** Phase 3 argues that on its own merits; logical replication turns
it into a hard requirement.

## What it is actually for

**Major version upgrades with minimal downtime.** Because publisher and
subscriber can run different major versions, you can build an 18 subscriber
against a 17 publisher, let it catch up, and cut over in the time it takes to
stop writes and move a connection string. This is the main reason a fullstack
developer meets logical replication at all, and it is
[17 · Major upgrades](./17-major-upgrades.md).

**Change data capture.** The logical decoding underneath is what feeds Debezium
and similar tools, streaming row changes into Kafka, a search index or a warehouse.
Note the alternative this corpus already covers: the
[transactional outbox](../phase-12-beyond-tables/18-transactional-outbox.md) is a
simpler CDC-shaped pattern that needs no replication slot and no additional
infrastructure — worth preferring when it suffices.

**Consolidation and subsets** — several databases into one reporting target, or
a subset of tables to a service that needs only those.

**What it is *not* for: high availability.** Use physical replication for
failover. Logical replication does not replicate schema, does not replicate
sequences, requires replica identities, and needs the subscriber's schema
maintained by hand — none of which you want in the path of an automatic failover.

## Replication slots, and the way this bites you

A subscription creates a **replication slot** on the publisher, which guarantees
WAL is retained until the subscriber has consumed it. That guarantee is exactly
what makes the subscriber safe from data loss, and exactly what makes an
abandoned slot dangerous:

**A slot whose subscriber is gone retains WAL forever, and the publisher's disk
fills.** This is one of the most common ways a healthy PostgreSQL instance runs
out of space, and the cause is invisible unless you look for it.

```sql
SELECT slot_name, active, restart_lsn,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained
  FROM pg_replication_slots
 ORDER BY retained DESC;
```

`active = false` with a large and growing `retained` is the signature. Two
defences: **alert on it**, and set `max_slot_wal_keep_size` so the server drops a
slot that falls too far behind — sacrificing that subscriber rather than the
whole instance. Dropping a slot invalidates its subscriber, which is the point:
you are choosing which thing breaks.

Clean up deliberately when a subscription is finished:

```sql
DROP SUBSCRIPTION orders_sub;    -- drops the remote slot too, when it can reach it
```

If the publisher is unreachable, the subscription must be disassociated from the
slot first (`ALTER SUBSCRIPTION … SET (slot_name = NONE)`) and the slot dropped
on the publisher by hand — otherwise you have just created the abandoned slot
described above.

## Monitoring

| View | Tells you |
|---|---|
| `pg_replication_slots` | retained WAL per slot, and whether it is active |
| `pg_stat_replication` | live sender state and lag ([08](./08-replication/README.md)) |
| `pg_stat_subscription` | on the subscriber: last message, latency |
| `pg_subscription_rel` | per-table sync state — `r` means ready |

`pg_subscription_rel` is the one to check after creating a subscription: initial
sync is per table, and a large table can still be copying while others are
already streaming.

## Trade-off

Logical replication trades **operational simplicity for flexibility**. Physical
replication is nearly automatic — identical cluster, no schema to maintain, no
replica identity to worry about — and gives you exactly one thing: a byte
identical copy of everything. Logical gives you cross-version, cross-schema,
per-table, writable targets, and asks you to maintain the schema by hand, to
manage sequences at cutover, to ensure primary keys exist, and to watch slots
that will fill a disk if neglected.

That trade is clearly worth it for a **bounded, purposeful** task — an upgrade, a
CDC feed, a one-way consolidation. It is usually not worth it for anything
open-ended, and it is the wrong tool for HA specifically because every one of its
manual steps is a thing that will not have been done when a failover happens at
4am.

The sharpest hidden cost is the slot. Physical replication's failure mode is
"the replica falls behind"; logical replication's is "the *publisher* runs out of
disk because a subscriber you forgot about still holds a slot" — a failure that
lands on the healthy side of the system.

## Gotchas

**Symptom:** `CREATE SUBSCRIPTION` fails or replicates nothing
**Cause:** `wal_level` is not `logical` — and changing it requires a **restart**.
**Fix:** Set it, restart, then create the subscription.

**Symptom:** Publisher disk fills with WAL
**Cause:** An inactive replication slot retaining WAL for a subscriber that is
gone.
**Fix:** Check `pg_replication_slots` for `active = false` with large retention.
Drop unused slots; set `max_slot_wal_keep_size` to bound the damage.

**Symptom:** Replication works, then fails on the first `UPDATE`
**Cause:** No replica identity — the subscriber cannot identify the row.
**Fix:** Add a primary key, or a unique index set as replica identity.
`REPLICA IDENTITY FULL` works but fails for types like `point`/`box` that lack a
default operator class.

**Symptom:** Unique violations immediately after cutover
**Cause:** **Sequences are not replicated** — they sit at their start value on
the subscriber.
**Fix:** Advance sequences as an explicit cutover step. This is the single most
common upgrade-day failure.

**Symptom:** Replication halts after a schema change
**Cause:** DDL is not replicated, and incoming data no longer fits the
subscriber's schema.
**Fix:** Apply schema changes to the subscriber **first** where they are
additive, and treat migrations as spanning both databases.

**Symptom:** A partitioned table will not replicate
**Cause:** By default replication originates from leaf partitions, which must
exist on the subscriber.
**Fix:** Create matching leaves, or publish with
`publish_via_partition_root = true`.

**Symptom:** `TRUNCATE` fails to replicate
**Cause:** It *is* replicated, but fails when truncated tables have foreign keys
to tables outside the subscription.
**Fix:** Include the related tables in the subscription, or avoid `TRUNCATE`
there.

## Interview questions

**★ What is the difference between physical and logical replication?**
Physical ships WAL bytes and produces a byte-identical, read-only copy of the
whole cluster on the same major version. Logical decodes WAL into row changes and
applies them per table to a **writable** target that may run a **different major
version**. Physical is for HA and failover; logical is for upgrades, CDC and
selective replication.

**★ What does logical replication not replicate?**
Schema and DDL, sequence data, and large objects; only tables are supported, not
views or materialized views. `TRUNCATE` *is* replicated, though it fails when
foreign keys point outside the subscription. The sequence gap is the one that
causes upgrade-day outages — unique violations on the first insert after cutover.

**★ Why is a replication slot dangerous?**
It guarantees WAL retention until the subscriber consumes it, so a slot whose
subscriber is gone retains WAL indefinitely and fills the **publisher's** disk.
Watch `pg_replication_slots` for inactive slots with large retention, and set
`max_slot_wal_keep_size` to bound it — choosing to break that subscriber rather
than the instance.

**★ What is replica identity and when do you need it?**
It is how the subscriber identifies which row an `UPDATE` or `DELETE` refers to —
the primary key by default, or a unique index marked for the purpose. Without it,
inserts replicate and the first update or delete fails. `REPLICA IDENTITY FULL`
is the fallback and breaks for types without a default B-tree or hash operator
class.

**Why not use logical replication for high availability?**
Because too much of it is manual: schema is not replicated, sequences are not
replicated, replica identities must exist, and the subscriber's schema is
maintained by hand. Every one of those is a step that will not have been done
when an unplanned failover occurs. Physical replication is the HA tool.

**When would you use the transactional outbox instead of CDC via logical
replication?**
When you control the writes and need events for your own system. The outbox needs
no replication slot, no `wal_level = logical`, and no extra infrastructure — it
is an ordinary table written in the same transaction as the data. Logical
decoding earns its keep when you need changes you did not write, or a
general-purpose stream for consumers you do not control.

---

← [Physical backup and PITR](./15-physical-backup/README.md) · Next → [Major version upgrades](17-major-upgrades.md)
