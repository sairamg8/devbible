---
title: "13.1 · What you give up"
sidebar_label: "01 · What you give up"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** and the
> providers' own documentation —
> [AWS RDS parameter groups](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.PostgreSQL.CommonDBATasks.Parameters.html),
> [RDS extensions](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.PostgreSQL.CommonDBATasks.Extensions.html).
> **Not sandbox-measured** — no console output on this page.
> ⚠️ **Provider behaviour changes.** Everything attributed to a specific provider
> was checked on **2026-08-13**; verify against their current documentation
> before relying on it.

**You are almost certainly running managed PostgreSQL.** RDS, Aurora, Cloud SQL,
Azure Database, Neon, Supabase, Render, Fly — for a fullstack developer, "we run
our own Postgres on a VM" is now the unusual case. So the practical question is
not how to administer a server; it is **which of the previous twelve topics you
are still responsible for.**

## You are not a superuser, and that is the root of it

On a managed instance you get a highly privileged role that is **not**
`SUPERUSER`. On RDS this is `rds_superuser`, documented plainly: "You don't have
access to the PostgreSQL superuser account." Other providers have equivalents
(`cloudsqlsuperuser`, and so on).

Most of what follows is a consequence of that single fact.

| You cannot | Because | What you do instead |
|---|---|---|
| Edit `postgresql.conf` | no filesystem access | a **parameter group** or provider console |
| Edit `pg_hba.conf` | same | provider firewall / network rules / IAM |
| `ALTER SYSTEM SET` (often blocked) | needs superuser on many providers | parameter group |
| Install arbitrary extensions | needs filesystem + superuser | choose from the provider's allowlist |
| Read the log files directly | no shell | provider log console / export |
| `COPY … FROM '/path'` (server-side) | no server filesystem | `\copy` (client-side), or S3 integrations |
| Create untrusted PL languages | superuser only | trusted languages only |
| Stop or restart at will | it is their process | a console action, on their terms |

Note what is *not* on that list: everything about schema design, indexing,
queries, transactions, privileges within your database, and connection
management. **The database-level skills from Phases 1–12 transfer completely.**
What you lose is the operating-system layer.

## Configuration goes through a parameter group

The RDS model is representative and worth understanding because the pattern
repeats across providers. From the AWS documentation:

> You can't change any values of the settings contained in the default RDS for
> PostgreSQL DB parameter groups. To change settings for any parameters, first
> create a custom DB parameter group. Then change the settings in that custom
> group, and then apply the custom parameter group to your RDS for PostgreSQL DB
> instance.

Two practical consequences:

**A fresh instance is on a default group you cannot edit.** The first
configuration change you ever make requires creating a custom group and
associating it — which is itself a change that may require a reboot. Do this
before you need it.

**The restart/reload distinction from
[10 · Config](../10-config-keys/02-planner-wal-and-changing.md) still applies**,
and the provider surfaces it as "static" vs "dynamic" parameters. A static
parameter needs an instance reboot; `pg_settings.context` still tells you which,
and `pending_restart` still tells you a change is staged. The vocabulary changed;
the mechanism did not.

## Extensions come from an allowlist

You can only install what the provider has vetted and shipped. `CREATE EXTENSION`
works for extensions on their list and fails for everything else — there is no
filesystem to place a new one on.

What this means in practice:

- **`pg_stat_statements` is essentially always available**, and on RDS it is the
  documented default for `shared_preload_libraries` from version 10 onward. So
  the single most valuable thing from
  [09 · Monitoring](../09-monitoring/02-pg-stat-statements.md) is available to
  you, usually already loaded.
- **`shared_preload_libraries` is set through the parameter group**, not a config
  file, and still requires a reboot. This is how you would add `auto_explain` or
  `pg_audit`.
- **Niche or new extensions may simply not be offered.** This is a real
  architectural constraint: if your design depends on an extension, check
  availability on your target provider *before* committing to it, not after.
  `pgvector`, `postgis`, `pg_cron` and `pglogical` are widely available; the long
  tail is not.

The relevant lesson from this corpus's own sandbox: **pgvector was absent from
the image** used for Phase 12, which is precisely the kind of surprise that
arrives at deploy time rather than design time.

## Backups, replication and HA are theirs

This is the good half of the trade, and it is substantial. The provider handles:

- automated backups and point-in-time recovery
  ([15 · Physical backup](../15-physical-backup/README.md))
- streaming replicas and failover
  ([08 · Replicas](../08-replication/README.md))
- minor version patching
- storage growth and the underlying hardware

You configure a retention window and a maintenance window, and it works. Building
that yourself is weeks of work and a permanent operational burden, and this is
the main reason managed PostgreSQL won.

**What remains yours** is more than people assume:

- **Testing that a restore actually works.** The provider guarantees a backup
  exists, not that your restore procedure is understood, timed and practised.
  That is [18 · Disaster drill](../18-disaster-drill.md), and it does not become
  someone else's job because the backup is automated.
- **Deciding the retention window.** A seven-day default does not survive a bug
  discovered after nine days.
- **Logical backups.** `pg_dump` remains yours for moving data between
  environments, and for the class of disaster the provider's snapshots do not
  cover — such as a migration that deleted the right rows for the wrong reason.
- **Major version upgrades.** Providers offer tooling, but the decision, the
  compatibility testing and the timing are yours
  ([17 · Major upgrades](../17-major-upgrades.md)).

## What is still entirely your problem

The blunt list, because it is the point of this page:

| Still yours | Where it is covered |
|---|---|
| Schema design, indexes, query plans | Phases 3, 5, 6, 10 |
| Connection count and pooling behaviour | [07](../07-pgbouncer/README.md) |
| `idle in transaction` and long transactions | [09](../09-monitoring/01-whats-happening-now.md), Phase 11 |
| Migrations that do not lock the table | [12](../12-zero-downtime-ddl/README.md) |
| Roles and least privilege **inside** the database | [01](../01-roles-grant/README.md) |
| Not leaking credentials | [02](../02-secrets/README.md) |
| Knowing whether a restore works | [18](../18-disaster-drill.md) |
| Reading `pg_stat_statements` | [09](../09-monitoring/02-pg-stat-statements.md) |

A managed provider removes the sysadmin work. **It removes none of the
application-side work, and application-side problems cause most incidents.** A
provider cannot fix a missing index, an unbounded transaction, or a migration
that takes an `ACCESS EXCLUSIVE` lock at peak traffic.

## The things that genuinely surprise people

**Superuser-only tricks stop working.** Anything you learned that begins "as
superuser…" — `LOAD`, certain `ALTER SYSTEM` calls, untrusted languages — is
unavailable. The `pg_read_all_stats` and `pg_monitor` predefined roles exist
precisely so monitoring does not need superuser, and they are the right tool on
managed instances.

**The maintenance window is a real outage.** Minor version patching restarts the
instance. It is short, and your application must survive it: pool reconnection,
retries, and no assumption that a connection lives forever. This is the same
requirement as failover in
[08 · Replicas](../08-replication/02-conflicts-and-routing.md).

**Storage can fill, and it is still your problem.** Autoscaling storage has
limits and costs. A stuck replication slot accumulating WAL, or unvacuumed bloat,
fills a disk on a managed instance exactly as on your own — and a full disk is an
outage with no graceful degradation.

**Costs scale with things you control.** Storage, I/O and connections are billed
in ways that reward the same practices this phase teaches: fewer connections,
less bloat, fewer unnecessary indexes, fewer full scans.

## Trade-off

Managed PostgreSQL trades **control for operational leverage**, and for almost
every application team the trade is correct: you get backups, replication,
failover and patching for a price far below what a competent DBA would cost, and
you give up filesystem access, superuser, arbitrary extensions and the ability to
tune anything the provider has not exposed.

The cost lands in three specific places. **Lock-in**, since the operational model
is provider-shaped even though the data is portable via `pg_dump`. **Ceiling
effects**, where an extension or a setting you need is simply unavailable and
there is no workaround. And **the illusion of delegation** — the belief that
because backups are automated, durability is handled; because failover is
automated, availability is handled; because the provider tunes the instance,
performance is handled. None of those follow, and the last one is where most
managed-PostgreSQL incidents actually come from.

## Gotchas

**Symptom:** `ALTER SYSTEM SET` fails with a permission error
**Cause:** You are not a superuser; RDS gives you `rds_superuser`, which is not
the same thing.
**Fix:** Use the provider's parameter group or console.

**Symptom:** A parameter change had no effect
**Cause:** Either it is a static parameter needing a reboot, or the instance is
still on the **default** parameter group, which cannot be edited.
**Fix:** Create and attach a custom parameter group; check
`pg_settings.pending_restart`.

**Symptom:** `CREATE EXTENSION` fails for an extension that exists upstream
**Cause:** Providers ship an allowlist; there is no filesystem to add to.
**Fix:** Check the provider's supported list **before** designing around an
extension.

**Symptom:** `COPY … FROM '/path/to/file.csv'` fails
**Cause:** Server-side `COPY` reads the *server's* filesystem, which you do not
have.
**Fix:** `\copy` in `psql` (client-side), or the provider's import integration.

**Symptom:** Brief connection errors at a predictable time each week
**Cause:** The maintenance window — minor patching restarts the instance.
**Fix:** Expected. Your pool must reconnect and your code must retry; do not
assume a connection lives forever.

**Symptom:** Disk filled on a managed instance
**Cause:** WAL retained by a stuck replication slot, or bloat from a long
transaction — the provider does not prevent either.
**Fix:** Monitor free space and slot lag; treat this as your responsibility.

## Interview questions

**★ What do you lose by using managed PostgreSQL?**
Superuser and the operating-system layer: no filesystem, so no editing
`postgresql.conf` or `pg_hba.conf`, no arbitrary extensions, no server-side
`COPY` from a path, and no restarting at will. Configuration moves to parameter
groups and extensions to an allowlist. Everything at the database level — schema,
indexes, queries, transactions, roles — is unchanged.

**★ If the provider handles backups, what is still your responsibility?**
Verifying that a **restore** works, and knowing how long it takes. The provider
guarantees a backup exists; it does not guarantee your team has practised the
recovery, chosen an adequate retention window, or covered the failure modes
snapshots miss — such as a bad migration that deleted data correctly, from the
database's point of view.

**★ Why does `ALTER SYSTEM SET` fail on RDS?**
Because the account you are given is `rds_superuser`, not a PostgreSQL
superuser — AWS documents that superuser access is not available. Configuration
goes through a custom DB parameter group instead, and the default group cannot be
edited at all.

**★ What causes most incidents on managed PostgreSQL?**
Application-side problems the provider cannot touch: missing indexes, long or
idle-in-transaction transactions, connection exhaustion, and migrations that take
heavy locks at peak traffic. Managed hosting removes the sysadmin work, not the
application work.

**How do you monitor a managed instance without superuser?**
The predefined roles `pg_monitor` and `pg_read_all_stats` exist for exactly this
— they grant the observability privileges without the rest of superuser.
`pg_stat_statements` is available on essentially every provider, and on RDS it is
the documented default in `shared_preload_libraries`.

**What should you check before choosing a provider?**
Extension availability against your design, the connection model and pooler,
whether the settings you need are exposed in the parameter group, PITR retention
limits, and the major-version upgrade path. Extensions are the constraint most
often discovered too late.

---

← [Phase index](../README.md) · Next → [The providers, and connecting](02-providers-and-connecting.md)
