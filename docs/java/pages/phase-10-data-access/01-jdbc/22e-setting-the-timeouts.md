---
title: "Every layer must be strictly larger than the one it backstops, or the destructive one fires first"
sidebar_label: "22e · Setting the timeouts"
sidebar_position: 26
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the PostgreSQL 18 manual *Client Connection Defaults*
> (postgresql.org/docs/18/runtime-config-client.html) and *Error Codes*
> (.../errcodes-appendix.html), the pgJDBC *Connection Parameters* documentation
> (jdbc.postgresql.org/documentation/use/), and the JDK 25 API for
> `java.sql.Connection.setNetworkTimeout`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/). JDK 25, JDBC 4.3,
> PostgreSQL 18, pgjdbc 42.7.13.

**Knowing what each timeout does is half the job; the other half is arranging them
so that when something goes wrong the *gentlest* applicable one fires first. Every
layer in the stack is more destructive than the one inside it — a lock timeout
loses a statement, a statement timeout loses a transaction, a socket timeout loses
the connection and forks a replacement backend on a database that was already
struggling. Get the order wrong by one step and a mild slowdown becomes a
connection storm. The second half of the job is scope: PostgreSQL gives you four
places to set a server-side bound, and the manual explicitly tells you not to use
the one everybody reaches for first.**

## Four scopes, and the one the manual tells you not to use

The manual repeats the same warning on `statement_timeout`, `lock_timeout` and
`transaction_timeout`: **"Setting `statement_timeout` in `postgresql.conf` is not
recommended because it would affect all sessions."** All sessions means your
migrations, your `CREATE INDEX`, your `VACUUM`, your backups and your on-call
`psql`. The four usable scopes, broadest first:

```sql
-- 1. per role — the sharpest structural tool: the OLTP role is bounded,
--    the migration role deliberately is not
ALTER ROLE checkout_app SET statement_timeout = '5s';
ALTER ROLE checkout_app SET lock_timeout = '2s';
ALTER ROLE checkout_app SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE reporting SET statement_timeout = '10min';

-- 2. per database
ALTER DATABASE shop SET statement_timeout = '30s';
```

```
# 3. per connection, from the JDBC URL. pgJDBC documents `options` with the
# example "-c statement_timeout=5min"; spaces and `=` need percent-encoding
jdbc:postgresql://db:5432/shop?options=-c%20statement_timeout%3D5000%20-c%20lock_timeout%3D2000
```

```java
// 4. per transaction — the only variant that cannot leak
c.setAutoCommit(false);
try (Statement s = c.createStatement()) {
    s.execute("SET LOCAL statement_timeout = 250");   // ms; undone at commit
    runTheOneQueryThatMustBeFast(c);
    c.commit();
}
```

🔴 **`SET` without `LOCAL` survives being returned to the pool.** This is
[chunk 4](04-connection-is-expensive.md)'s session-state problem in its most
dangerous costume, because the symptom lands on an unrelated request: a report
endpoint sets `statement_timeout = '10min'`, returns the connection, and the
checkout endpoint that borrows it next has silently lost its five-second bound and
will not find out until an incident. `SET LOCAL` is undone at commit; prefer it
always, and reserve plain `SET` for a connection you are about to discard.

⚠️ **Prefer `ALTER ROLE` over `options` where you can.** Both work, but the URL
form puts an operational policy in a string that also contains the hostname and is
often owned by a different team ([chunk 3](03-the-jdbc-url.md)), while `ALTER
ROLE` keeps it in the database, applies to `psql` sessions using the same role,
and survives someone rewriting the connection string.

## The ordering rule

Working outward from the cheapest failure to the most expensive:

```
lock_timeout  <  statement_timeout  <  client queryTimeout  <  socketTimeout
   (2s)               (5s)                   (8s)                  (30s)
   55P03              57014                  57014                 08006
   retry              fix the query          cancel round trip     connection dies
```

- **`lock_timeout` first**, so "I could not get the lock" is distinguishable from
  "the query was too slow". Different SQLStates, different retry policy.
- **`statement_timeout` next**, because it is the only bound that survives the
  client disappearing, and because a server-side abort leaves the session alive.
- **The client `queryTimeout` above it**, so in the normal case the server wins the
  race and you never pay for a cancel round trip. If the client fires first you
  get an extra connection opened to carry the cancel signal, for no benefit.
- **`socketTimeout` and the network timeout far above everything**, because they
  are the partition detector, not the slow-query detector. The javadoc's own
  instruction: they "should be given a high enough value so it is never triggered
  before any more normal timeouts."

⛔ **Inverting the last two is the classic misconfiguration.** With
`socketTimeout=3` and `statement_timeout=10s`, every query in the three-to-ten
second band destroys its connection instead of returning an error. The pool
evicts, reopens, and PostgreSQL forks a new backend process for each replacement
([chunk 4](04-connection-is-expensive.md)) — so the database gets slower, which
pushes more queries past three seconds, which destroys more connections. The
system has a positive feedback loop in it, and it will find it under load.

🔴 **And note what the inversion costs even when it "works": the query is still
running.** Closing your socket does not abort anything server-side. A socket
timeout that fired because a query was slow has destroyed a connection *and* left
the work in progress.

## A configuration that holds together

```java
HikariConfig cfg = new HikariConfig();
cfg.setJdbcUrl("jdbc:postgresql://db:5432/shop"
    + "?connectTimeout=5"          // seconds — TCP connect
    + "&loginTimeout=10"           // seconds — connect + TLS + SCRAM
    + "&socketTimeout=30"          // seconds — read; the partition detector
    + "&cancelSignalTimeout=10"    // seconds — the cancel's own connection
    + "&queryTimeout=8"            // seconds — default bound for every statement
    + "&tcpKeepAlive=true"
    + "&ApplicationName=checkout-api");
cfg.setConnectionTimeout(2_000);   // Hikari: waiting for a POOL SLOT, not the DB
cfg.setMaxLifetime(600_000);       // below any server-side idle timeout
```

⚠️ **`HikariConfig.setConnectionTimeout` is a fourth thing with a confusingly
similar name.** It bounds how long a caller waits for a *free pool entry* and has
nothing to do with the network or the database. In this one snippet, `2_000`,
`5`, `10` and `30` are measured in two different units and describe four different
failures.

🔴 **`maxLifetime` belongs in the same conversation as the timeouts**, because two
of PostgreSQL's server-side bounds terminate the *session* rather than a statement
— and a terminated session leaves a connection in the pool that looks healthy and
fails on next borrow. Keeping `maxLifetime` comfortably under the server's idle
bounds is what closes that window.

## What each expiry leaves behind

| What expired | Statement | Transaction | Connection | Back to the pool? |
|---|---|---|---|---|
| client `queryTimeout`, network healthy | cancelled | **aborted** | usable | yes — **after `rollback()`** |
| server `statement_timeout` | aborted | **aborted** | usable | yes — **after `rollback()`** |
| server `lock_timeout` | aborted | **aborted** | usable | yes — after `rollback()` |
| `socketTimeout` / `setNetworkTimeout` | gone | gone | **marked closed** | no — the pool must evict |
| `idle_in_transaction_session_timeout` | — | terminated | **dead server-side** | no, and the pool does not know |
| `idle_session_timeout` | — | — | **dead server-side** | no, and the pool does not know |
| Hikari `connectionTimeout` | never started | never started | never borrowed | n/a — pool starvation |

🔴 **The `rollback()` in the first three rows is not optional.** After any error
inside an explicit transaction PostgreSQL puts that transaction in the aborted
state, and every subsequent statement on the connection fails with `25P02`,
`in_failed_sql_transaction`, until the transaction ends. A connection returned to
the pool in that state poisons the next borrower with an error that has nothing to
do with what they did. `try`-with-resources closes the connection but does not
roll back for you ([chunk 14](17-resource-handling.md)).

⚠️ **The bottom rows are why the pool needs `maxLifetime` and a keepalive.** A
server-side session termination is invisible to the client until the socket is
used, so the connection sits in the pool looking healthy. `tcpKeepAlive=true`
(pgJDBC's default is `false`) and a `maxLifetime` comfortably below the server's
idle bounds are what close that window.

## Gotchas

**⚠️ `statement_timeout` in `postgresql.conf`**
**Symptom:** a migration, a `CREATE INDEX`, a nightly report or a `pg_dump`
aborting partway, on a database where "we set a sensible timeout".
**Cause:** the manual's warning, ignored: it "would affect all sessions".
**Fix:** `ALTER ROLE` per application role, `options` per connection, or
`SET LOCAL` per transaction. Never globally.

**⚠️ `SET statement_timeout` on a pooled connection**
**Symptom:** an endpoint intermittently loses its bound, correlated with which
request ran on that connection previously.
**Cause:** a plain `SET` is session-scoped and survives return to the pool.
**Fix:** `SET LOCAL` inside a transaction so it is undone at commit.

**⚠️ `socketTimeout` set *below* `statement_timeout`**
**Symptom:** a mild slowdown turning into connection churn — connections destroyed
and reopened rather than statements failing cleanly.
**Cause:** the outer, destructive layer fires before the inner, graceful one. The
javadoc is explicit that a network-timeout expiry marks the connection closed.
**Fix:** strict ordering — `lock_timeout` < `statement_timeout` < client
`queryTimeout` < `socketTimeout`.

**⚠️ Client `queryTimeout` set below `statement_timeout`**
**Symptom:** extra connections opened during every slow period, and cancel
requests appearing in the server log for queries the server was about to abort
anyway.
**Cause:** the client wins the race, so pgJDBC opens a second connection to carry
a cancel signal that the server-side timeout would have produced for free.
**Fix:** put the client bound above the server bound, so the server normally wins
and the client timeout is only a backstop for the case where the server has no
bound configured.

**⚠️ Not rolling back after a `57014` or `55P03`**
**Symptom:** the next request on that pooled connection fails with an error about
a failed transaction block, in code that did nothing wrong.
**Cause:** the statement was aborted but the transaction is still open and in the
aborted state; every subsequent statement returns `25P02`.
**Fix:** roll back in a `finally` on every error path before the connection
returns to the pool.

**⚠️ Copying a timeout value from one layer to another**
**Symptom:** four layers all set to the same number, so which one fires is decided
by chance and by the order the layers are evaluated.
**Cause:** timeouts were treated as one policy instead of a graduated stack.
**Fix:** deliberately separate them, and write both the number and its unit at
every layer. Equal values are the same bug as an inverted order, without the
diagnostic clarity.

**⚠️ A single global bound for OLTP, reports, migrations and batch**
**Symptom:** either the reports fail or the OLTP path carries a ten-minute bound,
depending on which team argued most recently.
**Cause:** the timeout was set at the wrong scope.
**Fix:** separate database roles with separate `ALTER ROLE … SET
statement_timeout`, and `SET LOCAL` for the outliers. The scope hierarchy exists
precisely so that this does not have to be one number.

## Interview questions

**★ Where should `statement_timeout` be set, and where does the manual tell you
not to?**
Not in `postgresql.conf` — the manual says so explicitly for `statement_timeout`,
`lock_timeout` and `transaction_timeout`, because it "would affect all sessions",
including migrations, `VACUUM`, backups and interactive `psql`. The four usable
scopes are `ALTER ROLE … SET`, which is the best structural answer because it lets
the OLTP role be bounded while the migration role deliberately is not;
`ALTER DATABASE … SET`; the `options` connection parameter, which pgJDBC documents
with the example `-c statement_timeout=5min`; and `SET LOCAL` inside an explicit
transaction, which is the only one that cannot leak because it is undone at
commit. A plain `SET` on a pooled connection silently changes the behaviour of
whoever borrows it next.

**★ In what order should the timeouts be set, and why does the order matter?**
Strictly increasing outward: `lock_timeout` < `statement_timeout` < the client's
query timeout < `socketTimeout` / network timeout. The reason is that each outer
layer is more destructive than the one inside it. If `lock_timeout` fires first
you get `55P03` and know it was contention, which is retryable. If
`statement_timeout` fires next you get `57014`, the session survives, and after a
rollback the connection goes back to the pool cleanly. If instead the network
timeout fires first, the javadoc is explicit that the connection is marked closed
and both connection and statement become unusable — so a mild slowdown becomes
connection churn, new backend forks, and a database that gets slower under the
load you just added. The javadoc even instructs this directly: the network timeout
"should be given a high enough value so it is never triggered before any more
normal timeouts."

**★ Why should the client's query timeout sit *above* the server's
`statement_timeout` rather than below it?**
Because when the client wins the race you pay for a cancel you did not need. A
client-side timeout in pgJDBC is implemented by sending a cancel request, and that
request travels over a brand-new connection to the server — so a slow period in
which the client bound is the tighter one produces a second connection per timed
out statement, at exactly the moment the database is least able to afford new
backends. When the server bound is tighter, the server aborts the statement itself
and simply returns `57014`; no extra connection, no race, and the outcome is
identical from the application's point of view. The client bound still earns its
place as a backstop for the case where somebody deploys against a database whose
role has no `statement_timeout` configured.

**★ A connection comes back from the pool and every statement fails with an error
about a failed transaction block. What happened?**
Something aborted a statement inside an explicit transaction and the connection
was returned without a rollback. After any error in a transaction PostgreSQL puts
that transaction in the aborted state, and every subsequent statement fails with
`25P02` `in_failed_sql_transaction` until the transaction ends — so the poison
travels with the connection to whoever borrows it next, and the stack trace points
at code that did nothing wrong. The usual originators are `57014` from a statement
timeout or a cancel and `55P03` from a lock timeout, all three of which leave the
session alive and therefore reusable, which is precisely why the rollback gets
forgotten. `try`-with-resources closes the connection but does not roll back; the
rollback has to be explicit, in a `finally`, on every error path.

**★ How do you keep a pool from handing out connections the server has already
killed?**
By making sure the pool retires them first. Three of PostgreSQL's timeouts
terminate the session rather than aborting a statement, and a terminated session
is invisible to a JDBC client until the socket is next used — so the connection
sits in the pool looking idle and healthy. The mitigations are all client-side and
all preventative: set the pool's `maxLifetime` comfortably below
`idle_in_transaction_session_timeout` and `idle_session_timeout` so connections are
recycled before the server can kill them, turn on `tcpKeepAlive`, which pgJDBC
leaves `false`, so a silently dropped connection is discovered by a probe rather
than by a request, and follow the manual's own advice not to apply
`idle_session_timeout` to the application's role at all — it warns that pooling
middleware "may not react well to unexpected connection closure", and notes that
an idle session outside a transaction costs the server little anyway.

---
<!--FOOTER-->
