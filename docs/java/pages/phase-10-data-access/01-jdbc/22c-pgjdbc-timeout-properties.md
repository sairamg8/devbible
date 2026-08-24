---
title: "Every timeout pgJDBC ships is either off by default or measured in a unit you did not expect"
sidebar_label: "22c · pgJDBC's timeout properties"
sidebar_position: 24
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the pgJDBC documentation *Initializing the Driver →
> Connection Parameters* (jdbc.postgresql.org/documentation/use/), the JDK 25 API
> for `java.sql.Statement` and `java.sql.Connection`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/), and the pgjdbc source at
> tag `REL42.7.13` (`PGStream.java`, `QueryExecutorBase.java`). JDK 25, JDBC 4.3,
> PostgreSQL 18, pgjdbc 42.7.13.

**The JDBC API's timeouts have to be set in code, on objects a framework often
owns. pgJDBC's own timeouts are *configuration* — they arrive with the connection,
apply to every statement the driver creates, and reach code you cannot edit. That
makes them the more powerful lever of the two, and the reason this chunk exists
separately. It also makes their defaults a security-of-availability problem:
`socketTimeout` is `0`, `loginTimeout` is `0`, `queryTimeout` is `0` and
`tcpKeepAlive` is `false`, so a driver installed and pointed at a database has no
read timeout, no bound on authentication, no default statement bound, and no way
to notice a connection that was silently discarded by a firewall. Three of them
are counted in seconds while the JDBC methods they shadow are counted in
milliseconds.**

## The driver's own socket knobs

Every one of these is documented on the pgJDBC *Connection Parameters* page, with
the default shown:

| Property | Default | Documented behaviour |
|---|---|---|
| `socketTimeout` | **`0`** | "used for socket read operations. If reading from the server takes longer than this value, the connection is closed." |
| `connectTimeout` | `10` | "used for socket connect operations. If connecting to the server takes longer than this value, the connection is broken." |
| `loginTimeout` | `0` | "Specify how long to wait for establishment of a database connection. The timeout is specified in seconds" |
| `cancelSignalTimeout` | `10` | "Cancel command is sent out of band over its own connection, so cancel message can itself get stuck. This property controls 'connect timeout' and 'socket timeout' used for cancel commands." |
| `queryTimeout` | `0` | "The timeout value in seconds that the driver will wait for a query to execute if not explicitly set by `Statement.setQueryTimeout(int)`." |
| `tcpKeepAlive` | **`false`** | "Enable or disable TCP keep-alive probe." |

🔴 **`queryTimeout` as a connection property is the most useful under-known
setting on this page.** It gives every statement on the connection a default query
timeout without a line of application code — which is the only realistic way to
bound statements issued by an ORM, a framework health check, a metrics exporter,
or any library you do not own and cannot reach into.

⚠️ **`connectTimeout` and `loginTimeout` are not the same thing.**
`connectTimeout` bounds the TCP connect only. `loginTimeout` bounds establishment
of the database connection overall, which includes TLS negotiation and the
multi-round-trip SCRAM exchange ([chunk 4](04-connection-is-expensive.md)). A
`connectTimeout` of 10 with `loginTimeout` at its default of 0 leaves
authentication unbounded — a server that completes the TCP handshake and then
stalls will hold your thread indefinitely.

⚠️ **`cancelSignalTimeout` bounds the cancel itself**, because the cancel travels
over its own fresh connection and that connection can hang too. If the network
problem is what caused the timeout, the cancel is going through the same broken
network. [How cancellation works](22f-how-cancellation-works.md) is about why
that matters.

## `tcpKeepAlive` is off, and that is a third failure mode

`socketTimeout` catches "the server accepted my query and stopped answering".
TCP keep-alive catches something different: a connection that has been silently
blackholed by a NAT gateway or firewall that dropped its state-table entry while
the connection sat idle in the pool. No data is expected in either direction, so
no read timeout can fire; the connection simply looks fine until somebody uses it.

pgJDBC documents the default as `false`. Turning it on does not replace
`socketTimeout` — the two catch different failures — and its timing is governed by
OS-level `tcp_keepalive_*` settings rather than by JDBC, so treat it as a coarse
safety net rather than a bound you can reason about precisely.


## Where a property can come from, and which one wins

Three places, one documented precedence rule, and it is the opposite of what most
people guess:

```java
// 1 — in the URL
"jdbc:postgresql://db:5432/shop?socketTimeout=30&queryTimeout=8"

// 2 — in a Properties object
Properties p = new Properties();
p.setProperty("socketTimeout", "30");
DriverManager.getConnection(url, p);

// 3 — as DataSource setters
pgSimpleDataSource.setSocketTimeout(30);
```

🔴 pgJDBC states it plainly: **"If a property is specified both in URL and in
`Properties` object, the value from `Properties` object is ignored."** The URL
wins. So a `DataSource` whose `socketTimeout` you set in code, pointed at a URL
that also sets it, silently uses the URL's value — and in a container platform the
URL is usually written by a different team than the code. [Chunk
3](03-the-jdbc-url.md) has the full precedence story; the reason it recurs here is
that timeouts are the properties most often set in both places, because they are
the ones people reach for during an incident.

## The one that reaches code you do not own

Almost every timeout discussion assumes you can edit the call site. Very often you
cannot: the statement is created by an ORM, a Spring health indicator, a metrics
exporter, a Liquibase lock check, or a library whose source you have never opened.
`Statement.setQueryTimeout` is unreachable in all of those.

`queryTimeout` as a *connection property* is the answer, and it is documented in
exactly the default-with-override shape you want:

> "The timeout value in seconds that the driver will wait for a query to execute
> if not explicitly set by `Statement.setQueryTimeout(int)`. A value of 0 means no
> timeout."

The driver applies it to every statement it creates; code that genuinely needs a
different bound still calls the setter and wins. One line of configuration bounds
every query in the process, including the ones you did not write.

⚠️ **It is still a client-side bound**, so it stops you waiting and does not stop
the server working — see [the server's own
timeouts](22d-server-side-timeouts.md). Treat it as the floor of your defences,
not the whole of them, and see [the server's own
timeouts](22d-server-side-timeouts.md) for the full stack these properties belong
in and the order the layers have to be set in.

## Gotchas

**⚠️ Setting `socketTimeout` in the URL *and* `setNetworkTimeout` in code**
**Symptom:** one of them appears to have no effect, and which one depends on the
environment.
**Cause:** they are the same knob — both end at `Socket.setSoTimeout` — with
different units, and pgJDBC documents that a property present in both the URL and
a `Properties` object takes the URL's value.
**Fix:** pick one owner. If the deployment platform supplies the URL, keep
connection tuning out of the code entirely ([chunk 3](03-the-jdbc-url.md)).

**⚠️ Shipping with `socketTimeout` at its default**
**Symptom:** during a partition or a failover, threads parked in a socket read for
minutes with no exception ever thrown.
**Cause:** the documented default is `0` — no read timeout at all.
**Fix:** set it, comfortably above your slowest legitimate statement. The JDK's
own javadoc names the fallback you are relying on otherwise: the OS TCP timeout,
"typically 10 minutes".

**⚠️ `connectTimeout` set, `loginTimeout` left at 0**
**Symptom:** connection acquisition hanging against a server that accepts TCP and
then stalls during TLS or SCRAM.
**Cause:** `connectTimeout` bounds only the socket connect, and its default of 10
gives false reassurance. Authentication is a separate multi-round-trip phase whose
default bound is "forever".
**Fix:** set `loginTimeout` too, above `connectTimeout`, and remember it covers
the whole establishment including TLS.

**⚠️ Assuming a number is seconds because the one next to it is**
**Symptom:** a `socketTimeout` of `30000`, meaning eight hours.
**Cause:** pgJDBC's socket properties are seconds; `Connection.setNetworkTimeout`
is milliseconds; PostgreSQL GUCs are milliseconds without a unit suffix; Hikari's
properties are milliseconds.
**Fix:** never copy a number between layers. Write the units in a comment beside
every value, as in the snippet above, and prefer unit-suffixed literals (`'5s'`)
wherever the syntax allows them.

**⚠️ No `queryTimeout` property, only per-statement calls**
**Symptom:** the hand-written DAOs are bounded and the ORM, the health check and
the metrics exporter are not — discovered when one of the unbounded ones hangs.
**Cause:** `Statement.setQueryTimeout` is reachable only at call sites you own.
**Fix:** set the `queryTimeout` connection property as the default and treat
per-statement calls as deliberate overrides.

**⚠️ `cancelSignalTimeout` forgotten**
**Symptom:** a query timeout that itself hangs — the thread the cancel was
supposed to release is now blocked waiting for the cancel to finish.
**Cause:** the cancel travels over its own fresh connection, and pgJDBC says so
outright: "cancel message can itself get stuck". If a network fault caused the
timeout, the cancel is crossing the same faulty network.
**Fix:** leave it at its default of 10 or lower, and understand that the cancel
path is a second, independent point of failure
([chunk 25](22f-how-cancellation-works.md)).

**⚠️ `tcpKeepAlive` left at `false`**
**Symptom:** a connection silently dropped by a NAT gateway or firewall during an
idle period; nothing notices until a read hangs or fails oddly on next use.
**Cause:** the documented default is `false`, and an idle connection generates no
traffic for a read timeout to bound.
**Fix:** set it to `true`, and keep `maxLifetime` short enough that long-idle
connections are recycled regardless. Its timing comes from OS-level
`tcp_keepalive_*` settings, so it is a safety net, not a bound you can reason
about precisely.

**⚠️ Percent-encoding forgotten in `options`**
**Symptom:** a connection that fails to open, or server settings that silently do
not apply, when `options` is used to push GUCs from the URL.
**Cause:** `options` separates arguments with spaces, and a space in a URL must be
percent-encoded — as must `=`, which is why the value looks like
`-c%20statement_timeout%3D5000`.
**Fix:** build the URL programmatically with proper encoding, or set the GUCs with
`ALTER ROLE` instead ([the server's own timeouts](22d-server-side-timeouts.md)).

**⚠️ Tuning timeouts without setting `ApplicationName`**
**Symptom:** a `pg_stat_activity` full of backends running the query that keeps
timing out, and no way to say which service owns them.
**Cause:** the property was never set, so every connection is identified only by
database user and client IP.
**Fix:** set it on every service. Timeout tuning is an operational exercise, and
it is unworkable when server-side load is anonymous.

**⚠️ Treating pool `connectionTimeout` as a database timeout**
**Symptom:** a "2-second timeout" in a config file that turns out to bound nothing
about the database at all, while queries run for minutes.
**Cause:** HikariCP's `connectionTimeout` bounds acquisition of a pool slot.
**Fix:** know which of the four "connection timeout" names you are reading.
Pool-slot starvation, TCP connect, login, and socket read are four different
incidents with four different remedies.

## Interview questions

**★ Why is a timeout set as a connection property more useful than the same
timeout set through the JDBC API?**
Because it reaches code you do not own. `Statement.setQueryTimeout` has to be
called at the site where the statement is created, and in a real service a large
fraction of statements are created by an ORM, a framework health indicator, a
migration tool's lock check or a metrics exporter — none of which you can edit and
several of which you may not know exist. pgJDBC's `queryTimeout` property is
documented as the value "the driver will wait for a query to execute if not
explicitly set by `Statement.setQueryTimeout(int)`", so the driver applies it to
every statement it manufactures while leaving explicit calls to win. It is one
line of configuration that bounds the whole process. The same argument applies to
`socketTimeout` versus `setNetworkTimeout`.

**★ You set `socketTimeout` on your `DataSource` and it has no effect. Why?**
Because the same property is present in the JDBC URL. pgJDBC documents the
precedence explicitly — if a property is specified both in the URL and in a
`Properties` object, the value from the `Properties` object is ignored — so the
URL wins. This bites hardest exactly where it is hardest to see: the URL is
usually supplied by the deployment platform and the code sets what it believes are
defaults, so the two halves are owned by different people and neither can read the
other's value. The fix is to decide which layer owns connection tuning and keep
the other silent; if the platform owns the URL, put nothing in it but host, port
and database, or put everything in it and nothing in the code.

**★ Walk through pgJDBC's timeout properties and their defaults.**
`connectTimeout`, default 10 seconds, bounds the TCP connect. `loginTimeout`,
default 0, bounds establishment of the database connection overall — TLS
negotiation and the multi-round-trip SCRAM exchange included — so at its default
authentication is unbounded even though the connect is not. `socketTimeout`,
default 0, is the socket read timeout, and on expiry the driver closes the
connection. `queryTimeout`, default 0, is the per-statement default the driver
applies when the application has not called `setQueryTimeout`. `cancelSignalTimeout`,
default 10, bounds the separate connection a cancel is sent over. And
`tcpKeepAlive`, default false, enables keep-alive probes. Four of the six ship
disabled, which is the summary: pgJDBC's out-of-the-box posture is to wait
indefinitely.

**★ How many different things in a typical stack are called some variant of
"connection timeout", and what does each bound?**
Four. pgJDBC's `connectTimeout` bounds the TCP connect. pgJDBC's `loginTimeout`
bounds the whole establishment of the database connection, including TLS and
authentication. `Connection.setNetworkTimeout` — a JDBC method, in milliseconds —
bounds how long you wait for a reply to any one request, and destroys the
connection on expiry. And HikariCP's `connectionTimeout` bounds how long a caller
waits for a free slot in the pool, which involves neither the network nor the
database. They fail in four distinguishable ways and need four different remedies,
and a stack that has set only the first has an unbounded authentication phase, no
read timeout and no bound on pool starvation.

**★ Why does `maxLifetime` belong in a discussion about timeouts?**
Because two of PostgreSQL's server-side timeouts terminate the *session* rather
than a statement — `idle_in_transaction_session_timeout` and
`idle_session_timeout` — and a terminated session is invisible to a JDBC client
until the socket is next used. The connection sits in the pool looking idle and
healthy and fails on the next borrow, in code that has nothing to do with whatever
left it idle. Nothing on the client side detects this proactively unless you make
it: `tcpKeepAlive` gives you a coarse probe, and a `maxLifetime` comfortably below
the server's idle bounds guarantees the pool recycles the connection before the
server kills it. Timeout configuration that stops at the driver's properties has
this hole in it.

**★ Why does `cancelSignalTimeout` exist at all?**
Because PostgreSQL's cancellation is sent out of band, on a brand-new connection
to the server, rather than down the busy one — the protocol documentation explains
that the backend deliberately does not watch its client socket during query
processing. pgJDBC's documentation is explicit about the consequence: "Cancel
command is sent out of band over its own connection, so cancel message can itself
get stuck." So a query timeout can hang inside its own cancel. Worse, the
circumstances that make a cancel necessary — a slow or broken network — are
exactly the circumstances that make opening a second connection slow or
impossible. `cancelSignalTimeout` bounds both the connect and the read on that
second connection, and its default of 10 seconds is a value you might reasonably
lower.

---
<!--FOOTER-->
