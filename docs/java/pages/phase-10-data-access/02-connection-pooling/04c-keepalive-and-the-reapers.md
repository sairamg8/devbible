---
title: "maxLifetime cannot save a connection that is young and untouched — keepaliveTime is the heartbeat that can"
sidebar_label: "4c · keepaliveTime and the reapers"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the HikariCP 7.0.2 README
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP),
> raw at tag `HikariCP-7.0.2`) and its source (`pool/HikariPool.java`,
> `pool/PoolBase.java`), the PostgreSQL 18 documentation for
> `idle_session_timeout` and `idle_in_transaction_session_timeout`
> ([postgresql.org/docs/18/runtime-config-client.html](https://www.postgresql.org/docs/18/runtime-config-client.html)),
> and the pgjdbc connection-parameter reference
> ([jdbc.postgresql.org/documentation/use/](https://jdbc.postgresql.org/documentation/use/)).
> JDK 25, HikariCP 7.0.2, PostgreSQL 18, pgjdbc 42.7.13.

**[Chunk 4b](04b-maxlifetime-and-keepalive.md) retires connections that grow old.
This chunk deals with the other half: a connection that is only ten minutes old
but has not been touched for ten minutes. Age-based retirement will not help it,
because it is young — and a firewall reaping idle flows does not check the
birthday. The pool needs to generate traffic on purpose.**

## `keepaliveTime` — a heartbeat for idle connections

A pool of ten on a service receiving one request a minute has nine connections
sitting untouched at any moment. Those nine are precisely the ones a middlebox
will decide are dead.

> *This property controls how frequently HikariCP will attempt to keep a
> connection alive, in order to prevent it from being timed out by the database
> or network infrastructure. This value must be less than the `maxLifetime`
> value.* ... *The minimum allowed value is 30000ms (30 seconds), but a value in
> the range of minutes is most desirable. Default: 120000 (2 minutes)*

The mechanism, from the source: keepalive **operates only on idle connections**.
The connection is removed from the pool so nobody can borrow it mid-check, pinged
with `Connection.isValid()` (or `connectionTestQuery` if one is set), and
returned. A ping that fails means the connection is evicted and replaced rather
than handed to a request — which is the whole point: the failure is absorbed by a
background thread instead of by a user's request.

```yaml
spring:
  datasource:
    hikari:
      max-lifetime: 240000     # 4 min — under a 350 s infrastructure reaper
      keepalive-time: 60000    # 1 min — well under both
      validation-timeout: 1000 # bounds the ping as well as a borrow's check
```

⚠️ **The ping is the same aliveness check a validated borrow performs, so
`validationTimeout` bounds it.** Lowering `validationTimeout` for the sake of the
request path also shortens the keepalive probe, which is usually fine and
occasionally not — a database that is slow but alive can fail its keepalive and
have a perfectly good connection thrown away and remade.

⚠️ **A connection being pinged is out of the pool.** On a pool sized exactly to
demand, a keepalive in flight transiently reduces the available connections by
one. It is a small effect and a real one, and it is one more argument against
sizing a pool with no headroom at all.

## The two ways keepalive turns itself off

🔴 **Neither of these produces an error, and one of them is easy to create by
accident:**

| Condition | Result |
|---|---|
| `keepaliveTime` < 30000 | **disabled** |
| `keepaliveTime` >= `maxLifetime` | **disabled** |

The second is the trap. Lower `maxLifetime` to 60000 — a perfectly reasonable
thing to do behind an aggressive reaper — leave `keepaliveTime` at its 120000
default, and keepalive is silently off. The setting is present in the file, it
looks configured, and nothing happens. [Chunk 4e](04e-when-a-clock-is-silently-disabled.md)
collects every rule of this shape.

## This is not TCP keepalive

pgjdbc exposes a `tcpKeepAlive` connection property that enables `SO_KEEPALIVE`
on the socket, and the operating system has its own probe intervals. Those work
at the transport layer, their defaults are frequently measured in hours, and some
middleboxes do not count bare keepalive probes as activity at all.

HikariCP's `keepaliveTime` is an **application-level round trip to the database**
— a real query on a real connection, which every reaper in the path counts as
use. The two are complementary. Enabling the socket option is not a substitute
for the pool setting, and the pool setting is the one that reliably works.

## The server-side reapers

PostgreSQL has its own idle timeouts. Both are **off by default**, and the
documentation attaches a warning to one of them aimed directly at this page:

> *Be wary of enforcing this timeout on connections made through
> connection-pooling software or other middleware, as such a layer may not react
> well to unexpected connection closure.*

That is `idle_session_timeout`. It kills any session that has been idle too long
— which, for a pool, describes normal healthy behaviour. Turning it on in front
of a pool means committing to a `maxLifetime` below it and accepting the churn.

Its sibling `idle_in_transaction_session_timeout` is a different and much safer
setting. It kills sessions sitting idle **inside an open transaction**, which is
never healthy: such a session holds its locks, keeps its snapshot, and blocks
vacuum from cleaning up rows newer than it. That is a genuine pathology, usually
caused by application code that opened a transaction and then went off to call an
HTTP service. Enabling it is generally a good idea, and it will surface bugs
rather than cause them.

| Setting | Default | Safe in front of a pool? |
|---|---|---|
| `idle_session_timeout` | 0 (off) | ⚠️ only with `maxLifetime` below it |
| `idle_in_transaction_session_timeout` | 0 (off) | ✅ yes — it targets a real bug |
| `transaction_timeout` | 0 (off) | ✅ bounds a whole transaction |
| `statement_timeout` | 0 (off) | ✅ the one most services should set |

## The trade-off

Keepalive costs a round trip per idle connection per interval. On a pool of ten
with a one-minute keepalive that is six hundred trivial queries an hour — nothing
in database terms, but it is not zero, and on a fleet of fifty instances it is
thirty thousand. More interesting is the second cost: a connection that is *slow*
rather than dead can fail its ping and be discarded, so an aggressive keepalive
against a struggling database adds connection churn at exactly the wrong moment.
The setting wants to be in minutes, as the README says, not seconds.

## Gotchas

**⚠️ `keepaliveTime` at or above `maxLifetime`**
**Symptom:** keepalive appears configured and does nothing at all.
**Cause:** HikariCP disables it when the relationship is violated — easily
created by lowering `maxLifetime` and forgetting the two-minute keepalive
default.
**Fix:** change both together; treat them as a pair, not two settings.

**⚠️ `keepaliveTime` below 30 seconds**
**Symptom:** silently disabled.
**Cause:** the documented minimum.
**Fix:** minutes, not seconds. The README says a value in the range of minutes is
most desirable.

**⚠️ Expecting keepalive to protect a busy connection**
**Symptom:** it makes no measurable difference on a hot pool.
**Cause:** it operates only on *idle* connections; a busy one is kept alive by
its own traffic.
**Fix:** correct behaviour. Keepalive is for quiet periods and for the tail of a
pool larger than current demand.

**⚠️ Relying on TCP keepalive instead**
**Symptom:** `tcpKeepAlive` is enabled and connections still get reaped.
**Cause:** operating-system probe intervals default to a very long time, and some
middleboxes ignore keepalive probes when deciding a flow is idle.
**Fix:** use the pool's application-level ping. The socket option is
complementary.

**⚠️ Setting keepalive aggressively against a slow database**
**Symptom:** connection churn rises during exactly the incident you are trying to
survive.
**Cause:** a slow-but-alive connection fails its `isValid()` inside
`validationTimeout` and is discarded.
**Fix:** keepalive in minutes, and a `validationTimeout` that is not so tight it
mistakes slowness for death.

**⚠️ Enabling `idle_session_timeout` in front of a pool**
**Symptom:** the database starts closing pooled connections; the application sees
class 08 errors from threads that did nothing wrong.
**Cause:** exactly what the PostgreSQL documentation warns about.
**Fix:** if it must be on, set `maxLifetime` comfortably below it. Prefer
`idle_in_transaction_session_timeout`, which targets a real bug.

**⚠️ Assuming a quiet environment is a safe one**
**Symptom:** staging, which is idle overnight, breaks every morning while
production never does.
**Cause:** production's traffic keeps connections warm; staging's does not, so
staging is the environment where idle reaping actually happens.
**Fix:** the same `maxLifetime` and `keepaliveTime` everywhere. A low-traffic
environment needs them *more*.

**⚠️ Sizing a pool with no headroom while keepalive is on**
**Symptom:** occasional borrow waits on a pool that should never be full.
**Cause:** a connection under a keepalive ping is out of the pool for the
duration of the round trip.
**Fix:** small, but a reason not to run a pool at exactly its ceiling.

## Interview questions

**★ What does `keepaliveTime` do that `maxLifetime` does not?**
It addresses idleness rather than age. A connection that is ten minutes old but
has not been used for ten minutes is a perfect candidate for a firewall to reap,
and `maxLifetime` will not touch it because it is young. Keepalive periodically
takes an idle connection out of the pool, pings it with `isValid()`, and puts it
back — which both proves it is still alive and generates the traffic that stops a
middlebox deciding the flow is dead. It runs only on idle connections, because a
busy one is already generating its own traffic.

**★ Both are configured and connections still die. What did you get wrong?**
Most often, `keepaliveTime` is silently disabled. HikariCP turns it off if it is
below 30 seconds, or if it is greater than or equal to `maxLifetime` — and the
second happens whenever someone lowers `maxLifetime` to a minute and leaves
keepalive at its two-minute default. The other common answer is that the reaper
in the path is shorter than anyone realised, because it belongs to a network team
and can change without a deployment. The confirming evidence is the pool's own
WARN, *"Failed to validate connection ... Possibly consider using a shorter
maxLifetime value"* — the pool naming the fix.

**★ A query hangs forever instead of failing. How does that relate to these settings?**
It means the connection was killed by something that dropped the flow without
sending a TCP reset, which is common NAT and firewall behaviour. The socket is
open as far as the JVM is concerned, so the driver sends a query and waits for a
reply that will never come. Neither `maxLifetime` nor `keepaliveTime` can rescue
a query that has already been issued — they reduce how often you reach that
state. What bounds it is a socket-level read timeout on the driver, which is why
a robust configuration has all three, and why a pool with perfect clocks and no
socket timeout still has an unbounded failure mode.

**★ Would you turn on PostgreSQL's `idle_session_timeout`?**
Cautiously, and only with `maxLifetime` set below it, because the documentation
warns explicitly that connection-pooling software may not react well to
unexpected connection closure — the server killing pooled connections is the
exact failure the pool's own clocks exist to avoid. The related
`idle_in_transaction_session_timeout` is a different matter and usually worth
enabling: a session idle *inside* a transaction holds locks, pins its snapshot
and blocks vacuum, which is a real bug rather than normal pool behaviour.

**★ Is HikariCP's keepalive the same as TCP keepalive?**
No, and treating them as interchangeable is a common way to be surprised.
`tcpKeepAlive` in pgjdbc enables `SO_KEEPALIVE` at the socket layer, where the
operating system sends empty probes on its own schedule — a schedule whose
defaults are usually far longer than any middlebox idle timeout, and which some
middleboxes do not count as activity when deciding whether a flow is in use.
HikariCP's `keepaliveTime` issues a real application-level round trip on the
connection, which every layer counts. Use the pool setting; enable the socket
option as well if you like, but do not rely on it.

**★ Why does staging break and production not?**
Because production's traffic keeps connections warm and staging's idleness is
exactly the condition idle reapers act on. It is a genuinely counter-intuitive
result — the environment nobody uses is the one where connections die — and it is
the reason these settings should be identical across environments rather than
"tuned for production". A low-traffic environment needs `keepaliveTime` more than
a busy one, not less.

**★ Could keepalive make things worse during an incident?**
Yes, in one specific way. The ping is bounded by `validationTimeout`, so a
database that is slow but alive can fail the check, and HikariCP will discard a
perfectly usable connection and open a new one. Under load that adds connection
setup — handshake, authentication, a new backend process — to a server that is
already struggling. It is an argument for keepalive intervals in minutes rather
than seconds, and for a `validationTimeout` that is not so tight it mistakes
slowness for death.

---

← Prev: [4b · maxLifetime](04b-maxlifetime-and-keepalive.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [4d · idleTimeout and minimumIdle](04d-idletimeout-and-minimumidle.md)
