---
title: "Local install with Podman/Docker"
sidebar_label: "07 · Local install"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

**For learning and app development, run PostgreSQL in a container** with a
published port, a volume for data, and a disposable password. Prefer that over
fighting a distro package on your laptop until you have a reason to go native.

## Why container-first

| Approach | Upside | Downside |
|---|---|---|
| **Container** | Pin major version (18), reset in one command, matches CI | Need Podman/Docker |
| **Native package** | Feels “real” | Version lag, upgrade mess, hard to reset cleanly |

This bible’s sandbox convention: **non-default host port** so nothing collides
with a system Postgres on 5432.

## Run PostgreSQL 18

```bash
podman run -d --name devbible-pg \
  -e POSTGRES_PASSWORD=devbible \
  -e POSTGRES_USER=devbible \
  -e POSTGRES_DB=devbible \
  -p 55432:5432 \
  docker.io/library/postgres:18-alpine
```

Wait until ready, then:

```console
$ psql -h 127.0.0.1 -p 55432 -U devbible -d devbible -c 'select version();'
                                         version
-----------------------------------------------------------------------------------------
 PostgreSQL 18.4 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
```

> Verified: 2026-08. Tear down: `podman rm -f devbible-pg`.

**Always connect with `127.0.0.1`, not `localhost`.** Node’s DNS order prefers
`::1`; IPv4 port publishes will fail with confusing errors if you use
`localhost`.

## From Node

```js
// ping.mjs
import pg from 'pg';

const pool = new pg.Pool({
  host: '127.0.0.1',
  port: 55432,
  user: 'devbible',
  password: 'devbible',
  database: 'devbible',
});

const {rows} = await pool.query('select 1 as ok');
console.log(rows[0]);
await pool.end();
```

```console
$ node ping.mjs
{ ok: 1 }
```

## Volumes and reset

Without a volume, deleting the container deletes data (fine for throwaway
learning). With a named volume, data survives container recreate — use that when
you care about a seed.

One-command mental model for tests: **destroy container → run again → migrate →
seed**.

## Trade-off

Containers hide filesystem layout (`PGDATA` inside the image). When you need
`pg_hba.conf` surgery for production-like auth, mount config or exec in — still
cheaper than reinstalling the OS package every major upgrade.

## Gotchas

**Symptom:** `connection refused` on 55432  
**Cause:** Container not running, still initializing, or wrong port  
**Fix:** `podman ps`; wait for “ready to accept connections” in logs

**Symptom:** `ECONNRESET` or refuse on `localhost`  
**Cause:** IPv6 vs IPv4 publish  
**Fix:** `127.0.0.1`

**Symptom:** Password auth failed after recreate  
**Cause:** Old volume with different `POSTGRES_PASSWORD`  
**Fix:** Remove volume or align password

## Interview questions

**★ Why run Postgres in Docker/Podman for local app work?**  
Reproducible version, easy reset, isolation from the host package manager.

**Why not publish only on 5432?**  
A host Postgres may already own 5432; non-default ports avoid collisions.

**Does the app care that Postgres is in a container?**  
Only about host, port, TLS, and credentials — the wire protocol is the same.

---

← [Roles](06-roles.md) · Next → [Connections and auth](08-connection-and-auth.md)
