---
title: "Something else will kill your connections, so retire them yourself first — on a schedule with jitter in it"
sidebar_label: "4b · maxLifetime"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the HikariCP 7.0.2 README
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP),
> raw at tag `HikariCP-7.0.2`) and its source (`pool/HikariPool.java`
> `createPoolEntry()`, `pool/PoolBase.java`), and the PostgreSQL 18 documentation
> for `idle_session_timeout` and `idle_in_transaction_session_timeout`
> ([postgresql.org/docs/18/runtime-config-client.html](https://www.postgresql.org/docs/18/runtime-config-client.html)).
> JDK 25, HikariCP 7.0.2, PostgreSQL 18, pgjdbc 42.7.13.

**A pooled connection is a TCP socket that stays open for hours doing nothing.
Almost every piece of infrastructure between your JVM and the database considers
that suspicious: load balancers, NAT gateways and firewalls all reap idle flows,
usually without telling either end. The connection is then dead in a particularly
unhelpful way — the pool still has it, hands it out, and your query fails.
`maxLifetime` and `keepaliveTime` are the two defences, and they defend against
different halves of the problem: `maxLifetime` handles connections that grow
*old*, and it is this chunk. [Chunk 4c](04c-keepalive-and-the-reapers.md) handles
connections that sit *idle*.**

## `maxLifetime` — retire connections before anything else does

> *This property controls the maximum lifetime of a connection in the pool. An
> in-use connection will never be retired, only when it is closed will it then be
> removed.* ... ***We strongly recommend setting this value, and it should be
> several seconds shorter than any database or infrastructure imposed connection
> time limit.*** *A value of zero indicates no maximum lifetime (infinite
> lifetime) ... The minimum allowed value is 30000ms (30 seconds). Default:
> 1800000 (30 minutes)*

That is one of only two places in the whole README where the authors write
**strongly recommend**, and the reason is that the default of 30 minutes is
longer than several common infrastructure timeouts.

| Thing in the path | Typical idle limit |
|---|---|
| a cloud network load balancer | often around 350 seconds, sometimes configurable |
| a NAT gateway | commonly 350 seconds |
| a stateful firewall's TCP idle rule | frequently 300–3600 seconds, set by someone else |
| PostgreSQL `idle_session_timeout` | 0 (off) by default — but often turned on |
| a managed database proxy | varies, and changes without your involvement |

🔴 **The rule is: `maxLifetime` must be comfortably below the *smallest* of
those.** Not equal to it. The README says *several seconds shorter*, and in
practice a minute of margin is cheap insurance. A common safe value against a
350-second reaper is `max-lifetime: 240000` (four minutes).

⚠️ **`maxLifetime: 0` means infinite, and it is almost never right.** It is
occasionally chosen deliberately — "we do not want connection churn" — and it
guarantees that every connection eventually meets whatever reaps it.

## The jitter, and why it exists

🔴 **The configured value is a ceiling, not the actual lifetime.** In
`createPoolEntry()`, HikariCP applies a random negative variance of **up to 25%**
to each connection's lifetime (governed by a `lifeTimeVarianceFactor`, default 4).
An effective lifetime is therefore somewhere in **75–100% of `maxLifetime`**.

The reason is mass extinction. A pool of ten connections opened within a second
of each other at startup would, without jitter, all expire within a second of
each other thirty minutes later. Every borrow in that window would have to wait
for a fresh handshake, and the database would see ten simultaneous new backends —
a self-inflicted thundering herd, repeating on a fixed period forever. Spreading
the retirements turns a cliff into a trickle.

Two consequences worth holding on to:

- **The variance is only downward**, so it always moves you *further* from the
  infrastructure timeout. The margin is safe.
- **The configured number is not the observed number.** A connection retired
  after 23 minutes on a 30-minute setting is behaving correctly, not oddly.

`keepaliveTime` gets the same treatment with a variance of **up to 20%**, for the
same reason.

## "In-use connections are never retired"

This sentence in the README has a consequence people meet exactly once:

**A connection held by a long-running query outlives `maxLifetime` and is only
retired when it is returned.** A report holding a connection for two hours
against a four-minute `maxLifetime` keeps that connection for two hours — and if
the infrastructure's idle reaper is not idle-based but absolute, or if the query
finishes and the connection is *then* found dead, the failure lands on whoever
borrows it next.

⚠️ It is also why `maxLifetime` cannot be used as a leak remedy. A leaked
connection is "in use" forever from the pool's point of view, so it is never
retired. That is [chunk 6](06-leak-detection.md).

## What a reaped connection looks like

The failure is confusing because it does not arrive when the connection is
killed. It arrives on the next borrow, from a thread that did nothing wrong:

- if HikariCP validates the connection, it is quietly evicted and replaced, and
  you see a WARN from `PoolBase`: *"Failed to validate connection {} ({}).
  Possibly consider using a shorter maxLifetime value."* — which is the pool
  telling you precisely what this chunk is about;
- if the borrow falls inside the 500 ms alive-bypass window
  ([chunk 4](04-the-six-clocks.md)), no check happens and the query itself fails
  — typically a SQLState in class **08**, *connection exception*
  ([topic 01 chunk 21c](../01-jdbc/21c-what-pgjdbc-throws.md));
- if the middlebox dropped the flow silently rather than sending a reset, the
  query **hangs** until pgjdbc's socket timeout, which is a different setting
  again ([topic 01 chunk 22b](../01-jdbc/22b-connection-and-socket-timeouts.md)).

That third case is the worst, and it is the argument for setting a socket timeout
as well as these two clocks.

## The trade-off

Every retirement is a fresh handshake, a fresh authentication and a fresh backend
process on the database. A four-minute `maxLifetime` on a pool of ten is 150
connection setups an hour that a thirty-minute setting would not have paid for —
which is real load on the database and real latency for whichever borrow has to
wait for one. You are buying reliability with churn. Setting it too high buys the
churn back and pays for it in unpredictable failures instead, which is a worse
currency.

## Gotchas

**⚠️ `maxLifetime` longer than an infrastructure idle timeout**
**Symptom:** intermittent connection errors with no pattern, often worse after
quiet periods.
**Cause:** a load balancer, NAT gateway or firewall reaped the flow and the pool
still believes it is alive.
**Fix:** find the *smallest* idle limit in the path and set `maxLifetime`
comfortably below it.

**⚠️ Setting `maxLifetime` to exactly the infrastructure limit**
**Symptom:** the same errors, much rarer, and therefore harder to attribute.
**Cause:** the two clocks are not synchronised and a retirement decision is not
instantaneous.
**Fix:** the README's *"several seconds shorter"* is a minimum; a minute of
margin costs almost nothing.

**⚠️ `maxLifetime: 0` to avoid churn**
**Symptom:** connections that work for weeks in one environment and fail daily in
another.
**Cause:** infinite lifetime means the connection lives until something else
kills it, and what that something is differs per environment.
**Fix:** set a value. The churn is the price of predictability.

**⚠️ Expecting `maxLifetime` to reclaim an in-use connection**
**Symptom:** a two-hour report holds a connection right through a four-minute
lifetime setting.
**Cause:** the README is explicit — in-use connections are retired only when
closed.
**Fix:** bound query execution with a server-side `statement_timeout`; use
`leakDetectionThreshold` to find connections nobody is returning.

**⚠️ One `maxLifetime` copied across environments with different networks**
**Symptom:** production is fine and a second region is not, on identical
configuration.
**Cause:** the reaper is a property of the network path, and paths differ per
environment — a different load balancer, a NAT gateway that only exists in one
place, a firewall managed by a different team.
**Fix:** the value is a function of the infrastructure, so it has to be checked
per environment even though the code is the same.

**⚠️ Lowering `maxLifetime` to drain the pool after a credential rotation**
**Symptom:** it works, eventually, over the next several minutes, while requests
fail.
**Cause:** retirement is gradual by design, and jitter spreads it further.
**Fix:** `softEvictConnections()` through JMX
([chunk 8d](08d-the-database-side.md)) drains the pool immediately and without a
restart. `maxLifetime` is a steady-state setting, not an operational lever.

**⚠️ Reading the configured lifetime off a dashboard and being confused**
**Symptom:** connections retiring after 23 minutes on a 30-minute setting.
**Cause:** the deliberate downward jitter of up to 25%.
**Fix:** nothing — that is the anti-herd mechanism working.

## Interview questions

**★ Why does a connection pool need `maxLifetime` at all?**
Because a pooled connection is a long-lived TCP socket, and the network is full
of things that quietly close long-lived idle sockets — load balancers, NAT
gateways, stateful firewalls, and the database's own idle timeouts. When one of
them reaps a connection, the pool is usually not told; it keeps the entry, hands
it out, and the failure lands on an unrelated request. `maxLifetime` retires
connections on your own schedule so that you replace them at a moment of your
choosing rather than discovering they are dead at a moment of somebody else's.
HikariCP's README says it should be several seconds shorter than any
infrastructure-imposed connection time limit, and that is the whole design rule.

**★ Why is there random variance in the lifetime?**
To prevent a thundering herd. Connections in a pool are created at nearly the
same instant — at startup, or in a burst when demand rises — so a fixed lifetime
would retire them all at nearly the same instant too. That produces a periodic
cliff where the pool is briefly empty, every borrow waits for a full handshake,
and the database sees a batch of simultaneous new backends. HikariCP applies a
downward variance of up to 25% to each connection's lifetime, and up to 20% to
keepalive, so retirements are spread out. The variance is only negative, so it
never erodes the margin you set against an infrastructure timeout.

**★ How do you pick `maxLifetime` when you do not own the network?**
By finding the smallest idle timeout anywhere in the path and setting it
comfortably below that — which usually means asking, because the reapers belong
to other teams: a load balancer, a NAT gateway, a firewall rule, a managed
database proxy. The README's guidance is *several seconds shorter*; a minute of
margin costs very little and absorbs a change you were not told about. When
nobody can tell you the number, the pragmatic default is a few minutes, since
most middlebox idle timeouts cluster in the region of five, and the jitter only
ever moves you further into safety.

**★ Does `maxLifetime` protect you from a database restart or failover?**
No. Those kill every connection at once, and connection age has nothing to do
with it — a connection created one second before the failover is just as dead as
one created an hour before. `maxLifetime` defends against connections being
reaped *quietly* over time; a restart is loud and immediate, and what handles it
is validation on borrow, keepalive on idle connections, and a retry policy. The
operational lever for a planned failover is `softEvictConnections()`, which
replaces every connection deliberately rather than waiting for them to be
discovered dead one request at a time.

**★ What does a short `maxLifetime` cost?**
Connection churn, and it is a real cost rather than a theoretical one. Every
retirement means a TCP handshake, a TLS handshake, an authentication round trip
and a new forked backend process on the PostgreSQL server. A pool of ten on a
four-minute lifetime creates roughly a hundred and fifty connections an hour that
a thirty-minute lifetime would not. That is load on the database and occasional
latency for the borrow that has to wait for a replacement. The trade is worth it
because the alternative — connections dying unpredictably — costs failed requests
instead of CPU, and failed requests are more expensive.

---

← Prev: [4 · The six clocks](04-the-six-clocks.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [4c · keepaliveTime and the reapers](04c-keepalive-and-the-reapers.md)
