---
title: "The pool does not make connections cheap — it makes you stop opening them, and the object it hands back is a proxy"
sidebar_label: "1 · What the pool hands you"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the HikariCP 7.0.2 README and its source at tag
> `HikariCP-7.0.2`
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)),
> the JDK 25 API for `javax.sql.DataSource` and `javax.sql.PooledConnection`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/)),
> and the Spring Boot reference *SQL Databases → Connection to a Production
> Database* ([docs.spring.io/spring-boot](https://docs.spring.io/spring-boot/reference/data/sql.html)).
> JDK 25, HikariCP 7.0.2, Spring Boot 4.1.0, PostgreSQL 18, pgjdbc 42.7.13.

**A connection pool solves one problem, and it is worth being precise about
which. It does not make opening a PostgreSQL connection faster. Opening one
still costs a TCP handshake, a TLS handshake, an authentication exchange and a
forked backend process on the database server —
[chunk 4 of topic 01](../01-jdbc/04-connection-is-expensive.md) has the detail.
What a pool does is open a small number of connections once, keep them open, and
lend them out. You pay the cost at startup instead of on every request. The
consequence that surprises people is what `getConnection()` then returns: not
the driver's connection, but a thin wrapper around it. When you call `close()`
on that wrapper, nothing is closed. The wrapper detaches itself and the real
connection goes back on the shelf. Everything else in this topic follows from
that one sentence.**

## The specification says this out loud

`javax.sql.DataSource` is described in the JDK 25 API as *"a factory for
connections to the physical data source that this `DataSource` object
represents"*, and it names three kinds of implementation. The second is the one
you use every day:

> *Connection pooling implementation — produces a `Connection` object that will
> automatically participate in connection pooling. This implementation works
> with a middle-tier connection pooling manager.*

`javax.sql.PooledConnection` then spells out the mechanics:

> *When an application calls the method `DataSource.getConnection`, it gets back
> a `Connection` object. If connection pooling is being done, that `Connection`
> object is actually a **handle** to a `PooledConnection` object, which is a
> physical connection.*

and, on closing:

> *Thus, when an application closes its connection, the underlying physical
> connection is **recycled** rather than being closed. The physical connection
> is not closed until the connection pool manager calls the `PooledConnection`
> method `close`.*

🔴 **Read "handle" as "proxy".** You hold an object that implements
`java.sql.Connection` and forwards almost every call to a real one. HikariCP's
proxy class is generated at build time and shows up in logs and debuggers as
`HikariProxyConnection`, wrapping something like `org.postgresql.jdbc.PgConnection`.

## What HikariCP's `close()` actually does

HikariCP does not use the `ConnectionPoolDataSource` machinery the specification
describes; it wraps an ordinary `DataSource` or driver itself. But the shape is
the same. Reading `ProxyConnection.close()` in the 7.0.2 source, closing does
five things in order:

| Step | What happens |
|---|---|
| 1 | Close any `Statement` objects still open on this connection |
| 2 | Cancel the leak-detection timer for this borrow ([chunk 6](06-leak-detection.md)) |
| 3 | **If a transaction was started and autocommit is off, `rollback()`** |
| 4 | Reset any connection settings you changed ([chunk 7](07-session-state.md)) |
| 5 | `clearWarnings()`, mark the proxy closed, hand the connection back to the pool |

Step 3 is worth pausing on. The `Connection.close()` javadoc refuses to promise a
rollback — it calls the result *implementation-defined* — and
[topic 01 chunk 20](../01-jdbc/18-ownership-and-leaks.md) makes the point that
you should never rely on it. HikariCP does roll back here, but only when it has
seen a statement execute since the last commit **and** autocommit is off. That
is a safety net for the pool's benefit, not a licence to skip your own
`commit()`/`rollback()`.

⚠️ **Closing twice is harmless.** The proxy replaces its delegate with a
sentinel `ClosedConnection` on the way out, so a second `close()` returns
immediately. Using the proxy *after* close is not harmless — every method throws
`SQLException` saying the connection is closed.

## So try-with-resources is still exactly right

Nothing about pooling changes the code you write:

```java
@Repository
class OrderRepository {

    private final DataSource dataSource;   // a HikariDataSource, injected

    OrderRepository(DataSource dataSource) { this.dataSource = dataSource; }

    Optional<Order> findById(long id) throws SQLException {
        var sql = "SELECT id, customer_id, total_cents FROM orders WHERE id = ?";
        try (var c  = dataSource.getConnection();      // borrow
             var ps = c.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (var rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(map(rs)) : Optional.empty();
            }
        }                                              // return to the pool
    }
}
```

The `close()` at the end of the `try` block is the *return*. Skip it and the
connection never comes back — which is the leak
[topic 01 chunk 20](../01-jdbc/18-ownership-and-leaks.md) describes and
[chunk 6](06-leak-detection.md) here shows you how to find.

## Spring Boot picks HikariCP for you

You rarely construct the pool yourself. Boot's reference documentation states
its selection order plainly:

> *We prefer HikariCP for its performance and concurrency. If HikariCP is
> available, we always choose it.*

Failing that it tries the Tomcat pooling `DataSource`, then Commons DBCP2, then
Oracle UCP. Using `spring-boot-starter-jdbc` or `spring-boot-starter-data-jpa`
brings HikariCP in automatically, so in practice the first branch always wins.
To force a different pool, set `spring.datasource.type`.

Everything under `spring.datasource.hikari.*` is bound straight onto
`HikariConfig`, so the property names are the kebab-case forms of the knobs in
HikariCP's own README:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://db.internal:5432/shop
    username: shop_app
    password: ${DB_PASSWORD}
    hikari:
      pool-name: shop-primary
      maximum-pool-size: 10
      connection-timeout: 3000
      max-lifetime: 900000
      leak-detection-threshold: 20000
```

⚠️ **HikariCP's README carries a note aimed exactly at this file:** *"Spring
Boot auto-configuration users, you need to use `jdbcUrl`-based configuration."*
HikariCP itself recommends `dataSourceClassName` over a URL, but Boot's
`spring.datasource.url` is the URL path, and mixing the two produces a startup
failure rather than a merge.

## The same thing without Spring

```java
var config = new HikariConfig();
config.setJdbcUrl("jdbc:postgresql://db.internal:5432/shop");
config.setUsername("shop_app");
config.setPassword(System.getenv("DB_PASSWORD"));
config.setPoolName("shop-primary");
config.setMaximumPoolSize(10);

try (var ds = new HikariDataSource(config)) {   // HikariDataSource is Closeable
    // ... use ds ...
}                                               // shuts the pool down
```

🔴 **One pool per application, held for the life of the application.** A
`HikariDataSource` created inside a method, or per request, is worse than no pool
at all: you pay the connection cost *and* the pool's startup cost every time.

## Gotchas

**⚠️ Treating the returned object as the driver's connection**
**Symptom:** a cast to `org.postgresql.jdbc.PgConnection` throws
`ClassCastException`, and a driver-specific method is not visible.
**Cause:** you are holding `HikariProxyConnection`, not the driver's class.
**Fix:** `connection.unwrap(PGConnection.class)` — the standard JDBC escape
hatch. Never hold the unwrapped object beyond the `try` block; the pool still
owns it.

**⚠️ Creating a `HikariDataSource` per request or per call**
**Symptom:** connection counts on the database climb and never settle; latency
is worse than with no pool.
**Cause:** each pool opens its own connections and starts its own housekeeping
threads.
**Fix:** one pool, created once, injected everywhere. In Boot this is automatic
— do not build a second one by hand.

**⚠️ Using the connection after the `try` block**
**Symptom:** `SQLException` reporting a closed connection on a line that looks
fine.
**Cause:** the proxy was detached at `close()`; the physical connection has been
handed to another thread by now.
**Fix:** never let a `Connection`, `Statement` or `ResultSet` escape the method
that borrowed it. Map rows before returning
([topic 01 chunk 18](../01-jdbc/16-mapping-rows-to-objects.md)).

**⚠️ Relying on `close()` to roll back**
**Symptom:** works with HikariCP, breaks the day someone swaps the pool or code
runs on a raw connection.
**Cause:** the JDBC specification calls the result of closing with an open
transaction *implementation-defined*.
**Fix:** commit or roll back in the code that began the transaction.

**⚠️ Mixing `spring.datasource.url` with `spring.datasource.hikari.data-source-class-name`**
**Symptom:** the application fails to start with a configuration error about
both being set.
**Cause:** the two configuration styles are alternatives, not layers.
**Fix:** under Boot, use the URL form, as HikariCP's own README instructs.

**⚠️ Assuming the pool validates every connection on every borrow**
**Symptom:** an occasional stale-connection error slips through after a network
event.
**Cause:** HikariCP skips the aliveness check if the connection was last used
within a short window (500 ms by default, `com.zaxxer.hikari.aliveBypassWindowMs`)
— a deliberate optimisation, since a connection used moments ago is almost
certainly still good.
**Fix:** this is the right trade-off; the tools for genuinely stale connections
are `maxLifetime` and `keepaliveTime`, in [chunk 4](04-the-six-clocks.md).

## Interview questions

**★ What does a connection pool actually save you?**
The cost of *opening* connections, paid repeatedly. Opening a PostgreSQL
connection means a TCP handshake, usually a TLS handshake, a multi-round-trip
authentication exchange and a forked backend process on the server. A pool opens
a small fixed number of those once and lends them out, so a request pays the
handshake cost zero times instead of once. It does not make an individual open
any faster, and it does not make queries faster. A secondary and equally
important benefit is that it puts a *ceiling* on how many connections your
application can hold, which protects the database from being flooded.

**★ What does `close()` do on a pooled connection?**
It returns the connection to the pool. The object you hold is a proxy — the JDK
documentation for `PooledConnection` calls it a *handle* — so closing it detaches
the handle and recycles the physical connection rather than destroying it. In
HikariCP specifically, `close()` also closes any statements you left open,
cancels the leak timer, rolls back if a transaction is in flight and autocommit
is off, resets any connection settings you changed, clears warnings and puts the
entry back in the pool. The physical connection is only really closed when the
pool retires it or the pool itself shuts down.

**★ If `close()` does not close anything, why still use try-with-resources?**
Because `close()` is how the connection gets *returned*, and returning it is
mandatory. A pool has a fixed number of connections; failing to return one
permanently reduces the pool by one. Do it on enough code paths and the pool
empties and every request starts failing — usually on threads that have nothing
to do with the bug. So try-with-resources is not a tidy-up habit here, it is the
mechanism by which the pool keeps working.

**★ Why does Spring Boot use HikariCP, and how would you change it?**
Boot's documented algorithm is HikariCP first — the reference says *"We prefer
HikariCP for its performance and concurrency. If HikariCP is available, we always
choose it"* — then the Tomcat pooling `DataSource`, then Commons DBCP2, then
Oracle UCP. The JDBC and JPA starters put HikariCP on the classpath, so the first
branch normally applies. You override the choice with
`spring.datasource.type=<the DataSource class>`, which matters most inside a
Tomcat container, where `tomcat-jdbc` is present by default.

**★ How do you reach a driver-specific method through the pool?**
Use `Connection.unwrap()`, the standard JDBC mechanism for getting past a
wrapper — for example `c.unwrap(PGConnection.class)` to reach pgJDBC's
`getNotifications()` or its `CopyManager`. The important discipline is scope: the
unwrapped object is the pool's property, not yours. Use it inside the same
try-with-resources block and never store it, because the moment you return the
proxy the physical connection belongs to another thread.

**★ Where should the `DataSource` live in the application?**
As a single long-lived bean, created at startup and shut down with the
application. Anything that needs the database holds the `DataSource`, never a
`Connection` — that is the rule from
[topic 01 chunk 4](../01-jdbc/04-connection-is-expensive.md), and pooling does not
change it. Creating a pool per request or per call is the worst of both worlds:
you pay the connection cost anyway, plus the pool's own thread and housekeeping
setup, and the connection count on the database grows without bound.

---

Index: [Connection pooling with HikariCP](README.md) · Next → [2 · Why a small pool is faster](02-why-a-small-pool-is-faster.md)
