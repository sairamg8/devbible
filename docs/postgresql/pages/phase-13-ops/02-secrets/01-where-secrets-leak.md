---
title: "Where secrets leak"
sidebar_label: "01 · Where secrets leak"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex51-secrets.mjs`.

**"Never log the connection string" is the advice; the leaks that actually happen
are somewhere else.** This page causes each one and shows which are real. The
short version: the driver object keeps your password, the server log takes
whatever you inline, and `pg`'s error objects are clean.

## The password survives on the pool object

```console
$ node ex51-secrets.mjs
=== 1. what the driver keeps in memory after you hand it a URL ===
pool.options.password                          undefined
pool.options.connectionString                  "postgres://u:sup3rs3cret@127.0.0.1:55432/devbible"
JSON.stringify(pool.options) contains it?      true
util.inspect depth 3 contains it?              true
```

`pool.options.password` is `undefined` — which is exactly the trap. The
credential is still there, inside `connectionString`, and both
`JSON.stringify()` and `util.inspect()` reproduce it in full.

That matters because of how objects reach logs without anyone deciding to log a
secret:

- `logger.info({pool}, 'db ready')` — a structured logger serialises the object.
- A crash reporter (Sentry, Bugsnag) attaching "context" containing config.
- `console.log(err)` where a wrapper attached the pool or its config.
- `process.on('uncaughtException', e => console.dir(e, {depth: null}))`.

None of these look like logging a password. All of them do. **Never put the pool,
its options, or your config object into a log line** — log the identity readout
from the last section instead.

## `pg`'s own errors are clean

```console
=== 2. does a connection error carry the password? ===
err.message                                    password authentication failed for user "nope"
err.code                                       28P01
message contains password?                     false
JSON.stringify(err) contains password?         false
inspect(err) contains password?                false
ECONNREFUSED err.message                       connect ECONNREFUSED 127.0.0.1:1
  contains password?                           false
```

Both failure shapes — rejected credentials (`28P01`) and a refused socket — carry
no password anywhere in the error, at any inspection depth. So the common
reflex of scrubbing `pg` errors before logging them is unnecessary; log the error
object as-is.

Node's own URL parser goes further and redacts on purpose:

```console
raw "p/ss" → THROWS   ERR_INVALID_URL Invalid URL · input: *****REDACTED*****
```

`ERR_INVALID_URL` from a URL containing credentials prints `*****REDACTED*****`
rather than the input. Useful, and also confusing the first time you debug a
malformed `DATABASE_URL` and cannot see what you passed.

## What other sessions can read while a query runs

```console
=== 3. pg_stat_activity — what other sessions can read ===
[ { application_name: 'p13-secrets', state: 'active',
    query: "SELECT pg_sleep(1.5), 'inline-secret-abc123' AS token" } ]
[ { rolname: 'devbible' } ]
```

`pg_stat_activity.query` holds the **text of the running statement**, readable by
any superuser and by any role in `pg_read_all_stats`. A secret pasted into SQL —
an API token, a password being written into a settings table — is visible to
every such role for as long as the statement runs, and the last statement of an
idle session stays visible until it runs another.

The same query with a bound parameter:

```console
=== 4. a parameter is NOT the query text ===
[ { query: 'SELECT pg_sleep(1.5), $1::text AS token' } ]
```

`$1`, not the value. Parameters are sent separately from the statement and never
become part of the query text — the same mechanism that makes them
[injection-proof](../../phase-9-api-crud/) also keeps values out of the stats view.

Note the second row of section 3: the query listing roles with
`pg_read_all_stats` returned only `devbible`, the sandbox superuser. Run it on
your own cluster — monitoring integrations and managed-provider "observability"
roles are commonly members, and each one can read every statement your
application runs.

## The server log takes whatever you inline

With `log_statement = 'all'` set **for one session only**, three statements were
issued and the container log inspected:

```console
=== 5. the server log, with log_statement = all for this session only ===
INLINE_1786622769319 in server log             1 line(s)
   2026-08-13 12:06:09.319 UTC [4726] LOG:  statement: SELECT 'INLINE_1786622769319' AS leaked
PARAM_1786622769319 (bound value) in log       2 line(s)
   2026-08-13 12:06:09.321 UTC [4726] DETAIL:  Parameters: $1 = 'PARAM_1786622769319'
PLAINTEXT_1786622769319 (the password) in log  1 line(s)
   2026-08-13 12:06:09.322 UTC [4726] LOG:  statement: ALTER ROLE p13_app PASSWORD 'PLAINTEXT_1786622769319'
{ log_parameter_max_length: '-1' }
{ log_parameter_max_length_on_error: '0' }
```

Three results, and the middle one contradicts what people assume:

1. **An inlined literal is logged verbatim.** Expected.
2. **Bound parameter values are logged too** — as a `DETAIL: Parameters:` line
   attached to the statement. Parameters keep secrets out of `pg_stat_activity`
   and out of the *statement* text, but **not out of the log** once `log_statement
   = 'all'` is on. `log_parameter_max_length = -1` means unlimited, and that is
   the default.
3. **`ALTER ROLE … PASSWORD 'x'` writes the plaintext password to the log**, in a
   `LOG: statement:` line, while `pg_authid` stores only a
   `SCRAM-SHA-256$4096:…` verifier. The database protected the password at rest
   and the logger wrote it to disk in the clear.

To rotate a password without that, use `psql`'s `\password`, which computes the
SCRAM verifier client-side and sends only the verifier. If you must do it from
code, compute the verifier yourself, or at minimum wrap the statement:

```sql
SET LOCAL log_statement = 'none';
SET LOCAL log_min_duration_statement = -1;
ALTER ROLE app_user PASSWORD '…';
```

`SET LOCAL` reverts at commit, so it cannot leak into the next request on a
pooled connection.

`log_parameter_max_length_on_error` is `0` — parameter values are **not** logged
with a failed statement by default, only with `log_statement`/duration logging.
Setting it to aid debugging turns every constraint violation into a log line
containing the offending values.


## Trade-off

Turning statement logging off protects secrets and removes your best debugging
tool; leaving it on gives you every query and every parameter value, which is
also every token any of them carried. There is no setting that is right in both
directions.

The workable position is to treat the log as data at the same sensitivity as the
database: same retention limits, same access control, same redaction review — and
keep the individually cheap habits (bound parameters, never serialising the pool,
`\password` for rotation) so that the log's exposure is bounded by what you
deliberately put in a statement.

## Gotchas

**Symptom:** A password appears in the application log although nothing logs a
password
**Cause:** The pool or a config object was serialised — `pool.options.password`
is `undefined`, but `connectionString` still contains the credential, and both
`JSON.stringify` and `util.inspect` reproduce it.
**Fix:** Never log the pool, its options, or the config object. Log the
`current_user`/`current_database` readout from the next chunk instead.

**Symptom:** A password appears in the *server* log
**Cause:** `ALTER ROLE … PASSWORD 'x'` is a statement, and `log_statement =
'all'` logs statements. Measured: plaintext in the log while `pg_authid` held
only a SCRAM verifier.
**Fix:** `\password` in psql, or `SET LOCAL log_statement = 'none'` around the
statement.

**Symptom:** Bound parameters are in the log, though "parameters aren't part of
the query"
**Cause:** True for `pg_stat_activity` and the statement text, false for the log
— `log_statement = 'all'` adds a `DETAIL: Parameters:` line, and
`log_parameter_max_length` is `-1` (unlimited) by default.
**Fix:** `log_parameter_max_length = 0` to suppress values, or treat statement
logging as a data-exposure surface.

**Symptom:** A monitoring integration can read your application's SQL
**Cause:** `pg_read_all_stats` membership grants access to
`pg_stat_activity.query` for every session, including the last statement of an
idle one.
**Fix:** Audit membership, and use bound parameters so the view shows `$1`.

**Symptom:** You cannot see what malformed `DATABASE_URL` you passed
**Cause:** Node redacts the input of a credentialed URL in `ERR_INVALID_URL` —
measured, it prints `*****REDACTED*****`.
**Fix:** Parse the pieces yourself, or log the host and database only. Details in
the next chunk.

## Interview questions

**★ You are told never to log the connection string. What actually leaks in
practice?**
The pool object. `pool.options.password` reads `undefined`, but the credential
survives inside `connectionString`, and any structured logger or crash reporter
that serialises the object emits it — measured with both `JSON.stringify` and
`util.inspect`. `pg`'s error objects, by contrast, carry no password at any depth.

**★ Do bound parameters keep a secret out of the logs?**
No — only out of the *statement text*. Measured: `pg_stat_activity` showed `$1`,
while the server log with `log_statement = 'all'` showed
`DETAIL: Parameters: $1 = '…'` in full, because `log_parameter_max_length`
defaults to `-1`.

**★ Why should you not rotate a password with `ALTER ROLE … PASSWORD`?**
The statement text contains the plaintext and reaches the server log and
`pg_stat_activity`, while the database stores only a SCRAM verifier — both
measured in the same run. `\password` computes the verifier client-side.

**★ Who can read the SQL your application is running?**
Any superuser and any member of `pg_read_all_stats`, through
`pg_stat_activity.query`. Managed-provider monitoring roles are commonly members.

**Do you need to scrub `pg` errors before logging them?**
No. Measured at depth 4: neither a `28P01` authentication failure nor an
`ECONNREFUSED` carries the password in `message`, `JSON.stringify` or
`util.inspect`. Scrub what *you* attach to them, not the error itself.

---

← [Topic index](README.md) · Next → [Storing and rotating](02-storing-and-rotating.md)
