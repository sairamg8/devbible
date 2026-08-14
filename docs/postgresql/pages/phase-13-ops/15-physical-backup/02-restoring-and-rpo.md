---
title: "15.2 · Restoring, timelines and RPO/RTO"
sidebar_label: "02 · Restoring & RPO/RTO"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [continuous archiving and PITR](https://www.postgresql.org/docs/18/continuous-archiving.html).
> **Not sandbox-measured** — no console output on this page.

**Restoring is the half nobody practises**, which is why
[18 · Disaster drill](../18-disaster-drill.md) exists as its own topic. This
chunk is the mechanism; that one is the discipline.

## Restoring to a point in time

The shape of the procedure, from the documentation:

```bash
# 1. stop the server
# 2. move the old data directory aside (do not delete it yet)
# 3. restore the base backup into place
# 4. configure recovery in postgresql.conf:
```

```conf
restore_command = 'cp /archive/%f %p'
recovery_target_time = '2026-08-13 09:14:59+00'
recovery_target_action = 'pause'      # default
```

```bash
# 5. touch recovery.signal in the data directory
# 6. start the server — recovery runs automatically
```

The settings that shape the outcome:

| Setting | Purpose |
|---|---|
| `recovery_target_time` | stop at a timestamp |
| `recovery_target_lsn` | stop at an exact WAL location |
| `recovery_target_name` | stop at a named point from `pg_create_restore_point()` |
| `recovery_target_xid` | stop at a transaction id |
| `recovery_target_inclusive` | **default `true`** — include the target transaction |
| `recovery_target_action` | **default `pause`** — `pause`, `promote` or `shutdown` |

**`recovery_target_action = 'pause'` is the default and it is the right one.**
Recovery stops and waits, letting you connect and confirm you landed where you
intended *before* promoting. If you overshot, you adjust the target and try again.
Promoting immediately forecloses that.

**`recovery.signal` versus `standby.signal`**: the first performs recovery and
then becomes a normal read-write server; the second keeps the server in
continuous recovery as a standby ([08 · Replicas](../08-replication/README.md)).

One documented constraint that catches people: **the recovery target must be
after the end of the base backup.** You cannot recover into the middle of a
backup that was in progress, so your oldest recoverable point is the end of your
oldest retained base backup — not its start.

## Timelines, and why they save you

When recovery completes, PostgreSQL creates a **new timeline** so that WAL
generated after recovery does not overwrite the original history. Timeline
history files track the branching.

The practical benefit is that **a wrong PITR attempt is not fatal.** Recover to
09:15, discover you needed 09:10, and the original timeline is still intact to
try again. `recovery_target_timeline` (default `latest`) selects which branch to
follow. This is a genuinely good piece of design and it is worth knowing about
before the night you need it.

## RPO and RTO — the numbers that are actually yours

Two acronyms worth using precisely, because they turn a vague "we have backups"
into a decision:

| | Question | Set by |
|---|---|---|
| **RPO** — recovery point objective | *how much data may we lose?* | archive frequency, `archive_timeout`, replication mode |
| **RTO** — recovery time objective | *how long may we be down?* | backup size, restore speed, whether anyone has practised |

With continuous archiving, RPO is roughly "the last archived WAL segment" —
seconds to minutes, and bounded by `archive_timeout` on a quiet system. With only
a nightly `pg_dump`, RPO is up to 24 hours. That is an enormous difference and it
should be a deliberate choice rather than an inherited default.

RTO is the one that is consistently underestimated, because it is the number
nobody measures until the day it matters. **A restore you have never timed is not
a recovery plan, it is a hope** — which is exactly the point of
[18 · Disaster drill](../18-disaster-drill.md).

## On a managed provider

You will not run `pg_basebackup` or write an `archive_command`. What you do
instead:

- **Choose the retention window**, and choose it against a real question: how
  long might a data-corrupting bug go unnoticed? A 7-day default does not cover a
  problem found on day 9.
- **Know your PITR granularity and floor** — providers typically offer
  second-level targets within the window.
- **Keep logical backups too.** Provider snapshots are cluster-level; extracting
  one table from one is awkward or impossible, and `pg_dump` remains the tool for
  "restore this table into staging".
- **Verify restores yourself.** The provider guarantees the backup exists. It
  does not guarantee your team knows the procedure or how long it takes.
- **Understand that a snapshot restore usually creates a new instance**, with a
  new endpoint — so recovery involves a connection-string change and an
  application restart, which belongs in the runbook.

## Trade-off

Point-in-time recovery trades **procedure for precision**. A logical restore is
one command; a PITR is a stopped server, a restored directory, a configured
target, a signal file and a verification step — considerably more to get right
under pressure, in exchange for landing on the exact second before the damage.

The deeper trade is that **all of this value is contingent on rehearsal**. Every
mechanism on this page works; none of them helps if the first time anyone
performs the sequence is during the outage. That makes the drill not an optional
extra but the step that converts the whole apparatus from a cost into a
capability — and it is why `recovery_target_action = 'pause'` and timelines
matter so much, since both exist to make a mistake recoverable rather than final.

## Gotchas

**Symptom:** Cannot recover to a time shortly after the base backup started
**Cause:** Documented — the target must be after the backup *ends*. You cannot
recover into the middle of a backup in progress.
**Fix:** Take base backups often enough that the floor is where you need it.

**Symptom:** PITR overshot and the data is still wrong
**Cause:** `recovery_target_action` was set to `promote`, ending recovery before
anyone verified it.
**Fix:** Leave it at the default `pause`, verify, then promote. Timelines mean a
failed attempt can be repeated with a different target.

**Symptom:** The server came up as a standby instead of read-write
**Cause:** `standby.signal` rather than `recovery.signal`.
**Fix:** `recovery.signal` for PITR that should end in a normal server.

**Symptom:** Recovery took far longer than anyone expected
**Cause:** RTO was assumed, never measured.
**Fix:** Time it during a drill ([18](../18-disaster-drill.md)). If the number is
unacceptable, that is a finding worth having before the incident.

**Symptom:** Corruption discovered after the retention window has passed
**Cause:** The window was chosen by default rather than against how long a
problem might go unnoticed.
**Fix:** Set retention from that question, and keep periodic long-term logical
dumps for the slow-corruption case.

**Symptom:** Data restored fine, application cannot reach it
**Cause:** A restored instance usually has a new endpoint.
**Fix:** Put the connection-string change in the runbook and rehearse it.

## Interview questions

**★ What are RPO and RTO, and what sets them?**
RPO is how much data you may lose — set by archiving frequency and
`archive_timeout`, seconds to minutes with continuous archiving versus up to a
day with nightly dumps. RTO is how long you may be down — set by database size,
restore speed and whether anyone has practised. RTO is the routinely
underestimated one, because it is never measured until it matters.

**★ Why should `recovery_target_action` stay at its default?**
The default is `pause`: recovery stops at the target and waits, so you can
connect and verify you landed at the right moment before promoting. Promoting
immediately removes that check. Combined with timelines — which preserve the
original history — a wrong attempt can simply be repeated with a different
target.

**★ What are timelines and why do they matter?**
When recovery completes, PostgreSQL starts a new timeline so post-recovery WAL
does not overwrite the original history, tracked by timeline history files. The
consequence is that a PITR to the wrong moment is not fatal — the original branch
survives and you can try again. `recovery_target_timeline` selects which branch
to follow.

**★ What is the oldest point you can recover to?**
The **end** of your oldest retained base backup, not its start — the
documentation is explicit that the target must be after the base backup ends,
because you cannot recover into the middle of a backup in progress. Base backup
frequency therefore sets your recovery floor.

**On a managed provider, what is left for you?**
Choosing the retention window against how long a bug might go unnoticed, keeping
logical backups for per-table recovery that cluster snapshots cannot provide,
knowing that a snapshot restore usually yields a new endpoint, and actually
testing the restore — the provider guarantees the backup exists, not that you can
use it.

---

← [Base backups and archiving](01-archiving.md) · Next → [Logical replication](../16-logical-replication.md)
