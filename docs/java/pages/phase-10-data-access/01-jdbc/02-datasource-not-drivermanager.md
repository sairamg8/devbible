---
title: "`DriverManager` is a factory for the most expensive object in your service"
sidebar_label: "2 · `DataSource`, not `DriverManager`"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the JDK 25 API for `java.sql.DriverManager`,
> `javax.sql.DataSource`, `javax.sql.ConnectionPoolDataSource` and
> `javax.sql.PooledConnection`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/), and the pgJDBC
> documentation *Connection Pools and Data Sources*
> (jdbc.postgresql.org/documentation/datasource/). JDK 25, JDBC 4.3,
> PostgreSQL 18, pgjdbc 42.7.13.

**`DriverManager.getConnection(url, user, password)` is the first line of every
JDBC tutorial and it is the wrong call to have anywhere in a server. Not because
it is deprecated — it is not — but because it does exactly one thing: it opens a
brand new physical connection to PostgreSQL, every single time, and hands it to
you. There is no pool behind it, no reuse, no bound on how many you can open, no
health check, no metrics, and no way for operations to change the target without
a redeploy. `DataSource` is the same call with an indirection in front of it, and
that indirection is the entire injection point for pooling, credentials rotation,
failover, tracing and every other thing a production database client needs. The
choice is not a style preference. It is the difference between a service whose
database connections are a managed resource and one where they are a side effect
of calling a static method.**

## The two ways to get a `Connection`

```java
// ❌ a new physical connection, every call, forever
Connection c = DriverManager.getConnection(
        "jdbc:postgresql://db:5432/shop", "shop_app", secret);

// ✅ someone else decides what "a connection" means
Connection c = dataSource.getConnection();
```

The second form is one interface method, `javax.sql.DataSource.getConnection()`,
and it says nothing about where the connection came from. That silence is the
point. Behind that method can sit:

| Implementation | What `getConnection()` returns |
|---|---|
| `PGSimpleDataSource` | a fresh physical connection — a `DataSource` shaped `DriverManager` |
| **HikariCP** | a proxy over a pooled physical connection, returned to the pool on `close()` |
| an application server's `DataSource` | a container-managed pooled connection, possibly XA-enrolled |
| a test double | an in-memory or wrapped connection |

Your repository code cannot tell the difference and must not try to. That is
what makes the pool swappable, the tests possible, and the tracing wrapper a
configuration change rather than a rewrite.

## What `DriverManager` actually costs you

Five things, and each of them is a production concern rather than an aesthetic
one:

1. **No pooling.** Every call pays the full connection cost —
   [chunk 4](04-connection-is-expensive.md) breaks that down into TCP, TLS, a
   PostgreSQL backend process and the authentication exchange. Under load this
   is the dominant cost of a short query.
2. **No upper bound.** `DriverManager` will happily open the ten-thousandth
   connection. PostgreSQL will not: it refuses with SQLSTATE `53300`,
   `too_many_connections`, once `max_connections` is reached. A pool turns that
   server-side failure into a client-side queue you control.
3. **No credentials indirection.** The username and password are arguments to a
   static method somewhere in your code. A `DataSource` bean reads them from
   configuration, and a rotating-credential `DataSource` can fetch a fresh token
   per connection without any caller knowing.
4. **No health checking or lifecycle.** Nothing validates the connection, ages
   it out, or notices that a failover moved the primary. A pool does all three.
5. **No observability.** There is no place to hang a metric. Pool gauges — active,
   idle, pending, creation time — all exist because there is an object that owns
   the connections.

⚠️ **`DriverManager` is not deprecated and does have legitimate uses**: a
migration tool, a one-shot CLI, a test fixture, an integration test that wants a
connection outside the pool deliberately. The rule is not "never call it"; it is
"never call it on a request path".

## `DataSource`, `ConnectionPoolDataSource` and the two `close()` meanings

`javax.sql` defines three data-source shapes and the difference between them is
routinely misread:

| Interface | Implemented by | `getConnection()` returns |
|---|---|---|
| `DataSource` | drivers, **and pools** | a `Connection` — physical or pooled, unspecified |
| `ConnectionPoolDataSource` | **drivers only** | a `PooledConnection` — the raw material a pool manages |
| `XADataSource` | drivers | an `XAConnection` for two-phase commit |

🔴 **`ConnectionPoolDataSource` is not a pool.** It is the driver-side hook that
lets *someone else* build a pool: it produces `PooledConnection` objects that fire
`connectionClosed` and `connectionErrorOccurred` events, and the pool listens for
those. Applications never call it. HikariCP, notably, does not require it —
it wraps a plain `DataSource` or the driver directly.

That leads to the one genuinely confusing thing in this API:

- On a **physical** connection, `close()` closes the socket.
- On a **pooled** connection, `close()` **returns it to the pool** and the socket
  stays open.

Both are `java.sql.Connection.close()`. Same method, same signature, entirely
different meaning depending on who made the object. Everything on
[chunk 14](17-resource-handling.md) about try-with-resources rests on this: in a
pooled application, *closing is how you release*, and not closing is how you
leak — and the leak is invisible because no socket count changes.

## JNDI, and why you can mostly forget it

For fifteen years the canonical way to get a `DataSource` was to look it up in
JNDI:

```java
InitialContext ctx = new InitialContext();
DataSource ds = (DataSource) ctx.lookup("java:comp/env/jdbc/shop");
```

The idea was sound: the *container* owned the pool and the credentials, declared
in `server.xml` or `web.xml`, and the application shipped without knowing the
database host at all. Operations changed a target without touching the war.

Two things ended it. Applications stopped being deployed into shared containers —
Boot and a container image made the JVM single-tenant — and configuration moved
to environment variables and mounted secrets, which achieve the same separation
with far less machinery. In a Spring Boot service the `DataSource` is a bean
built from `spring.datasource.*`; there is no JNDI name and no container to own
it.

⚠️ You will still meet JNDI in two places: a genuinely old application server
deployment, and Tomcat-based setups where a `Resource` element in `context.xml`
still defines the pool. Recognising the lookup and knowing it is a
`DataSource`-by-another-name is enough.

## pgJDBC ships a pool. Do not use it.

pgJDBC includes `PGPoolingDataSource`, and its own documentation is refreshingly
blunt about it: **"The pooling data-source implementation provided here is not
the most feature-rich in the world."** The listed limitations are that
**"Connections are never closed until the pool itself is closed; there is no way
to shrink the pool"**, that **"Connections requested for users other than the
default configured user are not pooled"**, and that **"Its error handling
sometimes cannot remove a broken connection from the pool"**.

The documentation's own recommendation: **"In general it is not recommended to
use the PostgreSQL® provided connection pool."**

Take the driver at its word. Use `PGSimpleDataSource` when you want an unpooled
`DataSource` — a migration runner, a test — and a real pool otherwise. That is
**Topic 02 — Connection pooling with HikariCP** *(not written yet)*.

## Wiring a `DataSource` by hand

Worth doing once, because it demystifies what Boot's auto-configuration is:

```java
PGSimpleDataSource unpooled = new PGSimpleDataSource();
unpooled.setServerNames(new String[] { "db.internal" });
unpooled.setPortNumbers(new int[] { 5432 });
unpooled.setDatabaseName("shop");
unpooled.setUser("shop_app");
unpooled.setPassword(System.getenv("DB_PASSWORD"));
unpooled.setApplicationName("checkout-api");   // shows up in pg_stat_activity
```

⚠️ `setServerNames` and `setPortNumbers` take **arrays** because pgJDBC supports
multiple hosts for failover. The old singular setters are legacy. Setting
`applicationName` costs nothing and is the difference between a `pg_stat_activity`
row you can attribute and one you cannot — do it on every service.

## The trade-off

`DataSource` buys the indirection at the cost of one more thing to configure and
one more thing that can be misconfigured. A pool with the wrong size, the wrong
connection timeout or leak detection off is worse than no pool in exactly one
respect: it fails in a way that looks like the database being slow rather than
the application being wrong. That is not an argument for `DriverManager`; it is
an argument for knowing what the pool's numbers mean, which is why the pool gets
its own topic.

## Gotchas

**⚠️ `DriverManager.getConnection` inside a request handler**
**Symptom:** latency that scales with request rate rather than query cost, and
`too_many_connections` under load.
**Cause:** a full physical connection per request.
**Fix:** a pooled `DataSource`. If you find this in a code review, it is not a
nitpick — it is the performance bug.

**⚠️ Believing `ConnectionPoolDataSource` gives you a pool**
**Symptom:** a `PGConnectionPoolDataSource` wired as the application's
`DataSource`, with no pooling behaviour and confusing types.
**Cause:** the name. It is the driver-side hook a pool consumes, not a pool.
**Fix:** use a pool implementation. `ConnectionPoolDataSource` is not application
API.

**⚠️ Not closing a pooled connection because "it goes back to the pool anyway"**
**Symptom:** the pool exhausts after N requests where N is the pool size, then
every caller blocks on acquisition until the connection timeout fires.
**Cause:** `close()` *is* the return-to-pool call. Skipping it means the
connection is never returned.
**Fix:** try-with-resources, always — [chunk 14](17-resource-handling.md).

**⚠️ Credentials in the URL, committed**
**Symptom:** a password in git history and in every log line that prints the
JDBC URL.
**Cause:** `jdbc:postgresql://host/db?user=x&password=y` is legal and convenient.
**Fix:** credentials as `DataSource` properties from the environment — see
[chunk 3](03-the-jdbc-url.md).

**⚠️ Assuming an injected `DataSource` is pooled**
**Symptom:** a service that behaves like it has no pool, because it does not —
someone wired `PGSimpleDataSource` as the bean.
**Cause:** the interface hides it, which is normally the virtue.
**Fix:** assert it at startup or check the bean type in the actuator/bean
listing. "Which `DataSource` implementation is this?" is a question with an
answer, and it should not be a surprise.

## Interview questions

**★ Why should a server never call `DriverManager.getConnection` on a request
path?**
Because it opens a new physical connection every time, and a physical connection
to PostgreSQL is genuinely expensive — a TCP handshake, usually a TLS handshake,
a new backend *process* forked on the server, and an authentication round trip.
Beyond the per-call cost there is no bound: `DriverManager` will keep opening
connections until PostgreSQL refuses with `too_many_connections`, SQLSTATE
`53300`, which is a server-wide failure affecting every other client. A
`DataSource` puts an object in front of that call, and once an object owns the
connections you can pool them, cap them, health-check them, rotate credentials
under them and measure them.

**★ What does `close()` do on a connection you got from HikariCP?**
It returns the connection to the pool. The physical socket stays open and the
PostgreSQL backend process stays alive; what you were holding was a proxy, and
`close()` releases the lease. That is why try-with-resources is not optional in a
pooled application — skipping the close does not leak a socket, it leaks a *pool
slot*, and the symptom is that after N requests every caller blocks in
`getConnection()` until the pool's connection timeout fires. Nothing in the
`java.sql.Connection` interface tells you which of the two meanings you are
getting, which is exactly why the discipline has to be unconditional.

**★ What is `ConnectionPoolDataSource` for?**
It is the driver-side contract that makes third-party pooling possible. A driver
implements it to produce `PooledConnection` objects, which are physical
connections that emit `connectionClosed` and `connectionErrorOccurred` events so
a pool can know when a logical handle was released or when the underlying
connection broke. Applications never use it directly — they use a `DataSource`.
The name is one of the more misleading in the JDK, because it sounds like the
pool and is actually the raw material.

**★ Is JNDI still relevant?**
Rarely, and mostly as something to recognise rather than write. Its purpose —
letting operations own the pool and the credentials so the deployed artifact does
not know the database host — is still a good purpose, but environment variables,
mounted secrets and externalised configuration achieve it without a naming
service, and applications stopped being deployed into shared containers where the
container could own anything. You will still meet it in older application-server
deployments and in Tomcat `context.xml` resources, and in both cases the thing on
the other end of the lookup is just a `DataSource`.

**★ pgJDBC ships a connection pool. Why does nobody use it?**
Because the driver's own documentation tells you not to. It says the
implementation "is not the most feature-rich in the world", that connections are
never closed until the pool itself is closed so the pool cannot shrink, that
connections for non-default users are not pooled at all, and that its error
handling sometimes cannot remove a broken connection from the pool. That last one
is the disqualifying defect: a pool that can hold a dead connection will hand it
to a caller, and the failure surfaces as a random query error long after the
network event that caused it. Use `PGSimpleDataSource` when you want an unpooled
`DataSource`, and a real pool otherwise.

---

← Prev: [What JDBC actually is](01-what-jdbc-actually-is.md) · Index: [JDBC](README.md) · Next → [The JDBC URL](03-the-jdbc-url.md)
