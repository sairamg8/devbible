---
title: "JDBC is a set of interfaces you never implement and a driver you never read"
sidebar_label: "1 · What JDBC actually is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the JDK 25 API for `java.sql.DriverManager`,
> `java.sql.Driver` and `java.sql.Connection`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/), and the pgJDBC
> documentation *Initializing the Driver*
> (jdbc.postgresql.org/documentation/use/). JDK 25, JDBC 4.3, PostgreSQL 18,
> pgjdbc 42.7.13.

**JDBC is two things that people constantly confuse. It is a *specification* —
a package of interfaces in `java.sql` and `javax.sql` that the JDK ships and
nobody at Oracle implements — and it is a *driver*, a third-party jar that
implements those interfaces by speaking a specific database's wire protocol.
`Connection`, `PreparedStatement` and `ResultSet` are all interfaces. Every
object you touch at runtime is a pgJDBC class you have never heard of, reached
through a type that promises far less than the implementation actually does.
Almost every JDBC surprise in production comes from that gap: the interface
documents a portable minimum, the driver does something specific, and the
behaviour you get is the driver's, not the specification's. Reading a page of
`java.sql` javadoc and concluding you know what will happen is the single most
common way to be wrong about this layer.**

## The two packages, and why there are two

| Package | What lives there | Who calls it |
|---|---|---|
| `java.sql` | `Driver`, `DriverManager`, `Connection`, `Statement`, `PreparedStatement`, `CallableStatement`, `ResultSet`, `SQLException`, the type constants | application code |
| `javax.sql` | `DataSource`, `ConnectionPoolDataSource`, `PooledConnection`, `XADataSource`, `RowSet` | containers, pools, application servers |

The split is historical but it still tells you something useful. `java.sql` is
the API you *use*; `javax.sql` is the API that *middleware* implements so that
something else can hand you a `java.sql.Connection` with extra behaviour
attached. HikariCP is a `javax.sql.DataSource` implementation. That is the whole
of its relationship to JDBC — see **Topic 02 — Connection pooling with HikariCP**
*(not written yet)*.

⚠️ Both packages live in the **`java.sql` module**, not `java.base`. On a modular
application you need `requires java.sql`, and on a `jlink` image you need the
module in the resolved set or your driver will not load at runtime with an error
that looks nothing like a missing module.

## Everything you touch is an interface

```java
Connection c = dataSource.getConnection();
// c is org.postgresql.jdbc.PgConnection — but you can only see Connection
```

That has three consequences worth internalising before anything else on this
page:

1. **The javadoc is a contract, not a description.** `Statement.setFetchSize`
   says "gives the JDBC driver a hint". A hint. What pgJDBC does with it is
   documented on a completely different site, and it is
   [chunk 12](15-fetch-size-and-streaming.md)'s subject because the answer is
   surprising.
2. **Driver-specific behaviour is reached by casting or by a connection
   property.** `((org.postgresql.PGStatement) ps).setPrepareThreshold(1)` is a
   real thing you will occasionally need to write, and it means your code no
   longer compiles against a different database. Prefer the URL property when
   one exists.
3. **"Portable JDBC" is mostly a myth you should stop paying for.** Writing SQL
   that runs on PostgreSQL and Oracle unchanged costs you `RETURNING`, arrays,
   `ON CONFLICT`, `SKIP LOCKED`, JSONB and `generate_series`. This bible targets
   PostgreSQL and uses PostgreSQL's SQL deliberately.

## The four driver types, and why only one still exists

Every JDBC textbook lists four driver types. Three of them are museum pieces,
and the only reason to know the list is so that "Type 4" means something when a
vendor's README says it:

| Type | How it works | Status |
|---|---|---|
| 1 | JDBC-ODBC bridge — delegates to a native ODBC driver | removed from the JDK in Java 8 |
| 2 | Java wrapper over a native client library (OCI, libpq) | needs a platform binary on every host; essentially dead |
| 3 | Java client talking to a middleware server that talks to the database | an extra network hop and an extra thing to operate; dead |
| 4 | **Pure Java, speaks the database's wire protocol directly** | what every modern driver is |

pgJDBC is Type 4: a jar with no native code that implements PostgreSQL's
frontend/backend protocol over a socket. That is why it works identically on
Linux, macOS, a container image and a GraalVM native image, and why "install the
Oracle client on the app servers" is a sentence from a previous era.

## Driver registration: why `Class.forName` is dead and still everywhere

The single most-copied line of JDBC code on the internet is this one, and it has
been unnecessary since JDBC 4.0 (Java 6, 2006):

```java
Class.forName("org.postgresql.Driver");   // ❌ unnecessary since JDBC 4.0
```

The `DriverManager` javadoc states what actually happens. As part of its
initialization it attempts to load available drivers using the `jdbc.drivers`
system property — "a colon separated list of fully qualified class names of JDBC
drivers" — and **"Service providers of the `java.sql.Driver` class, that are
loaded via the service-provider loading mechanism."**

That second bullet is the whole mechanism. pgJDBC's jar contains
`META-INF/services/java.sql.Driver` with one line naming `org.postgresql.Driver`.
`ServiceLoader` finds it. pgJDBC's own documentation says the same thing from the
other side: **"Applications do not need to explicitly load the
`org.postgresql.Driver` class"**, and describes `Class.forName` and
`-Djdbc.drivers=` as what "worked prior to Java 1.6".

So why does the line survive? Three reasons, all of them worth recognising:

- **It is harmless when the jar is present**, so nobody ever finds out it does
  nothing. Deleting it changes no behaviour, which is exactly why it never gets
  deleted.
- **It "fixes" a missing driver with a better error.** `ClassNotFoundException:
  org.postgresql.Driver` is a much clearer message than `No suitable driver found
  for jdbc:postgresql://...`, which is what `DriverManager` throws when nothing
  registered. People learned the line as the fix for the second message.
- **A handful of environments genuinely still need it.** The javadoc's
  implementation note says driver initialization "looks up service providers
  using the thread context class loader", and that "the drivers loaded and
  available to an application will depend on the thread context class loader of
  the thread that triggers driver initialization". In a container with an unusual
  class-loader hierarchy — some OSGi setups, some legacy application servers —
  the TCCL at initialization time may not see the driver jar. That is a real
  scenario and the reason the API still accepts the old approach.

⚠️ **`DriverManager` initialization is lazy and happens once.** If the first
thread ever to touch `DriverManager` has the wrong context class loader, the
result is sticky for the life of the JVM. If you meet "No suitable driver found"
in a container and the jar is demonstrably on the classpath, that is the
mechanism to suspect — not a typo in the URL.

## What a JDBC version actually buys you

JDBC 4.3 is the current maintenance release of the specification (JSR 221) and
ships in the JDK. The versions worth remembering by what they added:

| Version | Java | The thing you actually use from it |
|---|---|---|
| 4.0 | Java 6 | automatic driver loading via `ServiceLoader`; the `SQLException` subclass tree |
| 4.1 | Java 7 | try-with-resources support (`Connection`/`Statement`/`ResultSet` became `AutoCloseable`) |
| 4.2 | Java 8 | `getObject(int, Class<T>)`, `java.time` mapping, `executeLargeUpdate` |
| 4.3 | Java 9 | `Connection.beginRequest`/`endRequest`, sharding hints |

🔴 **4.1 and 4.2 are the two that changed how the code looks.** Everything on
[chunk 14](17-resource-handling.md) is 4.1; the typed accessor argument on
[chunk 9](12-resultset-the-cursor-model.md) and the `java.time` mapping on
[chunk 11](14-dates-times-and-timestamptz.md) are 4.2. A codebase still using
`getTimestamp` into a `java.util.Date` and closing in `finally` is not wrong so
much as fifteen years behind.

## Gotchas

**⚠️ Copying `Class.forName` into new code because every tutorial has it**
**Symptom:** a line in a code review that nobody can justify and nobody deletes.
**Cause:** the tutorials predate JDBC 4.0 and were never updated.
**Fix:** delete it. If it turns out to be load-bearing, you have discovered a
class-loader problem, which is a much more interesting finding than a missing
line.

**⚠️ "No suitable driver found" read as a URL problem**
**Symptom:** hours spent checking the connection string.
**Cause:** `DriverManager` had no registered driver that accepts that URL —
usually the jar is missing, is `provided` scope, or was not visible to the
thread context class loader at initialization.
**Fix:** check the jar is in the runtime classpath first; check the URL scheme
second. Both are real causes and they produce the same message.

**⚠️ Assuming the javadoc describes what your driver does**
**Symptom:** `setFetchSize(1000)` set on PostgreSQL, and the heap still fills.
**Cause:** the interface documents a hint and a portable minimum; the driver
decides.
**Fix:** read the *driver's* documentation for anything performance- or
resource-related. It is a different site and it is the authoritative one.

**⚠️ Missing `requires java.sql` on a modular application**
**Symptom:** compiles in the IDE, fails at runtime on a jlink image.
**Cause:** `java.sql` is a separate module and is not in the default resolved
set for a custom image.
**Fix:** declare the requirement and include the module in the image.

**⚠️ Casting to a `PG*` type in shared library code**
**Symptom:** the module cannot be reused against another database, and the
`ClassCastException` shows up only under a pooled/wrapped connection.
**Cause:** a pool hands you a *proxy*, so the object may not be the driver class
you expected.
**Fix:** use `Connection.unwrap(PGConnection.class)` — that is exactly what
`java.sql.Wrapper` exists for — and prefer a connection property when the same
setting is reachable that way.

## Interview questions

**★ What is JDBC, precisely?**
It is a specification — a set of interfaces in `java.sql` and `javax.sql` that
the JDK ships — plus a driver that implements them for a particular database.
The JDK contains almost no implementation: `DriverManager` is a registry,
`SQLException` is a class, the type constants are constants, and everything else
you actually call is an interface that a vendor jar implements. The practical
consequence is that the javadoc tells you the portable contract and the driver's
own documentation tells you the behaviour, and when they seem to disagree the
driver wins.

**★ Why don't you need `Class.forName("org.postgresql.Driver")` any more?**
Because JDBC 4.0 made driver registration a `ServiceLoader` concern.
`DriverManager`'s javadoc says it loads service providers of `java.sql.Driver`
via the service-provider mechanism, and pgJDBC ships a
`META-INF/services/java.sql.Driver` file naming its driver class. So merely
having the jar on the classpath registers it. The one genuine exception is a
class-loader environment where the thread context class loader at
`DriverManager` initialization time cannot see the driver jar — the javadoc
explicitly warns that the available drivers depend on that class loader — which
is why the old mechanism is still supported rather than removed.

**★ What is a Type 4 driver and why does the distinction still get mentioned?**
A Type 4 driver is pure Java and speaks the database's wire protocol directly
over a socket, with no native library and no middleware. Types 1 through 3 —
the ODBC bridge, the native-client wrapper, and the middleware-server model —
all required something installed outside the JVM, and all are effectively dead;
the JDBC-ODBC bridge was removed from the JDK in Java 8. The distinction still
appears because vendor documentation uses the term, and because it is the reason
a modern Java application can connect to PostgreSQL from a scratch container
with nothing but a jar.

**★ Your service throws "No suitable driver found" in production but works
locally. Where do you look?**
At the classpath and the class loader, in that order, not at the URL. The
message means `DriverManager` had no registered `Driver` whose `acceptsURL`
returned true, and the two ordinary causes are that the driver jar is not on the
runtime classpath — a `provided` or `compileOnly` scope that the local run
happened to satisfy differently — or that the driver was not visible through the
thread context class loader when `DriverManager` initialized. That second one is
sticky for the JVM's lifetime because initialization is lazy and happens once,
and it is the reason `Class.forName` still occasionally "fixes" things in
application servers and OSGi containers.

**★ Why is `DataSource` in `javax.sql` and `Connection` in `java.sql`?**
Because `java.sql` is the API applications call and `javax.sql` is the API that
middleware implements on the application's behalf. A connection pool, an
application server or an XA transaction manager implements
`javax.sql.DataSource`, `ConnectionPoolDataSource` or `XADataSource`, and what it
hands back is a plain `java.sql.Connection`. That separation is what lets
HikariCP be invisible to your repository code: the repository sees the same
interface whether the connection came from a pool, from a driver directly, or
from a test double.

---

← Prev: [Phase 9 — Spring Boot and the web](../../phase-9-spring-boot/README.md) · Index: [JDBC](README.md) · Next → [`DataSource`, not `DriverManager`](02-datasource-not-drivermanager.md)
