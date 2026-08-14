---
title: "Major version upgrades"
sidebar_label: "17 · Major upgrades"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [`pg_upgrade`](https://www.postgresql.org/docs/18/pgupgrade.html),
> [upgrading a cluster](https://www.postgresql.org/docs/18/upgrading.html).
> **Not sandbox-measured** — no console output on this page. A `postgres:17-alpine`
> image was pulled during an earlier session for a cross-version experiment that
> was **never run**; nothing here is measured, and no timing is claimed.

**Minor upgrades are routine; major upgrades are a project.** The dividing line
is the on-disk format: 18.3 → 18.4 is a restart, 17 → 18 is a data migration.

## Minor versus major

| | Minor (18.3 → 18.4) | Major (17 → 18) |
|---|---|---|
| On-disk format | unchanged | **changed** |
| Procedure | install binaries, restart | `pg_upgrade`, dump/restore, or logical replication |
| Downtime | seconds | minutes to hours, or near-zero with effort |
| Risk | low | real — behaviour and plans can change |
| Cadence | promptly; they are bug and security fixes | deliberately, once per release you care about |

**Apply minor upgrades promptly.** They contain security and data-corruption
fixes and require no migration. On a managed provider they arrive in your
maintenance window, which is the brief restart discussed in
[13 · Managed PostgreSQL](./13-managed-postgres/README.md).

Major versions receive roughly five years of support. Running past end-of-life
means no security fixes at all, which turns "we will upgrade eventually" into a
compliance problem.

## The three paths

### 1. `pg_dump` / `pg_restore`

Simplest, and the slowest. Dump from the old, restore into the new. Downtime is
the full dump plus restore — and this corpus measured a restore at **4× the dump
time** ([04 · pg_dump and pg_restore](./04-pg-dump-restore/README.md)), because
indexes are rebuilt and constraints revalidated.

Fine for small databases. On anything large it is hours, and it is the path most
often chosen by accident by someone who has not measured it.

Use the **new** version's `pg_dump` against the old server, which is the
supported direction.

### 2. `pg_upgrade`

The standard path. It migrates the catalog rather than the data, so it does not
rewrite rows.

```bash
pg_upgrade --check \
  -b /usr/lib/postgresql/17/bin -B /usr/lib/postgresql/18/bin \
  -d /var/lib/postgresql/17/main -D /var/lib/postgresql/18/main
```

**`--check` runs the validation alone**, and the documentation notes it works
"even if the old server is still running" — so it costs nothing and you should
run it days in advance, not on the night. It is the step that tells you about
incompatibilities while you still have time.

Modes, in increasing speed and decreasing recoverability:

| Mode | Behaviour | Risk |
|---|---|---|
| default (copy) | copies data files | slowest; old cluster stays intact |
| `--link` (`-k`) | hard-links files | **"you will not be able to access your old cluster once you start the new cluster"** — same filesystem required |
| `--swap` | moves directories, replaces catalog files | **fastest**, especially with many relations; "once the file transfer step begins, the old cluster will be destructively modified and therefore will no longer be safe to start" |

Read those warnings as written. `--link` and `--swap` trade your rollback path
for speed. If the upgrade goes wrong after the new cluster starts, the plan is
"restore from backup", not "start the old one" — so with either mode, **a
verified backup is a precondition, not a precaution**.

Requirements and steps that catch people:

- **Same architecture and compatible build options.** `pg_upgrade` checks binary
  compatibility including 32/64-bit. It is not a cross-platform tool.
- **Both servers stopped** during the upgrade itself.
- **Extension shared objects must be installed for the new version first** — and
  the documentation is explicit: *do not* run `CREATE EXTENSION` on the new
  cluster, "because these will be duplicated from the old cluster". This is the
  most common `pg_upgrade` mistake.
- **`pg_upgrade` generates scripts you must run afterwards**, and warns that "it
  is unsafe to access tables referenced in rebuild scripts until the rebuild
  scripts have run to completion".
- A documented security note worth repeating: upgrading "causes the destination
  to execute arbitrary code of the source superusers' choice" — so the source
  cluster must be trusted.

### 3. Logical replication

The near-zero-downtime path, and the reason
[16 · Logical replication](16-logical-replication.md) matters to a fullstack
developer at all: publisher and subscriber may run **different major versions**.

1. Build a new-version instance and copy the schema (`pg_dump --schema-only`).
2. Create a publication on the old, a subscription on the new.
3. Wait for initial sync and for lag to reach ~zero.
4. Stop writes briefly.
5. **Advance the sequences** — they are not replicated.
6. Point the application at the new instance.
7. Keep the old one until confident.

Downtime is steps 4–6: seconds to a couple of minutes. The cost is the
complexity, and the failure mode is step 5 — sequences left at their start values
produce a storm of `23505` unique violations on a database that looks perfectly
healthy. It is the single most common logical-replication cutover failure, and it
is entirely preventable by putting it in the runbook.

## Statistics after the upgrade — changed in PostgreSQL 18

Historically the standard warning was that `pg_upgrade` did **not** carry
optimizer statistics across, so the new cluster planned queries with no
statistics and was catastrophically slow until `ANALYZE` completed — an effect
frequently mistaken for "the new version is slower".

**PostgreSQL 18 changed this.** The documentation now states that unless
`--no-statistics` is given, `pg_upgrade` "will transfer most optimizer statistics
from the old cluster to the new cluster". That materially reduces the classic
post-upgrade cliff.

It is *most*, not all — statistics created explicitly with `CREATE STATISTICS`
(Phase 10's extended statistics) are among those not transferred. So the
post-upgrade step remains, in the form the docs give:

```bash
vacuumdb --all --analyze-in-stages --missing-stats-only
vacuumdb --all --analyze-only
```

`--analyze-in-stages` builds rough statistics first and refines them, so the
database becomes usable quickly rather than after a full analysis. Keep this in
the runbook regardless of version — and if you are reading older upgrade guides,
know that their dire warnings about statistics are describing pre-18 behaviour.

## What else changes across a major version

Beyond the mechanics, these are the things that produce surprises:

**Query plans can change.** A new planner is usually better on average and can be
worse for a specific query. This is the real argument for testing on a copy with
production-like data before committing.

**Defaults change between versions.** A parameter you never set may behave
differently. Diff `pg_settings` between old and new rather than assuming.

**Deprecated features are removed.** `vacuum_defer_cleanup_age` was removed in 16
([08 · Replicas](./08-replication/02-conflicts-and-routing.md)); the PG15 change
to `public` schema permissions broke applications that had relied on the old
default and is measured in
[01 · Roles and GRANT](./01-roles-grant/README.md). Read the release notes'
**"Migration to Version N"** section — that section exists precisely to list what
can break.

**`pg_stat_statements` `queryid` is not guaranteed stable across major
versions** ([09 · Monitoring](./09-monitoring/02-pg-stat-statements.md)), so
dashboards keyed on it break at the upgrade.

**Extensions need matching versions**, and an extension that has not kept up can
block the upgrade entirely. Check every extension before planning anything —
`SELECT * FROM pg_extension;` is the inventory.

## On a managed provider

The provider offers an in-place upgrade (usually `pg_upgrade` underneath) with a
maintenance window, or a blue/green style deployment using logical replication.
What remains yours:

- **Testing on a restored copy first.** Restore a snapshot to a new instance at
  the new version and run your application against it. This is the step that gets
  skipped and the one that finds the problems.
- **Checking extension availability** at the target version.
- **Deciding the timing** and accepting the window.
- **Watching plans afterwards** — `pg_stat_statements` before and after is the
  comparison worth having, provided you captured a baseline first.

## Trade-off

The three paths trade **downtime against complexity**, and the ordering is clean:
dump/restore is simple and slow, `pg_upgrade` is moderate on both, logical
replication is complex and nearly instantaneous. Choosing well is mostly a matter
of being honest about how much downtime you can actually take — and measuring the
dump/restore time before assuming it is unacceptable, because for a small
database it may be twenty minutes and not worth any additional machinery.

Within `pg_upgrade` there is a second trade that is easier to get wrong:
`--link` and `--swap` buy speed by **destroying your ability to start the old
cluster**. That is not a small thing to give up during a maintenance window, and
it converts your backup from a safety net into the only rollback path you have.
Take it deliberately, having verified the backup, or use copy mode and accept the
extra time.

The trade people miss entirely is **not upgrading**. Staying on an old version
feels free and is not: no security fixes past end-of-life, an ever-larger jump
when you finally move, and a growing set of features and planner improvements you
are paying for in performance without receiving.

## Gotchas

**Symptom:** `pg_upgrade` fails partway
**Cause:** Usually a missing extension shared object, or an incompatibility
`--check` would have caught.
**Fix:** Run `--check` days in advance — it works with the old server running.
Install the new version's extension `.so` files first.

**Symptom:** Duplicate extension objects on the new cluster
**Cause:** Running `CREATE EXTENSION` on the new cluster before `pg_upgrade`.
The docs say not to — the definitions come across from the old cluster.
**Fix:** Install the shared object files only; let `pg_upgrade` bring the schema.

**Symptom:** The old cluster will not start after a failed upgrade
**Cause:** `--link` or `--swap`. Both are documented as making the old cluster
unsafe or impossible to start once the new one has started or the transfer has
begun.
**Fix:** Restore from backup — which is why a verified backup is a precondition
for those modes.

**Symptom:** Unique violations immediately after a logical-replication cutover
**Cause:** Sequences are not replicated and sit at their start values.
**Fix:** Advance sequences as an explicit cutover step in the runbook.

**Symptom:** The new version seems much slower at first
**Cause:** Missing statistics. PG18 transfers *most* of them, but not all —
`CREATE STATISTICS` objects among them — and older versions transferred none.
**Fix:** `vacuumdb --all --analyze-in-stages` immediately after the upgrade, in
the runbook.

**Symptom:** One query regressed after an otherwise successful upgrade
**Cause:** A different planner made a different choice.
**Fix:** Compare `pg_stat_statements` before and after — which requires capturing
a baseline beforehand — and re-examine the plan with `EXPLAIN (ANALYZE, BUFFERS)`.

**Symptom:** Monitoring dashboards broke after the upgrade
**Cause:** `queryid` is not guaranteed stable across major versions.
**Fix:** Expected; key long-lived dashboards on normalised query text where
continuity matters.

## Interview questions

**★ What is the difference between a minor and a major upgrade?**
A minor upgrade (18.3 → 18.4) does not change the on-disk format: install the new
binaries and restart. A major upgrade (17 → 18) does, so the data must be
migrated with `pg_upgrade`, dump/restore, or logical replication. Minor upgrades
carry security fixes and should be applied promptly; major upgrades are projects.

**★ What are the options for a major upgrade and how do they differ?**
`pg_dump`/`pg_restore` — simplest, downtime is dump plus restore, and restore
measured at 4× the dump in this corpus. `pg_upgrade` — migrates the catalog
rather than the data, much faster, with `--link` and `--swap` trading away the
ability to restart the old cluster. Logical replication — near-zero downtime,
since publisher and subscriber may run different major versions, at the cost of
real complexity.

**★ What is the risk of `pg_upgrade --link`?**
Old and new clusters share data files via hard links, so once the new cluster
starts the old one is no longer usable — documented explicitly. `--swap` is
stronger still: the old cluster is destructively modified once the transfer
begins. Both require a verified backup as the only rollback path.

**★ What must you do immediately after a major upgrade?**
Run the post-upgrade scripts `pg_upgrade` generates, and refresh statistics with
`vacuumdb --all --analyze-in-stages`. PostgreSQL 18 transfers *most* optimizer
statistics — a change from earlier versions, where none came across and the new
cluster was very slow until `ANALYZE` finished — but not all, notably
`CREATE STATISTICS` objects.

**Why does a logical-replication cutover so often fail on the first insert?**
Because sequences are not replicated. Table data arrives, but the sequence objects
on the subscriber remain at their start values, so the first insert collides with
existing rows and produces `23505` unique violations. Advancing sequences must be
an explicit cutover step.

**What would you check before scheduling a major upgrade?**
Extension availability at the target version, the release notes' "Migration to
Version N" section for removed features and changed defaults, a diff of
`pg_settings`, and a full application test against a restored copy at the new
version. Also capture a `pg_stat_statements` baseline so plan regressions are
detectable afterwards.

---

← [Logical replication](16-logical-replication.md) · Next → [Disaster drill](18-disaster-drill.md)
