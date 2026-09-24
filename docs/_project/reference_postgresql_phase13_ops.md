---
name: devbible-postgresql-phase13-ops
description: The measured dataset behind PostgreSQL Phase 13 (security, operations, production) — privileges, secrets, connections; what each ex5x script covers and the results that contradicted the obvious expectation
metadata:
  type: reference
---

# PostgreSQL Phase 13 — security, operations and production

Child of [[devbible-postgresql-rewrite-handoff]]. Open when writing or defending a
phase-13 page. Scripts live in `sandbox/pg-api/`; every console block on a phase-13
page comes from one of them.

## Scripts

| Script | Covers | Topics |
|---|---|---|
| `ex50-privileges.mjs` | roles, membership, GRANT/REVOKE, columns, ownership, default privileges, ACL reading | 01, 03 |
| `ex51-secrets.mjs` | where a credential leaks: pool object, `pg_stat_activity`, the server log, URL encoding | 02 |
| `ex52-backup-restore.sh` | `pg_dump` formats/sizes/timings, restore, parallel, snapshot consistency, dump locks | 04 |
| `ex53-hba-tls.sh` | `pg_hba.conf` rule matching and methods, TLS and the six sslmodes. **Own container** | 05, 06 |

⚠️ **`ex53` uses a dedicated container `devbible-pg-hba` on :55435** (`postgres:18-alpine`),
created 2026-08-13 so that editing `pg_hba.conf`/`postgresql.conf` never touches the shared
`devbible-pg` other sessions use. Its data dir is **`/var/lib/postgresql/18/docker`**, *not*
`/var/lib/postgresql/data`. The image has **no `openssl` binary** — the certificate is
generated on the host and `podman cp`-ed in. The script resets the container to a pristine
`pg_hba.conf` + `ssl off` at the start so every section reproduces.

## `ex51-secrets.mjs` — where a connection string actually leaks

1. **The password survives on the pool object.** `pool.options.password` is `undefined`
   (the trap), while `connectionString` still holds it — `JSON.stringify(pool.options)`
   and `util.inspect(pool, {depth:3})` both reproduce `sup3rs3cret`. Any structured
   logger or crash reporter that serialises config ships the credential.
2. **`pg`'s errors are clean.** Neither `28P01` nor `ECONNREFUSED` carries the password in
   `message`, `JSON.stringify` or `inspect` at depth 4. No scrubbing needed.
3. **`log_statement='all'` logs bound parameter values** as
   `DETAIL: Parameters: $1 = 'PARAM_…'` — `log_parameter_max_length` is **`-1`**
   (unlimited) by default. Parameters keep secrets out of the *statement text* and
   `pg_stat_activity` (which showed `$1`), **not** out of the log.
   `log_parameter_max_length_on_error` is `0`, so failed statements do not log values.
4. **`ALTER ROLE … PASSWORD 'x'` writes the plaintext to the server log** while
   `pg_authid` holds only `SCRAM-SHA-256$4096:…`. Use `\password` (client-side verifier).
5. `pg_stat_activity.query` shows a running statement's full text to any superuser or
   `pg_read_all_stats` member.
6. **URL encoding**: `@`, `:` and a space parse correctly (`pg-connection-string` splits on
   the last `@`); **`/` and `#` throw `ERR_INVALID_URL`**, and Node **redacts** the input as
   `*****REDACTED*****`. `application_name` is empty by default.

## `ex52-backup-restore.sh` — logical backup, on a 202 MB / 2M-row database

1. **Format sizes: plain 121 493 KB vs custom 16 314 KB — 7.5×**, tar 121 502 KB,
   directory 16 294 KB, all at ~2.4 s. **`-Fp | gzip` = 16 366 KB**, within 0.3 % of `-Fc`
   — so compression is *not* the reason to choose custom; the table of contents is.
2. **Restore costs 4× the dump: 10.29 s vs 2.55 s.** Index rebuild + constraint
   revalidation, not row transfer.
3. **`-j 4` bought nothing**: restore 10.06 s vs 10.29 s serial; parallel dump 2.33 vs
   2.53 s. Parallelism is **across items**, and one table held 97 % of the data. Also
   **`pg_dump -Fc -j 4` is a hard error** — parallel dump needs `-Fd`.
4. **A dump is one snapshot**: 1000 rows inserted mid-dump → source 2 001 000, restored
   copy 2 000 000, **0** of the concurrent inserts. `REPEATABLE READ` + shared snapshot.
5. **`pg_dump` holds `ACCESS SHARE` for its whole run**: the same `ALTER TABLE` took
   **0.04 s** alone and **2.00 s** during a 2.01 s dump. Reads/writes unaffected; DDL
   queues — and everything queues behind the DDL.
6. **Roles are not in a `pg_dump`**: 0 `CREATE ROLE`, 1 `GRANT` referencing `p13_reader`.
   `pg_dumpall --roles-only` produced 7. Also absent: tablespaces, other databases,
   `postgresql.conf`/`pg_hba.conf`, `ALTER SYSTEM` state.
7. **`pg_restore` continues after errors by default** (`relation already exists`, exit
   non-zero but keeps going) → `--exit-on-error`, or `--clean --if-exists`.
8. **`pg_restore -t audit_log` restored 0 indexes** — including the primary key. Indexes
   and constraints are separate manifest items.
9. `--no-owner --no-acl` → 0 `OWNER TO` and 0 `GRANT` lines.

## `ex53-hba-tls.sh` — pg_hba.conf and TLS

1. **First matching rule wins, with no fall-through.** The same two rules in opposite
   order gave opposite outcomes: `reject` first → `FATAL: pg_hba.conf rejects connection`;
   `scram` first → connected.
2. **Three distinct failure messages**: `no pg_hba.conf entry for host …` = no rule
   matched (address problem) · `pg_hba.conf rejects connection` = a `reject` rule matched
   (ordering problem) · `password authentication failed` = auth ran and failed.
   **A non-existent role reports the same message as a wrong password** (anti-enumeration).
3. **`trust` authenticated a deliberately wrong password.** The image's entrypoint appends
   `host all all all scram-sha-256` when `POSTGRES_HOST_AUTH_METHOD` is unset — setting it
   to `trust` replaces that line.
4. **An `md5` rule authenticates a SCRAM-stored password**; the reverse is what breaks.
   Storage format (`password_encryption`) and rule method are independent.
5. **A syntax error does not take the server down**: the reload is refused, old rules stay
   in force, connections keep working, and `pg_hba_file_rules.error` gives
   `line 5: invalid authentication method "not-a-method"`. The danger is a *restart*.
6. `pg_settings.context`: `hba_file`/`port`/`shared_buffers` = **postmaster** (restart),
   `ssl` = **sighup** (reload).
7. **`pg_reload_conf()` returns before the rules are in force** — a 0.4 s wait made every
   result lag one step behind its config. 1.5 s reproduced consistently.
8. **TLS: `sslmode=allow` gave `ssl=false` where `prefer` gave `ssl=true`** — `allow` tries
   plaintext *first*. `prefer` (the default) turned the connection into TLSv1.3
   `TLS_AES_256_GCM_SHA384` with **no client change** once the server had a certificate.
9. **`verify-ca` accepted a `CN=devbible-pg-hba` certificate while connecting to
   `127.0.0.1`; `verify-full` rejected it** — `server certificate for "devbible-pg-hba"
   does not match host name "127.0.0.1"`. That is exactly the difference between the two.
   Both need a root cert; libpq's default path is `~/.postgresql/root.crt`.
10. **`hostnossl … reject` + `hostssl … scram-sha-256` makes TLS mandatory server-side** —
    `sslmode=disable` was refused, `require` connected.

## `ex50-privileges.mjs` — the results worth keeping

Method: every denial is produced by connecting **as** the role with its own
`pg.Client` and running the statement — not described. Roles `p13_owner` (owns
schema `app`), `p13_app` (the application login), `p13_analyst` (a person),
`p13_ro` (`NOLOGIN` group), `p13_noinh` (`NOINHERIT`).

1. **A column grant is not a restriction — it is additive, and a group membership
   silently defeats it.** The *same* role was denied `SELECT ssn` (`42501`) and then
   allowed on a re-run, with the column grant untouched, because it had joined
   `p13_ro` which holds table-wide `SELECT`. Effective privilege is the union over
   inherited roles. `has_column_privilege` reported `true` at that point. **For a real
   boundary use a view, not a column grant.**
2. **`VACUUM` without `MAINTAIN` returns success and does nothing.** It emits
   `WARNING: permission denied to vacuum "m_probe", skipping it` and exits OK;
   `ANALYZE` behaves identically. `has_table_privilege(...,'MAINTAIN')` was `false` at
   the time. A nightly maintenance job that lost its grant never fails. `pg` discards
   the warning unless `client.on('notice', …)` is attached — the script buffers notices
   and prints them under the result line for exactly this measurement.
3. **`UPDATE` alone does not cover a real `UPDATE`.** With `SELECT` revoked but
   `UPDATE` still granted: `UPDATE … WHERE id = 1` → `42501`, `UPDATE … SET email =
   email` → `42501`, but `UPDATE … SET email = 'const'` with no `WHERE` → OK. Reads
   inside a write (WHERE, RETURNING, `SET x = x+1`) need `SELECT`.
4. **`proacl` is `NULL` on a new function and it is callable by everyone.** A role
   with no grant executed it; only after `REVOKE EXECUTE … FROM PUBLIC` did the ACL
   materialise and the call return `42501`. **An empty ACL means "built-in default",
   not "no access"** — owner-only for a table, `EXECUTE` to `PUBLIC` for a function.
5. **`GRANT … ON ALL TABLES` is a snapshot**: a table created seconds later was
   `42501`. `ALTER DEFAULT PRIVILEGES` fixed future tables but not the earlier one —
   **both statements are required**. The rule is keyed on the **creating** role
   (`pg_default_acl.defaclrole`); omitting `FOR ROLE` records it for whoever ran the
   statement, which is the usual reason it appears to do nothing.
6. **Identity columns need no sequence grant** (the sequence is owned by the column);
   `serial`'s `nextval()` default does. One more argument for `GENERATED … AS IDENTITY`.
7. **`DELETE` does not imply `TRUNCATE`** — separate privileges, so withholding
   `TRUNCATE` turns an injected `TRUNCATE` into `42501`.
8. **Schema `USAGE` is checked before the table grant**, and reports *permission denied
   for schema*. The noun in the message is the whole diagnosis: schema → `GRANT USAGE`;
   table → `GRANT <verb>`; **`must be owner of table`** → DDL, which has no `GRANT` form.
9. **Revoking a privilege from the owner "succeeds"** and the owner's next `SELECT` is
   denied — but it is not a boundary, since ownership carries the right to grant it
   back. Ownership ≠ privilege.
10. **`SELECT *` fails under a column grant** where the explicit list works; a
    **predicate on an ungranted column is a read** (`WHERE ssn = …` → `42501`); and
    **`count(*)` needs no column privilege** at all.
11. Role attributes, not grants: `CONNECTION LIMIT 1` → **`53300 too many connections
    for role`**; an expired `VALID UNTIL` → **`28P01 password authentication failed`**,
    indistinguishable from a wrong password. `VALID UNTIL` applies to the *password*, so
    certificate auth is unaffected.
12. `NOINHERIT` member of a group → `42501`; the same statement after `SET ROLE p13_ro`
    → OK. `pg_auth_members.inherit_option` is **per grant** (PG16+), so the role's own
    `rolinherit` is only the default.
13. `DROP ROLE` while it owns objects → **`2BP01`**, with no indication of which object.
    The sequence is `REASSIGN OWNED BY` → `DROP OWNED BY` → `DROP ROLE`, per database.
14. **PG15+ `public` schema**: `nspacl` is `{pg_database_owner=UC/pg_database_owner,
    =U/pg_database_owner}` — `PUBLIC` (the empty grantee) has `USAGE` only, so a
    non-owner `CREATE TABLE public.t` is `42501`. This is the "it worked before the
    upgrade" break.
15. `password_encryption` = `scram-sha-256`; `rolpassword` stores `SCRAM-SHA-256$…`, a
    verifier. The exposure is the **statement text**, not the storage.

ACL letters (from the measured `relacl`): `r` SELECT · `w` UPDATE · `a` INSERT ·
`d` DELETE · `D` TRUNCATE · `x` REFERENCES · `t` TRIGGER · `m` MAINTAIN. An entry
beginning `=` is a grant to `PUBLIC`.

## Pages written — 6 of 18 topics

| Topic | Layout | Lines |
|---|---|---|
| 01 roles/GRANT | **chunked** `01-roles-grant/` — 4 chunks + index | 1009 |
| 02 secrets | **chunked** `02-secrets/` — 2 chunks + index | 464 |
| 03 app role ≠ owner | single file | 225 |
| 04 pg_dump/restore | **chunked** `04-pg-dump-restore/` — 2 chunks + index | 584 |
| 05 pg_hba.conf | single file | 296 |
| 06 TLS | single file | 266 |

Inbound links were updated to the **directory form** (`roles-grant/`, `secrets/`,
`pg-dump-restore/`) in the phase README and in each neighbour's footer. One link was
written in the invalid `../roles-grant/04-…md` form (prefix dropped *and* filename kept)
and corrected to `../01-roles-grant/04-…md` — the same mistake the handoff records from
sessions 6, 8 and 9.

**Remaining: topics 07–18** (pgbouncer, replication, monitoring, config, logging,
zero-downtime DDL, managed, RLS, physical backup/PITR, logical replication, major
upgrades, disaster drill), then phase-0 page 11.

## ⏸ Stopped mid-topic-07 (2026-08-13) — read this before resuming

The user stopped this work to move the session to **JavaScript**; PG phase 13 is paused,
not abandoned. State on disk:

- **`ex54-pgbouncer.mjs` is written and its key sections are measured** (below), but
  **no page 07 exists yet** — `07-pgbouncer.md` is still the original stamp.
  The script's later sections (SET persistence, advisory locks, LISTEN/NOTIFY, named
  prepared statements, `SHOW POOLS`, latency, connect cost) **ran but their output was
  never captured** — the process was killed mid-run. Re-run before writing.
- **`ex54` takes ~3 minutes**: section 2 deliberately waits out the default 120 s
  `query_wait_timeout` instead of lowering it, because that default is the finding.

**Measured and safe to use:**
1. **40 clients, sequential queries → 1 server backend pid.** The same 40 clients with
   **all queries in flight at once → exactly 5** (`default_pool_size`), 0 failures.
   Idle clients hold no server connection in transaction mode.
2. **Open transactions beyond the pool size wait and then fail**: with pool size 5 and 7
   clients issuing `BEGIN`, five got pids in 1–2 ms; **clients 5 and 6 waited 120 204 ms
   and failed with `08P01 query_wait_timeout`**. This is why one idle-in-transaction bug
   takes down every other client behind the pool.
3. `pg` **re-emits pgbouncer's connection close as an `'error'` event**; without a handler
   on every client the process dies mid-script. The script now uses an `mkClient()` factory
   that always attaches one.

**Containers created for phase 13, all now STOPPED (start before re-running):**

| Container | Port | For | Notes |
|---|---|---|---|
| `devbible-pg-hba` | 55435 | `ex53` hba/TLS | data dir `/var/lib/postgresql/18/docker`; **no `openssl` in the image** |
| `devbible-pgbouncer` | 6432 | `ex54` | PgBouncer **1.25.2**, host network, transaction mode, pool 5, `MAX_PREPARED_STATEMENTS=0` |
| `devbible-pg-primary` | 55436 | topic 08 replication | started with `wal_level=replica`, **replica never created** |

Images **already pulled**: `edoburu/pgbouncer:latest`, `postgres:17-alpine` (the latter for
topic 17's `pg_upgrade`/cross-version path — nothing measured yet).

**Build state:** clean rebuild ran with **only 3 broken links, all TypeScript** (another
session's `phase-2-narrowing`). The one PG break was mine and is fixed:
`docs/postgresql/pages/phase-1-psql/12-who-and-privileges.md` pointed at
`../phase-13-ops/01-roles-grant.md` after that topic became a directory → now
`../phase-13-ops/roles-grant/`. **`src/data/progress.js` has NOT been touched for phase 13.**

Related: [[devbible-postgresql-rewrite-handoff]] · [[devbible-postgresql-sandbox]] ·
[[devbible-verify-your-own-measurements]]

## 📐 Depth-by-tier decision (user, 2026-08-13) — applies to topics 07–18

The user asked *"in production as a fullstack developer do I need to work on these?"*
The syllabus already tiers them, and the tiers match production relevance. **Agreed
scope: depth follows tier.**

**Understand tier (7) — full measured treatment.** These are the ones a PERN developer
actually touches:

| Topic | Why it earns full depth |
|---|---|
| 07 PgBouncer / connection limits | the most common Postgres incident in serverless/containerised Node; Supabase, Neon, RDS Proxy all front you with a pooler, and transaction mode silently breaks prepared statements |
| 09 monitoring · 11 logging | `pg_stat_statements` + `log_min_duration_statement` = how you find the slow query |
| 12 zero-downtime DDL | the migration that locks a live table is the classic self-inflicted outage |
| 10 config keys | needed to reason about what the managed provider set for you |
| 13 managed PostgreSQL | it is what you actually run on |
| 08 streaming replication | **only** the consumer half — replication **lag and read-your-writes**. You never configure one |

**Know tier (5) — measure what is observable locally, then cover as "what your provider
does for you and what still bites you".** 14 RLS (full-ish — it is Supabase's entire
authorization model), 15 physical backup/PITR, 16 logical replication, 17 major
upgrades, 18 disaster drill.

**This is not a licence to invent.** Every console block still comes from a script.
The change is *what gets measured*: `pg_stat_replication` fields, `pg_upgrade --check`
output, WAL file behaviour — not a hand-built HA cluster producing operational numbers
the reader will never reproduce. Where a number can only come from a provider, the page
says so instead of manufacturing one.

**Cost:** ~7–11 h instead of 12–20 h. It avoids ~6 h of building replication pairs and
running `pg_upgrade` 17→18 for numbers with no fullstack audience.
