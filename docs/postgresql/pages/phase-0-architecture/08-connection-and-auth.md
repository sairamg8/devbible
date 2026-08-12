---
title: "Connection strings and authentication"
sidebar_label: "08 · Connection and auth"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

**Clients find PostgreSQL with a connection target (host, port, database, user)
and prove who they are (`pg_hba.conf` + auth method).** Node usually gets all of
that from one URI or a small set of `PG*` environment variables.

## Connection string (URI)

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

Example used on these pages:

```
postgresql://devbible:devbible@127.0.0.1:55432/devbible
```

Equivalent object form for `pg`:

```js
{
  host: '127.0.0.1',
  port: 55432,
  user: 'devbible',
  password: 'devbible',
  database: 'devbible',
}
```

## `PG*` environment variables

| Variable | Meaning |
|---|---|
| `PGHOST` | Host (use `127.0.0.1` for local containers) |
| `PGPORT` | Port |
| `PGUSER` | Role name |
| `PGPASSWORD` | Password (convenient; easy to leak in process lists) |
| `PGDATABASE` | Database name |
| `DATABASE_URL` | Common app convention (not read by `psql` by default) |

```console
$ PGPASSWORD=devbible psql -h 127.0.0.1 -p 55432 -U devbible -d devbible \
  -c "select current_user, inet_server_port();"
 current_user | inet_server_port
--------------+------------------
 devbible     |             5432
```

> Verified: 2026-08. `inet_server_port()` is **inside** the container (5432),
> not the published host port (55432).

## From Node

```js
// connect.mjs
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
    ?? 'postgresql://devbible:devbible@127.0.0.1:55432/devbible',
});

try {
  const {rows} = await pool.query(
    'select current_user as u, current_database() as db',
  );
  console.log(rows[0]);
} catch (err) {
  console.error('code', err.code); // e.g. 28P01 invalid_password
  throw err;
} finally {
  await pool.end();
}
```

```console
$ node connect.mjs
{ u: 'devbible', db: 'devbible' }
```

Wrong password (illustration):

```console
$ DATABASE_URL=postgresql://devbible:wrong@127.0.0.1:55432/devbible node connect.mjs
code 28P01
```

SQLSTATE **`28P01`** is what you map when diagnosing auth failures from Node.

## Auth modes (mental model)

`pg_hba.conf` decides **who may connect how** (trust, scram-sha-256, peer, …)
from which addresses. Managed providers force TLS + password/SCRAM; local
containers often use password auth on all interfaces inside the container
network.

`.pgpass` can store passwords for `psql` (file permissions must be tight). Prefer
secrets injection in real deploys (Phase 13).

## Trade-off

URIs are easy to pass around and easy to **log by accident**. Never print
`DATABASE_URL` in error handlers or APM breadcrumbs.

## Gotchas

**Symptom:** Works in `psql`, fails in Node with `ECONNREFUSED`  
**Cause:** Different host/port; or `localhost` vs `127.0.0.1`  
**Fix:** Same parameters; prefer `127.0.0.1` for published ports

**Symptom:** `no pg_hba.conf entry for host ...`  
**Cause:** Server rejected the connection path/method  
**Fix:** Adjust hba or connect the way the server allows (provider docs)

**Symptom:** Password in shell history  
**Cause:** `psql ...` with password on CLI  
**Fix:** `PGPASSWORD` env, `.pgpass`, or interactive prompt

## Interview questions

**★ What must a client know to connect?**  
Host, port, database name, user, password (or other auth), and optionally TLS.

**★ What is SQLSTATE `28P01`?**  
Invalid password / authentication failure.

**Why is logging the connection string dangerous?**  
It embeds secrets; logs and error trackers become credential stores.

**Does `inet_server_port()` show Docker’s published port?**  
No — it shows the server’s listen port **inside** its network namespace (often
5432).

---

← [Local install](07-local-install.md) · Next → [Process model](09-process-model.md)
