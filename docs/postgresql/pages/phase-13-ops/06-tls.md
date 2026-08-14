---
title: "TLS to the database"
sidebar_label: "06 · TLS"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`), dedicated
> container `devbible-pg-hba` at `127.0.0.1:55435`, `psql`/libpq 18.4.
> Script: `sandbox/pg-api/ex53-hba-tls.sh`.

**`sslmode=require` does not verify anything.** It encrypts the connection and
accepts whatever certificate it is handed, so it stops passive sniffing and not
an active attacker. The mode that actually authenticates the server is
`verify-full`, and the difference is measurable in one run.

## Off by default, on with one setting

```console
=== 11. TLS — off by default in this image ===
off
ssl in use on this connection: false

=== 12. generate a self-signed certificate and turn ssl on ===
on
this connection: ssl=true version=TLSv1.3 cipher=TLS_AES_256_GCM_SHA384
```

The server needs two files in its data directory — `server.crt` and `server.key`,
the key readable only by the postgres user — and `ssl = on`. `ssl` has context
`sighup`, so enabling it is a reload; adding the files is what needs care.

Then note what happened on the client side: **nothing changed and the connection
became TLS anyway.** libpq defaults to `sslmode=prefer`, so it asks for TLS and
uses it when the server offers it. That is convenient and it is also why "we're
using TLS" is not a claim anyone should accept without checking — `prefer`
silently falls back to plaintext when the server stops offering it.

Check per connection, from inside the session:

```sql
SELECT ssl, version, cipher FROM pg_stat_ssl WHERE pid = pg_backend_pid();
```

And across the whole server, which is the query worth putting on a dashboard:

```sql
SELECT s.ssl, count(*), array_agg(DISTINCT a.application_name)
  FROM pg_stat_ssl s JOIN pg_stat_activity a USING (pid)
 GROUP BY s.ssl;
```

## The six sslmodes, measured

```console
=== 14. what each sslmode actually verifies ===
  sslmode=disable      ssl=false
  sslmode=allow        ssl=false
  sslmode=prefer       ssl=true
  sslmode=require      ssl=true
  sslmode=verify-ca    root certificate file "/home/sairam/.postgresql/root.crt" does not exist
  sslmode=verify-full  root certificate file "/home/sairam/.postgresql/root.crt" does not exist
```

| Mode | Encrypts | Checks the certificate chain | Checks the hostname |
|---|---|---|---|
| `disable` | no | – | – |
| `allow` | only if the server refuses plaintext | no | no |
| `prefer` **(default)** | yes, if offered | no | no |
| `require` | **yes, always** | no | no |
| `verify-ca` | yes | **yes** | no |
| `verify-full` | yes | **yes** | **yes** |

Two of those rows are worth dwelling on:

- **`allow` produced `ssl=false`** against a TLS-capable server, where `prefer`
  produced `ssl=true`. `allow` tries plaintext *first* and only negotiates TLS if
  plaintext is refused — it is the near-opposite of `prefer` and is almost never
  what someone means when they choose it.
- **`verify-ca` and `verify-full` failed before connecting**, with a missing
  `~/.postgresql/root.crt`. The verifying modes need a root certificate the
  client trusts, and libpq's default location is that path. Point at one
  explicitly with `PGSSLROOTCERT`, or `ssl.ca` in `pg`.

## What `verify-full` adds

The certificate in this run says `CN=devbible-pg-hba` and the client connects to
`127.0.0.1` — a deliberate mismatch:

```console
=== 15. verify-ca vs verify-full — the hostname check ===
  sslmode=verify-ca    + root cert   ssl=true
  sslmode=verify-full  + root cert   server certificate for "devbible-pg-hba" does not match host name "127.0.0.1"
  sslmode=verify-ca, NO root cert    root certificate file "…/root.crt" does not exist
```

Same certificate, same root, same connection: `verify-ca` accepted it,
`verify-full` refused. `verify-ca` proves only that *some* certificate signed by
a CA you trust is on the other end — including a certificate issued for a
different host by that same CA. `verify-full` additionally requires the
certificate to be issued for the host you asked for, which is what makes it a
defence against redirection rather than only against sniffing.

**Use `verify-full` in production.** The other modes have narrow uses: `require`
where you control the network path end to end and have no CA in place, `disable`
on a Unix socket, and `prefer` essentially never on purpose — it is just the
default you inherited.

## Making TLS mandatory on the server

Client-side `sslmode` is the client's choice. If you want TLS enforced, enforce
it where the client cannot override it — in `pg_hba.conf`:

```console
=== 13. hostssl / hostnossl ===
  sslmode=disable against a hostnossl reject   FATAL: pg_hba.conf rejects connection for host "192.168.1.5", …
  sslmode=require                              1
```

```
hostnossl all all all reject
hostssl   all all all scram-sha-256
```

`hostssl` matches only TLS connections, `hostnossl` only plaintext ones, and
`host` matches either. The pair above makes an unencrypted connection impossible
regardless of what any client's configuration says — which is the only version of
"we require TLS" that survives a misconfigured service.

## From Node

```js
import pg from 'pg';
import {readFileSync} from 'node:fs';

const pool = new pg.Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: {
    ca: readFileSync(process.env.PGSSLROOTCERT),   // the CA you trust
    rejectUnauthorized: true,                      // chain AND hostname → verify-full
  },
});
```

Two things about `pg` specifically:

- **`ssl: true` is not `verify-full`.** It enables TLS with Node's default
  verification against the system CA store, which fails for a private CA — and
  the usual "fix" found in issue threads is `rejectUnauthorized: false`, which
  disables verification altogether and leaves you at `require`.
- **`?sslmode=…` in a connection string is parsed by `pg`**, but the safest
  arrangement is the explicit `ssl` object above, because it is unambiguous about
  which CA is trusted.

Verify what you actually got rather than what you configured:

```js
const {rows: [tls]} = await pool.query(
  'SELECT ssl, version, cipher FROM pg_stat_ssl WHERE pid = pg_backend_pid()');
if (!tls.ssl) throw new Error('database connection is not encrypted');
```

## Certificate authentication

`cert` in `pg_hba.conf` authenticates the *client* by its certificate and
requires no password at all — the certificate's CN must match the role name, and
the server needs `ssl_ca_file` set to verify it. It is the strongest option and
the most operationally demanding: certificates expire, and an expired client
certificate takes the service down exactly as a wrong password would, without the
option of typing a new one.

Managed providers largely do not offer it; they hand you a server CA bundle and
expect password or IAM authentication over `verify-full`.

## Trade-off

TLS costs a handshake per connection and a few percent of CPU on throughput — and
with a connection pool the handshake is amortised over the pool's lifetime, so
for most applications the real cost is operational: certificates to distribute,
renew, and get wrong at 3am when one expires.

`verify-full` is where that cost concentrates, since the client now needs the CA
and the hostname has to match what the certificate says — the failure mode this
page measured. That is the trade to accept anyway: `require` protects you from an
attacker who can read the network but not from one who can answer on it, and the
second is the one that gets your credentials.

The exception worth naming: a Unix socket, where there is no network to protect
and TLS adds cost for nothing.

## Gotchas

**Symptom:** "We use TLS" but some connections are plaintext
**Cause:** `sslmode=prefer` (the default) silently falls back when the server
does not offer TLS.
**Fix:** Check `pg_stat_ssl` per connection, and enforce with `hostnossl … reject`
so the client's setting cannot matter.

**Symptom:** `sslmode=allow` produced an unencrypted connection
**Cause:** `allow` tries plaintext first and negotiates TLS only if plaintext is
refused — the opposite of `prefer`. Measured: `ssl=false` where `prefer` gave
`ssl=true`.
**Fix:** Never use `allow` for security; use `require` or better.

**Symptom:** `root certificate file "~/.postgresql/root.crt" does not exist`
**Cause:** `verify-ca`/`verify-full` need a trusted root, and that is libpq's
default location.
**Fix:** `PGSSLROOTCERT=/path/to/ca.crt`, or `ssl: {ca: …}` in `pg`.

**Symptom:** `server certificate for "x" does not match host name "y"`
**Cause:** `verify-full` checks the hostname against the certificate. Measured
with `CN=devbible-pg-hba` while connecting to `127.0.0.1` — `verify-ca` accepted
the same certificate.
**Fix:** Connect by the name the certificate was issued for, or reissue with the
right SAN entries. Do not downgrade to `verify-ca` to make it pass.

**Symptom:** TLS works locally and fails in production with a private CA
**Cause:** `ssl: true` in `pg` verifies against the system CA store.
**Fix:** Pass the CA explicitly with `rejectUnauthorized: true`. Do **not** set
`rejectUnauthorized: false` — that is `require` with extra steps.

**Symptom:** The server will not start after enabling `ssl`
**Cause:** `server.key` permissions or ownership — it must be readable only by
the postgres user.
**Fix:** `chown postgres:postgres server.key && chmod 600 server.key`.

## Interview questions

**★ Does `sslmode=require` protect against a man-in-the-middle?**
No. It guarantees encryption and verifies nothing about the certificate, so an
attacker who can answer on the network presents any certificate and reads
everything. `verify-full` is the mode that authenticates the server.

**★ What is the difference between `verify-ca` and `verify-full`?**
The hostname check. Measured on one certificate: `verify-ca` accepted
`CN=devbible-pg-hba` while connecting to `127.0.0.1`; `verify-full` rejected it.
`verify-ca` only proves the certificate was signed by a CA you trust — including
a certificate issued for a different host.

**★ How do you make TLS mandatory?**
On the server, not the client: `hostnossl … reject` plus `hostssl … scram-sha-256`
in `pg_hba.conf`. Measured — `sslmode=disable` was refused while `require`
connected. Any client-side setting can be changed by the client.

**★ Your connection is TLS and you did not configure anything. Why?**
libpq defaults to `sslmode=prefer`, so it negotiates TLS whenever the server
offers it — measured, turning `ssl = on` moved connections to TLSv1.3 with no
client change. The same default silently falls back to plaintext.

**What is wrong with `rejectUnauthorized: false` in `pg`?**
It disables certificate verification, reducing the connection to `require`:
encrypted, unauthenticated. It appears as the fix for a private-CA failure; the
actual fix is passing that CA as `ssl.ca` with `rejectUnauthorized: true`.

**How would you prove TLS is in use across a running system?**
`SELECT ssl, count(*) FROM pg_stat_ssl JOIN pg_stat_activity USING (pid) GROUP BY
ssl` — per-connection truth from the server, rather than trusting each client's
configuration.

---

← [pg_hba.conf](05-pg-hba.md) · Next → [Connection limits and PgBouncer](./07-pgbouncer/README.md)
