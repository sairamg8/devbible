---
title: "Storing and rotating"
sidebar_label: "02 · Storing and rotating"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex51-secrets.mjs`.

**Given that the previous chunk's leaks are real, this one is about the credential
itself:** getting it into the process without breaking on a special character,
what to log in its place, where it should live, and how it gets rotated.

## URL encoding

```console
=== 7. URL encoding: a password with special characters ===
raw "p@ss" → user / password                   "devbible" / "p@ss"
raw "p/ss" → THROWS                            ERR_INVALID_URL Invalid URL · input: *****REDACTED*****
raw "p#ss" → THROWS                            ERR_INVALID_URL Invalid URL · input: *****REDACTED*****
raw "p:ss" → user / password                   "devbible" / "p:ss"
raw "p ss" → user / password                   "devbible" / "p ss"
encodeURIComponent("p@ss")                     p%40ss
encoded → parsed password                      "p@ss"
```

`@`, `:` and a space survive unencoded — `pg-connection-string` splits on the
*last* `@`, so the common case works. `/` and `#` throw `ERR_INVALID_URL`, and the
error deliberately will not show you the input.

This is why a generated password sometimes breaks only in one environment: the
generator emitted a `/`. Either percent-encode the password when building the URL
(`encodeURIComponent`), or skip the URL form entirely and pass discrete fields,
which has no escaping rules at all:

```js
const pool = new pg.Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,   // no encoding, no parsing, no surprises
});
```

`pg` also reads those `PG*` variables on its own when the field is absent, so an
environment that sets them needs no connection code at all.

## What to log instead

```console
=== 8. the safe read of your own connection identity ===
{ current_user: 'devbible', current_database: 'devbible',
  server: '192.168.1.5/32', is_superuser: 'on', app: '' }
```

Every question you wanted the connection string to answer at boot — which
database, on which host, as whom, with how much privilege — is available from the
server without a credential:

```js
const {rows: [id]} = await pool.query(`
  SELECT current_user, current_database(),
         inet_server_addr()::text AS server,
         current_setting('is_superuser') AS is_superuser`);
log.info(id, 'database connection established');
```

Log that. And note `is_superuser: 'on'` in the sandbox output — in a real service
that line should read `off`, which makes this readout an alert as well as a
diagnostic. [Defaults and auditing](../01-roles-grant/04-defaults-and-auditing.md) turns
it into a boot assertion.

Set `application_name` while you are there — it was empty above, and it is what
makes `pg_stat_activity` legible when three services share a database:

```js
new pg.Pool({connectionString: process.env.DATABASE_URL, application_name: 'orders-api'});
```

## Where the secret should live

Ranked by what they actually protect against:

| Storage | Protects against | Fails against |
|---|---|---|
| A secret manager (Vault, AWS/GCP secrets), fetched at boot | Repo leaks, image leaks, most host access | A process dump; anyone who can read the running container's env |
| Environment variable injected by the platform | Repo leaks, image leaks | `/proc/<pid>/environ`, crash dumps, anything logging `process.env` |
| `.env` file, gitignored | Casual repo leaks | Backups, image layers, `COPY . .` in a Dockerfile |
| Hardcoded in the repo | Nothing | Everything |

The single highest-value habit is not any of these — it is **short-lived
credentials**, so a leak has a deadline. Managed providers (RDS IAM auth, Cloud
SQL IAM, Neon) issue a token valid for minutes, and `pg` accepts a function for
`password`, called on each new connection:

```js
const pool = new pg.Pool({
  host, database, user,
  password: async () => getIamAuthToken(),   // re-invoked per connection
  ssl: {rejectUnauthorized: true},
});
```

Failing that: one credential per service (never shared), rotated on a schedule
you have actually practised, and revocable by `ALTER ROLE … VALID UNTIL 'now'`
without a deploy.


## Trade-off

Every control here costs something. Fetching secrets from a manager at boot adds
a startup dependency that takes the service down when the manager is unreachable.
Short-lived tokens add a refresh path that fails at 3am if the callback throws.
One credential per service multiplies the number of things to rotate.

The cheap wins with no downside are the ones to take first: pass discrete
connection fields instead of a URL, set `application_name`, log the identity
readout rather than the config, and rotate through `\password`. Reach for a
secret manager and short-lived tokens when the service is worth the operational
surface they add — and test the failure path before you rely on it.

## Gotchas

**Symptom:** `ERR_INVALID_URL`, and the error will not show what you passed
**Cause:** A `/` or `#` in the password breaks URL parsing, and Node redacts the
input of a credentialed URL — measured, it prints `*****REDACTED*****`.
**Fix:** `encodeURIComponent` the password, or pass discrete
`host`/`user`/`password` fields and avoid escaping entirely.

**Symptom:** A connection string works locally and fails in one environment
**Cause:** Usually a special character in a generated password. Measured: `@`,
`:` and a space parse correctly; `/` and `#` throw.
**Fix:** As above, or regenerate with a restricted alphabet if the platform
forces the URL form.

**Symptom:** `is_superuser` reads `on` in production
**Cause:** The service was handed an admin connection string — commonly a copied
`.env`, or a managed provider's default user.
**Fix:** A dedicated application role
([Roles, GRANT and REVOKE](../roles-grant/)), and a boot assertion so the wrong
credential fails the deploy instead of working.

**Symptom:** `pg_stat_activity` is unreadable — every row says the same service
**Cause:** `application_name` is empty by default. Measured: `app: ''`.
**Fix:** Set it in the pool config; it costs nothing and makes every later
diagnosis easier.

**Symptom:** A leaked credential is still valid weeks later
**Cause:** Long-lived static passwords with no expiry.
**Fix:** `VALID UNTIL` for a deadline without a deploy, and IAM/short-lived
tokens via a `password` function that `pg` re-invokes per connection.

## Interview questions

**★ What breaks when a generated password contains a slash?**
URL parsing — `ERR_INVALID_URL`, with the input redacted so you cannot see why.
Measured: `@`, `:` and spaces parse fine; `/` and `#` do not. Percent-encode, or
pass discrete connection fields, which have no escaping rules.

**★ What should a service log at boot instead of its connection string?**
`current_user`, `current_database()`, `inet_server_addr()` and
`current_setting('is_superuser')` — the same questions answered without a
credential, and `is_superuser` doubles as an alert if it ever reads `on`.

**★ How do short-lived database credentials work with a connection pool?**
`pg` accepts a **function** for `password`, invoked on each new connection, so an
IAM token is fetched per connection rather than at boot. The trade is a refresh
path that must not throw — a failure there looks like a database outage.

**Where should the secret actually live?**
Ranked by what it protects against: a secret manager fetched at boot, then
platform-injected environment variables, then a gitignored `.env`. None of them
survive a process dump, which is why a short expiry matters more than the storage
choice.

**What does `application_name` buy you?**
Attribution in `pg_stat_activity`, `pg_stat_statements` and the server log, so a
slow query or an idle-in-transaction session can be traced to a service. It is
empty by default — measured.

---

← [Where secrets leak](01-where-secrets-leak.md) · Next → [App role should not own schema](../03-app-role-not-owner.md)
