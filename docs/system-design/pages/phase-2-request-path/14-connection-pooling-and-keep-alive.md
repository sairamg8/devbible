---
title: "A connection costs a handshake and a slot at both ends, so it is opened once and reused — keep-alive between client and server, a pool between service and database — and the pool is sized from concurrency, not from request rate: arrival rate times time-in-system, capped by what the database can serve; the herd after a restart is every pool reconnecting at once"
sidebar_label: "14 · Connection pooling and keep-alive"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07. Method and common practice — pool sizing, keep-alive behaviour and the
> reconnection herd are described as every HTTP client, database driver and connection pooler
> implements them, without library names, defaults or figures. The multiplexing fact is
> [RFC 9113](https://www.rfc-editor.org/rfc/rfc9113.html) (many exchanges on one connection);
> the concurrency formula is [phase 1's](../phase-1-the-method/11b-the-load-walk-and-the-price-of-redundancy.md)
> arrival rate times time in the system, stated as method. **No sandbox run.**

**A connection is expensive to open and cheap to keep, so the design reuses it: keep-alive lets
a client send many requests over one HTTP connection, and a pool lets a service hold a fixed
set of connections to its database and lend them to requests one at a time.** The two questions
that decide the design are the same at every hop. *How many?* — a pool is sized from
concurrency, which is arrival rate times the time each request holds a connection, and it is
capped by what the far end can serve: a database that handles a few hundred concurrent queries
well does not get better with a thousand connections, it gets worse, and a hundred service
replicas each holding a pool of twenty is two thousand connections the database never agreed
to. *What happens when they all reconnect at once?* — a database restart, a network blip or a
deploy closes every pooled connection in the fleet, and every pool reconnects in the same
second: a herd of handshakes and authentications against a server that is just coming up.
This page is the cost a connection has at each end, keep-alive and what limits it, the pool
and its sizing arithmetic, the pooler in front of the database that makes the fleet's
connections add up, the herd and how it is tamed, and the storefront's numbers.

## What a connection costs, at both ends

| End | Cost to open | Cost to hold |
|---|---|---|
| **the client / service** | a TCP handshake, a TLS handshake ([10](10-tls-termination-and-where-it-lives.md)), an authentication exchange for a database — round trips and CPU | a socket, buffers, a pool slot |
| **the server / database** | the same handshakes' server side; for a database, a *process or thread* per connection on many engines, with its own memory | memory per connection whether idle or not; scheduling overhead; a hard maximum configured at the server |

The database row is the one that changes the arithmetic: on engines that allocate a backend
process per connection, each connection is megabytes of memory and a scheduler entry, so a
thousand idle connections are a real cost and a thousand *active* ones are contention — the
server is faster with a few hundred connections doing all the work than with thousands each
doing a little. Connections are therefore a scarce resource at the database and a nearly free
one at the service, which is why the pool lives at the service and the cap comes from the
database.

## Keep-alive: the client's side

HTTP/1.1 keeps a connection open after a response so the next request reuses it, saving the
handshakes; the client keeps a small set of connections per host and queues beyond them.
HTTP/2 goes further — many exchanges on one connection, per RFC 9113 — so a client needs one
connection per host. The design details:

- **Idle timeout at both ends, and the server's must be longer than the client's** — or the
  server closes an idle connection at the same moment the client reuses it, and the request
  fails with a reset that looks like a server error. The client retries an idempotent request
  on a fresh connection; a `POST` cannot be retried blindly ([08](08-timeouts-retries-and-budgets.md)).
- **A maximum requests per connection or a maximum age**, so that connections are eventually
  closed and re-resolved — which is what lets DNS changes and drained backends take effect
  ([09](09-dns-as-a-component.md), [12](12-service-discovery.md)). A connection that lives
  forever pins the client to one backend forever.
- **Through a layer-7 proxy**, the client's connection and the proxy's upstream connection are
  separate: the proxy keeps its own pool to each backend and multiplexes many clients' requests
  over it — which is one of the reasons the proxy exists ([03](03-reverse-proxies-and-api-gateways.md)).

## The pool: the service's side

A pool opens n connections to the database at startup (or lazily up to n), lends one to each
request for the duration of its queries, and takes it back. Requests that arrive when all n are
lent out *wait* in a queue with a timeout. Three parameters decide everything: the size n, the
wait timeout, and the connection's maximum lifetime.

**Sizing from concurrency.** The number of connections a service needs is the number of
requests *holding one at the same time*, which is arrival rate × time held:

```text
200 requests/s  ×  5 ms per request on the connection   =  1 connection busy on average → a pool of ~4 absorbs bursts
200 requests/s  ×  50 ms                                =  10 busy → a pool of ~20
200 requests/s  ×  30 s  (the provider call INSIDE the transaction)  =  6,000 busy → no pool size is enough
```

The third line is the checkout design of [phase 1](../phase-1-the-method/08-read-path-and-write-path.md)
seen from the pool: holding a connection across a slow external call is the thing that
exhausts every pool, and no size fixes it — the fix is not to hold the connection.

**Capping from the database.** The fleet's total — replicas × pool size — must stay under what
the database serves well, which for most engines is a few hundred *active* connections, not
thousands. Ten replicas × 20 = 200, fine; a hundred replicas × 20 = 2,000, not fine, and the
autoscaler that added replicas under load added connections to a database already struggling
— which is the "doubling replicas doubles pools" row of [phase 1's load walk](../phase-1-the-method/11b-the-load-walk-and-the-price-of-redundancy.md).

**The wait timeout.** Short — tens to hundreds of milliseconds — and it fails the request with
an error that says "pool exhausted", which is a capacity signal the dashboard should show,
rather than letting requests queue until the client's deadline passes. A long wait converts a
pool shortage into latency and hides it.

**Maximum lifetime.** Connections are retired after minutes and replaced, so that the pool
re-resolves and rebalances, and so that a database failover or a pooler restart is absorbed
gradually rather than discovered all at once.

```ts
// a pool's contract, in shape — the parameters are the design; the library is not the point
export interface PoolOptions {
  max: number;                 // replicas × max must stay under the database's comfortable active-connection count
  acquireTimeoutMs: number;    // short: fail fast with "pool exhausted" — a capacity signal, not a queue
  maxLifetimeMs: number;       // retire and replace, so DNS/failover/rebalance happen gradually
  idleTimeoutMs: number;       // shrink when idle; keep a minimum warm
  min: number;                 // warm connections after start — but see the herd below
}

// the sizing sentence, as code — nothing here runs; it is the arithmetic said in the round
export function poolSizeFor(requestsPerSecond: number, holdMs: number, burstFactor = 2): number {
  const busy = requestsPerSecond * (holdMs / 1000);       // arrival rate × time held = connections busy on average
  return Math.ceil(busy * burstFactor);
}
// poolSizeFor(200, 5)  → 2      poolSizeFor(200, 50) → 20      poolSizeFor(200, 30_000) → 12,000 — redesign, don't resize
```

## The pooler in front of the database

When the fleet's pools add up to more than the database wants, a **connection pooler** sits in
front of it: the services connect to the pooler (cheaply — it is built to hold thousands of
client connections), and the pooler holds a small pool of real connections to the database and
multiplexes the services' *transactions* onto them. Two thousand service connections become two
hundred database connections. The cost is the *transaction mode* trade: because a real
connection is lent per transaction rather than per client, anything that relies on per-session
state at the database — prepared statements bound to a session, session variables, advisory
locks held across transactions, temporary tables — either breaks or must be avoided; and the
pooler is one more box on the failure walk and a hop of a few hundred microseconds. It is the
standard answer to "a hundred replicas and one database", and the sentence includes the trade:
*"a pooler in transaction mode, so the fleet's pools multiplex onto a few hundred real
connections; we give up session-level features, which the services don't use."*

## The herd after a restart

The database restarts, or fails over, or the pooler is deployed, or a network blip resets every
socket. Every pool in the fleet notices at once, and every pool reconnects at once: a thousand
TLS handshakes and authentications in the same second against a server that is still warming
up — which can push it over, so it resets again, so the pools reconnect again. The same shape as
the reconnection storm of [06](06-long-lived-connections.md), at the database. Four mechanisms:

1. **Jittered backoff on reconnect** in the pool — the first reconnect after a random delay,
   growing on failure.
2. **Lazy warm-up** — do not open `min` connections all at once at startup; open them as
   requests need them, or spread over seconds.
3. **A connection rate limit at the pooler or database** — accept n new connections a second
   and queue the rest, so the herd becomes a line.
4. **Staggered lifetimes** — random maximum lifetimes, so the fleet's connections do not all
   expire in the same second after a fleet-wide start.

And the deploy that starts a hundred replicas at once is the same herd from the other side:
rolling deploys ([02](02-load-balancing-layer-4-vs-layer-7.md)) exist partly so that pools warm
up a few at a time.

## The storefront

```text
browser → CDN / gateway      HTTP/2 keep-alive; the gateway's server idle timeout longer than clients'
gateway → services           HTTP/1.1 from a per-backend pool at the gateway; max age 5 min; re-resolve on new connections
services → PostgreSQL        pool per replica: max 10 (200 req/s × ~20 ms × 2 burst ≈ 8); acquire timeout 200 ms; max lifetime 10 min ± jitter
                             8 replicas × 10 = 80 direct today; a pooler in transaction mode when the fleet passes ~30 replicas
services → Redis             a small pool, or a single multiplexed connection per replica — Redis is fast enough that one usually suffices
order svc → provider         an HTTP pool with keep-alive; the call is outside the transaction, so no database connection waits on it
on restart                   pools warm lazily with jittered reconnect; the pooler admits 50 new connections/s
```

The second-to-last row is the whole page's point restated: the provider's thirty seconds are
spent holding an HTTP connection from a cheap pool, never a database connection from the scarce
one.

## Gotchas

**★ Symptom: "pool exhausted" errors during the sale.** Cause: connections held across a slow
call — the provider inside the transaction — so the pool's arithmetic explodes. Fix: commit
first, call after; no pool size fixes a 30-second hold.

**★ Symptom: autoscaling added replicas and the database got slower.** Cause: replicas × pool
size exceeded the database's comfortable active count. Fix: cap the fleet's total; a pooler in
transaction mode when the fleet is large.

**★ Symptom: after a database failover, a second outage from the reconnect storm.** Cause:
every pool reconnecting at once. Fix: jittered reconnect backoff, lazy warm-up, a connection
rate limit at the pooler, staggered lifetimes.

**Symptom: intermittent connection resets on the first request after idle.** Cause: the
server's idle timeout shorter than the client's, closing the connection the client is about to
reuse. Fix: the server's idle timeout longer than any client's; idempotent retry on a fresh
connection.

**Symptom: the pool is sized "to be safe" at 100 per replica.** Cause: size confused with
capacity. Fix: arrival rate × hold time × a burst factor — usually tens, not hundreds; the
excess is memory at the database.

**Symptom: pool waits of two seconds and no error.** Cause: a long acquire timeout turning
shortage into latency. Fix: a short acquire timeout that fails fast; the "pool exhausted" count
on the dashboard.

**Symptom: prepared statements failing behind the pooler.** Cause: transaction mode lends
connections per transaction; session state is not preserved. Fix: no session-level features —
or session mode for the few clients that need them, with the connection cost that implies.

**Symptom: a drained backend still receives traffic from the gateway.** Cause: pooled
connections with no maximum age. Fix: a max age or max requests per connection so the pool
re-resolves and rebalances.

**Symptom: one database connection per request, opened and closed.** Cause: no pool at all.
Fix: a pool — the handshake and authentication per request is the cost that a pool exists to
remove.

**Symptom: the pool's `min` warmed a hundred connections at startup across a hundred replicas.**
Cause: eager warm-up × fleet size. Fix: lazy or staggered warm-up; a rolling deploy.

## Interview questions

**★ How do you size a database connection pool?**
From concurrency, not request rate: connections busy on average equal arrival rate times the
time each request holds a connection — two hundred requests a second at twenty milliseconds is
four busy, so a pool of eight or ten absorbs bursts. Then cap the fleet's total — replicas times
pool size — under what the database serves well, a few hundred active connections on most
engines, using a pooler in transaction mode when the fleet is large. A short acquire timeout
makes shortage an error rather than latency, and a maximum lifetime lets the pool re-resolve and
rebalance. If the arithmetic gives thousands, the hold time is the problem — a slow call inside
the transaction — and the fix is the design, not the size.

**★ Why does a slow external call inside a transaction exhaust the pool?**
Because the connection is held for the call's duration: two hundred checkouts a second at
thirty seconds each is six thousand connections busy, which no pool provides and no database
accepts — the pool exhausts in seconds and every request behind it waits or fails. Commit the
order first, release the connection, then call the provider from a cheap HTTP pool with its own
timeout, and finish the order in a second, short transaction. The scarce connection is never
lent across the slow hop.

**★ What is the reconnection herd, and how is it tamed?**
Every pool in the fleet discovering at the same instant that its connections are gone — after a
database restart, a failover, a pooler deploy or a network blip — and reconnecting at once:
thousands of TLS handshakes and authentications against a server that is still coming up,
which can push it over and repeat the cycle. Tamed by jittered exponential backoff on reconnect,
lazy or staggered warm-up instead of opening a minimum at once, a connection admission rate at
the pooler or database that turns the herd into a queue, and randomised connection lifetimes so
a fleet-wide start does not produce a fleet-wide expiry.

**What does a connection pooler in front of the database buy, and what does it cost?**
It lets a large fleet's pools multiplex onto a small number of real database connections: two
thousand service connections become two hundred at the database, which is faster with fewer
active connections than with thousands. In transaction mode a real connection is lent per
transaction, so anything relying on session state at the database — prepared statements bound
to a session, session variables, advisory locks across transactions, temporary tables — breaks
or must be avoided; and the pooler is a hop and a box on the failure walk. Name the trade:
fleet-scale connections for no session-level features.

**Why must the server's keep-alive idle timeout exceed the client's?**
Because the two ends decide independently when an idle connection is dead: if the server
closes it first, the client may be reusing it at that same moment and the request fails with a
connection reset that looks like a server error. With the server's timeout longer, the client
closes first and never reuses a dead connection. The residual case — a reset in flight — is
retried on a fresh connection for idempotent requests, and not for a `POST` without a key.

**Why do pooled connections need a maximum lifetime?**
So that the pool periodically re-resolves the target and rebalances: a connection that lives
forever pins the client to one backend through DNS changes, discovery updates and drains, and
means a database failover or a pooler restart is discovered by every connection at once rather
than gradually. Retiring connections after minutes — with jitter so they do not all expire
together — makes topology changes take effect and spreads reconnection over time.

---

← Prev: [13 · Serialization on the wire](13-serialization-on-the-wire.md) · Index: [Phase 2 — The request path](README.md) · Next → [15 · The path in the storefront](15-the-path-in-the-storefront.md)
