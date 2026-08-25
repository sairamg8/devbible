---
title: "Six of HikariCP's settings are measured in milliseconds and none of them measure the same thing"
sidebar_label: "4 · The six clocks"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the HikariCP 7.0.2 README
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP),
> raw at tag `HikariCP-7.0.2`) and its source
> (`pool/HikariPool.java`, `pool/PoolBase.java`, `HikariConfig.java`).
> JDK 25, HikariCP 7.0.2, Spring Boot 4.1.0, PostgreSQL 18.

**Six HikariCP properties are durations in milliseconds, they sit next to each
other in the documentation, and people copy them around as a block. They measure
four completely different things: how long a *thread* waits, how long a *probe*
may take, how old a *connection* may get, and how long an *unused* connection may
sit. Getting the wrong clock is not a tuning mistake — it is asking a question
the setting cannot answer. This chunk sorts them out and then goes deep on the
two that are about waiting.**

## The four kinds of clock

| Property | Default | Minimum | It measures | Whose clock |
|---|---|---|---|---|
| `connectionTimeout` | 30000 | 250 | how long a **thread** waits to be handed a connection | the borrower's |
| `validationTimeout` | 5000 | 250 | how long an **aliveness check** may take | the pool's |
| `maxLifetime` | 1800000 | 30000 | how **old** a connection may become | the connection's |
| `keepaliveTime` | 120000 | 30000 | how often an **idle** connection is pinged | the connection's |
| `idleTimeout` | 600000 | 10000 | how long an **unused** connection may sit before retirement | the connection's |
| `minimumIdle` | = `maximumPoolSize` | — | *(not a duration)* the switch that turns `idleTimeout` on at all | the pool's |

🔴 **Read the third column twice.** `connectionTimeout` is about a *thread* and
has nothing to do with connections aging. `maxLifetime` is about a *connection*
and has nothing to do with anyone waiting. They are unrelated mechanisms that
happen to be adjacent in a YAML file, and almost every confusion in this area is
a swap between the two columns.

Two more, covered in their own chunks because they answer different questions
entirely: `leakDetectionThreshold` ([chunk 6](06-leak-detection.md)) and
`initializationFailTimeout` ([chunk 8](08-starting-up-or-failing-fast.md)).

## `connectionTimeout` — how long a thread waits

> *This property controls the maximum number of milliseconds that a client
> (that's you) will wait for a connection from the pool.* ... *Lowest acceptable
> connection timeout is 250 ms. Default: 30000 (30 seconds)*

The README's entry for `maximumPoolSize` describes the other half of the same
mechanism:

> *When the pool reaches this size, and no idle connections are available, calls
> to getConnection() will block for up to `connectionTimeout` milliseconds before
> timing out.*

So the clock starts when your thread calls `getConnection()` and stops when a
connection is handed to it. Exceeding it throws
`SQLTransientConnectionException` with the pool's own numbers in the message —
[chunk 5](05-connection-is-not-available.md) reads them.

### 30 seconds is almost always wrong for a request path

🔴 **The default exists to be safe on startup, not to be right in production.**
Consider what 30 seconds means on a user-facing endpoint:

- the user's browser has probably given up;
- the load balancer has probably given up;
- your request thread is held for 30 seconds doing nothing, so *fewer* threads
  are available to serve the requests that could succeed;
- and the 500 you eventually return is 30 seconds later than the information was
  available.

The waiting is not free capacity — it is capacity spent on a request that has
already failed. A request-path pool should give up in one to three seconds:

```yaml
spring:
  datasource:
    hikari:
      connection-timeout: 2000      # a user is waiting
```

⚠️ **A batch or report pool wants the opposite.** Nobody is watching, the work is
expensive to restart, and queuing is exactly the right behaviour — 30 seconds, or
longer, is correct there. That difference in one number is a large part of
[chunk 3e's](03e-two-pools-not-one-bigger.md) argument for two pools: a single
pool can only hold one answer.

### But it must exceed the time to *make* a connection

This is the subtlety that bites during a cold start or a failover. If the pool
has no connection to give and is below `maximumPoolSize`, it creates one — and
the creation happens inside your thread's wait. Establishing a PostgreSQL
connection is a TCP handshake, usually a TLS handshake, an authentication
exchange and a forked backend on the server
([topic 01 chunk 4](../01-jdbc/04-connection-is-expensive.md)). Over a WAN link or
against a loaded database that can be hundreds of milliseconds.

⛔ **A `connectionTimeout` shorter than connection establishment produces a pool
that can never fill.** Every borrow times out before the connection it triggered
finishes being made, so the application fails at 100% while the database is
healthy. The floor of 250 ms exists to make the most extreme version of this
impossible, but 250 ms is a floor, not a safe value.

⚠️ **This is why the value that is right at steady state can be wrong at
failover.** After a database failover, DNS may have changed, the new primary is
cold, and every connection in the pool is dead and must be remade. A two-second
timeout that is generous in normal operation may be tight in exactly the minute
you most want the service to recover. Two seconds plus a retry is usually a
better shape than five seconds and no retry — see
[topic 01 chunk 21e](../01-jdbc/21e-retrying-and-translating.md).

### It is not a query timeout

🔴 **`connectionTimeout` bounds waiting *for* a connection. It says nothing about
what happens after you have one.** A query that runs for an hour is not affected
by any HikariCP setting. Bounding execution needs `Statement.setQueryTimeout()`,
pgjdbc's socket timeouts, or a server-side `statement_timeout` —
[topic 01 chunk 22d](../01-jdbc/22d-server-side-timeouts.md). A pool whose
connections are all held by runaway queries will report `connectionTimeout`
failures forever, and no value of `connectionTimeout` fixes it.

## `validationTimeout` — how long a probe may take

> *This property controls the maximum amount of time that a connection will be
> tested for aliveness. This value must be less than the `connectionTimeout`.
> Lowest acceptable validation timeout is 250 ms. Default: 5000*

Before handing you a connection, the pool checks it is still usable. With a
JDBC4-compliant driver that is `Connection.isValid(timeout)`; otherwise it runs
`connectionTestQuery`. `validationTimeout` bounds that check.

⚠️ **Set `connectionTestQuery` only if you must.** The README:

> *If your driver supports JDBC4 we strongly recommend not setting this property.*

pgjdbc supports JDBC4, so `SELECT 1` as a test query on PostgreSQL is a
copied-in setting that costs a round trip and buys nothing.

### The bypass window

Validating every borrow would be expensive, so HikariCP does not. The source
carries an `aliveBypassWindowMs`, **default 500 ms**
(`com.zaxxer.hikari.aliveBypassWindowMs`): a connection used within the last half
second is handed out without a check.

That is the right trade — a connection that worked 200 ms ago is almost certainly
still fine — but it means **validation is not a guarantee**. On a busy pool most
borrows skip the check entirely. The tools for connections that genuinely went
stale are `maxLifetime` and `keepaliveTime`
([chunk 4b](04b-maxlifetime-and-keepalive.md)), not a shorter validation window.

### Why it must be less than `connectionTimeout`

The validation happens inside the borrow. If validation were allowed to take
longer than the borrow's own budget, a single dead connection could consume the
entire wait and the thread would time out having never been offered a live one.
HikariCP enforces the relationship at startup —
[chunk 4e](04e-when-a-clock-is-silently-disabled.md) covers what it does when the
numbers disagree.

⚠️ **This is a real constraint when you shorten `connectionTimeout`.** Setting
`connection-timeout: 2000` and leaving `validation-timeout` at its default of
5000 is an inconsistent pair, and HikariCP will not run it as written.

## The trade-off

Every one of these clocks trades *failing sooner* against *succeeding later*. A
short `connectionTimeout` frees threads quickly and fails requests that a longer
wait would have served. A short `validationTimeout` rejects a slow-but-alive
connection. The reason there is no universally correct value is that the right
answer depends on whether anyone is waiting — and that is a property of the
workload, not of the pool.

## Gotchas

**⚠️ Leaving `connectionTimeout` at 30 seconds on a user-facing service**
**Symptom:** during an incident, request threads are all held waiting for
connections and the service stops responding to anything, including health
checks.
**Cause:** thirty seconds of holding a thread per doomed request.
**Fix:** one to three seconds on the request path. Fail fast and shed load.

**⚠️ Setting `connectionTimeout` shorter than the connect handshake**
**Symptom:** the pool never fills; 100% failure against a healthy database,
worst on the first deploy in a new network.
**Cause:** the borrow's clock includes creating the connection it is waiting for.
**Fix:** measure connect latency to that database and stay well above it, or
pre-warm the pool.

**⚠️ Expecting `connectionTimeout` to bound a slow query**
**Symptom:** a runaway query holds a connection for an hour and no HikariCP
setting stops it.
**Cause:** the clock ends when the connection is handed over.
**Fix:** `setQueryTimeout`, pgjdbc socket timeouts, or server-side
`statement_timeout`.

**⚠️ Shortening `connectionTimeout` below `validationTimeout`**
**Symptom:** the pool logs a warning at startup and does not use the value you
wrote.
**Cause:** the documented constraint that validation must be shorter than the
borrow budget.
**Fix:** lower both together — `connection-timeout: 2000` with
`validation-timeout: 1000`.

**⚠️ Adding `connectionTestQuery: SELECT 1` on PostgreSQL**
**Symptom:** an extra round trip on validated borrows, and none of the benefit
the setting is imagined to bring.
**Cause:** pgjdbc is JDBC4-compliant, so `isValid()` is used by default and is
cheaper.
**Fix:** remove it. The README says so explicitly.

**⚠️ Trusting validation to catch every dead connection**
**Symptom:** an occasional stale-connection error immediately after a network
event, on a busy pool.
**Cause:** the 500 ms alive-bypass window means most borrows on a hot pool are
not validated at all.
**Fix:** this is intended. Use `maxLifetime` and `keepaliveTime` for staleness.

**⚠️ Copying a whole timeout block between services**
**Symptom:** a batch service that fails instantly under load, or a web service
that hangs for half a minute.
**Cause:** the correct values depend entirely on whether a user is waiting.
**Fix:** decide `connectionTimeout` per workload; it is the setting most
sensitive to that question.

## Interview questions

**★ What exactly does `connectionTimeout` measure?**
The time a thread spends inside `getConnection()` waiting to be handed a
connection. It starts at the call and ends when a connection is returned to the
caller; exceeding it throws `SQLTransientConnectionException`. It is a property of
the *borrower*, not of the connection. In particular it is not a query timeout,
not a socket timeout and not related to how long connections live — those are
separate mechanisms with separate settings, two of which are not HikariCP's at
all.

**★ Why is the default of 30 seconds usually wrong?**
Because on a request path nothing useful happens in those thirty seconds. The
client has usually given up, the load balancer probably has too, and meanwhile
the request thread is held — so a pool shortage converts into a thread shortage
and the service stops answering requests that would have succeeded. Failing in
one to three seconds sheds load, returns a real error while anyone still cares,
and keeps threads circulating. The long default makes sense for batch work and
for tolerating a slow first connection at startup, which is roughly what it was
chosen for.

**★ Can `connectionTimeout` be too short?**
Yes, and the failure is severe: if it is shorter than the time to establish a
connection, a pool that needs to create one can never satisfy a borrow, so the
application fails completely against a perfectly healthy database. That includes
TCP, TLS, authentication and the server forking a backend, which over a WAN or
during a failover is not fast. The floor of 250 ms prevents only the most extreme
version. The practical rule is to know the connect latency to that database and
leave clear headroom above it, and to prefer a short timeout plus a retry over a
long timeout with none.

**★ What is `validationTimeout` and how does it relate to `connectionTimeout`?**
It bounds the aliveness check the pool performs before handing a connection over
— `Connection.isValid()` for a JDBC4 driver, or `connectionTestQuery` otherwise.
The documented constraint is that it must be less than `connectionTimeout`, and
the reason is structural: the check happens *inside* the borrow, so if it could
outlast the borrow's own budget, one dead connection would consume the whole wait
and the thread would fail without ever being offered a live one. The practical
consequence is that lowering `connectionTimeout` means lowering
`validationTimeout` in the same change.

**★ Does HikariCP validate every connection it hands out?**
No, and this surprises people. There is an alive-bypass window — 500 ms by
default, tunable with `com.zaxxer.hikari.aliveBypassWindowMs` — inside which a
recently used connection is handed out without any check. On a busy pool that
means most borrows skip validation entirely, which is a deliberate optimisation:
a connection that worked 200 milliseconds ago is almost certainly still working.
The corollary is that validation is not the mechanism protecting you from stale
connections; connection age is, which is what `maxLifetime` and `keepaliveTime`
are for.

**★ Should you set `connectionTestQuery` on PostgreSQL?**
No. The README says that if the driver supports JDBC4 it strongly recommends not
setting it, and pgjdbc does. Setting it replaces a cheap `isValid()` call with a
full statement round trip on every validated borrow, and buys nothing. It exists
for old or non-compliant drivers. Seeing `SELECT 1` in a HikariCP configuration
is usually a sign the block was copied from a decade-old article, and it is worth
checking what else came with it.

**★ Which of these settings would you expect to differ between two pools in the same application?**
`connectionTimeout`, more than any other, because it encodes whether anyone is
waiting. A request-path pool should give up in a couple of seconds; a reports or
batch pool should queue for thirty or more, since restarting the work is more
expensive than waiting for it. `validationTimeout` follows it down. The age
clocks — `maxLifetime` and `keepaliveTime` — are usually identical between pools
on the same database, because they are set by the network and database
infrastructure rather than by the workload.

---

← Prev: [3f · Wiring a second DataSource](03f-wiring-a-second-datasource.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [4b · maxLifetime](04b-maxlifetime-and-keepalive.md)
