---
title: "Disaster drill"
sidebar_label: "18 · Disaster drill"
sidebar_position: 18
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-13. This page is **synthesis** — it assembles the mechanisms
> established on earlier pages of this phase rather than introducing new ones.
> Where it cites a mechanism, that page carries the documentation reference.
> The one measured number quoted here (**restore at 4× the dump time**) is from
> `sandbox/pg-api/ex52-backup-restore.sh`,
> [04 · pg_dump and pg_restore](./04-pg-dump-restore/README.md).
> **Not sandbox-measured** — no console output on this page.

**An untested backup is not a backup. It is a belief.** This is the shortest page
in the phase and the one whose absence causes the worst outcomes, because every
mechanism in topics 04 and 15 is worthless if nobody has ever exercised it.

## The gap between having and being able

Three things are commonly conflated, and they are not the same:

| Claim | What it actually establishes |
|---|---|
| "We have backups" | a process runs and reports success |
| "We can restore" | someone has restored, at least once |
| "We can restore **in time**, **under pressure**" | you have measured it, with the people who would be doing it |

Almost every team can say the first. Far fewer can say the second. The third is
what an incident requires, and it is only obtainable by rehearsal.

The failures that a drill catches are mundane and would each be fatal at 3am:

- The backup has been failing for six weeks and nobody read the alert.
- The archive command returns zero on failure, so WAL was never stored
  ([15](./15-physical-backup/README.md)).
- The restore works but takes eleven hours, and the RTO everyone assumed was one.
- Nobody knows where the credentials for the backup store are.
- The restore succeeds and the application cannot connect, because the restored
  instance has a **new endpoint** ([13](./13-managed-postgres/README.md)).
- The snapshot restored fine, and the sequences were not advanced, so the first
  insert fails ([16](16-logical-replication.md)).
- The one person who knew the procedure has left.

None of these are exotic. All of them are found in an hour of deliberate
practice, and none are found by a monitoring check that says "backup: OK".

## What to actually drill

**Quarterly, or after any material change to the system.** Put it in the calendar,
because it never becomes the most urgent thing on its own.

### 1. Restore to a scratch environment

Not to production. Restore the most recent backup to a fresh instance and
**time it**.

```bash
# logical, the measured path
pg_restore -d scratch --clean --if-exists /backups/latest.dump
```

Then verify it is actually a database and not just a successful command:

```sql
SELECT count(*) FROM orders;                 -- expected magnitude?
SELECT max(created_at) FROM orders;          -- how fresh is it, really?
SELECT count(*) FROM pg_stat_user_tables WHERE n_live_tup > 0;
SELECT c.relname FROM pg_index i             -- did indexes come back?
  JOIN pg_class c ON c.oid = i.indexrelid WHERE NOT i.indisvalid;
```

That third and fourth query matter more than they look. `pg_restore -t` restoring
**zero indexes — including the primary key** — is a measured finding from this
corpus ([04 · Restoring](./04-pg-dump-restore/02-restoring.md)): indexes and
constraints are separate manifest items. A restore can succeed, contain all the
rows, and be unusably slow.

And `pg_restore` **continues after errors by default**, exiting non-zero while
carrying on — also measured. So "it printed some errors but finished" is not a
successful restore, and the exit code alone is not the check.

### 2. Practise point-in-time recovery

Pick a timestamp an hour ago and recover to it
([15](./15-physical-backup/README.md)). This exercises a different mechanism from a plain
restore, and it is the one you need for the most common real disaster — not a
server dying, but **a bad migration or a wrong `DELETE`**.

Leave `recovery_target_action` at its default `pause`, verify you landed where
intended, and only then promote. Timelines mean a wrong attempt can be repeated.

### 3. Time everything, and write the numbers down

| Step | Target | Measured |
|---|---|---|
| Detect the problem | | |
| Decide to restore | | |
| Locate and fetch the backup | | |
| Restore | | |
| Verify the data | | |
| Repoint the application | | |
| **Total (RTO)** | | |

The measured column is the deliverable. **If total RTO exceeds what the business
believes, you have found something more valuable than a working restore** — you
have found a false assumption, and you can fix it while nothing is on fire.

Expect the restore step to dominate: this corpus measured a logical restore at
**4× the dump time**, because indexes are rebuilt and constraints revalidated.
Parallelism helped less than expected — `-j 4` bought essentially nothing when
one table held 97% of the data, also measured. If that number is unacceptable,
the answer is a physical backup with PITR, not a faster `pg_restore`.

### 4. Rehearse the human parts

Who is called. Who decides to restore — that decision is often the longest step
and the least documented. Where the credentials are. What is communicated to
users, and by whom. What happens if it occurs at 3am on a public holiday and the
usual person is unreachable.

## The disasters worth planning for

Ranked by how likely they actually are, which is not the order people expect:

| Disaster | Likelihood | What saves you |
|---|---|---|
| **Bad migration or wrong `DELETE`/`UPDATE`** | **most common** | PITR to just before it ([15](./15-physical-backup/README.md)) |
| Application bug corrupting data slowly | common | PITR — needs a **long enough retention window** |
| Accidental `DROP TABLE` | occasional | PITR, or a logical dump |
| Disk full | occasional | monitoring; nothing degrades gracefully |
| Instance failure | occasional | replica failover ([08](./08-replication/README.md)) |
| Region outage | rare | cross-region replica or backup |
| Ransomware / credential compromise | rare, catastrophic | **offline or immutable** backups |

Two conclusions follow from that ranking.

**The most likely disaster is one you cause.** Not hardware. A migration, a
script run against the wrong environment, a `WHERE` clause that did not do what
its author expected. Replicas do not help — they faithfully replicate the
mistake, instantly. **Only backups with a time dimension help**, which is the
argument for PITR over "we have a replica".

**Retention length is a real decision.** The slow-corruption row is the one that
defeats short windows: a bug that corrupts a little data each day is discovered
weeks later, and a 7-day window means the last clean copy is gone. Choose the
window against "how long might something go unnoticed", not against what looks
reasonable on a pricing page.

## What to monitor, so the drill is not the discovery

- **Backup job success**, and — separately — **backup job recency**. A job that
  stopped running reports no failures at all.
- **`pg_stat_archiver.failed_count`** for WAL archiving
  ([15](./15-physical-backup/README.md)).
- **Backup size**, which should be roughly stable or growing. A sudden shrink
  means something is silently not being included.
- **Replication slot retention** ([16](16-logical-replication.md)) — an abandoned
  slot fills the publisher's disk.
- **Disk free space**, everywhere.

The first two are separate checks on purpose: the classic failure is a backup job
that has not run for six weeks while its "last run: success" status remains
green.

## The runbook

Write it down, keep it **outside** the systems it describes — an outage that
takes down your wiki should not take the runbook with it — and have someone who
did not write it follow it during the drill. That last detail is the test: a
runbook only its author can follow has not been tested.

Contents:

1. How to tell which disaster this is.
2. Who decides to restore, and how they are reached.
3. Exact commands, with real paths and real hostnames.
4. Where credentials live.
5. How to verify the restore — the specific queries, not "check the data".
6. How to repoint the application, including the endpoint change.
7. How to communicate, and to whom.
8. **Measured** timings from the last drill, and its date.

## Trade-off

Drills cost real time — a few hours per quarter, of people who have other work —
and they produce nothing visible when everything is fine. That is precisely why
they get skipped, and precisely why skipping them is dangerous: the cost is
certain and immediate, and the benefit is uncertain and deferred.

The honest framing is that a drill converts an **unknown** RTO into a **known**
one. It does not make recovery faster by itself; it tells you the truth about how
long it takes, and gives you the chance to disagree with that number while there
is still time to change it. Every other item in this phase — replicas, PITR,
archiving, managed backups — is an assumption until a drill turns it into a
measurement.

Scale it honestly, though. A quarterly full drill is right for a system where
downtime costs real money. A small internal tool needs one restore, once, timed
and written down — and that is still infinitely more than the common alternative
of never having tried.

## Gotchas

**Symptom:** Backups "succeed" for months, restore fails
**Cause:** Nothing ever tested the restore path; the job only verified that it
produced a file.
**Fix:** Restore on a schedule. Success of the backup job is not evidence about
the restore.

**Symptom:** The restore finished but the database is unusably slow
**Cause:** Indexes were not restored — `pg_restore -t` restored **zero** indexes,
including the primary key, in this corpus's measurement.
**Fix:** Verify indexes explicitly after restoring, and check for invalid ones.

**Symptom:** `pg_restore` printed errors and "finished"
**Cause:** It continues after errors by default, exiting non-zero but carrying
on — measured.
**Fix:** `--exit-on-error`, or `--clean --if-exists`, and read the output rather
than the exit code alone.

**Symptom:** Recovery took far longer than anyone expected
**Cause:** RTO was assumed, never measured. Restore was measured at 4× dump time,
and parallelism helped little with one dominant table.
**Fix:** Time it during a drill. If the number is unacceptable, change the
approach — physical backups and PITR, not a faster `pg_restore`.

**Symptom:** The data is intact and the application cannot reach it
**Cause:** A restored instance usually has a new endpoint.
**Fix:** Put the connection-string change in the runbook and rehearse it.

**Symptom:** Corruption discovered after the retention window has passed
**Cause:** The window was chosen by default rather than against how long a
problem might go unnoticed.
**Fix:** Set retention from that question. Keep periodic long-term dumps for the
slow-corruption case.

**Symptom:** Only one person can perform a recovery
**Cause:** The runbook exists in their head.
**Fix:** Have someone else run the drill from the written runbook. If they
cannot, the runbook is wrong.

## Interview questions

**★ Why is "we have backups" not enough?**
Because a backup job reporting success establishes only that a file was produced.
It says nothing about whether the file restores, how long a restore takes, whether
indexes and constraints come back, or whether anyone knows the procedure. Only a
rehearsed restore establishes those, and each of them has failed in practice —
including a measured case where restoring a single table brought back **zero**
indexes, primary key included.

**★ What is the most likely disaster, and what protects you from it?**
A bad migration or a wrong `DELETE`/`UPDATE` — a mistake you make, not hardware
failure. Replicas provide no protection, because they replicate the mistake
faithfully and immediately. Only point-in-time recovery helps, which is why PITR
and an adequate retention window matter more than replica count.

**★ How do you determine your real RTO?**
Measure it in a drill: detection, decision, locating the backup, restoring,
verifying, and repointing the application. The restore step usually dominates —
measured at 4× the dump time here, with parallelism buying little when one table
holds most of the data. If the total exceeds what the business assumes, that
discovery is the drill's most valuable output.

**★ What should a disaster runbook contain, and where should it live?**
Exact commands with real paths, who decides to restore and how they are reached,
where credentials live, the specific verification queries, how to repoint the
application, communication responsibilities, and the **measured** timings from
the last drill. It must live outside the systems it describes, and someone who
did not write it should be able to follow it — that is the actual test.

**How often should you drill, and what would you check between drills?**
Quarterly for anything where downtime costs money; at minimum once, timed and
written down, for anything else. Between drills, monitor backup job success
*and* recency separately — a job that stopped running reports no failures —
plus `pg_stat_archiver.failed_count`, backup size trend, replication slot
retention, and disk free space.

**Why does backup retention length deserve a deliberate decision?**
Because the failure it protects against is slow corruption discovered late. A bug
that damages a little data daily may surface weeks later, and a short window
means the last clean copy is already gone. Choose retention against how long a
problem might plausibly go unnoticed, not against a default.

---

← [Major version upgrades](17-major-upgrades.md) · Phase complete → [Phase index](README.md)
