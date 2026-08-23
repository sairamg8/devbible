---
title: "The URL is configuration, and half of your connection behaviour hides in it"
sidebar_label: "3 · The JDBC URL"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the pgJDBC documentation *Initializing the Driver
> → Connection Parameters* and *Using SSL*
> (jdbc.postgresql.org/documentation/use/, .../ssl/), and the JDK 25 API for
> `java.sql.DriverManager` and `javax.sql.DataSource`. JDK 25, JDBC 4.3,
> PostgreSQL 18, pgjdbc 42.7.13.

**A JDBC URL looks like a location and is actually a configuration file with no
schema and no validation. `jdbc:postgresql://db:5432/shop` names a host, a port
and a database; everything after a `?` is a driver setting, and pgJDBC accepts
several dozen of them — timeouts, SSL mode, prepared-statement thresholds, batch
rewriting, application name, cursor sizing. Two facts make this worth a chunk of
its own. First, some of the most important behaviours on this page are *only*
reachable as URL properties, so a team that treats the URL as "the address" never
finds them. Second, the URL is the single most common place a database password
ends up in a git repository, in a log line, and in a stack trace — and unlike a
config file, nobody thinks of it as secret because it looks like a hostname.**

## The shape

pgJDBC accepts three forms:

```
jdbc:postgresql:database
jdbc:postgresql://host/database
jdbc:postgresql://host:port/database
```

with documented defaults: host defaults to `localhost`, port to **5432**, and the
database name to the username if omitted. IPv6 addresses go in square brackets —
`jdbc:postgresql://[::1]:5432/shop`.

⚠️ **Percent-encoding is required and forgotten constantly.** The documentation
is explicit: any reserved characters for URLs — it lists `/`, `:`, `@`, `(`, `)`,
`[`, `]`, `&`, `#`, `=`, `?`, and space — appearing in a value **"must be percent
encoded"**. A generated password containing `#` or `@` will truncate the URL at
exactly the wrong place and produce an authentication error that looks like a
wrong password. This is a real 3am bug and the fix is not to shorten the password.

## Properties: three places, one precedence rule

You can pass driver settings three ways, and they do not all win:

```java
// 1 — in the URL
"jdbc:postgresql://db:5432/shop?socketTimeout=30&ApplicationName=checkout-api"

// 2 — in a Properties object
Properties p = new Properties();
p.setProperty("user", "shop_app");
p.setProperty("password", secret);
p.setProperty("socketTimeout", "30");
DriverManager.getConnection(url, p);

// 3 — as DataSource setters
pgSimpleDataSource.setApplicationName("checkout-api");
```

🔴 **The precedence is the opposite of what most people guess.** pgJDBC's
documentation states it plainly: **"If a property is specified both in URL and in
`Properties` object, the value from `Properties` object is ignored."** The URL
wins. So a `DataSource` whose `socketTimeout` you set in code, pointed at a URL
that also sets `socketTimeout`, silently uses the URL's value. If a setting
"isn't taking effect", check whether the URL is already asserting it.

## The properties that actually matter

Every one of these is documented on the pgJDBC *Connection Parameters* page with
the default shown:

| Property | Default | What it does |
|---|---|---|
| `user`, `password` | — | credentials; see below for where they belong |
| `ssl` | `false` | **"The mere presence of it specifies an SSL connection"** |
| `sslmode` | `prefer` | `disable`, `allow`, `prefer`, `require`, `verify-ca`, `verify-full` |
| `connectTimeout` | **10** (seconds) | socket *connect* operations |
| `socketTimeout` | **0** — none | socket *read* operations; on expiry the connection is closed |
| `loginTimeout` | 0 | how long to wait for connection establishment overall |
| `cancelSignalTimeout` | 10 | timeout for the out-of-band cancel connection |
| `prepareThreshold` | **5** | executions before switching to a server-side prepared statement — [chunk 7](09-server-side-prepared-statements.md) |
| `preferQueryMode` | `extended` | `simple`, `extended`, `extendedForPrepared`, `extendedCacheEverything` |
| `reWriteBatchedInserts` | **false** | rewrites batched inserts; documented as a **"2-3x performance improvement"** — [chunk 15](18-batch-updates.md) |
| `defaultRowFetchSize` | **0** | rows per fetch; 0 means the driver buffers everything — [chunk 12](15-fetch-size-and-streaming.md) |
| `ApplicationName` | — | shows in `pg_stat_activity.application_name` |
| `options` | — | server GUCs, e.g. `-c statement_timeout=5000` |

🔴 **`socketTimeout` defaults to 0, which means no read timeout at all.** That is
the JDBC equivalent of the "block forever" default this bible keeps meeting on
HTTP clients, and it has the same consequence: a database that accepts your
connection and then stops answering — a failover mid-flight, a network partition
that drops packets silently, a backend stuck on a lock — parks your thread with
no exception and no bound. `setQueryTimeout` does **not** cover it, and
[chunk 18](21-timeouts-cancellation-metadata.md) explains why.

⚠️ **`sslmode=prefer` is the default and it is not security.** `prefer` means
"encrypt if the server offers it, otherwise don't" — with no certificate
verification either way, so it stops a passive observer and does nothing about an
active one. `require` encrypts but still does not verify the server. Only
`verify-ca` and `verify-full` authenticate the server, and `verify-full` also
checks the hostname. For a database reachable over anything but a loopback
socket, `verify-full` is the setting you want, and the reason people do not use
it is that it requires distributing a CA certificate, which is a solvable problem.

## The `options` property: server settings from the client

This one is under-used and genuinely powerful. `options` passes startup
parameters to the backend, so you can set server GUCs per connection without
touching `postgresql.conf`:

```
jdbc:postgresql://db:5432/shop?options=-c%20statement_timeout%3D5000%20-c%20lock_timeout%3D3000
```

Note the documentation's rule: spaces separate arguments unless escaped with a
backslash — and in a URL those spaces need percent-encoding as `%20`, which is
why the string above looks the way it does. Setting `statement_timeout` this way
gives every statement on the connection a server-side bound, which is the one
timeout PostgreSQL enforces itself rather than trusting the client to notice.

## Where credentials belong, and where they must not

🔴 **Never in a URL that lives in a repository.** The URL is not treated as a
secret by anything: it is logged at startup by most frameworks, printed in
connection-error messages, visible in `ps` output if it arrived as a JVM
argument, and committed to git the moment someone puts it in
`application.properties` "just for local".

The hierarchy, best first:

1. **A short-lived credential fetched per connection** — an IAM token, a Vault
   lease. The `DataSource` acquires it; nothing is stored anywhere.
2. **A mounted secret file** the process reads at startup. Not in the image, not
   in the environment listing, rotatable without a rebuild.
3. **An environment variable.** Fine, with the caveat that environment blocks leak
   into crash dumps, child processes and some diagnostic endpoints.
4. **A config file outside the repository**, injected at deploy time.
5. ⛔ **In the URL in the repository.** No.

```java
// ✅ host and database are configuration; the password never joins them
HikariConfig cfg = new HikariConfig();
cfg.setJdbcUrl(env.getRequiredProperty("db.url"));   // no credentials in it
cfg.setUsername(env.getRequiredProperty("db.user"));
cfg.setPassword(secrets.read("db.password"));
```

⚠️ **And redact before you log.** If your startup banner prints the JDBC URL —
many do — strip the query string, or at least `password=`, before it reaches the
log. A URL with credentials in it, logged once, is in your log aggregator's index
forever and searchable by everyone with read access.

## Multi-host URLs and failover

pgJDBC accepts several hosts, which is why `PGSimpleDataSource` takes arrays:

```
jdbc:postgresql://primary:5432,replica:5432/shop?targetServerType=primary
```

`targetServerType` lets the driver pick a host by role — a primary for writes, a
replica or any host for reads. It is a genuinely useful feature and it is also a
trap: it is *connection-level* failover, not query-level, so a connection already
open to a host that is demoted stays there until something closes it. Pair it with
a bounded `maxLifetime` on the pool so connections cycle, and with
`socketTimeout` so a dead host is noticed rather than waited on.

## Gotchas

**⚠️ A password containing a reserved character, unencoded**
**Symptom:** authentication failures with a password everyone agrees is correct;
often intermittent because it only affects the environments with the generated
password.
**Cause:** `#`, `@`, `&` or a space terminating the URL early. The documentation
requires percent-encoding for exactly these characters.
**Fix:** percent-encode, or better, stop putting the password in the URL.

**⚠️ Setting a property in code and having the URL override it**
**Symptom:** a `socketTimeout` you can see in the source that is demonstrably not
in effect.
**Cause:** the documented precedence — a property present in both the URL and a
`Properties` object takes the URL's value.
**Fix:** own the setting in one place. If the URL is deployment-supplied, put
nothing in it but host, port and database.

**⚠️ Shipping with `socketTimeout` unset**
**Symptom:** during a network partition or a failover, application threads parked
indefinitely in a socket read against the database, with no exception ever thrown.
**Cause:** the documented default is 0, meaning no timeout.
**Fix:** set it, comfortably above your slowest legitimate query, and set a
server-side `statement_timeout` too. Two different mechanisms, both needed —
[chunk 18](21-timeouts-cancellation-metadata.md).

**⚠️ Treating `ssl=true` or `sslmode=require` as "the connection is secure"**
**Symptom:** an audit finding, or a real man-in-the-middle that nothing detected.
**Cause:** `require` encrypts without authenticating the server; the default
`prefer` may not even encrypt.
**Fix:** `sslmode=verify-full` plus a trusted CA certificate. Anything less is
encryption without identity.

**⚠️ Logging the JDBC URL at startup**
**Symptom:** credentials in the log aggregator, discovered during an unrelated
search.
**Cause:** a helpful banner.
**Fix:** log the URL with its query string removed, and keep credentials out of
it in the first place so the banner is harmless.

**⚠️ No `ApplicationName`**
**Symptom:** `pg_stat_activity` shows twenty connections running the same query
and nobody can say which service they belong to, during the incident where that
is the only question that matters.
**Cause:** the property was never set.
**Fix:** set it on every service. It costs one property and it is the difference
between attributable load and anonymous load.

## Interview questions

**★ Where do database credentials belong, and why not in the JDBC URL?**
They belong outside the artifact: ideally a short-lived credential fetched per
connection, otherwise a mounted secret file or an environment variable, injected
at deploy time. The URL is the worst place because nothing in the ecosystem
treats it as a secret — frameworks log it at startup, drivers include it in
connection-failure messages, it appears in `ps` output if it came in as a JVM
argument, and it is the string most likely to be committed "just for local" and
then inherited by every other environment. The practical test is whether the
string could appear in a log line without anyone caring; if not, it does not
belong in the URL.

**★ What does `sslmode=require` guarantee?**
Encryption, and nothing else. It requires that the connection is encrypted but
does not verify the server's certificate or hostname, so it defends against
passive eavesdropping and not against an active attacker who can redirect the
connection. `verify-ca` adds certificate-chain verification and `verify-full`
adds hostname verification on top; only `verify-full` gives you the property
people assume they already have. The default is `prefer`, which is weaker still —
it encrypts only if the server offers it and falls back to plaintext silently.

**★ You set `socketTimeout` in your `DataSource` configuration and it has no
effect. What is the most likely cause?**
The same property is present in the JDBC URL. pgJDBC documents the precedence
explicitly: if a property is specified both in the URL and in a `Properties`
object, the value from the `Properties` object is ignored. The URL wins. This
bites hardest when the URL is supplied by the deployment platform and the code
sets defaults, because the two halves are owned by different people and neither
can see the other's value. The fix is to decide which layer owns connection
tuning and keep the other one silent.

**★ What is the difference between `socketTimeout`, `setQueryTimeout` and
`statement_timeout`?**
Three different mechanisms at three different layers. `socketTimeout` is a
client-side socket read timeout in pgJDBC: if no data arrives within it, the
driver closes the connection — it bounds a dead network, not a slow query, and
its default is 0, meaning never. `Statement.setQueryTimeout` is JDBC-level: the
driver arranges for the statement to be cancelled after N seconds and throws
`SQLTimeoutException`, which in pgJDBC means sending a cancel request over a
separate connection. `statement_timeout` is a PostgreSQL server setting: the
server itself aborts the statement, independent of whether the client is alive or
listening. Only the last one still works when the client has gone away, which is
why a production database usually wants all three.

**★ Why set `ApplicationName`?**
Because it is the only thing that makes a connection attributable on the server
side. `pg_stat_activity` shows one row per backend with the query it is running,
and without `application_name` a row is identified by a database user and a
client IP that, in a Kubernetes cluster behind a service mesh, tell you nothing.
During an incident the question is always "which service is issuing this query",
and the answer is either one column or half an hour of correlation. It costs a
single connection property.

---

← Prev: [`DataSource`, not `DriverManager`](02-datasource-not-drivermanager.md) · Index: [JDBC](README.md) · Next → [A `Connection` is expensive](04-connection-is-expensive.md)
