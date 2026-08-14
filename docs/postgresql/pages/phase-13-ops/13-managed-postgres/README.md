---
title: "Managed PostgreSQL"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against provider documentation
> ([Neon](https://neon.com/docs/connect/connection-pooling),
> [Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres),
> [AWS RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.PostgreSQL.CommonDBATasks.Parameters.html))
> and the **PostgreSQL 18** docs, cited inline. **Not sandbox-measured** — no
> console output in this topic.
> ⚠️ **Provider facts move faster than anything else in this corpus.** Checked
> 2026-08-13; re-verify before relying on a specific detail.

**This is what you actually run on.** The question this topic answers is not how
to administer a server — it is **which of the previous twelve topics are still
your job**.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[What you give up](01-what-you-give-up.md)** | no superuser, parameter groups instead of config files, extension allowlists — and the long list of things that are still yours |
| 02 | **[Providers and connecting](02-providers-and-connecting.md)** | direct vs pooled endpoints, the per-provider differences, serverless, and TLS |

## The two sentences that matter

**A managed provider removes the sysadmin work and none of the application
work.** Backups, replication, failover and patching become theirs. Missing
indexes, long transactions, connection exhaustion and locking migrations remain
yours — and those cause most incidents.

**The most common connection incident is the wrong endpoint.** Every provider
offers a direct and a pooled endpoint, differing by one token or one port, and
the wrong choice fails only under load.

## Quick reference

| Question | Answer |
|---|---|
| Serverless / edge | **pooled** endpoint, always |
| Migrations, DDL, `LISTEN` | **direct** endpoint |
| Changing a setting | parameter group, not `postgresql.conf` |
| Installing an extension | only from the provider's allowlist |
| `sslmode` | `verify-full` with the provider's CA |
| Backups | theirs — **verifying a restore is yours** |

## Phase gate

You are done here when you know which endpoint each part of your system uses and
why, you can change a database setting on your provider without guessing, and you
have checked that the extensions your design needs are actually available.

## Where this connects

- [Connection limits and PgBouncer](../07-pgbouncer/README.md) — the pooling
  semantics every managed pooler imposes.
- [Streaming replication replicas](../08-replication/README.md) — a reader
  endpoint is a routing decision with read-your-writes consequences.
- [Key configuration](../10-config-keys/README.md) — the settings a parameter
  group exposes, and the restart/reload distinction that still applies.
- [TLS to the database](../06-tls.md) — `verify-full`, over a network you do not
  control.
- [Row-level security](../14-rls/README.md) — the centre of the model if you build on
  Supabase.
- [Disaster drill](../18-disaster-drill.md) — the part of backups that does not
  become someone else's job.

---

← [Phase index](../README.md) · Start → [What you give up](01-what-you-give-up.md)
