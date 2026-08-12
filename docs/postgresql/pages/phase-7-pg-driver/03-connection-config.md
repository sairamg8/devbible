---
title: "Connection configuration"
sidebar_label: "03 · Connection config"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0, `pg-connection-string` bundled. Script:
> `sandbox/pg-api/ex20-driver.mjs`.

**Three ways to configure a connection — a URL, an object, or environment variables —
and they do not merge the way you would expect. The one that bites is SSL, where `pg`'s
`sslmode` handling is stricter than `libpq`'s and is about to change.**

## The three sources

```js
// 1. connection string
new pg.Pool({connectionString: 'postgres://user:pass@host:5432/db'});

// 2. config object
new pg.Pool({host: 'host', port: 5432, user: 'user', password: 'pass', database: 'db'});

// 3. environment variables — the same names libpq uses
new pg.Pool();   // reads PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
```

All three work, and the third is genuinely zero-config:

```console
$ node ex20-driver.mjs
=== 8. where configuration comes from ===
new Pool() with no args, env only → { db: 'devbible', usr: 'devbible' }
```

`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGAPPNAME`, `PGSSLMODE` and
friends are read automatically. That is why `psql` and your app agree about where to
connect when neither is configured explicitly — and why a stray `PGDATABASE` in a shell
profile can send a migration to the wrong database.

## Precedence: the connection string wins

```console
connectionString + database:"postgres" → { db: 'devbible' } ← the connection string wins
```

```js
new pg.Pool({connectionString: 'postgres://…/devbible', database: 'postgres'});
// connects to devbible, silently ignoring `database`
```

**Do not mix the two forms.** Passing both looks like "URL for the basics, object for the
overrides", and it does not work that way — the parsed string overwrites the explicit
fields, with no warning. Pick one. The exception is options that have no URL equivalent
(`max`, `idleTimeoutMillis`, `connectionTimeoutMillis`, `ssl` as an object), which are
pool-level settings rather than connection fields and can be combined safely:

```js
new pg.Pool({
  connectionString: process.env.DATABASE_URL,   // where and who
  max: 10, idleTimeoutMillis: 30_000,           // pool behaviour — safe to combine
});
```

## What a URL actually parses to

```console
=== 1. connection string vs config object ===
parse(url) → [Object: null prototype] {
  user: 'devbible',
  password: 'devbible',
  host: '127.0.0.1',
  port: '55432',
  database: 'devbible'
}
query params → { ssl: {}, application_name: 'api', connect_timeout: '5' }
```

Query-string parameters are real configuration, not decoration:

```
postgres://user:pass@host:5432/db?sslmode=require&application_name=api&connect_timeout=5
```

Note `port` comes back as the **string** `'55432'`. That is fine for `pg`, but if you
read it yourself for a health check, coerce it.

Special characters in the password must be percent-encoded — a `@`, `/` or `:` in a
password is the classic cause of a URL that parses into nonsense. `encodeURIComponent`
the password when building the URL, or use the object form.

## SSL: the part that is changing

```console
sslmode=disable     → ssl: false
sslmode=prefer      → ssl: {}
sslmode=require     → ssl: {}
sslmode=verify-full → ssl: {}
```

And, printed to stderr the first time:

```console
Warning: SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated
as aliases for 'verify-full'.
In the next major version (pg-connection-string v3.0.0 and pg v9.0.0), these modes will
adopt standard libpq semantics, which have weaker security guarantees.
```

Read that carefully, because it is the opposite of the usual deprecation:

- **Today (`pg` 8.x)**: `sslmode=require` *also verifies the certificate and hostname* —
  stricter than `libpq`, where `require` means "encrypt, verify nothing".
- **From `pg` 9.0**: `require` will mean what `libpq` means — encryption without
  verification. **Connections that verify today will silently stop verifying.**

So write what you mean, now:

```
?sslmode=verify-full        # encrypt AND verify — what you want in production
?uselibpqcompat=true&sslmode=require   # libpq semantics, opted into explicitly
```

For a self-signed or private-CA server, supply the CA rather than disabling checks:

```js
new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {ca: fs.readFileSync('/etc/ssl/rds-ca.pem').toString()},
});
```

`ssl: {rejectUnauthorized: false}` is the line people paste to make an error go away. It
turns off certificate verification entirely, which means an attacker who can intercept
the connection can present any certificate. It is acceptable in local development and
nowhere else.

## Passing server settings with `options`

```console
options passthrough → { search_path: 'public,pg_catalog' } { statement_timeout: '1234ms' }
```

```js
new pg.Pool({
  connectionString: URL,
  options: '-c search_path=app,public -c statement_timeout=5000',
});
```

Every connection the pool opens starts with those settings applied. This is the correct
way to set `search_path` or a default `statement_timeout` for an application — a `SET`
issued through `pool.query()` lands on one arbitrary connection and is lost
([`Pool` vs `Client`](02-pool-vs-client.md)). Related:
[Schemas and tenancy](../phase-3-ddl/10-schemas-tenancy.md) and
[Timeouts](11-timeouts.md).

## A password that changes

```console
password function called 1× for 2 queries on 1 connection
```

`password` may be a function, sync or async, evaluated **when a connection is opened** —
not per query. That is what makes short-lived credentials workable:

```js
new pg.Pool({
  host, port, user, database,
  password: async () => (await rds.getAuthToken()).token,   // IAM token, ~15 min TTL
});
```

Pair it with an `idleTimeoutMillis` shorter than the token's lifetime so connections are
recycled before their credential expires.

## `localhost` and IPv6

`localhost` resolves to **both** `::1` and `127.0.0.1`, and which one is tried first has
historically broken container setups that publish only on IPv4 — the connection is
refused with no useful message.

On this setup all three forms connect:

```console
=== 3. where connection errors surface ===
localhost → connected
```

Node 24 has `autoSelectFamily` on by default, so it attempts both families and takes
whichever answers. That removes most of the pain, but **prefer `127.0.0.1` in
container-facing configuration anyway**: it is unambiguous, it does not depend on a
Node version's dialling behaviour or on `/etc/hosts`, and it fails loudly rather than
after a resolver timeout.

## Timeouts that belong here

```js
new pg.Pool({
  connectionTimeoutMillis: 5_000,   // give up waiting for a connection (client-side)
  idleTimeoutMillis: 30_000,        // close connections idle this long
  statement_timeout: 10_000,        // server-side cap per statement
});
```

`connectionTimeoutMillis` covers both opening a socket and waiting for a free pooled
connection. It is not the same as the URL's `connect_timeout` (seconds, passed to the
server-side handshake). Which timeout actually saves you is [Timeouts](11-timeouts.md).

## Trade-off

A connection string is one environment variable, matches what every hosting provider
hands you, and is what `psql` accepts — at the cost of stringly-typed configuration where
a mis-encoded password fails obscurely, and of silently overriding object fields.

The object form is explicit and type-checkable, and is the only way to pass a CA
certificate or a password function — at the cost of five variables instead of one, and
divergence from the `DATABASE_URL` convention everything else expects.

The common answer: `connectionString` from the environment for host/user/database, plus
object fields for pool behaviour and `ssl`.

## Gotchas

**Symptom:** An explicit `database`/`user` in the config is ignored
**Cause:** A `connectionString` is also present and wins — measured.
**Fix:** Use one form for connection fields.

**Symptom:** TLS silently stops verifying after a `pg` upgrade to 9.x
**Cause:** `sslmode=require` changes from verify-full semantics to libpq semantics.
**Fix:** Write `sslmode=verify-full` explicitly now.

**Symptom:** `self signed certificate in certificate chain`
**Cause:** A private CA and `pg` 8.x verifying by default.
**Fix:** Pass the CA with `ssl: {ca: …}`. Not `rejectUnauthorized: false` outside local
development.

**Symptom:** The app connects to the wrong database with no config change
**Cause:** `PGDATABASE`/`PGHOST` set in the environment and picked up automatically.
**Fix:** Set connection config explicitly in deployed environments.

**Symptom:** Authentication fails with a password that is definitely correct
**Cause:** Unencoded `@`, `:` or `/` in a URL password.
**Fix:** `encodeURIComponent`, or the object form.

**Symptom:** `SET search_path` appears to work, then does not
**Cause:** It was applied to one pooled connection.
**Fix:** `options: '-c search_path=…'` so every connection starts with it.

**Symptom:** `ECONNREFUSED ::1:5432` against a container
**Cause:** `localhost` resolving to IPv6 where only IPv4 is published.
**Fix:** `127.0.0.1`. Node 24's `autoSelectFamily` masks this, older runtimes do not.

## Interview questions

**★ What does `sslmode=require` mean in `pg` today, and why is that a problem?**
In `pg` 8.x it is treated as an alias for `verify-full` — it encrypts *and* verifies the
certificate and hostname, which is stricter than `libpq`, where `require` means encrypt
only. `pg` 9.0 will adopt libpq semantics, so connections that verify today will stop
verifying after that upgrade, silently. Write `sslmode=verify-full` explicitly.

**★ If you pass both a `connectionString` and a `database` field, which wins?**
The connection string — measured, a pool given a URL for `devbible` plus
`database: 'postgres'` connected to `devbible`, with no warning. Never mix the two for
connection fields; pool-level options like `max` are safe to combine.

**★ How do you handle credentials that rotate, such as an IAM auth token?**
Pass `password` as a function. It is evaluated when a connection is opened rather than
per query — measured, called once across two queries on one connection. Keep
`idleTimeoutMillis` below the credential's TTL so connections recycle before it expires.

**★ How do you set `search_path` for an application reliably?**
Through the connection `options` string (`-c search_path=…`), so every connection the
pool opens starts with it. A `SET` through `pool.query()` applies to one arbitrary
pooled connection and is effectively random.

**Why prefer `127.0.0.1` over `localhost`?**
`localhost` can resolve to `::1` first, and a container publishing only on IPv4 refuses
that. Node 24's `autoSelectFamily` tries both and hides the problem — measured, all
forms connect here — but the literal address removes the dependency on resolver order
entirely.

---

← [`Pool` vs `Client`](02-pool-vs-client.md) · Next → [`pool.query` and placeholders](04-query-placeholders.md)
